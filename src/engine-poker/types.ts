import type { Card } from './cards';
import type { Persona } from './ai';

export type Street = 'preflop' | 'flop' | 'turn' | 'river' | 'showdown';

export type ActionType = 'fold' | 'check' | 'call' | 'bet' | 'raise' | 'post-blind' | 'all-in';

export interface Action {
  type: ActionType;
  amount?: number; // total chips the player is putting in for this action
}

export interface PlayerState {
  id: string;
  name: string;
  avatar: string; // avatar key
  isHuman: boolean;
  persona?: Persona;
  stack: number;
  hole: Card[];
  committedThisStreet: number;
  committedTotal: number;
  hasFolded: boolean;
  isAllIn: boolean;
  sittingOut: boolean;
  hasActedThisRound: boolean;
  lastAction?: ActionType;
}

export interface LegalActions {
  canFold: boolean;
  canCheck: boolean;
  canCall: boolean;
  callAmount: number; // chips needed to call
  canBet: boolean;
  canRaise: boolean;
  minRaiseTo: number; // total bet size to raise to
  maxRaiseTo: number; // (all-in) total
  minBet: number;
}

export interface HandResultEntry {
  id: string;
  won: number; // chips won (gross from pots)
  net: number; // net for the hand (won - committedTotal)
  handName?: string;
  handDescr?: string;
  showed: boolean;
  bestCards?: Card[];
}

export interface HandSummary {
  board: Card[];
  results: HandResultEntry[];
  pots: { amount: number; eligible: string[]; winners: string[] }[];
}
