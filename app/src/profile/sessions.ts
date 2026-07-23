import type { Mode, PersonaKey } from '../ui/gameMachine';
import type { HandRecord } from './records';

/** Hands further apart than this start a new session. */
export const SESSION_GAP_MS = 30 * 60_000;

export interface SessionSummary {
  start: number; // ts of first hand
  end: number; // ts of last hand
  mode: Mode;
  personaKey: PersonaKey;
  drill: string | null; // leak key for drill sessions, null for play
  handCount: number;
  netChips: number;
  netBB: number;
  accuracy: number; // 1 when the session has no graded decisions
  mistakes: number;
  handIds: number[]; // chronological; hands without a store id are skipped
}

function sameSession(prev: HandRecord, next: HandRecord): boolean {
  return (
    prev.mode === next.mode &&
    prev.personaKey === next.personaKey &&
    prev.drill === next.drill &&
    next.ts - prev.ts <= SESSION_GAP_MS
  );
}

function summarize(bucket: HandRecord[]): SessionSummary {
  let decisions = 0;
  let good = 0;
  let mistakes = 0;
  let netChips = 0;
  let netBB = 0;
  const handIds: number[] = [];
  for (const r of bucket) {
    netChips += r.heroNet;
    netBB += r.heroNet / r.bigBlind;
    if (r.id !== undefined) handIds.push(r.id);
    for (const d of r.decisions) {
      decisions++;
      if (d.label === 'mistake') mistakes++;
      else good++;
    }
  }
  return {
    start: bucket[0].ts,
    end: bucket[bucket.length - 1].ts,
    mode: bucket[0].mode,
    personaKey: bucket[0].personaKey,
    drill: bucket[0].drill,
    handCount: bucket.length,
    netChips,
    netBB,
    accuracy: decisions === 0 ? 1 : good / decisions,
    mistakes,
    handIds,
  };
}

/** Groups stored hands into sessions, newest session first. */
export function groupSessions(records: HandRecord[]): SessionSummary[] {
  const sorted = [...records].sort((a, b) => a.ts - b.ts);
  const sessions: SessionSummary[] = [];
  let bucket: HandRecord[] = [];
  for (const r of sorted) {
    if (bucket.length > 0 && !sameSession(bucket[bucket.length - 1], r)) {
      sessions.push(summarize(bucket));
      bucket = [];
    }
    bucket.push(r);
  }
  if (bucket.length > 0) sessions.push(summarize(bucket));
  return sessions.reverse();
}
