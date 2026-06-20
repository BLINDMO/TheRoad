import { Routes, Route } from 'react-router-dom';
import { lazy, Suspense } from 'react';
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
    </SafeScreen>
  );
}
