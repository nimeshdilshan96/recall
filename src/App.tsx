import { useApp } from './store.tsx';
import { accentVars } from './theme.ts';
import { useIsMobile } from './hooks/useIsMobile.ts';
import { useVisualViewport } from './hooks/useVisualViewport.ts';
import { Auth } from './screens/Auth.tsx';
import { Sidebar } from './components/Sidebar.tsx';
import { StatsBar } from './components/StatsBar.tsx';
import { Home } from './screens/Home.tsx';
import { Study } from './screens/Study.tsx';
import { Add } from './screens/Add.tsx';
import { Browse } from './screens/Browse.tsx';
import { Community } from './screens/Community.tsx';
import { Sprakkafe } from './screens/Sprakkafe.tsx';
import { League } from './screens/League.tsx';
import { Stats } from './screens/Stats.tsx';
import { Changelog } from './screens/Changelog.tsx';
import { Requests } from './screens/Requests.tsx';
import { Settings } from './screens/Settings.tsx';
import { Toast } from './components/Toast.tsx';
import { WhatsNewDialog } from './components/WhatsNewDialog.tsx';

export function App() {
  const { state } = useApp();
  const isMobile = useIsMobile();
  const viewport = useVisualViewport();
  const rootStyle = {
    ...accentVars(state.accent),
    '--pad': isMobile ? '16px' : '38px',
    fontFamily: 'var(--font-ui)',
    // Track the visual viewport so the layout shrinks when the mobile keyboard opens (iOS never
    // resizes the layout viewport for the keyboard — see useVisualViewport).
    height: viewport.height ? `${viewport.height}px` : '100%',
  } as React.CSSProperties;

  if (!state.booted) {
    return (
      <div style={{ ...rootStyle, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ width: 44, height: 44, borderRadius: 13, background: 'var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 4px 0 var(--accent-deep)', animation: 'rvPop 0.5s ease both' }}>
          <span style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 24, color: '#fff' }}>R</span>
        </div>
      </div>
    );
  }

  if (!state.authed) {
    return (
      <div style={rootStyle}>
        <Auth />
        <Toast />
      </div>
    );
  }

  const screen = (
    <main style={{ flex: 1, minWidth: 0, overflowY: 'auto', position: 'relative', display: 'flex', flexDirection: 'column' }}>
      {state.screen !== 'study' && <StatsBar />}
      {state.screen === 'home' && <Home />}
      {state.screen === 'study' && <Study />}
      {state.screen === 'add' && <Add />}
      {state.screen === 'browse' && <Browse />}
      {state.screen === 'community' && <Community />}
      {state.screen === 'sprakkafe' && <Sprakkafe />}
      {state.screen === 'league' && <League />}
      {state.screen === 'stats' && <Stats />}
      {state.screen === 'changelog' && <Changelog />}
      {state.screen === 'requests' && <Requests />}
      {state.screen === 'settings' && <Settings />}
    </main>
  );

  // Mobile: hamburger menu in the top row (MobileMenu). Desktop: left sidebar.
  return (
    <div style={{ ...rootStyle, display: 'flex', flexDirection: isMobile ? 'column' : 'row', background: 'oklch(0.96 0 0)' }}>
      {!isMobile && <Sidebar />}
      {screen}
      {state.showWhatsNew && <WhatsNewDialog />}
      <Toast />
    </div>
  );
}
