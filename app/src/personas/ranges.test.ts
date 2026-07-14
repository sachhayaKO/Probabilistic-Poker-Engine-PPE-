import { describe, it, expect } from 'vitest';
import { cardFromString } from '../engine/cards';
import { chenScore, rangeTopFraction } from './ranges';

const c = cardFromString;

describe('chenScore', () => {
  it('matches known Chen values', () => {
    expect(chenScore(c('As'), c('Ah'))).toBe(20); // AA
    expect(chenScore(c('As'), c('Ks'))).toBe(12); // AKs
    expect(chenScore(c('As'), c('Kh'))).toBe(10); // AKo
    expect(chenScore(c('Ts'), c('Th'))).toBe(10); // TT
    expect(chenScore(c('2s'), c('2h'))).toBe(5);  // 22 (pair floor)
    expect(chenScore(c('2s'), c('7h'))).toBe(-1); // 27o, the worst hand
  });

  it('is symmetric', () => {
    expect(chenScore(c('As'), c('Kh'))).toBe(chenScore(c('Kh'), c('As')));
  });
});

describe('rangeTopFraction', () => {
  it('returns all 1326 combos at fraction 1 with no dead cards', () => {
    expect(rangeTopFraction(1, []).length).toBe(1326);
  });

  it('excludes combos containing dead cards', () => {
    const dead = [c('As'), c('Kh')];
    const range = rangeTopFraction(1, dead);
    expect(range.length).toBe(1225); // C(50,2)
    for (const combo of range) {
      expect(combo.cards).not.toContain(dead[0]);
      expect(combo.cards).not.toContain(dead[1]);
    }
  });

  it('keeps only strong hands at small fractions', () => {
    const tight = rangeTopFraction(0.05, []);
    expect(tight.length).toBeGreaterThan(0);
    expect(tight.length).toBeLessThan(1326 * 0.08);
    // AA must be in any top-5% range
    const hasAA = tight.some(({ cards }) => {
      const [a, b] = cards;
      return Math.floor(a / 4) === 12 && Math.floor(b / 4) === 12;
    });
    expect(hasAA).toBe(true);
  });

  it('wider fractions contain narrower ones', () => {
    const key = ({ cards }: { cards: [number, number] }) => cards.join(',');
    const tight = new Set(rangeTopFraction(0.1, []).map(key));
    const wide = new Set(rangeTopFraction(0.5, []).map(key));
    for (const k of tight) expect(wide.has(k)).toBe(true);
  });
});
