# PPE Rebuild Plan 1: Core Engine & Grading Brain

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the headless core of the poker trainer — game rules, hand evaluation, Monte Carlo equity, personality bots, and the decision-grading brain — as pure, fully-tested TypeScript modules.

**Architecture:** A new Vite + React + TypeScript app in `app/` at the repo root (the old Python/React stack stays untouched; it is retired, not modified). This plan builds only `app/src/engine/`, `app/src/personas/`, and `app/src/grading/` — pure functions with no DOM, no React, no dependencies. Plan 2 (table UI + review) and Plan 3 (profile + coach) consume these modules.

**Tech Stack:** Vite (react-ts template), TypeScript strict, Vitest for tests. Zero runtime dependencies in engine/personas/grading.

**Spec:** `docs/superpowers/specs/2026-07-13-ppe-rebuild-design.md`

## Global Constraints

- All new code lives under `app/`. Do not modify `backend/`, `frontend/`, or any pre-existing top-level files.
- `engine/`, `personas/`, `grading/` are pure TypeScript: no imports from React, DOM, or any npm package.
- All randomness flows through an injected `rng: () => number` (returns [0,1)); never call `Math.random()` in these modules. Deterministic seeds make every test reproducible.
- TypeScript `strict: true` (Vite template default — leave it on).
- Test runner is Vitest; all test commands run from the `app/` directory.
- Commit after every task (steps say when). Commit messages end with:
  `Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>`

---

### Task 1: Scaffold the app

**Files:**
- Create: `app/` (Vite react-ts template), `app/src/engine/smoke.test.ts`
- Modify: `app/package.json` (add test script)

**Interfaces:**
- Consumes: nothing.
- Produces: a working `npm test` (Vitest) inside `app/`. All later tasks put source in `app/src/<module>/` and colocate tests as `<file>.test.ts`.

- [ ] **Step 1: Scaffold and install**

```bash
cd /Users/kimet/Documents/GitHub/Probabilistic-Poker-Engine-PPE-
npm create vite@latest app -- --template react-ts
cd app
npm install
npm install -D vitest
```

- [ ] **Step 2: Add the test script**

In `app/package.json`, add to `"scripts"`:

```json
"test": "vitest run"
```

- [ ] **Step 3: Write a smoke test**

Create `app/src/engine/smoke.test.ts`:

```ts
import { describe, it, expect } from 'vitest';

describe('toolchain', () => {
  it('runs tests', () => {
    expect(1 + 1).toBe(2);
  });
});
```

- [ ] **Step 4: Run it**

Run (from `app/`): `npm test`
Expected: 1 passed.

- [ ] **Step 5: Commit**

```bash
git add app
git commit -m "chore(app): scaffold Vite react-ts app with Vitest

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 2: Cards, deck, seeded RNG

**Files:**
- Create: `app/src/engine/cards.ts`
- Test: `app/src/engine/cards.test.ts`
- Delete: `app/src/engine/smoke.test.ts` (superseded)

**Interfaces:**
- Consumes: nothing.
- Produces:
  - `type Card = number` — 0..51, encoded `rank * 4 + suit`; rank 0 = deuce … 12 = ace; suit 0=c,1=d,2=h,3=s.
  - `rankOf(c: Card): number`, `suitOf(c: Card): number`
  - `cardFromString(s: string): Card` (e.g. `'As'`, `'Td'`), `cardToString(c: Card): string`
  - `makeDeck(excluded?: Card[]): Card[]`
  - `shuffle(deck: Card[], rng: () => number): void` (in-place Fisher–Yates)
  - `mulberry32(seed: number): () => number` — the seeded RNG used everywhere.

- [ ] **Step 1: Write the failing tests**

Create `app/src/engine/cards.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { cardFromString, cardToString, makeDeck, mulberry32, rankOf, shuffle, suitOf } from './cards';

