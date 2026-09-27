# Retro — Performance, Correctness & Hardening Implementation Plan

- **Branch:** `dev` (created from `main` @ `d0900fe`). Nothing in this plan lands on `main` until reviewed and merged.
- **Scope:** every finding from the codebase audit of 2026-09-27, with per-item verdicts already reconciled. Claims that were audited and found *wrong* are listed in §11 so nobody re-implements them.
- **Conventions (from CLAUDE.md):** ES Modules, 2-space indent, double quotes, `feat:/fix:/perf:/docs:/chore:` commit prefixes, one logical change per commit, `asyncHandler` on controllers, Zod + `validate()` on routes, `tokenChecker → rateLimiter → validate → checkUsageLimit → trackUsage → controller` ordering.
- **CI:** `.github/workflows/ci.yml` already runs on *all* pull requests, so opening a PR from `dev` → `main` runs `lint` + `smoke` automatically. No workflow edit required.

---

## Table of contents

1. Audit verdict summary
2. Phase 1 — P0 correctness blockers
3. Phase 2 — P0 abuse & security
4. Phase 3 — P1 AI cost
5. Phase 4 — P1 data visibility & query cost
6. Phase 5 — P1 concurrency & atomicity
7. Phase 6 — P2 streaming & render performance
8. Phase 7 — P2 frontend correctness
9. Phase 8 — P3 polish
10. Explicitly out of scope / rejected
11. Verification matrix
12. Commit sequence
13. Risk register & rollback

---

## 1. Audit verdict summary

Confirmed correct and actionable:

| # | Finding | Anchor |
|---|---|---|
| A1 | No `max_tokens` on any AI call | `src/utils/openai.js:26-30` |
| A2 | 40-message history sent untruncated | `src/controllers/chat.js:165-172` |
| A3 | 2nd paid completion per user message | `src/controllers/chat.js:51-80`, `:212`, `:225` |
| A4 | Whole note injected up to 50 000 chars | `chat.js:318`, `note.js:385-397`, `card.js:349` |
| A5 | `fs.readFileSync` per prompt call | `src/utils/prompts/index.js:13-16` |
| B1 | Unbounded `messages[]`, list query unprojected | `src/models/chatSession.js:15-31`, `:55-57` |
| B2 | Unescaped `$regex`, text indexes unused | `note.js:147-159`, `card.js:101-112` |
| B3 | 4× `User.findById` per AI request | `tokenChecker.js:25`, `rateLimiter.js:56`, `usageTracker.js:51`, `:126` |
| B4 | No `.lean()` on hot lists | `note.js:139`, `card.js:97` |
| B5 | Index/sort key mismatch, missing indexes | `note.js:100` vs sort `isPinned:-1, lastEditedAt:-1` |
| B6 | Responds before cards are persisted | `card.js:436` + `flashcards.js:744` |
| B7 | check-then-`$inc` race | `usageTracker.js:51/78` then `:139` |
| B8 | Note delete does not cascade cards | `note.js:155` |
| B9 | 3× `findById` + manual owner compare | `chat.js:286`, `note.js:345`, `card.js:331` |
| C1 | In-memory rate limiter | `rateLimiter.js:4` |
| C2 | **Stripe webhook is broken, not fragile** | `index.js:93` → `subscriptionRoutes.js:21` → `subscription.js:142` |
| C3 | Compression defeats fake streaming | `index.js:70` vs `chat.js:15-48` (measured: first==last==146 ms) |
| C4 | Sync fs in music requests, no cache headers | `musicController.js:17,27,39` |
| C5 | Connect error swallowed; `.catch(process.exit)` is dead code | `dbConnection.js:5-12` |
| D1 | 400%-wide container, no `content-visibility` | `head.ejs:125-136` |
| D2 | Duplicate `id="searchInput"` cross-wires panes | `notes-content.ejs:32`, `flashcards-content.ejs:24` |
| D3 | Quill/marked CDN stall `den.js`, `flashcards.js`, `nav.js` | `notes-content.ejs:149-150`, `:527` |
| D4 | Theme FOUC + duplicate loader | `theme.js:30`, `profile.js:379-385`, `:485` |
| D5 | `chat.js:586` re-renders markdown every rAF frame | `public/js/chat.js:586` |
| D6 | Notes list full rebuild | `notes.js:119-122` |
| E1 | Frontend never sends `page`/`limit` → hard 20-item cap | `card.js:46`, `note.js:47`, `flashcards.js:196-204`, `notes.js:502` |
| E2 | Search routes have no rate limiter, no `.limit()` | `noteRoutes.js:60`, `cardRoutes.js:62` |
| E3 | `express.json()` default 100 KB (measured 413) | `index.js:93` |
| E4 | `POST /chat` has no Zod schema | `chatRoutes.js` |
| E5 | Limiters fail open on error | `rateLimiter.js:110-114`, `usageTracker.js:113-117` |
| E6 | Two `currentSession.save()` per request → lost writes | `chat.js:122` + `:201`, `:315` + `:397` |
| E7 | No OpenAI timeout/retries (10 min default) | `openai.js:10-13` |
| E8 | No security headers | `src/index.js` |
| E9 | `transition: all` on `body` | `head.ejs` |
| E10 | Extra `/cards/tags` request per search | `flashcards.js:216` |

Audited and **rejected** — see §10.

---

## 2. Phase 1 — P0 correctness blockers

### 1.1 Fix the broken Stripe webhook

**Root cause (verified empirically):** `app.use(express.json())` at `src/index.js:93` runs before `/api/v1/subscription` is mounted. Stripe posts `application/json`, so the global parser consumes the stream. By the time `subscriptionRoutes.js:21` `express.raw({ type: "application/json" })` runs, `isFinished(req)` is already `true` → `raw()` skips → `req.body` is a parsed object → `stripe.webhooks.constructEvent` at `subscription.js:142` throws *"Webhook payload must be provided as a string or a Buffer."* Measured: `bodyIsBuffer: false  typeof: object  isFinished: true`.

**Every Stripe webhook in production returns 400.**

**Change — `src/index.js`:**

```js
// BEFORE (line 93)
app.use(express.json());

// AFTER — skip the JSON parser for the Stripe webhook only
const isStripeWebhook = (req) =>
  req.originalUrl === "/api/v1/subscription/webhook";

app.use((req, res, next) => {
  if (isStripeWebhook(req)) return next();
  express.json({ limit: JSON_BODY_LIMIT })(req, res, next);
});
```

Keep `express.raw({ type: "application/json" })` on the route — it now receives an untouched stream and produces a `Buffer`.

**Also change:**
- `subscriptionRoutes.js:18` comment (`// Stripe webhook (must be before express.json())`) → replace with an accurate explanation of the URL bypass.
- `handleWebhook` (`subscription.js:141`): add a defensive coercion so a future regression fails loudly instead of silently:
  ```js
  const payload = Buffer.isBuffer(req.body)
    ? req.body
    : (() => { throw new Error("webhook body was pre-parsed"); })();
  event = stripe.webhooks.constructEvent(payload, sig, webhookSecret);
  ```
- `CLAUDE.md` → "Known gaps" bullet claiming the webhook "re-parses, works but fragile" is **wrong**; delete it and move the fix to "resolved".

**Verification — new `scripts/webhook-verify.mjs` (zero-dep, no network):**
1. Start the app with a stub `STRIPE_SECRET_KEY`.
2. Build a payload, sign it with `stripe.webhooks.generateTestHeaderString({ payload, secret })`.
3. POST it to `/api/v1/subscription/webhook` with `content-type: application/json`.
4. Assert `res.status === 200` and `{"received":true}`, and that the body arrived as a `Buffer` (log it).

