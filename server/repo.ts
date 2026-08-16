import { randomUUID } from 'node:crypto';
import { db } from './db.ts';
import { RecallScheduler, Rating, type Card } from '../src/fsrs/recall-scheduler.ts';
import { hashPassword } from './auth.ts';

const scheduler = new RecallScheduler(); // FSRS-6 defaults; authoritative server-side scheduler.

// ---- wire types (dates as epoch ms so JSON round-trips cleanly) ----
export type StudyDirection = 'front' | 'back' | 'both';

export type CardType = 'basic' | 'cloze';

export interface WireCard {
  id: string;
  front: string;
  back: string;
  example: string | null;
  type: CardType;
  mnemonic: string | null;
  image: string | null;
  createdAt: number;
  fsrs: { stability: number | null; difficulty: number | null; state: number; step: number | null; due: number; lastReview: number | null };
}
export type DeckVisibility = 'private' | 'public';

export interface WireDeck {
  id: string;
  name: string;
  color: string;
  visibility: DeckVisibility;
  /** True if this deck was copied from a public deck (imported decks can't be re-shared). */
  imported: boolean;
  /** Author of the source deck, when this deck was imported and the source still exists. */
  fromUsername: string | null;
  /** Cards in the (still public) source deck not yet pulled into this copy. */
  newAvailable: number;
  cards: WireCard[];
}
export interface PublicUser {
  id: string;
  username: string;
  xp: number;
  gems: number;
  newLimit: number;
  studyDirection: StudyDirection;
  /** Last "What's new" version the user dismissed (null = never). */
  seenVersion: string | null;
}

interface CardRow {
  id: string;
  front: string;
  back: string;
  example: string | null;
  type: string;
  mnemonic: string | null;
  image: string | null;
  created_at: number;
  stability: number | null;
  difficulty: number | null;
  state: number;
  step: number | null;
  due: number;
  last_review: number | null;
}

function rowToWire(r: CardRow): WireCard {
  return {
    id: r.id,
    front: r.front,
    back: r.back,
    example: r.example,
    type: (r.type as CardType) || 'basic',
    mnemonic: r.mnemonic,
    image: r.image,
    createdAt: r.created_at,
    fsrs: { stability: r.stability, difficulty: r.difficulty, state: r.state, step: r.step, due: r.due, lastReview: r.last_review },
  };
}

function toCard(r: CardRow): Card {
  return {
    stability: r.stability,
    difficulty: r.difficulty,
    state: r.state as Card['state'],
    step: r.step,
    due: new Date(r.due),
    lastReview: r.last_review === null ? null : new Date(r.last_review),
  };
}

// ---- users ----

const USER_COLS = 'id, username, xp, gems, new_limit AS newLimit, study_direction AS studyDirection, seen_version AS seenVersion';

export function getUserByUsername(username: string): (PublicUser & { password_hash: string }) | undefined {
  return db.prepare(`SELECT ${USER_COLS}, password_hash FROM users WHERE username = ?`).get(username) as any;
}

export function getUser(id: string): PublicUser | undefined {
  return db.prepare(`SELECT ${USER_COLS} FROM users WHERE id = ?`).get(id) as any;
}

/** Update a user's study settings. Returns the updated public user. */
export function updateSettings(userId: string, opts: { newLimit?: number; studyDirection?: StudyDirection; seenVersion?: string }): PublicUser | undefined {
  if (typeof opts.newLimit === 'number') {
    const n = Math.max(0, Math.min(999, Math.round(opts.newLimit)));
    db.prepare('UPDATE users SET new_limit = ? WHERE id = ?').run(n, userId);
  }
  if (opts.studyDirection && ['front', 'back', 'both'].includes(opts.studyDirection)) {
    db.prepare('UPDATE users SET study_direction = ? WHERE id = ?').run(opts.studyDirection, userId);
  }
  if (typeof opts.seenVersion === 'string' && opts.seenVersion.length <= 20) {
    db.prepare('UPDATE users SET seen_version = ? WHERE id = ?').run(opts.seenVersion, userId);
  }
  return getUser(userId);
}

