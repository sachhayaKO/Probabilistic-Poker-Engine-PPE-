# PPE Rebuild Plan 3 — Profile & Coach

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Persistent player profile and coaching layer on top of the merged Plans 1–2: IndexedDB decision store with tagged graded decisions, stats/aggregation engine (accuracy trend, bb/100, ranked leak list), Report Card dashboard, Coach Feed front page with "Drill This Spot", and generated drills — plus Plan 2's deferred fixes.

**Architecture:** New pure-logic module `app/src/profile/` (tags → records → aggregate → db → coach → drills, each independently unit-tested on synthetic data), then UI (`ReportCard`, `CoachFeed`) consuming the aggregation engine, then App-shell rework making the Coach Feed the home screen and wiring persistence + drills through the existing `useGame` hook. All grading/engine code from Plans 1–2 is consumed as-is.

**Tech Stack:** React 19, Vite 8, Vitest 4. No new **runtime** dependencies. Dev-only additions: `fake-indexeddb` (Task 5), `@playwright/test` (Task 11).

## Model routing (orchestrator note)

- **haiku** (complete code below — TRANSCRIPTION ONLY): Tasks 1–7.
- **sonnet** (locked interfaces + logic requirements; CSS/layout judgment within the theme.css token system): Tasks 8, 9, 10a, 10b, 11.
- Task 12 (final verification) = orchestrator inline. Review of every task = orchestrator diffing delivered code against this plan.

## Global Constraints

- No new **runtime** dependencies. Dev-only: `fake-indexeddb`, `@playwright/test`.
- TypeScript strict + `verbatimModuleSyntax`: all type-only imports MUST use `import type`.
- No live help during a hand: nothing coach/stats-related renders while `hand.result === null`.
- IndexedDB unavailable ⇒ session-only in-memory fallback with a **visible warning** that progress isn't saved. App stays fully usable.
- Components use `theme.css` custom properties only — never hardcoded colors (Task 1 removes the last violation).
- Blinds fixed: SB 50 / BB 100 / start stack 10,000. Hero is always seat 0 (`HERO_SEAT`).
- Preflop mistakes carry a fixed EV-lost proxy of **1 BB (100 chips)** — exported constant `PREFLOP_MISTAKE_EV` in `app/src/ui/stats.ts`; UI labels such figures "est." where shown as EV.
- Drill hands (`drill !== null`) are **excluded** from bb/100 and the accuracy trend, but **included** in per-category accuracy, leaks, graduation, and streaks.
- Branch `ppe-rebuild-profile`; one commit per task with the message given in the task.
- Credit discipline: each task runs ONLY the test files named in that task (`npx vitest run <files>`), from `app/`. No full suite, no tsc until Task 12.

## Existing shapes tasks rely on (from merged Plans 1–2 — do not redefine)

- `engine/cards`: `Card` (number 0–51), `rankOf`, `suitOf`, `cardFromString`, `mulberry32`, `RANKS`, `SUITS`.
- `engine/hand`: `Seat` (0|1), `Street`, `Action`, `HandConfig`, `HandState` (`cfg`, `holes`, `board`, `log`, `pot`, `committed`, `stacks`, `toAct`, `street`, `result`), `HandResult` (`winner`, `potAwarded`, `showdown`, `stacks`), `LogEntry` (`seat`, `street`, `action`, `toCall`, `potBefore`, `committedBefore`, `stackBehind`, `canRaise`, `maxRaiseTo`, `board`), `startHand`, `applyAction`, `legalActions` (returns `{ canFold, canRaise, callAmount, minRaiseTo, maxRaiseTo, ... }`).
- `personas/persona`: `PERSONAS` (keys `nit|maniac|station|balanced`), `PersonaParams`, `personaAction(hand, seat, params, rng)`.
- `personas/ranges`: `chenScore(c1, c2)` — Chen formula, AA = 20, KK = 16, AKs = 12, junk can be negative.
- `grading/grade`: `GradeLabel = 'best'|'okay'|'mistake'`, `DecisionGrade` (`label`, `evLost`, `bestAction`, `actionTaken`, `equity`, `requiredEquity`, `evByAction`, `explanation`).
- `grading/gradeHand`: `PreflopGrade` (`label`, `recommended`, `actionTaken`, `explanation`), `GradedDecision` (`street`, `logIndex`, `grade: DecisionGrade | PreflopGrade`), `gradeHand(finished, heroSeat, villain, iterations, rng)`.
- `ui/gameMachine`: `Mode = 'training'|'match'`, `PersonaKey = 'nit'|'maniac'|'station'|'balanced'`, `HERO_SEAT`, `VILLAIN_SEAT`, `SMALL_BLIND` (50), `BIG_BLIND` (100), `START_STACK` (10000), `Session`, `newSession`, `dealHand`.
- `ui/stats`: `SessionStats`, `emptyStats`, `accumulate`, `accuracy`.
- `ui/useGame`: `useGame(client): Game` with `session`, `hand`, `phase` (`menu|hero|villain|runout|over`), `grades`, `gradesFailed`, `startSession`, `act`, `nextHand`; villain RNG is seeded `mulberry32((cfg.seed ^ 0x5bd1e995) >>> 0)`.
- `ui/ReplayTheater`: existing deep-dive component (Task 10b reuses it — read its props in the file).

---

### Task 1: Plan 2 deferred fixes — preflop EV proxy + hardcoded color [haiku]

**THIS IS A TRANSCRIPTION TASK — copy every code block character-for-character; deviations are rejected in review.**

**Files:**
- Modify: `app/src/ui/stats.ts`
- Modify: `app/src/ui/theme.css` (`:root` block)
- Modify: `app/src/ui/Table.css` (line ~180, the only `#c4536a` occurrence)
- Test: `app/src/ui/gameMachine.test.ts`

