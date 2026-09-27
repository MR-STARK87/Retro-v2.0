# Code Reduction Plan

**Branch:** `dev`
**Base:** `7b44e42`
**Scope:** remove dead, duplicated, orphaned, and collapsible code.
**Hard constraint:** user-visible behaviour must not change — same rendered pixels, same interactions, same network calls.

This is a *deletion* plan, separate from `docs/implementation-plan.md` (which fixes correctness/performance/hardening). Nothing here repairs a bug; it only removes code that provably never runs, or collapses duplication.

Audited mass: **19,194 lines / 78 files** (`src/`, `public/`, `scripts/`, `.js|.mjs|.ejs|.css|.txt`).

---

## 0. Reading this document

- **Confidence H** = a grep/AST-style proof exists: zero inbound references, or an identical later declaration provably wins.
- **Confidence M** = structurally safe but touches rendered markup or a behaviour surface; needs `npm run smoke`.
- **"Looks dead but is live"** sections are as important as the removal lists. Read §6 before touching anything.

Verification gates referenced below:

```bash
npm run lint        # eslint .  (0 errors, 36 pre-existing warnings)
npm run smoke       # needs running server on :8000 + headless Chrome
npm run build:css   # only if class tokens move in/out of templates
node scripts/css-coverage.mjs
```

---

## 1. Executive summary

| Tier | Nature | Lines (approx.) | Confidence | Gate |
|---|---|---|---|---|
| T1 | Pure deletion — orphan scripts, unreachable JS/CSS, no-op guards, dead config | **~900** | H | lint / smoke per batch |
| T2 | Duplication collapse — byte-identical helpers redeclared across panes | **~120** | H | smoke (global shadowing) |
| T3 | EJS refactors — repetitive listener wiring + identical markup rows | **~500** | M | smoke primary |
| — | Hold — deliberately parked or operationally load-bearing | (69+) | — | product decision |
| **Total actionable** | | **~1,520** | | |

Backend contributes ~800 of the T1 lines, front-end ~300, config/docs/orphans ~200.

Three decisions gate the tail of the work (§7).

---

## 2. Tier 1 — pure deletion (high confidence)

### 2.1 Orphan scripts (~139 lines, no verification needed)

| File | Bytes | Proof |
|---|---|---|
| `scripts/md-diag.mjs` | 10,911 | Zero references in `package.json`, `.github/`, `CLAUDE.md`, `README.md`, `docs/`. One-off diagnostic. |
| `scripts/extract-inline.mjs` | 1,787 | Zero references. Header comment says "One-off helper"; it operated on `src/views/partials/*.ejs`, and all 8 partials are already extracted. |

`scripts/smoke-test.mjs` (21,171 B), `scripts/css-coverage.mjs` (9,898 B), `scripts/screenshot.mjs` (6,646 B) are **live** — wired in `package.json:11`, `ci.yml:51`, `CLAUDE.md:22-24`. Keep.

### 2.2 Dead loader (~35 lines)

- `public/js/common/loader.js` — entire file. `window.loadScript` has exactly **one** reference in the repo: its own definition.
- `src/views/partials/head.ejs:35` — the `<script>` tag that loads it.
- `src/views/partials/head.ejs:33` — comment describing it.
- `eslint.config.js:45` — the `loadScript` global declaration.

