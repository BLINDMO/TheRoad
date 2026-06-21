import { useLocation, useNavigate } from 'react-router-dom';
import { play, haptic } from '../audio/sound';

// Persistent bottom tab bar (social-casino / PokerStars style) so the player
// always knows where they are and can move between sections in one tap. Hidden
// on the full-screen game surfaces, which have their own Leave control.

const TABS = [
  { to: '/', label: 'Home', icon: HomeIcon },
  { to: '/poker', label: 'Poker', icon: SpadeIcon },
  { to: '/slots', label: 'Slots', icon: SlotsIcon },
  { to: '/profile', label: 'Profile', icon: UserIcon },
];

// Routes where the nav should NOT show (immersive game screens).
const HIDDEN = [/^\/poker\/play/, /^\/slots\/[^/]+$/];

export function BottomNav() {
  const nav = useNavigate();
  const { pathname } = useLocation();
  if (HIDDEN.some((re) => re.test(pathname))) return null;

  const isActive = (to: string) =>
    to === '/' ? pathname === '/' : pathname.startsWith(to);

  return (
    <nav
      className="fixed bottom-0 left-1/2 z-40 w-full max-w-md -translate-x-1/2 walnut grain border-t border-brass/25"
      style={{ paddingBottom: 'var(--safe-bottom)' }}
    >
      <div className="flex items-stretch justify-around px-2 pt-1.5 pb-1.5">
        {TABS.map((t) => {
          const active = isActive(t.to);
          const Icon = t.icon;
          return (
            <button
              key={t.to}
              onClick={() => { play('button'); haptic(8); nav(t.to); }}
              className="tactile flex flex-1 flex-col items-center gap-0.5 py-1"
            >
              <Icon active={active} />
              <span className={`text-[10px] font-semibold tracking-wide ${active ? 'text-brass-light' : 'text-cream-mute'}`}>
                {t.label}
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}

function wrap(active: boolean) {
  return active ? '#E4C878' : '#8C8473';
}

function HomeIcon({ active }: { active: boolean }) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={wrap(active)} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 10.5 12 3l9 7.5" />
      <path d="M5 9.5V21h14V9.5" />
    </svg>
  );
}
function SpadeIcon({ active }: { active: boolean }) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill={wrap(active)}>
      <path d="M12 3c3 4 8 6.5 8 10.5A4.5 4.5 0 0 1 13 17c.2 1.8 1 3 2.2 3.6V21H8.8v-.4C10 20 10.8 18.8 11 17a4.5 4.5 0 0 1-7-3.5C4 9.5 9 7 12 3z" />
    </svg>
  );
}
function SlotsIcon({ active }: { active: boolean }) {
  const c = wrap(active);
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2">
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <line x1="9" y1="5" x2="9" y2="19" />
      <line x1="15" y1="5" x2="15" y2="19" />
    </svg>
  );
}
function UserIcon({ active }: { active: boolean }) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={wrap(active)} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="8" r="3.5" />
      <path d="M5 20c0-3.5 3-6 7-6s7 2.5 7 6" />
    </svg>
  );
}
