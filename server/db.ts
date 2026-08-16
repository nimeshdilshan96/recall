import Database from 'better-sqlite3';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';

// Single SQLite file. On a Pi put this on a USB SSD (not the SD card) to avoid flash wear;
// on AWS put it on an EBS volume. Litestream replicates it to S3 for backup (see litestream.yml).
const DB_PATH = process.env.RECALL_DB ?? './data/recall.db';

mkdirSync(dirname(DB_PATH), { recursive: true });

export const db: Database.Database = new Database(DB_PATH);

// WAL: better read/write concurrency and durability — ideal for a few concurrent family users.
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id            TEXT PRIMARY KEY,
    username      TEXT NOT NULL UNIQUE COLLATE NOCASE,
    password_hash TEXT NOT NULL,
    xp            INTEGER NOT NULL DEFAULT 0,
    gems          INTEGER NOT NULL DEFAULT 500,
    new_limit     INTEGER NOT NULL DEFAULT 20,
    study_direction TEXT NOT NULL DEFAULT 'front',  -- 'front' | 'back' | 'both'
    seen_version  TEXT,                             -- last "What's new" version dismissed
    created_at    INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS decks (
    id          TEXT PRIMARY KEY,
    user_id     TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name        TEXT NOT NULL,
    color       TEXT NOT NULL,
    pos         INTEGER NOT NULL DEFAULT 0,
    visibility  TEXT NOT NULL DEFAULT 'private', -- 'private' | 'public' (public = listed in Community)
    forked_from TEXT                             -- source deck id if this deck was imported
  );
  CREATE INDEX IF NOT EXISTS idx_decks_user ON decks(user_id);

  CREATE TABLE IF NOT EXISTS cards (
    id          TEXT PRIMARY KEY,
    deck_id     TEXT NOT NULL REFERENCES decks(id) ON DELETE CASCADE,
    front       TEXT NOT NULL,
    back        TEXT NOT NULL,
    example     TEXT,               -- optional example sentence / note, shown on reveal
    type        TEXT NOT NULL DEFAULT 'basic',  -- 'basic' | 'cloze'
    mnemonic    TEXT,               -- optional memory hook, shown with the answer
    image       TEXT,               -- optional image URL, shown with the answer
    created_at  INTEGER NOT NULL,
    -- FSRS memory state (null until first review)
    stability   REAL,
    difficulty  REAL,
    state       INTEGER NOT NULL,   -- 1 Learning, 2 Review, 3 Relearning
    step        INTEGER,
    due         INTEGER NOT NULL,   -- epoch ms
    last_review INTEGER,            -- epoch ms, null if never reviewed
    source_card_id TEXT             -- original card id if copied from a public deck
  );
  CREATE INDEX IF NOT EXISTS idx_cards_deck ON cards(deck_id);

  CREATE TABLE IF NOT EXISTS review_log (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    card_id      TEXT NOT NULL REFERENCES cards(id) ON DELETE CASCADE,
    user_id      TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    rating       INTEGER NOT NULL,  -- 1 Again .. 4 Easy
    reviewed_at  INTEGER NOT NULL   -- epoch ms
  );
  CREATE INDEX IF NOT EXISTS idx_reviewlog_user ON review_log(user_id, reviewed_at);
`);

// Migrations for databases created before these columns existed.
function ensureColumn(table: string, column: string, ddl: string) {
  const cols = db.prepare(`PRAGMA table_info(${table})`).all() as { name: string }[];
  if (!cols.some((c) => c.name === column)) db.exec(`ALTER TABLE ${table} ADD COLUMN ${ddl}`);
}
ensureColumn('cards', 'example', 'example TEXT');
ensureColumn('cards', 'type', "type TEXT NOT NULL DEFAULT 'basic'");
ensureColumn('cards', 'mnemonic', 'mnemonic TEXT');
ensureColumn('cards', 'image', 'image TEXT');
ensureColumn('users', 'new_limit', 'new_limit INTEGER NOT NULL DEFAULT 20');
ensureColumn('users', 'study_direction', "study_direction TEXT NOT NULL DEFAULT 'front'");
// Last "What's new" version the user dismissed (null = never seen one; new users see the current one too).
ensureColumn('users', 'seen_version', 'seen_version TEXT');
// Snapshot the card's memory state as it was *going into* each review, so we can later
// compute the true maturity-at-review-time (e.g. strict mature-only lapse rate). Null for
// rows written before this migration and for a card's first-ever review (no prior state).
ensureColumn('review_log', 'stability_before', 'stability_before REAL');
ensureColumn('review_log', 'state_before', 'state_before INTEGER');
// Public deck sharing: decks can be published to the Community catalog; importing one copies
// its cards (fresh FSRS state). forked_from / source_card_id record provenance so already-
// imported decks can be detected and new cards pulled from the original later.
ensureColumn('decks', 'visibility', "visibility TEXT NOT NULL DEFAULT 'private'");
ensureColumn('decks', 'forked_from', 'forked_from TEXT');
ensureColumn('cards', 'source_card_id', 'source_card_id TEXT');
