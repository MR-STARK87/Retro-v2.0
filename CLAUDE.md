# CLAUDE.md

This file provides guidance for Claude Code (and other agents) when working in this repository.

## Project Overview

**Retro** — an AI-powered smart study assistant (a minor project submission). Full-stack Node.js/Express app with server-rendered EJS frontend, MongoDB storage, AI features via an OpenAI-compatible provider (see `src/utils/openai.js`), and an optional Stripe subscription layer.

- **Runtime:** Node.js >= 18 (developed on v22.11.0; no `engines` field in `package.json` — enforced by convention)
- **Backend:** Express 5 + Mongoose
- **Frontend:** EJS templates + Tailwind CSS (CDN) + Quill Delta rich text + Font Awesome + Quill snow theme (see `src/views/partials/head.ejs:1`) + horizontal 4-pane layout (`app.ejs`)
- **Database:** MongoDB (6 collections: User, Note, Card, ChatSession, UserContext, Subscription)
- **AI:** OpenAI SDK pointed at an OpenAI-compatible endpoint — **currently** `http://127.0.0.1:8319/v1` with `apiKey: "dummy"` and default model `claude-opus-5` in `src/utils/openai.js:8` (local provider; comment refs `provider/README.md`). `.env.example` still advertises `GROQ_API_KEY` for `https://api.groq.com/openai/v1` — code no longer reads it (stale env var, see Known Gaps).
- **Emails:** Nodemailer (Mailtrap SMTP in development, `src/utils/mail.js:5`)
- **Payments:** Stripe (optional — app runs without it, bootstrap warning in `src/index.js:98`)

## Commands

```bash
npm run code       # Start dev server with nodemon (src/index.js)  [primary dev command]
node src/index.js # start without watcher
npm run lint      # ESLint (flat config, eslint.config.js) — src/, scripts/, public/js/
npm run smoke     # headless-Chrome CDP smoke test (needs running server + Chrome; see scripts/smoke-test.mjs)
node scripts/css-coverage.mjs  # verifies every live DOM class has a CSS rule (needs running server + Chrome)
npm run build:css # compile Tailwind (v3.4.17 pinned) -> public/css/tailwind.css (minified)
npm run watch:css # same, watch mode
node test-routes.js  # manual API smoke test suite (requires running server)
```

- `npm test` just echoes "no test specified". The real automated checks are `npm run smoke` (UI) and `node test-routes.js` (API, manual).
- **Note:** `nodemon` is not listed in `package.json` dependencies/devDependencies — `npm run code` requires a global install (`npm i -g nodemon`) or adding it as a devDependency. `package-lock.json` exists on disk but is gitignored (see `.gitignore:3`).
- **Tailwind is a compiled v3 build** (`public/css/tailwind.css`, committed). If you add/modify utility classes in views or `public/js/`, rerun `npm run build:css`. Do NOT upgrade to Tailwind v4 (v4 renamed utilities like `shadow-sm`→`shadow-xs` and would change the look). Dynamically-composed classes (e.g. `bg-${...}` ternaries in `public/js/chat.js`) must go in the `safelist` of `tailwind.config.js`.

## Environment Variables

Create a `.env` in the project root. **`src/index.js:24` loads `dotenv` first**, and several modules also call `dotenv.config()` (`dbConnection.js:3`, `openai.js:4`, `mail.js:3`, `user.js:7`, `controllers/auth.js:11`).

`.env.example` is mostly aligned to what the code reads, but **diverges on AI config** (see row below). The code actually uses:

