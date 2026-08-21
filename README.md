# Recall

An Anki-inspired flashcard app with a Duolingo-style visual language. React + TypeScript SPA,
a small Fastify API, and **Anki's real FSRS-6 scheduling algorithm**. Data persists in SQLite,
so it runs the same on a Raspberry Pi or on AWS.

## Quick start (local dev)

Two terminals:

```bash
npm install
npm run server   # API on :8787 (creates ./data/recall.db)
npm run dev      # SPA on :5173, proxies /api to :8787
```

Open http://localhost:5173, register a user (username + password ≥ 4 chars). You get four seeded
starter decks. Register one account per family member.

Validate the scheduler against Anki's own test vectors:

```bash
npm run test:fsrs   # ALL PASS
```

## Architecture

```
Browser (Vite SPA)  ──fetch /api──►  Fastify (server/)  ──►  repository  ──►  SQLite (better-sqlite3)
   src/                            auth · decks · cards · answer · community · stats     + Litestream → S3
   └─ RecallScheduler (previews)        └─ RecallScheduler (authoritative grading)
```

- **`src/fsrs/`** — dependency-free FSRS-6 port (the algorithm Anki ships via `fsrs-rs`), validated
  1:1 against `py-fsrs` test vectors. See [src/fsrs/README.md](src/fsrs/README.md). The client uses it
  for the Again/Hard/Good/Easy interval *previews*; the server uses it to *apply* grades
  authoritatively and persist the new memory state.
- **`server/`** — Fastify API. `db.ts` (schema), `repo.ts` (the persistence seam — all SQL + FSRS
  writes live here), `auth.ts` (scrypt password hashing + signed cookie), `index.ts` (routes + serves
  the built SPA in production).
- **`src/`** — the SPA: `store.tsx` (API-backed state), `screens/`, `components/`, `selectors.ts`.

### Data model (SQLite)

```
users (id, username, password_hash, xp, gems, created_at, new_limit, study_direction,
       new_order,                  -- which unseen cards a session introduces: 'oldest' | 'newest' | 'random'
       seen_version)               -- last "What's new" version dismissed (null = never)
decks (id, user_id, name, color, pos,
       visibility,                  -- 'private' (default) | 'public' — public = listed in Community
       forked_from)                 -- source deck id if this deck was imported from Community
cards (id, deck_id, front, back, example, type, mnemonic, image, created_at,
       stability, difficulty, state, step, due, last_review,   -- the FSRS record, per card
       source_card_id)              -- original card id if copied from a public deck
review_log (id, card_id, user_id, rating, reviewed_at,
            stability_before, state_before)                    -- + memory state going INTO the grade
events (id, slug, title, library, organizer, ingress, target_audience, price,
        start_time, end_time, cancelled, last_seen_at)         -- language cafés cached from deichman.no
event_rsvps (event_id, user_id, status, created_at)            -- 'going' | 'cant', PK (event_id, user_id)
```

