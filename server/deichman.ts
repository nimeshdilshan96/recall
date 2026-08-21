import { upsertEvents, type EventRow } from './repo.ts';

/**
 * Pulls Norwegian language-café events from deichman.no (Oslo public library) into the local
 * `events` table. Their site exposes an undocumented but public JSON API (the same one the
 * "Hva skjer?" page uses), so this stays defensive: missing fields are tolerated and a failed
 * fetch just leaves the cached rows in place.
 *
 * Sync is lazy — ensureEventsSynced() is called from GET /api/events and re-fetches at most
 * once per hour, so the footprint on Deichman is one polite request per hour total.
 */

const API_URL =
  'https://deichman.no/api/library-events?page=6&field.tags=spr%C3%A5kkafe&field.privateEvent=false&field.dontShowOnWeb=false';
const USER_AGENT = 'Recall (personal Norwegian-study app; caches the language-cafe schedule hourly)';
const SYNC_INTERVAL_MS = 60 * 60 * 1000;

// Deichman tags generously: "Japansk språkkafé" carries norwegian/norsktrening tags too, so a
// foreign-language blocklist over title+tags is needed on top of the Norwegian-tag requirement.
const NORWEGIAN_TAGS = ['norwegian', 'norsktrening'];
const FOREIGN_MARKERS = [
  'japan', 'engelsk', 'english', 'spansk', 'spanish', 'fransk', 'french', 'tysk', 'german',
  'ukrain', 'arab', 'polsk', 'polish', 'somali', 'kinesisk', 'chinese', 'koreansk', 'korean',
  'new amigos',
];

interface DeichmanEvent {
  id?: string;
  title?: string;
  library?: string;
  organizer?: string;
  ingress?: string;
  targetAudience?: string;
  libraryEventPrice?: string;
  startTime?: string; // ISO UTC
  endTime?: string;
  cancelled?: boolean;
  tags?: string[];
}

function isNorwegianCafe(e: DeichmanEvent): boolean {
  const tags = (e.tags ?? []).map((t) => t.toLowerCase());
  if (!NORWEGIAN_TAGS.some((t) => tags.includes(t))) return false;
  const haystack = `${e.title ?? ''} ${tags.join(' ')}`.toLowerCase();
  return !FOREIGN_MARKERS.some((m) => haystack.includes(m));
}

// Deichman's event URLs are /event/<slug>_<id> where the slug is the lowercased title with
// every whitespace char replaced by a dash (Norwegian letters kept as-is).
function slugFor(title: string, id: string): string {
  return `${title.toLowerCase().replace(/\s/g, '-')}_${id}`;
}

function toRow(e: DeichmanEvent, now: number): EventRow | null {
  if (!e.id || !e.title || !e.startTime || !e.endTime) return null;
  const start = Date.parse(e.startTime);
  const end = Date.parse(e.endTime);
  if (Number.isNaN(start) || Number.isNaN(end)) return null;
  return {
    id: e.id,
    slug: slugFor(e.title, e.id),
    title: e.title,
    library: e.library ?? null,
    organizer: e.organizer ?? null,
    ingress: e.ingress ?? null,
    target_audience: e.targetAudience ?? null,
    price: e.libraryEventPrice ?? null,
    start_time: start,
    end_time: end,
    cancelled: e.cancelled ? 1 : 0,
    last_seen_at: now,
  };
}

let lastSyncAt = 0;
let inflight: Promise<void> | null = null;

/** Refresh the events cache if it's stale. Never throws — a failed sync keeps the cache. */
export function ensureEventsSynced(log?: { warn: (msg: string) => void }): Promise<void> {
  if (Date.now() - lastSyncAt < SYNC_INTERVAL_MS) return Promise.resolve();
  inflight ??= (async () => {
    try {
      const res = await fetch(API_URL, {
        headers: { 'User-Agent': USER_AGENT },
        signal: AbortSignal.timeout(10_000),
      });
      if (!res.ok) throw new Error(`Deichman responded ${res.status}`);
      const data = (await res.json()) as { searchResults?: DeichmanEvent[] };
      const now = Date.now();
      const rows = (data.searchResults ?? [])
        .filter(isNorwegianCafe)
        .map((e) => toRow(e, now))
        .filter((r): r is EventRow => r !== null);
      upsertEvents(rows);
      lastSyncAt = now;
    } catch (e) {
      log?.warn(`Deichman event sync failed, serving cache: ${(e as Error).message}`);
    } finally {
      inflight = null;
    }
  })();
  return inflight;
}
