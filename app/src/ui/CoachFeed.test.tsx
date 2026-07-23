// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { CoachFeed } from './CoachFeed';
import type { ProfileStats } from '../profile/aggregate';
import type { CoachCard } from '../profile/coach';

function makeStats(overrides: Partial<ProfileStats> = {}): ProfileStats {
  return {
    handsGraded: 10,
    decisions: 20,
    accuracy: 0.8,
    evLostTotal: 50,
    bb100: 5,
    trend: [],
    leaks: [],
    ...overrides,
  };
}

function makeCoach(overrides: Partial<CoachCard> = {}): CoachCard {
  return {
    leak: null,
    queue: [],
    graduated: [],
    streak: 0,
    ...overrides,
  };
}

const noop = () => {};

describe('CoachFeed', () => {
  it('(a) shows storage warning banner when persistent is false, hides when true', () => {
    const { rerender } = render(
      <CoachFeed
        stats={makeStats()}
        coach={makeCoach()}
        persistent={false}
        onPlay={noop}
        onDrill={noop}
        onReport={noop}
        onOpenHand={noop}
      />,
    );
    expect(screen.getByRole('alert').textContent).toBe(
      "Progress isn't being saved — IndexedDB is unavailable in this browser.",
    );

    rerender(
      <CoachFeed
        stats={makeStats()}
        coach={makeCoach()}
        persistent={true}
        onPlay={noop}
        onDrill={noop}
        onReport={noop}
        onOpenHand={noop}
      />,
    );
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('(b) renders leak label, drills with default balanced persona, and opens hands', () => {
    const onDrill = vi.fn();
    const onOpenHand = vi.fn();
    const coach = makeCoach({
      leak: {
        key: 'flop-cbet-facing-raise',
        label: 'Folding too much to flop c-bet raises',
        decisions: 10,
        mistakes: 5,
        evLost: 42,
        accuracy: 0.5,
        handIds: [3, 2, 1],
      },
    });

    render(
      <CoachFeed
        stats={makeStats()}
        coach={coach}
        persistent={true}
        onPlay={noop}
        onDrill={onDrill}
        onReport={noop}
        onOpenHand={onOpenHand}
      />,
    );

    expect(screen.getByText('Folding too much to flop c-bet raises')).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: /drill this spot/i }));
    expect(onDrill).toHaveBeenCalledWith('flop-cbet-facing-raise', 'balanced');

    fireEvent.click(screen.getByRole('button', { name: 'Hand #3' }));
    expect(onOpenHand).toHaveBeenCalledWith(3);
  });

  it('(c) renders graduated leak with rounded accuracy percentage', () => {
    render(
      <CoachFeed
        stats={makeStats()}
        coach={makeCoach({
          graduated: [{ key: 'x', label: 'Overfolding the big blind', accuracy: 0.92, decisions: 30 }],
        })}
        persistent={true}
        onPlay={noop}
        onDrill={noop}
        onReport={noop}
        onOpenHand={noop}
      />,
    );

    expect(screen.getByText(/graduated at 92%/)).toBeTruthy();
  });

  it('(d) Deal In defaults to training/balanced, and reflects Match + Maniac selection', () => {
    const onPlay = vi.fn();
    render(
      <CoachFeed
        stats={makeStats()}
        coach={makeCoach()}
        persistent={true}
        onPlay={onPlay}
        onDrill={noop}
        onReport={noop}
        onOpenHand={noop}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: /deal in/i }));
    expect(onPlay).toHaveBeenCalledWith('training', 'balanced');

    fireEvent.click(screen.getByRole('radio', { name: /match/i }));
    fireEvent.click(screen.getByRole('radio', { name: /the maniac/i }));
    fireEvent.click(screen.getByRole('button', { name: /deal in/i }));
    expect(onPlay).toHaveBeenCalledWith('match', 'maniac');
  });

  it('(f) renders all four persona cards with descriptions', () => {
    render(
      <CoachFeed
        stats={makeStats()}
        coach={makeCoach()}
        persistent={true}
        onPlay={noop}
        onDrill={noop}
        onReport={noop}
        onOpenHand={noop}
      />,
    );

    const group = screen.getByRole('radiogroup', { name: 'opponent' });
    expect(group).toBeTruthy();
    for (const name of [/the nit/i, /the maniac/i, /the calling station/i, /the balanced player/i]) {
      expect(screen.getByRole('radio', { name })).toBeTruthy();
    }
    expect(screen.getByText(/plays only premium hands/i)).toBeTruthy();
    expect(screen.getByRole('radio', { name: /the balanced player/i })).toHaveProperty(
      'checked',
      true,
    );
  });

  it('(e) Report Card button calls onReport', () => {
    const onReport = vi.fn();
    render(
      <CoachFeed
        stats={makeStats()}
        coach={makeCoach()}
        persistent={true}
        onPlay={noop}
        onDrill={noop}
        onReport={onReport}
        onOpenHand={noop}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: /report card/i }));
    expect(onReport).toHaveBeenCalled();
  });
});
