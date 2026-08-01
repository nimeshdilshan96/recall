import { useState } from 'react';
import { useApp } from '../store.tsx';
import { autoNordic } from '../util/answer.ts';
import type { CardType } from '../data/types.ts';

export function Add() {
  const { state, actions } = useApp();
  const cloze = state.addType === 'cloze';
  const canAdd = !!state.addDeckId && (cloze ? state.addSentence.trim().length > 0 : state.addFront.trim().length > 0 && state.addBack.trim().length > 0);
  const [creating, setCreating] = useState(false);
  const [newDeck, setNewDeck] = useState('');

  const confirmNewDeck = () => {
    if (!newDeck.trim()) return;
    actions.createDeck(newDeck);
    setNewDeck('');
    setCreating(false);
  };
  const cancelNewDeck = () => {
    setNewDeck('');
    setCreating(false);
  };

  const textarea: React.CSSProperties = {
    width: '100%',
    minHeight: 84,
    resize: 'vertical',
    border: '1px solid oklch(0.88 0 0)',
    borderRadius: 13,
    padding: '14px 16px',
    fontSize: 18,
    fontFamily: 'var(--font-display)',
    background: 'oklch(0.99 0 0)',
    color: '#4b4b4b',
  };
  const label: React.CSSProperties = { fontSize: 12, fontWeight: 700, letterSpacing: '0.04em', textTransform: 'uppercase', color: '#777777', marginBottom: 9 };
  const optional = (text: string) => (
    <span style={{ textTransform: 'none', fontWeight: 500, color: '#afafaf' }}> — {text}</span>
  );

  const chip = (selected: boolean): React.CSSProperties => ({
    border: `1px solid ${selected ? 'var(--accent)' : 'oklch(0.88 0 0)'}`,
    cursor: 'pointer',
    background: selected ? 'var(--accent-tint)' : 'oklch(0.99 0 0)',
    color: selected ? 'var(--accent)' : '#777777',
    fontSize: 13,
    fontWeight: 600,
    padding: '8px 14px',
    borderRadius: 10,
  });

  return (
    <div style={{ padding: '28px var(--pad) 48px', maxWidth: 640, animation: 'rvFloat 0.4s ease both' }}>
      <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 34, fontWeight: 600, margin: '0 0 4px', color: '#4b4b4b' }}>Add cards</h1>
      <p style={{ fontSize: 13.5, color: '#afafaf', margin: '0 0 26px' }}>Type the prompt and its answer. It enters the queue as a new card.</p>

      <div style={label}>Deck</div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 22 }}>
        {state.decks.map((d) => (
          <button key={d.id} onClick={() => actions.setAddDeck(d.id)} style={chip(d.id === state.addDeckId)}>
            {d.name.split(' — ')[0]}
          </button>
        ))}

        {creating ? (
          <div style={{ display: 'flex', alignItems: 'center', border: '1px solid var(--accent)', borderRadius: 10, overflow: 'hidden', background: 'oklch(0.99 0 0)' }}>
            <input
              autoFocus
              value={newDeck}
              onChange={(e) => setNewDeck(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') confirmNewDeck();
                else if (e.key === 'Escape') cancelNewDeck();
              }}
              onBlur={() => !newDeck.trim() && cancelNewDeck()}
              placeholder="Deck name"
              style={{ border: 'none', background: 'transparent', padding: '8px 12px', fontSize: 13, fontWeight: 600, color: '#4b4b4b', width: 150 }}
            />
            <button onClick={confirmNewDeck} aria-label="Create deck" style={{ border: 'none', cursor: 'pointer', background: 'var(--accent)', color: '#fff', padding: '9px 12px', display: 'flex', alignItems: 'center' }}>
              <svg width="15" height="15" viewBox="0 0 24 24" style={{ stroke: '#fff', fill: 'none', strokeWidth: 3, strokeLinecap: 'round', strokeLinejoin: 'round', display: 'block' }}>
                <path d="M5 13l4 4L19 7" />
              </svg>
            </button>
          </div>
        ) : (
          <button onClick={() => setCreating(true)} style={{ ...chip(false), border: '1px dashed oklch(0.8 0.03 70)', display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ fontSize: 15, lineHeight: 1 }}>+</span> New deck
          </button>
        )}
      </div>

      <div style={label}>Card type</div>
      <div style={{ display: 'flex', gap: 8, marginBottom: 22 }}>
        {([['basic', 'Basic'], ['cloze', 'Cloze (fill in the blank)']] as [CardType, string][]).map(([t, lbl]) => (
          <button key={t} onClick={() => actions.setAddType(t)} style={chip(state.addType === t)}>
            {lbl}
          </button>
        ))}
      </div>

      {cloze ? (
        <>
          <div style={label}>Sentence</div>
          <textarea
            value={state.addSentence}
            onChange={(e) => actions.setAddSentence(autoNordic(e.target.value))}
            placeholder="Type the full sentence — wrap the answer in [brackets], e.g. Bussen kommer [snart]"
            style={{ ...textarea, marginBottom: 18 }}
          />
        </>
      ) : (
        <>
          <div style={label}>Front</div>
          <textarea value={state.addFront} onChange={(e) => actions.setAddFront(autoNordic(e.target.value))} placeholder="e.g. 木" style={{ ...textarea, marginBottom: 18 }} />
          <div style={label}>Back</div>
          <textarea value={state.addBack} onChange={(e) => actions.setAddBack(autoNordic(e.target.value))} placeholder="e.g. tree (ki)" style={{ ...textarea, marginBottom: 18 }} />
        </>
      )}

      <div style={label}>Mnemonic{optional('optional, shown with the answer')}</div>
      <textarea value={state.addMnemonic} onChange={(e) => actions.setAddMnemonic(autoNordic(e.target.value))} placeholder="A memory hook, e.g. sounds like…" style={{ ...textarea, minHeight: 64, fontSize: 15, marginBottom: 18 }} />

      <div style={label}>Image URL{optional('optional')}</div>
      <input
        value={state.addImage}
        onChange={(e) => actions.setAddImage(e.target.value)}
        placeholder="https://…"
        style={{ width: '100%', border: '1px solid oklch(0.88 0 0)', borderRadius: 13, padding: '13px 16px', fontSize: 15, background: 'oklch(0.99 0 0)', color: '#4b4b4b', marginBottom: 22 }}
      />

      <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
        <button
          className="btn3d"
          disabled={!canAdd}
          onClick={() => actions.addCard()}
          style={{
            padding: '13px 28px 15px',
            borderRadius: 16,
            fontSize: 14,
            background: canAdd ? 'var(--accent)' : 'oklch(0.91 0 0)',
            color: canAdd ? 'oklch(0.99 0 0)' : '#afafaf',
            boxShadow: canAdd ? '0 4px 0 var(--accent-deep)' : '0 4px 0 oklch(0.82 0 0)',
          }}
        >
          Add card
        </button>
        {state.addedCount > 0 && <span style={{ fontSize: 13, color: '#777777' }}>{state.addedCount} added this session</span>}
      </div>
    </div>
  );
}
