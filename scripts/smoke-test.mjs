#!/usr/bin/env node
/**
 * CDP smoke test harness for the Retro app (zero npm dependencies).
 *
 * Expects the app server to already be running (default http://localhost:8000).
 * Boots headless Chrome, registers a throwaway user, completes onboarding,
 * then drives the real /app UI through a local proxy that stubs only
 * /api/v1/subscription/status (tier: "pro" so all sky colors unlock).
 *
 * Usage:  node scripts/smoke-test.mjs
 * Env:    BASE_URL (default http://localhost:8000)
 *         CHROME_PATH (default "C:/Program Files/Google/Chrome/Application/chrome.exe")
 *
 * Exit 0 = pass, 1 = fail.
 */

import { spawn } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import http from "node:http";

const BASE_URL = process.env.BASE_URL || "http://localhost:8000";
const CHROME_PATH =
  process.env.CHROME_PATH || "C:/Program Files/Google/Chrome/Application/chrome.exe";
const CDP_PORT = 9223;

// Console errors that are known-benign under this harness (API stubbing side
// effects). Real failures = uncaught exceptions and [VANTA] errors.
const BENIGN_ERRORS = [
  "Failed to load user profile",
  "Error finding empty session",
  "Failed to check user tier",
  "net::ERR_FAILED", // fetches blocked by stub, if any
];

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

let failed = false;
const failures = [];
function fail(msg) {
  failed = true;
  failures.push(msg);
  console.error(`  ✗ ${msg}`);
}
function pass(msg) {
  console.log(`  ✓ ${msg}`);
}

// ---------------------------------------------------------------------------
// Cookie-jar API client against the real server
// ---------------------------------------------------------------------------
class ApiClient {
  constructor(baseUrl) {
    this.baseUrl = baseUrl.replace(/\/$/, "");
    this.cookies = new Map();
  }

  cookieHeader() {
    return [...this.cookies.entries()].map(([k, v]) => `${k}=${v}`).join("; ");
  }

  captureCookies(res) {
    const raw = res.headers.getSetCookie?.() || [];
    for (const line of raw) {
      const [pair] = line.split(";");
      const idx = pair.indexOf("=");
      if (idx > 0) this.cookies.set(pair.slice(0, idx).trim(), pair.slice(idx + 1).trim());
    }
  }

  async request(path, { method = "GET", body } = {}) {
    const res = await fetch(`${this.baseUrl}${path}`, {
      method,
      headers: {
        "Content-Type": "application/json",
        ...(this.cookies.size ? { Cookie: this.cookieHeader() } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
    });
    this.captureCookies(res);
    let json = null;
    try {
      json = await res.json();
    } catch {
      /* non-JSON response */
    }
    return { status: res.status, json };
  }
}

// ---------------------------------------------------------------------------
// Local proxy: real /app HTML + stubbed subscription status, everything else
// forwarded to the real server with the session cookies.
// ---------------------------------------------------------------------------
async function startProxy(api) {
  const server = http.createServer(async (req, res) => {
    try {
      const url = new URL(req.url, "http://local");

      if (url.pathname === "/api/v1/subscription/status") {
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ subscription: { tier: "pro" } }));
        return;
      }

      const upstream = await fetch(`${api.baseUrl}${req.url}`, {
        method: req.method,
        headers: {
          ...(api.cookies.size ? { Cookie: api.cookieHeader() } : {}),
          ...(req.headers["content-type"]
            ? { "Content-Type": req.headers["content-type"] }
            : {}),
        },
        body: ["GET", "HEAD"].includes(req.method)
          ? undefined
          : await readBody(req),
      });

      const headers = {};
      upstream.headers.forEach((v, k) => {
        if (!["set-cookie", "content-encoding", "transfer-encoding"].includes(k))
          headers[k] = v;
      });
      res.writeHead(upstream.status, headers);
      const buf = Buffer.from(await upstream.arrayBuffer());
      res.end(buf);
    } catch (err) {
      res.writeHead(502, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ success: false, message: err.message }));
    }
  });
  await new Promise((r) => server.listen(0, "127.0.0.1", r));
  return { server, port: server.address().port };
}

function readBody(req) {
  return new Promise((resolve) => {
    const chunks = [];
    req.on("data", (c) => chunks.push(c));
    req.on("end", () => resolve(Buffer.concat(chunks)));
  });
}

