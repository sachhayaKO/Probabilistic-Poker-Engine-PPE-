import { describe, expect, it } from 'vitest';
import type { HandState } from '../engine/hand';
import type { HandRecord, StoredDecision } from './records';
import { MIN_LEAK_MISTAKES, aggregate, categoryRecent } from './aggregate';

function dec(over: Partial<StoredDecision>): StoredDecision {
  return {
    logIndex: 0, street: 'flop', facing: 'large-bet', handClass: 'air', persona: 'balanced',
    label: 'best', evLost: 0, actionTaken: 'fold', best: 'fold',
    ...over,
  };
}

function rec(over: Partial<HandRecord>): HandRecord {
  return {
    id: 1, ts: 1, mode: 'training', personaKey: 'balanced', drill: null,
    bigBlind: 100, heroNet: 0, state: {} as HandState, grades: [], decisions: [],
    ...over,
  };
}

describe('aggregate', () => {
  it('returns a sane empty profile', () => {
    const s = aggregate([]);
    expect(s.handsGraded).toBe(0);
    expect(s.decisions).toBe(0);
    expect(s.accuracy).toBe(1);
    expect(s.bb100).toBe(0);
    expect(s.trend).toEqual([]);
    expect(s.leaks).toEqual([]);
  });

  it('computes totals, bb/100 and ranks leaks by EV lost', () => {
    const mistakes = (n: number, evLost: number, handClass: 'air' | 'weak-pair') =>
      Array.from({ length: n }, () => dec({ label: 'mistake', evLost, handClass, actionTaken: 'call' }));
    const records: HandRecord[] = [
      rec({ id: 1, ts: 1, heroNet: 300, decisions: [dec({ street: 'river' }), ...mistakes(2, 50, 'weak-pair')] }),
      rec({ id: 2, ts: 2, heroNet: -100, decisions: mistakes(3, 200, 'air') }),
      // drill hand: counted in decisions/leaks, excluded from bb/100 and trend
      rec({ id: 3, ts: 3, drill: 'flop|large-bet|air', heroNet: 5000, decisions: mistakes(1, 200, 'air') }),
    ];
    const s = aggregate(records);
    expect(s.handsGraded).toBe(3);
    expect(s.decisions).toBe(7);
    expect(s.accuracy).toBeCloseTo(1 / 7);
    expect(s.evLostTotal).toBe(2 * 50 + 4 * 200);
    // bb/100 over the two non-drill hands: (300 - 100)/100 BB over 2 hands = 100 bb/100.
    expect(s.bb100).toBeCloseTo(100);
    expect(s.trend).toHaveLength(1);
    expect(s.trend[0].hands).toBe(2);
    expect(s.trend[0].accuracy).toBeCloseTo(1 / 6);

    // 'air' leak: 4 mistakes, 800 EV. 'weak-pair': only 2 mistakes (< MIN) — filtered out.
    expect(MIN_LEAK_MISTAKES).toBe(3);
    expect(s.leaks).toHaveLength(1);
    expect(s.leaks[0].key).toBe('flop|large-bet|air');
    expect(s.leaks[0].mistakes).toBe(4);
    expect(s.leaks[0].evLost).toBe(800);
    expect(s.leaks[0].accuracy).toBe(0);
    expect(s.leaks[0].handIds).toEqual([3, 2]); // newest offending hands first
    expect(s.leaks[0].label).toBe('On the flop, facing a large bet with air');
  });
});

describe('categoryRecent', () => {
  it('windows the most recent decisions in one category', () => {
    const records: HandRecord[] = [
      rec({ id: 1, ts: 1, decisions: [dec({ label: 'mistake', evLost: 100 })] }),
      rec({ id: 2, ts: 2, decisions: [dec({}), dec({}), dec({})] }),
      rec({ id: 3, ts: 3, decisions: [dec({ street: 'river' })] }), // other category
    ];
    const all = categoryRecent(records, 'flop|large-bet|air', 10);
    expect(all.decisions).toBe(4);
    expect(all.accuracy).toBeCloseTo(3 / 4);
    const windowed = categoryRecent(records, 'flop|large-bet|air', 3);
    expect(windowed.decisions).toBe(3);
    expect(windowed.accuracy).toBe(1); // the mistake falls outside the window
    expect(categoryRecent(records, 'nope', 10)).toEqual({ decisions: 0, accuracy: 1 });
  });
});
