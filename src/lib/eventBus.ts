// A tiny typed event bus for React <-> Phaser communication. Phaser scenes
// never touch React state directly and vice versa; they exchange typed events.

type Handler<T> = (payload: T) => void;

export class EventBus<Events extends Record<string, any>> {
  private map = new Map<keyof Events, Set<Handler<any>>>();

  on<K extends keyof Events>(event: K, fn: Handler<Events[K]>): () => void {
    if (!this.map.has(event)) this.map.set(event, new Set());
    this.map.get(event)!.add(fn);
    return () => this.off(event, fn);
  }

  off<K extends keyof Events>(event: K, fn: Handler<Events[K]>) {
    this.map.get(event)?.delete(fn);
  }

  emit<K extends keyof Events>(event: K, payload: Events[K]) {
    this.map.get(event)?.forEach((fn) => fn(payload));
  }

  clear() {
    this.map.clear();
  }
}

// --- Poker bus ----
import type { LegalActions, Action, HandSummary, Street } from '../engine-poker/types';

export interface PokerSeatView {
  seat: number;
  id: string;
  name: string;
  avatar: string;
  isHuman: boolean;
  persona?: string;
  stack: number;
  bet: number;
  cards: string[]; // face-up cards (empty/back rendered by scene)
  folded: boolean;
  allIn: boolean;
  isButton: boolean;
  isActing: boolean;
  lastAction?: string;
  showCards: boolean;
  thinking?: boolean;
  status?: string; // e.g. "OUT", "SB", "BB"
  bubble?: string;
}

export interface PokerView {
  seats: PokerSeatView[];
  board: string[];
  pot: number;
  street: Street;
  message?: string;
}

export interface PokerEvents {
  // scene <- react/controller
  'state': PokerView;
  'request-action': { legal: LegalActions; toCall: number; pot: number; minRaiseTo: number; maxRaiseTo: number; stack: number };
  'clear-action': void;
  'showdown': HandSummary;
  'win': { seat: number; amount: number; big: boolean };
  'deal-hole': void;
  'deal-board': { cards: string[] };
  'chips-to-pot': void;
  // scene -> react
  'human-action': Action;
  'scene-ready': void;
}

import type { SpinResult } from '../engine-slots/types';
import type { MachineConfig } from '../engine-slots/types';

export interface SlotEvents {
  'set-machine': MachineConfig;
  'spin': { result: SpinResult; freeSpin: boolean };
  'reels-stopped': { result: SpinResult };
  'present-done': { result: SpinResult };
  'scene-ready': void;
}

export const pokerBus = new EventBus<PokerEvents>();
export const slotBus = new EventBus<SlotEvents>();
