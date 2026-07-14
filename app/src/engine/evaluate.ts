import type { Card } from './cards';
import { rankOf, suitOf } from './cards';

// Score layout: category * 13^5 + up to five tiebreaker ranks packed base-13
// (most significant first, zero-padded). Same category always packs the same
// number of meaningful ranks, so padding never changes an ordering.
const P4 = 28561, P3 = 2197, P2 = 169, P1 = 13;
const CAT = 371293; // 13^5

function score(cat: number, ranks: number[]): number {
  const [a = 0, b = 0, c = 0, d = 0, e = 0] = ranks;
  return cat * CAT + a * P4 + b * P3 + c * P2 + d * P1 + e;
}

export const handCategory = (s: number): number => Math.floor(s / CAT);

// Returns the top rank of the best straight in a rank bitmask, or -1.
// Wheel (A2345) returns 3 (the rank index of the five).
export function straightTop(mask: number): number {
  for (let t = 12; t >= 4; t--) {
    let ok = true;
    for (let i = 0; i < 5; i++) if (!(mask & (1 << (t - i)))) { ok = false; break; }
    if (ok) return t;
  }
  const wheel = (1 << 12) | 0b1111; // A,2,3,4,5
  if ((mask & wheel) === wheel) return 3;
  return -1;
}

export function evaluate7(cards: Card[]): number {
  if (cards.length !== 7) throw new Error(`evaluate7 needs 7 cards, got ${cards.length}`);
  const rankCount = new Array<number>(13).fill(0);
  const suitCount = new Array<number>(4).fill(0);
  let rankMask = 0;
  for (const c of cards) {
    const r = rankOf(c);
    rankCount[r]++;
    suitCount[suitOf(c)]++;
    rankMask |= 1 << r;
  }

  let flushScore = -1;
  const flushSuit = suitCount.findIndex((n) => n >= 5);
  if (flushSuit >= 0) {
    let fmask = 0;
    for (const c of cards) if (suitOf(c) === flushSuit) fmask |= 1 << rankOf(c);
    const sfTop = straightTop(fmask);
    if (sfTop >= 0) return score(8, [sfTop]);
    const franks: number[] = [];
    for (let r = 12; r >= 0 && franks.length < 5; r--) if (fmask & (1 << r)) franks.push(r);
    flushScore = score(5, franks);
  }

  const quads: number[] = [], trips: number[] = [], pairs: number[] = [], singles: number[] = [];
  for (let r = 12; r >= 0; r--) {
    if (rankCount[r] === 4) quads.push(r);
    else if (rankCount[r] === 3) trips.push(r);
    else if (rankCount[r] === 2) pairs.push(r);
    else if (rankCount[r] === 1) singles.push(r);
  }

  if (quads.length) {
    const kicker = Math.max(...quads.slice(1), ...trips, ...pairs, ...singles);
    return score(7, [quads[0], kicker]);
  }
  if (trips.length && (trips.length > 1 || pairs.length)) {
    const pairRank = trips.length > 1 ? trips[1] : pairs[0];
    return score(6, [trips[0], pairRank]);
  }
  if (flushScore >= 0) return flushScore;
  const st = straightTop(rankMask);
  if (st >= 0) return score(4, [st]);
  if (trips.length) return score(3, [trips[0], singles[0], singles[1]]);
  if (pairs.length >= 2) {
    const kicker = Math.max(...pairs.slice(2), ...singles);
    return score(2, [pairs[0], pairs[1], kicker]);
  }
  if (pairs.length === 1) return score(1, [pairs[0], singles[0], singles[1], singles[2]]);
  return score(0, singles.slice(0, 5));
}
