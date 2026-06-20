// Pure card / deck primitives. No rendering, no globals.

export type Suit = 's' | 'h' | 'd' | 'c';
export type Rank =
  | '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9'
  | 'T' | 'J' | 'Q' | 'K' | 'A';

/** A card is encoded as a 2-char string: rank then suit, e.g. 'Ah', 'Td', 'Ks'. */
export type Card = string;

export const RANKS: Rank[] = ['2', '3', '4', '5', '6', '7', '8', '9', 'T', 'J', 'Q', 'K', 'A'];
export const SUITS: Suit[] = ['s', 'h', 'd', 'c'];

export function makeCard(rank: Rank, suit: Suit): Card {
  return `${rank}${suit}`;
}

export function cardRank(card: Card): Rank {
  return card[0] as Rank;
}

export function cardSuit(card: Card): Suit {
  return card[1] as Suit;
}

export function rankValue(rank: Rank): number {
  return RANKS.indexOf(rank) + 2; // 2..14
}

export function freshDeck(): Card[] {
  const deck: Card[] = [];
  for (const r of RANKS) for (const s of SUITS) deck.push(makeCard(r, s));
  return deck;
}

/**
 * A seedable RNG (mulberry32). We use a real PRNG so spins/deals are
 * reproducible in tests and auditable for fairness, but seed from crypto
 * entropy in production so gameplay isn't predictable.
 */
export function makeRng(seed?: number): () => number {
  let s = seed ?? (typeof crypto !== 'undefined' && crypto.getRandomValues
    ? crypto.getRandomValues(new Uint32Array(1))[0]
    : Math.floor(Math.random() * 0xffffffff));
  return function rng() {
    s |= 0;
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Fisher-Yates shuffle using the supplied rng. Mutates and returns. */
export function shuffle<T>(arr: T[], rng: () => number): T[] {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

export class Deck {
  private cards: Card[];
  private idx = 0;
  constructor(private rng: () => number = makeRng()) {
    this.cards = shuffle(freshDeck(), rng);
  }
  /** Build a deck with an exact, unshuffled card order (for tests). */
  static fromStack(cards: Card[]): Deck {
    const d = new Deck(() => 0);
    (d as unknown as { cards: Card[] }).cards = cards.slice();
    (d as unknown as { idx: number }).idx = 0;
    return d;
  }
  draw(): Card {
    if (this.idx >= this.cards.length) throw new Error('Deck exhausted');
    return this.cards[this.idx++];
  }
  drawMany(n: number): Card[] {
    return Array.from({ length: n }, () => this.draw());
  }
  burn(): void {
    this.idx++;
  }
  remaining(): number {
    return this.cards.length - this.idx;
  }
}
