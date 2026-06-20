import { Hand } from 'pokersolver';
import type { Card } from './cards';

export interface EvalResult {
  id: string;
  name: string; // e.g. "Full House"
  descr: string; // e.g. "Full House, K's over 9's"
  rank: number;
  cards: Card[]; // the 5 cards forming the best hand
}

interface PlayerHole {
  id: string;
  hole: Card[];
}

interface Solved {
  id: string;
  hand: Hand;
}

function normCard(value: string, suit: string): Card {
  return `${value === '10' ? 'T' : value}${suit}`;
}

/** Solve every player's best 5-card hand from hole + board. */
export function solveAll(players: PlayerHole[], board: Card[]): Solved[] {
  return players.map((p) => ({ id: p.id, hand: Hand.solve([...p.hole, ...board]) }));
}

/**
 * Winner ids among a *specific subset* of solved hands. This is the correct
 * primitive for per-pot resolution — it compares full hand strength (kickers
 * included), not just hand category, and returns multiple ids on a true tie.
 */
export function winnersAmong(solved: Solved[]): string[] {
  if (solved.length === 0) return [];
  const winnerHands = Hand.winners(solved.map((s) => s.hand));
  return solved.filter((s) => winnerHands.includes(s.hand)).map((s) => s.id);
}

export function toResult(s: Solved): EvalResult {
  return {
    id: s.id,
    name: s.hand.name,
    descr: s.hand.descr,
    rank: s.hand.rank,
    cards: s.hand.cards.map((c) => normCard(c.value, c.suit)),
  };
}

/** Full-table showdown (overall winners + per-player results), for display. */
export function evaluateShowdown(
  players: PlayerHole[],
  board: Card[],
): { results: EvalResult[]; winners: string[] } {
  const solved = solveAll(players, board);
  return { results: solved.map(toResult), winners: winnersAmong(solved) };
}

/** Compare two specific holdings on a board: 1 if a wins, -1 if b, 0 tie. */
export function compareTwo(a: Card[], b: Card[], board: Card[]): number {
  const ha = Hand.solve([...a, ...board]);
  const hb = Hand.solve([...b, ...board]);
  const w = Hand.winners([ha, hb]);
  const aw = w.includes(ha);
  const bw = w.includes(hb);
  if (aw && bw) return 0;
  return aw ? 1 : -1;
}