| Used by code | Variable(s) | Notes |
|--------------|-------------|-------|
| `dbConnection.js:7` | `MONGO_URI` |  |
| `index.js:28,31` | `PORT` (default 3000), `NODE_ENV`, `FRONTEND_URL` (CORS allowlist in production), `STRIPE_SECRET_KEY` (optional) | `allowedOrigins` also hardcodes `localhost:5173/3000/5500` |
| `user.js:105` / `tokenChecker.js:24` / `viewTokenChecker.js:23` / `controllers/auth.js` | `ACCESS_TOKEN_SECRET`, `REFRESH_TOKEN_SECRET`, `ACCESS_TOKEN_EXPIRY`, `REFRESH_TOKEN_EXPIRY` (expiries parsed as int via `parseInt` — treat as seconds) | 86400≈24h, 604800≈7d |
| `openai.js:8` | **none of `GROQ_API_KEY`** — file hardcodes `apiKey:"dummy"`, `baseURL:"http://127.0.0.1:8319/v1"`, default model `claude-opus-5` | `.env.example:14` still lists `GROQ_API_KEY` for Groq; keeping both works but `GROQ_API_KEY` is currently unused |
| `mail.js:6` | `MAILTRAP_SMTP_HOST`, `MAILTRAP_SMTP_PORT`, `MAILTRAP_SMTP_USER`, `MAILTRAP_SMTP_PASS` |  |
| `subscription.js:7,100,354` | `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_PRICE_PRO_MONTHLY`, `STRIPE_PRICE_PRO_YEARLY`, `STRIPE_PRICE_PREMIUM_MONTHLY`, `STRIPE_PRICE_PREMIUM_YEARLY`, `CLIENT_URL` (checkout `success_url`/`cancel_url` + portal `return_url`; falls back to `http://localhost:3000`) |  |

Key values: `PORT=3000`, `NODE_ENV=development`, `MONGO_URI`, secrets min 256-bit, `ACCESS_TOKEN_EXPIRY` in seconds (86400 ≈ 24h), `REFRESH_TOKEN_EXPIRY` in seconds (604800 ≈ 7d), Mailtrap SMTP creds, `FRONTEND_URL` + `CLIENT_URL` (both default to `http://localhost:3000`).

Do **not** commit `.env`. `.gitignore:6` ignores `.env` + `.env.*local`.

## Architecture & Conventions

### Module system
ES Modules (`"type": "module"` in `package.json:6`) throughout. Use `export default`/`import x from ".../.js"`.

### Directory layout
```
My server (project root)
├── public/           # static assets served at "/" (express.static + maxAge 1d, src/index.js)
│   ├── assets/images/
│   ├── css/          # tailwind.css (compiled, committed) + app.css (app shell + shared components)
│   ├── js/           # extracted pane scripts (deferred, classic scripts sharing window.* globals)
│   │   ├── common/   # events.js (RetroEvents pub/sub), loader.js (loadScript cached CDN loader)
│   │   ├── chat.js notes.js den.js flashcards.js nav.js profile.js theme.js
│   ├── music/        # ambient music files (mp3/wav/ogg), auto-listed by /api/v1/music
│   │   ├── Ezio's Family (...) .mp3  # one committed file with spaces & "&" (gitignored going forward)
│   │   └── README.md
│   ├── email-verified.html, email-verification-error.html  # served by auth.js sendFile — do not delete
│   ├── favicon.svg, icon.svg
├── scripts/          # zero-dependency dev tooling (Node 22)
│   ├── smoke-test.mjs     # CDP UI smoke test (register→onboard→drive all 4 panes, ambient, colors)
│   ├── css-coverage.mjs   # verifies every live DOM class has a CSS rule
│   ├── screenshot.mjs     # captures pane screenshots for visual review
│   └── extract-inline.mjs # one-off helper used during the extraction refactor
├── docs/             # not code — project docs (SRS etc.)
├── src/
│   ├── index.js      # Express bootstrap, CORS, compression, static, EJS view engine, route mounting
│   ├── db/dbConnection.js
│   ├── controllers/  # request handlers (auth, note, card, chat, chatSession, music, subscription, onboarding, healthCheck)
│   ├── models/       # Mongoose schemas (user, note, card, chatSession, userContext, subscription)
│   ├── middlewares/  # tokenChecker, viewTokenChecker, redirectIfAuthenticated, validate, rateLimiter, usageTracker
│   ├── styles/       # tailwind.css input (@tailwind base/components/utilities)
│   ├── utils/        # asyncHandler, mail, openai, prompts/
│   ├── validators/   # Zod schemas (register, login, password, note, flashcard, onboarding)
│   ├── routes/       # express.Router definitions (mount order matters — see below)
│   └── views/        # EJS templates + partials/ (app, setup, upgrade, loginSignUp)
├── .env.example
├── eslint.config.js  # ESLint flat config
├── tailwind.config.js
├── package.json
├── test-routes.js
├── TECHNICAL_SPECIFICATIONS.txt / Template.txt / SRS_DOCUMENT.md
└── server.log        # gitignored via *.log
```

