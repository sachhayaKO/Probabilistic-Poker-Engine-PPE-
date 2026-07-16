import type { HandConfig, HandResult, HandState, Seat } from '../engine/hand';
import { legalActions } from '../engine/hand';

export type Mode = 'training' | 'match';
export type PersonaKey = 'nit' | 'maniac' | 'station' | 'balanced';

export const HERO_SEAT: Seat = 0;
export const VILLAIN_SEAT: Seat = 1;
export const SMALL_BLIND = 50;
export const BIG_BLIND = 100;
export const START_STACK = 10_000; // 100 BB

export interface Session {
  mode: Mode;
  personaKey: PersonaKey;
  buttonSeat: Seat; // button for the NEXT deal; alternates each hand
  stacks: [number, number];
  handNumber: number; // deals so far; 0 before the first deal
  baseSeed: number;
  matchOver: boolean;
}

export function newSession(mode: Mode, personaKey: PersonaKey, baseSeed: number): Session {
  return {
    mode, personaKey,
    buttonSeat: HERO_SEAT,
    stacks: [START_STACK, START_STACK],
    handNumber: 0,
    baseSeed,
    matchOver: false,
  };
}

export function dealHand(s: Session): { session: Session; cfg: HandConfig } {
  if (s.matchOver) throw new Error('match is over');
  const stacks: [number, number] =
    s.mode === 'training' ? [START_STACK, START_STACK] : [s.stacks[0], s.stacks[1]];
  const cfg: HandConfig = {
    buttonSeat: s.buttonSeat,
    stacks,
    smallBlind: SMALL_BLIND,
    bigBlind: BIG_BLIND,
    seed: (s.baseSeed + s.handNumber * 0x9e3779b9) >>> 0,
  };
  const session: Session = {
    ...s,
    stacks,
    handNumber: s.handNumber + 1,
    buttonSeat: s.buttonSeat === 0 ? 1 : 0,
  };
  return { session, cfg };
}

export function applyHandResult(s: Session, r: HandResult): Session {
  const stacks: [number, number] = [r.stacks[0], r.stacks[1]];
  const matchOver = s.mode === 'match' && (stacks[0] === 0 || stacks[1] === 0);
  return { ...s, stacks, matchOver };
}

export const BET_PRESETS = [
  { label: '33%', fraction: 0.33 },
  { label: '50%', fraction: 0.5 },
  { label: '75%', fraction: 0.75 },
  { label: 'Pot', fraction: 1 },
] as const;

// Raise-to for an "X% of pot" bet: call, then add X% of the pot after the call.
// Clamped to the legal [minRaiseTo, maxRaiseTo] window; 0 when raising is illegal.
export function presetRaiseTo(state: HandState, fraction: number): number {
  const la = legalActions(state);
  if (!la.canRaise) return 0;
  const me = state.toAct;
  const potBefore = state.pot + state.committed[0] + state.committed[1];
  const potAfterCall = potBefore + la.callAmount;
  const target = state.committed[me] + la.callAmount + Math.round(fraction * potAfterCall);
  return Math.min(la.maxRaiseTo, Math.max(la.minRaiseTo, target));
}
