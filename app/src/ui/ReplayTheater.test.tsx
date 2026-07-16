// @vitest-environment jsdom
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { applyAction, startHand } from '../engine/hand';
import type { GradedDecision } from '../grading/gradeHand';
import { ReplayTheater } from './ReplayTheater';

function finishedHand() {
  let s = startHand({ buttonSeat: 0 as const, stacks: [10000, 10000] as [number, number], smallBlind: 50, bigBlind: 100, seed: 4 });
  s = applyAction(s, { type: 'call' }); // hero limp
  s = applyAction(s, { type: 'call' }); // bb check -> flop
  s = applyAction(s, { type: 'raise', to: 200 }); // villain bets
  s = applyAction(s, { type: 'fold' }); // hero folds
  return s;
}

const grades: GradedDecision[] = [
  { street: 'preflop', logIndex: 0, grade: { label: 'best', recommended: 'call', actionTaken: 'call', explanation: 'The chart agrees: call is standard here.' } },
  {
    street: 'flop', logIndex: 3,
    grade: {
      label: 'mistake', evLost: 120, bestAction: 'call', actionTaken: 'fold',
      equity: 0.4, requiredEquity: 0.25, evByAction: { fold: 0, call: 120, raise: null },
      explanation: 'Pot was 400 and the call was 200, so you needed 200 / (400 + 200 + 200) = 25% equity.',
    },
  },
];

describe('ReplayTheater', () => {
  it('steps through decisions and shows the written equation', () => {
    const hand = finishedHand();
    render(<ReplayTheater hand={hand} grades={grades} personaName="The Nit" onClose={() => {}} />);
    expect(screen.getByText(/chart agrees/i)).toBeTruthy(); // step 0 grade
    fireEvent.keyDown(window, { key: 'ArrowRight' });
    fireEvent.keyDown(window, { key: 'ArrowRight' });
    fireEvent.keyDown(window, { key: 'ArrowRight' });
    expect(screen.getByText(/25% equity/)).toBeTruthy(); // flop equation
    expect(screen.getByText(/raise wasn't available/i)).toBeTruthy();
  });

  it('closes on Escape', () => {
    const onClose = vi.fn();
    render(<ReplayTheater hand={finishedHand()} grades={grades} personaName="The Nit" onClose={onClose} />);
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(onClose).toHaveBeenCalled();
  });
});
