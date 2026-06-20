import { HandEngine, type SeatInput } from '../../engine-poker/handEngine';
import { makeRng } from '../../engine-poker/cards';
import { decideAi, thinkTime, PERSONAS, type PersonaKind } from '../../engine-poker/ai';
import type { Action } from '../../engine-poker/types';
import type { BlindLevel } from '../../engine-poker/tournament';
import { FieldSimulator, payoutLadder } from '../../engine-poker/tournament';
import { pokerBus, type PokerSeatView } from '../../lib/eventBus';
import { useGameStore } from '../../store/useGameStore';
import { play, haptic } from '../../audio/sound';

export type PokerMode = 'cash' | 'sng' | 'mtt';

export interface PokerSetup {
  mode: PokerMode;
  seatCount: number;
  startingStack: number;
  sb: number;
  bb: number;
  buyIn: number; // chips moved from bankroll
  schedule?: BlindLevel[];
  handsPerLevel?: number;
  fieldSize?: number; // mtt
}

export interface TableResult {
  place?: number;
  fieldSize?: number;
  prize: number;
  busted: boolean;
  cashOut?: number; // cash game: chips returned to bankroll
}

interface Runtime {
  id: string;
  name: string;
  avatar: string;
  isHuman: boolean;
  persona?: PersonaKind;
  stack: number;
  eliminated: boolean;
  bubble?: string;
}

const NAMES = [
  'Vega', 'Marlowe', 'Sokolov', 'Reyes', 'Okonkwo', 'Bishop', 'Chen', 'Dubois',
  'Kapoor', 'Nyx', 'Romano', 'Halloran', 'Frost', 'Ueda', 'Castellano', 'Voss',
  'Mercer', 'Lindqvist', 'Adeyemi', 'Petrov',
];

const PERSONA_POOL: PersonaKind[] = ['rock', 'tag', 'lag', 'station', 'maniac', 'tag', 'lag'];

export class PokerController {
  private rng = makeRng();
  private seats: Runtime[] = [];
  private buttonIndex = 0;
  private handNo = 0;
  private levelIndex = 0;
  private field?: FieldSimulator;
  private running = false;
  private destroyed = false;
  private humanResolver: ((a: Action) => void) | null = null;
  private rebuyResolver: ((v: 'rebuy' | 'leave') => void) | null = null;
  private offBus: () => void;

  constructor(
    private setup: PokerSetup,
    private onResult: (r: TableResult) => void,
  ) {
    this.offBus = pokerBus.on('human-action', (a) => {
      this.humanResolver?.(a);
      this.humanResolver = null;
    });
    this.buildSeats();
    if (setup.mode === 'mtt' && setup.fieldSize) {
      this.field = new FieldSimulator(setup.fieldSize, setup.startingStack, this.rng);
    }
  }

  private buildSeats() {
    const names = [...NAMES].sort(() => this.rng() - 0.5);
    const personas = this.distributedPersonas(this.setup.seatCount - 1);
    this.seats.push({
      id: 'hero', name: useGameStore.getState().profile.name, avatar: useGameStore.getState().profile.avatar,
      isHuman: true, stack: this.setup.startingStack, eliminated: false,
    });
    for (let i = 0; i < this.setup.seatCount - 1; i++) {
      this.seats.push({
        id: `ai${i}`, name: names[i] ?? `Player ${i}`, avatar: names[i] ?? 'P',
        isHuman: false, persona: personas[i], stack: this.setup.startingStack, eliminated: false,
      });
    }
    // Randomize seating order so the hero isn't always first to act.
    this.seats.sort(() => this.rng() - 0.5);
    this.buttonIndex = Math.floor(this.rng() * this.seats.length);
  }

  // Always include at least one rock and one maniac so opponents visibly differ.
  private distributedPersonas(n: number): PersonaKind[] {
    const out: PersonaKind[] = [];
    if (n >= 1) out.push('rock');
    if (n >= 2) out.push('maniac');
    while (out.length < n) out.push(PERSONA_POOL[Math.floor(this.rng() * PERSONA_POOL.length)]);
    return out.sort(() => this.rng() - 0.5);
  }

  private delay(ms: number) {
    const rm = useGameStore.getState().settings.reducedMotion;
    return new Promise<void>((r) => setTimeout(r, rm ? Math.min(120, ms * 0.3) : ms));
  }

