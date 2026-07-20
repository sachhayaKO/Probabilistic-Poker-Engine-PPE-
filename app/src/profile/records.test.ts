import { describe, expect, it } from 'vitest';
import { applyAction, startHand } from '../engine/hand';
import { PREFLOP_MISTAKE_EV } from '../ui/stats';
import type { GradedDecision } from '../grading/gradeHand';
import { buildHandRecord } from './records';

// Deterministic hand, no personas: hero (seat 0, button) limps, BB checks,
// flop: BB bets 60, hero calls, turn+river check through to showdown.
function playedHand() {
  let s = startHand({ buttonSeat: 0, stacks: [1000, 1000], smallBlind: 5, bigBlind: 10, seed: 42 });
  s = applyAction(s, { type: 'call' }); // hero limp        (log 0)
  s = applyAction(s, { type: 'call' }); // BB check -> flop (log 1)
  s = applyAction(s, { type: 'raise', to: 60 }); // BB bets (log 2)
  s = applyAction(s, { type: 'call' }); // hero calls       (log 3)
  s = applyAction(s, { type: 'call' }); // BB check         (log 4)
  s = applyAction(s, { type: 'call' }); // hero check -> river (log 5)
  s = applyAction(s, { type: 'call' }); // BB check         (log 6)
  s = applyAction(s, { type: 'call' }); // hero check -> showdown (log 7)
  return s;
}

const grades: GradedDecision[] = [
  {
    street: 'preflop', logIndex: 0,
    grade: { label: 'mistake', recommended: 'raise', actionTaken: 'call', explanation: '' },
  },
  {
    street: 'flop', logIndex: 3,
    grade: {
      label: 'mistake', evLost: 180, bestAction: 'fold', actionTaken: 'call',
      equity: 0.19, requiredEquity: 0.32,
      evByAction: { fold: 0, call: -180, raise: -220 }, explanation: '',
    },
  },
];

describe('buildHandRecord', () => {
  it('tags decisions and maps EV lost with the preflop proxy', () => {
    const state = playedHand();
    const rec = buildHandRecord(state, 0, 'training', 'maniac', grades, null, 777);
    expect(rec.ts).toBe(777);
    expect(rec.mode).toBe('training');
    expect(rec.personaKey).toBe('maniac');
    expect(rec.drill).toBeNull();
    expect(rec.bigBlind).toBe(10);
    expect(rec.heroNet).toBe(state.result!.stacks[0] - 1000);
    expect(rec.state).toBe(state);
    expect(rec.grades).toBe(grades);

    expect(rec.decisions).toHaveLength(2);
    const [pre, flop] = rec.decisions;
    expect(pre).toMatchObject({
      logIndex: 0, street: 'preflop', persona: 'maniac',
      label: 'mistake', evLost: PREFLOP_MISTAKE_EV, actionTaken: 'call', best: 'raise',
    });
    expect(flop).toMatchObject({
      logIndex: 3, street: 'flop', persona: 'maniac',
      label: 'mistake', evLost: 180, actionTaken: 'call', best: 'fold',
    });
    // Flop call of 60 into potBefore 80 (20 pot + 60 bet) is a large bet.
    expect(flop.facing).toBe('large-bet');
    expect(['monster', 'top-pair', 'weak-pair', 'strong-draw', 'air']).toContain(flop.handClass);
    expect(['premium', 'strong', 'playable', 'weak']).toContain(pre.handClass);
  });

  it('throws on an unfinished hand', () => {
    const live = startHand({ buttonSeat: 0, stacks: [1000, 1000], smallBlind: 5, bigBlind: 10, seed: 1 });
    expect(() => buildHandRecord(live, 0, 'training', 'balanced', [])).toThrow();
  });
});
