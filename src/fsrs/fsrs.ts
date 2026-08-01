/**
 * FSRS-6 — a faithful TypeScript port of Anki's real scheduler.
 *
 * Anki delegates card scheduling to the `fsrs-rs` crate (github.com/open-spaced-repetition/fsrs-rs).
 * The math and control flow here mirror the reference implementation in `py-fsrs`
 * (github.com/open-spaced-repetition/py-fsrs, `fsrs/scheduler.py`), which is the same
 * FSRS-6 algorithm Anki ships. Formula weights, clamps, learning-step state machine and
 * fuzzing all match the source 1:1 so results are identical (validated in fsrs.test.ts).
 *
 * This replaces the SM-2 approximation used in the Recall prototype. See recall-scheduler.ts
 * for the thin wrapper the Recall UI consumes.
 */

// ---- Ratings & states ----------------------------------------------------

/** The four grade buttons. Again=1, Hard=2, Good=3, Easy=4. */
export const Rating = { Again: 1, Hard: 2, Good: 3, Easy: 4 } as const;
export type Rating = (typeof Rating)[keyof typeof Rating];

/** Card lifecycle state. */
export const State = { Learning: 1, Review: 2, Relearning: 3 } as const;
export type State = (typeof State)[keyof typeof State];

// ---- Card model ----------------------------------------------------------

export interface Card {
  /** Memory stability in days (interval at which retrievability = desiredRetention). null until first review. */
  stability: number | null;
  /** Difficulty in [1, 10]. null until first review. */
  difficulty: number | null;
  state: State;
  /** Index into learning/relearning steps; null while in the Review state. */
  step: number | null;
  /** When the card next becomes due. */
  due: Date;
  /** Timestamp of the previous review; null for a card that has never been reviewed. */
  lastReview: Date | null;
}

export interface ReviewLog {
  rating: Rating;
  reviewDateTime: Date;
  reviewDurationMs: number | null;
}

/** A fresh, never-reviewed card, due immediately. */
export function createEmptyCard(now: Date = new Date()): Card {
  return {
    stability: null,
    difficulty: null,
    state: State.Learning,
    step: 0,
    due: new Date(now.getTime()),
    lastReview: null,
  };
}

// ---- Constants (from py-fsrs scheduler.py) -------------------------------

export const FSRS_DEFAULT_DECAY = 0.1542;

/** FSRS-6 default weights w[0..20]. */
export const DEFAULT_PARAMETERS: readonly number[] = [
  0.212, 1.2931, 2.3065, 8.2956, 6.4133, 0.8334, 3.0194, 0.001, 1.8722, 0.1666,
  0.796, 1.4835, 0.0614, 0.2629, 1.6483, 0.6014, 1.8729, 0.5425, 0.0912, 0.0658,
  FSRS_DEFAULT_DECAY,
];

const STABILITY_MIN = 0.001;
const MIN_DIFFICULTY = 1.0;
const MAX_DIFFICULTY = 10.0;

const MS_PER_DAY = 86_400_000;
const MS_PER_MINUTE = 60_000;

const FUZZ_RANGES = [
  { start: 2.5, end: 7.0, factor: 0.15 },
  { start: 7.0, end: 20.0, factor: 0.1 },
  { start: 20.0, end: Infinity, factor: 0.05 },
];

// ---- Config --------------------------------------------------------------

export interface SchedulerOptions {
  /** 21 FSRS weights. Defaults to the FSRS-6 defaults; replace with values from Anki's optimizer. */
  parameters?: readonly number[];
  /** Target probability of recall at review time. Anki default 0.9. */
  desiredRetention?: number;
  /** Learning-state steps in MINUTES. Anki default [1, 10]. */
  learningSteps?: number[];
  /** Relearning-state steps in MINUTES. Anki default [10]. */
  relearningSteps?: number[];
  /** Cap on the Review-state interval, in days. Anki default 36500 (~100y). */
  maximumInterval?: number;
  /** Add ±fuzz to Review intervals so cards don't all clump on the same day. */
  enableFuzzing?: boolean;
  /** Injectable RNG in [0, 1) for deterministic fuzzing in tests. Defaults to Math.random. */
  rng?: () => number;
}

export class Scheduler {
  readonly parameters: readonly number[];
  readonly desiredRetention: number;
  /** Steps stored internally in milliseconds. */
  readonly learningSteps: number[];
  readonly relearningSteps: number[];
  readonly maximumInterval: number;
  readonly enableFuzzing: boolean;
  private readonly rng: () => number;
  private readonly DECAY: number;
  private readonly FACTOR: number;

