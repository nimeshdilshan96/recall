import { useApp } from '../store.tsx';

export function Auth() {
  const { state, actions } = useApp();
  const login = state.authMode === 'login';

  const input: React.CSSProperties = {
    width: '100%',
    border: '2px solid oklch(0.9 0 0)',
    background: 'oklch(0.98 0 0)',
    borderRadius: 14,
    padding: '14px 16px',
    fontSize: 15,
    fontWeight: 600,
    color: '#4b4b4b',
  };

  return (
    <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 28, overflowY: 'auto' }}>
      <div style={{ width: '100%', maxWidth: 360, textAlign: 'center', animation: 'rvFloat 0.4s ease both' }}>
        <div style={{ width: 58, height: 58, borderRadius: 17, background: 'var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px', boxShadow: '0 5px 0 var(--accent-deep)' }}>
          <span style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 34, color: '#fff' }}>R</span>
        </div>
        <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 27, fontWeight: 700, color: '#4b4b4b', margin: '0 0 6px' }}>
          {login ? 'Welcome back' : 'Create your account'}
        </h1>
        <p style={{ fontSize: 14, color: '#777777', margin: '0 0 26px' }}>
          {login ? 'Log in to keep your streak going.' : 'Sign up to start learning.'}
        </p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 11, textAlign: 'left' }}>
          <input value={state.authUser} onChange={(e) => actions.setAuthUser(e.target.value)} placeholder="Username" style={input} onFocus={(e) => (e.currentTarget.style.borderColor = 'var(--accent)')} onBlur={(e) => (e.currentTarget.style.borderColor = 'oklch(0.9 0 0)')} />
          <input
            type="password"
            value={state.authPass}
            onChange={(e) => actions.setAuthPass(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && actions.submitAuth()}
            placeholder="Password"
            style={input}
            onFocus={(e) => (e.currentTarget.style.borderColor = 'var(--accent)')}
            onBlur={(e) => (e.currentTarget.style.borderColor = 'oklch(0.9 0 0)')}
          />
        </div>

        {state.authError && <div style={{ color: '#ff4b4b', fontSize: 13, fontWeight: 700, marginTop: 12, textAlign: 'left' }}>{state.authError}</div>}

        <button className="btn3d" onClick={() => actions.submitAuth()} style={{ width: '100%', marginTop: 20, fontSize: 15, padding: 15, borderRadius: 16 }}>
          {login ? 'Log in' : 'Create account'}
        </button>

        <div style={{ marginTop: 22, fontSize: 13, color: '#777777' }}>
          {login ? "Don't have an account? " : 'Already have an account? '}
          <button onClick={() => actions.toggleAuthMode()} style={{ border: 'none', background: 'none', cursor: 'pointer', color: 'var(--accent)', fontWeight: 800, fontSize: 13, padding: '0 2px' }}>
            {login ? 'Register' : 'Log in'}
          </button>
        </div>
      </div>
    </div>
  );
}