  private currentBlinds(): { sb: number; bb: number; ante: number } {
    if (this.setup.schedule) {
      const lvl = this.setup.schedule[Math.min(this.levelIndex, this.setup.schedule.length - 1)];
      return { sb: lvl.sb, bb: lvl.bb, ante: lvl.ante };
    }
    return { sb: this.setup.sb, bb: this.setup.bb, ante: 0 };
  }

  async start() {
    if (this.running) return;
    this.running = true;
    // Move buy-in out of bankroll.
    useGameStore.getState().addToBankroll(-this.setup.buyIn);
    while (!this.destroyed) {
      const done = await this.playHand();
      if (done) break;
      await this.delay(700);
    }
  }

  private activeSeats(): Runtime[] {
    return this.seats.filter((s) => !s.eliminated && s.stack > 0);
  }

  private async playHand(): Promise<boolean> {
    // Cash: handle human bust with a rebuy/leave prompt.
    const hero = this.seats.find((s) => s.id === 'hero')!;
    if (hero.stack <= 0) {
      if (this.setup.mode === 'cash') {
        const choice = await this.promptRebuy();
        if (choice === 'leave') {
          this.finish({ prize: 0, busted: true, cashOut: 0 });
          return true;
        }
        const amt = this.setup.startingStack;
        useGameStore.getState().addToBankroll(-amt);
        hero.stack = amt;
      } else {
        // Tournament bust — hero finished.
        this.handleTournamentEnd(true);
        return true;
      }
    }

    // Refill/cleanup the table.
    this.maintainTable();
    let active = this.activeSeats();
    if (active.length < 2) {
      // Everyone else gone — hero wins what's left.
      this.handleTournamentEnd(false);
      return true;
    }

    // Map active seats to engine inputs; rotate button to an active seat.
    this.advanceButton();
    const order = this.seatsFromButton();
    const seatInputs: SeatInput[] = order.map((s) => ({
      id: s.id, name: s.name, avatar: s.avatar, isHuman: s.isHuman,
      persona: s.persona ? PERSONAS[s.persona] : undefined, stack: s.stack,
    }));
    const blinds = this.currentBlinds();
    const engine = new HandEngine(seatInputs, {
      smallBlind: blinds.sb, bigBlind: blinds.bb, ante: blinds.ante,
      buttonIndex: 0, rng: this.rng,
    });
    this.handNo++;

    const idToRuntime = new Map(this.seats.map((s) => [s.id, s]));
    const heroIdx = engine.players.findIndex((p) => p.id === 'hero');

    this.emitState(engine, idToRuntime, 'New hand dealt');
    play('cardDeal');
    await this.delay(550);

    let lastBoardLen = 0;
    while (!engine.isComplete() && !this.destroyed) {
      // Detect a new street to animate the board + chip sweep.
      if (engine.board.length !== lastBoardLen) {
        lastBoardLen = engine.board.length;
        pokerBus.emit('deal-board', { cards: [...engine.board] });
        play('cardDeal');
        await this.delay(450);
      }
      const la = engine.legalActions();
      if (la === null || engine.currentActor === null) break;
      const actorSeat = engine.players[engine.currentActor];
      const rt = idToRuntime.get(actorSeat.id)!;
      this.emitState(engine, idToRuntime);

      let action: Action;
      if (rt.isHuman) {
        // Ask the UI to surface the action bar with the legal action set.
        pokerBus.emit('request-action', {
          legal: la,
          toCall: la.callAmount,
          pot: engine.pot,
          minRaiseTo: la.minRaiseTo,
          maxRaiseTo: la.maxRaiseTo,
          stack: actorSeat.stack,
        });
        action = await this.waitForHuman();
        pokerBus.emit('clear-action', undefined);
      } else {
        const persona = PERSONAS[rt.persona ?? 'tag'];
        await this.delay(thinkTime(persona, this.rng));
        action = this.aiAction(engine, persona);
      }
      if (this.destroyed) return true;
      this.applyActionSfx(action);
      engine.act(action);
      this.emitState(engine, idToRuntime);
      await this.delay(260);
    }

    if (engine.board.length !== lastBoardLen) {
      pokerBus.emit('deal-board', { cards: [...engine.board] });
    }

    // Resolve & present.
    const summary = engine.getSummary();
    if (summary) {
      pokerBus.emit('chips-to-pot', undefined);
      // Sync runtime stacks from engine.
      for (const p of engine.players) {
        const rt = idToRuntime.get(p.id);
        if (rt) rt.stack = p.stack;
      }
      const heroResult = summary.results.find((r) => r.id === 'hero');
      const heroWon = heroResult ? heroResult.won : 0;
      const winners = summary.pots.flatMap((p) => p.winners);
      const showdown = summary.results.some((r) => r.showed && r.handName);

      if (showdown) pokerBus.emit('showdown', summary);
      this.emitState(engine, idToRuntime, this.resultMessage(summary, engine, idToRuntime));

      // Win celebration.
      const totalPot = engine.pot;
      const heroSeatIdx = heroIdx;
      if (heroWon > 0) {
        const big = heroWon >= this.currentBlinds().bb * 25;
        pokerBus.emit('win', { seat: heroSeatIdx, amount: heroWon, big });
        play(big ? 'winBig' : 'winSmall');
        haptic(big ? [10, 40, 10, 40] : 20);
      } else if (winners.length) {
        const wseat = engine.players.findIndex((p) => p.id === winners[0]);
        pokerBus.emit('win', { seat: wseat, amount: totalPot, big: false });
      }
      this.maybeBubble(summary, idToRuntime);

      // Stats.
      const store = useGameStore.getState();
      store.recordStat({
        handsPlayed: store.stats.handsPlayed + 1,
        biggestPot: Math.max(store.stats.biggestPot, totalPot),
      });

      await this.delay(showdown ? 2600 : 1500);
    }

    // Tournament bookkeeping after the hand.
    this.processEliminations(idToRuntime);
    this.advanceLevelIfNeeded();
    this.tickField();

    return false;
  }