### Route mounting (order matters) in `src/index.js:77`
- `/api/v1/health`, `/api/v1/auth`, `/api/v1/notes`, `/api/v1` (chat + chat-with-note), `/api/v1/cards`, `/api/v1/chat-sessions`, `/api/v1/music`, `/api/v1/subscription`, `/api/v1/onboarding` ← **new since last CLAUDE.md**
- View routes mounted LAST at `/` (login, signup, setup, app, upgrade, chat→redirect, home) — must stay after API routes.
- **Gotcha:** `subscriptionRoutes` webhook uses `express.raw({ type: "application/json" })` at router level (`src/routes/subscriptionRoutes.js:20`). It is mounted after global `express.json()` in `src/index.js:68`; the router-level raw parser re-parses correctly, but add new raw-body routes at router level, not relying on global order.

When adding a new route group: create a router file in `src/routes/`, import it in `src/index.js`, and mount it **before** the `viewRoutes`.

### Middleware conventions
- **`asyncHandler`** wraps most controllers in `src/utils/asyncHandler.js:1` — handles async errors. Wrap controllers that await DB/AI work. Exceptions: `musicController.js` and `subscription.js` export raw async handlers with inline try/catch.
- **`tokenChecker`** (`src/middlewares/tokenChecker.js:5` — API auth) — verifies JWT from `Authorization: Bearer` header or `accessToken` cookie; attaches `req.user`. Returns 401 JSON on missing/invalid token, 404 if token decodes but user not found. Use on all protected API routes (often at router level via `router.use(tokenChecker)`).
- **`viewTokenChecker`** (`src/middlewares/viewTokenChecker.js:4`) — same, but redirects to `/login` instead of returning JSON. For rendering protected pages.
- **`redirectIfAuthenticated`** (`src/middlewares/redirectIfAuthenticated.js:4`) — redirects already-logged-in users away from `/login`/`/signup` to `/app`.
- **`validate({ body, query, params })`** (`src/middlewares/validate.js:9`) — Zod universal validation. **Gotcha:** validated query goes to `req.validatedQuery`, params to `req.validatedParams` — NOT `req.query`/`req.params`. Controllers must read `req.validatedQuery || req.query`. Body is overwritten on `req.body`.
- **`rateLimiter(type)`** (`src/middlewares/rateLimiter.js:42`) — in-memory per-user, per-tier (use Redis in production — see `rateLimiter.js:3`). Requires `req.user` (call after `tokenChecker`). `type`: `general | ai | notes | flashcards`.
- **`checkUsageLimit(type)` + `trackUsage(type)`** (`src/middlewares/usageTracker.js:38,235`) — monthly quotas by tier; `trackUsage` must come AFTER `checkUsageLimit` and wraps `res.json` to increment only on success. In **streaming mode** (`req.body.stream === true`) `res.json` never fires, so `src/controllers/chat.js:206,404` calls `incrementUsage` directly. `usageTracker` exports: `checkUsageLimit`, `trackUsage`, `incrementUsage`, `getUsageStats`, `resetUsageCounters`, `USAGE_LIMITS`.
- Tier ordering & limits live in `usageTracker.js:4` (`USAGE_LIMITS`) and `rateLimiter.js:7` (`RATE_LIMITS`). Note: `chat` and `chat-with-note` use different usage keys (`aiChatMessages`, `chatWithNote`).

### Models
- Mongoose models use `mongoose.models.X || mongoose.model("X", schema)` guard except `ChatSession`/`UserContext` (created directly with `mongoose.model` in `chatSession.js:77`, `userContext.js:45`).
- `User` (`src/models/user.js:9`) holds nested `subscription` and `usage` objects, hashes password (bcrypt, saltRounds 10), and defines `generateTokens` exported as standalone helper plus instance methods `generateAccessToken`/`generateRefreshToken`/`generateTemporaryToken` (10-min hashed token in `user.js:120`).
- `Note` (`src/models/note.js:3`) content stored as **Quill Delta** (`{ ops: [...] }`); `plainText` is derived for search via `note.extractPlainText()` (`note.js:111`). `searchNotes` uses `$regex` (not the text index). Indexes exist (`userId`, `plainText/title` text index at `note.js:100`).
- `Card` (flashcard, `src/models/card.js:3`) has `difficulty`, `reviewCount`, `isAIGenerated`; method `markAsReviewed` (`card.js:135`).
- `UserContext` (`src/models/userContext.js:3`) stores two layers: mutable `context` (updated by AI via `contextPrompt` in `chat.js:51`) and durable `stableContext`/`displayName`/`setupCompleted` (written only by onboarding wizard, never overwritten by context generator — see `onboarding.js:8` and `chat.js:149` where `stableContext` is injected as authoritative system message).
- `Subscription` (`src/models/subscription.js:3`) is a separate collection mirroring Stripe state; `User.subscription` is the denormalized active tier on the user doc. `Subscription.isActive()` / `hasFeatureAccess()` at `subscription.js:86,96`.
- Ownership checks are done by filtering on `userId: req.user._id` when querying.

