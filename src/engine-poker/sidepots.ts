// Side-pot construction. Given how much each player has committed to the pot
// over the whole hand and who is still eligible (not folded), build the main
// pot and any side pots. Only players who contributed to a given layer — and
// who have not folded — are eligible to win that layer.

export interface PlayerContribution {
  id: string;
  committed: number; // total chips put in across all streets
  folded: boolean;
}

export interface Pot {
  amount: number;
  eligible: string[]; // player ids that can win this pot
}

/**
 * Builds layered pots. Folded players' chips still go into the pot but they
 * cannot win any layer. Pots are built from the smallest commitment "level"
 * upward; each level forms one pot funded by everyone who reached it.
 */
export function buildPots(contribs: PlayerContribution[]): Pot[] {
  const working = contribs
    .filter((c) => c.committed > 0)
    .map((c) => ({ ...c }));

  const pots: Pot[] = [];
  let prevLevel = 0;

  // Distinct positive commitment levels, ascending.
  const levels = Array.from(new Set(working.map((c) => c.committed)))
    .filter((l) => l > 0)
    .sort((a, b) => a - b);

  for (const level of levels) {
    const layer = level - prevLevel;
    let amount = 0;
    const eligible: string[] = [];
    for (const c of working) {
      if (c.committed >= level) {
        amount += layer; // everyone who reached this level pays the layer slice
        if (!c.folded) eligible.push(c.id);
      } else if (c.committed > prevLevel) {
        // partial contributor below this level (already fully consumed earlier)
        amount += c.committed - prevLevel;
      }
    }
    if (amount > 0) pots.push({ amount, eligible });
    prevLevel = level;
  }

  // Merge consecutive pots with identical eligibility (cleaner UI / payout).
  const merged: Pot[] = [];
  for (const p of pots) {
    const last = merged[merged.length - 1];
    if (last && sameSet(last.eligible, p.eligible)) {
      last.amount += p.amount;
    } else {
      merged.push({ ...p });
    }
  }
  return merged;
}

function sameSet(a: string[], b: string[]): boolean {
  if (a.length !== b.length) return false;
  const sa = new Set(a);
  return b.every((x) => sa.has(x));
}