  constructor(opts: SchedulerOptions = {}) {
    this.parameters = opts.parameters ?? DEFAULT_PARAMETERS;
    if (this.parameters.length !== 21) {
      throw new Error(`Expected 21 parameters, got ${this.parameters.length}.`);
    }
    this.desiredRetention = opts.desiredRetention ?? 0.9;
    this.learningSteps = (opts.learningSteps ?? [1, 10]).map((m) => m * MS_PER_MINUTE);
    this.relearningSteps = (opts.relearningSteps ?? [10]).map((m) => m * MS_PER_MINUTE);
    this.maximumInterval = opts.maximumInterval ?? 36500;
    this.enableFuzzing = opts.enableFuzzing ?? true;
    this.rng = opts.rng ?? Math.random;

    this.DECAY = -this.parameters[20];
    this.FACTOR = Math.pow(0.9, 1 / this.DECAY) - 1;
  }

  // ---- public API --------------------------------------------------------

  /**
   * Predicted probability the card is recalled right now (or at `at`).
   * Returns 0 for a card that has never been reviewed.
   */
  getCardRetrievability(card: Card, at: Date = new Date()): number {
    if (card.lastReview === null || card.stability === null) return 0;
    const elapsedDays = Math.max(0, Math.floor((at.getTime() - card.lastReview.getTime()) / MS_PER_DAY));
    return Math.pow(1 + this.FACTOR * elapsedDays / card.stability, this.DECAY);
  }

  /**
   * Apply a rating to a card. Returns a new (copied) card and a review log entry;
   * the input card is not mutated.
   */
  reviewCard(
    card: Card,
    rating: Rating,
    reviewDateTime: Date = new Date(),
    reviewDurationMs: number | null = null,
  ): { card: Card; log: ReviewLog } {
    const c: Card = { ...card, due: new Date(card.due.getTime()) };

    const daysSinceLastReview =
      c.lastReview !== null
        ? Math.floor((reviewDateTime.getTime() - c.lastReview.getTime()) / MS_PER_DAY)
        : null;

    let nextIntervalMs = 0;

    if (c.state === State.Learning) {
      // stability / difficulty
      if (c.stability === null || c.difficulty === null) {
        c.stability = this.initialStability(rating);
        c.difficulty = this.initialDifficulty(rating, true);
      } else if (daysSinceLastReview !== null && daysSinceLastReview < 1) {
        c.stability = this.shortTermStability(c.stability, rating);
        c.difficulty = this.nextDifficulty(c.difficulty, rating);
      } else {
        c.stability = this.nextStability(c.difficulty, c.stability, this.getCardRetrievability(c, reviewDateTime), rating);
        c.difficulty = this.nextDifficulty(c.difficulty, rating);
      }

      // interval / step transitions
      if (this.learningSteps.length === 0 || (c.step! >= this.learningSteps.length && rating !== Rating.Again)) {
        c.state = State.Review;
        c.step = null;
        nextIntervalMs = this.nextIntervalDays(c.stability) * MS_PER_DAY;
      } else {
        nextIntervalMs = this.advanceThroughSteps(c, rating, this.learningSteps);
      }
    } else if (c.state === State.Review) {
      if (daysSinceLastReview !== null && daysSinceLastReview < 1) {
        c.stability = this.shortTermStability(c.stability!, rating);
      } else {
        c.stability = this.nextStability(c.difficulty!, c.stability!, this.getCardRetrievability(c, reviewDateTime), rating);
      }
      c.difficulty = this.nextDifficulty(c.difficulty!, rating);

      if (rating === Rating.Again) {
        if (this.relearningSteps.length === 0) {
          nextIntervalMs = this.nextIntervalDays(c.stability) * MS_PER_DAY;
        } else {
          c.state = State.Relearning;
          c.step = 0;
          nextIntervalMs = this.relearningSteps[0];
        }
      } else {
        nextIntervalMs = this.nextIntervalDays(c.stability) * MS_PER_DAY;
      }
    } else {
      // Relearning
      if (daysSinceLastReview !== null && daysSinceLastReview < 1) {
        c.stability = this.shortTermStability(c.stability!, rating);
        c.difficulty = this.nextDifficulty(c.difficulty!, rating);
      } else {
        c.stability = this.nextStability(c.difficulty!, c.stability!, this.getCardRetrievability(c, reviewDateTime), rating);
        c.difficulty = this.nextDifficulty(c.difficulty!, rating);
      }

      if (this.relearningSteps.length === 0 || (c.step! >= this.relearningSteps.length && rating !== Rating.Again)) {
        c.state = State.Review;
        c.step = null;
        nextIntervalMs = this.nextIntervalDays(c.stability) * MS_PER_DAY;
      } else {
        nextIntervalMs = this.advanceThroughSteps(c, rating, this.relearningSteps);
      }
    }

    if (this.enableFuzzing && c.state === State.Review) {
      const days = Math.round(nextIntervalMs / MS_PER_DAY);
      nextIntervalMs = this.getFuzzedIntervalDays(days) * MS_PER_DAY;
    }

    c.due = new Date(reviewDateTime.getTime() + nextIntervalMs);
    c.lastReview = new Date(reviewDateTime.getTime());

    return { card: c, log: { rating, reviewDateTime, reviewDurationMs } };
  }

  // ---- step state machine (shared by Learning & Relearning) --------------

