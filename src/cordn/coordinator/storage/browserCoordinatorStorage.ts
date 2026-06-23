import {
  type CoordinatorStorageSnapshot,
  DEFAULT_MEMORY_MESSAGE_BUFFER_LIMIT,
  InMemoryCoordinatorStorage,
} from "./inMemoryStorage";

export type BrowserCoordinatorStorageBackend = "memory" | "indexeddb";

export interface BrowserCoordinatorStorageOptions {
  backend: BrowserCoordinatorStorageBackend;
  messageBufferLimit: number;
  indexedDbMaxBytes?: number;
}

interface SnapshotPersistence {
  load(): Promise<CoordinatorStorageSnapshot | null>;
  save(snapshot: CoordinatorStorageSnapshot): Promise<void>;
  clear(): Promise<void>;
  close(): void;
}

interface SnapshotByteLimitResult {
  snapshot: CoordinatorStorageSnapshot;
  evictedMessages: number;
  evictedRecords: number;
  byteLength: number;
}

const INDEXEDDB_DB_NAME = "cordn-coordinator";
const INDEXEDDB_STORE_NAME = "snapshots";
const SNAPSHOT_KEY = "cordn:v1:coordinator-snapshot";
const FALLBACK_STORAGE_KEY = "cordn:v1:coordinator-snapshot:fallback";
const LEGACY_KVVFS_LOCAL_PREFIX = "kvvfs-local-";
export const DEFAULT_INDEXEDDB_SNAPSHOT_MAX_BYTES = 4 * 1_024 * 1_024;
const INDEXEDDB_EVICTION_TARGET_RATIO = 0.8;

class LocalStorageSnapshotPersistence implements SnapshotPersistence {
  async load(): Promise<CoordinatorStorageSnapshot | null> {
    const raw = localStorage.getItem(FALLBACK_STORAGE_KEY);
    return raw ? (JSON.parse(raw) as CoordinatorStorageSnapshot) : null;
  }

  async save(snapshot: CoordinatorStorageSnapshot): Promise<void> {
    localStorage.setItem(FALLBACK_STORAGE_KEY, JSON.stringify(snapshot));
  }

  async clear(): Promise<void> {
    localStorage.removeItem(FALLBACK_STORAGE_KEY);
  }

  close(): void {}
}

class VolatileSnapshotPersistence implements SnapshotPersistence {
  async load(): Promise<CoordinatorStorageSnapshot | null> {
    return null;
  }

  async save(): Promise<void> {}

  async clear(): Promise<void> {}

  close(): void {}
}

class IndexedDbSnapshotPersistence implements SnapshotPersistence {
  private writeQueue = Promise.resolve();

  constructor(
    private readonly db: IDBDatabase,
    private readonly maxBytes: number,
  ) {}

  async load(): Promise<CoordinatorStorageSnapshot | null> {
    const raw = await readIndexedDbValue<string>(this.db, SNAPSHOT_KEY);
    return raw ? (JSON.parse(raw) as CoordinatorStorageSnapshot) : null;
  }

  async save(snapshot: CoordinatorStorageSnapshot): Promise<void> {
    const { snapshot: boundedSnapshot } = applySnapshotByteLimit(
      snapshot,
      this.maxBytes,
    );
    const serialized = JSON.stringify(boundedSnapshot);
    this.writeQueue = this.writeQueue.then(() =>
      writeIndexedDbValue(this.db, SNAPSHOT_KEY, serialized),
    );
    await this.writeQueue;
  }

  async clear(): Promise<void> {
    this.writeQueue = this.writeQueue.then(() =>
      deleteIndexedDbValue(this.db, SNAPSHOT_KEY),
    );
    await this.writeQueue;
  }

  close(): void {
    this.db.close();
  }
}

