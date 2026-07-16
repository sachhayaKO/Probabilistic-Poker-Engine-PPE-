import type { GradedDecision } from '../grading/gradeHand';

export interface SessionStats {
  decisions: number;
  best: number;
  okay: number;
  mistakes: number;
  evLostTotal: number;
}

export const emptyStats = (): SessionStats => ({
  decisions: 0,
  best: 0,
  okay: 0,
  mistakes: 0,
  evLostTotal: 0,
});

export function accumulate(stats: SessionStats, decisions: GradedDecision[]): SessionStats {
  const next = { ...stats };
  for (const g of decisions) {
    next.decisions++;
    if (g.grade.label === 'best') next.best++;
    else if (g.grade.label === 'okay') next.okay++;
    else next.mistakes++;
    next.evLostTotal += 'evLost' in g.grade ? g.grade.evLost : 0;
  }
  return next;
}

export function accuracy(stats: SessionStats): number {
  return stats.decisions === 0 ? 1 : (stats.best + stats.okay) / stats.decisions;
}
