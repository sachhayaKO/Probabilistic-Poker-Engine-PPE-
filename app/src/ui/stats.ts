import type { DecisionGrade } from '../grading/grade';
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
  let st = { ...stats };
  for (const d of decisions) {
    if (d.grade && typeof d.grade === 'object' && 'label' in d.grade) {
      const g = d.grade as DecisionGrade;
      st.decisions += 1;

      // Map label to the field name (label can be 'mistake' but field is 'mistakes')
      const key = g.label === 'mistake' ? 'mistakes' : g.label;
      (st as any)[key] += 1;

      // Only postflop decisions have evLost
      if ('evLost' in g) {
        st.evLostTotal += g.evLost;
      }
    }
  }
  return st;
}

export function accuracy(stats: SessionStats): number {
  if (stats.decisions === 0) return 0;
  return stats.best / stats.decisions;
}