### AI (OpenAI-compatible provider)
`src/utils/openai.js:8` builds an `openai` client pointed at `http://127.0.0.1:8319/v1` with `apiKey: "dummy"` and default model `claude-opus-5`. Exports `chatCompletion(messages, model)` (`openai.js:19`) and `extractMessageContent(response)` (`openai.js:42`). Comment at `openai.js:6` refs `provider/README.md` for local provider setup (baseURL + dummy key + `claude-opus-5`).

- `.env.example:14` still documents `GROQ_API_KEY` for `https://api.groq.com/openai/v1` (`openai/gpt-oss-120b` in the *previous* version). That variable is **currently unused** — if you want to restore Groq, change `openai.js` back to `baseURL: "https://api.groq.com/openai/v1"` + `apiKey: process.env.GROQ_API_KEY`.
- All AI controllers expect plain text from the model *except* two that parse JSON: `note.js:428` (`NOTE_ENHANCE` expects `{enhanced, improvements, preserved}`) and `card.js:379` (`FLASHCARD` expects `{numberOfCards, cards:[{title,content}]}`) — see prompt files. `chat.js:174,372` treat responses as plain text (old `{response,meta}` wrapper removed — history of last 40 messages is pushed directly, `chat.js:165,360`).
- Streaming: when client sends `{stream:true}`, `chat.js:15,203` sends the *already-complete* answer as paced `text/plain` chunks (20 ms / 2 words) — network/display decoupled, `incrementUsage` called directly.

### Prompts (`src/utils/prompts/`)
- Plain `.txt` files read by `getPrompt()` in `src/utils/prompts/index.js:13`.
- Register new prompts in `PROMPTS` map in `index.js:23` (constant -> filename without extension). Keys used: `ANSWERING, CONTEXT, FLASHCARD, NOTE_REFERENCE, NOTE_ENHANCE`.
- `answeringPrompt.txt:3` / `noteReferencePrompt.txt` instruct plain-text answers (no JSON). `contextPrompt.txt`, `flashcardPrompt.txt`, `noteEnhancePrompt.txt` instruct strict JSON — parse results accordingly.

### Validators (Zod, `src/validators/`)
- `validationRules.js:3`: shared `username` (3–30, `^[a-zA-Z0-9_]+$`), `email`, `password` (8–100, upper/lower/digit/special), `firstName`, `lastName` (regex `^[a-zA-Z\s'-]+$`, 50 max).
- `registerSchema.js:10` / `loginSchema.js:4` / `passwordSchemas.js:4` / `noteSchemas.js:4` / `flashcardSchemas.js:4` / **`onboardingSchema.js:4` (new — `completeSetupSchema` with `displayName`, `role`, `subjects[0..10]`, `goal`, `answerStyle: crisp|balanced|detailed`, `tone: casual|formal`, `anythingElse`)**.
- `registerSchema` refines `password === confirmPassword` via `.refine` (no path, so error appears as top-level). `flashcardSchemas` / `noteSchemas` use ObjectId regex `/^[0-9a-fA-F]{24}$/` for `noteId`.
- `passwordSchemas.js:4` exports `resetPasswordSchema` (`{password, newPassword, confirmPassword}` with newPassword===confirmPassword refine), `changePasswordSchema` (same shape), and `forgetPasswordSchema` (`{email}`). Controllers read the same field names.

