import type { AppState } from './store.tsx';
import { State } from './fsrs/recall-scheduler.ts';
import type { Deck, RecallCard } from './data/types.ts';

/** Consecutive trailing days with >0 reviews. Today not yet studied doesn't reset it. */
export function streakFrom(history: number[]): number {
  let n = 0;
  let start = history.length - 1;
  // If today has no reviews yet, count up to yesterday instead of breaking at 0.
  if (start >= 0 && history[start] === 0) start--;
  for (let i = start; i >= 0; i--) {
    if (history[i] > 0) n++;
    else break;
  }
  return n;
}

export function isNew(card: RecallCard): boolean {
  return card.fsrs.lastReview === null;
}

/** Mirrors RecallScheduler.isDue: Review cards are day-granular (due = any time before local
 *  midnight tonight), sub-day learning steps stay exact. Keep the two in sync. */
export function isDue(card: RecallCard, now = new Date()): boolean {
  if (isNew(card)) return false;
  if (card.fsrs.state === State.Review) {
    const dayEnd = new Date(now);
    dayEnd.setHours(24, 0, 0, 0);
    return card.fsrs.due.getTime() < dayEnd.getTime();
  }
  return card.fsrs.due.getTime() <= now.getTime();
}

export function deckCounts(deck: Deck, now = new Date()) {
  let neu = 0;
  let due = 0;
  for (const c of deck.cards) {
    if (isNew(c)) neu++;
    else if (isDue(c, now)) due++;
  }
  return { neu, due, total: deck.cards.length };
}

export function totals(s: AppState, now = new Date()) {
  let cards = 0;
  let neu = 0;
  let due = 0;
  for (const d of s.decks) {
    cards += d.cards.length;
    for (const c of d.cards) {
      if (isNew(c)) neu++;
      else if (isDue(c, now)) due++;
    }
  }
  return { cards, neu, due, deckCount: s.decks.length };
}

/** Maturity bucket for a card, matching Anki: New / Learning / Young (<21d) / Mature (≥21d). */
export function maturity(card: RecallCard): 'new' | 'learning' | 'young' | 'mature' {
  const f = card.fsrs;
  if (isNew(card)) return 'new';
  if (f.state !== State.Review || (f.stability ?? 0) < 1) return 'learning';
  return (f.stability ?? 0) < 21 ? 'young' : 'mature';
}
