import { useNavigate, Link } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useAppSettings } from "@/contexts/AppSettingsContext";
import { doc, updateDoc, addDoc, collection, getDocs, arrayUnion, Timestamp, query, where } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { getCachedDoc, getCachedCollection } from "@/lib/firestoreCache";
import { LogOut, KeyRound, MessageCircle, ExternalLink, PlusCircle, Copy, Check, Timer, Clock, Calendar, FolderOpen, XCircle } from "lucide-react";
import { toast } from "sonner";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { useEffect, useState } from "react";
import { Course } from "@/types";
import { FloatingButtons } from "@/components/FloatingButtons";

export default function ProfilePage() {
  const { user, userDoc, logout, resetPassword, refreshUserDoc } = useAuth();
  const settings = useAppSettings();
  const navigate = useNavigate();

  const [activeCourse, setActiveCourse] = useState<Course | null>(null);

  // ── new-enroll dialog state ────────────────────────────────────────────────
  const [enrollOpen, setEnrollOpen] = useState(false);
  const [allCourses, setAllCourses] = useState<Course[]>([]);
  const [selectedCourse, setSelectedCourse] = useState<Course | null>(null);

  // ── re-enroll dialog state ────────────────────────────────────────────────
  const [reEnrollCourse, setReEnrollCourse] = useState<{
    courseId: string; courseName: string; courseThumbnail: string;
  } | null>(null);

  // ── shared payment form state ─────────────────────────────────────────────
  const [paymentMethod, setPaymentMethod] = useState("");
  const [paymentNumber, setPaymentNumber] = useState("");
  const [transactionId, setTransactionId] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);

  // ── statuses: courseId → "approved" | "pending" | "rejected" ─────────────
  const [courseRequestStatuses, setCourseRequestStatuses] = useState<Record<string, string>>({});
  const [statusesReady, setStatusesReady] = useState(false);

  // ── auth guard ────────────────────────────────────────────────────────────
  useEffect(() => { if (!user) navigate("/auth?mode=login"); }, [user]);

  // ── active course fetch ───────────────────────────────────────────────────
  useEffect(() => {
    if (!userDoc?.activeCourseId) { setActiveCourse(null); return; }
    getCachedDoc<Course>(db, "courses", userDoc.activeCourseId).then((c) => {
      setActiveCourse(c);
    });
  }, [userDoc?.activeCourseId]);

  // ── load all courses (cached) to detect inactive ─────────────────────────
  useEffect(() => {
    getCachedCollection<Course>(db, "courses").then((list) => {
      setAllCourses(list);
    });
  }, []);

  const inactiveIds = new Set(
    allCourses.filter((c: any) => c.isActive === false).map((c) => c.id)
  );

  // ── fetch enroll request statuses ─────────────────────────────────────────
  // Re-runs whenever enrolledCourses count changes (new enroll) OR on mount.
  const enrolledCoursesLength = userDoc?.enrolledCourses?.length ?? 0;
  const refreshStatuses = async () => {
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
  };

  useEffect(() => {
    setStatusesReady(false);
    refreshStatuses();
  }, [user, enrolledCoursesLength]); // eslint-disable-line

  if (!user || !userDoc) return null;

  // ── helpers ───────────────────────────────────────────────────────────────
  /**
   * Returns the status for a courseId.
   * - While still loading: return undefined (don't assume anything)
   * - After load: use the request status; fall back to "approved" only for
   *   courses that were manually added by admin (no request exists at all).
   */
  const getStatus = (courseId: string): "approved" | "pending" | "rejected" | undefined => {
    if (!statusesReady) return undefined;
    if (courseId in courseRequestStatuses) {
      return courseRequestStatuses[courseId] as "approved" | "pending" | "rejected";
    }
    // No request found → admin manually enrolled → treat as approved
    return "approved";
  };

  const enrolledIds = userDoc.enrolledCourses?.map((c) => c.courseId) || [];
  const availableCourses = allCourses.filter(
    (c) => !enrolledIds.includes(c.id) && (c as any).isActive !== false
  );

  const activeCourseStatus = activeCourse ? getStatus(activeCourse.id) : undefined;
  const isActiveInactive = activeCourse ? inactiveIds.has(activeCourse.id) : false;
  const isActiveApproved = activeCourseStatus === "approved" && !isActiveInactive;
  const isActiveRejected = activeCourseStatus === "rejected";
  const isActivePending  = activeCourseStatus === "pending";

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
  };

  // ── RE-ENROLL SUBMIT ──────────────────────────────────────────────────────
  const handleReEnrollSubmit = async () => {
    if (!reEnrollCourse) return;

    const hasMethods = (settings.paymentMethods?.length ?? 0) > 0;
    if (hasMethods && !paymentMethod) { toast.error("পেমেন্ট মেথড সিলেক্ট করুন"); return; }
    if (!transactionId.trim()) { toast.error("Transaction ID আবশ্যক"); return; }

    setSubmitting(true);
    try {
      const tnxId = transactionId.trim();

      // Find existing request for this course
      const reqSnap = await getDocs(query(
        collection(db, "enrollRequests"),
        where("userId", "==", user.uid),
        where("courseId", "==", reEnrollCourse.courseId),
      ));

      if (!reqSnap.empty) {
        // Update existing rejected request → back to pending
        await updateDoc(doc(db, "enrollRequests", reqSnap.docs[0].id), {
          status: "pending",
          paymentMethod: hasMethods ? paymentMethod : "",
          paymentNumber,
          transactionId: tnxId,
          createdAt: Timestamp.now(),
        });
      } else {
        // No existing request (edge case) → create new
        await addDoc(collection(db, "enrollRequests"), {
          userId: user.uid,
          name: userDoc.name,
          email: userDoc.email,
          courseId: reEnrollCourse.courseId,
          courseName: reEnrollCourse.courseName,
          paymentMethod: hasMethods ? paymentMethod : "",
          paymentNumber,
          transactionId: tnxId,
          status: "pending",
          createdAt: Timestamp.now(),
        });
      }

      // FIX: also reset user.status to "pending" so admin sees the new request
      // Only if all other courses are also not approved
      const allRequests = await getDocs(
        query(collection(db, "enrollRequests"), where("userId", "==", user.uid))
      );
      const hasOtherApproved = allRequests.docs.some(
        d => d.data().courseId !== reEnrollCourse.courseId && d.data().status === "approved"
      );
      if (!hasOtherApproved) {
        await updateDoc(doc(db, "users", user.uid), { status: "pending" });
      }

      await refreshUserDoc();
      await refreshStatuses();

      toast.success("পুনরায় এনরোল রিকোয়েস্ট পাঠানো হয়েছে!");
      setReEnrollCourse(null);
      resetPaymentForm();
    } catch (err: any) {
      toast.error(err.message || "Re-enrollment failed");
    } finally {
      setSubmitting(false);
    }
  };

  // ── NEW ENROLL SUBMIT ─────────────────────────────────────────────────────
  const handleEnrollSubmit = async () => {
    if (!selectedCourse) { toast.error("Please select a course"); return; }

    const hasMethods = (settings.paymentMethods?.length ?? 0) > 0;
    if (hasMethods && !paymentMethod) { toast.error("পেমেন্ট মেথড সিলেক্ট করুন"); return; }
    if (!transactionId.trim()) { toast.error("Transaction ID is required"); return; }

    // Duplicate check
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
      const tnxId = transactionId.trim();
      await addDoc(collection(db, "enrollRequests"), {
        userId: user.uid, name: userDoc.name, email: userDoc.email,
        courseId: selectedCourse.id, courseName: selectedCourse.courseName,
        paymentMethod: hasMethods ? paymentMethod : "",
        paymentNumber,
        transactionId: tnxId,
        status: "pending",
        createdAt: Timestamp.now(),
      });
      await updateDoc(doc(db, "users", user.uid), {
        enrolledCourses: arrayUnion({
          courseId: selectedCourse.id,
          courseName: selectedCourse.courseName,
          courseThumbnail: selectedCourse.thumbnail || "",
          enrolledAt: Timestamp.now(),
        }),
      });
      await refreshUserDoc();
      await refreshStatuses();
      toast.success("Enrollment request submitted!");
      setEnrollOpen(false);
      setSelectedCourse(null);
      resetPaymentForm();
    } catch (err: any) {
      toast.error(err.message || "Enrollment failed");
    } finally {
      setSubmitting(false);
    }
  };

  // ── payment method selector (shared) ─────────────────────────────────────
  const PaymentSelector = ({ radioName }: { radioName: string }) => {
    const methods = settings.paymentMethods ?? [];
    if (methods.length === 0) return null;
    return (
      <div>
        <p className="text-sm font-medium text-foreground mb-2">পেমেন্ট মেথড</p>
        <div className="space-y-2">
          {methods.map((pm, i) => (
            <label
              key={i}
              className={`flex items-center justify-between p-3 rounded-md border cursor-pointer ${
                paymentMethod === pm.name ? "border-primary bg-accent" : "border-border bg-card"
              }`}
            >
              <div className="flex items-center gap-2">
                <input
                  type="radio"
                  name={radioName}
                  value={pm.name}
                  checked={paymentMethod === pm.name}
                  onChange={() => setPaymentMethod(pm.name)}
                  className="accent-primary"
                />
                <span className="text-sm text-foreground">{pm.name}</span>
              </div>
              <div className="flex items-center gap-1">
                <span className="text-sm text-muted-foreground">{pm.number}</span>
                <button type="button" onClick={() => handleCopy(pm.number)} className="p-1">
                  {copied === pm.number
                    ? <Check className="h-3.5 w-3.5 text-success" />
                    : <Copy className="h-3.5 w-3.5 text-muted-foreground" />}
                </button>
              </div>
            </label>
          ))}
        </div>
      </div>
    );
  };

  // ── render ────────────────────────────────────────────────────────────────
  return (
    <div className="p-4 max-w-lg mx-auto animate-fade-in space-y-4">

      {/* Profile Header */}
      <div className="bg-card rounded-xl border border-border p-5 text-center">
        <div className="w-16 h-16 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-2xl font-semibold mx-auto">
          {userDoc.name?.[0]?.toUpperCase() || "U"}
        </div>
        <h2 className="text-lg font-semibold text-foreground mt-3">{userDoc.name}</h2>
        <p className="text-sm text-muted-foreground">{userDoc.email}</p>
      </div>

      {/* Enrolled Courses */}
      {userDoc.enrolledCourses?.length > 0 && (
        <div className="bg-card rounded-xl border border-border p-4">
          <h3 className="font-semibold text-foreground mb-3 text-sm">Enrolled Courses</h3>
          <div className="space-y-2">
            {userDoc.enrolledCourses.map((c) => {
              const reqStatus = getStatus(c.courseId);
              const isExpired = inactiveIds.has(c.courseId);
              const isApproved = reqStatus === "approved" && !isExpired;
              const isPending  = reqStatus === "pending";
              const isRejected = reqStatus === "rejected";

              return (
                <div
                  key={c.courseId}
                  className={`flex items-center justify-between p-3 rounded-lg border transition-colors ${
                    c.courseId === userDoc.activeCourseId ? "border-primary bg-accent" : "border-border"
                  } ${isExpired ? "opacity-70" : ""}`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    {c.courseThumbnail && (
                      <img src={c.courseThumbnail} alt="" className={`w-10 h-10 rounded-md object-cover shrink-0 ${isExpired ? "grayscale" : ""}`} />
                    )}
                    <div className="min-w-0">
                      <span className="text-sm font-medium text-foreground block truncate">{c.courseName}</span>
                      {isExpired ? (
                        <p className="text-[11px] text-destructive flex items-center gap-1">
                          <XCircle className="h-3 w-3" /> Expired
                        </p>
                      ) : isPending ? (
                        <p className="text-[11px] text-warning flex items-center gap-1">
                          <Clock className="h-3 w-3" /> Pending approval
                        </p>
                      ) : isRejected ? (
                        <p className="text-[11px] text-destructive flex items-center gap-1">
                          <XCircle className="h-3 w-3" /> Rejected
                        </p>
                      ) : null}
                    </div>
                  </div>

                  {isApproved && c.courseId !== userDoc.activeCourseId && userDoc.enrolledCourses.length > 1 && (
                    <button
                      onClick={() => handleSwitchCourse(c.courseId)}
                      className="text-xs px-3 py-1 rounded-md bg-primary text-primary-foreground shrink-0"
                    >
                      Select
                    </button>
                  )}

                  {isRejected && !isExpired && (
                    <button
                      onClick={() => {
                        resetPaymentForm();
                        setReEnrollCourse(c);
                      }}
                      className="text-xs px-2.5 py-1 rounded-md bg-destructive/10 border border-destructive/30 text-destructive hover:bg-destructive/20 transition-colors shrink-0 flex items-center gap-1"
                    >
                      <PlusCircle className="h-3 w-3" /> পুনরায় আবেদন
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── New Enroll Dialog ── */}
      <Dialog
        open={enrollOpen}
        onOpenChange={(open) => {
          setEnrollOpen(open);
          if (!open) { setSelectedCourse(null); resetPaymentForm(); }
        }}
      >
        <DialogTrigger asChild>
          <button className="flex items-center gap-2 w-full p-3 bg-primary/10 border border-primary/20 rounded-xl text-sm font-medium text-primary hover:bg-primary/20 transition-colors">
            <PlusCircle className="h-4 w-4" /> Enroll in More Courses
          </button>
        </DialogTrigger>
        <DialogContent className="max-w-md max-h-[85vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Enroll in a New Course</DialogTitle></DialogHeader>
          <div className="space-y-4 mt-2">
            {!selectedCourse ? (
              <div>
                <p className="text-sm font-medium text-foreground mb-2">Select a Course</p>
                {availableCourses.length === 0 ? (
                  <p className="text-sm text-muted-foreground py-4 text-center">No new courses available.</p>
                ) : (
                  <div className="space-y-2">
                    {availableCourses.map((course) => (
                      <button
                        key={course.id}
                        onClick={() => setSelectedCourse(course)}
                        className="flex items-center gap-3 w-full p-3 bg-card border border-border rounded-lg hover:bg-accent transition-colors text-left"
                      >
                        {course.thumbnail && (
                          <img src={course.thumbnail} alt="" className="w-12 h-12 rounded-md object-cover" />
                        )}
                        <div>
                          <p className="text-sm font-medium text-foreground">{course.courseName}</p>
                          <p className="text-xs text-muted-foreground">৳{course.price}</p>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <>
                <div className="p-3 bg-accent border border-border rounded-lg flex items-center gap-3">
                  {selectedCourse.thumbnail && (
                    <img src={selectedCourse.thumbnail} alt="" className="w-12 h-12 rounded-md object-cover" />
                  )}
                  <div className="flex-1">
                    <p className="text-sm font-medium text-foreground">{selectedCourse.courseName}</p>
                    <p className="text-xs text-muted-foreground">৳{selectedCourse.price}</p>
                  </div>
                  <button onClick={() => setSelectedCourse(null)} className="text-xs text-muted-foreground hover:text-foreground">
                    Change
                  </button>
                </div>

                <PaymentSelector radioName="enroll-payment" />

                <input
                  type="text"
                  placeholder="Payment Number"
                  value={paymentNumber}
                  onChange={(e) => setPaymentNumber(e.target.value)}
                  className="w-full px-4 py-3 rounded-md bg-card border border-border text-foreground text-sm"
                />
                <input
                  type="text"
                  placeholder="Transaction ID (from payment SMS)"
                  value={transactionId}
                  onChange={(e) => setTransactionId(e.target.value)}
                  className="w-full px-4 py-3 rounded-md bg-card border border-border text-foreground text-sm"
                />
                <p className="text-[11px] text-muted-foreground -mt-2">পেমেন্ট SMS এ আসা Transaction ID হুবহু কপি করে দিন।</p>

                <button
                  onClick={handleEnrollSubmit}
                  disabled={submitting}
                  className="w-full py-3 rounded-md bg-primary text-primary-foreground font-medium text-sm disabled:opacity-50"
                >
                  {submitting ? "Submitting..." : "Submit Enrollment Request"}
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
          if (!open) { setReEnrollCourse(null); resetPaymentForm(); }
        }}
      >
        <DialogContent className="max-w-md max-h-[85vh] overflow-y-auto">
          <DialogHeader><DialogTitle>পুনরায় এনরোল করুন</DialogTitle></DialogHeader>
          <div className="space-y-4 mt-2">
            {reEnrollCourse && (
              <div className="p-3 bg-destructive/5 border border-destructive/20 rounded-lg flex items-center gap-3">
                {reEnrollCourse.courseThumbnail && (
                  <img src={reEnrollCourse.courseThumbnail} alt="" className="w-12 h-12 rounded-md object-cover" />
                )}
                <div>
                  <p className="text-sm font-medium text-foreground">{reEnrollCourse.courseName}</p>
                  <p className="text-xs text-destructive flex items-center gap-1">
                    <XCircle className="h-3 w-3" /> আগের আবেদন প্রত্যাখ্যাত হয়েছিল
                  </p>
                </div>
              </div>
            )}

            <PaymentSelector radioName="reenroll-payment" />

            <input
              type="text"
              placeholder="পেমেন্ট নম্বর"
              value={paymentNumber}
              onChange={(e) => setPaymentNumber(e.target.value)}
              className="w-full px-4 py-3 rounded-md bg-card border border-border text-foreground text-sm"
            />
            <input
              type="text"
              placeholder="ট্রানজেকশন আইডি (পেমেন্ট SMS থেকে)"
              value={transactionId}
              onChange={(e) => setTransactionId(e.target.value)}
              className="w-full px-4 py-3 rounded-md bg-card border border-border text-foreground text-sm"
            />
            <p className="text-[11px] text-muted-foreground -mt-2">পেমেন্ট SMS এ আসা Transaction ID হুবহু কপি করে দিন।</p>

            <button
              onClick={handleReEnrollSubmit}
              disabled={submitting}
              className="w-full py-3 rounded-md bg-primary text-primary-foreground font-medium text-sm disabled:opacity-50"
            >
              {submitting ? "পাঠানো হচ্ছে..." : "পুনরায় এনরোল রিকোয়েস্ট পাঠান"}
            </button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Course Resources */}
      {isActiveApproved ? (
        <div className="bg-card rounded-xl border border-border p-4 space-y-2">
          <h3 className="font-semibold text-foreground text-sm mb-2">🎓 Course Resources</h3>

          {activeCourse?.allMaterialsLink && (
            <a href={activeCourse.allMaterialsLink} target="_blank" rel="noopener noreferrer"
              className="flex items-center gap-3 p-3 bg-primary/5 border border-primary/20 rounded-xl text-sm font-medium text-foreground hover:bg-primary/10 transition-colors">
              <FolderOpen className="h-5 w-5 text-primary" />
              <span className="flex-1">All Materials</span>
              <ExternalLink className="h-4 w-4 text-primary" />
            </a>
          )}

          {activeCourse?.routinePDF && (
            <a href={activeCourse.routinePDF} target="_blank" rel="noopener noreferrer"
              className="flex items-center gap-3 p-3 bg-primary/5 border border-primary/20 rounded-xl text-sm font-medium text-foreground hover:bg-primary/10 transition-colors">
              <Calendar className="h-5 w-5 text-primary" />
              <span className="flex-1">Routine</span>
              <ExternalLink className="h-4 w-4 text-primary" />
            </a>
          )}

          {activeCourse?.discussionGroups?.filter(g => g.name && g.link).map((g, i) => (
            <a key={i} href={g.link} target="_blank" rel="noopener noreferrer"
              className="flex items-center gap-3 p-3 bg-primary/5 border border-primary/20 rounded-xl text-sm font-medium text-foreground hover:bg-primary/10 transition-colors">
              <MessageCircle className="h-5 w-5 text-primary" />
              <span className="flex-1">{g.name}</span>
              <ExternalLink className="h-4 w-4 text-primary" />
            </a>
          ))}

          <Link to="/exams"
            className="flex items-center gap-3 p-3 bg-primary/5 border border-primary/20 rounded-xl text-sm font-medium text-foreground hover:bg-primary/10 transition-colors">
            <Timer className="h-5 w-5 text-primary" />
            <span className="flex-1">Exams</span>
          </Link>
        </div>
      ) : isActiveRejected ? (
        <div className="bg-destructive/10 border border-destructive/30 rounded-xl p-4 text-center space-y-2">
          <XCircle className="h-6 w-6 text-destructive mx-auto" />
          <p className="text-sm text-destructive font-medium">Enrollment Rejected</p>
          <p className="text-xs text-muted-foreground">আপনি এই কোর্সের কন্টেন্ট access করতে পারবেন না।</p>
        </div>
      ) : isActivePending ? (
        <div className="bg-warning/10 border border-warning/30 rounded-xl p-4 text-center space-y-2">
          <Clock className="h-6 w-6 text-warning mx-auto" />
          <p className="text-sm text-warning font-medium">Enrollment Pending</p>
          <p className="text-xs text-muted-foreground">Approval হলে course resources দেখা যাবে।</p>
        </div>
      ) : null}

      {/* Actions */}
      <div className="space-y-2">
        <button
          onClick={handleResetPassword}
          className="flex items-center gap-3 w-full p-3 bg-card border border-border rounded-xl text-sm text-foreground hover:bg-accent transition-colors"
        >
          <KeyRound className="h-4 w-4 text-muted-foreground" /> Reset Password
        </button>
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <button className="flex items-center gap-3 w-full p-3 bg-card border border-border rounded-xl text-sm text-destructive hover:bg-accent transition-colors">
              <LogOut className="h-4 w-4" /> Logout
            </button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Logout</AlertDialogTitle>
              <AlertDialogDescription>Are you sure you want to logout?</AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={handleLogout}>Logout</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>

      <FloatingButtons />
    </div>
  );
}
