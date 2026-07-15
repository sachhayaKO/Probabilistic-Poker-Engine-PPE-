import { describe, it, expect } from 'vitest';
import { cardFromString, mulberry32 } from '../engine/cards';
import { PERSONAS } from '../personas/persona';
import { gradePostflopDecision } from './grade';
import type { PostflopSpot } from './grade';


const c = cardFromString;

// Hero has 22 (only two outs) facing a huge river bet vs the station: clear fold.
const drawDeadSpot = (): PostflopSpot => ({
  hero: [c('2c'), c('2d')],
  board: ['As', 'Ks', 'Qs', 'Jh', '9d'].map(c),
  pot: 1000,
  toCall: 400,
  raiseCost: 1200,
  villain: PERSONAS.station,
  iterations: 2000,
  rng: mulberry32(11),
  bigBlind: 10,
});

// Hero has the nut flush on the river facing a bet: never fold.
const nutsSpot = (): PostflopSpot => ({
  hero: [c('As'), c('Ts')],
  board: ['Ks', 'Qs', '2s', '7h', '3d'].map(c),
  pot: 1000,
  toCall: 400,
  raiseCost: 1200,
  villain: PERSONAS.station,
  iterations: 2000,
  rng: mulberry32(12),
  bigBlind: 10,
});

describe('gradePostflopDecision', () => {
  it('grades a hopeless call as a mistake with positive EV lost', () => {
    const g = gradePostflopDecision(drawDeadSpot(), 'call');
    expect(g.label).toBe('mistake');
    expect(g.bestAction).toBe('fold');
    expect(g.evLost).toBeGreaterThan(50);
  });

  it('grades folding the same spot as best', () => {
    const g = gradePostflopDecision(drawDeadSpot(), 'fold');
    expect(g.label).toBe('best');
    expect(g.evLost).toBe(0);
  });

  it('never grades continuing with the nuts as fold-best', () => {
    const g = gradePostflopDecision(nutsSpot(), 'raise');
    expect(g.bestAction).not.toBe('fold');
    expect(g.equity).toBeGreaterThan(0.95);
  });

  it('reports required equity from pot odds', () => {
    const g = gradePostflopDecision(drawDeadSpot(), 'fold');
    expect(g.requiredEquity).toBeCloseTo(400 / 1400, 3);
  });

  it('writes an explanation containing the actual numbers', () => {
    const g = gradePostflopDecision(drawDeadSpot(), 'call');
    expect(g.explanation).toContain('1,000'); // pot
    expect(g.explanation).toContain('400');   // call amount
    expect(g.explanation).toContain('29%');   // required equity, rounded
  });

  it('sets raise EV to null when raising is unavailable', () => {
    const g = gradePostflopDecision({ ...drawDeadSpot(), raiseCost: null }, 'fold');
    expect(g.evByAction.raise).toBeNull();
  });
});
