/**
 * Validates the FSRS-6 port against py-fsrs's own test vectors
 * (tests/test_basic.py). Run: `node src/fsrs/fsrs.test.ts`
 */
import { Scheduler, createEmptyCard, Rating } from './fsrs.ts';

let failures = 0;
function check(name: string, cond: boolean, detail = '') {
  if (cond) {
    console.log(`  ok   ${name}`);
  } else {
    failures++;
    console.log(`  FAIL ${name} ${detail}`);
  }
}
function approx(a: number, b: number, eps = 1e-4) {
  return Math.abs(a - b) <= eps;
}

const DAY = 86_400_000;

// --- test_review_card: exact interval history, fuzzing off ---------------
{
  const s = new Scheduler({ enableFuzzing: false });
  const ratings = [
    Rating.Good, Rating.Good, Rating.Good, Rating.Good, Rating.Good, Rating.Good,
    Rating.Again, Rating.Again, Rating.Good, Rating.Good, Rating.Good, Rating.Good, Rating.Good,
  ];
  let card = createEmptyCard(new Date(Date.UTC(2022, 10, 29, 12, 30, 0)));
  let reviewAt = new Date(Date.UTC(2022, 10, 29, 12, 30, 0));
  const ivls: number[] = [];
  for (const r of ratings) {
    const res = s.reviewCard(card, r, reviewAt);
    card = res.card;
    ivls.push(Math.floor((card.due.getTime() - card.lastReview!.getTime()) / DAY));
    reviewAt = card.due;
  }
  const expected = [0, 2, 11, 46, 163, 498, 0, 0, 2, 4, 7, 12, 21];
  check('test_review_card interval history', JSON.stringify(ivls) === JSON.stringify(expected), `got ${JSON.stringify(ivls)}`);
}

// --- test_memo_state: final stability & difficulty -----------------------
{
  const s = new Scheduler();
  const ratings = [Rating.Again, Rating.Good, Rating.Good, Rating.Good, Rating.Good, Rating.Good];
  const ivlHistory = [0, 0, 1, 3, 8, 21];
  let card = createEmptyCard(new Date(Date.UTC(2022, 10, 29, 12, 30, 0)));
  let reviewAt = new Date(Date.UTC(2022, 10, 29, 12, 30, 0)).getTime();
  for (let i = 0; i < ratings.length; i++) {
    reviewAt += ivlHistory[i] * DAY;
    card = s.reviewCard(card, ratings[i], new Date(reviewAt)).card;
  }
  check('test_memo_state stability ≈ 53.62691', approx(card.stability!, 53.62691), `got ${card.stability}`);
  check('test_memo_state difficulty ≈ 6.3574867', approx(card.difficulty!, 6.3574867), `got ${card.difficulty}`);
}

// --- test_repeated_correct_reviews: difficulty floors at 1.0 -------------
{
  const s = new Scheduler();
  let card = createEmptyCard(new Date(Date.UTC(2022, 10, 29, 12, 30, 0)));
  let t = new Date(Date.UTC(2022, 10, 29, 12, 30, 0)).getTime();
  for (let i = 0; i < 10; i++) {
    card = s.reviewCard(card, Rating.Easy, new Date(t + i)).card;
  }
  check('test_repeated_correct_reviews difficulty == 1.0', card.difficulty === 1.0, `got ${card.difficulty}`);
}

// --- retrievability at t=stability equals desired retention (0.9) --------
{
  const s = new Scheduler();
  const base = createEmptyCard(new Date(Date.UTC(2023, 0, 1)));
  const card = s.reviewCard(base, Rating.Good, new Date(Date.UTC(2023, 0, 1))).card;
  // force a known stability and last review, then probe at t = S days
  card.stability = 10;
  card.lastReview = new Date(Date.UTC(2023, 0, 1));
  const r = s.getCardRetrievability(card, new Date(Date.UTC(2023, 0, 1) + 10 * DAY));
  check('retrievability(S,S) ≈ 0.9', approx(r, 0.9, 1e-3), `got ${r}`);
}

console.log(failures === 0 ? '\nALL PASS' : `\n${failures} FAILED`);
process.exit(failures === 0 ? 0 : 1);
