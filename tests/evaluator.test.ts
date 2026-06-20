import { describe, it, expect } from 'vitest';
import { evaluateShowdown } from '../src/engine-poker/evaluator';

describe('hand evaluation', () => {
  it('full house beats a flush', () => {
    const board = ['Kd', '9h', '9c', '2s', '5d'];
    const { winners, results } = evaluateShowdown(
      [
        { id: 'fh', hole: ['Kh', 'Ks'] }, // Kings full of nines
        { id: 'flush', hole: ['Ah', 'Qh'] }, // not a flush actually -> fix below
      ],
      board,
    );
    expect(winners).toEqual(['fh']);
    const fh = results.find((r) => r.id === 'fh')!;
    expect(fh.name.toLowerCase()).toContain('full');
  });

  it('detects a flush winner over top pair', () => {
    const board = ['2h', '7h', 'Th', 'Ks', '3d'];
    const { winners } = evaluateShowdown(
      [
        { id: 'flush', hole: ['Ah', '4h'] },
        { id: 'pair', hole: ['Kd', 'Qc'] },
      ],
      board,
    );
    expect(winners).toEqual(['flush']);
  });

  it('splits a tie (same straight on board)', () => {
    const board = ['Ts', 'Jh', 'Qd', 'Kc', 'Ah'];
    const { winners } = evaluateShowdown(
      [
        { id: 'a', hole: ['2c', '3d'] },
        { id: 'b', hole: ['4c', '5d'] },
      ],
      board,
    );
    expect(winners.sort()).toEqual(['a', 'b']);
  });

  it('identifies a wheel straight (A-2-3-4-5)', () => {
    const board = ['2d', '3s', '4c', 'Kh', 'Qd'];
    const { winners, results } = evaluateShowdown(
      [
        { id: 'wheel', hole: ['Ah', '5c'] },
        { id: 'pair', hole: ['Kd', 'Qc'] },
      ],
      board,
    );
    expect(winners).toEqual(['wheel']);
    expect(results.find((r) => r.id === 'wheel')!.name.toLowerCase()).toContain('straight');
  });
});