describe('cards', () => {
  it('encodes and decodes card strings', () => {
    expect(cardFromString('2c')).toBe(0);
    expect(cardFromString('As')).toBe(51);
    expect(rankOf(cardFromString('Td'))).toBe(8);
    expect(suitOf(cardFromString('Td'))).toBe(1);
    expect(cardToString(cardFromString('Kh'))).toBe('Kh');
  });

  it('rejects bad card strings', () => {
    expect(() => cardFromString('Xx')).toThrow();
  });

  it('makes a 52-card deck of unique cards', () => {
    const deck = makeDeck();
    expect(deck.length).toBe(52);
    expect(new Set(deck).size).toBe(52);
  });

  it('excludes dead cards', () => {
    const dead = [cardFromString('As'), cardFromString('Ah')];
    const deck = makeDeck(dead);
    expect(deck.length).toBe(50);
    expect(deck).not.toContain(dead[0]);
  });

  it('shuffles deterministically for a given seed', () => {
    const a = makeDeck(); shuffle(a, mulberry32(42));
    const b = makeDeck(); shuffle(b, mulberry32(42));
    const c = makeDeck(); shuffle(c, mulberry32(43));
    expect(a).toEqual(b);
    expect(a).not.toEqual(c);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test`
Expected: FAIL — cannot resolve `./cards`.

- [ ] **Step 3: Implement**

Create `app/src/engine/cards.ts`:

```ts
export type Card = number; // 0..51 = rank * 4 + suit; rank 0 = deuce .. 12 = ace

export const RANKS = '23456789TJQKA';
export const SUITS = 'cdhs';

export const rankOf = (c: Card): number => Math.floor(c / 4);
export const suitOf = (c: Card): number => c % 4;

export function cardFromString(s: string): Card {
  const r = RANKS.indexOf(s[0]);
  const su = SUITS.indexOf(s[1]);
  if (s.length !== 2 || r < 0 || su < 0) throw new Error(`bad card string: ${s}`);
  return r * 4 + su;
}

export const cardToString = (c: Card): string => RANKS[rankOf(c)] + SUITS[suitOf(c)];

export function makeDeck(excluded: Card[] = []): Card[] {
  const dead = new Set(excluded);
  const deck: Card[] = [];
  for (let c = 0; c < 52; c++) if (!dead.has(c)) deck.push(c);
  return deck;
}

export function shuffle(deck: Card[], rng: () => number): void {
  for (let i = deck.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }
}

export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
```

- [ ] **Step 4: Delete the smoke test, run tests**

```bash
rm src/engine/smoke.test.ts
npm test
```
Expected: all cards tests PASS.

- [ ] **Step 5: Commit**

```bash
git add -A app
git commit -m "feat(engine): card primitives, deck, seeded RNG

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 3: 7-card hand evaluator

**Files:**
- Create: `app/src/engine/evaluate.ts`
- Test: `app/src/engine/evaluate.test.ts`

**Interfaces:**
- Consumes: `Card`, `rankOf`, `suitOf` from `./cards`.
- Produces:
  - `evaluate7(cards: Card[]): number` — takes exactly 7 cards, returns a score; higher score wins, equal score ties.
  - `handCategory(score: number): number` — 0=high card … 8=straight flush (used by UI later for labels).

- [ ] **Step 1: Write the failing tests**

Create `app/src/engine/evaluate.test.ts`:

```ts
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
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test`
Expected: FAIL — cannot resolve `./evaluate`.

- [ ] **Step 3: Implement**

Create `app/src/engine/evaluate.ts`:

```ts
import { Card, rankOf, suitOf } from './cards';

// Score layout: category * 13^5 + up to five tiebreaker ranks packed base-13
// (most significant first, zero-padded). Same category always packs the same
// number of meaningful ranks, so padding never changes an ordering.
const P4 = 28561, P3 = 2197, P2 = 169, P1 = 13;
const CAT = 371293; // 13^5

function score(cat: number, ranks: number[]): number {
  const [a = 0, b = 0, c = 0, d = 0, e = 0] = ranks;
  return cat * CAT + a * P4 + b * P3 + c * P2 + d * P1 + e;
}

export const handCategory = (s: number): number => Math.floor(s / CAT);

// Returns the top rank of the best straight in a rank bitmask, or -1.
// Wheel (A2345) returns 3 (the rank index of the five).
export function straightTop(mask: number): number {
  for (let t = 12; t >= 4; t--) {
    let ok = true;
    for (let i = 0; i < 5; i++) if (!(mask & (1 << (t - i)))) { ok = false; break; }
    if (ok) return t;
  }
  const wheel = (1 << 12) | 0b1111; // A,2,3,4,5
  if ((mask & wheel) === wheel) return 3;
  return -1;
}

export function evaluate7(cards: Card[]): number {
  if (cards.length !== 7) throw new Error(`evaluate7 needs 7 cards, got ${cards.length}`);
  const rankCount = new Array<number>(13).fill(0);
  const suitCount = new Array<number>(4).fill(0);
  let rankMask = 0;
  for (const c of cards) {
    const r = rankOf(c);
    rankCount[r]++;
    suitCount[suitOf(c)]++;
    rankMask |= 1 << r;
  }

  let flushScore = -1;
  const flushSuit = suitCount.findIndex((n) => n >= 5);
  if (flushSuit >= 0) {
    let fmask = 0;
    for (const c of cards) if (suitOf(c) === flushSuit) fmask |= 1 << rankOf(c);
    const sfTop = straightTop(fmask);
    if (sfTop >= 0) return score(8, [sfTop]);
    const franks: number[] = [];
    for (let r = 12; r >= 0 && franks.length < 5; r--) if (fmask & (1 << r)) franks.push(r);
    flushScore = score(5, franks);
  }

  const quads: number[] = [], trips: number[] = [], pairs: number[] = [], singles: number[] = [];
  for (let r = 12; r >= 0; r--) {
    if (rankCount[r] === 4) quads.push(r);
    else if (rankCount[r] === 3) trips.push(r);
    else if (rankCount[r] === 2) pairs.push(r);
    else if (rankCount[r] === 1) singles.push(r);
  }

  if (quads.length) {
    const kicker = Math.max(...quads.slice(1), ...trips, ...pairs, ...singles);
    return score(7, [quads[0], kicker]);
  }
  if (trips.length && (trips.length > 1 || pairs.length)) {
    const pairRank = trips.length > 1 ? trips[1] : pairs[0];
    return score(6, [trips[0], pairRank]);
  }
  if (flushScore >= 0) return flushScore;
  const st = straightTop(rankMask);
  if (st >= 0) return score(4, [st]);
  if (trips.length) return score(3, [trips[0], singles[0], singles[1]]);
  if (pairs.length >= 2) {
    const kicker = Math.max(...pairs.slice(2), ...singles);
    return score(2, [pairs[0], pairs[1], kicker]);
  }
  if (pairs.length === 1) return score(1, [pairs[0], singles[0], singles[1], singles[2]]);
  return score(0, singles.slice(0, 5));
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test`
Expected: all PASS.

- [ ] **Step 5: Commit**

```bash
git add app/src/engine
git commit -m "feat(engine): 7-card hand evaluator

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 4: Heads-up hand state machine

**Files:**
- Create: `app/src/engine/hand.ts`
- Test: `app/src/engine/hand.test.ts`

**Interfaces:**
- Consumes: `cards.ts` (deck, shuffle, mulberry32), `evaluate.ts` (`evaluate7`).
- Produces (exact shapes — Plans 2/3 and later tasks rely on these):

```ts
export type Seat = 0 | 1;
export type Street = 'preflop' | 'flop' | 'turn' | 'river';
export type Action = { type: 'fold' } | { type: 'call' } | { type: 'raise'; to: number };
export interface HandConfig { buttonSeat: Seat; stacks: [number, number]; smallBlind: number; bigBlind: number; seed: number }
export interface LegalActions { canFold: boolean; callAmount: number; canRaise: boolean; minRaiseTo: number; maxRaiseTo: number }
export interface LogEntry { seat: Seat; street: Street; action: Action; toCall: number; potBefore: number; committedBefore: number; board: Card[] }
export interface HandResult { winner: Seat | null; potAwarded: number; showdown: boolean; stacks: [number, number] }
export interface HandState { /* see implementation */ }
export function startHand(cfg: HandConfig): HandState
export function legalActions(s: HandState): LegalActions
export function applyAction(s: HandState, a: Action): HandState  // returns a new state; never mutates
```

Semantics: `call` with `callAmount === 0` is a check. `raise.to` is the seat's **total committed this street** after the raise. Odd chips in split pots go to the button.

- [ ] **Step 1: Write the failing tests**

Create `app/src/engine/hand.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { startHand, legalActions, applyAction, HandConfig, HandState, Action } from './hand';

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
    expect(s.log[1]).toMatchObject({ seat: 1, street: 'preflop', toCall: 20, potBefore: 45, committedBefore: 10 });
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test`
Expected: FAIL — cannot resolve `./hand`.

- [ ] **Step 3: Implement**

Create `app/src/engine/hand.ts`:

```ts
import { Card, makeDeck, mulberry32, shuffle } from './cards';
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
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test`
Expected: all PASS. If the split-pot scan test fails, debug the tie path before moving on — do not widen the seed range to paper over it.

- [ ] **Step 5: Commit**

```bash
git add app/src/engine
git commit -m "feat(engine): heads-up no-limit hand state machine

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 5: Chen scores and starting-hand ranges

**Files:**
- Create: `app/src/personas/ranges.ts`
- Test: `app/src/personas/ranges.test.ts`

**Interfaces:**
- Consumes: `cards.ts`.
- Produces:
  - `chenScore(c1: Card, c2: Card): number` — Chen-formula strength of a starting hand.
  - `interface WeightedCombo { cards: [Card, Card]; weight: number }`
  - `rangeTopFraction(fraction: number, dead: Card[]): WeightedCombo[]` — all combos not blocked by `dead`, keeping the top `fraction` (0..1) ranked by Chen score, all with weight 1. This is both the bots' preflop range and the grading range model.

- [ ] **Step 1: Write the failing tests**

Create `app/src/personas/ranges.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { cardFromString } from '../engine/cards';
import { chenScore, rangeTopFraction } from './ranges';

const c = cardFromString;

describe('chenScore', () => {
  it('matches known Chen values', () => {
    expect(chenScore(c('As'), c('Ah'))).toBe(20); // AA
    expect(chenScore(c('As'), c('Ks'))).toBe(12); // AKs
    expect(chenScore(c('As'), c('Kh'))).toBe(10); // AKo
    expect(chenScore(c('Ts'), c('Th'))).toBe(10); // TT
    expect(chenScore(c('2s'), c('2h'))).toBe(5);  // 22 (pair floor)
    expect(chenScore(c('2s'), c('7h'))).toBe(-1); // 27o, the worst hand
  });

  it('is symmetric', () => {
    expect(chenScore(c('As'), c('Kh'))).toBe(chenScore(c('Kh'), c('As')));
  });
});

describe('rangeTopFraction', () => {
  it('returns all 1326 combos at fraction 1 with no dead cards', () => {
    expect(rangeTopFraction(1, []).length).toBe(1326);
  });

  it('excludes combos containing dead cards', () => {
    const dead = [c('As'), c('Kh')];
    const range = rangeTopFraction(1, dead);
    expect(range.length).toBe(1225); // C(50,2)
    for (const combo of range) {
      expect(combo.cards).not.toContain(dead[0]);
      expect(combo.cards).not.toContain(dead[1]);
    }
  });

  it('keeps only strong hands at small fractions', () => {
    const tight = rangeTopFraction(0.05, []);
    expect(tight.length).toBeGreaterThan(0);
    expect(tight.length).toBeLessThan(1326 * 0.08);
    // AA must be in any top-5% range
    const hasAA = tight.some(({ cards }) => {
      const [a, b] = cards;
      return Math.floor(a / 4) === 12 && Math.floor(b / 4) === 12;
    });
    expect(hasAA).toBe(true);
  });

  it('wider fractions contain narrower ones', () => {
    const key = ({ cards }: { cards: [number, number] }) => cards.join(',');
    const tight = new Set(rangeTopFraction(0.1, []).map(key));
    const wide = new Set(rangeTopFraction(0.5, []).map(key));
    for (const k of tight) expect(wide.has(k)).toBe(true);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test`
Expected: FAIL — cannot resolve `./ranges`.

- [ ] **Step 3: Implement**

Create `app/src/personas/ranges.ts`:

```ts
import { Card, rankOf, suitOf } from '../engine/cards';

export interface WeightedCombo {
  cards: [Card, Card];
  weight: number;
}

// Chen formula. Rank input is our 0..12 (deuce..ace) encoding.
const HIGH_CARD_POINTS = [1, 1.5, 2, 2.5, 3, 3.5, 4, 4.5, 5, 6, 7, 8, 10]; // 2..A

export function chenScore(c1: Card, c2: Card): number {
  const r1 = rankOf(c1), r2 = rankOf(c2);
  const hi = Math.max(r1, r2), lo = Math.min(r1, r2);
  if (r1 === r2) return Math.max(HIGH_CARD_POINTS[hi] * 2, 5);
  let pts = HIGH_CARD_POINTS[hi];
  if (suitOf(c1) === suitOf(c2)) pts += 2;
  const gap = hi - lo - 1;
  if (gap === 1) pts -= 1;
  else if (gap === 2) pts -= 2;
  else if (gap === 3) pts -= 4;
  else if (gap >= 4) pts -= 5;
  if (gap <= 1 && hi < 10) pts += 1; // 0-1 gap connectors below queen
  return Math.ceil(pts);
}

function allCombos(dead: Card[]): [Card, Card][] {
  const deadSet = new Set(dead);
  const combos: [Card, Card][] = [];
  for (let a = 0; a < 52; a++) {
    if (deadSet.has(a)) continue;
    for (let b = a + 1; b < 52; b++) {
      if (deadSet.has(b)) continue;
      combos.push([a, b]);
    }
  }
  return combos;
}

export function rangeTopFraction(fraction: number, dead: Card[]): WeightedCombo[] {
  const combos = allCombos(dead);
  const scored = combos
    .map((cards) => ({ cards, score: chenScore(cards[0], cards[1]) }))
    .sort((x, y) => y.score - x.score);
  const keep = Math.max(1, Math.round(scored.length * fraction));
  return scored.slice(0, keep).map(({ cards }) => ({ cards, weight: 1 }));
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test`
Expected: all PASS. If a Chen value is off by one, fix the formula (rounding is `Math.ceil` on half-points), not the test.

- [ ] **Step 5: Commit**

```bash
git add app/src/personas
git commit -m "feat(personas): Chen scores and top-fraction range builder

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 6: Monte Carlo equity vs a range

**Files:**
- Create: `app/src/grading/equity.ts`
- Test: `app/src/grading/equity.test.ts`

**Interfaces:**
- Consumes: `cards.ts`, `evaluate.ts`, `WeightedCombo` from `../personas/ranges`.
- Produces:
  - `equityVsRange(hero: [Card, Card], board: Card[], range: WeightedCombo[], iterations: number, rng: () => number): number` — hero's equity in [0,1] (win + half of ties), sampling villain hands from the range (weights respected, collisions with hero/board rejected) and completing the board uniformly.

- [ ] **Step 1: Write the failing tests**

Create `app/src/grading/equity.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { cardFromString, mulberry32 } from '../engine/cards';
import { equityVsRange } from './equity';
import { WeightedCombo } from '../personas/ranges';

const c = cardFromString;
const combo = (a: string, b: string): WeightedCombo => ({ cards: [c(a), c(b)], weight: 1 });

describe('equityVsRange', () => {
  it('AA vs 22 preflop is roughly 80/20', () => {
    const eq = equityVsRange([c('As'), c('Ah')], [], [combo('2c', '2d')], 5000, mulberry32(1));
    expect(eq).toBeGreaterThan(0.76);
    expect(eq).toBeLessThan(0.86);
  });

  it('the nuts on the river is 100%', () => {
    const board = ['As', 'Ks', 'Qs', '2d', '7h'].map(c);
    const eq = equityVsRange([c('Js'), c('Ts')], board, [combo('Ac', 'Ad')], 1000, mulberry32(2));
    expect(eq).toBe(1);
  });

  it('a chopped board is 50%', () => {
    const board = ['As', 'Ks', 'Qd', 'Jc', 'Th'].map(c); // broadway on board
    const eq = equityVsRange([c('2c'), c('3d')], board, [combo('4c', '5d')], 1000, mulberry32(3));
    expect(eq).toBe(0.5);
  });

  it('skips range combos that collide with known cards', () => {
    // villain range is only AsAh, both blocked by hero — falls back to remaining combos... 
    // there are none, so it must throw rather than loop forever.
    expect(() =>
      equityVsRange([c('As'), c('Ah')], [], [combo('As', 'Ah')], 100, mulberry32(4)),
    ).toThrow();
  });

  it('is deterministic for a given seed', () => {
    const range = [combo('Kc', 'Kd'), combo('7c', '2d')];
    const a = equityVsRange([c('As'), c('Qh')], [], range, 2000, mulberry32(5));
    const b = equityVsRange([c('As'), c('Qh')], [], range, 2000, mulberry32(5));
    expect(a).toBe(b);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test`
Expected: FAIL — cannot resolve `./equity`.

- [ ] **Step 3: Implement**

Create `app/src/grading/equity.ts`:

```ts
import { Card, makeDeck } from '../engine/cards';
import { evaluate7 } from '../engine/evaluate';
import { WeightedCombo } from '../personas/ranges';

export function equityVsRange(
  hero: [Card, Card],
  board: Card[],
  range: WeightedCombo[],
  iterations: number,
  rng: () => number,
): number {
  const known = new Set<Card>([...hero, ...board]);
  const live = range.filter(({ cards }) => !known.has(cards[0]) && !known.has(cards[1]));
  if (live.length === 0) throw new Error('range has no combos consistent with known cards');
  const totalWeight = live.reduce((sum, x) => sum + x.weight, 0);

  let wins = 0, ties = 0;
  for (let i = 0; i < iterations; i++) {
    // sample villain combo by weight
    let pick = rng() * totalWeight;
    let villain: [Card, Card] = live[live.length - 1].cards;
    for (const combo of live) {
      pick -= combo.weight;
      if (pick <= 0) { villain = combo.cards; break; }
    }
    // complete the board uniformly from remaining cards
    const deck = makeDeck([...hero, ...board, ...villain]);
    const runout: Card[] = [...board];
    while (runout.length < 5) {
      const j = Math.floor(rng() * deck.length);
      runout.push(deck[j]);
      deck[j] = deck[deck.length - 1];
      deck.pop();
    }
    const heroScore = evaluate7([...hero, ...runout]);
    const villainScore = evaluate7([...villain, ...runout]);
    if (heroScore > villainScore) wins++;
    else if (heroScore === villainScore) ties++;
  }
  return (wins + ties / 2) / iterations;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test`
Expected: all PASS. The AA-vs-22 tolerance band is wide on purpose; if it lands outside, that indicates a real bug (dead-card handling or scoring), not noise at 5000 iterations.

- [ ] **Step 5: Commit**

```bash
git add app/src/grading
git commit -m "feat(grading): Monte Carlo equity vs weighted range

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 7: Personality bots

**Files:**
- Create: `app/src/personas/persona.ts`
- Test: `app/src/personas/persona.test.ts`

**Interfaces:**
- Consumes: `hand.ts` (`HandState`, `Action`, `legalActions`, `Seat`), `ranges.ts`, `equity.ts`.
- Produces:

```ts
export interface PersonaParams {
  name: string;
  preflopRange: number;   // fraction of hands played, 0..1
  aggression: number;     // 0..1 — probability of raising instead of calling when strong
  callDown: number;       // 0..1 — extra willingness to call with insufficient equity
  bluffFreq: number;      // 0..1 — probability of raising with a weak hand
  foldToRaise: number;    // 0..1 — modeled fold frequency vs a raise (used by grading's EV model too)
}
export const PERSONAS: Record<'nit' | 'maniac' | 'station' | 'balanced', PersonaParams>
export function personaRange(params: PersonaParams, dead: Card[]): WeightedCombo[]
export function personaAction(state: HandState, seat: Seat, params: PersonaParams, rng: () => number): Action
```

`personaRange` is the single source of truth for "what hands does this villain have" — the same function feeds bot behavior and grading (spec requirement).

- [ ] **Step 1: Write the failing tests**

Create `app/src/personas/persona.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { mulberry32 } from '../engine/cards';
import { startHand, applyAction, HandState } from '../engine/hand';
import { PERSONAS, personaAction, personaRange } from './persona';

function playPreflopAsButton(seed: number, params: typeof PERSONAS.nit, rng: () => number) {
  const s = startHand({ buttonSeat: 0, stacks: [1000, 1000], smallBlind: 5, bigBlind: 10, seed });
  return personaAction(s, 0, params, rng);
}

describe('PERSONAS', () => {
  it('defines the four spec personas with sane parameters', () => {
    expect(PERSONAS.nit.preflopRange).toBeLessThan(PERSONAS.balanced.preflopRange);
    expect(PERSONAS.maniac.preflopRange).toBeGreaterThan(PERSONAS.balanced.preflopRange);
    expect(PERSONAS.maniac.aggression).toBeGreaterThan(PERSONAS.station.aggression);
    expect(PERSONAS.station.callDown).toBeGreaterThan(PERSONAS.balanced.callDown);
  });
});

describe('personaRange', () => {
  it('returns the persona preflop fraction of live combos', () => {
    const range = personaRange(PERSONAS.nit, []);
    expect(range.length).toBe(Math.round(1326 * PERSONAS.nit.preflopRange));
  });
});

describe('personaAction', () => {
  it('always returns a legal action across many random spots', () => {
    for (let seed = 0; seed < 60; seed++) {
      const rng = mulberry32(seed);
      let s: HandState = startHand({ buttonSeat: 0, stacks: [1000, 1000], smallBlind: 5, bigBlind: 10, seed });
      let guard = 0;
      while (!s.result && guard++ < 50) {
        const params = s.toAct === 0 ? PERSONAS.maniac : PERSONAS.nit;
        s = applyAction(s, personaAction(s, s.toAct, params, rng)); // throws if illegal
      }
      expect(s.result).not.toBeNull();
    }
  });

  it('the nit folds far more often preflop than the maniac', () => {
    const rng = mulberry32(99);
    let nitFolds = 0, maniacFolds = 0;
    for (let seed = 0; seed < 200; seed++) {
      if (playPreflopAsButton(seed, PERSONAS.nit, rng).type === 'fold') nitFolds++;
      if (playPreflopAsButton(seed, PERSONAS.maniac, rng).type === 'fold') maniacFolds++;
    }
    expect(nitFolds).toBeGreaterThan(maniacFolds + 40);
  });

  it('the maniac raises more often than the station', () => {
    const rng = mulberry32(7);
    let maniacRaises = 0, stationRaises = 0;
    for (let seed = 0; seed < 200; seed++) {
      if (playPreflopAsButton(seed, PERSONAS.maniac, rng).type === 'raise') maniacRaises++;
      if (playPreflopAsButton(seed, PERSONAS.station, rng).type === 'raise') stationRaises++;
    }
    expect(maniacRaises).toBeGreaterThan(stationRaises + 40);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test`
Expected: FAIL — cannot resolve `./persona`.

- [ ] **Step 3: Implement**

Create `app/src/personas/persona.ts`:

```ts
import { Card } from '../engine/cards';
import { Action, HandState, Seat, legalActions } from '../engine/hand';
import { equityVsRange } from '../grading/equity';
import { WeightedCombo, chenScore, rangeTopFraction } from './ranges';

export interface PersonaParams {
  name: string;
  preflopRange: number;
  aggression: number;
  callDown: number;
  bluffFreq: number;
  foldToRaise: number;
}

export const PERSONAS: Record<'nit' | 'maniac' | 'station' | 'balanced', PersonaParams> = {
  nit:      { name: 'The Nit',             preflopRange: 0.15, aggression: 0.35, callDown: 0.0,  bluffFreq: 0.02, foldToRaise: 0.65 },
  maniac:   { name: 'The Maniac',          preflopRange: 0.85, aggression: 0.85, callDown: 0.25, bluffFreq: 0.35, foldToRaise: 0.15 },
  station:  { name: 'The Calling Station', preflopRange: 0.70, aggression: 0.05, callDown: 0.60, bluffFreq: 0.02, foldToRaise: 0.05 },
  balanced: { name: 'The Balanced Player', preflopRange: 0.55, aggression: 0.55, callDown: 0.10, bluffFreq: 0.12, foldToRaise: 0.40 },
};

export function personaRange(params: PersonaParams, dead: Card[]): WeightedCombo[] {
  return rangeTopFraction(params.preflopRange, dead);
}

const BOT_EQUITY_ITERATIONS = 300;
// Chen threshold approximating the persona's preflop continuing range:
// rangeTopFraction is Chen-ordered, so "in range" ≈ "Chen score above the
// range's cutoff". We look it up directly to keep one source of truth.
function inPreflopRange(hole: [Card, Card], params: PersonaParams): boolean {
  const range = rangeTopFraction(params.preflopRange, []);
  const cutoff = chenScore(range[range.length - 1].cards[0], range[range.length - 1].cards[1]);
  return chenScore(hole[0], hole[1]) >= cutoff;
}

export function personaAction(
  state: HandState,
  seat: Seat,
  params: PersonaParams,
  rng: () => number,
): Action {
  const la = legalActions(state);
  const hole = state.holes[seat];
  const raiseTo = () => ({
    type: 'raise' as const,
    to: Math.min(la.maxRaiseTo, Math.max(la.minRaiseTo, la.minRaiseTo * 2)),
  });

  if (state.street === 'preflop') {
    const playable = inPreflopRange(hole, params);
    if (!playable) {
      if (la.canRaise && rng() < params.bluffFreq) return raiseTo();
      return la.canFold ? { type: 'fold' } : { type: 'call' };
    }
    if (la.canRaise && rng() < params.aggression) return raiseTo();
    return { type: 'call' };
  }

  // Postflop: estimate equity vs an unknown opponent (uniform random range).
  const equity = equityVsRange(
    hole, state.board, rangeTopFraction(1, [...hole, ...state.board]),
    BOT_EQUITY_ITERATIONS, rng,
  );
  const pot = state.pot + state.committed[0] + state.committed[1];
  const required = la.callAmount > 0 ? la.callAmount / (pot + la.callAmount) : 0;

  if (equity >= required + 0.15) {
    if (la.canRaise && rng() < params.aggression) return raiseTo();
    return { type: 'call' };
  }
  if (equity >= required) return { type: 'call' };
  // insufficient equity: stations still call, others occasionally bluff-raise
  if (rng() < params.callDown) return { type: 'call' };
  if (la.canRaise && rng() < params.bluffFreq) return raiseTo();
  if (la.canFold) return { type: 'fold' };
  return { type: 'call' }; // checking is free
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test`
Expected: all PASS. These are statistical tests over fixed seeds — they are deterministic. If a margin fails, the persona parameters or logic are wrong; tune logic, not the seeds.

- [ ] **Step 5: Commit**

```bash
git add app/src/personas
git commit -m "feat(personas): four personality bots with legal-action guarantees

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 8: Preflop chart grading

**Files:**
- Create: `app/src/grading/preflop.ts`
- Test: `app/src/grading/preflop.test.ts`

**Interfaces:**
- Consumes: `cards.ts`, `chenScore` from `../personas/ranges`.
- Produces:
  - `type PreflopSpot = 'button-open' | 'bb-vs-open' | 'button-vs-3bet'`
  - `preflopRecommendation(hole: [Card, Card], spot: PreflopSpot): 'raise' | 'call' | 'fold'` — chart-style recommendation for heads-up preflop spots. Thresholds are named constants (tunable data, one place).

- [ ] **Step 1: Write the failing tests**

Create `app/src/grading/preflop.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { cardFromString } from '../engine/cards';
import { preflopRecommendation } from './preflop';

const hole = (a: string, b: string): [number, number] => [cardFromString(a), cardFromString(b)];

describe('preflopRecommendation', () => {
  it('opens premium and playable hands on the button, folds trash', () => {
    expect(preflopRecommendation(hole('As', 'Ah'), 'button-open')).toBe('raise');
    expect(preflopRecommendation(hole('Ts', '9s'), 'button-open')).toBe('raise');
    expect(preflopRecommendation(hole('7c', '2d'), 'button-open')).toBe('fold');
  });

  it('3-bets premiums and defends reasonable hands in the big blind', () => {
    expect(preflopRecommendation(hole('As', 'Ks'), 'bb-vs-open')).toBe('raise');
    expect(preflopRecommendation(hole('9s', '8s'), 'bb-vs-open')).toBe('call');
    expect(preflopRecommendation(hole('7c', '2d'), 'bb-vs-open')).toBe('fold');
  });

  it('continues narrowly against a 3-bet', () => {
    expect(preflopRecommendation(hole('As', 'Ah'), 'button-vs-3bet')).toBe('raise');
    expect(preflopRecommendation(hole('As', 'Qs'), 'button-vs-3bet')).toBe('call');
    expect(preflopRecommendation(hole('8c', '3d'), 'button-vs-3bet')).toBe('fold');
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test`
Expected: FAIL — cannot resolve `./preflop`.

- [ ] **Step 3: Implement**

Create `app/src/grading/preflop.ts`:

```ts
import { Card } from '../engine/cards';
import { chenScore } from '../personas/ranges';

export type PreflopSpot = 'button-open' | 'bb-vs-open' | 'button-vs-3bet';

// Chart proxy: thresholds on Chen score per spot. These are v1 tunable data —
// a hand-authored 169-cell chart can replace this file without changing callers.
const THRESHOLDS: Record<PreflopSpot, { raise: number; call: number }> = {
  'button-open':    { raise: 5, call: Infinity }, // open-or-fold on the button
  'bb-vs-open':     { raise: 10, call: 6 },
  'button-vs-3bet': { raise: 12, call: 9 },
};

export function preflopRecommendation(
  hole: [Card, Card],
  spot: PreflopSpot,
): 'raise' | 'call' | 'fold' {
  const score = chenScore(hole[0], hole[1]);
  const t = THRESHOLDS[spot];
  if (score >= t.raise) return 'raise';
  if (score >= t.call) return 'call';
  return 'fold';
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test`
Expected: all PASS. (T9s Chen = 8 → raise on button-open; A Qs Chen = 10 → call vs 3-bet since 10 < 12 and ≥ 9.)

- [ ] **Step 5: Commit**

```bash
git add app/src/grading
git commit -m "feat(grading): preflop chart recommendations

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 9: Postflop decision grading with explanations

**Files:**
- Create: `app/src/grading/grade.ts`
- Test: `app/src/grading/grade.test.ts`

**Interfaces:**
- Consumes: `equity.ts`, `persona.ts` (`PersonaParams`, `personaRange`), `hand.ts` types.
- Produces:

```ts
export type GradeLabel = 'best' | 'okay' | 'mistake';
export interface DecisionGrade {
  label: GradeLabel;
  evLost: number;             // chips, >= 0; 0 when the taken action was best
  bestAction: 'fold' | 'call' | 'raise';
  actionTaken: 'fold' | 'call' | 'raise';
  equity: number;             // hero equity vs villain modeled range at decision time
  requiredEquity: number | null; // null when checking was free
  evByAction: { fold: number; call: number; raise: number | null }; // chips vs folding baseline
  explanation: string;        // plain-language write-up with the plugged-in numbers
}
export interface PostflopSpot {
  hero: [Card, Card];
  board: Card[];
  pot: number;        // pot at decision time (includes any villain bet)
  toCall: number;     // 0 = checking is free
  raiseCost: number | null;  // hero's total additional chips if raising (call + raise), null if raise unavailable
  villain: PersonaParams;
  iterations: number;
  rng: () => number;
  bigBlind: number;   // grade thresholds are in big blinds
}
export function gradePostflopDecision(spot: PostflopSpot, taken: 'fold' | 'call' | 'raise'): DecisionGrade
```

EV model (documented in code; the spec's simplified v1): fold = 0; call = `equity * (pot + toCall) − toCall`; raise = `foldToRaise * pot + (1 − foldToRaise) * (equity * (pot + raiseCost) − raiseCost)` using the villain persona's `foldToRaise`. Grade thresholds in big blinds are constants: `best` if within 0.1bb of the max-EV action, `okay` within 1bb, else `mistake`.

- [ ] **Step 1: Write the failing tests**

Create `app/src/grading/grade.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { cardFromString, mulberry32 } from '../engine/cards';
import { PERSONAS } from '../personas/persona';
import { gradePostflopDecision, PostflopSpot } from './grade';

const c = cardFromString;

// Hero has 22 (only two outs) facing a huge river bet vs a nit: clear fold.
const drawDeadSpot = (): PostflopSpot => ({
  hero: [c('2c'), c('2d')],
  board: ['As', 'Ks', 'Qs', 'Jh', '9d'].map(c),
  pot: 1000,
  toCall: 400,
  raiseCost: 1200,
  villain: PERSONAS.nit,
  iterations: 2000,
  rng: mulberry32(11),
  bigBlind: 10,
});

// Hero has the nut flush on the river facing a bet: never fold.
const nutsSpot = (): PostflopSpot => ({
  hero: [c('As'), c('Ts')],
  board: ['Ks', 'Qs', '2s', '7h', '3d'].map(c),
  pot: 1000,
  toCall: 400,
  raiseCost: 1200,
  villain: PERSONAS.station,
  iterations: 2000,
  rng: mulberry32(12),
  bigBlind: 10,
});

describe('gradePostflopDecision', () => {
  it('grades a hopeless call as a mistake with positive EV lost', () => {
    const g = gradePostflopDecision(drawDeadSpot(), 'call');
    expect(g.label).toBe('mistake');
    expect(g.bestAction).toBe('fold');
    expect(g.evLost).toBeGreaterThan(100);
  });

  it('grades folding the same spot as best', () => {
    const g = gradePostflopDecision(drawDeadSpot(), 'fold');
    expect(g.label).toBe('best');
    expect(g.evLost).toBe(0);
  });

  it('never grades continuing with the nuts as fold-best', () => {
    const g = gradePostflopDecision(nutsSpot(), 'raise');
    expect(g.bestAction).not.toBe('fold');
    expect(g.equity).toBeGreaterThan(0.95);
  });

  it('reports required equity from pot odds', () => {
    const g = gradePostflopDecision(drawDeadSpot(), 'fold');
    expect(g.requiredEquity).toBeCloseTo(400 / 1400, 3);
  });

  it('writes an explanation containing the actual numbers', () => {
    const g = gradePostflopDecision(drawDeadSpot(), 'call');
    expect(g.explanation).toContain('1,000'); // pot
    expect(g.explanation).toContain('400');   // call amount
    expect(g.explanation).toContain('29%');   // required equity, rounded
  });

  it('sets raise EV to null when raising is unavailable', () => {
    const g = gradePostflopDecision({ ...drawDeadSpot(), raiseCost: null }, 'fold');
    expect(g.evByAction.raise).toBeNull();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test`
Expected: FAIL — cannot resolve `./grade`.

- [ ] **Step 3: Implement**

Create `app/src/grading/grade.ts`:

```ts
import { Card } from '../engine/cards';
import { PersonaParams, personaRange } from '../personas/persona';
import { equityVsRange } from './equity';

export type GradeLabel = 'best' | 'okay' | 'mistake';

export interface DecisionGrade {
  label: GradeLabel;
  evLost: number;
  bestAction: 'fold' | 'call' | 'raise';
  actionTaken: 'fold' | 'call' | 'raise';
  equity: number;
  requiredEquity: number | null;
  evByAction: { fold: number; call: number; raise: number | null };
  explanation: string;
}

export interface PostflopSpot {
  hero: [Card, Card];
  board: Card[];
  pot: number;
  toCall: number;
  raiseCost: number | null;
  villain: PersonaParams;
  iterations: number;
  rng: () => number;
  bigBlind: number;
}

const BEST_TOLERANCE_BB = 0.1;
const OKAY_TOLERANCE_BB = 1.0;

const fmt = (n: number) => Math.round(n).toLocaleString('en-US');
const pct = (x: number) => `${Math.round(x * 100)}%`;

export function gradePostflopDecision(
  spot: PostflopSpot,
  taken: 'fold' | 'call' | 'raise',
): DecisionGrade {
  const { pot, toCall, raiseCost, villain, bigBlind } = spot;
  const range = personaRange(villain, [...spot.hero, ...spot.board]);
  const equity = equityVsRange(spot.hero, spot.board, range, spot.iterations, spot.rng);

  // Simplified v1 EV model, all relative to folding (= 0):
  //   call:  equity * (pot + toCall) − toCall
  //   raise: villain folds `foldToRaise` of the time (win pot now); otherwise
  //          showdown with current equity for the bigger pot.
  const evFold = 0;
  const evCall = equity * (pot + toCall) - toCall;
  const evRaise =
    raiseCost === null
      ? null
      : villain.foldToRaise * pot +
        (1 - villain.foldToRaise) * (equity * (pot + raiseCost) - raiseCost);

  const evByAction = { fold: evFold, call: evCall, raise: evRaise };
  const candidates: ['fold' | 'call' | 'raise', number][] = [
    ['fold', evFold],
    ['call', evCall],
  ];
  if (evRaise !== null) candidates.push(['raise', evRaise]);
  candidates.sort((a, b) => b[1] - a[1]);
  const [bestAction, bestEv] = candidates[0];

  const takenEv = evByAction[taken];
  if (takenEv === null) throw new Error(`graded action '${taken}' was not available`);
  const evLost = Math.max(0, bestEv - takenEv);

  const label: GradeLabel =
    evLost <= BEST_TOLERANCE_BB * bigBlind ? 'best'
    : evLost <= OKAY_TOLERANCE_BB * bigBlind ? 'okay'
    : 'mistake';

  const requiredEquity = toCall > 0 ? toCall / (pot + toCall) : null;

  let explanation: string;
  if (toCall > 0) {
    explanation =
      `The pot was ${fmt(pot)} and the call was ${fmt(toCall)}, so you needed ` +
      `${fmt(toCall)} / (${fmt(pot)} + ${fmt(toCall)}) = ${pct(requiredEquity!)} equity to call. ` +
      `Against ${villain.name}'s range here your hand had ${pct(equity)}. `;
  } else {
    explanation =
      `Checking was free. Against ${villain.name}'s range here your hand had ${pct(equity)} equity. `;
  }
  explanation +=
    label === 'best'
      ? `${cap(taken)} was the best available action.`
      : `${cap(bestAction)} was best; ${taken === 'fold' ? 'folding' : taken + 'ing'} ` +
        `loses ${fmt(evLost)} chips on average.`;

  return { label, evLost, bestAction, actionTaken: taken, equity, requiredEquity, evByAction, explanation };
}

const cap = (s: string) => s[0].toUpperCase() + s.slice(1);
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test`
Expected: all PASS.

- [ ] **Step 5: Commit**

```bash
git add app/src/grading
git commit -m "feat(grading): postflop decision grading with EV model and explanations

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 10: Whole-hand grading integration

**Files:**
- Create: `app/src/grading/gradeHand.ts`
- Test: `app/src/grading/gradeHand.test.ts`

**Interfaces:**
- Consumes: everything above — this is the function Plan 2's UI calls when a hand ends.
- Produces:

```ts
export interface GradedDecision {
  street: Street;
  logIndex: number;      // index into HandState.log
  grade: DecisionGrade | PreflopGrade;
}
export interface PreflopGrade {
  label: GradeLabel;
  recommended: 'raise' | 'call' | 'fold';
  actionTaken: 'raise' | 'call' | 'fold';
  explanation: string;
}
export function gradeHand(
  finished: HandState,
  heroSeat: Seat,
  villain: PersonaParams,
  iterations: number,
  rng: () => number,
): GradedDecision[]
```

Preflop decisions are graded against `preflopRecommendation` (label: `best` if matched, `mistake` if not — chart grading is binary in v1, no EV number). Postflop decisions go through `gradePostflopDecision`, reconstructing each spot from the `LogEntry`.

- [ ] **Step 1: Write the failing tests**

Create `app/src/grading/gradeHand.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { mulberry32 } from '../engine/cards';
import { startHand, applyAction, HandState, Action } from '../engine/hand';
import { PERSONAS } from '../personas/persona';
import { gradeHand } from './gradeHand';

const play = (seed: number, ...actions: Action[]): HandState =>
  actions.reduce(applyAction, startHand({ buttonSeat: 0, stacks: [1000, 1000], smallBlind: 5, bigBlind: 10, seed }));

describe('gradeHand', () => {
  it('grades only the hero seat decisions', () => {
    const s = play(3, { type: 'raise', to: 30 }, { type: 'fold' });
    const grades = gradeHand(s, 0, PERSONAS.balanced, 500, mulberry32(1));
    expect(grades.length).toBe(1);
    expect(s.log[grades[0].logIndex].seat).toBe(0);
  });

  it('grades every hero decision in a multi-street hand', () => {
    // limp, check, then check-check flop
    const s = play(3, { type: 'call' }, { type: 'call' }, { type: 'call' }, { type: 'call' });
    const heroDecisions = s.log.filter((e) => e.seat === 0).length;
    const grades = gradeHand(s, 0, PERSONAS.balanced, 500, mulberry32(2));
    expect(grades.length).toBe(heroDecisions);
  });

  it('marks chart-mismatched preflop actions as mistakes with an explanation', () => {
    // scan seeds for a hand where the button holds chart-fold trash, then limp it
    for (let seed = 0; seed < 300; seed++) {
      const s0 = startHand({ buttonSeat: 0, stacks: [1000, 1000], smallBlind: 5, bigBlind: 10, seed });
      const s = [{ type: 'call' } as Action, { type: 'raise', to: 40 } as Action, { type: 'fold' } as Action]
        .reduce(applyAction, s0);
      const grades = gradeHand(s, 0, PERSONAS.balanced, 300, mulberry32(seed));
      const pre = grades[0].grade as { label: string; recommended: string; explanation: string };
      if (pre.recommended === 'fold') {
        expect(pre.label).toBe('mistake');
        expect(pre.explanation.length).toBeGreaterThan(10);
        return;
      }
    }
    throw new Error('no chart-fold hand found in 300 seeds — suspicious');
  });

  it('every graded decision carries an explanation string', () => {
    const s = play(9, { type: 'call' }, { type: 'call' }, { type: 'call' }, { type: 'call' },
      { type: 'call' }, { type: 'call' }, { type: 'call' }, { type: 'call' });
    const grades = gradeHand(s, 0, PERSONAS.station, 500, mulberry32(4));
    for (const g of grades) {
      expect((g.grade as { explanation: string }).explanation.length).toBeGreaterThan(10);
    }
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test`
Expected: FAIL — cannot resolve `./gradeHand`.

- [ ] **Step 3: Implement**

Create `app/src/grading/gradeHand.ts`:

```ts
import { HandState, Seat, Street } from '../engine/hand';
import { PersonaParams } from '../personas/persona';
import { DecisionGrade, GradeLabel, gradePostflopDecision } from './grade';
import { PreflopSpot, preflopRecommendation } from './preflop';

export interface PreflopGrade {
  label: GradeLabel;
  recommended: 'raise' | 'call' | 'fold';
  actionTaken: 'raise' | 'call' | 'fold';
  explanation: string;
}

export interface GradedDecision {
  street: Street;
  logIndex: number;
  grade: DecisionGrade | PreflopGrade;
}

// Map a preflop log position to a chart spot. v1 covers the three core spots;
// deeper raise wars fall back to 'button-vs-3bet' as the closest chart.
function preflopSpotFor(state: HandState, heroSeat: Seat, logIndex: number): PreflopSpot {
  const isButton = heroSeat === state.cfg.buttonSeat;
  const priorRaises = state.log
    .slice(0, logIndex)
    .filter((e) => e.street === 'preflop' && e.action.type === 'raise').length;
  if (isButton) return priorRaises === 0 ? 'button-open' : 'button-vs-3bet';
  return 'bb-vs-open';
}

export function gradeHand(
  finished: HandState,
  heroSeat: Seat,
  villain: PersonaParams,
  iterations: number,
  rng: () => number,
): GradedDecision[] {
  if (!finished.result) throw new Error('gradeHand requires a finished hand');
  const grades: GradedDecision[] = [];
  const hero = finished.holes[heroSeat];
  const bb = finished.cfg.bigBlind;

  finished.log.forEach((entry, logIndex) => {
    if (entry.seat !== heroSeat) return;
    const takenType = entry.action.type;
    const taken: 'fold' | 'call' | 'raise' = takenType;

    if (entry.street === 'preflop') {
      const spot = preflopSpotFor(finished, heroSeat, logIndex);
      const recommended = preflopRecommendation(hero, spot);
      // 'call' with nothing to call is a check — checking when the chart says
      // fold is fine (folding when checking is free would burn equity).
      const effectiveRecommended =
        recommended === 'fold' && entry.toCall === 0 ? 'call' : recommended;
      const label: GradeLabel = taken === effectiveRecommended ? 'best' : 'mistake';
      const explanation =
        label === 'best'
          ? `The chart agrees: ${taken} is standard here.`
          : `Standard play in this spot is to ${effectiveRecommended}; you chose ${taken}.`;
      grades.push({
        street: entry.street, logIndex,
        grade: { label, recommended: effectiveRecommended, actionTaken: taken, explanation },
      });
      return;
    }

    // Postflop: rebuild the spot from the log entry.
    // If the hero raised, raiseCost is exactly what they added (to − committedBefore).
    // Otherwise model the raise option as a pot-ish raise for the EV comparison.
    const raiseCost =
      entry.action.type === 'raise'
        ? entry.action.to - entry.committedBefore
        : entry.toCall + Math.max(entry.potBefore, bb * 2);
    grades.push({
      street: entry.street, logIndex,
      grade: gradePostflopDecision(
        {
          hero,
          board: entry.board,
          pot: entry.potBefore,
          toCall: entry.toCall,
          raiseCost,
          villain,
          iterations,
          rng,
          bigBlind: bb,
        },
        taken,
      ),
    });
  });

  return grades;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test`
Expected: all PASS.

- [ ] **Step 5: Commit**

```bash
git add app/src
git commit -m "feat(grading): whole-hand grading integration

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

## After this plan

- **Plan 2 — Table UI & Review** (to be written when Plan 1 lands): Midnight Casino table, motion/sound, hotkeys, side ribbon consuming `gradeHand`, Replay Theater consuming `DecisionGrade.evByAction` + `explanation`, Web Worker wrapper around `equityVsRange`/`gradeHand`, Training + Match modes on top of `HandConfig`.
- **Plan 3 — Profile & Coach** (after Plan 2): IndexedDB decision store, leak aggregation by tags (street, action-facing, hand class, persona), Report Card dashboard, Coach Feed, drill generation.

## Self-review notes

- **Spec coverage:** this plan intentionally covers only the "grading brain", "opponents", and engine sections of the spec; UI, profile, modes, and worker plumbing are named in the follow-up plans above with their consuming interfaces already fixed here.
- **Type consistency check performed:** `WeightedCombo` (Task 5) is consumed by Tasks 6, 7, 9; `PersonaParams.foldToRaise` (Task 7) is consumed by Task 9's EV model; `LogEntry` fields (Task 4, including `committedBefore`) match Task 10's spot reconstruction exactly.
- **Known simplifications (by spec decision):** action-level grading only; simplified raise-EV model; preflop-only range model for villains; Chen-threshold chart proxy. All are isolated behind small files (`preflop.ts`, `grade.ts`) so they can be upgraded without touching callers.
