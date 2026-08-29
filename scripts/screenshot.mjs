#!/usr/bin/env node
/**
 * Capture screenshots of the 4 panes (light + dark) via CDP for visual review.
 * Usage: node scripts/screenshot.mjs [outdir]
 */
import { spawn } from "node:child_process";
import { mkdtempSync, rmSync, mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import http from "node:http";

const BASE_URL = process.env.BASE_URL || "http://localhost:8000";
const CHROME_PATH =
  process.env.CHROME_PATH || "C:/Program Files/Google/Chrome/Application/chrome.exe";
const OUTDIR = process.argv[2] || "screenshots";
const CDP_PORT = 9400 + Math.floor(Math.random() * 100);
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
        headers: {
          ...(api.cookies.size ? { Cookie: api.cookieHeader() } : {}),
        },
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
  mkdirSync(OUTDIR, { recursive: true });
  const api = new ApiClient(BASE_URL);
  const stamp = Date.now();
  const creds = {
    firstName: "Shot", lastName: "Test", username: `shot_${stamp}`,
    email: `shot_${stamp}@test.com`, password: `Sh0t!${stamp}`, confirmPassword: `Sh0t!${stamp}`,
  };
  await api.request("/api/v1/auth/register", { method: "POST", body: creds });
  await api.request("/api/v1/auth/login", { method: "POST", body: { email: creds.email, password: creds.password } });
  await api.request("/api/v1/onboarding", {
    method: "POST",
    body: { displayName: "Shot", role: "student", subjects: ["Math"], goal: "study", answerStyle: "balanced", tone: "casual", anythingElse: "" },
  });
  const proxy = await startProxy(api);
  const appUrl = `http://127.0.0.1:${proxy.port}/app`;

  const userDataDir = mkdtempSync(join(tmpdir(), "retro-shot-"));
  const proc = spawn(CHROME_PATH, [
    "--headless=new", `--remote-debugging-port=${CDP_PORT}`, "--enable-unsafe-swiftshader",
    "--disable-gpu", `--user-data-dir=${userDataDir}`,
    `--window-size=1440,900`, appUrl,
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

  await send("Page.enable");
  await send("Emulation.setDeviceMetricsOverride", { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false });

  // wait for boot
  for (let i = 0; i < 60; i++) {
    if (await evaluate("!!(window.ambientMode && document.getElementById('notesList'))")) break;
    await sleep(500);
  }
  await sleep(1500);

  const panes = ["chat", "notes", "den", "flashcards"];
  for (let i = 0; i < 4; i++) {
    await evaluate(`document.querySelector('.nav-dot[data-section="${i}"]').click()`);
    await sleep(1200);
    for (const theme of ["light", "dark"]) {
      if (theme === "dark") await evaluate(`document.body.setAttribute('data-theme','dark')`);
      const shot = await send("Page.captureScreenshot", { format: "png" });
      writeFileSync(join(OUTDIR, `${panes[i]}-${theme}.png`), Buffer.from(shot.data, "base64"));
    }
    await evaluate(`document.body.removeAttribute('data-theme')`);
  }

  // login page too
  await send("Page.navigate", { url: `http://127.0.0.1:${proxy.port}/login` });
  await sleep(3000);
  const shot = await send("Page.captureScreenshot", { format: "png" });
  writeFileSync(join(OUTDIR, "login-light.png"), Buffer.from(shot.data, "base64"));

  console.log(`screenshots written to ${OUTDIR}/`);
  if (process.platform === "win32" && proc.pid) {
    spawn("taskkill", ["/PID", String(proc.pid), "/T", "/F"], { stdio: "ignore" });
  } else {
    proc.kill("SIGTERM");
  }
  proxy.server.close();
  setTimeout(() => {
    try { rmSync(userDataDir, { recursive: true, force: true }); } catch {}
  }, 1000);
  process.exit(0);
}

main().catch((e) => { console.error(e); process.exit(1); });
