import type { Card } from './cards';
import { freshDeck, shuffle, makeRng } from './cards';
import { compareTwo } from './evaluator';

// --- Persona system --------------------------------------------------------
// Each persona biases an EV baseline rather than acting as a difficulty knob.

export type PersonaKind = 'rock' | 'tag' | 'lag' | 'station' | 'maniac';

export interface Persona {
  kind: PersonaKind;
  label: string;
  // Equity threshold (0..1) above which the AI is comfortable continuing.
  callThreshold: number;
  // Equity above which it wants to raise for value.
  raiseThreshold: number;
  // Chance to fire a bluff when equity is low (per decision).
  bluffFreq: number;
  // Typical bet/raise size as a fraction of the pot.
  betSizing: number;
  // Aggression multiplier applied to raise frequency.
  aggression: number;
  // Thinking-time tell, in ms (min/max), purely cosmetic.
  thinkMs: [number, number];
}

export const PERSONAS: Record<PersonaKind, Persona> = {
  rock: {
    kind: 'rock', label: 'The Rock',
    callThreshold: 0.55, raiseThreshold: 0.78, bluffFreq: 0.03,
    betSizing: 0.55, aggression: 0.5, thinkMs: [1100, 2200],
  },
  tag: {
    kind: 'tag', label: 'Tight-Aggressive',
    callThreshold: 0.45, raiseThreshold: 0.62, bluffFreq: 0.14,
    betSizing: 0.7, aggression: 1.0, thinkMs: [700, 1600],
  },
  lag: {
    kind: 'lag', label: 'Loose-Aggressive',
    callThreshold: 0.36, raiseThreshold: 0.52, bluffFreq: 0.3,
    betSizing: 0.85, aggression: 1.4, thinkMs: [500, 1300],
  },
  station: {
    kind: 'station', label: 'Calling Station',
    callThreshold: 0.3, raiseThreshold: 0.8, bluffFreq: 0.02,
    betSizing: 0.5, aggression: 0.4, thinkMs: [600, 1500],
  },
  maniac: {
    kind: 'maniac', label: 'The Maniac',
    callThreshold: 0.28, raiseThreshold: 0.42, bluffFreq: 0.5,
    betSizing: 1.05, aggression: 1.9, thinkMs: [250, 700],
  },
};

// --- Monte Carlo equity ----------------------------------------------------

/**
 * Estimate win/tie equity for `hole` against `opponents` unknown opponents on
 * the current `board`, by sampling random opponent holdings and run-outs.
 */
export function estimateEquity(
  hole: Card[],
  board: Card[],
  opponents: number,
  iterations = 220,
  rng: () => number = makeRng(),
): number {
  if (opponents <= 0) return 1;
  const known = new Set<Card>([...hole, ...board]);
  const base = freshDeck().filter((c) => !known.has(c));

  let score = 0;
  for (let it = 0; it < iterations; it++) {
    const pool = shuffle(base.slice(), rng);
    let p = 0;
    const oppHoles: Card[][] = [];
    for (let o = 0; o < opponents; o++) oppHoles.push([pool[p++], pool[p++]]);
    const fullBoard = board.slice();
    while (fullBoard.length < 5) fullBoard.push(pool[p++]);

    // Compare hero against each opponent; hero "wins the sim" only if it beats
    // or ties all of them (ties split — counted as fractional).
    let beat = 0;
    let tied = 0;
    let lost = false;
    for (const oh of oppHoles) {
      const r = compareTwo(hole, oh, fullBoard);
      if (r > 0) beat++;
      else if (r === 0) tied++;
      else { lost = true; break; }
    }
    if (lost) continue;
    if (tied > 0) score += 1 / (tied + 1);
    else if (beat === opponents) score += 1;
  }
  return score / iterations;
}

// --- Decision engine -------------------------------------------------------

export interface AiContext {
  hole: Card[];
  board: Card[];
  activeOpponents: number;
  toCall: number; // chips needed to call
  pot: number;
  stack: number;
  minRaiseTo: number;
  maxRaiseTo: number;
  bigBlind: number;
  canCheck: boolean;
  /** 0 = early, 1 = button. Used to widen ranges in position. */
  positionFactor: number;
}

