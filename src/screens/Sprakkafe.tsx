import { useEffect, useMemo, useState } from 'react';
import { useApp, type CafeEvent, type RsvpStatus } from '../store.tsx';
import { useIsMobile } from '../hooks/useIsMobile.ts';

const DAY = 86_400_000;

function startOfLocalDay(t: number): number {
  const d = new Date(t);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}
const fmtDate = (t: number) => new Date(t).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' });
const fmtTime = (t: number) => new Date(t).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });

function Pill({ children, tone = 'gray' }: { children: React.ReactNode; tone?: 'gray' | 'accent' | 'red' }) {
  const colors = {
    gray: { background: 'oklch(0.93 0 0)', color: '#8a8a8a' },
    accent: { background: 'var(--accent-tint)', color: 'var(--accent)' },
    red: { background: 'oklch(0.93 0.05 18)', color: 'oklch(0.55 0.19 18)' },
  }[tone];
  return <span style={{ ...colors, fontSize: 11.5, fontWeight: 700, padding: '4px 9px 5px', borderRadius: 8, whiteSpace: 'nowrap' }}>{children}</span>;
}

/** RSVP toggle: outline when inactive, accent-tinted when this is the user's current answer. */
function RsvpButton({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      style={{
        border: `2px solid ${active ? 'var(--accent)' : 'oklch(0.88 0 0)'}`,
        background: active ? 'var(--accent-tint)' : 'oklch(0.99 0 0)',
        color: active ? 'var(--accent)' : '#afafaf',
        fontSize: 12,
        fontWeight: 800,
        letterSpacing: '0.05em',
        textTransform: 'uppercase',
        padding: '9px 14px 10px',
        borderRadius: 12,
        cursor: 'pointer',
        whiteSpace: 'nowrap',
        transition: 'border-color 0.12s, background 0.12s, color 0.12s',
      }}
    >
      {label}
    </button>
  );
}

function EventRow({ ev, isMobile }: { ev: CafeEvent; isMobile: boolean }) {
  const { actions } = useApp();
  const toggle = (status: RsvpStatus) => actions.rsvpEvent(ev.id, ev.myStatus === status ? null : status);
  const sub = [ev.organizer, ev.library].filter(Boolean).join(' · ');

  const buttons = (
    <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
      <RsvpButton label="Going" active={ev.myStatus === 'going'} onClick={() => toggle('going')} />
      <RsvpButton label="Can't go" active={ev.myStatus === 'cant'} onClick={() => toggle('cant')} />
    </div>
  );

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 16, background: 'oklch(0.99 0 0)', border: '2px solid oklch(0.9 0 0)', borderRadius: 16, padding: '16px 18px', opacity: ev.cancelled ? 0.75 : 1 }}>
      <div style={{ width: 86, flexShrink: 0 }}>
        <div style={{ fontSize: 12.5, fontWeight: 800, color: 'var(--accent)' }}>{fmtDate(ev.startTime)}</div>
        <div style={{ fontSize: 12, fontFamily: 'var(--font-mono)', color: '#afafaf', marginTop: 3 }}>
          {fmtTime(ev.startTime)}–{fmtTime(ev.endTime)}
        </div>
      </div>
      <div style={{ minWidth: 0, flex: 1 }}>
        <a
          href={ev.url}
          target="_blank"
          rel="noreferrer"
          style={{ fontSize: 16, fontWeight: 700, color: '#4b4b4b', textDecoration: ev.cancelled ? 'line-through' : 'none' }}
        >
          {ev.title}
        </a>
        {sub && <div style={{ fontSize: 12.5, color: '#afafaf', marginTop: 2 }}>{sub}</div>}
        <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 7, marginTop: 8 }}>
          {ev.cancelled && <Pill tone="red">Cancelled</Pill>}
          {ev.targetAudience && <Pill>{ev.targetAudience}</Pill>}
          {ev.price && ev.price !== 'Gratis' && <Pill>{ev.price}</Pill>}
          {ev.going.length > 0 ? (
            <span className="tip" data-tip={ev.going.join(', ')} tabIndex={0} style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--accent)', cursor: 'default' }}>
              {ev.going.length} going
            </span>
          ) : (
            <span style={{ fontSize: 12.5, color: '#c4c4c4' }}>No one signed up yet</span>
          )}
          {ev.cant.length > 0 && (
            <span className="tip" data-tip={ev.cant.join(', ')} tabIndex={0} style={{ fontSize: 12.5, color: '#c4c4c4', cursor: 'default' }}>
              · {ev.cant.length} can't
            </span>
          )}
        </div>
        {isMobile && <div style={{ marginTop: 12 }}>{buttons}</div>}
      </div>
      {!isMobile && buttons}
    </div>
  );
}

