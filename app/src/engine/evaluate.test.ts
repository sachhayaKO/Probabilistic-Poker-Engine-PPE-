import { describe, it, expect } from 'vitest';
import { cardFromString } from './cards';
import { evaluate7, handCategory } from './evaluate';

const h = (s: string) => s.split(' ').map(cardFromString);

describe('evaluate7', () => {
  it('ranks categories correctly', () => {
    const straightFlush = evaluate7(h('9s 8s 7s 6s 5s 2c 3d'));
    const quads = evaluate7(h('As Ah Ad Ac Kd 2c 3d'));
    const fullHouse = evaluate7(h('As Ah Ad Kc Kd 2c 3d'));
    const flush = evaluate7(h('As Qs 9s 6s 3s 2c 3d'));
    const straight = evaluate7(h('9s 8d 7c 6h 5s 2c As'));
    const trips = evaluate7(h('As Ah Ad Kc Qd 2c 3d'));
    const twoPair = evaluate7(h('As Ah Kd Kc Qd 2c 3d'));
    const pair = evaluate7(h('As Ah Kd Qc Jd 2c 3d'));
    const high = evaluate7(h('As Kh Qd Jc 9d 2c 3d'));
    const ordered = [straightFlush, quads, fullHouse, flush, straight, trips, twoPair, pair, high];
    for (let i = 0; i < ordered.length - 1; i++) expect(ordered[i]).toBeGreaterThan(ordered[i + 1]);
    expect(handCategory(straightFlush)).toBe(8);
    expect(handCategory(high)).toBe(0);
  });

  it('handles the wheel (A-5 straight) as five-high', () => {
    const wheel = evaluate7(h('As 2d 3c 4h 5s Kc Qd'));
    const sixHigh = evaluate7(h('2d 3c 4h 5s 6s Kc Qd'));
    expect(handCategory(wheel)).toBe(4);
    expect(sixHigh).toBeGreaterThan(wheel);
  });

  it('breaks ties with kickers', () => {
    const aceKicker = evaluate7(h('Ks Kh Ad 9c 7d 5c 2d'));
    const queenKicker = evaluate7(h('Ks Kh Qd 9c 7d 5c 2d'));
    expect(aceKicker).toBeGreaterThan(queenKicker);
  });

  it('recognizes when the board plays for both (tie)', () => {
    const boardStr = 'As Ks Qs Js Ts';
    const p1 = evaluate7(h(`${boardStr} 2c 3d`));
    const p2 = evaluate7(h(`${boardStr} 7h 8h`));
    expect(p1).toBe(p2);
  });

  it('picks the best five from seven (two-pair uses top two pairs)', () => {
    const threePairs = evaluate7(h('As Ah Kd Kc 2s 2d Qh'));
    const expected = evaluate7(h('As Ah Kd Kc Qh 9s 2d'));
    expect(handCategory(threePairs)).toBe(2);
    expect(threePairs).toBe(expected);
  });
});
