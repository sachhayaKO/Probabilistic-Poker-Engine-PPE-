import type { Card } from '../engine/cards';
import { rankOf, suitOf } from '../engine/cards';

export interface WeightedCombo {
  cards: [Card, Card];
  weight: number;
}

// Chen formula. Rank input is our 0..12 (deuce..ace) encoding.
const HIGH_CARD_POINTS = [1, 1.5, 2, 2.5, 3, 3.5, 4, 4.5, 5, 6, 7, 8, 10]; // 2..A

export function chenScore(c1: Card, c2: Card): number {
  const r1 = rankOf(c1), r2 = rankOf(c2);
  const hi = Math.max(r1, r2), lo = Math.min(r1, r2);
  if (r1 === r2) return Math.max(HIGH_CARD_POINTS[hi] * 2, 5);
  let pts = HIGH_CARD_POINTS[hi];
  if (suitOf(c1) === suitOf(c2)) pts += 2;
  const gap = hi - lo - 1;
  if (gap === 1) pts -= 1;
  else if (gap === 2) pts -= 2;
  else if (gap === 3) pts -= 4;
  else if (gap >= 4) pts -= 5;
  if (gap <= 1 && hi < 10) pts += 1; // 0-1 gap connectors below queen
  return Math.ceil(pts);
}

function allCombos(dead: Card[]): [Card, Card][] {
  const deadSet = new Set(dead);
  const combos: [Card, Card][] = [];
  for (let a = 0; a < 52; a++) {
    if (deadSet.has(a)) continue;
    for (let b = a + 1; b < 52; b++) {
      if (deadSet.has(b)) continue;
      combos.push([a, b]);
    }
  }
  return combos;
}

export function rangeTopFraction(fraction: number, dead: Card[]): WeightedCombo[] {
  const combos = allCombos(dead);
  const scored = combos
    .map((cards) => ({ cards, score: chenScore(cards[0], cards[1]) }))
    .sort((x, y) => y.score - x.score);
  const keep = Math.max(1, Math.round(scored.length * fraction));
  return scored.slice(0, keep).map(({ cards }) => ({ cards, weight: 1 }));
}
