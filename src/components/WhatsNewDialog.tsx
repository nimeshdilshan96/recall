import { useApp } from '../store.tsx';
import { CHANGELOG } from '../data/changelog.ts';

/** One-time "What's new" announcement, shown after login until dismissed for this version. */
export function WhatsNewDialog() {
  const { actions } = useApp();
  const dismiss = () => actions.dismissWhatsNew();

  return (
    <div
      onClick={dismiss}
      style={{ position: 'fixed', inset: 0, background: 'oklch(0.2 0 0 / 0.35)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 60, padding: 20 }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{ width: '100%', maxWidth: 440, background: 'oklch(0.99 0 0)', border: '2px solid oklch(0.9 0 0)', borderRadius: 18, padding: '24px 24px 22px', boxShadow: '0 24px 60px -20px oklch(0.3 0 0 / 0.5)', animation: 'rvFloat 0.18s ease both' }}
      >
        <div style={{ fontSize: 11.5, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--accent)', marginBottom: 6 }}>
          Version {CHANGELOG.version}
        </div>
        <div style={{ fontFamily: 'var(--font-display)', fontSize: 26, fontWeight: 700, color: '#4b4b4b', marginBottom: 18 }}>What's new</div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 16, marginBottom: 22 }}>
          {CHANGELOG.items.map((item) => (
            <div key={item.title} style={{ display: 'flex', gap: 12 }}>
              <span style={{ width: 14, height: 14, borderRadius: 4, flexShrink: 0, marginTop: 3, background: 'var(--accent)', boxShadow: 'inset 0 -2px 0 rgba(0,0,0,0.18)' }} />
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 15, fontWeight: 700, color: '#4b4b4b', marginBottom: 3 }}>{item.title}</div>
                <div style={{ fontSize: 13.5, lineHeight: 1.5, color: '#777777' }}>{item.body}</div>
              </div>
            </div>
          ))}
        </div>

        <button className="btn3d" onClick={dismiss} style={{ width: '100%', padding: '13px 20px 15px', borderRadius: 14, fontSize: 14 }}>
          Got it
        </button>
      </div>
    </div>
  );
}
