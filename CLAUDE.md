# CLAUDE.md

Source of truth for agents working in this repo. Verified against code on disk — prefer this over older docs/comments when they disagree.

## Overview

**Retro** — AI study workspace (minor-project submission). Express 5 + Mongoose + server-rendered EJS + MongoDB, OpenAI-compatible AI, Resend email, optional Stripe.

- **Runtime:** Node >= 18 (dev on v22; no `engines` field — convention only). ES Modules (`"type": "module"`), 2-space indent, double quotes.
- **Backend:** Express 5, Mongoose 8. **Frontend:** EJS + compiled Tailwind v3.4.17 + Quill Delta notes + Font Awesome 6.4.0 + Quill snow 1.3.6 CSS + horizontal 4-pane layout (Chat, Notes, Den, Flashcards in `app.ejs`).
- **DB:** MongoDB, 6 collections: User, Note, Card, ChatSession, UserContext, Subscription.
- **AI:** OpenAI SDK against an OpenAI-compatible endpoint, **env-driven** in `src/utils/openai.js`: `AI_BASE_URL` (fallback `http://127.0.0.1:8319/v1`), `AI_API_KEY` (fallback `"dummy"`), `AI_MODEL` (fallback `claude-opus-5`). No `GROQ_API_KEY` anywhere in code.
- **Email:** Nodemailer via Resend SMTP (`src/utils/mail.js`, free tier 3k/mo, 100/day). Missing key warns at boot; registration still works.
- **Payments:** Stripe optional — app runs without it (boot warning in `src/index.js`).

## Commands

```bash
npm run code       # nodemon src/index.js — PRIMARY dev cmd; needs GLOBAL nodemon (not in package.json)
node src/index.js  # run without watcher
npm run lint       # eslint . (ignores node_modules/, public/css/)
npm run smoke      # zero-dep CDP UI test — needs running server + headless Chrome (see Testing)
node scripts/css-coverage.mjs  # live-DOM class coverage — same requirements as smoke
node scripts/screenshot.mjs [outdir]  # 4 panes light+dark via CDP
npm run build:css  # tailwind -i src/styles/tailwind.css -o public/css/tailwind.css --minify
npm run watch:css  # same, --watch
node test-routes.js  # manual API suite — needs running server (see Testing)
```

`npm test` is a placeholder (`echo "Error: no test specified"`). CI (`.github/workflows/ci.yml`) runs `lint` + `smoke` on push/PR to `main` (Node 22, mongo:6 service, `PORT=8000`).

## Env vars

`.env.example` matches code. Copy to `.env` (never commit — gitignored). Code reads:

| Var | Used in |
|-----|---------|
| `PORT` (default 3000), `NODE_ENV`, `FRONTEND_URL` | `src/index.js` (CORS allowlist + static cache) |
| `MONGO_URI` | `src/db/dbConnection.js` |
| `ACCESS_TOKEN_SECRET`, `REFRESH_TOKEN_SECRET`, `ACCESS_TOKEN_EXPIRY`, `REFRESH_TOKEN_EXPIRY` (seconds; `parseInt`, e.g. 86400/604800) | `models/user.js`, `tokenChecker.js`, `viewTokenChecker.js`, `redirectIfAuthenticated.js`, `controllers/auth.js` |
| `AI_BASE_URL`, `AI_API_KEY`, `AI_MODEL` | `src/utils/openai.js` (all have local fallbacks above) |
| `RESEND_API_KEY`, `RESEND_FROM_EMAIL` (default `onboarding@resend.dev` — delivers only to your own Resend inbox until a domain is verified) | `src/utils/mail.js` |
| `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_PRICE_PRO_MONTHLY/YEARLY`, `STRIPE_PRICE_PREMIUM_MONTHLY/YEARLY`, `CLIENT_URL` (checkout/portal URLs, default `http://localhost:3000`) | `controllers/subscription.js`, `src/index.js` (boot check) |
| `RENDER_GIT_COMMIT` | `src/index.js` — injected by Render for `?v=` asset cache-busting (undocumented by design) |

## Architecture

### Bootstrap (`src/index.js`)

`cookieParser → CORS → compression → assetVersion → urlencoded + json → EJS → static → API routers → viewRoutes last`. Details:

