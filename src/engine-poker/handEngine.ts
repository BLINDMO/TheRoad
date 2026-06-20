import { Deck, makeRng, type Card } from './cards';
import { buildPots } from './sidepots';
import { solveAll, winnersAmong, toResult } from './evaluator';
import type {
  Action, LegalActions, PlayerState, Street, HandSummary, HandResultEntry,
} from './types';

export interface HandConfig {
  smallBlind: number;
  bigBlind: number;
  ante?: number;
  buttonIndex: number; // seat index of the dealer button among `players`
  rng?: () => number;
  /** Inject a deck for deterministic tests. */
  deck?: Deck;
}

export interface SeatInput {
  id: string;
  name: string;
  avatar: string;
  isHuman: boolean;
  persona?: PlayerState['persona'];
  stack: number;
}

export type HandEvent =
  | { type: 'blinds-posted' }
  | { type: 'hole-dealt' }
  | { type: 'action'; seat: number; action: Action }
  | { type: 'street'; street: Street; board: Card[] }
  | { type: 'showdown'; summary: HandSummary }
  | { type: 'hand-complete'; summary: HandSummary };

/**
 * Drives one full hand of No-Limit Texas Hold'em. Fully headless: feed it
 * actions via `act()` and read state via getters. The UI/AI layer decides
 * *what* to do; this enforces the rules and the money.
 */
export class HandEngine {
  players: PlayerState[];
  board: Card[] = [];
  street: Street = 'preflop';
  buttonIndex: number;
  currentActor: number | null = null;
  currentBet = 0; // highest committedThisStreet this round
  lastRaiseSize: number; // min increment for next raise
  pot = 0;
  private deck: Deck;
  private cfg: HandConfig;
  private complete = false;
  private summary?: HandSummary;
  private listeners: ((e: HandEvent) => void)[] = [];

  constructor(seats: SeatInput[], cfg: HandConfig) {
    this.cfg = cfg;
    this.buttonIndex = cfg.buttonIndex;
    this.lastRaiseSize = cfg.bigBlind;
    this.deck = cfg.deck ?? new Deck(cfg.rng ?? makeRng());
    this.players = seats.map((s) => ({
      ...s,
      hole: [],
      committedThisStreet: 0,
      committedTotal: 0,
      hasFolded: false,
      isAllIn: false,
      sittingOut: false,
      hasActedThisRound: false,
    }));
    this.start();
  }

  on(fn: (e: HandEvent) => void) {
    this.listeners.push(fn);
    return () => {
      this.listeners = this.listeners.filter((l) => l !== fn);
    };
  }
  private emit(e: HandEvent) {
    for (const l of this.listeners) l(e);
  }

  isComplete() {
    return this.complete;
  }
  getSummary() {
    return this.summary;
  }

  private activeSeats() {
    return this.players.map((p, i) => ({ p, i })).filter(({ p }) => !p.hasFolded);
  }
  private numInHand() {
    return this.players.filter((p) => !p.hasFolded).length;
  }

  private start() {
    const n = this.players.length;
    const heads = this.players.filter((p) => p.stack > 0).length === 2;
    // Antes
    if (this.cfg.ante) {
      for (const p of this.players) {
        const a = Math.min(this.cfg.ante, p.stack);
        p.stack -= a;
        p.committedTotal += a;
        this.pot += a;
        if (p.stack === 0) p.isAllIn = true;
      }
    }
    // Blinds. Heads-up: button is small blind and acts first preflop.
    const sbSeat = heads ? this.buttonIndex : this.nextOccupied(this.buttonIndex);
    const bbSeat = this.nextOccupied(sbSeat);
    this.postBlind(sbSeat, this.cfg.smallBlind);
    this.postBlind(bbSeat, this.cfg.bigBlind);
    this.currentBet = this.cfg.bigBlind;
    this.lastRaiseSize = this.cfg.bigBlind;
    this.emit({ type: 'blinds-posted' });

    // Deal two hole cards each.
    for (let r = 0; r < 2; r++) {
      let seat = this.nextOccupied(this.buttonIndex);
      for (let k = 0; k < n; k++) {
        if (this.players[seat].stack >= 0 && !this.players[seat].sittingOut) {
          this.players[seat].hole.push(this.deck.draw());
        }
        seat = (seat + 1) % n;
      }
    }
    this.emit({ type: 'hole-dealt' });

    // First to act preflop: left of BB (UTG), or SB/button in heads-up.
    this.currentActor = heads ? sbSeat : this.nextActiveToAct(bbSeat);
    this.maybeSkipToShowdownIfAllIn();
  }

