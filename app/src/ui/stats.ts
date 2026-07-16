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
      const g = d.grade;
      st.decisions += 1;
      const key = g.label === 'mistake' ? 'mistakes' : g.label;
      st[key as keyof SessionStats]++;
      st.evLostTotal += 'evLost' in g ? g.evLost : 0;
    }
  }
  return st;
}

export function accuracy(stats: SessionStats): number {
  return stats.decisions === 0 ? 1 : (stats.best + stats.okay) / stats.decisions;
}
