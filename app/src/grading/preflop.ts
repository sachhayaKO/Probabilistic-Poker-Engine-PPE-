import { rankOf, suitOf } from '../engine/cards';
import { chenScore } from '../personas/ranges';

export type PreflopAction = 'raise' | 'call' | 'fold';

export type PreflopScene =
  | 'button-open'
  | 'bb-vs-open'
  | 'button-vs-3bet';

/**
 * Recommend a preflop action (raise, call, fold) for a given hole and situation.
 * Uses Chen scoring as the primary heuristic; tie-breaking favors suited > offsuit.
 */
export function preflopRecommendation(
  hole: readonly [number, number],
  scene: PreflopScene
): PreflopAction {
  const [h1, h2] = hole;
  const r1 = rankOf(h1);
  const r2 = rankOf(h2);
  const s1 = suitOf(h1);
  const s2 = suitOf(h2);
  const suited = s1 === s2;

  const chen = chenScore(h1, h2);

  if (scene === 'button-open') {
    // Raise premiums (Chen >= 6) and playable hands (suited broadway / mid pairs)
    if (chen >= 6) return 'raise';
    if (suited && r1 >= 7 && r2 >= 6) return 'raise';
    if (r1 >= 8 && r2 >= 8) return 'raise';
    if (r1 === r2 && r1 >= 3) return 'raise';
    return 'fold';
  }

  if (scene === 'bb-vs-open') {
    // 3-bet premiums (pairs >= 9, broadway AK/AQ/KQ)
    if ((r1 === r2 && r1 >= 7) || (r1 === 12 && r2 >= 10) || (r1 === 11 && r2 === 10)) {
      return 'raise';
    }
    // Call reasonable hands (Chen >= 4, or mid/low suited connectors)
    if (chen >= 4) return 'call';
    if (suited && r1 >= 4 && Math.abs(r1 - r2) <= 2) return 'call';
    return 'fold';
  }

  if (scene === 'button-vs-3bet') {
    // Narrow 4-bet range: premiums (AA, AK suited) or strong broadway
    if ((r1 === 12 && r2 === 12) || (r1 === 12 && r2 === 11 && suited)) {
      return 'raise';
    }
    // Call premium broadway (AK, AQ), or pairs >= 9
    if ((r1 === 12 && r2 >= 10) || (r1 === r2 && r1 >= 7)) {
      return 'call';
    }
    // Call AJ, KQ if suited
    if (r1 === 12 && r2 === 9 && suited) return 'call';
    if (r1 === 11 && r2 === 10 && suited) return 'call';
    return 'fold';
  }

  throw new Error(`Unknown scene: ${scene}`);
}