/** Create an empty user account in one transaction. */
export const createUser = db.transaction((username: string, password: string): PublicUser => {
  const id = randomUUID();
  const now = Date.now();
  db.prepare('INSERT INTO users (id, username, password_hash, xp, gems, created_at) VALUES (?, ?, ?, ?, ?, ?)').run(id, username, hashPassword(password), 0, 500, now);

  return { id, username, xp: 0, gems: 500, newLimit: 20, studyDirection: 'front', seenVersion: null };
});

// ---- decks / cards ----

// Palette for new decks (cycles by deck count).
const DECK_COLORS = [
  'oklch(0.64 0.14 40)',
  'oklch(0.6 0.11 250)',
  'oklch(0.62 0.14 18)',
  'oklch(0.6 0.11 150)',
  'oklch(0.62 0.13 300)',
  'oklch(0.63 0.13 90)',
];

/** Create a new empty deck for the user. */
export function createDeck(userId: string, name: string): WireDeck {
  const row = db.prepare('SELECT COUNT(*) AS n FROM decks WHERE user_id = ?').get(userId) as { n: number };
  const color = DECK_COLORS[row.n % DECK_COLORS.length];
  const id = randomUUID();
  db.prepare('INSERT INTO decks (id, user_id, name, color, pos) VALUES (?, ?, ?, ?, ?)').run(id, userId, name, color, row.n);
  return { id, name, color, visibility: 'private', imported: false, fromUsername: null, newAvailable: 0, cards: [] };
}

// Cards in `sourceDeckId` that no card in `targetDeckId` was copied from — i.e. added upstream
// since the import (or since the last pull).
const NEW_FROM_SOURCE = `FROM cards o WHERE o.deck_id = ?
  AND o.id NOT IN (SELECT source_card_id FROM cards WHERE deck_id = ? AND source_card_id IS NOT NULL)`;

export function getDecks(userId: string): WireDeck[] {
  const decks = db
    .prepare(
      `SELECT d.id, d.name, d.color, d.visibility, d.forked_from,
              (SELECT u.username FROM decks sd JOIN users u ON u.id = sd.user_id WHERE sd.id = d.forked_from) AS fromUsername
       FROM decks d WHERE d.user_id = ? ORDER BY d.pos`,
    )
    .all(userId) as { id: string; name: string; color: string; visibility: DeckVisibility; forked_from: string | null; fromUsername: string | null }[];
  const cardsStmt = db.prepare('SELECT * FROM cards WHERE deck_id = ? ORDER BY created_at');
  const newStmt = db.prepare(
    `SELECT COUNT(*) AS n ${NEW_FROM_SOURCE} AND EXISTS (SELECT 1 FROM decks WHERE id = o.deck_id AND visibility = 'public')`,
  );
  return decks.map((d) => ({
    id: d.id,
    name: d.name,
    color: d.color,
    visibility: d.visibility,
    imported: d.forked_from !== null,
    fromUsername: d.fromUsername,
    newAvailable: d.forked_from ? (newStmt.get(d.forked_from, d.id) as { n: number }).n : 0,
    cards: (cardsStmt.all(d.id) as CardRow[]).map(rowToWire),
  }));
}

export interface NewCard {
  front: string;
  back: string;
  example?: string | null;
  type?: CardType;
  mnemonic?: string | null;
  image?: string | null;
}

export function addCard(userId: string, deckId: string, c: NewCard): WireCard | null {
  const owns = db.prepare('SELECT 1 FROM decks WHERE id = ? AND user_id = ?').get(deckId, userId);
  if (!owns) return null;
  const now = Date.now();
  const fresh = scheduler.newCard(new Date(now));
  const id = randomUUID();
  db.prepare(
    'INSERT INTO cards (id, deck_id, front, back, example, type, mnemonic, image, created_at, stability, difficulty, state, step, due, last_review) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
  ).run(id, deckId, c.front, c.back, c.example ?? null, c.type ?? 'basic', c.mnemonic ?? null, c.image ?? null, now, fresh.stability, fresh.difficulty, fresh.state, fresh.step, fresh.due.getTime(), null);
  return rowToWire(db.prepare('SELECT * FROM cards WHERE id = ?').get(id) as CardRow);
}

/** Delete a single card (its review_log rows cascade). Returns true if it belonged to the user. */
export function deleteCard(userId: string, cardId: string): boolean {
  const info = db
    .prepare('DELETE FROM cards WHERE id = ? AND deck_id IN (SELECT id FROM decks WHERE user_id = ?)')
    .run(cardId, userId);
  return info.changes > 0;
}

