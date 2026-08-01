// Fuzzy answer matching, ported from the Recall prototype.
// Normalize (lowercase, strip non-alphanumerics incl. CJK), split the back on "·",
// accept an exact part match or substring containment (length > 1 to avoid trivial hits).

function norm(s: string): string {
  return (s || '').toLowerCase().replace(/[^a-z0-9぀-ヿ一-鿿]/g, '');
}

/**
 * Norwegian typing shortcut: turns a doubled "a" into "å" as you type
 * (AA/Aa → Å, aa/aA → å). Standard convention for entering Norwegian without a å key.
 */
export function autoNordic(s: string): string {
  return s.replace(/[Aa][Aa]/g, (m) => (m[0] === 'A' ? 'Å' : 'å'));
}

// ---- Cloze (fill-in-the-blank) helpers ----
// A cloze card stores the sentence in `front` with the answer word replaced by CLOZE_BLANK,
// and the answer word in `back`.
export const CLOZE_BLANK = '{{}}';

/** Turn a typed sentence into { front (with blank marker), back (answer word) }.
 *  Wrap the answer in [brackets] to pick it; otherwise the last word is used. */
export function parseCloze(sentence: string): { front: string; back: string } {
  const s = sentence.trim();
  const m = s.match(/\[([^\]]+)\]/);
  if (m) return { front: s.replace(m[0], CLOZE_BLANK), back: m[1].trim() };
  const parts = s.split(/\s+/);
  if (parts.length < 2) return { front: CLOZE_BLANK, back: s };
  const last = parts[parts.length - 1];
  const word = last.replace(/[.,!?;:»«"'）)]+$/u, '');
  const trail = last.slice(word.length);
  parts[parts.length - 1] = CLOZE_BLANK + trail;
  return { front: parts.join(' '), back: word };
}

/** The prompt shown before reveal: sentence with the blank as an underscore run. */
export function clozePrompt(front: string): string {
  return front.replace(CLOZE_BLANK, '――――'); // ―――― (horizontal bars)
}

/** Split a cloze front into [before, after] around the blank, for rendering the filled answer. */
export function clozeParts(front: string): [string, string] {
  const i = front.indexOf(CLOZE_BLANK);
  return i < 0 ? [front, ''] : [front.slice(0, i), front.slice(i + CLOZE_BLANK.length)];
}

export function checkTyped(typed: string, back: string): boolean {
  const t = norm(typed);
  if (!t) return false;
  const parts = (back || '').split('·').map((p) => norm(p));
  if (parts.indexOf(t) !== -1) return true;
  const nb = norm(back);
  return t.length > 1 && (nb.indexOf(t) !== -1 || t.indexOf(nb) !== -1);
}
