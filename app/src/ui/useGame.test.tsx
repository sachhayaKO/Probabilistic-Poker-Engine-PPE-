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
