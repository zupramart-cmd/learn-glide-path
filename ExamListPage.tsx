import { collection, getDocs, getDoc, doc, query, where, QueryConstraint, Firestore, DocumentData } from "firebase/firestore";

interface CacheEntry<T = any> {
  data: T;
  timestamp: number;
}

// Default TTLs in milliseconds
const TTL = {
  courses: 10 * 60 * 1000,      // 10 min
  videos: 5 * 60 * 1000,        // 5 min
  settings: 30 * 60 * 1000,     // 30 min
  users: 2 * 60 * 1000,         // 2 min
  exams: 5 * 60 * 1000,         // 5 min
  enrollRequests: 2 * 60 * 1000, // 2 min
  default: 5 * 60 * 1000,       // 5 min
};

// In-memory cache
const memoryCache = new Map<string, CacheEntry>();

// Pending requests deduplication
const pendingRequests = new Map<string, Promise<any>>();

function getCacheTTL(collectionName: string): number {
  return TTL[collectionName as keyof typeof TTL] || TTL.default;
}

function getLocalStorageKey(key: string): string {
  return `fsc_${key}`;
}

function getFromLocalStorage<T>(key: string): CacheEntry<T> | null {
  try {
    const raw = localStorage.getItem(getLocalStorageKey(key));
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function setToLocalStorage<T>(key: string, data: T): void {
  try {
    const entry: CacheEntry<T> = { data, timestamp: Date.now() };
    localStorage.setItem(getLocalStorageKey(key), JSON.stringify(entry));
  } catch {
    // Storage full - clear old cache entries
    clearOldCache();
  }
}

function clearOldCache(): void {
  const keys = Object.keys(localStorage).filter(k => k.startsWith("fsc_"));
  keys.forEach(k => localStorage.removeItem(k));
}

function isFresh(entry: CacheEntry | null, collectionName: string): boolean {
  if (!entry) return false;
  return Date.now() - entry.timestamp < getCacheTTL(collectionName);
}

/**
 * Get cached collection data. Returns from memory > localStorage > Firestore.
 * Deduplicates concurrent requests for the same key.
 */
export async function getCachedCollection<T extends { id: string }>(
  dbInstance: Firestore,
  collectionName: string,
  constraints?: QueryConstraint[],
  cacheKeySuffix?: string
): Promise<T[]> {
  const cacheKey = `col_${collectionName}${cacheKeySuffix ? `_${cacheKeySuffix}` : ""}`;

  // 1. Check memory cache
  const memEntry = memoryCache.get(cacheKey);
  if (isFresh(memEntry, collectionName)) {
    return memEntry!.data as T[];
  }

  // 2. Check localStorage
  const lsEntry = getFromLocalStorage<T[]>(cacheKey);
  if (isFresh(lsEntry, collectionName)) {
    memoryCache.set(cacheKey, lsEntry!);
    return lsEntry!.data;
  }

  // 3. Deduplicate concurrent requests
  if (pendingRequests.has(cacheKey)) {
    return pendingRequests.get(cacheKey)!;
  }

  const fetchPromise = (async () => {
    try {
      const ref = collection(dbInstance, collectionName);
      const q = constraints?.length ? query(ref, ...constraints) : ref;
      const snap = await getDocs(q);
      const data = snap.docs.map(d => ({ id: d.id, ...d.data() } as T));

      // Update caches
      const entry: CacheEntry<T[]> = { data, timestamp: Date.now() };
      memoryCache.set(cacheKey, entry);
      setToLocalStorage(cacheKey, data);

      return data;
    } finally {
      pendingRequests.delete(cacheKey);
    }
  })();

  pendingRequests.set(cacheKey, fetchPromise);
  return fetchPromise;
}

/**
 * Get a cached single document.
 */
export async function getCachedDoc<T>(
  dbInstance: Firestore,
  collectionName: string,
  docId: string
): Promise<T | null> {
  const cacheKey = `doc_${collectionName}_${docId}`;

  const memEntry = memoryCache.get(cacheKey);
  if (isFresh(memEntry, collectionName)) {
    return memEntry!.data as T;
  }

  const lsEntry = getFromLocalStorage<T>(cacheKey);
  if (isFresh(lsEntry, collectionName)) {
    memoryCache.set(cacheKey, lsEntry!);
    return lsEntry!.data;
  }

  if (pendingRequests.has(cacheKey)) {
    return pendingRequests.get(cacheKey)!;
  }

  const fetchPromise = (async () => {
    try {
      const snap = await getDoc(doc(dbInstance, collectionName, docId));
      if (!snap.exists()) return null;
      const data = { id: snap.id, ...snap.data() } as T;

      const entry: CacheEntry<T> = { data, timestamp: Date.now() };
      memoryCache.set(cacheKey, entry);
      setToLocalStorage(cacheKey, data);

      return data;
    } finally {
      pendingRequests.delete(cacheKey);
    }
  })();

  pendingRequests.set(cacheKey, fetchPromise);
  return fetchPromise;
}

/**
 * Invalidate cache for a collection (call after writes).
 */
export function invalidateCache(collectionName?: string): void {
  if (collectionName) {
    // Remove specific collection entries
    const prefixes = [`col_${collectionName}`, `doc_${collectionName}`];
    for (const key of memoryCache.keys()) {
      if (prefixes.some(p => key.startsWith(p))) {
        memoryCache.delete(key);
      }
    }
    // Also clear localStorage
    const lsKeys = Object.keys(localStorage).filter(k => 
      prefixes.some(p => k.startsWith(`fsc_${p}`))
    );
    lsKeys.forEach(k => localStorage.removeItem(k));
  } else {
    // Clear all
    memoryCache.clear();
    clearOldCache();
  }
}

/**
 * Pre-warm cache for commonly accessed collections.
 */
export function prewarmCache(dbInstance: Firestore, collections: string[]): void {
  collections.forEach(col => {
    getCachedCollection(dbInstance, col).catch(() => {});
  });
}
