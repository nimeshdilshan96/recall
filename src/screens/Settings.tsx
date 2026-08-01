import { useApp, type StudyDirection } from '../store.tsx';

const DIRECTIONS: { value: StudyDirection; label: string; hint: string }[] = [
  { value: 'front', label: 'Front → Back', hint: 'See the prompt, recall the answer' },
  { value: 'back', label: 'Back → Front', hint: 'See the answer, recall the prompt' },
  { value: 'both', label: 'Both ways', hint: 'Randomly drills each card in both directions' },
];

export function Settings() {
  const { state, actions } = useApp();

  const card: React.CSSProperties = { background: 'oklch(0.99 0 0)', border: '2px solid oklch(0.9 0 0)', borderRadius: 18, padding: '20px 22px', marginBottom: 18 };
  const heading: React.CSSProperties = { fontFamily: 'var(--font-display)', fontSize: 16, fontWeight: 700, color: '#4b4b4b', marginBottom: 4 };
  const sub: React.CSSProperties = { fontSize: 13, color: '#afafaf', marginBottom: 16 };

  const step = (delta: number) => actions.setNewLimit(Math.max(0, Math.min(999, state.newLimit + delta)));

  const stepBtn = (label: string, onClick: () => void) => (
    <button onClick={onClick} style={{ width: 38, height: 38, borderRadius: 11, border: '2px solid oklch(0.9 0 0)', background: 'oklch(0.98 0 0)', cursor: 'pointer', fontSize: 20, fontWeight: 700, color: '#4b4b4b', lineHeight: 1 }}>
      {label}
    </button>
  );

  return (
    <div style={{ padding: '28px var(--pad) 48px', maxWidth: 640, animation: 'rvFloat 0.4s ease both' }}>
      <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 34, fontWeight: 600, margin: '0 0 22px', color: '#4b4b4b' }}>Settings</h1>

      <div style={card}>
        <div style={heading}>New cards per day</div>
        <div style={sub}>How many new cards a deck introduces per study session. Lower = lighter daily review load.</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          {stepBtn('−', () => step(-5))}
          <div style={{ minWidth: 64, textAlign: 'center', fontFamily: 'var(--font-display)', fontSize: 28, fontWeight: 600, color: '#4b4b4b' }}>{state.newLimit}</div>
          {stepBtn('+', () => step(5))}
          <div style={{ display: 'flex', gap: 6, marginLeft: 10 }}>
            {[10, 20, 30, 50].map((n) => (
              <button
                key={n}
                onClick={() => actions.setNewLimit(n)}
                style={{
                  border: `1px solid ${state.newLimit === n ? 'var(--accent)' : 'oklch(0.88 0 0)'}`,
                  background: state.newLimit === n ? 'var(--accent-tint)' : 'oklch(0.99 0 0)',
                  color: state.newLimit === n ? 'var(--accent)' : '#777777',
                  cursor: 'pointer',
                  fontSize: 13,
                  fontWeight: 600,
                  padding: '7px 12px',
                  borderRadius: 9,
                }}
              >
                {n}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div style={card}>
        <div style={heading}>Study direction</div>
        <div style={sub}>Which side of the card you're shown as the prompt.</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {DIRECTIONS.map((d) => {
            const sel = state.studyDirection === d.value;
            return (
              <button
                key={d.value}
                onClick={() => actions.setStudyDirection(d.value)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                  textAlign: 'left',
                  border: `2px solid ${sel ? 'var(--accent)' : 'oklch(0.9 0 0)'}`,
                  background: sel ? 'var(--accent-tint)' : 'oklch(0.99 0 0)',
                  cursor: 'pointer',
                  padding: '12px 14px',
                  borderRadius: 13,
                }}
              >
                <span style={{ width: 18, height: 18, borderRadius: '50%', flexShrink: 0, border: `2px solid ${sel ? 'var(--accent)' : 'oklch(0.8 0 0)'}`, background: sel ? 'var(--accent)' : 'transparent', boxShadow: sel ? 'inset 0 0 0 3px oklch(0.99 0 0)' : 'none' }} />
                <span>
                  <div style={{ fontSize: 14, fontWeight: 700, color: sel ? 'var(--accent)' : '#4b4b4b' }}>{d.label}</div>
                  <div style={{ fontSize: 12.5, color: '#afafaf', marginTop: 1 }}>{d.hint}</div>
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