### Views (EJS) & frontend architecture
- Partials live in `src/views/partials/` (8 files: `head`, `theme-toggle`, `profile-icon`, `horizontal-nav`, `chat-content`, `notes-content`, `den-content`, `flashcards-content` — `head.ejs` loads compiled Tailwind, Font Awesome, Quill snow CSS, Google Fonts, and the deferred `common/events.js` + `common/loader.js`).
- **Pane logic lives in `public/js/*.js`** (extracted 1:1 from the partials; loaded via `<script defer>` in partial include order: theme → profile → chat → notes → den → flashcards → nav). All panes still share `window.*` globals (`window.ambientMode`, `window.pomodoroTimer`, `window.quill`…).
- **Cross-pane events** (`public/js/common/events.js`, `window.RetroEvents`): `section:change {index,name}` (nav.js), `ambient:toggled {active}` (den.js), `den:timer-progress {progress}` (den.js → ambient dynamic sky). Panes must NOT reach into each other's internals — subscribe/dispatch instead. `visibility` of `#ambientToggle`/`#colorPickerContainer` is owned exclusively by nav.js via the `data-visible` attribute.
- **Lazy loading**: three.js r121 + vanta.clouds load on first ambient activation via `window.loadScript` (`public/js/common/loader.js`); AmbientMode guards races with `enableGeneration`.
- `app.ejs:16` assembles: head → theme-toggle → profile-icon → a `.horizontal-container` with 4 sections (chat, notes, den, flashcards) → nav → ambient/music controls → modals (flashcard, read-mode, delete-confirm) + inline dark-mode CSS.
- `setup.ejs` — 7-step onboarding wizard (name → role → subjects → goal → style/tone → anythingElse → review). Posts to `POST /api/v1/onboarding` (`setup.ejs:480`), stores `stableContext` server-side (`onboarding.js:53`). Theme-aware, progress bar, chip multi-select, optional steps 3/4/6 skippable.
- `loginSignUp.ejs` renders both `/login` and `/signup` (`defaultView` picks form); client-side validation mirrors `validationRules.js`; success login redirects to `/chat` (`loginSignUp.ejs:947`) while `viewRoutes` gated redirects use `/app` (intentional split — see Known Gaps).
- `upgrade.ejs` is a standalone page. (Legacy `chat.ejs` and standalone HTML prototypes were removed — `/chat` redirects to `/app`; only `email-verified.html` / `email-verification-error.html` remain in `public/`, served by `auth.js`.)
- Styling: compiled Tailwind v3 (`/css/tailwind.css`) + `/css/app.css` (app shell + shared components, formerly `styles.css`) + pane-local inline `<style>` blocks with CSS variables (`--bg-primary`, etc.) and `[data-theme="dark"]` overrides. Theme toggle uses `data-theme` attribute on `<body>`/`<html>` with `localStorage` persistence.
- View routes (`src/routes/viewRoutes.js:8`): `/login` + `/signup` use `redirectIfAuthenticated`; `/setup` (protected, redirects to `/app` if `setupCompleted`); `/app` (protected, redirects to `/setup` if not completed); `/upgrade` (protected); `/chat` → redirect `/app`; `/home` → redirect `/app`; `/` does manual JWT decode and redirects to `/app` or `/login` (not using `viewTokenChecker`).

### Music (`public/music/`)
- `musicController.js:14` lists `public/music/`, streams with Range support (`206`), path-traversal guarded (`musicController.js:76`).
- Add `.mp3/.wav/.ogg` files here; they are served two ways: static via `express.static` at `/music/:filename` (URL generated by `getMusicList` at `musicController.js:45`) and via streaming API at `/api/v1/music/stream/:filename`. Prefer the API route for Range support.
- Currently one committed MP3 exists (`Ezio's Family (Mome Remix)...mp3`) — future media is gitignored unless `git add -f`.

### Response shape conventions
- Success (notes/cards/health/subscription/onboarding): `{ success: true, message, data }` (HTTP 200/201). `healthCheck.js:3` returns `{ status:"OK", message:"Server is healthy" }` instead.
- Errors: `{ success: false, message, errors? }` — JSON; auth verification uses non-JSON `sendFile` for `email-verification-error.html`/`email-verified.html` (`auth.js:150`).
- Auth endpoints: `register` returns `{ user, message }` (201), `login`/`logout`/`refresh-token`/`forgot-password` return `{ message }` and set HTTP-only cookies (`accessToken`, `refreshToken`); `GET /auth/me` returns `{ user, memory, message }` (`auth.js:137`).
- Chat endpoints: non-stream returns `{ success, response }` (`chatWithNote` also includes `noteReference: {noteId, noteTitle}` at `chat.js:417`). **Stream mode** (`{stream:true}`) returns `text/plain; charset=utf-8` paced chunks (`chat.js:16`), not JSON — frontend `chat-content.ejs` reveals via `requestAnimationFrame` typewriter. Usage is counted via direct `incrementUsage`.

