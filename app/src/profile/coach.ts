import type { LeakStat, ProfileStats } from './aggregate';
import { categoryRecent } from './aggregate';
import type { HandRecord } from './records';

export const GRADUATION_WINDOW = 25; // recent decisions needed to graduate a leak
export const GRADUATION_ACCURACY = 0.85;
export const DRILL_WINDOW = 10; // recent category decisions a drill looks at
export const DRILL_MIN_SAMPLES = 6;
export const DRILL_ACCURACY = 0.8;

export interface Graduation {
  key: string;
  label: string;
  accuracy: number; // over the graduation window
  decisions: number; // lifetime decisions in the category
}

export interface CoachCard {
  leak: LeakStat | null; // the single biggest active leak
  queue: LeakStat[]; // next focuses, up to 3
  graduated: Graduation[];
  streak: number; // consecutive non-mistake decisions, counting back from the latest
}

export function coachState(stats: ProfileStats, records: HandRecord[]): CoachCard {
  const graduated: Graduation[] = [];
  const active: LeakStat[] = [];
  for (const leak of stats.leaks) {
    const recent = categoryRecent(records, leak.key, GRADUATION_WINDOW);
    if (recent.decisions >= GRADUATION_WINDOW && recent.accuracy >= GRADUATION_ACCURACY) {
      graduated.push({
        key: leak.key,
        label: leak.label,
        accuracy: recent.accuracy,
        decisions: leak.decisions,
      });
    } else {
      active.push(leak);
    }
  }

  const all = [...records].sort((a, b) => a.ts - b.ts).flatMap((r) => r.decisions);
  let streak = 0;
  for (let i = all.length - 1; i >= 0 && all[i].label !== 'mistake'; i--) streak++;

  return { leak: active[0] ?? null, queue: active.slice(1, 4), graduated, streak };
}

// Has drilling pulled this category's recent accuracy back above the bar?
export function drillRecovered(records: HandRecord[], key: string): boolean {
  const recent = categoryRecent(records, key, DRILL_WINDOW);
  return recent.decisions >= DRILL_MIN_SAMPLES && recent.accuracy >= DRILL_ACCURACY;
}
