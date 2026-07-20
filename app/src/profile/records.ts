import type { HandState, Seat } from '../engine/hand';
import type { GradeLabel } from '../grading/grade';
import type { GradedDecision } from '../grading/gradeHand';
import type { Mode, PersonaKey } from '../ui/gameMachine';
import { PREFLOP_MISTAKE_EV } from '../ui/stats';
import type { DecisionTags } from './tags';
import { tagsFor } from './tags';

export interface StoredDecision extends DecisionTags {
  logIndex: number;
  label: GradeLabel;
  evLost: number; // chips; preflop mistakes use the PREFLOP_MISTAKE_EV proxy
  actionTaken: 'fold' | 'call' | 'raise';
  best: 'fold' | 'call' | 'raise';
}

export interface HandRecord {
  id?: number; // assigned by the store
  ts: number;
  mode: Mode;
  personaKey: PersonaKey;
  drill: string | null; // leak key that generated this hand, null for normal play
  bigBlind: number;
  heroNet: number; // chips won (negative = lost) by the hero this hand
  state: HandState; // full finished hand, replayable in the Replay Theater
  grades: GradedDecision[];
  decisions: StoredDecision[];
}

export function buildHandRecord(
  state: HandState,
  heroSeat: Seat,
  mode: Mode,
  personaKey: PersonaKey,
  grades: GradedDecision[],
  drill: string | null = null,
  ts: number = Date.now(),
): HandRecord {
  if (!state.result) throw new Error('buildHandRecord requires a finished hand');
  const hole = state.holes[heroSeat];
  const decisions = grades.map((g): StoredDecision => {
    const grade = g.grade;
    return {
      ...tagsFor(state.log[g.logIndex], hole, personaKey),
      logIndex: g.logIndex,
      label: grade.label,
      evLost:
        'evLost' in grade ? grade.evLost : grade.label === 'mistake' ? PREFLOP_MISTAKE_EV : 0,
      actionTaken: grade.actionTaken,
      best: 'bestAction' in grade ? grade.bestAction : grade.recommended,
    };
  });
  return {
    ts,
    mode,
    personaKey,
    drill,
    bigBlind: state.cfg.bigBlind,
    heroNet: state.result.stacks[heroSeat] - state.cfg.stacks[heroSeat],
    state,
    grades,
    decisions,
  };
}
