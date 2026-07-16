import type { HandConfig, HandState } from '../engine/hand';
import { legalActions, startHand } from '../engine/hand';

export const START_STACK = 10000;
export const SMALL_BLIND = 5;
export const BIG_BLIND = 10;

export const BET_PRESETS = [
  { label: '33%', fraction: 0.33 },
  { label: '50%', fraction: 0.5 },
  { label: '75%', fraction: 0.75 },
  { label: 'Pot', fraction: 1.0 },
] as const;

export interface SessionConfig {
  mode: 'training' | 'match';
  villain: string;
  nextSeed: number;
  stacks: [number, number];
  buttonSeat: 0 | 1;
}

export interface Session {
  cfg: SessionConfig;
  handCount: number;
  matchOver: boolean;
}

/**
 * Deterministic hand-config producer.
 * Seeds are xorshift32-like: each hand draws from nextSeed, which advances.
 */
export function dealHand(s: Session): { cfg: HandConfig; session: Session } {
  if (s.matchOver) throw new Error('match is over');

  const seed = s.cfg.nextSeed;
  const nextSeed = ((seed << 13) ^ seed) >>> 19;

  const cfg: HandConfig = {
    buttonSeat: s.cfg.buttonSeat,
    stacks: s.cfg.stacks,
    smallBlind: SMALL_BLIND,
    bigBlind: BIG_BLIND,
    seed,
  };

  const hand = startHand(cfg);
  const newSession: Session = {
    cfg: {
      ...s.cfg,
      nextSeed,
      buttonSeat: s.cfg.buttonSeat === 0 ? 1 : 0,
    },
    handCount: s.handCount + 1,
    matchOver: s.matchOver,
  };

  return { cfg, session: newSession };
}

/**
 * Apply a hand result to the session, returning the updated session.
 * In training mode, stacks are always reset to START_STACK.
 * In match mode, stacks are carried and matchOver is set to true if a stack hits zero.
 */
export function applyHandResult(
  s: Session,
  result: { winner: 0 | 1; potAwarded: number; showdown: boolean; stacks: [number, number] },
): Session {
  const newStacks = s.cfg.mode === 'training' ? [START_STACK, START_STACK] : result.stacks;
  const matchOver = result.stacks[0] === 0 || result.stacks[1] === 0;

  return {
    ...s,
    cfg: {
      ...s.cfg,
      stacks: newStacks as [number, number],
    },
    matchOver,
  };
}

export function newSession(mode: 'training' | 'match', villain: string, seed: number): Session {
  return {
    cfg: {
      mode,
      villain,
      nextSeed: seed,
      stacks: [START_STACK, START_STACK],
      buttonSeat: 0,
    },
    handCount: 0,
    matchOver: false,
  };
}

/**
 * Compute the "to" value of a preset raise on the current action.
 * Returns the clamped raise amount, or 0 if raising is not legal.
 *
 * Preset-raise formula:
 *   (committed) + (call) + frac * (pot + call)
 * Clamped to [min-raise, all-in].
 */
export function presetRaiseTo(s: HandState, fraction: number): number {
  const la = legalActions(s);
  if (!la.canRaise) return 0;

  // committed := amount you've already put in this street (not pot-relative)
  const committed = s.committed[s.toAct];
  const toCall = Math.max(0, Math.max(...s.committed) - committed);
  const pot = s.pot + s.committed[0] + s.committed[1];

  const target = committed + toCall + fraction * (pot + toCall);
  const clamped = Math.max(la.minRaiseTo, Math.min(target, la.maxRaiseTo));
  return Math.round(clamped);
}
