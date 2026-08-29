#!/usr/bin/env node
/**
 * CSS coverage check: boots the app, exercises the UI, then verifies every
 * class present in the live DOM is covered by the compiled Tailwind CSS or
 * the custom stylesheets (style.css/styles.css/inline <style> blocks).
 * Catches utilities the Tailwind compiler missed (dynamically built classes).
 * Usage: node scripts/css-coverage.mjs
 */
import { spawn } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import http from "node:http";

const BASE_URL = process.env.BASE_URL || "http://localhost:8000";
const CHROME_PATH =
  process.env.CHROME_PATH || "C:/Program Files/Google/Chrome/Application/chrome.exe";
const CDP_PORT = 9500 + Math.floor(Math.random() * 100);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

class ApiClient {
  constructor(baseUrl) {
    this.baseUrl = baseUrl.replace(/\/$/, "");
    this.cookies = new Map();
  }
  cookieHeader() {
    return [...this.cookies.entries()].map(([k, v]) => `${k}=${v}`).join("; ");
  }
  captureCookies(res) {
    for (const line of res.headers.getSetCookie?.() || []) {
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
    } catch {}
    return { status: res.status, json };
  }
}

async function startProxy(api) {
  const server = http.createServer(async (req, res) => {
    if (req.url === "/api/v1/subscription/status") {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ subscription: { tier: "pro" } }));
      return;
    }
    try {
      const upstream = await fetch(`${api.baseUrl}${req.url}`, {
        method: req.method,
        headers: { ...(api.cookies.size ? { Cookie: api.cookieHeader() } : {}) },
      });
      const headers = {};
      upstream.headers.forEach((v, k) => {
        if (!["set-cookie", "content-encoding", "transfer-encoding"].includes(k)) headers[k] = v;
      });
      res.writeHead(upstream.status, headers);
      res.end(Buffer.from(await upstream.arrayBuffer()));
    } catch (err) {
      res.writeHead(502);
      res.end(err.message);
    }
  });
  await new Promise((r) => server.listen(0, "127.0.0.1", r));
  return { server, port: server.address().port };
}

