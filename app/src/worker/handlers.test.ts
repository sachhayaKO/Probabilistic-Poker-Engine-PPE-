import { describe, expect, it } from 'vitest';
import { applyAction, startHand } from '../engine/hand';
import { cardFromString } from '../engine/cards';
import { PERSONAS } from '../personas/persona';
import { handleRequest } from './handlers';

function finishedHand() {
  let s = startHand({ buttonSeat: 0, stacks: [1000, 1000], smallBlind: 5, bigBlind: 10, seed: 3 });
  s = applyAction(s, { type: 'fold' }); // hero folds the button
  return s;
}

describe('handleRequest', () => {
  it('grades a finished hand', () => {
    const res = handleRequest({
      id: 1, kind: 'gradeHand', state: finishedHand(), heroSeat: 0,
      villain: PERSONAS.balanced, iterations: 100, seed: 5,
    });
    expect(res.ok).toBe(true);
    if (res.ok && res.kind === 'gradeHand') {
      expect(res.result.length).toBeGreaterThan(0);
      expect(res.result[0].street).toBe('preflop');
    }
  });

  it('computes equity vs a single known combo', () => {
    const res = handleRequest({
      id: 2, kind: 'equity',
      hero: [cardFromString('As'), cardFromString('Ah')],
      board: [],
      range: [{ cards: [cardFromString('7c'), cardFromString('2d')], weight: 1 }],
      iterations: 300, seed: 11,
    });
    expect(res.ok).toBe(true);
    if (res.ok && res.kind === 'equity') expect(res.result).toBeGreaterThan(0.7);
  });

  it('returns an error envelope instead of throwing', () => {
    const live = startHand({ buttonSeat: 0, stacks: [1000, 1000], smallBlind: 5, bigBlind: 10, seed: 3 });
    const res = handleRequest({
      id: 3, kind: 'gradeHand', state: live, heroSeat: 0,
      villain: PERSONAS.balanced, iterations: 100, seed: 5,
    });
    expect(res.ok).toBe(false);
  });
});
