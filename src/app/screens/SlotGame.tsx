import { useEffect, useRef, useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { PhaserMount } from '../poker/PhaserMount';
import { SlotScene } from '../../scenes-slots/SlotScene';
import { getMachine } from '../../engine-slots/machines';
import { resolveSpin } from '../../engine-slots/engine';
import type { SpinResult } from '../../engine-slots/types';
import { makeRng } from '../../engine-poker/cards';
import { slotBus } from '../../lib/eventBus';
import { useGameStore } from '../../store/useGameStore';
import { BrassButton, formatChips, MoneyPill, Panel } from '../ui';
import { play, haptic } from '../../audio/sound';

// A normal-feeling social-casino bet ladder (total wager across all 10 lines).
const BET_LEVELS = [20, 40, 60, 100, 200, 400, 600, 1000, 2000, 4000, 10000];
const DEFAULT_BET_IDX = 3; // 100

export default function SlotGame() {
  const { id } = useParams();
  const nav = useNavigate();
  const cfg = id ? getMachine(id) : undefined;
  const bankroll = useGameStore((s) => s.bankroll);
  const jackpots = useGameStore((s) => s.jackpots);
  const store = useGameStore;

  const rngRef = useRef(makeRng());
  const [betIdx, setBetIdx] = useState(DEFAULT_BET_IDX);
  const [busy, setBusy] = useState(false);
  const [lastWin, setLastWin] = useState(0);
  const [showPaytable, setShowPaytable] = useState(false);
  const [freeInfo, setFreeInfo] = useState<{ remaining: number; mult: number; total: number; won: number } | null>(null);
  const [bonus, setBonus] = useState<{ resolve: (v: number) => void } | null>(null);
  const [celebration, setCelebration] = useState<{ amount: number; tier: 'big' | 'mega' | 'jackpot' } | null>(null);

  const totalBet = BET_LEVELS[betIdx];

  useEffect(() => {
    if (!cfg) { nav('/slots'); return; }
    const off = slotBus.on('scene-ready', () => slotBus.emit('set-machine', cfg));
    // if scene already ready
    const t = setTimeout(() => slotBus.emit('set-machine', cfg), 300);
    return () => { off(); clearTimeout(t); };
  }, [cfg, nav]);

  const waitStopped = useCallback(() => {
    return new Promise<void>((resolve) => {
      const off = slotBus.on('reels-stopped', () => { off(); resolve(); });
    });
  }, []);

  const presentWin = useCallback(async (result: SpinResult, jackpotWon: number) => {
    const win = result.totalWin + result.scatterWin * 0; // scatterWin already in baseWin
    const total = result.totalWin + jackpotWon;
    if (jackpotWon > 0) {
      setCelebration({ amount: jackpotWon, tier: 'jackpot' });
      play('jackpot'); haptic([20, 60, 20, 60, 40]);
      await delay(2600);
      setCelebration(null);
    }
    if (result.totalWin > 0) {
      const ratio = result.totalWin / totalBet;
      if (ratio >= 50) {
        setCelebration({ amount: result.totalWin, tier: 'mega' });
        play('winBig'); haptic([10, 40, 10, 40]);
        await delay(1800); setCelebration(null);
      } else if (ratio >= 12) {
        setCelebration({ amount: result.totalWin, tier: 'big' });
        play('winBig'); haptic(30);
        await delay(1300); setCelebration(null);
      } else {
        play('winSmall'); haptic(12);
      }
    }
    void win;
    return total;
  }, [totalBet]);

  const spinScene = useCallback(async (result: SpinResult, freeSpin: boolean) => {
    play('reelSpin');
    [600, 840, 1080].forEach((d) => setTimeout(() => play('reelStop'), d));
    slotBus.emit('spin', { result, freeSpin });
    await waitStopped();
    await delay(250);
  }, [waitStopped]);

  const runBonus = useCallback(async () => {
    if (!cfg?.bonus) return;
    const mult = await new Promise<number>((resolve) => setBonus({ resolve }));
    setBonus(null);
    const award = Math.round(mult * totalBet);
    if (award > 0) {
      store.getState().addToBankroll(award);
      setLastWin(award);
      setCelebration({ amount: award, tier: award / totalBet >= 30 ? 'mega' : 'big' });
      play('winBig');
      await delay(1500); setCelebration(null);
    }
  }, [cfg, totalBet, store]);

  const runFreeSpins = useCallback(async (award: number, mult: number) => {
    let remaining = award;
    let totalFree = award;
    let wonAll = 0;
    setFreeInfo({ remaining, mult, total: totalFree, won: 0 });
    play('coin');
    await delay(900);
    while (remaining > 0) {
      remaining--;
      const res = resolveSpin(cfg!, { totalBet, multiplier: mult, rng: rngRef.current });
      await spinScene(res, true);
      let jackpotWon = 0;
      if (res.jackpotWon === -1 && cfg!.jackpot) {
        jackpotWon = store.getState().resetJackpot(cfg!.id, cfg!.jackpot.seed);
        store.getState().recordStat({ slotJackpots: store.getState().stats.slotJackpots + 1 });
      }
      const got = await presentWin(res, jackpotWon);
      if (got > 0) store.getState().addToBankroll(got);
      wonAll += got;
      if (cfg!.freeSpins?.retrigger && res.freeSpinsTriggered > 0) {
        remaining += cfg!.freeSpins.award;
        totalFree += cfg!.freeSpins.award;
        play('coin');
      }
      setFreeInfo({ remaining, mult, total: totalFree, won: wonAll });
      store.getState().recordStat({ totalSpins: store.getState().stats.totalSpins + 1 });
      if (res.bonusTriggered) await runBonus();
      await delay(300);
    }
    await delay(700);
    setFreeInfo(null);
  }, [cfg, totalBet, spinScene, presentWin, runBonus, store]);

  const onSpin = useCallback(async () => {
    if (!cfg || busy) return;
    if (bankroll < totalBet) return;
    setBusy(true);
    setLastWin(0);
    store.getState().addToBankroll(-totalBet);
    // progressive jackpot contribution
    if (cfg.jackpot) store.getState().bumpJackpot(cfg.id, cfg.jackpot.seed, Math.round(totalBet * cfg.jackpot.contribRate));
    store.getState().recordStat({ totalSpins: store.getState().stats.totalSpins + 1 });
    haptic(10);

    const result = resolveSpin(cfg, { totalBet, rng: rngRef.current });
    await spinScene(result, false);

    let jackpotWon = 0;
    if (result.jackpotWon === -1 && cfg.jackpot) {
      jackpotWon = store.getState().resetJackpot(cfg.id, cfg.jackpot.seed);
      store.getState().recordStat({ slotJackpots: store.getState().stats.slotJackpots + 1 });
    }
    const got = await presentWin(result, jackpotWon);
    if (got > 0) {
      store.getState().addToBankroll(got);
      setLastWin(got);
      store.getState().recordStat({ biggestSlotWin: Math.max(store.getState().stats.biggestSlotWin, got) });
    }
    if (result.bonusTriggered) await runBonus();
    if (result.freeSpinsTriggered > 0 && cfg.freeSpins) {
      await runFreeSpins(result.freeSpinsTriggered, cfg.freeSpins.multiplier);
    }
    setBusy(false);
  }, [cfg, busy, bankroll, totalBet, spinScene, presentWin, runBonus, runFreeSpins, store]);

  if (!cfg) return null;
  const jp = cfg.jackpot ? (jackpots[cfg.id] ?? cfg.jackpot.seed) : null;

  return (
    <div className="fixed inset-0 mx-auto flex max-w-md flex-col bg-gradient-to-b from-[#171228] to-[#080610]">
      {/* top bar */}
      <div className="z-20 flex items-center justify-between px-3 pt-2" style={{ paddingTop: 'calc(var(--safe-top) + 6px)' }}>
        <button onClick={() => { play('button'); nav('/slots'); }}
          className="tactile rounded-pill bg-walnut-light/80 px-3 py-1.5 text-xs font-semibold text-cream ring-1 ring-brass/30">← Floor</button>
        <div className="text-center">
          <div className="font-display text-sm font-bold brass-text">{cfg.name}</div>
        </div>
        <MoneyPill value={bankroll} className="scale-90" />
      </div>

      {jp !== null && (
        <div className="z-20 mx-auto mt-2 flex items-center gap-2 rounded-pill bg-walnut/70 px-4 py-1 ring-1 ring-amber/40">
          <span className="text-[10px] uppercase tracking-widest text-brass/80">Jackpot</span>
          <span className="tnum font-slab text-base font-bold text-amber-light">{formatChips(jp)}</span>
        </div>
      )}

      {/* reels */}
      <div className="relative min-h-[44vh] flex-1">
        <PhaserMount scene={SlotScene} className="absolute inset-0" />
        {freeInfo && (
          <div className="pointer-events-none absolute inset-x-0 top-2 z-20 text-center">
            <div className="inline-block animate-fade-up rounded-pill bg-amber/90 px-4 py-1 text-sm font-bold text-walnut shadow-glow">
              Free Spins · {freeInfo.remaining} left · x{freeInfo.mult}
              {freeInfo.won > 0 && <span className="tnum"> · +{formatChips(freeInfo.won)}</span>}
            </div>
          </div>
        )}
      </div>

      {/* controls */}
      <div className="z-20 px-3 pb-3" style={{ paddingBottom: 'calc(var(--safe-bottom) + 10px)' }}>
        <div className="walnut grain rounded-panel p-3 shadow-panel ring-1 ring-brass/30">
          <div className="mb-2 flex items-center justify-between">
            <button onClick={() => { play('button'); setShowPaytable(true); }}
              className="tactile rounded-pill bg-walnut-light/70 px-3 py-1.5 text-xs font-semibold text-cream-dim ring-1 ring-brass/20">
              Paytable
            </button>
            <div className="text-center">
              <div className="text-[10px] uppercase tracking-widest text-cream-mute">Last Win</div>
              <div className="tnum font-slab text-lg font-bold text-amber-light">{formatChips(lastWin)}</div>
            </div>
            <div className="text-right">
              <button onClick={() => { play('button'); setBetIdx(BET_LEVELS.length - 1); }}
                disabled={busy}
                className="tactile rounded-pill bg-walnut-light/70 px-3 py-1.5 text-[11px] font-bold text-brass-light ring-1 ring-brass/20 disabled:opacity-40">
                Max Bet
              </button>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* bet selector */}
            <div className="flex items-center gap-1 rounded-pill bg-walnut-light/60 p-1 ring-1 ring-brass/20">
              <StepBtn disabled={busy || betIdx === 0} onClick={() => setBetIdx((i) => Math.max(0, i - 1))}>−</StepBtn>
              <div className="min-w-[78px] text-center">
                <div className="text-[9px] uppercase tracking-widest text-cream-mute">Total Bet</div>
                <div className="tnum text-base font-bold text-brass-light">{formatChips(totalBet)}</div>
                <div className="tnum text-[9px] text-cream-mute">{formatChips(totalBet / 10)}/line</div>
              </div>
              <StepBtn disabled={busy || betIdx === BET_LEVELS.length - 1} onClick={() => setBetIdx((i) => Math.min(BET_LEVELS.length - 1, i + 1))}>+</StepBtn>
            </div>

            <BrassButton variant="amber" sfx={null} disabled={busy || bankroll < totalBet}
              className="flex-1 py-3.5 text-lg"
              onClick={onSpin}>
              {busy ? '…' : bankroll < totalBet ? 'Low Chips' : 'SPIN'}
            </BrassButton>
          </div>
        </div>
      </div>

      {showPaytable && <Paytable cfg={cfg} onClose={() => setShowPaytable(false)} />}
      {bonus && cfg.bonus && <BonusPick prizes={cfg.bonus.prizes} picks={cfg.bonus.picks} onDone={bonus.resolve} />}
      {celebration && <Celebration {...celebration} />}
    </div>
  );
}

