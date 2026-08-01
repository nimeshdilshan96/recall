import { useEffect } from 'react';
import { useApp } from '../store.tsx';

const PALETTE = ['#ff9600', '#1cb0f6', '#ce82ff', '#58cc02', '#ff4b4b', '#ffc800', '#1cb0f6', '#ce82ff', '#ff9600'];

export function League() {
  const { state, actions } = useApp();

  // refresh from the server on open (XP changes as family members study)
  useEffect(() => {
    actions.loadLeaderboard();
  }, []);

  const ranked = [...state.leaderboard].sort((a, b) => b.xp - a.xp);
  const myRank = ranked.findIndex((r) => r.username.toLowerCase() === state.profileName.toLowerCase()) + 1;

  return (
    <div style={{ padding: '28px var(--pad) 48px', animation: 'rvFloat 0.4s ease both' }}>
      <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 34, fontWeight: 600, margin: '0 0 4px', color: '#4b4b4b' }}>Diamond League</h1>
      <p style={{ fontSize: 13.5, color: '#afafaf', margin: '0 0 22px' }}>{myRank > 0 ? `You're ranked #${myRank} this week.` : 'Study to climb the ranks.'}</p>

      <div style={{ background: 'oklch(0.99 0 0)', border: '2px solid oklch(0.9 0 0)', borderRadius: 16, overflow: 'hidden' }}>
        {ranked.map((r, i) => {
          const isMe = r.username.toLowerCase() === state.profileName.toLowerCase();
          return (
            <div key={r.username + i} style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '12px 18px', borderBottom: '1px solid oklch(0.93 0 0)', background: isMe ? 'var(--accent-tint)' : 'transparent' }}>
              <span style={{ width: 26, textAlign: 'center', fontFamily: 'var(--font-display)', fontSize: 17, fontWeight: 700, color: i < 3 ? '#4b4b4b' : '#afafaf' }}>{i + 1}</span>
              <span style={{ width: 34, height: 34, borderRadius: '50%', background: isMe ? 'var(--accent)' : PALETTE[i % PALETTE.length], color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: 15, flexShrink: 0, boxShadow: 'inset 0 -3px 0 rgba(0,0,0,0.18)' }}>
                {r.username.trim().charAt(0).toUpperCase()}
              </span>
              <span style={{ flex: 1, minWidth: 0, fontWeight: 700, fontSize: 14.5, color: '#4b4b4b', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {isMe ? r.username + ' (you)' : r.username}
              </span>
              <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ width: 13, height: 13, borderRadius: '50%', background: 'var(--accent)', boxShadow: 'inset 0 -2px 0 var(--accent-deep)' }} />
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: 13, fontWeight: 700, color: '#777777' }}>{r.xp}</span>
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