export interface AiDecision {
  action: 'fold' | 'check' | 'call' | 'raise' | 'all-in';
  amount?: number; // total to raise to
  equity: number;
}

export function decideAi(p: Persona, ctx: AiContext, rng: () => number = makeRng()): AiDecision {
  const iters = ctx.board.length >= 4 ? 160 : 240;
  let equity = estimateEquity(ctx.hole, ctx.board, ctx.activeOpponents, iters, rng);

  // Position widens perceived strength slightly.
  const posBonus = ctx.positionFactor * 0.05;
  const effEquity = Math.min(1, equity + posBonus);

  // Short-stack push/fold adjustment.
  const stackBB = ctx.stack / Math.max(1, ctx.bigBlind);
  const shortStack = stackBB <= 12;

  const potOdds = ctx.toCall > 0 ? ctx.toCall / (ctx.pot + ctx.toCall) : 0;

  // --- No bet to face: check or bet ---
  if (ctx.canCheck && ctx.toCall === 0) {
    const wantValue = effEquity >= p.raiseThreshold;
    const wantBluff = rng() < p.bluffFreq * p.aggression && effEquity < 0.4;
    if ((wantValue || wantBluff) && ctx.maxRaiseTo > 0) {
      return raiseDecision(p, ctx, equity, rng, wantBluff);
    }
    return { action: 'check', equity };
  }

  // --- Facing a bet ---
  // Must beat pot odds (plus persona threshold) to continue.
  const continueThreshold = Math.max(potOdds, p.callThreshold - posBonus);

  if (shortStack && effEquity >= p.callThreshold) {
    // Short stack jams instead of flat-calling with decent equity.
    if (effEquity >= p.callThreshold + 0.08 || rng() < 0.5) {
      return { action: 'all-in', amount: ctx.maxRaiseTo, equity };
    }
  }

  if (effEquity >= p.raiseThreshold && ctx.maxRaiseTo > ctx.minRaiseTo - 1) {
    // Strong: raise for value (sometimes just call to trap, esp. stations).
    if (p.kind === 'station' && rng() < 0.6) return callOrAllIn(ctx, equity);
    return raiseDecision(p, ctx, equity, rng, false);
  }

  if (effEquity >= continueThreshold) {
    return callOrAllIn(ctx, equity);
  }

  // Weak — consider a bluff-raise, otherwise fold.
  if (rng() < p.bluffFreq * p.aggression && ctx.toCall <= ctx.pot * 0.6) {
    return raiseDecision(p, ctx, equity, rng, true);
  }

  // Calling stations hate folding to small bets.
  if (p.kind === 'station' && potOdds < 0.3 && rng() < 0.7) {
    return callOrAllIn(ctx, equity);
  }

  return { action: 'fold', equity };
}

function callOrAllIn(ctx: AiContext, equity: number): AiDecision {
  if (ctx.toCall >= ctx.stack) return { action: 'all-in', amount: ctx.stack + 0, equity };
  return { action: 'call', equity };
}

function raiseDecision(
  p: Persona,
  ctx: AiContext,
  equity: number,
  rng: () => number,
  bluff: boolean,
): AiDecision {
  const sizeFactor = p.betSizing * (bluff ? 0.9 : 1) * (0.85 + rng() * 0.4);
  const target = Math.round((ctx.pot + ctx.toCall) * sizeFactor + ctx.toCall);
  let raiseTo = Math.max(ctx.minRaiseTo, target);
  if (raiseTo >= ctx.maxRaiseTo) return { action: 'all-in', amount: ctx.maxRaiseTo, equity };
  // Round to a clean-ish number.
  raiseTo = Math.min(ctx.maxRaiseTo, raiseTo);
  return { action: 'raise', amount: raiseTo, equity };
}

export function thinkTime(p: Persona, rng: () => number = Math.random): number {
  const [lo, hi] = p.thinkMs;
  return Math.round(lo + (hi - lo) * rng());
}