**Risk:** low. Regression surface is the JSON parser for one URL; the rest of the API is untouched.

---

### 1.2 Make the DB failure path real

**Problem:** `dbConnection.js:9-11` catches and does not rethrow, so `connectDB()` resolves on failure. `index.js` `connectDB().then(() => app.listen(...))` therefore starts the server with no database, and the intended `.catch(err => process.exit(1))` never fires.

**Change — `src/db/dbConnection.js`:**

```js
const connectDB = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI, {
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 45000,
      maxPoolSize: 10,            // matches expected Render single-instance load
    });
    console.log("MongoDB connected");
  } catch (error) {
    console.error("MongoDB connection error:", error);
    throw error;                  // <- must propagate
  }
};
```

**Change — `src/index.js` bootstrap:** confirm the existing `.catch((err) => { console.error(...); process.exit(1); })` is present and reachable; if it only logs today, make it `process.exit(1)`.

**Verification:**
```bash
MONGO_URI=mongodb://127.0.0.1:9/nope node src/index.js ; echo "exit=$?"
# expect: "MongoDB connection error" + "listening" NEVER printed + exit=1
```
Add this as case 1 in `scripts/webhook-verify.mjs`'s sibling `scripts/startup-checks.mjs`, or fold both into one `scripts/preflight.mjs`.

**Risk:** low locally; on Render a bad `MONGO_URI` now fails the deploy instead of serving a broken app — that is the desired behaviour. Confirm the Render health check tolerates a non-zero exit (it restarts, which is correct).

---

### 1.3 Rate-limit the auth routes (currently wide open)

**Problem:** `src/routes/authRoutes.js` has `validate(...)` on every route but **no `rateLimiter` at all**. The existing `rateLimiter` cannot be reused as-is: `rateLimiter.js:48-53` returns 401 when `req.user` is missing, and every auth route is anonymous.

**Change — new `src/middlewares/ipRateLimiter.js`:**

```js
// Map<bucketKey, {count, resetTime}> — same lifecycle as rateLimiter.js
const store = new Map();
setInterval(() => { /* prune expired, identical to rateLimiter.js:29-36 */ }, 5 * 60 * 1000);

const BUCKETS = {
  login:    { windowMs: 15 * 60 * 1000, max: 10 },
  register: { windowMs: 60 * 60 * 1000, max: 5  },
  password: { windowMs: 60 * 60 * 1000, max: 5  },  // forget + reset
};

const ipRateLimiter = (bucket) => (req, res, next) => { /* increments, 429 + Retry-After */ };

export default ipRateLimiter;
```

**Wiring — `authRoutes.js`:**

```js
router.post("/login", ipRateLimiter("login"), validate({ body: loginSchema }), loginUser);
router.post("/register", ipRateLimiter("register"), validate({ body: registerSchema }), registerUser);
router.post("/forget-password", ipRateLimiter("password"), validate({ body: forgetPasswordSchema }), forgetPassword);
router.post("/reset-password", ipRateLimiter("password"), validate({ body: resetPasswordSchema }), resetPassword);
```

`validate` stays *after* the limiter so garbage bodies still consume quota.

**Prerequisite — `src/index.js`:** `app.set("trust proxy", 1)` when `NODE_ENV === "production"` (Render sits behind a proxy; without this `req.ip` is the proxy and all users share one bucket).

**Verification:** `for i in $(seq 1 11); do curl -s -o /dev/null -w "%{http_code}\n" -X POST .../login -H 'content-type: application/json' -d '{"username":"x","password":"y"}'; done` → last response `429` with `Retry-After`.

---

### 1.4 Stop the limiters failing open

**Problem:** both `rateLimiter.js:110-114` and `usageTracker.js:113-117` catch any error and call `next()`. Additionally `RATE_LIMITS[tier]` / `USAGE_LIMITS[tier]` throw a `TypeError` if `tier` is an unexpected string, which lands in that same catch — so an unknown tier silently grants unlimited AI.

**Change — both middlewares:**

```js
const limits = RATE_LIMITS[tier] ?? RATE_LIMITS.free;   // never index blindly
const limitConfig = limits[limitType];
...
} catch (error) {
  console.error("Rate limiter error:", error);
  if (process.env.FAIL_OPEN_ON_LIMITERS === "true") return next();
  return res.status(503).json({
    success: false,
    message: "Service temporarily unavailable, please retry",
    error: "LIMITER_UNAVAILABLE",
  });
}
```

Same shape in `usageTracker.checkUsageLimit`.

**Notes:**
- `FAIL_OPEN_ON_LIMITERS` goes into `.env.example` with a comment, default off.
- Apply fail-closed to `general` **and** `ai` alike — simpler, and a 503 is honest when the tier can't be read.
- `rateLimiter.js:62-65` (`if (!limitConfig) return next()`) stays: an unknown `limitType` is a programmer error, not a fault.

**Risk:** medium — if Mongo blips, all API traffic 503s. That is preferable to un-metered AI spend, and the env escape hatch covers emergencies. Flag it in the PR description.

---

### 1.5 Body size limits + a real schema for chat

**Problem:**
- `express.json()` has no `limit` → body-parser's default **100 KB** (measured: 150 KB body → `413 PayloadTooLargeError`). Quill Delta JSON inflates fast; a note over ~100 KB silently fails to save.
- `chatRoutes.js` registers **no `validate`** — `message` is unbounded up to that 100 KB and goes straight into a paid completion.

**Change — `src/index.js`:**
```js
const JSON_BODY_LIMIT = process.env.JSON_BODY_LIMIT || "1mb";
// used by the conditional json parser from §1.1
```

**Change — new `src/validators/chatSchemas.js`:**
```js
import { z } from "zod";

const objectId = z.string().regex(/^[0-9a-fA-F]{24}$/, "Invalid id");

export const chatSchema = z.object({
  message: z.string().trim().min(1, "Message is required").max(8000),
  chatSessionId: objectId,
  stream: z.boolean().optional().default(false),
});

export const chatWithNoteSchema = z.object({
  message: z.string().trim().min(1).max(8000),
  chatSessionId: objectId,
  noteId: objectId,
  stream: z.boolean().optional().default(false),
});
```

**Wiring — `chatRoutes.js`** (keep CLAUDE.md's documented order; `validate` before `checkUsageLimit` so a 400 doesn't burn quota):
```js
router.post("/chat", tokenChecker, rateLimiter("ai"), validate({ body: chatSchema }),
  checkUsageLimit("aiChatMessages"), trackUsage("aiChatMessages"), chat);
```

Keep the inline `if (!message ...)` guards in `chat.js` as defence in depth.

**`.env.example`:** add `JSON_BODY_LIMIT=1mb`.

**Verification:**
- `POST /api/v1/chat` with a 9 000-char message → `400` with Zod field errors, **not** an AI call (assert by log or by checking `usage.aiChatMessages` is unchanged).
- `POST /api/v1/chat` with a 2 MB body → `413`.

---

### 1.6 Stop base64 images reaching Mongo

**Problem:** `public/js/notes.js:42` puts `image` and `video` in the Quill toolbar with **no custom handler**. Quill's default clipboard matcher inlines pasted/dropped images as `data:image/png;base64,...`. One screenshot can exceed the 100 KB body limit (E3) or store megabytes in `Note.content` (a `Mixed` field).