export async function createBrowserCoordinatorStorage(
  options: BrowserCoordinatorStorageOptions,
): Promise<InMemoryCoordinatorStorage> {
  const persistence = await createSnapshotPersistence(options);
  const storage = new InMemoryCoordinatorStorage(
    await persistence.load(),
    (snapshot) => {
      void persistence.save(snapshot);
    },
    { messageBufferLimit: options.messageBufferLimit },
  );
  const closeStorage = storage.close.bind(storage);
  storage.close = () => {
    closeStorage();
    persistence.close();
  };

  return storage;
}

export async function clearPersistedCoordinatorState(): Promise<void> {
  if ("localStorage" in globalThis) {
    localStorage.removeItem(FALLBACK_STORAGE_KEY);
    clearLegacySqliteKvvfsState();
  }

  await clearIndexedDbDatabase();
}

export function applySnapshotByteLimit(
  snapshot: CoordinatorStorageSnapshot,
  maxBytes = DEFAULT_INDEXEDDB_SNAPSHOT_MAX_BYTES,
): SnapshotByteLimitResult {
  const bounded = cloneSnapshot(snapshot);
  const targetBytes = Math.floor(maxBytes * INDEXEDDB_EVICTION_TARGET_RATIO);
  let evictedMessages = 0;
  let evictedRecords = 0;
  let byteLength = measureSnapshotBytes(bounded);

  while (byteLength > targetBytes && removeOldestGroupMessage(bounded)) {
    evictedMessages += 1;
    byteLength = measureSnapshotBytes(bounded);
  }

  const recordEvictionPasses = [
    () => removeOldestRecord(bounded.welcomes, (record) => record.readAt !== null),
    () => removeOldestRecord(bounded.joinRequests, (record) => record.readAt !== null),
    () => removeOldestRecord(bounded.welcomes),
    () => removeOldestRecord(bounded.joinRequests),
  ];

  for (const evictRecord of recordEvictionPasses) {
    while (byteLength > targetBytes && evictRecord()) {
      evictedRecords += 1;
      byteLength = measureSnapshotBytes(bounded);
    }
  }

  return {
    snapshot: bounded,
    evictedMessages,
    evictedRecords,
    byteLength,
  };
}

async function createSnapshotPersistence(
  options: BrowserCoordinatorStorageOptions,
): Promise<SnapshotPersistence> {
  if (options.backend === "memory") {
    return new VolatileSnapshotPersistence();
  }

  if (!("indexedDB" in globalThis) || !indexedDB) {
    return "localStorage" in globalThis
      ? new LocalStorageSnapshotPersistence()
      : new VolatileSnapshotPersistence();
  }

  try {
    return new IndexedDbSnapshotPersistence(
      await openIndexedDb(),
      options.indexedDbMaxBytes ?? DEFAULT_INDEXEDDB_SNAPSHOT_MAX_BYTES,
    );
  } catch {
    return "localStorage" in globalThis
      ? new LocalStorageSnapshotPersistence()
      : new VolatileSnapshotPersistence();
  }
}

function cloneSnapshot(snapshot: CoordinatorStorageSnapshot): CoordinatorStorageSnapshot {
  return JSON.parse(JSON.stringify(snapshot)) as CoordinatorStorageSnapshot;
}

function measureSnapshotBytes(snapshot: CoordinatorStorageSnapshot): number {
  return new TextEncoder().encode(JSON.stringify(snapshot)).byteLength;
}

function removeOldestGroupMessage(snapshot: CoordinatorStorageSnapshot): boolean {
  let oldestGroupIndex = -1;
  let oldestMessageIndex = -1;
  let oldestCreatedAt = Number.POSITIVE_INFINITY;
  let oldestCursor = Number.POSITIVE_INFINITY;

  snapshot.groups.forEach((group, groupIndex) => {
    group.messages.forEach((message, messageIndex) => {
      if (
        message.createdAt < oldestCreatedAt ||
        (message.createdAt === oldestCreatedAt && message.cursor < oldestCursor)
      ) {
        oldestGroupIndex = groupIndex;
        oldestMessageIndex = messageIndex;
        oldestCreatedAt = message.createdAt;
        oldestCursor = message.cursor;
      }
    });
  });

  if (oldestGroupIndex === -1 || oldestMessageIndex === -1) {
    return false;
  }

  snapshot.groups[oldestGroupIndex]?.messages.splice(oldestMessageIndex, 1);
  return true;
}

