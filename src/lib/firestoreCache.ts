import {
  collection, getDocs, getDoc, doc, setDoc, query, where,
  QueryConstraint, Firestore, serverTimestamp, Timestamp,
} from "firebase/firestore";

interface CacheEntry<T = any> {
  data: T;
  timestamp: number;
}

// ─── TTLs ─────────────────────────────────────────────────────────────────────
// Note: with version-based invalidation, TTLs are only the *upper-bound* —
// admin changes propagate immediately via the _meta/versions doc, so we can
// keep TTLs long without worrying about staleness.
const TTL = {
  courses: 6 * 60 * 60 * 1000,
  videos: 6 * 60 * 60 * 1000,
  settings: 2 * 60 * 60 * 1000,           // ⬇ 12h → 2h
  users: 30 * 60 * 1000,
  exams: 6 * 60 * 60 * 1000,
  examQuestions: 12 * 60 * 60 * 1000,
  submissions: 5 * 60 * 1000,             // ⬇ short — admin needs fresh result data
  enrollRequests: 5 * 60 * 1000,          // ⬇ short — admin approval flow
  examCounters: 10 * 60 * 1000,
  default: 30 * 60 * 1000,
};

// Per-collection version-check freshness. Hot collections where admin updates
// must propagate quickly use a shorter window; everything else uses the default.
const VERSION_TTL_FAST = 60 * 1000;       // 1 min
const VERSION_TTL_DEFAULT = 5 * 60 * 1000;
const FAST_COLLECTIONS = new Set([
  "exams", "settings", "enrollRequests", "users", "submissions",
]);
function versionTtlFor(c?: string): number {
  return c && FAST_COLLECTIONS.has(c) ? VERSION_TTL_FAST : VERSION_TTL_DEFAULT;
}


const memoryCache = new Map<string, CacheEntry>();
const pendingRequests = new Map<string, Promise<any>>();

function getCacheTTL(c: string): number {
  return TTL[c as keyof typeof TTL] || TTL.default;
}

const lsKey = (k: string) => `fsc_${k}`;

function getLS<T>(k: string): CacheEntry<T> | null {
  try { const r = localStorage.getItem(lsKey(k)); return r ? JSON.parse(r) : null; }
  catch { return null; }
}

function setLS<T>(k: string, data: T): void {
  try { localStorage.setItem(lsKey(k), JSON.stringify({ data, timestamp: Date.now() })); }
  catch { clearOldCache(); }
}

function clearOldCache(): void {
  Object.keys(localStorage).filter(k => k.startsWith("fsc_")).forEach(k => localStorage.removeItem(k));
}

// ─── Cross-user version sync ──────────────────────────────────────────────────
// Single doc `_meta/versions` per Firestore stores {[collection]: Timestamp}.
// Admin writes call `bumpVersion`, students read the doc cheaply once per
// session (5-min mem cache) to know whether their local cache is stale.
const VERSIONS_DOC_PATH: { col: string; id: string } = { col: "_meta", id: "versions" };

const versionCache = new Map<string, { data: Record<string, number>; timestamp: number }>();
const versionPending = new Map<string, Promise<Record<string, number>>>();

function dbKey(dbInstance: Firestore): string {
  // Each Firestore (main / exam) gets its own version cache.
  return (dbInstance as any)?._databaseId?.projectId || "default";
}

async function getVersions(dbInstance: Firestore, collectionName?: string): Promise<Record<string, number>> {
  const key = dbKey(dbInstance);
  const cached = versionCache.get(key);
  const ttl = versionTtlFor(collectionName);
  if (cached && Date.now() - cached.timestamp < ttl) return cached.data;
  if (versionPending.has(key)) return versionPending.get(key)!;

  const p = (async () => {
    try {
      const snap = await getDoc(doc(dbInstance, VERSIONS_DOC_PATH.col, VERSIONS_DOC_PATH.id));
      const raw = snap.exists() ? (snap.data() as Record<string, any>) : {};
      const data: Record<string, number> = {};
      for (const [k, v] of Object.entries(raw)) {
        if (v && typeof (v as any).toMillis === "function") data[k] = (v as Timestamp).toMillis();
        else if (typeof v === "number") data[k] = v;
      }
      versionCache.set(key, { data, timestamp: Date.now() });
      return data;
    } catch {
      const data = {};
      versionCache.set(key, { data, timestamp: Date.now() });
      return data;
    } finally {
      versionPending.delete(key);
    }
  })();
  versionPending.set(key, p);
  return p;
}


/**
 * Call after any admin write to a collection.
 * All other clients (within 5 min) will see the new version and refetch.
 */
