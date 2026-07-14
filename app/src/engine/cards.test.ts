import { describe, it, expect } from 'vitest';
import { cardFromString, cardToString, makeDeck, mulberry32, rankOf, shuffle, suitOf } from './cards';

describe('cards', () => {
  it('encodes and decodes card strings', () => {
    expect(cardFromString('2c')).toBe(0);
    expect(cardFromString('As')).toBe(51);
    expect(rankOf(cardFromString('Td'))).toBe(8);
    expect(suitOf(cardFromString('Td'))).toBe(1);
    expect(cardToString(cardFromString('Kh'))).toBe('Kh');
  });

  it('rejects bad card strings', () => {
    expect(() => cardFromString('Xx')).toThrow();
  });

  it('makes a 52-card deck of unique cards', () => {
    const deck = makeDeck();
    expect(deck.length).toBe(52);
    expect(new Set(deck).size).toBe(52);
  });

  it('excludes dead cards', () => {
    const dead = [cardFromString('As'), cardFromString('Ah')];
    const deck = makeDeck(dead);
    expect(deck.length).toBe(50);
    expect(deck).not.toContain(dead[0]);
  });

  it('shuffles deterministically for a given seed', () => {
    const a = makeDeck(); shuffle(a, mulberry32(42));
    const b = makeDeck(); shuffle(b, mulberry32(42));
    const c = makeDeck(); shuffle(c, mulberry32(43));
    expect(a).toEqual(b);
    expect(a).not.toEqual(c);
  });
});
