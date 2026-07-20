import { describe, expect, it } from 'vitest';
import { mulberry32 } from '../engine/cards';
import type { HandState } from '../engine/hand';
import { applyAction, startHand } from '../engine/hand';
import { PERSONAS, personaAction } from '../personas/persona';
import type { PersonaKey } from '../ui/gameMachine';
import { leakKey, liveTags } from './tags';
import type { DrillDeal } from './drills';
import { generateDrill } from './drills';

// Replay a drill deal exactly as useGame would: villain rng from the same
// seed derivation, hero playing the script in order. Returns the state at
// the moment the script runs out (the drill decision point).
function replayToDecision(deal: DrillDeal, personaKey: PersonaKey): HandState {
  const rng = mulberry32((deal.cfg.seed ^ 0x5bd1e995) >>> 0);
  let s = startHand(deal.cfg);
  let i = 0;
  while (!s.result) {
    if (s.toAct === 0) {
      if (i >= deal.heroScript.length) return s;
      s = applyAction(s, deal.heroScript[i++]);
    } else {
      s = applyAction(s, personaAction(s, 1, PERSONAS[personaKey], rng));
    }
  }
  throw new Error('hand ended before the drill decision point');
}

describe('generateDrill', () => {
  it('finds a preflop drill spot and the replay lands on it', () => {
    const key = 'preflop|medium-bet|weak';
    const deal = generateDrill(key, 'balanced', 1);
    expect(deal).not.toBeNull();
    const s = replayToDecision(deal!, 'balanced');
    expect(s.toAct).toBe(0);
    expect(leakKey(liveTags(s, 0, 'balanced'))).toBe(key);
  });

  it('finds a postflop drill spot and the replay lands on it', () => {
    const key = 'flop|unopened|air';
    const deal = generateDrill(key, 'station', 7);
    expect(deal).not.toBeNull();
    const s = replayToDecision(deal!, 'station');
    expect(leakKey(liveTags(s, 0, 'station'))).toBe(key);
  });

  it('returns null when no seed matches within the budget', () => {
    expect(generateDrill('flop|unopened|air', 'balanced', 1, 0)).toBeNull();
  });
});
