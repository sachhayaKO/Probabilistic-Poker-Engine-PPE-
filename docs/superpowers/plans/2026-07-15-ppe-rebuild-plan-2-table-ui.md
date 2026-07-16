# PPE Rebuild Plan 2 — Midnight Casino Table UI & Review

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Playable heads-up trainer UI on top of the merged Plan 1 engine: Midnight Casino table with motion/sound/hotkeys, Training + Match modes, side-ribbon end-of-hand review, Replay Theater, and a Web Worker wrapper for grading.

**Architecture:** Pure frontend React 19 + TS. New `src/worker/` (protocol + handlers + client, seed in / plain data out) and `src/ui/` (pure session logic in `gameMachine.ts`/`stats.ts`, one `useGame` hook driving all pacing, presentational components on top). Engine/grading from Plan 1 are consumed as-is except one `LogEntry` extension (Task 1).

**Tech Stack:** React 19, Vite 8, Vitest 4, no new runtime deps. Dev-only additions: `jsdom`, `@testing-library/react`. Sound is synthesized WebAudio (no asset files). Fonts are system serif stacks (no external fetches).

## Model routing (orchestrator note)

- **haiku** (complete code below, transcribe exactly): Tasks 1–5, 7.
- **sonnet** (locked interfaces + logic code below; CSS/layout judgment within the Task 4 token system): Tasks 6, 8, 9, 10.
- Review = orchestrator (Fable) diffs delivered code against this plan's code.

## Global Constraints

- No new **runtime** dependencies. Dev-only: `jsdom`, `@testing-library/react` (installed in Task 4).
- TypeScript strict + `verbatimModuleSyntax`: all type-only imports MUST use `import type`.
- No live help during a hand: no equity, odds, or recommendations rendered while `hand.result === null`.
- Sound must be toggleable and default ON; all sound goes through `src/ui/sound.ts`.
- Worker failure degrades gracefully: hand stays playable, review shows "grading unavailable", next hand retries.
- Desktop-first (min layout target 1280×800); basic responsiveness only.
- Blinds fixed: SB 50 / BB 100 / starting stack 10,000 (100BB). Hero is always seat 0.
- Visual direction "Midnight Casino": tokens in `src/ui/theme.css` only — components must use the CSS custom properties, never hardcoded colors.
- Branch `ppe-rebuild-ui`; one commit per task with the message given in the task.
- Credit discipline: each task runs ONLY the test files named in that task (`npx vitest run <files>`), from `app/`. No full suite, no tsc until Task 11.

---

### Task 1: Extend LogEntry with stackBehind/canRaise/maxRaiseTo [haiku]

**Files:**
- Modify: `app/src/engine/hand.ts` (LogEntry interface ~line 25; `applyAction` log push ~line 156)
- Modify: `app/src/grading/gradeHand.ts` (raiseCost ~line 71)
- Test: `app/src/engine/hand.test.ts`, `app/src/grading/gradeHand.test.ts`

**Interfaces:**
- Consumes: existing `LegalActions` from `legalActions(prev)` (already computed as `la` in `applyAction`).
- Produces: `LogEntry` gains `stackBehind: number; canRaise: boolean; maxRaiseTo: number` — consumed by `gradeHand` and later by Replay Theater (Task 9).

- [ ] **Step 1: Write the failing tests**