  private resultMessage(
    summary: NonNullable<ReturnType<HandEngine['getSummary']>>,
    engine: HandEngine,
    idToRt: Map<string, Runtime>,
  ): string {
    const top = summary.results.find((r) => r.showed && r.handName && r.won > 0);
    if (top) {
      const rt = idToRt.get(top.id);
      return `${rt?.name ?? 'Player'} wins with ${top.handDescr ?? top.handName}`;
    }
    const w = summary.pots[0]?.winners[0];
    const rt = w ? idToRt.get(w) : undefined;
    return rt ? `${rt.name} wins the pot` : 'Hand complete';
  }

  private aiAction(engine: HandEngine, persona: (typeof PERSONAS)[PersonaKind]): Action {
    const seat = engine.players[engine.currentActor!];
    const la = engine.legalActions()!;
    const toCall = la.callAmount;
    const active = engine.players.filter((p) => !p.hasFolded);
    const positionFactor = this.positionFactor(engine);
    const decision = decideAi(
      persona,
      {
        hole: seat.hole,
        board: engine.board,
        activeOpponents: Math.max(1, active.length - 1),
        toCall,
        pot: engine.pot,
        stack: seat.stack,
        minRaiseTo: la.minRaiseTo,
        maxRaiseTo: la.maxRaiseTo,
        bigBlind: this.currentBlinds().bb,
        canCheck: la.canCheck,
        positionFactor,
      },
      this.rng,
    );
    switch (decision.action) {
      case 'fold':
        return la.canCheck ? { type: 'check' } : { type: 'fold' };
      case 'check':
        return la.canCheck ? { type: 'check' } : { type: 'call' };
      case 'call':
        return { type: 'call' };
      case 'raise':
        return { type: 'raise', amount: Math.min(la.maxRaiseTo, Math.max(la.minRaiseTo, decision.amount ?? la.minRaiseTo)) };
      case 'all-in':
        return { type: 'all-in' };
    }
  }

  private positionFactor(engine: HandEngine): number {
    const n = engine.players.length;
    const actor = engine.currentActor!;
    let dist = (actor - engine.buttonIndex + n) % n;
    return dist / Math.max(1, n - 1);
  }

  private applyActionSfx(a: Action) {
    if (a.type === 'fold') play('fold');
    else if (a.type === 'check') play('check');
    else play('chip');
    if (a.type !== 'fold' && a.type !== 'check') haptic(8);
  }

  private waitForHuman(): Promise<Action> {
    return new Promise((resolve) => {
      this.humanResolver = resolve;
    });
  }
  private promptRebuy(): Promise<'rebuy' | 'leave'> {
    pokerBus.emit('state', this.lastView ?? { seats: [], board: [], pot: 0, street: 'preflop', message: 'You are out of chips' });
    pokerBus.emit('request-action', { legal: { canFold: false, canCheck: false, canCall: false, callAmount: 0, canBet: false, canRaise: false, minRaiseTo: 0, maxRaiseTo: 0, minBet: 0 }, toCall: 0, pot: 0, minRaiseTo: 0, maxRaiseTo: 0, stack: 0 });
    return new Promise((resolve) => {
      this.rebuyResolver = resolve;
    });
  }
  resolveRebuy(choice: 'rebuy' | 'leave') {
    this.rebuyResolver?.(choice);
    this.rebuyResolver = null;
  }

