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
