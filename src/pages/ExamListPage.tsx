import { useState, useEffect } from "react";
import { collection, getDocs, query, where } from "firebase/firestore";
import { examDb } from "@/lib/examFirebase";
import { useAuth } from "@/contexts/AuthContext";
import { Exam, ExamSubmission } from "@/types/exam";
import { getCachedCollection } from "@/lib/firestoreCache";
import { Link, useNavigate } from "react-router-dom";
import {
  Clock, CheckCircle, Timer, Zap, Send, Trophy, BookOpen,
} from "lucide-react";
import { FloatingButtons } from "@/components/FloatingButtons";

// ─── Status type ──────────────────────────────────────────────────────────────
type ExamStatus =
  | "upcoming"         // পরীক্ষা এখনো শুরু হয়নি
  | "live"             // চলছে, student এখনো দেয়নি
  | "submitted"        // student দিয়েছে, result এখনো প্রকাশ পায়নি
  | "result_published" // result প্রকাশ পেয়েছে
  | "ended";           // শেষ হয়েছে, student দেয়নি

// ─── Per-status UI config ─────────────────────────────────────────────────────
const STATUS_CONFIG: Record<
  ExamStatus,
  {
    label: string;
    icon: React.ReactNode;
    badgeCls: string;
    stripCls: string | null;
  }
> = {
  upcoming: {
    label: "Upcoming",
    icon: <Clock className="h-3 w-3" />,
    badgeCls:
      "bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20",
    stripCls: null,
  },
  live: {
    label: "Live",
    icon: <Zap className="h-3 w-3" />,
    badgeCls:
      "bg-green-500/15 text-green-600 dark:text-green-400 border border-green-500/30",
    stripCls: "bg-gradient-to-r from-green-400 to-emerald-500",
  },
  submitted: {
    label: "Submitted",
    icon: <Send className="h-3 w-3" />,
    badgeCls:
      "bg-violet-500/10 text-violet-600 dark:text-violet-400 border border-violet-500/20",
    stripCls: "bg-gradient-to-r from-violet-400 to-purple-500",
  },
  result_published: {
    label: "Result Published",
    icon: <Trophy className="h-3 w-3" />,
    badgeCls:
      "bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/30",
    stripCls: "bg-gradient-to-r from-amber-400 to-yellow-500",
  },
  ended: {
    label: "Ended",
    icon: <CheckCircle className="h-3 w-3" />,
    badgeCls: "bg-accent text-muted-foreground border border-border",
    stripCls: null,
  },
};

