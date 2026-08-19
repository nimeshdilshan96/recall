import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { useApp } from '../store.tsx';
import { accentVars } from '../theme.ts';

interface Props {
  card: { id: string; front: string; back: string; mnemonic?: string | null; image?: string | null };
  deckLabel: string;
  onClose(): void;
}

/** Card-style popup for editing a card's note content (used by Browse and Study).
 *  Rendered through a portal: screen wrappers keep a transform from their entry animation,
 *  which would re-anchor position:fixed — and outside the app root the accent CSS vars are
 *  gone, so they're re-applied on the backdrop. */
export function EditCardDialog({ card, deckLabel, onClose }: Props) {
  const { state, actions } = useApp();
  const [front, setFront] = useState(card.front);
  const [back, setBack] = useState(card.back);
  const [mnemonic, setMnemonic] = useState(card.mnemonic ?? '');
  const [image, setImage] = useState(card.image ?? '');
  const [saving, setSaving] = useState(false);

  const save = async () => {
    if (saving || !front.trim() || !back.trim()) return;
    setSaving(true);
    const ok = await actions.updateCard(card.id, { front: front.trim(), back: back.trim(), mnemonic: mnemonic.trim() || undefined, image: image.trim() || undefined });
    setSaving(false);
    if (ok) onClose();
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const label: React.CSSProperties = { fontSize: 12, fontWeight: 700, letterSpacing: '0.04em', textTransform: 'uppercase', color: '#777777', marginBottom: 9 };
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

  return createPortal(
    <div
      onClick={onClose}
      style={{ ...accentVars(state.accent), position: 'fixed', inset: 0, background: 'oklch(0.2 0 0 / 0.35)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 60, padding: 20 }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{ width: '100%', maxWidth: 560, maxHeight: '90vh', overflowY: 'auto', background: 'oklch(0.99 0 0)', border: '2px solid oklch(0.9 0 0)', borderRadius: 18, padding: '24px 24px 22px', boxShadow: '0 24px 60px -20px oklch(0.3 0 0 / 0.5)', animation: 'rvFloat 0.18s ease both' }}
      >
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, marginBottom: 18 }}>
          <div style={{ fontFamily: 'var(--font-display)', fontSize: 20, fontWeight: 700, color: '#4b4b4b' }}>Edit card</div>
          <div style={{ fontSize: 12.5, color: '#afafaf' }}>{deckLabel}</div>
        </div>

        <div style={label}>Front</div>
        <textarea autoFocus value={front} onChange={(e) => setFront(e.target.value)} style={{ ...textarea, marginBottom: 18 }} />
        <div style={label}>Back</div>
        <textarea value={back} onChange={(e) => setBack(e.target.value)} style={{ ...textarea, marginBottom: 18 }} />
        <div style={label}>
          Mnemonic<span style={{ textTransform: 'none', fontWeight: 500, color: '#afafaf' }}> — optional, shown with the answer</span>
        </div>
        <textarea value={mnemonic} onChange={(e) => setMnemonic(e.target.value)} placeholder="A memory hook, e.g. sounds like…" style={{ ...textarea, minHeight: 64, fontSize: 15, marginBottom: 18 }} />
        <div style={label}>
          Image URL<span style={{ textTransform: 'none', fontWeight: 500, color: '#afafaf' }}> — optional</span>
        </div>
        <input value={image} onChange={(e) => setImage(e.target.value)} placeholder="https://…" style={{ ...textarea, minHeight: 0, resize: 'none', fontSize: 15, fontFamily: 'inherit', padding: '12px 16px', marginBottom: 22 }} />

        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
          <button
            onClick={onClose}
            style={{ border: 'none', cursor: 'pointer', background: 'oklch(0.93 0 0)', color: '#4b4b4b', fontSize: 14, fontWeight: 700, padding: '11px 18px', borderRadius: 13 }}
          >
            Cancel
          </button>
          <button
            className="btn3d"
            onClick={save}
            disabled={saving || !front.trim() || !back.trim()}
            style={{ fontSize: 14, padding: '11px 22px 13px', borderRadius: 13 }}
          >
            Save
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
