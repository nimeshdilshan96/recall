import { CHANGELOG } from '../data/changelog.ts';

/** Full release history, newest first. Pure render of src/data/changelog.ts — no state, no API. */
export function Changelog() {
  return (
    <div style={{ padding: '28px var(--pad) 48px', maxWidth: 640, animation: 'rvFloat 0.4s ease both' }}>
      <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 34, fontWeight: 600, margin: '0 0 6px', color: '#4b4b4b' }}>Changelog</h1>
      <div style={{ fontSize: 13.5, color: '#afafaf', margin: '0 0 30px' }}>What changed in each release, newest first.</div>

      {CHANGELOG.map((release) => (
        <section key={release.version} style={{ marginBottom: 36 }}>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, borderBottom: '1px solid oklch(0.9 0 0)', paddingBottom: 10, marginBottom: 18 }}>
            <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 21, fontWeight: 600, margin: 0, color: '#4b4b4b' }}>Version {release.version}</h2>
            <span style={{ fontSize: 12.5, color: '#afafaf' }}>{release.date}</span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {release.items.map((item) => (
              <div key={item.title} style={{ display: 'flex', gap: 12 }}>
                <span style={{ width: 14, height: 14, borderRadius: 4, flexShrink: 0, marginTop: 3, background: 'var(--accent)', boxShadow: 'inset 0 -2px 0 rgba(0,0,0,0.18)' }} />
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 15, fontWeight: 700, color: '#4b4b4b', marginBottom: 3 }}>{item.title}</div>
                  <div style={{ fontSize: 13.5, lineHeight: 1.5, color: '#777777' }}>{item.body}</div>
                </div>
              </div>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
