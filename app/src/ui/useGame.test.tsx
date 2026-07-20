// @vitest-environment jsdom
import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { GradeClient } from '../worker/gradeClient';
import { useGame } from './useGame';

describe('useGame', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('plays a hand end to end with graceful grading degradation', async () => {
    const { result } = renderHook(() => useGame(new GradeClient()));
    expect(result.current.phase).toBe('menu');

    act(() => result.current.startSession('training', 'balanced'));
    // Hand 1: hero (seat 0) has the button and acts first preflop.
    expect(result.current.phase).toBe('hero');
    expect(result.current.legal!.canFold).toBe(true);

    act(() => result.current.act({ type: 'fold' }));
    expect(result.current.phase).toBe('over');
    expect(result.current.hand!.result!.winner).toBe(1);

    // jsdom has no Worker: grading must degrade to failed, not hang or throw.
    await act(async () => {
      await vi.runAllTimersAsync();
    });
    expect(result.current.grades).toBeNull();
    expect(result.current.gradesFailed).toBe(true);

    act(() => result.current.nextHand());
    // Hand 2: button alternates to the villain, who now acts first.
    expect(result.current.phase).toBe('villain');
    expect(result.current.session!.handNumber).toBe(2);
  });

  it('ignores act() outside the hero phase', () => {
    const { result } = renderHook(() => useGame(new GradeClient()));
    act(() => result.current.act({ type: 'fold' }));
    expect(result.current.phase).toBe('menu');
  });
});

describe('drills', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  const dealWithScript = {
    cfg: { buttonSeat: 0 as const, stacks: [10000, 10000] as [number, number], smallBlind: 50, bigBlind: 100, seed: 3 },
    heroScript: [{ type: 'call' as const }],
  };

  it('starts a drill and auto-plays the scripted hero action', async () => {
    const { result } = renderHook(() => useGame(new GradeClient()));

    act(() => result.current.startDrill('station', 'flop|unopened|air', dealWithScript));
    expect(result.current.drill).toBe('flop|unopened|air');
    const logBefore = result.current.hand!.log.length;

    await act(async () => {
      await vi.advanceTimersByTimeAsync(350);
    });
    expect(result.current.hand!.log.length).toBeGreaterThan(logBefore);

    // Control eventually returns to a live phase (hero or villain), not stuck.
    await act(async () => {
      await vi.advanceTimersByTimeAsync(2000);
    });
    expect(['hero', 'villain', 'over']).toContain(result.current.phase);
  });

  it('resets drill to null when a new session starts', () => {
    const { result } = renderHook(() => useGame(new GradeClient()));
    act(() => result.current.startDrill('station', 'flop|unopened|air', dealWithScript));
    expect(result.current.drill).not.toBeNull();

    act(() => result.current.startSession('training', 'balanced'));
    expect(result.current.drill).toBeNull();
  });

  it('nextHand() is a no-op during a drill even when phase is over', async () => {
    const { result } = renderHook(() => useGame(new GradeClient()));
    act(() => result.current.startDrill('station', 'flop|unopened|air', dealWithScript));

    act(() => result.current.act({ type: 'fold' }));
    expect(result.current.phase).toBe('over');
    const handBefore = result.current.hand;

    act(() => result.current.nextHand());
    expect(result.current.hand).toBe(handBefore);

    await act(async () => {
      await vi.runAllTimersAsync();
    });
  });
});