**Interfaces:**
- Produces: `PREFLOP_MISTAKE_EV = 100` exported from `app/src/ui/stats.ts` (consumed by Task 3's `buildHandRecord`); CSS token `--red-soft: #c4536a` in `theme.css`.

- [ ] **Step 1: Write the failing test**

Append inside the existing `describe('stats', ...)` block in `app/src/ui/gameMachine.test.ts`:

```ts
  it('counts a 1BB proxy EV loss for preflop mistakes', () => {
    let st = emptyStats();
    st = accumulate(st, [
      {
        street: 'preflop', logIndex: 0,
        grade: { label: 'mistake', recommended: 'raise', actionTaken: 'call', explanation: '' },
      },
    ]);
    expect(st.mistakes).toBe(1);
    expect(st.evLostTotal).toBe(PREFLOP_MISTAKE_EV);
  });
```

Extend the existing `./stats` import line in that test file to also import `PREFLOP_MISTAKE_EV`.

- [ ] **Step 2: Run test to verify it fails**

Run (from `app/`): `npx vitest run src/ui/gameMachine.test.ts`
Expected: the new test FAILS (`PREFLOP_MISTAKE_EV` not exported / evLostTotal 0); all pre-existing tests PASS.

- [ ] **Step 3: Implement**

In `app/src/ui/stats.ts`, add this export directly above `export function accumulate`:

```ts
// Preflop chart grades carry no EV model; count each preflop mistake as a
// fixed 1 BB proxy so preflop leaks are visible in EV-ranked stats ("est." in UI).
export const PREFLOP_MISTAKE_EV = 100;
```

In `accumulate`, replace the line

```ts
    next.evLostTotal += 'evLost' in g.grade ? g.grade.evLost : 0;
```

with:

```ts
    next.evLostTotal +=
      'evLost' in g.grade ? g.grade.evLost : g.grade.label === 'mistake' ? PREFLOP_MISTAKE_EV : 0;
```

In `app/src/ui/theme.css`, add this line inside `:root`, directly below the `--red:` line:

```css
  --red-soft: #c4536a;
```

In `app/src/ui/Table.css`, replace the single occurrence of `#c4536a` (in the `linear-gradient(90deg, var(--red), #c4536a)` value) with `var(--red-soft)`.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/ui/gameMachine.test.ts`
Expected: ALL PASS. Also run `grep -rn '#c4536a' src/ --include='*.css'` — the ONLY hit must be in `theme.css`.

- [ ] **Step 5: Commit**

```bash
git add src/ui/stats.ts src/ui/theme.css src/ui/Table.css src/ui/gameMachine.test.ts
git commit -m "fix(ui): preflop mistakes carry 1BB proxy EV; tokenize #c4536a as --red-soft"
```

---

### Task 2: profile/tags.ts — decision context tags [haiku]

**THIS IS A TRANSCRIPTION TASK — copy every code block character-for-character; deviations are rejected in review.**

**Files:**
- Create: `app/src/profile/tags.ts`
- Test: `app/src/profile/tags.test.ts`

**Interfaces:**
- Consumes: `chenScore` from `../personas/ranges`; `rankOf`, `suitOf` from `../engine/cards`; `LogEntry`, `HandState`, `legalActions` from `../engine/hand`; `PersonaKey` from `../ui/gameMachine`.
- Produces (consumed by Tasks 3, 4, 7): `Facing`, `HandClass`, `DecisionTags`, `preflopClass(hole)`, `postflopClass(hole, board)`, `tagsFor(entry, hole, persona)`, `liveTags(state, heroSeat, persona)`, `leakKey(tags): string` (format `street|facing|handClass`), `leakLabel(key): string`.

- [ ] **Step 1: Write the failing test**

Create `app/src/profile/tags.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { cardFromString } from '../engine/cards';
import { startHand } from '../engine/hand';
import { leakKey, leakLabel, liveTags, postflopClass, preflopClass, tagsFor } from './tags';

const c = cardFromString;

describe('preflopClass', () => {
  it('bands hole cards by Chen score', () => {
    expect(preflopClass([c('As'), c('Ah')])).toBe('premium'); // Chen 20
    expect(preflopClass([c('Ks'), c('Qs')])).toBe('strong'); // Chen 10
    expect(preflopClass([c('9s'), c('8s')])).toBe('playable'); // Chen 6
    expect(preflopClass([c('7c'), c('2d')])).toBe('weak'); // Chen negative
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
    expect(postflopClass([c('9h'), c('8h')], [c('Kh'), c('6h'), c('2c'), c('Js'), c('3d')])).toBe('air');
  });
});

describe('tagsFor / liveTags / leakKey', () => {
  it('derives facing from the log entry pot math', () => {
    const entry = {
      seat: 0, street: 'flop', action: { type: 'call' },
      toCall: 60, potBefore: 80, committedBefore: 0, stackBehind: 900,
      canRaise: true, maxRaiseTo: 960,
      board: [c('Kc'), c('Qh'), c('8s')],
    } as const;
    const tags = tagsFor(entry as never, [c('3c'), c('2d')], 'maniac');
    expect(tags).toEqual({ street: 'flop', facing: 'large-bet', handClass: 'air', persona: 'maniac' });
    expect(leakKey(tags)).toBe('flop|large-bet|air');
  });

  it('tags an all-in when raising is illegal and unopened when nothing to call', () => {
    const base = {
      seat: 0, street: 'turn', action: { type: 'call' }, committedBefore: 0,
      stackBehind: 500, board: [c('Kc'), c('Qh'), c('8s'), c('2d')],
    };
    const allIn = tagsFor(
      { ...base, toCall: 500, potBefore: 1200, canRaise: false, maxRaiseTo: 0 } as never,
      [c('Ac'), c('Kd')], 'nit',
    );
    expect(allIn.facing).toBe('all-in');
    const unopened = tagsFor(
      { ...base, toCall: 0, potBefore: 200, canRaise: true, maxRaiseTo: 700 } as never,
      [c('Ac'), c('Kd')], 'nit',
    );
    expect(unopened.facing).toBe('unopened');
  });

  it('liveTags matches the button preflop first decision', () => {
    const s = startHand({ buttonSeat: 0, stacks: [10000, 10000], smallBlind: 50, bigBlind: 100, seed: 4 });
    const tags = liveTags(s, 0, 'balanced');
    // Button to act: toCall 50 into potBefore 150 => medium-bet band.
    expect(tags.street).toBe('preflop');
    expect(tags.facing).toBe('medium-bet');
    expect(tags.persona).toBe('balanced');
  });
});

describe('leakLabel', () => {
  it('renders plain English', () => {
    expect(leakLabel('flop|large-bet|air')).toBe('On the flop, facing a large bet with air');
    expect(leakLabel('preflop|medium-bet|weak')).toBe('Preflop, facing a medium bet with a weak hand');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/profile/tags.test.ts`
Expected: FAIL — cannot resolve `./tags`.

- [ ] **Step 3: Implement**

Create `app/src/profile/tags.ts`:

```ts
import type { Card } from '../engine/cards';
import { rankOf, suitOf } from '../engine/cards';
import type { HandState, LogEntry, Seat, Street } from '../engine/hand';
import { legalActions } from '../engine/hand';
import { chenScore } from '../personas/ranges';
import type { PersonaKey } from '../ui/gameMachine';

export type Facing = 'unopened' | 'small-bet' | 'medium-bet' | 'large-bet' | 'all-in';
export type HandClass =
  | 'premium' | 'strong' | 'playable' | 'weak' // preflop (Chen bands)
  | 'monster' | 'top-pair' | 'weak-pair' | 'strong-draw' | 'air'; // postflop

export interface DecisionTags {
  street: Street;
  facing: Facing;
  handClass: HandClass;
  persona: PersonaKey;
}

// Thresholds are on toCall / potBefore, where potBefore already includes the
// bet being faced: a 1/3-pot bet ≈ 0.25, half-pot ≈ 0.33, pot-sized ≈ 0.5.
function facingFrom(toCall: number, potBefore: number, canRaise: boolean): Facing {
  if (toCall === 0) return 'unopened';
  if (!canRaise) return 'all-in';
  const r = toCall / potBefore;
  if (r <= 0.3) return 'small-bet';
  if (r <= 0.45) return 'medium-bet';
  return 'large-bet';
}

export function preflopClass(hole: [Card, Card]): HandClass {
  const s = chenScore(hole[0], hole[1]);
  if (s >= 12) return 'premium';
  if (s >= 9) return 'strong';
  if (s >= 6) return 'playable';
  return 'weak';
}

export function postflopClass(hole: [Card, Card], board: Card[]): HandClass {
  const holeRanks = [rankOf(hole[0]), rankOf(hole[1])];
  const boardRanks = board.map(rankOf);
  const topBoard = Math.max(...boardRanks);
  const pocketPair = holeRanks[0] === holeRanks[1];

  const all = [...hole, ...board];
  const suitCounts = [0, 0, 0, 0];
  for (const card of all) suitCounts[suitOf(card)]++;
  const holeSuits = new Set(hole.map(suitOf));
  const madeFlush = suitCounts.some((n, suit) => n >= 5 && holeSuits.has(suit));

  // Rank runs, with the ace also playing low (rank -1) for wheels.
  const present = new Set<number>(all.map(rankOf));
  if (present.has(12)) present.add(-1);
  const holeSet = new Set<number>(holeRanks);
  if (holeSet.has(12)) holeSet.add(-1);
  const runHit = (len: number): boolean => {
    for (let top = 12; top - len + 1 >= -1; top--) {
      let ok = true;
      let usesHole = false;
      for (let r = top; r > top - len; r--) {
        if (!present.has(r)) {
          ok = false;
          break;
        }
        if (holeSet.has(r)) usesHole = true;
      }
      if (ok && usesHole) return true;
    }
    return false;
  };

  const pairedHoleRanks = holeRanks.filter((r) => boardRanks.includes(r));
  const set = pocketPair && boardRanks.includes(holeRanks[0]);
  const twoPair = !pocketPair && pairedHoleRanks.length === 2;
  if (madeFlush || runHit(5) || set || twoPair) return 'monster';

  const overpair = pocketPair && holeRanks[0] > topBoard;
  if (overpair || pairedHoleRanks.includes(topBoard)) return 'top-pair';
  if (pocketPair || pairedHoleRanks.length > 0) return 'weak-pair';

  if (board.length < 5) {
    const flushDraw = suitCounts.some((n, suit) => n === 4 && holeSuits.has(suit));
    if (flushDraw || runHit(4)) return 'strong-draw';
  }
  return 'air';
}

export function tagsFor(entry: LogEntry, hole: [Card, Card], persona: PersonaKey): DecisionTags {
  return {
    street: entry.street,
    facing: facingFrom(entry.toCall, entry.potBefore, entry.canRaise),
    handClass:
      entry.street === 'preflop' ? preflopClass(hole) : postflopClass(hole, entry.board),
    persona,
  };
}

// Tags for a live decision point, before the action is taken (drill generation).
export function liveTags(state: HandState, heroSeat: Seat, persona: PersonaKey): DecisionTags {
  const la = legalActions(state);
  const potBefore = state.pot + state.committed[0] + state.committed[1];
  return {
    street: state.street,
    facing: facingFrom(la.callAmount, potBefore, la.canRaise),
    handClass:
      state.street === 'preflop'
        ? preflopClass(state.holes[heroSeat])
        : postflopClass(state.holes[heroSeat], state.board),
    persona,
  };
}

export const leakKey = (t: DecisionTags): string => `${t.street}|${t.facing}|${t.handClass}`;

const FACING_TEXT: Record<Facing, string> = {
  unopened: 'first in',
  'small-bet': 'facing a small bet',
  'medium-bet': 'facing a medium bet',
  'large-bet': 'facing a large bet',
  'all-in': 'facing an all-in',
};

const CLASS_TEXT: Record<HandClass, string> = {
  premium: 'a premium hand',
  strong: 'a strong hand',
  playable: 'a playable hand',
  weak: 'a weak hand',
  monster: 'a monster',
  'top-pair': 'top pair or better',
  'weak-pair': 'a weak pair',
  'strong-draw': 'a strong draw',
  air: 'air',
};

export function leakLabel(key: string): string {
  const [street, facing, handClass] = key.split('|') as [Street, Facing, HandClass];
  const where = street === 'preflop' ? 'Preflop' : `On the ${street}`;
  return `${where}, ${FACING_TEXT[facing]} with ${CLASS_TEXT[handClass]}`;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/profile/tags.test.ts`
Expected: ALL PASS. If any classifier assertion fails, STOP and report the actual value to the orchestrator — do not adjust thresholds yourself.

- [ ] **Step 5: Commit**

```bash
git add src/profile/tags.ts src/profile/tags.test.ts
git commit -m "feat(profile): decision context tags — street, action-facing, hand class, persona"
```

---

### Task 3: profile/records.ts — HandRecord + buildHandRecord [haiku]

**THIS IS A TRANSCRIPTION TASK — copy every code block character-for-character; deviations are rejected in review.**

**Files:**
- Create: `app/src/profile/records.ts`
- Test: `app/src/profile/records.test.ts`

**Interfaces:**
- Consumes: Task 2 `tagsFor`, `DecisionTags`; `PREFLOP_MISTAKE_EV` from `../ui/stats` (Task 1); `GradedDecision` from `../grading/gradeHand`; `GradeLabel` from `../grading/grade`; `Mode`, `PersonaKey` from `../ui/gameMachine`.
- Produces (consumed by Tasks 4–6, 10b): `StoredDecision`, `HandRecord`, `buildHandRecord(state, heroSeat, mode, personaKey, grades, drill?, ts?)`.

- [ ] **Step 1: Write the failing test**

Create `app/src/profile/records.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { applyAction, startHand } from '../engine/hand';
import { PREFLOP_MISTAKE_EV } from '../ui/stats';
import type { GradedDecision } from '../grading/gradeHand';
import { buildHandRecord } from './records';

// Deterministic hand, no personas: hero (seat 0, button) limps, BB checks,
// flop: BB bets 60, hero calls, turn+river check through to showdown.
function playedHand() {
  let s = startHand({ buttonSeat: 0, stacks: [1000, 1000], smallBlind: 5, bigBlind: 10, seed: 42 });
  s = applyAction(s, { type: 'call' }); // hero limp        (log 0)
  s = applyAction(s, { type: 'call' }); // BB check -> flop (log 1)
  s = applyAction(s, { type: 'raise', to: 60 }); // BB bets (log 2)
  s = applyAction(s, { type: 'call' }); // hero calls       (log 3)
  s = applyAction(s, { type: 'call' }); // BB check         (log 4)
  s = applyAction(s, { type: 'call' }); // hero check -> river (log 5)
  s = applyAction(s, { type: 'call' }); // BB check         (log 6)
  s = applyAction(s, { type: 'call' }); // hero check -> showdown (log 7)
  return s;
}

const grades: GradedDecision[] = [
  {
    street: 'preflop', logIndex: 0,
    grade: { label: 'mistake', recommended: 'raise', actionTaken: 'call', explanation: '' },
  },
  {
    street: 'flop', logIndex: 3,
    grade: {
      label: 'mistake', evLost: 180, bestAction: 'fold', actionTaken: 'call',
      equity: 0.19, requiredEquity: 0.32,
      evByAction: { fold: 0, call: -180, raise: -220 }, explanation: '',
    },
  },
];

describe('buildHandRecord', () => {
  it('tags decisions and maps EV lost with the preflop proxy', () => {
    const state = playedHand();
    const rec = buildHandRecord(state, 0, 'training', 'maniac', grades, null, 777);
    expect(rec.ts).toBe(777);
    expect(rec.mode).toBe('training');
    expect(rec.personaKey).toBe('maniac');
    expect(rec.drill).toBeNull();
    expect(rec.bigBlind).toBe(10);
    expect(rec.heroNet).toBe(state.result!.stacks[0] - 1000);
    expect(rec.state).toBe(state);
    expect(rec.grades).toBe(grades);

    expect(rec.decisions).toHaveLength(2);
    const [pre, flop] = rec.decisions;
    expect(pre).toMatchObject({
      logIndex: 0, street: 'preflop', persona: 'maniac',
      label: 'mistake', evLost: PREFLOP_MISTAKE_EV, actionTaken: 'call', best: 'raise',
    });
    expect(flop).toMatchObject({
      logIndex: 3, street: 'flop', persona: 'maniac',
      label: 'mistake', evLost: 180, actionTaken: 'call', best: 'fold',
    });
    // Flop call of 60 into potBefore 80 (20 pot + 60 bet) is a large bet.
    expect(flop.facing).toBe('large-bet');
    expect(['monster', 'top-pair', 'weak-pair', 'strong-draw', 'air']).toContain(flop.handClass);
    expect(['premium', 'strong', 'playable', 'weak']).toContain(pre.handClass);
  });

  it('throws on an unfinished hand', () => {
    const live = startHand({ buttonSeat: 0, stacks: [1000, 1000], smallBlind: 5, bigBlind: 10, seed: 1 });
    expect(() => buildHandRecord(live, 0, 'training', 'balanced', [])).toThrow();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/profile/records.test.ts`
Expected: FAIL — cannot resolve `./records`.

- [ ] **Step 3: Implement**

Create `app/src/profile/records.ts`:

```ts
import type { HandState, Seat } from '../engine/hand';
import type { GradeLabel } from '../grading/grade';
import type { GradedDecision } from '../grading/gradeHand';
import type { Mode, PersonaKey } from '../ui/gameMachine';
import { PREFLOP_MISTAKE_EV } from '../ui/stats';
import type { DecisionTags } from './tags';
import { tagsFor } from './tags';

export interface StoredDecision extends DecisionTags {
  logIndex: number;
  label: GradeLabel;
  evLost: number; // chips; preflop mistakes use the PREFLOP_MISTAKE_EV proxy
  actionTaken: 'fold' | 'call' | 'raise';
  best: 'fold' | 'call' | 'raise';
}

export interface HandRecord {
  id?: number; // assigned by the store
  ts: number;
  mode: Mode;
  personaKey: PersonaKey;
  drill: string | null; // leak key that generated this hand, null for normal play
  bigBlind: number;
  heroNet: number; // chips won (negative = lost) by the hero this hand
  state: HandState; // full finished hand, replayable in the Replay Theater
  grades: GradedDecision[];
  decisions: StoredDecision[];
}

export function buildHandRecord(
  state: HandState,
  heroSeat: Seat,
  mode: Mode,
  personaKey: PersonaKey,
  grades: GradedDecision[],
  drill: string | null = null,
  ts: number = Date.now(),
): HandRecord {
  if (!state.result) throw new Error('buildHandRecord requires a finished hand');
  const hole = state.holes[heroSeat];
  const decisions = grades.map((g): StoredDecision => {
    const grade = g.grade;
    return {
      ...tagsFor(state.log[g.logIndex], hole, personaKey),
      logIndex: g.logIndex,
      label: grade.label,
      evLost:
        'evLost' in grade ? grade.evLost : grade.label === 'mistake' ? PREFLOP_MISTAKE_EV : 0,
      actionTaken: grade.actionTaken,
      best: 'bestAction' in grade ? grade.bestAction : grade.recommended,
    };
  });
  return {
    ts,
    mode,
    personaKey,
    drill,
    bigBlind: state.cfg.bigBlind,
    heroNet: state.result.stacks[heroSeat] - state.cfg.stacks[heroSeat],
    state,
    grades,
    decisions,
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/profile/records.test.ts`
Expected: ALL PASS.

- [ ] **Step 5: Commit**

```bash
git add src/profile/records.ts src/profile/records.test.ts
git commit -m "feat(profile): HandRecord with tagged, EV-mapped stored decisions"
```

---

### Task 4: profile/aggregate.ts — the stats engine [haiku]

**THIS IS A TRANSCRIPTION TASK — copy every code block character-for-character; deviations are rejected in review.**

**Files:**
- Create: `app/src/profile/aggregate.ts`
- Test: `app/src/profile/aggregate.test.ts`

**Interfaces:**
- Consumes: Task 3 `HandRecord`, `StoredDecision`; Task 2 `leakKey`, `leakLabel`.
- Produces (consumed by Tasks 6, 8, 9, 10b): `TREND_BUCKET = 25`, `MIN_LEAK_MISTAKES = 3`, `LeakStat`, `TrendPoint`, `ProfileStats`, `aggregate(records): ProfileStats`, `categoryRecent(records, key, window): { decisions: number; accuracy: number }`.

- [ ] **Step 1: Write the failing test**

Create `app/src/profile/aggregate.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import type { HandState } from '../engine/hand';
import type { HandRecord, StoredDecision } from './records';
import { MIN_LEAK_MISTAKES, aggregate, categoryRecent } from './aggregate';

function dec(over: Partial<StoredDecision>): StoredDecision {
  return {
    logIndex: 0, street: 'flop', facing: 'large-bet', handClass: 'air', persona: 'balanced',
    label: 'best', evLost: 0, actionTaken: 'fold', best: 'fold',
    ...over,
  };
}

function rec(over: Partial<HandRecord>): HandRecord {
  return {
    id: 1, ts: 1, mode: 'training', personaKey: 'balanced', drill: null,
    bigBlind: 100, heroNet: 0, state: {} as HandState, grades: [], decisions: [],
    ...over,
  };
}

describe('aggregate', () => {
  it('returns a sane empty profile', () => {
    const s = aggregate([]);
    expect(s.handsGraded).toBe(0);
    expect(s.decisions).toBe(0);
    expect(s.accuracy).toBe(1);
    expect(s.bb100).toBe(0);
    expect(s.trend).toEqual([]);
    expect(s.leaks).toEqual([]);
  });

  it('computes totals, bb/100 and ranks leaks by EV lost', () => {
    const mistakes = (n: number, evLost: number, handClass: 'air' | 'weak-pair') =>
      Array.from({ length: n }, () => dec({ label: 'mistake', evLost, handClass, actionTaken: 'call' }));
    const records: HandRecord[] = [
      rec({ id: 1, ts: 1, heroNet: 300, decisions: [dec({ street: 'river' }), ...mistakes(2, 50, 'weak-pair')] }),
      rec({ id: 2, ts: 2, heroNet: -100, decisions: mistakes(3, 200, 'air') }),
      // drill hand: counted in decisions/leaks, excluded from bb/100 and trend
      rec({ id: 3, ts: 3, drill: 'flop|large-bet|air', heroNet: 5000, decisions: mistakes(1, 200, 'air') }),
    ];
    const s = aggregate(records);
    expect(s.handsGraded).toBe(3);
    expect(s.decisions).toBe(7);
    expect(s.accuracy).toBeCloseTo(1 / 7);
    expect(s.evLostTotal).toBe(2 * 50 + 4 * 200);
    // bb/100 over the two non-drill hands: (300 - 100)/100 BB over 2 hands = 100 bb/100.
    expect(s.bb100).toBeCloseTo(100);
    expect(s.trend).toHaveLength(1);
    expect(s.trend[0].hands).toBe(2);
    expect(s.trend[0].accuracy).toBeCloseTo(1 / 6);

    // 'air' leak: 4 mistakes, 800 EV. 'weak-pair': only 2 mistakes (< MIN) — filtered out.
    expect(MIN_LEAK_MISTAKES).toBe(3);
    expect(s.leaks).toHaveLength(1);
    expect(s.leaks[0].key).toBe('flop|large-bet|air');
    expect(s.leaks[0].mistakes).toBe(4);
    expect(s.leaks[0].evLost).toBe(800);
    expect(s.leaks[0].accuracy).toBe(0);
    expect(s.leaks[0].handIds).toEqual([3, 2]); // newest offending hands first
    expect(s.leaks[0].label).toBe('On the flop, facing a large bet with air');
  });
});

describe('categoryRecent', () => {
  it('windows the most recent decisions in one category', () => {
    const records: HandRecord[] = [
      rec({ id: 1, ts: 1, decisions: [dec({ label: 'mistake', evLost: 100 })] }),
      rec({ id: 2, ts: 2, decisions: [dec({}), dec({}), dec({})] }),
      rec({ id: 3, ts: 3, decisions: [dec({ street: 'river' })] }), // other category
    ];
    const all = categoryRecent(records, 'flop|large-bet|air', 10);
    expect(all.decisions).toBe(4);
    expect(all.accuracy).toBeCloseTo(3 / 4);
    const windowed = categoryRecent(records, 'flop|large-bet|air', 3);
    expect(windowed.decisions).toBe(3);
    expect(windowed.accuracy).toBe(1); // the mistake falls outside the window
    expect(categoryRecent(records, 'nope', 10)).toEqual({ decisions: 0, accuracy: 1 });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/profile/aggregate.test.ts`
Expected: FAIL — cannot resolve `./aggregate`.

- [ ] **Step 3: Implement**

Create `app/src/profile/aggregate.ts`:

```ts
import type { HandRecord } from './records';
import { leakKey, leakLabel } from './tags';

export const TREND_BUCKET = 25; // hands per accuracy-trend bucket
export const MIN_LEAK_MISTAKES = 3; // a category needs this many mistakes to be a leak

export interface LeakStat {
  key: string;
  label: string;
  decisions: number;
  mistakes: number;
  evLost: number;
  accuracy: number;
  handIds: number[]; // ids of offending hands, newest first, max 10
}

export interface TrendPoint {
  bucket: number;
  hands: number;
  accuracy: number;
}

export interface ProfileStats {
  handsGraded: number;
  decisions: number;
  accuracy: number; // 1 when no decisions
  evLostTotal: number;
  bb100: number; // non-drill hands only; 0 when there are none
  trend: TrendPoint[]; // non-drill hands, chronological, TREND_BUCKET hands each
  leaks: LeakStat[]; // mistakes >= MIN_LEAK_MISTAKES, ranked by evLost desc
}

export function aggregate(records: HandRecord[]): ProfileStats {
  const sorted = [...records].sort((a, b) => a.ts - b.ts);

  let decisions = 0;
  let good = 0;
  let evLostTotal = 0;
  const byLeak = new Map<
    string,
    { decisions: number; mistakes: number; evLost: number; handIds: number[] }
  >();
  for (const record of sorted) {
    for (const d of record.decisions) {
      decisions++;
      if (d.label !== 'mistake') good++;
      evLostTotal += d.evLost;
      const key = leakKey(d);
      const bucket = byLeak.get(key) ?? { decisions: 0, mistakes: 0, evLost: 0, handIds: [] };
      bucket.decisions++;
      if (d.label === 'mistake') {
        bucket.mistakes++;
        bucket.evLost += d.evLost;
        if (record.id !== undefined && bucket.handIds[0] !== record.id) {
          bucket.handIds.unshift(record.id); // chronological input => newest first
        }
      }
      byLeak.set(key, bucket);
    }
  }

  const play = sorted.filter((r) => r.drill === null);
  const netBB = play.reduce((sum, r) => sum + r.heroNet / r.bigBlind, 0);
  const bb100 = play.length === 0 ? 0 : (netBB / play.length) * 100;

  const trend: TrendPoint[] = [];
  for (let i = 0; i < play.length; i += TREND_BUCKET) {
    const slice = play.slice(i, i + TREND_BUCKET);
    let d = 0;
    let g = 0;
    for (const record of slice) {
      for (const dec of record.decisions) {
        d++;
        if (dec.label !== 'mistake') g++;
      }
    }
    trend.push({ bucket: trend.length, hands: slice.length, accuracy: d === 0 ? 1 : g / d });
  }

  const leaks: LeakStat[] = [...byLeak.entries()]
    .filter(([, v]) => v.mistakes >= MIN_LEAK_MISTAKES)
    .map(([key, v]) => ({
      key,
      label: leakLabel(key),
      decisions: v.decisions,
      mistakes: v.mistakes,
      evLost: v.evLost,
      accuracy: 1 - v.mistakes / v.decisions,
      handIds: v.handIds.slice(0, 10),
    }))
    .sort((a, b) => b.evLost - a.evLost);

  return {
    handsGraded: sorted.length,
    decisions,
    accuracy: decisions === 0 ? 1 : good / decisions,
    evLostTotal,
    bb100,
    trend,
    leaks,
  };
}

// Accuracy over the most recent `window` decisions in one leak category.
export function categoryRecent(
  records: HandRecord[],
  key: string,
  window: number,
): { decisions: number; accuracy: number } {
  const all = [...records]
    .sort((a, b) => a.ts - b.ts)
    .flatMap((r) => r.decisions)
    .filter((d) => leakKey(d) === key);
  const recent = all.slice(-window);
  const good = recent.filter((d) => d.label !== 'mistake').length;
  return { decisions: recent.length, accuracy: recent.length === 0 ? 1 : good / recent.length };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/profile/aggregate.test.ts`
Expected: ALL PASS.

- [ ] **Step 5: Commit**

```bash
git add src/profile/aggregate.ts src/profile/aggregate.test.ts
git commit -m "feat(profile): aggregation engine — accuracy trend, bb/100, ranked leak list"
```

---

### Task 5: profile/db.ts — IndexedDB store with session-only fallback [haiku]

**THIS IS A TRANSCRIPTION TASK — copy every code block character-for-character; deviations are rejected in review.**

**Files:**
- Modify: `app/package.json` (dev dep via npm install)
- Create: `app/src/profile/db.ts`
- Test: `app/src/profile/db.test.ts`

**Interfaces:**
- Consumes: Task 3 `HandRecord`.
- Produces (consumed by Task 10b): `ProfileStore` interface (`persistent: boolean; addHand(rec): Promise<number>; allHands(): Promise<HandRecord[]>; getSetting<T>(key, fallback): Promise<T>; setSetting(key, value): Promise<void>; clearHands(): Promise<void>`), `openProfileStore(): Promise<ProfileStore>`, `memoryStore(): ProfileStore`.

- [ ] **Step 1: Install the dev-only test dep**

Run (from `app/`): `npm install -D fake-indexeddb`
Expected: added to devDependencies only.

- [ ] **Step 2: Write the failing test**

Create `app/src/profile/db.test.ts`:

```ts
import 'fake-indexeddb/auto';
import { describe, expect, it } from 'vitest';
import type { HandState } from '../engine/hand';
import type { HandRecord } from './records';
import { memoryStore, openProfileStore } from './db';

function rec(ts: number): HandRecord {
  return {
    ts, mode: 'training', personaKey: 'balanced', drill: null,
    bigBlind: 100, heroNet: -50, state: {} as HandState, grades: [], decisions: [],
  };
}

describe('openProfileStore (IndexedDB via fake-indexeddb)', () => {
  it('persists hands and settings round-trip', async () => {
    const store = await openProfileStore();
    expect(store.persistent).toBe(true);
    const id1 = await store.addHand(rec(1));
    const id2 = await store.addHand(rec(2));
    expect(id2).toBeGreaterThan(id1);
    const all = await store.allHands();
    expect(all).toHaveLength(2);
    expect(all[0].id).toBe(id1);
    expect(all[0].heroNet).toBe(-50);

    await store.setSetting('sound', false);
    expect(await store.getSetting('sound', true)).toBe(false);
    expect(await store.getSetting('missing', 'fallback')).toBe('fallback');

    await store.clearHands();
    expect(await store.allHands()).toHaveLength(0);
  });
});

describe('memoryStore (session-only fallback)', () => {
  it('reports non-persistent and round-trips in memory', async () => {
    const store = memoryStore();
    expect(store.persistent).toBe(false);
    const id = await store.addHand(rec(1));
    expect(id).toBe(1);
    expect((await store.allHands())[0].id).toBe(1);
    await store.setSetting('k', 42);
    expect(await store.getSetting('k', 0)).toBe(42);
    await store.clearHands();
    expect(await store.allHands()).toEqual([]);
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `npx vitest run src/profile/db.test.ts`
Expected: FAIL — cannot resolve `./db`.

- [ ] **Step 4: Implement**

Create `app/src/profile/db.ts`:

```ts
import type { HandRecord } from './records';

export interface ProfileStore {
  persistent: boolean;
  addHand(rec: HandRecord): Promise<number>;
  allHands(): Promise<HandRecord[]>;
  getSetting<T>(key: string, fallback: T): Promise<T>;
  setSetting(key: string, value: unknown): Promise<void>;
  clearHands(): Promise<void>;
}

const DB_NAME = 'ppe-profile';
const DB_VERSION = 1;

function req<T>(r: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    r.onsuccess = () => resolve(r.result);
    r.onerror = () => reject(r.error ?? new Error('IndexedDB request failed'));
  });
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const r = indexedDB.open(DB_NAME, DB_VERSION);
    r.onupgradeneeded = () => {
      const db = r.result;
      if (!db.objectStoreNames.contains('hands')) {
        db.createObjectStore('hands', { keyPath: 'id', autoIncrement: true });
      }
      if (!db.objectStoreNames.contains('settings')) {
        db.createObjectStore('settings');
      }
    };
    r.onsuccess = () => resolve(r.result);
    r.onerror = () => reject(r.error ?? new Error('IndexedDB open failed'));
    r.onblocked = () => reject(new Error('IndexedDB open blocked'));
  });
}

function idbStore(db: IDBDatabase): ProfileStore {
  const os = (name: 'hands' | 'settings', mode: IDBTransactionMode) =>
    db.transaction(name, mode).objectStore(name);
  return {
    persistent: true,
    async addHand(rec) {
      return (await req(os('hands', 'readwrite').add(rec))) as number;
    },
    async allHands() {
      return (await req(os('hands', 'readonly').getAll())) as HandRecord[];
    },
    async getSetting<T>(key: string, fallback: T) {
      const v = (await req(os('settings', 'readonly').get(key))) as T | undefined;
      return v === undefined ? fallback : v;
    },
    async setSetting(key, value) {
      await req(os('settings', 'readwrite').put(value, key));
    },
    async clearHands() {
      await req(os('hands', 'readwrite').clear());
    },
  };
}

export function memoryStore(): ProfileStore {
  let nextId = 1;
  const hands: HandRecord[] = [];
  const settings = new Map<string, unknown>();
  return {
    persistent: false,
    addHand(rec) {
      const id = nextId++;
      hands.push({ ...rec, id });
      return Promise.resolve(id);
    },
    allHands() {
      return Promise.resolve([...hands]);
    },
    getSetting<T>(key: string, fallback: T) {
      return Promise.resolve(settings.has(key) ? (settings.get(key) as T) : fallback);
    },
    setSetting(key, value) {
      settings.set(key, value);
      return Promise.resolve();
    },
    clearHands() {
      hands.length = 0;
      return Promise.resolve();
    },
  };
}

// Session-only fallback keeps the app fully usable when IndexedDB is missing
// or broken; callers surface a "progress not saved" warning off `persistent`.
export async function openProfileStore(): Promise<ProfileStore> {
  if (typeof indexedDB === 'undefined') return memoryStore();
  try {
    return idbStore(await openDb());
  } catch {
    return memoryStore();
  }
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npx vitest run src/profile/db.test.ts`
Expected: ALL PASS.

- [ ] **Step 6: Commit**

```bash
git add package.json package-lock.json src/profile/db.ts src/profile/db.test.ts
git commit -m "feat(profile): IndexedDB hand store with session-only memory fallback"
```

---

### Task 6: profile/coach.ts — biggest leak, focus queue, graduation, streaks [haiku]

**THIS IS A TRANSCRIPTION TASK — copy every code block character-for-character; deviations are rejected in review.**

**Files:**
- Create: `app/src/profile/coach.ts`
- Test: `app/src/profile/coach.test.ts`

**Interfaces:**
- Consumes: Task 4 `ProfileStats`, `LeakStat`, `categoryRecent`; Task 3 `HandRecord`.
- Produces (consumed by Tasks 9, 10b): `GRADUATION_WINDOW = 25`, `GRADUATION_ACCURACY = 0.85`, `DRILL_WINDOW = 10`, `DRILL_MIN_SAMPLES = 6`, `DRILL_ACCURACY = 0.8`, `Graduation`, `CoachCard`, `coachState(stats, records): CoachCard`, `drillRecovered(records, key): boolean`.

- [ ] **Step 1: Write the failing test**

Create `app/src/profile/coach.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import type { HandState } from '../engine/hand';
import type { HandRecord, StoredDecision } from './records';
import { aggregate } from './aggregate';
import { GRADUATION_WINDOW, coachState, drillRecovered } from './coach';

function dec(over: Partial<StoredDecision>): StoredDecision {
  return {
    logIndex: 0, street: 'flop', facing: 'large-bet', handClass: 'air', persona: 'balanced',
    label: 'best', evLost: 0, actionTaken: 'fold', best: 'fold',
    ...over,
  };
}

let nextId = 1;
function rec(ts: number, decisions: StoredDecision[], drill: string | null = null): HandRecord {
  return {
    id: nextId++, ts, mode: 'training', personaKey: 'balanced', drill,
    bigBlind: 100, heroNet: 0, state: {} as HandState, grades: [], decisions,
  };
}

const mistake = (over: Partial<StoredDecision> = {}) =>
  dec({ label: 'mistake', evLost: 100, actionTaken: 'call', ...over });

describe('coachState', () => {
  it('names the biggest active leak and queues the rest', () => {
    const records = [
      rec(1, [mistake(), mistake(), mistake()]), // air: 300 EV
      rec(2, [
        mistake({ handClass: 'weak-pair', evLost: 500 }),
        mistake({ handClass: 'weak-pair', evLost: 500 }),
        mistake({ handClass: 'weak-pair', evLost: 500 }),
      ]), // weak-pair: 1500 EV — biggest
    ];
    const card = coachState(aggregate(records), records);
    expect(card.leak?.key).toBe('flop|large-bet|weak-pair');
    expect(card.queue.map((l) => l.key)).toEqual(['flop|large-bet|air']);
    expect(card.graduated).toEqual([]);
    expect(card.streak).toBe(0); // last decision was a mistake
  });

  it('graduates a leak whose recent window is accurate and counts streaks', () => {
    const records = [
      rec(1, [mistake(), mistake(), mistake()]),
      // GRADUATION_WINDOW clean decisions in the same category afterwards
      rec(2, Array.from({ length: GRADUATION_WINDOW }, () => dec({}))),
    ];
    const card = coachState(aggregate(records), records);
    expect(card.leak).toBeNull();
    expect(card.graduated).toHaveLength(1);
    expect(card.graduated[0].key).toBe('flop|large-bet|air');
    expect(card.graduated[0].accuracy).toBe(1);
    expect(card.streak).toBe(GRADUATION_WINDOW);
  });
});

describe('drillRecovered', () => {
  it('requires enough recent samples above the accuracy bar', () => {
    const key = 'flop|large-bet|air';
    const few = [rec(1, [dec({}), dec({})])];
    expect(drillRecovered(few, key)).toBe(false); // too few samples
    const good = [rec(1, [mistake(), mistake(), mistake()]), rec(2, Array.from({ length: 10 }, () => dec({})))];
    expect(drillRecovered(good, key)).toBe(true); // last 10 are clean
    const bad = [rec(1, Array.from({ length: 6 }, () => mistake()))];
    expect(drillRecovered(bad, key)).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/profile/coach.test.ts`
Expected: FAIL — cannot resolve `./coach`.

- [ ] **Step 3: Implement**

Create `app/src/profile/coach.ts`:

```ts
import type { LeakStat, ProfileStats } from './aggregate';
import { categoryRecent } from './aggregate';
import type { HandRecord } from './records';

export const GRADUATION_WINDOW = 25; // recent decisions needed to graduate a leak
export const GRADUATION_ACCURACY = 0.85;
export const DRILL_WINDOW = 10; // recent category decisions a drill looks at
export const DRILL_MIN_SAMPLES = 6;
export const DRILL_ACCURACY = 0.8;

export interface Graduation {
  key: string;
  label: string;
  accuracy: number; // over the graduation window
  decisions: number; // lifetime decisions in the category
}

export interface CoachCard {
  leak: LeakStat | null; // the single biggest active leak
  queue: LeakStat[]; // next focuses, up to 3
  graduated: Graduation[];
  streak: number; // consecutive non-mistake decisions, counting back from the latest
}

export function coachState(stats: ProfileStats, records: HandRecord[]): CoachCard {
  const graduated: Graduation[] = [];
  const active: LeakStat[] = [];
  for (const leak of stats.leaks) {
    const recent = categoryRecent(records, leak.key, GRADUATION_WINDOW);
    if (recent.decisions >= GRADUATION_WINDOW && recent.accuracy >= GRADUATION_ACCURACY) {
      graduated.push({
        key: leak.key,
        label: leak.label,
        accuracy: recent.accuracy,
        decisions: leak.decisions,
      });
    } else {
      active.push(leak);
    }
  }

  const all = [...records].sort((a, b) => a.ts - b.ts).flatMap((r) => r.decisions);
  let streak = 0;
  for (let i = all.length - 1; i >= 0 && all[i].label !== 'mistake'; i--) streak++;

  return { leak: active[0] ?? null, queue: active.slice(1, 4), graduated, streak };
}

// Has drilling pulled this category's recent accuracy back above the bar?
export function drillRecovered(records: HandRecord[], key: string): boolean {
  const recent = categoryRecent(records, key, DRILL_WINDOW);
  return recent.decisions >= DRILL_MIN_SAMPLES && recent.accuracy >= DRILL_ACCURACY;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/profile/coach.test.ts`
Expected: ALL PASS.

- [ ] **Step 5: Commit**

```bash
git add src/profile/coach.ts src/profile/coach.test.ts
git commit -m "feat(profile): coach engine — biggest leak, focus queue, graduation, streaks"
```

---

### Task 7: profile/drills.ts — generated pattern-matched drill deals [haiku]

**THIS IS A TRANSCRIPTION TASK — copy every code block character-for-character; deviations are rejected in review.**

**Files:**
- Create: `app/src/profile/drills.ts`
- Test: `app/src/profile/drills.test.ts`

**Interfaces:**
- Consumes: Task 2 `leakKey`, `liveTags`; engine `startHand`, `applyAction`, `legalActions`, `mulberry32`; `PERSONAS`, `personaAction` from `../personas/persona`; `HERO_SEAT`, `VILLAIN_SEAT`, `SMALL_BLIND`, `BIG_BLIND`, `START_STACK`, `PersonaKey` from `../ui/gameMachine`.
- Produces (consumed by Tasks 10a, 10b): `DrillDeal { cfg: HandConfig; heroScript: Action[] }`, `DRILL_MAX_TRIES = 400`, `generateDrill(key, personaKey, baseSeed, maxTries?): DrillDeal | null`.
- **Critical invariant:** the villain RNG is derived `mulberry32((cfg.seed ^ 0x5bd1e995) >>> 0)` — exactly how `useGame` derives it — so replaying `cfg` live with the hero playing `heroScript` reproduces this simulation up to the drill decision point.

- [ ] **Step 1: Write the failing test**

Create `app/src/profile/drills.test.ts`:

```ts
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/profile/drills.test.ts`
Expected: FAIL — cannot resolve `./drills`.

- [ ] **Step 3: Implement**

Create `app/src/profile/drills.ts`:

```ts
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
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/profile/drills.test.ts`
Expected: ALL PASS. If either `generateDrill` search test returns null, STOP and report to the orchestrator with the key that failed — do not loosen the matcher or change keys yourself.

- [ ] **Step 5: Commit**

```bash
git add src/profile/drills.ts src/profile/drills.test.ts
git commit -m "feat(profile): drill generator — seed-searched deals matching a leak pattern"
```

---

### Task 8: Report Card dashboard [sonnet]

**Files:**
- Create: `app/src/ui/ReportCard.tsx`
- Create: `app/src/ui/ReportCard.css`
- Test: `app/src/ui/ReportCard.test.tsx`

**Interfaces:**
- Consumes: Task 4 `ProfileStats` from `../profile/aggregate` (import type).
- Produces (consumed by Task 10b):

```tsx
export function ReportCard({ stats, onBack, onOpenHand }: {
  stats: ProfileStats;
  onBack: () => void;
  onOpenHand: (handId: number) => void;
}): JSX-element
```

**Requirements (locked):**
1. Header: display-serif title "Report Card" and a "Back" button calling `onBack`.
2. Empty state when `stats.handsGraded === 0`: message containing "Play some hands" and nothing else stats-related.
3. Stat tiles (all values from `stats`): hands graded, decisions, accuracy as `XX%` (`Math.round(stats.accuracy * 100)`), bb/100 to one decimal with sign (e.g. `+12.5` / `-3.0`), total EV lost as chips with an `est.` marker (preflop proxy is folded in).
4. Accuracy trend: inline SVG (no libraries) polyline over `stats.trend` points (y = accuracy 0–1, x = bucket). Render only when `stats.trend.length >= 2`. Give the SVG `role="img"` and `aria-label="accuracy trend"`.
5. Ranked leak table in `stats.leaks` order (already ranked): each row shows `leak.label`, decisions, mistakes, EV lost, accuracy %, and up to 3 "Hand #<id>" buttons over `leak.handIds` calling `onOpenHand(id)`.
6. Styling: `ReportCard.css` using ONLY `theme.css` custom properties (`--panel`, `--panel-edge`, `--gold`, `--cream`, `--muted`, `--red`, `--good`, `--font-display`, `--font-mono`...). Midnight Casino: dark panels, gold accents, serif display headings. Desktop-first, content column max-width ~960px.
7. `import './ReportCard.css';` in the component file.

- [ ] **Step 1: Write the failing test** — create `app/src/ui/ReportCard.test.tsx` with `// @vitest-environment jsdom`, `@testing-library/react`. Cases: (a) empty state renders "Play some hands" when `handsGraded` is 0; (b) a synthetic `ProfileStats` (2 leaks, trend of 3 points, bb100 12.34) renders both leak labels in document order, the accuracy tile, and the trend SVG by `aria-label`; (c) clicking a "Hand #" button calls `onOpenHand` with the id; (d) clicking Back calls `onBack`.
- [ ] **Step 2: Run to verify it fails** — `npx vitest run src/ui/ReportCard.test.tsx` — cannot resolve `./ReportCard`.
- [ ] **Step 3: Implement** `ReportCard.tsx` + `ReportCard.css` per the requirements above.
- [ ] **Step 4: Run to verify it passes** — `npx vitest run src/ui/ReportCard.test.tsx` — ALL PASS.
- [ ] **Step 5: Commit**

```bash
git add src/ui/ReportCard.tsx src/ui/ReportCard.css src/ui/ReportCard.test.tsx
git commit -m "feat(ui): Report Card dashboard — stat tiles, accuracy trend, ranked leak table"
```

---

### Task 9: Coach Feed front page [sonnet]

**Files:**
- Create: `app/src/ui/CoachFeed.tsx`
- Create: `app/src/ui/CoachFeed.css`
- Test: `app/src/ui/CoachFeed.test.tsx`

**Interfaces:**
- Consumes: Task 4 `ProfileStats`; Task 6 `CoachCard`; `Mode`, `PersonaKey` from `./gameMachine` (import type where type-only).
- Produces (consumed by Task 10b):

```tsx
export function CoachFeed({ stats, coach, persistent, onPlay, onDrill, onReport, onOpenHand }: {
  stats: ProfileStats;
  coach: CoachCard;
  persistent: boolean;
  onPlay: (mode: Mode, personaKey: PersonaKey) => void;
  onDrill: (leakKey: string, personaKey: PersonaKey) => void;
  onReport: () => void;
  onOpenHand: (handId: number) => void;
}): JSX-element
```

**Requirements (locked):**
1. App title header (display serif, e.g. "Probabilistic Poker Engine" with a "Midnight Casino" flourish is fine — judgment).
2. **Storage warning banner** rendered when `persistent === false`, exact copy: `Progress isn't being saved — IndexedDB is unavailable in this browser.` Hidden when `persistent` is true. Give it `role="alert"`.
3. **Coach card** (the headline element):
   - When `coach.leak` is non-null: "Your biggest leak" heading, `coach.leak.label` in plain English, evidence line with EV lost (chips, "est." marker) and mistake count, up to 3 "Hand #<id>" buttons over `coach.leak.handIds` calling `onOpenHand(id)`, and a prominent **"Drill This Spot"** button calling `onDrill(coach.leak.key, <currently selected persona>)` — the same persona select that drives `onPlay`.
   - When `coach.leak` is null and `stats.handsGraded > 0`: positive copy containing "No leaks big enough to name yet".
   - When `stats.handsGraded === 0`: welcome copy inviting the first session.
4. **Next focus queue**: list of `coach.queue` labels (render section only when non-empty).
5. **Graduated** section (only when non-empty): each `coach.graduated` entry as `<label> — graduated at NN% over M decisions` (accuracy rounded to whole %).
6. **Streak**: show `coach.streak` as "clean-decision streak" when `>= 3`.
7. **Play controls**: mode toggle (Training / Match), persona select (The Nit / The Maniac / The Calling Station / The Balanced Player → keys `nit|maniac|station|balanced`), and a "Deal In" button calling `onPlay(mode, personaKey)`. Default `training` + `balanced`.
8. "Report Card" nav button calling `onReport`.
9. Styling in `CoachFeed.css`, theme tokens only, imported by the component. No live-hand data appears here (this screen never renders during a hand).

- [ ] **Step 1: Write the failing test** — create `app/src/ui/CoachFeed.test.tsx` (`// @vitest-environment jsdom`). Cases: (a) warning banner by role `alert` when `persistent={false}`, absent when true; (b) with a synthetic coach card: leak label rendered, "Drill This Spot" click calls `onDrill` with the key and the default `'balanced'` persona, hand link calls `onOpenHand`; (c) graduated line renders "graduated at 92%" for accuracy 0.92; (d) "Deal In" default calls `onPlay('training', 'balanced')`, and after choosing Match + The Maniac calls `onPlay('match', 'maniac')`; (e) Report Card button calls `onReport`.
- [ ] **Step 2: Run to verify it fails** — `npx vitest run src/ui/CoachFeed.test.tsx`.
- [ ] **Step 3: Implement** `CoachFeed.tsx` + `CoachFeed.css`.
- [ ] **Step 4: Run to verify it passes** — `npx vitest run src/ui/CoachFeed.test.tsx` — ALL PASS.
- [ ] **Step 5: Commit**

```bash
git add src/ui/CoachFeed.tsx src/ui/CoachFeed.css src/ui/CoachFeed.test.tsx
git commit -m "feat(ui): Coach Feed — biggest leak card, drill entry, graduation, play controls"
```

---

### Task 10a: useGame drill support [sonnet]

**Files:**
- Modify: `app/src/ui/useGame.ts`
- Test: `app/src/ui/useGame.test.tsx` (append tests; do not alter existing ones)

**Interfaces:**
- Consumes: Task 7 `DrillDeal` from `../profile/drills` (import type).
- Produces (consumed by Task 10b) — the `Game` interface gains exactly:

```ts
drill: string | null; // active drill leak key, null in normal play
startDrill: (personaKey: PersonaKey, key: string, deal: DrillDeal) => void;
```

**Requirements (locked):**
1. `startDrill(personaKey, key, deal)`: starts a **training**-mode session (`newSession('training', personaKey, deal.cfg.seed)`), then starts the hand from `deal.cfg` **verbatim** (not from `dealHand`) — refactor the internal `deal` callback so both paths share the reset logic (villainRng from `(cfg.seed ^ 0x5bd1e995) >>> 0`, clear board/grades/race/ended flags). Session bookkeeping: bump `handNumber` to 1 via the same mechanics or set directly; hero must still be seat 0. Store `deal.heroScript` in a ref and set `drill` state to `key`.
2. **Script auto-play**: while `phase === 'hero'` and unconsumed script actions remain, auto-apply the next script action after ~350 ms (constant `DRILL_SCRIPT_STEP_MS = 350`, exported). The player takes over live exactly when the script is exhausted. Script must be cleared whenever a new hand is dealt or a session starts.
3. `startSession` and `nextHand` must reset `drill` to null and clear any leftover script. During a drill, `nextHand()` is a **no-op** (the App layer generates the next drill deal and calls `startDrill` again).
4. Everything else about the hook (grading, runouts, phases) untouched. No other changes to existing behavior — existing tests must keep passing unmodified.
5. Villain-persona note: grading uses `PERSONAS[session.personaKey]`, and `startDrill` sets the session persona, so drill hands grade against the same persona automatically — verify this holds in your implementation.

- [ ] **Step 1: Write the failing tests** — append to `useGame.test.tsx` a `describe('drills', ...)` using fake timers and `GradeClient` like the existing tests. Cases: (a) `startDrill('station', 'flop|unopened|air', dealWithScript)` where `dealWithScript` is a hand-built `DrillDeal` (e.g. `cfg = { buttonSeat: 0, stacks: [10000,10000], smallBlind: 50, bigBlind: 100, seed: 3 }`, `heroScript: [{ type: 'call' }]`): after start, `result.current.drill` is the key; advancing timers auto-plays the scripted call (hand log grows) and control eventually returns to a live phase; (b) `startSession` after a drill resets `drill` to null; (c) during a drill with `phase === 'over'`, `nextHand()` does not deal (hand unchanged).
- [ ] **Step 2: Run to verify new tests fail** — `npx vitest run src/ui/useGame.test.tsx` (existing tests must still pass).
- [ ] **Step 3: Implement** the changes in `useGame.ts`.
- [ ] **Step 4: Run to verify all pass** — `npx vitest run src/ui/useGame.test.tsx` — ALL PASS including pre-existing.
- [ ] **Step 5: Commit**

```bash
git add src/ui/useGame.ts src/ui/useGame.test.tsx
git commit -m "feat(ui): useGame drill mode — scripted fast-forward to the leak decision point"
```

---

### Task 10b: App shell rework — Coach Feed home, persistence wiring, drill flow [sonnet]

**Files:**
- Modify: `app/src/App.tsx`
- Modify: `app/src/App.css` (additions only, keep existing rules)
- Modify: `app/src/App.test.tsx`

**Interfaces:**
- Consumes: Tasks 4–9 exports (`aggregate`, `coachState`, `drillRecovered`, `openProfileStore`, `ProfileStore`, `buildHandRecord`, `generateDrill`, `leakLabel`), Task 10a `startDrill`/`drill`, existing `ReplayTheater` (read its props in `src/ui/ReplayTheater.tsx` and reuse as-is), existing `GameScreen`/ribbon wiring in `App.tsx`.
- Produces: the shipped app. No new exported API.

**Requirements (locked):**
1. **Screens**: `'home' | 'report' | 'game'` state. `home` renders `CoachFeed`, `report` renders `ReportCard`, `game` renders the existing game screen. The old `MenuScreen` is REMOVED — CoachFeed's play controls replace it (`onPlay` → `game.startSession(mode, persona)` + screen `'game'`).
2. **Store lifecycle**: on mount, `openProfileStore()` into state (`ProfileStore | null`); load `allHands()` into a `records` state; expose a `refresh` that reloads them. `persistent={store?.persistent ?? false}`... pass `true` while the store is still opening to avoid a warning flash, i.e. `store ? store.persistent : true`.
3. **Persist graded hands**: when `game.grades` becomes non-null for a finished hand, build `buildHandRecord(game.hand, 0, session.mode, session.personaKey, game.grades, game.drill)` and `store.addHand(...)`, exactly once per hand (guard with a ref keyed on e.g. `hand.cfg.seed`). Refresh records after saving. Hands whose grading failed (`gradesFailed`) are NOT persisted.
4. **Leave table**: replace the `window.location.reload()` handler with: set screen `'home'` and refresh records. `location.reload` must not appear anywhere in `src/` afterwards.
5. **Drill flow**: CoachFeed passes the persona with the key — `onDrill(key, personaKey)` → `generateDrill(key, personaKey, Date.now() >>> 0)`. If null: show a transient inline notice on home ("Couldn't deal that spot right now — try again."). Else `game.startDrill(personaKey, key, deal)` + screen `'game'`; App remembers the active drill's `{ key, personaKey }` for requirement 6.
6. **Drill UI in game screen**: when `game.drill` is non-null, show a banner over/beside the table: `Drilling: <leakLabel(key)>`, plus after each finished graded hand either `Recovered — nice work.` when `drillRecovered(records, key)` is true (with a "Back to coach" button) or a "Next drill" button that generates a fresh deal (`generateDrill(key, personaKey, Date.now() >>> 0)`) and `startDrill`s it. The banner must never show equity/odds for the live hand.
7. **Replay from records**: `onOpenHand(handId)` (from CoachFeed and ReportCard) finds the record and opens the existing `ReplayTheater` with that record's `state`/`grades` (match the props the component actually takes), as an overlay with a close action, from both home and report screens.
8. **No live help**: nothing new renders coach/stats data inside a live hand beyond the drill banner described above.
9. Keep all existing game-screen behavior (ribbon, theater from ribbon, sound toggle, hotkeys) working — this task rewires navigation and adds persistence; it does not restyle the table.

- [ ] **Step 1: Update tests first** — rewrite `App.test.tsx` expectations: (a) app boots to the Coach Feed (welcome copy, "Deal In" present); (b) "Deal In" → game screen appears (table renders); (c) leave-table control returns to Coach Feed WITHOUT `location.reload` (assert the home screen renders again; also `grep`-style assertion is done in step 4); (d) Report Card opens from home and returns. Keep/adapt any still-valid existing assertions. Note jsdom quirk from Plan 2: `openProfileStore` resolves the fake-less path — `indexedDB` is undefined in jsdom, so the memory fallback + warning banner path is what tests will see; assert the warning appears (role `alert`).
- [ ] **Step 2: Run to verify fails** — `npx vitest run src/App.test.tsx`.
- [ ] **Step 3: Implement** the App rework.
- [ ] **Step 4: Verify** — `npx vitest run src/App.test.tsx src/ui/useGame.test.tsx` ALL PASS, and `grep -rn "location.reload" src/` returns nothing.
- [ ] **Step 5: Commit**

```bash
git add src/App.tsx src/App.css src/App.test.tsx
git commit -m "feat(app): Coach Feed home, IndexedDB persistence wiring, drill flow, reload-free leave"
```

---

### Task 11: Playwright smoke as a repo test [sonnet]

**Files:**
- Modify: `app/package.json` (dev dep `@playwright/test` if not present; script `"test:e2e": "playwright test"`)
- Create: `app/playwright.config.ts`
- Create: `app/e2e/coach-flow.spec.ts`

**Requirements (locked):**
1. `playwright.config.ts`: `testDir: './e2e'`, chromium only, `webServer: { command: 'npm run dev', port: 5173, reuseExistingServer: true }`, `use: { baseURL: 'http://localhost:5173' }`.
2. Vitest must not pick up `e2e/` (it lives outside `src/`; verify `npm test` config globs don't match — if they do, exclude it).
3. `coach-flow.spec.ts` — one serial smoke test of the new flows:
   a. `goto('/')` → Coach Feed visible (welcome or coach card).
   b. Start a Training session vs The Balanced Player via the play controls → table visible.
   c. Play hands with the `f` hotkey (fold) — repeat fold + next-hand (`n`) for ~3 hands, waiting for the ribbon's graded review to appear each time (grading runs in a real worker here, allow generous timeouts).
   d. Leave the table → Coach Feed again (no full page reload: assert via a `window` marker set before leaving that survives navigation-free screen switch).
   e. Open Report Card → "hands graded" reflects ≥ 1; return home.
4. Keep it ONE spec file, resilient selectors (roles/text, not CSS classes).

- [ ] **Step 1: Install & scaffold** — from `app/`: check `@playwright/test` in devDependencies; if missing `npm install -D @playwright/test` (chromium browser is already installed on this machine from Plan 2; if the run complains, `npx playwright install chromium`). Add the `test:e2e` script.
- [ ] **Step 2: Write the spec and config** per requirements.
- [ ] **Step 3: Run** — `npx playwright test` from `app/`. Expected: 1 passed. Fix flakiness with waits on visible text, not sleeps.
- [ ] **Step 4: Commit**

```bash
git add package.json package-lock.json playwright.config.ts e2e/coach-flow.spec.ts
git commit -m "test(e2e): Playwright smoke — coach feed, training hands, ribbon review, report card"
```

---

### Task 12: Final verification [orchestrator]

- [ ] From `app/`: `npm test` — full suite green.
- [ ] From `app/`: `npx tsc -p tsconfig.app.json --noEmit` — no errors.
- [ ] From `app/`: `npx playwright test` — smoke green.
- [ ] `grep -rn "location.reload\|#c4536a" src/ | grep -v theme.css` — empty.
- [ ] Update `.superpowers/sdd/progress.md` ledger; report to the user and ASK BEFORE MERGING.

---

## Deferred (Plan 4+ candidates)

- Egregious-sizing flags surfaced in the Report Card (grading emits action-level only today).
- Coach Feed "links to offending hands" open the full Replay Theater; deep-linking to the exact decision within the theater is a polish item.
- Settings UI backed by `ProfileStore.get/setSetting` (sound preference persistence).
- Real EV model for preflop decisions (replace the 1 BB proxy).
