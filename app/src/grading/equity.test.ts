import { describe, it, expect } from 'vitest';
import { cardFromString, mulberry32 } from '../engine/cards';
import { equityVsRange } from './equity';
import type { WeightedCombo } from '../personas/ranges';

const c = cardFromString;
const combo = (a: string, b: string): WeightedCombo => ({ cards: [c(a), c(b)], weight: 1 });

describe('equityVsRange', () => {
  it('AA vs 22 preflop is roughly 80/20', () => {
    const eq = equityVsRange([c('As'), c('Ah')], [], [combo('2c', '2d')], 5000, mulberry32(1));
    expect(eq).toBeGreaterThan(0.76);
    expect(eq).toBeLessThan(0.86);
  });

  it('the nuts on the river is 100%', () => {
    const board = ['As', 'Ks', 'Qs', '2d', '7h'].map(c);
    const eq = equityVsRange([c('Js'), c('Ts')], board, [combo('Ac', 'Ad')], 1000, mulberry32(2));
    expect(eq).toBe(1);
  });

  it('a chopped board is 50%', () => {
    const board = ['As', 'Ks', 'Qd', 'Jc', 'Th'].map(c); // broadway on board
    const eq = equityVsRange([c('2c'), c('3d')], board, [combo('4c', '5d')], 1000, mulberry32(3));
    expect(eq).toBe(0.5);
  });

  it('skips range combos that collide with known cards', () => {
    // villain range is only AsAh, both blocked by hero — falls back to remaining combos...
    // there are none, so it must throw rather than loop forever.
    expect(() =>
      equityVsRange([c('As'), c('Ah')], [], [combo('As', 'Ah')], 100, mulberry32(4)),
    ).toThrow();
  });

  it('is deterministic for a given seed', () => {
    const range = [combo('Kc', 'Kd'), combo('7c', '2d')];
    const a = equityVsRange([c('As'), c('Qh')], [], range, 2000, mulberry32(5));
    const b = equityVsRange([c('As'), c('Qh')], [], range, 2000, mulberry32(5));
    expect(a).toBe(b);
  });
});
