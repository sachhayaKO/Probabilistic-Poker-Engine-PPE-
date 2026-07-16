import { describe, it, expect } from 'vitest';
import type { HandConfig, HandState, Action } from './hand';
import { startHand, legalActions, applyAction } from './hand';

const cfg = (over: Partial<HandConfig> = {}): HandConfig => ({
  buttonSeat: 0, stacks: [1000, 1000], smallBlind: 5, bigBlind: 10, seed: 7, ...over,
});

const act = (s: HandState, ...actions: Action[]): HandState => actions.reduce(applyAction, s);

describe('startHand', () => {
  it('posts blinds and gives the button first action preflop', () => {
    const s = startHand(cfg());
    expect(s.committed).toEqual([5, 10]); // seat0 = button = SB
    expect(s.stacks).toEqual([995, 990]);
    expect(s.toAct).toBe(0);
    expect(s.street).toBe('preflop');
    expect(s.board).toEqual([]);
  });

  it('deals unique cards', () => {
    const s = startHand(cfg());
    const all = [...s.holes[0], ...s.holes[1], ...s.fullBoard];
    expect(new Set(all).size).toBe(9);
  });
});

describe('betting flow', () => {
  it('gives the big blind an option after a limp', () => {
    const s = act(startHand(cfg()), { type: 'call' }); // button limps
    expect(s.street).toBe('preflop');
    expect(s.toAct).toBe(1); // BB still to act
    const s2 = applyAction(s, { type: 'call' }); // BB checks
    expect(s2.street).toBe('flop');
    expect(s2.board.length).toBe(3);
    expect(s2.pot).toBe(20);
  });

  it('non-button acts first postflop and check-check advances the street', () => {
    const s = act(startHand(cfg()), { type: 'call' }, { type: 'call' });
    expect(s.toAct).toBe(1); // non-button first postflop
    const s2 = act(s, { type: 'call' }, { type: 'call' }); // check, check
    expect(s2.street).toBe('turn');
    expect(s2.board.length).toBe(4);
  });

  it('fold ends the hand and awards the pot', () => {
    const s = act(startHand(cfg()), { type: 'raise', to: 30 }, { type: 'fold' });
    expect(s.result).not.toBeNull();
    expect(s.result!.winner).toBe(0);
    expect(s.result!.stacks).toEqual([1010, 990]);
  });

  it('enforces min-raise sizing', () => {
    const s = applyAction(startHand(cfg()), { type: 'raise', to: 30 }); // raise of 20 over BB
    const la = legalActions(s);
    expect(la.callAmount).toBe(20);
    expect(la.minRaiseTo).toBe(50); // 30 + last raise size 20
    expect(() => applyAction(s, { type: 'raise', to: 40 })).toThrow();
  });

  it('caps raises at the effective stack', () => {
    const s = startHand(cfg({ stacks: [1000, 200] }));
    const la = legalActions(s);
    expect(la.maxRaiseTo).toBe(200); // villain can only match 200 total
  });

  it('runs out the board and shows down on all-in call', () => {
    const s = act(startHand(cfg()), { type: 'raise', to: 1000 }, { type: 'call' });
    expect(s.result).not.toBeNull();
    expect(s.result!.showdown).toBe(true);
    expect(s.board.length).toBe(5);
    const [a, b] = s.result!.stacks;
    expect(a + b).toBe(2000);
  });

  it('splits ties', () => {
    // find a seed that produces a chopped board by scanning; boards where both play the board exist
    for (let seed = 0; seed < 500; seed++) {
      const s = act(startHand(cfg({ seed })), { type: 'raise', to: 1000 }, { type: 'call' });
      if (s.result!.winner === null) {
        expect(s.result!.stacks).toEqual([1000, 1000]);
        return;
      }
    }
    throw new Error('no split pot found in 500 seeds — suspicious');
  });

  it('rejects acting on a finished hand', () => {
    const s = act(startHand(cfg()), { type: 'fold' });
    expect(() => applyAction(s, { type: 'call' })).toThrow();
  });

  it('logs every action with decision context', () => {
    const s = act(startHand(cfg()), { type: 'raise', to: 30 }, { type: 'call' });
    expect(s.log.length).toBe(2);
    expect(s.log[0]).toMatchObject({ seat: 0, street: 'preflop', toCall: 5, potBefore: 15, committedBefore: 5 });
    expect(s.log[1]).toMatchObject({ seat: 1, street: 'preflop', toCall: 20, potBefore: 40, committedBefore: 10 });
  });

  it('log entries record stackBehind, canRaise, maxRaiseTo at decision time', () => {
    let s = startHand({ buttonSeat: 0, stacks: [1000, 1000], smallBlind: 5, bigBlind: 10, seed: 42 });
    s = applyAction(s, { type: 'raise', to: 30 });
    expect(s.log[0]).toMatchObject({
      stackBehind: 995, // button posted SB 5
      canRaise: true,
      maxRaiseTo: 1000,
    });
    s = applyAction(s, { type: 'call' });
    expect(s.log[1]).toMatchObject({ stackBehind: 990, canRaise: true });
  });

  it('log entry facing an all-in has canRaise false and maxRaiseTo 0', () => {
    let s = startHand({ buttonSeat: 0, stacks: [1000, 1000], smallBlind: 5, bigBlind: 10, seed: 7 });
    s = applyAction(s, { type: 'raise', to: 1000 }); // button open-shoves
    s = applyAction(s, { type: 'call' });
    expect(s.log[1]).toMatchObject({ canRaise: false, maxRaiseTo: 0, stackBehind: 990 });
  });
});
