import { describe, it, expect } from 'vitest';
import { mulberry32 } from '../engine/cards';
import type { HandState } from '../engine/hand';
import { startHand, applyAction } from '../engine/hand';
import { PERSONAS, personaAction, personaRange } from './persona';

function playPreflopAsButton(seed: number, params: typeof PERSONAS.nit, rng: () => number) {
  const s = startHand({ buttonSeat: 0, stacks: [1000, 1000], smallBlind: 5, bigBlind: 10, seed });
  return personaAction(s, 0, params, rng);
}

describe('PERSONAS', () => {
  it('defines the four spec personas with sane parameters', () => {
    expect(PERSONAS.nit.preflopRange).toBeLessThan(PERSONAS.balanced.preflopRange);
    expect(PERSONAS.maniac.preflopRange).toBeGreaterThan(PERSONAS.balanced.preflopRange);
    expect(PERSONAS.maniac.aggression).toBeGreaterThan(PERSONAS.station.aggression);
    expect(PERSONAS.station.callDown).toBeGreaterThan(PERSONAS.balanced.callDown);
  });
});

describe('personaRange', () => {
  it('returns the persona preflop fraction of live combos', () => {
    const range = personaRange(PERSONAS.nit, []);
    expect(range.length).toBe(Math.round(1326 * PERSONAS.nit.preflopRange));
  });
});

describe('personaAction', () => {
  it('always returns a legal action across many random spots', () => {
    for (let seed = 0; seed < 60; seed++) {
      const rng = mulberry32(seed);
      let s: HandState = startHand({ buttonSeat: 0, stacks: [1000, 1000], smallBlind: 5, bigBlind: 10, seed });
      let guard = 0;
      while (!s.result && guard++ < 50) {
        const params = s.toAct === 0 ? PERSONAS.maniac : PERSONAS.nit;
        s = applyAction(s, personaAction(s, s.toAct, params, rng)); // throws if illegal
      }
      expect(s.result).not.toBeNull();
    }
  });

  it('the nit folds far more often preflop than the maniac', () => {
    const rng = mulberry32(99);
    let nitFolds = 0, maniacFolds = 0;
    for (let seed = 0; seed < 200; seed++) {
      if (playPreflopAsButton(seed, PERSONAS.nit, rng).type === 'fold') nitFolds++;
      if (playPreflopAsButton(seed, PERSONAS.maniac, rng).type === 'fold') maniacFolds++;
    }
    expect(nitFolds).toBeGreaterThan(maniacFolds + 40);
  });

  it('the maniac raises more often than the station', () => {
    const rng = mulberry32(7);
    let maniacRaises = 0, stationRaises = 0;
    for (let seed = 0; seed < 200; seed++) {
      if (playPreflopAsButton(seed, PERSONAS.maniac, rng).type === 'raise') maniacRaises++;
      if (playPreflopAsButton(seed, PERSONAS.station, rng).type === 'raise') stationRaises++;
    }
    expect(maniacRaises).toBeGreaterThan(stationRaises + 40);
  });
});