  private postBlind(seat: number, amount: number) {
    const p = this.players[seat];
    const a = Math.min(amount, p.stack);
    p.stack -= a;
    p.committedThisStreet += a;
    p.committedTotal += a;
    this.pot += a;
    p.lastAction = 'post-blind';
    if (p.stack === 0) p.isAllIn = true;
  }

  private nextOccupied(from: number): number {
    const n = this.players.length;
    let i = (from + 1) % n;
    for (let k = 0; k < n; k++) {
      if (this.players[i].stack > 0 || this.players[i].committedTotal > 0) return i;
      i = (i + 1) % n;
    }
    return (from + 1) % n;
  }

  /** Next seat that still needs/can act (not folded, not all-in, has chips). */
  private nextActiveToAct(from: number): number | null {
    const n = this.players.length;
    let i = (from + 1) % n;
    for (let k = 0; k < n; k++) {
      const p = this.players[i];
      if (!p.hasFolded && !p.isAllIn && p.stack > 0) return i;
      i = (i + 1) % n;
    }
    return null;
  }

  legalActions(): LegalActions | null {
    if (this.currentActor === null || this.complete) return null;
    const p = this.players[this.currentActor];
    const toCall = this.currentBet - p.committedThisStreet;
    const canCheck = toCall <= 0;
    const canCall = toCall > 0;
    const callAmount = Math.min(toCall, p.stack);
    // A full raise requires reaching at least currentBet + lastRaiseSize.
    const minRaiseTo = this.currentBet + this.lastRaiseSize;
    const maxRaiseTo = p.committedThisStreet + p.stack; // all-in total
    const canRaise = p.stack > toCall; // has chips beyond the call
    const canBet = this.currentBet === 0 && p.stack > 0;
    return {
      canFold: true,
      canCheck,
      canCall,
      callAmount,
      canBet,
      canRaise: canRaise && !canBet,
      minRaiseTo: Math.min(maxRaiseTo, minRaiseTo),
      maxRaiseTo,
      minBet: Math.min(p.stack, this.cfg.bigBlind),
    };
  }

  act(action: Action) {
    if (this.currentActor === null || this.complete) throw new Error('No actor / hand complete');
    const seat = this.currentActor;
    const p = this.players[seat];
    const toCall = this.currentBet - p.committedThisStreet;

    switch (action.type) {
      case 'fold':
        p.hasFolded = true;
        p.lastAction = 'fold';
        break;
      case 'check':
        if (toCall > 0) throw new Error('Cannot check facing a bet');
        p.lastAction = 'check';
        break;
      case 'call': {
        const amt = Math.min(toCall, p.stack);
        this.moveChips(p, amt);
        p.lastAction = 'call';
        break;
      }
      case 'bet':
      case 'raise':
      case 'all-in': {
        const target =
          action.type === 'all-in'
            ? p.committedThisStreet + p.stack
            : action.amount ?? 0;
        const total = Math.min(target, p.committedThisStreet + p.stack);
        const added = total - p.committedThisStreet;
        if (added <= 0) throw new Error('Raise must add chips');
        const raiseIncrement = total - this.currentBet;
        this.moveChips(p, added);
        // A raise that reaches >= a full raise updates the min-raise size.
        // Short all-ins that don't constitute a full raise don't reopen action.
        if (total > this.currentBet) {
          if (raiseIncrement >= this.lastRaiseSize) {
            this.lastRaiseSize = raiseIncrement;
            this.reopenAction(seat);
          }
          this.currentBet = total;
        }
        p.lastAction = p.isAllIn ? 'all-in' : action.type === 'bet' ? 'bet' : 'raise';
        break;
      }
      default:
        throw new Error(`Unsupported action ${action.type}`);
    }

    p.hasActedThisRound = true;
    this.emit({ type: 'action', seat, action });
    this.advance();
  }