**Change (Option A, recommended — no new endpoint):**
1. `notes.js:42` → `["link"]` only; drop `image`, `video`.
2. Add an explicit rejection so paste/drag still can't smuggle one in:
```js
import { Quill } from ... // already global
const CLIPBOARD = Quill.import("application/clipboard"); // or use the instance
quill.clipboard.addMatcher(Node.ELEMENT_NODE, (node, delta) => {
  const img = node.querySelector?.("img");
  if (img?.src?.startsWith("data:")) {
    showNoteToast("Images aren't supported yet — use a link", "error");
    return new Delta(); // drop it
  }
  return delta;
});
```
3. `src/validators/noteSchemas.js`: cap the Delta:
```js
const MAX_NOTE_JSON_BYTES = 256 * 1024;
content: z.object({ ops: z.array(z.any()).min(1) })
  .refine(c => Buffer.byteLength(JSON.stringify(c)) <= MAX_NOTE_JSON_BYTES,
          { message: `Note content exceeds ${MAX_NOTE_JSON_BYTES / 1024} KB` }),
```
Add `MAX_NOTE_JSON_BYTES` to `.env.example` only if it becomes configurable — otherwise leave it a constant.

**Option B (out of scope, listed for the future):** `POST /api/v1/notes/:id/asset` storing under `public/uploads/` + serving via a static route.

---

### 1.7 Reconcile the 50 000-char `plainText` cap

**Problem:** `models/note.js:25` `plainText: { maxlength: 50000 }`, but `content` (the Delta) has no cap. A note whose extracted plain text exceeds 50 000 throws a Mongoose `ValidationError` on save → **500** to the user, with the editor content still only local.

**Change:**
1. Apply the Zod cap from §1.6 *and* a plain-text check:
```js
function plainTextLength(delta) {
  return delta.ops
    .filter(op => typeof op.insert === "string")
    .reduce((n, op) => n + op.insert.length, 0);
}
// refine: plainTextLength(c) <= 50000, message "Note exceeds 50,000 characters"
```
2. Frontend counter: `notes.js` already has an autosave path (`:819-826`); surface a toast at 49 000 instead of failing at 50 000.

**Verification:** create a note, insert 51 000 chars of text, attempt save → `400` with a readable message; Mongoose `ValidationError` must never reach the client.

---

## 3. Phase 2 — P0 abuse & security

### 2.1 Escape regex, limit result sets, rate-limit search

**Problem:** `new RegExp(searchTerm, "i")` at `note.js:154` / `card.js:107` — Zod caps length at 100 but does not escape metacharacters, so `?query=(` returns **500** (`SyntaxError: Invalid regular expression`) and nested-quantifier patterns are a ReDoS vector. Neither search route has a `rateLimiter` (`noteRoutes.js:60`, `cardRoutes.js:62`), and no static has `.limit()`.

**Changes:**
1. New `src/utils/escapeRegExp.js`:
   ```js
   export default (s) => String(s).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
   ```
2. Use it in `Note.searchNotes`, `Card.searchCards`, and any other `new RegExp(userInput)`.
3. Add `.limit(...)` to every list static:
   - `Note.searchNotes`, `Card.searchCards` → `.limit(100)`
   - `Note.getNotesByTag`, `Note.getNotesByCategory`, `Card.getCardsByNote`, `Card.getCardsByDifficulty` → accept `{ limit = 50, skip = 0 }` options and apply them.
4. Routes: add `rateLimiter("general")` before `validate` on both search routes.
5. Add a `search` bucket to `RATE_LIMITS` in `rateLimiter.js` (`free: { windowMs: 60_000, max: 20 }`) and use `rateLimiter("search")` — sharper than borrowing `general`.

**Verification:** `GET /api/v1/notes/search?query=(` → `200` with `notes: []`, no stack trace. Add to `scripts/preflight.mjs`.

---

### 2.2 Security headers

**Problem:** no `helmet`, no `X-Content-Type-Options`, no `Referrer-Policy`.

**Change — Option A (zero-dep, preferred for this project):**
```js
app.disable("x-powered-by");
app.use((req, res, next) => {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  res.setHeader("X-Frame-Options", "SAMEORIGIN");
  next();
});
```
Place after `cookieParser`, before CORS.

**Option B (full `helmet`):** `npm i helmet`, then `app.use(helmet({ contentSecurityPolicy: false }))`. **Do not enable CSP blind** — the app loads `cdnjs.cloudflare.com` (Font Awesome), `cdn.quilljs.com`, `marked` from jsDelivr/unpkg, and `fonts.googleapis.com`/`fonts.gstatic.com`. A follow-up task must enumerate those in `script-src`/`style-src`/`font-src`/`img-src`, or it will break the editor on first load.

**Verification:** `curl -I /api/v1/health` shows the headers; `npm run smoke` still passes (headers can break framing).

---

## 4. Phase 3 — P1 AI cost

### 3.1 Add `max_tokens`

**Change — `src/utils/openai.js`:**
```js
export const chatCompletion = async (
  messages,
  model = process.env.AI_MODEL || "claude-opus-5",
  options = {},
) => {
  const { maxTokens } = options;
  const response = await openai.chat.completions.create({
    model,
    messages,
    temperature: 0.7,
    ...(maxTokens ? { max_tokens: maxTokens } : {}),
  });
  return response;
};
```
Client construction also gets `timeout` / `maxRetries` — see §3.6.

**Per-call budgets (new constants, colocated with each call site):**

| Call site | `maxTokens` |
|---|---|
| `chat.js` answering (chat) | `1500` |
| `chat.js` answering (chat-with-note) | `1800` |
| `chat.js` `runContextUpdate` | `700` |
| `note.js` enhance | `2500` |
| `card.js` flashcards | `4000` |
| `note.js` note reference | `1500` |

Env override: `AI_MAX_TOKENS` caps *all* of them (`Math.min(budget, Number(AI_MAX_TOKENS))`) for cheap experimentation without a redeploy. Add to `.env.example`.

**Risk:** a budget that's too low truncates mid-sentence. Mitigation: log when `finish_reason === "length"` so truncation is observable.

---

### 3.2 Trim what's sent, not what's stored

`chat.js:165-172`:
```js
// BEFORE
const HISTORY_LIMIT = 40;
const history = currentSession.messages.slice(-HISTORY_LIMIT);

// AFTER — dual budget: newest 12 messages AND 12 000 chars
const HISTORY_MESSAGE_LIMIT = 12;
const HISTORY_CHAR_LIMIT = 12_000;
const MAX_MESSAGE_CHARS = 4_000;

function buildHistory(messages) {
  const out = [];
  let chars = 0;
  for (let i = messages.length - 1; i >= 0 && out.length < HISTORY_MESSAGE_LIMIT; i--) {
    const m = messages[i];
    const content = m.content.length > MAX_MESSAGE_CHARS
      ? m.content.slice(0, MAX_MESSAGE_CHARS) + "\n…[truncated]"
      : m.content;
    if (chars + content.length > HISTORY_CHAR_LIMIT) break;
    chars += content.length;
    out.unshift({ role: m.sender === "user" ? "user" : "assistant", content });
  }
  return out;
}
```
Full history stays in `messages[]` (and is what the sidebar/`loadChatSession` shows) — only the prompt payload shrinks.

---

### 3.3 Throttle the context update (it doubles every request)

`runContextUpdate` (`chat.js:51-80`) is a **second paid completion per user message**, fired at `:212` (stream) and `:225` (non-stream), with the 3 945-char `contextPrompt.txt` as the system prompt.

**Change:**
1. Add `UserContext.lastContextUpdateAt: Date` (schema `src/models/userContext.js`).
2. Gate in `chat.js` before calling `runContextUpdate`:
```js
const CONTEXT_UPDATE_MIN_INTERVAL_MS = 60_000;   // at most 1/min/user
const shouldUpdateContext =
  !userContext.lastContextUpdateAt ||
  Date.now() - new Date(userContext.lastContextUpdateAt).getTime()
    > CONTEXT_UPDATE_MIN_INTERVAL_MS;
if (shouldUpdateContext) {
  userContext.lastContextUpdateAt = new Date();
  runContextUpdate(userContext, message, contextPrompt);
}
```
3. Inside `runContextUpdate`, set `lastContextUpdateAt` again on success (so a failed call retries next message).
4. Additionally gate on message count: update every 3rd user message even if under 60 s, so short bursts still build context.

