// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import type { ProfileStats } from '../profile/aggregate';
import { ReportCard } from './ReportCard';

function emptyStats(): ProfileStats {
  return {
    handsGraded: 0,
    decisions: 0,
    accuracy: 1,
    evLostTotal: 0,
    bb100: 0,
    trend: [],
    leaks: [],
  };
}

function sampleStats(): ProfileStats {
  return {
    handsGraded: 42,
    decisions: 80,
    accuracy: 0.75,
    evLostTotal: 123.4,
    bb100: 12.34,
    trend: [
      { bucket: 0, hands: 25, accuracy: 0.6 },
      { bucket: 1, hands: 25, accuracy: 0.7 },
      { bucket: 2, hands: 25, accuracy: 0.8 },
    ],
    leaks: [
      {
        key: 'flop-large-bet',
        label: 'Flop, facing large bet',
        decisions: 20,
        mistakes: 8,
        evLost: 60,
        accuracy: 0.6,
        handIds: [101, 102, 103],
      },
      {
        key: 'preflop-unopened',
        label: 'Preflop, unopened',
        decisions: 30,
        mistakes: 5,
        evLost: 40,
        accuracy: 0.83,
        handIds: [201],
      },
    ],
  };
}

describe('ReportCard', () => {
  it('renders empty state when handsGraded is 0', () => {
    render(<ReportCard stats={emptyStats()} onBack={() => {}} onOpenHand={() => {}} />);
    expect(screen.getByText(/Play some hands/)).toBeTruthy();
    expect(screen.queryByText(/accuracy/i)).toBeNull();
  });

  it('renders stat tiles, leaks in order, and the trend svg', () => {
    render(<ReportCard stats={sampleStats()} onBack={() => {}} onOpenHand={() => {}} />);

    expect(screen.getByText('75%')).toBeTruthy();

    const labels = screen.getAllByText(/Flop, facing large bet|Preflop, unopened/);
    expect(labels.map((el) => el.textContent)).toEqual([
      'Flop, facing large bet',
      'Preflop, unopened',
    ]);

    expect(screen.getByRole('img', { name: 'accuracy trend' })).toBeTruthy();
  });

  it('calls onOpenHand when a hand button is clicked', () => {
    const onOpenHand = vi.fn();
    render(<ReportCard stats={sampleStats()} onBack={() => {}} onOpenHand={onOpenHand} />);

    fireEvent.click(screen.getByText('Hand #101'));
    expect(onOpenHand).toHaveBeenCalledWith(101);
  });

  it('calls onBack when Back is clicked', () => {
    const onBack = vi.fn();
    render(<ReportCard stats={sampleStats()} onBack={onBack} onOpenHand={() => {}} />);

    fireEvent.click(screen.getByText('Back'));
    expect(onBack).toHaveBeenCalled();
  });
});
