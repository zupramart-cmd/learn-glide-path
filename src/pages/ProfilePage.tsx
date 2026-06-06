import { useNavigate, Link } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useAppSettings } from "@/contexts/AppSettingsContext";
import {
  doc, updateDoc, addDoc, collection, getDocs,
  arrayUnion, Timestamp, query, where,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { getCachedDoc, getCachedCollection } from "@/lib/firestoreCache";
import {
  LogOut, KeyRound, MessageCircle, ExternalLink, PlusCircle,
  Copy, Check, Timer, Clock, Calendar, FolderOpen, XCircle,
  BookOpen, ChevronRight, ShieldCheck, GraduationCap,
  Lock,
} from "lucide-react";
import { toast } from "sonner";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { useEffect, useState, useCallback, memo } from "react";
import { Course } from "@/types";
import { FloatingButtons } from "@/components/FloatingButtons";
import { ProfileSkeleton } from "@/components/skeletons";

// ── Transaction ID validation (mirrors AuthPage) ──────────────────────────────
function validateTransactionId(method: string, tnxId: string): string | null {
  const id = tnxId.trim().toUpperCase();
  const m = method.toLowerCase();
  if (m.includes("bkash")) {
    if (!/^[A-Z0-9]{10}$/.test(id)) return "Invalid";
  } else if (m.includes("nagad")) {
    if (!/^[A-Z0-9]{8,12}$/.test(id)) return "Invalid";
  } else if (m.includes("rocket")) {
    if (!/^[A-Z0-9]{8,12}$/.test(id)) return "Invalid";
  } else {
    if (id.length < 6) return "Invalid";
  }
  return null;
}

function validatePaymentNumber(v: string): string | null {
  const cleaned = v.trim().replace(/[-\s]/g, "");
  if (!cleaned) return null;
  return /^01[3-9]\d{8}$/.test(cleaned) ? null : "Invalid";
}

// ── PaymentSelector — defined OUTSIDE ProfilePage to prevent remount ──────────
interface PaymentSelectorProps {
  radioName: string;
  methods: { name: string; number: string }[];
  paymentMethod: string;
  onMethodChange: (v: string) => void;
  copied: string | null;
  onCopy: (v: string) => void;
}

const PaymentSelector = memo(({
  radioName, methods, paymentMethod, onMethodChange, copied, onCopy,
}: PaymentSelectorProps) => {
  if (methods.length === 0) return null;
  return (
    <div>
      <p className="text-sm font-medium text-foreground mb-2">Payment Method</p>
      <div className="space-y-2">
        {methods.map((pm, i) => (
          <div
            key={i}
            onClick={() => onMethodChange(pm.name)}
            className={`flex items-center justify-between p-3 rounded-md border cursor-pointer ${
              paymentMethod === pm.name ? "border-primary bg-accent" : "border-border bg-card"
            }`}
          >
            <div className="flex items-center gap-2">
              <div
                className={`w-4 h-4 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-colors ${
                  paymentMethod === pm.name ? "border-primary" : "border-muted-foreground"
                }`}
              >
                {paymentMethod === pm.name && <div className="w-2 h-2 rounded-full bg-primary" />}
              </div>
              <span className="text-sm text-foreground">{pm.name}</span>
            </div>
            <div className="flex items-center gap-1">
              <span className="text-sm text-muted-foreground">{pm.number}</span>
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); onCopy(pm.number); }}
                className="p-1"
              >
                {copied === pm.number
                  ? <Check className="h-3.5 w-3.5 text-green-500" />
                  : <Copy className="h-3.5 w-3.5 text-muted-foreground" />}
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
});

// ── Payment Form Fields — inline validation, no instruction text ─────────────
interface PaymentFieldsProps {
  paymentMethod: string;
  paymentNumber: string;
  transactionId: string;
  onPaymentNumberChange: (v: string) => void;
  onTransactionIdChange: (v: string) => void;
  paymentNumberError: string | null;
  transactionIdError: string | null;
  onValidatePaymentNumber: () => void;
  onValidateTransactionId: () => void;
}

const PaymentFields = memo(({
  paymentMethod, paymentNumber, transactionId,
  onPaymentNumberChange, onTransactionIdChange,
  paymentNumberError, transactionIdError,
  onValidatePaymentNumber, onValidateTransactionId,
}: PaymentFieldsProps) => {
  return (
    <>
      <div className="relative">
        <input
          type="tel"
          placeholder="Payment Number"
          value={paymentNumber}
          onChange={(e) => {
            const digits = e.target.value.replace(/\D/g, "").slice(0, 11);
            onPaymentNumberChange(digits);
          }}
          onBlur={onValidatePaymentNumber}
          maxLength={11}
          className={`w-full px-4 py-3 rounded-md bg-card border text-foreground text-sm transition-colors ${
            paymentNumberError ? "border-destructive" : "border-border"
          }`}
        />
        {paymentNumberError && (
          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-medium text-destructive">
            {paymentNumberError}
          </span>
        )}
      </div>
      <div className="relative">
        <input
          type="text"
          required
          placeholder="Transaction ID"
          value={transactionId}
          onChange={(e) => onTransactionIdChange(e.target.value.toUpperCase().replace(/\s+/g, ""))}
          onBlur={onValidateTransactionId}
          maxLength={16}
          className={`w-full px-4 py-3 rounded-md bg-card border text-foreground text-sm tracking-wider transition-colors ${
            transactionIdError ? "border-destructive" : "border-border"
          }`}
        />
        {transactionIdError && (
          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-medium text-destructive">
            {transactionIdError}
          </span>
        )}
      </div>
    </>
  );
});

// ── Status badge helper ───────────────────────────────────────────────────────
function StatusBadge({ status, expired }: { status?: string; expired?: boolean }) {
  if (expired)
    return (
      <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-destructive/10 text-destructive border border-destructive/20">
        <XCircle className="h-2.5 w-2.5" /> Expired
      </span>
    );
  if (status === "pending")
    return (
      <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
        <Clock className="h-2.5 w-2.5" /> Pending
      </span>
    );
  if (status === "rejected")
    return (
      <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-destructive/10 text-destructive border border-destructive/20">
        <XCircle className="h-2.5 w-2.5" /> Rejected
      </span>
    );
  if (status === "approved")
    return (
      <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-green-500/10 text-green-600 dark:text-green-400 border border-green-500/20">
        <ShieldCheck className="h-2.5 w-2.5" /> Approved
      </span>
    );
  return null;
}

// ═════════════════════════════════════════════════════════════════════════════
export default function ProfilePage() {
  const { user, userDoc, logout, resetPassword, refreshUserDoc } = useAuth();
  const settings = useAppSettings();
  const navigate = useNavigate();

  const [activeCourse, setActiveCourse] = useState<Course | null>(null);
  const [enrollOpen, setEnrollOpen] = useState(false);
  const [allCourses, setAllCourses] = useState<Course[]>([]);
  const [selectedCourse, setSelectedCourse] = useState<Course | null>(null);
  const [reEnrollCourse, setReEnrollCourse] = useState<{
    courseId: string; courseName: string; courseThumbnail: string;
  } | null>(null);
  const [reEnrollStep, setReEnrollStep] = useState<"confirm" | "payment">("confirm");

  // ── shared payment form state ─────────────────────────────────────────────
  const [paymentMethod, setPaymentMethod] = useState("");
  const [paymentNumber, setPaymentNumber] = useState("");
  const [transactionId, setTransactionId] = useState("");
  const [paymentNumberError, setPaymentNumberError] = useState<string | null>(null);
  const [transactionIdError, setTransactionIdError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);
  const [courseRequestStatuses, setCourseRequestStatuses] = useState<Record<string, string>>({});
  const [statusesReady, setStatusesReady] = useState(false);

  useEffect(() => { if (!user) navigate("/auth?mode=login"); }, [user]);

  useEffect(() => {
    if (!userDoc?.activeCourseId) { setActiveCourse(null); return; }
    getCachedDoc<Course>(db, "courses", userDoc.activeCourseId).then(setActiveCourse);
  }, [userDoc?.activeCourseId]);

  useEffect(() => {
    getCachedCollection<Course>(db, "courses").then(setAllCourses);
  }, []);

  const inactiveIds = new Set(
    allCourses.filter((c: any) => c.isActive === false).map((c) => c.id)
  );

  const enrolledCoursesLength = userDoc?.enrolledCourses?.length ?? 0;

  const refreshStatuses = useCallback(async () => {
    if (!user) return;
    const snap = await getDocs(
      query(collection(db, "enrollRequests"), where("userId", "==", user.uid))
    );
    const statuses: Record<string, string> = {};
    snap.docs.forEach((d) => {
      const data = d.data() as { courseId: string; status: string };
      statuses[data.courseId] = data.status;
    });
    setCourseRequestStatuses(statuses);
    setStatusesReady(true);
  }, [user]);

  useEffect(() => {
    setStatusesReady(false);
    refreshStatuses();
  }, [user, enrolledCoursesLength]);

  if (!user || !userDoc) return <ProfileSkeleton />;

  const getStatus = (courseId: string): "approved" | "pending" | "rejected" | undefined => {
    if (!statusesReady) return undefined;
    if (courseId in courseRequestStatuses)
      return courseRequestStatuses[courseId] as "approved" | "pending" | "rejected";
    return "approved";
  };

  const enrolledIds = userDoc.enrolledCourses?.map((c) => c.courseId) || [];
  const availableCourses = allCourses.filter(
    (c) => !enrolledIds.includes(c.id) && (c as any).isActive !== false
  );

  const activeCourseStatus = activeCourse ? getStatus(activeCourse.id) : undefined;
  const isActiveInactive  = activeCourse ? inactiveIds.has(activeCourse.id) : false;
  const isActiveApproved  = activeCourseStatus === "approved" && !isActiveInactive;
  const isActiveRejected  = activeCourseStatus === "rejected";
  const isActivePending   = activeCourseStatus === "pending";

  // ── actions ───────────────────────────────────────────────────────────────
  const handleLogout = async () => { await logout(); navigate("/"); };

  const handleResetPassword = async () => {
    try { await resetPassword(userDoc.email); toast.success("Password reset email sent"); }
    catch { toast.error("Failed to send reset email"); }
  };

  const handleSwitchCourse = async (courseId: string) => {
    await updateDoc(doc(db, "users", user.uid), { activeCourseId: courseId });
    await refreshUserDoc();
    toast.success("Active course changed");
  };

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(text);
    setTimeout(() => setCopied(null), 2000);
  };

  const resetPaymentForm = () => {
    setPaymentMethod(""); setPaymentNumber(""); setTransactionId("");
    setPaymentNumberError(null); setTransactionIdError(null);
  };

  const runValidatePaymentNumber = useCallback(() => {
    setPaymentNumberError(validatePaymentNumber(paymentNumber));
  }, [paymentNumber]);

  const runValidateTransactionId = useCallback(() => {
    if (transactionId.trim()) {
      setTransactionIdError(validateTransactionId(paymentMethod, transactionId));
    } else {
      setTransactionIdError(null);
    }
  }, [transactionId, paymentMethod]);

  const handlePaymentNumberChange = useCallback((v: string) => {
    setPaymentNumber(v); setPaymentNumberError(null);
  }, []);
  const handleTransactionIdChange = useCallback((v: string) => {
    setTransactionId(v); setTransactionIdError(null);
  }, []);

  // ── RE-ENROLL SUBMIT ──────────────────────────────────────────────────────
  const handleReEnrollSubmit = async () => {
    if (!reEnrollCourse) return;
    const hasMethods = (settings.paymentMethods?.length ?? 0) > 0;
    if (hasMethods && !paymentMethod) { toast.error("পেমেন্ট মেথড সিলেক্ট করুন"); return; }
    const tnxId = transactionId.trim().toUpperCase();
    if (!tnxId) { toast.error("Transaction ID আবশ্যক"); return; }
    if (hasMethods && paymentMethod) {
      const err = validateTransactionId(paymentMethod, tnxId);
      if (err) { toast.error(err); return; }
    }
    setSubmitting(true);
    try {
      const reqSnap = await getDocs(query(
        collection(db, "enrollRequests"),
        where("userId", "==", user.uid),
        where("courseId", "==", reEnrollCourse.courseId),
      ));
      if (!reqSnap.empty) {
        await updateDoc(doc(db, "enrollRequests", reqSnap.docs[0].id), {
          status: "pending", paymentMethod: hasMethods ? paymentMethod : "",
          paymentNumber, transactionId: tnxId, createdAt: Timestamp.now(),
        });
      } else {
        await addDoc(collection(db, "enrollRequests"), {
          userId: user.uid, name: userDoc.name, email: userDoc.email,
          courseId: reEnrollCourse.courseId, courseName: reEnrollCourse.courseName,
          paymentMethod: hasMethods ? paymentMethod : "",
          paymentNumber, transactionId: tnxId, status: "pending", createdAt: Timestamp.now(),
        });
      }
      const allRequests = await getDocs(
        query(collection(db, "enrollRequests"), where("userId", "==", user.uid))
      );
      const hasOtherApproved = allRequests.docs.some(
        d => d.data().courseId !== reEnrollCourse.courseId && d.data().status === "approved"
      );
      if (!hasOtherApproved)
        await updateDoc(doc(db, "users", user.uid), { status: "pending" });

      await refreshUserDoc(); await refreshStatuses();
      toast.success("পুনরায় এনরোল রিকোয়েস্ট পাঠানো হয়েছে!");
      setReEnrollCourse(null); setReEnrollStep("confirm"); resetPaymentForm();
    } catch (err: any) {
      toast.error(err.message || "Re-enrollment failed");
    } finally { setSubmitting(false); }
  };

  // ── NEW ENROLL SUBMIT ─────────────────────────────────────────────────────
  const handleEnrollSubmit = async () => {
    if (!selectedCourse) { toast.error("Please select a course"); return; }
    const hasMethods = (settings.paymentMethods?.length ?? 0) > 0;
    if (hasMethods && !paymentMethod) { toast.error("পেমেন্ট মেথড সিলেক্ট করুন"); return; }
    const tnxId = transactionId.trim().toUpperCase();
    if (!tnxId) { toast.error("Transaction ID is required"); return; }
    if (hasMethods && paymentMethod) {
      const err = validateTransactionId(paymentMethod, tnxId);
      if (err) { toast.error(err); return; }
    }
    const existingReq = await getDocs(query(
      collection(db, "enrollRequests"),
      where("userId", "==", user.uid),
      where("courseId", "==", selectedCourse.id),
    ));
    if (!existingReq.empty) {
      const st = existingReq.docs[0].data().status;
      if (st === "pending")  { toast.error("এই কোর্সে একটি pending request আছে।"); return; }
      if (st === "approved") { toast.error("আপনি ইতিমধ্যে এই কোর্সে approved।"); return; }
    }
    setSubmitting(true);
    try {
      await addDoc(collection(db, "enrollRequests"), {
        userId: user.uid, name: userDoc.name, email: userDoc.email,
        courseId: selectedCourse.id, courseName: selectedCourse.courseName,
        paymentMethod: hasMethods ? paymentMethod : "",
        paymentNumber, transactionId: tnxId, status: "pending", createdAt: Timestamp.now(),
      });
      await updateDoc(doc(db, "users", user.uid), {
        enrolledCourses: arrayUnion({
          courseId: selectedCourse.id, courseName: selectedCourse.courseName,
          courseThumbnail: selectedCourse.thumbnail || "", enrolledAt: Timestamp.now(),
        }),
      });
      await refreshUserDoc(); await refreshStatuses();
      toast.success("Enrollment request submitted!");
      setEnrollOpen(false); setSelectedCourse(null); resetPaymentForm();
    } catch (err: any) {
      toast.error(err.message || "Enrollment failed");
    } finally { setSubmitting(false); }
  };

  const paymentMethods = settings.paymentMethods ?? [];

  // ── render ────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen pb-24">
      <div className="max-w-2xl mx-auto px-4 py-6 space-y-5 animate-fade-in">

        {/* ── Profile Hero Card ── */}
        <div className="relative overflow-hidden bg-card rounded-2xl border border-border shadow-sm">
          {/* Gradient accent bar */}
          <div className="h-1.5 w-full bg-gradient-to-r from-primary via-primary/70 to-primary/30" />
          <div className="p-5 sm:p-6 flex flex-col sm:flex-row items-center sm:items-start gap-4">
            {/* Avatar */}
            <div className="relative shrink-0">
              <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl bg-gradient-to-br from-primary to-primary/60 text-primary-foreground flex items-center justify-center text-2xl sm:text-3xl font-bold shadow-md">
                {userDoc.name?.[0]?.toUpperCase() || "U"}
              </div>
            </div>
            {/* Info */}
            <div className="flex-1 min-w-0 text-center sm:text-left">
              <h2 className="text-lg sm:text-xl font-bold text-foreground leading-tight">{userDoc.name}</h2>
              <p className="text-sm text-muted-foreground mt-0.5 truncate">{userDoc.email}</p>
              {activeCourse && (
                <div className="mt-2 inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full bg-primary/10 text-primary border border-primary/20">
                  <GraduationCap className="h-3 w-3" />
                  {activeCourse.courseName}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* ── Enrolled Courses ── */}
        {(userDoc.enrolledCourses?.length ?? 0) > 0 && (
          <section className="bg-card rounded-2xl border border-border shadow-sm overflow-hidden">
            <div className="px-4 py-3.5 border-b border-border flex items-center gap-2">
              <BookOpen className="h-4 w-4 text-primary" />
              <h3 className="font-semibold text-foreground text-sm">Enrolled Courses</h3>
              <span className="ml-auto text-xs text-muted-foreground bg-accent px-2 py-0.5 rounded-full">
                {userDoc.enrolledCourses.length}
              </span>
            </div>
            <div className="p-3 space-y-2">
              {userDoc.enrolledCourses.map((c) => {
                const reqStatus = getStatus(c.courseId);
                const isExpired = inactiveIds.has(c.courseId);
                const isApproved = reqStatus === "approved" && !isExpired;
                const isPending  = reqStatus === "pending";
                const isRejected = reqStatus === "rejected";
                const isActive   = c.courseId === userDoc.activeCourseId;

                return (
                  <div
                    key={c.courseId}
                    className={`relative flex items-center gap-3 p-3 rounded-xl border transition-all ${
                      isActive
                        ? "border-primary/40 bg-primary/5 shadow-sm"
                        : "border-border bg-background hover:bg-accent/40"
                    } ${isExpired ? "opacity-60" : ""}`}
                  >
                    {/* Active indicator */}
                    {isActive && (
                      <div className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-8 bg-primary rounded-r-full" />
                    )}

                    {/* Thumbnail */}
                    {c.courseThumbnail ? (
                      <img
                        src={c.courseThumbnail}
                        alt=""
                        className={`w-20 aspect-video rounded-lg object-cover shrink-0 ${isExpired ? "grayscale" : ""}`}
                      />
                    ) : (
                      <div className="w-20 aspect-video rounded-lg bg-accent flex items-center justify-center shrink-0">
                        <GraduationCap className="h-5 w-5 text-muted-foreground" />
                      </div>
                    )}

                    {/* Text */}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-foreground truncate leading-snug">{c.courseName}</p>
                      <div className="mt-1">
                        <StatusBadge
                          status={reqStatus}
                          expired={isExpired}
                        />
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="shrink-0">
                      {isApproved && !isActive && (userDoc.enrolledCourses?.length ?? 0) > 1 && (
                        <button
                          onClick={() => handleSwitchCourse(c.courseId)}
                          className="text-xs px-3 py-1.5 rounded-lg bg-primary text-primary-foreground font-medium hover:bg-primary/90 transition-colors shadow-sm"
                        >
                          Switch
                        </button>
                      )}
                      {isActive && isApproved && (
                        <span className="text-[10px] font-semibold text-primary px-2 py-1 bg-primary/10 rounded-lg border border-primary/20">
                          Active
                        </span>
                      )}
                      {isRejected && !isExpired && (
                        <button
                          onClick={() => { resetPaymentForm(); setReEnrollCourse(c); }}
                          className="text-xs px-2.5 py-1.5 rounded-lg bg-destructive/10 border border-destructive/30 text-destructive hover:bg-destructive/20 transition-colors flex items-center gap-1 font-medium"
                        >
                          <PlusCircle className="h-3 w-3" /> পুনরায়
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {/* ── Enroll More Button ── */}
        <Dialog
          open={enrollOpen}
          onOpenChange={(open) => {
            setEnrollOpen(open);
            if (!open) { setSelectedCourse(null); resetPaymentForm(); }
          }}
        >
          <DialogTrigger asChild>
            <button className="flex items-center gap-3 w-full p-4 bg-primary/5 border border-primary/20 border-dashed rounded-2xl text-sm font-semibold text-primary hover:bg-primary/10 transition-all group">
              <div className="w-8 h-8 rounded-xl bg-primary/10 flex items-center justify-center group-hover:bg-primary/20 transition-colors">
                <PlusCircle className="h-4 w-4" />
              </div>
              <span className="flex-1 text-left">নতুন কোর্সে ভর্তি হন</span>
              <ChevronRight className="h-4 w-4 opacity-50 group-hover:opacity-100 group-hover:translate-x-0.5 transition-all" />
            </button>
          </DialogTrigger>
          <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <GraduationCap className="h-5 w-5 text-primary" /> নতুন কোর্সে এনরোল
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4 mt-2">
              {!selectedCourse ? (
                <div>
                  <p className="text-sm font-semibold text-foreground mb-3">কোর্স বেছে নিন</p>
                  {availableCourses.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                      <GraduationCap className="h-10 w-10 mx-auto mb-2 opacity-30" />
                      <p className="text-sm">নতুন কোনো কোর্স নেই।</p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {availableCourses.map((course) => (
                        <button
                          key={course.id}
                          onClick={() => setSelectedCourse(course)}
                          className="flex items-center gap-3 w-full p-3 bg-card border border-border rounded-xl hover:bg-accent hover:border-primary/30 transition-all text-left group"
                        >
                          {course.thumbnail ? (
                            <img src={course.thumbnail} alt="" className="w-24 aspect-video rounded-lg object-cover shrink-0" />
                          ) : (
                            <div className="w-24 aspect-video rounded-lg bg-accent flex items-center justify-center shrink-0">
                              <GraduationCap className="h-6 w-6 text-muted-foreground" />
                            </div>
                          )}
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-semibold text-foreground truncate">{course.courseName}</p>
                            <p className="text-xs text-muted-foreground mt-0.5">৳{course.price}</p>
                          </div>
                          <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors shrink-0" />
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              ) : (
                <>
                  {/* Selected course preview */}
                  <div className="p-3 bg-primary/5 border border-primary/20 rounded-xl flex items-center gap-3">
                    {selectedCourse.thumbnail && (
                      <img src={selectedCourse.thumbnail} alt="" className="w-24 aspect-video rounded-lg object-cover shrink-0" />
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-foreground truncate">{selectedCourse.courseName}</p>
                      <p className="text-xs text-muted-foreground">৳{selectedCourse.price}</p>
                    </div>
                    <button
                      onClick={() => setSelectedCourse(null)}
                      className="text-xs text-muted-foreground hover:text-foreground px-2 py-1 rounded-lg hover:bg-accent transition-colors shrink-0"
                    >
                      Change
                    </button>
                  </div>

                  <PaymentSelector
                    radioName="enroll-payment"
                    methods={paymentMethods}
                    paymentMethod={paymentMethod}
                    onMethodChange={setPaymentMethod}
                    copied={copied}
                    onCopy={handleCopy}
                  />

                  <PaymentFields
                    paymentMethod={paymentMethod}
                    paymentNumber={paymentNumber}
                    transactionId={transactionId}
                    onPaymentNumberChange={handlePaymentNumberChange}
                    onTransactionIdChange={handleTransactionIdChange}
                    paymentNumberError={paymentNumberError}
                    transactionIdError={transactionIdError}
                    onValidatePaymentNumber={runValidatePaymentNumber}
                    onValidateTransactionId={runValidateTransactionId}
                  />

                  <button
                    onClick={handleEnrollSubmit}
                    disabled={submitting}
                    className="w-full py-3 rounded-xl bg-primary text-primary-foreground font-semibold text-sm disabled:opacity-50 hover:bg-primary/90 transition-colors shadow-sm"
                  >
                    {submitting ? "পাঠানো হচ্ছে..." : "Enrollment Request পাঠান"}
                  </button>
                </>
              )}
            </div>
          </DialogContent>
        </Dialog>

        {/* ── Re-Enroll Dialog ── */}
        <Dialog
          open={!!reEnrollCourse}
          onOpenChange={(open) => {
            if (!open) { setReEnrollCourse(null); setReEnrollStep("confirm"); resetPaymentForm(); }
          }}
        >
          <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <PlusCircle className="h-5 w-5 text-primary" /> পুনরায় এনরোল করুন
              </DialogTitle>
            </DialogHeader>

            <div className="space-y-4 mt-2">
              {reEnrollStep === "confirm" ? (
                /* ── Step 1: Course info + rejection notice ── */
                <>
                  {reEnrollCourse && (
                    <>
                      {/* Course preview card — same style as new-enroll */}
                      <div className="p-3 bg-primary/5 border border-primary/20 rounded-xl flex items-center gap-3">
                        {reEnrollCourse.courseThumbnail ? (
                          <img src={reEnrollCourse.courseThumbnail} alt="" className="w-24 aspect-video rounded-lg object-cover shrink-0" />
                        ) : (
                          <div className="w-24 aspect-video rounded-lg bg-accent flex items-center justify-center shrink-0">
                            <GraduationCap className="h-6 w-6 text-muted-foreground" />
                          </div>
                        )}
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-foreground truncate">{reEnrollCourse.courseName}</p>
                          <p className="text-xs text-destructive flex items-center gap-1 mt-0.5">
                            <XCircle className="h-3 w-3" /> আগের আবেদন প্রত্যাখ্যাত হয়েছিল
                          </p>
                        </div>
                      </div>

                    </>
                  )}

                  <button
                    onClick={() => setReEnrollStep("payment")}
                    className="w-full py-3 rounded-xl bg-primary text-primary-foreground font-semibold text-sm hover:bg-primary/90 transition-colors shadow-sm flex items-center justify-center gap-2"
                  >
                    পেমেন্ট তথ্য দিন <ChevronRight className="h-4 w-4" />
                  </button>
                </>
              ) : (
                /* ── Step 2: Payment form — identical to new-enroll ── */
                <>
                  {/* Selected course preview with back option */}
                  <div className="p-3 bg-primary/5 border border-primary/20 rounded-xl flex items-center gap-3">
                    {reEnrollCourse?.courseThumbnail ? (
                      <img src={reEnrollCourse.courseThumbnail} alt="" className="w-24 aspect-video rounded-lg object-cover shrink-0" />
                    ) : (
                      <div className="w-24 aspect-video rounded-lg bg-accent flex items-center justify-center shrink-0">
                        <GraduationCap className="h-6 w-6 text-muted-foreground" />
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-foreground truncate">{reEnrollCourse?.courseName}</p>
                    </div>
                    <button
                      onClick={() => { setReEnrollStep("confirm"); resetPaymentForm(); }}
                      className="text-xs text-muted-foreground hover:text-foreground px-2 py-1 rounded-lg hover:bg-accent transition-colors shrink-0"
                    >
                      Back
                    </button>
                  </div>

                  <PaymentSelector
                    radioName="reenroll-payment"
                    methods={paymentMethods}
                    paymentMethod={paymentMethod}
                    onMethodChange={setPaymentMethod}
                    copied={copied}
                    onCopy={handleCopy}
                  />

                  <PaymentFields
                    paymentMethod={paymentMethod}
                    paymentNumber={paymentNumber}
                    transactionId={transactionId}
                    onPaymentNumberChange={handlePaymentNumberChange}
                    onTransactionIdChange={handleTransactionIdChange}
                    paymentNumberError={paymentNumberError}
                    transactionIdError={transactionIdError}
                    onValidatePaymentNumber={runValidatePaymentNumber}
                    onValidateTransactionId={runValidateTransactionId}
                  />

                  <button
                    onClick={handleReEnrollSubmit}
                    disabled={submitting}
                    className="w-full py-3 rounded-xl bg-primary text-primary-foreground font-semibold text-sm disabled:opacity-50 hover:bg-primary/90 transition-colors shadow-sm"
                  >
                    {submitting ? "পাঠানো হচ্ছে..." : "পুনরায় এনরোল রিকোয়েস্ট পাঠান"}
                  </button>
                </>
              )}
            </div>
          </DialogContent>
        </Dialog>

        {/* ── Course Resources / Status Block ── */}
        {isActiveInactive ? (
          <section className="bg-card rounded-2xl border border-destructive/30 shadow-sm overflow-hidden">
            <div className="h-1 bg-destructive/60 w-full" />
            <div className="p-5 text-center space-y-3">
              <div className="w-12 h-12 rounded-xl bg-destructive/10 flex items-center justify-center mx-auto">
                <XCircle className="h-6 w-6 text-destructive" />
              </div>
              <div>
                <p className="text-sm font-bold text-destructive">Course Expired</p>
                <p className="text-xs text-muted-foreground mt-1">এই কোর্সটি আর available নেই।</p>
              </div>
            </div>
          </section>
        ) : isActiveApproved ? (
          <section className="bg-card rounded-2xl border border-border shadow-sm overflow-hidden">
            <div className="px-4 py-3.5 border-b border-border flex items-center gap-2">
              <GraduationCap className="h-4 w-4 text-primary" />
              <h3 className="font-semibold text-foreground text-sm">Course Resources</h3>
            </div>
            <div className="p-3 space-y-2">
              {activeCourse?.allMaterialsLink && (
                <a
                  href={activeCourse.allMaterialsLink}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-3 p-3.5 bg-background border border-border rounded-xl text-sm font-medium text-foreground hover:bg-accent hover:border-primary/30 transition-all group"
                >
                  <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                    <FolderOpen className="h-4 w-4 text-primary" />
                  </div>
                  <span className="flex-1">All Materials</span>
                  <ExternalLink className="h-3.5 w-3.5 text-muted-foreground group-hover:text-primary transition-colors" />
                </a>
              )}

              {activeCourse?.routinePDF && (
                <a
                  href={activeCourse.routinePDF}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-3 p-3.5 bg-background border border-border rounded-xl text-sm font-medium text-foreground hover:bg-accent hover:border-primary/30 transition-all group"
                >
                  <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                    <Calendar className="h-4 w-4 text-primary" />
                  </div>
                  <span className="flex-1">Routine</span>
                  <ExternalLink className="h-3.5 w-3.5 text-muted-foreground group-hover:text-primary transition-colors" />
                </a>
              )}

              {activeCourse?.discussionGroups?.filter(g => g.name && g.link).map((g, i) => (
                <a
                  key={i}
                  href={g.link}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-3 p-3.5 bg-background border border-border rounded-xl text-sm font-medium text-foreground hover:bg-accent hover:border-primary/30 transition-all group"
                >
                  <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                    <MessageCircle className="h-4 w-4 text-primary" />
                  </div>
                  <span className="flex-1">{g.name}</span>
                  <ExternalLink className="h-3.5 w-3.5 text-muted-foreground group-hover:text-primary transition-colors" />
                </a>
              ))}

              {/* Exams — locked if course expired */}
              {isActiveInactive ? (
                <div className="flex items-center gap-3 p-3.5 bg-destructive/5 border border-destructive/20 rounded-xl opacity-60 cursor-not-allowed">
                  <div className="w-8 h-8 rounded-lg bg-destructive/10 flex items-center justify-center shrink-0">
                    <Lock className="h-4 w-4 text-destructive" />
                  </div>
                  <div className="flex-1">
                    <span className="text-sm font-medium text-muted-foreground">Exams</span>
                    <p className="text-[11px] text-destructive">কোর্স Expired — পরীক্ষা বন্ধ</p>
                  </div>
                </div>
              ) : (
                <Link
                  to="/exams"
                  className="flex items-center gap-3 p-3.5 bg-background border border-border rounded-xl text-sm font-medium text-foreground hover:bg-accent hover:border-primary/30 transition-all group"
                >
                  <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                    <Timer className="h-4 w-4 text-primary" />
                  </div>
                  <span className="flex-1">Exams</span>
                  <ChevronRight className="h-3.5 w-3.5 text-muted-foreground group-hover:text-primary group-hover:translate-x-0.5 transition-all" />
                </Link>
              )}
            </div>
          </section>
        ) : isActiveRejected ? (
          <section className="bg-card rounded-2xl border border-destructive/30 shadow-sm overflow-hidden">
            <div className="h-1 bg-destructive/60 w-full" />
            <div className="p-5 text-center space-y-2">
              <div className="w-12 h-12 rounded-xl bg-destructive/10 flex items-center justify-center mx-auto">
                <XCircle className="h-6 w-6 text-destructive" />
              </div>
              <p className="text-sm font-bold text-destructive">Enrollment Rejected</p>
              <p className="text-xs text-muted-foreground">আপনি এই কোর্সের কন্টেন্ট access করতে পারবেন না।</p>
            </div>
          </section>
        ) : isActivePending ? (
          <section className="bg-card rounded-2xl border border-amber-500/30 shadow-sm overflow-hidden">
            <div className="h-1 bg-amber-400 w-full" />
            <div className="p-5 text-center space-y-2">
              <div className="w-12 h-12 rounded-xl bg-amber-500/10 flex items-center justify-center mx-auto">
                <Clock className="h-6 w-6 text-amber-500" />
              </div>
              <p className="text-sm font-bold text-amber-600 dark:text-amber-400">Enrollment Pending</p>
              <p className="text-xs text-muted-foreground">Approval হলে course resources দেখা যাবে।</p>
            </div>
          </section>
        ) : null}

        {/* ── Account Actions ── */}
        <section className="bg-card rounded-2xl border border-border shadow-sm overflow-hidden">
          <div className="px-4 py-3.5 border-b border-border">
            <h3 className="font-semibold text-foreground text-sm">Account</h3>
          </div>
          <div className="p-2 space-y-1">
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <button className="flex items-center gap-3 w-full px-3 py-3 rounded-xl text-sm text-foreground hover:bg-accent transition-colors group">
                  <div className="w-8 h-8 rounded-lg bg-accent flex items-center justify-center group-hover:bg-primary/10 transition-colors">
                    <KeyRound className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors" />
                  </div>
                  <span className="flex-1 text-left">Reset Password</span>
                  <ChevronRight className="h-4 w-4 text-muted-foreground" />
                </button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Reset Password?</AlertDialogTitle>
                  <AlertDialogDescription>
                    আপনার ইমেইলে ({userDoc.email}) একটি password reset link পাঠানো হবে। আপনি কি continue করতে চান?
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>বাতিল</AlertDialogCancel>
                  <AlertDialogAction onClick={handleResetPassword}>
                    Send Reset Link
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>

            <AlertDialog>
              <AlertDialogTrigger asChild>
                <button className="flex items-center gap-3 w-full px-3 py-3 rounded-xl text-sm text-destructive hover:bg-destructive/5 transition-colors group">
                  <div className="w-8 h-8 rounded-lg bg-destructive/10 flex items-center justify-center">
                    <LogOut className="h-4 w-4 text-destructive" />
                  </div>
                  <span className="flex-1 text-left font-medium">Logout</span>
                  <ChevronRight className="h-4 w-4 text-destructive/50" />
                </button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Logout করবেন?</AlertDialogTitle>
                  <AlertDialogDescription>আপনি কি সত্যিই logout করতে চান?</AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>বাতিল</AlertDialogCancel>
                  <AlertDialogAction onClick={handleLogout} className="bg-destructive hover:bg-destructive/90">
                    Logout
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </section>

      </div>
      <FloatingButtons />
    </div>
  );
}
