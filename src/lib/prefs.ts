export type CompressLevelPref = 'light' | 'recommended' | 'strong';

export interface SavedWorkflow {
  name: string;
  steps: string[];
}

export interface Prefs {
  theme?: 'light' | 'dark';
  compressLevel?: CompressLevelPref;
  recent?: string[];
  workflows?: SavedWorkflow[];
  lite?: boolean;
  /** Opt-in saved signature image, only after the user asks to keep one. */
  signature?: string;
}

const DB_NAME = 'weesize-prefs';
const STORE = 'prefs';
const KEY = 'settings';

let memory: Prefs = {};

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE);
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('Preferences could not be opened.'));
  });
}

export async function loadPrefs(): Promise<Prefs> {
  try {
    const db = await openDb();
    const stored = await new Promise<Prefs>((resolve, reject) => {
      const tx = db.transaction(STORE, 'readonly');
      const request = tx.objectStore(STORE).get(KEY);
      request.onsuccess = () => {
        const value = request.result;
        resolve(value && typeof value === 'object' ? (value as Prefs) : {});
      };
      request.onerror = () => reject(request.error ?? new Error('Preferences could not be read.'));
    });
    db.close();
    memory = { ...stored };
    return { ...memory };
  } catch {
    return { ...memory };
  }
}

export async function savePrefs(partial: Prefs): Promise<void> {
  memory = { ...memory, ...partial };
  const next = { ...memory };
  try {
    const db = await openDb();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE, 'readwrite');
      tx.objectStore(STORE).put(next, KEY);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error ?? new Error('Preferences could not be saved.'));
    });
    db.close();
  } catch {
    /* Preferences are optional. File bytes are never stored. */
  }
}

export async function erasePrefs(): Promise<void> {
  memory = {};
  await new Promise<void>((resolve) => {
    const request = indexedDB.deleteDatabase(DB_NAME);
    request.onsuccess = () => resolve();
    request.onerror = () => resolve();
    request.onblocked = () => resolve();
  });
}
