import { useEffect, useState } from 'react';
import { useApp } from '../store.tsx';
import { deckCounts, maturity, totals } from '../selectors.ts';
import { ConfirmDialog } from '../components/ConfirmDialog.tsx';
import type { Deck } from '../data/types.ts';

// Daily new-card target (Anki's default is 20/day).
const NEW_TARGET = 20;

export function Home() {
  const { state, actions } = useApp();
  const [pending, setPending] = useState<Deck | null>(null);
  const now = new Date();
  const t = totals(state, now);

  // Refresh today's activity (reviews/new done today) whenever Home is shown.
  useEffect(() => {
    actions.loadToday();
  }, []);

  const { reviewDone, newDone } = state.today;
  const mastered = state.decks.reduce((a, d) => a + d.cards.filter((c) => maturity(c) === 'mature').length, 0);

  // Progress = work done today ÷ (done today + still remaining), anchored to the review log.
  const reviewMax = reviewDone + t.due; // reviews done today + still due
  const newMax = Math.max(1, Math.min(NEW_TARGET, newDone + t.neu)); // up to NEW_TARGET new cards available today
  const masteredMax = Math.max(1, t.cards);

  const goals = [
    { label: 'Review due cards', color: '#58cc02', pct: reviewMax === 0 ? 0 : Math.round((reviewDone / reviewMax) * 100) },
    { label: 'Learn new cards', color: '#1cb0f6', pct: Math.round((Math.min(newDone, newMax) / newMax) * 100) },
    { label: 'Cards mastered', color: '#ff9600', pct: Math.round((mastered / masteredMax) * 100) },
  ];

  return (
    <div style={{ padding: '28px var(--pad) 48px', animation: 'rvFloat 0.4s ease both' }}>
      <div style={{ background: 'oklch(0.99 0 0)', border: '2px solid oklch(0.9 0 0)', borderRadius: 18, padding: '20px 22px', margin: '0 0 24px' }}>
        <div style={{ fontFamily: 'var(--font-display)', fontSize: 19, fontWeight: 700, color: '#4b4b4b', marginBottom: 16 }}>Daily goals</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
          {goals.map((g) => {
            const pct = Math.min(100, Math.max(0, g.pct));
            return (
              <div key={g.label} style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                <span style={{ width: 26, height: 26, borderRadius: 8, flexShrink: 0, background: g.color, boxShadow: 'inset 0 -3px 0 rgba(0,0,0,0.18)' }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 700, fontSize: 14, color: '#4b4b4b', marginBottom: 7 }}>{g.label}</div>
                  <div style={{ position: 'relative', height: 18, background: 'oklch(0.9 0 0)', borderRadius: 20, overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: `${pct}%`, background: '#ffc800', borderRadius: 20, boxShadow: 'inset 0 4px 0 rgba(255,255,255,0.45)' }} />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div style={{ fontFamily: 'var(--font-display)', fontSize: 19, fontWeight: 700, color: '#4b4b4b', marginBottom: 14 }}>Continue learning</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {state.decks.map((d) => {
          const { neu, due, total } = deckCounts(d, now);
          const has = neu + due > 0;
          return (
            <div key={d.id} className="deck-row" style={{ display: 'flex', alignItems: 'center', gap: 16, background: 'oklch(0.99 0 0)', border: '2px solid oklch(0.9 0 0)', borderRadius: 16, padding: '16px 18px', position: 'relative' }}>
              <div style={{ minWidth: 0, flex: 1 }}>
                <div style={{ fontSize: 16, fontWeight: 700, color: '#4b4b4b' }}>{d.name}</div>
                <div style={{ fontSize: 12.5, color: '#afafaf', marginTop: 2 }}>{total} cards</div>
              </div>
              <div className="deck-actions">
                <div style={{ display: 'flex', gap: 16, alignItems: 'center', fontFamily: 'var(--font-mono)' }}>
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: 17, fontWeight: 700, color: 'oklch(0.55 0.11 250)' }}>{neu}</div>
                    <div style={{ fontSize: 9.5, color: '#afafaf', letterSpacing: '0.05em' }}>NEW</div>
                  </div>
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: 17, fontWeight: 700, color: 'oklch(0.62 0.12 150)' }}>{due}</div>
                    <div style={{ fontSize: 9.5, color: '#afafaf', letterSpacing: '0.05em' }}>DUE</div>
                  </div>
                </div>
                <button className="btn3d" onClick={() => actions.startPractice(d.id)} style={{ padding: '11px 18px 13px', borderRadius: 13, minWidth: 96, fontSize: 13 }}>
                  Practice
                </button>
                {has ? (
                  <button className="btn3d" onClick={() => actions.startStudy(d.id)} style={{ padding: '11px 20px 13px', borderRadius: 13, minWidth: 96, fontSize: 13 }}>
                    Study
                  </button>
                ) : (
                  <button
                    onClick={() => actions.showToast('No cards due in this deck')}
                    style={{ border: 'none', cursor: 'pointer', background: 'oklch(0.92 0 0)', color: '#afafaf', fontSize: 13, fontWeight: 800, letterSpacing: '0.04em', textTransform: 'uppercase', padding: '11px 20px 13px', borderRadius: 13, minWidth: 96, boxShadow: '0 4px 0 oklch(0.82 0 0)' }}
                  >
                    Done
                  </button>
                )}
              </div>
              <span className="deck-delete">
                <button className="link-delete" onClick={() => setPending(d)}>
                  Delete
                </button>
              </span>
            </div>
          );
        })}
      </div>

      <button onClick={() => actions.goto('add')} style={{ marginTop: 18, border: '1.5px dashed oklch(0.82 0.03 70)', background: 'transparent', color: '#777777', cursor: 'pointer', width: '100%', padding: 14, borderRadius: 14, fontSize: 13.5, fontWeight: 600 }}>
        + Add cards to a deck
      </button>

      {pending && (
        <ConfirmDialog
          title={`Delete ${pending.name.split(' — ')[0]}?`}
          message={`This removes all ${pending.cards.length} card${pending.cards.length === 1 ? '' : 's'} in this deck and their review history. This can't be undone.`}
          confirmLabel="Delete deck"
          onConfirm={() => {
            actions.deleteDeck(pending.id);
            setPending(null);
          }}
          onCancel={() => setPending(null)}
        />
      )}
    </div>
  );
}