function StepBtn({ children, onClick, disabled }: { children: React.ReactNode; onClick: () => void; disabled?: boolean }) {
  return (
    <button disabled={disabled} onClick={() => { play('button'); onClick(); }}
      className="tactile grid h-8 w-8 place-items-center rounded-full bg-walnut text-lg font-bold text-brass-light ring-1 ring-brass/30 disabled:opacity-40">
      {children}
    </button>
  );
}

function delay(ms: number) {
  const rm = useGameStore.getState().settings.reducedMotion;
  return new Promise<void>((r) => setTimeout(r, rm ? Math.min(120, ms * 0.3) : ms));
}

// --- Paytable --------------------------------------------------------------
function Paytable({ cfg, onClose }: { cfg: ReturnType<typeof getMachine>; onClose: () => void }) {
  if (!cfg) return null;
  return (
    <div className="absolute inset-0 z-40 overflow-y-auto bg-black/80 px-4 py-6 no-scrollbar" onClick={onClose}>
      <Panel className="mx-auto max-w-sm p-5" >
        <div className="flex items-center justify-between">
          <h3 className="font-display text-xl font-bold brass-text">{cfg.name} · Paytable</h3>
          <button onClick={onClose} className="tactile text-cream-mute">✕</button>
        </div>
        <p className="mt-1 text-xs text-cream-dim">Pays left-to-right on 10 lines. Wild substitutes for all but Scatter/Bonus. Target RTP {(cfg.rtpTarget * 100).toFixed(0)}%.</p>
        <div className="mt-3 space-y-1.5">
          {cfg.symbols.map((s) => (
            <div key={s.id} className="flex items-center justify-between rounded-card bg-walnut/40 px-3 py-2">
              <span className="text-sm font-semibold text-cream">{s.name}{s.wild ? ' · Wild' : s.scatter ? ' · Scatter' : s.bonus ? ' · Bonus' : ''}</span>
              <span className="tnum text-xs text-brass-light">
                {[5, 4, 3].map((c) => s.pays[c] ? `${c}: ${s.pays[c]}x` : null).filter(Boolean).join('   ') || (s.bonus ? 'Triggers Bonus' : '')}
              </span>
            </div>
          ))}
        </div>
        <div className="mt-3 rounded-card bg-walnut/40 px-3 py-2 text-xs text-cream-dim">
          <b className="text-brass-light">Free Spins:</b> {cfg.freeSpins?.triggerCount}+ Scatters award {cfg.freeSpins?.award} spins at x{cfg.freeSpins?.multiplier}{cfg.freeSpins?.retrigger ? ', retriggerable.' : '.'}<br />
          <b className="text-brass-light">Bonus:</b> {cfg.bonus?.triggerCount} Bonus symbols launch a pick-a-prize round ({cfg.bonus?.picks} picks).
          {cfg.jackpot && <><br /><b className="text-amber-glow">Jackpot:</b> 5 {cfg.symbols.find((x) => x.id === cfg.jackpot!.triggerSymbolId)?.name} crack the progressive.</>}
        </div>
        <BrassButton variant="gold" className="mt-4 w-full py-2.5" onClick={onClose}>Close</BrassButton>
      </Panel>
    </div>
  );
}

