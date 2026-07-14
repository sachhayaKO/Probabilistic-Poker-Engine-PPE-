import type { Card } from '../engine/cards';
import { rankOf, suitOf } from '../engine/cards';

/**
 * Chen score for a two-card hand.
 * Computes the formula-based strength value.
 */
export function chenScore(card1: Card, card2: Card): number {
  const r1 = rankOf(card1);
  const r2 = rankOf(card2);
  const s1 = suitOf(card1);
  const s2 = suitOf(card2);

  const high = Math.max(r1, r2);
  const low = Math.min(r1, r2);
  const suited = s1 === s2 ? 1 : 0;
  const pair = r1 === r2 ? 1 : 0;

  if (pair) {
    return Math.max(5, 2.5 * high - 10);
  }

  if (high === 12) {
    if (low === 11) return 10 + 2 * suited;
    if (low === 10) return 8 + 2 * suited;
    if (low === 9) return 7 + 2 * suited;
    if (low === 8) return 6 + 2 * suited;
    if (low === 7) return 5 + 1 * suited;
    if (low === 6) return 5 + 1 * suited;
    if (low === 5) return 5 + 1 * suited;
    if (low === 4) return 5;
    if (low === 3) return 5;
    if (low === 2) return 5;
  }

  if (high === 11) {
    if (low === 10) return 12 + 2 * suited;
    if (low === 9) return 9 + 2 * suited;
    if (low === 8) return 8 + 2 * suited;
    if (low === 7) return 7 + 1 * suited;
    if (low === 6) return 6 + 1 * suited;
    if (low === 5) return 6 + 1 * suited;
    if (low === 4) return 4;
    if (low === 3) return 3;
    if (low === 2) return 3;
  }

  if (high === 10) {
    if (low === 9) return 9 + 1 * suited;
    if (low === 8) return 8 + 1 * suited;
    if (low === 7) return 7 + 1 * suited;
    if (low === 6) return 6;
    if (low === 5) return 6;
    if (low === 4) return 4;
    if (low === 3) return 3;
    if (low === 2) return 3;
  }

  if (high === 9) {
    if (low === 8) return 8 + 1 * suited;
    if (low === 7) return 7 + 1 * suited;
    if (low === 6) return 5;
    if (low === 5) return 5;
    if (low === 4) return 3;
    if (low === 3) return 2;
    if (low === 2) return 2;
  }

  if (high === 8) {
    if (low === 7) return 7 + 1 * suited;
    if (low === 6) return 5;
    if (low === 5) return 5;
    if (low === 4) return 2;
    if (low === 3) return 1;
    if (low === 2) return 1;
  }

  if (high === 7) {
    if (low === 6) return 5;
    if (low === 5) return 4;
    if (low === 4) return 1;
    if (low === 3) return 1;
    if (low === 2) return -1;
  }

  if (high === 6) {
    if (low === 5) return 4;
    if (low === 4) return 1;
    if (low === 3) return 0;
    if (low === 2) return -1;
  }

  if (high === 5) {
    if (low === 4) return 1;
    if (low === 3) return 0;
    if (low === 2) return -1;
  }

  if (high === 4) {
    if (low === 3) return 0;
    if (low === 2) return -1;
  }

  if (high === 3) {
    if (low === 2) return -1;
  }

  return -1;
}

/**
 * Generate all card combinations (1326 total for a standard deck).
 */
function allCombos(): { cards: [Card, Card] }[] {
  const combos: { cards: [Card, Card] }[] = [];
  for (let i = 0; i < 52; i++) {
    for (let j = i + 1; j < 52; j++) {
      combos.push({ cards: [i as Card, j as Card] });
    }
  }
  return combos;
}

/**
 * Filter combos to exclude those containing dead cards.
 */
function filterDead(
  combos: { cards: [Card, Card] }[],
  dead: Card[]
): { cards: [Card, Card] }[] {
  const deadSet = new Set(dead);
  return combos.filter(({ cards: [a, b] }) => !deadSet.has(a) && !deadSet.has(b));
}

/**
 * Sort combos by Chen score in descending order.
 */
function sortByScore(combos: { cards: [Card, Card] }[]): { cards: [Card, Card] }[] {
  return combos.sort(({ cards: [a, b] }, { cards: [c, d] }) => {
    return chenScore(c, d) - chenScore(a, b);
  });
}

/**
 * Return the top fraction of combos by Chen score.
 */
export function rangeTopFraction(
  fraction: number,
  dead: Card[]
): { cards: [Card, Card] }[] {
  let combos = allCombos();
  combos = filterDead(combos, dead);
  combos = sortByScore(combos);
  const count = Math.ceil(combos.length * fraction);
  return combos.slice(0, count);
}
