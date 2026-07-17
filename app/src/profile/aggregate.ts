import type { HandRecord } from './records';
import { leakKey, leakLabel } from './tags';

export const TREND_BUCKET = 25; // hands per accuracy-trend bucket
export const MIN_LEAK_MISTAKES = 3; // a category needs this many mistakes to be a leak

export interface LeakStat {
  key: string;
  label: string;
  decisions: number;
  mistakes: number;
  evLost: number;
  accuracy: number;
  handIds: number[]; // ids of offending hands, newest first, max 10
}

export interface TrendPoint {
  bucket: number;
  hands: number;
  accuracy: number;
}

export interface ProfileStats {
  handsGraded: number;
  decisions: number;
  accuracy: number; // 1 when no decisions
  evLostTotal: number;
  bb100: number; // non-drill hands only; 0 when there are none
  trend: TrendPoint[]; // non-drill hands, chronological, TREND_BUCKET hands each
  leaks: LeakStat[]; // mistakes >= MIN_LEAK_MISTAKES, ranked by evLost desc
}

export function aggregate(records: HandRecord[]): ProfileStats {
  const sorted = [...records].sort((a, b) => a.ts - b.ts);

  let decisions = 0;
  let good = 0;
  let evLostTotal = 0;
  const byLeak = new Map<
    string,
    { decisions: number; mistakes: number; evLost: number; handIds: number[] }
  >();
  for (const record of sorted) {
    for (const d of record.decisions) {
      decisions++;
      if (d.label !== 'mistake') good++;
      evLostTotal += d.evLost;
      const key = leakKey(d);
      const bucket = byLeak.get(key) ?? { decisions: 0, mistakes: 0, evLost: 0, handIds: [] };
      bucket.decisions++;
      if (d.label === 'mistake') {
        bucket.mistakes++;
        bucket.evLost += d.evLost;
        if (record.id !== undefined && bucket.handIds[0] !== record.id) {
          bucket.handIds.unshift(record.id); // chronological input => newest first
        }
      }
      byLeak.set(key, bucket);
    }
  }

  const play = sorted.filter((r) => r.drill === null);
  const netBB = play.reduce((sum, r) => sum + r.heroNet / r.bigBlind, 0);
  const bb100 = play.length === 0 ? 0 : (netBB / play.length) * 100;

  const trend: TrendPoint[] = [];
  for (let i = 0; i < play.length; i += TREND_BUCKET) {
    const slice = play.slice(i, i + TREND_BUCKET);
    let d = 0;
    let g = 0;
    for (const record of slice) {
      for (const dec of record.decisions) {
        d++;
        if (dec.label !== 'mistake') g++;
      }
    }
    trend.push({ bucket: trend.length, hands: slice.length, accuracy: d === 0 ? 1 : g / d });
  }

  const leaks: LeakStat[] = [...byLeak.entries()]
    .filter(([, v]) => v.mistakes >= MIN_LEAK_MISTAKES)
    .map(([key, v]) => ({
      key,
      label: leakLabel(key),
      decisions: v.decisions,
      mistakes: v.mistakes,
      evLost: v.evLost,
      accuracy: 1 - v.mistakes / v.decisions,
      handIds: v.handIds.slice(0, 10),
    }))
    .sort((a, b) => b.evLost - a.evLost);

  return {
    handsGraded: sorted.length,
    decisions,
    accuracy: decisions === 0 ? 1 : good / decisions,
    evLostTotal,
    bb100,
    trend,
    leaks,
  };
}

// Accuracy over the most recent `window` decisions in one leak category.
export function categoryRecent(
  records: HandRecord[],
  key: string,
  window: number,
): { decisions: number; accuracy: number } {
  const all = [...records]
    .sort((a, b) => a.ts - b.ts)
    .flatMap((r) => r.decisions)
    .filter((d) => leakKey(d) === key);
  const recent = all.slice(-window);
  const good = recent.filter((d) => d.label !== 'mistake').length;
  return { decisions: recent.length, accuracy: recent.length === 0 ? 1 : good / recent.length };
}