// --- Bonus pick-a-prize ----------------------------------------------------
function BonusPick({ prizes, picks, onDone }: { prizes: number[]; picks: number; onDone: (total: number) => void }) {
  const [boxes] = useState(() => {
    const rng = makeRng();
    return Array.from({ length: 6 }, () => prizes[Math.floor(rng() * prizes.length)]);
  });
  const [revealed, setRevealed] = useState<number[]>([]);
  const [total, setTotal] = useState(0);

  const pick = (i: number) => {
    if (revealed.includes(i) || revealed.length >= picks) return;
    play('coin'); haptic(15);
    const next = [...revealed, i];
    setRevealed(next);
    setTotal((t) => t + boxes[i]);
    if (next.length >= picks) {
      setTimeout(() => onDone(boxes.reduce((s, v, idx) => s + (next.includes(idx) ? v : 0), 0)), 900);
    }
  };

  return (
    <div className="absolute inset-0 z-40 grid place-items-center bg-black/85 px-6">
      <Panel className="w-full max-w-sm animate-fade-up p-6 text-center">
        <h3 className="font-display text-2xl font-bold brass-text">Bonus Pick</h3>
        <p className="mt-1 text-sm text-cream-dim">Choose {picks} chests · {Math.max(0, picks - revealed.length)} left</p>
        <div className="mt-4 grid grid-cols-3 gap-3">
          {boxes.map((v, i) => {
            const open = revealed.includes(i);
            return (
              <button key={i} onClick={() => pick(i)} disabled={revealed.length >= picks && !open}
                className={`tactile aspect-square rounded-card ring-1 transition ${
                  open ? 'bg-gradient-to-br from-amber to-amber-light text-walnut ring-amber-glow' : 'bg-walnut-light/70 ring-brass/30 text-brass-light'
                }`}>
                {open ? <span className="tnum text-xl font-bold">{v}x</span> : <ChestIcon />}
              </button>
            );
          })}
        </div>
        <div className="mt-4 text-sm text-cream-dim">Total multiplier</div>
        <div className="tnum font-slab text-3xl font-bold text-amber-light">{total}x</div>
      </Panel>
    </div>
  );
}

