import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import {
  collection, deleteDoc, doc, updateDoc, setDoc, query, where, getDocs,
} from "firebase/firestore";
import { examDb } from "@/lib/examFirebase";
import { db } from "@/lib/firebase";
import { Exam, ExamSubmission } from "@/types/exam";
import { Course } from "@/types";
import { toast } from "sonner";
import { getCachedCollection, invalidateCache } from "@/lib/firestoreCache";
import {
  Trash2, Edit, Eye, Plus, Download, Upload, Trophy,
  FileText, ChevronLeft, ChevronRight,
} from "lucide-react";
import { ImagePreviewDialog } from "@/components/ImagePreviewDialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

const formatTime12 = (d?: Date) =>
  d?.toLocaleString("en-US", { hour: "numeric", minute: "2-digit", hour12: true, month: "short", day: "numeric" }) || "";

const PAGE_SIZE = 15;

export default function AdminExamsPage() {
  const navigate = useNavigate();
  const [exams, setExams] = useState<Exam[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState(true);
  const [resultsExam, setResultsExam] = useState<Exam | null>(null);
  const [submissions, setSubmissions] = useState<ExamSubmission[]>([]);
  const [activeTab, setActiveTab] = useState("exams");
  const [filterCourse, setFilterCourse] = useState("");
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [loadingResults, setLoadingResults] = useState(false);

  // ─── In-memory cache: submissions per examId ───────────────────────────────
  const submissionsCache = useRef<Map<string, ExamSubmission[]>>(new Map());

  // ─── Fetch exams (cached) ─────────────────────────────────────────────────
  const fetchExams = async () => {
    setLoading(true);
    const list = await getCachedCollection<Exam>(examDb, "exams");
    setExams(list);
    setLoading(false);
  };

  // ─── Fetch courses (cached) ───────────────────────────────────────────────
  const fetchCourses = async () => {
    const list = await getCachedCollection<Course>(db, "courses");
    setCourses(list);
  };

  useEffect(() => {
    fetchExams();
    fetchCourses();
  }, []);

  // ─── Delete: update local state instead of re-fetching ────────────────────
  const handleDelete = async (id: string) => {
    await deleteDoc(doc(examDb, "exams", id));
    invalidateCache("exams");
    toast.success("Exam deleted");
    setExams((prev) => prev.filter((e) => e.id !== id));
    submissionsCache.current.delete(id);
  };

  // ─── View Results: WHERE query + cache ───────────────────────────────────
  const viewResults = async (exam: Exam, forceRefresh = false) => {
    setResultsExam(exam);
    setActiveTab("results");

    // Cache hit — Firebase read লাগবে না
    if (!forceRefresh && submissionsCache.current.has(exam.id)) {
      setSubmissions(submissionsCache.current.get(exam.id)!);
      return;
    }

    setLoadingResults(true);
    try {
      // ✅ WHERE query: শুধু ওই exam-এর submissions fetch করে
      const q = query(
        collection(examDb, "submissions"),
        where("examId", "==", exam.id)
      );
      const snap = await getDocs(q);
      const subs = snap.docs
        .map((d) => ({ id: d.id, ...d.data() } as ExamSubmission))
        .sort((a, b) => b.obtainedMarks - a.obtainedMarks);

      submissionsCache.current.set(exam.id, subs);                      // cache store
      setSubmissions(subs);
    } finally {
      setLoadingResults(false);
    }
  };

  // ─── Publish toggle: update local state, no re-fetch ─────────────────────
  const togglePublish = async (exam: Exam) => {
    const newValue = !exam.resultPublished;
    await updateDoc(doc(examDb, "exams", exam.id), { resultPublished: newValue });
    invalidateCache("exams");
    toast.success(newValue ? "Result published" : "Result unpublished");
    setExams((prev) =>                                                   // ✅ 0 extra reads
      prev.map((e) => (e.id === exam.id ? { ...e, resultPublished: newValue } : e))
    );
  };

  // ─── Export / Import (unchanged logic, no Firebase impact) ───────────────
  const exportExams = (examsToExport: Exam[]) => {
    const data = examsToExport.map((e) => {
      const { id, ...rest } = e as any;
      return { id, ...rest };
    });
    const blob = new Blob([JSON.stringify({ exams: data }, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `exams-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success(`${examsToExport.length} exam(s) exported`);
  };

  const handleImportExams = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const text = await file.text();
      const data = JSON.parse(text);
      const examsData = data.exams || data;
      const arr = Array.isArray(examsData) ? examsData : [examsData];
      for (const exam of arr) {
        const { id, ...rest } = exam;
        if (id) {
          await setDoc(doc(examDb, "exams", id), rest, { merge: true });
        } else {
          const { addDoc } = await import("firebase/firestore");
          await addDoc(collection(examDb, "exams"), rest);
        }
      }
      toast.success(`${arr.length} exam(s) imported`);
      invalidateCache("exams");
      fetchExams();
    } catch (err: any) {
      toast.error("Import failed: " + err.message);
    }
    e.target.value = "";
  };

  // ─── PDF Exports (client-side only, no Firebase reads) ───────────────────
  const downloadRankingPDF = () => {
    if (!resultsExam || submissions.length === 0) return;
    const passMark = resultsExam.passMark || 0;
    let html = `<html><head><meta charset="utf-8"><title>${resultsExam.title} - Rankings</title>
    <style>body{font-family:'Segoe UI',sans-serif;padding:40px;color:#333}h1{font-size:22px;margin-bottom:4px}h2{font-size:14px;color:#666;margin-bottom:20px}table{width:100%;border-collapse:collapse;font-size:13px}th{background:#f5f5f5;text-align:left;padding:10px;border-bottom:2px solid #ddd}td{padding:10px;border-bottom:1px solid #eee}.pass{color:#2e7d32;font-weight:600}.fail{color:#c62828;font-weight:600}</style></head><body>
    <h1>${resultsExam.title}</h1>
    <h2>${resultsExam.courseName} • Total: ${resultsExam.totalMarks} • Pass: ${passMark}</h2>
    <table><tr><th>Rank</th><th>Name</th><th>Email</th><th>Marks</th><th>Correct</th><th>Wrong</th><th>Status</th></tr>`;
    submissions.forEach((sub, idx) => {
      const passed = sub.obtainedMarks >= passMark;
      html += `<tr><td>${idx + 1}</td><td>${sub.userName}</td><td>${sub.userEmail}</td><td>${sub.obtainedMarks}/${sub.totalMarks}</td><td>${sub.correctCount}</td><td>${sub.wrongCount}</td><td class="${passed ? "pass" : "fail"}">${passed ? "Pass" : "Fail"}</td></tr>`;
    });
    html += `</table></body></html>`;
    const w = window.open("", "_blank");
    if (w) { w.document.write(html); w.document.close(); w.onload = () => w.print(); }
  };
  const downloadQuestionsPDF = (exam: Exam) => {
    let html = `<html><head><meta charset="utf-8"><title>${exam.title} - Questions & Answers</title>
    <style>body{font-family:'Segoe UI',sans-serif;padding:40px;color:#333;line-height:1.6}h1{font-size:22px;margin-bottom:4px;color:#111}h2{font-size:14px;color:#666;margin-bottom:20px}.question{margin-bottom:24px;padding:16px;border:1px solid #e0e0e0;border-radius:8px;page-break-inside:avoid}.q-header{font-weight:600;font-size:15px;margin-bottom:8px;color:#111}.q-type{display:inline-block;font-size:11px;padding:2px 8px;border-radius:10px;background:#f0f0f0;color:#666;margin-left:8px}.option{padding:6px 12px;margin:4px 0;border-radius:6px;font-size:13px}.correct{background:#e8f5e9;color:#2e7d32;font-weight:600}.answer-label{font-size:12px;color:#888;margin-top:8px;margin-bottom:4px}.answer-text{font-size:14px;color:#2e7d32;font-weight:500}img{max-height:200px;border-radius:6px;margin:8px 0}</style></head><body>
    <h1>${exam.title}</h1>
    <h2>${exam.courseName} • Total: ${exam.totalMarks} Marks • Duration: ${exam.duration} min • Pass: ${exam.passMark || 0}</h2>`;

    exam.questions.forEach((q, idx) => {
      html += `<div class="question"><div class="q-header">Q${idx + 1}. ${q.questionText} <span class="q-type">MCQ • ${q.marks} marks</span></div>`;
      if (q.questionImage) html += `<img src="${q.questionImage}" alt="Question Image" />`;
      if (q.options) {
        q.options.forEach((opt, oIdx) => {
          const isCorrect = oIdx === q.correctAnswer;
          html += `<div class="option ${isCorrect ? "correct" : ""}">${String.fromCharCode(65 + oIdx)}) ${opt.text} ${isCorrect ? "✓" : ""}</div>`;
          if (opt.image) html += `<img src="${opt.image}" alt="Option" style="max-height:80px;margin-left:20px" />`;
        });
        html += `<div class="answer-label">Correct Answer:</div><div class="answer-text">${String.fromCharCode(65 + (q.correctAnswer || 0))}) ${q.options[q.correctAnswer || 0]?.text || ""}</div>`;
      }
      html += `</div>`;
    });
    html += `</body></html>`;
    const w = window.open("", "_blank");
    if (w) { w.document.write(html); w.document.close(); w.onload = () => w.print(); }
  };

  // ─── Pagination & filtering ───────────────────────────────────────────────
  const filteredExams = filterCourse ? exams.filter((e) => e.courseId === filterCourse) : exams;
  const totalPages = Math.ceil(filteredExams.length / PAGE_SIZE);
  const paginatedExams = filteredExams.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  useEffect(() => { setCurrentPage(1); }, [filterCourse]);

  const getExamTypeLabel = (_exam: Exam) => "MCQ";


  // ─── Main View ────────────────────────────────────────────────────────────
  return (
    <div className="p-4 max-w-4xl mx-auto animate-fade-in">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-xl font-semibold text-foreground">Exam Management</h1>
        <button
          onClick={() => navigate("/admin/exams/add")}
          className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium"
        >
          <Plus className="h-4 w-4" /> Create
        </button>
      </div>

      <div className="flex gap-2 mb-4">
        <button
          onClick={() => exportExams(filteredExams)}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-card border border-border rounded-lg text-xs font-medium text-foreground hover:bg-accent"
        >
          <Download className="h-3 w-3" /> Export {filterCourse ? "Filtered" : "All"}
        </button>
        <label className="flex items-center gap-1.5 px-3 py-1.5 bg-card border border-border rounded-lg text-xs font-medium text-foreground hover:bg-accent cursor-pointer">
          <Upload className="h-3 w-3" /> Import
          <input type="file" accept=".json" onChange={handleImportExams} className="hidden" />
        </label>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="w-full mb-4">
          <TabsTrigger value="exams" className="flex-1">Exams</TabsTrigger>
          <TabsTrigger value="results" className="flex-1">Results</TabsTrigger>
        </TabsList>

        {/* ── Exams Tab ── */}
        <TabsContent value="exams">
          <select
            value={filterCourse}
            onChange={(e) => setFilterCourse(e.target.value)}
            className="w-full px-4 py-2.5 rounded-lg bg-card border border-border text-foreground text-sm mb-4"
          >
            <option value="">All Courses</option>
            {courses.map((c) => (
              <option key={c.id} value={c.id}>{c.courseName}</option>
            ))}
          </select>

          {loading ? (
            <p className="text-muted-foreground text-sm text-center py-8">Loading...</p>
          ) : paginatedExams.length === 0 ? (
            <p className="text-muted-foreground text-sm text-center py-8">No exams yet</p>
          ) : (
            <div className="space-y-3">
              {paginatedExams.map((exam) => {
                const startTime = formatTime12(exam.startTime?.toDate?.());
                const endTime = formatTime12(exam.endTime?.toDate?.());
                const typeLabel = getExamTypeLabel(exam);
                const typeColor =
                  typeLabel === "MCQ + Written"
                    ? "bg-purple-500/10 text-purple-600 dark:text-purple-400"
                    : typeLabel === "Written"
                    ? "bg-amber-500/10 text-amber-600 dark:text-amber-400"
                    : "bg-blue-500/10 text-blue-600 dark:text-blue-400";

                return (
                  <div key={exam.id} className="bg-card border border-border rounded-2xl shadow-sm overflow-hidden">
                    {/* Card Header */}
                    <div className="px-4 pt-4 pb-3">
                      <div className="flex flex-wrap items-start gap-2 mb-1.5">
                        <h3 className="font-semibold text-foreground text-sm leading-snug flex-1 min-w-0">
                          {exam.title}
                        </h3>
                        <span
                          className={`shrink-0 text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                            exam.resultPublished
                              ? "bg-green-500/10 text-green-600 dark:text-green-400"
                              : "bg-muted text-muted-foreground"
                          }`}
                        >
                          {exam.resultPublished ? "✓ Published" : "Unpublished"}
                        </span>
                      </div>

                      <p className="text-xs text-muted-foreground mb-3 truncate">{exam.courseName}</p>

                      <div className="flex flex-wrap gap-1.5">
                        <span className={`inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-full ${typeColor}`}>
                          {typeLabel}
                        </span>
                        <span className="inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-full bg-accent text-foreground">
                          {exam.questions?.length || 0} প্রশ্ন
                        </span>
                        <span className="inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-full bg-accent text-foreground">
                          {exam.totalMarks} নম্বর
                        </span>
                        <span className="inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-full bg-accent text-foreground">
                          ⏱ {exam.duration} মিনিট
                        </span>
                        <span className="inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-full bg-green-500/10 text-green-600 dark:text-green-400">
                          পাস: {exam.passMark || 0}
                        </span>
                        {(exam.negativeMark ?? 0) > 0 && (
                          <span className="inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-full bg-red-500/10 text-red-500">
                            −{exam.negativeMark} নেগেটিভ
                          </span>
                        )}
                      </div>

                      {(startTime || endTime) && (
                        <div className="mt-2.5 flex items-center gap-1.5 text-[11px] text-muted-foreground">
                          <span className="shrink-0">🕐</span>
                          <span className="truncate">
                            {startTime}
                            {endTime && <> &rarr; {endTime}</>}
                          </span>
                        </div>
                      )}
                    </div>

                    {/* Action Bar */}
                    <div className="flex items-center justify-between gap-1 px-3 py-2 border-t border-border bg-accent/30">
                      <button
                        onClick={() => togglePublish(exam)}
                        title={exam.resultPublished ? "Unpublish Result" : "Publish Result"}
                        className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] font-medium transition-colors ${
                          exam.resultPublished
                            ? "bg-green-500/10 text-green-600 dark:text-green-400 hover:bg-green-500/20"
                            : "bg-accent text-muted-foreground hover:bg-accent/80"
                        }`}
                      >
                        <Trophy className="h-3.5 w-3.5" />
                        <span className="hidden sm:inline">
                          {exam.resultPublished ? "Unpublish" : "Publish"}
                        </span>
                      </button>

                      <div className="flex items-center gap-0.5">
                        <button
                          onClick={() => downloadQuestionsPDF(exam)}
                          title="Download Q&A PDF"
                          className="p-2 hover:bg-accent rounded-lg transition-colors"
                        >
                          <FileText className="h-4 w-4 text-muted-foreground" />
                        </button>
                        <button
                          onClick={() => exportExams([exam])}
                          title="Export"
                          className="p-2 hover:bg-accent rounded-lg transition-colors"
                        >
                          <Download className="h-4 w-4 text-muted-foreground" />
                        </button>
                        <button
                          onClick={() => viewResults(exam)}
                          title="View Results"
                          className="p-2 hover:bg-accent rounded-lg transition-colors"
                        >
                          <Eye className="h-4 w-4 text-muted-foreground" />
                        </button>
                        <button
                          onClick={() => navigate(`/admin/exams/add?edit=${exam.id}`)}
                          title="Edit"
                          className="p-2 hover:bg-accent rounded-lg transition-colors"
                        >
                          <Edit className="h-4 w-4 text-muted-foreground" />
                        </button>
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <button title="Delete" className="p-2 hover:bg-red-500/10 rounded-lg transition-colors">
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Delete Exam</AlertDialogTitle>
                              <AlertDialogDescription>Are you sure?</AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancel</AlertDialogCancel>
                              <AlertDialogAction onClick={() => handleDelete(exam.id)}>Delete</AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-2 mt-4">
              <button
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="p-2 rounded-lg bg-card border border-border disabled:opacity-30"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <span className="text-sm text-muted-foreground">{currentPage} / {totalPages}</span>
              <button
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
                className="p-2 rounded-lg bg-card border border-border disabled:opacity-30"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          )}
        </TabsContent>

        {/* ── Results Tab ── */}
        <TabsContent value="results">
          {resultsExam ? (
            <div>
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-medium text-foreground">
                  {resultsExam.title} - Results ({submissions.length})
                </h3>
                <div className="flex gap-2">
                  <button
                    onClick={() => viewResults(resultsExam, true)}   // force refresh button
                    className="flex items-center gap-1 px-3 py-1.5 bg-accent border border-border rounded-lg text-xs font-medium text-foreground"
                    title="Firebase থেকে নতুন করে লোড করুন"
                  >
                    ↺ Refresh
                  </button>
                  <button
                    onClick={downloadRankingPDF}
                    className="flex items-center gap-1 px-3 py-1.5 bg-accent border border-border rounded-lg text-xs font-medium text-foreground"
                  >
                    <Download className="h-3 w-3" /> PDF
                  </button>
                  <button
                    onClick={() => setResultsExam(null)}
                    className="text-sm text-muted-foreground hover:text-foreground"
                  >
                    Back
                  </button>
                </div>
              </div>

              {loadingResults ? (
                <p className="text-muted-foreground text-sm text-center py-8">Loading results...</p>
              ) : submissions.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">No submissions yet</p>
              ) : (
                <div className="space-y-2">
                  {submissions.map((sub, idx) => {
                    const passed = sub.obtainedMarks >= (resultsExam.passMark || 0);
                    return (
                      <div key={sub.id} className="bg-card border border-border rounded-xl p-3">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <span
                              className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${
                                idx < 3 ? "bg-primary text-primary-foreground" : "bg-accent text-foreground"
                              }`}
                            >
                              {idx + 1}
                            </span>
                            <div>
                              <p className="text-sm font-medium text-foreground">{sub.userName}</p>
                              <p className="text-xs text-muted-foreground">{sub.userEmail}</p>
                            </div>
                          </div>
                          <div className="text-right">
                            <p className="text-sm font-semibold text-foreground">
                              {sub.obtainedMarks}/{sub.totalMarks}
                            </p>
                            <div className="flex items-center gap-2 justify-end">
                              <p className="text-xs text-muted-foreground">✓{sub.correctCount} ✗{sub.wrongCount}</p>
                              <span
                                className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${
                                  passed
                                    ? "bg-green-500/10 text-green-600 dark:text-green-400"
                                    : "bg-red-500/10 text-destructive"
                                }`}
                              >
                                {passed ? "Pass" : "Fail"}
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          ) : (
            <div>
              <select
                value={filterCourse}
                onChange={(e) => setFilterCourse(e.target.value)}
                className="w-full px-4 py-2.5 rounded-lg bg-card border border-border text-foreground text-sm mb-3"
              >
                <option value="">All Courses</option>
                {courses.map((c) => (
                  <option key={c.id} value={c.id}>{c.courseName}</option>
                ))}
              </select>
              <div className="space-y-2">
                {filteredExams.map((exam) => (
                  <button
                    key={exam.id}
                    onClick={() => viewResults(exam)}
                    className="w-full text-left bg-card border border-border rounded-xl p-3 hover:bg-accent transition-colors"
                  >
                    <p className="text-sm font-medium text-foreground">{exam.title}</p>
                    <p className="text-xs text-muted-foreground">
                      {exam.courseName} • {exam.questions?.length || 0} Q
                      {submissionsCache.current.has(exam.id) && (
                        <span className="ml-2 text-primary/60">• cached</span>
                      )}
                    </p>
                  </button>
                ))}
              </div>
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
