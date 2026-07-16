import type { Card } from '../engine/cards';
import type { PersonaParams } from '../personas/persona';
import { personaRange } from '../personas/persona';
import { equityVsRange } from './equity';

export type GradeLabel = 'best' | 'okay' | 'mistake';

export interface DecisionGrade {
  label: GradeLabel;
  evLost: number;
  bestAction: 'fold' | 'call' | 'raise';
  actionTaken: 'fold' | 'call' | 'raise';
  equity: number;
  requiredEquity: number | null;
  evByAction: { fold: number; call: number; raise: number | null };
  explanation: string;
}

export interface PostflopSpot {
  hero: [Card, Card];
  board: Card[];
  pot: number;
  toCall: number;
  raiseCost: number | null;
  villain: PersonaParams;
  iterations: number;
  rng: () => number;
  bigBlind: number;
}

const GERUNDS = { fold: 'folding', call: 'calling', raise: 'raising' } as const;

const BEST_TOLERANCE_BB = 0.1;
const OKAY_TOLERANCE_BB = 1.0;

const fmt = (n: number) => Math.round(n).toLocaleString('en-US');
const pct = (x: number) => `${Math.round(x * 100)}%`;

export function gradePostflopDecision(
  spot: PostflopSpot,
  taken: 'fold' | 'call' | 'raise',
): DecisionGrade {
  const { pot, toCall, raiseCost, villain, bigBlind } = spot;
  const range = personaRange(villain, [...spot.hero, ...spot.board]);
  const equity = equityVsRange(spot.hero, spot.board, range, spot.iterations, spot.rng);

  // Simplified v1 EV model, all relative to folding (= 0):
  //   call:  equity * (pot + toCall) − toCall
  //   raise: villain folds `foldToRaise` of the time (win pot now); otherwise
  //          showdown with current equity for the bigger pot.
  const evFold = 0;
  const evCall = equity * (pot + toCall) - toCall;
  const evRaise =
    raiseCost === null
      ? null
      : villain.foldToRaise * pot +
        (1 - villain.foldToRaise) * (equity * (pot + raiseCost) - raiseCost);

  const evByAction = { fold: evFold, call: evCall, raise: evRaise };
  const candidates: ['fold' | 'call' | 'raise', number][] = [
    ['fold', evFold],
    ['call', evCall],
  ];
  if (evRaise !== null) candidates.push(['raise', evRaise]);
  candidates.sort((a, b) => b[1] - a[1]);
  const [bestAction, bestEv] = candidates[0];

  const takenEv = evByAction[taken];
  if (takenEv === null) throw new Error(`graded action '${taken}' was not available`);
  const evLost = Math.max(0, bestEv - takenEv);

  const label: GradeLabel =
    evLost <= BEST_TOLERANCE_BB * bigBlind ? 'best'
    : evLost <= OKAY_TOLERANCE_BB * bigBlind ? 'okay'
    : 'mistake';

  const requiredEquity = toCall > 0 ? toCall / (pot + toCall) : null;

  let explanation: string;
  if (toCall > 0) {
    explanation =
      `The pot was ${fmt(pot)} and the call was ${fmt(toCall)}, so you needed ` +
      `${fmt(toCall)} / (${fmt(pot)} + ${fmt(toCall)}) = ${pct(requiredEquity!)} equity to call. ` +
      `Against ${villain.name}'s range here your hand had ${pct(equity)}. `;
  } else {
    explanation =
      `Checking was free. Against ${villain.name}'s range here your hand had ${pct(equity)} equity. `;
  }
  explanation +=
    label === 'best'
      ? `${cap(taken)} was the best available action.`
      : `${cap(bestAction)} was best; ${GERUNDS[taken]} ` +
        `loses ${fmt(evLost)} chips on average.`;

  return { label, evLost, bestAction, actionTaken: taken, equity, requiredEquity, evByAction, explanation };
}

const cap = (s: string) => s[0].toUpperCase() + s.slice(1);