/** Delete a whole deck; its cards + their review_log rows cascade. Returns true if it belonged to the user. */
export function deleteDeck(userId: string, deckId: string): boolean {
  const info = db.prepare('DELETE FROM decks WHERE id = ? AND user_id = ?').run(deckId, userId);
  return info.changes > 0;
}

// ---- public deck sharing (Community) ----

/** Flip a deck's Community visibility. Returns true if the deck belonged to the user. */
export function setDeckVisibility(userId: string, deckId: string, visibility: DeckVisibility): boolean {
  const info = db.prepare('UPDATE decks SET visibility = ? WHERE id = ? AND user_id = ?').run(visibility, deckId, userId);
  return info.changes > 0;
}

export interface CommunityDeck {
  id: string;
  name: string;
  color: string;
  author: string;
  cardCount: number;
  added: boolean; // the viewer already imported this deck
}

/** The Community catalog: other users' public decks (hidden while empty — nothing to copy yet). */
export function listPublicDecks(userId: string): CommunityDeck[] {
  const rows = db
    .prepare(
      `SELECT d.id, d.name, d.color, u.username AS author,
              (SELECT COUNT(*) FROM cards WHERE deck_id = d.id) AS cardCount,
              EXISTS (SELECT 1 FROM decks WHERE user_id = ? AND forked_from = d.id) AS added
       FROM decks d JOIN users u ON u.id = d.user_id
       WHERE d.visibility = 'public' AND d.user_id != ?
         AND EXISTS (SELECT 1 FROM cards WHERE deck_id = d.id)
       ORDER BY u.username, d.pos`,
    )
    .all(userId, userId) as (Omit<CommunityDeck, 'added'> & { added: number })[];
  return rows.map((r) => ({ ...r, added: !!r.added }));
}

export interface CommunityCardPreview {
  front: string;
  back: string;
  example: string | null;
  type: CardType;
}
export interface CommunityDeckDetail {
  id: string;
  name: string;
  color: string;
  author: string;
  cards: CommunityCardPreview[];
}

/** Read-only preview of a public deck: content only — never scheduling state. */
export function getPublicDeckCards(deckId: string): CommunityDeckDetail | null {
  const deck = db
    .prepare(
      `SELECT d.id, d.name, d.color, u.username AS author
       FROM decks d JOIN users u ON u.id = d.user_id
       WHERE d.id = ? AND d.visibility = 'public'`,
    )
    .get(deckId) as Omit<CommunityDeckDetail, 'cards'> | undefined;
  if (!deck) return null;
  const cards = db.prepare('SELECT front, back, example, type FROM cards WHERE deck_id = ? ORDER BY created_at').all(deckId) as CommunityCardPreview[];
  return { ...deck, cards };
}

// Copy every source card the target deck doesn't have yet, with fresh FSRS state (a copy is a
// new note for *this* user's memory) and source_card_id provenance. Returns the copies.
function copyMissingCards(targetDeckId: string, sourceDeckId: string): WireCard[] {
  const missing = db.prepare(`SELECT o.* ${NEW_FROM_SOURCE} ORDER BY o.created_at`).all(sourceDeckId, targetDeckId) as (CardRow & { id: string })[];
  const now = Date.now();
  const insert = db.prepare(
    'INSERT INTO cards (id, deck_id, front, back, example, type, mnemonic, image, created_at, stability, difficulty, state, step, due, last_review, source_card_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
  );
  const select = db.prepare('SELECT * FROM cards WHERE id = ?');
  return missing.map((c) => {
    const fresh = scheduler.newCard(new Date(now));
    const id = randomUUID();
    insert.run(id, targetDeckId, c.front, c.back, c.example, c.type, c.mnemonic, c.image, now, fresh.stability, fresh.difficulty, fresh.state, fresh.step, fresh.due.getTime(), null, c.id);
    return rowToWire(select.get(id) as CardRow);
  });
}

