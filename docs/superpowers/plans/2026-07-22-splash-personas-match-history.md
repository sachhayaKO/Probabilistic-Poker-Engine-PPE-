# Splash Screen, Persona Cards & Match History Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a splash screen before the coach dashboard, replace the persona dropdown with rich selectable persona cards, and restructure the Report Card into Overview + Match History tabs with derived (read-time) session grouping.

**Architecture:** Sessions are derived from stored `HandRecord`s by a pure function (`groupSessions`) — no IndexedDB schema change. UI work reuses the Midnight Casino tokens in `app/src/ui/theme.css`. The `SuitPip` SVG component is extracted from `CoachFeed.tsx` for shared use; persona display copy/traits live in a new `personaMeta.ts` derived from the real engine `PERSONAS` params.

**Tech Stack:** React 19 + TypeScript + Vite, Vitest + @testing-library/react (jsdom), Playwright e2e, plain CSS with custom properties.

**Spec:** `docs/superpowers/specs/2026-07-22-splash-personas-match-history-design.md`

## Global Constraints

- All commands run from `app/` (`/Users/kimet/Documents/GitHub/Probabilistic-Poker-Engine-PPE-/app`).
- Session gap constant: `SESSION_GAP_MS = 30 * 60_000` (30 minutes), exactly as specced.
- Persona crests: nit = spade, maniac = heart, station = club, balanced = diamond.
- Trait meters: Looseness = `preflopRange`, Aggression = `aggression`, Stubbornness = `1 - foldToRaise`.
- Splash tagline copy, verbatim: `A poker trainer that learns your leaks.`
- Splash button copy, verbatim: `Enter the Casino`.
- No emoji as icons — vector `SuitPip` only. All colors from theme tokens (no new raw hex except inside gradients already patterned in theme.css).
- Touch targets ≥ 44px on primary controls; visible `:focus-visible` / `:focus-within` rings; all new animation disabled under `prefers-reduced-motion`.
- Test-runner note: vitest jsdom environment startup is slow (~50s) — always scope runs to the named file.
- After every task: `npx tsc --noEmit` must be clean.

---

### Task 1: `groupSessions` — derived session grouping

**Files:**
- Create: `app/src/profile/sessions.ts`
- Test: `app/src/profile/sessions.test.ts`

**Interfaces:**
- Consumes: `HandRecord` from `app/src/profile/records.ts` (fields used: `id`, `ts`, `mode`, `personaKey`, `drill`, `bigBlind`, `heroNet`, `decisions[].label`).
- Produces: `SESSION_GAP_MS: number`, `interface SessionSummary { start; end; mode; personaKey; drill; handCount; netChips; netBB; accuracy; mistakes; handIds }`, `function groupSessions(records: HandRecord[]): SessionSummary[]` (returns **newest session first**). Task 6 imports all three.

- [ ] **Step 1: Write the failing test**

Create `app/src/profile/sessions.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import type { HandRecord, StoredDecision } from './records';
import type { HandState } from '../engine/hand';
import { SESSION_GAP_MS, groupSessions } from './sessions';

const MIN = 60_000;

function decision(label: 'good' | 'mistake'): StoredDecision {
  return { label } as unknown as StoredDecision;
}

function rec(overrides: Partial<HandRecord>): HandRecord {
  return {
    id: 1,
    ts: 0,
    mode: 'training',
    personaKey: 'balanced',
    drill: null,
    bigBlind: 2,
    heroNet: 0,
    state: {} as HandState, // grouping never touches the replay state
    grades: [],
    decisions: [],
    ...overrides,
  };
}

describe('groupSessions', () => {
  it('returns [] for no records', () => {
    expect(groupSessions([])).toEqual([]);
  });

  it('groups consecutive same-persona/mode hands and computes summary math', () => {
    const records = [
      rec({ id: 1, ts: 0, heroNet: 10, decisions: [decision('good'), decision('mistake')] }),
      rec({ id: 2, ts: MIN, heroNet: -4, decisions: [decision('good'), decision('good')] }),
    ];
    const sessions = groupSessions(records);
    expect(sessions).toHaveLength(1);
    const s = sessions[0];
    expect(s.start).toBe(0);
    expect(s.end).toBe(MIN);
    expect(s.mode).toBe('training');
    expect(s.personaKey).toBe('balanced');
    expect(s.drill).toBeNull();
    expect(s.handCount).toBe(2);
    expect(s.netChips).toBe(6);
    expect(s.netBB).toBeCloseTo(3); // 10/2 + (-4)/2
    expect(s.mistakes).toBe(1);
    expect(s.accuracy).toBeCloseTo(3 / 4);
    expect(s.handIds).toEqual([1, 2]);
  });

  it('splits when the gap between hands exceeds SESSION_GAP_MS', () => {
    const records = [
      rec({ id: 1, ts: 0 }),
      rec({ id: 2, ts: SESSION_GAP_MS + 1 }),
    ];
    expect(groupSessions(records)).toHaveLength(2);
  });

  it('does not split at exactly SESSION_GAP_MS', () => {
    const records = [rec({ id: 1, ts: 0 }), rec({ id: 2, ts: SESSION_GAP_MS })];
    expect(groupSessions(records)).toHaveLength(1);
  });

  it('splits on persona change, mode change, and drill change', () => {
    const records = [
      rec({ id: 1, ts: 0 }),
      rec({ id: 2, ts: MIN, personaKey: 'nit' }),
      rec({ id: 3, ts: 2 * MIN, personaKey: 'nit', mode: 'match' }),
      rec({ id: 4, ts: 3 * MIN, personaKey: 'nit', mode: 'match', drill: 'flop-cbet' }),
    ];
    const sessions = groupSessions(records);
    expect(sessions).toHaveLength(4);
  });

  it('keeps consecutive same-key drill hands in one drill session', () => {
    const records = [
      rec({ id: 1, ts: 0, drill: 'flop-cbet' }),
      rec({ id: 2, ts: MIN, drill: 'flop-cbet' }),
    ];
    const sessions = groupSessions(records);
    expect(sessions).toHaveLength(1);
    expect(sessions[0].drill).toBe('flop-cbet');
  });

  it('sorts input by ts and returns sessions newest-first', () => {
    const records = [
      rec({ id: 2, ts: SESSION_GAP_MS * 3 }),
      rec({ id: 1, ts: 0 }),
    ];
    const sessions = groupSessions(records);
    expect(sessions).toHaveLength(2);
    expect(sessions[0].handIds).toEqual([2]); // newest session first
    expect(sessions[1].handIds).toEqual([1]);
  });

  it('treats a hand with no decisions as accuracy 1', () => {
    const sessions = groupSessions([rec({ id: 1, ts: 0 })]);
    expect(sessions[0].accuracy).toBe(1);
  });

  it('skips undefined ids in handIds', () => {
    const sessions = groupSessions([rec({ id: undefined, ts: 0 }), rec({ id: 5, ts: MIN })]);
    expect(sessions[0].handIds).toEqual([5]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/profile/sessions.test.ts`
