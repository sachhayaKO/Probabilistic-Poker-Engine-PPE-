// @vitest-environment jsdom
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { GradedDecision } from '../grading/gradeHand';
import { Ribbon } from './Ribbon';

const stats = { decisions: 4, best: 2, okay: 1, mistakes: 1, evLostTotal: 180 };

const grades: GradedDecision[] = [
  { street: 'preflop', logIndex: 0, grade: { label: 'best', recommended: 'raise', actionTaken: 'raise', explanation: 'chart' } },
  {
    street: 'flop', logIndex: 2,
    grade: {
      label: 'mistake', evLost: 180, bestAction: 'fold', actionTaken: 'call',
      equity: 0.19, requiredEquity: 0.22, evByAction: { fold: 0, call: -180, raise: null },
      explanation: 'needed 22%',
    },
  },
];

describe('Ribbon', () => {
  it('shows graded lines with symbols and EV lost', () => {
    render(<Ribbon grades={grades} gradesFailed={false} stats={stats} phase="over" matchOver={false} onOpenTheater={() => {}} />);
    // symbols appear in both the verdict-summary chips and the per-decision badges
    expect(screen.getAllByText(/✓/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/✗/).length).toBeGreaterThan(0);
    expect(screen.getByText(/−180/)).toBeTruthy();
    expect(screen.getByText(/75%/)).toBeTruthy(); // (2+1)/4 accuracy
  });

  it('opens the replay theater', () => {
    const open = vi.fn();
    render(<Ribbon grades={grades} gradesFailed={false} stats={stats} phase="over" matchOver={false} onOpenTheater={open} />);
    fireEvent.click(screen.getByRole('button', { name: /replay theater/i }));
    expect(open).toHaveBeenCalled();
  });

  it('degrades gracefully when grading failed', () => {
    render(<Ribbon grades={null} gradesFailed={true} stats={stats} phase="over" matchOver={false} onOpenTheater={() => {}} />);
    expect(screen.getByText(/grading unavailable/i)).toBeTruthy();
  });

  it('shows no review content during a live hand', () => {
    render(<Ribbon grades={null} gradesFailed={false} stats={stats} phase="hero" matchOver={false} onOpenTheater={() => {}} />);
    expect(screen.getByText(/review appears here/i)).toBeTruthy();
  });
});
