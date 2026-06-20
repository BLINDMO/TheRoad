import { MACHINES } from '../src/engine-slots/machines';
import { resolveSpin, bonusExpectedValue } from '../src/engine-slots/engine';
import { makeRng } from '../src/engine-poker/cards';
import type { MachineConfig } from '../src/engine-slots/types';

// Honest RTP simulation: runs millions of weighted spins, recurses into free
// spins, and accounts for the pick-a-prize bonus expected value and the
// progressive jackpot contribution. Confirms actual RTP lands near target.

interface Breakdown {
  base: number; free: number; bonus: number; jackpot: number;
  fsTrig: number; bonusTrig: number; jpTrig: number;
}

function simulateOne(cfg: MachineConfig, rng: () => number, totalBet: number, b: Breakdown): number {
  let win = 0;
  const spin = resolveSpin(cfg, { totalBet, rng });
  win += spin.totalWin;
  b.base += spin.totalWin;

  if (spin.bonusTriggered) {
    const ev = bonusExpectedValue(cfg, totalBet);
    win += ev; b.bonus += ev; b.bonusTrig++;
  }

  if (spin.jackpotWon === -1 && cfg.jackpot) {
    const jp = cfg.jackpot.seed * 2;
    win += jp; b.jackpot += jp; b.jpTrig++;
  }

  if (spin.freeSpinsTriggered > 0 && cfg.freeSpins) {
    b.fsTrig++;
    let remaining = spin.freeSpinsTriggered;
    let guard = 0;
    while (remaining > 0 && guard++ < 2000) {
      remaining--;
      const fs = resolveSpin(cfg, { totalBet, multiplier: cfg.freeSpins.multiplier, rng });
      win += fs.totalWin; b.free += fs.totalWin;
      if (fs.bonusTriggered) {
        const ev = bonusExpectedValue(cfg, totalBet);
        win += ev; b.bonus += ev;
      }
      if (cfg.freeSpins.retrigger && fs.freeSpinsTriggered > 0) {
        remaining += cfg.freeSpins.award;
      }
    }
  }
  return win;
}

function run(cfg: MachineConfig, spins: number) {
  const rng = makeRng(0xC0FFEE ^ cfg.id.length);
  const totalBet = cfg.paylines.length; // 1 per line
  let totalBetSum = 0;
  let totalWin = 0;
  let hits = 0;
  let biggest = 0;
  const b: Breakdown = { base: 0, free: 0, bonus: 0, jackpot: 0, fsTrig: 0, bonusTrig: 0, jpTrig: 0 };
  for (let i = 0; i < spins; i++) {
    totalBetSum += totalBet;
    const w = simulateOne(cfg, rng, totalBet, b);
    totalWin += w;
    if (w > 0) hits++;
    if (w > biggest) biggest = w;
  }
  const rtp = totalWin / totalBetSum;
  const hitRate = hits / spins;
  const delta = rtp - cfg.rtpTarget;
  const ok = Math.abs(delta) <= 0.02;
  const pct = (x: number) => ((x / totalBetSum) * 100).toFixed(1);
  console.log(
    `${cfg.name.padEnd(18)} RTP=${(rtp * 100).toFixed(2)}%  ` +
      `target=${(cfg.rtpTarget * 100).toFixed(0)}%  Δ=${(delta * 100).toFixed(2)}pp  ` +
      `hit=${(hitRate * 100).toFixed(1)}%  ${ok ? 'OK' : '*** OFF ***'}`,
  );
  const rate = (n: number) => n === 0 ? '—' : `1/${Math.round(spins / n)}`;
  console.log(
    `   breakdown: base=${pct(b.base)}%  free=${pct(b.free)}%  ` +
      `bonus=${pct(b.bonus)}%  jackpot=${pct(b.jackpot)}%  maxWin=${biggest.toFixed(0)}x`,
  );
  console.log(
    `   triggers:  freespins=${rate(b.fsTrig)}  bonus=${rate(b.bonusTrig)}  jackpot=${rate(b.jpTrig)}`,
  );
  return ok;
}

const SPINS = Number(process.argv[2] ?? 2_000_000);
console.log(`\nGilded Aces — RTP simulation (${SPINS.toLocaleString()} spins/machine)\n`);
let allOk = true;
for (const m of MACHINES) allOk = run(m, SPINS) && allOk;
console.log(`\n${allOk ? 'All machines within ±2pp of target.' : 'Some machines need tuning.'}\n`);
process.exit(allOk ? 0 : 1);
