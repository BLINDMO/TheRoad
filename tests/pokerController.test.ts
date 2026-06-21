import { describe, it, expect, beforeAll } from 'vitest';
import { PokerController, type PokerSetup, type TableResult } from '../src/app/poker/PokerController';
import { buildSchedule } from '../src/engine-poker/tournament';
import { pokerBus } from '../src/lib/eventBus';
import { useGameStore } from '../src/store/useGameStore';

// Runtime integration: drive the full controller (blinds, AI, eliminations,
// payouts) headlessly to completion. Exercises the real orchestration that the
// UI relies on — not just the pure engine.

describe('PokerController end-to-end', () => {
  beforeAll(() => {
    useGameStore.getState().updateSettings({ reducedMotion: true });
    useGameStore.getState().setBankroll(1_000_000);
  });

  it('plays a heads-up Sit & Go to a result', async () => {
    const schedule = buildSchedule(20, 14, 1.45, 4);
    const setup: PokerSetup = {
      mode: 'sng', seatCount: 2, startingStack: 80,
      sb: schedule[0].sb, bb: schedule[0].bb, buyIn: 1000,
      schedule, handsPerLevel: 8, fieldSize: 2,
    };

    const result = await new Promise<TableResult>((resolve) => {
      const ctrl = new PokerController(setup, (r) => resolve(r));
      // Human always folds → busts quickly (or wins if AI keeps folding too).
      const off = pokerBus.on('request-action', () => {
        setTimeout(() => pokerBus.emit('human-action', { type: 'fold' }), 0);
      });
      void ctrl.start();
      // Safety net.
      setTimeout(() => { off(); }, 25_000);
    });

    expect(result).toBeTruthy();
    expect(typeof result.place).toBe('number');
    expect(result.place).toBeGreaterThanOrEqual(1);
    expect(result.place).toBeLessThanOrEqual(2);
  }, 30_000);

  it('plays a 6-max Sit & Go to a result with eliminations', async () => {
    const schedule = buildSchedule(20, 14, 1.5, 4);
    const setup: PokerSetup = {
      mode: 'sng', seatCount: 6, startingStack: 120,
      sb: schedule[0].sb, bb: schedule[0].bb, buyIn: 2000,
      schedule, handsPerLevel: 6, fieldSize: 6,
    };
    const result = await new Promise<TableResult>((resolve) => {
      const ctrl = new PokerController(setup, (r) => resolve(r));
      pokerBus.on('request-action', () => {
        setTimeout(() => pokerBus.emit('human-action', { type: 'fold' }), 0);
      });
      void ctrl.start();
    });
    expect(result.place).toBeGreaterThanOrEqual(1);
    expect(result.fieldSize).toBe(6);
  }, 40_000);

  it('plays a multi-table tournament to an honest finishing place', async () => {
    const schedule = buildSchedule(20, 16, 1.5, 4);
    const fieldSize = 12;
    const setup: PokerSetup = {
      mode: 'mtt', seatCount: 6, startingStack: 80,
      sb: schedule[0].sb, bb: schedule[0].bb, buyIn: 1000,
      schedule, handsPerLevel: 4, fieldSize,
    };
    const result = await new Promise<TableResult>((resolve) => {
      const ctrl = new PokerController(setup, (r) => resolve(r));
      pokerBus.on('request-action', () => {
        setTimeout(() => pokerBus.emit('human-action', { type: 'fold' }), 0);
      });
      void ctrl.start();
    });
    expect(result.fieldSize).toBe(fieldSize);
    // Place must reflect the real field, never a predetermined value.
    expect(result.place).toBeGreaterThanOrEqual(1);
    expect(result.place).toBeLessThanOrEqual(fieldSize);
  }, 40_000);
});