/** Copy a public deck (content only) into the user's account. Null if it isn't importable. */
export const importDeck = db.transaction((userId: string, sourceDeckId: string): WireDeck | null => {
  const src = db
    .prepare(
      `SELECT d.name, u.username AS author FROM decks d JOIN users u ON u.id = d.user_id
       WHERE d.id = ? AND d.visibility = 'public' AND d.user_id != ?`,
    )
    .get(sourceDeckId, userId) as { name: string; author: string } | undefined;
  if (!src) return null;
  if (db.prepare('SELECT 1 FROM decks WHERE user_id = ? AND forked_from = ?').get(userId, sourceDeckId)) return null; // already imported
  const row = db.prepare('SELECT COUNT(*) AS n FROM decks WHERE user_id = ?').get(userId) as { n: number };
  const color = DECK_COLORS[row.n % DECK_COLORS.length];
  const id = randomUUID();
  db.prepare('INSERT INTO decks (id, user_id, name, color, pos, forked_from) VALUES (?, ?, ?, ?, ?, ?)').run(id, userId, src.name, color, row.n, sourceDeckId);
  const cards = copyMissingCards(id, sourceDeckId);
  return { id, name: src.name, color, visibility: 'private', imported: true, fromUsername: src.author, newAvailable: 0, cards };
});

/** Pull cards added to the source deck since import. Null if the deck isn't an import of a (still) public deck. */
export const pullNewCards = db.transaction((userId: string, deckId: string): WireCard[] | null => {
  const deck = db.prepare('SELECT forked_from FROM decks WHERE id = ? AND user_id = ?').get(deckId, userId) as { forked_from: string | null } | undefined;
  if (!deck?.forked_from) return null;
  if (!db.prepare("SELECT 1 FROM decks WHERE id = ? AND visibility = 'public'").get(deck.forked_from)) return null;
  return copyMissingCards(deckId, deck.forked_from);
});

/** Run FSRS for a grade, persist the new memory state, log the review, award XP. */
export const answerCard = db.transaction((userId: string, cardId: string, rating: Rating): { card: WireCard; user: PublicUser } | null => {
  const row = db
    .prepare('SELECT c.* FROM cards c JOIN decks d ON d.id = c.deck_id WHERE c.id = ? AND d.user_id = ?')
    .get(cardId, userId) as CardRow | undefined;
  if (!row) return null;

  const now = new Date();
  const updated = scheduler.answer(toCard(row), rating, now);

  db.prepare('UPDATE cards SET stability = ?, difficulty = ?, state = ?, step = ?, due = ?, last_review = ? WHERE id = ?').run(
    updated.stability,
    updated.difficulty,
    updated.state,
    updated.step,
    updated.due.getTime(),
    updated.lastReview ? updated.lastReview.getTime() : null,
    cardId,
  );
  // Snapshot the card's memory state *before* this grade, so maturity-at-review-time is recoverable.
  db.prepare(
    'INSERT INTO review_log (card_id, user_id, rating, reviewed_at, stability_before, state_before) VALUES (?, ?, ?, ?, ?, ?)',
  ).run(cardId, userId, rating, now.getTime(), row.stability, row.state);

  const gained = rating === Rating.Again ? 0 : 8;
  if (gained) db.prepare('UPDATE users SET xp = xp + ? WHERE id = ?').run(gained, userId);

  const card = rowToWire(db.prepare('SELECT * FROM cards WHERE id = ?').get(cardId) as CardRow);
  return { card, user: getUser(userId)! };
});

// ---- stats ----

/** Per-day review counts and added-card counts for the last `days` days (index 0 = oldest). */
export function getHistory(userId: string, days = 21): { reviews: number[]; added: number[] } {
  const now = Date.now();
  const DAY = 86_400_000;
  const startOfToday = now - (now % DAY);
  const reviews = new Array(days).fill(0);
  const added = new Array(days).fill(0);

  const revRows = db
    .prepare('SELECT reviewed_at FROM review_log WHERE user_id = ? AND reviewed_at >= ?')
    .all(userId, startOfToday - (days - 1) * DAY) as { reviewed_at: number }[];
  for (const r of revRows) {
    const idx = days - 1 - Math.floor((startOfToday - (r.reviewed_at - (r.reviewed_at % DAY))) / DAY);
    if (idx >= 0 && idx < days) reviews[idx]++;
  }

  const addRows = db
    .prepare('SELECT c.created_at FROM cards c JOIN decks d ON d.id = c.deck_id WHERE d.user_id = ? AND c.created_at >= ?')
    .all(userId, startOfToday - (days - 1) * DAY) as { created_at: number }[];
  for (const r of addRows) {
    const idx = days - 1 - Math.floor((startOfToday - (r.created_at - (r.created_at % DAY))) / DAY);
    if (idx >= 0 && idx < days) added[idx]++;
  }

  return { reviews, added };
}