**Expected saving:** ≥50% of context-update spend on active users; ~4 000 input tokens avoided on most messages.

**Alternatives considered and rejected for now:**
- Folding context extraction into the main completion (two outputs from one call) — not all OpenAI-compatible endpoints support `n>1` + per-choice usage; needs a provider spike.
- Deleting context entirely — it's a product feature (`GET /me` returns `memory`).

---

### 3.4 Cap note injection

New `src/utils/truncate.js`:
```js
export function truncateForPrompt(text, maxChars) {
  if (!text || text.length <= maxChars) return text || "";
  const head = Math.floor(maxChars * 0.6);
  const tail = maxChars - head;
  return `${text.slice(0, head)}\n\n…[middle of note omitted: ${text.length - maxChars} chars]…\n\n${text.slice(-tail)}`;
}
```

Apply at:

| Call site | Cap |
|---|---|
| `chat.js:318` (chat-with-note `noteContent`) | `24_000` |
| `note.js:385-397` (enhance `noteContext`) | `30_000` |
| `card.js:349` (flashcard source text) | `16_000` |

Keep `text.slice(0, ...)` (head-biased) for flashcards — the top of a note is usually the outline. Use head/tail for chat-with-note and enhance.

**Note:** `plainText` maxes at 50 000 (§1.7), so today a single note can inject 50 000 chars into *two* completions (answer + context). Caps above cut worst-case spend by ~50%.

---

### 3.5 Cache prompt reads

`src/utils/prompts/index.js:13-21`:
```js
const cache = new Map();

export const getPrompt = (promptName) => {
  const cached = cache.get(promptName);
  if (cached !== undefined) return cached;
  try {
    const promptPath = path.join(__dirname, `${promptName}.txt`);
    const content = fs.readFileSync(promptPath, "utf-8").trim();
    cache.set(promptName, content);
    return content;
  } catch {
    throw new Error(`Failed to read prompt file: ${promptName}`);
  }
};

export const clearPromptCache = () => cache.clear();
```
Call `clearPromptCache()` from `nodemon` restarts naturally (process restart), so no file-watcher needed. Note in the JSDoc that editing a `.txt` requires a restart in dev.

---

### 3.6 Bound the OpenAI call

`openai.js:10-13`:
```js
const openai = new OpenAI({
  apiKey: process.env.AI_API_KEY || "dummy",
  baseURL: process.env.AI_BASE_URL || "http://127.0.0.1:8319/v1",
  timeout: Number(process.env.AI_TIMEOUT_MS) || 45_000,  // SDK default is 10 min
  maxRetries: Number(process.env.AI_MAX_RETRIES) ?? 1,   // SDK default 2
});
```
Add both to `.env.example`. `maxRetries: 1` matters for cost: retries on 5xx can double-bill a request that actually completed upstream.

---

### 3.7 Collapse the 4× `User.findById` into 0

`tokenChecker.js:25` already hydrates the full user. Then `rateLimiter.js:56`, `usageTracker.js:51`, `usageTracker.js:126` each query again.

**Change:**
1. In `tokenChecker.js`, after a successful lookup set `req.userTier = user.subscription?.tier || "free"` and `req.user` (already done).
2. `rateLimiter.js:56` → `const tier = req.userTier ?? "free";` (drop the `findById`).
3. `usageTracker.checkUsageLimit:51` → reuse `req.user` for `subscription` **but keep one `findById` for `usage`**, because `tokenChecker` doesn't select it. Better: make `tokenChecker` select `+usage` when the caller asks:
   ```js
   // tokenChecker.js
   export const loadUsage = (req, res, next) => { req._loadUsage = true; next(); };
   const user = await User.findById(id).select(req._loadUsage ? "+usage subscription" : "");
   ```
   Simpler and adequate: `checkUsageLimit` keeps its own `.select("usage")` read (1 query), `incrementUsage` moves to an atomic `$inc` that doesn't need a read at all (§5.1).
4. Result per AI request: **1 (tokenChecker) + 1 (usage read) + 0 (rate limiter) + 0 (increment) = 2**, down from 4, with no staleness introduced.

**Tier staleness tradeoff:** reusing `req.user` means an upgrade applied by webhook isn't visible until the next login/refresh. Document it; it's acceptable because upgrades are rare and the frontend calls `GET /subscription/status` immediately after checkout, which re-reads from the DB.

**Verification:** `MONGOOSE_DEBUG=1` (or a `mongoose.set("debug", ...)`) log for one AI request — assert exactly 2 `User.find` calls, down from 4.

---

## 5. Phase 4 — P1 data visibility & query cost

### 4.1 The silent 20-item cap (highest user-visible impact)

**Problem:** `getCards`/`getNotes` default `limit: 20` (`card.js:46`, `note.js:47`). `flashcards.js:196-204` never appends `page`/`limit`; `notes.js:502` never does either. Notes render from `localStorage`, so on a **fresh browser** only the first 20 notes ever sync. Cards beyond 20 are simply unreachable.

**Changes — `public/js/flashcards.js`:**
```js
let cardsPage = 1;
const PAGE_SIZE = 40;
let hasMore = true;

async function loadFlashcards({ append = false } = {}) {
  ...
  params.append("page", String(cardsPage));
  params.append("limit", String(PAGE_SIZE));
  ...
  const { cards: page, pagination } = result.data;
  cards = append ? cards.concat(page) : page;
  hasMore = pagination.currentPage < pagination.totalPages;
  renderCards();
}

// "Load more" button + IntersectionObserver sentinel at the grid bottom
```
Reset `cardsPage = 1` in every filter/search change (`applyFilters`, difficulty, tag). Add a sentinel:
```js
const io = new IntersectionObserver((entries) => {
  if (entries[0].isIntersecting && hasMore && !loading) { cardsPage++; loadFlashcards({ append: true }); }
}, { rootMargin: "400px" });
io.observe(sentinelEl);
```

**Changes — `public/js/notes.js` sync (`:502`):** loop pages until `totalPages`:
```js
const PAGE_SIZE = 100;
let page = 1, total = Infinity;
const all = [];
while (page <= total && page <= 50) {          // hard safety cap
  const r = await fetch(`/api/v1/notes?page=${page}&limit=${PAGE_SIZE}`, ...);
  const d = await r.json();
  all.push(...d.data.notes);
  total = d.data.pagination.totalPages;
  page++;
}
if (page > 50 && total > 50) showNoteToast(`Synced first ${all.length} of ${...} notes`, "error");
```

**Also:** `searchCards`/`searchNotes` currently return unbounded results — §2.1's `.limit(100)` covers the server side; the UI must then show "100+ results, refine your search".

---

### 4.2 Chat session list must not ship full histories

**Problem:** `ChatSession.getChatSessionsByUserId` (`models/chatSession.js:55-57`) is `find({userId}).sort(...)` — no projection, no limit, no lean. The sidebar (`chat.js:646-690`) only needs `title`, `updatedAt`, and the **last message**; it reads `session.messages[messages.length-1].content.substring(0,50)`.

**Change — `models/chatSession.js`:**
```js
chatSessionSchema.statics.getChatSessionsByUserId = function (userId, limit = 50) {
  return this.find({ userId })
    .sort({ updatedAt: -1 })
    .limit(limit)
    .select("title createdAt updatedAt messages")
    .slice("messages", -1)          // only the last message travels
    .lean();
};
```
`.slice("messages", -1)` is the Mongoose array-slice projection — the whole `messages` array stays on disk.

