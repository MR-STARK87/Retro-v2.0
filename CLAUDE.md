# CLAUDE.md

This file provides guidance for Claude Code (and other agents) when working in this repository.

## Project Overview

**Retro** — an AI-powered smart study assistant (a minor project submission). Full-stack Node.js/Express app with server-rendered EJS frontend, MongoDB storage, Groq-powered AI features (chat, note enhancement, flashcard generation), and an optional Stripe subscription layer.

- **Runtime:** Node.js >= 18 (developed on v22.11.0; no `engines` field in `package.json` — enforced by convention)
- **Backend:** Express 5 + Mongoose
- **Frontend:** EJS templates + Tailwind CSS (CDN) + Quill Delta rich text + Font Awesome + Quill snow theme (see `src/views/partials/head.ejs`)
- **Database:** MongoDB (6 collections)
- **AI:** Groq API via the `openai` SDK (see `src/utils/openai.js`)
- **Emails:** Nodemailer (Mailtrap SMTP in development)
- **Payments:** Stripe (optional — app runs without it)

## Commands

```bash
npm run code       # Start dev server with nodemon (src/index.js)  [primary dev command]
node src/index.js # start without watcher
node test-routes.js  # manual API smoke test suite (requires running server)
```

- There is **no test script** wired up (`npm test` just echoes "no test specified"). `test-routes.js` is the only "test suite" — it is a manual script that assumes a running server.
- No linter or formatter (no ESLint/Prettier). No type-check step. Code quality is maintained by following existing conventions.
- **Note:** `nodemon` is not listed in `package.json` dependencies/devDependencies — `npm run code` requires a global install (`npm i -g nodemon`) or adding it as a devDependency.

## Environment Variables

Create a `.env` in the project root. **`src/index.js` loads `dotenv` first**, and several modules also call `dotenv.config()` (`dbConnection.js`, `openai.js`, `mail.js`, `user.js`, `controllers/auth.js`).

`.env.example` is aligned to what the code reads (see table). The code uses:

| Used by code | Variable(s) |
|--------------|-------------|
| `dbConnection.js` | `MONGO_URI` |
| `index.js` | `PORT` (default 3000), `NODE_ENV`, `FRONTEND_URL` (CORS allowlist in production), `STRIPE_SECRET_KEY` (optional) |
| `user.js` / `tokenChecker` / `viewTokenChecker` / `controllers/auth.js` | `ACCESS_TOKEN_SECRET`, `REFRESH_TOKEN_SECRET`, `ACCESS_TOKEN_EXPIRY`, `REFRESH_TOKEN_EXPIRY` (expiries parsed as int via `parseInt` — treat as seconds) |
| `openai.js` | `GROQ_API_KEY` |
| `mail.js` | `MAILTRAP_SMTP_HOST`, `MAILTRAP_SMTP_PORT`, `MAILTRAP_SMTP_USER`, `MAILTRAP_SMTP_PASS` |
| `subscription.js` | `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_PRICE_PRO_MONTHLY`, `STRIPE_PRICE_PRO_YEARLY`, `STRIPE_PRICE_PREMIUM_MONTHLY`, `STRIPE_PRICE_PREMIUM_YEARLY`, `CLIENT_URL` (checkout `success_url`/`cancel_url` + portal `return_url`; falls back to `http://localhost:3000`) |

Key values: `PORT=3000`, `NODE_ENV=development`, `MONGO_URI`, secrets min 256-bit, `ACCESS_TOKEN_EXPIRY` in seconds (86400 ≈ 24h), `REFRESH_TOKEN_EXPIRY` in seconds (604800 ≈ 7d), `GROQ_API_KEY`, Mailtrap SMTP creds, `FRONTEND_URL` + `CLIENT_URL` (both default to `http://localhost:3000`). JWT expiries are parsed with `parseInt`, so treat them as plain seconds.

