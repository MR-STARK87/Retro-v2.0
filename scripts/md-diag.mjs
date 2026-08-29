#!/usr/bin/env node
/**
 * Diagnostic: check markdown rendering in chat bubbles.
 * Registers a throwaway user, opens /app in headless Chrome, injects an
 * assistant message with markdown via appendMessage(), then sends a real
 * chat message and inspects the streamed bubble's DOM.
 */
import { spawn } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const BASE_URL = process.env.BASE_URL || "http://localhost:8000";
const CHROME_PATH =
  process.env.CHROME_PATH || "C:/Program Files/Google/Chrome/Application/chrome.exe";
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
    } catch {}
    return { status: res.status, json };
  }
}

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
    } catch {}
  }
}

async function launchChrome(startUrl) {
  const userDataDir = mkdtempSync(join(tmpdir(), "retro-md-diag-"));
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
  for (let i = 0; i < 60; i++) {
    try {
      const res = await fetch(`http://127.0.0.1:${CDP_PORT}/json/list`);
      if (res.ok) return { proc, userDataDir };
    } catch {}
    await sleep(500);
  }
  throw new Error("Chrome DevTools endpoint never became available");
}

function killChrome(proc) {
  if (process.platform === "win32" && proc.pid) {
    spawn("taskkill", ["/PID", String(proc.pid), "/T", "/F"], { stdio: "ignore" });
  } else {
    proc.kill("SIGTERM");
  }
}

async function getPageTarget() {
  for (let i = 0; i < 30; i++) {
    const res = await fetch(`http://127.0.0.1:${CDP_PORT}/json/list`);
    const targets = await res.json();
    const page = targets.find((t) => t.type === "page" && t.webSocketDebuggerUrl);
    if (page) return page;
    await sleep(500);
  }
  throw new Error("No page target found");
}

const MD_SAMPLE = "**bold text** and *italic* and `inline code`\n\n- bullet one\n- bullet two\n\n```js\nconst x = 1;\n```\n\n# A Heading";

