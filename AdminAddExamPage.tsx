import { useState, useEffect, useCallback, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { doc, getDoc, addDoc, collection, getDocs, query, where, setDoc, Timestamp } from "firebase/firestore";
import { examDb } from "@/lib/examFirebase";
import { useAuth } from "@/contexts/AuthContext";
import { Exam, ExamAnswer, ExamSubmission } from "@/types/exam";
import { uploadToImgBB } from "@/lib/imgbb";
import { toast } from "sonner";
import {
  Camera, Clock, ChevronLeft, ChevronRight, Send, Trophy, CheckCircle, XCircle,
  ArrowLeft, Award, TrendingDown, Shield, AlertTriangle, Monitor, Maximize, ZoomIn,
  BookOpen, FileText, Users, Timer, Star, MinusCircle,
} from "lucide-react";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useExamSecurity, getDeviceInfo } from "@/hooks/useExamSecurity";
import { ImagePreviewDialog } from "@/components/ImagePreviewDialog";

export default function ExamTakePage() {
  const { examId } = useParams<{ examId: string }>();
  const { user, userDoc } = useAuth();
  const navigate = useNavigate();
  const [exam, setExam] = useState<Exam | null>(null);
  const [loading, setLoading] = useState(true);
  const [answers, setAnswers] = useState<Record<string, ExamAnswer>>({});
  const [currentQ, setCurrentQ] = useState(0);
  const [timeLeft, setTimeLeft] = useState(0);
  const [started, setStarted] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<ExamSubmission | null>(null);
  const [existingSubmission, setExistingSubmission] = useState<ExamSubmission | null>(null);
  const [showConfirm, setShowConfirm] = useState(false);
  const [showExitConfirm, setShowExitConfirm] = useState(false);
  const [myRank, setMyRank] = useState<number | null>(null);
  const [totalParticipants, setTotalParticipants] = useState(0);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [isUploadingWrittenState, setIsUploadingWrittenState] = useState(false);
  const [rulesAccepted, setRulesAccepted] = useState(false);
  const [examEntered, setExamEntered] = useState(false);
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const cameraRef = useRef<HTMLInputElement>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const submittedRef = useRef(false);

  const isWrittenOnlyExam = exam ? exam.questions.every(q => q.type === "written") : false;
  const hasMcqQuestions = exam ? exam.questions.some(q => q.type === "mcq") : false;

  const handleSuspiciousAutoSubmit = useCallback(() => {
    if (submittedRef.current) return;
    toast.error("⚠️ ট্যাব সুইচের কারণে পরীক্ষা অটো-সাবমিট হচ্ছে!");
    handleSubmitInternal();
  }, []);

  const handleFullscreenExitConfirm = useCallback(() => {
    if (submittedRef.current || isUploadingWrittenState) return;
    setShowExitConfirm(true);
  }, [isUploadingWrittenState]);

  const isCurrentQuestionWritten = exam?.questions?.[currentQ]?.type === "written";

  const { requestFullscreen, exitFullscreen, isFullscreen } = useExamSecurity({
    enabled: started && !submitted && hasMcqQuestions,
    onSuspiciousActivity: handleSuspiciousAutoSubmit,
    onFullscreenExit: handleFullscreenExitConfirm,
    maxTabSwitches: 2,
    isUploadingWritten: isUploadingWrittenState,
    isWrittenExam: isWrittenOnlyExam,
  });

  useEffect(() => {
    const checkEntry = async () => {
      if (!examId || !user) return;
      const entryDoc = await getDoc(doc(examDb, "examEntries", `${examId}_${user.uid}`));
      if (entryDoc.exists()) setExamEntered(true);
    };
    checkEntry();
  }, [examId, user]);

  useEffect(() => {
    const fetchExam = async () => {
      if (!examId) return;
      const snap = await getDoc(doc(examDb, "exams", examId));
      if (snap.exists()) setExam({ id: snap.id, ...snap.data() } as Exam);
      if (user) {
        const subSnap = await getDocs(query(collection(examDb, "submissions"), where("examId", "==", examId), where("userId", "==", user.uid)));
        if (!subSnap.empty) {
          const sub = { id: subSnap.docs[0].id, ...subSnap.docs[0].data() } as ExamSubmission;
          setExistingSubmission(sub);
          setResult(sub);
          setSubmitted(true);
          submittedRef.current = true;
        }
      }
      setLoading(false);
    };
    fetchExam();
  }, [examId, user]);

  useEffect(() => {
    if (!started || submitted || timeLeft <= 0) return;
    timerRef.current = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) {
          clearInterval(timerRef.current!);
          handleSubmitInternal();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [started, submitted]);

  useEffect(() => {
    return () => {
      if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
    };
  }, []);

  const loadMyRanking = async () => {
    if (!exam || !user) return;
    const snap = await getDocs(query(collection(examDb, "submissions"), where("examId", "==", exam.id)));
    const subs = snap.docs
      .map(d => ({ id: d.id, ...d.data() } as ExamSubmission))
      .sort((a, b) => b.obtainedMarks - a.obtainedMarks);
    setTotalParticipants(subs.length);
    const rank = subs.findIndex(s => s.userId === user.uid);
    setMyRank(rank >= 0 ? rank + 1 : null);
  };

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
  };

  const now = Date.now();
  const examStarted = exam ? (exam.startTime?.toMillis?.() || 0) <= now : false;
  const examEnded = exam ? (exam.endTime?.toMillis?.() || 0) < now : false;

  const startExam = async () => {
    if (!exam || !user) return;
    try {
      await setDoc(doc(examDb, "examEntries", `${exam.id}_${user.uid}`), {
        examId: exam.id,
        userId: user.uid,
        enteredAt: Timestamp.now(),
      });
      setExamEntered(true);
    } catch (err) {
      console.error("Failed to record exam entry:", err);
    }
    setTimeLeft(exam.duration * 60);
    setStarted(true);
    if (hasMcqQuestions) requestFullscreen();
    const initial: Record<string, ExamAnswer> = {};
    exam.questions.forEach(q => {
      initial[q.id] = { questionId: q.id, marks: q.marks };
    });
    setAnswers(initial);
  };

  const selectOption = (questionId: string, optionIdx: number) => {
    setAnswers(prev => ({
      ...prev,
      [questionId]: { ...prev[questionId], selectedOption: optionIdx },
    }));
  };

  const handleCameraCapture = async (questionId: string, e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingImage(true);
    setIsUploadingWrittenState(true);
    try {
      const url = await uploadToImgBB(file);
      setAnswers(prev => ({
        ...prev,
        [questionId]: { ...prev[questionId], writtenImageUrl: url },
      }));
      toast.success("ছবি আপলোড হয়েছে");
    } catch {
      toast.error("আপলোড ব্যর্থ হয়েছে");
    }
    setUploadingImage(false);
    setIsUploadingWrittenState(false);
    if (hasMcqQuestions) {
      setTimeout(() => requestFullscreen(), 500);
    }
  };

  const handleSubmitInternal = useCallback(async () => {
    if (!exam || !user || !userDoc || submitting || submittedRef.current) return;
    submittedRef.current = true;
    setSubmitting(true);

    const negativeMark = exam.negativeMark || 0;
    const deviceInfo = getDeviceInfo();

    const answersList: ExamAnswer[] = exam.questions.map(q => {
      const ans = answers[q.id] || { questionId: q.id, marks: q.marks };
      if (q.type === "mcq") {
        const isCorrect = ans.selectedOption === q.correctAnswer;
        return { ...ans, isCorrect, marks: q.marks };
      }
      return ans;
    });

    const correctCount = answersList.filter(a => a.isCorrect).length;
    const wrongCount = answersList.filter(a => a.selectedOption !== undefined && !a.isCorrect).length;
    const correctMarks = answersList.filter(a => a.isCorrect).reduce((s, a) => s + a.marks, 0);
    const negativeTotal = wrongCount * negativeMark;
    const obtainedMarks = Math.max(0, correctMarks - negativeTotal);
    const passed = obtainedMarks >= (exam.passMark || 0);

    const submission: Omit<ExamSubmission, "id"> = {
      examId: exam.id,
      userId: user.uid,
      userName: userDoc.name,
      userEmail: userDoc.email,
      courseId: exam.courseId,
      answers: answersList,
      totalMarks: exam.totalMarks,
      obtainedMarks,
      correctCount,
      wrongCount,
      submittedAt: Timestamp.now(),
      passed,
      deviceInfo: deviceInfo as any,
    };

    try {
      const docRef = await addDoc(collection(examDb, "submissions"), submission);
      const resultSub = { id: docRef.id, ...submission } as ExamSubmission;
      setResult(resultSub);
      setSubmitted(true);
      setStarted(false);
      exitFullscreen();
      if (timerRef.current) clearInterval(timerRef.current);
      toast.success("পরীক্ষা সাবমিট হয়েছে!");
    } catch (err: any) {
      toast.error(err.message);
      submittedRef.current = false;
    }
    setSubmitting(false);
  }, [exam, user, userDoc, answers, submitting, exitFullscreen]);

  const handleSubmit = handleSubmitInternal;

  if (loading) return <div className="p-4 text-center text-muted-foreground text-sm py-8">Loading...</div>;
  if (!exam) return <div className="p-4 text-center text-muted-foreground text-sm py-8">Exam not found</div>;

  if (examEntered && !existingSubmission && !started && !submitted) {
    const canReEnter = examStarted && !examEnded;
    if (!canReEnter) {
      return (
        <div className="p-4 max-w-lg mx-auto animate-fade-in">
          <button onClick={() => navigate("/exams")} className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-4">
            <ArrowLeft className="h-4 w-4" /> Back to Exams
          </button>
          <div className="bg-card border border-border rounded-xl p-6 text-center">
            <AlertTriangle className="h-10 w-10 text-destructive mx-auto mb-3" />
            <h2 className="text-lg font-semibold text-foreground mb-2">পরীক্ষায় পুনরায় প্রবেশ করা যাবে না</h2>
            <p className="text-sm text-muted-foreground">আপনি এই পরীক্ষায় আগে প্রবেশ করেছিলেন কিন্তু সাবমিট করেননি। পরীক্ষার সময় শেষ হয়ে গেছে।</p>
          </div>
        </div>
      );
    }
  }

  // ─── Result View ────────────────────────────────────────────────────────────
  if (submitted && result) {
    const passed = result.obtainedMarks >= (exam.passMark || 0);
    const negativeTotal = (result.wrongCount || 0) * (exam.negativeMark || 0);
    const scorePercent = Math.round((result.obtainedMarks / result.totalMarks) * 100);

    return (
      <div className="p-4 max-w-2xl mx-auto animate-fade-in">
        <button onClick={() => navigate("/exams")} className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-4">
          <ArrowLeft className="h-4 w-4" /> Back to Exams
        </button>

        {/* Result Card */}
        <div className="bg-card border border-border rounded-2xl overflow-hidden shadow-sm">
          {/* Top gradient strip based on pass/fail */}
          <div className={`h-2 w-full ${passed ? "bg-gradient-to-r from-green-400 to-emerald-500" : "bg-gradient-to-r from-red-400 to-rose-500"}`} />

          <div className="p-6 text-center">
            {/* Exam title */}
            <h2 className="text-base font-semibold text-foreground">{exam.title}</h2>
            <p className="text-xs text-muted-foreground mt-0.5 mb-5">Your Result</p>

            {/* Big score */}
            <div className="text-5xl font-bold tracking-tight text-foreground">
              {result.obtainedMarks}
              <span className="text-2xl font-normal text-muted-foreground">/{result.totalMarks}</span>
            </div>
            <p className="text-sm text-muted-foreground mt-1">{scorePercent}% scored</p>

            {/* Pass / Fail badge */}
            <div className="mt-4">
              <span className={`inline-flex items-center gap-1.5 px-5 py-1.5 rounded-full text-sm font-semibold ${passed
                ? "bg-green-500/10 text-green-600 dark:text-green-400 ring-1 ring-green-500/20"
                : "bg-red-500/10 text-red-600 dark:text-red-400 ring-1 ring-red-500/20"
              }`}>
                {passed
                  ? <><Award className="h-4 w-4" /> উত্তীর্ণ (Passed)</>
                  : <><TrendingDown className="h-4 w-4" /> অনুত্তীর্ণ (Failed)</>
                }
              </span>
            </div>

            {/* Stats grid — 3 columns */}
            <div className="grid grid-cols-3 gap-3 mt-6">
              <div className="bg-green-500/8 border border-green-500/20 rounded-xl p-3">
                <CheckCircle className="h-5 w-5 text-green-600 dark:text-green-400 mx-auto mb-1" />
                <p className="text-xl font-bold text-green-700 dark:text-green-400">{result.correctCount}</p>
                <p className="text-xs text-muted-foreground">সঠিক</p>
              </div>
              <div className="bg-red-500/8 border border-red-500/20 rounded-xl p-3">
                <XCircle className="h-5 w-5 text-destructive mx-auto mb-1" />
                <p className="text-xl font-bold text-destructive">{result.wrongCount}</p>
                <p className="text-xs text-muted-foreground">ভুল</p>
              </div>
              <div className="bg-primary/8 border border-primary/20 rounded-xl p-3">
                <Star className="h-5 w-5 text-primary mx-auto mb-1" />
                <p className="text-xl font-bold text-primary">{exam.passMark || "—"}</p>
                <p className="text-xs text-muted-foreground">পাস নম্বর</p>
              </div>
            </div>

            {/* Secondary info row */}
            {((exam.negativeMark || 0) > 0 && negativeTotal > 0) || (result.writtenMarks !== undefined && result.writtenMarks > 0) ? (
              <div className="flex items-center justify-center gap-4 mt-4 flex-wrap">
                {(exam.negativeMark || 0) > 0 && negativeTotal > 0 && (
                  <div className="flex items-center gap-1.5 text-sm">
                    <MinusCircle className="h-4 w-4 text-destructive" />
                    <span className="text-muted-foreground">নেগেটিভ:</span>
                    <span className="font-semibold text-destructive">-{negativeTotal}</span>
                  </div>
                )}
                {result.writtenMarks !== undefined && result.writtenMarks > 0 && (
                  <div className="flex items-center gap-1.5 text-sm">
                    <FileText className="h-4 w-4 text-primary" />
                    <span className="text-muted-foreground">লিখিত:</span>
                    <span className="font-semibold text-foreground">
                      {result.writtenMarks}
                      {!result.writtenGraded && <span className="text-xs text-muted-foreground ml-1">(মূল্যায়ন বাকি)</span>}
                    </span>
                  </div>
                )}
              </div>
            ) : null}
          </div>
        </div>

        {/* Own Ranking Section */}
        {examEnded && exam.resultPublished && (
          <div className="mt-4">
            {myRank === null ? (
              <button
                onClick={loadMyRanking}
                className="w-full py-3 bg-primary text-primary-foreground rounded-xl text-sm font-medium flex items-center justify-center gap-2 hover:bg-primary/90 transition-colors"
              >
                <Trophy className="h-4 w-4" /> আমার র‍্যাংকিং দেখুন
              </button>
            ) : (
              <div className="bg-card border border-border rounded-2xl overflow-hidden shadow-sm">
                {/* Trophy card header */}
                <div className="flex items-center gap-3 px-4 py-3 border-b border-border bg-accent/30">
                  <div className="h-8 w-8 rounded-full bg-yellow-500/15 flex items-center justify-center">
                    <Trophy className="h-4 w-4 text-yellow-500" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-foreground">র‍্যাংকিং</p>
                    <p className="text-xs text-muted-foreground">এই পরীক্ষায় আপনার অবস্থান</p>
                  </div>
                </div>
                <div className="p-5 text-center">
                  <p className="text-6xl font-extrabold tracking-tight text-foreground">
                    #{myRank}
                  </p>
                  <div className="flex items-center justify-center gap-1.5 mt-2">
                    <Users className="h-3.5 w-3.5 text-muted-foreground" />
                    <p className="text-sm text-muted-foreground">
                      মোট <span className="font-semibold text-foreground">{totalParticipants}</span> জন অংশগ্রহণকারীর মধ্যে
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {examEnded && !exam.resultPublished && (
          <div className="mt-4 bg-accent/50 border border-border rounded-xl p-4 text-center">
            <Clock className="h-6 w-6 text-muted-foreground mx-auto mb-2" />
            <p className="text-sm text-muted-foreground">রেজাল্ট এখনো প্রকাশিত হয়নি। অ্যাডমিন প্রকাশ করলে দেখতে পাবেন।</p>
          </div>
        )}

        {/* Answer Review */}
        <div className="mt-6 space-y-3">
          <h3 className="font-semibold text-foreground">উত্তরপত্র পর্যালোচনা</h3>
          {exam.questions.map((q, idx) => {
            const ans = result.answers.find(a => a.questionId === q.id);
            return (
              <div key={q.id} className="bg-card border border-border rounded-xl p-3">
                <p className="text-sm font-medium text-foreground">
                  Q{idx + 1}. {q.questionText}{" "}
                  <span className="text-xs text-muted-foreground">({q.type === "mcq" ? "MCQ" : "Written"})</span>
                </p>
                {q.questionImage && (
                  <img
                    src={q.questionImage}
                    alt=""
                    className="h-24 rounded-lg object-contain mt-2 cursor-pointer hover:opacity-80 transition-opacity"
                    onClick={() => setPreviewImage(q.questionImage!)}
                  />
                )}
                {q.type === "mcq" && q.options && (
                  <div className="mt-2 space-y-1">
                    {q.options.map((opt, oIdx) => {
                      const isCorrect = oIdx === q.correctAnswer;
                      const isSelected = ans?.selectedOption === oIdx;
                      let bg = "bg-card";
                      if (isCorrect) bg = "bg-green-500/10";
                      if (isSelected && !isCorrect) bg = "bg-red-500/10";
                      return (
                        <div key={oIdx} className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm ${bg}`}>
                          {isCorrect && <CheckCircle className="h-3.5 w-3.5 text-green-600 dark:text-green-400 shrink-0" />}
                          {isSelected && !isCorrect && <XCircle className="h-3.5 w-3.5 text-destructive shrink-0" />}
                          {!isCorrect && !isSelected && <span className="w-3.5" />}
                          <span className="text-foreground">{opt.text}</span>
                          {opt.image && <img src={opt.image} alt="" className="h-8 rounded object-contain ml-auto" />}
                        </div>
                      );
                    })}
                  </div>
                )}
                {q.type === "written" && ans?.writtenImageUrl && (
                  <div className="mt-2">
                    <p className="text-xs text-muted-foreground mb-1">Your answer:</p>
                    <div className="relative inline-block group cursor-pointer" onClick={() => setPreviewImage(ans.writtenImageUrl!)}>
                      <img src={ans.writtenImageUrl} alt="Answer" className="h-32 rounded-lg object-contain" />
                      <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity rounded-lg flex items-center justify-center">
                        <ZoomIn className="h-6 w-6 text-white" />
                      </div>
                    </div>
                    {ans.writtenMarksAwarded !== undefined && (
                      <p className="text-xs mt-1 text-foreground font-medium">Marks: {ans.writtenMarksAwarded}/{q.marks}</p>
                    )}
                  </div>
                )}
                {q.type === "written" && !ans?.writtenImageUrl && (
                  <p className="text-xs text-muted-foreground italic mt-2">No answer submitted</p>
                )}
                {q.type === "written" && q.writtenAnswer && (
                  <div className="mt-2 p-2 bg-green-500/10 rounded-lg">
                    <p className="text-xs text-muted-foreground mb-1">Correct Answer:</p>
                    {q.writtenAnswer.startsWith("http") ? (
                      <div className="relative inline-block group cursor-pointer" onClick={() => setPreviewImage(q.writtenAnswer!)}>
                        <img src={q.writtenAnswer} alt="Answer" className="h-32 rounded-lg object-contain" />
                        <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity rounded-lg flex items-center justify-center">
                          <ZoomIn className="h-6 w-6 text-white" />
                        </div>
                      </div>
                    ) : (
                      <p className="text-sm text-foreground">{q.writtenAnswer}</p>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        <ImagePreviewDialog src={previewImage} onClose={() => setPreviewImage(null)} />
      </div>
    );
  }

  // ─── Pre-start View ─────────────────────────────────────────────────────────
  if (!started) {
    const mcqCount = exam.questions.filter(q => q.type === "mcq").length;
    const writtenCount = exam.questions.filter(q => q.type === "written").length;
    const examTypeLabel =
      mcqCount > 0 && writtenCount > 0 ? "MCQ + Written" :
      mcqCount > 0 ? "MCQ" : "Written";

    const rules: { icon: React.ReactNode; text: React.ReactNode; variant: "primary" | "danger" }[] = [
      ...(hasMcqQuestions ? [
        {
          icon: <Maximize className="h-3.5 w-3.5" />,
          text: <>পরীক্ষা <strong>ফুলস্ক্রিন মোডে</strong> চলবে। বের হতে চাইলে অবশ্যই <strong>সাবমিট</strong> করতে হবে।</>,
          variant: "primary" as const,
        },
        {
          icon: <AlertTriangle className="h-3.5 w-3.5" />,
          text: <><strong>২ বার ট্যাব সুইচ</strong> করলে পরীক্ষা <strong>অটো-সাবমিট</strong> হয়ে যাবে।</>,
          variant: "danger" as const,
        },
        {
          icon: <XCircle className="h-3.5 w-3.5" />,
          text: <><strong>কপি, পেস্ট এবং রাইট-ক্লিক</strong> পরীক্ষা চলাকালীন নিষিদ্ধ।</>,
          variant: "danger" as const,
        },
      ] : []),
      {
        icon: <Monitor className="h-3.5 w-3.5" />,
        text: <>আপনার <strong>ডিভাইস ও ব্রাউজার তথ্য</strong> রেকর্ড করা হবে।</>,
        variant: "primary" as const,
      },
      ...(hasMcqQuestions ? [{
        icon: <Camera className="h-3.5 w-3.5" />,
        text: <><strong>স্ক্রিনশট</strong> নেওয়া যাবে না।</>,
        variant: "danger" as const,
      }] : []),
      {
        icon: <Clock className="h-3.5 w-3.5" />,
        text: <>সময় শেষ হলে পরীক্ষা <strong>অটো-সাবমিট</strong> হবে।</>,
        variant: "primary" as const,
      },
      {
        icon: <Shield className="h-3.5 w-3.5" />,
        text: <>একবার পরীক্ষায় প্রবেশ করলে <strong>সাবমিট না করে বের হওয়া যাবে না</strong>। পরবর্তীতে আবার দেওয়া যাবে না।</>,
        variant: "danger" as const,
      },
    ];

    return (
      <div className="p-4 max-w-lg mx-auto animate-fade-in">
        <button onClick={() => navigate("/exams")} className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-4">
          <ArrowLeft className="h-4 w-4" /> Back
        </button>

        {/* ── Header card ── */}
        <div className="bg-card border border-border rounded-2xl overflow-hidden shadow-sm">
          <div className="bg-gradient-to-br from-primary/10 to-primary/5 border-b border-border px-5 py-5">
            <div className="flex items-start gap-3">
              <div className="h-10 w-10 rounded-xl bg-primary/15 flex items-center justify-center shrink-0 mt-0.5">
                <BookOpen className="h-5 w-5 text-primary" />
              </div>
              <div className="min-w-0">
                <h2 className="text-base font-bold text-foreground leading-tight">{exam.title}</h2>
                <p className="text-xs text-muted-foreground mt-0.5 truncate">{exam.courseName}</p>
              </div>
            </div>
          </div>

          {/* ── Info grid 2-col ── */}
          <div className="grid grid-cols-2 gap-px bg-border">
            {[
              { label: "ধরন", value: examTypeLabel },
              { label: "প্রশ্ন সংখ্যা", value: `${exam.questions.length}টি` },
              { label: "মোট নম্বর", value: exam.totalMarks },
              { label: "সময়কাল", value: `${exam.duration} মিনিট` },
              ...(exam.negativeMark > 0 ? [{ label: "নেগেটিভ মার্ক", value: `-${exam.negativeMark} প্রতিটিতে` }] : []),
              ...(exam.passMark > 0 ? [{ label: "পাস নম্বর", value: exam.passMark }] : []),
              {
                label: "শুরু",
                value: exam.startTime?.toDate?.()?.toLocaleString("en-US", {
                  hour: "numeric", minute: "2-digit", hour12: true,
                  month: "short", day: "numeric", year: "numeric",
                }),
              },
              {
                label: "শেষ",
                value: exam.endTime?.toDate?.()?.toLocaleString("en-US", {
                  hour: "numeric", minute: "2-digit", hour12: true,
                  month: "short", day: "numeric", year: "numeric",
                }),
              },
            ].map(({ label, value }, i) => (
              <div key={i} className="bg-card px-4 py-3">
                <p className="text-xs text-muted-foreground mb-0.5">{label}</p>
                <p className="text-sm font-semibold text-foreground">{value}</p>
              </div>
            ))}
          </div>
        </div>

        {/* ── Rules section ── */}
        {examStarted && !examEnded && !existingSubmission && (
          <div className="mt-4 space-y-3">
            {/* Section header */}
            <div className="flex items-center gap-2 px-1">
              <Shield className="h-4 w-4 text-primary" />
              <h3 className="text-sm font-semibold text-foreground">পরীক্ষার নিয়ম ও নিরাপত্তা</h3>
            </div>

            {/* Rule items */}
            <div className="space-y-2">
              {rules.map((rule, i) => (
                <div
                  key={i}
                  className={`flex items-start gap-3 p-3 rounded-xl border ${
                    rule.variant === "danger"
                      ? "bg-destructive/5 border-destructive/20"
                      : "bg-primary/5 border-primary/15"
                  }`}
                >
                  {/* Round icon badge */}
                  <span className={`shrink-0 mt-0.5 h-5 w-5 rounded-full flex items-center justify-center ${
                    rule.variant === "danger"
                      ? "bg-destructive/15 text-destructive"
                      : "bg-primary/15 text-primary"
                  }`}>
                    {rule.icon}
                  </span>
                  <span className="text-sm text-foreground leading-snug">{rule.text}</span>
                </div>
              ))}
            </div>

            {/* Agree checkbox — full card */}
            <label
              className={`flex items-center gap-3 p-4 rounded-xl border cursor-pointer transition-colors ${
                rulesAccepted
                  ? "bg-primary/5 border-primary/30"
                  : "bg-card border-border hover:bg-accent/50"
              }`}
            >
              <input
                type="checkbox"
                checked={rulesAccepted}
                onChange={e => setRulesAccepted(e.target.checked)}
                className="w-4 h-4 rounded border-border accent-primary shrink-0"
              />
              <span className="text-sm font-medium text-foreground">
                আমি পরীক্ষার সকল নিয়মগুলো পড়েছি এবং মানতে সম্মত আছি
              </span>
            </label>

            {/* Start button */}
            <button
              onClick={startExam}
              disabled={!rulesAccepted}
              className="w-full py-3 bg-primary text-primary-foreground rounded-xl font-semibold text-sm disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2 hover:bg-primary/90 transition-colors"
            >
              <Shield className="h-4 w-4" /> পরীক্ষা শুরু করুন
            </button>
          </div>
        )}

        {!examStarted && (
          <div className="mt-4 bg-yellow-500/10 border border-yellow-500/20 rounded-xl p-4 text-center">
            <Timer className="h-5 w-5 text-yellow-600 dark:text-yellow-400 mx-auto mb-1" />
            <p className="text-sm text-yellow-700 dark:text-yellow-400 font-medium">পরীক্ষা এখনো শুরু হয়নি। অপেক্ষা করুন।</p>
          </div>
        )}

        {examEnded && !existingSubmission && (
          <div className="mt-4">
            <p className="text-sm text-destructive mb-4 text-center font-medium">পরীক্ষার সময় শেষ হয়ে গেছে।</p>
            <div className="space-y-3">
              <h3 className="font-semibold text-foreground">সঠিক উত্তর</h3>
              {exam.questions.map((q, idx) => (
                <div key={q.id} className="bg-card border border-border rounded-xl p-3">
                  <p className="text-sm font-medium text-foreground">
                    Q{idx + 1}. {q.questionText}{" "}
                    <span className="text-xs text-muted-foreground">({q.type === "mcq" ? "MCQ" : "Written"})</span>
                  </p>
                  {q.questionImage && (
                    <img src={q.questionImage} alt="" className="h-24 rounded-lg object-contain mt-2 cursor-pointer hover:opacity-80" onClick={() => setPreviewImage(q.questionImage!)} />
                  )}
                  {q.type === "mcq" && q.options && (
                    <div className="mt-2 space-y-1">
                      {q.options.map((opt, oIdx) => {
                        const isCorrect = oIdx === q.correctAnswer;
                        return (
                          <div key={oIdx} className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm ${isCorrect ? "bg-green-500/10" : "bg-card"}`}>
                            {isCorrect && <CheckCircle className="h-3.5 w-3.5 text-green-600 dark:text-green-400 shrink-0" />}
                            {!isCorrect && <span className="w-3.5" />}
                            <span className="text-foreground">{opt.text}</span>
                            {opt.image && <img src={opt.image} alt="" className="h-8 rounded object-contain ml-auto" />}
                          </div>
                        );
                      })}
                    </div>
                  )}
                  {q.type === "written" && q.writtenAnswer && (
                    <div className="mt-2 p-2 bg-green-500/10 rounded-lg">
                      <p className="text-xs text-muted-foreground mb-1">Correct Answer:</p>
                      {q.writtenAnswer.startsWith("http") ? (
                        <div className="relative inline-block group cursor-pointer" onClick={() => setPreviewImage(q.writtenAnswer!)}>
                          <img src={q.writtenAnswer} alt="Answer" className="h-32 rounded-lg object-contain" />
                          <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity rounded-lg flex items-center justify-center">
                            <ZoomIn className="h-6 w-6 text-white" />
                          </div>
                        </div>
                      ) : (
                        <p className="text-sm text-foreground">{q.writtenAnswer}</p>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        <ImagePreviewDialog src={previewImage} onClose={() => setPreviewImage(null)} />
      </div>
    );
  }

  // ─── Exam Taking View ────────────────────────────────────────────────────────
  const question = exam.questions[currentQ];

  return (
    <div className="p-4 max-w-2xl mx-auto animate-fade-in select-none">
      {/* Fullscreen reminder during written upload */}
      {!isFullscreen && started && isUploadingWrittenState && hasMcqQuestions && (
        <div
          className="fixed top-0 left-0 right-0 z-50 bg-primary text-primary-foreground text-center py-2 text-sm font-medium cursor-pointer"
          onClick={requestFullscreen}
        >
          📸 ছবি আপলোড মোড — আপলোড শেষে ফুলস্ক্রিনে ফিরে যেতে এখানে ক্লিক করুন
        </div>
      )}

      {/* Timer bar */}
      <div className="sticky top-0 z-40 bg-background border-b border-border -mx-4 px-4 py-2 flex items-center justify-between">
        <span className="text-sm text-foreground font-medium">Q {currentQ + 1}/{exam.questions.length}</span>
        <span className={`flex items-center gap-1 text-sm font-mono font-bold ${timeLeft < 60 ? "text-destructive" : "text-foreground"}`}>
          <Clock className="h-4 w-4" /> {formatTime(timeLeft)}
        </span>
      </div>

      {/* Question navigation dots */}
      <div className="flex flex-wrap gap-1.5 mt-3 mb-4">
        {exam.questions.map((q, idx) => {
          const answered = answers[q.id]?.selectedOption !== undefined || answers[q.id]?.writtenImageUrl;
          return (
            <button
              key={q.id}
              onClick={() => setCurrentQ(idx)}
              className={`w-8 h-8 rounded-lg text-xs font-medium border ${
                idx === currentQ
                  ? "border-primary bg-primary text-primary-foreground"
                  : answered
                    ? "border-primary/50 bg-primary/10 text-foreground"
                    : "border-border bg-card text-muted-foreground"
              }`}
            >
              {idx + 1}
            </button>
          );
        })}
      </div>

      {/* Question */}
      <div className="bg-card border border-border rounded-xl p-4">
        <p className="text-sm font-medium text-foreground mb-1">
          Question {currentQ + 1} <span className="text-muted-foreground">({question.marks} marks)</span>
        </p>
        <p className="text-foreground">{question.questionText}</p>
        {question.questionImage && (
          <img src={question.questionImage} alt="" className="mt-3 max-h-48 rounded-lg object-contain pointer-events-none" />
        )}

        {question.type === "mcq" && question.options && (
          <div className="mt-4 space-y-2">
            {question.options.map((opt, oIdx) => {
              const selected = answers[question.id]?.selectedOption === oIdx;
              return (
                <button
                  key={oIdx}
                  onClick={() => selectOption(question.id, oIdx)}
                  className={`w-full text-left flex items-center gap-3 px-4 py-3 rounded-xl border text-sm transition-colors ${
                    selected ? "border-primary bg-primary/10 text-foreground" : "border-border bg-card text-foreground hover:bg-accent"
                  }`}
                >
                  <span className={`w-6 h-6 rounded-full border-2 flex items-center justify-center text-xs shrink-0 ${
                    selected ? "border-primary bg-primary text-primary-foreground" : "border-border"
                  }`}>
                    {String.fromCharCode(65 + oIdx)}
                  </span>
                  <span className="flex-1">{opt.text}</span>
                  {opt.image && <img src={opt.image} alt="" className="h-10 rounded object-contain pointer-events-none" />}
                </button>
              );
            })}
          </div>
        )}

        {question.type === "written" && (
          <div className="mt-4">
            <p className="text-sm text-muted-foreground mb-2">Upload your answer (take a photo):</p>
            <input
              ref={cameraRef}
              type="file"
              accept="image/*"
              capture="environment"
              onChange={e => handleCameraCapture(question.id, e)}
              className="hidden"
            />
            <button
              onClick={() => { setIsUploadingWrittenState(true); cameraRef.current?.click(); }}
              disabled={uploadingImage}
              className="flex items-center gap-2 px-4 py-3 bg-accent border border-border rounded-xl text-sm text-foreground w-full justify-center"
            >
              <Camera className="h-4 w-4" /> {uploadingImage ? "Uploading..." : "Take Photo / Upload Image"}
            </button>
            {answers[question.id]?.writtenImageUrl && (
              <img src={answers[question.id].writtenImageUrl} alt="Answer" className="mt-3 max-h-48 rounded-lg object-contain mx-auto pointer-events-none" />
            )}
          </div>
        )}
      </div>

      {/* Navigation */}
      <div className="flex items-center justify-between mt-4">
        <button
          onClick={() => setCurrentQ(Math.max(0, currentQ - 1))}
          disabled={currentQ === 0}
          className="flex items-center gap-1 px-4 py-2 bg-card border border-border rounded-xl text-sm text-foreground disabled:opacity-40"
        >
          <ChevronLeft className="h-4 w-4" /> Previous
        </button>

        {currentQ === exam.questions.length - 1 ? (
          <button
            onClick={() => setShowConfirm(true)}
            disabled={submitting}
            className="flex items-center gap-1 px-4 py-2 bg-primary text-primary-foreground rounded-xl text-sm font-medium disabled:opacity-50"
          >
            <Send className="h-4 w-4" /> Submit
          </button>
        ) : (
          <button
            onClick={() => setCurrentQ(Math.min(exam.questions.length - 1, currentQ + 1))}
            className="flex items-center gap-1 px-4 py-2 bg-primary text-primary-foreground rounded-xl text-sm font-medium"
          >
            Next <ChevronRight className="h-4 w-4" />
          </button>
        )}
      </div>

      {/* Submit confirmation */}
      <AlertDialog open={showConfirm} onOpenChange={setShowConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>পরীক্ষা সাবমিট করুন</AlertDialogTitle>
            <AlertDialogDescription>
              আপনি কি সাবমিট করতে চান? আপনি {Object.values(answers).filter(a => a.selectedOption !== undefined || a.writtenImageUrl).length}/{exam.questions.length} টি প্রশ্নের উত্তর দিয়েছেন।
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleSubmit}>Submit</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Exit/Escape confirmation */}
      <AlertDialog open={showExitConfirm} onOpenChange={(open) => {
        if (!open) {
          setShowExitConfirm(false);
          if (hasMcqQuestions) setTimeout(() => requestFullscreen(), 200);
        }
      }}>
        <AlertDialogContent onEscapeKeyDown={(e) => e.preventDefault()}>
          <AlertDialogHeader>
            <AlertDialogTitle>⚠️ পরীক্ষা থেকে বের হতে চান?</AlertDialogTitle>
            <AlertDialogDescription>
              পরীক্ষা থেকে বের হতে হলে অবশ্যই সাবমিট করতে হবে। সাবমিট না করে বের হওয়া যাবে না।
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => {
              setShowExitConfirm(false);
              if (hasMcqQuestions) setTimeout(() => requestFullscreen(), 200);
            }}>
              Cancel — পরীক্ষা চালিয়ে যান
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={() => { setShowExitConfirm(false); handleSubmit(); }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Submit — পরীক্ষা সাবমিট করুন
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
