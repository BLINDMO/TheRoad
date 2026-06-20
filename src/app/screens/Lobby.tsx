import { useNavigate } from 'react-router-dom';
import { useGameStore } from '../../store/useGameStore';
import { BrassButton, ChipGlyph, formatChips, MoneyPill, Panel } from '../ui';
import { play, haptic } from '../../audio/sound';
import { useState } from 'react';

export default function Lobby() {
  const nav = useNavigate();
  const bankroll = useGameStore((s) => s.bankroll);
  const profile = useGameStore((s) => s.profile);
  const canClaim = useGameStore((s) => s.canClaimDaily());
  const claimDaily = useGameStore((s) => s.claimDaily);
  const [claimed, setClaimed] = useState<number | null>(null);

  return (
    <div className="felt grain min-h-full px-4 pb-8 pt-3">
      {/* Top bar */}
      <div className="flex items-center justify-between">
        <button
          onClick={() => { play('button'); nav('/profile'); }}
          className="tactile flex items-center gap-2.5 rounded-pill bg-walnut-light/70 py-1.5 pl-1.5 pr-4 ring-1 ring-brass/30"
        >
          <Avatar id={profile.avatar} size={34} />
          <div className="text-left leading-tight">
            <div className="text-[10px] uppercase tracking-widest text-cream-mute">Welcome</div>
            <div className="text-sm font-semibold text-cream">{profile.name}</div>
          </div>
        </button>
        <div className="flex items-center gap-2">
          <MoneyPill value={bankroll} label="Chips" />
          <button
            onClick={() => { play('button'); nav('/settings'); }}
            className="tactile grid h-10 w-10 place-items-center rounded-full bg-walnut-light/70 text-cream ring-1 ring-brass/30"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="3" />
              <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
            </svg>
          </button>
        </div>
      </div>

      {/* Brand */}
      <div className="mt-7 text-center">
        <div className="mb-1 text-[11px] font-semibold uppercase tracking-[0.4em] text-brass/80">The Private Room</div>
        <h1 className="font-display text-5xl font-extrabold leading-none brass-text">Gilded Aces</h1>
        <div className="mx-auto mt-3 h-px w-40 brass-rule" />
      </div>

      {/* Daily bonus */}
      <div className="mt-6">
        {claimed !== null ? (
          <Panel className="animate-fade-up px-4 py-3 text-center">
            <span className="text-sm text-cream-dim">Daily bonus claimed: </span>
            <span className="tnum font-slab font-bold text-amber-light">+{formatChips(claimed)}</span>
          </Panel>
        ) : (
          <button
            disabled={!canClaim}
            onClick={() => {
              const amt = claimDaily();
              if (amt > 0) { play('coin'); haptic([10, 30, 10]); setClaimed(amt); }
            }}
            className={`tactile flex w-full items-center justify-between rounded-panel px-4 py-3 ring-1 ${
              canClaim
                ? 'bg-gradient-to-r from-amber/90 to-amber-light/80 text-walnut ring-amber-glow/50 animate-pulse-glow'
                : 'bg-walnut-light/50 text-cream-mute ring-brass/20'
            }`}
          >
            <div className="flex items-center gap-3">
              <div className="grid h-9 w-9 place-items-center rounded-full bg-walnut/30"><ChipGlyph size={22} /></div>
              <div className="text-left">
                <div className="text-sm font-bold">Daily Bonus</div>
                <div className="text-[11px] opacity-80">{canClaim ? 'Tap to collect 5,000 chips' : 'Come back later for more'}</div>
              </div>
            </div>
            <span className="text-lg font-bold">{canClaim ? '→' : '✓'}</span>
          </button>
        )}
      </div>

      {/* Game cards */}
      <div className="mt-6 space-y-4">
        <GameCard
          title="Poker Room"
          subtitle="Texas Hold'em · Cash, Sit & Go, Championship"
          accent="from-felt-light to-felt-dark"
          onClick={() => nav('/poker')}
          art={<PokerArt />}
        />
        <GameCard
          title="Slots Floor"
          subtitle="Three machines · Free spins, bonuses, jackpot"
          accent="from-[#2a2147] to-[#120d2a]"
          onClick={() => nav('/slots')}
          art={<SlotsArt />}
        />
      </div>

      <div className="mt-7 flex items-center justify-center gap-6 text-xs text-cream-mute">
        <button className="tactile" onClick={() => { play('button'); nav('/profile'); }}>Stats</button>
        <span className="opacity-40">·</span>
        <button className="tactile" onClick={() => { play('button'); nav('/about'); }}>About</button>
        <span className="opacity-40">·</span>
        <button className="tactile" onClick={() => { play('button'); nav('/settings'); }}>Settings</button>
      </div>
      <p className="mt-4 text-center text-[10px] leading-relaxed text-cream-mute/70">
        Virtual chips only. No real money, payments, or prizes anywhere in this app.
      </p>
    </div>
  );
}

