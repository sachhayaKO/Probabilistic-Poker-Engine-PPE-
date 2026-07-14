export type Card = number; // 0..51 = rank * 4 + suit; rank 0 = deuce .. 12 = ace

export const RANKS = '23456789TJQKA';
export const SUITS = 'cdhs';

export const rankOf = (c: Card): number => Math.floor(c / 4);
export const suitOf = (c: Card): number => c % 4;

export function cardFromString(s: string): Card {
  const r = RANKS.indexOf(s[0]);
  const su = SUITS.indexOf(s[1]);
  if (s.length !== 2 || r < 0 || su < 0) throw new Error(`bad card string: ${s}`);
  return r * 4 + su;
}

export const cardToString = (c: Card): string => RANKS[rankOf(c)] + SUITS[suitOf(c)];

export function makeDeck(excluded: Card[] = []): Card[] {
  const dead = new Set(excluded);
  const deck: Card[] = [];
  for (let c = 0; c < 52; c++) if (!dead.has(c)) deck.push(c);
  return deck;
}

export function shuffle(deck: Card[], rng: () => number): void {
  for (let i = deck.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }
}

export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
