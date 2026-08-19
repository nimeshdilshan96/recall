import { useEffect, useState } from 'react';
import { useApp } from '../store.tsx';
import { streakFrom, maturity } from '../selectors.ts';
import { tokens } from '../theme.ts';

const DAY = 86_400_000;
const BASELINE = 'oklch(0.82 0 0)'; // x-axis line under the bar charts

/** "Today" or a short date, `offsetDays` days from now (negative = past). */
function dayLabel(offsetDays: number): string {
  if (offsetDays === 0) return 'Today';
  return new Date(Date.now() + offsetDays * DAY).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' });
}

/** Smallest "nice" axis maximum ≥ n with an integer midpoint tick. */
function niceMax(n: number): number {
  const bases = [2, 4, 6, 8, 10, 20, 30, 40, 60, 80, 100, 120, 160, 200, 240, 300, 400, 600, 800, 1000];
  for (const b of bases) if (b >= n) return b;
  return Math.ceil(n / 1000) * 1000;
}

const CHART_WINDOWS = [
  { label: '1W', days: 7, ago: '7 days ago' },
  { label: '1M', days: 30, ago: '30 days ago' },
  { label: '3M', days: 90, ago: '3 months ago' },
  { label: '1Y', days: 365, ago: '1 year ago' },
];

/** Mature-cards-over-time line chart: green area + line, period tabs, per-day hover tooltips. */
function MatureOverTime({ counts, firstEventAt }: { counts: number[]; firstEventAt: number | null }) {
  const [win, setWin] = useState(CHART_WINDOWS[0]);
  const green = '#58cc02';

  const header = (
    <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, marginBottom: 16 }}>
      <div style={{ fontSize: 13, fontWeight: 700, color: '#4b4b4b' }}>Mature cards over time</div>
      <div style={{ fontSize: 12, color: '#afafaf' }}>cards you've truly learned (interval ≥ 21 days)</div>
      <div style={{ marginLeft: 'auto', display: 'flex', gap: 14 }}>
        {CHART_WINDOWS.map((w) => {
          const sel = w.days === win.days;
          return (
            <button
              key={w.label}
              onClick={() => setWin(w)}
              style={{ border: 'none', background: 'transparent', cursor: 'pointer', padding: '0 1px 4px', fontSize: 13, fontWeight: 700, color: sel ? '#4b4b4b' : '#afafaf', borderBottom: `2.5px solid ${sel ? 'var(--accent)' : 'transparent'}` }}
            >
              {w.label}
            </button>
          );
        })}
      </div>
    </div>
  );

  if (counts.length === 0 || firstEventAt === null) {
    return (
      <div style={{ background: 'oklch(0.99 0 0)', border: '2px solid oklch(0.9 0 0)', borderRadius: 18, padding: '20px 22px', marginBottom: 18 }}>
        {header}
        <div style={{ padding: '28px 0', textAlign: 'center', color: '#afafaf', fontSize: 13.5 }}>
          Collecting data — this fills in as your cards mature.
        </div>
      </div>
    );
  }

  // Clamp the window to the days we actually have knowable data for (avoids a misleading flat zero era).
  const now = Date.now();
  const startOfToday = now - (now % DAY);
  const daysAvail = Math.floor((startOfToday - (firstEventAt - (firstEventAt % DAY))) / DAY) + 1;
  const m = Math.max(2, Math.min(win.days, daysAvail, counts.length));
  const series = counts.slice(-m);
  const clamped = m < Math.min(win.days, counts.length);

  const top = niceMax(Math.max(1, ...series));
  const ticks = [0, top / 2, top];
  const yPct = (v: number) => 100 - (v / top) * 100;
  const pts = series.map((v, i) => `${(i / (m - 1)) * 100},${yPct(v)}`);

  return (
    <div style={{ background: 'oklch(0.99 0 0)', border: '2px solid oklch(0.9 0 0)', borderRadius: 18, padding: '20px 22px', marginBottom: 18 }}>
      {header}
      <div style={{ display: 'flex', gap: 10 }}>
        {/* y-axis tick labels */}
        <div style={{ position: 'relative', width: 26, height: 150, fontSize: 10.5, fontFamily: 'var(--font-mono)', color: '#afafaf' }}>
          {ticks.map((t) => (
            <span key={t} style={{ position: 'absolute', right: 0, top: `calc(${yPct(t)}% - 6px)` }}>{t}</span>
          ))}
        </div>
        {/* plot area */}
        <div style={{ position: 'relative', flex: 1, height: 150 }}>
          {ticks.map((t) => (
            <div key={t} style={{ position: 'absolute', left: 0, right: 0, top: `${yPct(t)}%`, borderTop: `1px solid ${t === 0 ? BASELINE : 'oklch(0.93 0 0)'}` }} />
          ))}
          <svg viewBox="0 0 100 100" preserveAspectRatio="none" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', display: 'block', overflow: 'visible' }}>
            <path d={`M${pts.join(' L')} L100,100 L0,100 Z`} fill="color-mix(in srgb, #58cc02 13%, transparent)" />
            <path d={`M${pts.join(' L')}`} fill="none" stroke={green} strokeWidth={2.5} strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
          </svg>
          <span style={{ position: 'absolute', right: -5, top: `calc(${yPct(series[m - 1])}% - 5px)`, width: 10, height: 10, borderRadius: '50%', background: green, border: '2px solid #fff', boxSizing: 'border-box' }} />
          {/* invisible per-day hover targets; each reveals a guide line + marker on its point of the line */}
          <div style={{ position: 'absolute', inset: 0, display: 'flex' }}>
            {series.map((v, i) => {
              const x = `${(i / (m - 1)) * 100}%`; // the point's x, relative to this column
              return (
                <div key={i} className="tip chart-col" data-tip={`${dayLabel(-(m - 1 - i))} · ${v} mature card${v === 1 ? '' : 's'}`} style={{ flex: 1, height: '100%', position: 'relative' }}>
                  <span className="chart-marker" style={{ position: 'absolute', left: x, top: `${yPct(v)}%`, bottom: 0, width: 1.5, background: 'oklch(0.75 0 0)', transform: 'translateX(-50%)' }} />
                  <span className="chart-marker" style={{ position: 'absolute', left: x, top: `${yPct(v)}%`, width: 11, height: 11, borderRadius: '50%', background: green, border: '2.5px solid #fff', boxSizing: 'border-box', transform: 'translate(-50%, -50%)', boxShadow: '0 1px 4px rgba(0,0,0,0.25)' }} />
                </div>
              );
            })}
          </div>
        </div>
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginLeft: 36, marginTop: 8, fontSize: 11.5, color: '#afafaf' }}>
        <span>{clamped ? dayLabel(-(m - 1)) : win.ago}</span>
        <span>today</span>
      </div>
    </div>
  );
}