function GameCard({
  title, subtitle, onClick, art, accent,
}: { title: string; subtitle: string; onClick: () => void; art: React.ReactNode; accent: string }) {
  return (
    <button
      onClick={() => { play('button'); haptic(10); onClick(); }}
      className={`tactile relative flex w-full items-center gap-4 overflow-hidden rounded-panel bg-gradient-to-br ${accent} p-4 text-left shadow-panel ring-1 ring-brass/30`}
    >
      <div className="grain absolute inset-0 opacity-100" />
      <div className="relative grid h-20 w-20 shrink-0 place-items-center">{art}</div>
      <div className="relative flex-1">
        <div className="font-display text-2xl font-bold text-cream">{title}</div>
        <div className="mt-0.5 text-xs text-cream-dim">{subtitle}</div>
        <div className="mt-2 inline-flex items-center gap-1 text-sm font-semibold text-brass-light">
          Enter <span>→</span>
        </div>
      </div>
    </button>
  );
}

function PokerArt() {
  return (
    <svg viewBox="0 0 80 80" className="h-full w-full drop-shadow-lg">
      <g transform="rotate(-14 40 40)">
        <rect x="20" y="18" width="34" height="46" rx="5" fill="#F8F2E3" stroke="#caa24b" />
      </g>
      <g transform="rotate(6 44 40)">
        <rect x="30" y="16" width="34" height="46" rx="5" fill="#F8F2E3" stroke="#caa24b" />
        <text x="36" y="32" fontFamily="Zilla Slab, serif" fontWeight="800" fontSize="14" fill="#B5304A">A</text>
        <path d="M47 40l5 8h-10z" fill="#B5304A" transform="rotate(180 47 44)" />
        <path d="M47 38c3-5 9-1 0 6-9-7-3-11 0-6z" fill="#B5304A" />
      </g>
    </svg>
  );
}

function SlotsArt() {
  return (
    <svg viewBox="0 0 80 80" className="h-full w-full drop-shadow-lg">
      <rect x="12" y="20" width="56" height="40" rx="6" fill="#1a1430" stroke="#caa24b" strokeWidth="1.5" />
      {[20, 36, 52].map((x) => (
        <rect key={x} x={x} y="26" width="11" height="28" rx="2" fill="#0c0a1a" stroke="#5b78c8" strokeWidth="0.6" />
      ))}
      <circle cx="25.5" cy="40" r="3.4" fill="#ff5d6c" />
      <path d="M41.5 36l3 4-3 4-3-4z" fill="#3fd08a" />
      <circle cx="57.5" cy="40" r="3.4" fill="#ffc14d" />
      <rect x="33" y="60" width="14" height="4" rx="2" fill="#caa24b" />
    </svg>
  );
}

export function Avatar({ id, size = 40 }: { id: string; size?: number }) {
  // Deterministic crest-style avatar from id.
  const hue = [...id].reduce((a, c) => a + c.charCodeAt(0), 0) % 360;
  return (
    <div
      className="grid place-items-center rounded-full ring-1 ring-brass/50"
      style={{
        width: size,
        height: size,
        background: `radial-gradient(circle at 35% 30%, hsl(${hue} 45% 38%), hsl(${hue} 50% 18%))`,
      }}
    >
      <span className="font-display font-bold text-cream" style={{ fontSize: size * 0.42 }}>
        {id.slice(0, 1).toUpperCase()}
      </span>
    </div>
  );
}
