import { useState, useEffect } from "react";
import { where } from "firebase/firestore";
import { examDb } from "@/lib/examFirebase";
import { db } from "@/lib/firebase";
import { useAuth } from "@/contexts/AuthContext";
import { Exam } from "@/types/exam";
import { Course } from "@/types";
import { getCachedCollection } from "@/lib/firestoreCache";
import { Link, useNavigate } from "react-router-dom";
import {
  Clock, CheckCircle, Timer, Zap, Send, Trophy, BookOpen, Lock, XCircle,
} from "lucide-react";
import { FloatingButtons } from "@/components/FloatingButtons";
import { ExamListSkeleton } from "@/components/skeletons";

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
  const [activeCourseExpired, setActiveCourseExpired] = useState(false);
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

      // ── Check if active course is expired (isActive === false) ────────────
      const allCourses = await getCachedCollection<Course>(db, "courses");
      const activeCourse = allCourses.find(c => c.id === userDoc.activeCourseId);
      const isExpired = activeCourse && (activeCourse as any).isActive === false;
      setActiveCourseExpired(!!isExpired);
      if (isExpired) { setExamsLoading(false); return; }

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

      // ── Check which exams this user has submitted ────────────────────────
      // ✅ Zero Firestore reads — uses pre-stored `submittedExamIds` on userDoc
      //    plus the localStorage backup as a fallback. The user doc is loaded
      //    by AuthContext, so we incur no extra read here.
      const submittedFromUserDoc = new Set<string>(userDoc?.submittedExamIds || []);
      const locallySubmitted = new Set<string>();
      list.forEach(exam => {
        const backupKey = `submission_backup_${exam.id}_${user.uid}`;
        try {
          const raw = localStorage.getItem(backupKey);
          if (raw) {
            const parsed = JSON.parse(raw);
            if (parsed?.data) locallySubmitted.add(exam.id);
          }
        } catch { /* ignore */ }
      });
      setSubmittedIds(new Set([...submittedFromUserDoc, ...locallySubmitted]));
    };

    fetchExams();
  }, [userDoc?.activeCourseId, user, userDoc?.submittedExamIds]);

  // Show nothing while auth is still initializing or redirecting
  if (loading || !user || !userDoc) return null;

  // Strict access check: pending / rejected / suspended → blocked everywhere
  if (userDoc.status !== "approved") {
    return (
      <div className="p-4 max-w-md mx-auto animate-fade-in">
        <div className="bg-card border border-destructive/30 rounded-2xl p-6 text-center mt-8">
          <div className="w-14 h-14 rounded-2xl bg-destructive/10 flex items-center justify-center mx-auto mb-3">
            <Lock className="h-7 w-7 text-destructive" />
          </div>
          <p className="text-base font-bold text-destructive">No Access</p>
          <p className="text-sm text-muted-foreground mt-1">
            আপনার enrollment {userDoc.status === "pending" ? "pending" : userDoc.status === "rejected" ? "rejected" : "suspended"} — পরীক্ষায় অ্যাক্সেস নেই।
          </p>
        </div>
      </div>
    );
  }

  if (!userDoc?.activeCourseId) {
    return (
      <div className="p-4 text-center">
        <p className="text-muted-foreground text-sm py-8">
          Please select an active course from your profile to view exams.
        </p>
      </div>
    );
  }

  if (activeCourseExpired) {
    return (
      <div className="p-4 max-w-2xl mx-auto animate-fade-in">
        <h1 className="text-xl font-semibold text-foreground mb-4 flex items-center gap-2">
          <BookOpen className="h-5 w-5" /> Exams
        </h1>
        <div className="flex flex-col items-center justify-center py-16 gap-4">
          <div className="w-16 h-16 rounded-2xl bg-destructive/10 flex items-center justify-center">
            <Lock className="h-8 w-8 text-destructive" />
          </div>
          <div className="text-center">
            <p className="text-base font-bold text-destructive mb-1">Course Expired</p>
            <p className="text-sm text-muted-foreground max-w-xs">
              এই কোর্সটি expired হয়ে গেছে। পরীক্ষায় আর অ্যাক্সেস নেই।
            </p>
          </div>
        </div>
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
        <ExamListSkeleton count={4} />
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
