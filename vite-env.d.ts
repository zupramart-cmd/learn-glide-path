import { useState, useRef, useEffect } from "react";
import { collection, getDocs, doc, setDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { examDb } from "@/lib/examFirebase";
import { toast } from "sonner";
import { Download, Upload, BookOpen, Database, FileArchive, ChevronDown } from "lucide-react";
import { Course } from "@/types";

const COLLECTIONS = ["users", "courses", "videos", "settings", "enrollRequests"];

const COLLECTION_LABELS: Record<string, string> = {
  users: "Users",
  courses: "Courses",
  videos: "Videos",
  settings: "Settings",
  enrollRequests: "Enroll Requests",
};

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
  const [exporting, setExporting] = useState<string | null>(null);
  const [importing, setImporting] = useState<string | null>(null);
  const [courses, setCourses] = useState<Course[]>([]);
  const [selectedCourse, setSelectedCourse] = useState("");
  const [openCollection, setOpenCollection] = useState<string | null>(null);

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

  // ── Course Backup ─────────────────────────────────────────────
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

  // ── Collection Export ─────────────────────────────────────────
  const handleExportSingle = async (col: string) => {
    setExporting(col);
    try {
      const snap = await getDocs(collection(db, col));
      downloadJson({ [col]: snap.docs.map(d => ({ id: d.id, ...d.data() })) }, `lms-${col}-${today()}.json`);
      toast.success(`"${COLLECTION_LABELS[col]}" exported`);
    } catch (err: any) { toast.error(err.message); }
    setExporting(null);
  };

  // ── Collection Import ─────────────────────────────────────────
  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>, target: string) => {
    const file = e.target.files?.[0]; if (!file) return;
    setImporting(target);
    try {
      const data = JSON.parse(await file.text());
      for (const [colName, docs] of Object.entries(data) as [string, any[]][]) {
        if (target !== "all" && colName !== target) continue;
        for (const docData of docs) {
          const { id, ...rest } = docData;
          if (id) await setDoc(doc(db, colName, id), rest, { merge: true });
        }
      }
      toast.success("Data imported & merged successfully");
    } catch (err: any) { toast.error(err.message || "Import failed"); }
    setImporting(null); e.target.value = "";
  };

  // ── Exam Export ───────────────────────────────────────────────
  const handleExamExport = async () => {
    setExporting("exams");
    try {
      const snap = await getDocs(collection(examDb, "exams"));
      downloadJson({ exams: snap.docs.map(d => ({ id: d.id, ...d.data() })) }, `exams-${today()}.json`);
      toast.success("Exams exported");
    } catch (err: any) { toast.error(err.message); }
    setExporting(null);
  };

  // ── Exam Import ───────────────────────────────────────────────
  const handleExamImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; if (!file) return;
    setImporting("exams");
    try {
      const data = JSON.parse(await file.text());
      const arr = data.exams || (Array.isArray(data) ? data : [data]);
      for (const exam of arr) {
        const { id, ...rest } = exam;
        if (id) await setDoc(doc(examDb, "exams", id), rest, { merge: true });
      }
      toast.success(`${arr.length} exam(s) imported`);
    } catch (err: any) { toast.error("Import failed: " + err.message); }
    setImporting(null); e.target.value = "";
  };

  const busy = !!exporting || !!importing;

  return (
    <div className="p-4 max-w-xl mx-auto space-y-4 animate-fade-in">
      <div>
        <h2 className="text-xl font-bold text-foreground">Backup & Restore</h2>
        <p className="text-sm text-muted-foreground mt-1">Export or import your LMS data as JSON files.</p>
      </div>

      {/* ── 1. Course Backup ── */}
      <SectionCard
        icon={<BookOpen className="h-4 w-4" />}
        title="Course Backup"
        description="Export everything for one course — users, videos, exams, and submissions."
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

      {/* ── 2. Exam Backup ── */}
      <SectionCard
        icon={<FileArchive className="h-4 w-4" />}
        title="Exam Backup"
        description="Export or import all exams from the exam database."
      >
        <div className="flex gap-2 flex-wrap">
          <ActionBtn
            onClick={handleExamExport}
            disabled={busy}
            loading={exporting === "exams"}
            variant="outline"
            icon={<Download className="h-4 w-4" />}
          >
            Export Exams
          </ActionBtn>
          <FileImportBtn onChange={handleExamImport} loading={importing === "exams"} disabled={busy}>
            Import Exams
          </FileImportBtn>
        </div>
      </SectionCard>

      {/* ── 3. Collections ── */}
      <SectionCard
        icon={<Database className="h-4 w-4" />}
        title="Collections"
        description="Export or import individual Firestore collections."
      >
        {/* Bulk import all */}
        <div className="flex items-center justify-between py-2 border-b border-border mb-1">
          <span className="text-sm font-medium text-foreground">All Collections</span>
          <FileImportBtn onChange={e => handleImport(e, "all")} loading={importing === "all"} disabled={busy} variant="primary">
            Import All
          </FileImportBtn>
        </div>

        <div className="space-y-1 mt-1">
          {COLLECTIONS.map(col => (
            <div key={col} className="flex items-center justify-between px-2 py-2 rounded-lg hover:bg-muted/50 transition-colors">
              <span className="text-sm text-foreground">{COLLECTION_LABELS[col]}</span>
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
  );
}