**Frontend:** `chat.js:656-658` still works (`session.messages[session.messages.length - 1]` now has exactly one element).

**`findEmptySession` (`chat.js:666`)** currently re-fetches *all* sessions just to find one with `messages.length === 0`. Replace with a server endpoint:
```js
// chatSessionRoutes.js
router.get("/empty", tokenChecker, findOrCreateEmptySession);
// controller: findOne({userId, "messages.0": {$exists: false}}) ?? create new
```

**Verification:** `GET /api/v1/chat-sessions` with 30 sessions totalling 10 000 messages → response size drops from MB-scale to KB-scale; log `Buffer.byteLength(JSON.stringify(res))` before/after.

---

### 4.3 `.lean()` on list endpoints

Add `.lean()` to:
- `models/note.js:139` `getUserNotes` (has `.select("-__v")`, no lean)
- `models/card.js:97` `getUserCards`
- `models/note.js:147/162/173` search/tag/category statics
- `models/card.js:101/115/125` search/note/difficulty statics

**Caveat:** `.lean()` returns plain objects — audit each call site for `.save()`/`markAsReviewed()` on a returned doc. `card.js:315` calls `markAsReviewed()` but on a `Card.findById` path, not the list path; confirm before enabling. Where a returned doc is mutated, keep hydrated.

---

### 4.4 Indexes

New **`scripts/reindex.mjs`** (idempotent, safe to run repeatedly) + schema definitions so `syncIndexes()` stays the source of truth:

```js
// models/chatSession.js
chatSessionSchema.index({ userId: 1, updatedAt: -1 });

// models/user.js
userSchema.index({ "subscription.stripeCustomerId": 1 });

// models/note.js — matches getUserNotes sort {isPinned:-1, lastEditedAt:-1}
noteSchema.index({ userId: 1, isArchived: 1, isPinned: -1, lastEditedAt: -1 });

// models/card.js — matches getUserCards sort {isPinned:-1, createdAt:-1}
cardSchema.index({ userId: 1, isPinned: -1, createdAt: -1 });
cardSchema.index({ userId: 1, difficulty: 1 });
```

`scripts/reindex.mjs`:
```js
import mongoose from "mongoose";
// import every model, then:
for (const m of Object.values(mongoose.models)) {
  console.log(await m.ensureIndexes());  // or syncIndexes() to drop orphans
}
process.exit(0);
```
Add `"reindex": "node scripts/reindex.mjs"` to `package.json`. Document in CLAUDE.md that index changes require a reindex run.

**Verification:** `Note.find({userId, isArchived:false}).sort({isPinned:-1, lastEditedAt:-1}).explain("executionStats")` → `totalDocsExamined` ≈ `nReturned`, no `COLLSCAN`.

**Do not** drop the existing text indexes (`note.js:100`, `card.js:82`) in this phase — see §10.

---

### 4.5 Music route caching

`musicController.js`: `existsSync` (`:17`) + `readdirSync` (`:27`) + `statSync` per file (`:39`) on every request.

**Change:**
```js
let listCache = { at: 0, files: [] };
const LIST_TTL_MS = 30_000;

async function getFiles() {
  if (Date.now() - listCache.at < LIST_TTL_MS) return listCache.files;
  const files = (await fs.promises.readdir(MUSIC_DIR)).filter(f => f.endsWith(".mp3"));
  listCache = { at: Date.now(), files };
  return files;
}
```
- Replace `statSync` with `fs.promises.stat` (or store size/mtime in the same cache entry).
- `/info/:filename` and the list route: `ETag: W/"<mtimeMs>-<size>"` + `Cache-Control: public, max-age=300`.
- `/stream/:filename`: keep `Accept-Ranges`/`206`; add `ETag` and honour `If-None-Match` → `304`.
- Keep the path-traversal guard exactly as-is.

**Verification:** 100 sequential `GET /api/v1/music` → time before/after; `curl -I` shows `etag`, and a repeat request returns `304`.

---

## 6. Phase 5 — P1 concurrency & atomicity

### 5.1 Atomic usage accounting (fixes B7, removes the `res.json` monkey-patch)

**Current flow:** `checkUsageLimit` reads `count` → controller runs → `trackUsage` patches `res.json` → `incrementUsage` reads again → `$inc`. Two reads, one write, TOCTOU window, and a monkey-patched framework method.

**Recommended design (keeps "only count 2xx" semantics, closes the race):**

Split into *reserve* (atomic, bounded) and *settle* (no-op if reserved):
```js
// reserveUsage(type): called BEFORE the controller
const reserveUsage = (usageType) => async (req, res, next) => {
  const limit = (USAGE_LIMITS[req.userTier] ?? USAGE_LIMITS.free)[usageType];
  if (limit === undefined || limit === Infinity) { req.usageReserved = true; return next(); }

  const now = new Date();
  const reset = getNextMonthDate();
  // 1. roll the month if stale
  await User.updateOne(
    { _id: req.user._id, [`usage.${usageType}.resetDate`]: { $lt: now } },
    { $set: { [`usage.${usageType}.count`]: 0, [`usage.${usageType}.resetDate`]: reset } },
  );
  // 2. conditional increment — the atomic check
  const doc = await User.findOneAndUpdate(
    { _id: req.user._id, [`usage.${usageType}.count`]: { $lt: limit } },
    { $inc: { [`usage.${usageType}.count`]: 1 } },
    { new: true, select: "usage subscription" },
  );
  if (!doc) { /* 403 with the same body shape as today (usageTracker.js:87-100) */ }
  req.usageReserved = true;
  req.usageInfo = { type: usageType, ... };
  next();
};

// releaseUsage(type): mounted AFTER the controller, refunds on non-2xx
const releaseUsage = (usageType) => (req, res, next) => {
  res.on("finish", () => {
    if (req.usageReserved && res.statusCode >= 400) {
      User.updateOne({ _id: req.user._id }, { $inc: { [`usage.${usageType}.count`]: -1 } }).catch(() => {});
    }
  });
  next();
};
```

**Trade-off (must be stated in the PR):** reserve-then-refund briefly holds quota for in-flight requests, so N concurrent requests can each see `count < limit` only if the atomic `$inc` allows it — it does. Worst case under refund-on-error there is **no** over-count; worst case without refund there is no over-count either. This is strictly better than today.

**Route migration — replace `checkUsageLimit` + `trackUsage` with `reserveUsage` + `releaseUsage` in:**
- `chatRoutes.js` (2 routes)
- `noteRoutes.js` (enhance)
- `cardRoutes.js` (AI generate)

**Streaming path:** `chat.js:207` calls `incrementUsage` directly today. With reserve-first it is already counted → **delete** that direct call and the comment at `chatRoutes.js:14-16`.

**Keep exported** `checkUsageLimit`/`trackUsage`/`incrementUsage` temporarily as deprecated aliases so `test-routes.js` and any docs don't break; remove them in the final cleanup commit.

**Verification:** parallel `Promise.all` of 40 `POST /chat` against a free-tier user (limit 20) → exactly 20 succeed, 20 return 403, and `usage.aiChatMessages.count === 20`.

---

### 5.2 Atomic chat-session writes (fixes E6: lost messages)

**Problem:** `chat.js` calls `currentSession.save()` twice per request (`:122` + `:201` for `chat`, `:315` + `:397` for `chat-with-note`). Mongoose `$set`s the whole `messages` array, so two concurrent sends on the same session overwrite each other.

**Change:** stop round-tripping the document.

