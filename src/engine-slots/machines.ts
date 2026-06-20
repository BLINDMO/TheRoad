import type { MachineConfig, SlotSymbol, ReelSlot } from './types';

// Ten paylines across a 5x3 grid, shared by every machine skin.
export const PAYLINES_10: number[][] = [
  [1, 1, 1, 1, 1],
  [0, 0, 0, 0, 0],
  [2, 2, 2, 2, 2],
  [0, 1, 2, 1, 0],
  [2, 1, 0, 1, 2],
  [0, 0, 1, 2, 2],
  [2, 2, 1, 0, 0],
  [1, 0, 0, 0, 1],
  [1, 2, 2, 2, 1],
  [0, 1, 1, 1, 0],
];

function strip(weights: Record<string, number>): ReelSlot[] {
  return Object.entries(weights).map(([id, weight]) => ({ id, weight }));
}

function fiveReels(weights: Record<string, number>): ReelSlot[][] {
  return [0, 1, 2, 3, 4].map(() => strip(weights));
}

// ---------------------------------------------------------------------------
// 1) Orchard Gold — classic fruit machine
// ---------------------------------------------------------------------------
const orchardSymbols: SlotSymbol[] = [
  { id: 'wild', name: 'Golden Bell', wild: true, pays: { 3: 37, 4: 183, 5: 776 } },
  { id: 'scatter', name: 'Lucky Star', scatter: true, pays: { 3: 2, 4: 8, 5: 40 } },
  { id: 'bonus', name: 'Cherry Crate', bonus: true, pays: {} },
  { id: 'seven', name: 'Lucky 7', pays: { 3: 35, 4: 127, 5: 494 } },
  { id: 'melon', name: 'Watermelon', pays: { 3: 23, 4: 63, 5: 247 } },
  { id: 'grape', name: 'Grapes', pays: { 3: 18, 4: 49, 5: 183 } },
  { id: 'plum', name: 'Plum', pays: { 3: 11, 4: 31, 5: 93 } },
  { id: 'orange', name: 'Orange', pays: { 3: 8, 4: 25, 5: 78 } },
  { id: 'lemon', name: 'Lemon', pays: { 3: 7, 4: 20, 5: 62 } },
  { id: 'cherry', name: 'Cherry', pays: { 3: 5, 4: 16, 5: 56 } },
];

export const ORCHARD_GOLD: MachineConfig = {
  id: 'orchard',
  name: 'Orchard Gold',
  theme: 'fruit',
  blurb: 'A sun-warmed classic. Three-reel soul in a five-reel frame.',
  reels: 5,
  rows: 3,
  symbols: orchardSymbols,
  reelStrips: fiveReels({
    wild: 4, scatter: 4, bonus: 2,
    seven: 5, melon: 7, grape: 9,
    plum: 14, orange: 16, lemon: 18, cherry: 20,
  }),
  paylines: PAYLINES_10,
  wildId: 'wild',
  scatterId: 'scatter',
  bonusId: 'bonus',
  freeSpins: { triggerCount: 3, award: 6, multiplier: 2, retrigger: true },
  bonus: { triggerCount: 3, picks: 3, prizes: [2, 3, 5, 8, 12, 18] },
  rtpTarget: 0.94,
};

// ---------------------------------------------------------------------------
// 2) Prism Riches — gem / jewel theme
// ---------------------------------------------------------------------------
const prismSymbols: SlotSymbol[] = [
  { id: 'wild', name: 'Prism Wild', wild: true, pays: { 3: 22, 4: 110, 5: 470 } },
  { id: 'scatter', name: 'Starlight', scatter: true, pays: { 3: 3, 4: 10, 5: 50 } },
  { id: 'bonus', name: 'Vault Key', bonus: true, pays: {} },
  { id: 'diamond', name: 'Diamond', pays: { 3: 16, 4: 70, 5: 280 } },
  { id: 'ruby', name: 'Ruby', pays: { 3: 11, 4: 40, 5: 140 } },
  { id: 'emerald', name: 'Emerald', pays: { 3: 8, 4: 25, 5: 95 } },
  { id: 'sapphire', name: 'Sapphire', pays: { 3: 6, 4: 19, 5: 62 } },
  { id: 'amethyst', name: 'Amethyst', pays: { 3: 5, 4: 14, 5: 44 } },
  { id: 'topaz', name: 'Topaz', pays: { 3: 4, 4: 11, 5: 34 } },
  { id: 'opal', name: 'Opal', pays: { 3: 3, 4: 8, 5: 25 } },
];

