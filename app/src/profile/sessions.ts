import type { HandRecord, StoredDecision } from './records';

export const SESSION_GAP_MS = 30 * 60 * 1000; // 30 minutes

export interface Session {
  start: number;
  end: number;
  mode: string;
  personaKey: string;
  drill: string | null;
  handCount: number;
  netChips: number;
  netBB: number;
  mistakes: number;
  accuracy: number;
  handIds: number[];
}

export function groupSessions(records: HandRecord[]): Session[] {
  if (records.length === 0) return [];

  // Sort by ts ascending, then group
  const sorted = [...records].sort((a, b) => a.ts - b.ts);

  const groups: HandRecord[][] = [];
  let currentGroup: HandRecord[] = [sorted[0]];

  for (let i = 1; i < sorted.length; i++) {
    const prev = sorted[i - 1];
    const curr = sorted[i];
    // Split if: gap > SESSION_GAP_MS, or any group key changed
    const gapExceeds = curr.ts - prev.ts > SESSION_GAP_MS;
    const keyChanged =
      prev.personaKey !== curr.personaKey ||
      prev.mode !== curr.mode ||
      prev.drill !== curr.drill;

    if (gapExceeds || keyChanged) {
      groups.push(currentGroup);
      currentGroup = [curr];
    } else {
      currentGroup.push(curr);
    }
  }
  groups.push(currentGroup);

  // Convert to sessions and reverse (newest-first)
  const sessions = groups.map((group) => {
    const handIds = group.map((h) => h.id).filter((id) => id !== undefined);
    const netChips = group.reduce((sum, h) => sum + h.heroNet, 0);
    const totalDecisions = group.reduce((sum, h) => sum + h.decisions.length, 0);
    const mistakes = group.reduce((sum, h) => {
      return (
        sum +
        h.decisions.filter((d: StoredDecision) => d.label === 'mistake').length
      );
    }, 0);
    const accuracy =
      totalDecisions === 0 ? 1 : (totalDecisions - mistakes) / totalDecisions;
    const netBB = netChips / group[0].bigBlind;

    return {
      start: group[0].ts,
      end: group[group.length - 1].ts,
      mode: group[0].mode,
      personaKey: group[0].personaKey,
      drill: group[0].drill,
      handCount: group.length,
      netChips,
      netBB,
      mistakes,
      accuracy,
      handIds,
    } as Session;
  });

  return sessions.reverse();
}