  private moveChips(p: PlayerState, amt: number) {
    const a = Math.min(amt, p.stack);
    p.stack -= a;
    p.committedThisStreet += a;
    p.committedTotal += a;
    this.pot += a;
    if (p.stack === 0) p.isAllIn = true;
  }

  /** A full raise reopens the betting for everyone else. */
  private reopenAction(raiser: number) {
    this.players.forEach((p, i) => {
      if (i !== raiser && !p.hasFolded && !p.isAllIn) p.hasActedThisRound = false;
    });
  }

  private roundComplete(): boolean {
    if (this.numInHand() <= 1) return true;
    const canAct = this.players.filter((p) => !p.hasFolded && !p.isAllIn && p.stack > 0);
    if (canAct.length === 0) return true;
    return canAct.every((p) => p.hasActedThisRound && p.committedThisStreet === this.currentBet);
  }

  private advance() {
    if (this.numInHand() === 1) {
      this.finish();
      return;
    }
    if (this.roundComplete()) {
      this.nextStreet();
      return;
    }
    const next = this.nextActiveToAct(this.currentActor!);
    if (next === null) {
      this.nextStreet();
    } else {
      this.currentActor = next;
    }
  }

  private resetStreetBets() {
    this.currentBet = 0;
    this.lastRaiseSize = this.cfg.bigBlind;
    for (const p of this.players) {
      p.committedThisStreet = 0;
      if (!p.hasFolded && !p.isAllIn) p.hasActedThisRound = false;
      p.lastAction = undefined;
    }
  }

  private nextStreet() {
    if (this.street === 'river') {
      this.showdown();
      return;
    }
    this.resetStreetBets();
    if (this.street === 'preflop') {
      this.deck.burn();
      this.board.push(...this.deck.drawMany(3));
      this.street = 'flop';
    } else if (this.street === 'flop') {
      this.deck.burn();
      this.board.push(this.deck.draw());
      this.street = 'turn';
    } else if (this.street === 'turn') {
      this.deck.burn();
      this.board.push(this.deck.draw());
      this.street = 'river';
    }
    this.emit({ type: 'street', street: this.street, board: [...this.board] });

    // First to act postflop is first active seat left of the button.
    const first = this.nextActiveToAct(this.buttonIndex);
    this.currentActor = first;
    this.maybeSkipToShowdownIfAllIn();
  }

  /** If betting is closed (<=1 can act), run remaining streets then showdown. */
  private maybeSkipToShowdownIfAllIn() {
    const canAct = this.players.filter((p) => !p.hasFolded && !p.isAllIn && p.stack > 0);
    if (this.numInHand() <= 1) return; // fold-out handled elsewhere
    if (canAct.length <= 1 && this.allBetsMatched()) {
      // Run out the board.
      while (this.street !== 'river' && this.street !== 'showdown') {
        this.resetStreetBets();
        if (this.street === 'preflop') {
          this.deck.burn();
          this.board.push(...this.deck.drawMany(3));
          this.street = 'flop';
        } else if (this.street === 'flop') {
          this.deck.burn();
          this.board.push(this.deck.draw());
          this.street = 'turn';
        } else if (this.street === 'turn') {
          this.deck.burn();
          this.board.push(this.deck.draw());
          this.street = 'river';
        }
        this.emit({ type: 'street', street: this.street, board: [...this.board] });
      }
      this.showdown();
    }
  }

