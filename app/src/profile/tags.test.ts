import { describe, expect, it } from 'vitest';
import { cardFromString as c } from '../engine/cards';
import { startHand } from '../engine/hand';
import { leakKey, leakLabel, liveTags, postflopClass, preflopClass, tagsFor } from './tags';

describe('preflopClass', () => {
  it('bands hole cards by Chen score', () => {
    expect(preflopClass([c('As'), c('Ah')])).toBe('premium');
    expect(preflopClass([c('Ks'), c('Qs')])).toBe('strong');
    expect(preflopClass([c('9s'), c('8s')])).toBe('playable');
    expect(preflopClass([c('7c'), c('2d')])).toBe('weak');
  });
});

describe('postflopClass', () => {
  it('classifies made hands and draws', () => {
    // two pair using both hole cards
    expect(postflopClass([c('Ac'), c('7d')], [c('Ah'), c('7s'), c('2c')])).toBe('monster');
    // made flush using a hole card
    expect(postflopClass([c('Ah'), c('4h')], [c('Kh'), c('9h'), c('2h')])).toBe('monster');
    // top pair
    expect(postflopClass([c('As'), c('Kd')], [c('Ac'), c('7h'), c('2s')])).toBe('top-pair');
    // overpair counts as top-pair tier
    expect(postflopClass([c('Qs'), c('Qd')], [c('Jc'), c('7h'), c('2s')])).toBe('top-pair');
    // underpair to the board
    expect(postflopClass([c('5c'), c('5d')], [c('Ac'), c('7h'), c('2s')])).toBe('weak-pair');
    // flush draw
    expect(postflopClass([c('9h'), c('8h')], [c('Kh'), c('6h'), c('2c')])).toBe('strong-draw');
    // open-ended straight draw
    expect(postflopClass([c('Qs'), c('Jd')], [c('Tc'), c('9h'), c('2s')])).toBe('strong-draw');
    // air
    expect(postflopClass([c('3c'), c('2d')], [c('Kc'), c('Qh'), c('8s')])).toBe('air');
    // no draws counted on the river
    expect(postflopClass([c('9h'), c('8h')], [c('Kh'), c('6h'), c('2c'), c('Js'), c('3d')])).toBe(
      'air',
    );
  });
});

describe('tagsFor / liveTags / leakKey', () => {
  it('derives facing from the log entry pot math', () => {
    const entry = {
      seat: 0 as const,
      street: 'flop' as const,
      action: { type: 'call' as const },
      toCall: 60,
      potBefore: 80,
      committedBefore: 0,
      stackBehind: 900,
      canRaise: true,
      maxRaiseTo: 960,
      board: [c('Kc'), c('Qh'), c('8s')],
    };
    const tags = tagsFor(entry as never, [c('3c'), c('2d')], 'maniac');
    expect(tags).toEqual({
      street: 'flop',
      facing: 'large-bet',
      handClass: 'air',
      persona: 'maniac',
    });
    expect(leakKey(tags)).toBe('flop|large-bet|air');
  });

  it('tags an all-in when raising is illegal and unopened when nothing to call', () => {
    const base = {
      seat: 0 as const,
      street: 'turn' as const,
      action: { type: 'call' as const },
      committedBefore: 0,
      stackBehind: 500,
      board: [c('Kc'), c('Qh'), c('8s'), c('2d')],
    };
    const allIn = tagsFor(
      { ...base, toCall: 500, potBefore: 1200, canRaise: false, maxRaiseTo: 0 } as never,
      [c('Ac'), c('Kd')],
      'nit',
    );
    expect(allIn.facing).toBe('all-in');
    const unopened = tagsFor(
      { ...base, toCall: 0, potBefore: 200, canRaise: true, maxRaiseTo: 700 } as never,
      [c('Ac'), c('Kd')],
      'nit',
    );
    expect(unopened.facing).toBe('unopened');
  });

  it('liveTags matches the button preflop first decision', () => {
    const state = startHand({ buttonSeat: 0, stacks: [10000, 10000], smallBlind: 50, bigBlind: 100, seed: 4 });
    const tags = liveTags(state, 0, 'balanced');
    // Button to act: callAmount 50 into potBefore 150 => medium-bet band.
    expect(tags.street).toBe('preflop');
    expect(tags.facing).toBe('medium-bet');
    expect(tags.persona).toBe('balanced');
  });
});

describe('leakLabel', () => {
  it('renders plain English', () => {
    expect(leakLabel('flop|large-bet|air')).toBe(
      'On the flop, facing a large bet with air',
    );
    expect(leakLabel('preflop|medium-bet|weak')).toBe(
      'Preflop, facing a medium bet with a weak hand',
    );
  });
});