Expected: FAIL — `Cannot find module './sessions'` (or equivalent resolve error).

- [ ] **Step 3: Write the implementation**

Create `app/src/profile/sessions.ts`:

```ts
import type { Mode, PersonaKey } from '../ui/gameMachine';
import type { HandRecord } from './records';

/** Hands further apart than this start a new session. */
export const SESSION_GAP_MS = 30 * 60_000;

export interface SessionSummary {
  start: number; // ts of first hand
  end: number; // ts of last hand
  mode: Mode;
  personaKey: PersonaKey;
  drill: string | null; // leak key for drill sessions, null for play
  handCount: number;
  netChips: number;
  netBB: number;
  accuracy: number; // 1 when the session has no graded decisions
  mistakes: number;
  handIds: number[]; // chronological; hands without a store id are skipped
}

function sameSession(prev: HandRecord, next: HandRecord): boolean {
  return (
    prev.mode === next.mode &&
    prev.personaKey === next.personaKey &&
    prev.drill === next.drill &&
    next.ts - prev.ts <= SESSION_GAP_MS
  );
}

function summarize(bucket: HandRecord[]): SessionSummary {
  let decisions = 0;
  let good = 0;
  let mistakes = 0;
  let netChips = 0;
  let netBB = 0;
  const handIds: number[] = [];
  for (const r of bucket) {
    netChips += r.heroNet;
    netBB += r.heroNet / r.bigBlind;
    if (r.id !== undefined) handIds.push(r.id);
    for (const d of r.decisions) {
      decisions++;
      if (d.label === 'mistake') mistakes++;
      else good++;
    }
  }
  return {
    start: bucket[0].ts,
    end: bucket[bucket.length - 1].ts,
    mode: bucket[0].mode,
    personaKey: bucket[0].personaKey,
    drill: bucket[0].drill,
    handCount: bucket.length,
    netChips,
    netBB,
    accuracy: decisions === 0 ? 1 : good / decisions,
    mistakes,
    handIds,
  };
}

/** Groups stored hands into sessions, newest session first. */
export function groupSessions(records: HandRecord[]): SessionSummary[] {
  const sorted = [...records].sort((a, b) => a.ts - b.ts);
  const sessions: SessionSummary[] = [];
  let bucket: HandRecord[] = [];
  for (const r of sorted) {
    if (bucket.length > 0 && !sameSession(bucket[bucket.length - 1], r)) {
      sessions.push(summarize(bucket));
      bucket = [];
    }
    bucket.push(r);
  }
  if (bucket.length > 0) sessions.push(summarize(bucket));
  return sessions.reverse();
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/profile/sessions.test.ts`
Expected: PASS (8 tests).

- [ ] **Step 5: Type-check and commit**

```bash
npx tsc --noEmit
git add src/profile/sessions.ts src/profile/sessions.test.ts
git commit -m "feat(profile): groupSessions derives match/session history from hand records"
```

---

### Task 2: Extract `SuitPip`, add `personaMeta`

**Files:**
- Create: `app/src/ui/SuitPip.tsx`
- Create: `app/src/ui/personaMeta.ts`
- Modify: `app/src/ui/CoachFeed.tsx` (remove local SuitPip, import it)
- Test: `app/src/ui/personaMeta.test.ts`

**Interfaces:**
- Consumes: `PERSONAS` record from `app/src/personas/persona.ts` (`{ name, preflopRange, aggression, callDown, bluffFreq, foldToRaise }` per key).
- Produces:
  - `SuitPip({ suit, className }: { suit: 'spade' | 'heart' | 'diamond' | 'club'; className?: string })` — aria-hidden SVG. Tasks 3, 5, 6 import it.
  - `type Suit`, `interface PersonaMeta { key; name; crest: Suit; blurb: string; traits: { label: string; value: number }[] }`, `const PERSONA_KEYS: PersonaKey[]`, `function personaMeta(key: PersonaKey): PersonaMeta`. Tasks 5 and 6 import these.

- [ ] **Step 1: Write the failing test**

Create `app/src/ui/personaMeta.test.ts`:

```ts
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/ui/personaMeta.test.ts`
Expected: FAIL — cannot resolve `./personaMeta`.

- [ ] **Step 3: Create `SuitPip.tsx` and `personaMeta.ts`**

Create `app/src/ui/SuitPip.tsx` (moved verbatim from `CoachFeed.tsx`, now exported):

```tsx
export type Suit = 'spade' | 'heart' | 'diamond' | 'club';

const PATHS: Record<Suit, string> = {
  spade:
    'M12 2C9 7 4 10 4 14a4 4 0 0 0 7 2.6c-.2 1.8-.8 3.2-2 4.4h6c-1.2-1.2-1.8-2.6-2-4.4A4 4 0 0 0 20 14c0-4-5-7-8-12z',
  heart:
    'M12 21c-5.5-4.5-9-7.8-9-11.5A4.5 4.5 0 0 1 12 6.6 4.5 4.5 0 0 1 21 9.5C21 13.2 17.5 16.5 12 21z',
  diamond: 'M12 2l6.5 10L12 22 5.5 12 12 2z',
  club:
    'M12 2a4 4 0 0 0-3.2 6.4 4 4 0 1 0 2.2 7c-.2 2-.8 3.4-2 4.6h6c-1.2-1.2-1.8-2.6-2-4.6a4 4 0 1 0 2.2-7A4 4 0 0 0 12 2z',
};

/** Decorative vector card-suit glyph. Always aria-hidden; color via currentColor. */
export function SuitPip({ suit, className }: { suit: Suit; className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true" focusable="false">
      <path d={PATHS[suit]} fill="currentColor" />
    </svg>
  );
}
```

Create `app/src/ui/personaMeta.ts`:

```ts
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
```

- [ ] **Step 4: Point `CoachFeed.tsx` at the shared component**

