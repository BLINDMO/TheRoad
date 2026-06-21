import { useNavigate } from 'react-router-dom';
import { useState } from 'react';
import { BackBar, BrassButton, Heading, MoneyPill, Panel, formatChips } from '../ui';
import { useGameStore } from '../../store/useGameStore';
import { buildSchedule } from '../../engine-poker/tournament';
import type { PokerSetup } from '../poker/PokerController';
import { play } from '../../audio/sound';

type Tab = 'cash' | 'sng' | 'mtt';

const CASH_STAKES = [
  { label: 'Micro', sb: 5, bb: 10, min: 400, max: 1000 },
  { label: 'Low', sb: 25, bb: 50, min: 2000, max: 5000 },
  { label: 'Mid', sb: 100, bb: 200, min: 8000, max: 20000 },
];

const SNG_TIERS = [
  { label: 'Heads-Up', seats: 2, buyIn: 1000 },
  { label: '6-Max', seats: 6, buyIn: 2000 },
  { label: '9-Max', seats: 9, buyIn: 1000 },
];

export default function PokerLobby() {
  const nav = useNavigate();
  const bankroll = useGameStore((s) => s.bankroll);
  const [tab, setTab] = useState<Tab>('cash');

  return (
    <div className="felt grain min-h-full">
      <BackBar title="Poker Room" right={<MoneyPill value={bankroll} />} />
      <div className="px-4 pb-28">
        <div className="mt-1 grid grid-cols-3 gap-2 rounded-pill bg-walnut-light/60 p-1 ring-1 ring-brass/25">
          {(['cash', 'sng', 'mtt'] as Tab[]).map((t) => (
            <button
              key={t}
              onClick={() => { play('button'); setTab(t); }}
              className={`tactile rounded-pill py-2 text-sm font-semibold transition ${
                tab === t ? 'bg-brass-sheen text-walnut shadow-brass' : 'text-cream-dim'
              }`}
            >
              {t === 'cash' ? 'Cash' : t === 'sng' ? 'Sit & Go' : 'Championship'}
            </button>
          ))}
        </div>

        <div className="mt-5">
          {tab === 'cash' && <CashTab bankroll={bankroll} />}
          {tab === 'sng' && <SngTab bankroll={bankroll} />}
          {tab === 'mtt' && <MttTab bankroll={bankroll} />}
        </div>
      </div>
    </div>
  );
}

function launch(nav: ReturnType<typeof useNavigate>, setup: PokerSetup, title: string) {
  play('button');
  nav('/poker/play', { state: { setup, title } });
}

function CashTab({ bankroll }: { bankroll: number }) {
  const nav = useNavigate();
  const [stakeIdx, setStakeIdx] = useState(0);
  const [seats, setSeats] = useState(6);
  const stake = CASH_STAKES[stakeIdx];
  const [buyIn, setBuyIn] = useState(stake.max);

  const setStake = (i: number) => {
    setStakeIdx(i);
    setBuyIn(CASH_STAKES[i].max);
  };

  return (
    <div className="space-y-5 animate-fade-up">
      <Heading sub="Sit, rebuy and leave whenever you like — just like a real cash game.">Leisure Cash Table</Heading>

      <Panel className="p-4">
        <Label>Stakes</Label>
        <div className="mt-2 grid grid-cols-3 gap-2">
          {CASH_STAKES.map((s, i) => (
            <Choice key={s.label} active={i === stakeIdx} onClick={() => setStake(i)}>
              <div className="font-semibold">{s.label}</div>
              <div className="text-[11px] opacity-80 tnum">{s.sb}/{s.bb}</div>
            </Choice>
          ))}
        </div>

        <Label className="mt-4">Table Size</Label>
        <div className="mt-2 grid grid-cols-4 gap-2">
          {[2, 4, 6, 9].map((n) => (
            <Choice key={n} active={n === seats} onClick={() => setSeats(n)}>
              <div className="font-semibold">{n === 2 ? 'HU' : `${n}`}</div>
            </Choice>
          ))}
        </div>

        <Label className="mt-4">Buy-in <span className="tnum text-brass-light">{formatChips(buyIn)}</span></Label>
        <input
          type="range" min={stake.min} max={stake.max} step={stake.bb}
          value={buyIn} onChange={(e) => setBuyIn(Number(e.target.value))}
          className="mt-2 w-full accent-amber"
        />
        <div className="flex justify-between text-[11px] text-cream-mute tnum">
          <span>{formatChips(stake.min)}</span><span>{formatChips(stake.max)}</span>
        </div>
      </Panel>

      <BrassButton
        variant="amber"
        className="w-full py-3.5 text-lg"
        disabled={bankroll < buyIn}
        onClick={() =>
          launch(nav, {
            mode: 'cash', seatCount: seats, startingStack: buyIn,
            sb: stake.sb, bb: stake.bb, buyIn,
          }, `${stake.label} Cash · ${seats === 2 ? 'HU' : seats + '-max'}`)
        }
      >
        {bankroll < buyIn ? 'Not enough chips' : `Sit Down · ${formatChips(buyIn)}`}
      </BrassButton>
    </div>
  );
}

