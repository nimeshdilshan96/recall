export type NavKey = 'home' | 'add' | 'community' | 'league' | 'stats' | 'browse';

export function NavIcon({ name, color, size }: { name: NavKey; color: string; size: number }) {
  const stroke = { stroke: color, fill: 'none', strokeWidth: 2.2, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const, display: 'block' as const };
  if (name === 'home') {
    return (
      <svg width={size} height={size} viewBox="0 0 24 24" style={{ display: 'block' }}>
        <rect x={8} y={3} width={13} height={13} rx={2.6} fill={color} opacity={0.4} />
        <rect x={3} y={8} width={13} height={13} rx={2.6} fill={color} />
      </svg>
    );
  }
  if (name === 'add')
    return (
      <svg width={size} height={size} viewBox="0 0 24 24" style={stroke}>
        <path d="M12 5v14" />
        <path d="M5 12h14" />
      </svg>
    );
  if (name === 'community')
    return (
      <svg width={size} height={size} viewBox="0 0 24 24" style={{ ...stroke, strokeWidth: 2 }}>
        <circle cx={12} cy={12} r={9} />
        <path d="M15.5 8.5l-1.8 5.2-5.2 1.8 1.8-5.2z" />
      </svg>
    );
  if (name === 'stats')
    return (
      <svg width={size} height={size} viewBox="0 0 24 24" style={{ ...stroke, strokeWidth: 2 }}>
        <path d="M20 20H4V4" />
        <path d="M4 16.5L12 9L15 12L19.5 7.5" />
      </svg>
    );
  if (name === 'league')
    return (
      <svg width={size} height={size} viewBox="0 0 24 24" style={{ ...stroke, strokeWidth: 2 }}>
        <path d="M14.2718 10.445L18 2M9.31612 10.6323L5 2M12.7615 10.0479L8.835 2M14.36 2L13.32 4.5M6 16C6 19.3137 8.68629 22 12 22C15.3137 22 18 19.3137 18 16C18 12.6863 15.3137 10 12 10C8.68629 10 6 12.6863 6 16Z" />
      </svg>
    );
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" style={stroke}>
      <circle cx={10.5} cy={10.5} r={6.5} />
      <path d="M20 20l-4.6-4.6" />
    </svg>
  );
}

/** Streak flame. Hover flickers + glows via `.flame` (index.css). `withStroke` separates it
 *  from busy backgrounds (sidebar card) — too heavy below ~20px, so off by default. */
export function FlameIcon({ width = 23, height = 28, withStroke = false }: { width?: number; height?: number; withStroke?: boolean }) {
  return (
    <svg className="flame" width={width} height={height} viewBox="0 0 23 28" aria-hidden style={{ flexShrink: 0 }}>
      <path
        fillRule="nonzero"
        d="M0.068,15.675 L0.044,7.216 C0.039,5.334 1.25,3.942 3.056,4.246 C3.413,4.306 3.998,4.491 4.306,4.656 L5.997,5.561 L9.247,1.464 C9.79255754,0.776391272 10.6222536,0.37555895 11.5,0.37555895 C12.3777464,0.37555895 13.2074425,0.776391272 13.753,1.464 L20.523,10 C22.1231469,11.939276 22.9988566,14.3747884 23,16.889 C23,23.034 17.843,28 11.5,28 C5.157,28 0,23.034 0,16.889 C0,16.481 0.023,16.076 0.068,15.675 Z"
        fill="#FF9600"
        stroke={withStroke ? '#FFFFFF' : undefined}
        strokeWidth={withStroke ? 2 : undefined}
      />
      <path
        fillRule="nonzero"
        d="M8.012,16.077 C8.02645313,16.0400285 8.04561094,16.0050739 8.069,15.973 L10.719,12.364 C10.8930682,12.1267419 11.1697362,11.9865812 11.464,11.9865812 C11.7582638,11.9865812 12.0349317,12.1267419 12.209,12.364 L14.732,15.8 C15.5411747,16.594774 15.9979151,17.6807932 16,18.815 C16,21.208 13.985,23.148 11.5,23.148 C9.015,23.148 7,21.208 7,18.815 C7,17.776 7.38,16.823 8.012,16.077 Z"
        fill="#FFC800"
      />
    </svg>
  );
}

/** Gem. Hover glows and cycles the two crown facets in counter-phase via `.gem` (index.css). */
export function GemIcon({ width = 22, height = 20 }: { width?: number; height?: number }) {
  return (
    <svg className="gem" width={width} height={height} viewBox="0 0 22 20" aria-hidden style={{ flexShrink: 0 }}>
      <path fill="#1cb0f6" d="M6 1.4h10l5 6.2-10 11.2L1 7.6z" />
      <path fill="#1899d6" d="M11 18.8 1 7.6h20z" />
      <path className="gem-facet gem-facet-2" fill="#57ccff" d="M6 1.4 1 7.6h20l-5-6.2z" />
      <path className="gem-facet" fill="#8ddcff" d="M6 1.4 11 7.6l5-6.2z" />
    </svg>
  );
}

/** Deck visibility badge: closed = private, open = public (shared to Community). */
export function PadlockIcon({ open, color, size = 15 }: { open: boolean; color: string; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" style={{ stroke: color, fill: 'none', strokeWidth: 2.2, strokeLinecap: 'round', strokeLinejoin: 'round', display: 'block' }}>
      <rect x={4.5} y={10.5} width={15} height={10} rx={2.8} />
      {open ? <path d="M8.5 10.5V7a3.5 3.5 0 0 1 6.8-1.2" /> : <path d="M8.5 10.5V7a3.5 3.5 0 0 1 7 0v3.5" />}
    </svg>
  );
}

export function LogoutIcon() {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" style={{ stroke: '#ff4b4b', fill: 'none', strokeWidth: 2.2, strokeLinecap: 'round', strokeLinejoin: 'round', display: 'block' }}>
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
      <path d="M16 17l5-5-5-5" />
      <path d="M21 12H9" />
    </svg>
  );
}
