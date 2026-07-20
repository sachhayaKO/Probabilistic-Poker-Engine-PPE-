import { mulberry32 } from '../engine/cards';
import type { Action, HandConfig, Seat } from '../engine/hand';
import type { HandState } from '../engine/hand';
import { applyAction, legalActions, startHand } from '../engine/hand';
import { PERSONAS, personaAction } from '../personas/persona';
import type { PersonaKey } from '../ui/gameMachine';
import { BIG_BLIND, HERO_SEAT, SMALL_BLIND, START_STACK, VILLAIN_SEAT } from '../ui/gameMachine';
import { leakKey, liveTags } from './tags';

export interface DrillDeal {
  cfg: HandConfig;
  heroScript: Action[]; // hero actions to auto-play before the live decision
}

export const DRILL_MAX_TRIES = 400;

// Scripted hero on the way to the target spot: open the button first-in so
// raise-war spots stay reachable, otherwise check/call toward later streets.
function autopilot(s: HandState): Action {
  const la = legalActions(s);
  if (s.street === 'preflop' && s.log.length === 0 && la.canRaise) {
    return { type: 'raise', to: Math.max(la.minRaiseTo, Math.min(3 * BIG_BLIND, la.maxRaiseTo)) };
  }
  return { type: 'call' };
}

// Seed-search for a deal whose natural play (persona villain + scripted hero)
// reaches a hero decision matching the leak. The villain rng derivation must
// stay identical to useGame's so the live drill replays this exact line.
export function generateDrill(
  key: string,
  personaKey: PersonaKey,
  baseSeed: number,
  maxTries: number = DRILL_MAX_TRIES,
): DrillDeal | null {
  for (let t = 0; t < maxTries; t++) {
    const seed = ((baseSeed >>> 0) + t * 0x9e3779b9) >>> 0;
    const cfg: HandConfig = {
      buttonSeat: (t % 2) as Seat,
      stacks: [START_STACK, START_STACK],
      smallBlind: SMALL_BLIND,
      bigBlind: BIG_BLIND,
      seed,
    };
    const rng = mulberry32((seed ^ 0x5bd1e995) >>> 0);
    let s = startHand(cfg);
    const script: Action[] = [];
    let safety = 40;
    while (!s.result && safety-- > 0) {
      if (s.toAct === HERO_SEAT) {
        if (leakKey(liveTags(s, HERO_SEAT, personaKey)) === key) {
          return { cfg, heroScript: script };
        }
        const a = autopilot(s);
        script.push(a);
        s = applyAction(s, a);
      } else {
        s = applyAction(s, personaAction(s, VILLAIN_SEAT, PERSONAS[personaKey], rng));
      }
    }
  }
  return null;
}
