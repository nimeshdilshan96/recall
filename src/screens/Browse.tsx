import { useMemo, useState } from 'react';
import { useApp } from '../store.tsx';
import { totals } from '../selectors.ts';

export function Browse() {
  const { state, actions } = useApp();
  const [query, setQuery] = useState('');
  const [deckFilter, setDeckFilter] = useState<string>('all');
  const t = totals(state);

  const allRows = useMemo(
    () =>
      state.decks.flatMap((d) =>
        d.cards.map((c) => ({ id: c.id, front: c.front, back: c.back, deckId: d.id, deck: d.name.split(' — ')[0] })),
      ),
    [state.decks],
  );

  const q = query.trim().toLowerCase();
  const rows = allRows.filter((r) => {
    if (deckFilter !== 'all' && r.deckId !== deckFilter) return false;
    if (!q) return true;
    return r.front.toLowerCase().includes(q) || r.back.toLowerCase().includes(q) || r.deck.toLowerCase().includes(q);
  });

  const filtering = q.length > 0 || deckFilter !== 'all';
  const ellipsis: React.CSSProperties = { overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' };

  const chip = (id: string, label: string) => {
    const sel = deckFilter === id;
    return (
      <button
        key={id}
        onClick={() => setDeckFilter(id)}
        style={{
          border: `1px solid ${sel ? 'var(--accent)' : 'oklch(0.88 0 0)'}`,
          cursor: 'pointer',
          background: sel ? 'var(--accent-tint)' : 'oklch(0.99 0 0)',
          color: sel ? 'var(--accent)' : '#777777',
          fontSize: 13,
          fontWeight: 600,
          padding: '8px 14px',
          borderRadius: 10,
        }}
      >
        {label}
      </button>
    );
  };

  return (
    <div style={{ padding: '28px var(--pad) 48px', animation: 'rvFloat 0.4s ease both' }}>
      <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 34, fontWeight: 600, margin: '0 0 4px', color: '#4b4b4b' }}>Browse</h1>
      <p style={{ fontSize: 13.5, color: '#afafaf', margin: '0 0 22px' }}>
        {filtering ? `${rows.length} of ${t.cards} cards` : `${t.cards} cards across ${t.deckCount} decks.`}
      </p>

      <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: '0.04em', textTransform: 'uppercase', color: '#777777', marginBottom: 9 }}>Deck</div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 16 }}>
        {chip('all', 'All')}
        {state.decks.map((d) => chip(d.id, d.name.split(' — ')[0]))}
      </div>

      <div style={{ position: 'relative', marginBottom: 22 }}>
        <svg width="17" height="17" viewBox="0 0 24 24" style={{ position: 'absolute', left: 16, top: '50%', transform: 'translateY(-50%)', stroke: '#afafaf', fill: 'none', strokeWidth: 2.2, strokeLinecap: 'round', strokeLinejoin: 'round' }}>
          <circle cx={10.5} cy={10.5} r={6.5} />
          <path d="M20 20l-4.6-4.6" />
        </svg>
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search words, answers, or decks"
          style={{ width: '100%', border: '2px solid oklch(0.9 0 0)', background: 'oklch(0.98 0 0)', borderRadius: 20, padding: '12px 16px 12px 42px', fontSize: 14, fontWeight: 500, color: '#4b4b4b' }}
          onFocus={(e) => (e.currentTarget.style.borderColor = 'var(--accent)')}
          onBlur={(e) => (e.currentTarget.style.borderColor = 'oklch(0.9 0 0)')}
        />
      </div>

      <div style={{ background: 'oklch(0.99 0 0)', border: '2px solid oklch(0.9 0 0)', borderRadius: 16, overflow: 'hidden' }}>
        <div style={{ display: 'flex', padding: '11px 18px', fontSize: 11, fontWeight: 700, letterSpacing: '0.05em', textTransform: 'uppercase', color: '#afafaf', background: 'oklch(0.97 0 0)', borderBottom: '1px solid oklch(0.9 0 0)' }}>
          <span style={{ flex: 2 }}>Front</span>
          <span style={{ flex: 2 }}>Back</span>
          <span style={{ flex: 1.4 }}>Deck</span>
          <span style={{ width: 70 }} />
        </div>
        {rows.length === 0 ? (
          <div style={{ padding: '28px 18px', textAlign: 'center', color: '#afafaf', fontSize: 13.5 }}>No cards match.</div>
        ) : (
          rows.map((r) => (
            <div key={r.id} style={{ display: 'flex', alignItems: 'center', padding: '12px 18px', borderBottom: '1px solid oklch(0.93 0 0)', fontSize: 13.5 }}>
              <span style={{ flex: 2, fontFamily: 'var(--font-display)', fontSize: 16, color: '#4b4b4b', minWidth: 0, ...ellipsis }}>{r.front}</span>
              <span style={{ flex: 2, color: '#777777', minWidth: 0, ...ellipsis }}>{r.back}</span>
              <span style={{ flex: 1.4, color: '#777777', minWidth: 0, ...ellipsis }}>{r.deck}</span>
              <span style={{ width: 70, textAlign: 'right' }}>
                <button className="link-delete" onClick={() => actions.deleteCard(r.id)}>
                  Delete
                </button>
              </span>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
