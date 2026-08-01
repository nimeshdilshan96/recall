# FSRS-6 scheduler for Recall

A faithful TypeScript port of **Anki's real spaced-repetition algorithm** — FSRS-6 — to
replace the SM-2 approximation in the Recall prototype.

## Source

Anki delegates scheduling to the [`fsrs-rs`](https://github.com/open-spaced-repetition/fsrs-rs)
crate. The math and control flow here mirror the reference implementation in
[`py-fsrs`](https://github.com/open-spaced-repetition/py-fsrs) (`fsrs/scheduler.py`), which is
the same FSRS-6 algorithm Anki ships. Weights, clamps, the learning-step state machine and
interval fuzzing all match the source 1:1.

`fsrs.test.ts` reproduces py-fsrs's own test vectors (`tests/test_basic.py`) — interval
history `[0, 2, 11, 46, 163, 498, 0, 0, 2, 4, 7, 12, 21]`, and final memory state
`stability ≈ 53.62691`, `difficulty ≈ 6.3574867` — and passes exactly.

```
node src/fsrs/fsrs.test.ts
```

## Files

- `fsrs.ts` — core FSRS-6 scheduler (`Scheduler`, `Card`, `Rating`, `State`). Dependency-free.
- `recall-scheduler.ts` — thin wrapper exposing what the study UI needs.
- `fsrs.test.ts` — validation against py-fsrs vectors.

## The algorithm (FSRS-6)

Each card carries two latent memory variables instead of SM-2's ease/interval:

- **Stability `S`** — days until recall probability decays to the target retention.
- **Difficulty `D`** — intrinsic hardness, in `[1, 10]`.

Retrievability decays as a power curve `R(t) = (1 + FACTOR · t/S)^DECAY`, with
`DECAY = -w₂₀` and `FACTOR = 0.9^(1/DECAY) − 1`, so `R(S) = 0.9`. The next interval solves
`R(t) = desiredRetention`. On each grade, `S` and `D` update via the FSRS-6 recall/forget
formulas (weights `w₀..w₂₀`, defaults from the optimizer). Same-day reviews use the
short-term stability formula; Again on a Review card drops it into Relearning.

## Using it in Recall

```ts
import { RecallScheduler, Rating, type Card } from './fsrs/recall-scheduler.ts';

const scheduler = new RecallScheduler(); // FSRS-6 defaults, retention 0.9

const card: Card = scheduler.newCard();          // replaces { reps:0, interval:0, ease:2.5 }
const labels = scheduler.gradeButtons(card);     // { again:'1m', hard:'6m', good:'10m', easy:'8d' }
const graded = scheduler.answer(card, Rating.Good); // replaces grade('good')
const queue = scheduler.buildQueue(deck.cards);  // due-first, then ≤20 new
```

### Replacing the prototype's model

| Prototype (SM-2) | FSRS-6 |
| --- | --- |
| `reps`, `interval`, `ease`, `lapses`, `due` (day counter) | `stability`, `difficulty`, `state`, `step`, `due: Date`, `lastReview: Date` |
| `grade(kind)` requeues Again in-session | `answer()` reschedules; Again → Relearning step (due in ~10m) |
| button previews with mismatched Easy formula | `gradeButtons()` — deterministic, always matches what `answer()` applies |
| `today` integer day counter | real `Date` timestamps (FSRS needs elapsed time) |

The prototype's Easy-preview bug (preview used the old ease, grading used the bumped ease)
does not exist here: previews call the same `reviewCard` math with fuzzing disabled.

## Tuning

- `desiredRetention` (default `0.9`) — higher = shorter intervals, more reviews.
- `parameters` — the 21 FSRS weights. Defaults are the general-population optimum; Anki
  re-optimizes these per-user from review history. Feed optimized weights here when available.
- `learningSteps` / `relearningSteps` — minutes; Anki defaults `[1, 10]` / `[10]`.
- `enableFuzzing` — spreads due dates so reviews don't clump (on by default; off for previews).