export default function ExamListPage() {
  const { user, userDoc, loading } = useAuth();
  const navigate = useNavigate();
  const [exams, setExams] = useState<Exam[]>([]);
  const [examsLoading, setExamsLoading] = useState(true);
  // Map of examId → whether this user has submitted
  const [submittedIds, setSubmittedIds] = useState<Set<string>>(new Set());

  // Wait until Firebase auth resolves, then redirect if not logged in.
  useEffect(() => {
    if (!loading && !user) navigate("/auth?mode=login");
  }, [loading, user]);

  useEffect(() => {
    if (!userDoc?.activeCourseId || !user) return;

    const fetchExams = async () => {
      setExamsLoading(true);

      const list = await getCachedCollection<Exam>(
        examDb,
        "exams",
        [where("courseId", "==", userDoc.activeCourseId)],
        `course_${userDoc.activeCourseId}`
      );
      list.sort(
        (a, b) =>
          (b.startTime?.toMillis?.() || 0) - (a.startTime?.toMillis?.() || 0)
      );
      setExams(list);
      setExamsLoading(false);

      // ── Pre-warm localStorage question cache for live/upcoming exams ──────
      const TWO_HOURS = 2 * 60 * 60 * 1000;
      const nowMs = Date.now();
      list.forEach(exam => {
        const end = exam.endTime?.toMillis?.() || 0;
        const start = exam.startTime?.toMillis?.() || 0;
        if (end < nowMs) return;
        if (start - nowMs > 24 * 60 * 60 * 1000) return;
        try {
          const cacheKey = `exam_questions_${exam.id}`;
          const raw = localStorage.getItem(cacheKey);
          if (raw) {
            const parsed = JSON.parse(raw);
            if (parsed?.cachedAt && nowMs - parsed.cachedAt < TWO_HOURS) return;
          }
          localStorage.setItem(
            cacheKey,
            JSON.stringify({ data: exam, cachedAt: nowMs })
          );
        } catch { /* localStorage full */ }
      });

      // ── Check which ended/live exams this user has submitted ─────────────
      // 1) Fast path: check localStorage backup first (zero Firestore reads)
      const endedOrLive = list.filter(e => {
        const end = e.endTime?.toMillis?.() || 0;
        const start = e.startTime?.toMillis?.() || 0;
        return end >= nowMs || start <= nowMs; // live or already started
      });

      const locallySubmitted = new Set<string>();
      endedOrLive.forEach(exam => {
        const backupKey = `submission_backup_${exam.id}_${user.uid}`;
        try {
          const raw = localStorage.getItem(backupKey);
          if (raw) {
            const parsed = JSON.parse(raw);
            if (parsed?.data) locallySubmitted.add(exam.id);
          }
        } catch { /* ignore */ }
      });
      if (locallySubmitted.size > 0) {
        setSubmittedIds(prev => new Set([...prev, ...locallySubmitted]));
      }

      // 2) Slow path: verify against Firestore for all ended exams
      // (only ended exams matter — live ones we already have backup for)
      const endedExams = list.filter(e => (e.endTime?.toMillis?.() || 0) < nowMs);
      if (endedExams.length === 0) return;

      const checks = endedExams.map(async exam => {
        const submissionId = `${exam.id}_${user.uid}`;
        try {
          const snap = await getDoc(doc(examDb, "submissions", submissionId));
          if (snap.exists()) return exam.id;
        } catch { /* ignore */ }
        return null;
      });

      const results = await Promise.all(checks);
      const firestoreSubmitted = new Set(
        results.filter((id): id is string => id !== null)
      );
      if (firestoreSubmitted.size > 0) {
        setSubmittedIds(prev => new Set([...prev, ...firestoreSubmitted]));
      }
    };

    fetchExams();
  }, [userDoc?.activeCourseId, user]);

  // Show nothing while auth is still initializing or redirecting
  if (loading || !user || !userDoc) return null;

  if (!userDoc?.activeCourseId) {
    return (
      <div className="p-4 text-center">
        <p className="text-muted-foreground text-sm py-8">
          Please select an active course from your profile to view exams.
        </p>
      </div>
    );
  }

  const now = Date.now();

  const getStatus = (exam: Exam): ExamStatus => {
    const start = exam.startTime?.toMillis?.() || 0;
    const end = exam.endTime?.toMillis?.() || 0;
    const hasSubmitted = submittedIds.has(exam.id);

    if (now < start) return "upcoming";
    if (now >= start && now <= end) {
      // চলছে — student দিয়েছে কিনা?
      return hasSubmitted ? "submitted" : "live";
    }
    // শেষ হয়েছে
    if (hasSubmitted) {
      return exam.resultPublished ? "result_published" : "submitted";
    }
    return "ended";
  };

  return (
    <div className="p-4 max-w-2xl mx-auto animate-fade-in">
      <h1 className="text-xl font-semibold text-foreground mb-4 flex items-center gap-2">
        <BookOpen className="h-5 w-5" /> Exams
      </h1>

      {examsLoading ? (
        <p className="text-muted-foreground text-sm text-center py-8">Loading...</p>
      ) : exams.length === 0 ? (
        <p className="text-muted-foreground text-sm text-center py-8">
          No exams available for this course.
        </p>
      ) : (
        <div className="space-y-3">
          {exams.map(exam => {
            const status = getStatus(exam);
            const cfg = STATUS_CONFIG[status];
            const startDateStr = exam.startTime
              ?.toDate?.()
              ?.toLocaleString("en-US", {
                hour: "numeric",
                minute: "2-digit",
                hour12: true,
                month: "short",
                day: "numeric",
              });

            return (
              <Link
                key={exam.id}
                to={`/exams/${exam.id}`}
                className="block bg-card border border-border rounded-2xl overflow-hidden hover:border-primary/30 hover:shadow-md transition-all duration-200 group"
              >
                {/* Colored top strip for notable statuses */}
                {cfg.stripCls && <div className={`h-1 w-full ${cfg.stripCls}`} />}

                <div className="p-4">
                  {/* Title + badge */}
                  <div className="flex items-start justify-between gap-2 mb-2.5">
                    <h3 className="font-semibold text-foreground text-sm leading-snug flex-1 min-w-0 group-hover:text-primary transition-colors">
                      {exam.title}
                    </h3>
                    <span
                      className={`shrink-0 inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full ${cfg.badgeCls}`}
                    >
                      {/* Pulsing dot for live */}
                      {status === "live" && (
                        <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
                      )}
                      {cfg.icon}
                      {cfg.label}
                    </span>
                  </div>

                  {/* Info chips */}
                  <div className="flex flex-wrap gap-1.5 mb-3">
                    <span className="inline-flex items-center text-[11px] font-medium px-2 py-0.5 rounded-full bg-primary/10 text-primary">
                      MCQ
                    </span>
                    <span className="inline-flex items-center text-[11px] font-medium px-2 py-0.5 rounded-full bg-accent text-foreground">
                      {exam.questions.length} প্রশ্ন
                    </span>
                    <span className="inline-flex items-center text-[11px] font-medium px-2 py-0.5 rounded-full bg-accent text-foreground">
                      {exam.totalMarks} নম্বর
                    </span>
                    <span className="inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-full bg-accent text-foreground">
                      <Clock className="h-3 w-3" /> {exam.duration} মিনিট
                    </span>
                  </div>

                  {/* Date + contextual hint */}
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    {startDateStr && (
                      <p className="text-[11px] text-muted-foreground flex items-center gap-1">
                        🗓 {startDateStr}
                      </p>
                    )}
                    {status === "result_published" && (
                      <p className="text-[11px] text-amber-600 dark:text-amber-400 font-medium flex items-center gap-1">
                        <Trophy className="h-3 w-3" /> ফলাফল দেখুন
                      </p>
                    )}
                    {status === "submitted" && (
                      <p className="text-[11px] text-violet-600 dark:text-violet-400 font-medium">
                        ✓ জমা দেওয়া হয়েছে
                      </p>
                    )}
                    {status === "live" && (
                      <p className="text-[11px] text-green-600 dark:text-green-400 font-medium">
                        এখনই পরীক্ষা দিন →
                      </p>
                    )}
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      )}
      <FloatingButtons />
    </div>
  );
}