// ---------------------------------------------------------------------------
// Chrome + CDP
// ---------------------------------------------------------------------------
class Cdp {
  constructor(ws) {
    this.ws = ws;
    this.id = 0;
    this.pending = new Map();
    this.listeners = new Map();
    ws.addEventListener("message", (ev) => {
      const msg = JSON.parse(ev.data);
      if (msg.id && this.pending.has(msg.id)) {
        const { resolve, reject } = this.pending.get(msg.id);
        this.pending.delete(msg.id);
        msg.error ? reject(new Error(msg.error.message)) : resolve(msg.result);
      } else if (msg.method) {
        for (const fn of this.listeners.get(msg.method) || []) fn(msg.params);
      }
    });
  }

  static async connect(wsUrl) {
    const ws = new WebSocket(wsUrl);
    await new Promise((resolve, reject) => {
      ws.addEventListener("open", resolve);
      ws.addEventListener("error", reject);
    });
    return new Cdp(ws);
  }

  send(method, params = {}) {
    const id = ++this.id;
    this.ws.send(JSON.stringify({ id, method, params }));
    return new Promise((resolve, reject) => this.pending.set(id, { resolve, reject }));
  }

  on(method, fn) {
    if (!this.listeners.has(method)) this.listeners.set(method, []);
    this.listeners.get(method).push(fn);
  }

  /** Evaluate an expression in the page. Returns the JSON-decoded value. */
  async evaluate(expression, { awaitPromise = true } = {}) {
    const result = await this.send("Runtime.evaluate", {
      expression,
      awaitPromise,
      returnByValue: true,
    });
    if (result.exceptionDetails) {
      throw new Error(
        `Page exception: ${result.exceptionDetails.text} ${
          result.exceptionDetails.exception?.description || ""
        }`,
      );
    }
    return result.result.value;
  }

  close() {
    try {
      this.ws.close();
    } catch {
      /* already closed */
    }
  }
}

async function launchChrome(startUrl) {
  const userDataDir = mkdtempSync(join(tmpdir(), "retro-smoke-"));
  const proc = spawn(
    CHROME_PATH,
    [
      "--headless=new",
      `--remote-debugging-port=${CDP_PORT}`,
      "--enable-unsafe-swiftshader",
      "--no-first-run",
      "--disable-gpu",
      `--user-data-dir=${userDataDir}`,
      startUrl,
    ],
    { stdio: "ignore" },
  );

  // Wait for the DevTools endpoint.
  for (let i = 0; i < 60; i++) {
    try {
      const res = await fetch(`http://127.0.0.1:${CDP_PORT}/json/list`);
      if (res.ok) return { proc, userDataDir };
    } catch {
      /* not up yet */
    }
    await sleep(500);
  }
  throw new Error("Chrome DevTools endpoint never became available");
}

async function getPageTarget() {
  for (let i = 0; i < 30; i++) {
    const res = await fetch(`http://127.0.0.1:${CDP_PORT}/json/list`);
    const targets = await res.json();
    const page = targets.find((t) => t.type === "page" && t.webSocketDebuggerUrl);
    if (page) return page;
    await sleep(500);
  }
  throw new Error("No page target found in Chrome");
}

// ---------------------------------------------------------------------------
// Test steps
// ---------------------------------------------------------------------------
async function waitFor(cdp, expression, { timeout = 20000, label } = {}) {
  const start = Date.now();
  while (Date.now() - start < timeout) {
    try {
      if (await cdp.evaluate(expression)) return true;
    } catch {
      /* page navigating */
    }
    await sleep(300);
  }
  fail(`Timeout waiting for ${label || expression}`);
  return false;
}

