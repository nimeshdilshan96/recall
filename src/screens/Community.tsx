import { useEffect } from 'react';
import { useApp } from '../store.tsx';

/** The Community catalog: browse other users' public decks, preview one, copy it to your decks. */
export function Community() {
  const { state, actions } = useApp();

  // Refresh the catalog whenever the screen is shown; drop any stale preview.
  useEffect(() => {
    actions.loadCommunity();
    return () => actions.closeCommunityPreview();
  }, []);

  const preview = state.communityPreview;
  const addedChip = (
    <span style={{ background: 'oklch(0.93 0 0)', color: '#afafaf', fontSize: 13, fontWeight: 800, letterSpacing: '0.04em', textTransform: 'uppercase', padding: '11px 18px 12px', borderRadius: 13, whiteSpace: 'nowrap' }}>
      Added ✓
    </span>
  );

  if (preview) {
    const added = state.community.find((c) => c.id === preview.id)?.added ?? false;
    return (
      <div style={{ padding: '28px var(--pad) 24px', animation: 'rvFloat 0.4s ease both', display: 'flex', flexDirection: 'column', flex: 1 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 22 }}>
          <button
            onClick={() => actions.closeCommunityPreview()}
            aria-label="Back to Community"
            style={{ width: 40, height: 40, borderRadius: 12, border: 'none', cursor: 'pointer', background: 'oklch(0.93 0 0)', color: '#777777', fontSize: 19, flexShrink: 0 }}
          >
            ←
          </button>
          <div style={{ minWidth: 0 }}>
            <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 30, fontWeight: 600, margin: 0, color: '#4b4b4b' }}>{preview.name}</h1>
            <div style={{ fontSize: 13.5, color: '#afafaf', marginTop: 2 }}>
              by @{preview.author} · {preview.cards.length} card{preview.cards.length === 1 ? '' : 's'}
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {preview.cards.length === 0 && (
            <div style={{ background: 'oklch(0.99 0 0)', border: '2px solid oklch(0.9 0 0)', borderRadius: 14, padding: '28px 18px', textAlign: 'center', color: '#afafaf', fontSize: 13.5 }}>
              This deck has no cards yet.
            </div>
          )}
          {preview.cards.map((c, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'baseline', gap: 14, background: 'oklch(0.99 0 0)', border: '2px solid oklch(0.9 0 0)', borderRadius: 14, padding: '14px 18px' }}>
              <span style={{ fontFamily: 'var(--font-display)', fontSize: 17, color: '#4b4b4b', flex: 1, minWidth: 0, overflowWrap: 'break-word' }}>{c.front}</span>
              <span style={{ color: '#c4c4c4', flexShrink: 0 }}>→</span>
              <span style={{ fontSize: 14.5, color: '#777777', flex: 2, minWidth: 0, overflowWrap: 'break-word' }}>
                {c.back}
                {c.example && <span style={{ color: '#afafaf' }}> · {c.example}</span>}
              </span>
            </div>
          ))}
        </div>

        <div style={{ position: 'sticky', bottom: 0, marginTop: 'auto', padding: '18px 0 8px', background: 'oklch(0.96 0 0)' }}>
          {added ? (
            <div style={{ display: 'flex', justifyContent: 'center' }}>{addedChip}</div>
          ) : (
            <button
              className="btn3d"
              disabled={state.communityBusy}
              onClick={() => actions.importCommunityDeck(preview.id)}
              style={{ width: '100%', padding: '15px 20px 17px', borderRadius: 15, fontSize: 15 }}
            >
              Add to my decks
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div style={{ padding: '28px var(--pad) 48px', animation: 'rvFloat 0.4s ease both' }}>
      <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 34, fontWeight: 600, margin: '0 0 4px', color: '#4b4b4b' }}>Community</h1>
      <p style={{ fontSize: 13.5, color: '#afafaf', margin: '0 0 22px' }}>Public decks shared by other people on this server.</p>

      {state.community.length === 0 ? (
        <div style={{ background: 'oklch(0.99 0 0)', border: '2px solid oklch(0.9 0 0)', borderRadius: 16, padding: '36px 22px', textAlign: 'center', color: '#afafaf', fontSize: 14 }}>
          No shared decks yet — make one of yours public!
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {state.community.map((d) => (
            <div key={d.id} style={{ display: 'flex', alignItems: 'center', gap: 16, background: 'oklch(0.99 0 0)', border: '2px solid oklch(0.9 0 0)', borderRadius: 16, padding: '16px 18px' }}>
              <div style={{ minWidth: 0, flex: 1 }}>
                <div style={{ fontSize: 16, fontWeight: 700, color: '#4b4b4b' }}>{d.name}</div>
                <div style={{ fontSize: 12.5, color: '#afafaf', marginTop: 2 }}>
                  by @{d.author} · {d.cardCount} card{d.cardCount === 1 ? '' : 's'}
                </div>
              </div>
              {d.added ? (
                addedChip
              ) : (
                <button className="btn3d" onClick={() => actions.openCommunityDeck(d.id)} style={{ padding: '11px 20px 13px', borderRadius: 13, minWidth: 96, fontSize: 13 }}>
                  Preview
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