/**
 * Rolling True Retention over the last `days` days: of all reviews on cards the user had
 * already seen before, what fraction were recalled (rated better than Again). Each card's
 * first-ever exposure is excluded — that first sight is learning, not a memory test — so this
 * reflects genuine recall, not the normal stumbling when meeting a new word.
 */
export function getRetention(
  userId: string,
  days = 7,
): {
  recalled: number;
  total: number;
  trueRecalled: number;
  trueTotal: number;
  matureRecalled: number;
  matureTotal: number;
} {
  const DAY = 86_400_000;
  const since = Date.now() - days * DAY;
  const rows = db
    .prepare(
      `SELECT rl.card_id AS cid, rl.rating AS rating, rl.reviewed_at AS at, rl.stability_before AS stab, rl.state_before AS state,
              (SELECT MIN(reviewed_at) FROM review_log WHERE card_id = rl.card_id) AS first
       FROM review_log rl
       JOIN cards c ON c.id = rl.card_id
       JOIN decks d ON d.id = c.deck_id
       WHERE d.user_id = ? AND rl.reviewed_at >= ?`,
    )
    .all(userId, since) as { cid: string; rating: number; at: number; stab: number | null; state: number | null; first: number }[];

  // "Grind" = every already-seen review, including same-session relearning repeats. The overload
  // thermometer — computable from history alone (no snapshot needed).
  let recalled = 0;
  let total = 0;
  // For Anki-style True Retention we keep only each card's FIRST review per day.
  const firstOfDay = new Map<string, { rating: number; at: number; stab: number | null; state: number | null }>();
  for (const r of rows) {
    if (r.at <= r.first) continue; // skip first-ever exposure (learning, not recall)
    total++;
    if (r.rating !== 1) recalled++; // rating 1 = Again = a lapse
    if (r.state === null) continue; // pre-snapshot rows can't be classified by maturity
    const key = `${r.cid}|${Math.floor(r.at / DAY)}`;
    const prev = firstOfDay.get(key);
    if (!prev || r.at < prev.at) firstOfDay.set(key, r);
  }

  // True Retention = graduated (Review-state) cards only, first look per day. Mature = the subset
  // with stability >= 21 days. Both need the snapshot, so they fill in going forward.
  let trueRecalled = 0;
  let trueTotal = 0;
  let matureRecalled = 0;
  let matureTotal = 0;
  for (const r of firstOfDay.values()) {
    if (r.state !== 2) continue; // 2 = Review = graduated
    const ok = r.rating !== 1;
    trueTotal++;
    if (ok) trueRecalled++;
    if (r.stab !== null && r.stab >= 21) {
      matureTotal++;
      if (ok) matureRecalled++;
    }
  }
  return { recalled, total, trueRecalled, trueTotal, matureRecalled, matureTotal };
}

/**
 * Today's activity for the daily-goals bars, from the review log:
 *  - reviewDone: reviews today of cards first seen *before* today (i.e. real reviews, not new)
 *  - newDone:    cards whose very first review happened today (new cards learned today)
 */
export function getTodayCounts(userId: string): { reviewDone: number; newDone: number } {
  const now = Date.now();
  const startOfToday = now - (now % 86_400_000);

  const reviewDone = (
    db
      .prepare(
        `SELECT COUNT(*) AS n FROM review_log rl
         JOIN cards c ON c.id = rl.card_id
         JOIN decks d ON d.id = c.deck_id
         WHERE d.user_id = ? AND rl.reviewed_at >= ?
           AND (SELECT MIN(reviewed_at) FROM review_log WHERE card_id = rl.card_id) < ?`,
      )
      .get(userId, startOfToday, startOfToday) as { n: number }
  ).n;

  const newDone = (
    db
      .prepare(
        `SELECT COUNT(*) AS n FROM (
           SELECT rl.card_id, MIN(rl.reviewed_at) AS first
           FROM review_log rl
           JOIN cards c ON c.id = rl.card_id
           JOIN decks d ON d.id = c.deck_id
           WHERE d.user_id = ?
           GROUP BY rl.card_id
           HAVING first >= ?
         )`,
      )
      .get(userId, startOfToday) as { n: number }
  ).n;

  return { reviewDone, newDone };
}