Do **not** commit `.env`. `.gitignore` awareness: secrets live only in local `.env`.

## Architecture & Conventions

### Module system
ES Modules (`"type": "module"`) throughout. Use `export default`/`import x from ".../.js"`.

### Directory layout
```
My server (project root)
├── public/           # static assets served at "/" (HTML, CSS, music/ files)
│   ├── assets/images/
│   ├── music/        # ambient music files (mp3/wav/ogg), auto-listed by /api/v1/music
│   ├── *.html        # standalone static pages (loginSignUp, Notes, den, cardsFinal, email-*)
│   ├── style.css, styles.css
├── src/
│   ├── index.js      # Express bootstrap, CORS, static, EJS view engine, route mounting
│   ├── db/dbConnection.js
│   ├── controllers/  # request handlers (auth, note, card, chat, chatSession, music, subscription, healthCheck)
│   ├── models/       # Mongoose schemas (user, note, card, chatSession, userContext, subscription)
│   ├── middlewares/  # tokenChecker, viewTokenChecker, redirectIfAuthenticated, validate, rateLimiter, usageTracker
│   ├── utils/        # asyncHandler, mail, openai, prompts/
│   ├── validators/   # Zod schemas
│   ├── routes/       # express.Router definitions (mount order matters — see below)
│   └── views/        # EJS templates + partials/
```

### Route mounting (order matters) in `src/index.js`
- `/api/v1/health`, `/api/v1/auth`, `/api/v1/notes`, `/api/v1` (chat + chat-with-note), `/api/v1/cards`, `/api/v1/chat-sessions`, `/api/v1/music`, `/api/v1/subscription`
- View routes mounted LAST at `/` (login, signup, app, upgrade, home) — must stay after API routes.
- **Gotcha:** `subscriptionRoutes` webhook uses `express.raw({ type: "application/json" })` at router level (`src/routes/subscriptionRoutes.js:20`). It is mounted after global `express.json()` in `src/index.js:67`; the router-level raw parser re-parses correctly, but add new raw-body routes at router level, not relying on global order.

When adding a new route group: create a router file in `src/routes/`, import it in `src/index.js`, and mount it before the `viewRoutes`.

### Middleware conventions
- **`asyncHandler`** wraps most controllers in `src/utils/asyncHandler.js` — handles async errors. Wrap controllers that await DB/AI work. Exception: `musicController.js` exports raw async handlers without wrapping.
- **`tokenChecker`** (API auth) — verifies JWT from `Authorization: Bearer` header or `accessToken` cookie; attaches `req.user`. Returns 401 JSON on missing/invalid token, 404 if token decodes but user not found. Use on all protected API routes (often at router level via `router.use(tokenChecker)`).
- **`viewTokenChecker`** — same, but redirects to `/login` instead of returning JSON. For rendering protected pages.
- **`redirectIfAuthenticated`** — redirects already-logged-in users away from `/login`/`/signup`.
- **`validate({ body, query, params })`** — Zod universal validation. **Gotcha:** validated query goes to `req.validatedQuery`, params to `req.validatedParams` — NOT `req.query`/`req.params`. Controllers must read `req.validatedQuery || req.query`. Body is overwritten on `req.body`.
- **`rateLimiter(type)`** — in-memory per-user, per-tier (use Redis in production — see `rateLimiter.js:3`). Requires `req.user` (call after `tokenChecker`). `type`: `general | ai | notes | flashcards`.
- **`checkUsageLimit(type)` + `trackUsage(type)`** — monthly quotas by tier; `trackUsage` must come AFTER `checkUsageLimit` and wraps `res.json` to increment only on success. `usageTracker` exports: `checkUsageLimit`, `trackUsage`, `incrementUsage`, `getUsageStats`, `resetUsageCounters`, `USAGE_LIMITS`.
- Tier ordering & limits live in `usageTracker.js` (`USAGE_LIMITS`) and `rateLimiter.js` (`RATE_LIMITS`). Note: `chat` and `chat-with-note` use different usage keys (`aiChatMessages`, `chatWithNote`).

