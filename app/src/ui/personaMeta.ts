import { PERSONAS } from '../personas/persona';
import type { PersonaKey } from './gameMachine';
import type { Suit } from './SuitPip';

export interface PersonaMeta {
  key: PersonaKey;
  name: string;
  crest: Suit;
  blurb: string;
  traits: { label: string; value: number }[]; // values in [0, 1]
}

export const PERSONA_KEYS: PersonaKey[] = ['nit', 'maniac', 'station', 'balanced'];

const CRESTS: Record<PersonaKey, Suit> = {
  nit: 'spade',
  maniac: 'heart',
  station: 'club',
  balanced: 'diamond',
};

const BLURBS: Record<PersonaKey, string> = {
  nit: 'Plays only premium hands and folds under pressure. Steal his blinds relentlessly — but when he raises, believe him.',
  maniac:
    'Raises with almost anything and never slows down. Tighten up, call down with real hands, and let him hang himself.',
  station:
    "Calls everything, folds nothing, rarely raises. Value-bet thin and never bluff — he's paying you off.",
  balanced:
    'Solid, aggressive in the right spots, hard to exploit. Play fundamentally sound poker to beat him.',
};

export function personaMeta(key: PersonaKey): PersonaMeta {
  const p = PERSONAS[key];
  return {
    key,
    name: p.name,
    crest: CRESTS[key],
    blurb: BLURBS[key],
    traits: [
      { label: 'Looseness', value: p.preflopRange },
      { label: 'Aggression', value: p.aggression },
      { label: 'Stubbornness', value: 1 - p.foldToRaise },
    ],
  };
}