function Card({ title, children, extra }: { title: string; extra?: string; children: React.ReactNode }) {
  return (
    <div style={{ background: 'oklch(0.99 0 0)', border: '2px solid oklch(0.9 0 0)', borderRadius: 18, padding: '20px 22px', marginBottom: 18 }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, marginBottom: 16 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: '#4b4b4b' }}>{title}</div>
        {extra && <div style={{ fontSize: 12, color: '#afafaf' }}>{extra}</div>}
      </div>
      {children}
    </div>
  );
}

/**
 * One retention gauge: big % + status on the left, a 0→100% bar on the right.
 * variant 'retention' → graded against a 90% target (target marker shown, higher = healthier).
 * variant 'grind'     → an overload thermometer (no target; lower = heavier learning load).
 */
function RetentionBlock({
  title,
  subtitle,
  pct,
  caption,
  variant,
}: {
  title: string;
  subtitle: string;
  pct: number | null;
  caption: string;
  variant: 'grind' | 'retention';
}) {
  const green = 'oklch(0.62 0.12 150)';
  let color = '#afafaf';
  let status = 'Collecting data';
  if (pct !== null) {
    if (variant === 'retention') {
      color = pct >= 90 ? green : pct >= 80 ? '#e6a700' : '#ff4b4b';
      status = pct >= 90 ? 'Healthy' : pct >= 80 ? 'Keep an eye on it' : 'Low — ease off new cards';
    } else {
      color = pct >= 80 ? green : pct >= 65 ? '#e6a700' : '#ff4b4b';
      status = pct >= 80 ? 'Light load' : pct >= 65 ? 'Getting heavy' : 'Heavy — ease off new cards';
    }
  }
  const showTarget = variant === 'retention';
  return (
    <div style={{ background: 'oklch(0.99 0 0)', border: '2px solid oklch(0.9 0 0)', borderRadius: 18, padding: '20px 22px', height: '100%', boxSizing: 'border-box' }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, marginBottom: 18 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: '#4b4b4b' }}>{title}</div>
        <div style={{ fontSize: 12, color: '#afafaf' }}>{subtitle}</div>
      </div>
      <div style={{ display: 'flex', gap: 28, alignItems: 'center', flexWrap: 'wrap' }}>
        <div style={{ minWidth: 96 }}>
          <div style={{ fontFamily: 'var(--font-display)', fontSize: 46, fontWeight: 600, lineHeight: 1, color }}>{pct === null ? '—' : `${pct}%`}</div>
          <div style={{ fontSize: 13, fontWeight: 700, color, marginTop: 7 }}>{status}</div>
        </div>
        <div style={{ flex: 1, minWidth: 240 }}>
          <div style={{ position: 'relative', height: 12, borderRadius: 8, background: 'linear-gradient(90deg, #f8d0d0 0%, #f8d0d0 76%, #fbe6ad 85%, #c9e9ac 92%, #aadd90 100%)' }}>
            {showTarget && <div style={{ position: 'absolute', left: '90%', top: -3, bottom: -3, width: 2, background: green, transform: 'translateX(-1px)' }} />}
            {pct !== null && (
              <div style={{ position: 'absolute', left: `${Math.min(100, Math.max(0, pct))}%`, top: -5, bottom: -5, width: 3, borderRadius: 2, background: '#4b4b4b', transform: 'translateX(-1.5px)' }} />
            )}
          </div>
          <div style={{ position: 'relative', height: 15, marginTop: 7, fontSize: 11, color: '#afafaf' }}>
            <span style={{ position: 'absolute', left: 0 }}>0%</span>
            {showTarget ? (
              <>
                <span style={{ position: 'absolute', left: '80%', transform: 'translateX(-50%)' }}>80%</span>
                <span style={{ position: 'absolute', left: '90%', transform: 'translateX(-20%)', color: green, fontWeight: 600 }}>90% target</span>
              </>
            ) : (
              <span style={{ position: 'absolute', right: 0 }}>100%</span>
            )}
          </div>
          <div style={{ fontSize: 13, color: '#777777', marginTop: 12 }}>{caption}</div>
        </div>
      </div>
    </div>
  );
}

