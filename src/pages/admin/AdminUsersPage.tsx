import { useEffect, useState, useCallback } from "react";
import { useSearchParams } from "react-router-dom";
import { updateDoc, doc, Timestamp } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { UserDoc, EnrollRequest, Course } from "@/types";
import { getCachedCollection, invalidateCache } from "@/lib/firestoreCache";
import { toast } from "sonner";
import {
  Check, X, ChevronLeft, Search, Users, BookOpen,
  Clock, Calendar, CreditCard, ChevronRight, Receipt,
  AlertCircle, RefreshCw, UserCheck, UserX, Hourglass,
} from "lucide-react";
import { AdminListSkeleton } from "@/components/skeletons/AdminSkeleton";

interface UserWithId extends UserDoc { id: string; }
type StatusFilter = "all" | "pending" | "approved" | "rejected";
const PAGE_SIZE = 20;

// ─── helpers ────────────────────────────────────────────────────────────────

/** Course-level status: prefers enrollRequest status, falls back to "approved"
 *  only when the course was manually added without a request. */
function getCourseStatus(
  courseId: string,
  requests: EnrollRequest[],
): "approved" | "pending" | "rejected" | "none" {
  const req = requests.find(r => r.courseId === courseId);
  if (!req) return "approved"; // manually added by admin
  return req.status as "approved" | "pending" | "rejected";
}

function statusBadge(status: string) {
  const map: Record<string, string> = {
    approved: "bg-success/10 text-success border border-success/20",
    pending:  "bg-warning/10 text-warning border border-warning/20",
    rejected: "bg-destructive/10 text-destructive border border-destructive/20",
  };
  return map[status] ?? "bg-muted text-muted-foreground";
}

function statusLabel(status: string) {
  return { approved: "Approved", pending: "Pending", rejected: "Rejected" }[status] ?? status;
}

// ─── main component ─────────────────────────────────────────────────────────