function SngTab({ bankroll }: { bankroll: number }) {
  const nav = useNavigate();
  const [idx, setIdx] = useState(1);
  const tier = SNG_TIERS[idx];
  const startStack = 1500;
  const schedule = buildSchedule(tier.seats <= 2 ? 20 : 20, 14, 1.45, 4);

  return (
    <div className="space-y-5 animate-fade-up">
      <Heading sub="Single-table tournament. Starts when the table fills. Top finishers paid.">Sit &amp; Go</Heading>
      <Panel className="p-4">
        <Label>Format</Label>
        <div className="mt-2 grid grid-cols-3 gap-2">
          {SNG_TIERS.map((t, i) => (
            <Choice key={t.label} active={i === idx} onClick={() => setIdx(i)}>
              <div className="font-semibold">{t.label}</div>
              <div className="text-[11px] opacity-80 tnum">{formatChips(t.buyIn)}</div>
            </Choice>
          ))}
        </div>
        <div className="mt-4 grid grid-cols-3 gap-2 text-center text-xs text-cream-dim">
          <Stat k="Players" v={`${tier.seats}`} />
          <Stat k="Stack" v={formatChips(startStack)} />
          <Stat k="Paid" v={tier.seats <= 2 ? 'Top 1' : tier.seats <= 6 ? 'Top 2' : 'Top 3'} />
        </div>
      </Panel>
      <BrassButton
        variant="amber" className="w-full py-3.5 text-lg" disabled={bankroll < tier.buyIn}
        onClick={() => launch(nav, {
          mode: 'sng', seatCount: tier.seats, startingStack: startStack,
          sb: schedule[0].sb, bb: schedule[0].bb, buyIn: tier.buyIn,
          schedule, handsPerLevel: 8, fieldSize: tier.seats,
        }, `${tier.label} Sit & Go`)}
      >
        {bankroll < tier.buyIn ? 'Not enough chips' : `Register · ${formatChips(tier.buyIn)}`}
      </BrassButton>
    </div>
  );
}

function MttTab({ bankroll }: { bankroll: number }) {
  const nav = useNavigate();
  const buyIn = 5000;
  const fieldSize = 180;
  const startStack = 20000;
  const schedule = buildSchedule(50, 24, 1.4, 4);

  return (
    <div className="space-y-5 animate-fade-up">
      <Heading sub="A 180-runner championship with antes, a final-table redraw and a real payout ladder.">
        The Gilded Crown
      </Heading>
      <Panel className="relative p-5">
        <div className="absolute right-4 top-4 opacity-90"><Trophy /></div>
        <div className="text-[11px] font-semibold uppercase tracking-[0.3em] text-brass/80">Marquee Event</div>
        <h3 className="mt-1 font-display text-2xl font-bold text-cream">Gilded Crown Championship</h3>
        <p className="mt-2 max-w-[80%] text-sm text-cream-dim">
          Survive the field, reach the final table and lift the Crown. Win it for a permanent place in your trophy case.
        </p>
        <div className="mt-4 grid grid-cols-4 gap-2 text-center text-xs text-cream-dim">
          <Stat k="Field" v={`${fieldSize}`} />
          <Stat k="Stack" v={`${formatChips(startStack)}`} />
          <Stat k="Levels" v={`${schedule.length}`} />
          <Stat k="Prize" v={`${formatChips(buyIn * fieldSize)}`} />
        </div>
      </Panel>
      <BrassButton
        variant="amber" className="w-full py-3.5 text-lg" disabled={bankroll < buyIn}
        onClick={() => launch(nav, {
          mode: 'mtt', seatCount: 9, startingStack: startStack,
          sb: schedule[0].sb, bb: schedule[0].bb, buyIn,
          schedule, handsPerLevel: 6, fieldSize,
        }, 'Gilded Crown Championship')}
      >
        {bankroll < buyIn ? 'Not enough chips' : `Enter · ${formatChips(buyIn)}`}
      </BrassButton>
    </div>
  );
}

function Label({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <div className={`text-xs font-semibold uppercase tracking-widest text-cream-mute ${className}`}>{children}</div>;
}
function Choice({ children, active, onClick }: { children: React.ReactNode; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={() => { play('button'); onClick(); }}
      className={`tactile rounded-card px-2 py-2 text-center ring-1 transition ${
        active ? 'bg-brass-sheen text-walnut ring-brass shadow-brass' : 'bg-walnut-light/50 text-cream-dim ring-brass/20'
      }`}
    >
      {children}
    </button>
  );
}
function Stat({ k, v }: { k: string; v: string }) {
  return (
    <div className="rounded-card bg-walnut/40 py-2">
      <div className="text-[10px] uppercase tracking-wider text-cream-mute">{k}</div>
      <div className="tnum font-slab text-base font-bold text-brass-light">{v}</div>
    </div>
  );
}
export function Trophy({ size = 40 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48">
      <defs>
        <linearGradient id="tg" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#E9CF8B" /><stop offset="1" stopColor="#9A7A33" />
        </linearGradient>
      </defs>
      <path d="M14 8h20v8a10 10 0 0 1-20 0z" fill="url(#tg)" />
      <path d="M14 10H9a4 4 0 0 0 5 7M34 10h5a4 4 0 0 1-5 7" fill="none" stroke="#C9A24B" strokeWidth="2" />
      <rect x="21" y="26" width="6" height="8" fill="url(#tg)" />
      <rect x="15" y="34" width="18" height="5" rx="1.5" fill="url(#tg)" />
      <rect x="17" y="39" width="14" height="4" rx="1" fill="#8c6d2c" />
    </svg>
  );
}
