import type { Card, Rating } from './fsrs/recall-scheduler.ts';
import type { Deck, DeckVisibility, RecallCard, CardType } from './data/types.ts';

// Wire format from the server: dates are epoch ms so JSON round-trips cleanly.
export type StudyDirection = 'front' | 'back' | 'both';

export interface HardestCard {
  id: string;
  front: string;
  type: CardType;
  deck: string;
  again: number;
  total: number;
  difficulty: number | null;
}

interface WireCard {
  id: string;
  front: string;
  back: string;
  example: string | null;
  type: CardType;
  mnemonic: string | null;
  image: string | null;
  createdAt: number;
  fsrs: { stability: number | null; difficulty: number | null; state: number; step: number | null; due: number; lastReview: number | null };
}
interface WireDeck {
  id: string;
  name: string;
  color: string;
  visibility: DeckVisibility;
  imported: boolean;
  fromUsername: string | null;
  newAvailable: number;
  cards: WireCard[];
}

export interface CommunityDeck {
  id: string;
  name: string;
  color: string;
  author: string;
  cardCount: number;
  added: boolean;
}
export interface CommunityDeckDetail {
  id: string;
  name: string;
  color: string;
  author: string;
  cards: { front: string; back: string; example: string | null; type: CardType }[];
}
export interface PublicUser {
  id: string;
  username: string;
  xp: number;
  gems: number;
  newLimit: number;
  studyDirection: StudyDirection;
  seenVersion: string | null;
}

export interface Retention {
  recalled: number;
  total: number;
  trueRecalled: number;
  trueTotal: number;
  matureRecalled: number;
  matureTotal: number;
}

function reviveCard(w: WireCard): RecallCard {
  const fsrs: Card = {
    stability: w.fsrs.stability,
    difficulty: w.fsrs.difficulty,
    state: w.fsrs.state as Card['state'],
    step: w.fsrs.step,
    due: new Date(w.fsrs.due),
    lastReview: w.fsrs.lastReview === null ? null : new Date(w.fsrs.lastReview),
  };
  return { id: w.id, front: w.front, back: w.back, example: w.example, type: w.type ?? 'basic', mnemonic: w.mnemonic, image: w.image, createdAt: new Date(w.createdAt), fsrs };
}

function reviveDeck(w: WireDeck): Deck {
  return { id: w.id, name: w.name, color: w.color, visibility: w.visibility, imported: w.imported, fromUsername: w.fromUsername, newAvailable: w.newAvailable, cards: w.cards.map(reviveCard) };
}

async function req<T>(method: string, url: string, body?: unknown): Promise<T> {
  const res = await fetch(url, {
    method,
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
    credentials: 'same-origin',
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((data as { error?: string }).error ?? `Request failed (${res.status})`);
  return data as T;
}

export const api = {
  me: () => req<{ user: PublicUser }>('GET', '/api/me'),
  register: (username: string, password: string) => req<{ user: PublicUser }>('POST', '/api/auth/register', { username, password }),
  login: (username: string, password: string) => req<{ user: PublicUser }>('POST', '/api/auth/login', { username, password }),
  logout: () => req<{ ok: true }>('POST', '/api/auth/logout'),

  decks: async (): Promise<Deck[]> => (await req<{ decks: WireDeck[] }>('GET', '/api/decks')).decks.map(reviveDeck),
  addCard: async (deckId: string, card: { front: string; back: string; example?: string; type?: CardType; mnemonic?: string; image?: string }): Promise<RecallCard> =>
    reviveCard((await req<{ card: WireCard }>('POST', '/api/cards', { deckId, ...card })).card),
  answer: async (cardId: string, rating: Rating): Promise<{ card: RecallCard; user: PublicUser }> => {
    const r = await req<{ card: WireCard; user: PublicUser }>('POST', `/api/cards/${cardId}/answer`, { rating });
    return { card: reviveCard(r.card), user: r.user };
  },

  createDeck: async (name: string): Promise<Deck> => reviveDeck((await req<{ deck: WireDeck }>('POST', '/api/decks', { name })).deck),
  updateSettings: async (opts: { newLimit?: number; studyDirection?: StudyDirection; seenVersion?: string }): Promise<PublicUser> =>
    (await req<{ user: PublicUser }>('PATCH', '/api/settings', opts)).user,
  deleteCard: (cardId: string) => req<{ ok: true }>('DELETE', `/api/cards/${cardId}`),
  deleteDeck: (deckId: string) => req<{ ok: true }>('DELETE', `/api/decks/${deckId}`),

  setDeckVisibility: (deckId: string, visibility: DeckVisibility) => req<{ ok: true }>('PATCH', `/api/decks/${deckId}`, { visibility }),
  community: async (): Promise<CommunityDeck[]> => (await req<{ decks: CommunityDeck[] }>('GET', '/api/community')).decks,
  communityDeck: async (deckId: string): Promise<CommunityDeckDetail> => (await req<{ deck: CommunityDeckDetail }>('GET', `/api/community/${deckId}`)).deck,
  importDeck: async (deckId: string): Promise<Deck> => reviveDeck((await req<{ deck: WireDeck }>('POST', `/api/community/${deckId}/import`)).deck),
  pullNewCards: async (deckId: string): Promise<RecallCard[]> => (await req<{ cards: WireCard[] }>('POST', `/api/decks/${deckId}/pull`)).cards.map(reviveCard),

  today: () => req<{ reviewDone: number; newDone: number }>('GET', '/api/today'),
  retention: (days = 7) => req<Retention>('GET', `/api/retention?days=${days}`),
  hardest: async (): Promise<HardestCard[]> => (await req<{ cards: HardestCard[] }>('GET', '/api/hardest')).cards,
  history: () => req<{ reviews: number[]; added: number[] }>('GET', '/api/history'),
  leaderboard: async (): Promise<{ username: string; xp: number }[]> => (await req<{ rows: { username: string; xp: number }[] }>('GET', '/api/leaderboard')).rows,
};
