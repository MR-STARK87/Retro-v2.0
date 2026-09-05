<p align="center">
  <img src="public/icon.svg" alt="Retro — Minimal R Logo" width="92" height="92">
</p>

<h1 align="center">Retro</h1>

<p align="center">
  <em>One workspace. No app switching.</em><br>
  AI-powered study assistant — chat, notes, flashcards & focus in one place.
</p>

<p align="center">
  <img src="https://img.shields.io/badge/node-%3E%3D18-brightgreen" alt="Node >=18">
  <img src="https://img.shields.io/badge/express-5.x-lightgrey" alt="Express 5">
  <img src="https://img.shields.io/badge/mongodb-8.x-green" alt="MongoDB">
  <img src="https://img.shields.io/badge/tailwind-3.4.17-38bdf8" alt="Tailwind 3.4.17">
  <img src="https://img.shields.io/badge/AI-OpenAI_Compatible-purple" alt="AI">
  <img src="https://img.shields.io/badge/license-ISC-blue" alt="License ISC">
</p>

<p align="center">
  <a href="#overview">Overview</a> •
  <a href="#features">Features</a> •
  <a href="#quick-start">Quick Start</a> •
  <a href="#api-reference">API</a> •
  <a href="#project-structure">Structure</a> •
  <a href="#tech-stack">Stack</a>
</p>

---

## Overview

**Retro** is a full-stack study workspace that replaces the daily juggle between ChatGPT, Anki, Notion and Pomodoro/Forest timers with a single, coherent app.

Built with **Express 5 + Mongoose + EJS + Tailwind CSS v3**, it provides a horizontal 4-pane interface — **Chat, Notes, Den, Flashcards** — backed by an OpenAI-compatible AI layer, JWT auth, and optional Stripe subscriptions. Designed as a minor-project submission with production-grade conventions.

> **Objective:** Eliminate context-switching. Give students an integrated, AI-native environment to capture knowledge, clarify doubts, retain via flashcards, and stay in flow.

