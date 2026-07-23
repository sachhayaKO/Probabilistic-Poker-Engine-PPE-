import { describe, expect, it } from 'vitest';
import type { HandRecord, StoredDecision } from './records';
import type { HandState } from '../engine/hand';
import { SESSION_GAP_MS, groupSessions } from './sessions';

const MIN = 60_000;

function decision(label: 'good' | 'mistake'): StoredDecision {
  return { label } as unknown as StoredDecision;
}

function rec(overrides: Partial<HandRecord>): HandRecord {
  return {
    id: 1,
    ts: 0,
    mode: 'training',
    personaKey: 'balanced',
    drill: null,
    bigBlind: 2,
    heroNet: 0,
    state: {} as HandState, // grouping never touches the replay state
    grades: [],
    decisions: [],
    ...overrides,
  };
}

describe('groupSessions', () => {
  it('returns [] for no records', () => {
    expect(groupSessions([])).toEqual([]);
  });

  it('groups consecutive same-persona/mode hands and computes summary math', () => {
    const records = [
      rec({ id: 1, ts: 0, heroNet: 10, decisions: [decision('good'), decision('mistake')] }),
      rec({ id: 2, ts: MIN, heroNet: -4, decisions: [decision('good'), decision('good')] }),
    ];
    const sessions = groupSessions(records);
    expect(sessions).toHaveLength(1);
    const s = sessions[0];
    expect(s.start).toBe(0);
    expect(s.end).toBe(MIN);
    expect(s.mode).toBe('training');
    expect(s.personaKey).toBe('balanced');
    expect(s.drill).toBeNull();
    expect(s.handCount).toBe(2);
    expect(s.netChips).toBe(6);
    expect(s.netBB).toBeCloseTo(3); // 10/2 + (-4)/2
    expect(s.mistakes).toBe(1);
    expect(s.accuracy).toBeCloseTo(3 / 4);
    expect(s.handIds).toEqual([1, 2]);
  });

  it('splits when the gap between hands exceeds SESSION_GAP_MS', () => {
    const records = [
      rec({ id: 1, ts: 0 }),
      rec({ id: 2, ts: SESSION_GAP_MS + 1 }),
    ];
    expect(groupSessions(records)).toHaveLength(2);
  });

  it('does not split at exactly SESSION_GAP_MS', () => {
    const records = [rec({ id: 1, ts: 0 }), rec({ id: 2, ts: SESSION_GAP_MS })];
    expect(groupSessions(records)).toHaveLength(1);
  });

  it('splits on persona change, mode change, and drill change', () => {
    const records = [
      rec({ id: 1, ts: 0 }),
      rec({ id: 2, ts: MIN, personaKey: 'nit' }),
      rec({ id: 3, ts: 2 * MIN, personaKey: 'nit', mode: 'match' }),
      rec({ id: 4, ts: 3 * MIN, personaKey: 'nit', mode: 'match', drill: 'flop-cbet' }),
    ];
    const sessions = groupSessions(records);
    expect(sessions).toHaveLength(4);
  });

  it('keeps consecutive same-key drill hands in one drill session', () => {
    const records = [
      rec({ id: 1, ts: 0, drill: 'flop-cbet' }),
      rec({ id: 2, ts: MIN, drill: 'flop-cbet' }),
    ];
    const sessions = groupSessions(records);
    expect(sessions).toHaveLength(1);
    expect(sessions[0].drill).toBe('flop-cbet');
  });

  it('sorts input by ts and returns sessions newest-first', () => {
    const records = [
      rec({ id: 2, ts: SESSION_GAP_MS * 3 }),
      rec({ id: 1, ts: 0 }),
    ];
    const sessions = groupSessions(records);
    expect(sessions).toHaveLength(2);
    expect(sessions[0].handIds).toEqual([2]); // newest session first
    expect(sessions[1].handIds).toEqual([1]);
  });

  it('treats a hand with no decisions as accuracy 1', () => {
    const sessions = groupSessions([rec({ id: 1, ts: 0 })]);
    expect(sessions[0].accuracy).toBe(1);
  });

  it('skips undefined ids in handIds', () => {
    const sessions = groupSessions([rec({ id: undefined, ts: 0 }), rec({ id: 5, ts: MIN })]);
    expect(sessions[0].handIds).toEqual([5]);
  });
});
