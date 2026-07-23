import { describe, expect, it } from 'vitest';
import { PERSONAS } from '../personas/persona';
import { PERSONA_KEYS, personaMeta } from './personaMeta';

describe('personaMeta', () => {
  it('covers all four personas with engine-matching names', () => {
    expect(PERSONA_KEYS).toEqual(['nit', 'maniac', 'station', 'balanced']);
    for (const key of PERSONA_KEYS) {
      expect(personaMeta(key).name).toBe(PERSONAS[key].name);
    }
  });

  it('assigns the specced crests', () => {
    expect(personaMeta('nit').crest).toBe('spade');
    expect(personaMeta('maniac').crest).toBe('heart');
    expect(personaMeta('station').crest).toBe('club');
    expect(personaMeta('balanced').crest).toBe('diamond');
  });

  it('derives traits from engine params in [0,1]', () => {
    for (const key of PERSONA_KEYS) {
      const m = personaMeta(key);
      expect(m.traits.map((t) => t.label)).toEqual(['Looseness', 'Aggression', 'Stubbornness']);
      for (const t of m.traits) {
        expect(t.value).toBeGreaterThanOrEqual(0);
        expect(t.value).toBeLessThanOrEqual(1);
      }
      expect(m.traits[0].value).toBe(PERSONAS[key].preflopRange);
      expect(m.traits[1].value).toBe(PERSONAS[key].aggression);
      expect(m.traits[2].value).toBeCloseTo(1 - PERSONAS[key].foldToRaise);
      expect(m.blurb.length).toBeGreaterThan(20);
    }
  });
});
