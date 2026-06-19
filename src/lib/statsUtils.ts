/**
 * statsUtils.ts
 *
 * Single-document counter pattern for AdminDashboard.
 *
 * Firestore path: _meta/stats
 * {
 *   totalStudents : number   — all users where role === "student"
 *   pendingCount  : number   — users pending approval + enroll-requests pending
 *   totalCourses  : number
 *   totalVideos   : number
 *   totalExams    : number
 *   updatedAt     : Timestamp
 * }
 *
 * Usage
 * ─────
 * Dashboard reads  → getStats()          → 1 Firestore read
 * Admin writes     → incrementStats({})  → 1 Firestore write (atomic increment)
 * First-ever run   → initStats({})       → seeded from full-collection counts
 */

import {
  doc, getDoc, setDoc, updateDoc,
  increment, serverTimestamp, Firestore,
} from "firebase/firestore";

// ── Types ────────────────────────────────────────────────────────────────────

export interface StatsDoc {
  totalStudents : number;
  pendingCount  : number;
  totalCourses  : number;
  totalVideos   : number;
  totalExams    : number;
  updatedAt?    : any;
}

export type StatsDelta = Partial<Omit<StatsDoc, "updatedAt">>;

// ── Internal cache (5 min) ───────────────────────────────────────────────────

const STATS_TTL = 5 * 60 * 1000;
let _cache: { data: StatsDoc; ts: number } | null = null;

function fresh(): StatsDoc | null {
  return _cache && Date.now() - _cache.ts < STATS_TTL ? _cache.data : null;
}

function bust(): void { _cache = null; }

// ── Public API ───────────────────────────────────────────────────────────────

const REF = (db: Firestore) => doc(db, "_meta", "stats");

/**
 * Read the stats doc. Returns null if the doc doesn't exist yet
 * (AdminDashboard will fall back to full-collection counts and call initStats).
 */
export async function getStats(db: Firestore): Promise<StatsDoc | null> {
  const cached = fresh();
  if (cached) return cached;

  try {
    const snap = await getDoc(REF(db));
    if (!snap.exists()) return null;
    const data = snap.data() as StatsDoc;
    _cache = { data, ts: Date.now() };
    return data;
  } catch (err) {
    console.warn("[statsUtils] getStats failed:", err);
    return null;
  }
}

/**
 * Atomically increment / decrement counters.
 * Pass positive numbers for +1, negative for -1.
 *
 * Example (approve enrollment):
 *   await incrementStats(db, { pendingCount: -1 });
 */
export async function incrementStats(db: Firestore, delta: StatsDelta): Promise<void> {
  bust();
  try {
    const updates: Record<string, any> = { updatedAt: serverTimestamp() };
    for (const [k, v] of Object.entries(delta)) {
      if (typeof v === "number") updates[k] = increment(v);
    }
    await updateDoc(REF(db), updates);
  } catch (err) {
    // Non-critical — dashboard will fall back on next read
    console.warn("[statsUtils] incrementStats failed:", err);
  }
}

/**
 * Seed (or overwrite) the stats doc.
 * Call once from AdminDashboard when the doc is missing.
 */
export async function initStats(db: Firestore, data: Omit<StatsDoc, "updatedAt">): Promise<void> {
  bust();
  try {
    await setDoc(REF(db), { ...data, updatedAt: serverTimestamp() });
    _cache = { data: data as StatsDoc, ts: Date.now() };
  } catch (err) {
    console.warn("[statsUtils] initStats failed:", err);
  }
}

/** Force next getStats() to hit Firestore (useful after admin writes). */
export function invalidateStats(): void { bust(); }