- **CORS:** dev (`NODE_ENV=development`) reflects any origin; production restricts to `FRONTEND_URL` + `localhost:5173/3000/5500`.
- **Static:** `public/` with `maxAge 1d` in production, `0` in dev. `?v=<%= assetVersion %>` busting: `RENDER_GIT_COMMIT` → package version (prod) → `Date.now()` (dev).
- **View engine:** EJS, `src/views`.

### API mount order (`src/index.js`, viewRoutes MUST stay last)

`/api/v1/health`, `/api/v1/auth`, `/api/v1/notes`, `/api/v1` (chat → full paths `/api/v1/chat`, `/api/v1/chat-with-note`), `/api/v1/cards`, `/api/v1/chat-sessions`, `/api/v1/music`, `/api/v1/onboarding`, then `/` (views).

Middleware order on protected AI routes: `tokenChecker → rateLimiter → checkUsageLimit → trackUsage → controller`. `onboardingRoutes` uses `tokenChecker → validate → controller`. `musicRoutes` and `GET /pricing` + `POST /webhook` are public.

### Middleware (`src/middlewares/`)

- **`tokenChecker`** — JWT from `Authorization: Bearer` or `accessToken` cookie → `req.user`. 401 missing/invalid, 404 valid-token-but-no-user. Call before anything needing `req.user`.
- **`viewTokenChecker`** — same extraction, redirects to `/login` instead of JSON. For pages.
- **`redirectIfAuthenticated`** — logged-in users hitting `/login`/`/signup` bounce to `/app`.
- **`validate({body,query,params})`** — Zod. Body overwrites `req.body`; query → `req.validatedQuery`, params → `req.validatedParams` (never `req.query`/`req.params` — controllers must read `req.validatedQuery || req.query`).
- **`rateLimiter(type)`** — `general|ai|notes|flashcards`, per-user per-tier, **in-memory Map** (use Redis in prod). Needs `req.user`. 429 with `X-RateLimit-*` headers.
- **`usageTracker`** — monthly quotas by tier (`USAGE_LIMITS`: `aiChatMessages, flashcardGenerations, noteEnhancements, chatWithNote, maxNotes, maxFlashcards, storageLimit`). Exports `checkUsageLimit`, `trackUsage`, `incrementUsage`. `trackUsage` patches `res.json` so it only counts 2xx successes. **Streaming never calls `res.json`** — `controllers/chat.js` calls `incrementUsage` directly when `stream:true`.

### Models (`src/models/`, 6)

- **User** — `username` (unique/lowercase), names, `email` (unique), `password` (`select:false`, bcrypt-10 `pre save`), `isEmailVerified`, hashed temp tokens (`select:false`), nested `subscription{tier,status,…}` + `usage{…}`. Standalone `generateTokens` + instance `generateAccessToken/RefreshToken/TemporaryToken` (10-min). No `role` field.
- **Note** — `userId` indexed, `title`, `content` (**Quill Delta** `{ops:[…]}`, Mixed), derived `plainText`, tags/category/pin/archive/favorite/color, `sharedWith`, `reminder`. Text index on `plainText+title` exists but `searchNotes` uses `$regex` (not the index).
- **Card** — `userId` + `noteId` (nullable ref) indexed, `title`/`content` (**plain strings**, not Delta), tags/difficulty (`easy|medium|hard`)/`reviewCount`/`isAIGenerated`. `markAsReviewed()` bumps count. Search also `$regex`, not the text index.
- **ChatSession** — `userId`, `title` (default `New Chat`), `messages[{sender:user|ai, content}]`. Direct `mongoose.model` (no `models.X ||` guard, unlike User/Note/Card/Subscription).
- **UserContext** — two layers: mutable `context` (AI-updated) + durable `stableContext`/`displayName`/`setupCompleted` (onboarding-only; context generator must not overwrite). Direct `mongoose.model`, no guard.
- **Subscription** — mirrors Stripe state (`tier`, `status`, customer/subscription/price IDs, periods, `paymentHistory`). `isActive()`, `hasFeatureAccess()`. `User.subscription` is the denormalized hot copy.

### AI + prompts (`src/utils/`)

- `chatCompletion(messages, model)` + `extractMessageContent(response)` in `openai.js`.
- 5 prompts in `src/utils/prompts/` (register new ones in the `PROMPTS` map in `index.js`): `ANSWERING`, `NOTE_REFERENCE` → **plain text** (never JSON); `CONTEXT`, `FLASHCARD` (`{numberOfCards, cards:[{title,content}]}`), `NOTE_ENHANCE` (`{enhanced, improvements[3-5], preserved}`) → **strict JSON**, always `JSON.parse` defensively (`controllers/chat.js`, `note.js`, `card.js` all try/catch).
- **Streaming is fake (by design):** provider call is not streamed; server gets the full answer, persists everything, then paces it as `text/plain` chunks (20 ms / 2 words). Validation, history, and error paths are identical to non-stream.
- `chat` and `chat-with-note` **require a valid `chatSessionId`** scoped to the user (404 otherwise — `{message}`-only calls fail).