  private maintainTable() {
    if (this.setup.mode !== 'cash') return;
    // AI that busted: rebuy (most) or leave and get replaced.
    for (const s of this.seats) {
      if (s.isHuman || s.eliminated) continue;
      if (s.stack <= 0) {
        if (this.rng() < 0.8) {
          s.stack = this.setup.startingStack;
        } else {
          // Replace with a fresh face.
          s.name = NAMES[Math.floor(this.rng() * NAMES.length)];
          s.avatar = s.name;
          s.persona = PERSONA_POOL[Math.floor(this.rng() * PERSONA_POOL.length)];
          s.stack = this.setup.startingStack;
        }
      }
    }
  }

  private advanceButton() {
    const n = this.seats.length;
    for (let k = 1; k <= n; k++) {
      const idx = (this.buttonIndex + k) % n;
      if (!this.seats[idx].eliminated && this.seats[idx].stack > 0) {
        this.buttonIndex = idx;
        return;
      }
    }
  }

  private seatsFromButton(): Runtime[] {
    const active = this.activeSeats();
    const idxs = this.seats
      .map((s, i) => ({ s, i }))
      .filter(({ s }) => active.includes(s));
    // Order starting from button.
    const ordered: Runtime[] = [];
    const n = this.seats.length;
    for (let k = 0; k < n; k++) {
      const idx = (this.buttonIndex + k) % n;
      const s = this.seats[idx];
      if (active.includes(s)) ordered.push(s);
    }
    void idxs;
    return ordered;
  }

  private processEliminations(idToRt: Map<string, Runtime>) {
    if (this.setup.mode === 'cash') return;
    for (const s of this.seats) {
      if (!s.isHuman && !s.eliminated && s.stack <= 0) {
        s.eliminated = true;
        if (this.field) this.field.remaining = Math.max(this.activeRemaining(), this.field.remaining - 1);
      }
    }
    void idToRt;
  }

  private activeRemaining(): number {
    const tableAlive = this.seats.filter((s) => !s.eliminated && s.stack > 0).length;
    if (this.field) return Math.max(tableAlive, this.field.remaining);
    return tableAlive;
  }

  private advanceLevelIfNeeded() {
    if (!this.setup.schedule || !this.setup.handsPerLevel) return;
    if (this.handNo > 0 && this.handNo % this.setup.handsPerLevel === 0) {
      this.levelIndex = Math.min(this.levelIndex + 1, this.setup.schedule.length - 1);
    }
  }

  private tickField() {
    if (!this.field || !this.setup.handsPerLevel) return;
    const levelFactor = this.levelIndex / Math.max(1, (this.setup.schedule?.length ?? 1));
    this.field.tick(this.setup.handsPerLevel, levelFactor);
  }

  private handleTournamentEnd(heroBusted: boolean) {
    const fieldSize = this.setup.fieldSize ?? this.setup.seatCount;
    let remaining: number;
    if (heroBusted) {
      remaining = this.activeRemaining();
    } else {
      remaining = 1; // hero last standing
    }
    const place = heroBusted ? remaining + 1 : 1;
    const ladder = payoutLadder(fieldSize);
    const prizePool = this.setup.buyIn * fieldSize;
    const frac = place <= ladder.length ? ladder[place - 1] : 0;
    const prize = Math.round(prizePool * frac);
    if (prize > 0) useGameStore.getState().addToBankroll(prize);
    const store = useGameStore.getState();
    store.recordStat({
      tournamentsCashed: store.stats.tournamentsCashed + (prize > 0 ? 1 : 0),
      tournamentsWon: store.stats.tournamentsWon + (place === 1 ? 1 : 0),
    });
    this.finish({ place, fieldSize, prize, busted: heroBusted });
  }

  private finish(r: TableResult) {
    if (this.destroyed) return;
    // Cash game: return hero's remaining stack to bankroll.
    if (this.setup.mode === 'cash') {
      const hero = this.seats.find((s) => s.id === 'hero')!;
      const cashOut = Math.max(0, hero.stack);
      useGameStore.getState().addToBankroll(cashOut);
      r = { ...r, cashOut };
    }
    this.running = false;
    this.onResult(r);
  }

