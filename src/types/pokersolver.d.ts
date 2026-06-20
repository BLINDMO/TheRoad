declare module 'pokersolver' {
  export class Hand {
    name: string;
    descr: string;
    rank: number;
    cards: { value: string; suit: string; toString(): string }[];
    /** Build a hand from an array of card strings like ['Ah','Kd', ...] (2-7 cards). */
    static solve(cards: string[], game?: string): Hand;
    /** Returns the winning hand(s); ties produce multiple. */
    static winners(hands: Hand[]): Hand[];
    toString(): string;
  }
}
