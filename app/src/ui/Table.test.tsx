// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { applyAction, startHand } from '../engine/hand';
import type { Game } from './useGame';
import { Table } from './Table';

function gameFixture(overrides: Partial<Game>): Game {
  return {
    session: {
      mode: 'training', personaKey: 'balanced', buttonSeat: 1,
      stacks: [10000, 10000], handNumber: 1, baseSeed: 1, matchOver: false,
    },
    hand: null, visibleBoard: [], phase: 'hero', legal: null,
    grades: null, gradesFailed: false, race: null,
    startSession: () => {}, act: () => {}, nextHand: () => {},
    ...overrides,
  };
}

const cfg = { buttonSeat: 0 as const, stacks: [10000, 10000] as [number, number], smallBlind: 50, bigBlind: 100, seed: 8 };

describe('Table', () => {
  it('hides villain cards during a live hand and shows the pot', () => {
    const hand = startHand(cfg);
    render(<Table game={gameFixture({ hand, phase: 'hero' })} />);
    expect(screen.getAllByLabelText('face-down card')).toHaveLength(2);
    expect(screen.getByText('The Balanced Player')).toBeTruthy();
    expect(screen.getByLabelText(/150.*pot/i)).toBeTruthy(); // SB 50 + BB 100
  });

  it('shows a result banner when the hand is over', () => {
    let hand = startHand(cfg);
    hand = applyAction(hand, { type: 'fold' });
    render(<Table game={gameFixture({ hand, phase: 'over' })} />);
    expect(screen.getByText(/wins|You win|Split/i)).toBeTruthy();
  });

  it('renders the equity race during a runout', () => {
    let hand = startHand(cfg);
    hand = applyAction(hand, { type: 'raise', to: 10000 });
    hand = applyAction(hand, { type: 'call' });
    render(
      <Table game={gameFixture({ hand, phase: 'runout', visibleBoard: hand.board.slice(0, 3), race: { hero: 0.62, villain: 0.38 } })} />,
    );
    expect(screen.getByText(/62/)).toBeTruthy();
    expect(screen.getByText(/38/)).toBeTruthy();
  });
});
