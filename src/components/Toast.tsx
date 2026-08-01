import { useApp } from '../store.tsx';

export function Toast() {
  const { state } = useApp();
  if (!state.toast) return null;
  return (
    <div
      style={{
        position: 'fixed',
        bottom: 28,
        left: '50%',
        transform: 'translateX(-50%)',
        background: '#4b4b4b',
        color: 'oklch(0.97 0 0)',
        fontSize: 13,
        fontWeight: 600,
        padding: '11px 20px',
        borderRadius: 12,
        boxShadow: '0 10px 24px -10px oklch(0.2 0.04 60 / 0.5)',
        animation: 'rvToast 0.3s ease both',
        zIndex: 50,
      }}
    >
      {state.toast}
    </div>
  );
}