/**
 * Mature-card count per day (oldest first), reconstructed losslessly from the review log.
 *
 * A card's memory state only changes at reviews, and each log row snapshots the state going
 * *into* its grade — so the state a review *set* is the next row's `*_before` (or the card's
 * current row, for its latest review). Chaining those gives every card's exact maturity
 * timeline; "mature" matches `selectors.maturity`: state = Review AND stability ≥ 21.
 * Pre-snapshot rows (null `*_before`) are unknowable and skipped — the series is accurate
 * from `firstEventAt` onward and its last point always equals the live mature count.
 */
export function getMatureHistory(userId: string, days = 365): { counts: number[]; firstEventAt: number | null } {
  const DAY = 86_400_000;
  const stmt = db.prepare(
    `SELECT rl.card_id AS cid, rl.reviewed_at AS at, rl.stability_before AS sb, rl.state_before AS st,
            c.stability AS curS, c.state AS curSt
     FROM review_log rl
     JOIN cards c ON c.id = rl.card_id
     JOIN decks d ON d.id = c.deck_id
     WHERE d.user_id = ?
     ORDER BY rl.card_id, rl.reviewed_at, rl.id`,
  );
  interface Row { cid: string; at: number; sb: number | null; st: number | null; curS: number | null; curSt: number }

  // One streaming pass: chain each card's reviews into maturity flip events (+1 / -1).
  const events: { at: number; delta: 1 | -1 }[] = [];
  let group: Row[] = [];
  const flush = () => {
    let mature = false; // every card starts immature
    for (let k = 0; k < group.length; k++) {
      const afterS = k + 1 < group.length ? group[k + 1].sb : group[k].curS;
      const afterSt = k + 1 < group.length ? group[k + 1].st : group[k].curSt;
      if (afterS === null || afterSt === null) continue; // pre-snapshot gap: unknowable step
      const isMature = afterSt === 2 && afterS >= 21;
      if (isMature !== mature) events.push({ at: group[k].at, delta: isMature ? 1 : -1 });
      mature = isMature;
    }
    group = [];
  };
  for (const r of stmt.iterate(userId) as IterableIterator<Row>) {
    if (group.length > 0 && group[0].cid !== r.cid) flush();
    group.push(r);
  }
  flush();
  events.sort((a, b) => a.at - b.at);

  // Sweep day boundaries sampling a running count. Events before the window fold into the
  // first sample (e starts at 0) — do NOT pre-filter events to the window, or the baseline breaks.
  const now = Date.now();
  const startOfToday = now - (now % DAY);
  const counts = new Array(days).fill(0);
  let n = 0;
  let e = 0;
  for (let d = 0; d < days; d++) {
    const dayEnd = startOfToday - (days - 1 - d) * DAY + DAY;
    while (e < events.length && events[e].at < dayEnd) n += events[e++].delta;
    counts[d] = n;
  }
  return { counts, firstEventAt: events.length ? events[0].at : null };
}

export interface HardestCard {
  id: string;
  front: string;
  type: CardType;
  deck: string;
  again: number;
  total: number;
  difficulty: number | null;
}

/** Cards the user misses most — most "Again" presses, worst rate first. */
export function getHardest(userId: string, limit = 10): HardestCard[] {
  return db
    .prepare(
      `SELECT c.id, c.front, c.type, d.name AS deck, ROUND(c.difficulty, 1) AS difficulty,
        SUM(CASE WHEN rl.rating = 1 THEN 1 ELSE 0 END) AS again,
        COUNT(*) AS total
       FROM review_log rl
       JOIN cards c ON c.id = rl.card_id
       JOIN decks d ON d.id = c.deck_id
       WHERE d.user_id = ?
       GROUP BY rl.card_id
       HAVING again >= 1 AND total >= 3
       ORDER BY (CAST(again AS REAL) / total) DESC, again DESC
       LIMIT ?`,
    )
    .all(userId, limit) as HardestCard[];
}

export function getLeaderboard(): { username: string; xp: number }[] {
  return db.prepare('SELECT username, xp FROM users ORDER BY xp DESC').all() as { username: string; xp: number }[];
}