Gate: `npm run smoke`, then `node scripts/css-coverage.mjs` (confirms the tag removal didn't orphan a class).

### 2.3 Unreachable `showToast` in chat (~86 lines)

`public/js/chat.js:258-275` defines `showToast` inside chat's deferred script. `public/js/flashcards.js:104` defines a top-level `window.showToast` with **no IIFE**, and flashcards loads later in `app.ejs` include order — so flashcards' copy wins for every caller.

Remove:

- `public/js/chat.js:258-275` (the shadowed function body)
- `src/views/partials/chat-content.ejs:1276-1340` (the `.toast*` CSS block)
- `src/views/partials/chat-content.ejs:27-29` (`#toastContainer` div — the surviving implementation provides its own)

Gate: `npm run smoke` (chat and flashcards both exercise toasts).

### 2.4 Backend — no-op statements and unreachable guards (~201 lines across commits)

| Location | Finding | Proof |
|---|---|---|
| `src/controllers/auth.js:135-136` | Assignments to `req.user.context` / `req.user.preferences` | Neither path exists on `userSchema`; `toJSON` omits both. **No-op.** Note `:140` (`memory`) and `:143` (`displayName`) are **LIVE** — keep them. |
| `src/controllers/auth.js:294-296`, `:338-340` | `newPassword !== confirmPassword` guards | Redundant: `resetPasswordSchema` / `changePasswordSchema` already `.refine()` this (`src/validators/passwordSchemas.js:10-12`, `:24-26`), wired at `src/routes/authRoutes.js:36`, `:48`. The Zod layer rejects first. |
| Dead exports | See table below | Reference-counted across `src/` + `scripts/` |

Dead-export scan result:

- **LIVE — do not remove:** `getUsageStats` (`src/controllers/subscription.js:4`, called at `:199`), `checkUsageLimit`, `trackUsage`, `incrementUsage` (all in the route middleware chain).
- **Status TBD:** `getRateLimitStatus` — confirm before the commit that lands this batch.

Also stale, not dead: `src/index.js:136` boot log references `PAYMENT_SETUP_GUIDE.md`, which does not exist.

**Password handling audit (negative result, recorded so it isn't re-investigated):** no password leak. `tokenChecker.js:25` uses a bare `findById`; `password` is `select:false`; the only `+password` paths (`auth.js:87`, `:330`) respond message-only.

### 2.5 Backend — unwired endpoints (~234 + ~366 lines)

- **Batch B:** orphan note/card `query` + `toggle` routes (~234 lines). Each removal must ship with a matching edit in `test-routes.js` *if that file is kept* (§7).
- **Batch C:** `POST /resend-verification-email` (`src/routes/authRoutes.js:41`) — authenticated, zero callers — plus remaining unwired auth/subscription/music/onboarding endpoints (~366 lines). **Requires product sign-off**: these are reachable by anyone holding a token, they are just never called by our own front-end.

Gate: `npm run smoke`.

### 2.6 Front-end CSS / markup deletions (~88 lines)

| Location | Finding | Proof |
|---|---|---|
| `public/css/app.css:532-539` | `.note-item.deleting` (+ `:532` comment) | No `classList.add/toggle("deleting")` anywhere; only console-string matches (`chat.js:847`, `notes.js:703`). |
| `public/css/app.css:66-111` | `.modal-header .tooltip:hover::before/::after` + `@keyframes tooltipFadeInLeft` | The only `.modal-header` is `app.ejs:149-161`, which contains no `.tooltip`. **Base `.tooltip` (`:18-64`) stays** — live in notes/flashcards toolbars. |
| `public/css/app.css:249-268` | 4× `.flex-1.overflow-y-auto.p-4::-webkit-scrollbar*` | Fully redeclared at `notes-content.ejs:202-221`, later in document order → wins. Keep `app.css:245-247`. |
| `public/css/app.css:14-16` | `.gradient-bg` | Zero class references; `--gradient-bg` (`head.ejs:55`) is also dead. |
| `src/views/partials/head.ejs:40,49,49,50,51,55,56,69` | 7 dead CSS custom properties (`--nav-height`, `--success`, `--warning`, `--error`, `--gradient-bg`, `--glass-bg` ×2) | Each `var(--x)` search returns only its own definition. |
| `src/views/partials/head.ejs:122-124` | `.accent-font` | Class token absent from every view, script, and the safelist. |
| `src/views/partials/head.ejs:104` | `font-family:"IBM Plex Sans"` on `body` | Equal specificity to `app.css:10`; `app.css` is linked at `app.ejs:6`, *after* the head include at `app.ejs:4` → later wins. **Keep the rest of that rule.** |
| `src/views/partials/den-content.ejs:687-690` | `[data-theme="dark"] .bg-gray-300` | Byte-identical to `den-content.ejs:604-606`. |
| `src/views/partials/den-content.ejs:634-636` | `#optResetToday { color:#c2c0b6 }` | Same selector redeclared at `:642-644` with `#ef4444`, same specificity → later wins. **Keep `:642-644` and `:538-542`.** |
| `src/views/partials/den-content.ejs:1339` | `background:rgba(255,255,255,0.1)` in dark `.volume-slider` | Same selector at `:1386-1388` sets `background:var(--bg-tertiary)`. **Keep the rule for its `box-shadow` on `:1340`.** |
| `src/views/partials/notes-content.ejs:153` | Duplicate `<link href="/css/app.css?v=…">` | `app.ejs:6` loads the identical URL; this partial only renders inside `app.ejs`. |
| `public/favicon.svg` | 16 lines | MD5 `A86F5D6F6B7ECB0EAC66FE16D011D1D6`, identical to `public/icon.svg`. `head.ejs:6` (`rel="icon"`) points at `/icon.svg`; `head.ejs:7` uses non-standard `rel="alternate icon"` and is effectively never fetched. Delete the file **and** retarget or drop `head.ejs:7`. |
| `public/css/tailwind.css` | `.md\:space-y-5` | No `md:` variant exists in `src/views` or `public/js`; safelist never emitted it. **Requires `npm run build:css`, not a hand edit.** |

Gate: `npm run smoke`.

### 2.7 Dead `id` attributes (~9 lines)

Zero `getElementById` / `#` / CSS-attribute readers:

`flashcards-content.ejs:24,34,39,49,70` (`searchInput`, `difficultyDropdownBtn/Menu`, `tagDropdownBtn`, `flashCreateBtn`), `horizontal-nav.ejs:2` (`navIndicator`), `den-content.ejs:442` (`musicPlayerContainer`), `loginSignUp.ejs:196` (`rememberMe`).

**Elements themselves stay** — several are styled by class. Only the `id` attribute goes. Note `notes-content`'s `id="searchInput"` duplicates the flashcards one; both are unread, which is why neither collides today.

Gate: `npm run lint` (no runtime change).

### 2.8 Config / metadata / hygiene (~65 lines + 1 fix)

| Location | Finding |
|---|---|
| `package.json:5` | `"main": "index.js"` — file does not exist; no script, CI step, or import reads it. Entry is `src/index.js`. |
| `package.json:9` | `"test"` stub (`exit 1`) — `npm test` never invoked by CI or docs-as-command. |
| `eslint.config.js:41-42` | Globals `VANTA`, `THREE` — zero hits since `ca54c86` removed three.js/vanta. |
| `eslint.config.js:53` | Global `enhanceWithPro` — renamed to `enhanceWithRetro` (`notes.js:361`, `:221`). |
| `eslint.config.js:59-61` | `{ files: [...] }` block with no `rules`/`languageOptions` — no-op. |
| `.gitignore:19` | `C:\Users\Zaida\AppData\Local\Temp\opencode` — absolute path; `git check-ignore` errors *"outside repository"*. Can never match. |
| `.gitignore:46` | `!public/music/.gitkeep` — no `.gitkeep` tracked or on disk. |
| `.gitignore` ×16 | Patterns for directories that don't exist (`logs/`, `dist/`, `build/`, `.next/`, `out/`, `coverage/`, `.nyc_output/`, `tmp/`, `.vscode/`, `.idea/`, `*.code-workspace`, `*.sqlite`, `*.db`, `pnpm-*`, `yarn-*`). |
| `.gitignore` **missing** | No `screenshots/` entry. `scripts/screenshot.mjs:15` writes there → 9 untracked PNGs are `git add .`-eligible. **This is the one safety *improvement* in this plan.** |
| `ci.yml:12-16` vs `:27-31` | Duplicated `checkout`/`setup-node`/`npm install`, no `cache:` — ~2× install waste. Optional; not a removal. |
| `ci.yml:38` | `NODE_ENV=test`, but `index.js:40` only tests `=== "development"` → CI exercises the **production** static/CORS branch under a `test` label. Misleading; works. Optional. |

Gate: `npm run lint` must produce **byte-identical output** before and after — that is the proof for the eslint edits.

`.env.example` audit: **0 of 20 keys unused.** Every key grep-matches in `src/`. `RENDER_GIT_COMMIT` is read (`index.js:76`) but intentionally undocumented (`CLAUDE.md:44`).

---

## 3. Tier 2 — duplication collapse (high confidence, ~120 lines)

All four are **unguarded top-level declarations** where the last script loaded wins. Flashcards loads after chat/notes/den, so `flashcards.js`'s copies are the live ones today — deleting the earlier copies changes nothing, but the *shape* of the global changes, hence `smoke`.

| Keep | Delete | Lines |
|---|---|---|
| `flashcards.js:94-102` `escapeHtml` | `chat.js:31-36`, `den.js:1894-1900`, `profile.js:356-361` | 19 → ~14 net |
| `notes.js:1-6` `getCookie` | `chat.js:439-444` | 12 → ~7 net |
| — (extract) | 4× identical `localStorage…\|\|getCookie("accessToken")` preamble: `chat.js:1104-1110`, `notes.js:305-311`, `:495-501`, `:683-689` → `authHeaders()` | 28 → ~21 net |

`notes.js:620` consumes the global `escapeHtml` — that call must keep resolving.

Gate: `npm run lint` + **`npm run smoke`**.

---

## 4. Tier 3 — EJS refactors (medium confidence, ~500 lines)

Structurally repetitive, mechanically collapsible, **but** these change rendered HTML, so `npm run smoke` is the primary gate — lint cannot catch a broken template. Use `npm run build:css` if any class token leaves a template.

| # | Location | What | Lines | Confidence |
|---|---|---|---|---|
| T3.1 | `loginSignUp.ejs:663-890` | Per-field `blur`/`input` listener boilerplate (8× `addEventListener("blur")`, 8× `("input")`, 8× `errorDiv.classList.contains("show")`) over fixed `[id, errId, rule]` triples → loop | 203 | M-H |
| T3.2 | `loginSignUp.ejs:158-380` | 8× identical label row + input class | 160 | M |
| T3.3 | `loginSignUp.ejs:967-1001` | 6 explicit `validateField(...)` calls, same triples as T3.1 | 23 | M |
| T3.4 | `den-content.ejs:272-398` | Settings rows: `w-7 h-7 rounded-full…` ×6, `flex justify-between…` ×6, toggle `label.inline-flex` ×3 — differ only in id/label/step | 92 | M |
| T3.5 | `upgrade.ejs` spec table | `.spec-row` ×11, `<strong>Unlimited</strong>` ×5, `.check ok` ×5, `.check no` ×4 → driven by data array | 40 | M |
| T3.6 | `app.ejs` colour picker | `color-option pro-feature` ×4, `fa-lock` ×4 | 8 | M |

**Keep password/confirm special-cases explicit** in T3.1/T3.3 — those two fields have asymmetric rules and should not be forced into the shared triple.

Recommended batching: one commit per refactor, each behind `npm run smoke`, done **after** Tiers 1–2 (deleting first makes the helpers smaller).

---

## 5. Backend helper extraction (after Tiers 1–2)

Each is its own commit, each behind `npm run lint` + `npm run smoke`.

| Commit | Scope | Net lines | Risk |
|---|---|---|---|
| D1 | `extractAccessToken(req)` — collapse 4× token-extraction waterfall (`tokenChecker.js`, `viewTokenChecker.js`, `redirectIfAuthenticated.js`, root `/` route) | 33 | **Highest** — touches auth on 4 paths incl. root `/`. |
| D2 | Toggle handler helper | 70 (or ~25 if the Batch-B toggle routes were already deleted) | Medium — must preserve 5 distinct message strings verbatim. |
| D3 | `chat.js` extracted handlers (two ~150-line blocks) | 55 | Medium — easy to regress the stream path. |
| D4 | `loadOwnedNote` | 27 | Medium — **must keep 403, not 404** (`docs/implementation-plan.md:839`). |
| D5 | `findOwnedOr404` for the remaining 13 ownership blocks | 50 | Low-medium. |
| D6 | `subscription.js` → `asyncHandler` + error helper | 60 | Low — but changes which errors surface as HTML vs JSON. **Verify webhook still 200s.** |

### Explicitly not recommended

| Item | Why |
|---|---|
| `parseAIJson` consolidation | 15 lines for real regression risk across 3 distinct error contracts (`chat.js`, `note.js`, `card.js`). Skip. |
| `express.urlencoded` removal (`index.js:92`) | Not dead — still serves form posts. Skip. |
| `profile.js:304` `clear-memory` mismatch | **Not dead code.** Route doesn't exist; either add it or drop the call — a product decision (§7). |

---

## 6. Looks dead but is LIVE — do not remove

Negative results, recorded so they are not re-investigated.

**Front-end**

- `.ql-*` selectors in `app.css` (~45, `:119-530`) — injected at runtime by Quill, invisible to any source grep. Any naive scan false-positives on all of them.
- `show-notes` / `show-den` / `show-flashcards` — string-built at `nav.js:15` as `'show-' + name`.
- `toast-${type}` (`chat.js:267`) — template-literal class.
- Tailwind safelist `bg-gray-100` / `bg-black` / `text-gray-800` / `text-white` — composed dynamically in `chat.js`, pinned in `tailwind.config.js`.
- `feature-row`, `feature-icon` (`setup.ejs:439/443`), `.dot` (`setup.ejs:461`) — created via JS `className` assignment.
- `toastError` / `toastSuccess` ids — assigned dynamically.
- `*DropdownContainer` / `*DropdownText` / `*DropdownMenu` (`flashcards.js:50,69,72,79`) — read as `type + 'Dropdown…'` concatenation.
- `fa-volume-mute` (`den.js:1858,1872`) — assigned via `className`.
- All 26 inline `onclick` / `oninput` handlers in `.ejs` — legitimate references.
- Every `window.*` export **except** `loadScript` and `resetGreeting` — 151 top-level definitions scanned, all ≥1 ref. `window.RetroEvents` is dispatched cross-pane (`section:change`, `ambient:toggled`, `den:timer-progress`).
- `head.ejs:73-77` `*` reset duplicated in `setup.ejs` — different pages; `head.ejs` is included only by `app.ejs`.
- `i.far` / `button i.far` (`den-content:539-551`, `flashcards-content:503-518`, `notes-content:260-276`) — distinct selectors per pane.
- `.chat-sessions-list`, `.notes-popup-body`, `.chat-messages`, `.chat-textarea`, `.playlist-items`, `.flashcard-modal`, `#ambientToggle` repeats — complementary property sets (base vs scrollbar vs Firefox block), verified property-by-property.
- `#ambientToggle` / `#colorPickerContainer` — visibility owned by `nav.js` via `data-visible` (`app.css:1-6`). Do not toggle elsewhere.
- `den-content.ejs:538-542` `#optResetToday` — keep; only `:634-636` is shadowed.

**Back-end / tooling / repo**

- `scripts/smoke-test.mjs`, `css-coverage.mjs`, `screenshot.mjs` — CI + documented tooling.
- `test-routes.js` (22,553 B) — only manual API suite; broken chat case is *documented*.
- `docs/implementation-plan.md` — it is the active `dev` plan (HEAD `7b44e42`); the files it names as "missing" are *proposed*, not drift.
- `public/js/theme.js` + `partials/theme-toggle.ejs` (69 lines) — button is `display:none`, `theme.js:17-30` duplicates `profile.js:377-386`, **but** it is explicitly tagged "TEMPORARILY DISABLED / will be re-enabled later". **Hold.** Revisit only when re-enabling the toggle.
- `icon/icon.svg` + `icon/README.md` — design master (`icon/README.md:13`) for regenerating the served copies.
- `.github/workflows/keep-awake.yml` — undocumented cron `*/10 * * * *` → Render health endpoint. Removing it lets the service sleep. Operational, not code.
- `docs/provider.md`, `src/views/README.md`, `icon/README.md`, `public/music/README.md` — zero *code* refs by design; human docs. Fix inbound pointers, don't delete.
- `tailwind.config.js` + `src/styles/tailwind.css` — build inputs. Only the emitted `.md\:space-y-5` is dead.
- `.gitignore:3` (`package-lock.json`) — intentional (`CLAUDE.md:129`).
- `package.json` `name` / `description` — cosmetic; only `version` is consumed (`index.js:84`).
- `RENDER_GIT_COMMIT` absent from `.env.example` — undocumented by design.

**Runtime-injected / dynamic — never treat as dead:** `.ql-*`, `show-*`, `toast-*`, safelist classes, `fa-*` assigned via `className`, `window.RetroEvents`, inline EJS handlers.

---

## 7. Decisions required before execution

1. **`test-routes.js`** — delete it, or keep it?
   - *Delete:* +808 lines; every Batch-B endpoint removal becomes a whole-file deletion, and the "update test-routes" edits disappear.
   - *Keep:* every endpoint removal ships with a matching TR edit in the same commit, plus the separate `fix:` for its existing staleness (its chat test sends only `{message}` and 404s).
   - **This decides Batch B's shape — answer it first.**
2. **`profile.js:304` `clear-memory`** — the target route does not exist. Add the route, or remove the call? Product decision, separate issue either way.
3. **`keep-awake.yml`** — confirm the Render deployment intent before touching.

---

## 8. Batch plan and commit sequence

Ordered so that deletions land before the refactors that shrink them.

| Batch | Contents | Lines | Gate |
|---|---|---|---|
| **B1** docs-only | `README.md` 10 stale blocks (three/vanta, `GROQ_API_KEY`, non-env AI, wrong anchors `:132/:282/:287`, `provider/README.md` path, scripts tree `:110-113`), `docs/provider.md:93,105`, `src/views/README.md:56`, `CLAUDE.md:58` (missing `/api/v1/subscription` mount), `css-coverage.mjs:5` stale header | ~28 | `npm run lint` (syntax only; rest is text) |
| **B2** config/metadata | `package.json:5,9`; `eslint.config.js:41,42,45,53,55,59-61`; `.gitignore` prune + **add `screenshots/`** | ~47 | `npm run lint` **byte-identical** = the proof |
| **B6** orphan scripts | delete `scripts/md-diag.mjs`, `scripts/extract-inline.mjs` | 139 | none (zero refs) |
| **A** dead CSS/markup/JS | §2.2, §2.3, §2.6, §2.7 | ~140 | `npm run smoke` |
| **B** orphan backend routes | §2.5 first half | ~234 | `npm run smoke` (+ TR edit if kept) |
| **C** unwired endpoints | §2.5 second half | ~366 | `npm run smoke`, **product sign-off** |
| **backend chore** | §2.4 no-op lines, redundant guards, dead exports | ~201 | `npm run lint` then `npm run smoke` |
| **T2** dedupe helpers | §3 | ~120 | `npm run lint` + `npm run smoke` |
| **D1–D6** | §5, one commit each | ~295 | `npm run lint` + `npm run smoke` **each** |
| **T3.1–T3.6** | §4, one commit each, last | ~500 | `npm run smoke` primary, then `npm run lint` (+ `build:css` if tokens move) |
| **schema fields** | `sharedWith` / `reminder` / `attachments` / `formattedDate` / `storageUsed` + text indexes (`note.js:100`, `card.js:82`) | — | **Separate commit, response-shape diff in description.** Text indexes can be their own pure-DB commit — safest half, zero response impact. |

### Suggested commit messages

```
chore: drop stale docs, dead config entries and orphan scripts          (~214 L)
fix:   remove unreachable chat toast, dead CSS and duplicate markup     (~140 L, smoke)
fix:   drop orphan note/card query and toggle routes                    (~234 L, smoke)
feat:  remove unwired auth/subscription/music/onboarding endpoints      (~366 L, smoke)
chore: remove no-op assignments, redundant guards and dead exports      (~201 L, smoke)
refactor: collapse duplicate escapeHtml/getCookie/auth header helpers    (~120 L, smoke)
refactor: extract token, toggle, chat and ownership helpers              (6 commits, smoke each)
refactor: replace repetitive EJS wiring with data-driven loops           (6 commits, smoke each)
chore: drop unreferenced note/card schema fields and unused text indexes (response-shape diff)
```

Every commit: conventional prefix, one logical change, PR into `main` (branch protection now enforces `lint` + `smoke` + strict up-to-date).

---

## 9. Excluded from scope

- Anything in `docs/implementation-plan.md` — correctness/performance work, not reduction.
- `express.urlencoded`, `parseAIJson` consolidation, `profile.js:304` (§5).
- `theme.js` / `theme-toggle.ejs`, `keep-awake.yml`, `icon/`, `test-routes.js` pending §7.
- Dependency removal — all 13 runtime deps are genuinely imported. No free win.
- Behaviour-affecting CSS tuning (den.js fps, chat streaming pacing, rate limits).

---

## 10. Verification matrix

| Batch | lint | smoke | build:css | css-coverage | Manual |
|---|---|---|---|---|---|
| B1 docs | ✓ | | | | |
| B2 config | ✓ (identical output) | | | | |
| B6 orphans | ✓ | | | | |
| A CSS/markup/JS | ✓ | ✓ | if classes move | ✓ | |
| B/C backend routes | ✓ | ✓ | | | product sign-off (C) |
| backend chore | ✓ | ✓ | | | |
| T2 dedupe | ✓ | ✓ | | | |
| D1–D6 | ✓ | ✓ | | | webhook 200 (D6) |
| T3 EJS | ✓ | ✓ | ✓ | ✓ | rendered diff on 4 panes + login/signup + pricing |
| schema fields | ✓ | ✓ | | | API response diff |

`npm run smoke` needs the server on **:8000** (`BASE_URL` override available) and headless Chrome; it registers a throwaway user and completes onboarding, so it covers chat, notes, den, flashcards, and setup.
