import { useState, useEffect, useRef } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { collection, getDocs, addDoc, updateDoc, doc, getDoc, Timestamp } from "firebase/firestore";
import { examDb } from "@/lib/examFirebase";
import { db } from "@/lib/firebase";
import { Exam, ExamQuestion } from "@/types/exam";
import { Course } from "@/types";
import { toast } from "sonner";
import { Trash2, Plus, Upload, ChevronDown, ChevronUp, X, Image, Download, ExternalLink, FileText, CheckCircle, ArrowLeft } from "lucide-react";

/* ── Helpers ── */
const FormSection = ({ icon: Icon, title, step, children }: { icon: any; title: string; step: number; children: React.ReactNode }) => (
  <div className="rounded-xl border border-border bg-card/50 overflow-hidden">
    <div className="flex items-center gap-2 px-4 py-2.5 bg-accent/30 border-b border-border">
      <span className="w-6 h-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xs font-bold">{step}</span>
      <Icon className="h-4 w-4 text-primary" />
      <span className="text-sm font-medium text-foreground">{title}</span>
    </div>
    <div className="p-4 space-y-3">{children}</div>
  </div>
);

const inputClass = "w-full px-3 py-2.5 rounded-lg bg-background border border-border text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-all placeholder:text-muted-foreground/60";