Append to `app/src/engine/hand.test.ts` (inside the existing top-level describe; reuse the file's existing `cfg` helper style — construct a config exactly like neighboring tests do):

```ts
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
```

Append to `app/src/grading/gradeHand.test.ts` (reuse the file's existing imports/persona fixture style):

```ts
it('models no raise option when the log entry could not raise (facing all-in)', () => {
  // Hero seat 0 on the button. Preflop: hero limps, BB checks. Flop: villain shoves, hero calls.
  let s = startHand({ buttonSeat: 0, stacks: [1000, 1000], smallBlind: 5, bigBlind: 10, seed: 99 });
  s = applyAction(s, { type: 'call' }); // hero limp
  s = applyAction(s, { type: 'call' }); // BB check -> flop
  s = applyAction(s, { type: 'raise', to: 990 }); // villain (seat 1) shoves
  s = applyAction(s, { type: 'call' }); // hero calls -> showdown
  const grades = gradeHand(s, 0, PERSONAS.balanced, 200, mulberry32(1));
  const flop = grades.find((g) => g.street === 'flop')!;
  const grade = flop.grade as DecisionGrade;
  expect(grade.evByAction.raise).toBeNull();
});
```

(If `DecisionGrade`, `PERSONAS`, `mulberry32`, `startHand`, or `applyAction` are not yet imported in that test file, add `import type`/`import` lines matching how sibling test files import them.)

- [ ] **Step 2: Run tests to verify the new ones fail**

Run (from `app/`): `npx vitest run src/engine/hand.test.ts src/grading/gradeHand.test.ts`
Expected: the three new tests FAIL (missing fields / raise EV not null); all pre-existing tests PASS.

- [ ] **Step 3: Implement**

In `app/src/engine/hand.ts`, replace the `LogEntry` interface with:

```ts
export interface LogEntry {
  seat: Seat;
  street: Street;
  action: Action;
  toCall: number;
  potBefore: number;       // pot + both committed at decision time
  committedBefore: number; // acting seat's committed chips at decision time
  stackBehind: number;     // acting seat's stack behind at decision time
  canRaise: boolean;       // whether raising was legal at decision time
  maxRaiseTo: number;      // legal max raise-to at decision time (0 if canRaise is false)
  board: Card[];
}
```

In `applyAction`, replace the `s.log.push({...})` call with:

```ts
  s.log.push({
    seat: me, street: s.street, action: a,
    toCall: la.callAmount,
    potBefore: s.pot + s.committed[0] + s.committed[1],
    committedBefore: s.committed[me],
    stackBehind: s.stacks[me],
    canRaise: la.canRaise,
    maxRaiseTo: la.maxRaiseTo,
    board: [...s.board],
  });
```

In `app/src/grading/gradeHand.ts`, replace the `raiseCost` computation (the `const raiseCost = ...` statement and its comment) with:

```ts
    // If the hero raised, raiseCost is exactly what they added (to − committedBefore).
    // Otherwise model the raise option as a pot-ish raise, clamped to what was
    // actually legal; if no raise was legal (facing all-in), there is no raise option.
    const raiseCost =
      entry.action.type === 'raise'
        ? entry.action.to - entry.committedBefore
        : entry.canRaise
          ? Math.min(
              entry.toCall + Math.max(entry.potBefore, bb * 2),
              entry.maxRaiseTo - entry.committedBefore,
            )
          : null;
```

(`gradePostflopDecision`'s spot already accepts `raiseCost: number | null` — no change to `grade.ts`.)

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/engine/hand.test.ts src/grading/gradeHand.test.ts`
Expected: ALL PASS. If any pre-existing gradeHand fixture assertion fails, STOP and report to the orchestrator with the diff — do not adjust fixtures yourself.

- [ ] **Step 5: Commit**

```bash
git add src/engine/hand.ts src/grading/gradeHand.ts src/engine/hand.test.ts src/grading/gradeHand.test.ts
git commit -m "feat(engine): record stackBehind/canRaise/maxRaiseTo in LogEntry; legal raise model in gradeHand"
```

---

### Task 2: Web Worker wrapper (protocol, handlers, worker, client) [haiku]

**Files:**
- Create: `app/src/worker/protocol.ts`
- Create: `app/src/worker/handlers.ts`
- Create: `app/src/worker/gradeWorker.ts`
- Create: `app/src/worker/gradeClient.ts`
- Test: `app/src/worker/handlers.test.ts`

**Interfaces:**
- Consumes: `gradeHand(finished, heroSeat, villain, iterations, rng)` from `../grading/gradeHand`; `equityVsRange(hero, board, range, iterations, rng)` from `../grading/equity`; `mulberry32` from `../engine/cards`.
- Produces: `class GradeClient` with `gradeHand(state, heroSeat, villain, iterations, seed): Promise<GradedDecision[] | null>` and `equity(hero, board, range, iterations, seed): Promise<number | null>`. **All failures resolve `null`** (never reject) — consumed by `useGame` (Task 5).

- [ ] **Step 1: Write the failing test**

Create `app/src/worker/handlers.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { applyAction, startHand } from '../engine/hand';
import { cardFromString } from '../engine/cards';
import { PERSONAS } from '../personas/persona';
import { handleRequest } from './handlers';

function finishedHand() {
  let s = startHand({ buttonSeat: 0, stacks: [1000, 1000], smallBlind: 5, bigBlind: 10, seed: 3 });
  s = applyAction(s, { type: 'fold' }); // hero folds the button
  return s;
}

describe('handleRequest', () => {
  it('grades a finished hand', () => {
    const res = handleRequest({
      id: 1, kind: 'gradeHand', state: finishedHand(), heroSeat: 0,
      villain: PERSONAS.balanced, iterations: 100, seed: 5,
    });
    expect(res.ok).toBe(true);
    if (res.ok && res.kind === 'gradeHand') {
      expect(res.result.length).toBeGreaterThan(0);
      expect(res.result[0].street).toBe('preflop');
    }
  });

  it('computes equity vs a single known combo', () => {
    const res = handleRequest({
      id: 2, kind: 'equity',
      hero: [cardFromString('As'), cardFromString('Ah')],
      board: [],
      range: [{ cards: [cardFromString('7c'), cardFromString('2d')], weight: 1 }],
      iterations: 300, seed: 11,
    });
    expect(res.ok).toBe(true);
    if (res.ok && res.kind === 'equity') expect(res.result).toBeGreaterThan(0.7);
  });

  it('returns an error envelope instead of throwing', () => {
    const live = startHand({ buttonSeat: 0, stacks: [1000, 1000], smallBlind: 5, bigBlind: 10, seed: 3 });
    const res = handleRequest({
      id: 3, kind: 'gradeHand', state: live, heroSeat: 0,
      villain: PERSONAS.balanced, iterations: 100, seed: 5,
    });
    expect(res.ok).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/worker/handlers.test.ts`
Expected: FAIL — cannot resolve `./handlers`.

- [ ] **Step 3: Implement**

Create `app/src/worker/protocol.ts`:

```ts
import type { Card } from '../engine/cards';
import type { HandState, Seat } from '../engine/hand';
import type { PersonaParams } from '../personas/persona';
import type { WeightedCombo } from '../personas/ranges';
import type { GradedDecision } from '../grading/gradeHand';

export interface GradeHandRequest {
  id: number;
  kind: 'gradeHand';
  state: HandState; // finished hand; plain data, structured-cloneable
  heroSeat: Seat;
  villain: PersonaParams;
  iterations: number;
  seed: number;
}

export interface EquityRequest {
  id: number;
  kind: 'equity';
  hero: [Card, Card];
  board: Card[];
  range: WeightedCombo[];
  iterations: number;
  seed: number;
}

export type WorkerRequest = GradeHandRequest | EquityRequest;

export type WorkerResponse =
  | { id: number; ok: true; kind: 'gradeHand'; result: GradedDecision[] }
  | { id: number; ok: true; kind: 'equity'; result: number }
  | { id: number; ok: false; error: string };
```

Create `app/src/worker/handlers.ts`:

```ts
import { mulberry32 } from '../engine/cards';
import { equityVsRange } from '../grading/equity';
import { gradeHand } from '../grading/gradeHand';
import type { WorkerRequest, WorkerResponse } from './protocol';

export function handleRequest(req: WorkerRequest): WorkerResponse {
  try {
    const rng = mulberry32(req.seed);
    if (req.kind === 'gradeHand') {
      const result = gradeHand(req.state, req.heroSeat, req.villain, req.iterations, rng);
      return { id: req.id, ok: true, kind: 'gradeHand', result };
    }
    const result = equityVsRange(req.hero, req.board, req.range, req.iterations, rng);
    return { id: req.id, ok: true, kind: 'equity', result };
  } catch (err) {
    return { id: req.id, ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}
```

Create `app/src/worker/gradeWorker.ts` (tsconfig lib is DOM, not WebWorker — use the narrow cast below verbatim):

```ts
import { handleRequest } from './handlers';
import type { WorkerRequest } from './protocol';

const ctx = self as unknown as {
  onmessage: ((e: MessageEvent<WorkerRequest>) => void) | null;
  postMessage: (msg: unknown) => void;
};

ctx.onmessage = (e) => {
  ctx.postMessage(handleRequest(e.data));
};
```

Create `app/src/worker/gradeClient.ts`:

```ts
import type { Card } from '../engine/cards';
import type { HandState, Seat } from '../engine/hand';
import type { PersonaParams } from '../personas/persona';
import type { WeightedCombo } from '../personas/ranges';
import type { GradedDecision } from '../grading/gradeHand';
import type { WorkerRequest, WorkerResponse } from './protocol';

const TIMEOUT_MS = 5000;

// Wraps the grading Web Worker. Every failure path resolves to null so the UI
// degrades gracefully (hand playable ungraded) instead of blocking play.
export class GradeClient {
  private worker: Worker | null = null;
  private nextId = 1;
  private pending = new Map<number, (r: WorkerResponse | null) => void>();

  constructor() {
    if (typeof Worker === 'undefined') return; // e.g. test env: degraded mode
    try {
      this.worker = new Worker(new URL('./gradeWorker.ts', import.meta.url), { type: 'module' });
      this.worker.onmessage = (e: MessageEvent<WorkerResponse>) => {
        const resolve = this.pending.get(e.data.id);
        if (resolve) {
          this.pending.delete(e.data.id);
          resolve(e.data);
        }
      };
      this.worker.onerror = () => this.failAll();
    } catch {
      this.worker = null;
    }
  }

  private failAll(): void {
    for (const resolve of this.pending.values()) resolve(null);
    this.pending.clear();
  }

  private send(req: WorkerRequest): Promise<WorkerResponse | null> {
    if (!this.worker) return Promise.resolve(null);
    return new Promise((resolve) => {
      const timer = setTimeout(() => {
        this.pending.delete(req.id);
        resolve(null);
      }, TIMEOUT_MS);
      this.pending.set(req.id, (r) => {
        clearTimeout(timer);
        resolve(r);
      });
      this.worker!.postMessage(req);
    });
  }

  async gradeHand(
    state: HandState, heroSeat: Seat, villain: PersonaParams, iterations: number, seed: number,
  ): Promise<GradedDecision[] | null> {
    const r = await this.send({ id: this.nextId++, kind: 'gradeHand', state, heroSeat, villain, iterations, seed });
    return r && r.ok && r.kind === 'gradeHand' ? r.result : null;
  }

  async equity(
    hero: [Card, Card], board: Card[], range: WeightedCombo[], iterations: number, seed: number,
  ): Promise<number | null> {
    const r = await this.send({ id: this.nextId++, kind: 'equity', hero, board, range, iterations, seed });
    return r && r.ok && r.kind === 'equity' ? r.result : null;
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/worker/handlers.test.ts`
Expected: 3 PASS.

- [ ] **Step 5: Commit**

```bash
git add src/worker
git commit -m "feat(worker): grading web worker with plain-data protocol and null-degrading client"
```

---

### Task 3: Session logic — gameMachine.ts and stats.ts [haiku]

**Files:**
- Create: `app/src/ui/gameMachine.ts`
- Create: `app/src/ui/stats.ts`
- Test: `app/src/ui/gameMachine.test.ts`

**Interfaces:**
- Consumes: `HandConfig`, `HandResult`, `HandState`, `Seat` types and `legalActions` from `../engine/hand`.
- Produces (consumed by Tasks 5–10):
  - `Mode`, `PersonaKey`, `Session`, `HERO_SEAT`, `VILLAIN_SEAT`, `SMALL_BLIND`, `BIG_BLIND`, `START_STACK`
  - `newSession(mode, personaKey, baseSeed): Session`
  - `dealHand(s): { session: Session; cfg: HandConfig }`
  - `applyHandResult(s, r): Session`
  - `BET_PRESETS`, `presetRaiseTo(state, fraction): number`
  - `SessionStats`, `emptyStats()`, `accumulate(stats, grades)`, `accuracy(stats)`

- [ ] **Step 1: Write the failing test**

Create `app/src/ui/gameMachine.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { applyAction, startHand } from '../engine/hand';
import {
  BET_PRESETS, START_STACK, applyHandResult, dealHand, newSession, presetRaiseTo,
} from './gameMachine';
import { accumulate, accuracy, emptyStats } from './stats';

describe('session', () => {
  it('training mode resets stacks and alternates the button each deal', () => {
    const s0 = newSession('training', 'balanced', 123);
    const d1 = dealHand(s0);
    expect(d1.cfg.buttonSeat).toBe(0);
    expect(d1.cfg.stacks).toEqual([START_STACK, START_STACK]);
    const afterLoss = applyHandResult(d1.session, {
      winner: 1, potAwarded: 200, showdown: false, stacks: [9900, 10100],
    });
    const d2 = dealHand(afterLoss);
    expect(d2.cfg.buttonSeat).toBe(1);
    expect(d2.cfg.stacks).toEqual([START_STACK, START_STACK]); // reset
    expect(d2.cfg.seed).not.toBe(d1.cfg.seed);
  });

  it('match mode carries stacks and ends when a stack hits zero', () => {
    const s0 = newSession('match', 'nit', 5);
    const d1 = dealHand(s0);
    const busted = applyHandResult(d1.session, {
      winner: 0, potAwarded: 20000, showdown: true, stacks: [20000, 0],
    });
    expect(busted.matchOver).toBe(true);
    expect(() => dealHand(busted)).toThrow();
    const alive = applyHandResult(d1.session, {
      winner: 0, potAwarded: 400, showdown: false, stacks: [10200, 9800],
    });
    const d2 = dealHand(alive);
    expect(d2.cfg.stacks).toEqual([10200, 9800]); // carried
  });
});

describe('presetRaiseTo', () => {
  it('computes a clamped pot-fraction raise', () => {
    // BTN opens preflop: pot 15 (SB5+BB10), toCall 5.
    const s = startHand({ buttonSeat: 0, stacks: [1000, 1000], smallBlind: 5, bigBlind: 10, seed: 1 });
    // pot preset: committed 5 + call 5 + 1.0 * (15 + 5) = 30
    expect(presetRaiseTo(s, 1)).toBe(30);
    // clamped up to the min-raise when the fraction is tiny
    expect(presetRaiseTo(s, 0.01)).toBe(20);
    // clamped down to all-in for a huge fraction
    expect(presetRaiseTo(s, 200)).toBe(1000);
  });

  it('returns 0 when raising is illegal', () => {
    let s = startHand({ buttonSeat: 0, stacks: [1000, 1000], smallBlind: 5, bigBlind: 10, seed: 1 });
    s = applyAction(s, { type: 'raise', to: 1000 }); // shove; opponent cannot raise
    expect(presetRaiseTo(s, 0.5)).toBe(0);
  });

  it('exposes the four spec presets', () => {
    expect(BET_PRESETS.map((p) => p.label)).toEqual(['33%', '50%', '75%', 'Pot']);
  });
});

describe('stats', () => {
  it('accumulates labels and EV lost across hands', () => {
    let st = emptyStats();
    st = accumulate(st, [
      { street: 'preflop', logIndex: 0, grade: { label: 'best', recommended: 'raise', actionTaken: 'raise', explanation: '' } },
      {
        street: 'flop', logIndex: 2,
        grade: {
          label: 'mistake', evLost: 180, bestAction: 'fold', actionTaken: 'call',
          equity: 0.19, requiredEquity: 0.22, evByAction: { fold: 0, call: -180, raise: null },
          explanation: '',
        },
      },
    ]);
    expect(st.decisions).toBe(2);
    expect(st.best).toBe(1);
    expect(st.mistakes).toBe(1);
    expect(st.evLostTotal).toBe(180);
    expect(accuracy(st)).toBeCloseTo(0.5);
  });
});
```

(If the `evByAction`/`DecisionGrade` object literal above fails typecheck against `grade.ts`'s actual field names, STOP and report — do not improvise a different shape.)

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/ui/gameMachine.test.ts`
Expected: FAIL — cannot resolve `./gameMachine`.

- [ ] **Step 3: Implement**

Create `app/src/ui/gameMachine.ts`:

```ts
import type { HandConfig, HandResult, HandState, Seat } from '../engine/hand';
import { legalActions } from '../engine/hand';

export type Mode = 'training' | 'match';
export type PersonaKey = 'nit' | 'maniac' | 'station' | 'balanced';

export const HERO_SEAT: Seat = 0;
export const VILLAIN_SEAT: Seat = 1;
export const SMALL_BLIND = 50;
export const BIG_BLIND = 100;
export const START_STACK = 10_000; // 100 BB

export interface Session {
  mode: Mode;
  personaKey: PersonaKey;
  buttonSeat: Seat; // button for the NEXT deal; alternates each hand
  stacks: [number, number];
  handNumber: number; // deals so far; 0 before the first deal
  baseSeed: number;
  matchOver: boolean;
}

export function newSession(mode: Mode, personaKey: PersonaKey, baseSeed: number): Session {
  return {
    mode, personaKey,
    buttonSeat: HERO_SEAT,
    stacks: [START_STACK, START_STACK],
    handNumber: 0,
    baseSeed,
    matchOver: false,
  };
}

export function dealHand(s: Session): { session: Session; cfg: HandConfig } {
  if (s.matchOver) throw new Error('match is over');
  const stacks: [number, number] =
    s.mode === 'training' ? [START_STACK, START_STACK] : [s.stacks[0], s.stacks[1]];
  const cfg: HandConfig = {
    buttonSeat: s.buttonSeat,
    stacks,
    smallBlind: SMALL_BLIND,
    bigBlind: BIG_BLIND,
    seed: (s.baseSeed + s.handNumber * 0x9e3779b9) >>> 0,
  };
  const session: Session = {
    ...s,
    stacks,
    handNumber: s.handNumber + 1,
    buttonSeat: s.buttonSeat === 0 ? 1 : 0,
  };
  return { session, cfg };
}

export function applyHandResult(s: Session, r: HandResult): Session {
  const stacks: [number, number] = [r.stacks[0], r.stacks[1]];
  const matchOver = s.mode === 'match' && (stacks[0] === 0 || stacks[1] === 0);
  return { ...s, stacks, matchOver };
}

export const BET_PRESETS = [
  { label: '33%', fraction: 0.33 },
  { label: '50%', fraction: 0.5 },
  { label: '75%', fraction: 0.75 },
  { label: 'Pot', fraction: 1 },
] as const;

// Raise-to for an "X% of pot" bet: call, then add X% of the pot after the call.
// Clamped to the legal [minRaiseTo, maxRaiseTo] window; 0 when raising is illegal.
export function presetRaiseTo(state: HandState, fraction: number): number {
  const la = legalActions(state);
  if (!la.canRaise) return 0;
  const me = state.toAct;
  const potBefore = state.pot + state.committed[0] + state.committed[1];
  const potAfterCall = potBefore + la.callAmount;
  const target = state.committed[me] + la.callAmount + Math.round(fraction * potAfterCall);
  return Math.min(la.maxRaiseTo, Math.max(la.minRaiseTo, target));
}
```

Create `app/src/ui/stats.ts`:

```ts
import type { GradedDecision } from '../grading/gradeHand';

export interface SessionStats {
  decisions: number;
  best: number;
  okay: number;
  mistakes: number;
  evLostTotal: number; // preflop mistakes contribute 0 in v1 (chart grades carry no EV)
}

export const emptyStats = (): SessionStats => ({
  decisions: 0, best: 0, okay: 0, mistakes: 0, evLostTotal: 0,
});

export function accumulate(stats: SessionStats, grades: GradedDecision[]): SessionStats {
  const next = { ...stats };
  for (const g of grades) {
    next.decisions++;
    if (g.grade.label === 'best') next.best++;
    else if (g.grade.label === 'okay') next.okay++;
    else next.mistakes++;
    next.evLostTotal += 'evLost' in g.grade ? g.grade.evLost : 0;
  }
  return next;
}

export const accuracy = (s: SessionStats): number =>
  s.decisions === 0 ? 1 : (s.best + s.okay) / s.decisions;
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/ui/gameMachine.test.ts`
Expected: ALL PASS.

- [ ] **Step 5: Commit**

```bash
git add src/ui/gameMachine.ts src/ui/stats.ts src/ui/gameMachine.test.ts
git commit -m "feat(ui): session machine (training/match), bet presets, session stats"
```

---

### Task 4: UI foundation — theme tokens, card/chip primitives, sound [haiku]

**Files:**
- Modify: `app/package.json` (dev deps via npm install)
- Create: `app/src/ui/theme.css`
- Create: `app/src/ui/CardView.tsx`
- Create: `app/src/ui/ChipStack.tsx`
- Create: `app/src/ui/sound.ts`
- Test: `app/src/ui/CardView.test.tsx`

**Interfaces:**
- Produces (consumed by Tasks 6–10):
  - `<CardView card?: Card; faceDown?: boolean; dealt?: boolean />`
  - `<ChipStack amount: number; label?: string />`
  - `sound.setSoundEnabled(v: boolean)`, `sound.soundEnabled()`, and effects `cardSlide()`, `cardFlip()`, `chipClink()`, `potWin()`, `bigPotSting()`, `mistakeSting()` — all no-ops when disabled or no AudioContext.
  - `theme.css` custom properties (`--felt`, `--gold`, `--cream`, `--ink`, `--red`, `--panel`, `--panel-edge`, `--muted`, `--font-display`, `--font-body`, `--font-mono`) plus `.card*`, `.chipstack`, and keyframes `deal-in`, `flip-in`, `chip-in`.

- [ ] **Step 1: Install dev-only test deps**

Run (from `app/`): `npm install -D jsdom @testing-library/react`
Expected: both added to devDependencies, no runtime deps touched.

- [ ] **Step 2: Write the failing test**

Create `app/src/ui/CardView.test.tsx`:

```tsx
// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { cardFromString } from '../engine/cards';
import { CardView } from './CardView';

describe('CardView', () => {
  it('renders rank and suit for a face-up card', () => {
    render(<CardView card={cardFromString('Ah')} />);
    const el = screen.getByLabelText('Ah');
    expect(el.textContent).toContain('A');
    expect(el.textContent).toContain('♥');
    expect(el.className).toContain('red');
  });

  it('renders T as 10 and black suits without the red class', () => {
    render(<CardView card={cardFromString('Ts')} />);
    const el = screen.getByLabelText('Ts');
    expect(el.textContent).toContain('10');
    expect(el.className).not.toContain('red');
  });

  it('renders a face-down back', () => {
    render(<CardView faceDown card={cardFromString('Ah')} />);
    expect(screen.getByLabelText('face-down card').className).toContain('card-back');
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `npx vitest run src/ui/CardView.test.tsx`
Expected: FAIL — cannot resolve `./CardView`.

- [ ] **Step 4: Implement**

Create `app/src/ui/CardView.tsx`:

```tsx
import type { Card } from '../engine/cards';
import { RANKS, SUITS, rankOf, suitOf } from '../engine/cards';

const SUIT_GLYPHS = ['♣', '♦', '♥', '♠']; // index-aligned with SUITS 'cdhs'
const SUIT_RED = [false, true, true, false];

export function CardView({
  card,
  faceDown = false,
  dealt = false,
}: {
  card?: Card;
  faceDown?: boolean;
  dealt?: boolean;
}) {
  if (faceDown || card === undefined) {
    return <div className={`card card-back${dealt ? ' dealt' : ''}`} aria-label="face-down card" />;
  }
  const r = RANKS[rankOf(card)];
  const s = suitOf(card);
  return (
    <div
      className={`card card-face${SUIT_RED[s] ? ' red' : ''}${dealt ? ' dealt' : ''}`}
      aria-label={`${r}${SUITS[s]}`}
    >
      <span className="card-rank">{r === 'T' ? '10' : r}</span>
      <span className="card-suit">{SUIT_GLYPHS[s]}</span>
    </div>
  );
}
```

Create `app/src/ui/ChipStack.tsx`:

```tsx
export function ChipStack({ amount, label }: { amount: number; label?: string }) {
  if (amount <= 0) return null;
  const chips = Math.max(1, Math.min(8, Math.round(Math.log2(amount / 50 + 1))));
  return (
    <div className="chipstack" aria-label={`${amount.toLocaleString()} chips${label ? ` ${label}` : ''}`}>
      <div className="chips">
        {Array.from({ length: chips }, (_, i) => (
          <div key={i} className="chip" style={{ bottom: i * 4 }} />
        ))}
      </div>
      <span className="chip-amount">
        {label ? `${label} ` : ''}
        {amount.toLocaleString()}
      </span>
    </div>
  );
}
```

Create `app/src/ui/sound.ts`:

```ts
// Synthesized WebAudio sound design — no asset files. All effects are silent
// no-ops when sound is toggled off or AudioContext is unavailable (tests).
let enabled = true;
let ctx: AudioContext | null = null;

export function setSoundEnabled(v: boolean): void {
  enabled = v;
}

export function soundEnabled(): boolean {
  return enabled;
}

function audio(): AudioContext | null {
  if (!enabled || typeof AudioContext === 'undefined') return null;
  ctx ??= new AudioContext();
  if (ctx.state === 'suspended') void ctx.resume();
  return ctx;
}

function tone(freq: number, dur: number, type: OscillatorType, peak: number, when = 0): void {
  const ac = audio();
  if (!ac) return;
  const t0 = ac.currentTime + when;
  const osc = ac.createOscillator();
  const gain = ac.createGain();
  osc.type = type;
  osc.frequency.value = freq;
  gain.gain.setValueAtTime(0, t0);
  gain.gain.linearRampToValueAtTime(peak, t0 + 0.01);
  gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  osc.connect(gain).connect(ac.destination);
  osc.start(t0);
  osc.stop(t0 + dur + 0.05);
}

function noise(dur: number, peak: number, filterFreq: number): void {
  const ac = audio();
  if (!ac) return;
  const len = Math.floor(ac.sampleRate * dur);
  const buf = ac.createBuffer(1, len, ac.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
  const src = ac.createBufferSource();
  src.buffer = buf;
  const filter = ac.createBiquadFilter();
  filter.type = 'bandpass';
  filter.frequency.value = filterFreq;
  const gain = ac.createGain();
  gain.gain.value = peak;
  src.connect(filter).connect(gain).connect(ac.destination);
  src.start();
}

export const cardSlide = (): void => noise(0.12, 0.25, 2400);
export const cardFlip = (): void => noise(0.07, 0.3, 3600);
export const chipClink = (): void => {
  tone(2200, 0.06, 'triangle', 0.12);
  tone(2800, 0.05, 'triangle', 0.08, 0.03);
};
export const potWin = (): void => {
  tone(523, 0.18, 'sine', 0.14);
  tone(659, 0.18, 'sine', 0.14, 0.09);
  tone(784, 0.3, 'sine', 0.14, 0.18);
};
export const bigPotSting = (): void => {
  potWin();
  tone(1047, 0.4, 'sine', 0.1, 0.27);
};
export const mistakeSting = (): void => {
  tone(220, 0.25, 'sawtooth', 0.06);
  tone(208, 0.3, 'sawtooth', 0.05, 0.05);
};
```

Create `app/src/ui/theme.css`:

```css
/* ── Midnight Casino design tokens ─────────────────────────────── */
:root {
  --bg: #07090b;
  --felt: #123524;
  --felt-dark: #0b2318;
  --gold: #c9a227;
  --gold-soft: #e6c968;
  --cream: #f3ead7;
  --ink: #17140e;
  --red: #a4243b;
  --muted: #8b937e;
  --panel: #101410;
  --panel-edge: #2b3125;
  --good: #7fb069;
  --font-display: 'Palatino Linotype', Palatino, 'Book Antiqua', Georgia, serif;
  --font-body: Georgia, 'Times New Roman', serif;
  --font-mono: 'SF Mono', Menlo, Consolas, monospace;
}

/* ── Cards ─────────────────────────────────────────────────────── */
.card {
  width: 64px;
  height: 92px;
  border-radius: 7px;
  display: inline-flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 2px;
  box-shadow: 0 4px 10px rgba(0, 0, 0, 0.55);
  user-select: none;
}

.card-face {
  background: linear-gradient(160deg, #fbf5e6, var(--cream));
  border: 1px solid #d8ccb0;
  color: var(--ink);
  font-family: var(--font-display);
}

.card-face.red {
  color: var(--red);
}

.card-rank {
  font-size: 26px;
  font-weight: 700;
  line-height: 1;
}

.card-suit {
  font-size: 22px;
  line-height: 1;
}

.card-back {
  background:
    repeating-linear-gradient(45deg, rgba(201, 162, 39, 0.16) 0 6px, transparent 6px 12px),
    linear-gradient(160deg, #14233d, #0c1626);
  border: 1px solid var(--gold);
}

.card-slot {
  background: rgba(0, 0, 0, 0.25);
  border: 1px dashed rgba(201, 162, 39, 0.25);
  box-shadow: none;
}

/* ── Chips ─────────────────────────────────────────────────────── */
.chipstack {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
}

.chipstack .chips {
  position: relative;
  width: 34px;
  height: 44px;
}

.chip {
  position: absolute;
  left: 0;
  width: 32px;
  height: 10px;
  border-radius: 50%;
  background: radial-gradient(circle at 50% 35%, #d8b544, var(--gold) 70%);
  border: 1px solid #6e5714;
  animation: chip-in 260ms cubic-bezier(0.2, 0.8, 0.3, 1) both;
}

.chip-amount {
  font-family: var(--font-mono);
  font-size: 12px;
  color: var(--gold-soft);
  text-shadow: 0 1px 2px rgba(0, 0, 0, 0.8);
  white-space: nowrap;
}

/* ── Motion ────────────────────────────────────────────────────── */
@keyframes deal-in {
  from {
    transform: translate(-30vw, -22vh) rotate(-18deg);
    opacity: 0;
  }
  55% {
    opacity: 1;
  }
  to {
    transform: none;
    opacity: 1;
  }
}

.card.dealt {
  animation: deal-in 420ms cubic-bezier(0.2, 0.7, 0.3, 1) both;
}

@keyframes flip-in {
  from {
    transform: rotateY(88deg);
  }
  to {
    transform: rotateY(0);
  }
}

@keyframes chip-in {
  from {
    transform: translateY(16px) scale(0.85);
    opacity: 0;
  }
  to {
    transform: none;
    opacity: 1;
  }
}

@keyframes glow-pulse {
  0%, 100% {
    box-shadow: 0 0 0 0 rgba(201, 162, 39, 0.0);
  }
  50% {
    box-shadow: 0 0 18px 4px rgba(201, 162, 39, 0.45);
  }
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npx vitest run src/ui/CardView.test.tsx`
Expected: 3 PASS.

- [ ] **Step 6: Commit**

```bash
git add package.json package-lock.json src/ui/theme.css src/ui/CardView.tsx src/ui/ChipStack.tsx src/ui/sound.ts src/ui/CardView.test.tsx
git commit -m "feat(ui): Midnight Casino tokens, card/chip primitives, WebAudio sound design"
```

---

### Task 5: useGame hook — the whole game loop [haiku]

**Files:**
- Create: `app/src/ui/useGame.ts`
- Test: `app/src/ui/useGame.test.tsx`

**Interfaces:**
- Consumes: Task 2 `GradeClient`; Task 3 gameMachine exports; `personaAction`, `PERSONAS` from `../personas/persona`; engine `startHand`/`applyAction`/`legalActions`; `mulberry32`.
- Produces (consumed by Tasks 6–10): `Phase`, `Game` interface, `useGame(client): Game`, constants `VILLAIN_DELAY_MS`, `RUNOUT_STEP_MS`.

- [ ] **Step 1: Write the failing test**

Create `app/src/ui/useGame.test.tsx`:

```tsx
// @vitest-environment jsdom
import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { GradeClient } from '../worker/gradeClient';
import { useGame } from './useGame';

describe('useGame', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('plays a hand end to end with graceful grading degradation', async () => {
    const { result } = renderHook(() => useGame(new GradeClient()));
    expect(result.current.phase).toBe('menu');

    act(() => result.current.startSession('training', 'balanced'));
    // Hand 1: hero (seat 0) has the button and acts first preflop.
    expect(result.current.phase).toBe('hero');
    expect(result.current.legal!.canFold).toBe(true);

    act(() => result.current.act({ type: 'fold' }));
    expect(result.current.phase).toBe('over');
    expect(result.current.hand!.result!.winner).toBe(1);

    // jsdom has no Worker: grading must degrade to failed, not hang or throw.
    await act(async () => {
      await vi.runAllTimersAsync();
    });
    expect(result.current.grades).toBeNull();
    expect(result.current.gradesFailed).toBe(true);

    act(() => result.current.nextHand());
    // Hand 2: button alternates to the villain, who now acts first.
    expect(result.current.phase).toBe('villain');
    expect(result.current.session!.handNumber).toBe(2);
  });

  it('ignores act() outside the hero phase', () => {
    const { result } = renderHook(() => useGame(new GradeClient()));
    act(() => result.current.act({ type: 'fold' }));
    expect(result.current.phase).toBe('menu');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/ui/useGame.test.tsx`
Expected: FAIL — cannot resolve `./useGame`.

- [ ] **Step 3: Implement**

Create `app/src/ui/useGame.ts`:

```ts
import { useCallback, useEffect, useRef, useState } from 'react';
import type { Card } from '../engine/cards';
import { mulberry32 } from '../engine/cards';
import type { Action, HandState, LegalActions } from '../engine/hand';
import { applyAction, legalActions, startHand } from '../engine/hand';
import { PERSONAS, personaAction } from '../personas/persona';
import type { GradedDecision } from '../grading/gradeHand';
import type { GradeClient } from '../worker/gradeClient';
import type { Mode, PersonaKey, Session } from './gameMachine';
import { HERO_SEAT, VILLAIN_SEAT, applyHandResult, dealHand, newSession } from './gameMachine';

export type Phase = 'menu' | 'hero' | 'villain' | 'runout' | 'over';

export interface Game {
  session: Session | null;
  hand: HandState | null;
  visibleBoard: Card[]; // paced board — lags hand.board during dramatic runouts
  phase: Phase;
  legal: LegalActions | null;
  grades: GradedDecision[] | null; // null while pending or unavailable
  gradesFailed: boolean;
  race: { hero: number; villain: number } | null; // live equity during runouts
  startSession: (mode: Mode, personaKey: PersonaKey) => void;
  act: (a: Action) => void;
  nextHand: () => void;
}

export const VILLAIN_DELAY_MS = 750;
export const RUNOUT_STEP_MS = 1100;
const GRADE_ITERATIONS = 800;
const RACE_ITERATIONS = 400;

export function useGame(client: GradeClient): Game {
  const [session, setSession] = useState<Session | null>(null);
  const [hand, setHand] = useState<HandState | null>(null);
  const [visibleBoard, setVisibleBoard] = useState<Card[]>([]);
  const [ended, setEnded] = useState<'runout' | 'over' | null>(null);
  const [grades, setGrades] = useState<GradedDecision[] | null>(null);
  const [gradesFailed, setGradesFailed] = useState(false);
  const [race, setRace] = useState<{ hero: number; villain: number } | null>(null);
  const villainRng = useRef<() => number>(mulberry32(1));
  const timers = useRef<number[]>([]);

  useEffect(
    () => () => {
      timers.current.forEach((t) => clearTimeout(t));
    },
    [],
  );

  const phase: Phase = !hand
    ? 'menu'
    : hand.result
      ? (ended ?? 'over')
      : hand.toAct === HERO_SEAT
        ? 'hero'
        : 'villain';

  const legal = hand && !hand.result ? legalActions(hand) : null;

  const finishHand = useCallback(
    (finished: HandState, revealedBefore: number, sess: Session) => {
      setSession(applyHandResult(sess, finished.result!));
      client
        .gradeHand(finished, HERO_SEAT, PERSONAS[sess.personaKey], GRADE_ITERATIONS, finished.cfg.seed + 7)
        .then((g) => (g ? setGrades(g) : setGradesFailed(true)));

      const full = finished.board; // all 5 at showdown; partial after a fold
      if (finished.result!.showdown && revealedBefore < full.length) {
        // Dramatic all-in runout: reveal card by card with a live equity race.
        setEnded('runout');
        const hero = finished.holes[HERO_SEAT];
        const villain = finished.holes[VILLAIN_SEAT];
        const steps = full.length - revealedBefore;
        for (let i = 0; i <= steps; i++) {
          const k = revealedBefore + i;
          const t = window.setTimeout(() => {
            setVisibleBoard(full.slice(0, k));
            if (k < full.length) {
              client
                .equity(
                  hero,
                  full.slice(0, k),
                  [{ cards: [villain[0], villain[1]], weight: 1 }],
                  RACE_ITERATIONS,
                  finished.cfg.seed + 31 * (k + 1),
                )
                .then((e) => {
                  if (e !== null) setRace({ hero: e, villain: 1 - e });
                });
            } else {
              setEnded('over');
            }
          }, i * RUNOUT_STEP_MS);
          timers.current.push(t);
        }
      } else {
        setVisibleBoard(full);
        setEnded('over');
      }
    },
    [client],
  );

  const apply = useCallback(
    (a: Action) => {
      if (!hand || !session || hand.result) return;
      const revealedBefore = visibleBoard.length;
      const next = applyAction(hand, a);
      setHand(next);
      if (next.result) {
        finishHand(next, revealedBefore, session);
      } else {
        setVisibleBoard(next.board);
      }
    },
    [hand, session, visibleBoard, finishHand],
  );

  // The villain acts on a short dramatic delay whenever it is their turn.
  useEffect(() => {
    if (!hand || !session || hand.result || hand.toAct === HERO_SEAT) return;
    const t = window.setTimeout(() => {
      const a = personaAction(hand, VILLAIN_SEAT, PERSONAS[session.personaKey], villainRng.current);
      apply(a);
    }, VILLAIN_DELAY_MS);
    return () => clearTimeout(t);
  }, [hand, session, apply]);

  const deal = useCallback((sess: Session) => {
    const { session: s2, cfg } = dealHand(sess);
    villainRng.current = mulberry32((cfg.seed ^ 0x5bd1e995) >>> 0);
    setSession(s2);
    setHand(startHand(cfg));
    setVisibleBoard([]);
    setEnded(null);
    setRace(null);
    setGrades(null);
    setGradesFailed(false);
  }, []);

  const startSession = useCallback(
    (mode: Mode, personaKey: PersonaKey) => {
      deal(newSession(mode, personaKey, Date.now() >>> 0));
    },
    [deal],
  );

  const nextHand = useCallback(() => {
    if (!session || phase !== 'over' || session.matchOver) return;
    deal(session);
  }, [session, phase, deal]);

  const act = useCallback(
    (a: Action) => {
      if (phase === 'hero') apply(a);
    },
    [phase, apply],
  );

  return {
    session, hand, visibleBoard, phase, legal, grades, gradesFailed, race,
    startSession, act, nextHand,
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/ui/useGame.test.tsx`
Expected: 2 PASS. Also re-run `npx vitest run src/ui/gameMachine.test.ts` (still green).

- [ ] **Step 5: Commit**

```bash
git add src/ui/useGame.ts src/ui/useGame.test.tsx
git commit -m "feat(ui): useGame hook — dealing, villain pacing, dramatic runouts, worker grading"
```

---

### Task 6: Table component — felt, seats, board, pot [sonnet]

**Files:**
- Create: `app/src/ui/Table.tsx`
- Create: `app/src/ui/Table.css` (imported by Table.tsx; MUST build on `theme.css` tokens)
- Test: `app/src/ui/Table.test.tsx`

**Interfaces:**
- Consumes: `Game` from `./useGame`; `CardView`, `ChipStack` from Task 4; `PERSONAS` from `../personas/persona`; `BIG_BLIND`, `HERO_SEAT`, `VILLAIN_SEAT` from `./gameMachine`.
- Produces: `export function Table({ game }: { game: Game })` — mounted by the App shell (Task 10). Renders nothing when `game.hand === null`.

**Requirements (all must hold):**
1. Elliptical felt: radial gradient `--felt` → `--felt-dark`, thick `--gold` rail border, cinematic vignette (inset box-shadow or overlay). Page-level background stays `--bg`.
2. Villain seat top-center: persona name (`PERSONAS[session.personaKey].name`, font `--font-display`), stack in chips AND big blinds (`(stack / BIG_BLIND).toFixed(1)` BB), two hole cards — `faceDown` unless `hand.result !== null && hand.result.showdown`. Stacks shown from `hand.result ? hand.result.stacks[seat] : hand.stacks[seat]`.
3. Hero seat bottom-center: same info, hole cards always face-up, `dealt` animation on a fresh hand.
4. Board row center: render `game.visibleBoard` (NOT `hand.board` — visibleBoard is the runout-paced view) with `dealt` cards plus empty `.card-slot` placeholders up to 5.
5. Pot display between board and hero: `ChipStack` with `hand.pot + hand.committed[0] + hand.committed[1]`; per-seat committed chips as smaller `ChipStack`s near each seat.
6. Dealer button: a small gold disc labeled "D" next to `hand.cfg.buttonSeat`'s seat.
7. Acting indicator: the seat whose turn it is (phase 'hero'/'villain') gets `animation: glow-pulse 1.6s infinite` (keyframe exists in theme.css).
8. Result banner when `hand.result` and phase is 'over': "You win N" / "<persona> wins N" / "Split pot" in `--gold-soft`, `--font-display`.
9. Equity race overlay when `phase === 'runout'`: centered translucent panel with two horizontal bars (hero gold, villain red) sized by `race.hero`/`race.villain`, percentage labels, transitions on width. Hidden when `race === null`.
10. No equity/odds/hints anywhere while `hand.result === null` (spec: play cold).
11. Sounds: call `sound.cardSlide()` in an effect when a new hand's hole cards mount, and `sound.cardFlip()` when `visibleBoard.length` increases (`import * as sound from './sound'`).

**Test (write exactly this file, `app/src/ui/Table.test.tsx`):**

```tsx
// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { applyAction, startHand } from '../engine/hand';
import type { Game } from './useGame';
import { Table } from './Table';

function gameFixture(overrides: Partial<Game>): Game {
  return {
    session: {
      mode: 'training', personaKey: 'balanced', buttonSeat: 1,
      stacks: [10000, 10000], handNumber: 1, baseSeed: 1, matchOver: false,
    },
    hand: null, visibleBoard: [], phase: 'hero', legal: null,
    grades: null, gradesFailed: false, race: null,
    startSession: () => {}, act: () => {}, nextHand: () => {},
    ...overrides,
  };
}

const cfg = { buttonSeat: 0 as const, stacks: [10000, 10000] as [number, number], smallBlind: 50, bigBlind: 100, seed: 8 };

describe('Table', () => {
  it('hides villain cards during a live hand and shows the pot', () => {
    const hand = startHand(cfg);
    render(<Table game={gameFixture({ hand, phase: 'hero' })} />);
    expect(screen.getAllByLabelText('face-down card')).toHaveLength(2);
    expect(screen.getByText('The Balanced Player')).toBeTruthy();
    expect(screen.getByLabelText(/150.*pot/i)).toBeTruthy(); // SB 50 + BB 100
  });

  it('shows a result banner when the hand is over', () => {
    let hand = startHand(cfg);
    hand = applyAction(hand, { type: 'fold' });
    render(<Table game={gameFixture({ hand, phase: 'over' })} />);
    expect(screen.getByText(/wins|You win|Split/i)).toBeTruthy();
  });

  it('renders the equity race during a runout', () => {
    let hand = startHand(cfg);
    hand = applyAction(hand, { type: 'raise', to: 10000 });
    hand = applyAction(hand, { type: 'call' });
    render(
      <Table game={gameFixture({ hand, phase: 'runout', visibleBoard: hand.board.slice(0, 3), race: { hero: 0.62, villain: 0.38 } })} />,
    );
    expect(screen.getByText(/62/)).toBeTruthy();
    expect(screen.getByText(/38/)).toBeTruthy();
  });
});
```

Steps: write test → `npx vitest run src/ui/Table.test.tsx` (fails) → implement `Table.tsx` + `Table.css` meeting ALL requirements → test passes → commit:

```bash
git add src/ui/Table.tsx src/ui/Table.css src/ui/Table.test.tsx
git commit -m "feat(ui): Midnight Casino table — felt, seats, board, pot, equity race overlay"
```

---

### Task 7: ActionBar — buttons, presets, F/C/R hotkeys [haiku]

**Files:**
- Create: `app/src/ui/ActionBar.tsx`
- Test: `app/src/ui/ActionBar.test.tsx`

**Interfaces:**
- Consumes: `Game` from `./useGame`; `BET_PRESETS`, `presetRaiseTo` from `./gameMachine`; `sound` from `./sound`.
- Produces: `export function ActionBar({ game }: { game: Game })` — mounted by App shell (Task 10). App shell unmounts it while the Replay Theater is open, so its hotkeys never fire there.

- [ ] **Step 1: Write the failing test**

Create `app/src/ui/ActionBar.test.tsx`:

```tsx
// @vitest-environment jsdom
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { startHand } from '../engine/hand';
import type { Action } from '../engine/hand';
import type { Game } from './useGame';
import { ActionBar } from './ActionBar';

const cfg = { buttonSeat: 0 as const, stacks: [10000, 10000] as [number, number], smallBlind: 50, bigBlind: 100, seed: 8 };

function heroGame(act: (a: Action) => void, nextHand = () => {}): Game {
  const hand = startHand(cfg);
  return {
    session: {
      mode: 'training', personaKey: 'balanced', buttonSeat: 1,
      stacks: [10000, 10000], handNumber: 1, baseSeed: 1, matchOver: false,
    },
    hand, visibleBoard: [], phase: 'hero',
    legal: { canFold: true, callAmount: 50, canRaise: true, minRaiseTo: 200, maxRaiseTo: 10000 },
    grades: null, gradesFailed: false, race: null,
    startSession: () => {}, act, nextHand,
  };
}

describe('ActionBar', () => {
  it('fires fold/call via buttons', () => {
    const act = vi.fn();
    render(<ActionBar game={heroGame(act)} />);
    fireEvent.click(screen.getByRole('button', { name: /fold/i }));
    expect(act).toHaveBeenCalledWith({ type: 'fold' });
    fireEvent.click(screen.getByRole('button', { name: /call 50/i }));
    expect(act).toHaveBeenCalledWith({ type: 'call' });
  });

  it('F/C hotkeys act, R raises to the default preset', () => {
    const act = vi.fn();
    render(<ActionBar game={heroGame(act)} />);
    fireEvent.keyDown(window, { key: 'f' });
    expect(act).toHaveBeenCalledWith({ type: 'fold' });
    fireEvent.keyDown(window, { key: 'c' });
    expect(act).toHaveBeenCalledWith({ type: 'call' });
    fireEvent.keyDown(window, { key: 'r' });
    // 50% preset on BTN preflop: committed 50 + call 50 + 0.5*(150+50) = 200
    expect(act).toHaveBeenCalledWith({ type: 'raise', to: 200 });
  });

  it('numeric hotkeys raise by preset; pot preset computes 350', () => {
    const act = vi.fn();
    render(<ActionBar game={heroGame(act)} />);
    fireEvent.keyDown(window, { key: '4' });
    // pot preset: 50 + 50 + 1.0*(150+50) = 300 -> but min-raise clamps apply; expected 300
    expect(act).toHaveBeenCalledWith({ type: 'raise', to: 300 });
  });

  it('N advances to the next hand when the hand is over', () => {
    const nextHand = vi.fn();
    const g = heroGame(() => {}, nextHand);
    render(<ActionBar game={{ ...g, phase: 'over', legal: null }} />);
    fireEvent.keyDown(window, { key: 'n' });
    expect(nextHand).toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/ui/ActionBar.test.tsx`
Expected: FAIL — cannot resolve `./ActionBar`.

- [ ] **Step 3: Implement**

Create `app/src/ui/ActionBar.tsx`:

```tsx
import { useEffect, useState } from 'react';
import { BET_PRESETS, presetRaiseTo } from './gameMachine';
import type { Game } from './useGame';
import * as sound from './sound';

const DEFAULT_PRESET = 1; // 50%

export function ActionBar({ game }: { game: Game }) {
  const { hand, legal, phase, act, nextHand } = game;
  const [raiseTo, setRaiseTo] = useState(0);

  // Reset the raise input to the default preset each time it's hero's turn.
  useEffect(() => {
    if (hand && legal?.canRaise) {
      setRaiseTo(presetRaiseTo(hand, BET_PRESETS[DEFAULT_PRESET].fraction));
    }
  }, [hand, legal]);

  const fold = () => {
    if (legal?.canFold) {
      sound.cardSlide();
      act({ type: 'fold' });
    }
  };
  const call = () => {
    if (legal) {
      if (legal.callAmount > 0) sound.chipClink();
      act({ type: 'call' });
    }
  };
  const raise = (to: number) => {
    if (legal?.canRaise && to > 0) {
      sound.chipClink();
      act({ type: 'raise', to });
    }
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement) return;
      const k = e.key.toLowerCase();
      if (phase === 'over') {
        if (k === 'n' || k === ' ') {
          e.preventDefault();
          nextHand();
        }
        return;
      }
      if (phase !== 'hero' || !hand || !legal) return;
      if (k === 'f') fold();
      else if (k === 'c') call();
      else if (k === 'r') raise(raiseTo);
      else if (k >= '1' && k <= '4' && legal.canRaise) {
        raise(presetRaiseTo(hand, BET_PRESETS[Number(k) - 1].fraction));
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  if (phase === 'over') {
    return (
      <div className="actionbar">
        <button type="button" className="btn btn-gold" onClick={nextHand}>
          Next hand <kbd>N</kbd>
        </button>
      </div>
    );
  }

  if (phase !== 'hero' || !hand || !legal) {
    return <div className="actionbar actionbar-idle" />;
  }

  return (
    <div className="actionbar">
      <button type="button" className="btn btn-fold" disabled={!legal.canFold} onClick={fold}>
        Fold <kbd>F</kbd>
      </button>
      <button type="button" className="btn btn-call" onClick={call}>
        {legal.callAmount > 0 ? `Call ${legal.callAmount.toLocaleString()}` : 'Check'} <kbd>C</kbd>
      </button>
      {legal.canRaise && (
        <div className="raise-group">
          {BET_PRESETS.map((p, i) => (
            <button
              key={p.label}
              type="button"
              className="btn btn-preset"
              onClick={() => raise(presetRaiseTo(hand, p.fraction))}
            >
              {p.label} <kbd>{i + 1}</kbd>
            </button>
          ))}
          <input
            type="number"
            className="raise-input"
            aria-label="raise to"
            min={legal.minRaiseTo}
            max={legal.maxRaiseTo}
            value={raiseTo}
            onChange={(e) => setRaiseTo(Number(e.target.value))}
          />
          <button
            type="button"
            className="btn btn-gold"
            onClick={() => raise(Math.min(legal.maxRaiseTo, Math.max(legal.minRaiseTo, raiseTo)))}
          >
            Raise <kbd>R</kbd>
          </button>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/ui/ActionBar.test.tsx`
Expected: 4 PASS. (If the `to: 300` expectation fails, verify `presetRaiseTo` math against Task 3's tests before touching anything; report a mismatch, don't fudge the number.)

- [ ] **Step 5: Commit**

```bash
git add src/ui/ActionBar.tsx src/ui/ActionBar.test.tsx
git commit -m "feat(ui): action bar with F/C/R hotkeys and 33/50/75/pot presets"
```

---

### Task 8: Side Ribbon — end-of-hand review panel [sonnet]

**Files:**
- Create: `app/src/ui/Ribbon.tsx`
- Create: `app/src/ui/Ribbon.css`
- Test: `app/src/ui/Ribbon.test.tsx`

**Interfaces:**
- Consumes: `GradedDecision` from `../grading/gradeHand` (`grade` is `DecisionGrade | PreflopGrade`; discriminate with `'recommended' in grade` for preflop); `SessionStats`, `accuracy` from `./stats`; `Phase` from `./useGame`.
- Produces:

```tsx
export interface RibbonProps {
  grades: GradedDecision[] | null;
  gradesFailed: boolean;
  stats: SessionStats;
  phase: Phase;
  matchOver: boolean;
  onOpenTheater: () => void;
}
export function Ribbon(props: RibbonProps): JSX.Element;
```

**Requirements:**
1. Fixed-width right panel (~320px), `--panel` background, `--panel-edge` border, always mounted beside the table (App shell lays it out). Serif display header "Review".
2. Session stats block at top, always visible: hands' decisions graded, accuracy as `Math.round(accuracy(stats) * 100)%`, total EV lost as whole chips. Use `--font-mono` for numbers.
3. Body by state, in priority order: phase not 'over'/'runout' and no grades → muted hint "Play the hand — review appears here when it ends."; `gradesFailed` → warning line "Grading unavailable for this hand — next hand will retry." in `--red`; grades pending (phase 'over', `grades === null`, not failed) → "Grading…" shimmer; grades present → one line item per `GradedDecision`.
4. Line item: street tag (capitalize), grade symbol ✓ (label 'best', `--good`), ~ ('okay', `--gold-soft`), ✗ ('mistake', `--red`), then text:
   - Preflop grade: `"raise — standard"` when best, else `"you: ${actionTaken} · chart: ${recommended}"`.
   - Postflop `DecisionGrade`: `"you: ${actionTaken} · best: ${bestAction}"` plus, when `evLost > 0`, ` (−${Math.round(evLost)})` in `--red`.
5. When grades are present, a gold "Replay Theater" button calling `onOpenTheater` with hint `<kbd>T</kbd>`; plus muted "Next hand <kbd>N</kbd>" hint (or "Match over" when `matchOver`).
6. Mistake lines get a subtle left border in `--red`; keep list scrollable (`overflow-y: auto`).

**Test (write exactly, `app/src/ui/Ribbon.test.tsx`):**

```tsx
// @vitest-environment jsdom
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { GradedDecision } from '../grading/gradeHand';
import { Ribbon } from './Ribbon';

const stats = { decisions: 4, best: 2, okay: 1, mistakes: 1, evLostTotal: 180 };

const grades: GradedDecision[] = [
  { street: 'preflop', logIndex: 0, grade: { label: 'best', recommended: 'raise', actionTaken: 'raise', explanation: 'chart' } },
  {
    street: 'flop', logIndex: 2,
    grade: {
      label: 'mistake', evLost: 180, bestAction: 'fold', actionTaken: 'call',
      equity: 0.19, requiredEquity: 0.22, evByAction: { fold: 0, call: -180, raise: null },
      explanation: 'needed 22%',
    },
  },
];

describe('Ribbon', () => {
  it('shows graded lines with symbols and EV lost', () => {
    render(<Ribbon grades={grades} gradesFailed={false} stats={stats} phase="over" matchOver={false} onOpenTheater={() => {}} />);
    expect(screen.getByText(/✓/)).toBeTruthy();
    expect(screen.getByText(/✗/)).toBeTruthy();
    expect(screen.getByText(/−180/)).toBeTruthy();
    expect(screen.getByText(/75%/)).toBeTruthy(); // (2+1)/4 accuracy
  });

  it('opens the replay theater', () => {
    const open = vi.fn();
    render(<Ribbon grades={grades} gradesFailed={false} stats={stats} phase="over" matchOver={false} onOpenTheater={open} />);
    fireEvent.click(screen.getByRole('button', { name: /replay theater/i }));
    expect(open).toHaveBeenCalled();
  });

  it('degrades gracefully when grading failed', () => {
    render(<Ribbon grades={null} gradesFailed={true} stats={stats} phase="over" matchOver={false} onOpenTheater={() => {}} />);
    expect(screen.getByText(/grading unavailable/i)).toBeTruthy();
  });

  it('shows no review content during a live hand', () => {
    render(<Ribbon grades={null} gradesFailed={false} stats={stats} phase="hero" matchOver={false} onOpenTheater={() => {}} />);
    expect(screen.getByText(/review appears here/i)).toBeTruthy();
  });
});
```

Steps: test → `npx vitest run src/ui/Ribbon.test.tsx` fails → implement → passes → commit:

```bash
git add src/ui/Ribbon.tsx src/ui/Ribbon.css src/ui/Ribbon.test.tsx
git commit -m "feat(ui): side ribbon end-of-hand review with session stats"
```

---

### Task 9: Replay Theater — scrubber, EV bars, equations [sonnet]

**Files:**
- Create: `app/src/ui/ReplayTheater.tsx`
- Create: `app/src/ui/ReplayTheater.css`
- Test: `app/src/ui/ReplayTheater.test.tsx`

**Interfaces:**
- Consumes: finished `HandState` (`hand.log: LogEntry[]` — each entry has `seat`, `street`, `action`, `toCall`, `potBefore`, `board`, and from Task 1 `stackBehind`/`canRaise`/`maxRaiseTo`); `GradedDecision[]`; `CardView`; `HERO_SEAT` from `./gameMachine`.
- Produces:

```tsx
export interface ReplayTheaterProps {
  hand: HandState; // hand.result !== null
  grades: GradedDecision[];
  personaName: string;
  onClose: () => void;
}
export function ReplayTheater(props: ReplayTheaterProps): JSX.Element;
```

**Requirements:**
1. Full-screen modal overlay (near-black scrim, centered `--panel` stage, gold-serif header "Replay Theater — Hand review"). Close on Esc and on a ✕ button.
2. Scrubber over `hand.log`: state `const [idx, setIdx] = useState(0)`. Prev/Next buttons plus ArrowLeft/ArrowRight keys. Step counter "Decision i of N". A final extra step (idx === log.length) shows the result summary (winner, pot awarded, showdown or fold).
3. Each step shows the reconstructed spot from `hand.log[idx]`: visible board (`entry.board` via CardView), pot `entry.potBefore`, both hole cards face-up (post-hand, all known), actor name (You / persona), and the action taken (`fold` / `call` / `raise to N`).
4. When a `GradedDecision` exists with `grade.logIndex === idx` (hero decisions only):
   - Preflop grade: show label symbol + `explanation` text; no EV bars (chart-based).
   - Postflop `DecisionGrade`: horizontal EV bar per action from `evByAction` — fold, call, and raise (omit the raise row when `evByAction.raise === null`, rendering the muted note "raise wasn't available"). Bar length proportional to `Math.abs(ev) / maxAbs` (guard maxAbs 0 → all bars minimal); positive EV bars in `--good`, negative in `--red`; the `bestAction` row highlighted with a `--gold` border and the taken action tagged "you". Numeric EV labels (chips, rounded) in `--font-mono`.
   - **The written equation:** render `grade.explanation` verbatim in a serif blockquote (this string already contains the plugged-in numbers from `grade.ts`) plus a mono sub-line `equity ${Math.round(equity * 100)}% vs required ${Math.round(requiredEquity * 100)}%`.
5. Villain steps show the action only — never grade the villain.
6. Steps with no grade show muted "No decision to grade here."

**Test (write exactly, `app/src/ui/ReplayTheater.test.tsx`):**

```tsx
// @vitest-environment jsdom
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { applyAction, startHand } from '../engine/hand';
import type { GradedDecision } from '../grading/gradeHand';
import { ReplayTheater } from './ReplayTheater';

function finishedHand() {
  let s = startHand({ buttonSeat: 0 as const, stacks: [10000, 10000] as [number, number], smallBlind: 50, bigBlind: 100, seed: 4 });
  s = applyAction(s, { type: 'call' }); // hero limp
  s = applyAction(s, { type: 'call' }); // bb check -> flop
  s = applyAction(s, { type: 'raise', to: 200 }); // villain bets
  s = applyAction(s, { type: 'fold' }); // hero folds
  return s;
}

const grades: GradedDecision[] = [
  { street: 'preflop', logIndex: 0, grade: { label: 'best', recommended: 'call', actionTaken: 'call', explanation: 'The chart agrees: call is standard here.' } },
  {
    street: 'flop', logIndex: 3,
    grade: {
      label: 'mistake', evLost: 120, bestAction: 'call', actionTaken: 'fold',
      equity: 0.4, requiredEquity: 0.25, evByAction: { fold: 0, call: 120, raise: null },
      explanation: 'Pot was 400 and the call was 200, so you needed 200 / (400 + 200 + 200) = 25% equity.',
    },
  },
];

describe('ReplayTheater', () => {
  it('steps through decisions and shows the written equation', () => {
    const hand = finishedHand();
    render(<ReplayTheater hand={hand} grades={grades} personaName="The Nit" onClose={() => {}} />);
    expect(screen.getByText(/chart agrees/i)).toBeTruthy(); // step 0 grade
    fireEvent.keyDown(window, { key: 'ArrowRight' });
    fireEvent.keyDown(window, { key: 'ArrowRight' });
    fireEvent.keyDown(window, { key: 'ArrowRight' });
    expect(screen.getByText(/25% equity/)).toBeTruthy(); // flop equation
    expect(screen.getByText(/raise wasn't available/i)).toBeTruthy();
  });

  it('closes on Escape', () => {
    const onClose = vi.fn();
    render(<ReplayTheater hand={finishedHand()} grades={grades} personaName="The Nit" onClose={onClose} />);
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(onClose).toHaveBeenCalled();
  });
});
```

Steps: test → `npx vitest run src/ui/ReplayTheater.test.tsx` fails → implement → passes → commit:

```bash
git add src/ui/ReplayTheater.tsx src/ui/ReplayTheater.css src/ui/ReplayTheater.test.tsx
git commit -m "feat(ui): replay theater — decision scrubber, EV bars, written equations"
```

---

### Task 10: App shell — menu, layout, theater wiring, stings [sonnet]

**Files:**
- Modify: `app/src/App.tsx` (full rewrite — delete the Vite demo content and logo imports)
- Modify: `app/src/App.css` (full rewrite: shell layout on theme tokens)
- Modify: `app/src/index.css` (full rewrite: reset + `--bg` body + vignette; keep it minimal)
- Modify: `app/src/main.tsx` (ensure `import './ui/theme.css'` is loaded before App)
- Test: `app/src/App.test.tsx`

**Interfaces:**
- Consumes: everything above — `GradeClient`, `useGame`, `Table`, `ActionBar`, `Ribbon`, `ReplayTheater`, `stats`, `sound`, `PERSONAS`, `BIG_BLIND`.
- Produces: default-exported `App`.

**Requirements:**
1. `const client = useMemo(() => new GradeClient(), [])`, `const game = useGame(client)`.
2. **Menu screen** when `game.phase === 'menu'`: title "Probabilistic Poker Engine" over subtitle "Midnight Casino" (serif, gold), mode cards for **Training** ("Stacks reset to 100BB every hand") and **Match** ("Persistent stacks — play to the felt"), persona picker of the four `PERSONAS` (name + one-line character description you write), and a gold "Deal me in" button calling `game.startSession(mode, personaKey)`.
3. **Game screen** otherwise: header bar (persona name, mode, hand number, both stacks in BB, sound toggle button 🔊/🔇 flipping `sound.setSoundEnabled` via local state, "Leave table" button that reloads to menu by resetting local state — acceptable v1: `window.location.reload()`), main grid `[table | ribbon]`, `ActionBar` docked under the table. `Ribbon` gets accumulated `stats` (see 5) and `onOpenTheater`.
4. **Theater wiring:** `theaterOpen` state; open via Ribbon button or `T` keydown when `phase === 'over' && grades`; while open render `ReplayTheater` and DO NOT render `ActionBar` (its hotkeys must not fire). Close resets `theaterOpen`.
5. **Stats accumulation:** `const [stats, setStats] = useState(emptyStats())` + a ref guard so each hand's grades are counted exactly once:

```tsx
const counted = useRef(0);
useEffect(() => {
  if (game.grades && game.session && counted.current !== game.session.handNumber) {
    counted.current = game.session.handNumber;
    setStats((s) => accumulate(s, game.grades!));
    if (game.grades.some((g) => g.grade.label === 'mistake')) sound.mistakeSting();
  }
}, [game.grades, game.session]);
```

6. **Pot stings:** on hand end (`phase === 'over'` transition), `sound.potWin()` when hero won; `sound.bigPotSting()` when `hand.result.potAwarded >= 40 * BIG_BLIND`.
7. **Match over:** when `game.session?.matchOver`, overlay banner "Match over — {You win / persona wins}" with a "Back to menu" button.
8. Desktop-first layout at 1280×800; ribbon fixed 320px; table area flexes.

**Test (write exactly, `app/src/App.test.tsx`):**

```tsx
// @vitest-environment jsdom
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import App from './App';

describe('App', () => {
  it('shows the menu, then deals into a hand', () => {
    render(<App />);
    expect(screen.getByText(/Midnight Casino/i)).toBeTruthy();
    fireEvent.click(screen.getByText(/Training/i));
    fireEvent.click(screen.getByText(/The Balanced Player/i));
    fireEvent.click(screen.getByRole('button', { name: /deal me in/i }));
    expect(screen.getByText(/Review/)).toBeTruthy(); // ribbon mounted
    expect(screen.getAllByLabelText('face-down card').length).toBeGreaterThan(0); // villain cards
  });
});
```

(Menu interaction details may differ from the exact clicks above — if your menu uses different roles, adjust the TEST's selectors to match the real markup, keeping its assertions: menu renders, session starts, ribbon + face-down villain cards appear.)

Steps: test → `npx vitest run src/App.test.tsx` fails → implement all four files → passes → also re-run `npx vitest run src/ui` (all UI tests green) → commit:

```bash
git add src/App.tsx src/App.css src/index.css src/main.tsx src/App.test.tsx
git commit -m "feat(ui): app shell — menu, game layout, theater wiring, sound stings"
```

---

### Task 11: Final verification [orchestrator — do not delegate]

- [ ] From `app/`: `npm test` — full suite green.
- [ ] From `app/`: `npx tsc -p tsconfig.app.json --noEmit` — clean. Fix any strict/`verbatimModuleSyntax` fallout.
- [ ] Manual smoke via dev server (webapp-testing): menu → training vs Balanced → play a hand with hotkeys → ribbon fills in → open Replay Theater → verify EV bars + equation text → next hand → force an all-in for the runout race.
- [ ] Commit any fixes: `git commit -m "fix(ui): final verification fixes"`.
- [ ] Whole-branch review, then superpowers:finishing-a-development-branch.

## Deferred (recorded for Plan 3)

- Playwright smoke test for hand → review → replay (spec Testing section) — deferred until Plan 3's full app; Task 11's manual smoke covers the cycle for now.
- Preflop mistakes carry 0 EV lost in session stats (chart grades have no EV model in v1).
- "Leave table" uses `location.reload()` — replace with proper state reset when Plan 3 adds persistence.

## Self-review notes

- **Spec coverage:** LogEntry gap (Plan 1's known design gap) → Task 1; worker → Task 2; modes → Task 3/5; Midnight Casino + motion + sound + hotkeys + presets + reveals → Tasks 4–7, 10; side ribbon → Task 8; theater with EV bars + equations → Task 9; graceful worker degradation → Tasks 2/5/8; "play cold" → Table req. 10; desktop-first → global.
- **Type consistency:** `Game` (Task 5) consumed by Tasks 6/7/8/10 with identical field names; `presetRaiseTo(state, fraction)` used in Tasks 3/7; `GradedDecision.grade` discriminated by `'recommended' in grade` in Tasks 3/8/9; `WeightedCombo = { cards, weight }` verified against `ranges.ts`.
- **Verified against source:** `LegalActions`/`applyAction` shapes, `DecisionGrade.evByAction.raise: number | null`, tsconfig DOM-only lib (worker cast), `toMatchObject` in existing hand tests (Task 1 additive-safe).
