import { describe, it, expect } from 'vitest';
import { cardFromString } from '../engine/cards';
import { preflopRecommendation } from './preflop';

const hole = (a: string, b: string): [number, number] => [cardFromString(a), cardFromString(b)];

describe('preflopRecommendation', () => {
  it('opens premium and playable hands on the button, folds trash', () => {
    expect(preflopRecommendation(hole('As', 'Ah'), 'button-open')).toBe('raise');
    expect(preflopRecommendation(hole('Ts', '9s'), 'button-open')).toBe('raise');
    expect(preflopRecommendation(hole('7c', '2d'), 'button-open')).toBe('fold');
  });

  it('3-bets premiums and defends reasonable hands in the big blind', () => {
    expect(preflopRecommendation(hole('As', 'Ks'), 'bb-vs-open')).toBe('raise');
    expect(preflopRecommendation(hole('9s', '8s'), 'bb-vs-open')).toBe('call');
    expect(preflopRecommendation(hole('7c', '2d'), 'bb-vs-open')).toBe('fold');
  });

  it('continues narrowly against a 3-bet', () => {
    expect(preflopRecommendation(hole('As', 'Ah'), 'button-vs-3bet')).toBe('raise');
    expect(preflopRecommendation(hole('As', 'Qs'), 'button-vs-3bet')).toBe('call');
    expect(preflopRecommendation(hole('8c', '3d'), 'button-vs-3bet')).toBe('fold');
  });
});
