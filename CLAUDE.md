# Recall — guide for Claude

Anki-inspired spaced-repetition flashcard app. React + TypeScript SPA, a small Fastify API,
and a **from-scratch FSRS-6 scheduler** (Anki's algorithm), persisted in **SQLite**.
Duolingo-style UI. In practice it's used for the owner's **Norwegian (Norsk)** study — cards are
**English (front) → Norwegian (back)**, drilled in the "production" direction (see the Norwegian
answer, say it aloud). There's also a speaking deck, "Norsk — Muntlig (A2)".

## Run & debug locally (no Docker)

Two processes, two terminals:
```bash
npm run server   # Fastify API on :8787  (reads/writes ./data/recall.db)
npm run dev      # Vite SPA on :5173, proxies /api → :8787 (hot reload)
```
Open http://localhost:5173. The `data/recall.db` file is a normal SQLite DB you can inspect.
- `npm run test:fsrs` — validate the scheduler against Anki's vectors.
- `npm run typecheck` — `tsc --noEmit`.
- Frontend edits hot-reload; after server edits, restart `npm run server` (or use `npm run dev:server`, which watches).

## Architecture

- **`src/`** — the SPA. `store.tsx` (API-backed state), `screens/`, `components/`, `selectors.ts`
  (derived stats/maturity/streak), `api.ts` (HTTP client). FSRS-6 port lives in `src/fsrs/`.
- **`server/`** — Fastify API. `db.ts` (schema + `ensureColumn` migrations), **`repo.ts`
  (ALL SQL + FSRS writes — the single persistence seam)**, `auth.ts` (scrypt hashing + signed
  cookie), `index.ts` (routes; serves the built SPA in production).
- Grades run FSRS **server-side** and persist the updated `cards` row + a `review_log` entry in
  one transaction. Stats are computed from real data — no fabricated numbers.

## Data model notes

- `review_log` has **`stability_before` / `state_before`**: a snapshot of the card's memory state
  *going into* each grade. Null for rows written before that migration and for a card's
  first-ever review. This is what makes maturity-at-review-time recoverable.
- Cards can be **cloze-style**: a fill-in-the-blank prompt on the front (a literal `___`, or the
  legacy `{{}}` marker) with the answer on the back — used to disambiguate function words.
- **Deck sharing (Community)**: decks have `visibility` ('private' default | 'public'); public decks
  are copied on import (fresh FSRS state, new ids), never shared live. Provenance columns
  `decks.forked_from` + `cards.source_card_id` power "Added ✓" and the additive "Get new cards"
  pull. Imported decks can't be re-shared (gate on the server's `imported` flag, not `fromUsername` —
  the latter goes null when the source is deleted). Empty public decks are hidden from the catalog.
  Details in README "Sharing decks (Community)".

- **Språkkafé (events tab)**: `server/deichman.ts` lazily syncs Norwegian language-café events from
  deichman.no's undocumented public JSON API (at most hourly, one request, never throws — a failed
  fetch serves the cache). Events upsert by Deichman's **stable event id** into `events` and are
  **never deleted on sync**, so `event_rsvps` ('going' | 'cant' per user) always keep a valid parent.
  The Norwegian-only filter needs both halves: a `norwegian`/`norsktrening` tag AND a
  foreign-language blocklist (Deichman tags "Japansk språkkafé" with `norwegian` too). Window =
  not-yet-over events starting within 7 days; the per-day filter is client state in `Sprakkafe.tsx`.
  Details in README "Språkkafé (language-café events)".

## Stats & retention (details in README "Stats & retention")

Three rolling **7-day** gauges on the Stats screen, computed in `repo.ts:getRetention`
(exposed at `GET /api/retention`). A review counts as recalled if graded better than Again;
**each card's first-ever exposure is excluded everywhere**.
- **Learning grind** — every already-seen review incl. same-session relearning. Overload
  thermometer, **no 90% target** (it's a workload signal, dragged down by in-progress cards).
- **True retention** — graduated (Review-state) cards, **first look per day**. 90% target.
- **Mature card retention** — the subset with `stability ≥ 21` days. 90% target.
- True/Mature need `state_before`, so they read "collecting data" until enough post-snapshot
  reviews accrue. **90%** is FSRS's default *desired retention* — fair for graduated/mature, not
  for the grind blend.
- **Streak** (`selectors.ts:streakFrom`): consecutive days with >0 reviews ending today; a day
  with no reviews *yet* doesn't reset it (Duolingo-style — holds at yesterday's value, +1s once
  you review, resets only after a full missed day).