Grades run FSRS server-side and persist the updated `cards` row + a `review_log` entry in one
transaction. Each log row also snapshots the card's `stability`/`state` **as they were going into the
grade** (`*_before`), so maturity-at-review-time is recoverable later (null on rows written before this
was added, and on a card's first-ever review). Stats and the family leaderboard are computed from real
data — no fabricated numbers.

See **[Stats & retention](#stats--retention)** for how the gauges and streak are derived.

## Stats & retention

The Stats screen shows three rolling **7-day** retention gauges, each answering a different question.
All are computed from `review_log` in `repo.ts` (`getRetention`, exposed at `GET /api/retention`); a
review counts as *recalled* if it was graded better than Again.

| Gauge | Question it answers | What it counts | Target |
|---|---|---|---|
| **Learning grind** | Am I overloaded right now? | every already-seen review, incl. same-session relearning | none (thermometer) |
| **True retention** | Are my graduated cards sticking? | graduated (Review-state) cards, first look per day | 90% |
| **Mature card retention** | Are my long-learned cards solid? | the subset with `stability ≥ 21` days | 90% |

Key rules:

- **First-ever exposure is excluded everywhere** — the first time you meet a card is learning, not a
  memory test, so counting it would unfairly drag retention down.
- **True / Mature need `state_before`** (to know a card was graduated at review time), so they read
  *"collecting data"* until enough post-snapshot reviews accrue. **Learning grind** needs only rating
  history, so it works immediately.
- The **90%** line is FSRS's default *desired retention* (`0.9`). It's a fair target for the
  graduated/mature gauges — but **not** for the grind blend, which is deliberately dragged down by
  in-progress cards, so the grind card shows no target marker (it's a workload signal, not a grade).
- **Colors:** 🟢 healthy · 🟡 watch · 🔴 low. Below a minimum sample (20 reviews for grind, 15 for
  mature) a gauge shows *"collecting data"* rather than a misleading percentage.

**Streak** (`streakFrom` in `selectors.ts`): consecutive days with `> 0` reviews, ending today. A day
with no reviews *yet* doesn't reset it — the count holds at yesterday's value and increments once you
review today; it only resets after a full missed day (Duolingo-style).

**Cloze-style cards:** a card may carry a fill-in-the-blank prompt on the front (e.g.
`Jeg er ___ legen.` with the answer `hos` on the back) to disambiguate function words. The legacy
`{{}}` marker is also rendered as a blank.

**Mature cards over time** (`repo.ts:getMatureHistory`, `GET /api/mature-history`): a line chart
of how many mature cards (state = Review **and** stability ≥ 21 — the same definition as the
card-counts donut) you held on each day, with 1W/1M/3M/1Y windows. It's **reconstructed
losslessly from the review log**, not snapshotted: a card's memory state only changes at reviews,
and each log row records the state going *into* its grade — so the state a review *set* is the
next row's `*_before` (or the card's current row, for its latest review). Chaining those yields
every card's exact maturity timeline; maturity flips become ±1 events and one sweep samples the
running count per day. Deterministic invariant: the series' last point always equals the live
mature count. Reviews logged before the `*_before` migration can't be classified, so the chart
clamps its x-axis to the first knowable data point. Deleting a deck rewrites this history, like
every other stat.

**Calendar** shows the current year (Jan 1 → Dec 31, Monday-first columns, month labels); future
days render as faint placeholders. `/api/history` returns 366 trailing days so Jan 1 is always
covered — the streak and the reviews chart read from the tail of the same array.

**Chart tooltips:** every chart (and the deck padlock) uses one CSS-only tooltip: put
`class="tip"` + `data-tip="…"` on an element (`index.css`). The line chart adds a per-day hover
marker + guide line via `.chart-col`/`.chart-marker`. Triggers near a clipping right edge
(`overflow: hidden` cards) add `tip-left` to right-align the pill with the trigger.

## Browsing & editing cards

**Browse** lists every card with deck filter chips, a search box, and a **sort**: *Default*
(deck order), *Most missed* — ranked by each card's Again-rate from `review_log`
(`GET /api/hardest?limit=…`, same source as the Stats "Hardest cards" list) — or *New first*,
which floats unstudied cards to the top. Cards missed on ≥ 30% of reviews carry a warning badge
(hover it for the exact miss count); cards never studied carry a **NEW** pill in the accent color.

**Editing.** Every Browse row has an Edit button, and the Study card has a pencil in its top-right
corner — both open the same card-style popup (`components/EditCardDialog.tsx`) for front / back /
mnemonic / image URL, saved via `PATCH /api/cards/:id`. Edits change **note content only**: the
FSRS memory state, the review log, and the study queue are untouched, so fixing a typo never
reschedules a card. (For shared decks, content is copied at import/pull time — see
[Sharing decks](#sharing-decks-community) — so edits don't propagate to existing copies.)
The dialog renders through a React portal: screen wrappers keep a CSS transform from their entry
animation (which would re-anchor `position: fixed`), and since the accent CSS variables live on
the app root, `EditCardDialog` re-applies them on its backdrop.

## Study settings & daily goals

Settings (persisted per user via `PATCH /api/settings`) control how a study session is built in
`store.startStudy`: due cards first, then up to **New cards per day** unseen cards (adjustable
by 1, with quick presets — note the limit applies per *session start*, not per calendar day).
**New card order** picks *which* unseen cards get introduced — `oldest` (order added, default),
`newest`, or `random` — by reordering the unseen cards before `buildQueue` slices the first N.
**Study direction** flips which side is the prompt.

**Due cards unlock at midnight** (Anki-style day granularity): a graduated (Review-state) card
due *any time today* is available from local midnight — reviewing tonight at 21:00 doesn't make
tomorrow's session wait until 21:00. Sub-day learning/relearning steps (e.g. the 10-minute
relearn loop) keep exact timing. Due timestamps are stored exact; only the *is it due yet?*
comparison is day-granular (`RecallScheduler.isDue` / `selectors.isDue`).

Home's **Daily goals** show two bars, each with a "3 of 12 reviews done"-style label:
*Review due cards* = reviews done today ÷ (done + still due), and *Learn new cards* = first
exposures today ÷ your new-cards limit (capped at what's actually available). Done-today counts
come from `GET /api/today` (`repo.ts:getTodayCounts`), split by whether the card's first-ever
review happened today; days roll over at **UTC** midnight.

## Announcing releases (the "What's new" dialog)

`src/data/changelog.ts` holds a list of releases (newest first); the dialog shows them all, with
older ones under an "Earlier" divider — keep the list to the last 1–2 releases. After login,
users who haven't dismissed the *newest* version see the dialog once (new users included);
"Got it" stores that version in `users.seen_version` via the settings PATCH. To announce a
release: unshift a new entry and trim old ones.

## Sharing decks (Community)

Decks can be shared with the other accounts on the same server, AnkiWeb-style: a public deck is a
**template others copy**, not a live shared object.

**Publishing.** Every deck is **private by default**. The padlock on your own deck rows toggles it:
tap to make it public (with a confirmation — "anyone on this server can browse and copy it"), tap
again to make it private. Public decks with at least one card appear in the **Community** screen
(empty ones stay hidden until they have something to copy).

**Importing (copy-on-import).** From Community you can preview a deck's cards (content only — never
anyone's scheduling state) and *Add to my decks*. That clones the deck and its cards into your
account with **new ids and fresh FSRS state** — a copy is a new note for *your* memory, so everyone
schedules independently. After import the catalog shows *Added ✓* and re-importing is refused.

**Getting new cards later.** Each copy remembers where it came from (`decks.forked_from` +
`cards.source_card_id`). When the author adds cards to a deck you imported, your copy shows a
*"N new cards available from @author — Get new cards"* banner. Pulling is **additive only**: new
cards arrive with fresh FSRS state; the author's edits and deletions are never propagated (your
copy and review history are yours).

Rules that keep this safe:

- **Copies are independent.** Unpublishing or deleting the source never touches importers' copies —
  the banner and attribution simply disappear.
- **Imported decks can't be re-shared** (no padlock), even if the original is later deleted.
- **Nothing is public by accident** — sharing is an explicit per-deck act, and a failed
  preview/import (deck just unpublished) resyncs the catalog instead of erroring.

The API surface, all cookie-authenticated (in `server/index.ts`, SQL in `repo.ts`):

```
PATCH /api/decks/:id                 { visibility: 'private' | 'public' }
GET   /api/community                 catalog of other users' public decks (+ added flag)
GET   /api/community/:id             read-only card preview of one public deck
POST  /api/community/:id/import      copy the deck into your account
POST  /api/decks/:id/pull            pull new cards from the (still public) source
```

## Språkkafé (language-café events)

The **Språkkafé** tab lists Norwegian language cafés around Oslo for the next 7 days, and lets
everyone on the server RSVP — *Going* / *Can't go* — so you can see who else will be there
(hover the "N going" count for names).

**Where the data comes from.** `server/deichman.ts` pulls from deichman.no's (Oslo public
library's) event API — public JSON, no auth, but **undocumented**, so the fetch layer is
deliberately thin and defensive: missing fields are tolerated, and a failed fetch just serves the
cached rows. The sync is lazy: `GET /api/events` refreshes at most **once per hour** (one request
total, not per user), then always serves from SQLite.

**Filtering.** Only *Norwegian* cafés are kept: the event must carry a `norwegian`/`norsktrening`
tag **and** not match a foreign-language blocklist over title+tags. Both halves are needed —
Deichman tags "Japansk språkkafé" with `norwegian` too. If a legit café ever goes missing, this
filter (in `deichman.ts`) is the first place to look.

**Why events live in a table.** RSVPs must reference something stable, and the browser can't call
deichman.no directly (CORS). Events are **upserted by Deichman's own stable event id and never
deleted on sync** — an event vanishing upstream keeps its RSVP rows and simply drops out of the
window once `end_time` passes. Upstream changes (time moved, cancelled) update the row in place;
RSVPs stay attached. Cancelled events show a struck-through title + badge rather than disappearing.

**UI.** A 7-day strip (today outlined dark, the selected day filled accent, today preselected)
filters the list per day; empty days stay tappable and show "No language cafés on this day."
The "Showing … ✕" chip, tapping the pill again, or tapping another day clears/moves the filter —
the filter is pure client state, the API always returns the full window. Times are shown in the
browser's local timezone; titles deep-link to the event on deichman.no.

The API surface (cookie-authenticated; SQL in `repo.ts`, sync in `deichman.ts`):

```
GET  /api/events            next-7-days events + everyone's RSVPs + your status (triggers lazy sync)
POST /api/events/:id/rsvp   { status: 'going' | 'cant' | null }   null clears your RSVP
```

## Deploy

One ARM64/amd64 image runs on both targets. Set a secret first:

```bash
cp .env.example .env      # then edit RECALL_SECRET (openssl rand -hex 32)
docker compose up -d --build
```

The app is on port `8787` (serves SPA + API). The SQLite file lives in the `recall-data` volume.

**Raspberry Pi**
- `docker compose up -d --build`. Put a reverse proxy (Caddy/nginx) in front for HTTPS on your LAN.
- Point the data volume at a **USB SSD**, not the SD card, to avoid flash wear from WAL writes.
- Backups: either the Litestream service (→ S3) or a nightly `cp` of `recall.db*` to another disk.

**AWS**
- Cheapest / closest to the Pi: a `t4g.small` (ARM) EC2 or Lightsail instance running the same
  `docker compose`. Front with CloudFront (static) or an ALB.
- Set `LITESTREAM_*` in `.env` for continuous S3 backup + point-in-time restore (see `litestream.yml`).
- Only move to RDS Postgres if you outgrow a few users — swap the implementation behind `server/repo.ts`;
  nothing else changes.

## Scope notes

- **Responsive** (breakpoint 720px): desktop shows the left sidebar; mobile switches to the bottom
  tab bar, 16px content padding, and hides the profile name in the top bar — matching the design's
  two layouts. The prototype's device frame + Desktop/Mobile toggle (scaffolding) are omitted; the
  app fills the viewport and picks the layout from the viewport width instead.
- Deck rows on mobile stack into three lines (name + count / padlock + NEW·DUE + Delete /
  full-width buttons) via `useIsMobile`; on desktop Delete stays hover-revealed, on mobile it's an
  inline link (hover doesn't exist on touch).
- On short viewports (≤ 580px high — i.e. the mobile keyboard is open) the Study screen's spacing
  compresses via the `--study-*` CSS variables in `index.css`, so the card and Show-answer button
  fit without scrolling. Fonts are unchanged; only paddings shrink.
- **Site icons** (`public/`): `favicon.svg` is the browser-tab icon; `apple-touch-icon.png`
  (180×180) is what iOS home-screen shortcuts use — iOS **ignores favicons**, requires a PNG with
  a **solid background** (transparent pixels are composited onto black), and caches the icon per
  shortcut (delete + re-add the shortcut to refresh it). To regenerate: render the artwork in a
  browser at 180×180 over a solid background and screenshot it.
- The streak **flame** and **gem** icons (`icons.tsx`) animate on hover via CSS in `index.css`:
  wrap an icon + its number in `class="icon-stat"` so hovering either triggers the effect; the
  gem's animating facets are the paths carrying `class="gem-facet"`. Both respect
  `prefers-reduced-motion`.
- Auth is username + password for a trusted family circle. For a public deployment add HTTPS
  (reverse proxy), rate limiting, and email/verification.