  /** Voluntary leave (cash) — cash out remaining chips. */
  leave() {
    if (this.setup.mode === 'cash') {
      this.finish({ prize: 0, busted: false });
    } else {
      // Surrender tournament — treat as bust at current standing.
      this.handleTournamentEnd(true);
    }
    this.destroy();
  }

  private lastView?: import('../../lib/eventBus').PokerView;

  private emitState(engine: HandEngine, idToRt: Map<string, Runtime>, message?: string) {
    const blinds = this.currentBlinds();
    const sbSeatId = this.smallBlindId(engine);
    const bbSeatId = this.bigBlindId(engine);
    const heroFolded = engine.players.find((p) => p.id === 'hero')?.hasFolded;
    const showdownPhase = engine.isComplete();

    const seats: PokerSeatView[] = engine.players.map((p, i) => {
      const rt = idToRt.get(p.id);
      const isHero = p.id === 'hero';
      const reveal = isHero || (showdownPhase && !p.hasFolded && this.handHadShowdown(engine));
      return {
        seat: i,
        id: p.id,
        name: rt?.name ?? p.name,
        avatar: rt?.avatar ?? p.avatar,
        isHuman: p.isHuman,
        persona: rt?.persona,
        stack: p.stack,
        bet: p.committedThisStreet,
        cards: reveal ? p.hole : [],
        folded: p.hasFolded,
        allIn: p.isAllIn,
        isButton: i === engine.buttonIndex,
        isActing: engine.currentActor === i && !showdownPhase,
        lastAction: p.lastAction,
        showCards: reveal && !!p.hole.length,
        status: p.id === sbSeatId ? 'SB' : p.id === bbSeatId ? 'BB' : undefined,
        bubble: rt?.bubble,
      };
    });

    const view = {
      seats,
      board: [...engine.board],
      pot: engine.pot,
      street: engine.street,
      message: message ?? (heroFolded ? 'You folded' : undefined),
    };
    this.lastView = view;
    pokerBus.emit('state', view);
    void blinds;
  }

  private handHadShowdown(engine: HandEngine): boolean {
    const s = engine.getSummary();
    return !!s && s.results.some((r) => r.showed && r.handName);
  }
  private smallBlindId(engine: HandEngine): string | undefined {
    const n = engine.players.length;
    const heads = engine.players.filter((p) => p.committedTotal > 0 || p.stack > 0).length === 2;
    const sbSeat = heads ? engine.buttonIndex : (engine.buttonIndex + 1) % n;
    return engine.players[sbSeat]?.id;
  }
  private bigBlindId(engine: HandEngine): string | undefined {
    const n = engine.players.length;
    const heads = engine.players.filter((p) => p.committedTotal > 0 || p.stack > 0).length === 2;
    const sbSeat = heads ? engine.buttonIndex : (engine.buttonIndex + 1) % n;
    return engine.players[(sbSeat + 1) % n]?.id;
  }

  private maybeBubble(summary: NonNullable<ReturnType<HandEngine['getSummary']>>, idToRt: Map<string, Runtime>) {
    for (const s of this.seats) s.bubble = undefined;
    const bigWin = summary.results.find((r) => r.won > this.currentBlinds().bb * 20);
    if (bigWin && this.rng() < 0.5) {
      const rt = idToRt.get(bigWin.id);
      if (rt && !rt.isHuman) rt.bubble = this.rng() < 0.5 ? 'Ship it! 🚢' : 'Too easy 😎';
    }
  }

  /** Public snapshot for tournament HUD. */
  tournamentInfo() {
    const blinds = this.currentBlinds();
    const lvl = this.setup.schedule ? this.setup.schedule[Math.min(this.levelIndex, this.setup.schedule.length - 1)] : undefined;
    const fieldSize = this.setup.fieldSize ?? this.setup.seatCount;
    return {
      level: lvl?.level ?? 1,
      sb: blinds.sb,
      bb: blinds.bb,
      ante: blinds.ante,
      remaining: this.activeRemaining(),
      fieldSize,
      field: this.field?.state(),
      paid: payoutLadder(fieldSize).length,
      heroStack: this.seats.find((s) => s.id === 'hero')?.stack ?? 0,
    };
  }

  destroy() {
    this.destroyed = true;
    this.running = false;
    this.humanResolver = null;
    this.rebuyResolver = null;
    this.offBus();
  }
}