  private allBetsMatched(): boolean {
    const live = this.players.filter((p) => !p.hasFolded && !p.isAllIn && p.stack > 0);
    return live.every((p) => p.committedThisStreet === this.currentBet);
  }

  // --- Resolution ----------------------------------------------------------

  private finish() {
    // Everyone folded but one — winner takes the whole pot, no showdown.
    const winner = this.players.find((p) => !p.hasFolded)!;
    const results: HandResultEntry[] = this.players.map((p) => ({
      id: p.id,
      won: p === winner ? this.pot : 0,
      net: (p === winner ? this.pot : 0) - p.committedTotal,
      showed: false,
    }));
    winner.stack += this.pot;
    this.summary = {
      board: [...this.board],
      results,
      pots: [{ amount: this.pot, eligible: [winner.id], winners: [winner.id] }],
    };
    this.complete = true;
    this.currentActor = null;
    this.emit({ type: 'hand-complete', summary: this.summary });
  }

  private showdown() {
    this.street = 'showdown';
    const contribs = this.players.map((p) => ({
      id: p.id,
      committed: p.committedTotal,
      folded: p.hasFolded,
    }));
    const pots = buildPots(contribs);

    const contenders = this.players.filter((p) => !p.hasFolded);
    const solved = solveAll(
      contenders.map((p) => ({ id: p.id, hole: p.hole })),
      this.board,
    );
    const solvedById = new Map(solved.map((s) => [s.id, s]));
    const byId = new Map(solved.map((s) => [s.id, toResult(s)]));

    const won = new Map<string, number>();
    const potOut: HandSummary['pots'] = [];

    for (const pot of pots) {
      const eligibleSolved = pot.eligible
        .map((id) => solvedById.get(id))
        .filter((s): s is NonNullable<typeof s> => !!s);
      if (eligibleSolved.length === 0) continue;
      // Per-pot winners must be resolved among the pot's eligible subset using
      // full hand strength (Hand.winners), NOT the coarse category rank.
      const winners = winnersAmong(eligibleSolved);
      const share = Math.floor(pot.amount / winners.length);
      let remainder = pot.amount - share * winners.length;
      // Odd chips to the first winner in seat order left of the button.
      const ordered = this.seatOrderFromButton(winners);
      for (const id of ordered) {
        let amt = share;
        if (remainder > 0) {
          amt += 1;
          remainder--;
        }
        won.set(id, (won.get(id) ?? 0) + amt);
      }
      potOut.push({ amount: pot.amount, eligible: pot.eligible, winners });
    }

    const results: HandResultEntry[] = this.players.map((p) => {
      const w = won.get(p.id) ?? 0;
      const ev = byId.get(p.id);
      const isWinner = w > 0;
      return {
        id: p.id,
        won: w,
        net: w - p.committedTotal,
        handName: ev?.name,
        handDescr: ev?.descr,
        bestCards: ev?.cards,
        // Winners always show; losers muck by default (UI may override).
        showed: isWinner && !p.hasFolded,
      };
    });

    for (const p of this.players) p.stack += won.get(p.id) ?? 0;

    this.summary = { board: [...this.board], results, pots: potOut };
    this.complete = true;
    this.currentActor = null;
    this.emit({ type: 'showdown', summary: this.summary });
    this.emit({ type: 'hand-complete', summary: this.summary });
  }

  private seatOrderFromButton(ids: string[]): string[] {
    const order: string[] = [];
    const n = this.players.length;
    let i = (this.buttonIndex + 1) % n;
    for (let k = 0; k < n; k++) {
      const p = this.players[i];
      if (ids.includes(p.id)) order.push(p.id);
      i = (i + 1) % n;
    }
    return order;
  }
}