## Common tasks

### Adding an API endpoint
1. Add/define a handler in `src/controllers/<area>.js` (model async logic, JSON responses, wrap in `asyncHandler` unless streaming/static — `subscription.js` uses inline try/catch).
2. Add/define a Zod schema in `src/validators/` (export and handle `req.validatedQuery` vs `req.query`).
3. Register the route in `src/routes/<area>Routes.js` (import controller, middleware order: `tokenChecker` → `rateLimiter` → `validate` → `checkUsageLimit` → `trackUsage` → controller; `onboardingRoutes.js:12` uses `tokenChecker → validate → controller`; streaming routes add a comment that `trackUsage` won't fire).
4. Mount router in `src/index.js` under `/api/v1` (before `viewRoutes`).

### Adding a page/view
1. Create `src/views/<page>.ejs` using existing partials (`head`, `theme-toggle`, etc.).
2. Add a route in `src/routes/viewRoutes.js` (`viewTokenChecker` for protected, `redirectIfAuthenticated` for public; use `hasCompletedSetup` guard like `/app`/`/setup` if needed).
3. Update `src/views/README.md` if you document views.

## Testing notes
- `node test-routes.js` hardcodes `BASE_URL = http://localhost:8000` (`test-routes.js:9`) but the server runs on **port 3000** by default (`src/index.js:28`) — adjust `BASE_URL` (or run server on 8000) before using it. The file header comment says 3000 while code uses 8000 — trust the code value. It does destructive cleanup (deletes test notes/cards, logs out).
- `.env.example` is mostly aligned to code (`MONGO_URI`, `CLIENT_URL`/`FRONTEND_URL`), but **AI key is stale** (`GROQ_API_KEY` vs hard-coded dummy/local provider in `openai.js:8`). Copy real secrets into local `.env`; don't assume example values work.
- Chat tests in `test-routes.js:660` now need `chatSessionId` — older tests that only send `message` will 404 (`chat.js:99`).

## Styling / code-style guidelines
- 2024 ES Modules + 2-space indent, double quotes in JS. No comment spam unless explaining non-obvious logic.
- Keep controller↔route 1:1; keep static helper methods tightly coupled to where models are defined.
- Keep AI calls isolated in `utils`; controllers parse model JSON defensively (try/catch around `JSON.parse` — see `note.js:428`, `card.js:379`).
- **Current behavior note:** `enhanceNote` (`src/controllers/note.js:329`) overwrites `note.content`/`plainText` immediately without user confirmation, despite the guideline. Consider adding a preview/confirm step before persisting. `generateFlashcards` (`card.js:423`) does the opposite — responds first, then `setImmediate` saves in background.

## Git & Version Control

Repo is initialized at the project root (`./.git/`, branch `main`, HEAD `758f830` — 5 commits: `a8ba440` (initial, 76 files) → `2c8c91f` → `1ecdc51` → `1d8a2d0` → `277af7b` (setup wizard) → `758f830` (streaming). No remote is set yet; add one when ready.

- **Config:** `user.name=Syed Zaid Ali` / `user.email=zaidali809687@gmail.com` (from global `git config`).
- **.gitignore** (50 lines) covers: `node_modules/`, `package-lock.json` (ignored for this minor project — remove the line if you want lockfile tracking; `package-lock.json` still exists on disk), `.env` + `.env.*local`, `logs/`/`*.log`/`server.log`/`/tmp/`/`C:\Users\Zaida\AppData\Local\Temp\opencode`, OS/IDE (`.DS_Store`, `.vscode/`), `dist/`/`build/`, `public/music/*.mp3|wav|ogg` (keeps `!public/music/.gitkeep` + committed `README.md`), and `coverage/`. Verified via `git check-ignore -v .env` → `.gitignore:6:.env` and `node_modules/` → ignored.
- **Tracked:** `.env.example`, `src/`, `public/*.html|css|svg`, `docs/`, `TECHNICAL_SPECIFICATIONS.txt`, `CLAUDE.md`, `README.md`, `package.json`, `test-routes.js`, one `public/music/*.mp3` (committed before ignore). **Not tracked:** `.env` (real secrets), `node_modules/`, `package-lock.json`, `logs/`/`server.log`.
- **Workflow (any agent/session can run in this workdir):**
  ```bash
  git status                 # what changed
  git diff                   # unstaged diff
  git diff --staged          # staged diff
  git add .                  # or git add src/views/partials/profile-icon.ejs
  git commit -m "feat: concise message"
  git log --oneline -5       # history
  git branch -a              # branches
  # first remote:
  git remote add origin <url>
  git push -u origin main
  ```
  Any new Claude Code / opencode session running `bash` in `C:\My work folder\Claude Desktop\session5\My Minor Project` can use `git` directly — the repo is on disk, not in session memory. Run `git status`/`git log` to re-hydrate context.
- **Conventions:** keep commits scoped (`feat:`, `fix:`, `docs:`, `style:`, `chore:`), one logical change per commit, branch per feature (`git checkout -b feat/xyz`). Keep `.env` out of history; if a secret was ever committed, rotate it and use `git filter-repo`.

## Known gaps (not blocking, but worth fixing)
- `src/utils/openai.js:8` hardcodes `apiKey:"dummy"` + `baseURL:"http://127.0.0.1:8319/v1"` + `model:"claude-opus-5"`; `.env.example:14` still documents `GROQ_API_KEY`/Groq — env and code are out of sync.
- `src/views/loginSignUp.ejs:947` redirects after login to `/chat` while `viewRoutes.js:43` guards `/app` and `redirectIfAuthenticated` redirects to `/app` — split causes extra redirect (`/chat` → `/app` via `viewRoutes.js:62`).
- `src/controllers/auth.js:47` registration still accepts unused `role` from body; `registerSchema.js` doesn't validate it; `user.js` has no `role` field — silently dropped.
- `public/music/` currently contains one committed MP3 name with spaces and `&`; `.gitignore:43` will ignore future MP3/WAV/OGG unless you `git add -f` or rely on the existing tracked file.
- `.gitignore:3` ignores `package-lock.json` — intentional for submission lightness, but for reproducible installs consider removing that line and committing the lockfile (it already exists on disk).
- `src/index.js` global `express.json()` runs before `subscriptionRoutes` webhook's `express.raw()` — works today because the router re-parses, but fragile; consider mounting the webhook router *before* the global JSON parser or using `express.json({verify:...})` split.
- Mailtrap free-tier send quota can exhaust (SMTP `verify()` still passes) — registration continues on email failure by design, but `resend-verification-email` returns 500 `{message:"Failed to send verification email"}` when the quota is hit.
- `resetPassword` requires a `password` field in the body that the controller ignores (only `newPassword` is saved) — kept for API compatibility; consider dropping it from `changePasswordSchema`/`resetPasswordSchema` in a future API cleanup.

## Fixed in `optimizing-retro` branch (historical context)
- Auth bugs: `cookieOptions` scope ReferenceError in `refreshAccessToken`, incomplete `changeCurrentPassword` (now `POST /api/v1/auth/change-password`), missing `return` in `forgotPassword`, `resendVerificationEmail` re-hashing an already-hashed token, `refreshToken` not selected (`select:false`) so refresh always 401'd, `resetPasswordSchema` field-name mismatch.
- Frontend refactor: ~206 KB inline JS extracted to `public/js/` (defer, same order); cross-pane coupling via `RetroEvents` CustomEvents; debug `console.log`s and defensive `setTimeout` re-checks removed; latent bug fixed where nav called nonexistent `ambientMode.deactivate()` (now suspend/resume on `section:change`).
- Performance: three.js+vanta lazy-load on first ambient activation (~700 KB saved on chat-first load); Quill/marked deferred; Tailwind Play CDN → compiled v3.4.17 build (24 KB, pixel-identical; safelist for chat.js ternary classes); `compression()` gzip + `express.static` maxAge 1d.
- CSS: `styles.css`+`style.css` consolidated to `public/css/app.css` (dead rules deleted, ambient-visibility `!important` arms race collapsed to the `data-visible` pair); legacy `chat.ejs` + standalone HTML prototypes (`den.html`, `Notes.html`, `cardsFinal.html`, `loginSignUp.html`) deleted.

