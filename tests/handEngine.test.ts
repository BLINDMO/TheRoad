import { describe, it, expect } from 'vitest';
import { HandEngine, type SeatInput } from '../src/engine-poker/handEngine';
import { Deck, makeRng } from '../src/engine-poker/cards';

function seat(id: string, stack: number): SeatInput {
  return { id, name: id, avatar: 'a', isHuman: false, stack };
}

describe('HandEngine — full hands', () => {
  it('conserves chips and produces exactly one winner pool over a random hand', () => {
    const seats = [seat('P0', 1000), seat('P1', 1000), seat('P2', 1000)];
    const startTotal = seats.reduce((s, x) => s + x.stack, 0);
    const eng = new HandEngine(seats, {
      smallBlind: 5,
      bigBlind: 10,
      buttonIndex: 0,
      rng: makeRng(12345),
    });
    // Drive everyone to just call/check down using legal actions.
    let guard = 0;
    while (!eng.isComplete() && guard++ < 200) {
      const la = eng.legalActions();
      if (!la) break;
      if (la.canCheck) eng.act({ type: 'check' });
      else if (la.canCall) eng.act({ type: 'call' });
      else eng.act({ type: 'fold' });
    }
    expect(eng.isComplete()).toBe(true);
    const endTotal = eng.players.reduce((s, p) => s + p.stack, 0);
    expect(endTotal).toBe(startTotal);
    const summary = eng.getSummary()!;
    const distributed = summary.results.reduce((s, r) => s + r.won, 0);
    expect(distributed).toBe(eng.pot);
  });

  it('constructs correct main + side pot in a 3-way unequal all-in', () => {
    // Deal order for 3 players, button=0:
    // holes: P1a, P2a, P0a, P1b, P2b, P0b ; burn; flop x3; burn; turn; burn; river
    const stack = [
      'Ks', '7d', 'As', 'Kh', '2c', 'Ah', // holes
      '2d',                                 // burn
      'Ad', 'Kd', '9c',                     // flop
      '5d', '4h',                           // burn, turn
      '6d', '3s',                           // burn, river
    ];
    const deck = Deck.fromStack(stack);
    const seats = [seat('P0', 50), seat('P1', 200), seat('P2', 200)];
    const eng = new HandEngine(seats, {
      smallBlind: 5,
      bigBlind: 10,
      buttonIndex: 0,
      deck,
    });

    // P0 (UTG/button-as-first here) jams 50.
    eng.act({ type: 'all-in' });
    // P1 (SB) jams 200.
    eng.act({ type: 'all-in' });
    // P2 (BB) calls all-in.
    eng.act({ type: 'call' });

    expect(eng.isComplete()).toBe(true);
    const s = eng.getSummary()!;

    // Two pots: main (all three) and side (P1, P2).
    expect(s.pots).toHaveLength(2);
    expect(s.pots[0].amount).toBe(150);
    expect(s.pots[0].eligible.sort()).toEqual(['P0', 'P1', 'P2']);
    expect(s.pots[1].amount).toBe(300);
    expect(s.pots[1].eligible.sort()).toEqual(['P1', 'P2']);

    // P0 (trip aces) wins main; P1 (trip kings) wins side.
    expect(s.pots[0].winners).toEqual(['P0']);
    expect(s.pots[1].winners).toEqual(['P1']);

    const p0 = eng.players.find((p) => p.id === 'P0')!;
    const p1 = eng.players.find((p) => p.id === 'P1')!;
    const p2 = eng.players.find((p) => p.id === 'P2')!;
    expect(p0.stack).toBe(150);
    expect(p1.stack).toBe(300);
    expect(p2.stack).toBe(0);
    // Chip conservation: 450 in, 450 out.
    expect(p0.stack + p1.stack + p2.stack).toBe(450);
  });

  it('awards the whole pot without showdown when everyone folds', () => {
    const seats = [seat('P0', 1000), seat('P1', 1000), seat('P2', 1000)];
    const eng = new HandEngine(seats, {
      smallBlind: 5, bigBlind: 10, buttonIndex: 0, rng: makeRng(7),
    });
    // P0 raises, P1 folds, P2 folds -> P0 wins blinds.
    const la = eng.legalActions()!;
    eng.act({ type: 'raise', amount: Math.max(la.minRaiseTo, 30) });
    eng.act({ type: 'fold' });
    eng.act({ type: 'fold' });
    expect(eng.isComplete()).toBe(true);
    const s = eng.getSummary()!;
    expect(s.pots).toHaveLength(1);
    expect(s.pots[0].winners).toEqual(['P0']);
    // Winner net should be positive (won the blinds).
    const p0 = s.results.find((r) => r.id === 'P0')!;
    expect(p0.won).toBeGreaterThan(0);
  });

  it('enforces minimum raise sizing', () => {
    const seats = [seat('P0', 1000), seat('P1', 1000)];
    const eng = new HandEngine(seats, {
      smallBlind: 5, bigBlind: 10, buttonIndex: 0, rng: makeRng(3),
    });
    const la = eng.legalActions()!;
    // Heads-up, BB=10, min raise increment = BB, so minRaiseTo = 20.
    expect(la.minRaiseTo).toBe(20);
  });
});

describe('AI personas', () => {
  it('a rock folds weak hands a maniac would play', async () => {
    const { decideAi, PERSONAS } = await import('../src/engine-poker/ai');
    const ctx = {
      hole: ['2c', '7d'], board: [] as string[], activeOpponents: 3,
      toCall: 40, pot: 60, stack: 1000, minRaiseTo: 80, maxRaiseTo: 1040,
      bigBlind: 20, canCheck: false, positionFactor: 0,
    };
    const rng = makeRng(999);
    let rockFolds = 0;
    let maniacAggressive = 0;
    for (let i = 0; i < 12; i++) {
      const r = decideAi(PERSONAS.rock, ctx, makeRng(100 + i));
      if (r.action === 'fold') rockFolds++;
      const m = decideAi(PERSONAS.maniac, ctx, makeRng(100 + i));
      if (m.action === 'raise' || m.action === 'all-in' || m.action === 'call') maniacAggressive++;
    }
    expect(rockFolds).toBeGreaterThan(maniacAggressive - rockFolds); // rock clearly tighter
    expect(rockFolds).toBeGreaterThanOrEqual(8);
  });
});
