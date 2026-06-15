import { useState, useEffect } from "react";
import { collection, getDocs, doc, setDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { examDb } from "@/lib/examFirebase";
import { toast } from "sonner";
import {
  Download, Upload, BookOpen, Database, FileArchive, ChevronDown,
  HardDrive, ArrowLeft,
} from "lucide-react";
import { Course } from "@/types";
import { useNavigate } from "react-router-dom";
import { invalidateCache, bumpVersion } from "@/lib/firestoreCache";

// ── Collection routing ──────────────────────────────────────────────────────
// `main` runs against the primary Firestore (db).
// `exam` runs against the exam Firestore (examDb).
const MAIN_COLLECTIONS = ["users", "courses", "videos", "settings", "enrollRequests"];
const EXAM_COLLECTIONS = ["exams", "submissions", "examEntries"];

const LABELS: Record<string, string> = {
  users: "Users",
  courses: "Courses",
  videos: "Videos",
  settings: "Settings",
  enrollRequests: "Enroll Requests",
  exams: "Exams",
  submissions: "Submissions",
  examEntries: "Exam Entries",
};

const dbFor = (col: string) => (EXAM_COLLECTIONS.includes(col) ? examDb : db);

function Spinner() {
  return (
    <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
    </svg>
  );
}

function SectionCard({ icon, title, description, children }: {
  icon: React.ReactNode; title: string; description: string; children: React.ReactNode;
}) {
  return (
    <div className="bg-card border border-border rounded-xl overflow-hidden">
      <div className="flex items-start gap-3 px-5 py-4 border-b border-border bg-muted/30">
        <span className="mt-0.5 text-primary">{icon}</span>
        <div>
          <p className="font-semibold text-sm text-foreground">{title}</p>
          <p className="text-xs text-muted-foreground mt-0.5">{description}</p>
        </div>
      </div>
      <div className="px-5 py-4">{children}</div>
    </div>
  );
}

function ActionBtn({
  onClick, disabled, loading, variant = "primary", icon, children,
}: {
  onClick?: () => void; disabled?: boolean; loading?: boolean;
  variant?: "primary" | "outline"; icon?: React.ReactNode; children: React.ReactNode;
}) {
  const base = "inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all disabled:opacity-40 disabled:cursor-not-allowed";
  const styles = variant === "primary"
    ? "bg-primary text-primary-foreground hover:bg-primary/90"
    : "border border-border bg-background text-foreground hover:bg-muted";
  return (
    <button onClick={onClick} disabled={disabled || loading} className={`${base} ${styles}`}>
      {loading ? <Spinner /> : icon}
      {children}
    </button>
  );
}

function FileImportBtn({
  onChange, loading, disabled, variant = "outline", children,
}: {
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  loading?: boolean; disabled?: boolean;
  variant?: "primary" | "outline"; children: React.ReactNode;
}) {
  const base = "inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all cursor-pointer";
  const styles = variant === "primary"
    ? "bg-primary text-primary-foreground hover:bg-primary/90"
    : "border border-border bg-background text-foreground hover:bg-muted";
  return (
    <label className={`${base} ${styles} ${(loading || disabled) ? "opacity-40 cursor-not-allowed pointer-events-none" : ""}`}>
      {loading ? <Spinner /> : <Upload className="h-4 w-4" />}
      {children}
      <input type="file" accept=".json" onChange={onChange} className="hidden" disabled={loading || disabled} />
    </label>
  );
}

export default function AdminDataPage() {
  const navigate = useNavigate();
  const [exporting, setExporting] = useState<string | null>(null);
  const [importing, setImporting] = useState<string | null>(null);
  const [courses, setCourses] = useState<Course[]>([]);
  const [selectedCourse, setSelectedCourse] = useState("");

  useEffect(() => {
    getDocs(collection(db, "courses")).then(snap => {
      setCourses(snap.docs.map(d => ({ id: d.id, ...d.data() } as Course)));
    });
  }, []);

  // ── Helpers ──────────────────────────────────────────────────
  const downloadJson = (data: unknown, filename: string) => {
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = filename; a.click();
    URL.revokeObjectURL(url);
  };

  const today = () => new Date().toISOString().slice(0, 10);

  const fetchCollection = async (col: string) => {
    const snap = await getDocs(collection(dbFor(col), col));
    return snap.docs.map(d => ({ id: d.id, ...d.data() }));
  };

  // ── 0. Full Backup (main + exam) ──────────────────────────────
  const handleFullExport = async () => {
    setExporting("full");
    try {
      const all: Record<string, any[]> = {};
      for (const c of [...MAIN_COLLECTIONS, ...EXAM_COLLECTIONS]) {
        all[c] = await fetchCollection(c);
      }
      downloadJson(
        { _meta: { type: "lms-full-backup", exportedAt: new Date().toISOString() }, ...all },
        `lms-full-backup-${today()}.json`
      );
      const totals = Object.entries(all).map(([k, v]) => `${LABELS[k]}: ${v.length}`).join(" · ");
      toast.success(`Full backup ready — ${totals}`);
    } catch (err: any) { toast.error(err.message || "Export failed"); }
    setExporting(null);
  };

  // ── Generic importer — routes each collection to correct DB ───
  const handleImport = async (
    e: React.ChangeEvent<HTMLInputElement>,
    target: string, // "full" | "main-all" | "exam-all" | specific collection name
  ) => {
    const file = e.target.files?.[0]; if (!file) return;
    setImporting(target);
    try {
      const raw = JSON.parse(await file.text());
      // Strip metadata so it doesn't get treated as a collection
      const { _meta, ...data } = raw as Record<string, any[]>;
      let writeCount = 0;
      const touched = new Set<string>();

      for (const [colName, docs] of Object.entries(data)) {
        if (!Array.isArray(docs)) continue;
        // Filter by target scope
        if (target === "main-all" && !MAIN_COLLECTIONS.includes(colName)) continue;
        if (target === "exam-all" && !EXAM_COLLECTIONS.includes(colName)) continue;
        if (
          target !== "full" && target !== "main-all" && target !== "exam-all" &&
          colName !== target
        ) continue;

        const targetDb = dbFor(colName);
        for (const docData of docs) {
          const { id, ...rest } = docData;
          if (!id) continue;
          await setDoc(doc(targetDb, colName, id), rest, { merge: true });
          writeCount++;
        }
        touched.add(colName);
      }

      // Invalidate caches + bump versions so live clients refetch
      for (const colName of touched) {
        invalidateCache(colName);
        await bumpVersion(dbFor(colName), colName);
      }

      toast.success(`Imported ${writeCount} document(s) into ${touched.size} collection(s)`);
    } catch (err: any) { toast.error(err.message || "Import failed"); }
    setImporting(null); e.target.value = "";
  };

  // ── Single-collection export ─────────────────────────────────
  const handleExportSingle = async (col: string) => {
    setExporting(col);
    try {
      const docs = await fetchCollection(col);
      downloadJson({ [col]: docs }, `lms-${col}-${today()}.json`);
      toast.success(`"${LABELS[col]}" exported (${docs.length})`);
    } catch (err: any) { toast.error(err.message); }
    setExporting(null);
  };

  // ── Course backup (unchanged behaviour) ──────────────────────
  const handleCourseBackupExport = async () => {
    if (!selectedCourse) { toast.error("Please select a course first"); return; }
    setExporting("course-backup");
    try {
      const course = courses.find(c => c.id === selectedCourse);
      const [usersSnap, videosSnap, enrollReqSnap, examsSnap, submissionsSnap] = await Promise.all([
        getDocs(collection(db, "users")),
        getDocs(collection(db, "videos")),
        getDocs(collection(db, "enrollRequests")),
        getDocs(collection(examDb, "exams")),
        getDocs(collection(examDb, "submissions")),
      ]);
      const courseUsers = usersSnap.docs.map(d => ({ id: d.id, ...d.data() }))
        .filter((u: any) => u.enrolledCourses?.some((c: any) => c.courseId === selectedCourse) || u.activeCourseId === selectedCourse);
      const courseVideos = videosSnap.docs.map(d => ({ id: d.id, ...d.data() })).filter((v: any) => v.courseId === selectedCourse);
      const courseEnrollRequests = enrollReqSnap.docs.map(d => ({ id: d.id, ...d.data() })).filter((r: any) => r.courseId === selectedCourse);
      const courseExams = examsSnap.docs.map(d => ({ id: d.id, ...d.data() })).filter((e: any) => e.courseId === selectedCourse);
      const examIds = courseExams.map((e: any) => e.id);
      const courseSubmissions = submissionsSnap.docs.map(d => ({ id: d.id, ...d.data() })).filter((s: any) => examIds.includes(s.examId));
      downloadJson(
        { course: course ? { id: course.id, ...course } : null, users: courseUsers, videos: courseVideos, enrollRequests: courseEnrollRequests, exams: courseExams, submissions: courseSubmissions, exportedAt: new Date().toISOString() },
        `course-backup-${course?.courseName?.replace(/\s+/g, "-") || selectedCourse}-${today()}.json`
      );
      toast.success(`Exported: ${courseUsers.length} users · ${courseVideos.length} videos · ${courseExams.length} exams`);
    } catch (err: any) { toast.error(err.message || "Export failed"); }
    setExporting(null);
  };

  const busy = !!exporting || !!importing;

  return (
    <div className="animate-fade-in">
      <div className="sticky top-0 z-10 bg-background/80 backdrop-blur-md border-b border-border px-4 py-3 flex items-center gap-2">
        <button onClick={() => navigate("/admin")} className="text-sm text-muted-foreground hover:text-foreground transition-colors">
          <ArrowLeft className="h-5 w-5" />
        </button>
        <h2 className="text-lg font-semibold text-foreground flex items-center gap-2">
          <HardDrive className="h-5 w-5" /> Backup & Restore
        </h2>
      </div>

      <div className="p-4 max-w-xl mx-auto space-y-4">
        <p className="text-xs text-muted-foreground">
          Main + Exam — দুটি Firestore-এর সব ডেটা একসাথে অথবা আলাদা আলাদা export/import করো।
        </p>

        {/* ── 0. Full Backup (BOTH DBs) ── */}
        <SectionCard
          icon={<HardDrive className="h-4 w-4" />}
          title="Full Backup (Main + Exam)"
          description="Both Firestore databases combined in one JSON — easiest disaster recovery."
        >
          <div className="flex gap-2 flex-wrap">
            <ActionBtn
              onClick={handleFullExport}
              disabled={busy}
              loading={exporting === "full"}
              icon={<Download className="h-4 w-4" />}
            >
              Export Everything
            </ActionBtn>
            <FileImportBtn
              onChange={e => handleImport(e, "full")}
              loading={importing === "full"}
              disabled={busy}
              variant="primary"
            >
              Import Everything
            </FileImportBtn>
          </div>
        </SectionCard>

        {/* ── 1. Course Backup ── */}
        <SectionCard
          icon={<BookOpen className="h-4 w-4" />}
          title="Single Course Backup"
          description="Export everything tied to one course — users, videos, exams & submissions."
        >
          <div className="flex gap-2">
            <div className="relative flex-1">
              <select
                value={selectedCourse}
                onChange={e => setSelectedCourse(e.target.value)}
                className="w-full appearance-none pl-3 pr-8 py-2 rounded-lg bg-background border border-border text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40"
              >
                <option value="">Select a course…</option>
                {courses.map(c => <option key={c.id} value={c.id}>{c.courseName}</option>)}
              </select>
              <ChevronDown className="pointer-events-none absolute right-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            </div>
            <ActionBtn
              onClick={handleCourseBackupExport}
              disabled={!selectedCourse || busy}
              loading={exporting === "course-backup"}
              icon={<Download className="h-4 w-4" />}
            >
              Export
            </ActionBtn>
          </div>
        </SectionCard>

        {/* ── 2. Main DB Collections ── */}
        <SectionCard
          icon={<Database className="h-4 w-4" />}
          title="Main Database Collections"
          description="Users, courses, videos, settings, enrollments."
        >
          <div className="flex items-center justify-between py-2 border-b border-border mb-1">
            <span className="text-sm font-medium text-foreground">All Main Collections</span>
            <FileImportBtn
              onChange={e => handleImport(e, "main-all")}
              loading={importing === "main-all"}
              disabled={busy}
              variant="primary"
            >
              Import All
            </FileImportBtn>
          </div>

          <div className="space-y-1 mt-1">
            {MAIN_COLLECTIONS.map(col => (
              <div key={col} className="flex items-center justify-between px-2 py-2 rounded-lg hover:bg-muted/50 transition-colors">
                <span className="text-sm text-foreground">{LABELS[col]}</span>
                <div className="flex gap-2">
                  <ActionBtn
                    onClick={() => handleExportSingle(col)}
                    disabled={busy}
                    loading={exporting === col}
                    variant="outline"
                    icon={<Download className="h-3.5 w-3.5" />}
                  >
                    Export
                  </ActionBtn>
                  <FileImportBtn onChange={e => handleImport(e, col)} loading={importing === col} disabled={busy}>
                    Import
                  </FileImportBtn>
                </div>
              </div>
            ))}
          </div>
        </SectionCard>

        {/* ── 3. Exam DB Collections ── */}
        <SectionCard
          icon={<FileArchive className="h-4 w-4" />}
          title="Exam Database Collections"
          description="Exams, submissions, exam entries (separate Firestore)."
        >
          <div className="flex items-center justify-between py-2 border-b border-border mb-1">
            <span className="text-sm font-medium text-foreground">All Exam Collections</span>
            <FileImportBtn
              onChange={e => handleImport(e, "exam-all")}
              loading={importing === "exam-all"}
              disabled={busy}
              variant="primary"
            >
              Import All
            </FileImportBtn>
          </div>

          <div className="space-y-1 mt-1">
            {EXAM_COLLECTIONS.map(col => (
              <div key={col} className="flex items-center justify-between px-2 py-2 rounded-lg hover:bg-muted/50 transition-colors">
                <span className="text-sm text-foreground">{LABELS[col]}</span>
                <div className="flex gap-2">
                  <ActionBtn
                    onClick={() => handleExportSingle(col)}
                    disabled={busy}
                    loading={exporting === col}
                    variant="outline"
                    icon={<Download className="h-3.5 w-3.5" />}
                  >
                    Export
                  </ActionBtn>
                  <FileImportBtn onChange={e => handleImport(e, col)} loading={importing === col} disabled={busy}>
                    Import
                  </FileImportBtn>
                </div>
              </div>
            ))}
          </div>
        </SectionCard>
      </div>
    </div>
  );
}
