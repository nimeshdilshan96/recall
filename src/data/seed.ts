import { createEmptyCard, State } from '../fsrs/recall-scheduler.ts';
import type { Deck, RecallCard } from './types.ts';

const DAY = 86_400_000;
let uid = 0;

/**
 * A card that has already entered the Review state. We construct its FSRS memory
 * state directly (stability/difficulty) and place `due` relative to now — exactly
 * what importing pre-existing cards into FSRS looks like.
 *
 * @param dueInDays  negative or 0 => due now; positive => due in the future.
 */
function reviewed(front: string, back: string, stability: number, difficulty: number, dueInDays: number, now: number): RecallCard {
  const due = now + dueInDays * DAY;
  const card = createEmptyCard(new Date(now));
  card.state = State.Review;
  card.step = null;
  card.stability = stability;
  card.difficulty = difficulty;
  card.due = new Date(due);
  // Last review sits one interval before the due date — but always in the past
  // (a card due far in the future would otherwise land its last review in the future).
  card.lastReview = new Date(Math.min(due - Math.round(stability) * DAY, now - DAY));
  return { id: 'c' + uid++, front, back, type: 'basic', fsrs: card, createdAt: new Date(now - Math.round(stability + 5) * DAY) };
}

/** A brand-new, never-reviewed card. */
function fresh(front: string, back: string, now: number, createdDaysAgo = 1): RecallCard {
  return { id: 'c' + uid++, front, back, type: 'basic', fsrs: createEmptyCard(new Date(now)), createdAt: new Date(now - createdDaysAgo * DAY) };
}

export function seedDecks(now: number = Date.now()): Deck[] {
  return [
    {
      id: 'd0',
      name: 'Japanese — JLPT N5',
      color: 'oklch(0.64 0.14 40)',
      cards: [
        reviewed('水', 'water · mizu', 12, 4.8, -1, now),
        fresh('火', 'fire · hi', now),
        reviewed('食べる', 'to eat · taberu', 4, 5.5, 0, now),
        fresh('大きい', 'big · ōkii', now),
        reviewed('学校', 'school · gakkō', 24, 4.1, -2, now),
        fresh('友達', 'friend · tomodachi', now),
        reviewed('時間', 'time · jikan', 8, 5.0, 5, now),
      ],
    },
    {
      id: 'd1',
      name: 'World Capitals',
      color: 'oklch(0.6 0.11 250)',
      cards: [
        reviewed('Australia', 'Canberra', 30, 3.8, -1, now),
        fresh('Brazil', 'Brasília', now),
        reviewed('Switzerland', 'Bern', 4, 6.0, 0, now),
        fresh('Kazakhstan', 'Astana', now),
        reviewed('Türkiye', 'Ankara', 16, 4.5, 3, now),
        reviewed('Canada', 'Ottawa', 45, 3.2, 12, now),
      ],
    },
    {
      id: 'd2',
      name: 'Anatomy — The Heart',
      color: 'oklch(0.62 0.14 18)',
      cards: [
        reviewed('Largest artery in the body', 'The aorta', 9, 5.1, -1, now),
        fresh("Heart's natural pacemaker", 'Sinoatrial (SA) node', now),
        fresh('Valve between left atrium & ventricle', 'Mitral (bicuspid) valve', now),
        reviewed('Number of chambers', 'Four', 22, 4.0, 4, now),
      ],
    },
    {
      id: 'd3',
      name: 'Spanish — Core Verbs',
      color: 'oklch(0.6 0.11 150)',
      cards: [
        reviewed('to be (permanent)', 'ser', 28, 3.6, -1, now),
        fresh('to have', 'tener', now),
        reviewed('to go', 'ir', 8, 5.0, -1, now),
        reviewed('to want', 'querer', 5, 5.8, 6, now),
      ],
    },
  ];
}

/**
 * Deterministic pseudo review history: counts per day for the last `days` days.
 * Index 0 = oldest, last = today. Used by the stats screen.
 */
export function seedHistory(days = 126): number[] {
  let s = 1337;
  const rnd = () => {
    s = (s * 1103515245 + 12345) & 0x7fffffff;
    return s / 0x7fffffff;
  };
  const out: number[] = [];
  for (let i = 0; i < days; i++) {
    const r = rnd();
    let c = r < 0.22 ? 0 : Math.round(r * r * 95);
    if (i >= days - 16) c = 12 + Math.round(rnd() * 70); // recent active streak
    out.push(c);
  }
  return out;
}
