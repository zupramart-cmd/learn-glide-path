/**
 * AdminUsersPage — optimized read strategy
 *
 * Pending tab  → two targeted queries only:
 *                 users     where status  == "pending"
 *                 enrollRequests where status == "pending"
 *               Total: 2 reads, returns only the small pending set.
 *
 * All / Approved / Rejected tabs → server-side cursor pagination:
 *                 users     where role == "student"  limit(PAGE_SIZE)
 *                 enrollRequests where userId in [pageUserIds]
 *               "Load More" button advances the cursor.
 *               Approved / Rejected are client-side filtered on the loaded set.
 *
 * On approve / reject:  incrementStats(db, { pendingCount: ±1 }) keeps the
 *                       dashboard's single-doc counter in sync.
 */

import { useEffect, useState, useCallback } from "react";
import { useSearchParams } from "react-router-dom";
import {
  updateDoc, doc, Timestamp,
  collection, getDocs, query, where, orderBy,
  documentId, DocumentSnapshot,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { UserDoc, EnrollRequest, Course } from "@/types";
import {
  getCachedCollection, getPaginatedCollection,
  invalidateCache, bumpVersion,
} from "@/lib/firestoreCache";
import { incrementStats } from "@/lib/statsUtils";
import { toast } from "sonner";
import {
  Check, X, Search, Users, BookOpen,
  Clock, CreditCard, ChevronRight, Receipt,
  AlertCircle, RefreshCw, UserCheck, UserX, Hourglass, Copy,
  ChevronDown, ChevronUp, Loader2,
} from "lucide-react";
import { AdminListSkeleton } from "@/components/skeletons";

interface UserWithId extends UserDoc { id: string; }
type StatusFilter = "all" | "pending" | "approved" | "rejected";

const PAGE_SIZE = 20;

// ─── helpers ────────────────────────────────────────────────────────────────

function getCourseStatus(
  courseId: string,
  requests: EnrollRequest[],
): "approved" | "pending" | "rejected" | "none" {
  const req = requests.find(r => r.courseId === courseId);
  if (!req) return "approved";
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

/** Chunk an array into slices of `size` (for Firestore "in" limit of 30). */
function chunks<T>(arr: T[], size: number): T[][] {
  const result: T[][] = [];
  for (let i = 0; i < arr.length; i += size) result.push(arr.slice(i, i + size));
  return result;
}

// ─── main component ─────────────────────────────────────────────────────────

export default function AdminUsersPage() {
  const [searchParams] = useSearchParams();

  const [users, setUsers] = useState<UserWithId[]>([]);
  const [enrollRequests, setEnrollRequests] = useState<EnrollRequest[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);

  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [lastDoc, setLastDoc] = useState<DocumentSnapshot | null>(null);

  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  const initialStatus = (searchParams.get("status") as StatusFilter) || "all";
  const [statusFilter, setStatusFilter] = useState<StatusFilter>(
    ["all", "pending", "approved", "rejected"].includes(initialStatus) ? initialStatus : "all",
  );
  const [courseFilter, setCourseFilter] = useState("");
  const [expandedUsers, setExpandedUsers] = useState<Set<string>>(new Set());
  const [currentPage, setCurrentPage] = useState(1);

  // ── Courses (always loaded — small collection, needed for filter dropdown) ─

  const fetchCourses = useCallback(async () => {
    const list = await getCachedCollection<Course>(db, "courses");
    setCourses(list);
  }, []);

  // ── Pending-tab targeted query ─────────────────────────────────────────────
  // 2 small reads:
  //   (a) enrollRequests where status == "pending"
  //   (b) users where status == "pending"   +  users whose IDs appear in (a)

  const loadPendingData = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      // (a) pending enroll requests
      const reqSnap = await getDocs(
        query(collection(db, "enrollRequests"), where("status", "==", "pending")),
      );
      const pendingReqs = reqSnap.docs.map(d => ({ id: d.id, ...d.data() }) as EnrollRequest);

      // (b1) users with pending account status
      const acctSnap = await getDocs(
        query(collection(db, "users"), where("status", "==", "pending"), where("role", "==", "student")),
      );
      const acctPendingUsers = acctSnap.docs.map(d => ({ id: d.id, ...d.data() }) as UserWithId);
      const acctPendingIds   = new Set(acctPendingUsers.map(u => u.id));

      // (b2) users with pending enroll requests but approved account
      const pendingEnrollIds = [...new Set(pendingReqs.map(r => r.userId))].filter(
        id => !acctPendingIds.has(id),
      );

      const enrollPendingUsers: UserWithId[] = [];
      for (const chunk of chunks(pendingEnrollIds, 30)) {
        const snap = await getDocs(
          query(collection(db, "users"), where(documentId(), "in", chunk)),
        );
        snap.docs.forEach(d => enrollPendingUsers.push({ id: d.id, ...d.data() } as UserWithId));
      }

      setUsers([...acctPendingUsers, ...enrollPendingUsers]);
      setEnrollRequests(pendingReqs);
      setHasMore(false);
      setLastDoc(null);
    } catch {
      toast.error("Failed to load pending data");
    } finally {
      setLoading(false);
    }
  }, []);

  // ── All-users paginated load ───────────────────────────────────────────────
  // First page:  users limit(20) + their enrollRequests
  // Load More:   next page cursor, appended to existing lists

  const loadPagedUsers = useCallback(async (cursor: DocumentSnapshot | null = null) => {
    if (cursor) setLoadingMore(true);
    else        setLoading(true);

    try {
      const { data: pageUsers, lastDoc: newLastDoc, hasMore: more } =
        await getPaginatedCollection<UserWithId>(
          db,
          "users",
          PAGE_SIZE,
          [where("role", "==", "student"), orderBy("createdAt", "desc")],
          cursor,
        );

      // Fetch enrollRequests only for the users on this page
      const userIds = pageUsers.map(u => u.id);
      const pageReqs: EnrollRequest[] = [];
      for (const chunk of chunks(userIds, 30)) {
        const snap = await getDocs(
          query(collection(db, "enrollRequests"), where("userId", "in", chunk)),
        );
        snap.docs.forEach(d => pageReqs.push({ id: d.id, ...d.data() } as EnrollRequest));
      }

      if (cursor) {
        setUsers(prev => [...prev, ...pageUsers]);
        setEnrollRequests(prev => [...prev, ...pageReqs]);
      } else {
        setUsers(pageUsers);
        setEnrollRequests(pageReqs);
      }

      setLastDoc(newLastDoc);
      setHasMore(more);
    } catch {
      toast.error("Failed to load users");
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, []);

  // ── Route initial load to the right strategy ───────────────────────────────

  const refresh = useCallback(async (silent = false) => {
    if (statusFilter === "pending") {
      await loadPendingData(silent);
    } else {
      if (!silent) setLoading(true);
      await loadPagedUsers(null);
    }
  }, [statusFilter, loadPendingData, loadPagedUsers]);

  // Load courses once on mount
  useEffect(() => { fetchCourses(); }, [fetchCourses]);

  // Reload users whenever tab changes
  useEffect(() => {
    setUsers([]);
    setEnrollRequests([]);
    setLastDoc(null);
    setHasMore(false);
    setCurrentPage(1);
    refresh();
  }, [statusFilter]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Actions ────────────────────────────────────────────────────────────────

  const handleApproveRequest = async (
    reqId: string,
    userId: string,
    courseName: string,
    courseId: string,
  ) => {
    if (actionLoading) return;
    setActionLoading(reqId);
    try {
      await updateDoc(doc(db, "enrollRequests", reqId), {
        status    : "approved",
        approvedAt: Timestamp.now(),
      });

      const userDoc = users.find(u => u.id === userId);
      const updates: Record<string, any> = { status: "approved" };
      if (!userDoc?.activeCourseId) updates.activeCourseId = courseId;

      await updateDoc(doc(db, "users", userId), updates);

      // Keep dashboard stats in sync
      await incrementStats(db, { pendingCount: -1 });

      // Optimistic UI update
      setEnrollRequests(prev => prev.map(r => r.id === reqId ? { ...r, status: "approved" } : r));
      setUsers(prev => prev.map(u => u.id === userId ? { ...u, ...updates } as UserWithId : u));

      invalidateCache("users");
      invalidateCache("enrollRequests");
      await Promise.all([bumpVersion(db, "users"), bumpVersion(db, "enrollRequests")]);

      toast.success(`✓ ${courseName} — approved`);
    } catch (e: any) {
      toast.error(e.message || "Approve failed");
    } finally {
      setActionLoading(null);
    }
  };

  const handleRejectRequest = async (
    reqId: string,
    userId: string,
    courseName: string,
    courseId: string,
  ) => {
    if (actionLoading) return;
    setActionLoading(reqId);
    try {
      await updateDoc(doc(db, "enrollRequests", reqId), {
        status    : "rejected",
        rejectedAt: Timestamp.now(),
      });

      const otherApproved = enrollRequests.filter(
        r => r.userId === userId && r.id !== reqId && r.status === "approved",
      );
      const userDoc = users.find(u => u.id === userId);
      const userUpdates: Record<string, any> = {};

      if (otherApproved.length === 0) userUpdates.status = "rejected";
      if (userDoc?.activeCourseId === courseId) {
        userUpdates.activeCourseId = otherApproved[0]
          ? enrollRequests.find(r => r.id === otherApproved[0].id)?.courseId ?? ""
          : "";
      }

      if (Object.keys(userUpdates).length > 0) {
        await updateDoc(doc(db, "users", userId), userUpdates);
      }

      // Keep dashboard stats in sync
      await incrementStats(db, { pendingCount: -1 });

      // Optimistic UI update
      setEnrollRequests(prev => prev.map(r => r.id === reqId ? { ...r, status: "rejected" } : r));
      if (Object.keys(userUpdates).length > 0) {
        setUsers(prev => prev.map(u => u.id === userId ? { ...u, ...userUpdates } as UserWithId : u));
      }

      invalidateCache("users");
      invalidateCache("enrollRequests");
      await Promise.all([bumpVersion(db, "users"), bumpVersion(db, "enrollRequests")]);

      toast.success(`✗ ${courseName} — rejected`);
    } catch (e: any) {
      toast.error(e.message || "Reject failed");
    } finally {
      setActionLoading(null);
    }
  };

  // ── Derived / client-side filter (within loaded set) ──────────────────────

  const getUserRequests = (userId: string) => enrollRequests.filter(r => r.userId === userId);

  const students = users.filter(u => u.role !== "admin");

  const statusCounts = {
    all     : students.length,
    pending : students.filter(u =>
      getUserRequests(u.id).some(r => r.status === "pending") || u.status === "pending",
    ).length,
    approved: students.filter(u =>
      getUserRequests(u.id).some(r => r.status === "approved") || u.status === "approved",
    ).length,
    rejected: students.filter(u =>
      getUserRequests(u.id).some(r => r.status === "rejected"),
    ).length,
  };

  const filtered = students.filter(u => {
    const matchSearch =
      u.name?.toLowerCase().includes(search.toLowerCase()) ||
      u.email?.toLowerCase().includes(search.toLowerCase()) ||
      u.enrolledCourses?.some(c => c.courseName.toLowerCase().includes(search.toLowerCase()));

    const reqs = getUserRequests(u.id);

    // On pending tab, all loaded users are already pending → no extra filter needed
    const matchStatus = statusFilter === "all" || statusFilter === "pending"
      ? true
      : statusFilter === "approved"
        ? reqs.some(r => r.status === "approved") || u.status === "approved"
        : reqs.some(r => r.status === "rejected");

    const matchCourse = !courseFilter
      || u.enrolledCourses?.some(c => c.courseId === courseFilter)
      || u.activeCourseId === courseFilter;

    return matchSearch && matchStatus && matchCourse;
  });

  useEffect(() => { setCurrentPage(1); }, [search, courseFilter]);

  const totalPages     = Math.ceil(filtered.length / PAGE_SIZE);
  const paginatedUsers = filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  const toggleExpand = (userId: string) => {
    setExpandedUsers(prev => {
      const next = new Set(prev);
      next.has(userId) ? next.delete(userId) : next.add(userId);
      return next;
    });
  };

  if (loading) return <AdminListSkeleton count={6} />;

  // ─── render ───────────────────────────────────────────────────────────────
  return (
    <div className="p-3 sm:p-4 animate-fade-in max-w-4xl mx-auto">

      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-foreground flex items-center gap-2">
          <Users className="h-5 w-5" /> Students
          <span className="text-sm font-normal text-muted-foreground">({students.length})</span>
        </h2>
        <button
          onClick={() => refresh()}
          className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors px-2.5 py-1.5 rounded-lg border border-border bg-card"
        >
          <RefreshCw className="h-3.5 w-3.5" /> Refresh
        </button>
      </div>

      {/* Search */}
      <div className="relative mb-3">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search by name, email or course…"
          className="w-full pl-9 pr-3 py-2 rounded-lg bg-card border border-border text-foreground text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
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

      {/* Status tabs */}
      <div className="flex gap-2 mb-4 overflow-x-auto pb-1 scrollbar-hide">
        {([
          { key: "all",      label: "All",      Icon: Users     },
          { key: "pending",  label: "Pending",  Icon: Hourglass },
          { key: "approved", label: "Approved", Icon: UserCheck },
          { key: "rejected", label: "Rejected", Icon: UserX     },
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
          const reqs         = getUserRequests(u.id);
          const pendingCount = reqs.filter(r => r.status === "pending").length;
          const rejectedCount = reqs.filter(r => r.status === "rejected").length;
          const dominantStatus = pendingCount > 0 ? "pending" : u.status;
          const isExpanded   = expandedUsers.has(u.id);

          return (
            <div
              key={u.id}
              className={`bg-card rounded-xl border transition-all ${
                isExpanded ? "border-primary/40 shadow-sm" : "border-border"
              }`}
            >
              {/* ── Collapsed row ── */}
              <button
                className="w-full text-left p-3 flex items-center gap-3 hover:bg-accent/40 transition-colors rounded-xl"
                onClick={() => toggleExpand(u.id)}
              >
                <div className="w-9 h-9 rounded-full bg-primary/10 text-primary flex items-center justify-center text-sm font-semibold flex-shrink-0">
                  {u.name?.[0]?.toUpperCase() || "U"}
                </div>

                <div className="flex-1 min-w-0">
                  <p className="font-medium text-foreground text-sm truncate">{u.name}</p>
                  <div className="flex items-center gap-1">
                    <p className="text-xs text-muted-foreground truncate">{u.email}</p>
                    {u.email && (
                      <span onClick={e => e.stopPropagation()}>
                        <CopyButton value={u.email} label="email" />
                      </span>
                    )}
                  </div>
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
                    {u.enrolledCourses?.length > 0 && (
                      <span className="text-[11px] text-muted-foreground/70 flex items-center gap-1">
                        <BookOpen className="h-3 w-3" />
                        {u.enrolledCourses.length} course{u.enrolledCourses.length > 1 ? "s" : ""}
                      </span>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-2 flex-shrink-0">
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium hidden sm:inline-flex ${statusBadge(dominantStatus)}`}>
                    {statusLabel(dominantStatus)}
                  </span>
                  {isExpanded
                    ? <ChevronUp className="h-4 w-4 text-muted-foreground" />
                    : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
                </div>
              </button>

              {/* ── Expanded panel ── */}
              {isExpanded && (
                <div className="border-t border-border/60 px-3 pb-3 pt-2 space-y-2 animate-fade-in">
                  {u.enrolledCourses?.length > 0 ? (
                    <div className="space-y-2">
                      {u.enrolledCourses.map((c) => {
                        const req         = reqs.find(r => r.courseId === c.courseId);
                        const courseStatus = getCourseStatus(c.courseId, reqs);
                        const isActive    = c.courseId === u.activeCourseId;

                        return (
                          <div
                            key={c.courseId}
                            className={`rounded-lg border overflow-hidden ${
                              courseStatus === "approved" ? "border-success/30 bg-success/5" :
                              courseStatus === "pending"  ? "border-warning/30 bg-warning/5" :
                              "border-destructive/30 bg-destructive/5"
                            }`}
                          >
                            <div className="flex items-center gap-2 p-2.5">
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-1.5 flex-wrap">
                                  <span className="text-sm font-medium text-foreground truncate">{c.courseName}</span>
                                  {isActive && (
                                    <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20 font-medium">
                                      Active
                                    </span>
                                  )}
                                </div>
                                <div className="flex items-center gap-2 mt-0.5">
                                  <span className={`text-[11px] px-2 py-0.5 rounded-full font-medium ${statusBadge(courseStatus)}`}>
                                    {statusLabel(courseStatus)}
                                  </span>
                                </div>
                              </div>

                              <div className="flex gap-1.5 flex-shrink-0">
                                {(courseStatus === "pending" || courseStatus === "rejected") && req && (
                                  <button
                                    onClick={() => handleApproveRequest(req.id, u.id, c.courseName, c.courseId)}
                                    disabled={!!actionLoading}
                                    className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-success/10 hover:bg-success/20 text-success text-xs font-medium transition-colors disabled:opacity-40"
                                  >
                                    {actionLoading === req.id
                                      ? <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                                      : <Check className="h-3.5 w-3.5" />}
                                    <span className="hidden sm:inline">Approve</span>
                                  </button>
                                )}
                                {(courseStatus === "pending" || courseStatus === "approved") && req && (
                                  <button
                                    onClick={() => handleRejectRequest(req.id, u.id, c.courseName, c.courseId)}
                                    disabled={!!actionLoading}
                                    className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-destructive/10 hover:bg-destructive/20 text-destructive text-xs font-medium transition-colors disabled:opacity-40"
                                  >
                                    {actionLoading === req.id
                                      ? <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                                      : <X className="h-3.5 w-3.5" />}
                                    <span className="hidden sm:inline">Reject</span>
                                  </button>
                                )}
                              </div>
                            </div>

                            {req && (
                              <div className="px-2.5 pb-2.5 pt-1.5 border-t border-border/40 grid grid-cols-2 gap-x-4 gap-y-1">
                                <InfoCell label="Payment Method"  value={req.paymentMethod} />
                                <InfoCell label="Payment Number"  value={req.paymentNumber} copyable />
                                <InfoCell label="Transaction ID"  value={req.transactionId} copyable fullWidth />
                                {req.createdAt && (
                                  <div className="col-span-2">
                                    <p className="text-[10px] text-muted-foreground/70 flex items-center gap-1 mt-0.5">
                                      <Clock className="h-2.5 w-2.5" />
                                      Submitted: {(req.createdAt as Timestamp).toDate?.()?.toLocaleString("en-US", {
                                        month: "short", day: "numeric", year: "numeric",
                                        hour: "2-digit", minute: "2-digit",
                                      })}
                                    </p>
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <p className="text-xs text-muted-foreground text-center py-3">No courses enrolled</p>
                  )}

                  {u.paymentInfo?.method && !reqs.length && (
                    <div className="border-t border-border pt-2 grid grid-cols-2 gap-x-4 gap-y-1">
                      <p className="col-span-2 text-[11px] text-muted-foreground font-medium uppercase mb-1 flex items-center gap-1">
                        <CreditCard className="h-3 w-3" /> Payment Info (Legacy)
                      </p>
                      <InfoCell label="Method"         value={u.paymentInfo.method} />
                      <InfoCell label="Payment Number" value={u.paymentInfo.paymentNumber} copyable />
                      <InfoCell label="Transaction ID" value={u.paymentInfo.transactionId} copyable fullWidth />
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Client-side page navigation (within loaded set) */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 mt-4">
          <button
            onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
            disabled={currentPage === 1}
            className="p-2 rounded-lg bg-card border border-border disabled:opacity-30"
          >
            <ChevronRight className="h-4 w-4 rotate-180" />
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

      {/* Server-side "Load More" (all / approved / rejected tabs only) */}
      {hasMore && statusFilter !== "pending" && (
        <div className="flex justify-center mt-4">
          <button
            onClick={() => loadPagedUsers(lastDoc)}
            disabled={loadingMore}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-card border border-border text-sm text-muted-foreground hover:text-foreground hover:border-primary/40 transition-colors disabled:opacity-50"
          >
            {loadingMore
              ? <Loader2 className="h-4 w-4 animate-spin" />
              : <ChevronDown className="h-4 w-4" />}
            {loadingMore ? "Loading…" : "Load more students"}
          </button>
        </div>
      )}
    </div>
  );
}

// ─── sub-components ──────────────────────────────────────────────────────────

function CopyButton({ value, label }: { value: string; label?: string }) {
  const [copied, setCopied] = useState(false);
  const handleCopy = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!value) return;
    navigator.clipboard.writeText(value).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  };
  return (
    <button
      onClick={handleCopy}
      title={`Copy ${label || "value"}`}
      className="inline-flex items-center justify-center w-5 h-5 rounded hover:bg-muted transition-colors flex-shrink-0"
    >
      {copied
        ? <Check className="h-3 w-3 text-success" />
        : <Copy className="h-3 w-3 text-muted-foreground hover:text-foreground" />}
    </button>
  );
}

function InfoCell({
  label, value, copyable, fullWidth,
}: { label: string; value?: string; copyable?: boolean; fullWidth?: boolean }) {
  return (
    <div className={fullWidth ? "col-span-2" : ""}>
      <p className="text-[10px] text-muted-foreground uppercase font-medium">{label}</p>
      <div className="flex items-center gap-1">
        <p className="text-foreground text-xs font-mono break-all flex-1">{value || "—"}</p>
        {copyable && value && <CopyButton value={value} label={label} />}
      </div>
    </div>
  );
}