### Validators (`src/validators/`)

Shared `validationRules.js` (username 3–30 `^[a-zA-Z0-9_]+$`, strong password 8–100 upper/lower/digit/special, names `^[a-zA-Z\s'-]+$`). `registerSchema` refines `password===confirmPassword` (no path → top-level error, no `role`). `loginSchema` reuses the strong-password rule. `resetPasswordSchema`/`changePasswordSchema` both require a `password` field but the controller only saves `newPassword` (compat quirk). `noteSchemas` validates Quill Delta (`content.ops` non-empty array); `flashcardSchemas` uses `/^[0-9a-fA-F]{24}$/` for `noteId`. `onboardingSchema.completeSetupSchema`: `displayName, role, subjects[≤10], goal, answerStyle: crisp|balanced|detailed, tone: casual|formal, anythingElse`.

## Frontend

- **Pages:** `app.ejs`, `setup.ejs` (7-step wizard → `POST /api/v1/onboarding`), `loginSignUp.ejs` (both forms, `defaultView` picks), `upgrade.ejs`. Only `app.ejs` uses `partials/head.ejs`; the other three inline their own Tailwind/FA/font links.
- **Partials (8):** `head`, `theme-toggle`, `profile-icon`, `chat-content`, `notes-content`, `den-content`, `flashcards-content`, `horizontal-nav`. `app.ejs` assembles them into a 400%-wide `.horizontal-container` with 4 `.page-section`s. Deferred pane scripts run in include order: `common/events` + `common/loader` → theme → profile → chat → notes (Quill + marked CDN first) → den → flashcards → nav. All panes share `window.*` globals — don't cross-import internals.
- **`head.ejs`:** `tailwind.css?v=…`, Font Awesome 6.4.0 (cdnjs), Google Fonts (IBM Plex Sans/Mono, Space Grotesk), Quill snow 1.3.6 CSS, plus layout CSS vars (`--bg-primary` etc., `[data-theme="dark"]` overrides).
- **CSS:** `public/css/tailwind.css` = committed compiled build (input `src/styles/tailwind.css`). Rebuild after touching classes in views/`public/js`. `public/css/app.css` = hand-written shell. `tailwind.config.js` content covers `src/views/**/*.ejs` + `public/js/**/*.js`; safelist keeps the 4 classes composed dynamically in `chat.js` (`bg-gray-100/bg-black/text-gray-800/text-white`). Never upgrade to Tailwind v4 (renamed utilities change the look).
- **Events (`window.RetroEvents`):** `section:change {index,name}` (nav, 0=Chat 1=Notes 2=Den 3=Cards), `ambient:toggled {active}` (den), `den:timer-progress {progress}` (den → dynamic sky). Subscribe/dispatch — never reach into another pane.
- **Ambient:** zero-dependency `CustomCloudEffect` WebGL raymarcher in `den.js` (three.js/vanta are gone; `common/loader.js` `loadScript` has no cloud caller). Race-guarded by `enableGeneration`; `section:change` suspends off-pane. **Visibility owned by `nav.js`** via `data-visible` on `#ambientToggle` / `#colorPickerContainer` — don't toggle them elsewhere.
- **Theme:** `data-theme="dark"` on `<body>` (removed = light), `localStorage.theme`. Live path is the profile menu (`profile.js:setTheme`); `theme-toggle.ejs` button is hidden/disabled.
- **View routes (`viewRoutes.js`):** `/login`, `/signup` (`redirectIfAuthenticated`); `/setup` (redirects to `/app` if done); `/app` (redirects to `/setup` if not done); `/upgrade`; `/chat` → `/app`; `/home` → `/app` (unguarded); `/` manual JWT decode → `/app` or `/login`.

## Music (`public/music/`, `musicController.js`)

