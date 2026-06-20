import { openDB, type IDBPDatabase } from 'idb';

// IndexedDB persistence. This is a personal, single-device, closed virtual-
// currency simulation: there is NO backend, NO auth, and NO real-money path.
// Everything below stores virtual chips and local stats only.

const DB_NAME = 'gilded-aces';
const STORE = 'state';
const VERSION = 1;

let dbp: Promise<IDBPDatabase> | null = null;

function db() {
  if (!dbp) {
    dbp = openDB(DB_NAME, VERSION, {
      upgrade(d) {
        if (!d.objectStoreNames.contains(STORE)) d.createObjectStore(STORE);
      },
    });
  }
  return dbp;
}

export async function loadKey<T>(key: string): Promise<T | undefined> {
  try {
    return (await (await db()).get(STORE, key)) as T | undefined;
  } catch {
    return undefined;
  }
}

export async function saveKey<T>(key: string, value: T): Promise<void> {
  try {
    await (await db()).put(STORE, value, key);
  } catch {
    /* storage may be unavailable in private mode — fail soft */
  }
}