```js
// 1. append user message (atomic)
await ChatSession.updateOne(
  { _id: chatSessionId, userId },
  { $push: { messages: { sender: "user", content: message } },
    $set: { updatedAt: Date.now() } },
);

// 2. title from first message — atomic, only when empty
await ChatSession.updateOne(
  { _id: chatSessionId, userId, title: "New Chat", "messages.1": { $exists: true } },
  { $set: { title: generatedTitle } },
);

// 3. read history for the prompt WITHOUT pulling the whole array
const session = await ChatSession.findOne({ _id: chatSessionId, userId })
  .slice("messages", -HISTORY_MESSAGE_LIMIT)   // matches §3.2
  .select("title messages");
const history = buildHistory(session.messages);

// 4. append AI message after the completion (atomic)
await ChatSession.updateOne(
  { _id: chatSessionId, userId },
  { $push: { messages: { sender: "ai", content: answer } },
    $set: { updatedAt: Date.now() } },
);
```
Same for `chatWithNote`. The `messages.length === 0` title check at `:110-118` is replaced by the `"messages.1": {$exists: true}` guard in step 2 (safe: step 1 already pushed the user message, so index `1` exists only if the session was previously empty).

**Verify title correctness:** first message → title becomes first 6 words + `...` when >6 words; second message → title unchanged.

---

### 5.3 Stop returning before cards exist (fixes B6)

**Problem:** `card.js:436` `setImmediate(() => Card.insertMany(validCards).catch(...))` responds first; `flashcards.js:744` masks it with `setTimeout(() => loadFlashcards(), 1000)`.

**Change:** `await Card.insertMany(validCards)` inside the handler, then respond with the count and the created ids. Inserting ≤20 small docs is single-digit milliseconds — the fake async buys nothing and costs correctness.

- Delete `flashcards.js:744` (and its comment "Wait a bit for backend to save cards").
- Render the returned cards directly (or `loadFlashcards()` once, synchronously).
- Enforce `validCards.length <= 20` server-side (the prompt says 20; nothing enforces it).

**Verification:** `POST /api/v1/cards/ai` → response → immediate `GET /api/v1/cards` → cards present, no 1 s wait. If `insertMany` fails, return `500`, not `200`.

---

### 5.4 One-query ownership check (fixes B9)

Three controllers do `findById(_id)` then a second `if (doc.userId.toString() !== userId) return 403`:
`chat.js:286/297`, `note.js:345/356`, `card.js:331/341`.

**Change:**
```js
const note = await Note.findOne({ _id: noteId, userId: req.user._id });
if (!note) return res.status(404).json({ success: false, message: "Note not found" });
```

**Behaviour change — document loudly in the PR:** foreign IDs return **404 instead of 403**. That is an improvement (no existence oracle), but any client branching on 403 must be updated. Grep `test-routes.js` and the frontend for `403` before merging.

---

## 7. Phase 6 — P2 streaming & render performance

### 6.1 Compression defeats the paced stream (verified)

Measured: with `compression()` enabled, all chunks arrived at **146 ms** (first == last), vs. 5 chunks spread over 100 ms without it.

**Option A (recommended — keep the pacing, stop compressing it):**
```js
// chat.js streamAnswer, before res.flushHeaders()
res.setHeader("Content-Encoding", "identity");
res.setHeader("Vary", "Accept-Encoding");
```
Then assert the header survives to the wire and chunks are staggered. `compression`'s filter honours a pre-set `Content-Encoding` — **must be verified** by the test below, not assumed.

**Option B (simpler, fewer moving parts):** delete server pacing entirely. `public/js/chat.js` already runs a client-side typewriter at ~220 cps, so the visual result is identical. Remove `streamAnswer`, `STREAM_CHUNK_MS`, `STREAM_WORDS_PER_CHUNK`, and keep `Content-Type: text/plain` + the full body in one write. This also removes the `incrementUsage` special case (§5.1) and the `res.on("close")` bookkeeping.

**Option C (only if A and B are rejected):** mount `express.json()` *before* `compression()` for API paths so `req.body.stream` is known, then use `compression({ filter })`. Largest blast radius — last resort.

**Recommendation:** try B first. It is the smallest diff and eliminates a whole class of buffering bugs.

**Verification — add to `scripts/preflight.mjs`:**
```js
// measure chunk arrival spread on a streamed chat reply
// Option A/B: assert firstChunkMs < 50 OR body is single-shot with no pacing claim
```

---

### 6.2 Stop re-parsing markdown 60×/second

`public/js/chat.js:586` runs `escapeHtml` + regex + `innerHTML` on the whole accumulated string on **every rAF frame** while streaming — O(n²) over a long answer.

**Change:**
```js
const RENDER_INTERVAL_MS = 100;   // 10 fps while streaming
let lastRender = 0;

function frame(ts) {
  ...
  if (ts - lastRender >= RENDER_INTERVAL_MS) {
    lastRender = ts;
    renderPartial(displayed);
  }
  ...
}
// final full render when the stream completes (index >= chunks.length)
```
Optionally skip the intermediate markdown pass entirely: append the growing tail as escaped plain text, then run `renderMarkdown` once at completion. The 100 ms throttle is the low-risk version — do that first.

**Verification:** stream a 3 000-word answer, profile `renderMarkdown` call count in dev (`console.count`); expect ~30 for a 3 s stream instead of ~180.

---

### 6.3 Notes list rebuild (`notes.js:119-122`)

Full `innerHTML = ""` + rebuild on every mutation. Not a hot loop (search filters in place at `notes.js:781-801` without rebuilding), so this is lower priority than §6.2.

**Change:** patch the single node when only one note changed:
```js
function updateNoteItem(note) {
  const el = list.querySelector(`.note-item[data-id="${note.id}"]`);
  if (!el) return renderNotesList();        // fall back to full rebuild
  el.outerHTML = noteCardTemplate(note);     // or mutate children
}
```
Call `updateNoteItem` from pin/color/title updates; keep `renderNotesList()` for load, delete, filter and search changes.

---

### 6.4 Flashcards render + redundant requests

