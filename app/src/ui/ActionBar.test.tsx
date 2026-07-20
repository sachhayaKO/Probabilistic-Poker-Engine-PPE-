// @vitest-environment jsdom
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { startHand } from '../engine/hand';
import type { Action } from '../engine/hand';
import type { Game } from './useGame';
import { ActionBar } from './ActionBar';

const cfg = { buttonSeat: 0 as const, stacks: [10000, 10000] as [number, number], smallBlind: 50, bigBlind: 100, seed: 8 };

function heroGame(act: (a: Action) => void, nextHand = () => {}): Game {
  const hand = startHand(cfg);
  return {
    session: {
      mode: 'training', personaKey: 'balanced', buttonSeat: 1,
      stacks: [10000, 10000], handNumber: 1, baseSeed: 1, matchOver: false,
    },
    hand, visibleBoard: [], phase: 'hero',
    legal: { canFold: true, callAmount: 50, canRaise: true, minRaiseTo: 200, maxRaiseTo: 10000 },
    grades: null, gradesFailed: false, race: null, drill: null,
    startSession: () => {}, startDrill: () => {}, act, nextHand,
  };
}

describe('ActionBar', () => {
  it('fires fold/call via buttons', () => {
    const act = vi.fn();
    render(<ActionBar game={heroGame(act)} />);
    fireEvent.click(screen.getByRole('button', { name: /fold/i }));
    expect(act).toHaveBeenCalledWith({ type: 'fold' });
    fireEvent.click(screen.getByRole('button', { name: /call 50/i }));
    expect(act).toHaveBeenCalledWith({ type: 'call' });
  });

  it('F/C hotkeys act, R raises to the default preset', () => {
    const act = vi.fn();
    render(<ActionBar game={heroGame(act)} />);
    fireEvent.keyDown(window, { key: 'f' });
    expect(act).toHaveBeenCalledWith({ type: 'fold' });
    fireEvent.keyDown(window, { key: 'c' });
    expect(act).toHaveBeenCalledWith({ type: 'call' });
    fireEvent.keyDown(window, { key: 'r' });
    // 50% preset on BTN preflop: committed 50 + call 50 + 0.5*(150+50) = 200
    expect(act).toHaveBeenCalledWith({ type: 'raise', to: 200 });
  });

  it('numeric hotkeys raise by preset; pot preset computes 350', () => {
    const act = vi.fn();
    render(<ActionBar game={heroGame(act)} />);
    fireEvent.keyDown(window, { key: '4' });
    // pot preset: 50 + 50 + 1.0*(150+50) = 300 -> but min-raise clamps apply; expected 300
    expect(act).toHaveBeenCalledWith({ type: 'raise', to: 300 });
  });

  it('N advances to the next hand when the hand is over', () => {
    const nextHand = vi.fn();
    const g = heroGame(() => {}, nextHand);
    render(<ActionBar game={{ ...g, phase: 'over', legal: null }} />);
    fireEvent.keyDown(window, { key: 'n' });
    expect(nextHand).toHaveBeenCalled();
  });
});
