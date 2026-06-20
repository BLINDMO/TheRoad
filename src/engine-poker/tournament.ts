// Tournament structures: blind schedules, payout ladders, and a numerically
// honest background-field simulator for the marquee multi-table event.

export interface BlindLevel {
  level: number;
  sb: number;
  bb: number;
  ante: number;
}

/** Build an escalating schedule; antes kick in from `anteFrom`. */
export function buildSchedule(
  baseBB: number,
  levels: number,
  growth = 1.5,
  anteFrom = 4,
): BlindLevel[] {
  const out: BlindLevel[] = [];
  let bb = baseBB;
  for (let i = 0; i < levels; i++) {
    const rbb = roundNice(bb);
    out.push({
      level: i + 1,
      sb: Math.max(1, Math.round(rbb / 2)),
      bb: rbb,
      ante: i + 1 >= anteFrom ? Math.max(1, Math.round(rbb * 0.12)) : 0,
    });
    bb *= growth;
  }
  return out;
}

function roundNice(n: number): number {
  if (n < 50) return Math.round(n / 5) * 5;
  if (n < 200) return Math.round(n / 25) * 25;
  if (n < 1000) return Math.round(n / 50) * 50;
  if (n < 5000) return Math.round(n / 100) * 100;
  return Math.round(n / 500) * 500;
}

/**
 * Standard-ish payout ladder for a field. Returns fraction of the prize pool
 * per finishing place (index 0 = winner).
 */
export function payoutLadder(fieldSize: number): number[] {
  if (fieldSize <= 2) return [1];
  if (fieldSize <= 3) return [0.65, 0.35];
  if (fieldSize <= 6) return [0.5, 0.3, 0.2];
  if (fieldSize <= 9) return [0.5, 0.3, 0.2];
  if (fieldSize <= 18) return [0.4, 0.25, 0.16, 0.1, 0.05, 0.04];
  if (fieldSize <= 45) return [0.3, 0.2, 0.13, 0.09, 0.07, 0.06, 0.05, 0.05, 0.05];
  // Large field — pay ~15%.
  return [0.26, 0.165, 0.11, 0.08, 0.06, 0.045, 0.035, 0.03, 0.025,
    0.02, 0.018, 0.016, 0.014, 0.012, 0.01, 0.01, 0.01, 0.008, 0.008, 0.006];
}

export function paidPlaces(fieldSize: number): number {
  return payoutLadder(fieldSize).length;
}

// --- Background field simulator (marquee MTT) ------------------------------

export interface FieldState {
  remaining: number;
  chipLeader: number;
  averageStack: number;
  totalChips: number;
}

/**
 * Simulates the rest of the field bust at other tables. We don't render those
 * tables, but we keep the bust rate, chip leader and average stack honest so
 * the standings progress like a real event.
 */
export class FieldSimulator {
  remaining: number;
  private startStack: number;
  private leader: number;
  private rng: () => number;

  constructor(fieldSize: number, startStack: number, rng: () => number) {
    this.remaining = fieldSize;
    this.startStack = startStack;
    this.leader = startStack;
    this.rng = rng;
  }

  totalChips(): number {
    return this.remaining * this.startStack;
  }

  /** Advance the field after one of the hero's hands completes. */
  tick(handsPerLevel: number, levelFactor: number): number {
    if (this.remaining <= 9) return 0;
    // More busts as blinds rise; scaled so a big field thins steadily.
    const expectedBusts = Math.max(0, (this.remaining / handsPerLevel) * (0.6 + levelFactor * 0.5));
    let busts = Math.floor(expectedBusts);
    if (this.rng() < expectedBusts - busts) busts++;
    busts = Math.min(busts, this.remaining - 9);
    this.remaining -= busts;
    // Chip leader drifts upward as chips consolidate.
    const avg = this.totalChips() / this.remaining;
    this.leader = Math.max(this.leader, Math.round(avg * (1.8 + this.rng() * 1.4)));
    return busts;
  }

  state(): FieldState {
    const total = this.totalChips();
    return {
      remaining: this.remaining,
      chipLeader: Math.min(this.leader, total),
      averageStack: Math.round(total / this.remaining),
      totalChips: total,
    };
  }
}
