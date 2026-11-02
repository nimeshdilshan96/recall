import { useEffect, useRef, useState } from 'react';
import { useApp, type Screen } from '../store.tsx';
import { NavIcon, type NavKey } from './icons.tsx';

// Mobile navigation. Replaced the bottom tab bar (which cost ~80px of an already keyboard-shrunk
// screen): a hamburger button in the top row — next to the avatar on StatsBar screens, next to
// the counters on the Study header — opening a dropdown of the main screens.
export const NAV: { key: NavKey; label: string; screen: Screen }[] = [
  { key: 'home', label: 'Decks', screen: 'home' },
  { key: 'add', label: 'Add', screen: 'add' },
  { key: 'community', label: 'Community', screen: 'community' },
  { key: 'sprakkafe', label: 'Språkkafé', screen: 'sprakkafe' },
  { key: 'league', label: 'League', screen: 'league' },
  { key: 'stats', label: 'Stats', screen: 'stats' },
  { key: 'browse', label: 'Browse', screen: 'browse' },
];

export function MobileMenu() {
  const { state, actions } = useApp();
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  // Close on tap outside / Escape.
  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('pointerdown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('pointerdown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  return (
    <div ref={wrapRef} style={{ position: 'relative', flexShrink: 0 }}>
      <button
        aria-label="Menu"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        style={{ border: 'none', background: open ? 'var(--accent-tint)' : 'oklch(0.93 0 0)', cursor: 'pointer', width: 34, height: 34, borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0 }}
      >
        <svg width="18" height="18" viewBox="0 0 24 24" style={{ stroke: open ? 'var(--accent)' : '#777777', fill: 'none', strokeWidth: 2.4, strokeLinecap: 'round', display: 'block' }}>
          <path d="M4 7h16M4 12h16M4 17h16" />
        </svg>
      </button>
      {open && (
        <div style={{ position: 'absolute', top: 'calc(100% + 10px)', right: 0, width: 200, background: 'oklch(0.99 0 0)', border: '2px solid oklch(0.9 0 0)', borderRadius: 14, boxShadow: '0 14px 32px -14px rgba(0,0,0,0.3)', zIndex: 40, overflow: 'hidden', animation: 'rvFloat 0.18s ease both' }}>
          {NAV.map((n) => {
            const active = state.screen === n.screen || (n.key === 'home' && state.screen === 'study');
            return (
              <button
                key={n.key}
                onClick={() => {
                  setOpen(false);
                  actions.goto(n.screen);
                }}
                style={{ display: 'flex', alignItems: 'center', gap: 12, width: '100%', border: 'none', background: active ? 'var(--accent-tint)' : 'transparent', cursor: 'pointer', textAlign: 'left', padding: '12px 14px', fontSize: 14, fontWeight: 700, color: active ? 'var(--accent)' : '#4b4b4b' }}
              >
                <NavIcon name={n.key} color={active ? 'var(--accent)' : '#777777'} size={19} />
                {n.label}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
