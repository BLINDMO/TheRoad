import { useNavigate } from 'react-router-dom';
import { BackBar, MoneyPill, formatChips } from '../ui';
import { MACHINES } from '../../engine-slots/machines';
import { useGameStore } from '../../store/useGameStore';
import { play, haptic } from '../../audio/sound';

export default function SlotsLobby() {
  const nav = useNavigate();
  const bankroll = useGameStore((s) => s.bankroll);
  const jackpots = useGameStore((s) => s.jackpots);

  return (
    <div className="min-h-full bg-gradient-to-b from-[#1a1430] to-[#0a0712]">
      <BackBar title="Slots Floor" right={<MoneyPill value={bankroll} />} />
      <div className="space-y-4 px-4 pb-28 pt-1">
        {MACHINES.map((m) => {
          const jp = m.jackpot ? (jackpots[m.id] ?? m.jackpot.seed) : null;
          return (
            <button
              key={m.id}
              onClick={() => { play('button'); haptic(10); nav(`/slots/${m.id}`); }}
              className="tactile relative block w-full overflow-hidden rounded-panel text-left shadow-panel ring-1 ring-brass/30"
              style={{ background: gradientFor(m.theme) }}
            >
              <div className="grain absolute inset-0" />
              <div className="relative flex items-center gap-4 p-4">
                <MachinePreview theme={m.theme} />
                <div className="flex-1">
                  <div className="font-display text-xl font-bold text-cream">{m.name}</div>
                  <div className="mt-0.5 text-xs text-cream-dim">{m.blurb}</div>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    <Tag>10 lines</Tag>
                    <Tag>Free spins</Tag>
                    <Tag>Bonus pick</Tag>
                    {m.jackpot && <Tag accent>Jackpot</Tag>}
                    <Tag>RTP {(m.rtpTarget * 100).toFixed(0)}%</Tag>
                  </div>
                </div>
              </div>
              {jp !== null && (
                <div className="relative flex items-center justify-between border-t border-brass/20 bg-walnut/40 px-4 py-2">
                  <span className="text-[11px] uppercase tracking-widest text-brass/80">Progressive Jackpot</span>
                  <span className="tnum font-slab text-lg font-bold text-amber-light animate-pulse-glow rounded px-1">
                    {formatChips(jp)}
                  </span>
                </div>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function gradientFor(theme: string) {
  switch (theme) {
    case 'fruit': return 'linear-gradient(135deg,#1c4636,#0c2b1f)';
    case 'gems': return 'linear-gradient(135deg,#1a2740,#0a1326)';
    case 'egypt': return 'linear-gradient(135deg,#3a2a12,#1c1306)';
    default: return '#1a1430';
  }
}

function Tag({ children, accent }: { children: React.ReactNode; accent?: boolean }) {
  return (
    <span className={`rounded-pill px-2 py-0.5 text-[10px] font-semibold ring-1 ${
      accent ? 'bg-amber/20 text-amber-glow ring-amber/40' : 'bg-walnut/40 text-cream-dim ring-brass/20'
    }`}>{children}</span>
  );
}

function MachinePreview({ theme }: { theme: string }) {
  const sym = theme === 'fruit'
    ? [['#ff5d6c', '#ffc14d', '#3fd08a']]
    : theme === 'gems'
      ? [['#dff1ff', '#ff5d6c', '#3fd08a']]
      : [['#caa24b', '#e8743b', '#caa24b']];
  return (
    <div className="grid h-16 w-16 shrink-0 grid-cols-3 gap-1 rounded-card bg-[#0a0712] p-1.5 ring-1 ring-brass/30">
      {sym[0].map((c, i) => (
        <div key={i} className="rounded-sm" style={{ background: `radial-gradient(circle at 35% 30%, #fff6, ${c})` }} />
      ))}
      {[0, 1, 2].map((i) => <div key={'b' + i} className="rounded-sm bg-walnut-light/40" />)}
      {[0, 1, 2].map((i) => <div key={'c' + i} className="rounded-sm bg-walnut-light/30" />)}
    </div>
  );
}
