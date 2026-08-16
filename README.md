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
users (id, username, password_hash, xp, gems, created_at, new_limit, study_direction)
decks (id, user_id, name, color, pos,
       visibility,                  -- 'private' (default) | 'public' — public = listed in Community
       forked_from)                 -- source deck id if this deck was imported from Community
cards (id, deck_id, front, back, example, type, mnemonic, image, created_at,
       stability, difficulty, state, step, due, last_review,   -- the FSRS record, per card
       source_card_id)              -- original card id if copied from a public deck
review_log (id, card_id, user_id, rating, reviewed_at,
            stability_before, state_before)                    -- + memory state going INTO the grade
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
- Auth is username + password for a trusted family circle. For a public deployment add HTTPS
  (reverse proxy), rate limiting, and email/verification.
