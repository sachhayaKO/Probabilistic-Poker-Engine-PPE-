import type { HandState, Seat, Street } from '../engine/hand';
import type { PersonaParams } from '../personas/persona';
import type { DecisionGrade, GradeLabel } from './grade';
import { gradePostflopDecision } from './grade';
import type { PreflopSpot } from './preflop';
import { preflopRecommendation } from './preflop';

export interface PreflopGrade {
  label: GradeLabel;
  recommended: 'raise' | 'call' | 'fold';
  actionTaken: 'raise' | 'call' | 'fold';
  explanation: string;
}

export interface GradedDecision {
  street: Street;
  logIndex: number;
  grade: DecisionGrade | PreflopGrade;
}

// Map a preflop log position to a chart spot. v1 covers the three core spots;
// deeper raise wars fall back to 'button-vs-3bet' as the closest chart.
function preflopSpotFor(state: HandState, heroSeat: Seat, logIndex: number): PreflopSpot {
  const isButton = heroSeat === state.cfg.buttonSeat;
  const priorRaises = state.log
    .slice(0, logIndex)
    .filter((e) => e.street === 'preflop' && e.action.type === 'raise').length;
  if (isButton) return priorRaises === 0 ? 'button-open' : 'button-vs-3bet';
  return 'bb-vs-open';
}

export function gradeHand(
  finished: HandState,
  heroSeat: Seat,
  villain: PersonaParams,
  iterations: number,
  rng: () => number,
): GradedDecision[] {
  if (!finished.result) throw new Error('gradeHand requires a finished hand');
  const grades: GradedDecision[] = [];
  const hero = finished.holes[heroSeat];
  const bb = finished.cfg.bigBlind;

  finished.log.forEach((entry, logIndex) => {
    if (entry.seat !== heroSeat) return;
    const takenType = entry.action.type;
    const taken: 'fold' | 'call' | 'raise' = takenType;

    if (entry.street === 'preflop') {
      const spot = preflopSpotFor(finished, heroSeat, logIndex);
      const recommended = preflopRecommendation(hero, spot);
      // 'call' with nothing to call is a check — checking when the chart says
      // fold is fine (folding when checking is free would burn equity).
      const effectiveRecommended =
        recommended === 'fold' && entry.toCall === 0 ? 'call' : recommended;
      const label: GradeLabel = taken === effectiveRecommended ? 'best' : 'mistake';
      const explanation =
        label === 'best'
          ? `The chart agrees: ${taken} is standard here.`
          : `Standard play in this spot is to ${effectiveRecommended}; you chose ${taken}.`;
      grades.push({
        street: entry.street, logIndex,
        grade: { label, recommended: effectiveRecommended, actionTaken: taken, explanation },
      });
      return;
    }

    // Postflop: rebuild the spot from the log entry.
    // If the hero raised, raiseCost is exactly what they added (to − committedBefore).
    // Otherwise model the raise option as a pot-ish raise, clamped to what was
    // actually legal; if no raise was legal (facing all-in), there is no raise option.
    const raiseCost =
      entry.action.type === 'raise'
        ? entry.action.to - entry.committedBefore
        : entry.canRaise
          ? Math.min(
              entry.toCall + Math.max(entry.potBefore, bb * 2),
              entry.maxRaiseTo - entry.committedBefore,
            )
          : null;
    grades.push({
      street: entry.street, logIndex,
      grade: gradePostflopDecision(
        {
          hero,
          board: entry.board,
          pot: entry.potBefore,
          toCall: entry.toCall,
          raiseCost,
          villain,
          iterations,
          rng,
          bigBlind: bb,
        },
        taken,
      ),
    });
  });

  return grades;
}
