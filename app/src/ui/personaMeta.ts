import type { Suit } from './SuitPip';
import { PERSONAS } from '../personas/persona';

export type PersonaMeta = {
  name: string;
  crest: Suit;
  traits: { label: string; value: number }[];
  blurb: string;
};

export const PERSONA_KEYS = ['nit', 'maniac', 'station', 'balanced'] as const;
export type PersonaKey = (typeof PERSONA_KEYS)[number];

const CRESTS: Record<PersonaKey, Suit> = {
  nit: 'spade',
  maniac: 'heart',
  station: 'club',
  balanced: 'diamond',
};

const BLURBS: Record<PersonaKey, string> = {
  nit: 'Tight, cautious, folds too much',
  maniac: 'Raises everything, relentless',
  station: 'Never folds, never raises',
  balanced: 'Solid, hard to exploit',
};

export function personaMeta(key: PersonaKey): PersonaMeta {
  const params = PERSONAS[key];
  return {
    name: params.name,
    crest: CRESTS[key],
    traits: [
      { label: 'Looseness', value: params.preflopRange },
      { label: 'Aggression', value: params.aggression },
      { label: 'Stubbornness', value: 1 - params.foldToRaise },
    ],
    blurb: BLURBS[key],
  };
}
