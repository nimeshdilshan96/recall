// Duolingo core brand accents — a random one is chosen per load (README §Accent color).
export const ACCENTS = ['#58CC02', '#1CB0F6', '#CE82FF', '#FF4B4B', '#FF9600'];

export function pickAccent(): string {
  return ACCENTS[Math.floor(Math.random() * ACCENTS.length)];
}

// Derived accent shades, applied as CSS variables on a root element.
export function accentVars(accent: string): Record<string, string> {
  return {
    '--accent': accent,
    '--accent-soft': `color-mix(in srgb, ${accent} 45%, transparent)`,
    '--accent-tint': `color-mix(in srgb, ${accent} 12%, transparent)`,
    '--accent-deep': `color-mix(in srgb, ${accent} 72%, black)`,
  };
}

export const tokens = {
  textPrimary: '#4b4b4b',
  textSecondary: '#777777',
  textMuted: '#afafaf',
  gold: '#ffc800',
  streak: '#ff9600',
  gems: '#1cb0f6',
  error: '#ff4b4b',
  // maturity colors used across stats
  mature: '#58cc02',
  young: '#9ae65c',
  learning: '#ffc800',
  relearn: '#ff4b4b',
  newBlue: '#1cb0f6',
};