### Models
- Mongoose models use `mongoose.models.X || mongoose.model("X", schema)` guard except `ChatSession`/`UserContext` (created directly with `mongoose.model`).
- `User` model holds nested `subscription` and `usage` objects, hashes password (bcrypt, saltRounds 10), and defines `generateTokens` exported as standalone helper plus instance methods `generateAccessToken`/`generateRefreshToken`/`generateTemporaryToken`.
- `Note` content stored as **Quill Delta** (`{ ops: [...] }`); `plainText` is derived for search via `note.extractPlainText()`. `searchNotes` uses `$regex` (not the text index). Indexes exist (`userId`, `plainText/title` text index).
- `Card` (flashcard) has `difficulty`, `reviewCount`, `isAIGenerated`; method `markAsReviewed`.
- Ownership checks are done by filtering on `userId: req.user._id` when querying.

### AI (Groq)
`src/utils/openai.js` builds an `openai` client pointed at `https://api.groq.com/openai/v1` with `apiKey: process.env.GROQ_API_KEY`. Exports `chatCompletion(messages, model)` (default model `"openai/gpt-oss-120b"`) and `extractMessageContent(response)`. All AI controllers expect **JSON** responses from the model and `JSON.parse` them — see prompt files.

### Prompts (`src/utils/prompts/`)
- Plain `.txt` files read by `getPrompt()` in `src/utils/prompts/index.js`.
- Register new prompts in `PROMPTS` map in `index.js` (constant -> filename without extension). Keys used: `ANSWERING, CONTEXT, FLASHCARD, NOTE_REFERENCE, NOTE_ENHANCE`.
- All prompt files instruct the model to return strict JSON — parse results accordingly.

### Validators (Zod, `src/validators/`)
- `validationRules.js`: shared `username`, `email`, `password` (8–100, upper/lower/digit/special), `firstName`, `lastName`.
- `registerSchema.js` / `loginSchema.js` / `passwordSchemas.js` / `noteSchemas.js` / `flashcardSchemas.js`.
- Flashcard schemas use ObjectId regex `/^[0-9a-fA-F]{24}$/`.

### Views (EJS)
- Partials live in `src/views/partials/` (`head`, `theme-toggle`, `profile-icon`, `horizontal-nav`, `chat-content`, `notes-content`, `den-content`, `flashcards-content`).
- `app.ejs` assembles: head → theme-toggle → profile-icon → a `.horizontal-container` with 4 sections (chat, notes, den, flashcards) → nav → modals.
- Styling: Tailwind CDN + inline `<style>` with CSS variables (`--bg-primary`, etc.) and `[data-theme="dark"]` overrides. Fonts: IBM Plex Sans + Space Grotesk, plus Font Awesome and Quill snow CSS (see `head.ejs`). Theme toggle uses `data-theme` attribute on `<body>`/`<html>`.
- Views consume data via `res.render("view", { title, user })`. Auth page is `loginSignUp.ejs` rendered for both `/login` and `/signup` (`defaultView` picks form); `/app` and `/upgrade` pass `user`.
- `public/*.html` files are static and independent of EJS.

### Music (`public/music/`)
- `musicController.js` lists `public/music/`, streams with Range support (`206`), path-traversal guarded.
- Add `.mp3/.wav/.ogg` files here; they are served two ways: static via `express.static` at `/music/:filename` (URL generated by `getMusicList`) and via streaming API at `/api/v1/music/stream/:filename`. Prefer the API route for Range support.

