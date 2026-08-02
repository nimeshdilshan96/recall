import type { Card } from '../fsrs/recall-scheduler.ts';

/** A Recall card = note content (front/back) + its FSRS memory state. */
export type CardType = 'basic' | 'cloze';

export interface RecallCard {
  id: string;
  front: string;
  back: string;
  example?: string | null;
  type: CardType;
  mnemonic?: string | null;
  image?: string | null;
  fsrs: Card;
  /** When this card's note was created (for the "Added" stats graph). */
  createdAt: Date;
}

export interface Deck {
  id: string;
  name: string;
  color: string;
  cards: RecallCard[];
}