  private advanceThroughSteps(c: Card, rating: Rating, steps: number[]): number {
    switch (rating) {
      case Rating.Again:
        c.step = 0;
        return steps[0];
      case Rating.Hard:
        if (c.step === 0 && steps.length === 1) return steps[0] * 1.5;
        if (c.step === 0 && steps.length >= 2) return (steps[0] + steps[1]) / 2;
        return steps[c.step!];
      case Rating.Good:
        if (c.step! + 1 === steps.length) {
          c.state = State.Review;
          c.step = null;
          return this.nextIntervalDays(c.stability!) * MS_PER_DAY;
        }
        c.step = c.step! + 1;
        return steps[c.step];
      case Rating.Easy:
        c.state = State.Review;
        c.step = null;
        return this.nextIntervalDays(c.stability!) * MS_PER_DAY;
    }
  }

  // ---- FSRS-6 formulas ---------------------------------------------------

  private clampStability(s: number): number {
    return Math.max(s, STABILITY_MIN);
  }
  private clampDifficulty(d: number): number {
    return Math.min(Math.max(d, MIN_DIFFICULTY), MAX_DIFFICULTY);
  }

  private initialStability(rating: Rating): number {
    return this.clampStability(this.parameters[rating - 1]);
  }

  private initialDifficulty(rating: Rating, clamp: boolean): number {
    const d = this.parameters[4] - Math.exp(this.parameters[5] * (rating - 1)) + 1;
    return clamp ? this.clampDifficulty(d) : d;
  }

  /** Interval in whole days for a given stability, from the target retention. */
  nextIntervalDays(stability: number): number {
    const ivl = (stability / this.FACTOR) * (Math.pow(this.desiredRetention, 1 / this.DECAY) - 1);
    return Math.min(Math.max(Math.round(ivl), 1), this.maximumInterval);
  }

  private shortTermStability(stability: number, rating: Rating): number {
    let inc = Math.exp(this.parameters[17] * (rating - 3 + this.parameters[18])) * Math.pow(stability, -this.parameters[19]);
    if (rating === Rating.Good || rating === Rating.Easy) inc = Math.max(inc, 1.0);
    return this.clampStability(stability * inc);
  }

  private nextDifficulty(difficulty: number, rating: Rating): number {
    const linearDamping = (deltaD: number, d: number) => ((10.0 - d) * deltaD) / 9.0;
    const meanReversion = (a: number, b: number) => this.parameters[7] * a + (1 - this.parameters[7]) * b;

    const arg1 = this.initialDifficulty(Rating.Easy, false);
    const deltaD = -(this.parameters[6] * (rating - 3));
    const arg2 = difficulty + linearDamping(deltaD, difficulty);
    return this.clampDifficulty(meanReversion(arg1, arg2));
  }

  private nextStability(difficulty: number, stability: number, retrievability: number, rating: Rating): number {
    const s =
      rating === Rating.Again
        ? this.nextForgetStability(difficulty, stability, retrievability)
        : this.nextRecallStability(difficulty, stability, retrievability, rating);
    return this.clampStability(s);
  }

  private nextForgetStability(difficulty: number, stability: number, retrievability: number): number {
    const longTerm =
      this.parameters[11] *
      Math.pow(difficulty, -this.parameters[12]) *
      (Math.pow(stability + 1, this.parameters[13]) - 1) *
      Math.exp((1 - retrievability) * this.parameters[14]);
    const shortTerm = stability / Math.exp(this.parameters[17] * this.parameters[18]);
    return Math.min(longTerm, shortTerm);
  }

  private nextRecallStability(difficulty: number, stability: number, retrievability: number, rating: Rating): number {
    const hardPenalty = rating === Rating.Hard ? this.parameters[15] : 1;
    const easyBonus = rating === Rating.Easy ? this.parameters[16] : 1;
    return (
      stability *
      (1 +
        Math.exp(this.parameters[8]) *
          (11 - difficulty) *
          Math.pow(stability, -this.parameters[9]) *
          (Math.exp((1 - retrievability) * this.parameters[10]) - 1) *
          hardPenalty *
          easyBonus)
    );
  }

  // ---- fuzzing -----------------------------------------------------------

  private getFuzzedIntervalDays(intervalDays: number): number {
    if (intervalDays < 2.5) return intervalDays;

    let delta = 1.0;
    for (const r of FUZZ_RANGES) {
      delta += r.factor * Math.max(Math.min(intervalDays, r.end) - r.start, 0.0);
    }

    let minIvl = Math.round(intervalDays - delta);
    let maxIvl = Math.round(intervalDays + delta);
    minIvl = Math.max(2, minIvl);
    maxIvl = Math.min(maxIvl, this.maximumInterval);
    minIvl = Math.min(minIvl, maxIvl);

    const fuzzed = this.rng() * (maxIvl - minIvl + 1) + minIvl;
    return Math.min(Math.round(fuzzed), this.maximumInterval);
  }
}
