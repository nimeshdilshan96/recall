import { useApp } from '../store.tsx';
import { streakFrom } from '../selectors.ts';
import { LogoutIcon } from './icons.tsx';
import { useIsMobile } from '../hooks/useIsMobile.ts';

export function StatsBar() {
  const { state, actions } = useApp();
  const isMobile = useIsMobile();
  const streak = streakFrom(state.history);
  const initial = (state.profileName || 'L').trim().charAt(0).toUpperCase() || 'L';

  const chip = (bg: string, shadow: string) => ({ width: 18, height: 18, borderRadius: '6px 6px 7px 7px', background: bg, boxShadow: `inset 0 -3px 0 ${shadow}`, flexShrink: 0 });

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: isMobile ? 14 : 22, padding: '16px var(--pad)', borderBottom: '1px solid oklch(0.9 0 0)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={chip('#ff9600', '#e08600')} />
        <span style={{ fontWeight: 800, fontSize: 15, color: '#ff9600' }}>{streak}</span>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={chip('#1cb0f6', '#1899d6')} />
        <span style={{ fontWeight: 800, fontSize: 15, color: '#1899d6' }}>{state.gems}</span>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginLeft: 'auto' }}>
        <span style={chip('var(--accent)', 'var(--accent-deep)')} />
        <span style={{ fontWeight: 800, fontSize: 15, color: 'var(--accent)', whiteSpace: 'nowrap' }}>{state.xp} XP</span>
      </div>
      <div style={{ position: 'relative', paddingLeft: isMobile ? 12 : 18, marginLeft: isMobile ? 12 : 18, borderLeft: '1px solid oklch(0.9 0 0)' }}>
        <button onClick={() => actions.toggleMenu()} style={{ display: 'flex', alignItems: 'center', gap: 9, border: 'none', background: 'transparent', cursor: 'pointer', padding: 0 }}>
          <span style={{ width: 30, height: 30, borderRadius: '50%', background: 'var(--accent)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: 14, lineHeight: 1, boxShadow: 'inset 0 -3px 0 var(--accent-deep)', flexShrink: 0 }}>
            <span style={{ display: 'block', transform: 'translateY(-1px)' }}>{initial}</span>
          </span>
          {!isMobile && <span style={{ fontWeight: 700, fontSize: 14, color: '#4b4b4b' }}>{state.profileName}</span>}
          <span style={{ color: '#afafaf', fontSize: 10, lineHeight: 1 }}>▾</span>
        </button>
        {state.menuOpen && (
          <div style={{ position: 'absolute', top: 'calc(100% + 10px)', right: 0, width: 180, background: 'oklch(0.99 0 0)', border: '2px solid oklch(0.9 0 0)', borderRadius: 14, boxShadow: '0 14px 32px -14px rgba(0,0,0,0.3)', zIndex: 40, overflow: 'hidden', animation: 'rvFloat 0.18s ease both' }}>
            <div style={{ padding: '12px 14px', borderBottom: '1px solid oklch(0.93 0 0)' }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: '#4b4b4b', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{state.profileName}</div>
              <div style={{ fontSize: 11, color: '#afafaf', marginTop: 1 }}>Signed in</div>
            </div>
            <button onClick={() => actions.goto('settings')} style={{ display: 'flex', alignItems: 'center', gap: 10, width: '100%', border: 'none', background: 'transparent', cursor: 'pointer', textAlign: 'left', padding: '12px 14px', fontSize: 13.5, fontWeight: 600, color: '#4b4b4b' }}>
              <svg width="17" height="17" viewBox="0 0 24 24" style={{ stroke: '#777777', fill: 'none', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round', display: 'block' }}>
                <circle cx="12" cy="12" r="3" />
                <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
              </svg>
              Settings
            </button>
            <button onClick={() => actions.logout()} style={{ display: 'flex', alignItems: 'center', gap: 10, width: '100%', border: 'none', background: 'transparent', cursor: 'pointer', textAlign: 'left', padding: '12px 14px', fontSize: 13.5, fontWeight: 600, color: '#ff4b4b', borderTop: '1px solid oklch(0.93 0 0)' }}>
              <LogoutIcon />
              Log out
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
