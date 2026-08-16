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

export type DeckVisibility = 'private' | 'public';

export interface Deck {
  id: string;
  name: string;
  color: string;
  /** Public decks are listed in the Community catalog for other users to copy. */
  visibility: DeckVisibility;
  /** True if this deck was copied from a public deck (imported decks can't be re-shared). */
  imported: boolean;
  /** Author of the source deck, when this deck was imported and the source still exists. */
  fromUsername: string | null;
  /** Cards added to the (still public) source deck that haven't been pulled into this copy. */
  newAvailable: number;
  cards: RecallCard[];
}
