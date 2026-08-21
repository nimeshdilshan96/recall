import { useEffect, useState } from 'react';
import { useApp } from '../store.tsx';
import { deckCounts, totals } from '../selectors.ts';
import { ConfirmDialog } from '../components/ConfirmDialog.tsx';
import { PadlockIcon } from '../components/icons.tsx';
import { useIsMobile } from '../hooks/useIsMobile.ts';
import type { Deck } from '../data/types.ts';

export function Home() {
  const { state, actions } = useApp();
  const isMobile = useIsMobile();
  const [pending, setPending] = useState<Deck | null>(null);
  const [pendingShare, setPendingShare] = useState<Deck | null>(null);
  const now = new Date();
  const t = totals(state, now);

  // Refresh today's activity (reviews/new done today) whenever Home is shown.
  useEffect(() => {
    actions.loadToday();
  }, []);

  const { reviewDone, newDone } = state.today;

  // Progress = work done today ÷ (done today + still remaining), anchored to the review log.
  const reviewMax = reviewDone + t.due; // reviews done today + still due
  const newMax = Math.max(1, Math.min(state.newLimit, newDone + t.neu)); // the user's own new-cards-per-day setting is the target

  const goals = [
    {
      label: 'Review due cards',
      color: '#58cc02',
      pct: reviewMax === 0 ? 0 : Math.round((reviewDone / reviewMax) * 100),
      hint: reviewMax === 0 ? 'Nothing due today' : `${reviewDone} of ${reviewMax} reviews done`,
    },
    {
      label: 'Learn new cards',
      color: '#1cb0f6',
      pct: Math.round((Math.min(newDone, newMax) / newMax) * 100),
      hint: newDone + t.neu === 0 ? 'No new cards to learn' : `${Math.min(newDone, newMax)} of ${newMax} new cards learned`,
    },
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
                  <div style={{ fontWeight: 700, fontSize: 14, color: '#4b4b4b', marginBottom: 1 }}>{g.label}</div>
                  <div style={{ fontSize: 12.5, color: '#afafaf', marginBottom: 7 }}>{g.hint}</div>
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
          const pub = d.visibility === 'public';

          const padlock = !d.imported && (
            <button
              className="tip"
              onClick={() => (pub ? actions.setDeckVisibility(d.id, 'private') : setPendingShare(d))}
              data-tip={pub ? 'Public — click to make private' : 'Private — click to make public'}
              aria-label={pub ? 'Public — click to make private' : 'Private — click to make public'}
              style={{ width: 34, height: 34, borderRadius: 9, border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', background: pub ? 'var(--accent-tint)' : 'oklch(0.93 0 0)', flexShrink: 0 }}
            >
              <PadlockIcon open={pub} color={pub ? 'var(--accent)' : '#afafaf'} />
            </button>
          );
          const numbers = (
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
          );
          const buttonStyle = (grow: boolean) => ({ padding: '11px 18px 13px', borderRadius: 13, fontSize: 13, ...(grow ? { flex: 1 } : { minWidth: 96 }) });
          const practiceBtn = (grow: boolean) => (
            <button className="btn3d tip" data-tip="Free run of the whole deck, shuffled — doesn't touch your schedule or XP" onClick={() => actions.startPractice(d.id)} style={buttonStyle(grow)}>
              Practice
            </button>
          );
          const studyBtn = (grow: boolean) =>
            has ? (
              <button className="btn3d tip tip-left" data-tip="Today's real session: due reviews + new cards — grades update your schedule" onClick={() => actions.startStudy(d.id)} style={buttonStyle(grow)}>
                Study
              </button>
            ) : (
              <button
                className="tip tip-left"
                data-tip="All caught up — no cards due or new right now"
                onClick={() => actions.showToast('No cards due in this deck')}
                style={{ border: 'none', cursor: 'pointer', background: 'oklch(0.92 0 0)', color: '#afafaf', fontWeight: 800, letterSpacing: '0.04em', textTransform: 'uppercase', boxShadow: '0 4px 0 oklch(0.82 0 0)', ...buttonStyle(grow) }}
              >
                Done
              </button>
            );

          return (
            <div key={d.id} style={{ background: 'oklch(0.99 0 0)', border: '2px solid oklch(0.9 0 0)', borderRadius: 16 }}>
              {isMobile ? (
                /* Mobile: name+count / padlock+counts+delete / buttons — three stacked lines. */
                <div style={{ display: 'flex', flexDirection: 'column', gap: 17, padding: '16px' }}>
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: 10 }}>
                    <span style={{ flex: 1, minWidth: 0, fontSize: 16, fontWeight: 700, color: '#4b4b4b', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{d.name}</span>
                    <span style={{ flexShrink: 0, fontSize: 12.5, color: '#afafaf' }}>
                      {total} cards
                      {d.fromUsername && ` · from @${d.fromUsername}`}
                    </span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                    {padlock}
                    {numbers}
                    <span style={{ marginLeft: 'auto' }}>
                      <button className="link-delete" onClick={() => setPending(d)}>
                        Delete
                      </button>
                    </span>
                  </div>
                  <div style={{ display: 'flex', gap: 10 }}>
                    {practiceBtn(true)}
                    {studyBtn(true)}
                  </div>
                </div>
              ) : (
                <div className="deck-row" style={{ display: 'flex', alignItems: 'center', gap: 16, padding: '16px 18px', position: 'relative' }}>
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div style={{ fontSize: 16, fontWeight: 700, color: '#4b4b4b' }}>{d.name}</div>
                    <div style={{ fontSize: 12.5, color: '#afafaf', marginTop: 2 }}>
                      {total} cards
                      {d.fromUsername && ` · from @${d.fromUsername}`}
                    </div>
                  </div>
                  <div className="deck-actions">
                    {padlock}
                    {numbers}
                    {practiceBtn(false)}
                    {studyBtn(false)}
                  </div>
                  <span className="deck-delete">
                    <button className="link-delete" onClick={() => setPending(d)}>
                      Delete
                    </button>
                  </span>
                </div>
              )}
              {d.newAvailable > 0 && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, margin: '0 18px 16px', background: 'var(--accent-tint)', borderRadius: 12, padding: '10px 10px 10px 14px' }}>
                  <span style={{ flex: 1, minWidth: 0, fontSize: 13, fontWeight: 600, color: '#4b4b4b' }}>
                    {d.newAvailable} new card{d.newAvailable === 1 ? '' : 's'} available from @{d.fromUsername}
                  </span>
                  <button className="btn3d" onClick={() => actions.pullNewCards(d.id)} style={{ padding: '9px 14px 11px', borderRadius: 11, fontSize: 12 }}>
                    Get new cards
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>

      <button onClick={() => actions.goto('add')} style={{ marginTop: 18, border: '1.5px dashed oklch(0.82 0.03 70)', background: 'transparent', color: '#777777', cursor: 'pointer', width: '100%', padding: 14, borderRadius: 14, fontSize: 13.5, fontWeight: 600 }}>
        + Add cards to a deck
      </button>

      {pendingShare && (
        <ConfirmDialog
          title={`Share ${pendingShare.name.split(' — ')[0]}?`}
          message="It will appear in Community, where anyone on this server can browse it and copy the cards. You can make it private again anytime."
          confirmLabel="Make public"
          confirmColor="var(--accent)"
          onConfirm={() => {
            actions.setDeckVisibility(pendingShare.id, 'public');
            setPendingShare(null);
          }}
          onCancel={() => setPendingShare(null)}
        />
      )}

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