| Item | Change |
|---|---|
| `flashcards.js:257` full grid rebuild | Acceptable; keep for filter changes |
| `flashcards.js:306-322` per-card re-bind | Replace with **one** delegated listener on the grid: `grid.addEventListener("click", e => { const card = e.target.closest("[data-card-id]"); ... })` |
| `flashcards.js:744` `setTimeout(..., 1000)` | Delete (superseded by §5.3) |
| `flashcards.js:216` `await updateTagOptions()` inside every `loadFlashcards()` | Move to boot + tag mutation only → **-1 request per search** |
| Debounce | **Already present** at `:335-340` (500 ms) — do not add another |
| `card.js:315` `markAsReviewed` PATCH per flip | Acceptable (it's a real state change); note as a candidate for batching if it ever shows in traces |

---

## 8. Phase 7 — P2 frontend correctness

### 7.1 Duplicate `id="searchInput"` (confirmed broken)

`notes-content.ejs:32` and `flashcards-content.ejs:24` both use `id="searchInput"`. `getElementById` returns the **notes** input (earlier in the document), so:
- `flashcards.js:329` `applyFilters()` reads the **notes** box value
- `flashcards.js:772` binds its listener to the **notes** box → every Notes keystroke fires a debounced `/cards/search` + `/cards/tags`
- the real Cards input only has an inline `oninput="handleSearch()"`, which fires but filters against the wrong text

**Change:**
1. `flashcards-content.ejs:24` → `id="cardSearchInput"` (keep `name`/`aria-label` unique too).
2. `flashcards.js` — every lookup → `document.getElementById("cardSearchInput")` (lines ~329, ~772, and any `querySelector("#searchInput")`).
3. `notes.js:781` — keep `getElementById("searchInput")` (the notes box).
4. Grep the whole repo for `#searchInput` / `"searchInput"` afterwards to confirm exactly two distinct ids remain, one per pane.

**Verification:** type in Notes → Network tab shows **no** `/api/v1/cards/*` request. Type in Cards → results filter by the Cards text.

---

### 7.2 A slow Quill CDN stalls `den.js`, `flashcards.js`, and `nav.js`

Both `<script defer>` tags sit in `notes-content.ejs:149-150`, before `notes.js:527`, and pane include order in `app.ejs` is chat → **notes** → den → cards → nav. Deferred classic scripts execute in document order, so a slow Quill/marked fetch delays all four later scripts — navigation included.

**Change:**
1. Move the Quill and marked `<script defer>` tags from `notes-content.ejs` to `head.ejs` (or immediately after `common/loader.js`), so they resolve **in parallel with** the other deferred scripts rather than ahead of them in the queue.
   - Keep the Quill **CSS** where it is.
   - Keep `tailwind.css`, Font Awesome, Google Fonts untouched.
2. Guard the top-level editor construction — `notes.js:9` currently does `const quill = new Quill(...)` at module scope:
```js
let quill = null;
function initEditor() {
  if (quill || typeof Quill === "undefined") return quill;
  quill = new Quill("#editor", { theme: "snow", modules: { toolbar: [...] } });
  ...
  return quill;
}
// call initEditor() lazily on first Notes-pane interaction / first render
```
   Every `quill.*` call site must go through `initEditor()`.
3. Same guard for `marked` at `notes.js:456` (`if (typeof marked === "undefined") return escapeHtml(md);`).

**Verification:** `npm run smoke` (exercises all four panes) + a manual run with DevTools → Network → "Offline" after first load, to confirm the app still boots and nav still works when the CDN is unreachable.

---

### 7.3 Theme flash of unstyled content

`theme.js:30` applies `data-theme` on `DOMContentLoaded`; `profile.js:379-385` and `:485` duplicate the same work. Dark-mode users see a light flash on every load.

**Change — `head.ejs`:** put the attribute on as early as possible. Since the CSS selectors are `[data-theme="dark"]` on `<body>` (not `:root`), the script must run *before body content paints*:
```html
<body>
<script>
  (function () {
    var t = localStorage.getItem("theme");
    if (t) document.body.setAttribute("data-theme", t);
  })();
</script>
  ...rest of body...
```
A blocking script as the **first child of `<body>`** executes before any sibling content renders → no flash, no CSS selector changes. (Do not use `defer` here — that defeats the purpose.)

**Dedupe:** make `theme.js` the single owner of `loadSavedTheme`; have `profile.js:379-385` and `:485` call `window.RetroTheme?.load()` instead of re-implementing it. Export it explicitly.

**Verification:** DevTools → Emulate `prefers-color-scheme` irrelevant (theme is `localStorage`, not media query); reload with `localStorage.theme = "dark"` and watch for a light frame in the Performance panel.

---

### 7.4 `transition: all` on `body`

**Change — `head.ejs`:** replace `transition: all .3s ease` with an explicit property list (`background-color, color, border-color, box-shadow`) or remove it. `transition: all` forces the browser to track every property and repaints on any class change — a known jank source, and the theme toggle only needs two or three properties.

---

### 7.5 `content-visibility` on the off-screen panes (risk-test before merging)

`.horizontal-container` is 400% wide (`head.ejs:125-131`); three of four `.page-section`s are permanently outside the viewport but still laid out.

**Change — `head.ejs`:**
```css
.page-section {
  content-visibility: auto;
  contain-intrinsic-size: auto 100vw;   /* avoids scroll/layout jumps */
}
```

**⚠️ Required manual test before this ships:**
1. Open the Notes pane, put the caret in the Quill editor, switch to Chat, switch back → caret position, scroll offset, and toolbar state must be intact.
2. Repeat with the Den pane (WebGL canvas) and Flashcards.
3. Verify `position: fixed` overlays (profile modal, delete modal) still lay out correctly while their pane is skipped.
4. If **anything** misbehaves, narrow the rule to `#flashcardsSection` and `#denSection` only — neither contains a Quill editor.

`contain-intrinsic-size` is mandatory: without it the browser assumes 0×0 and the horizontal scroll position jumps on every pane switch.

---

## 9. Phase 8 — P3 polish

### 8.1 den.js — corrected scope

The original claim was partly wrong. Preserve what already works:

| Claimed fix | Verdict | Action |
|---|---|---|
| "115-step raymarcher is expensive" | Steps are `MARCH(20)+25+30+40 = 115` — true, but that's the effect's design | **No change** (unless a perf budget is set later) |
| "cap to 30 fps" | `den.js:519-524` already throttles to 60 fps desktop / 24 fps mobile via `frameInterval` | **No change** |
| "pause on `document.hidden`" | Browsers already stop firing rAF for hidden documents | **No change** for rAF |
| "auto-starts off-pane" | Only for the few ms between `den.js` boot and `nav.js`'s first `section:change` | **Optional:** defer `loadAmbientPrefs()` until the first `section:change` with `index === 2` — saves one WebGL create+destroy per page load |
| "suspension missing" | `den.js:1422` + `nav.js` already suspend correctly | **No change** |

**Do add:** `visibilitychange` → pause/resume the **pomodoro `setInterval`** (`den.js:292`) when the tab is hidden. rAF is free, but a 1 Hz interval is not, and a timer that ticks while hidden is also wrong behaviour.

**Cleanup:** remove `bg-yellow-400` from `den.js:246-272` — it is the only class there that is absent from `public/css/tailwind.css` and unused elsewhere.

---

### 8.2 Smaller items

- **`helmet`/CSP follow-up** (if Option B of §2.2) — enumerate CDN allowlists.
- **`Trust proxy`** — already required by §1.3; put it in the same commit as the IP limiter.
- **`package.json`:** add `"preflight": "node scripts/preflight.mjs"` and `"reindex": "node scripts/reindex.mjs"`.
- **`.env.example`:** add `JSON_BODY_LIMIT`, `AI_MAX_TOKENS`, `AI_TIMEOUT_MS`, `AI_MAX_RETRIES`, `FAIL_OPEN_ON_LIMITERS`.
- **`CLAUDE.md`:** after each merged phase, update the relevant section (env table, middleware docs, "Known gaps"). Specifically:
  - delete the incorrect webhook bullet,
  - document `ipRateLimiter`,
  - document `reserveUsage`/`releaseUsage` replacing `checkUsageLimit`/`trackUsage`,
  - document that `content-visibility` is on `.page-section` if §7.5 ships,
  - document the reindex script.
- **`src/views/README.md`** — no changes expected (no new pages).

---

## 10. Explicitly out of scope / rejected

| Item | Why rejected |
|---|---|
| Tailwind **safelist** for `den.js` classes | **Audited and false.** `tailwind.config.js` content includes `./public/js/**/*.js`; a static scan of every `bg\|text\|border\|ring\|shadow\|from\|to\|via` literal across all 7 JS files found **zero** classes missing from `public/css/tailwind.css`. The existing safelist exists only for `chat.js`'s `bg-${isUser ? ... : ...}` template composition, which genuinely can't be scanned. Only action: delete the unused `bg-yellow-400` (§8.1). |
| Replace `$regex` with `$text` search | CJK tokenisation, no `indeterminate` substring matching, and relevance ranking changes UX. Escape + limit + rate-limit (§2.1) fixes the actual bugs. Keep the text indexes for a later spike. |
| Redis-backed rate limiting | Correct for multi-instance prod, but the app runs as a single Render instance and CLAUDE.md already flags this. Document as a hard requirement before scaling out; do not add a dependency now. |
| Real SSE / true token streaming | Larger change with provider-specific streaming support. §6.1 Option B removes the bug at a fraction of the cost. |
| `document.hidden` rAF handling | Redundant — rAF is already throttled by the browser. |
| den.js 30 fps cap | A cap already exists (60/24). |
| Image upload endpoint (§1.6 Option B) | Product feature, not perf/correctness. |
| Deduplicating note storage (localStorage **and** Mongo) | Architectural; noted for a future pass. Two sources of truth is a real design smell but rewriting it is not in this plan. |

---

## 11. Verification matrix

Run every row before opening the PR. `BASE_URL` defaults to `http://localhost:8000`; the server must be running.

| # | Check | Command / method | Expected |
|---|---|---|---|
| V1 | Lint | `npm run lint` | 0 errors |
| V2 | Tailwind rebuild | `npm run build:css` (only if classes changed) | committed `public/css/tailwind.css` updated |
| V3 | Smoke (4 panes) | `npm run smoke` | pass |
| V4 | Live class coverage | `node scripts/css-coverage.mjs` | no missing classes |
| V5 | Manual API suite | `node test-routes.js` | pass (**destructive** — creates and deletes its own data) |
| V6 | Webhook signature | `node scripts/preflight.mjs` (new) | signed Stripe payload → `200 {"received":true}` |
| V7 | DB failure path | `MONGO_URI=mongodb://127.0.0.1:9/nope node src/index.js` | no "listening", `exit=1` |
| V8 | Body limits | 2 MB POST → `413`; 9 000-char message → `400` (no AI call) | both as expected |
| V9 | Regex safety | `GET /notes/search?query=(` | `200` + empty, no 500 |
| V10 | Auth IP limiter | 11× bad login | 11th → `429` + `Retry-After` |
| V11 | Usage atomicity | 40 parallel `POST /chat` on free tier | exactly 20 succeed; `count === 20` |
| V12 | Pagination | 25 cards / 30 notes → reload in a fresh browser | all visible via load-more / full sync |
| V13 | Search isolation | type in Notes → no `/cards/*` request; type in Cards → correct results | both hold |
| V14 | Script ordering | DevTools offline after first load | app boots, nav works, editor degrades gracefully |
| V15 | Theme | `localStorage.theme=dark`, reload | no light frame |
| V16 | Streaming | measure chunk spread | either staggered (Option A) or single-shot with client typewriter (Option B) |
| V17 | Indexes | `.explain("executionStats")` on the 4 sorted queries | no `COLLSCAN` |
| V18 | `content-visibility` | manual pane-switch test with an open editor | no caret/scroll loss |

**New scripts to author:**
- `scripts/preflight.mjs` — V6, V7, V8, V9, V10, V16 (idempotent, no external network except localhost).
- `scripts/reindex.mjs` — V17.
- Update `scripts/smoke-test.mjs` if §5.3 removes the 1 s wait (it may already assert on it).

---

## 12. Commit sequence

One logical change per commit, `dev` branch only, in this order (each independently lint- and smoke-clean):

| # | Prefix | Subject |
|---|---|---|
| 1 | `docs:` | `record audit verdicts and implementation plan (docs/implementation-plan.md)` |
| 2 | `fix:` | `bypass express.json for Stripe webhook so signature verification works` |
| 3 | `fix:` | `propagate Mongo connect failure and exit instead of listening blind` |
| 4 | `feat:` | `add IP rate limiter to auth routes (trust proxy in production)` |
| 5 | `fix:` | `fail closed on limiter/usage errors instead of allowing through` |
| 6 | `feat:` | `add Zod schema for chat routes and configurable JSON body limit` |
| 7 | `fix:` | `block base64 image embedding and cap note content size` |
| 8 | `fix:` | `escape regex input and limit rate-limit search endpoints` |
| 9 | `feat:` | `add baseline security headers` |
| 10 | `perf:` | `add max_tokens budgets and OpenAI timeout/retries` |
| 11 | `perf:` | `cap chat history payload and truncate note context injection` |
| 12 | `perf:` | `cache prompt file reads and throttle context updates` |
| 13 | `perf:` | `drop duplicate User lookups in rate limiter and usage tracker` |
| 14 | `fix:` | `send page/limit from notes and flashcards, add load-more` |
| 15 | `perf:` | `project chat session list and lean list statics` |
| 16 | `chore:` | `add missing indexes and reindex script` |
| 17 | `perf:` | `cache music file listing and add ETag/304` |
| 18 | `fix:` | `make usage accounting atomic with reserve/release` |
| 19 | `fix:` | `write chat messages atomically to stop lost updates` |
| 20 | `fix:` | `await flashcard insert before responding, drop client timeout` |
| 21 | `fix:` | `single-query ownership check in note/card/chat controllers` |
| 22 | `fix:` | `rename duplicate searchInput id and scope per pane` |
| 23 | `fix:` | `move Quill/marked CDN out of the deferred pane order, lazy-init editor` |
| 24 | `fix:` | `apply theme before first paint and remove duplicate loader` |
| 25 | `perf:` | `throttle streamed markdown re-render` |
| 26 | `fix:` | `replace body transition:all with explicit properties` |
| 27 | `perf:` | `scope streaming response off compression` (or `fix: remove server-side fake streaming`) |
| 28 | `perf:` | `content-visibility for off-screen panes` — **separate commit, revert independently if the Quill test fails** |
| 29 | `perf:` | `den: pause pomodoro timer when tab hidden, defer ambient boot` |
| 30 | `docs:` | `update CLAUDE.md and .env.example for the dev changes` |

Do **not** squash into one commit — each phase must be individually revertible.

---

## 13. Risk register & rollback

| Risk | Severity | Mitigation |
|---|---|---|
| §1.4 fail-closed 503s all traffic on a Mongo blip | Medium | `FAIL_OPEN_ON_LIMITERS=true` escape hatch; alert on `LIMITER_UNAVAILABLE` |
| §5.1 reserve/release changes quota semantics | Medium | Keep the exact 403 body shape (`usageTracker.js:87-100`); verify with V11 |
| §5.4 403 → 404 for foreign ids | Low | Grep `test-routes.js` + frontend for 403 before merge |
| §7.5 `content-visibility` breaks Quill focus | High if shipped blind | Isolated commit `28`; manual test V18; narrow to flashcards+den if it fails |
| §7.2 script reorder breaks pane init order | Medium | `npm run smoke` (V3) covers all four panes; commit is isolated |
| §6.1 `Content-Encoding: identity` not honoured by `compression` | Medium | Measure in V16; fall back to Option B (delete pacing) in the same commit if it fails |
| §1.1 JSON parser bypass is URL-string matching | Low | Exact `originalUrl` match + defensive `Buffer.isBuffer` throw in `handleWebhook` |
| §3.3 `max_tokens` too low truncates answers | Low | Log `finish_reason === "length"`; `AI_MAX_TOKENS` env override without redeploy |
| §4.1 new pagination changes list rendering | Medium | `loadFlashcards({append})` only appends; filters reset to page 1; covered by V12 |

**Rollback strategy**
- All work lives on `dev`; `main` is untouched until the PR merges.
- Each commit is one logical change → `git revert <sha>` for any individual phase.
- Phases 1, 2, 5 are the ones to land first and independently; phases 6–8 can be split across later PRs from `dev` if the diff gets large.
- Feature-flag candidates (env vars, no redeploy): `FAIL_OPEN_ON_LIMITERS`, `AI_MAX_TOKENS`, `JSON_BODY_LIMIT`.

**Definition of done**
1. Every row of §11 passes on `dev`.
2. PR `dev` → `main` is green on GitHub Actions (`lint` + `smoke`).
3. `CLAUDE.md` and `.env.example` updated in commit 30.
4. `docs/implementation-plan.md` has each completed phase ticked off (add a `Status` column as phases land).