export function Stats() {
  const { state, actions } = useApp();
  useEffect(() => {
    actions.loadStats();
    actions.loadHardest();
  }, []);
  const now = new Date();
  const streak = streakFrom(state.history);

  // Human day name for chart tooltips: 0 = today, negative = past, positive = future.
  const fmtDay = (offsetDays: number) => {
    if (offsetDays === 0) return 'Today';
    const d = new Date(now.getTime() + offsetDays * DAY);
    return d.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' });
  };
  const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`;

  // --- Today ---
  const studied = state.history[state.history.length - 1] + state.session.reviewed;
  const minutes = Math.round(studied * 0.16 * 10) / 10;
  const againPct = state.session.total > 0 ? Math.round((state.session.again / state.session.total) * 100) : null;
  const correctPct = againPct === null ? null : 100 - againPct;

  // --- Retention gauges (rolling 7 days, from the review log) ---
  const ret = state.retention;
  // Learning grind: every already-seen review incl. same-session relearning — the overload thermometer.
  const grindEnough = ret.total >= 20; // below this, one bad morning would misleadingly flash red
  const grindPct = grindEnough ? Math.round((ret.recalled / ret.total) * 100) : null;
  // True retention (Anki-style) and Mature: need the review-time snapshot, so they fill in going forward.
  const trueEnough = ret.trueTotal >= 15;
  const truePct = trueEnough ? Math.round((ret.trueRecalled / ret.trueTotal) * 100) : null;
  const matureEnough = ret.matureTotal >= 15;
  const maturePct = matureEnough ? Math.round((ret.matureRecalled / ret.matureTotal) * 100) : null;

  // --- Card counts (real maturity buckets) ---
  const counts = { new: 0, learning: 0, young: 0, mature: 0 };
  for (const d of state.decks) for (const c of d.cards) counts[maturity(c)]++;
  const suspended = 0;
  const ccDefs = [
    { label: 'New', count: counts.new, color: tokens.newBlue },
    { label: 'Learning', count: counts.learning, color: tokens.learning },
    { label: 'Young', count: counts.young, color: tokens.young },
    { label: 'Mature', count: counts.mature, color: tokens.mature },
    { label: 'Suspended', count: suspended, color: '#c9cdd4' },
  ];
  const ccTotal = ccDefs.reduce((a, s) => a + s.count, 0) || 1;
  let acc = 0;
  const segs: string[] = [];
  for (const s of ccDefs) {
    if (s.count <= 0) continue;
    const start = (acc / ccTotal) * 360;
    acc += s.count;
    const end = (acc / ccTotal) * 360;
    segs.push(`${s.color} ${start.toFixed(1)}deg ${end.toFixed(1)}deg`);
  }
  const donut = `conic-gradient(${segs.join(', ')})`;

  // --- Future due (next 21 days) from real due dates ---
  const fdYoung = new Array(21).fill(0);
  const fdMature = new Array(21).fill(0);
  for (const d of state.decks)
    for (const c of d.cards) {
      if (c.fsrs.lastReview === null) continue;
      const day = Math.floor((c.fsrs.due.getTime() - now.getTime()) / DAY);
      if (day < 0 || day > 20) continue;
      if ((c.fsrs.stability ?? 0) >= 21) fdMature[day]++;
      else fdYoung[day]++;
    }
  const fdTotal = fdYoung.reduce((a, b) => a + b, 0) + fdMature.reduce((a, b) => a + b, 0);
  const fdMax = Math.max(1, ...fdYoung.map((y, i) => y + fdMature[i]));

  // --- Reviews last 21 days (stacked by type, split from history counts) ---
  const rev = state.history.slice(-21);
  const revMax = Math.max(1, ...rev);
  const reviewLegend = [
    { label: 'Mature', color: tokens.mature },
    { label: 'Young', color: tokens.young },
    { label: 'Learning', color: tokens.learning },
    { label: 'Relearn', color: tokens.relearn },
  ];

  // --- Calendar heatmap: the current year, Jan 1 → Dec 31, weekday-aligned (Monday-first) ---
  const year = now.getFullYear();
  const todayMidnight = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const jan1 = new Date(year, 0, 1);
  type HeatCell = { bg: string; tip: string | null } | null; // null = leading spacer before Jan 1's weekday
  const heat: HeatCell[] = new Array((jan1.getDay() + 6) % 7).fill(null);
  for (const d = new Date(jan1); d.getFullYear() === year; d.setDate(d.getDate() + 1)) {
    const daysAgo = Math.round((todayMidnight - d.getTime()) / DAY);
    if (daysAgo < 0) {
      heat.push({ bg: 'oklch(0.955 0 0)', tip: null }); // future day — faint, no tooltip
      continue;
    }
    const c = state.history[state.history.length - 1 - daysAgo] ?? 0;
    let bg: string;
    if (c === 0) bg = 'oklch(0.91 0 0)';
    else if (c < 18) bg = 'color-mix(in srgb, var(--accent) 28%, transparent)';
    else if (c < 45) bg = 'color-mix(in srgb, var(--accent) 55%, transparent)';
    else if (c < 70) bg = 'color-mix(in srgb, var(--accent) 78%, transparent)';
    else bg = 'var(--accent)';
    heat.push({ bg, tip: `${fmtDay(-daysAgo)} · ${plural(c, 'review')}` });
  }
  // Month label for each week column: shown when the column starts a new month.
  const weekCount = Math.ceil(heat.length / 7);
  const monthLabels = Array.from({ length: weekCount }, (_, w) => {
    const first = new Date(year, 0, 1 + Math.max(0, w * 7 - ((jan1.getDay() + 6) % 7)));
    const prev = w === 0 ? null : new Date(year, 0, 1 + Math.max(0, (w - 1) * 7 - ((jan1.getDay() + 6) % 7)));
    return prev === null || first.getMonth() !== prev.getMonth() ? first.toLocaleDateString('en-GB', { month: 'short' }) : '';
  });

  // --- Review interval histogram (real stabilities) ---
  const ivBuckets = [
    { label: '1d', max: 1, count: 0 },
    { label: '1wk', max: 7, count: 0 },
    { label: '2wk', max: 14, count: 0 },
    { label: '1mo', max: 30, count: 0 },
    { label: '2mo', max: 60, count: 0 },
    { label: '3mo+', max: Infinity, count: 0 },
  ];
  for (const d of state.decks)
    for (const c of d.cards) {
      if (c.fsrs.lastReview === null) continue;
      const s = c.fsrs.stability ?? 0;
      if (s < 1) continue;
      for (const b of ivBuckets)
        if (s <= b.max) {
          b.count++;
          break;
        }
    }
  const ivMax = Math.max(1, ...ivBuckets.map((b) => b.count));

  // --- Added last 21 days (real createdAt) ---
  const added = new Array(21).fill(0);
  for (const d of state.decks)
    for (const c of d.cards) {
      const day = Math.floor((now.getTime() - c.createdAt.getTime()) / DAY);
      if (day >= 0 && day <= 20) added[20 - day]++;
    }
  const addedMax = Math.max(1, ...added);

  // --- True retention (real review-log windows, excluding first-ever exposures) ---
  const retention = [
    { period: 'Today', data: state.retentionWindows[1] },
    { period: 'Past week', data: state.retentionWindows[7] },
    { period: 'Past month', data: state.retentionWindows[30] },
    { period: 'Past year', data: state.retentionWindows[365] },
  ].map(({ period, data }) => {
    const pass = data.trueRecalled;
    const fail = data.trueTotal - pass;
    return { period, pass, fail, pct: data.trueTotal ? `${Math.round((pass / data.trueTotal) * 100)}%` : '—' };
  });

  const label = (i: number, len: number) => (i % 5 === 0 ? `${len - i}d` : '');

  return (
    <div style={{ padding: '28px var(--pad) 48px', animation: 'rvFloat 0.4s ease both' }}>
      <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 34, fontWeight: 600, margin: '0 0 22px', color: '#4b4b4b' }}>Statistics</h1>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 18, marginBottom: 18 }}>
      <RetentionBlock
        variant="grind"
        title="Learning grind (7 days)"
        subtitle="how heavy the load feels — includes cards you're still learning"
        pct={grindPct}
        caption={
          grindEnough
            ? `${ret.recalled} recalled of ${ret.total} reviews (incl. same-day retries)`
            : `${ret.total} review${ret.total === 1 ? '' : 's'} so far · need 20+ for a reading`
        }
      />

      <RetentionBlock
        variant="retention"
        title="True retention (7 days)"
        subtitle="graduated cards, first look each day — the real 90% target"
        pct={truePct}
        caption={
          trueEnough
            ? `${ret.trueRecalled} recalled of ${ret.trueTotal} first-look reviews`
            : 'Fills in as your graduated cards come due (needs review-time data we now log)'
        }
      />

      <RetentionBlock
        variant="retention"
        title="Mature card retention (7 days)"
        subtitle="cards you've truly learned (interval ≥ 21 days)"
        pct={maturePct}
        caption={
          matureEnough
            ? `${ret.matureRecalled} recalled of ${ret.matureTotal} mature reviews`
            : 'Fills in as your mature cards come due'
        }
      />

      <div style={{ background: 'oklch(0.99 0 0)', border: '2px solid oklch(0.9 0 0)', borderRadius: 18, padding: '20px 22px', height: '100%', boxSizing: 'border-box' }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: '#4b4b4b', marginBottom: 18 }}>Today</div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 26 }}>
          {[
            { v: String(studied), l: 'cards studied', c: 'var(--accent)' },
            { v: String(minutes), l: 'minutes', c: '#4b4b4b' },
            { v: correctPct === null ? '—' : correctPct + '%', l: 'correct', c: 'oklch(0.62 0.12 150)' },
            { v: againPct === null ? '—' : againPct + '%', l: 'again', c: '#ff4b4b' },
            { v: String(streak), l: 'day streak', c: '#ff9600' },
          ].map((s) => (
            <div key={s.l}>
              <div style={{ fontFamily: 'var(--font-display)', fontSize: 30, fontWeight: 600, color: s.c }}>{s.v}</div>
              <div style={{ fontSize: 12, color: '#afafaf', marginTop: 2 }}>{s.l}</div>
            </div>
          ))}
        </div>
      </div>
      </div>

      {state.hardest.length > 0 && (
        <div style={{ background: 'oklch(0.99 0 0)', border: '2px solid oklch(0.9 0 0)', borderRadius: 18, padding: '20px 22px', marginBottom: 18 }}>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, marginBottom: 14 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: '#4b4b4b' }}>Hardest cards</div>
            <div style={{ fontSize: 12, color: '#afafaf' }}>The words you miss most, worst first</div>
          </div>
          <div>
            {state.hardest.slice(0, 10).map((h, i) => {
              const front = h.front.replace('{{}}', '____');
              const leech = h.again >= 4;
              const rate = h.total ? h.again / h.total : 0;
              const hardDiff = (h.difficulty ?? 0) >= 4;
              return (
                <div key={h.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 0', borderBottom: '1px solid oklch(0.95 0 0)' }}>
                  <span style={{ width: 18, textAlign: 'right', fontFamily: 'var(--font-mono)', fontSize: 12, color: '#afafaf' }}>{i + 1}</span>
                  <span style={{ flex: 1.4, minWidth: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontWeight: 600, fontSize: 14, color: '#4b4b4b', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{front}</span>
                    {leech && (
                      <span style={{ flexShrink: 0, fontSize: 9.5, fontWeight: 800, letterSpacing: '0.06em', color: '#d97e00', background: '#ffeccc', padding: '2px 7px', borderRadius: 6 }}>LEECH</span>
                    )}
                  </span>
                  <span style={{ flex: 1, minWidth: 0, fontSize: 12.5, color: '#afafaf', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{h.deck.split(' — ')[0]}</span>
                  <span style={{ display: 'flex', alignItems: 'center', gap: 8, width: 150, flexShrink: 0 }}>
                    <span style={{ flex: 1, height: 7, background: 'oklch(0.91 0 0)', borderRadius: 20, overflow: 'hidden' }}>
                      <span style={{ display: 'block', height: '100%', width: `${Math.round(rate * 100)}%`, background: '#ff4b4b', borderRadius: 20 }} />
                    </span>
                    <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: '#777777', whiteSpace: 'nowrap' }}>{h.again}/{h.total}</span>
                  </span>
                  <span style={{ flexShrink: 0, fontFamily: 'var(--font-mono)', fontSize: 11, fontWeight: 700, padding: '3px 8px', borderRadius: 7, color: hardDiff ? '#d97e00' : '#46a302', background: hardDiff ? '#ffeccc' : '#e1f7cf' }}>
                    D {h.difficulty ?? '—'}
                  </span>
                </div>
              );
            })}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginTop: 16 }}>
            <button className="btn3d" onClick={() => actions.drillCards(state.hardest.slice(0, 10).map((h) => h.id))} style={{ padding: '12px 22px 14px', borderRadius: 14, fontSize: 13 }}>
              Drill these words
            </button>
            <span style={{ fontSize: 12.5, color: '#afafaf' }}>Off-schedule — won't change your review dates</span>
          </div>
        </div>
      )}

      <Card title="Future due" extra={`${fdTotal} reviews over the next 21 days`}>
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: 4, height: 120, borderBottom: `1px solid ${BASELINE}` }}>
          {fdYoung.map((y, i) => (
            <div
              key={i}
              className="tip"
              data-tip={`${fmtDay(i)} · ${plural(fdMature[i] + y, 'review')}${fdMature[i] + y > 0 ? ` (${fdMature[i]} mature, ${y} young)` : ''}`}
              style={{ flex: 1, height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'flex-end' }}
            >
              <div style={{ width: '100%', height: `${(fdMature[i] / fdMax) * 100}%`, background: tokens.mature }} />
              <div style={{ width: '100%', height: `${(y / fdMax) * 100}%`, background: tokens.young }} />
            </div>
          ))}
        </div>
        <AxisLabels count={21} label={(i) => (i % 5 === 0 ? `${i}d` : '')} gap={4} />
        <Legend items={[{ label: 'Mature', color: tokens.mature }, { label: 'Young', color: tokens.young }]} />
      </Card>

      <MatureOverTime counts={state.matureHistory.counts} firstEventAt={state.matureHistory.firstEventAt} />

      <Card title="Calendar" extra={String(year)}>
        <div style={{ display: 'grid', gridAutoFlow: 'column', gridAutoColumns: '12px', columnGap: 3, marginBottom: 5, fontSize: 9.5, color: '#afafaf' }}>
          {monthLabels.map((l, i) => (
            <span key={i} style={{ whiteSpace: 'nowrap', overflow: 'visible' }}>{l}</span>
          ))}
        </div>
        <div style={{ display: 'grid', gridTemplateRows: 'repeat(7, 12px)', gridAutoFlow: 'column', gridAutoColumns: '12px', gap: 3, paddingBottom: 4 }}>
          {heat.map((cell, i) =>
            cell === null ? (
              <div key={i} />
            ) : cell.tip === null ? (
              <div key={i} style={{ width: 12, height: 12, borderRadius: 3, background: cell.bg }} />
            ) : (
              <div key={i} className="tip" data-tip={cell.tip} style={{ width: 12, height: 12, borderRadius: 3, background: cell.bg }} />
            ),
          )}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 12, fontSize: 11, color: '#afafaf' }}>
          Less
          <span style={{ width: 11, height: 11, borderRadius: 3, background: 'oklch(0.91 0 0)' }} />
          <span style={{ width: 11, height: 11, borderRadius: 3, background: 'color-mix(in srgb, var(--accent) 30%, transparent)' }} />
          <span style={{ width: 11, height: 11, borderRadius: 3, background: 'color-mix(in srgb, var(--accent) 60%, transparent)' }} />
          <span style={{ width: 11, height: 11, borderRadius: 3, background: 'var(--accent)' }} />
          More
        </div>
      </Card>

      <Card title="Reviews — last 21 days">
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: 3, height: 140, borderBottom: `1px solid ${BASELINE}` }}>
          {rev.map((c, i) => {
            const mature = Math.round(c * 0.45);
            const young = Math.round(c * 0.3);
            const learn = Math.round(c * 0.18);
            const relearn = Math.max(0, c - mature - young - learn);
            const seg = (v: number, color: string) => <div style={{ width: '100%', height: `${(v / revMax) * 100}%`, background: color }} />;
            return (
              <div
                key={i}
                className="tip"
                data-tip={`${fmtDay(-(rev.length - 1 - i))} · ${plural(c, 'review')}`}
                style={{ flex: 1, height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'flex-end' }}
              >
                {seg(mature, tokens.mature)}
                {seg(young, tokens.young)}
                {seg(learn, tokens.learning)}
                {seg(relearn, tokens.relearn)}
              </div>
            );
          })}
        </div>
        <AxisLabels count={rev.length} label={(i) => label(i, rev.length)} gap={3} />
        <Legend items={reviewLegend} />
      </Card>

      {/* Card counts — full width */}
      {/* Review intervals + Added — shared row */}
      <div style={{ display: 'flex', gap: 18, flexWrap: 'wrap' }}>
        <div style={{ flex: 1, minWidth: 250, background: 'oklch(0.99 0 0)', border: '2px solid oklch(0.9 0 0)', borderRadius: 18, padding: '20px 22px', marginBottom: 18 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: '#4b4b4b', marginBottom: 16 }}>Review intervals</div>
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 6, height: 110, borderBottom: `1px solid ${BASELINE}` }}>
            {ivBuckets.map((b) => (
              <div key={b.label} className="tip" data-tip={`${b.label} · ${plural(b.count, 'card')}`} style={{ flex: 1, height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'flex-end' }}>
                <div style={{ width: '100%', height: `${(b.count / ivMax) * 100}%`, minHeight: 3, background: 'var(--accent)' }} />
              </div>
            ))}
          </div>
          <AxisLabels count={ivBuckets.length} label={(i) => ivBuckets[i].label} gap={6} />
        </div>

        <div style={{ flex: 1, minWidth: 250, background: 'oklch(0.99 0 0)', border: '2px solid oklch(0.9 0 0)', borderRadius: 18, padding: '20px 22px', marginBottom: 18 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: '#4b4b4b', marginBottom: 16 }}>Added — last 21 days</div>
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 2, height: 110, borderBottom: `1px solid ${BASELINE}` }}>
            {added.map((c, i) => (
              <div key={i} className="tip" data-tip={`${fmtDay(-(added.length - 1 - i))} · ${plural(c, 'card')} added`} style={{ flex: 1, height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'flex-end' }}>
                <div style={{ width: '100%', height: `${(c / addedMax) * 100}%`, minHeight: 2, background: tokens.newBlue }} />
              </div>
            ))}
          </div>
          <AxisLabels count={added.length} label={(i) => label(i, added.length)} gap={2} />
        </div>
      </div>

      {/* Card counts + True retention — shared row */}
      <div style={{ display: 'flex', gap: 18, flexWrap: 'wrap', alignItems: 'flex-start' }}>
        <div style={{ flex: 1, minWidth: 280, background: 'oklch(0.99 0 0)', border: '2px solid oklch(0.9 0 0)', borderRadius: 18, padding: '20px 22px' }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: '#4b4b4b', marginBottom: 16 }}>Card counts</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 22 }}>
            <div style={{ width: 104, height: 104, borderRadius: '50%', background: donut, flexShrink: 0, WebkitMask: 'radial-gradient(circle, transparent 38%, #000 39%)', mask: 'radial-gradient(circle, transparent 38%, #000 39%)' }} />
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, fontSize: 12.5, flex: 1 }}>
              {ccDefs.filter((s) => s.count > 0).map((s) => (
                <div key={s.label} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ width: 10, height: 10, borderRadius: 3, background: s.color }} />
                  {s.label}
                  <span style={{ marginLeft: 'auto', fontFamily: 'var(--font-mono)', fontWeight: 700, color: '#4b4b4b' }}>{s.count}</span>
                </div>
              ))}
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, borderTop: '1px solid oklch(0.92 0 0)', paddingTop: 8, marginTop: 2 }}>
                Total
                <span style={{ marginLeft: 'auto', fontFamily: 'var(--font-mono)', fontWeight: 700, color: '#4b4b4b' }}>{ccTotal}</span>
              </div>
            </div>
          </div>
        </div>

        <div style={{ flex: 1, minWidth: 280, background: 'oklch(0.99 0 0)', border: '2px solid oklch(0.9 0 0)', borderRadius: 18, padding: '20px 22px' }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: '#4b4b4b', marginBottom: 6 }}>True retention</div>
          <div style={{ display: 'flex', padding: '10px 0', fontSize: 11, fontWeight: 700, letterSpacing: '0.04em', textTransform: 'uppercase', color: '#afafaf', borderBottom: '1px solid oklch(0.92 0 0)' }}>
            <span style={{ flex: 1.4 }}>Period</span>
            <span style={{ flex: 1, textAlign: 'right' }}>Pass</span>
            <span style={{ flex: 1, textAlign: 'right' }}>Fail</span>
            <span style={{ flex: 1, textAlign: 'right' }}>Retention</span>
          </div>
          {retention.map((r) => (
            <div key={r.period} style={{ display: 'flex', padding: '11px 0', fontSize: 13, borderBottom: '1px solid oklch(0.95 0 0)' }}>
              <span style={{ flex: 1.4, color: '#4b4b4b', fontWeight: 600 }}>{r.period}</span>
              <span style={{ flex: 1, textAlign: 'right', fontFamily: 'var(--font-mono)', color: 'oklch(0.62 0.12 150)' }}>{r.pass}</span>
              <span style={{ flex: 1, textAlign: 'right', fontFamily: 'var(--font-mono)', color: '#ff4b4b' }}>{r.fail}</span>
              <span style={{ flex: 1, textAlign: 'right', fontFamily: 'var(--font-mono)', fontWeight: 700, color: '#4b4b4b' }}>{r.pct}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function AxisLabels({ count, label, gap }: { count: number; label: (i: number) => string; gap: number }) {
  return (
    <div style={{ display: 'flex', gap, marginTop: 6 }}>
      {Array.from({ length: count }).map((_, i) => (
        <span key={i} style={{ flex: 1, textAlign: 'center', fontSize: 9, fontFamily: 'var(--font-mono)', color: '#afafaf' }}>
          {label(i)}
        </span>
      ))}
    </div>
  );
}

function Legend({ items }: { items: { label: string; color: string }[] }) {
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16, marginTop: 12, fontSize: 11.5, color: '#777777' }}>
      {items.map((l) => (
        <span key={l.label} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ width: 10, height: 10, borderRadius: 2, background: l.color }} />
          {l.label}
        </span>
      ))}
    </div>
  );
}