### Response shape conventions
- Success (notes/cards/health/subscription): `{ success: true, message, data }` (HTTP 200/201).
- Errors: `{ success: false, message, errors? }` — JSON; auth verification uses non-JSON `sendFile` for `email-verification-error.html`/`email-verified.html`.
- Auth endpoints: `register` returns `{ user, message }` (201), `login`/`logout`/`refresh-token`/`forgot-password` return `{ message }` and set HTTP-only cookies (`accessToken`, `refreshToken`); `GET /auth/me` returns `{ user, memory, message }`.
- Chat endpoints return `{ success, response, meta }` (`chatWithNote` also includes `noteReference`).

## Common tasks

### Adding an API endpoint
1. Add/define a handler in `src/controllers/<area>.js` (model async logic, JSON responses, wrap in `asyncHandler` unless streaming/static).
2. Add/define a Zod schema in `src/validators/`.
3. Register the route in `src/routes/<area>Routes.js` (import controller, middleware order: `tokenChecker` → `rateLimiter` → `validate` → `checkUsageLimit` → `trackUsage` → controller).
4. Mount router in `src/index.js` under `/api/v1`.

### Adding a page/view
1. Create `src/views/<page>.ejs` using existing partials.
2. Add a route in `src/routes/viewRoutes.js` (`viewTokenChecker` for protected).
3. Update `src/views/README.md` if you document views.

## Testing notes
- `node test-routes.js` hardcodes `BASE_URL = http://localhost:8000` but the server runs on **port 3000** by default — adjust `BASE_URL` (or run server on 8000) before using it. The file header comment says 3000 while code uses 8000 — trust the code value. It does destructive cleanup (deletes test notes/cards, logs out).
- `.env.example` is now aligned to code (`MONGO_URI`, `GROQ_API_KEY`, `CLIENT_URL`/`FRONTEND_URL`). Copy real secrets into local `.env`; don't assume example values work.

## Styling / code-style guidelines
- 2024 ES Modules + 2-space indent, double quotes in JS. No comment spam unless explaining non-obvious logic.
- Keep controller↔route 1:1; keep static helper methods tightly coupled to where models are defined.
- Keep AI calls isolated in `utils`; controllers parse model JSON defensively (try/catch around `JSON.parse`).
- **Current behavior note:** `enhanceNote` (`src/controllers/note.js:448`) overwrites `note.content`/`plainText` immediately without user confirmation, despite the guideline. Consider adding a preview/confirm step before persisting.

## Git & Version Control

Repo is initialized at the project root (`./.git/`, branch `main`, initial commit `a8ba440` — 76 files). No remote is set yet; add one when ready.

- **Config:** `user.name=Syed Zaid Ali` / `user.email=zaidali809687@gmail.com` (from global `git config`). Verified via `git config --list`.
- **.gitignore** (50 lines) covers: `node_modules/`, `package-lock.json` (ignored for this minor project — remove the line if you want lockfile tracking), `.env` + `.env.*local`, `logs/`/`*.log`, OS/IDE (` .DS_Store`, `.vscode/`), `dist/`/`build/`, `public/music/*.mp3|wav|ogg` (keeps `README.md` + `.gitkeep`), and `coverage/`. Checked via `git check-ignore -v .env` → `.gitignore:6:.env` and `node_modules/` → ignored.
- **Tracked:** `.env.example` (now clean — fixed stray `bro i` prefix at line 1), `src/`, `public/*.html|css`, `CLAUDE.md`, `README.md`, `package.json`, `test-routes.js`. **Not tracked:** `.env` (real secrets), `node_modules/`, `package-lock.json`, `logs/`.
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
- `src/controllers/auth.js:243` `refreshAccessToken` references `cookieOptions` out of scope (defined only in `loginUser`). Will throw `ReferenceError` on refresh.
- `.gitignore:3` ignores `package-lock.json` — intentional for submission lightness, but for reproducible installs consider removing that line and committing the lockfile.
- `public/music/` currently contains one committed MP3 name with spaces and `&`; `.gitignore` will ignore future MP3/WAV/OGG unless you `git add -f` or add a `.gitkeep`.
