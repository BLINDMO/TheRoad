import React from 'react';
import ReactDOM from 'react-dom/client';
import { HashRouter } from 'react-router-dom';
import App from './app/App';
import './index.css';
import { useGameStore } from './store/useGameStore';
import { unlockAudio } from './audio/sound';

// Hydrate persisted state (bankroll/stats/settings) from IndexedDB on launch —
// iOS may kill a backgrounded PWA, so we always reload from local storage.
void useGameStore.getState().hydrate();

// Unlock Web Audio on the first user gesture (iOS requirement).
const unlock = () => {
  unlockAudio();
  window.removeEventListener('pointerdown', unlock);
  window.removeEventListener('touchstart', unlock);
};
window.addEventListener('pointerdown', unlock);
window.addEventListener('touchstart', unlock);

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <HashRouter>
      <App />
    </HashRouter>
  </React.StrictMode>,
);
