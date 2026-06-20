import { makeRng } from '../engine-poker/cards';
import type { MachineConfig, SpinResult, LineWin } from './types';

/**
 * Reusable slot engine. One implementation drives every machine "skin"; the
 * differences live entirely in the MachineConfig (reel strips, paytable,
 * features). Spin resolution is a pure function so the RTP simulator and the
 * renderer share exactly the same math.
 */

function pickFromStrip(strip: { id: string; weight: number }[], rng: () => number): string {
  const total = strip.reduce((s, x) => s + x.weight, 0);
  let r = rng() * total;
  for (const slot of strip) {
    r -= slot.weight;
    if (r < 0) return slot.id;
  }
  return strip[strip.length - 1].id;
}

/** Spin every reel and produce a grid[reel][row]. */
export function spinGrid(cfg: MachineConfig, rng: () => number): string[][] {
  const grid: string[][] = [];
  for (let reel = 0; reel < cfg.reels; reel++) {
    const strip = cfg.reelStrips[reel];
    const col: string[] = [];
    for (let row = 0; row < cfg.rows; row++) col.push(pickFromStrip(strip, rng));
    grid.push(col);
  }
  return grid;
}

/**
 * Evaluate a fixed grid against the paytable. `lineBet` is the bet per payline
 * (totalBet / paylines). Wins are left-aligned: matching from reel 0, with the
 * wild substituting for any non-scatter/bonus symbol.
 */
export function evaluateGrid(
  cfg: MachineConfig,
  grid: string[][],
  lineBet: number,
  totalBet: number,
): Pick<SpinResult, 'lineWins' | 'scatterCount' | 'scatterWin' | 'bonusTriggered' | 'baseWin'> {
  const symbolById = new Map(cfg.symbols.map((s) => [s.id, s]));
  const lineWins: LineWin[] = [];

  cfg.paylines.forEach((line, lineIdx) => {
    // The symbol on reel 0 (resolving wild to the first concrete symbol).
    const firstId = grid[0][line[0]];
    let target = firstId;
    if (cfg.wildId && firstId === cfg.wildId) {
      // find the first non-wild along the line to anchor the comparison
      for (let r = 1; r < cfg.reels; r++) {
        const id = grid[r][line[r]];
        if (id !== cfg.wildId) {
          target = id;
          break;
        }
      }
    }
    const tSym = symbolById.get(target);
    if (!tSym || tSym.scatter || tSym.bonus) return;

    let count = 0;
    for (let r = 0; r < cfg.reels; r++) {
      const id = grid[r][line[r]];
      if (id === target || (cfg.wildId && id === cfg.wildId)) count++;
      else break;
    }
    const mult = tSym.pays[count];
    if (mult && count >= 3) {
      lineWins.push({ line: lineIdx, symbolId: target, count, amount: mult * lineBet });
    }
  });

  // Scatters pay anywhere on the grid.
  let scatterCount = 0;
  if (cfg.scatterId) {
    for (const col of grid) for (const id of col) if (id === cfg.scatterId) scatterCount++;
  }
  let scatterWin = 0;
  if (cfg.scatterId && scatterCount >= 3) {
    const sc = symbolById.get(cfg.scatterId);
    const mult = sc?.pays[scatterCount] ?? sc?.pays[Math.min(scatterCount, cfg.reels)] ?? 0;
    scatterWin = mult * totalBet; // scatters pay on total bet
  }

  // Bonus trigger (count bonus symbols anywhere).
  let bonusCount = 0;
  if (cfg.bonusId) {
    for (const col of grid) for (const id of col) if (id === cfg.bonusId) bonusCount++;
  }
  const bonusTriggered = !!cfg.bonus && bonusCount >= cfg.bonus.triggerCount;

  const baseWin = lineWins.reduce((s, w) => s + w.amount, 0) + scatterWin;
  return { lineWins, scatterCount, scatterWin, bonusTriggered, baseWin };
}

export interface SpinOptions {
  totalBet: number;
  multiplier?: number; // active win multiplier (free spins)
  rng?: () => number;
}

/** Resolve a single base/free spin (no recursion into features). */
export function resolveSpin(cfg: MachineConfig, opts: SpinOptions): SpinResult {
  const rng = opts.rng ?? makeRng();
  const lineBet = opts.totalBet / cfg.paylines.length;
  const grid = spinGrid(cfg, rng);
  const ev = evaluateGrid(cfg, grid, lineBet, opts.totalBet);

  let freeSpinsTriggered = 0;
  if (cfg.freeSpins && ev.scatterCount >= cfg.freeSpins.triggerCount) {
    freeSpinsTriggered = cfg.freeSpins.award;
  }

  // Progressive jackpot: count the trigger symbol.
  let jackpotWon = 0;
  if (cfg.jackpot) {
    let c = 0;
    for (const col of grid) for (const id of col) if (id === cfg.jackpot.triggerSymbolId) c++;
    if (c >= cfg.jackpot.triggerCount) jackpotWon = -1; // sentinel: caller fills meter value
  }

  const mult = opts.multiplier ?? 1;
  const totalWin = ev.baseWin * mult;
  return {
    grid,
    lineWins: ev.lineWins,
    scatterCount: ev.scatterCount,
    scatterWin: ev.scatterWin,
    bonusTriggered: ev.bonusTriggered,
    freeSpinsTriggered,
    baseWin: ev.baseWin,
    totalWin,
    jackpotWon,
  };
}

/** Expected value of a pick-a-prize bonus (for honest RTP accounting). */
export function bonusExpectedValue(cfg: MachineConfig, totalBet: number): number {
  if (!cfg.bonus) return 0;
  const { prizes, picks } = cfg.bonus;
  const avg = prizes.reduce((s, p) => s + p, 0) / prizes.length;
  return avg * picks * totalBet;
}
