import { describe, it, expect } from 'vitest';
import { buildPots } from '../src/engine-poker/sidepots';

describe('side pot construction', () => {
  it('single pot when everyone matched', () => {
    const pots = buildPots([
      { id: 'a', committed: 100, folded: false },
      { id: 'b', committed: 100, folded: false },
      { id: 'c', committed: 100, folded: false },
    ]);
    expect(pots).toHaveLength(1);
    expect(pots[0].amount).toBe(300);
    expect(pots[0].eligible.sort()).toEqual(['a', 'b', 'c']);
  });

  it('builds main + side pot for unequal all-ins', () => {
    // a all-in 50, b all-in 100, c calls 100
    const pots = buildPots([
      { id: 'a', committed: 50, folded: false },
      { id: 'b', committed: 100, folded: false },
      { id: 'c', committed: 100, folded: false },
    ]);
    expect(pots).toHaveLength(2);
    // Main pot: 50 from each of 3 = 150, all eligible
    expect(pots[0].amount).toBe(150);
    expect(pots[0].eligible.sort()).toEqual(['a', 'b', 'c']);
    // Side pot: 50 from b and c = 100, a NOT eligible
    expect(pots[1].amount).toBe(100);
    expect(pots[1].eligible.sort()).toEqual(['b', 'c']);
  });

  it('folded players contribute chips but are not eligible', () => {
    // a folds after putting in 30, b and c go to showdown for 100 each
    const pots = buildPots([
      { id: 'a', committed: 30, folded: true },
      { id: 'b', committed: 100, folded: false },
      { id: 'c', committed: 100, folded: false },
    ]);
    const total = pots.reduce((s, p) => s + p.amount, 0);
    expect(total).toBe(230);
    // No pot should list 'a' as eligible
    for (const p of pots) expect(p.eligible).not.toContain('a');
  });

  it('three-way unequal all-in produces three layers', () => {
    const pots = buildPots([
      { id: 'a', committed: 20, folded: false },
      { id: 'b', committed: 60, folded: false },
      { id: 'c', committed: 100, folded: false },
    ]);
    expect(pots).toHaveLength(3);
    expect(pots[0]).toMatchObject({ amount: 60 }); // 20*3
    expect(pots[0].eligible.sort()).toEqual(['a', 'b', 'c']);
    expect(pots[1]).toMatchObject({ amount: 80 }); // 40*2
    expect(pots[1].eligible.sort()).toEqual(['b', 'c']);
    expect(pots[2]).toMatchObject({ amount: 40 }); // 40*1
    expect(pots[2].eligible.sort()).toEqual(['c']);
  });
});
