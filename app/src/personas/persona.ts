import type { Card } from '../engine/cards';
import type { Action, HandState, Seat } from '../engine/hand';
import { legalActions } from '../engine/hand';
import { equityVsRange } from '../grading/equity';
import type { WeightedCombo } from './ranges';
import { chenScore, rangeTopFraction } from './ranges';

export interface PersonaParams {
  name: string;
  preflopRange: number;
  aggression: number;
  callDown: number;
  bluffFreq: number;
  foldToRaise: number;
}

export const PERSONAS: Record<'nit' | 'maniac' | 'station' | 'balanced', PersonaParams> = {
  nit:      { name: 'The Nit',             preflopRange: 0.15, aggression: 0.35, callDown: 0.0,  bluffFreq: 0.02, foldToRaise: 0.65 },
  maniac:   { name: 'The Maniac',          preflopRange: 0.85, aggression: 0.85, callDown: 0.25, bluffFreq: 0.35, foldToRaise: 0.15 },
  station:  { name: 'The Calling Station', preflopRange: 0.70, aggression: 0.05, callDown: 0.60, bluffFreq: 0.02, foldToRaise: 0.05 },
  balanced: { name: 'The Balanced Player', preflopRange: 0.55, aggression: 0.55, callDown: 0.10, bluffFreq: 0.12, foldToRaise: 0.40 },
};

export function personaRange(params: PersonaParams, dead: Card[]): WeightedCombo[] {
  return rangeTopFraction(params.preflopRange, dead);
}

const BOT_EQUITY_ITERATIONS = 300;
// Chen threshold approximating the persona's preflop continuing range:
// rangeTopFraction is Chen-ordered, so "in range" ≈ "Chen score above the
// range's cutoff". We look it up directly to keep one source of truth.
function inPreflopRange(hole: [Card, Card], params: PersonaParams): boolean {
  const range = rangeTopFraction(params.preflopRange, []);
  const cutoff = chenScore(range[range.length - 1].cards[0], range[range.length - 1].cards[1]);
  return chenScore(hole[0], hole[1]) >= cutoff;
}

export function personaAction(
  state: HandState,
  seat: Seat,
  params: PersonaParams,
  rng: () => number,
): Action {
  const la = legalActions(state);
  const hole = state.holes[seat];
  const raiseTo = () => ({
    type: 'raise' as const,
    to: Math.min(la.maxRaiseTo, Math.max(la.minRaiseTo, la.minRaiseTo * 2)),
  });

  if (state.street === 'preflop') {
    const playable = inPreflopRange(hole, params);
    if (!playable) {
      if (la.canRaise && rng() < params.bluffFreq) return raiseTo();
      return la.canFold ? { type: 'fold' } : { type: 'call' };
    }
    if (la.canRaise && rng() < params.aggression) return raiseTo();
    return { type: 'call' };
  }

  // Postflop: estimate equity vs an unknown opponent (uniform random range).
  const equity = equityVsRange(
    hole, state.board, rangeTopFraction(1, [...hole, ...state.board]),
    BOT_EQUITY_ITERATIONS, rng,
  );
  const pot = state.pot + state.committed[0] + state.committed[1];
  const required = la.callAmount > 0 ? la.callAmount / (pot + la.callAmount) : 0;

  if (equity >= required + 0.15) {
    if (la.canRaise && rng() < params.aggression) return raiseTo();
    return { type: 'call' };
  }
  if (equity >= required) return { type: 'call' };
  // insufficient equity: stations still call, others occasionally bluff-raise
  if (rng() < params.callDown) return { type: 'call' };
  if (la.canRaise && rng() < params.bluffFreq) return raiseTo();
  if (la.canFold) return { type: 'fold' };
  return { type: 'call' }; // checking is free
}
