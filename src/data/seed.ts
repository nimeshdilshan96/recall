import { createEmptyCard } from '../fsrs/recall-scheduler.ts';
import type { Deck, RecallCard } from './types.ts';
let uid = 0;

/** A brand-new starter card. Starter decks never invent a learning history. */
function starter(front: string, back: string, now: number): RecallCard {
  return { id: 'c' + uid++, front, back, type: 'basic', fsrs: createEmptyCard(new Date(now)), createdAt: new Date(now) };
}

export function seedDecks(now: number = Date.now()): Deck[] {
  const decks: Omit<Deck, 'visibility' | 'imported' | 'fromUsername' | 'newAvailable'>[] = [
    {
      id: 'd0',
      name: 'Japanese — JLPT N5',
      color: 'oklch(0.64 0.14 40)',
      cards: [
        starter('水', 'water · mizu', now),
        starter('火', 'fire · hi', now),
        starter('食べる', 'to eat · taberu', now),
        starter('大きい', 'big · ōkii', now),
        starter('学校', 'school · gakkō', now),
        starter('友達', 'friend · tomodachi', now),
        starter('時間', 'time · jikan', now),
      ],
    },
    {
      id: 'd1',
      name: 'World Capitals',
      color: 'oklch(0.6 0.11 250)',
      cards: [
        starter('Australia', 'Canberra', now),
        starter('Brazil', 'Brasília', now),
        starter('Switzerland', 'Bern', now),
        starter('Kazakhstan', 'Astana', now),
        starter('Türkiye', 'Ankara', now),
        starter('Canada', 'Ottawa', now),
      ],
    },
    {
      id: 'd2',
      name: 'Anatomy — The Heart',
      color: 'oklch(0.62 0.14 18)',
      cards: [
        starter('Largest artery in the body', 'The aorta', now),
        starter("Heart's natural pacemaker", 'Sinoatrial (SA) node', now),
        starter('Valve between left atrium & ventricle', 'Mitral (bicuspid) valve', now),
        starter('Number of chambers', 'Four', now),
      ],
    },
    {
      id: 'd3',
      name: 'Spanish — Core Verbs',
      color: 'oklch(0.6 0.11 150)',
      cards: [
        starter('to be (permanent)', 'ser', now),
        starter('to have', 'tener', now),
        starter('to go', 'ir', now),
        starter('to want', 'querer', now),
      ],
    },
  ];
  return decks.map((d) => ({ ...d, visibility: 'private', imported: false, fromUsername: null, newAvailable: 0 }));
}