function ChestIcon() {
  return (
    <svg viewBox="0 0 32 32" className="mx-auto h-8 w-8">
      <rect x="5" y="13" width="22" height="13" rx="2" fill="#8c6d2c" />
      <path d="M5 13a11 6 0 0 1 22 0z" fill="#c9a24b" />
      <rect x="14" y="16" width="4" height="6" fill="#3a2e22" />
    </svg>
  );
}

// --- Celebration overlay ---------------------------------------------------
function Celebration({ amount, tier }: { amount: number; tier: 'big' | 'mega' | 'jackpot' }) {
  const [display, setDisplay] = useState(0);
  useEffect(() => {
    let raf = 0;
    const start = performance.now();
    const dur = tier === 'jackpot' ? 2000 : 1100;
    const tick = (now: number) => {
      const p = Math.min(1, (now - start) / dur);
      setDisplay(Math.round(amount * (1 - Math.pow(1 - p, 3))));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [amount, tier]);

  const label = tier === 'jackpot' ? 'JACKPOT!' : tier === 'mega' ? 'MEGA WIN' : 'BIG WIN';
  return (
    <div className="pointer-events-none absolute inset-0 z-50 grid place-items-center">
      <div className="absolute inset-0 bg-black/55" />
      {tier !== 'big' && <Confetti />}
      <div className="relative animate-fade-up text-center">
        <div className={`font-display font-extrabold tracking-wide ${tier === 'jackpot' ? 'text-5xl' : 'text-4xl'} brass-text`}>{label}</div>
        <div className="tnum mt-2 font-slab text-5xl font-extrabold text-amber-light drop-shadow-[0_0_20px_rgba(232,116,59,0.7)]">
          {formatChips(display)}
        </div>
      </div>
    </div>
  );
}

function Confetti() {
  const pieces = Array.from({ length: 50 });
  const colors = ['#c9a24b', '#e8743b', '#f2e9d8', '#e4c878', '#2fa37c'];
  return (
    <div className="absolute inset-0 overflow-hidden">
      {pieces.map((_, i) => {
        const left = Math.random() * 100;
        const delay = Math.random() * 0.5;
        const dur = 1.4 + Math.random() * 1.2;
        return (
          <span key={i} className="absolute top-[-10%] block h-3 w-2"
            style={{
              left: `${left}%`, background: colors[i % colors.length],
              animation: `confetti-fall ${dur}s linear ${delay}s forwards`,
              transform: `rotate(${Math.random() * 360}deg)`,
            }} />
        );
      })}
    </div>
  );
}
