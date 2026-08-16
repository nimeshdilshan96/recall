interface Props {
  title: string;
  message: string;
  confirmLabel?: string;
  /** Confirm button color; defaults to destructive red. */
  confirmColor?: string;
  onConfirm(): void;
  onCancel(): void;
}

/** Centered modal for confirmation (destructive red by default, e.g. deleting a deck). */
export function ConfirmDialog({ title, message, confirmLabel = 'Delete', confirmColor = '#ff4b4b', onConfirm, onCancel }: Props) {
  return (
    <div
      onClick={onCancel}
      style={{ position: 'fixed', inset: 0, background: 'oklch(0.2 0 0 / 0.35)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 60, padding: 20 }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{ width: '100%', maxWidth: 380, background: 'oklch(0.99 0 0)', border: '2px solid oklch(0.9 0 0)', borderRadius: 18, padding: '22px 22px 20px', boxShadow: '0 24px 60px -20px oklch(0.3 0 0 / 0.5)', animation: 'rvFloat 0.18s ease both' }}
      >
        <div style={{ fontFamily: 'var(--font-display)', fontSize: 20, fontWeight: 700, color: '#4b4b4b', marginBottom: 8 }}>{title}</div>
        <div style={{ fontSize: 14, lineHeight: 1.5, color: '#777777', marginBottom: 22 }}>{message}</div>
        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
          <button
            onClick={onCancel}
            style={{ border: 'none', cursor: 'pointer', background: 'oklch(0.93 0 0)', color: '#4b4b4b', fontSize: 14, fontWeight: 700, padding: '11px 18px', borderRadius: 13 }}
          >
            Cancel
          </button>
          <button
            className="btn3d"
            onClick={onConfirm}
            style={{ background: confirmColor, boxShadow: `0 4px 0 color-mix(in srgb, ${confirmColor} 72%, black)`, fontSize: 14, padding: '11px 20px 13px', borderRadius: 13 }}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
