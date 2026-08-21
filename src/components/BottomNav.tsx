import { useApp, type Screen } from '../store.tsx';
import { NavIcon, type NavKey } from './icons.tsx';

const NAV: { key: NavKey; label: string; screen: Screen }[] = [
  { key: 'home', label: 'Decks', screen: 'home' },
  { key: 'add', label: 'Add', screen: 'add' },
  { key: 'community', label: 'Community', screen: 'community' },
  { key: 'sprakkafe', label: 'Språkkafé', screen: 'sprakkafe' },
  { key: 'league', label: 'League', screen: 'league' },
  { key: 'stats', label: 'Stats', screen: 'stats' },
  { key: 'browse', label: 'Browse', screen: 'browse' },
];

export function BottomNav() {
  const { state, actions } = useApp();

  return (
    <nav
      style={{
        flexShrink: 0,
        display: 'flex',
        background: 'oklch(0.98 0 0)',
        borderTop: '1px solid oklch(0.9 0 0)',
        padding: '8px 8px calc(8px + env(safe-area-inset-bottom))',
      }}
    >
      {NAV.map((n) => {
        const active = state.screen === n.screen || (n.key === 'home' && state.screen === 'study');
        return (
          <button
            key={n.key}
            onClick={() => actions.goto(n.screen)}
            style={{ flex: 1, border: 'none', background: 'transparent', cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5, padding: '6px 2px', color: active ? 'var(--accent)' : '#afafaf' }}
          >
            <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', height: 24 }}>
              <NavIcon name={n.key} color={active ? 'var(--accent)' : '#afafaf'} size={23} />
            </span>
            <span style={{ fontSize: 10.5, fontWeight: 600 }}>{n.label}</span>
          </button>
        );
      })}
    </nav>
  );
}