**Live demo video:** [`Retro_Final-Edit.mp4`](https://raw.githubusercontent.com/MR-STARK87/Samadhan-2.0/main/Retro_Final-Edit.mp4) — also available at [`Samadhan-2.0/Retro_Final-Edit.mp4`](https://github.com/MR-STARK87/Samadhan-2.0/blob/main/Retro_Final-Edit.mp4)

---

## Features

### AI Chat — Context-aware, streaming-ready
- Persistent chat sessions (6 collections: `User`, `Note`, `Card`, `ChatSession`, `UserContext`, `Subscription`)
- **Chat** and **Chat with Note** (note injected as reference context)
- Streaming mode (`{ stream: true }` → `text/plain` paced chunks) with correct quota accounting
- Stable onboarding context (`stableContext` / `displayName` / `setupCompleted`) never overwritten by the mutable AI-generated `context`

### Smart Notes
- **Quill Delta** storage (`{ ops: [...] }`) + derived `plainText` for search
- Tags, categories, colors, pin / favorite / archive
- Full-text search (`$regex` + text index on `plainText`/`title`)
- **AI Enhance** — preserves voice, returns `{ enhanced, improvements, preserved }`

### Flashcards
- Manual or **AI-generated** from any note (`{ numberOfCards, cards: [{ title, content }] }`)
- Difficulty (`easy` / `medium` / `hard`), `reviewCount`, `isAIGenerated`, background `setImmediate` save
- Filter, search, pin, favorite, mark-reviewed

### Den — Study Environment
- Pomodoro-style focus timer with progress events
- **Ambient Mode** — lazy-loaded `three.js r121 + vanta.clouds` on first activation (~700 KB saved on first paint)
- Dynamic sky reacting to timer progress via `RetroEvents`
- Theme-aware (light/dark via `data-theme` + `localStorage`)

### Ambient Music
- Lists `public/music/` (`mp3` / `wav` / `ogg`) via `/api/v1/music`
- Streaming with **Range / 206** support + path-traversal guard; also served as static `/music/:file`

### Auth & Onboarding
- JWT (HTTP-only `accessToken` + `refreshToken` cookies, `Authorization: Bearer` also supported)
- Email verification (Nodemailer via Resend SMTP), forgot/reset, refresh, resend-verification, change-password
- 7-step setup wizard (`/setup` → `POST /api/v1/onboarding`) → `stableContext`; guards redirect to `/app` or `/setup` correctly

### Subscriptions (optional)
- Stripe-ready tiering (Free → Pro → Premium) with webhook (`express.raw`) and `User.subscription` denormalized cache. App runs without `STRIPE_SECRET_KEY` (bootstrap warning only).

---

## Tech Stack

| Layer | Technology |
|-------|------------|
| Runtime | Node.js >= 18 (dev on v22.11.0) |
| Backend | Express 5, Mongoose 8, JWT, bcrypt, Zod, Nodemailer, Stripe |
| Frontend | EJS, Tailwind CSS v3.4.17 (compiled `public/css/tailwind.css`), Quill Delta, Font Awesome, Google Fonts (IBM Plex + Space Grotesk) |
| Database | MongoDB (6 models) |
| AI | OpenAI SDK → OpenAI-compatible provider (`http://127.0.0.1:8319/v1`, `apiKey: "dummy"`, model `claude-opus-5` — see `src/utils/openai.js:8` and `provider/README.md`) |
| Tooling | ESLint (flat config), `compression` gzip, `express.static` caching, CDP smoke test, CSS coverage script |

> To switch to Groq: set `baseURL: "https://api.groq.com/openai/v1"` and `apiKey: process.env.GROQ_API_KEY` in `src/utils/openai.js`.

---

## Project Structure

```
retro/
├── public/
│   ├── css/                  # tailwind.css (compiled, committed) + app.css (shell + shared components)
│   ├── js/                   # pane scripts (defer, classic scripts sharing window.* globals)
│   │   ├── common/           # events.js (RetroEvents pub/sub), loader.js (cached CDN loader)
│   │   └── chat.js notes.js den.js flashcards.js nav.js profile.js theme.js
│   ├── music/                # ambient audio (mp3/wav/ogg) — auto-listed by /api/v1/music
│   ├── favicon.svg / icon.svg
│   └── email-verified.html / email-verification-error.html
├── scripts/
│   ├── smoke-test.mjs        # CDP UI smoke test (register → onboard → 4 panes)
│   ├── css-coverage.mjs      # verifies every live DOM class has a CSS rule
│   └── screenshot.mjs
├── src/
│   ├── index.js              # bootstrap: CORS, compression, static, EJS, route mounting
│   ├── db/dbConnection.js
│   ├── controllers/          # auth, note, card, chat, chatSession, music, subscription, onboarding, healthCheck
│   ├── models/               # user, note, card, chatSession, userContext, subscription
│   ├── middlewares/          # tokenChecker, viewTokenChecker, redirectIfAuthenticated, validate, rateLimiter, usageTracker
│   ├── routes/               # auth, notes, cards, chat, chatSessions, music, subscription, onboarding, views, health
│   ├── styles/tailwind.css   # Tailwind input (@tailwind base/components/utilities)
│   ├── utils/                # asyncHandler, mail, openai, prompts/
│   ├── validators/           # Zod schemas (register, login, password, note, flashcard, onboarding)
│   └── views/                # EJS — app, setup, upgrade, loginSignUp + partials/
├── .env.example
├── tailwind.config.js
├── eslint.config.js
├── package.json
└── README.md
```

Route mount order in `src/index.js:77` matters: `/api/v1/*` first, view routes at `/` last.

---

## Quick Start

### Prerequisites
- Node.js >= 18, MongoDB >= 6 (local or Atlas), Resend account + API key (free tier email), Stripe account (optional)

### 1. Clone & install
```bash
git clone https://github.com/MR-STARK87/Retro-v2.0.git
cd Retro-v2.0
npm install
# nodemon is not in package.json — for `npm run code` install globally:
npm i -g nodemon
```

### 2. Configure env

Create `.env` in the project root (see `.env.example` — authoritative):

```env
PORT=3000
NODE_ENV=development
MONGO_URI=mongodb://localhost:27017/retro

ACCESS_TOKEN_SECRET=your-access-token-secret-min-32-chars
ACCESS_TOKEN_EXPIRY=86400
REFRESH_TOKEN_SECRET=your-refresh-token-secret-min-32-chars
REFRESH_TOKEN_EXPIRY=604800

# AI — hardcoded in src/utils/openai.js (local OpenAI-compatible, no env needed by default)
# AI_BASE_URL=http://127.0.0.1:8319/v1
# AI_MODEL=claude-opus-5

# Email — Resend SMTP (free: 3,000/mo, 100/day). Test sender
# onboarding@resend.dev only reaches your own inbox; after verifying
# your domain at resend.com/domains, set your address (no code change).
RESEND_API_KEY=re_your_resend_api_key_here
RESEND_FROM_EMAIL=onboarding@resend.dev

FRONTEND_URL=http://localhost:3000
CLIENT_URL=http://localhost:3000

# Stripe (optional — app runs without it)
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
STRIPE_PRICE_PRO_MONTHLY=price_...
STRIPE_PRICE_PRO_YEARLY=price_...
STRIPE_PRICE_PREMIUM_MONTHLY=price_...
STRIPE_PRICE_PREMIUM_YEARLY=price_...
```

> `.env` is gitignored. Never commit secrets. AI defaults to local provider — no `GROQ_API_KEY` required unless you rewire `openai.js`.

### 3. (Optional) Ambient music
Drop `.mp3` / `.wav` / `.ogg` files into `public/music/`. Served at `/api/v1/music/stream/:filename` (Range-aware) and `/music/:filename`.

### 4. Run
```bash
npm run code       # dev with nodemon (src/index.js)
# or
node src/index.js

npm run build:css  # rebuild Tailwind after editing views/public/js
npm run watch:css  # watch mode
npm run lint       # ESLint (src/, scripts/, public/js/)
npm run smoke      # CDP smoke test (needs running server + Chrome)
```

Open `http://localhost:3000` → `/` redirects to `/app` (authed) or `/login`.

---

## API Reference

Base URL: `http://localhost:3000/api/v1`

Auth via HTTP-only `accessToken` cookie **or** `Authorization: Bearer <token>` header.

| Group | Method & Endpoint | Description | Auth |
|-------|-------------------|-------------|------|
| **Health** | `GET /health` | `{ status: "OK", message: "Server is healthy" }` | — |
| **Auth** | `POST /auth/register` | Register | — |
| | `POST /auth/login` | Login (sets cookies, redirects to `/app`) | — |
| | `POST /auth/logout` | Logout | ✓ |
| | `GET /auth/me` | Current user + memory | ✓ |
| | `GET /auth/verify-email?token=` | Verify email | — |
| | `POST /auth/forgot-password` | Request reset | — |
| | `POST /auth/reset-password` | Reset (token) | — |
| | `POST /auth/change-password` | Change (authed) | ✓ |
| | `POST /auth/refresh-token` | Refresh access token | — |
| | `POST /auth/resend-verification-email` | Resend verification | ✓ |
| **Notes** | `POST /notes` | Create (Quill Delta) | ✓ |
| | `GET /notes` | List | ✓ |
| | `GET /notes/:id` | Get one | ✓ |
| | `PUT /notes/:id` | Update | ✓ |
| | `DELETE /notes/:id` | Delete | ✓ |
| | `GET /notes/search?query=` | Search | ✓ |
| | `GET /notes/tags` · `GET /notes/categories` | Aggregations | ✓ |
| | `PATCH /notes/:id/pin` · `.../favorite` · `.../archive` | Toggles | ✓ |
| | `POST /notes/enhance` | AI enhance `{ enhanced, improvements, preserved }` | ✓ |
| **Chat** | `POST /chat` | AI chat `{ message, chatSessionId, stream? }` → `{ success, response }` or `text/plain` chunks | ✓ |
| | `POST /chat-with-note` | Chat with note `{ message, noteId, chatSessionId?, stream? }` → `+ noteReference` | ✓ |
| **Cards** | `POST /cards` | Create manual | ✓ |
| | `POST /cards/ai` | Generate from note `{ noteId }` | ✓ |
| | `GET /cards` · `GET /cards/:id` · `PUT /cards/:id` · `DELETE /cards/:id` | CRUD | ✓ |
| | `GET /cards/search?query=` · `GET /cards/note/:noteId` · `DELETE /cards/note/:noteId` | Query | ✓ |
| | `PATCH /cards/:id/pin` · `.../favorite` · `.../review` | Actions | ✓ |
| **Sessions** | `POST /chat-sessions` · `GET /chat-sessions` · `GET /chat-sessions/:sessionId` · `DELETE /chat-sessions/:sessionId` | Session CRUD | ✓ |
| **Music** | `GET /music` | List tracks | — |
| | `GET /music/stream/:filename` | Stream (206 Range) | — |
| | `GET /music/info/:filename` | File info | — |
| **Onboarding** | `POST /onboarding` | Complete setup `{ displayName, role, subjects, goal, answerStyle, tone, anythingElse }` | ✓ |
| **Subscription** | `.../subscription` | Stripe checkout/portal/webhook (optional) | ✓ |

Success shape: `{ success: true, message, data }` — chat non-stream: `{ success, response }`. Errors: `{ success: false, message, errors? }`.

---

## Frontend Architecture

- **Partials:** `src/views/partials/` — `head`, `theme-toggle`, `profile-icon`, `horizontal-nav`, `chat-content`, `notes-content`, `den-content`, `flashcards-content`
- **Panes:** logic in `public/js/*.js` loaded via `<script defer>` in include order; globals on `window` (`ambientMode`, `pomodoroTimer`, `quill`, …)
- **Events:** `window.RetroEvents` (`public/js/common/events.js`) — `section:change`, `ambient:toggled`, `den:timer-progress`; visibility of `#ambientToggle` / `#colorPickerContainer` owned solely by `nav.js` via `data-visible`
- **Lazy loading:** `window.loadScript` (`public/js/common/loader.js`) for `three.js` + `vanta.clouds`
- **Layout:** `app.ejs` assembles `.horizontal-container` with 4 × 25% sections; nav translates `0 / -25% / -50% / -75%`
- **Views:** `loginSignUp.ejs` (dual form), `setup.ejs` (7-step wizard), `upgrade.ejs`, `app.ejs`; route guards `viewTokenChecker` / `redirectIfAuthenticated` / `hasCompletedSetup`

---

## Scripts

| Command | Description |
|---------|-------------|
| `npm run code` | Dev server with nodemon (`src/index.js`) — primary dev command |
| `node src/index.js` | Start without watcher |
| `npm run lint` | ESLint (flat config) — `src/`, `scripts/`, `public/js/` |
| `npm run smoke` | Headless-Chrome CDP smoke test (needs running server + Chrome) |
| `node scripts/css-coverage.mjs` | Verifies every live DOM class has a CSS rule |
| `npm run build:css` | Compile Tailwind v3.4.17 → `public/css/tailwind.css` (minified) |
| `npm run watch:css` | Same, watch mode |

Tailwind is a **compiled v3 build** (committed). After editing classes in views or `public/js`, rerun `build:css`. Do not upgrade to v4 (renamed utilities like `shadow-sm` → `shadow-xs`).

---

## Environment Variables

See `.env.example` for the full reference. `src/index.js:24` loads `dotenv` first; several modules also call `dotenv.config()`.

| Used by | Variable(s) | Notes |
|---------|-------------|-------|
| `dbConnection.js:7` | `MONGO_URI` | |
| `index.js:28,31` | `PORT` (default 3000), `NODE_ENV`, `FRONTEND_URL`, `STRIPE_SECRET_KEY` | `allowedOrigins` also hardcodes `localhost:5173/3000/5500` |
| `user.js` / `tokenChecker.js` / `viewTokenChecker.js` | `ACCESS_TOKEN_SECRET`, `REFRESH_TOKEN_SECRET`, `ACCESS_TOKEN_EXPIRY`, `REFRESH_TOKEN_EXPIRY` | expiries as seconds (`86400` ≈ 24h, `604800` ≈ 7d) |
| `openai.js:8` | *(none)* — hardcoded `apiKey: "dummy"`, `baseURL: "http://127.0.0.1:8319/v1"`, model `claude-opus-5` | set `AI_BASE_URL`/`AI_MODEL` only if you make it env-driven |
| `mail.js:5` | `RESEND_API_KEY`, `RESEND_FROM_EMAIL` | test sender reaches only your inbox; verified-domain address mails everyone |
| `subscription.js` | `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_PRICE_*`, `CLIENT_URL` | checkout/portal URLs (fallback `http://localhost:3000`) |

---

## Roadmap

- [x] AI chat + chat-with-note (streaming), notes (Quill Delta), flashcards (AI), den + music, JWT auth + onboarding
- [x] Compiled Tailwind v3, lazy ambient, `RetroEvents` decoupling, `compression` + static caching
- [ ] Note sharing & collaboration
- [ ] Export (PDF / Markdown)
- [ ] Semantic search & analytics dashboard
- [ ] PWA offline + mobile app

---

## Contributing

```bash
git checkout -b feat/your-feature
# make changes, follow existing style (ESM, 2-space, double quotes)
npm run lint
git commit -m "feat: concise message"
git push -u origin feat/your-feature
# open a PR against main
```

Keep controller ↔ route 1:1, isolate AI calls in `src/utils/`, parse model JSON defensively, and respect middleware order (`tokenChecker` → `rateLimiter` → `validate` → `checkUsageLimit` → `trackUsage`).

---

## License

ISC — see [LICENSE](LICENSE) if present.

---

## Acknowledgments

MongoDB, Express, Tailwind CSS, Quill, and the open-source community. AI via an OpenAI-compatible provider (local `claude-opus-5` by default; Groq-compatible with a one-line `openai.js` change).

<p align="center">
  Made for learners — <a href="#retro">back to top ↑</a>
</p>
