import type { Card } from '../engine/cards';
import { makeDeck } from '../engine/cards';
import { evaluate7 } from '../engine/evaluate';
import type { WeightedCombo } from '../personas/ranges';

export function equityVsRange(
  hero: [Card, Card],
  board: Card[],
  range: WeightedCombo[],
  iterations: number,
  rng: () => number,
): number {
  const known = new Set<Card>([...hero, ...board]);
  const live = range.filter(({ cards }) => !known.has(cards[0]) && !known.has(cards[1]));
  if (live.length === 0) throw new Error('range has no combos consistent with known cards');
  const totalWeight = live.reduce((sum, x) => sum + x.weight, 0);

  let wins = 0, ties = 0;
  for (let i = 0; i < iterations; i++) {
    // sample villain combo by weight
    let pick = rng() * totalWeight;
    let villain: [Card, Card] = live[live.length - 1].cards;
    for (const combo of live) {
      pick -= combo.weight;
      if (pick <= 0) { villain = combo.cards; break; }
    }
    // complete the board uniformly from remaining cards
    const deck = makeDeck([...hero, ...board, ...villain]);
    const runout: Card[] = [...board];
    while (runout.length < 5) {
      const j = Math.floor(rng() * deck.length);
      runout.push(deck[j]);
      deck[j] = deck[deck.length - 1];
      deck.pop();
    }
    const heroScore = evaluate7([...hero, ...runout]);
    const villainScore = evaluate7([...villain, ...runout]);
    if (heroScore > villainScore) wins++;
    else if (heroScore === villainScore) ties++;
  }
  return (wins + ties / 2) / iterations;
}
