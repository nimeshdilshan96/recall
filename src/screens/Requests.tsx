import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { useApp, type FeatureRequest, type RequestStatus } from '../store.tsx';
import { accentVars } from '../theme.ts';

/** Status is curated by hand on the server — the UI only displays it. 'open' shows no strong color. */
const STATUS: Record<RequestStatus, { label: string; background: string; color: string }> = {
  open: { label: 'Open', background: 'oklch(0.93 0 0)', color: '#8a8a8a' },
  under_review: { label: 'Under review', background: 'oklch(0.95 0.07 90)', color: 'oklch(0.55 0.13 80)' },
  planned: { label: 'Planned', background: 'oklch(0.93 0.09 140)', color: 'oklch(0.52 0.15 140)' },
  done: { label: 'Done', background: 'var(--accent-tint)', color: 'var(--accent)' },
};

function StatusPill({ status }: { status: RequestStatus }) {
  const s = STATUS[status] ?? STATUS.open;
  return (
    <span style={{ background: s.background, color: s.color, fontSize: 10.5, fontWeight: 800, letterSpacing: '0.06em', textTransform: 'uppercase', padding: '4px 9px 5px', borderRadius: 8, whiteSpace: 'nowrap' }}>
      {s.label}
    </span>
  );
}

/** Upvote toggle: chevron + count, accent-outlined when the viewer has voted. */
function VoteBox({ r, onToggle }: { r: FeatureRequest; onToggle: () => void }) {
  return (
    <button
      onClick={onToggle}
      aria-label={r.myVote ? 'Remove your vote' : 'Vote for this'}
      style={{
        width: 46,
        flexShrink: 0,
        border: `2px solid ${r.myVote ? 'var(--accent)' : 'oklch(0.88 0 0)'}`,
        background: r.myVote ? 'var(--accent-tint)' : 'oklch(0.99 0 0)',
        color: r.myVote ? 'var(--accent)' : '#8a8a8a',
        borderRadius: 13,
        padding: '7px 0 8px',
        cursor: 'pointer',
        textAlign: 'center',
        transition: 'border-color 0.12s, background 0.12s, color 0.12s',
      }}
    >
      <svg width={14} height={9} viewBox="0 0 14 9" style={{ display: 'block', margin: '0 auto 2px', stroke: 'currentColor', fill: 'none', strokeWidth: 2.4, strokeLinecap: 'round', strokeLinejoin: 'round' }}>
        <path d="M2 7l5-5 5 5" />
      </svg>
      <span style={{ fontFamily: 'var(--font-mono)', fontSize: 14.5, fontWeight: 700, lineHeight: 1 }}>{r.votes}</span>
    </button>
  );
}

/** Portal-rendered (screen wrappers keep a transform; accent vars live on the app root). */
function NewRequestDialog({ onClose }: { onClose: () => void }) {
  const { state, actions } = useApp();
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (busy || !title.trim()) return;
    setBusy(true);
    const ok = await actions.createRequest(title.trim(), body.trim());
    setBusy(false);
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
  const field: React.CSSProperties = {
    width: '100%',
    border: '1px solid oklch(0.88 0 0)',
    borderRadius: 13,
    padding: '13px 16px',
    fontSize: 15,
    fontFamily: 'inherit',
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
        style={{ width: '100%', maxWidth: 480, background: 'oklch(0.99 0 0)', border: '2px solid oklch(0.9 0 0)', borderRadius: 18, padding: '24px 24px 22px', boxShadow: '0 24px 60px -20px oklch(0.3 0 0 / 0.5)', animation: 'rvFloat 0.18s ease both' }}
      >
        <div style={{ fontFamily: 'var(--font-display)', fontSize: 20, fontWeight: 700, color: '#4b4b4b', marginBottom: 6 }}>New request</div>
        <div style={{ fontSize: 13, color: '#afafaf', marginBottom: 18 }}>What should Recall do next? Everyone on this server can see and vote on it.</div>

        <div style={label}>Title</div>
        <input autoFocus value={title} onChange={(e) => setTitle(e.target.value)} maxLength={120} placeholder="e.g. Audio on cards" style={{ ...field, marginBottom: 18 }} />
        <div style={label}>
          Details<span style={{ textTransform: 'none', fontWeight: 500, color: '#afafaf' }}> — optional</span>
        </div>
        <textarea value={body} onChange={(e) => setBody(e.target.value)} maxLength={1000} placeholder="What problem would it solve for you?" style={{ ...field, minHeight: 96, resize: 'vertical', marginBottom: 22 }} />

        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
          <button
            onClick={onClose}
            style={{ border: 'none', cursor: 'pointer', background: 'oklch(0.93 0 0)', color: '#4b4b4b', fontSize: 14, fontWeight: 700, padding: '11px 18px', borderRadius: 13 }}
          >
            Cancel
          </button>
          <button className="btn3d" onClick={submit} disabled={busy || !title.trim()} style={{ fontSize: 14, padding: '11px 22px 13px', borderRadius: 13 }}>
            Add request
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}

/** Feature-request board: everyone can post and upvote; most-voted first. */
export function Requests() {
  const { state, actions } = useApp();
  const [dialogOpen, setDialogOpen] = useState(false);

  useEffect(() => {
    actions.loadRequests();
  }, []);

  return (
    <div style={{ padding: '28px var(--pad) 48px', animation: 'rvFloat 0.4s ease both' }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 16, marginBottom: 22 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 34, fontWeight: 600, margin: '0 0 4px', color: '#4b4b4b' }}>Requests</h1>
          <p style={{ fontSize: 13.5, color: '#afafaf', margin: 0 }}>Vote on what you want next, or add something missing.</p>
        </div>
        <button className="btn3d" onClick={() => setDialogOpen(true)} style={{ padding: '12px 18px 14px', borderRadius: 13, fontSize: 13, flexShrink: 0, marginTop: 6 }}>
          New request
        </button>
      </div>

      {!state.requestsLoaded ? (
        <div style={{ padding: '48px 22px', textAlign: 'center', color: '#afafaf', fontSize: 14 }}>Loading requests…</div>
      ) : state.requests.length === 0 ? (
        <div style={{ padding: '48px 22px', textAlign: 'center', color: '#afafaf', fontSize: 14 }}>Nothing here yet — add the first request.</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {state.requests.map((r) => (
            <div key={r.id} style={{ display: 'flex', alignItems: 'flex-start', gap: 16, background: 'oklch(0.99 0 0)', border: '2px solid oklch(0.9 0 0)', borderRadius: 16, padding: '16px 18px' }}>
              <VoteBox r={r} onToggle={() => actions.voteRequest(r.id, !r.myVote)} />
              <div style={{ minWidth: 0, flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 9 }}>
                  <span style={{ fontSize: 15.5, fontWeight: 700, color: '#4b4b4b' }}>{r.title}</span>
                  <StatusPill status={r.status} />
                </div>
                {r.body && <div style={{ fontSize: 13.5, lineHeight: 1.5, color: '#777777', marginTop: 4 }}>{r.body}</div>}
                <div style={{ fontSize: 12, color: '#afafaf', marginTop: 7 }}>by @{r.author}</div>
              </div>
            </div>
          ))}
        </div>
      )}

      {dialogOpen && <NewRequestDialog onClose={() => setDialogOpen(false)} />}
    </div>
  );
}
