// Pure slot-engine types. No rendering.

export interface SlotSymbol {
  id: string;
  name: string;
  /** Payout multiplier keyed by count of matching symbols on a line. */
  pays: Record<number, number>;
  wild?: boolean;
  scatter?: boolean;
  /** Symbol that triggers the pick-a-prize bonus. */
  bonus?: boolean;
}

export interface ReelSlot {
  id: string;
  weight: number;
}

export interface FreeSpinConfig {
  triggerCount: number; // scatters required
  award: number; // free spins awarded
  multiplier: number; // win multiplier during free spins
  retrigger: boolean; // scatters during FS award more
}

export interface BonusConfig {
  triggerCount: number; // bonus symbols required
  picks: number; // how many items the player picks
  /** Prize pool (multipliers of total bet) the player reveals from. */
  prizes: number[];
}

export interface JackpotConfig {
  seed: number; // starting/reset value
  contribRate: number; // fraction of each bet added to the meter
  /** Combination that wins the progressive (e.g. 5 of the top symbol). */
  triggerSymbolId: string;
  triggerCount: number;
}

export interface MachineConfig {
  id: string;
  name: string;
  theme: string;
  blurb: string;
  reels: number;
  rows: number;
  symbols: SlotSymbol[];
  /** Weighted strip per reel. */
  reelStrips: ReelSlot[][];
  /** Each payline is an array of row indices, one per reel. */
  paylines: number[][];
  wildId?: string;
  scatterId?: string;
  bonusId?: string;
  freeSpins?: FreeSpinConfig;
  bonus?: BonusConfig;
  jackpot?: JackpotConfig;
  rtpTarget: number;
}

export interface LineWin {
  line: number;
  symbolId: string;
  count: number;
  amount: number;
}

export interface SpinResult {
  /** grid[reel][row] = symbol id */
  grid: string[][];
  lineWins: LineWin[];
  scatterCount: number;
  scatterWin: number;
  bonusTriggered: boolean;
  freeSpinsTriggered: number; // spins awarded this spin (0 if none)
  baseWin: number; // line + scatter wins for this single spin (pre-multiplier)
  totalWin: number; // including multiplier applied
  jackpotWon: number;
}
