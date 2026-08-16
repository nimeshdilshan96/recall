import { useApp, type Screen } from '../store.tsx';
import { NavIcon, FlameIcon, type NavKey } from './icons.tsx';
import { streakFrom } from '../selectors.ts';
import { useState } from 'react';

const NAV: { key: NavKey; label: string; screen: Screen }[] = [
  { key: 'home', label: 'Decks', screen: 'home' },
  { key: 'add', label: 'Add', screen: 'add' },
  { key: 'community', label: 'Community', screen: 'community' },
  { key: 'league', label: 'League', screen: 'league' },
  { key: 'stats', label: 'Stats', screen: 'stats' },
  { key: 'browse', label: 'Browse', screen: 'browse' },
];

export function Sidebar() {
  const { state, actions } = useApp();
  const [hover, setHover] = useState<string | null>(null);
  const streak = streakFrom(state.history);
  const todayLabel = new Date().toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });

  return (
    <nav
      style={{
        width: 232,
        flexShrink: 0,
        background: 'oklch(0.97 0 0)',
        borderRight: '1px solid oklch(0.9 0 0)',
        padding: '22px 16px',
        display: 'flex',
        flexDirection: 'column',
        gap: 4,
        height: '100%',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 11, padding: '2px 8px 22px' }}>
        <div style={{ width: 34, height: 34, borderRadius: 10, background: 'var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 4px 10px -3px var(--accent-soft)' }}>
          <span style={{ fontFamily: 'var(--font-display)', fontWeight: 600, fontSize: 20, color: 'oklch(0.99 0 0)' }}>R</span>
        </div>
        <div>
          <div style={{ fontFamily: 'var(--font-display)', fontSize: 20, fontWeight: 600, lineHeight: 1, color: '#4b4b4b' }}>Recall</div>
          <div style={{ fontSize: 10.5, fontFamily: 'var(--font-mono)', color: '#afafaf', marginTop: 3 }}>{todayLabel}</div>
        </div>
      </div>

      {NAV.map((n) => {
        const active = state.screen === n.screen || (n.key === 'home' && state.screen === 'study');
        return (
          <button
            key={n.key}
            onClick={() => actions.goto(n.screen)}
            onMouseEnter={() => setHover(n.key)}
            onMouseLeave={() => setHover(null)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 12,
              width: '100%',
              border: 'none',
              cursor: 'pointer',
              textAlign: 'left',
              padding: '11px 12px',
              borderRadius: 11,
              fontSize: 14,
              fontWeight: 600,
              background: active ? 'var(--accent-tint)' : hover === n.key ? 'oklch(0.93 0 0)' : 'transparent',
              color: active ? 'var(--accent)' : '#777777',
              transition: 'background 0.12s',
            }}
          >
            <span style={{ display: 'inline-flex', flexShrink: 0 }}>
              <NavIcon name={n.key} color={active ? 'var(--accent)' : '#afafaf'} size={19} />
            </span>
            {n.label}
          </button>
        );
      })}

      <div style={{ marginTop: 'auto', padding: 14, borderRadius: 14, background: 'oklch(0.97 0 0)', border: '1px solid oklch(0.9 0 0)' }}>
        <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.04em', textTransform: 'uppercase', color: '#afafaf' }}>Current streak</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 6 }}>
          <FlameIcon />
          <span style={{ fontFamily: 'var(--font-display)', fontSize: 32, fontWeight: 600, color: '#4b4b4b' }}>{streak}</span>
          <span style={{ fontSize: 13, color: '#777777' }}>days</span>
        </div>
      </div>
    </nav>
  );
}
