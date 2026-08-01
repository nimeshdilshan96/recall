import { randomUUID } from 'node:crypto';
import { db } from './db.ts';
import { RecallScheduler, Rating, type Card } from '../src/fsrs/recall-scheduler.ts';
import { seedDecks } from '../src/data/seed.ts';
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
export interface WireDeck {
  id: string;
  name: string;
  color: string;
  cards: WireCard[];
}
export interface PublicUser {
  id: string;
  username: string;
  xp: number;
  gems: number;
  newLimit: number;
  studyDirection: StudyDirection;
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

const USER_COLS = 'id, username, xp, gems, new_limit AS newLimit, study_direction AS studyDirection';

export function getUserByUsername(username: string): (PublicUser & { password_hash: string }) | undefined {
  return db.prepare(`SELECT ${USER_COLS}, password_hash FROM users WHERE username = ?`).get(username) as any;
}

export function getUser(id: string): PublicUser | undefined {
  return db.prepare(`SELECT ${USER_COLS} FROM users WHERE id = ?`).get(id) as any;
}

/** Update a user's study settings. Returns the updated public user. */
export function updateSettings(userId: string, opts: { newLimit?: number; studyDirection?: StudyDirection }): PublicUser | undefined {
  if (typeof opts.newLimit === 'number') {
    const n = Math.max(0, Math.min(999, Math.round(opts.newLimit)));
    db.prepare('UPDATE users SET new_limit = ? WHERE id = ?').run(n, userId);
  }
  if (opts.studyDirection && ['front', 'back', 'both'].includes(opts.studyDirection)) {
    db.prepare('UPDATE users SET study_direction = ? WHERE id = ?').run(opts.studyDirection, userId);
  }
  return getUser(userId);
}

/** Create a user and seed their starter decks (the four demo decks) in one transaction. */
export const createUser = db.transaction((username: string, password: string): PublicUser => {
  const id = randomUUID();
  const now = Date.now();
  db.prepare('INSERT INTO users (id, username, password_hash, xp, gems, created_at) VALUES (?, ?, ?, ?, ?, ?)').run(id, username, hashPassword(password), 0, 500, now);

  const insertDeck = db.prepare('INSERT INTO decks (id, user_id, name, color, pos) VALUES (?, ?, ?, ?, ?)');
  const insertCard = db.prepare(
    'INSERT INTO cards (id, deck_id, front, back, created_at, stability, difficulty, state, step, due, last_review) VALUES (@id, @deck_id, @front, @back, @created_at, @stability, @difficulty, @state, @step, @due, @last_review)',
  );
  const insertLog = db.prepare('INSERT INTO review_log (card_id, user_id, rating, reviewed_at) VALUES (?, ?, ?, ?)');

  seedDecks(now).forEach((deck, pos) => {
    const deckId = randomUUID();
    insertDeck.run(deckId, id, deck.name, deck.color, pos);
    for (const c of deck.cards) {
      const cardId = randomUUID();
      insertCard.run({
        id: cardId,
        deck_id: deckId,
        front: c.front,
        back: c.back,
        created_at: c.createdAt.getTime(),
        stability: c.fsrs.stability,
        difficulty: c.fsrs.difficulty,
        state: c.fsrs.state,
        step: c.fsrs.step,
        due: c.fsrs.due.getTime(),
        last_review: c.fsrs.lastReview ? c.fsrs.lastReview.getTime() : null,
      });
      // Backfill a past review-log entry so seeded "reviewed" cards have real history
      // (otherwise their first *logged* review would be today, mis-counting them as new).
      if (c.fsrs.lastReview) insertLog.run(cardId, id, 3, c.fsrs.lastReview.getTime());
    }
  });

  return { id, username, xp: 0, gems: 500, newLimit: 20, studyDirection: 'front' };
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
  return { id, name, color, cards: [] };
}

export function getDecks(userId: string): WireDeck[] {
  const decks = db.prepare('SELECT id, name, color FROM decks WHERE user_id = ? ORDER BY pos').all(userId) as { id: string; name: string; color: string }[];
  const cardsStmt = db.prepare('SELECT * FROM cards WHERE deck_id = ? ORDER BY created_at');
  return decks.map((d) => ({ ...d, cards: (cardsStmt.all(d.id) as CardRow[]).map(rowToWire) }));
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
