import type { HandRecord, StoredDecision } from './records';
import { leakKey, leakLabel } from './tags';

export const MIN_LEAK_MISTAKES = 3;

export interface AggregateStats {
  handsGraded: number;
  decisions: number;
  accuracy: number;
  evLostTotal: number;
  bb100: number;
  trend: TrendPoint[];
  leaks: LeakStat[];
}

export interface TrendPoint {
  hands: number;
  accuracy: number;
}

export interface LeakStat {
  key: string;
  label: string;
  mistakes: number;
  evLost: number;
  accuracy: number;
  handIds: number[];
}

export interface CategoryStats {
  decisions: number;
  accuracy: number;
}

export function categoryRecent(
  records: HandRecord[],
  key: string,
  window: number,
): CategoryStats {
  let decisions = 0;
  let mistakes = 0;

  for (let i = records.length - 1; i >= 0 && decisions < window; i--) {
    const record = records[i];
    for (let j = record.decisions.length - 1; j >= 0 && decisions < window; j--) {
      const decision = record.decisions[j];
      const decKey = leakKey(decision);
      if (decKey === key) {
        decisions++;
        if (decision.label === 'mistake') mistakes++;
      }
    }
  }

  return {
    decisions,
    accuracy: decisions === 0 ? 1 : 1 - mistakes / decisions,
  };
}

export function aggregate(records: HandRecord[]): AggregateStats {
  const leakMap = new Map<string, LeakStat>();
  let totalDecisions = 0;
  let totalMistakes = 0;
  let evLostTotal = 0;
  let bbFromNonDrill = 0;
  let handsInTrend = 0;
  let trendDecisions = 0;
  let trendMistakes = 0;

  for (const record of records) {
    const isNonDrill = !record.drill;

    for (const decision of record.decisions) {
      totalDecisions++;
      if (decision.label === 'mistake') {
        totalMistakes++;
        evLostTotal += decision.evLost;
      }

      // Track trend metrics for non-drill hands
      if (isNonDrill) {
        trendDecisions++;
        if (decision.label === 'mistake') {
          trendMistakes++;
        }
      }

      // Leak tracking
      const key = leakKey(decision);
      if (!leakMap.has(key)) {
        leakMap.set(key, {
          key,
          label: leakLabel(key),
          mistakes: 0,
          evLost: 0,
          accuracy: 0,
          handIds: [],
        });
      }
      const leak = leakMap.get(key)!;
      if (decision.label === 'mistake') {
        leak.mistakes++;
        leak.evLost += decision.evLost;
        if (!leak.handIds.includes(record.id)) {
          leak.handIds.unshift(record.id);
        }
      }
    }

    // BB/100 (non-drill hands only)
    if (isNonDrill) {
      bbFromNonDrill += record.heroNet / record.bigBlind;
      handsInTrend++;
    }
  }

  // Compute leak accuracy and filter by MIN_LEAK_MISTAKES
  const leaks: LeakStat[] = Array.from(leakMap.values()).filter((leak) => leak.mistakes >= MIN_LEAK_MISTAKES);
  for (const leak of leaks) {
    // Walk the records backwards to count decisions in this leak
    let categoryDecisions = 0;
    for (let i = records.length - 1; i >= 0; i--) {
      for (const decision of records[i].decisions) {
        if (leakKey(decision) === leak.key) categoryDecisions++;
      }
    }
    leak.accuracy = categoryDecisions === 0 ? 0 : 1 - leak.mistakes / categoryDecisions;
  }

  // Sort leaks by most recent (handIds desc)
  leaks.sort((a, b) => b.handIds[0] - a.handIds[0]);

  const trend: TrendPoint[] = handsInTrend > 0 ? [{ hands: handsInTrend, accuracy: 1 - trendMistakes / (trendDecisions || 1) }] : [];

  return {
    handsGraded: records.length,
    decisions: totalDecisions,
    accuracy: totalDecisions === 0 ? 1 : 1 - totalMistakes / totalDecisions,
    evLostTotal,
    bb100: handsInTrend === 0 ? 0 : (bbFromNonDrill / handsInTrend) * 100,
    trend,
    leaks,
  };
}