export default function AdminUsersPage() {
  const [searchParams] = useSearchParams();
  const [users, setUsers] = useState<UserWithId[]>([]);
  const [enrollRequests, setEnrollRequests] = useState<EnrollRequest[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null); // reqId being processed

  const [search, setSearch] = useState("");
  const initialStatus = (searchParams.get("status") as StatusFilter) || "all";
  const [statusFilter, setStatusFilter] = useState<StatusFilter>(
    ["all", "pending", "approved", "rejected"].includes(initialStatus) ? initialStatus : "all"
  );
  const [courseFilter, setCourseFilter] = useState("");
  const [selectedUser, setSelectedUser] = useState<UserWithId | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [tnxSearch, setTnxSearch] = useState("");

  // ── fetch ──────────────────────────────────────────────────────────────────

  const fetchData = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    invalidateCache("users");
    invalidateCache("enrollRequests");
    try {
      const [usersData, requestsData, coursesData] = await Promise.all([
        getCachedCollection<UserWithId>(db, "users"),
        getCachedCollection<EnrollRequest>(db, "enrollRequests"),
        getCachedCollection<Course>(db, "courses"),
      ]);
      setUsers(usersData);
      setEnrollRequests(requestsData);
      setCourses(coursesData);

      // Keep selectedUser in sync after refresh
      if (selectedUser) {
        const fresh = usersData.find(u => u.id === selectedUser.id);
        if (fresh) setSelectedUser(fresh);
      }
    } catch {
      toast.error("Failed to load data");
    } finally {
      setLoading(false);
    }
  }, [selectedUser]);

  useEffect(() => { fetchData(); }, []); // eslint-disable-line

  // ── actions ────────────────────────────────────────────────────────────────

  /**
   * BUG FIX 1: handleApproveRequest also sets activeCourseId if user has none.
   * BUG FIX 2: user.status is updated to "approved" reliably.
   * BUG FIX 3: actionLoading prevents double-click race conditions.
   */
  const handleApproveRequest = async (reqId: string, userId: string, courseName: string, courseId: string) => {
    if (actionLoading) return;
    setActionLoading(reqId);
    try {
      await updateDoc(doc(db, "enrollRequests", reqId), {
        status: "approved",
        approvedAt: Timestamp.now(),
      });

      const userDoc = users.find(u => u.id === userId);
      const updates: Record<string, any> = { status: "approved" };

      // If user has no active course, set this one as active
      if (!userDoc?.activeCourseId) {
        updates.activeCourseId = courseId;
      }

      await updateDoc(doc(db, "users", userId), updates);
      toast.success(`✓ ${courseName} — approved`);
      await fetchData(true);
    } catch (e: any) {
      toast.error(e.message || "Approve failed");
    } finally {
      setActionLoading(null);
    }
  };

  /**
   * BUG FIX 4: When rejecting, if this was the user's only approved course,
   * update user.status back to "pending" so the badge reflects reality.
   */
  const handleRejectRequest = async (reqId: string, userId: string, courseName: string, courseId: string) => {
    if (actionLoading) return;
    setActionLoading(reqId);
    try {
      await updateDoc(doc(db, "enrollRequests", reqId), {
        status: "rejected",
        rejectedAt: Timestamp.now(),
      });

      // Check if user still has any other approved requests
      const otherApproved = enrollRequests.filter(
        r => r.userId === userId && r.id !== reqId && r.status === "approved"
      );
      const userDoc = users.find(u => u.id === userId);
      const userUpdates: Record<string, any> = {};

      if (otherApproved.length === 0) {
        userUpdates.status = "rejected";
      }
      // If rejected course was the active one, clear it
      if (userDoc?.activeCourseId === courseId) {
        const nextApproved = otherApproved[0];
        userUpdates.activeCourseId = nextApproved
          ? enrollRequests.find(r => r.id === nextApproved.id)?.courseId ?? ""
          : "";
      }

      if (Object.keys(userUpdates).length > 0) {
        await updateDoc(doc(db, "users", userId), userUpdates);
      }

      toast.success(`✗ ${courseName} — rejected`);
      await fetchData(true);
    } catch (e: any) {
      toast.error(e.message || "Reject failed");
    } finally {
      setActionLoading(null);
    }
  };

  // ── derived data ──────────────────────────────────────────────────────────

  const getUserRequests = (userId: string) => enrollRequests.filter(r => r.userId === userId);

  const students = users.filter(u => u.role !== "admin");

  // BUG FIX 5: statusCounts use enrollRequest statuses (not just user.status),
  // so "rejected" filter actually finds students with rejected course requests.
  const statusCounts = {
    all: students.length,
    pending: students.filter(u =>
      getUserRequests(u.id).some(r => r.status === "pending") || u.status === "pending"
    ).length,
    approved: students.filter(u =>
      getUserRequests(u.id).some(r => r.status === "approved") || u.status === "approved"
    ).length,
    rejected: students.filter(u =>
      getUserRequests(u.id).some(r => r.status === "rejected")
    ).length,
  };

  const filtered = students.filter(u => {
    const matchSearch =
      u.name?.toLowerCase().includes(search.toLowerCase()) ||
      u.email?.toLowerCase().includes(search.toLowerCase()) ||
      u.enrolledCourses?.some(c => c.courseName.toLowerCase().includes(search.toLowerCase()));

    const reqs = getUserRequests(u.id);
    const matchStatus = statusFilter === "all"
      ? true
      : statusFilter === "pending"
        ? reqs.some(r => r.status === "pending") || u.status === "pending"
        : statusFilter === "approved"
          ? reqs.some(r => r.status === "approved") || u.status === "approved"
          : reqs.some(r => r.status === "rejected"); // rejected

    const matchCourse = !courseFilter
      || u.enrolledCourses?.some(c => c.courseId === courseFilter)
      || u.activeCourseId === courseFilter;

    return matchSearch && matchStatus && matchCourse;
  });

  useEffect(() => { setCurrentPage(1); }, [search, statusFilter, courseFilter]);

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
  const paginatedUsers = filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  // ─────────────────────────────────────────────────────────────────────────

  if (loading) return <AdminListSkeleton count={6} />;

  // ── detail view ───────────────────────────────────────────────────────────
  if (selectedUser) {
    const userReqs = getUserRequests(selectedUser.id);
    const hasPending = userReqs.some(r => r.status === "pending");

    return (
      <div className="p-3 sm:p-4 animate-fade-in max-w-2xl mx-auto">
        <div className="flex items-center justify-between mb-4">
          <button
            onClick={() => setSelectedUser(null)}
            className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            <ChevronLeft className="h-4 w-4" /> Back
          </button>
          <button
            onClick={() => fetchData(true)}
            className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors px-2.5 py-1.5 rounded-lg border border-border bg-card"
          >
            <RefreshCw className="h-3.5 w-3.5" /> Refresh
          </button>
        </div>

        <div className="bg-card border border-border rounded-xl overflow-hidden">
          {/* User header */}
          <div className="p-4 sm:p-5 border-b border-border flex items-center gap-4">
            <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xl font-bold flex-shrink-0">
              {selectedUser.name?.[0]?.toUpperCase() || "U"}
            </div>
            <div className="flex-1 min-w-0">
              <h2 className="text-base sm:text-lg font-semibold text-foreground truncate">{selectedUser.name}</h2>
              <p className="text-xs sm:text-sm text-muted-foreground truncate">{selectedUser.email}</p>
              <div className="flex items-center gap-2 mt-1 flex-wrap">
                <span className={`text-[11px] px-2 py-0.5 rounded-full font-medium ${statusBadge(selectedUser.status)}`}>
                  {statusLabel(selectedUser.status)}
                </span>
                {hasPending && (
                  <span className="text-[11px] px-2 py-0.5 rounded-full font-medium bg-warning/10 text-warning border border-warning/20 flex items-center gap-1">
                    <Hourglass className="h-2.5 w-2.5" /> Pending request
                  </span>
                )}
                <span className="text-[11px] text-muted-foreground flex items-center gap-1">
                  <Calendar className="h-3 w-3" />
                  Joined {selectedUser.createdAt?.toDate?.()?.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) || "—"}
                </span>
              </div>
            </div>
          </div>

          <div className="p-4 sm:p-5 space-y-4 overflow-y-auto max-h-[65vh]">
            {/* Enrolled courses */}
            {selectedUser.enrolledCourses?.length > 0 ? (
              <div>
                <p className="text-xs text-muted-foreground font-medium uppercase mb-3 flex items-center gap-1.5">
                  <BookOpen className="h-3.5 w-3.5" /> Enrolled Courses ({selectedUser.enrolledCourses.length})
                </p>
                <div className="space-y-3">
                  {selectedUser.enrolledCourses.map((c) => {
                    const req = userReqs.find(r => r.courseId === c.courseId);
                    const courseStatus = getCourseStatus(c.courseId, userReqs);
                    const isActive = c.courseId === selectedUser.activeCourseId;
                    return (
                      <div
                        key={c.courseId}
                        className={`rounded-xl border overflow-hidden transition-all ${
                          courseStatus === "approved" ? "border-success/30 bg-success/5" :
                          courseStatus === "pending"  ? "border-warning/30 bg-warning/5" :
                          "border-destructive/30 bg-destructive/5"
                        }`}
                      >
                        {/* Course header row */}
                        <div className="flex items-center gap-3 p-3">
                          {c.courseThumbnail && (
                            <img src={c.courseThumbnail} alt="" className="w-10 h-10 rounded-lg object-cover flex-shrink-0" />
                          )}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className="text-sm font-medium text-foreground truncate">{c.courseName}</span>
                              {isActive && (
                                <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20 font-medium">
                                  Active
                                </span>
                              )}
                            </div>
                            <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                              <span className={`text-[11px] px-2 py-0.5 rounded-full font-medium ${statusBadge(courseStatus)}`}>
                                {statusLabel(courseStatus)}
                              </span>
                              <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                                <Calendar className="h-3 w-3" />
                                {c.enrolledAt?.toDate?.()?.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) || "—"}
                              </span>
                            </div>
                          </div>

                          {/* Action buttons */}
                          <div className="flex gap-1.5 flex-shrink-0">
                            {(courseStatus === "pending" || courseStatus === "rejected") && req && (
                              <button
                                onClick={() => handleApproveRequest(req.id, selectedUser.id, c.courseName, c.courseId)}
                                disabled={!!actionLoading}
                                className="p-2 rounded-lg bg-success/10 hover:bg-success/20 transition-colors disabled:opacity-40"
                                title="Approve"
                              >
                                {actionLoading === req.id
                                  ? <RefreshCw className="h-4 w-4 text-success animate-spin" />
                                  : <Check className="h-4 w-4 text-success" />}
                              </button>
                            )}
                            {(courseStatus === "pending" || courseStatus === "approved") && req && (
                              <button
                                onClick={() => handleRejectRequest(req.id, selectedUser.id, c.courseName, c.courseId)}
                                disabled={!!actionLoading}
                                className="p-2 rounded-lg bg-destructive/10 hover:bg-destructive/20 transition-colors disabled:opacity-40"
                                title="Reject"
                              >
                                {actionLoading === req.id
                                  ? <RefreshCw className="h-4 w-4 text-destructive animate-spin" />
                                  : <X className="h-4 w-4 text-destructive" />}
                              </button>
                            )}
                          </div>
                        </div>

                        {/* Payment info */}
                        {req && (
                          <div className="px-3 pb-3 pt-1 border-t border-border/40 space-y-1.5">
                            <p className="text-[11px] text-muted-foreground font-medium uppercase flex items-center gap-1 mb-1">
                              <CreditCard className="h-3 w-3" /> Payment Info
                            </p>
                            <div className="grid grid-cols-2 gap-x-4 gap-y-1.5">
                              <DetailRow label="Method" value={req.paymentMethod} />
                              <DetailRow label="Number" value={req.paymentNumber} />
                              <DetailRow label="Transaction ID" value={req.transactionId} fullWidth />
                            </div>
                            {req.createdAt && (
                              <p className="text-[10px] text-muted-foreground">
                                Submitted: {(req.createdAt as Timestamp).toDate?.()?.toLocaleString("en-US", { month: "short", day: "numeric", year: "numeric", hour: "2-digit", minute: "2-digit" })}
                              </p>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                <BookOpen className="h-8 w-8 mx-auto mb-2 opacity-40" />
                <p className="text-sm">No courses enrolled</p>
              </div>
            )}

            {/* Legacy payment info */}
            {selectedUser.paymentInfo?.method && !userReqs.length && (
              <div className="border-t border-border pt-4">
                <p className="text-xs text-muted-foreground font-medium uppercase mb-2 flex items-center gap-1.5">
                  <CreditCard className="h-3.5 w-3.5" /> Payment Info (Legacy)
                </p>
                <div className="grid grid-cols-2 gap-2">
                  <DetailRow label="Method" value={selectedUser.paymentInfo.method} />
                  <DetailRow label="Number" value={selectedUser.paymentInfo.paymentNumber} />
                  <DetailRow label="Transaction ID" value={selectedUser.paymentInfo.transactionId} fullWidth />
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  // ── list view ─────────────────────────────────────────────────────────────
  return (
    <div className="p-3 sm:p-4 animate-fade-in max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-foreground flex items-center gap-2">
          <Users className="h-5 w-5" /> Students
          <span className="text-sm font-normal text-muted-foreground">({students.length})</span>
        </h2>
        <button
          onClick={() => fetchData()}
          className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors px-2.5 py-1.5 rounded-lg border border-border bg-card"
        >
          <RefreshCw className="h-3.5 w-3.5" /> Refresh
        </button>
      </div>

      {/* Transaction ID Verification */}
      <TnxVerificationPanel
        value={tnxSearch}
        onChange={setTnxSearch}
        requests={enrollRequests}
        actionLoading={actionLoading}
        onApprove={handleApproveRequest}
        onReject={handleRejectRequest}
      />

      {/* Search */}
      <div className="relative mb-3">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <input
          type="text"
          placeholder="Search by name, email, or course…"
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="w-full pl-9 pr-3 py-2.5 rounded-lg bg-card border border-border text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-all"
        />
      </div>

      {/* Course filter */}
      <div className="mb-3">
        <select
          value={courseFilter}
          onChange={e => setCourseFilter(e.target.value)}
          className="w-full px-3 py-2 rounded-lg bg-card border border-border text-foreground text-sm"
        >
          <option value="">All Courses</option>
          {courses.map(c => <option key={c.id} value={c.id}>{c.courseName}</option>)}
        </select>
      </div>

      {/* Status tabs with icons */}
      <div className="flex gap-2 mb-4 overflow-x-auto pb-1 scrollbar-hide">
        {([
          { key: "all",      label: "All",      Icon: Users },
          { key: "pending",  label: "Pending",  Icon: Hourglass },
          { key: "approved", label: "Approved", Icon: UserCheck },
          { key: "rejected", label: "Rejected", Icon: UserX },
        ] as const).map(({ key, label, Icon }) => (
          <button
            key={key}
            onClick={() => setStatusFilter(key)}
            className={`flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
              statusFilter === key
                ? "bg-primary text-primary-foreground"
                : "bg-card border border-border text-muted-foreground hover:text-foreground"
            }`}
          >
            <Icon className="h-3.5 w-3.5" />
            {label}
            <span className="opacity-70">({statusCounts[key]})</span>
          </button>
        ))}
      </div>

      {/* Student list */}
      <div className="space-y-2">
        {paginatedUsers.length === 0 ? (
          <div className="text-center py-10 text-muted-foreground">
            <AlertCircle className="h-8 w-8 mx-auto mb-2 opacity-40" />
            <p className="text-sm">No students found</p>
          </div>
        ) : paginatedUsers.map(u => {
          const reqs = getUserRequests(u.id);
          const pendingCount = reqs.filter(r => r.status === "pending").length;
          const rejectedCount = reqs.filter(r => r.status === "rejected").length;

          // Determine the "dominant" badge for the list item
          // Priority: pending > user.status
          const dominantStatus = pendingCount > 0 ? "pending" : u.status;

          return (
            <button
              key={u.id}
              onClick={() => setSelectedUser(u)}
              className="w-full text-left p-3 bg-card rounded-xl border border-border flex items-center gap-3 hover:bg-accent/50 transition-colors"
            >
              <div className="w-10 h-10 rounded-full bg-primary/10 text-primary flex items-center justify-center text-sm font-semibold flex-shrink-0">
                {u.name?.[0]?.toUpperCase() || "U"}
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-medium text-foreground text-sm truncate">{u.name}</p>
                <p className="text-xs text-muted-foreground truncate">{u.email}</p>
                {u.enrolledCourses?.length > 0 && (
                  <p className="text-[11px] text-muted-foreground/70 truncate mt-0.5">
                    {u.enrolledCourses.map(c => c.courseName).join(", ")}
                  </p>
                )}
                <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                  {pendingCount > 0 && (
                    <span className="text-[11px] text-warning flex items-center gap-1">
                      <Clock className="h-3 w-3" /> {pendingCount} pending
                    </span>
                  )}
                  {rejectedCount > 0 && (
                    <span className="text-[11px] text-destructive flex items-center gap-1">
                      <X className="h-3 w-3" /> {rejectedCount} rejected
                    </span>
                  )}
                </div>
              </div>
              <span className={`text-xs px-2 py-0.5 rounded-full flex-shrink-0 font-medium ${statusBadge(dominantStatus)}`}>
                {statusLabel(dominantStatus)}
              </span>
            </button>
          );
        })}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 mt-4">
          <button
            onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
            disabled={currentPage === 1}
            className="p-2 rounded-lg bg-card border border-border disabled:opacity-30"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <span className="text-sm text-muted-foreground">{currentPage} / {totalPages}</span>
          <button
            onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
            disabled={currentPage === totalPages}
            className="p-2 rounded-lg bg-card border border-border disabled:opacity-30"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      )}
    </div>
  );
}

// ─── sub-components ──────────────────────────────────────────────────────────

function DetailRow({ label, value, fullWidth }: { label: string; value: string; fullWidth?: boolean }) {
  return (
    <div className={fullWidth ? "col-span-2" : ""}>
      <p className="text-[10px] text-muted-foreground uppercase font-medium">{label}</p>
      <p className="text-foreground text-xs font-mono break-all">{value || "—"}</p>
    </div>
  );
}

function TnxVerificationPanel({
  value, onChange, requests, actionLoading, onApprove, onReject,
}: {
  value: string;
  onChange: (v: string) => void;
  requests: EnrollRequest[];
  actionLoading: string | null;
  onApprove: (reqId: string, userId: string, courseName: string, courseId: string) => void;
  onReject:  (reqId: string, userId: string, courseName: string, courseId: string) => void;
}) {
  const q = value.trim().toLowerCase();
  const matches = q.length >= 3
    ? requests.filter(r => (r.transactionId || "").toLowerCase().includes(q))
    : [];

  return (
    <div className="mb-4 p-3 sm:p-4 rounded-xl border border-primary/20 bg-primary/5">
      <div className="flex items-center gap-2 mb-1.5">
        <Receipt className="h-4 w-4 text-primary" />
        <p className="text-sm font-semibold text-foreground">Transaction ID Verify</p>
      </div>
      <p className="text-[11px] text-muted-foreground mb-2">
        SMS থেকে কপি করা Transaction ID এখানে পেস্ট করুন। ম্যাচ করলে সরাসরি Approve / Reject করতে পারবেন।
      </p>
      <input
        type="text"
        placeholder="Paste Transaction ID…"
        value={value}
        onChange={e => onChange(e.target.value)}
        className="w-full px-3 py-2.5 rounded-lg bg-background border border-border text-foreground text-sm font-mono focus:outline-none focus:ring-2 focus:ring-primary/30"
      />

      {q.length > 0 && q.length < 3 && (
        <p className="text-[11px] text-muted-foreground mt-2">কমপক্ষে ৩ অক্ষর লিখুন…</p>
      )}

      {q.length >= 3 && (
        <div className="mt-3 space-y-2">
          {matches.length === 0 ? (
            <p className="text-xs text-destructive flex items-center gap-1">
              <AlertCircle className="h-3.5 w-3.5" /> কোনো ম্যাচ পাওয়া যায়নি
            </p>
          ) : (
            <>
              <p className="text-[11px] text-muted-foreground">{matches.length} match(es) found</p>
              {matches.slice(0, 5).map(r => {
                const isExact = (r.transactionId || "").toLowerCase() === q;
                return (
                  <div
                    key={r.id}
                    className={`p-3 rounded-lg border ${isExact ? "border-success/40 bg-success/5" : "border-border bg-card"}`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-foreground truncate">{r.name}</p>
                        <p className="text-[11px] text-muted-foreground truncate">{r.email}</p>
                        <p className="text-[11px] text-muted-foreground truncate">{r.courseName}</p>
                        <p className="text-[11px] mt-1 font-mono text-foreground/70 break-all">
                          <span className={isExact ? "text-success font-semibold" : ""}>{r.transactionId || "—"}</span>
                        </p>
                        <div className="flex items-center gap-2 mt-1">
                          <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${statusBadge(r.status)}`}>
                            {statusLabel(r.status)}
                          </span>
                          {r.createdAt && (
                            <span className="text-[10px] text-muted-foreground">
                              {(r.createdAt as Timestamp).toDate?.()?.toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                            </span>
                          )}
                        </div>
                      </div>

                      {/* BUG FIX 6: TnxPanel was missing courseId param — now passes it */}
                      {r.status !== "approved" && (
                        <button
                          onClick={() => onApprove(r.id, r.userId, r.courseName, r.courseId)}
                          disabled={!!actionLoading}
                          className="p-1.5 rounded-lg bg-success/10 hover:bg-success/20 disabled:opacity-40"
                          title="Approve"
                        >
                          {actionLoading === r.id
                            ? <RefreshCw className="h-4 w-4 text-success animate-spin" />
                            : <Check className="h-4 w-4 text-success" />}
                        </button>
                      )}
                      {r.status !== "rejected" && (
                        <button
                          onClick={() => onReject(r.id, r.userId, r.courseName, r.courseId)}
                          disabled={!!actionLoading}
                          className="p-1.5 rounded-lg bg-destructive/10 hover:bg-destructive/20 disabled:opacity-40"
                          title="Reject"
                        >
                          {actionLoading === r.id
                            ? <RefreshCw className="h-4 w-4 text-destructive animate-spin" />
                            : <X className="h-4 w-4 text-destructive" />}
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </>
          )}
        </div>
      )}
    </div>
  );
}