export default function AdminAddExamPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const editId = searchParams.get("edit");

  const [courses, setCourses] = useState<Course[]>([]);
  const [title, setTitle] = useState("");
  const [courseId, setCourseId] = useState("");
  const [duration, setDuration] = useState(30);
  const [negativeMark, setNegativeMark] = useState(0);
  const [passMark, setPassMark] = useState(0);
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");
  const [questions, setQuestions] = useState<ExamQuestion[]>([]);
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(!!editId);
  const [existingExam, setExistingExam] = useState<Exam | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    getDocs(collection(db, "courses")).then(snap => {
      setCourses(snap.docs.map(d => ({ id: d.id, ...d.data() } as Course)));
    });
  }, []);

  useEffect(() => {
    if (!editId) return;
    getDoc(doc(examDb, "exams", editId)).then(snap => {
      if (snap.exists()) {
        const exam = { id: snap.id, ...snap.data() } as Exam;
        setExistingExam(exam);
        setTitle(exam.title);
        setCourseId(exam.courseId);
        setDuration(exam.duration);
        setNegativeMark(exam.negativeMark || 0);
        setPassMark(exam.passMark || 0);
        setStartTime(exam.startTime?.toDate?.()?.toISOString().slice(0, 16) || "");
        setEndTime(exam.endTime?.toDate?.()?.toISOString().slice(0, 16) || "");
        setQuestions(exam.questions || []);
      }
      setLoading(false);
    });
  }, [editId]);

  const selectedCourse = courses.find(c => c.id === courseId);

  const addMCQQuestion = () => {
    setQuestions([...questions, {
      id: Date.now().toString(),
      questionText: "",
      type: "mcq",
      options: [{ text: "" }, { text: "" }, { text: "" }, { text: "" }],
      correctAnswer: 0,
      marks: 1,
    }]);
  };

  const addWrittenQuestion = () => {
    setQuestions([...questions, {
      id: Date.now().toString(),
      questionText: "",
      type: "written",
      marks: 1,
    }]);
  };

  const updateQuestion = (idx: number, updates: Partial<ExamQuestion>) => {
    const updated = [...questions];
    updated[idx] = { ...updated[idx], ...updates };
    setQuestions(updated);
  };

  const removeQuestion = (idx: number) => setQuestions(questions.filter((_, i) => i !== idx));

  const updateOption = (qIdx: number, oIdx: number, text: string) => {
    const updated = [...questions];
    if (updated[qIdx].options) {
      updated[qIdx].options![oIdx] = { ...updated[qIdx].options![oIdx], text };
      setQuestions(updated);
    }
  };

  const updateOptionImage = (qIdx: number, oIdx: number, image: string) => {
    const updated = [...questions];
    if (updated[qIdx].options) {
      updated[qIdx].options![oIdx] = { ...updated[qIdx].options![oIdx], image };
      setQuestions(updated);
    }
  };

  const addOption = (qIdx: number) => {
    const updated = [...questions];
    if (updated[qIdx].options) {
      updated[qIdx].options!.push({ text: "" });
      setQuestions(updated);
    }
  };

  const removeOption = (qIdx: number, oIdx: number) => {
    const updated = [...questions];
    if (updated[qIdx].options && updated[qIdx].options!.length > 2) {
      updated[qIdx].options!.splice(oIdx, 1);
      if ((updated[qIdx].correctAnswer || 0) >= updated[qIdx].options!.length) {
        updated[qIdx].correctAnswer = 0;
      }
      setQuestions(updated);
    }
  };

  const downloadTemplate = () => {
    const template = [
      {
        question: "What is 2+2?",
        questionImage: "",
        type: "mcq",
        option1: "3", option1Image: "",
        option2: "4", option2Image: "",
        option3: "5", option3Image: "",
        option4: "6", option4Image: "",
        correct: 1,
        marks: 1
      },
      {
        question: "Which planet is closest to the Sun?",
        questionImage: "",
        type: "mcq",
        option1: "Venus", option1Image: "",
        option2: "Earth", option2Image: "",
        option3: "Mercury", option3Image: "",
        option4: "Mars", option4Image: "",
        correct: 2,
        marks: 1
      },
    ];
    const blob = new Blob([JSON.stringify(template, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = "exam_template.json"; a.click();
    URL.revokeObjectURL(url);
    toast.success("JSON template downloaded");
  };

  const handleBulkUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.name.endsWith(".json")) {
      toast.error("Only JSON files are supported");
      if (fileRef.current) fileRef.current.value = "";
      return;
    }
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const text = ev.target?.result as string;
        let parsed: any[];
        if (file.name.endsWith(".json")) {
          parsed = JSON.parse(text);
        } else {
          parsed = [];
        }
        const newQuestions: ExamQuestion[] = parsed.map((item, idx) => {
          const qType = (item.type || "mcq").toLowerCase();
          if (qType === "written") {
            return {
              id: (Date.now() + idx).toString(),
              questionText: item.question || item.questionText || "",
              questionImage: item.questionImage || "",
              type: "written" as const,
              writtenAnswer: item.answerImage || item.writtenAnswer || "",
              marks: parseInt(item.marks || "1"),
            };
          }
          return {
            id: (Date.now() + idx).toString(),
            questionText: item.question || item.questionText || "",
            questionImage: item.questionImage || "",
            type: "mcq" as const,
            options: [
              { text: item.option1 || item.a || "", image: item.option1Image || "" },
              { text: item.option2 || item.b || "", image: item.option2Image || "" },
              { text: item.option3 || item.c || "", image: item.option3Image || "" },
              { text: item.option4 || item.d || "", image: item.option4Image || "" },
            ].filter(o => o.text),
            correctAnswer: parseInt(item.correct || item.correctAnswer || "0"),
            marks: parseInt(item.marks || "1"),
          };
        });
        setQuestions(prev => [...prev, ...newQuestions]);
        toast.success(`${newQuestions.length} questions imported`);
      } catch {
        toast.error("Failed to parse file");
      }
    };
    reader.readAsText(file);
    if (fileRef.current) fileRef.current.value = "";
  };

  const handleSave = async () => {
    if (!title || !courseId || !startTime || !endTime) {
      toast.error("Please fill all required fields"); return;
    }
    setSaving(true);
    const totalMarks = questions.reduce((s, q) => s + q.marks, 0);
    // Determine exam type based on questions
    const hasMcq = questions.some(q => q.type === "mcq");
    const hasWritten = questions.some(q => q.type === "written");
    const type = hasMcq && hasWritten ? "mcq" : hasWritten ? "written" : "mcq";
    
    const data = {
      title, courseId, courseName: selectedCourse?.courseName || "", type,
      duration, totalMarks, negativeMark, passMark,
      startTime: Timestamp.fromDate(new Date(startTime)),
      endTime: Timestamp.fromDate(new Date(endTime)),
      questions,
      createdAt: existingExam?.createdAt || Timestamp.now(),
    };
    try {
      if (existingExam) {
        await updateDoc(doc(examDb, "exams", existingExam.id), data);
        toast.success("Exam updated");
      } else {
        await addDoc(collection(examDb, "exams"), data);
        toast.success("Exam created");
      }
      setSuccess(true);
      setTimeout(() => { navigate("/admin/exams"); }, 1000);
    } catch (err: any) { toast.error(err.message); }
    setSaving(false);
  };

  if (loading) return <div className="p-4 text-center text-muted-foreground text-sm py-8">Loading...</div>;

  return (
    <div className="animate-fade-in w-full max-w-2xl mx-auto overflow-x-hidden overflow-y-auto pb-8 px-3 sm:px-4 pt-4" style={{ maxWidth: '100vw' }}>
      <div className="flex items-center gap-2 mb-4">
        <button onClick={() => navigate("/admin/exams")} className="p-2 hover:bg-accent rounded-lg">
          <ArrowLeft className="h-4 w-4 text-muted-foreground" />
        </button>
        <h2 className="text-lg font-semibold text-foreground flex items-center gap-2">
          <FileText className="h-5 w-5" /> {existingExam ? "Edit Exam" : "Create New Exam"}
        </h2>
      </div>

      <div className="space-y-4">
        {/* Basic Info */}
        <FormSection icon={FileText} title="Basic Information" step={1}>
          <div>
            <label className="text-xs font-medium text-muted-foreground">Exam Title *</label>
            <input value={title} onChange={e => setTitle(e.target.value)} placeholder="Enter exam title" className={inputClass + " mt-1"} />
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground">Course *</label>
            <select value={courseId} onChange={e => setCourseId(e.target.value)} className={inputClass + " mt-1"}>
              <option value="">Select Course</option>
              {courses.map(c => <option key={c.id} value={c.id}>{c.courseName}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground">Duration (minutes)</label>
            <input type="number" value={duration} onChange={e => setDuration(Number(e.target.value))} className={inputClass + " mt-1"} />
          </div>
        </FormSection>

        {/* Marks */}
        <FormSection icon={FileText} title="Marks Settings" step={2}>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-muted-foreground">Pass Mark</label>
              <input type="number" value={passMark} onChange={e => setPassMark(Number(e.target.value))} placeholder="0" className={inputClass + " mt-1"} />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground">Negative Mark</label>
              <input type="number" step="0.25" value={negativeMark} onChange={e => setNegativeMark(Number(e.target.value))} placeholder="0" className={inputClass + " mt-1"} />
            </div>
          </div>
        </FormSection>

        {/* Schedule */}
        <FormSection icon={FileText} title="Schedule" step={3}>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-muted-foreground">Start Time *</label>
              <input type="datetime-local" value={startTime} onChange={e => setStartTime(e.target.value)} className={inputClass + " mt-1"} />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground">End Time *</label>
              <input type="datetime-local" value={endTime} onChange={e => setEndTime(e.target.value)} className={inputClass + " mt-1"} />
            </div>
          </div>
        </FormSection>

        {/* Questions */}
        <FormSection icon={FileText} title={`Questions (${questions.length})`} step={4}>
          {/* Bulk import */}
          <div className="rounded-xl border border-dashed border-primary/30 bg-gradient-to-br from-primary/5 to-accent/30 overflow-hidden">
            {/* Header */}
            <div className="flex items-center gap-2 px-4 py-2.5 border-b border-primary/10 bg-primary/5">
              <div className="w-5 h-5 rounded-full bg-primary/15 flex items-center justify-center">
                <Upload className="h-3 w-3 text-primary" />
              </div>
              <span className="text-xs font-semibold text-primary uppercase tracking-wide">Bulk Import via JSON</span>
            </div>
            <div className="p-4 space-y-3">
              {/* Info card */}
              <div className="flex items-start gap-2.5 bg-background/60 rounded-lg p-3 border border-border/50">
                <FileText className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
                <div className="space-y-1">
                  <p className="text-xs font-medium text-foreground">কোশ্চেন টেমপ্লেট ডাউনলোড করে <span className="text-primary font-semibold">Claude AI</span> দিয়ে বাল্ক কোশ্চেন বানিয়ে নিন ও এখানে ইমপোর্ট করুন।</p>
                </div>
              </div>
              {/* Side-by-side action buttons */}
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={downloadTemplate}
                  className="flex items-center justify-center gap-2 px-3 py-2.5 bg-card border border-border rounded-xl text-xs font-semibold text-foreground hover:bg-accent hover:border-primary/40 transition-all group shadow-sm"
                >
                  <div className="w-6 h-6 rounded-md bg-primary/10 flex items-center justify-center group-hover:bg-primary/20 transition-colors shrink-0">
                    <Download className="h-3.5 w-3.5 text-primary" />
                  </div>
                  <span>Download Template</span>
                </button>
                <button
                  onClick={() => fileRef.current?.click()}
                  className="flex items-center justify-center gap-2 px-3 py-2.5 bg-primary text-primary-foreground rounded-xl text-xs font-semibold hover:bg-primary/90 transition-all shadow-sm active:scale-[0.98]"
                >
                  <div className="w-6 h-6 rounded-md bg-white/20 flex items-center justify-center shrink-0">
                    <Upload className="h-3.5 w-3.5" />
                  </div>
                  <span>Import Questions</span>
                </button>
              </div>
              <input ref={fileRef} type="file" accept=".json" onChange={handleBulkUpload} className="hidden" />
            </div>
          </div>

          {/* Questions list */}
          <div className="space-y-3">
            {questions.map((q, qIdx) => (
              <QuestionEditor
                key={q.id}
                question={q}
                index={qIdx}
                onUpdate={(u) => updateQuestion(qIdx, u)}
                onRemove={() => removeQuestion(qIdx)}
                onUpdateOption={(oIdx, text) => updateOption(qIdx, oIdx, text)}
                onUpdateOptionImage={(oIdx, img) => updateOptionImage(qIdx, oIdx, img)}
                onAddOption={() => addOption(qIdx)}
                onRemoveOption={(oIdx) => removeOption(qIdx, oIdx)}
              />
            ))}
          </div>

          <div className="flex gap-2">
            <button onClick={addMCQQuestion} className="flex-1 flex items-center gap-1.5 px-4 py-2.5 bg-accent border border-dashed border-border rounded-xl text-sm font-medium text-foreground justify-center hover:bg-accent/80 transition-colors">
              <Plus className="h-4 w-4" /> MCQ Question
            </button>
            <button onClick={addWrittenQuestion} className="flex-1 flex items-center gap-1.5 px-4 py-2.5 bg-accent border border-dashed border-border rounded-xl text-sm font-medium text-foreground justify-center hover:bg-accent/80 transition-colors">
              <Plus className="h-4 w-4" /> Written Question
            </button>
          </div>
        </FormSection>

        {/* Summary */}
        <div className="bg-accent/30 border border-border rounded-xl p-3">
          <p className="text-xs text-muted-foreground">
            Total: <span className="text-foreground font-medium">{questions.length} Q</span> •
            MCQ: <span className="text-foreground font-medium">{questions.filter(q => q.type === "mcq").length}</span> •
            Written: <span className="text-foreground font-medium">{questions.filter(q => q.type === "written").length}</span> •
            Marks: <span className="text-foreground font-medium">{questions.reduce((s, q) => s + q.marks, 0)}</span> •
            Pass: <span className="text-foreground font-medium">{passMark}</span>
          </p>
        </div>

        <button onClick={handleSave} disabled={saving} className={`w-full py-3 rounded-xl font-semibold text-sm disabled:opacity-50 transition-all active:scale-[0.98] shadow-sm flex items-center justify-center gap-2 ${
          success ? "bg-success text-white" : "bg-primary text-primary-foreground"
        }`}>
          {success ? <><CheckCircle className="h-4 w-4" /> Saved!</> :
           saving ? "Saving..." : existingExam ? "Update Exam" : "Create Exam"}
        </button>
      </div>
    </div>
  );
}

/* ── Question Editor ── */
function QuestionEditor({ question, index, onUpdate, onRemove, onUpdateOption, onUpdateOptionImage, onAddOption, onRemoveOption }: {
  question: ExamQuestion; index: number;
  onUpdate: (u: Partial<ExamQuestion>) => void; onRemove: () => void;
  onUpdateOption: (oIdx: number, text: string) => void;
  onUpdateOptionImage: (oIdx: number, img: string) => void;
  onAddOption: () => void; onRemoveOption: (oIdx: number) => void;
}) {
  const [collapsed, setCollapsed] = useState(false);
  const isMcq = question.type === "mcq";

  return (
    <div className="bg-card border border-border rounded-xl overflow-hidden shadow-sm">
      {/* Header bar with serial, type, marks */}
      <div className="flex items-center gap-2 px-3 py-2 bg-accent/40 border-b border-border">
        <button onClick={() => setCollapsed(!collapsed)} className="shrink-0">
          {collapsed ? <ChevronDown className="h-4 w-4 text-muted-foreground" /> : <ChevronUp className="h-4 w-4 text-muted-foreground" />}
        </button>
        <span className="w-7 h-7 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xs font-bold shrink-0">{index + 1}</span>
        <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold shrink-0 ${isMcq ? "bg-primary/10 text-primary" : "bg-accent text-muted-foreground border border-border"}`}>
          {isMcq ? "MCQ" : "Written"}
        </span>
        <div className="flex-1" />
        <div className="flex items-center gap-1 shrink-0">
          <span className="text-[10px] text-muted-foreground">Marks</span>
          <input type="number" value={question.marks} onChange={e => onUpdate({ marks: Number(e.target.value) })}
            className="w-12 px-1.5 py-1 rounded-md bg-background border border-border text-foreground text-xs text-center focus:outline-none focus:ring-1 focus:ring-primary/30" />
        </div>
        <button onClick={onRemove} className="p-1 hover:bg-destructive/10 rounded-lg shrink-0"><Trash2 className="h-3.5 w-3.5 text-destructive" /></button>
      </div>

      {!collapsed && (
        <div className="p-3 space-y-2.5">
          <textarea value={question.questionText} onChange={e => onUpdate({ questionText: e.target.value })} placeholder="Enter question text" rows={2} className="w-full px-3 py-2 rounded-lg bg-background border border-border text-foreground text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-all" />
          
          {isMcq && (
            <>
              <ImageUrlField value={question.questionImage || ""} onChange={(v) => onUpdate({ questionImage: v })} placeholder="Question image URL (optional)" />
              {question.questionImage && <img src={question.questionImage} alt="" className="h-20 rounded-lg object-contain" />}
            </>
          )}

          {isMcq && question.options && (
            <div className="space-y-2 mt-1">
              <p className="text-xs text-muted-foreground font-medium">Options (select correct):</p>
              {question.options.map((opt, oIdx) => (
                <div
                  key={oIdx}
                  onClick={() => onUpdate({ correctAnswer: oIdx })}
                  className={`flex items-start gap-2 rounded-lg px-2 py-1 cursor-pointer transition-all border ${
                    question.correctAnswer === oIdx
                      ? "bg-green-500/15 dark:bg-green-500/20 border-green-500/50 dark:border-green-400/60"
                      : "border-transparent hover:bg-accent/60"
                  }`}
                >
                  <div className={`mt-2.5 shrink-0 w-4 h-4 rounded-full border-2 flex items-center justify-center transition-all ${
                    question.correctAnswer === oIdx
                      ? "border-green-500 dark:border-green-400 bg-green-500 dark:bg-green-400"
                      : "border-muted-foreground/40 bg-background"
                  }`}>
                    {question.correctAnswer === oIdx && (
                      <div className="w-1.5 h-1.5 rounded-full bg-white" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0 space-y-1">
                    <input value={opt.text} onChange={e => { e.stopPropagation(); onUpdateOption(oIdx, e.target.value); }} onClick={e => e.stopPropagation()} placeholder={`Option ${oIdx + 1}`} className={`w-full px-3 py-1.5 rounded-lg bg-background border text-foreground text-sm focus:outline-none focus:ring-2 transition-all ${
                      question.correctAnswer === oIdx
                        ? "border-green-500/40 dark:border-green-400/40 focus:ring-green-500/20 focus:border-green-500/60"
                        : "border-border focus:ring-primary/30 focus:border-primary"
                    }`} />
                    <ImageUrlField value={opt.image || ""} onChange={(v) => onUpdateOptionImage(oIdx, v)} placeholder="Option image URL" small />
                    {opt.image && <img src={opt.image} alt="" className="h-12 rounded-lg object-contain" />}
                  </div>
                  {question.options!.length > 2 && (
                    <button onClick={() => onRemoveOption(oIdx)} className="p-1 mt-1 hover:bg-accent rounded-lg shrink-0"><X className="h-3 w-3 text-muted-foreground" /></button>
                  )}
                </div>
              ))}
              <button onClick={onAddOption} className="text-xs text-primary hover:underline ml-5">+ Add Option</button>
            </div>
          )}

          {!isMcq && (
            <div className="space-y-2 mt-1">
              <ImageUrlField value={question.questionImage || ""} onChange={(v) => onUpdate({ questionImage: v })} placeholder="Question image URL (optional)" />
              {question.questionImage && <img src={question.questionImage} alt="" className="h-20 rounded-lg object-contain" />}
              {/* Answer Image — always visible, with gap */}
              <div className="pt-2 border-t border-border/50" />
              {/* Answer Image */}
              <div className="space-y-1.5">
                <div className="flex items-center gap-1.5">
                  <CheckCircle className="h-3.5 w-3.5 text-green-500 shrink-0" />
                  <span className="text-[11px] font-medium text-muted-foreground">Answer Image</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <input
                    value={question.writtenAnswer || ""}
                    onChange={e => onUpdate({ writtenAnswer: e.target.value })}
                    placeholder="সঠিক উত্তরের ইমেজ URL দিন"
                    className="flex-1 min-w-0 px-3 py-2 rounded-lg bg-background border border-green-400/40 text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-green-500/20 focus:border-green-500/60 transition-all placeholder:text-muted-foreground/50"
                  />
                  {question.writtenAnswer && (
                    <button type="button" onClick={() => onUpdate({ writtenAnswer: "" })} className="p-1.5 hover:bg-destructive/10 text-destructive/50 hover:text-destructive rounded-lg transition-colors shrink-0">
                      <X className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
                <a href="https://postimages.org" target="_blank" rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800/50 text-green-700 dark:text-green-400 hover:bg-green-100 dark:hover:bg-green-900/40 transition-colors"
                >
                  <ExternalLink className="h-3 w-3" /> Get URL
                </a>
                {question.writtenAnswer?.startsWith("http") && (
                  <div className="relative mt-0.5">
                    <img src={question.writtenAnswer} alt="Answer preview" className="h-20 rounded-lg object-contain border border-green-300/50 dark:border-green-800/40" />
                    <span className="absolute top-1 left-1 text-[9px] font-bold bg-green-500 text-white px-1.5 py-0.5 rounded-full">Answer</span>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/* ── Image URL Field with toggle (MCQ / options) ── */
function ImageUrlField({ value, onChange, placeholder, small }: {
  value: string; onChange: (v: string) => void; placeholder: string; small?: boolean;
}) {
  const [open, setOpen] = useState(!!value);

  if (!open && !value) {
    return (
      <button type="button" onClick={() => setOpen(true)} className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors">
        <Image className={`${small ? "h-3 w-3" : "h-3.5 w-3.5"}`} />
        <span>Add Image</span>
      </button>
    );
  }

  return (
    <div className="space-y-1">
      <div className="flex items-center gap-1.5">
        <Image className={`${small ? "h-3 w-3" : "h-3.5 w-3.5"} text-muted-foreground shrink-0`} />
        <input value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder}
          className={`flex-1 min-w-0 px-3 ${small ? "py-1" : "py-1.5"} rounded-lg bg-background border border-border text-foreground ${small ? "text-xs" : "text-sm"} focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-all`}
        />
        <button type="button" onClick={() => { onChange(""); setOpen(false); }} className="p-1 hover:bg-destructive/10 text-destructive/60 hover:text-destructive rounded-lg transition-colors shrink-0">
          <X className="h-3 w-3" />
        </button>
      </div>
      <a href="https://postimages.org" target="_blank" rel="noopener noreferrer"
        className={`inline-flex items-center gap-1 px-2.5 ${small ? "py-1" : "py-1.5"} ml-5 bg-accent border border-border rounded-lg ${small ? "text-[10px]" : "text-xs"} font-medium text-primary hover:bg-primary/10 hover:border-primary/30 transition-colors`}
      >
        <ExternalLink className={`${small ? "h-2.5 w-2.5" : "h-3 w-3"}`} /> Get URL
      </a>
    </div>
  );
}

/* ── Written Image Field (toggle, same UX as MCQ ImageUrlField) ── */
function WrittenImageField({ label, labelIcon, value, onChange, placeholder }: {
  label: string; labelIcon: "question" | "answer";
  value: string; onChange: (v: string) => void; placeholder: string;
}) {
  const [open, setOpen] = useState(!!value);
  const isAnswer = labelIcon === "answer";

  if (!open && !value) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
      >
        {isAnswer
          ? <CheckCircle className="h-3.5 w-3.5 text-green-500/70" />
          : <Image className="h-3.5 w-3.5" />}
        <span>Add {label}</span>
      </button>
    );
  }

  return (
    <div className="space-y-1.5">
      <div className="flex items-center gap-1.5">
        {isAnswer
          ? <CheckCircle className="h-3.5 w-3.5 text-green-500 shrink-0" />
          : <Image className="h-3.5 w-3.5 text-muted-foreground shrink-0" />}
        <span className="text-[11px] font-medium text-muted-foreground">{label}</span>
      </div>
      <div className="flex items-center gap-1.5">
        <input
          value={value}
          onChange={e => onChange(e.target.value)}
          placeholder={placeholder}
          className={`flex-1 min-w-0 px-3 py-2 rounded-lg bg-background border text-foreground text-sm focus:outline-none focus:ring-2 transition-all placeholder:text-muted-foreground/50 ${
            isAnswer
              ? "border-green-400/40 focus:ring-green-500/20 focus:border-green-500/60"
              : "border-border focus:ring-primary/30 focus:border-primary"
          }`}
        />
        <button
          type="button"
          onClick={() => { onChange(""); setOpen(false); }}
          className="p-1.5 hover:bg-destructive/10 text-destructive/50 hover:text-destructive rounded-lg transition-colors shrink-0"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
      <a
        href="https://postimages.org"
        target="_blank"
        rel="noopener noreferrer"
        className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
          isAnswer
            ? "bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800/50 text-green-700 dark:text-green-400 hover:bg-green-100 dark:hover:bg-green-900/40"
            : "bg-accent border border-border text-primary hover:bg-primary/10 hover:border-primary/30"
        }`}
      >
        <ExternalLink className="h-3 w-3" /> Get URL
      </a>
      {value?.startsWith("http") && (
        <div className="relative mt-0.5">
          <img src={value} alt={`${label} preview`} className={`h-20 rounded-lg object-contain border ${isAnswer ? "border-green-300/50 dark:border-green-800/40" : "border-border"}`} />
          {isAnswer && <span className="absolute top-1 left-1 text-[9px] font-bold bg-green-500 text-white px-1.5 py-0.5 rounded-full">Answer</span>}
        </div>
      )}
    </div>
  );
}