export const PRISM_RICHES: MachineConfig = {
  id: 'prism',
  name: 'Prism Riches',
  theme: 'gems',
  blurb: 'Cut, polished and lit from within. Chase the Starlight free spins.',
  reels: 5,
  rows: 3,
  symbols: prismSymbols,
  reelStrips: fiveReels({
    wild: 4, scatter: 4, bonus: 2,
    diamond: 5, ruby: 7, emerald: 9, sapphire: 11,
    amethyst: 14, topaz: 16, opal: 19,
  }),
  paylines: PAYLINES_10,
  wildId: 'wild',
  scatterId: 'scatter',
  bonusId: 'bonus',
  freeSpins: { triggerCount: 3, award: 7, multiplier: 2, retrigger: true },
  bonus: { triggerCount: 3, picks: 3, prizes: [3, 5, 8, 12, 18, 30, 60] },
  rtpTarget: 0.95,
};

// ---------------------------------------------------------------------------
// 3) Sands of Anubis — premium Egyptian theme, with progressive jackpot
// ---------------------------------------------------------------------------
const anubisSymbols: SlotSymbol[] = [
  { id: 'wild', name: 'Ankh Wild', wild: true, pays: { 3: 22, 4: 114, 5: 567 } },
  { id: 'scatter', name: 'Scarab', scatter: true, pays: { 3: 3, 4: 12, 5: 60 } },
  { id: 'bonus', name: "Pharaoh's Mask", bonus: true, pays: {} },
  { id: 'anubis', name: 'Anubis', pays: { 3: 18, 4: 71, 5: 709 } }, // 5 = progressive trigger
  { id: 'horus', name: 'Horus', pays: { 3: 12, 4: 44, 5: 174 } },
  { id: 'cat', name: 'Bastet', pays: { 3: 9, 4: 28, 5: 114 } },
  { id: 'eye', name: 'Eye of Ra', pays: { 3: 7, 4: 18, 5: 65 } },
  { id: 'ankhg', name: 'Gold Ankh', pays: { 3: 4, 4: 13, 5: 44 } },
  { id: 'scroll', name: 'Papyrus', pays: { 3: 3, 4: 10, 5: 32 } },
  { id: 'urn', name: 'Canopic Jar', pays: { 3: 3, 4: 8, 5: 24 } },
];

export const SANDS_OF_ANUBIS: MachineConfig = {
  id: 'anubis',
  name: 'Sands of Anubis',
  theme: 'egypt',
  blurb: 'A tomb of treasure. Land five Anubis to crack the rising jackpot.',
  reels: 5,
  rows: 3,
  symbols: anubisSymbols,
  reelStrips: fiveReels({
    wild: 4, scatter: 4, bonus: 2,
    anubis: 2, horus: 6, cat: 8, eye: 11,
    ankhg: 14, scroll: 16, urn: 18,
  }),
  paylines: PAYLINES_10,
  wildId: 'wild',
  scatterId: 'scatter',
  bonusId: 'bonus',
  freeSpins: { triggerCount: 3, award: 6, multiplier: 2, retrigger: true },
  bonus: { triggerCount: 3, picks: 3, prizes: [2, 3, 5, 8, 12, 20] },
  jackpot: { seed: 5000, contribRate: 0.01, triggerSymbolId: 'anubis', triggerCount: 5 },
  rtpTarget: 0.94,
};

export const MACHINES: MachineConfig[] = [ORCHARD_GOLD, PRISM_RICHES, SANDS_OF_ANUBIS];

export function getMachine(id: string): MachineConfig | undefined {
  return MACHINES.find((m) => m.id === id);
}
