import type { Card } from './cards';
import { makeDeck, mulberry32, shuffle } from './cards';
import { evaluate7 } from './evaluate';

export type Seat = 0 | 1;
export type Street = 'preflop' | 'flop' | 'turn' | 'river';
export type Action = { type: 'fold' } | { type: 'call' } | { type: 'raise'; to: number };

export interface HandConfig {
  buttonSeat: Seat;
  stacks: [number, number];
  smallBlind: number;
  bigBlind: number;
  seed: number;
}

export interface LegalActions {
  canFold: boolean;
  callAmount: number;
  canRaise: boolean;
  minRaiseTo: number;
  maxRaiseTo: number;
}

export interface LogEntry {
  seat: Seat;
  street: Street;
  action: Action;
  toCall: number;
  potBefore: number;       // pot + both committed at decision time
  committedBefore: number; // acting seat's committed chips at decision time
  stackBehind: number;     // acting seat's stack behind at decision time
  canRaise: boolean;       // whether raising was legal at decision time
  maxRaiseTo: number;      // legal max raise-to at decision time (0 if canRaise is false)
  board: Card[];
}

export interface HandResult {
  winner: Seat | null; // null = split
  potAwarded: number;
  showdown: boolean;
  stacks: [number, number];
}

export interface HandState {
  cfg: HandConfig;
  holes: [[Card, Card], [Card, Card]];
  fullBoard: Card[]; // predealt 5; hidden until revealed
  board: Card[];     // visible portion
  street: Street;
  stacks: [number, number];    // behind
  committed: [number, number]; // this street
  pot: number;                 // from completed streets
  toAct: Seat;
  lastRaiseSize: number;
  actionsThisStreet: number;
  result: HandResult | null;
  log: LogEntry[];
}

const other = (s: Seat): Seat => (s === 0 ? 1 : 0);

export function startHand(cfg: HandConfig): HandState {
  const deck = makeDeck();
  shuffle(deck, mulberry32(cfg.seed));
  const btn = cfg.buttonSeat, bb = other(btn);
  const holes: [[Card, Card], [Card, Card]] = [[0, 0], [0, 0]] as never;
  holes[btn] = [deck[0], deck[2]];
  holes[bb] = [deck[1], deck[3]];
  const fullBoard = deck.slice(4, 9);
  const stacks: [number, number] = [...cfg.stacks];
  const committed: [number, number] = [0, 0];
  const sbPost = Math.min(cfg.smallBlind, stacks[btn]);
  const bbPost = Math.min(cfg.bigBlind, stacks[bb]);
  committed[btn] = sbPost; stacks[btn] -= sbPost;
  committed[bb] = bbPost; stacks[bb] -= bbPost;
  return {
    cfg, holes, fullBoard, board: [], street: 'preflop',
    stacks, committed, pot: 0, toAct: btn,
    lastRaiseSize: cfg.bigBlind, actionsThisStreet: 0, result: null, log: [],
  };
}

export function legalActions(s: HandState): LegalActions {
  if (s.result) throw new Error('hand is over');
  const me = s.toAct, opp = other(me);
  const callAmount = Math.min(s.committed[opp] - s.committed[me], s.stacks[me]);
  const oppAllIn = s.stacks[opp] === 0;
  const effectiveMax = Math.min(s.committed[me] + s.stacks[me], s.committed[opp] + s.stacks[opp]);
  const minRaiseTo = Math.min(
    s.committed[opp] + Math.max(s.lastRaiseSize, s.cfg.bigBlind),
    effectiveMax,
  );
  const canRaise = !oppAllIn && effectiveMax > s.committed[opp] && s.stacks[me] > callAmount;
  return {
    canFold: callAmount > 0,
    callAmount,
    canRaise,
    minRaiseTo: canRaise ? minRaiseTo : 0,
    maxRaiseTo: canRaise ? effectiveMax : 0,
  };
}

function clone(s: HandState): HandState {
  return {
    ...s,
    stacks: [...s.stacks],
    committed: [...s.committed],
    board: [...s.board],
    log: [...s.log],
  };
}

function finish(s: HandState, winner: Seat | null, showdown: boolean): void {
  const pot = s.pot + s.committed[0] + s.committed[1];
  const stacks: [number, number] = [...s.stacks];
  if (winner === null) {
    const half = Math.floor(pot / 2);
    stacks[s.cfg.buttonSeat] += pot - half; // odd chip to the button
    stacks[other(s.cfg.buttonSeat)] += half;
  } else {
    stacks[winner] += pot;
  }
  s.result = { winner, potAwarded: pot, showdown, stacks };
  s.stacks = stacks;
  s.pot = 0;
  s.committed = [0, 0];
}

function showdown(s: HandState): void {
  s.board = s.fullBoard.slice(); // reveal everything
  const score0 = evaluate7([...s.holes[0], ...s.board]);
  const score1 = evaluate7([...s.holes[1], ...s.board]);
  finish(s, score0 === score1 ? null : score0 > score1 ? 0 : 1, true);
}

const BOARD_BY_STREET: Record<Street, number> = { preflop: 0, flop: 3, turn: 4, river: 5 };
const NEXT_STREET: Partial<Record<Street, Street>> = { preflop: 'flop', flop: 'turn', turn: 'river' };

function closeStreet(s: HandState): void {
  s.pot += s.committed[0] + s.committed[1];
  s.committed = [0, 0];
  if (s.stacks[0] === 0 || s.stacks[1] === 0 || s.street === 'river') {
    showdown(s);
    return;
  }
  const next = NEXT_STREET[s.street]!;
  s.street = next;
  s.board = s.fullBoard.slice(0, BOARD_BY_STREET[next]);
  s.toAct = other(s.cfg.buttonSeat);
  s.lastRaiseSize = 0;
  s.actionsThisStreet = 0;
}

export function applyAction(prev: HandState, a: Action): HandState {
  const la = legalActions(prev); // throws if hand is over
  const s = clone(prev);
  const me = s.toAct, opp = other(me);
  s.log.push({
    seat: me, street: s.street, action: a,
    toCall: la.callAmount,
    potBefore: s.pot + s.committed[0] + s.committed[1],
    committedBefore: s.committed[me],
    stackBehind: s.stacks[me],
    canRaise: la.canRaise,
    maxRaiseTo: la.maxRaiseTo,
    board: [...s.board],
  });

  if (a.type === 'fold') {
    finish(s, opp, false);
    return s;
  }

  if (a.type === 'call') {
    s.stacks[me] -= la.callAmount;
    s.committed[me] += la.callAmount;
    s.actionsThisStreet++;
    const settled = s.committed[me] === s.committed[opp] || s.stacks[me] === 0;
    if (settled && (s.actionsThisStreet >= 2 || s.stacks[me] === 0 || s.stacks[opp] === 0)) {
      closeStreet(s);
    } else if (settled) {
      s.toAct = opp; // e.g. button limp → BB option
    } else {
      s.toAct = opp;
    }
    return s;
  }

  // raise
  if (!la.canRaise) throw new Error('raise not allowed');
  if (a.to < la.minRaiseTo || a.to > la.maxRaiseTo) {
    throw new Error(`raise to ${a.to} outside [${la.minRaiseTo}, ${la.maxRaiseTo}]`);
  }
  const added = a.to - s.committed[me];
  if (added > s.stacks[me]) throw new Error('raise exceeds stack');
  s.lastRaiseSize = a.to - s.committed[opp];
  s.stacks[me] -= added;
  s.committed[me] = a.to;
  s.actionsThisStreet++;
  s.toAct = opp;
  return s;
}
