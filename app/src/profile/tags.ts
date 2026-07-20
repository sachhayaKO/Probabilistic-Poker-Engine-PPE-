import type { Card } from '../engine/cards';
import { rankOf, suitOf } from '../engine/cards';
import type { HandState, LogEntry, Seat, Street } from '../engine/hand';
import { legalActions } from '../engine/hand';
import { chenScore } from '../personas/ranges';
import type { PersonaKey } from '../ui/gameMachine';

export type Facing = 'unopened' | 'small-bet' | 'medium-bet' | 'large-bet' | 'all-in';
export type HandClass =
  | 'premium' | 'strong' | 'playable' | 'weak' // preflop (Chen bands)
  | 'monster' | 'top-pair' | 'weak-pair' | 'strong-draw' | 'air'; // postflop

export interface DecisionTags {
  street: Street;
  facing: Facing;
  handClass: HandClass;
  persona: PersonaKey;
}

// Thresholds are on toCall / potBefore, where potBefore already includes the
// bet being faced: a 1/3-pot bet ≈ 0.25, half-pot ≈ 0.33, pot-sized ≈ 0.5.
function facingFrom(toCall: number, potBefore: number, canRaise: boolean): Facing {
  if (toCall === 0) return 'unopened';
  if (!canRaise) return 'all-in';
  const r = toCall / potBefore;
  if (r <= 0.3) return 'small-bet';
  if (r <= 0.45) return 'medium-bet';
  return 'large-bet';
}

export function preflopClass(hole: [Card, Card]): HandClass {
  const s = chenScore(hole[0], hole[1]);
  if (s >= 12) return 'premium';
  if (s >= 9) return 'strong';
  if (s >= 6) return 'playable';
  return 'weak';
}

export function postflopClass(hole: [Card, Card], board: Card[]): HandClass {
  const holeRanks = [rankOf(hole[0]), rankOf(hole[1])];
  const boardRanks = board.map(rankOf);
  const topBoard = Math.max(...boardRanks);
  const pocketPair = holeRanks[0] === holeRanks[1];

  const all = [...hole, ...board];
  const suitCounts = [0, 0, 0, 0];
  for (const card of all) suitCounts[suitOf(card)]++;
  const holeSuits = new Set(hole.map(suitOf));
  const madeFlush = suitCounts.some((n, suit) => n >= 5 && holeSuits.has(suit));

  // Rank runs, with the ace also playing low (rank -1) for wheels.
  const present = new Set<number>(all.map(rankOf));
  if (present.has(12)) present.add(-1);
  const holeSet = new Set<number>(holeRanks);
  if (holeSet.has(12)) holeSet.add(-1);
  const runHit = (len: number): boolean => {
    for (let top = 12; top - len + 1 >= -1; top--) {
      let ok = true;
      let usesHole = false;
      for (let r = top; r > top - len; r--) {
        if (!present.has(r)) {
          ok = false;
          break;
        }
        if (holeSet.has(r)) usesHole = true;
      }
      if (ok && usesHole) return true;
    }
    return false;
  };

  const pairedHoleRanks = holeRanks.filter((r) => boardRanks.includes(r));
  const set = pocketPair && boardRanks.includes(holeRanks[0]);
  const twoPair = !pocketPair && pairedHoleRanks.length === 2;
  if (madeFlush || runHit(5) || set || twoPair) return 'monster';

  const overpair = pocketPair && holeRanks[0] > topBoard;
  if (overpair || pairedHoleRanks.includes(topBoard)) return 'top-pair';
  if (pocketPair || pairedHoleRanks.length > 0) return 'weak-pair';

  if (board.length < 5) {
    const flushDraw = suitCounts.some((n, suit) => n === 4 && holeSuits.has(suit));
    if (flushDraw || runHit(4)) return 'strong-draw';
  }
  return 'air';
}

export function tagsFor(entry: LogEntry, hole: [Card, Card], persona: PersonaKey): DecisionTags {
  return {
    street: entry.street,
    facing: facingFrom(entry.toCall, entry.potBefore, entry.canRaise),
    handClass:
      entry.street === 'preflop' ? preflopClass(hole) : postflopClass(hole, entry.board),
    persona,
  };
}

// Tags for a live decision point, before the action is taken (drill generation).
export function liveTags(state: HandState, heroSeat: Seat, persona: PersonaKey): DecisionTags {
  const la = legalActions(state);
  const potBefore = state.pot + state.committed[0] + state.committed[1];
  return {
    street: state.street,
    facing: facingFrom(la.callAmount, potBefore, la.canRaise),
    handClass:
      state.street === 'preflop'
        ? preflopClass(state.holes[heroSeat])
        : postflopClass(state.holes[heroSeat], state.board),
    persona,
  };
}

export const leakKey = (t: DecisionTags): string => `${t.street}|${t.facing}|${t.handClass}`;

const FACING_TEXT: Record<Facing, string> = {
  unopened: 'first in',
  'small-bet': 'facing a small bet',
  'medium-bet': 'facing a medium bet',
  'large-bet': 'facing a large bet',
  'all-in': 'facing an all-in',
};

const CLASS_TEXT: Record<HandClass, string> = {
  premium: 'a premium hand',
  strong: 'a strong hand',
  playable: 'a playable hand',
  weak: 'a weak hand',
  monster: 'a monster',
  'top-pair': 'top pair or better',
  'weak-pair': 'a weak pair',
  'strong-draw': 'a strong draw',
  air: 'air',
};

export function leakLabel(key: string): string {
  const [street, facing, handClass] = key.split('|') as [Street, Facing, HandClass];
  const where = street === 'preflop' ? 'Preflop' : `On the ${street}`;
  return `${where}, ${FACING_TEXT[facing]} with ${CLASS_TEXT[handClass]}`;
}
