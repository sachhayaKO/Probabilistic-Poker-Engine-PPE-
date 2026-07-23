// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import type { ProfileStats } from '../profile/aggregate';
import type { HandRecord, StoredDecision } from '../profile/records';
import type { HandState } from '../engine/hand';
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
    render(<ReportCard stats={emptyStats()} records={[]} onBack={() => {}} onOpenHand={() => {}} />);
    expect(screen.getByText(/Play some hands/)).toBeTruthy();
    expect(screen.queryByText(/accuracy/i)).toBeNull();
  });

  it('renders stat tiles, leaks in order, and the trend svg', () => {
    render(<ReportCard stats={sampleStats()} records={[]} onBack={() => {}} onOpenHand={() => {}} />);

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
    render(<ReportCard stats={sampleStats()} records={[]} onBack={() => {}} onOpenHand={onOpenHand} />);

    fireEvent.click(screen.getByText('Hand #101'));
    expect(onOpenHand).toHaveBeenCalledWith(101);
  });

  it('calls onBack when Back is clicked', () => {
    const onBack = vi.fn();
    render(<ReportCard stats={sampleStats()} records={[]} onBack={onBack} onOpenHand={() => {}} />);

    fireEvent.click(screen.getByText('Back'));
    expect(onBack).toHaveBeenCalled();
  });
});

const noop = () => {};

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
    state: {} as HandState,
    grades: [],
    decisions: [],
    ...overrides,
  };
}

describe('ReportCard match history', () => {
  const records = [
    rec({ id: 1, ts: 0, heroNet: 12, decisions: [decision('good')] }),
    rec({ id: 2, ts: 60_000, heroNet: -4, decisions: [decision('mistake')] }),
  ];

  it('switches to the Match History tab and lists sessions', () => {
    render(
      <ReportCard
        stats={sampleStats()}
        records={records}
        onBack={noop}
        onOpenHand={noop}
      />,
    );
    fireEvent.click(screen.getByRole('tab', { name: 'Match History' }));
    expect(screen.getByText('The Balanced Player')).toBeTruthy();
    expect(screen.getByText('Training')).toBeTruthy();
    expect(screen.getByText('+8')).toBeTruthy(); // net chips, signed
    expect(screen.getByText(/2 hands/)).toBeTruthy();
  });

  it('expands a session to its hands and opens the replay', () => {
    const onOpenHand = vi.fn();
    render(
      <ReportCard
        stats={sampleStats()}
        records={records}
        onBack={noop}
        onOpenHand={onOpenHand}
      />,
    );
    fireEvent.click(screen.getByRole('tab', { name: 'Match History' }));
    fireEvent.click(screen.getByRole('button', { name: /the balanced player/i }));
    fireEvent.click(screen.getByRole('button', { name: 'Hand #2' }));
    expect(onOpenHand).toHaveBeenCalledWith(2);
  });

  it('shows an empty state with no sessions', () => {
    render(<ReportCard stats={sampleStats()} records={[]} onBack={noop} onOpenHand={noop} />);
    fireEvent.click(screen.getByRole('tab', { name: 'Match History' }));
    expect(screen.getByText(/play your first session/i)).toBeTruthy();
  });
});