- 11 `.mp3`s on disk (rain, campfire, fireplace, crickets, forest, thunder, jungle, ocean, wind, + Ezio remix); **none tracked in git** (only `README.md` is — audio is gitignored). Add files here and they auto-list.
- Served two ways: static `/music/:file` and API `/api/v1/music` (list), `/stream/:filename` (Range `206` + `Accept-Ranges`, else `200`), `/info/:filename`. Frontend uses the API. Path-traversal guarded, auto-`mkdir`, `duration: null` (client-side).

## Response shapes

- Standard: `{success:true, message, data}` (201 on create). Errors: `{success:false, message, errors?}`. **Health is the exception:** `{status:"OK", message}`.
- Auth sets HTTP-only `accessToken`/`refreshToken` cookies. `register` → `201 {user, message}` (no cookies); `login`/`refresh` → `200 {message}` (+cookies); `logout` clears; `GET /me` → `{user, memory, displayName, message}`. `verifyEmail` failure serves an HTML page, not JSON.
- Chat non-stream: `{success, response}` (`chat-with-note` adds `noteReference:{noteId,noteTitle}`); stream mode: `text/plain` paced chunks, no `noteReference`. ChatSession endpoints return raw docs (no envelope); `DELETE` → `204`.
- `enhanceNote` **overwrites** `note.content`/`plainText` immediately (no preview step). `generateFlashcards` responds first, then `setImmediate(insertMany)` in background.

## Common tasks

**Add an endpoint:** handler in `src/controllers/` (wrap in `asyncHandler`; `musicController`/`subscription` use inline try/catch) → Zod schema in `src/validators/` → route in `src/routes/` (`tokenChecker → rateLimiter → validate → checkUsageLimit → trackUsage → controller`; note streaming bypasses `trackUsage`) → mount in `src/index.js` **before** `viewRoutes`.

**Add a page:** `src/views/<page>.ejs` (reuse partials) → route in `viewRoutes.js` (`viewTokenChecker` for protected, `redirectIfAuthenticated` for public, `hasCompletedSetup` check like `/app`/`/setup` if it needs onboarding) → update `src/views/README.md`.

## Testing notes

- Server defaults to **port 3000**, but `test-routes.js`, `smoke-test.mjs`, `css-coverage.mjs`, `screenshot.mjs` all default to **`http://localhost:8000`** (override with `BASE_URL`; `test-routes.js` needs a code edit — its header comment saying 3000 is wrong). Run the server on 8000 or set `BASE_URL`.
- `test-routes.js` is **destructive** (deletes created notes/cards, logs out) and its chat test sends only `{message}` — it 404s since `chatSessionId` is now required.
- `smoke` needs headless Chrome (`CHROME_PATH`, default Windows install path; CI installs it). It registers a throwaway user, completes onboarding, and stubs only `/api/v1/subscription/status` → `pro`.
- `css-coverage.mjs` flags live-DOM classes missing from compiled CSS (i.e. dynamic classes absent from the safelist).

## Git

`main` branch, remote `origin https://github.com/MR-STARK87/Retro-v2.0.git`, tags `stable-v01…v04`. Commits use `feat:/fix:/docs:/style:/chore:`, one logical change each, feature branches. `.gitignore` covers `node_modules/`, `package-lock.json` (exists on disk, untracked — intentional for submission lightness), `.env*local`, `*.log`, OS/IDE, `dist/build`, `public/music/*.{mp3,wav,ogg}` (the `!.gitkeep` exception has no file behind it; only `README.md` is tracked there), `coverage/`.

## Known gaps (all verified, none blocking)

- `subscriptionRoutes.js` comment says the webhook "must be before `express.json()`" — false in current wiring (global `express.json()` in `src/index.js` runs first; the router-level `express.raw()` re-parses, works but fragile).
- Login lands on `/chat` (`loginSignUp.ejs`) which instantly 302s to `/app` — extra hop vs `redirectIfAuthenticated` → `/app`. (`src/views/README.md` saying `/home` is staler still.)
- `register` accepts a `role` body field that is silently dropped (no schema rule, no model field). `resetPassword` requires `password` but ignores it (saves `newPassword` only).
- Note/Card `search*` use `$regex` despite text indexes. `GET /` and `/home` skip the `setupCompleted` check that `/app` enforces.
- Duplicate `id="searchInput"` in `notes-content` + `flashcards-content` coexist in the `app.ejs` DOM. `upgrade.ejs` interpolates `STRIPE_PRICE_*` server-side — renders empty without env.
- Resend free tier hard-fails past 100/day or 3k/mo; `resend-verification-email` then 500s (registration itself still succeeds).
