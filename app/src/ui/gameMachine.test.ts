import { describe, expect, it } from 'vitest';
import { applyAction, startHand } from '../engine/hand';
import {
  BET_PRESETS, START_STACK, applyHandResult, dealHand, newSession, presetRaiseTo,
} from './gameMachine';
import { accumulate, accuracy, emptyStats, PREFLOP_MISTAKE_EV } from './stats';

describe('session', () => {
  it('training mode resets stacks and alternates the button each deal', () => {
    const s0 = newSession('training', 'balanced', 123);
    const d1 = dealHand(s0);
    expect(d1.cfg.buttonSeat).toBe(0);
    expect(d1.cfg.stacks).toEqual([START_STACK, START_STACK]);
    const afterLoss = applyHandResult(d1.session, {
      winner: 1, potAwarded: 200, showdown: false, stacks: [9900, 10100],
    });
    const d2 = dealHand(afterLoss);
    expect(d2.cfg.buttonSeat).toBe(1);
    expect(d2.cfg.stacks).toEqual([START_STACK, START_STACK]); // reset
    expect(d2.cfg.seed).not.toBe(d1.cfg.seed);
  });

  it('match mode carries stacks and ends when a stack hits zero', () => {
    const s0 = newSession('match', 'nit', 5);
    const d1 = dealHand(s0);
    const busted = applyHandResult(d1.session, {
      winner: 0, potAwarded: 20000, showdown: true, stacks: [20000, 0],
    });
    expect(busted.matchOver).toBe(true);
    expect(() => dealHand(busted)).toThrow();
    const alive = applyHandResult(d1.session, {
      winner: 0, potAwarded: 400, showdown: false, stacks: [10200, 9800],
    });
    const d2 = dealHand(alive);
    expect(d2.cfg.stacks).toEqual([10200, 9800]); // carried
  });
});

describe('presetRaiseTo', () => {
  it('computes a clamped pot-fraction raise', () => {
    // BTN opens preflop: pot 15 (SB5+BB10), toCall 5.
    const s = startHand({ buttonSeat: 0, stacks: [1000, 1000], smallBlind: 5, bigBlind: 10, seed: 1 });
    // pot preset: committed 5 + call 5 + 1.0 * (15 + 5) = 30
    expect(presetRaiseTo(s, 1)).toBe(30);
    // clamped up to the min-raise when the fraction is tiny
    expect(presetRaiseTo(s, 0.01)).toBe(20);
    // clamped down to all-in for a huge fraction
    expect(presetRaiseTo(s, 200)).toBe(1000);
  });

  it('returns 0 when raising is illegal', () => {
    let s = startHand({ buttonSeat: 0, stacks: [1000, 1000], smallBlind: 5, bigBlind: 10, seed: 1 });
    s = applyAction(s, { type: 'raise', to: 1000 }); // shove; opponent cannot raise
    expect(presetRaiseTo(s, 0.5)).toBe(0);
  });

  it('exposes the four spec presets', () => {
    expect(BET_PRESETS.map((p) => p.label)).toEqual(['33%', '50%', '75%', 'Pot']);
  });
});

describe('stats', () => {
  it('accumulates labels and EV lost across hands', () => {
    let st = emptyStats();
    st = accumulate(st, [
      { street: 'preflop', logIndex: 0, grade: { label: 'best', recommended: 'raise', actionTaken: 'raise', explanation: '' } },
      {
        street: 'flop', logIndex: 2,
        grade: {
          label: 'mistake', evLost: 180, bestAction: 'fold', actionTaken: 'call',
          equity: 0.19, requiredEquity: 0.22, evByAction: { fold: 0, call: -180, raise: null },
          explanation: '',
        },
      },
    ]);
    expect(st.decisions).toBe(2);
    expect(st.best).toBe(1);
    expect(st.mistakes).toBe(1);
    expect(st.evLostTotal).toBe(180);
    expect(accuracy(st)).toBeCloseTo(0.5);
  });

  it('counts a 1BB proxy EV loss for preflop mistakes', () => {
    let st = emptyStats();
    st = accumulate(st, [
      {
        street: 'preflop', logIndex: 0,
        grade: { label: 'mistake', recommended: 'raise', actionTaken: 'call', explanation: '' },
      },
    ]);
    expect(st.mistakes).toBe(1);
    expect(st.evLostTotal).toBe(PREFLOP_MISTAKE_EV);
  });
});