function removeOldestRecord<T extends { createdAt: number }>(
  records: T[],
  filter: (record: T) => boolean = () => true,
): boolean {
  let oldestIndex = -1;

  records.forEach((record, index) => {
    if (!filter(record)) {
      return;
    }

    if (oldestIndex === -1 || record.createdAt < records[oldestIndex]!.createdAt) {
      oldestIndex = index;
    }
  });

  if (oldestIndex === -1) {
    return false;
  }

  records.splice(oldestIndex, 1);
  return true;
}

function openIndexedDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(INDEXEDDB_DB_NAME, 1);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(INDEXEDDB_STORE_NAME)) {
        db.createObjectStore(INDEXEDDB_STORE_NAME);
      }
    };
    request.onerror = () => reject(request.error ?? new Error("IndexedDB open failed"));
    request.onsuccess = () => resolve(request.result);
  });
}

function readIndexedDbValue<T>(
  db: IDBDatabase,
  key: string,
): Promise<T | undefined> {
  return withIndexedDbStore(db, "readonly", (store) =>
    requestToPromise<T | undefined>(store.get(key) as IDBRequest<T | undefined>),
  );
}

function writeIndexedDbValue(
  db: IDBDatabase,
  key: string,
  value: string,
): Promise<void> {
  return withIndexedDbStore(db, "readwrite", async (store) => {
    await requestToPromise(store.put(value, key));
  });
}

function deleteIndexedDbValue(db: IDBDatabase, key: string): Promise<void> {
  return withIndexedDbStore(db, "readwrite", async (store) => {
    await requestToPromise(store.delete(key));
  });
}

async function withIndexedDbStore<T>(
  db: IDBDatabase,
  mode: IDBTransactionMode,
  run: (store: IDBObjectStore) => Promise<T>,
): Promise<T> {
  const transaction = db.transaction(INDEXEDDB_STORE_NAME, mode);
  const done = transactionDone(transaction);
  const result = await run(transaction.objectStore(INDEXEDDB_STORE_NAME));
  await done;
  return result;
}

function requestToPromise<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onerror = () => reject(request.error ?? new Error("IndexedDB request failed"));
    request.onsuccess = () => resolve(request.result);
  });
}

function transactionDone(transaction: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    transaction.onabort = () => reject(transaction.error ?? new Error("IndexedDB transaction aborted"));
    transaction.onerror = () => reject(transaction.error ?? new Error("IndexedDB transaction failed"));
    transaction.oncomplete = () => resolve();
  });
}

async function clearIndexedDbDatabase(): Promise<void> {
  if (!("indexedDB" in globalThis) || !indexedDB) {
    return;
  }

  await new Promise<void>((resolve) => {
    const request = indexedDB.deleteDatabase(INDEXEDDB_DB_NAME);
    request.onerror = () => resolve();
    request.onsuccess = () => resolve();
    request.onblocked = () => resolve();
  });
}

function clearLegacySqliteKvvfsState(): void {
  for (let index = localStorage.length - 1; index >= 0; index -= 1) {
    const key = localStorage.key(index);
    if (key?.startsWith(LEGACY_KVVFS_LOCAL_PREFIX)) {
      localStorage.removeItem(key);
    }
  }
}

export const DEFAULT_BROWSER_COORDINATOR_STORAGE_OPTIONS: BrowserCoordinatorStorageOptions = {
  backend: "memory",
  messageBufferLimit: DEFAULT_MEMORY_MESSAGE_BUFFER_LIMIT,
};
