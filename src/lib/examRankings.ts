import {
  collection, doc, getDoc, getDocs, query, where, updateDoc, serverTimestamp,
} from "firebase/firestore";
import { examDb } from "@/lib/examFirebase";
import { Exam, ExamRankingEntry, ExamSubmission } from "@/types/exam";

/**
 * Ranking pre-compute helper.
 *
 * Goal: avoid the "every student queries every submission" read explosion.
 * Free Firestore quota = 50K reads/day; 2500 students each doing a 2500-doc
 * scan would burn 6.25M reads. Instead we pre-compute the ranking list once
 * and store it on the exam doc, so each student only needs a single doc read.
 *
 * Flow:
 *  1. If the local exam already has `rankings`, return them (0 reads).
 *  2. Otherwise re-read the exam doc once. If rankings now present, use them.
 *  3. Otherwise compute: one filtered `where examId == X` query, sort by
 *     obtainedMarks desc, write back to the exam doc.
 *
 * Idempotent: concurrent students may all recompute on the same day, but the
 * result is deterministic, so the final stored value is consistent. The
 * `rankingsComputedAt` field lets future callers short-circuit immediately.
 */
export async function ensureExamRankings(
  exam: Exam
): Promise<{ rankings: ExamRankingEntry[]; total: number }> {
  // Fast path: already on the in-memory exam object.
  if (exam.rankings && exam.rankings.length >= 0 && exam.rankingsComputedAt) {
    return {
      rankings: exam.rankings,
      total: exam.totalParticipants ?? exam.rankings.length,
    };
  }

  // Re-fetch the exam doc (1 read) in case another client already computed.
  const examRef = doc(examDb, "exams", exam.id);
  const fresh = await getDoc(examRef);
  if (fresh.exists()) {
    const data = fresh.data() as Partial<Exam>;
    if (data.rankings && data.rankingsComputedAt) {
      return {
        rankings: data.rankings,
        total: data.totalParticipants ?? data.rankings.length,
      };
    }
  }

  // Compute: one query for this exam's submissions.
  const q = query(
    collection(examDb, "submissions"),
    where("examId", "==", exam.id)
  );
  const snap = await getDocs(q);
  const subs = snap.docs
    .map((d) => ({ id: d.id, ...d.data() } as ExamSubmission))
    .sort((a, b) => b.obtainedMarks - a.obtainedMarks);

  const rankings: ExamRankingEntry[] = subs.map((s, idx) => ({
    userId: s.userId,
    obtainedMarks: s.obtainedMarks,
    rank: idx + 1,
  }));

  // Persist back to exam doc — best-effort, ignore write errors so the user
  // still gets their rank even if the write is denied by rules.
  try {
    await updateDoc(examRef, {
      rankings,
      totalParticipants: rankings.length,
      rankingsComputedAt: serverTimestamp(),
    });
  } catch (err) {
    console.warn("[examRankings] failed to persist rankings:", err);
  }

  return { rankings, total: rankings.length };
}