export async function bumpVersion(dbInstance: Firestore, collectionName: string): Promise<void> {
  try {
    await setDoc(
      doc(dbInstance, VERSIONS_DOC_PATH.col, VERSIONS_DOC_PATH.id),
      { [collectionName]: serverTimestamp() },
      { merge: true }
    );
    // Refresh local copy so the writer themselves sees the bump.
    const key = dbKey(dbInstance);
    const existing = versionCache.get(key)?.data || {};
    versionCache.set(key, { data: { ...existing, [collectionName]: Date.now() }, timestamp: Date.now() });
  } catch (err) {
    console.warn("[bumpVersion] failed:", err);
  }
}

async function isStaleVsServer(
  dbInstance: Firestore,
  collectionName: string,
  entryTimestamp: number,
): Promise<boolean> {
  const versions = await getVersions(dbInstance, collectionName);
  const v = versions[collectionName];
  if (!v) return false;
  return v > entryTimestamp;
}


function freshLocally(entry: CacheEntry | null, c: string): boolean {
  return !!entry && Date.now() - entry.timestamp < getCacheTTL(c);
}

// ─── Public API ───────────────────────────────────────────────────────────────
export async function getCachedCollection<T extends { id: string }>(
  dbInstance: Firestore,
  collectionName: string,
  constraints?: QueryConstraint[],
  cacheKeySuffix?: string,
): Promise<T[]> {
  const cacheKey = `col_${collectionName}${cacheKeySuffix ? `_${cacheKeySuffix}` : ""}`;

  const mem = memoryCache.get(cacheKey);
  if (freshLocally(mem, collectionName) && !(await isStaleVsServer(dbInstance, collectionName, mem!.timestamp))) {
    return mem!.data as T[];
  }

  const ls = getLS<T[]>(cacheKey);
  if (freshLocally(ls, collectionName) && !(await isStaleVsServer(dbInstance, collectionName, ls!.timestamp))) {
    memoryCache.set(cacheKey, ls!);
    return ls!.data;
  }

  if (pendingRequests.has(cacheKey)) return pendingRequests.get(cacheKey)!;

  const p = (async () => {
    try {
      const ref = collection(dbInstance, collectionName);
      const q = constraints?.length ? query(ref, ...constraints) : ref;
      const snap = await getDocs(q);
      const data = snap.docs.map(d => ({ id: d.id, ...d.data() } as T));
      const entry: CacheEntry<T[]> = { data, timestamp: Date.now() };
      memoryCache.set(cacheKey, entry);
      setLS(cacheKey, data);
      return data;
    } finally {
      pendingRequests.delete(cacheKey);
    }
  })();
  pendingRequests.set(cacheKey, p);
  return p;
}

export async function getCachedDoc<T>(
  dbInstance: Firestore,
  collectionName: string,
  docId: string,
  options?: { forceRefresh?: boolean },
): Promise<T | null> {
  const cacheKey = `doc_${collectionName}_${docId}`;

  if (!options?.forceRefresh) {
    const mem = memoryCache.get(cacheKey);
    if (freshLocally(mem, collectionName) && !(await isStaleVsServer(dbInstance, collectionName, mem!.timestamp))) {
      return mem!.data as T;
    }
    const ls = getLS<T>(cacheKey);
    if (freshLocally(ls, collectionName) && !(await isStaleVsServer(dbInstance, collectionName, ls!.timestamp))) {
      memoryCache.set(cacheKey, ls!);
      return ls!.data;
    }
  }
  if (pendingRequests.has(cacheKey)) return pendingRequests.get(cacheKey)!;

  const p = (async () => {
    try {
      const snap = await getDoc(doc(dbInstance, collectionName, docId));
      if (!snap.exists()) return null;
      const data = { id: snap.id, ...snap.data() } as T;
      const entry: CacheEntry<T> = { data, timestamp: Date.now() };
      memoryCache.set(cacheKey, entry);
      setLS(cacheKey, data);
      return data;
    } finally {
      pendingRequests.delete(cacheKey);
    }
  })();
  pendingRequests.set(cacheKey, p);
  return p;
}

/** Force the next version check to hit Firestore (drops the in-memory versions cache). */
export function forceRefreshVersions(dbInstance: Firestore): void {
  versionCache.delete(dbKey(dbInstance));
}


/** Local-only invalidation — kept for compatibility, but `bumpVersion` is preferred. */
export function invalidateCache(collectionName?: string): void {
  if (collectionName) {
    const prefixes = [`col_${collectionName}`, `doc_${collectionName}`];
    for (const k of memoryCache.keys()) if (prefixes.some(p => k.startsWith(p))) memoryCache.delete(k);
    Object.keys(localStorage)
      .filter(k => prefixes.some(p => k.startsWith(`fsc_${p}`)))
      .forEach(k => localStorage.removeItem(k));
  } else {
    memoryCache.clear();
    clearOldCache();
  }
}

export function prewarmCache(dbInstance: Firestore, collections: string[]): void {
  collections.forEach(c => { getCachedCollection(dbInstance, c).catch(() => {}); });
}
