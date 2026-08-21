/**
 * Recall ⇄ FSRS-6 glue.
 *
 * The Recall prototype (Recall.dc.html) shipped an SM-2 approximation with a
 * `{ reps, interval, due, ease, lapses }` card model and a `grade(kind)` method.
 * This wrapper swaps that for Anki's real FSRS-6 scheduler (see fsrs.ts) while
 * exposing the two things the study UI actually needs:
 *
 *   - gradeButtons(card, now) -> the four interval labels under Again/Hard/Good/Easy
 *   - answer(card, rating, now) -> the updated card after a grade
 *
 * plus small helpers for building the study queue and formatting intervals.
 */
import { Scheduler, createEmptyCard, Rating, State, type Card, type SchedulerOptions } from './fsrs.ts';

export { createEmptyCard, Rating, State, type Card };

/**
 * Anki's "next day starts at" hour: the study day rolls over at 4 AM local, not midnight, so a
 * night owl reviewing at 1 AM is finishing *yesterday's* session — their day-granular cards
 * don't all come back three hours later.
 */
export const DAY_ROLLOVER_HOUR = 4;

/** Start of the (rollover-adjusted) study day containing `t` — i.e. the most recent 4 AM. */
export function studyDayStart(t: Date): Date {
  const d = new Date(t);
  if (d.getHours() < DAY_ROLLOVER_HOUR) d.setDate(d.getDate() - 1);
  d.setHours(DAY_ROLLOVER_HOUR, 0, 0, 0);
  return d;
}

/** End of the study day containing `t` — the next 4 AM, when day-granular cards unlock. */
export function studyDayEnd(t: Date): Date {
  const d = studyDayStart(t);
  d.setDate(d.getDate() + 1);
  return d;
}

export interface GradeButtons {
  again: string;
  hard: string;
  good: string;
  easy: string;
}

/** Format a duration (ms) as an Anki-style short label: 1m, 10m, 5h, 4d, 2mo, 1.4y. */
export function formatInterval(ms: number): string {
  const minutes = ms / 60_000;
  if (minutes < 60) return `${Math.max(1, Math.round(minutes))}m`;
  const hours = minutes / 60;
  if (hours < 24) return `${Math.round(hours)}h`;
  const days = hours / 24;
  if (days < 30) return `${Math.round(days)}d`;
  const months = days / 30;
  if (months < 12) return `${Math.round(months)}mo`;
  return `${(days / 365).toFixed(1)}y`;
}

export class RecallScheduler {
  private readonly scheduler: Scheduler;
  /** Fuzz-free twin used only to compute the deterministic labels shown on buttons. */
  private readonly preview: Scheduler;

  constructor(opts: SchedulerOptions = {}) {
    // App default: a SINGLE learning step, so a new card graduates on the first Good
    // (not just Easy). Two steps would require two Goods to leave the session, which makes
    // the progress bar sit still unless you press Easy. Callers can still override.
    const withDefaults: SchedulerOptions = { learningSteps: [10], ...opts };
    this.scheduler = new Scheduler(withDefaults);
    this.preview = new Scheduler({ ...withDefaults, enableFuzzing: false });
  }

  newCard(now: Date = new Date()): Card {
    return createEmptyCard(now);
  }

  /**
   * A card is due when its `due` timestamp has passed — except graduated (Review-state) cards,
   * which use Anki-style day granularity: anything due within the current study day is available
   * from that day's start, so finishing tonight at 21:00 doesn't push tomorrow's session past
   * 21:00. Sub-day learning/relearning steps keep exact timing (a 10-min step must stay 10 min).
   */
  isDue(card: Card, now: Date = new Date()): boolean {
    if (card.state === State.Review) return card.due.getTime() < studyDayEnd(now).getTime();
    return card.due.getTime() <= now.getTime();
  }

  isNew(card: Card): boolean {
    return card.lastReview === null;
  }

  /**
   * Build a study queue: due review cards first, then up to `newLimit` new cards.
   * Mirrors the prototype's startStudy (due first, then new, cap new at 20).
   */
  buildQueue<T extends { card: Card }>(cards: T[], now: Date = new Date(), newLimit = 20): T[] {
    const due = cards.filter((c) => !this.isNew(c.card) && this.isDue(c.card, now));
    const neu = cards.filter((c) => this.isNew(c.card)).slice(0, newLimit);
    return due.concat(neu);
  }

  /** The interval each grade button would produce, as display labels. */
  gradeButtons(card: Card, now: Date = new Date()): GradeButtons {
    const label = (rating: Rating) => {
      const { card: next } = this.preview.reviewCard(card, rating, now);
      return formatInterval(next.due.getTime() - now.getTime());
    };
    return {
      again: label(Rating.Again),
      hard: label(Rating.Hard),
      good: label(Rating.Good),
      easy: label(Rating.Easy),
    };
  }

  /** Apply a grade. Returns the updated card (input is not mutated). Uses real fuzzing. */
  answer(card: Card, rating: Rating, now: Date = new Date()): Card {
    return this.scheduler.reviewCard(card, rating, now).card;
  }

  retrievability(card: Card, now: Date = new Date()): number {
    return this.scheduler.getCardRetrievability(card, now);
  }
}