In `app/src/ui/CoachFeed.tsx`:
1. Delete the entire local `SuitPip` function (the block starting with the comment `/* Vector suit pips — decorative, consistent stroke-free glyph family */` through its closing brace).
2. Add to the imports: `import { SuitPip } from './SuitPip';`

- [ ] **Step 5: Run tests to verify green**

Run: `npx vitest run src/ui/personaMeta.test.ts src/ui/CoachFeed.test.tsx`
Expected: PASS (3 + 5 tests) — CoachFeed still renders with the extracted pip.

- [ ] **Step 6: Type-check and commit**

```bash
npx tsc --noEmit
git add src/ui/SuitPip.tsx src/ui/personaMeta.ts src/ui/personaMeta.test.ts src/ui/CoachFeed.tsx
git commit -m "refactor(ui): extract SuitPip, add personaMeta display metadata"
```

---

### Task 3: Splash screen component

**Files:**
- Create: `app/src/ui/Splash.tsx`
- Create: `app/src/ui/Splash.css`
- Test: `app/src/ui/Splash.test.tsx`

**Interfaces:**
- Consumes: `SuitPip` from Task 2; `.card`/`.card-back` and `deal-in`/`glow-pulse` styles from `theme.css`; `.btn`/`.btn-gold` from `App.css`.
- Produces: `Splash({ onEnter }: { onEnter: () => void })`. Task 4 imports it.

- [ ] **Step 1: Write the failing test**

Create `app/src/ui/Splash.test.tsx`:

```tsx
// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { Splash } from './Splash';

describe('Splash', () => {
  it('renders title, flourish, and tagline', () => {
    render(<Splash onEnter={() => {}} />);
    expect(screen.getByRole('heading', { name: /probabilistic poker engine/i })).toBeTruthy();
    expect(screen.getByText(/midnight casino/i)).toBeTruthy();
    expect(screen.getByText('A poker trainer that learns your leaks.')).toBeTruthy();
  });

  it('calls onEnter from the button', () => {
    const onEnter = vi.fn();
    render(<Splash onEnter={onEnter} />);
    fireEvent.click(screen.getByRole('button', { name: /enter the casino/i }));
    expect(onEnter).toHaveBeenCalled();
  });

  it('calls onEnter when clicking anywhere on the screen', () => {
    const onEnter = vi.fn();
    const { container } = render(<Splash onEnter={onEnter} />);
    fireEvent.click(container.firstElementChild!);
    expect(onEnter).toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/ui/Splash.test.tsx`
Expected: FAIL — cannot resolve `./Splash`.

- [ ] **Step 3: Implement the component**

Create `app/src/ui/Splash.tsx`:

```tsx
import { SuitPip } from './SuitPip';
import './Splash.css';

export interface SplashProps {
  onEnter: () => void;
}

/** Full-viewport gate shown before the coach dashboard. Click anywhere to enter. */
export function Splash({ onEnter }: SplashProps) {
  return (
    <div className="splash" onClick={onEnter}>
      <div className="splash-stage">
        <div className="splash-card card card-back dealt" aria-hidden="true" />
        <h1 className="splash-title">
          Probabilistic Poker Engine
          <span className="splash-flourish">Midnight Casino</span>
        </h1>
        <p className="splash-tagline">A poker trainer that learns your leaks.</p>
        <button type="button" className="btn btn-gold splash-enter" onClick={onEnter}>
          <SuitPip suit="spade" className="splash-enter-pip" />
          Enter the Casino
        </button>
      </div>
    </div>
  );
}
```

Create `app/src/ui/Splash.css`:

```css
/* ── Splash: the door to the casino ──────────────────────────────── */
.splash {
  position: fixed;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px;
  background:
    radial-gradient(70% 55% at 50% 42%, rgba(18, 53, 36, 0.5), transparent 75%),
    radial-gradient(120% 90% at 50% 110%, rgba(201, 162, 39, 0.08), transparent 70%),
    var(--bg);
  cursor: pointer;
}

.splash-stage {
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  max-width: 560px;
}

.splash-card {
  width: 88px;
  height: 126px;
  margin-bottom: 28px;
  transform: rotate(-6deg);
  box-shadow: 0 14px 36px rgba(0, 0, 0, 0.6), 0 0 24px rgba(201, 162, 39, 0.18);
}

.splash-title {
  margin: 0 0 10px;
  font-family: var(--font-display);
  font-size: clamp(28px, 6vw, 44px);
  font-weight: 700;
  line-height: 1.12;
  color: var(--cream);
  letter-spacing: 0.01em;
}

.splash-flourish {
  display: block;
  margin-top: 10px;
  font-size: clamp(12px, 2.4vw, 15px);
  font-weight: 400;
  color: var(--gold-soft);
  letter-spacing: 0.34em;
  text-transform: uppercase;
}

.splash-tagline {
  margin: 0 0 32px;
  font-size: 15px;
  font-style: italic;
  color: var(--muted);
}

.splash-enter {
  display: inline-flex;
  align-items: center;
  gap: 10px;
  min-height: 48px;
  padding: 12px 30px;
  font-size: 16px;
  letter-spacing: 0.06em;
}

.splash-enter:hover:not(:disabled) {
  animation: glow-pulse 1.6s ease-in-out infinite;
}

.splash-enter:focus-visible {
  outline: 2px solid var(--gold-soft);
  outline-offset: 2px;
}

.splash-enter-pip {
  width: 15px;
  height: 15px;
  flex: none;
}

/* Entrance: title fades up after the card deals in */
@keyframes splash-rise {
  from {
    opacity: 0;
    transform: translateY(16px);
  }
  to {
    opacity: 1;
    transform: none;
  }
}

.splash-title,
.splash-tagline,
.splash-enter {
  animation: splash-rise 420ms cubic-bezier(0.2, 0.7, 0.3, 1) both;
}

.splash-title {
  animation-delay: 180ms;
}

.splash-tagline {
  animation-delay: 280ms;
}

.splash-enter {
  animation-delay: 380ms;
}

@media (prefers-reduced-motion: reduce) {
  .splash-title,
  .splash-tagline,
  .splash-enter,
  .splash-card {
    animation: none !important;
  }
}
```

