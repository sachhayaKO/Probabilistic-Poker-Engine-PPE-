import type { Card } from '../engine/cards';
import { chenScore } from '../personas/ranges';

export type PreflopSpot = 'button-open' | 'bb-vs-open' | 'button-vs-3bet';

// Chart proxy: thresholds on Chen score per spot. These are v1 tunable data —
// a hand-authored 169-cell chart can replace this file without changing callers.
const THRESHOLDS: Record<PreflopSpot, { raise: number; call: number }> = {
  'button-open':    { raise: 5, call: Infinity }, // open-or-fold on the button
  'bb-vs-open':     { raise: 10, call: 6 },
  'button-vs-3bet': { raise: 12, call: 9 },
};

export function preflopRecommendation(
  hole: [Card, Card],
  spot: PreflopSpot,
): 'raise' | 'call' | 'fold' {
  const score = chenScore(hole[0], hole[1]);
  const t = THRESHOLDS[spot];
  if (score >= t.raise) return 'raise';
  if (score >= t.call) return 'call';
  return 'fold';
}
