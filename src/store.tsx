import { createContext, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { RecallScheduler, Rating, State } from './fsrs/recall-scheduler.ts';
import type { Deck, DeckVisibility, RecallCard, CardType } from './data/types.ts';
import { parseCloze } from './util/answer.ts';
import { pickAccent } from './theme.ts';
import { api, type StudyDirection, type NewOrder, type PublicUser, type HardestCard, type Retention, type CommunityDeck, type CommunityDeckDetail } from './api.ts';
import { CURRENT_VERSION } from './data/changelog.ts';

export type { StudyDirection, NewOrder };
export type { CommunityDeck, CommunityDeckDetail };
export type Screen = 'home' | 'study' | 'add' | 'community' | 'league' | 'stats' | 'browse' | 'settings';
export type AuthMode = 'login' | 'register';

interface CardRef {
  deckId: string;
  cardId: string;
  reversed: boolean; // show the back as the prompt (Back → Front / Both mode)
}
interface SessionStats {
  reviewed: number;
  again: number;
  total: number;
}

export interface AppState {
  accent: string;
  booted: boolean; // finished the initial /api/me check

  authed: boolean;
  authMode: AuthMode;
  authUser: string;
  authPass: string;
  authError: string;
  authBusy: boolean;
  profileName: string;

  screen: Screen;
  decks: Deck[];
  history: number[];
  today: { reviewDone: number; newDone: number };
  retention: Retention;
  retentionWindows: Record<1 | 7 | 30 | 365, Retention>;
  leaderboard: { username: string; xp: number }[];

  studyDeckId: string | null;
  studyLabel: string; // header title for the session (deck name, or "Practice"/"Trouble words")
  practice: boolean; // practice session — grades don't touch the schedule
  queue: CardRef[];
  qIndex: number;
  revealed: boolean;
  typed: string;
  session: SessionStats;

  addDeckId: string;
  addType: CardType;
  addFront: string;
  addBack: string;
  addSentence: string; // cloze
  addExample: string;
  addMnemonic: string;
  addImage: string;
  addedCount: number;
  addBusy: boolean;

  hardest: HardestCard[];
  matureHistory: { counts: number[]; firstEventAt: number | null };

  community: CommunityDeck[];
  communityPreview: CommunityDeckDetail | null;
  communityBusy: boolean; // an import is in flight

  newLimit: number;
  studyDirection: StudyDirection;
  newOrder: NewOrder;

  xp: number;
  gems: number;
  menuOpen: boolean;
  toast: string;
  showWhatsNew: boolean; // the user hasn't dismissed the current CHANGELOG version yet
}

export interface AppActions {
  setAuthUser(v: string): void;
  setAuthPass(v: string): void;
  submitAuth(): void;
  toggleAuthMode(): void;
  logout(): void;

  goto(screen: Screen): void;
  toggleMenu(open?: boolean): void;
  showToast(msg: string): void;
  dismissWhatsNew(): void;

  startStudy(deckId: string): void;
  startPractice(deckId: string): void;
  drillCards(cardIds: string[]): void;
  reveal(): void;
  setTyped(v: string): void;
  grade(rating: Rating): void;

  setAddDeck(id: string): void;
  setAddType(t: CardType): void;
  setAddFront(v: string): void;
  setAddBack(v: string): void;
  setAddSentence(v: string): void;
  setAddExample(v: string): void;
  setAddMnemonic(v: string): void;
  setAddImage(v: string): void;
  addCard(): void;

  loadHardest(): void;

  loadCommunity(): void;
  openCommunityDeck(deckId: string): void;
  closeCommunityPreview(): void;
  importCommunityDeck(deckId: string): void;
  setDeckVisibility(deckId: string, visibility: DeckVisibility): void;
  pullNewCards(deckId: string): void;

  setNewLimit(n: number): void;
  setStudyDirection(d: StudyDirection): void;
  setNewOrder(o: NewOrder): void;

  createDeck(name: string): void;
  updateCard(cardId: string, fields: { front: string; back: string; mnemonic?: string; image?: string }): Promise<boolean>;
  deleteCard(cardId: string): void;
  deleteDeck(deckId: string): void;

  loadStats(): void;
  loadLeaderboard(): void;
  loadToday(): void;
}

interface Store {
  state: AppState;
  actions: AppActions;
  scheduler: RecallScheduler;
  currentCard(): RecallCard | null;
}

/** Whether a card should be shown reversed, given the study-direction setting. */
function dirFor(dir: StudyDirection): boolean {
  return dir === 'back' ? true : dir === 'both' ? Math.random() < 0.5 : false;
}

function shuffle<T>(arr: T[]): T[] {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

const Ctx = createContext<Store | null>(null);

export function useApp(): Store {
  const s = useContext(Ctx);
  if (!s) throw new Error('useApp must be used within <AppProvider>');
  return s;
}

export function AppProvider({ children }: { children: ReactNode }) {
  const schedulerRef = useRef<RecallScheduler>(new RecallScheduler()); // client-side previews + queue building
  const accentRef = useRef<string>(pickAccent());
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [state, setState] = useState<AppState>(() => ({
    accent: accentRef.current,
    booted: false,
    authed: false,
    authMode: 'login',
    authUser: '',
    authPass: '',
    authError: '',
    authBusy: false,
    profileName: 'Learner',
    screen: 'home',
    decks: [],
    history: [],
    today: { reviewDone: 0, newDone: 0 },
    retention: { recalled: 0, total: 0, trueRecalled: 0, trueTotal: 0, matureRecalled: 0, matureTotal: 0 },
    retentionWindows: {
      1: { recalled: 0, total: 0, trueRecalled: 0, trueTotal: 0, matureRecalled: 0, matureTotal: 0 },
      7: { recalled: 0, total: 0, trueRecalled: 0, trueTotal: 0, matureRecalled: 0, matureTotal: 0 },
      30: { recalled: 0, total: 0, trueRecalled: 0, trueTotal: 0, matureRecalled: 0, matureTotal: 0 },
      365: { recalled: 0, total: 0, trueRecalled: 0, trueTotal: 0, matureRecalled: 0, matureTotal: 0 },
    },
    leaderboard: [],
    studyDeckId: null,
    studyLabel: '',
    practice: false,
    queue: [],
    qIndex: 0,
    revealed: false,
    typed: '',
    session: { reviewed: 0, again: 0, total: 0 },
    addDeckId: '',
    addType: 'basic',
    addFront: '',
    addBack: '',
    addSentence: '',
    addExample: '',
    addMnemonic: '',
    addImage: '',
    addedCount: 0,
    addBusy: false,
    hardest: [],
    matureHistory: { counts: [], firstEventAt: null },
    community: [],
    communityPreview: null,
    communityBusy: false,
    newLimit: 20,
    studyDirection: 'front',
    newOrder: 'oldest',
    xp: 0,
    gems: 0,
    menuOpen: false,
    toast: '',
    showWhatsNew: false,
  }));

  // Mirror of state for reads inside async actions (avoids stale closures / side effects in updaters).
  const stateRef = useRef(state);
  stateRef.current = state;

  const patch = (p: Partial<AppState>) => setState((s) => ({ ...s, ...p }));
  const sched = schedulerRef.current;

  const findCard = (s: AppState, ref: CardRef | undefined): RecallCard | null => {
    if (!ref) return null;
    return s.decks.find((d) => d.id === ref.deckId)?.cards.find((c) => c.id === ref.cardId) ?? null;
  };

  // Load a signed-in user's data set (decks + history + leaderboard).
  const loadAll = async (user: PublicUser) => {
    const [decks, hist, leaderboard, today] = await Promise.all([api.decks(), api.history(), api.leaderboard(), api.today()]);
    setState((s) => ({
      ...s,
      authed: true,
      profileName: user.username,
      xp: user.xp,
      gems: user.gems,
      newLimit: user.newLimit,
      studyDirection: user.studyDirection,
      newOrder: user.newOrder,
      showWhatsNew: user.seenVersion !== CURRENT_VERSION,
      decks,
      history: hist.reviews,
      today,
      leaderboard,
      addDeckId: decks[0]?.id ?? '',
      authUser: '',
      authPass: '',
      authError: '',
    }));
  };

  // Initial session check.
  useEffect(() => {
    (async () => {
      try {
        const { user } = await api.me();
        await loadAll(user);
      } catch {
        /* not signed in */
      } finally {
        patch({ booted: true });
      }
    })();
  }, []);

  const showToast = (msg: string) => {
    patch({ toast: msg });
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => patch({ toast: '' }), 1900);
  };

  const actions: AppActions = useMemo(
    () => ({
      setAuthUser: (v) => patch({ authUser: v, authError: '' }),
      setAuthPass: (v) => patch({ authPass: v, authError: '' }),
      toggleAuthMode: () => setState((s) => ({ ...s, authMode: s.authMode === 'login' ? 'register' : 'login', authError: '' })),
      submitAuth: async () => {
        const s = stateRef.current;
        if (s.authBusy) return;
        const u = s.authUser.trim();
        if (!u) return patch({ authError: 'Enter a username' });
        if (s.authPass.length < 4) return patch({ authError: 'Password must be at least 4 characters' });
        const { authMode: mode, authPass: pass } = s;
        patch({ authBusy: true, authError: '' });
        try {
          const { user } = mode === 'login' ? await api.login(u, pass) : await api.register(u, pass);
          await loadAll(user);
          patch({ authBusy: false });
        } catch (e) {
          patch({ authError: (e as Error).message, authBusy: false });
        }
      },
      logout: () => {
        api.logout().catch(() => {});
        patch({ authed: false, menuOpen: false, screen: 'home', decks: [], history: [], leaderboard: [], authUser: '', authPass: '', authError: '', authMode: 'login', authBusy: false });
      },

      goto: (screen) => patch({ screen, menuOpen: false }),
      toggleMenu: (open) => setState((s) => ({ ...s, menuOpen: open ?? !s.menuOpen })),
      showToast,
      dismissWhatsNew: () => {
        patch({ showWhatsNew: false }); // optimistic — worst case it reappears next login
        api.updateSettings({ seenVersion: CURRENT_VERSION }).catch(() => {});
      },

      startStudy: (deckId) => {
        const s = stateRef.current;
        const deck = s.decks.find((d) => d.id === deckId);
        if (!deck) return;
        // buildQueue takes the first `newLimit` unseen cards in array order (cards arrive
        // oldest-first), so reordering the unseen ones here is what picks which get introduced.
        let items = deck.cards.map((c) => ({ card: c.fsrs, id: c.id }));
        if (s.newOrder !== 'oldest') {
          const seen = items.filter((x) => !sched.isNew(x.card));
          const neu = items.filter((x) => sched.isNew(x.card));
          items = seen.concat(s.newOrder === 'newest' ? neu.reverse() : shuffle(neu));
        }
        const refs: CardRef[] = sched
          .buildQueue(items, new Date(), s.newLimit)
          .map((x) => ({ deckId, cardId: x.id, reversed: dirFor(s.studyDirection) }));
        if (refs.length === 0) {
          showToast('No cards due in this deck');
          return;
        }
        patch({ screen: 'study', studyDeckId: deckId, studyLabel: deck.name, practice: false, queue: refs, qIndex: 0, revealed: false, typed: '', session: { reviewed: 0, again: 0, total: 0 } });
      },
      startPractice: (deckId) => {
        const s = stateRef.current;
        const deck = s.decks.find((d) => d.id === deckId);
        if (!deck || deck.cards.length === 0) {
          showToast('This deck is empty');
          return;
        }
        // Practice: every card, ignoring due dates, in a shuffled order.
        const refs: CardRef[] = shuffle(deck.cards.map((c) => ({ deckId, cardId: c.id, reversed: dirFor(s.studyDirection) })));
        patch({ screen: 'study', studyDeckId: deckId, studyLabel: `${deck.name} — Practice`, practice: true, queue: refs, qIndex: 0, revealed: false, typed: '', session: { reviewed: 0, again: 0, total: 0 } });
      },
      drillCards: (cardIds) => {
        const s = stateRef.current;
        const refs: CardRef[] = [];
        for (const id of cardIds) {
          const deck = s.decks.find((d) => d.cards.some((c) => c.id === id));
          if (deck) refs.push({ deckId: deck.id, cardId: id, reversed: dirFor(s.studyDirection) });
        }
        if (refs.length === 0) return;
        patch({ screen: 'study', studyDeckId: null, studyLabel: 'Trouble words', practice: true, queue: shuffle(refs), qIndex: 0, revealed: false, typed: '', session: { reviewed: 0, again: 0, total: 0 } });
      },
      reveal: () => patch({ revealed: true }),
      setTyped: (v) => patch({ typed: v }),
      grade: (rating) => {
        const s = stateRef.current;
        const ref = s.queue[s.qIndex];
        const card = findCard(s, ref);
        if (!card) return;
        const session: SessionStats = {
          reviewed: s.session.reviewed + (rating === Rating.Again ? 0 : 1),
          again: s.session.again + (rating === Rating.Again ? 1 : 0),
          total: s.session.total + 1,
        };

        // Practice: never touch the schedule, review log, or XP. Just decide (locally)
        // whether the card should loop again this session, using a throwaway FSRS calc.
        if (s.practice) {
          const wouldBe = sched.answer(card.fsrs, rating, new Date());
          const requeue = wouldBe.state !== State.Review;
          patch({ qIndex: s.qIndex + 1, revealed: false, typed: '', session, queue: requeue ? [...s.queue, ref] : s.queue });
          return;
        }

        // Real study: advance immediately (optimistic); the graded card lands from the server.
        patch({ qIndex: s.qIndex + 1, revealed: false, typed: '', session });
        (async () => {
          try {
            const { card: updated, user } = await api.answer(card.id, rating);
            setState((s2) => {
              const decks = s2.decks.map((d) =>
                d.id === ref.deckId ? { ...d, cards: d.cards.map((c) => (c.id === ref.cardId ? updated : c)) } : d,
              );
              const requeue = updated.fsrs.state !== State.Review;
              return { ...s2, decks, xp: user.xp, queue: requeue ? [...s2.queue, ref] : s2.queue };
            });
          } catch (e) {
            showToast((e as Error).message);
          }
        })();
      },

      setAddDeck: (id) => patch({ addDeckId: id }),
      setAddType: (t) => patch({ addType: t }),
      setAddFront: (v) => patch({ addFront: v }),
      setAddBack: (v) => patch({ addBack: v }),
      setAddSentence: (v) => patch({ addSentence: v }),
      setAddExample: (v) => patch({ addExample: v }),
      setAddMnemonic: (v) => patch({ addMnemonic: v }),
      setAddImage: (v) => patch({ addImage: v }),
      addCard: async () => {
        const s = stateRef.current;
        if (s.addBusy) return;
        // Build front/back from the card type.
        let front: string, back: string;
        if (s.addType === 'cloze') {
          const sentence = s.addSentence.trim();
          if (!sentence) return;
          const parsed = parseCloze(sentence);
          front = parsed.front;
          back = parsed.back;
          if (!back) return;
        } else {
          front = s.addFront.trim();
          back = s.addBack.trim();
          if (!front || !back) return;
        }
        const deckId = s.addDeckId;
        const deckName = s.decks.find((d) => d.id === deckId)?.name ?? 'deck';
        patch({ addBusy: true });
        try {
          const card = await api.addCard(deckId, {
            front,
            back,
            type: s.addType,
            example: s.addExample.trim() || undefined,
            mnemonic: s.addMnemonic.trim() || undefined,
            image: s.addImage.trim() || undefined,
          });
          setState((s2) => ({
            ...s2,
            decks: s2.decks.map((d) => (d.id === deckId ? { ...d, cards: [...d.cards, card] } : d)),
            addFront: '',
            addBack: '',
            addSentence: '',
            addExample: '',
            addMnemonic: '',
            addImage: '',
            addedCount: s2.addedCount + 1,
            addBusy: false,
          }));
          showToast('Card added to ' + deckName);
        } catch (e) {
          patch({ addBusy: false });
          showToast((e as Error).message);
        }
      },

      loadHardest: () => {
        // 200 covers Browse's "Most missed" sort + badges; Stats shows the top 10.
        api.hardest(200).then((hardest) => patch({ hardest })).catch(() => {});
      },

      loadCommunity: () => {
        api.community().then((community) => patch({ community })).catch(() => {});
      },
      openCommunityDeck: (deckId) => {
        api.communityDeck(deckId).then(
          (deck) => patch({ communityPreview: deck }),
          (e) => {
            showToast((e as Error).message);
            api.community().then((community) => patch({ community })).catch(() => {}); // deck gone/private — resync the catalog
          },
        );
      },
      closeCommunityPreview: () => patch({ communityPreview: null }),
      importCommunityDeck: async (deckId) => {
        if (stateRef.current.communityBusy) return;
        patch({ communityBusy: true });
        try {
          const deck = await api.importDeck(deckId);
          setState((s) => ({
            ...s,
            decks: [...s.decks, deck],
            community: s.community.map((c) => (c.id === deckId ? { ...c, added: true } : c)),
            communityBusy: false,
          }));
          showToast(`Added ${deck.name.split(' — ')[0]} to your decks`);
        } catch (e) {
          patch({ communityBusy: false, communityPreview: null });
          showToast((e as Error).message);
          api.community().then((community) => patch({ community })).catch(() => {}); // import refused — resync the catalog
        }
      },
      setDeckVisibility: (deckId, visibility) => {
        const prev = stateRef.current.decks;
        setState((s) => ({ ...s, decks: s.decks.map((d) => (d.id === deckId ? { ...d, visibility } : d)) })); // optimistic
        api.setDeckVisibility(deckId, visibility).then(
          () => showToast(visibility === 'public' ? 'Deck is now public' : 'Deck is now private'),
          (e) => {
            setState((s) => ({ ...s, decks: prev }));
            showToast((e as Error).message);
          },
        );
      },
      pullNewCards: async (deckId) => {
        try {
          const cards = await api.pullNewCards(deckId);
          setState((s) => ({
            ...s,
            decks: s.decks.map((d) => (d.id === deckId ? { ...d, cards: [...d.cards, ...cards], newAvailable: 0 } : d)),
          }));
          showToast(cards.length === 0 ? 'No new cards to add' : `Added ${cards.length} new card${cards.length === 1 ? '' : 's'}`);
        } catch (e) {
          showToast((e as Error).message);
        }
      },

      setNewLimit: (n) => {
        patch({ newLimit: n }); // optimistic
        api.updateSettings({ newLimit: n }).then((user) => patch({ newLimit: user.newLimit })).catch((e) => showToast((e as Error).message));
      },
      setNewOrder: (o) => {
        patch({ newOrder: o });
        api.updateSettings({ newOrder: o }).then((user) => patch({ newOrder: user.newOrder })).catch((e) => showToast((e as Error).message));
      },
      setStudyDirection: (d) => {
        patch({ studyDirection: d });
        api.updateSettings({ studyDirection: d }).then((user) => patch({ studyDirection: user.studyDirection })).catch((e) => showToast((e as Error).message));
      },

      createDeck: (name) => {
        const n = name.trim();
        if (!n) return;
        api.createDeck(n).then(
          (deck) => {
            setState((s) => ({ ...s, decks: [...s.decks, deck], addDeckId: deck.id }));
            showToast(`Created ${n}`);
          },
          (e) => showToast((e as Error).message),
        );
      },
      updateCard: async (cardId, fields) => {
        try {
          const updated = await api.updateCard(cardId, fields);
          setState((s) => ({ ...s, decks: s.decks.map((d) => ({ ...d, cards: d.cards.map((c) => (c.id === cardId ? updated : c)) })) }));
          showToast('Card updated');
          return true;
        } catch (e) {
          showToast((e as Error).message);
          return false;
        }
      },
      deleteCard: (cardId) => {
        const prev = stateRef.current.decks;
        // optimistic remove
        setState((s) => ({ ...s, decks: s.decks.map((d) => ({ ...d, cards: d.cards.filter((c) => c.id !== cardId) })) }));
        api.deleteCard(cardId).then(
          () => {
            showToast('Card deleted');
            api.today().then((today) => patch({ today })).catch(() => {}); // deleting cascades the review log
          },
          (e) => {
            setState((s) => ({ ...s, decks: prev })); // restore on failure
            showToast((e as Error).message);
          },
        );
      },
      deleteDeck: (deckId) => {
        const s0 = stateRef.current;
        const prev = s0.decks;
        const name = prev.find((d) => d.id === deckId)?.name ?? 'Deck';
        setState((s) => {
          const decks = s.decks.filter((d) => d.id !== deckId);
          return { ...s, decks, addDeckId: s.addDeckId === deckId ? decks[0]?.id ?? '' : s.addDeckId };
        });
        api.deleteDeck(deckId).then(
          () => {
            showToast(`Deleted ${name.split(' — ')[0]}`);
            api.today().then((today) => patch({ today })).catch(() => {}); // deleting cascades the review log
          },
          (e) => {
            setState((s) => ({ ...s, decks: prev }));
            showToast((e as Error).message);
          },
        );
      },

      loadStats: () => {
        api
          .history()
          .then((h) => patch({ history: h.reviews }))
          .catch(() => {});
        api
          .matureHistory()
          .then((matureHistory) => patch({ matureHistory }))
          .catch(() => {});
        Promise.all([1, 7, 30, 365].map((days) => api.retention(days)))
          .then(([today, week, month, year]) => patch({
            retention: week,
            retentionWindows: { 1: today, 7: week, 30: month, 365: year },
          }))
          .catch(() => {});
      },
      loadLeaderboard: () => {
        api
          .leaderboard()
          .then((rows) => patch({ leaderboard: rows }))
          .catch(() => {});
      },
      loadToday: () => {
        api
          .today()
          .then((today) => patch({ today }))
          .catch(() => {});
      },
    }),
    [],
  );

  const store: Store = {
    state,
    actions,
    scheduler: schedulerRef.current,
    currentCard: () => findCard(state, state.queue[state.qIndex]),
  };

  return <Ctx.Provider value={store}>{children}</Ctx.Provider>;
}
