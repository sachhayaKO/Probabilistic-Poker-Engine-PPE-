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
