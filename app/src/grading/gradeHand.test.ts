import { describe, it, expect } from 'vitest';
import { mulberry32 } from '../engine/cards';
import type { HandState, Action } from '../engine/hand';
import { startHand, applyAction } from '../engine/hand';
import { PERSONAS } from '../personas/persona';
import { gradeHand } from './gradeHand';
import type { DecisionGrade } from './grade';

const play = (seed: number, ...actions: Action[]): HandState =>
  actions.reduce(applyAction, startHand({ buttonSeat: 0, stacks: [1000, 1000], smallBlind: 5, bigBlind: 10, seed }));

describe('gradeHand', () => {
  it('grades only the hero seat decisions', () => {
    const s = play(3, { type: 'raise', to: 30 }, { type: 'fold' });
    const grades = gradeHand(s, 0, PERSONAS.balanced, 500, mulberry32(1));
    expect(grades.length).toBe(1);
    expect(s.log[grades[0].logIndex].seat).toBe(0);
  });

  it('grades every hero decision in a multi-street hand', () => {
    // limp, check preflop, then check-check on flop, turn, and river to showdown
    const s = play(3, { type: 'call' }, { type: 'call' }, { type: 'call' }, { type: 'call' },
      { type: 'call' }, { type: 'call' }, { type: 'call' }, { type: 'call' });
    const heroDecisions = s.log.filter((e) => e.seat === 0).length;
    const grades = gradeHand(s, 0, PERSONAS.balanced, 500, mulberry32(2));
    expect(grades.length).toBe(heroDecisions);
  });

  it('marks chart-mismatched preflop actions as mistakes with an explanation', () => {
    // scan seeds for a hand where the button holds chart-fold trash, then limp it
    for (let seed = 0; seed < 300; seed++) {
      const s0 = startHand({ buttonSeat: 0, stacks: [1000, 1000], smallBlind: 5, bigBlind: 10, seed });
      const s = [{ type: 'call' } as Action, { type: 'raise', to: 40 } as Action, { type: 'fold' } as Action]
        .reduce(applyAction, s0);
      const grades = gradeHand(s, 0, PERSONAS.balanced, 300, mulberry32(seed));
      const pre = grades[0].grade as { label: string; recommended: string; explanation: string };
      if (pre.recommended === 'fold') {
        expect(pre.label).toBe('mistake');
        expect(pre.explanation.length).toBeGreaterThan(10);
        return;
      }
    }
    throw new Error('no chart-fold hand found in 300 seeds — suspicious');
  });

  it('every graded decision carries an explanation string', () => {
    const s = play(9, { type: 'call' }, { type: 'call' }, { type: 'call' }, { type: 'call' },
      { type: 'call' }, { type: 'call' }, { type: 'call' }, { type: 'call' });
    const grades = gradeHand(s, 0, PERSONAS.station, 500, mulberry32(4));
    for (const g of grades) {
      expect((g.grade as { explanation: string }).explanation.length).toBeGreaterThan(10);
    }
  });

  it('models no raise option when the log entry could not raise (facing all-in)', () => {
    // Hero seat 0 on the button. Preflop: hero limps, BB checks. Flop: villain shoves, hero calls.
    let s = startHand({ buttonSeat: 0, stacks: [1000, 1000], smallBlind: 5, bigBlind: 10, seed: 99 });
    s = applyAction(s, { type: 'call' }); // hero limp
    s = applyAction(s, { type: 'call' }); // BB check -> flop
    s = applyAction(s, { type: 'raise', to: 990 }); // villain (seat 1) shoves
    s = applyAction(s, { type: 'call' }); // hero calls -> showdown
    const grades = gradeHand(s, 0, PERSONAS.balanced, 200, mulberry32(1));
    const flop = grades.find((g) => g.street === 'flop')!;
    const grade = flop.grade as DecisionGrade;
    expect(grade.evByAction.raise).toBeNull();
  });
});
