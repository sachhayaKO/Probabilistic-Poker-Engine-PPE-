import { describe, expect, it } from 'vitest';
import type { HandState } from '../engine/hand';
import type { HandRecord, StoredDecision } from './records';
import { aggregate } from './aggregate';
import { GRADUATION_WINDOW, coachState, drillRecovered } from './coach';

function dec(over: Partial<StoredDecision>): StoredDecision {
  return {
    logIndex: 0, street: 'flop', facing: 'large-bet', handClass: 'air', persona: 'balanced',
    label: 'best', evLost: 0, actionTaken: 'fold', best: 'fold',
    ...over,
  };
}

let nextId = 1;
function rec(ts: number, decisions: StoredDecision[], drill: string | null = null): HandRecord {
  return {
    id: nextId++, ts, mode: 'training', personaKey: 'balanced', drill,
    bigBlind: 100, heroNet: 0, state: {} as HandState, grades: [], decisions,
  };
}

const mistake = (over: Partial<StoredDecision> = {}) =>
  dec({ label: 'mistake', evLost: 100, actionTaken: 'call', ...over });

describe('coachState', () => {
  it('names the biggest active leak and queues the rest', () => {
    const records = [
      rec(1, [mistake(), mistake(), mistake()]), // air: 300 EV
      rec(2, [
        mistake({ handClass: 'weak-pair', evLost: 500 }),
        mistake({ handClass: 'weak-pair', evLost: 500 }),
        mistake({ handClass: 'weak-pair', evLost: 500 }),
      ]), // weak-pair: 1500 EV — biggest
    ];
    const card = coachState(aggregate(records), records);
    expect(card.leak?.key).toBe('flop|large-bet|weak-pair');
    expect(card.queue.map((l) => l.key)).toEqual(['flop|large-bet|air']);
    expect(card.graduated).toEqual([]);
    expect(card.streak).toBe(0); // last decision was a mistake
  });

  it('graduates a leak whose recent window is accurate and counts streaks', () => {
    const records = [
      rec(1, [mistake(), mistake(), mistake()]),
      // GRADUATION_WINDOW clean decisions in the same category afterwards
      rec(2, Array.from({ length: GRADUATION_WINDOW }, () => dec({}))),
    ];
    const card = coachState(aggregate(records), records);
    expect(card.leak).toBeNull();
    expect(card.graduated).toHaveLength(1);
    expect(card.graduated[0].key).toBe('flop|large-bet|air');
    expect(card.graduated[0].accuracy).toBe(1);
    expect(card.streak).toBe(GRADUATION_WINDOW);
  });
});

describe('drillRecovered', () => {
  it('requires enough recent samples above the accuracy bar', () => {
    const key = 'flop|large-bet|air';
    const few = [rec(1, [dec({}), dec({})])];
    expect(drillRecovered(few, key)).toBe(false); // too few samples
    const good = [rec(1, [mistake(), mistake(), mistake()]), rec(2, Array.from({ length: 10 }, () => dec({})))];
    expect(drillRecovered(good, key)).toBe(true); // last 10 are clean
    const bad = [rec(1, Array.from({ length: 6 }, () => mistake()))];
    expect(drillRecovered(bad, key)).toBe(false);
  });
});