async function main() {
  const api = new ApiClient(BASE_URL);
  const stamp = Date.now();
  const creds = {
    firstName: "Cov", lastName: "Test", username: `cov_${stamp}`,
    email: `cov_${stamp}@test.com`, password: `C0v!${stamp}`, confirmPassword: `C0v!${stamp}`,
  };
  await api.request("/api/v1/auth/register", { method: "POST", body: creds });
  await api.request("/api/v1/auth/login", { method: "POST", body: { email: creds.email, password: creds.password } });
  await api.request("/api/v1/onboarding", {
    method: "POST",
    body: { displayName: "Cov", role: "student", subjects: ["Math"], goal: "study", answerStyle: "balanced", tone: "casual", anythingElse: "" },
  });
  const proxy = await startProxy(api);
  const appUrl = `http://127.0.0.1:${proxy.port}/app`;

  const userDataDir = mkdtempSync(join(tmpdir(), "retro-cov-"));
  const proc = spawn(CHROME_PATH, [
    "--headless=new", `--remote-debugging-port=${CDP_PORT}`, "--enable-unsafe-swiftshader",
    "--disable-gpu", `--user-data-dir=${userDataDir}`, appUrl,
  ], { stdio: "ignore" });

  for (let i = 0; i < 60; i++) {
    try {
      const res = await fetch(`http://127.0.0.1:${CDP_PORT}/json/list`);
      if (res.ok) break;
    } catch {}
    await sleep(500);
  }
  const targets = await (await fetch(`http://127.0.0.1:${CDP_PORT}/json/list`)).json();
  const page = targets.find((t) => t.type === "page");
  const ws = new WebSocket(page.webSocketDebuggerUrl);
  await new Promise((r) => ws.addEventListener("open", r));
  let id = 0;
  const pending = new Map();
  ws.addEventListener("message", (ev) => {
    const m = JSON.parse(ev.data);
    if (m.id && pending.has(m.id)) {
      pending.get(m.id)(m.result);
      pending.delete(m.id);
    }
  });
  const send = (method, params = {}) => {
    const i = ++id;
    ws.send(JSON.stringify({ id: i, method, params }));
    return new Promise((r) => pending.set(i, r));
  };
  const evaluate = async (expr) =>
    (await send("Runtime.evaluate", { expression: expr, awaitPromise: true, returnByValue: true })).result.value;
  await send("Runtime.enable");

  for (let i = 0; i < 60; i++) {
    if (await evaluate("!!(window.ambientMode && document.getElementById('notesList'))")) break;
    await sleep(500);
  }
  await sleep(1500);

  // ---- Exercise the UI so runtime-built DOM appears ----
  // Chat: send a user message (creates bg-gray-100 / text-gray-800 bubble)
  for (let i = 0; i < 4; i++) {
    await evaluate(`document.querySelector('.nav-dot[data-section="${i}"]').click()`);
    await sleep(700);
  }
  await evaluate(`document.querySelector('.nav-dot[data-section="0"]').click()`);
  await sleep(700);
  await evaluate(`
    (() => {
      const input = document.querySelector('#chatInput, .chat-input, textarea[placeholder], .message-input');
      if (input) {
        input.value = 'coverage test message';
        input.dispatchEvent(new Event('input', { bubbles: true }));
        const btn = document.querySelector('#sendButton, .send-btn, button[type="submit"]');
        if (btn) btn.click();
      }
      return !!input;
    })()
  `);
  await sleep(2500);

  // Notes: inject + render a note item
  await evaluate(`document.querySelector('.nav-dot[data-section="1"]').click()`);
  await sleep(700);
  await evaluate(`
    localStorage.setItem("retroNotes", JSON.stringify([{ id: "cov1", title: "Cov Note", html: "<p>coverage</p>", updatedAt: new Date().toISOString() }]));
    renderNotesList();
  `);
  await sleep(500);

  // DEN: ambient + color picker open
  await evaluate(`document.querySelector('.nav-dot[data-section="2"]').click()`);
  await sleep(900);
  await evaluate(`document.getElementById('ambientToggle').click()`);
  for (let i = 0; i < 40; i++) {
    if (await evaluate("window.ambientMode && window.ambientMode.vantaEffect !== null")) break;
    await sleep(500);
  }
  await evaluate(`document.getElementById('colorPickerToggle').click()`);
  await sleep(500);
  await evaluate(`document.querySelector('.color-option[data-color="0xff6b6b"]').click()`);
  await sleep(500);

  // Flashcards pane + profile menu
  await evaluate(`document.querySelector('.nav-dot[data-section="3"]').click()`);
  await sleep(700);
  await evaluate(`document.querySelector('.nav-dot[data-section="0"]').click()`);
  await sleep(500);

  // ---- Collect every class in the live DOM ----
  const domClasses = await evaluate(`
    Array.from(new Set(
      Array.from(document.querySelectorAll('*')).flatMap(el => Array.from(el.classList))
    ))
  `);

  // Walk the page's accessible stylesheets and extract every class token
  // from real selectors (the browser does the CSS parsing for us).
  const cssClasses = await evaluate(`
    (() => {
      const found = new Set();
      const addSelector = (sel) => {
        if (!sel) return;
        for (const m of sel.matchAll(/\\.((?:\\\\.|[a-zA-Z0-9_-])+)/g)) {
          found.add(m[1].replace(/\\\\(.)/g, '$1'));
        }
      };
      for (const sheet of Array.from(document.styleSheets)) {
        let rules;
        try { rules = sheet.cssRules; } catch (e) { continue; } // cross-origin (CDN) sheets
        const walk = (ruleList) => {
          for (const rule of Array.from(ruleList)) {
            if (rule.selectorText) addSelector(rule.selectorText);
            if (rule.cssRules) walk(rule.cssRules); // @media etc.
          }
        };
        walk(rules);
      }
      return Array.from(found);
    })()
  `);

  // Classes owned by cross-origin CDN stylesheets we can't walk
  const CDN_PREFIXES = [/^ql-/, /^fas$/, /^fa[brls]$/, /^fa-/];
  // Dead classes: no CSS rule anywhere in the codebase, unstyled under the
  // Play CDN too (would need theme extension / typography plugin)
  const KNOWN_DEAD = new Set([
    "font-space-grotesk", "locked-icon", "memory-text", "minimal",
    "pro-feature", "prose", "prose-lg",
  ]);

  const missing = [];
  for (const cls of domClasses) {
    if (CDN_PREFIXES.some((re) => re.test(cls))) continue;
    if (KNOWN_DEAD.has(cls)) continue;
    if (!cssClasses.includes(cls)) missing.push(cls);
  }

  console.log(`DOM classes: ${domClasses.length}`);
  console.log(`classes defined in accessible stylesheets: ${cssClasses.length}`);
  console.log(`MISSING (no CSS rule anywhere): ${missing.length}`);
  for (const m of missing.sort()) console.log(`  - ${m}`);

  const ok = missing.length === 0;

  if (process.platform === "win32" && proc.pid) {
    spawn("taskkill", ["/PID", String(proc.pid), "/T", "/F"], { stdio: "ignore" });
  } else {
    proc.kill("SIGTERM");
  }
  proxy.server.close();
  setTimeout(() => {
    try { rmSync(userDataDir, { recursive: true, force: true }); } catch {}
  }, 1000);
  console.log(ok ? "\\nCSS COVERAGE OK" : "\\nCSS COVERAGE FAILED");
  process.exit(ok ? 0 : 1);
}

main().catch((e) => { console.error(e); process.exit(1); });
