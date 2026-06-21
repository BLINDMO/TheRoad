import { Routes, Route } from 'react-router-dom';
import { lazy, Suspense, Component, type ReactNode } from 'react';

// Catches render-time exceptions so a crash shows a message instead of a
// silent black screen — and lets the user recover without a hard reload.
class ErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  state = { error: null as Error | null };
  static getDerivedStateFromError(error: Error) {
    return { error };
  }
  render() {
    if (this.state.error) {
      return (
        <div className="felt grain grid min-h-[100dvh] place-items-center px-6 text-center">
          <div>
            <h1 className="font-display text-2xl font-bold brass-text">Something tilted.</h1>
            <p className="mt-2 text-sm text-cream-dim">{this.state.error.message}</p>
            <button
              onClick={() => { this.setState({ error: null }); location.hash = '#/'; }}
              className="tactile mt-5 rounded-pill bg-brass-sheen px-5 py-2.5 font-semibold text-walnut"
            >
              Back to Lobby
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
import Lobby from './screens/Lobby';
import PokerLobby from './screens/PokerLobby';
import SlotsLobby from './screens/SlotsLobby';
import Profile from './screens/Profile';
import Settings from './screens/Settings';
import About from './screens/About';
import { SafeScreen } from './ui';

// The two game surfaces pull in Phaser — load them lazily so the lobby and
// menus stay light on mobile.
const PokerGame = lazy(() => import('./screens/PokerGame'));
const SlotGame = lazy(() => import('./screens/SlotGame'));

function Loading() {
  return (
    <div className="felt grain grid min-h-full place-items-center">
      <div className="animate-pulse font-display text-2xl brass-text">Gilded Aces…</div>
    </div>
  );
}

export default function App() {
  return (
    <SafeScreen className="mx-auto max-w-md">
      <ErrorBoundary>
      <Suspense fallback={<Loading />}>
        <Routes>
          <Route path="/" element={<Lobby />} />
          <Route path="/poker" element={<PokerLobby />} />
          <Route path="/poker/play" element={<PokerGame />} />
          <Route path="/slots" element={<SlotsLobby />} />
          <Route path="/slots/:id" element={<SlotGame />} />
          <Route path="/profile" element={<Profile />} />
          <Route path="/settings" element={<Settings />} />
          <Route path="/about" element={<About />} />
        </Routes>
      </Suspense>
      </ErrorBoundary>
    </SafeScreen>
  );
}
