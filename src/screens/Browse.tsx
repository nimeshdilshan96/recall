import { useEffect, useMemo, useState } from 'react';
import { useApp } from '../store.tsx';
import { totals, isNew } from '../selectors.ts';
import { EditCardDialog } from '../components/EditCardDialog.tsx';

type SortMode = 'default' | 'missed' | 'new';

interface Row {
  id: string;
  front: string;
  back: string;
  mnemonic: string;
  image: string;
  deckId: string;
  deck: string;
  isNew: boolean;
}

export function Browse() {
  const { state, actions } = useApp();
  const [query, setQuery] = useState('');
  const [deckFilter, setDeckFilter] = useState<string>('all');
  const [sort, setSort] = useState<SortMode>('default');
  const [editing, setEditing] = useState<Row | null>(null);
  const t = totals(state);

  // Miss stats power the "Most missed" sort and the warning badge.
  useEffect(() => {
    actions.loadHardest();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const missStats = useMemo(() => new Map(state.hardest.map((h) => [h.id, h])), [state.hardest]);

  const allRows: Row[] = useMemo(
    () =>
      state.decks.flatMap((d) =>
        d.cards.map((c) => ({ id: c.id, front: c.front, back: c.back, mnemonic: c.mnemonic ?? '', image: c.image ?? '', deckId: d.id, deck: d.name.split(' — ')[0], isNew: isNew(c) })),
      ),
    [state.decks],
  );

  const q = query.trim().toLowerCase();
  let rows = allRows.filter((r) => {
    if (deckFilter !== 'all' && r.deckId !== deckFilter) return false;
    if (!q) return true;
    return r.front.toLowerCase().includes(q) || r.back.toLowerCase().includes(q) || r.deck.toLowerCase().includes(q);
  });
  if (sort === 'missed') {
    // Miss rate (worst first); unseen/clean cards keep their default order below (stable sort).
    const rate = (id: string) => {
      const m = missStats.get(id);
      return m ? m.again / m.total : -1;
    };
    rows = rows.slice().sort((a, b) => rate(b.id) - rate(a.id));
  } else if (sort === 'new') {
    // Unstudied cards first; within each group the default order is kept (stable sort).
    rows = rows.slice().sort((a, b) => Number(b.isNew) - Number(a.isNew));
  }

  const filtering = q.length > 0 || deckFilter !== 'all';
  const ellipsis: React.CSSProperties = { overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' };
  const label: React.CSSProperties = { fontSize: 12, fontWeight: 700, letterSpacing: '0.04em', textTransform: 'uppercase', color: '#777777', marginBottom: 9 };

  const chip = (key: string, sel: boolean, label: string, onClick: () => void) => (
    <button
      key={key}
      onClick={onClick}
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

  return (
    <div style={{ padding: '28px var(--pad) 48px', animation: 'rvFloat 0.4s ease both' }}>
      <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 34, fontWeight: 600, margin: '0 0 4px', color: '#4b4b4b' }}>Browse</h1>
      <p style={{ fontSize: 13.5, color: '#afafaf', margin: '0 0 22px' }}>
        {filtering ? `${rows.length} of ${t.cards} cards` : `${t.cards} cards across ${t.deckCount} decks.`}
      </p>

      <div style={label}>Deck</div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 16 }}>
        {chip('all', deckFilter === 'all', 'All', () => setDeckFilter('all'))}
        {state.decks.map((d) => chip(d.id, deckFilter === d.id, d.name.split(' — ')[0], () => setDeckFilter(d.id)))}
      </div>

      <div style={label}>Sort</div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 16 }}>
        {chip('default', sort === 'default', 'Default', () => setSort('default'))}
        {chip('missed', sort === 'missed', 'Most missed', () => setSort('missed'))}
        {chip('new', sort === 'new', 'New first', () => setSort('new'))}
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

      {/* No overflow:hidden here — it would clip the hover tooltips ("Not learned yet", miss counts);
          the header rounds its own top corners instead. */}
      <div style={{ background: 'oklch(0.99 0 0)', border: '2px solid oklch(0.9 0 0)', borderRadius: 16 }}>
        <div style={{ display: 'flex', padding: '11px 18px', fontSize: 11, fontWeight: 700, letterSpacing: '0.05em', textTransform: 'uppercase', color: '#afafaf', background: 'oklch(0.97 0 0)', borderBottom: '1px solid oklch(0.9 0 0)', borderRadius: '14px 14px 0 0' }}>
          <span style={{ flex: 2 }}>Front</span>
          <span style={{ flex: 2 }}>Back</span>
          <span style={{ flex: 1.4 }}>Deck</span>
          <span style={{ width: 96 }} />
        </div>
        {rows.length === 0 ? (
          <div style={{ padding: '28px 18px', textAlign: 'center', color: '#afafaf', fontSize: 13.5 }}>No cards match.</div>
        ) : (
          rows.map((r) => {
            const m = missStats.get(r.id);
            const trouble = m && m.again / m.total >= 0.3;
            return (
              <div key={r.id} style={{ display: 'flex', alignItems: 'center', padding: '12px 18px', borderBottom: '1px solid oklch(0.93 0 0)', fontSize: 13.5 }}>
                <span style={{ flex: 2, minWidth: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontFamily: 'var(--font-display)', fontSize: 16, color: '#4b4b4b', minWidth: 0, ...ellipsis }}>{r.front.replace('{{}}', '___')}</span>
                  {r.isNew && (
                    <span className="tip" data-tip="Not learned yet" style={{ flexShrink: 0, marginTop: 3, padding: '2px 7px', borderRadius: 999, background: 'var(--accent-tint)', color: 'var(--accent)', fontSize: 9.5, fontWeight: 800, letterSpacing: '0.06em' }}>
                      NEW
                    </span>
                  )}
                  {trouble && (
                    <span className="tip" data-tip={`Missed ${m.again} of ${m.total} reviews`} style={{ flexShrink: 0, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 18, height: 18, borderRadius: 5, background: '#ffeccc', color: '#d97e00', fontSize: 9 }}>
                      ▲
                    </span>
                  )}
                </span>
                <span style={{ flex: 2, color: '#777777', minWidth: 0, ...ellipsis }}>{r.back}</span>
                <span style={{ flex: 1.4, color: '#777777', minWidth: 0, ...ellipsis }}>{r.deck}</span>
                <span style={{ width: 96, flexShrink: 0, display: 'flex', justifyContent: 'flex-end', gap: 14 }}>
                  <button onClick={() => setEditing(r)} style={{ border: 'none', background: 'none', cursor: 'pointer', padding: 0, color: '#777777', fontWeight: 500, fontSize: 13 }}>
                    Edit
                  </button>
                  <button className="link-delete" onClick={() => actions.deleteCard(r.id)}>
                    Delete
                  </button>
                </span>
              </div>
            );
          })
        )}
      </div>

      {editing && <EditCardDialog card={editing} deckLabel={editing.deck} onClose={() => setEditing(null)} />}
    </div>
  );
}