async function main() {
  console.log(`Retro smoke test — server: ${BASE_URL}`);

  // 1. Throwaway user + onboarding against the real API
  const api = new ApiClient(BASE_URL);
  const stamp = Date.now();
  const creds = {
    firstName: "Smoke",
    lastName: "Test",
    username: `smoke_${stamp}`,
    email: `smoke_${stamp}@test.com`,
    password: `Sm0ke!${stamp}`,
    confirmPassword: `Sm0ke!${stamp}`,
  };

  const reg = await api.request("/api/v1/auth/register", { method: "POST", body: creds });
  if (reg.status !== 201) return finish(`register failed: ${JSON.stringify(reg.json)}`);
  const login = await api.request("/api/v1/auth/login", {
    method: "POST",
    body: { email: creds.email, password: creds.password },
  });
  if (login.status !== 200) return finish(`login failed: ${JSON.stringify(login.json)}`);
  const onboard = await api.request("/api/v1/onboarding", {
    method: "POST",
    body: {
      displayName: "Smoke Tester",
      role: "student",
      subjects: ["Math"],
      goal: "study",
      answerStyle: "balanced",
      tone: "casual",
      anythingElse: "",
    },
  });
  if (onboard.status !== 200 && onboard.status !== 201)
    return finish(`onboarding failed: ${JSON.stringify(onboard.json)}`);
  pass("registered + logged in + onboarded throwaway user");

  // 2. Proxy serving the real /app with a pro-tier stub
  const proxy = await startProxy(api);
  const appUrl = `http://127.0.0.1:${proxy.port}/app`;
  console.log(`  proxy: ${appUrl} (subscription status stubbed to pro)`);

  // 3. Headless Chrome + CDP
  const { proc, userDataDir } = await launchChrome(appUrl);
  const errors = [];
  try {
    const target = await getPageTarget();
    const cdp = await Cdp.connect(target.webSocketDebuggerUrl);
    await cdp.send("Runtime.enable");
    await cdp.send("Page.enable");

    cdp.on("Runtime.exceptionThrown", (p) => {
      const desc = p.exceptionDetails?.exception?.description || p.exceptionDetails?.text || "";
      errors.push(`uncaught: ${desc}`);
    });
    cdp.on("Runtime.consoleAPICalled", (p) => {
      if (p.type !== "error") return;
      const text = p.args.map((a) => a.value ?? a.description ?? "").join(" ");
      if (BENIGN_ERRORS.some((b) => text.includes(b))) return;
      errors.push(`console.error: ${text}`);
    });

    // 4. Wait for the app to boot
    const ready = await waitFor(cdp, "!!(window.ambientMode && document.getElementById('notesList'))", {
      timeout: 30000,
      label: "app boot (ambientMode + notes list)",
    });
    if (!ready) return finish("app never finished booting");
    pass("app booted (all partial scripts ran)");

    // 5. Navigate through all 4 panes
    const sections = ["Chat", "Notes", "Den", "Cards"];
    for (let i = 0; i < 4; i++) {
      await cdp.evaluate(`goToSection(${i})`);
      await sleep(900);
      const state = await cdp.evaluate(
        `document.querySelector('.horizontal-container').className`,
      );
      if (!state.includes(["show-chat", "show-notes", "show-den", "show-flashcards"][i]))
        fail(`section ${i} (${sections[i]}) did not activate (container="${state}")`);
      else pass(`navigated to ${sections[i]}`);
    }

    // 6. Note read-mode modal (on Notes pane)
    await cdp.evaluate("goToSection(1)");
    await sleep(900);
    await cdp.evaluate(
      `localStorage.setItem("retroNotes", JSON.stringify([{ id: "smoke1", title: "Smoke Note", html: "<p>hello smoke</p>", updatedAt: new Date().toISOString() }]))`,
    );
    await cdp.evaluate("renderNotesList()");
    const noteRendered = await cdp.evaluate(
      `!!document.querySelector('#notesList .note-item')`,
    );
    noteRendered ? pass("note rendered in notes list") : fail("note did not render");
    await cdp.evaluate(`document.querySelector('#notesList .note-item').click()`);
    await sleep(400);
    await cdp.evaluate("openReadMode()");
    await sleep(400);
    const modalOpen = await cdp.evaluate(
      `document.getElementById('readModal').classList.contains('active')`,
    );
    modalOpen ? pass("read-mode modal opened") : fail("read-mode modal did not open");
    await cdp.evaluate("closeReadMode()");

    // 7. Ambient mode on DEN
    await cdp.evaluate("goToSection(2)");
    await sleep(1200);
    const toggleVisible = await cdp.evaluate(
      `document.getElementById('ambientToggle').getAttribute('data-visible')`,
    );
    toggleVisible === "true"
      ? pass("ambient toggle visible on DEN")
      : fail(`ambient toggle data-visible="${toggleVisible}" on DEN`);

    await cdp.evaluate(`document.getElementById('ambientToggle').click()`);
    const vantaReady = await waitFor(
      cdp,
      "window.ambientMode && window.ambientMode.vantaEffect !== null",
      { timeout: 30000, label: "VANTA.CLOUDS effect creation" },
    );
    if (!vantaReady) return finish("Vanta effect never initialized");
    pass("ambient mode activated (VANTA.CLOUDS running)");

    // 8. Color picker: click every color option, assert sky color changes
    await cdp.evaluate(`document.getElementById('colorPickerToggle').click()`);
    await sleep(500);
    const optionCount = await cdp.evaluate(`document.querySelectorAll('.color-option').length`);
    if (optionCount < 5) fail(`expected 5 color options, found ${optionCount}`);

    const cases = [
      { color: "0x68c7ff", name: "Sky Blue" },
      { color: "0xff6b6b", name: "Sunset" },
      { color: "0x9b59b6", name: "Twilight" },
      { color: "0x2ecc71", name: "Aurora" },
      { color: "dynamic", name: "Timer Sync" },
    ];
    for (const c of cases) {
      const sel = `document.querySelector('.color-option[data-color="${c.color}"]')`;
      const exists = await cdp.evaluate(`!!${sel}`);
      if (!exists) {
        fail(`color option "${c.name}" not found`);
        continue;
      }
      await cdp.evaluate(`${sel}.click()`);
      await sleep(500);
      if (c.color === "dynamic") {
        const dyn = await cdp.evaluate(`window.ambientMode.isDynamicMode`);
        dyn ? pass(`dynamic mode ("Timer Sync") enabled`) : fail("dynamic mode not enabled");
      } else {
        const expected = parseInt(c.color, 16);
        const sky = await cdp.evaluate(`window.ambientMode.currentSkyColor`);
        // skyColor uniform is a THREE.Vector3 (x/y/z = r/g/b, floats 0-1)
        const rgb = await cdp.evaluate(
          `(() => { const v = window.ambientMode.vantaEffect?.uniforms?.skyColor?.value; return v ? [v.x, v.y, v.z] : null; })()`,
        );
        const uniformOk =
          Array.isArray(rgb) &&
          Math.abs(rgb[0] - ((expected >> 16) & 255) / 255) < 0.01 &&
          Math.abs(rgb[1] - ((expected >> 8) & 255) / 255) < 0.01 &&
          Math.abs(rgb[2] - (expected & 255) / 255) < 0.01;
        if (sky === expected && uniformOk)
          pass(`${c.name}: skyColor ${c.color} applied (state + uniform)`);
        else fail(`${c.name}: sky=${sky} rgb=${JSON.stringify(rgb)}, expected ${c.color}`);
      }
    }

    // 9. Toggle ambient off
    await cdp.evaluate(`document.getElementById('ambientToggle').click()`);
    await sleep(800);
    const activeOff = await cdp.evaluate(
      `window.ambientMode.isActive === false && window.ambientMode.vantaEffect === null`,
    );
    activeOff ? pass("ambient mode deactivated cleanly") : fail("ambient mode did not deactivate");
    cdp.close();

    // 10. Verdict on console errors
    const realErrors = errors.filter(
      (e) => !BENIGN_ERRORS.some((b) => e.includes(b)),
    );
    if (realErrors.length) {
      fail(`${realErrors.length} real console error(s):`);
      for (const e of realErrors.slice(0, 10)) console.error(`      ${e}`);
    } else {
      pass("no uncaught exceptions or [VANTA] errors");
    }
  } finally {
    proc.kill("SIGTERM");
    proxy.server.close();
    setTimeout(() => {
      try {
        rmSync(userDataDir, { recursive: true, force: true });
      } catch {
        /* windows may hold the dir briefly */
      }
    }, 1000);
  }

  return finish();
}

function finish(reason) {
  if (reason) {
    console.error(`\n✗ SMOKE TEST FAILED — ${reason}`);
    process.exit(1);
  }
  if (failed) {
    console.error(`\n✗ SMOKE TEST FAILED — ${failures.length} assertion(s):`);
    for (const f of failures) console.error(`  - ${f}`);
    process.exit(1);
  }
  console.log("\n✓ SMOKE TEST PASSED");
  process.exit(0);
}

main().catch((err) => finish(err.stack || err.message));