/** Upcoming Norwegian language cafés around Oslo (from deichman.no) with going / can't-go RSVPs. */
export function Sprakkafe() {
  const { state, actions } = useApp();
  const isMobile = useIsMobile();
  const [selectedDay, setSelectedDay] = useState<number | null>(() => startOfLocalDay(Date.now())); // startOfLocalDay key; today preselected

  useEffect(() => {
    actions.loadEvents();
  }, []);

  const today = startOfLocalDay(Date.now());
  const days = useMemo(() => Array.from({ length: 7 }, (_, i) => today + i * DAY), [today]);

  // The server window can spill past day 7 (it cuts on start_time <= now+7d) — keep the strip's days only.
  const week = useMemo(
    () => state.events.filter((ev) => {
      const d = startOfLocalDay(ev.startTime);
      return d >= today && d <= days[6];
    }),
    [state.events, today],
  );
  const byDay = (day: number) => week.filter((ev) => startOfLocalDay(ev.startTime) === day);
  const shown = selectedDay === null ? week : byDay(selectedDay);

  const empty = (msg: string) => (
    <div style={{ padding: '48px 22px', textAlign: 'center', color: '#afafaf', fontSize: 14 }}>{msg}</div>
  );

  return (
    <div style={{ padding: '28px var(--pad) 48px', animation: 'rvFloat 0.4s ease both' }}>
      <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 34, fontWeight: 600, margin: '0 0 4px', color: '#4b4b4b' }}>Language cafés</h1>
      <p style={{ fontSize: 13.5, color: '#afafaf', margin: '0 0 22px' }}>Practise out loud with people around Oslo. Say whether you're coming.</p>

      {/* 7-day strip: today outlined, the selected day filled. Tapping toggles the day filter. */}
      <div style={{ display: 'flex', gap: 8, background: 'oklch(0.99 0 0)', border: '2px solid oklch(0.9 0 0)', borderRadius: 18, padding: 10, marginBottom: 16, overflowX: 'auto' }}>
        {days.map((day) => {
          const count = byDay(day).length;
          const selected = selectedDay === day;
          const isToday = day === today;
          return (
            <button
              key={day}
              onClick={() => setSelectedDay(selected ? null : day)}
              style={{
                flex: 1,
                minWidth: 64,
                border: `2px solid ${selected ? 'var(--accent)' : isToday ? '#4b4b4b' : 'transparent'}`,
                background: selected ? 'var(--accent)' : count > 0 ? 'var(--accent-tint)' : 'oklch(0.955 0 0)',
                borderRadius: 14,
                padding: '10px 6px 11px',
                cursor: 'pointer',
                textAlign: 'center',
                transition: 'background 0.12s, border-color 0.12s',
              }}
            >
              <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: '0.08em', color: selected ? 'oklch(0.99 0 0 / 0.85)' : count > 0 ? 'var(--accent)' : '#c4c4c4' }}>
                {new Date(day).toLocaleDateString('en-GB', { weekday: 'short' }).toUpperCase()}
              </div>
              <div style={{ fontFamily: 'var(--font-display)', fontSize: 21, fontWeight: 600, margin: '2px 0', color: selected ? '#fff' : count > 0 ? 'var(--accent)' : '#afafaf' }}>
                {new Date(day).getDate()}
              </div>
              <div style={{ fontSize: 10, fontWeight: 700, color: selected ? 'oklch(0.99 0 0 / 0.85)' : count > 0 ? 'var(--accent)' : '#c4c4c4' }}>
                {count > 0 ? `${count} café${count === 1 ? '' : 's'}` : '—'}
              </div>
            </button>
          );
        })}
      </div>

      {selectedDay !== null && (
        <button
          onClick={() => setSelectedDay(null)}
          style={{ display: 'inline-flex', alignItems: 'center', gap: 7, border: 'none', background: 'var(--accent-tint)', color: 'var(--accent)', fontSize: 12.5, fontWeight: 700, padding: '8px 13px 9px', borderRadius: 999, cursor: 'pointer', marginBottom: 16 }}
        >
          Showing {fmtDate(selectedDay)} <span style={{ fontSize: 14, lineHeight: 1 }}>✕</span>
        </button>
      )}

      {!state.eventsLoaded ? (
        empty('Fetching the schedule…')
      ) : shown.length === 0 ? (
        empty(selectedDay !== null ? 'No language cafés on this day.' : 'No language cafés found for the next 7 days.')
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {shown.map((ev) => (
            <EventRow key={ev.id} ev={ev} isMobile={isMobile} />
          ))}
        </div>
      )}

      <p style={{ fontSize: 11.5, color: '#c4c4c4', marginTop: 26, textAlign: 'center' }}>
        Schedule from{' '}
        <a href="https://deichman.no/hva-skjer?query=spr%C3%A5kkafe" target="_blank" rel="noreferrer" style={{ color: '#afafaf' }}>
          deichman.no
        </a>
        , refreshed hourly. Norwegian cafés only.
      </p>
    </div>
  );
}