Note: `.splash-card.dealt` reuses the `deal-in` keyframes from `theme.css`; the reduced-motion block overrides it.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/ui/Splash.test.tsx`
Expected: PASS (3 tests).

- [ ] **Step 5: Type-check and commit**

```bash
npx tsc --noEmit
git add src/ui/Splash.tsx src/ui/Splash.css src/ui/Splash.test.tsx
git commit -m "feat(ui): splash screen gate before the coach dashboard"
```

---

### Task 4: Wire splash into App

**Files:**
- Modify: `app/src/App.tsx`
- Test: `app/src/App.test.tsx`

**Interfaces:**
- Consumes: `Splash` from Task 3.
- Produces: `Screen` union gains `'splash'`; app boots to splash; every existing flow reached by clicking Enter. Task 7's e2e relies on the button name `Enter the Casino`.

- [ ] **Step 1: Update App.test.tsx (failing first)**

In `app/src/App.test.tsx`, add a helper and a new first test, and route every existing test through the splash. The full updated file:

```tsx
// @vitest-environment jsdom
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import App from './App';

async function enterCasino() {
  fireEvent.click(await screen.findByRole('button', { name: /enter the casino/i }));
}

describe('App', () => {
  it('boots to the splash screen and enters the Coach Feed', async () => {
    render(<App />);
    expect(screen.getByRole('button', { name: /enter the casino/i })).toBeTruthy();
    expect(screen.queryByRole('button', { name: /deal in/i })).toBeNull();
    await enterCasino();
    expect(await screen.findByText(/Welcome to the tables/i)).toBeTruthy();
  });

  it('shows the Coach Feed home screen after entering', async () => {
    render(<App />);
    await enterCasino();
    expect(screen.getByText(/Midnight Casino/i)).toBeTruthy();
    expect(await screen.findByText(/Welcome to the tables/i)).toBeTruthy();
    expect(screen.getByRole('button', { name: /deal in/i })).toBeTruthy();
    // jsdom has no indexedDB: openProfileStore falls back to the memory
    // store, which surfaces the "not saved" warning.
    expect(await screen.findByRole('alert')).toBeTruthy();
  });

  it('deals in from Coach Feed into a live hand', async () => {
    render(<App />);
    await enterCasino();
    await screen.findByRole('button', { name: /deal in/i });
    fireEvent.click(screen.getByRole('button', { name: /deal in/i }));
    expect(screen.getByText(/Review/)).toBeTruthy(); // ribbon mounted
    expect(screen.getAllByLabelText('face-down card').length).toBeGreaterThan(0); // villain cards
  });

  it('leaving the table returns to Coach Feed without reloading the page', async () => {
    render(<App />);
    await enterCasino();
    await screen.findByRole('button', { name: /deal in/i });
    fireEvent.click(screen.getByRole('button', { name: /deal in/i }));
    fireEvent.click(screen.getByRole('button', { name: /leave table/i }));
    expect(await screen.findByText(/Welcome to the tables/i)).toBeTruthy();
  });

  it('opens the Report Card from home and returns to Coach Feed', async () => {
    render(<App />);
    await enterCasino();
    await screen.findByRole('button', { name: /deal in/i });
    fireEvent.click(screen.getByRole('button', { name: /report card/i }));
    expect(screen.getByRole('heading', { name: /Report Card/i })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: /back/i }));
    expect(await screen.findByText(/Welcome to the tables/i)).toBeTruthy();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/App.test.tsx`
Expected: FAIL — no button named "Enter the Casino".

- [ ] **Step 3: Wire the splash screen**

In `app/src/App.tsx`:

1. Add the import: `import { Splash } from './ui/Splash';`
2. Change the screen union: `type Screen = 'splash' | 'home' | 'report' | 'game';`
3. Change the initial state: `const [screen, setScreen] = useState<Screen>('splash');`
4. Add a splash branch **before** the `if (screen === 'home')` branch:

```tsx
  let content: ReactNode;
  if (screen === 'splash') {
    content = <Splash onEnter={() => setScreen('home')} />;
  } else if (screen === 'home') {
```

(The rest of the chain is unchanged.)

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/App.test.tsx`
Expected: PASS (5 tests).

- [ ] **Step 5: Type-check and commit**

```bash
npx tsc --noEmit
git add src/App.tsx src/App.test.tsx
git commit -m "feat(app): boot to splash screen before the coach dashboard"
```

---

### Task 5: Persona cards on the coach dashboard

**Files:**
- Modify: `app/src/ui/CoachFeed.tsx`
- Modify: `app/src/ui/CoachFeed.css`
- Test: `app/src/ui/CoachFeed.test.tsx`

**Interfaces:**
- Consumes: `PERSONA_KEYS`, `personaMeta` from Task 2; `SuitPip` from Task 2.
- Produces: persona selection via radios named `The Nit` / `The Maniac` / `The Calling Station` / `The Balanced Player` inside a radiogroup labeled `opponent`. Task 7's e2e checks `getByRole('radio', { name: /The Balanced Player/ })`.

- [ ] **Step 1: Update the persona-selection test (failing first)**

In `app/src/ui/CoachFeed.test.tsx`, replace test (d) with:

```tsx
  it('(d) Deal In defaults to training/balanced, and reflects Match + Maniac selection', () => {
    const onPlay = vi.fn();
    render(
      <CoachFeed
        stats={makeStats()}
        coach={makeCoach()}
        persistent={true}
        onPlay={onPlay}
        onDrill={noop}
        onReport={noop}
        onOpenHand={noop}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: /deal in/i }));
    expect(onPlay).toHaveBeenCalledWith('training', 'balanced');

    fireEvent.click(screen.getByRole('radio', { name: /match/i }));
    fireEvent.click(screen.getByRole('radio', { name: /the maniac/i }));
    fireEvent.click(screen.getByRole('button', { name: /deal in/i }));
    expect(onPlay).toHaveBeenCalledWith('match', 'maniac');
  });
```

And add a new test after it:

```tsx
  it('(f) renders all four persona cards with descriptions', () => {
    render(
      <CoachFeed
        stats={makeStats()}
        coach={makeCoach()}
        persistent={true}
        onPlay={noop}
        onDrill={noop}
        onReport={noop}
        onOpenHand={noop}
      />,
    );

    const group = screen.getByRole('radiogroup', { name: 'opponent' });
    expect(group).toBeTruthy();
    for (const name of [/the nit/i, /the maniac/i, /the calling station/i, /the balanced player/i]) {
      expect(screen.getByRole('radio', { name })).toBeTruthy();
    }
    expect(screen.getByText(/plays only premium hands/i)).toBeTruthy();
    expect(screen.getByRole('radio', { name: /the balanced player/i })).toHaveProperty(
      'checked',
      true,
    );
  });
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/ui/CoachFeed.test.tsx`
Expected: (d) and (f) FAIL — no radio named "The Maniac", no radiogroup "opponent".

- [ ] **Step 3: Replace the select with persona cards**

In `app/src/ui/CoachFeed.tsx`:

1. Add imports: `import { PERSONA_KEYS, personaMeta } from './personaMeta';`
2. Delete the module-level `const PERSONAS: { key: PersonaKey; label: string; blurb: string }[] = [...]` array and the `const persona = PERSONAS.find(...)` line in the component body.
3. In the play-controls section, delete the `<label className="coach-persona-select">…</label>` block and the `<p className="coach-persona-blurb">{persona.blurb}</p>` line.
4. In their place (after the closing `</div>` of `.coach-mode-toggle`, still inside `.coach-controls-row` — move the radiogroup **out** of the row so cards get full width; final structure below), render the card grid. The play-controls section becomes:

```tsx
      <section className="coach-play-controls coach-enter" style={{ '--stagger': 6 } as CSSProperties}>
        <div className="coach-controls-row">
          <div className="coach-mode-toggle" role="radiogroup" aria-label="mode">
            <label className={`coach-radio${mode === 'training' ? ' coach-radio-active' : ''}`}>
              <input
                type="radio"
                name="coach-mode"
                value="training"
                checked={mode === 'training'}
                onChange={() => setMode('training')}
              />
              Training
            </label>
            <label className={`coach-radio${mode === 'match' ? ' coach-radio-active' : ''}`}>
              <input
                type="radio"
                name="coach-mode"
                value="match"
                checked={mode === 'match'}
                onChange={() => setMode('match')}
              />
              Match
            </label>
          </div>
        </div>

        <div className="coach-persona-cards" role="radiogroup" aria-label="opponent">
          {PERSONA_KEYS.map((key) => {
            const m = personaMeta(key);
            const selected = personaKey === key;
            const red = m.crest === 'heart' || m.crest === 'diamond';
            return (
              <label
                key={key}
                className={`coach-persona-card${selected ? ' coach-persona-card-selected' : ''}`}
              >
                <input
                  type="radio"
                  name="coach-persona"
                  value={key}
                  checked={selected}
                  onChange={() => setPersonaKey(key)}
                />
                <span className="coach-persona-head">
                  <SuitPip
                    suit={m.crest}
                    className={`coach-persona-crest${red ? ' coach-persona-crest-red' : ''}`}
                  />
                  <span className="coach-persona-name">{m.name}</span>
                </span>
                <span className="coach-persona-blurb">{m.blurb}</span>
                <span className="coach-persona-traits">
                  {m.traits.map((t) => (
                    <span key={t.label} className="coach-persona-trait">
                      <span className="coach-persona-trait-label">{t.label}</span>
                      <span className="coach-persona-trait-meter">
                        <span
                          className="coach-persona-trait-fill"
                          style={{ width: `${Math.round(t.value * 100)}%` }}
                        />
                      </span>
                    </span>
                  ))}
                </span>
              </label>
            );
          })}
        </div>

        <button
          type="button"
          className="btn btn-gold coach-deal-btn"
          onClick={() => onPlay(mode, personaKey)}
        >
          <SuitPip suit="diamond" className="coach-deal-pip" />
          Deal In
        </button>
      </section>
```

- [ ] **Step 4: Style the cards**

In `app/src/ui/CoachFeed.css`, delete the `.coach-persona-select` rules (all three blocks: base, `select`, and hover/focus) and the `.coach-persona-blurb` block. Add:

```css
/* Persona cards */
.coach-persona-cards {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 10px;
}

.coach-persona-card {
  position: relative;
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 14px;
  background: rgba(0, 0, 0, 0.3);
  border: 1px solid var(--panel-edge);
  border-radius: 10px;
  cursor: pointer;
  transition: border-color 150ms ease, transform 150ms ease, box-shadow 150ms ease;
}

.coach-persona-card input {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  margin: 0;
  opacity: 0;
  cursor: pointer;
}

.coach-persona-card:hover {
  border-color: rgba(201, 162, 39, 0.45);
}

.coach-persona-card:focus-within {
  outline: 2px solid var(--gold-soft);
  outline-offset: 2px;
}

.coach-persona-card-selected {
  background:
    radial-gradient(140% 120% at 50% 0%, var(--felt) 0%, var(--felt-dark) 80%);
  border-color: var(--gold);
  transform: translateY(-2px);
  box-shadow: 0 8px 20px rgba(0, 0, 0, 0.45), inset 0 0 0 1px rgba(201, 162, 39, 0.25);
}

.coach-persona-head {
  display: flex;
  align-items: center;
  gap: 8px;
}

.coach-persona-crest {
  width: 15px;
  height: 15px;
  color: var(--gold);
  flex: none;
}

.coach-persona-crest-red {
  color: var(--red-soft);
}

.coach-persona-name {
  font-family: var(--font-display);
  font-size: 16px;
  color: var(--cream);
}

.coach-persona-blurb {
  font-size: 12.5px;
  line-height: 1.5;
  color: var(--muted);
}

.coach-persona-card-selected .coach-persona-blurb {
  color: var(--cream);
  opacity: 0.85;
}

.coach-persona-traits {
  display: flex;
  flex-direction: column;
  gap: 4px;
  margin-top: 2px;
}

.coach-persona-trait {
  display: grid;
  grid-template-columns: 86px 1fr;
  align-items: center;
  gap: 8px;
}

.coach-persona-trait-label {
  font-size: 10px;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--muted);
}

.coach-persona-trait-meter {
  height: 4px;
  border-radius: 2px;
  background: rgba(0, 0, 0, 0.45);
  overflow: hidden;
}

.coach-persona-trait-fill {
  display: block;
  height: 100%;
  border-radius: 2px;
  background: linear-gradient(90deg, var(--gold), var(--gold-soft));
}
```

And inside the existing `@media (max-width: 480px)` block, add:

```css
  .coach-persona-cards {
    grid-template-columns: 1fr;
  }
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `npx vitest run src/ui/CoachFeed.test.tsx src/App.test.tsx`
Expected: PASS (6 CoachFeed + 5 App). App tests must stay green — they exercise Deal In defaults.

- [ ] **Step 6: Type-check and commit**

```bash
npx tsc --noEmit
git add src/ui/CoachFeed.tsx src/ui/CoachFeed.css src/ui/CoachFeed.test.tsx
git commit -m "feat(ui): selectable persona cards with play-style descriptions and trait meters"
```

---

### Task 6: Report Card — Overview + Match History tabs

**Files:**
- Create: `app/src/ui/MatchHistory.tsx`
- Modify: `app/src/ui/ReportCard.tsx`
- Modify: `app/src/ui/ReportCard.css`
- Modify: `app/src/App.tsx` (pass `records`)
- Test: `app/src/ui/ReportCard.test.tsx`

**Interfaces:**
- Consumes: `groupSessions`, `SessionSummary` from Task 1; `personaMeta` + `SuitPip` from Task 2; `HandRecord` from `profile/records`.
- Produces: `ReportCardProps` gains `records: HandRecord[]`. `MatchHistory({ records, onOpenHand })` renders the session list. Tabs named `Overview` and `Match History` (role `tab`). Task 7's e2e clicks `getByRole('tab', { name: 'Match History' })`.

- [ ] **Step 1: Add failing tests**

In `app/src/ui/ReportCard.test.tsx` (existing file — read it first; keep existing tests, adjust every existing `render(<ReportCard …/>)` call to pass `records={[]}`). Add these imports if missing: `fireEvent`, `HandRecord`, `HandState`, `StoredDecision` (mirror the helpers from `sessions.test.ts`). Then add:

```tsx
function decision(label: 'good' | 'mistake'): StoredDecision {
  return { label } as unknown as StoredDecision;
}

function rec(overrides: Partial<HandRecord>): HandRecord {
  return {
    id: 1,
    ts: 0,
    mode: 'training',
    personaKey: 'balanced',
    drill: null,
    bigBlind: 2,
    heroNet: 0,
    state: {} as HandState,
    grades: [],
    decisions: [],
    ...overrides,
  };
}

describe('ReportCard match history', () => {
  const records = [
    rec({ id: 1, ts: 0, heroNet: 12, decisions: [decision('good')] }),
    rec({ id: 2, ts: 60_000, heroNet: -4, decisions: [decision('mistake')] }),
  ];

  it('switches to the Match History tab and lists sessions', () => {
    render(
      <ReportCard
        stats={makeStats()}
        records={records}
        onBack={noop}
        onOpenHand={noop}
      />,
    );
    fireEvent.click(screen.getByRole('tab', { name: 'Match History' }));
    expect(screen.getByText('The Balanced Player')).toBeTruthy();
    expect(screen.getByText('Training')).toBeTruthy();
    expect(screen.getByText('+8')).toBeTruthy(); // net chips, signed
    expect(screen.getByText(/2 hands/)).toBeTruthy();
  });

  it('expands a session to its hands and opens the replay', () => {
    const onOpenHand = vi.fn();
    render(
      <ReportCard
        stats={makeStats()}
        records={records}
        onBack={noop}
        onOpenHand={onOpenHand}
      />,
    );
    fireEvent.click(screen.getByRole('tab', { name: 'Match History' }));
    fireEvent.click(screen.getByRole('button', { name: /the balanced player/i }));
    fireEvent.click(screen.getByRole('button', { name: 'Hand #2' }));
    expect(onOpenHand).toHaveBeenCalledWith(2);
  });

  it('shows an empty state with no sessions', () => {
    render(<ReportCard stats={makeStats()} records={[]} onBack={noop} onOpenHand={noop} />);
    fireEvent.click(screen.getByRole('tab', { name: 'Match History' }));
    expect(screen.getByText(/play your first session/i)).toBeTruthy();
  });
});
```

Note: if the existing file's stats helper is named differently than `makeStats`/`noop`, reuse the existing names — do not duplicate helpers.

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/ui/ReportCard.test.tsx`
Expected: existing tests FAIL to compile (missing `records` prop) or new tests FAIL — both acceptable as the red state.

- [ ] **Step 3: Create `MatchHistory.tsx`**

Create `app/src/ui/MatchHistory.tsx`:

```tsx
import { useState } from 'react';
import type { HandRecord } from '../profile/records';
import type { SessionSummary } from '../profile/sessions';
import { groupSessions } from '../profile/sessions';
import { personaMeta } from './personaMeta';
import { SuitPip } from './SuitPip';

export interface MatchHistoryProps {
  records: HandRecord[];
  onOpenHand: (handId: number) => void;
}

function formatDate(ts: number): string {
  return new Date(ts).toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

function formatChips(n: number): string {
  const rounded = Math.round(n);
  return rounded >= 0 ? `+${rounded}` : `${rounded}`;
}

function badge(s: SessionSummary): string {
  if (s.drill) return 'Drill';
  return s.mode === 'match' ? 'Match' : 'Training';
}

function SessionHands({
  session,
  records,
  onOpenHand,
}: {
  session: SessionSummary;
  records: HandRecord[];
  onOpenHand: (handId: number) => void;
}) {
  const byId = new Map(records.filter((r) => r.id !== undefined).map((r) => [r.id!, r]));
  return (
    <ul className="history-hands">
      {session.handIds.map((id) => {
        const hand = byId.get(id);
        if (!hand) return null;
        const mistakes = hand.decisions.filter((d) => d.label === 'mistake').length;
        return (
          <li key={id} className="history-hand">
            <span className={`history-hand-net${hand.heroNet < 0 ? ' history-neg' : ' history-pos'}`}>
              {formatChips(hand.heroNet)}
            </span>
            <span className="history-hand-mistakes">
              {mistakes === 0 ? 'clean' : `${mistakes} mistake${mistakes === 1 ? '' : 's'}`}
            </span>
            <button type="button" className="history-hand-btn" onClick={() => onOpenHand(id)}>
              Hand #{id}
            </button>
          </li>
        );
      })}
    </ul>
  );
}

export function MatchHistory({ records, onOpenHand }: MatchHistoryProps) {
  const sessions = groupSessions(records);
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  if (sessions.length === 0) {
    return <p className="report-empty">Play your first session — your match history will appear here.</p>;
  }

  return (
    <ul className="history-list">
      {sessions.map((s, i) => {
        const m = personaMeta(s.personaKey);
        const red = m.crest === 'heart' || m.crest === 'diamond';
        const open = openIndex === i;
        return (
          <li key={`${s.start}-${i}`} className={`history-session${open ? ' history-session-open' : ''}`}>
            <button
              type="button"
              className="history-row"
              aria-expanded={open}
              onClick={() => setOpenIndex(open ? null : i)}
            >
              <span className="history-date">{formatDate(s.start)}</span>
              <span className="history-persona">
                <SuitPip suit={m.crest} className={`history-crest${red ? ' history-crest-red' : ''}`} />
                {m.name}
              </span>
              <span className={`history-badge history-badge-${badge(s).toLowerCase()}`}>{badge(s)}</span>
              <span className="history-hand-count">{s.handCount} hands</span>
              <span className={`history-net${s.netChips < 0 ? ' history-neg' : ' history-pos'}`}>
                {formatChips(s.netChips)}
              </span>
              <span className="history-accuracy">{Math.round(s.accuracy * 100)}%</span>
            </button>
            {open && <SessionHands session={s} records={records} onOpenHand={onOpenHand} />}
          </li>
        );
      })}
    </ul>
  );
}
```

- [ ] **Step 4: Add tabs to `ReportCard.tsx`**

In `app/src/ui/ReportCard.tsx`:

1. Add imports:

```tsx
import { useState } from 'react';
import type { HandRecord } from '../profile/records';
import { MatchHistory } from './MatchHistory';
```

2. Extend the props:

```tsx
export interface ReportCardProps {
  stats: ProfileStats;
  records: HandRecord[];
  onBack: () => void;
  onOpenHand: (handId: number) => void;
}
```

3. Restructure the component body — tab state, tab bar under the header, and the existing content becomes the Overview panel:

```tsx
export function ReportCard({ stats, records, onBack, onOpenHand }: ReportCardProps) {
  const [tab, setTab] = useState<'overview' | 'history'>('overview');

  return (
    <div className="report-card">
      <header className="report-header">
        <h1 className="report-title">Report Card</h1>
        <button type="button" className="btn btn-gold" onClick={onBack}>
          Back
        </button>
      </header>

      <div className="report-tabs" role="tablist" aria-label="report sections">
        <button
          type="button"
          role="tab"
          aria-selected={tab === 'overview'}
          className={`report-tab${tab === 'overview' ? ' report-tab-active' : ''}`}
          onClick={() => setTab('overview')}
        >
          Overview
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={tab === 'history'}
          className={`report-tab${tab === 'history' ? ' report-tab-active' : ''}`}
          onClick={() => setTab('history')}
        >
          Match History
        </button>
      </div>

      {tab === 'history' ? (
        <MatchHistory records={records} onOpenHand={onOpenHand} />
      ) : stats.handsGraded === 0 ? (
        <p className="report-empty">Play some hands — your report card will appear here.</p>
      ) : (
        <>
          {/* …existing tiles / trend / leaks JSX, unchanged… */}
        </>
      )}
    </div>
  );
}
```

(The `{/* …existing… */}` comment stands for the current tiles/trend/leaks JSX already in the file — keep it exactly as is inside the fragment.)

4. Upgrade the trend chart with a gold area fill. Replace the `TrendChart` return with:

```tsx
  return (
    <svg
      className="report-trend-svg"
      viewBox={`0 0 ${width} ${height}`}
      preserveAspectRatio="none"
      role="img"
      aria-label="accuracy trend"
    >
      <defs>
        <linearGradient id="trend-fill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="var(--gold)" stopOpacity="0.35" />
          <stop offset="100%" stopColor="var(--gold)" stopOpacity="0" />
        </linearGradient>
      </defs>
      <polygon points={`0,${height} ${points} ${width},${height}`} fill="url(#trend-fill)" />
      <polyline points={points} fill="none" stroke="var(--gold)" strokeWidth="1.5" />
    </svg>
  );
```

5. In `app/src/App.tsx`, pass the records:

```tsx
    content = (
      <ReportCard
        stats={profileStats}
        records={records}
        onBack={() => setScreen('home')}
        onOpenHand={handleOpenHand}
      />
    );
```

- [ ] **Step 5: Style tabs and history**

Append to `app/src/ui/ReportCard.css`:

```css
/* ── Tabs ─────────────────────────────────────────────────────────── */
.report-tabs {
  display: inline-flex;
  padding: 3px;
  gap: 2px;
  margin-bottom: 24px;
  background: rgba(0, 0, 0, 0.35);
  border: 1px solid var(--panel-edge);
  border-radius: 999px;
}

.report-tab {
  min-height: 38px;
  padding: 0 20px;
  border: none;
  border-radius: 999px;
  background: transparent;
  color: var(--muted);
  font-family: var(--font-body);
  font-size: 13px;
  letter-spacing: 0.04em;
  cursor: pointer;
  transition: color 150ms ease, background 150ms ease;
}

.report-tab:hover:not(.report-tab-active) {
  color: var(--cream);
}

.report-tab-active {
  background: linear-gradient(160deg, var(--gold-soft), var(--gold));
  color: var(--ink);
  font-weight: 700;
}

.report-tab:focus-visible {
  outline: 2px solid var(--gold-soft);
  outline-offset: 2px;
}

/* ── Match history ────────────────────────────────────────────────── */
.history-list {
  margin: 0;
  padding: 0;
  list-style: none;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.history-session {
  background: var(--panel);
  border: 1px solid var(--panel-edge);
  border-radius: 10px;
  overflow: hidden;
}

.history-session-open {
  border-color: rgba(201, 162, 39, 0.45);
}

.history-row {
  display: grid;
  grid-template-columns: 120px 1fr 84px 76px 64px 52px;
  align-items: center;
  gap: 10px;
  width: 100%;
  min-height: 48px;
  padding: 10px 14px;
  border: none;
  background: transparent;
  color: var(--cream);
  font-family: var(--font-body);
  font-size: 13px;
  text-align: left;
  cursor: pointer;
  transition: background 150ms ease;
}

.history-row:hover {
  background: rgba(201, 162, 39, 0.06);
}

.history-row:focus-visible {
  outline: 2px solid var(--gold-soft);
  outline-offset: -2px;
}

.history-date {
  font-family: var(--font-mono);
  font-size: 12px;
  color: var(--muted);
}

.history-persona {
  display: flex;
  align-items: center;
  gap: 7px;
  font-family: var(--font-display);
  font-size: 14px;
}

.history-crest {
  width: 13px;
  height: 13px;
  color: var(--gold);
  flex: none;
}

.history-crest-red {
  color: var(--red-soft);
}

.history-badge {
  justify-self: start;
  padding: 3px 10px;
  border-radius: 999px;
  font-size: 11px;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  border: 1px solid var(--panel-edge);
  color: var(--muted);
}

.history-badge-match {
  border-color: var(--gold);
  color: var(--gold-soft);
}

.history-badge-drill {
  border-color: var(--red-soft);
  color: var(--red-soft);
}

.history-hand-count {
  font-family: var(--font-mono);
  font-size: 12px;
  color: var(--muted);
}

.history-net,
.history-hand-net {
  font-family: var(--font-mono);
  font-variant-numeric: tabular-nums;
  font-size: 13px;
}

.history-pos {
  color: var(--good);
}

.history-neg {
  color: var(--red-soft);
}

.history-accuracy {
  font-family: var(--font-mono);
  font-size: 12px;
  color: var(--cream);
  text-align: right;
}

.history-hands {
  margin: 0;
  padding: 6px 14px 12px;
  list-style: none;
  border-top: 1px solid var(--panel-edge);
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.history-hand {
  display: flex;
  align-items: center;
  gap: 14px;
  font-size: 13px;
}

.history-hand-mistakes {
  color: var(--muted);
  font-size: 12px;
  flex: 1;
}

.history-hand-btn {
  font-family: var(--font-mono);
  font-size: 11px;
  color: var(--gold-soft);
  background: transparent;
  border: 1px solid var(--panel-edge);
  border-radius: 4px;
  padding: 6px 10px;
  cursor: pointer;
}

.history-hand-btn:hover {
  border-color: var(--gold);
  color: var(--gold);
}

@media (max-width: 640px) {
  .history-row {
    grid-template-columns: 1fr auto;
    grid-auto-flow: row dense;
    row-gap: 4px;
  }
}
```

- [ ] **Step 6: Run tests to verify they pass**

Run: `npx vitest run src/ui/ReportCard.test.tsx src/App.test.tsx`
Expected: PASS (all existing ReportCard tests + 3 new, 5 App).

- [ ] **Step 7: Type-check and commit**

```bash
npx tsc --noEmit
git add src/ui/MatchHistory.tsx src/ui/ReportCard.tsx src/ui/ReportCard.css src/ui/ReportCard.test.tsx src/App.tsx
git commit -m "feat(ui): Report Card tabs with derived match history and replayable sessions"
```

---

### Task 7: E2E flow update + full verification + visual QA

**Files:**
- Modify: `app/e2e/coach-flow.spec.ts`

**Interfaces:**
- Consumes: splash button `Enter the Casino` (Task 4), persona radio names (Task 5), tab `Match History` (Task 6).

- [ ] **Step 1: Update the e2e spec**

In `app/e2e/coach-flow.spec.ts`:

1. After `await page.goto('/');`, add the splash step as the new step (a):

```ts
  // a. Splash gate -> enter the casino.
  await expect(page.getByRole('button', { name: 'Enter the Casino' })).toBeVisible();
  await page.getByRole('button', { name: 'Enter the Casino' }).click();
```

2. Replace the persona dropdown line `await page.getByLabel('Persona').selectOption('balanced');` with:

```ts
  await page.getByRole('radio', { name: /The Balanced Player/ }).check();
```

3. In step (e), after the hands-graded assertion and before clicking Back, add:

```ts
  // f. Match history tab lists the session just played, expandable to hands.
  await page.getByRole('tab', { name: 'Match History' }).click();
  await expect(page.getByText(/The Balanced Player/).first()).toBeVisible();
  await page.getByRole('button', { name: /The Balanced Player/ }).first().click();
  await expect(page.getByRole('button', { name: /Hand #\d+/ }).first()).toBeVisible();
```

- [ ] **Step 2: Run the full test suite**

```bash
npx tsc --noEmit
npx vitest run
npx playwright test
```

Expected: all unit/component tests PASS; e2e spec PASSES. (Playwright config already serves the dev build; if the run reports a missing browser, run `npx playwright install chromium` once.)

- [ ] **Step 3: Visual QA screenshots**

Start the dev server and screenshot the three screens at desktop and mobile widths:

```bash
(npm run dev -- --port 5199 >/tmp/vite.log 2>&1 &)
sleep 12
node -e "
const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch();
  for (const [tag, w, h] of [['desktop', 1280, 900], ['mobile', 375, 812]]) {
    const p = await b.newPage({ viewport: { width: w, height: h } });
    await p.goto('http://localhost:5199');
    await p.waitForTimeout(1200);
    await p.screenshot({ path: '/tmp/qa-splash-' + tag + '.png' });
    await p.getByRole('button', { name: 'Enter the Casino' }).click();
    await p.waitForTimeout(800);
    await p.screenshot({ path: '/tmp/qa-home-' + tag + '.png', fullPage: true });
    await p.getByRole('button', { name: 'Report Card' }).click();
    await p.waitForTimeout(500);
    await p.screenshot({ path: '/tmp/qa-report-' + tag + '.png', fullPage: true });
  }
  await b.close();
})();
"
pkill -f "vite.*5199"
```

Review each screenshot (Read the PNGs) against the checklist: no clipped text, felt card inlay visible, persona cards legible at 375px (single column), tabs and history rows aligned, focus/contrast sane. Fix any visual defects found, re-screenshot, then:

- [ ] **Step 4: Final commit**

```bash
git add e2e/coach-flow.spec.ts
git commit -m "test(e2e): splash gate, persona card selection, match history drill-down"
```

---

## Self-Review Notes

- **Spec coverage:** derived sessions (Task 1), splash (Tasks 3–4), persona cards with specced copy/crests/traits (Tasks 2, 5), Report Card tabs + history + trend restyle (Task 6), empty states (Tasks 5–6 tests), e2e + visual QA (Task 7). Splash "click anywhere" behavior tested in Task 3.
- **Type consistency:** `SessionSummary`/`groupSessions`/`SESSION_GAP_MS` names match between Tasks 1 and 6; `personaMeta`/`PERSONA_KEYS`/`SuitPip` match between Tasks 2, 5, 6; `records` prop name matches Tasks 6 and App wiring.
- **Known judgment calls:** ReportCard.test.tsx exists with 4 tests not shown here — Task 6 Step 1 instructs the implementer to read it and adapt render calls rather than blindly overwrite. MatchHistory keys use `${s.start}-${i}` since sessions have no ids.