async function main() {
  const api = new ApiClient(BASE_URL);
  const stamp = Date.now();
  const creds = {
    firstName: "Md",
    lastName: "Diag",
    username: `mddiag_${stamp}`,
    email: `mddiag_${stamp}@test.com`,
    password: `Diag!${stamp}Aa`,
    confirmPassword: `Diag!${stamp}Aa`,
  };
  const reg = await api.request("/api/v1/auth/register", { method: "POST", body: creds });
  if (reg.status !== 201) throw new Error(`register failed: ${JSON.stringify(reg.json)}`);
  await api.request("/api/v1/auth/login", { method: "POST", body: { email: creds.email, password: creds.password } });
  const onboard = await api.request("/api/v1/onboarding", {
    method: "POST",
    body: {
      displayName: "Md Diag",
      role: "student",
      subjects: ["Math"],
      goal: "study",
      answerStyle: "balanced",
      tone: "casual",
      anythingElse: "",
    },
  });
  if (onboard.status !== 200 && onboard.status !== 201)
    throw new Error(`onboarding failed: ${JSON.stringify(onboard.json)}`);
  console.log("✓ user registered + onboarded");

  // Load /app directly with the session cookie injected
  const { proc, userDataDir } = await launchChrome("about:blank");
  const consoleErrors = [];
  try {
    const target = await getPageTarget();
    const cdp = await Cdp.connect(target.webSocketDebuggerUrl);
    await cdp.send("Runtime.enable");
    cdp.on("Runtime.exceptionThrown", (p) => {
      consoleErrors.push(`EXCEPTION: ${p.exceptionDetails?.exception?.description || p.exceptionDetails?.text}`);
    });
    cdp.on("Runtime.consoleAPICalled", (p) => {
      if (p.type === "error") {
        consoleErrors.push(`CONSOLE: ${p.args?.map((a) => a.value || a.description).join(" ")}`);
      }
    });

    // Set cookies then navigate
    const cookieList = [...api.cookies.entries()];
    for (const [name, value] of cookieList) {
      await cdp.send("Network.enable");
      await cdp.send("Network.setCookie", {
        url: BASE_URL,
        name,
        value,
      });
    }
    await cdp.send("Page.navigate", { url: `${BASE_URL}/app` });
    await sleep(6000);

    // --- Check 1: are the renderer functions defined? ---
    const fns = await cdp.evaluate(`({
      renderMarkdown: typeof renderMarkdown,
      appendMessage: typeof appendMessage,
      chatScriptLoaded: !!document.querySelector('script[src*="chat.js"]')
    })`);
    console.log("check 1 - functions defined:", JSON.stringify(fns));

    // --- Check 2: inject markdown via appendMessage, inspect DOM ---
    await cdp.evaluate(`appendMessage(${JSON.stringify(MD_SAMPLE)}, false)`);
    await sleep(500);
    const dom = await cdp.evaluate(`(() => {
      const bubbles = document.querySelectorAll('.chat-bubble--assistant .md-body');
      const last = bubbles[bubbles.length - 1];
      if (!last) return { found: false };
      return {
        found: true,
        hasStrong: !!last.querySelector('strong'),
        hasEm: !!last.querySelector('em'),
        hasCode: !!last.querySelector('code.md-code'),
        hasUl: !!last.querySelector('ul.md-list'),
        hasPre: !!last.querySelector('pre.md-pre'),
        hasHeading: !!last.querySelector('.md-heading'),
        rawAsterisks: last.textContent.includes('**'),
        innerHTML: last.innerHTML.slice(0, 400),
      };
    })()`);
    console.log("check 2 - injected markdown DOM:", JSON.stringify(dom, null, 2));

    // --- Check 3: computed styles on the rendered elements ---
    const styles = await cdp.evaluate(`(() => {
      const body = document.querySelector('.chat-bubble--assistant .md-body');
      const bubble = document.querySelector('.chat-bubble--assistant');
      const strong = body && body.querySelector('strong');
      return {
        bubbleWhiteSpace: bubble ? getComputedStyle(bubble).whiteSpace : null,
        bubbleDisplay: bubble ? getComputedStyle(bubble).display : null,
        bodyWhiteSpace: body ? getComputedStyle(body).whiteSpace : null,
        strongFontWeight: strong ? getComputedStyle(strong).fontWeight : null,
        listMarker: body && body.querySelector('ul') ? getComputedStyle(body.querySelector('ul li')).listStyleType || getComputedStyle(body.querySelector('ul')).listStyleType : null,
      };
    })()`);
    console.log("check 3 - computed styles:", JSON.stringify(styles, null, 2));

    // --- Check 4: real end-to-end chat message ---
    console.log("\nsending real chat message...");
    await cdp.evaluate(`(() => {
      const ta = document.querySelector('.chat-textarea');
      const btn = document.querySelector('.chat-send-btn');
      ta.value = 'Reply with one short sentence containing **bold word** and a - bullet item. Keep it tiny.';
      ta.dispatchEvent(new Event('input'));
      btn.click();
    })()`);
    // Wait for streaming to finish (bubble count grows, caret disappears)
    let streamResult = null;
    for (let i = 0; i < 60; i++) {
      await sleep(1000);
      streamResult = await cdp.evaluate(`(() => {
        const bodies = document.querySelectorAll('.chat-bubble--assistant .md-body');
        const last = bodies[bodies.length - 1];
        if (!last) return { ready: false };
        const html = last.innerHTML;
        const streaming = html.includes('\\u258C');
        return {
          ready: !streaming && html.length > 20,
          hasStrong: !!last.querySelector('strong'),
          hasUl: !!last.querySelector('ul'),
          rawAsterisks: last.textContent.includes('**'),
          rawDash: /^\\s*-\\s/m.test(last.textContent),
          textPreview: last.textContent.trim().slice(0, 200),
          htmlPreview: html.slice(0, 500),
        };
      })()`);
      if (streamResult.ready) break;
    }
    console.log("check 4 - real streamed message:", JSON.stringify(streamResult, null, 2));

    console.log("\nconsole errors captured:", consoleErrors.length ? consoleErrors : "(none)");
    cdp.close();
  } finally {
    killChrome(proc);
    await sleep(1500);
    try {
      rmSync(userDataDir, { recursive: true, force: true });
    } catch {}
  }
}

main().catch((err) => {
  console.error("DIAG FAILED:", err.message);
  process.exitCode = 1;
});
