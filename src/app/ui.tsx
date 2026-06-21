import React from 'react';
import { useNavigate } from 'react-router-dom';
import { play, haptic } from '../audio/sound';

export function formatChips(n: number): string {
  return Math.round(n).toLocaleString('en-US');
}

/** App-wide root that honors iOS safe areas. */
export function SafeScreen({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <div
      className={`min-h-[100dvh] w-full ${className}`}
      style={{
        paddingTop: 'var(--safe-top)',
        paddingBottom: 'var(--safe-bottom)',
        paddingLeft: 'var(--safe-left)',
        paddingRight: 'var(--safe-right)',
      }}
    >
      {children}
    </div>
  );
}

export function Panel({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <div
      className={`walnut grain relative overflow-hidden rounded-panel shadow-panel ring-1 ring-brass/25 ${className}`}
    >
      {children}
    </div>
  );
}

type BtnVariant = 'gold' | 'felt' | 'amber' | 'ghost' | 'danger';
export function BrassButton({
  children,
  onClick,
  variant = 'gold',
  className = '',
  disabled,
  sfx = 'button',
}: {
  children: React.ReactNode;
  onClick?: () => void;
  variant?: BtnVariant;
  className?: string;
  disabled?: boolean;
  sfx?: Parameters<typeof play>[0] | null;
}) {
  const base =
    'tactile select-none rounded-pill font-semibold tracking-wide text-center transition disabled:opacity-40 disabled:cursor-not-allowed';
  const styles: Record<BtnVariant, string> = {
    gold: 'bg-brass-sheen text-walnut shadow-brass',
    amber: 'bg-gradient-to-b from-amber-light to-amber text-walnut shadow-glow',
    felt: 'bg-felt-light text-cream ring-1 ring-brass/40',
    ghost: 'bg-walnut-light/60 text-cream ring-1 ring-brass/30',
    danger: 'bg-gradient-to-b from-ruby to-[#7c1b2f] text-cream',
  };
  return (
    <button
      disabled={disabled}
      onClick={() => {
        if (disabled) return;
        if (sfx) play(sfx);
        haptic(10);
        onClick?.();
      }}
      className={`${base} ${styles[variant]} ${className}`}
    >
      {children}
    </button>
  );
}

export function MoneyPill({ value, label, className = '' }: { value: number; label?: string; className?: string }) {
  return (
    <div className={`flex items-center gap-2 rounded-pill bg-walnut-light/80 px-3 py-1.5 ring-1 ring-brass/40 ${className}`}>
      <ChipGlyph />
      <div className="leading-none">
        {label && <div className="text-[9px] uppercase tracking-widest text-cream-mute">{label}</div>}
        <div className="tnum font-slab text-base font-bold text-brass-light">{formatChips(value)}</div>
      </div>
    </div>
  );
}

export function ChipGlyph({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden>
      <circle cx="16" cy="16" r="15" fill="#c9a24b" />
      <circle cx="16" cy="16" r="15" fill="none" stroke="#8c6d2c" strokeWidth="1" />
      {[0, 1, 2, 3, 4, 5, 6, 7].map((i) => {
        const a = (Math.PI * 2 * i) / 8;
        return (
          <rect
            key={i}
            x={16 + Math.cos(a) * 13 - 1.6}
            y={16 + Math.sin(a) * 13 - 2.6}
            width="3.2"
            height="5.2"
            rx="1"
            fill="#0b3d2e"
            transform={`rotate(${(a * 180) / Math.PI} ${16 + Math.cos(a) * 13} ${16 + Math.sin(a) * 13})`}
          />
        );
      })}
      <circle cx="16" cy="16" r="9" fill="#0b3d2e" />
      <circle cx="16" cy="16" r="9" fill="none" stroke="#c9a24b" strokeWidth="1" />
    </svg>
  );
}

export function BackBar({ title, right }: { title: string; right?: React.ReactNode }) {
  const nav = useNavigate();
  return (
    <div className="flex items-center justify-between px-4 py-3">
      <button
        onClick={() => {
          play('button');
          nav(-1);
        }}
        className="tactile flex items-center gap-1.5 rounded-pill bg-walnut-light/70 py-1.5 pl-2 pr-3.5 text-cream ring-1 ring-brass/30"
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4">
          <path d="M15 18l-6-6 6-6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        <span className="text-sm font-medium">Back</span>
      </button>
      <h1 className="font-display text-lg font-bold brass-text">{title}</h1>
      <div className="min-w-[64px] text-right">{right}</div>
    </div>
  );
}

export function Heading({ children, sub }: { children: React.ReactNode; sub?: string }) {
  return (
    <div className="text-center">
      <h2 className="font-display text-2xl font-extrabold brass-text">{children}</h2>
      {sub && <p className="mt-1 text-sm text-cream-dim">{sub}</p>}
    </div>
  );
}