- **Mature cards over time** (`repo.ts:getMatureHistory`, `GET /api/mature-history`): per-day
  mature count reconstructed from the log — the state a review *set* = the next row's `*_before`
  (or the card's current row for its last review). Mature must match `selectors.maturity`:
  **state = Review AND stability ≥ 21** (stability alone diverges after lapses). Don't pre-filter
  events to the chart window — earlier events form the baseline. Invariant: last point == live
  mature count. `idx_reviewlog_card` supports this and the retention subqueries.
- `/api/history` returns **366 trailing days** (covers Jan 1 for the year-view Calendar); the
  streak and reviews chart read the array's tail, so the length is safe to grow but not shrink.
- **UI conventions**: `class="tip"` + `data-tip` = the CSS-only tooltip (index.css); add `tip-left`
  near a clipping right edge (right-aligns the pill). `.chart-col`/`.chart-marker` add the
  line-chart hover dot. The "What's new" dialog content lives in `src/data/changelog.ts` — bump
  `version` to announce; dismissal stores `users.seen_version`.
- **Due-ness is day-granular for graduated cards** (Anki-style): a Review-state card is due from
  the **start of its due study day**, so finishing tonight at 21:00 doesn't push tomorrow to 21:00.
  The study day rolls over at **4 AM local** (`DAY_ROLLOVER_HOUR`, Anki's "next day starts at"
  default) so a session at 1 AM still counts as yesterday's. Sub-day learning/relearning steps stay
  exact-time. Boundary helpers `studyDayStart`/`studyDayEnd` live in `recall-scheduler.ts` and are
  the ONLY place the rule is computed — used by `RecallScheduler.isDue`, `selectors.isDue`, Study's
  "Next review in" hint, and Stats' forecast buckets. FSRS grading math is untouched (due
  timestamps are stored exact).
- **Study settings** (README "Study settings & daily goals"): `users.new_limit` steps by 1;
  `users.new_order` ('oldest' | 'newest' | 'random') picks which unseen cards a session introduces —
  `store.startStudy` reorders the unseen cards before `buildQueue` slices the first N (the FSRS
  scheduler itself is untouched). The new-card limit is per *session start*, not per calendar day.
  Home's Daily goals read `GET /api/today` (UTC day boundary); the "Learn new cards" bar targets
  `state.newLimit`. Browse marks unstudied cards (`selectors.isNew`) with an accent "NEW" pill and
  has a "New first" sort.
- **Card editing**: Browse rows + the Study card's corner pencil open `components/EditCardDialog.tsx`
  (front/back/mnemonic/image → `PATCH /api/cards/:id`; FSRS state and review_log untouched).
  Modals must render via `createPortal` — screen wrappers keep a transform from their entry
  animation (breaks `position: fixed`), and the accent CSS vars live on the app root, so the
  dialog re-applies `accentVars(state.accent)` on its backdrop. Browse's "Most missed" sort +
  ▲ badge reuse `GET /api/hardest?limit=…` (store fetches 200; Stats slices its top 10).
- **Responsive patterns**: inline styles can't use media queries, so responsive values go through
  CSS variables in index.css (e.g. `--study-*` shrink under `@media (max-height: 580px)` so the
  Study card fits with the mobile keyboard open). Home renders deck rows in two layouts via
  `useIsMobile` — desktop keeps the hover-reveal Delete; mobile shows Delete inline.
- **Icons**: flame/gem (icons.tsx) animate on hover via index.css; `class="icon-stat"` on an
  icon+number wrapper makes the whole group a hover trigger. iOS shortcuts use
  `public/apple-touch-icon.png` (180×180 PNG, solid background — iOS ignores favicon.svg and
  composites transparency onto black; icon cached until the shortcut is re-added).

## Deploy (full guide in DEPLOY.md)

AWS Lightsail + Docker Compose (`recall` container serves SPA+API on 8787; optional `litestream`
S3 backup). SQLite lives on the instance disk; S3 is backup only. **Gotchas that bit us:**
- **Add swap before building** on a small instance, or the build OOMs and freezes the box
  (SSH included). Recover via a console reboot; then add 2 GB swap.
- **`.gitignore` must use `/data`** (anchored). An unanchored `data` also ignores `src/data/`,
  which drops `src/data/types.ts` + `seed.ts` and breaks the build (`Cannot find module ./data/types.ts`).
- App listens on **8787** — either map it to port 80 (`"80:8787"`) or add a **Custom** firewall
  rule for 8787 (remember the IPv6 firewall section too — instances are dualstack).
- **Migrate the DB** with `sqlite3 recall.db ".backup out.db"` (merges the WAL into one file),
  then `scp` it up (the `:` after `host` is required). Bind-mount `./data:/app/data`.

## Conventions

- Match the surrounding code's style. Keep **all SQL in `server/repo.ts`**.
- **Never commit** `data/` (the SQLite DB + backups) or `.env`. `.env.example` is the template.
- The owner works on a **work Mac**; when touching git remotes, keep global git/`gh` config
  untouched (use repo-local settings / a dedicated key).
