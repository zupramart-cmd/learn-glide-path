import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { collection, getDocs, updateDoc, doc, query, where } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { UserDoc, EnrollRequest, Course } from "@/types";
import { toast } from "sonner";
import { Check, X, ChevronLeft, Search, Users, BookOpen, Clock, Filter, Calendar, CreditCard, Image as ImageIcon } from "lucide-react";
import { AdminListSkeleton } from "@/components/skeletons/AdminSkeleton";
import { ImagePreview } from "@/components/ImagePreview";

interface UserWithId extends UserDoc { id: string; }

type StatusFilter = "all" | "pending" | "approved" | "rejected";

export default function AdminUsersPage() {
  const [searchParams] = useSearchParams();
  const [users, setUsers] = useState<UserWithId[]>([]);
  const [enrollRequests, setEnrollRequests] = useState<EnrollRequest[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const initialStatus = (searchParams.get("status") as StatusFilter) || "all";
  const [statusFilter, setStatusFilter] = useState<StatusFilter>(
    ["all", "pending", "approved", "rejected"].includes(initialStatus) ? initialStatus : "all"
  );
  const [courseFilter, setCourseFilter] = useState("");
  const [selectedUser, setSelectedUser] = useState<UserWithId | null>(null);

  const fetchData = async () => {
    const [usersSnap, requestsSnap, coursesSnap] = await Promise.all([
      getDocs(collection(db, "users")),
      getDocs(collection(db, "enrollRequests")),
      getDocs(collection(db, "courses")),
    ]);
    setUsers(usersSnap.docs.map((d) => ({ id: d.id, ...d.data() } as UserWithId)));
    setEnrollRequests(requestsSnap.docs.map((d) => ({ id: d.id, ...d.data() } as EnrollRequest)));
    setCourses(coursesSnap.docs.map(d => ({ id: d.id, ...d.data() } as Course)));
    setLoading(false);
  };

  useEffect(() => { fetchData(); }, []);

  const getUserRequests = (userId: string) => enrollRequests.filter(r => r.userId === userId);
  const hasPendingRequest = (userId: string) => getUserRequests(userId).some(r => r.status === "pending");

  const handleApproveRequest = async (reqId: string, userId: string, courseName: string) => {
    await updateDoc(doc(db, "enrollRequests", reqId), { status: "approved" });
    const userDoc = users.find(u => u.id === userId);
    if (userDoc?.status !== "approved") {
      await updateDoc(doc(db, "users", userId), { status: "approved" });
    }
    toast.success(`${courseName} অ্যাপ্রুভ করা হয়েছে`);
    fetchData();
  };

  const handleRejectRequest = async (reqId: string, userId: string, courseName: string) => {
    await updateDoc(doc(db, "enrollRequests", reqId), { status: "rejected" });
    toast.success(`${courseName} রিজেক্ট করা হয়েছে`);
    fetchData();
  };

  const filtered = users.filter((u) => {
    if (u.role === "admin") return false;
    const matchesSearch =
      u.name?.toLowerCase().includes(search.toLowerCase()) ||
      u.email?.toLowerCase().includes(search.toLowerCase()) ||
      u.enrolledCourses?.some((c) => c.courseName.toLowerCase().includes(search.toLowerCase()));
    const userHasPendingRequest = hasPendingRequest(u.id);
    const matchesStatus =
      statusFilter === "all" ||
      (statusFilter === "pending" ? (u.status === "pending" || userHasPendingRequest) : u.status === statusFilter);
    const matchesCourse = !courseFilter || u.enrolledCourses?.some(c => c.courseId === courseFilter) || u.activeCourseId === courseFilter;
    return matchesSearch && matchesStatus && matchesCourse;
  });

  const students = users.filter(u => u.role !== "admin");
  const statusCounts = {
    all: students.length,
    pending: students.filter(u => u.status === "pending" || hasPendingRequest(u.id)).length,
    approved: students.filter(u => u.status === "approved").length,
    rejected: students.filter(u => u.status === "rejected").length,
  };

  if (loading) return <AdminListSkeleton count={6} />;

  // Full detail view
  if (selectedUser) {
    const userRequests = getUserRequests(selectedUser.id);

    return (
      <div className="p-3 sm:p-4 animate-fade-in max-w-2xl mx-auto overflow-x-hidden">
        <button onClick={() => setSelectedUser(null)} className="flex items-center gap-1 text-sm text-muted-foreground mb-4 hover:text-foreground transition-colors">
          <ChevronLeft className="h-4 w-4" /> ব্যাক
        </button>
        <div className="bg-card border border-border rounded-xl overflow-hidden">
          {/* User header */}
          <div className="p-4 sm:p-6 border-b border-border flex items-center gap-4">
            <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-lg sm:text-xl font-semibold flex-shrink-0">
              {selectedUser.name?.[0]?.toUpperCase() || "U"}
            </div>
            <div className="flex-1 min-w-0">
              <h2 className="text-base sm:text-lg font-semibold text-foreground truncate">{selectedUser.name}</h2>
              <p className="text-xs sm:text-sm text-muted-foreground truncate">{selectedUser.email}</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                যোগদান: {selectedUser.createdAt?.toDate?.()?.toLocaleDateString('bn-BD', { year: 'numeric', month: 'long', day: 'numeric' }) || "—"}
              </p>
            </div>
          </div>

          <div className="p-4 sm:p-6 space-y-5 overflow-y-auto max-h-[65vh]">
            {/* Enrolled Courses with payment details */}
            {selectedUser.enrolledCourses?.length > 0 ? (
              <div>
                <p className="text-xs text-muted-foreground font-medium uppercase mb-3 flex items-center gap-1.5">
                  <BookOpen className="h-3.5 w-3.5" /> এনরোল্ড কোর্স ({selectedUser.enrolledCourses.length})
                </p>
                <div className="space-y-3">
                  {selectedUser.enrolledCourses.map((c, i) => {
                    const courseReq = userRequests.find(r => r.courseId === c.courseId);
                    const reqStatus = courseReq?.status || "approved";
                    return (
                      <div key={i} className={`rounded-xl border overflow-hidden ${
                        reqStatus === "approved" ? "border-success/30 bg-success/5" :
                        reqStatus === "pending" ? "border-warning/30 bg-warning/5" :
                        "border-destructive/30 bg-destructive/5"
                      }`}>
                        {/* Course header */}
                        <div className="flex items-center gap-3 p-3 border-b border-border/50">
                          {c.courseThumbnail && <img src={c.courseThumbnail} alt="" className="w-10 h-10 rounded-lg object-cover flex-shrink-0" />}
                          <div className="flex-1 min-w-0">
                            <span className="text-sm font-medium text-foreground block truncate">{c.courseName}</span>
                            <div className="flex items-center gap-2 mt-0.5">
                              <span className={`text-[11px] px-2 py-0.5 rounded-full font-medium ${
                                reqStatus === "approved" ? "bg-success/15 text-success" :
                                reqStatus === "pending" ? "bg-warning/15 text-warning" : "bg-destructive/15 text-destructive"
                              }`}>{reqStatus === "approved" ? "অ্যাপ্রুভড" : reqStatus === "pending" ? "পেন্ডিং" : "রিজেক্টেড"}</span>
                              <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                                <Calendar className="h-3 w-3" />
                                {c.enrolledAt?.toDate?.()?.toLocaleDateString('bn-BD', { month: 'short', day: 'numeric', year: 'numeric' }) || "—"}
                              </span>
                            </div>
                          </div>
                          {/* Approve/Reject buttons for this course */}
                          {courseReq && (reqStatus === "pending" || reqStatus === "rejected") && (
                            <div className="flex gap-1.5 flex-shrink-0">
                              <button onClick={() => handleApproveRequest(courseReq.id, selectedUser.id, c.courseName)}
                                className="p-2 rounded-lg bg-success/10 hover:bg-success/20 transition-colors" title="অ্যাপ্রুভ">
                                <Check className="h-4 w-4 text-success" />
                              </button>
                              {reqStatus === "pending" && (
                                <button onClick={() => handleRejectRequest(courseReq.id, selectedUser.id, c.courseName)}
                                  className="p-2 rounded-lg bg-destructive/10 hover:bg-destructive/20 transition-colors" title="রিজেক্ট">
                                  <X className="h-4 w-4 text-destructive" />
                                </button>
                              )}
                            </div>
                          )}
                          {courseReq && reqStatus === "approved" && (
                            <div className="flex gap-1.5 flex-shrink-0">
                              <button onClick={() => handleRejectRequest(courseReq.id, selectedUser.id, c.courseName)}
                                className="p-2 rounded-lg bg-destructive/10 hover:bg-destructive/20 transition-colors" title="রিজেক্ট">
                                <X className="h-4 w-4 text-destructive" />
                              </button>
                            </div>
                          )}
                        </div>
                        
                        {/* Payment details for this course */}
                        {courseReq && (
                          <div className="p-3 space-y-2">
                            <p className="text-[11px] text-muted-foreground font-medium uppercase flex items-center gap-1">
                              <CreditCard className="h-3 w-3" /> পেমেন্ট তথ্য
                            </p>
                            <div className="grid grid-cols-2 gap-2">
                              <DetailRow label="পেমেন্ট মেথড" value={courseReq.paymentMethod} />
                              <DetailRow label="পেমেন্ট নম্বর" value={courseReq.paymentNumber} />
                              <DetailRow label="ট্রানজেকশন আইডি" value={courseReq.transactionId} />
                            </div>
                            {courseReq.screenshot && (
                              <div>
                                <p className="text-[11px] text-muted-foreground mb-1 flex items-center gap-1"><ImageIcon className="h-3 w-3" /> স্ক্রিনশট</p>
                                <ImagePreview file={null} url={courseReq.screenshot} size="lg" />
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground text-center py-4">কোনো কোর্সে এনরোল করেনি</p>
            )}

            {/* Original Payment Info for legacy users without enrollRequests */}
            {selectedUser.paymentInfo && !userRequests.length && selectedUser.paymentInfo.method && (
              <div className="border-t border-border pt-4">
                <p className="text-xs text-muted-foreground font-medium uppercase mb-2 flex items-center gap-1.5">
                  <CreditCard className="h-3.5 w-3.5" /> পেমেন্ট তথ্য (লিগ্যাসি)
                </p>
                <div className="grid grid-cols-2 gap-2">
                  <DetailRow label="পেমেন্ট মেথড" value={selectedUser.paymentInfo.method} />
                  <DetailRow label="পেমেন্ট নম্বর" value={selectedUser.paymentInfo.paymentNumber} />
                  <DetailRow label="ট্রানজেকশন আইডি" value={selectedUser.paymentInfo.transactionId} />
                </div>
                {selectedUser.paymentInfo.screenshot && (
                  <div className="mt-2">
                    <p className="text-[11px] text-muted-foreground mb-1">স্ক্রিনশট</p>
                    <ImagePreview file={null} url={selectedUser.paymentInfo.screenshot} size="lg" />
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-3 sm:p-4 animate-fade-in max-w-4xl mx-auto overflow-x-hidden">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-foreground flex items-center gap-2">
          <Users className="h-5 w-5" /> স্টুডেন্ট ({students.length})
        </h2>
      </div>

      <div className="relative mb-3">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <input
          type="text"
          placeholder="নাম, ইমেইল, বা কোর্স দিয়ে সার্চ করুন..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full pl-9 pr-3 py-2.5 rounded-lg bg-card border border-border text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-all"
        />
      </div>

      {/* Course filter */}
      <div className="mb-3">
        <select value={courseFilter} onChange={(e) => setCourseFilter(e.target.value)}
          className="w-full px-3 py-2 rounded-lg bg-card border border-border text-foreground text-sm">
          <option value="">সকল কোর্স</option>
          {courses.map(c => <option key={c.id} value={c.id}>{c.courseName}</option>)}
        </select>
      </div>

      <div className="flex gap-2 mb-4 overflow-x-auto pb-1 scrollbar-hide">
        {(["all", "pending", "approved", "rejected"] as StatusFilter[]).map((status) => (
          <button
            key={status}
            onClick={() => setStatusFilter(status)}
            className={`flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
              statusFilter === status
                ? "bg-primary text-primary-foreground"
                : "bg-card border border-border text-muted-foreground hover:text-foreground"
            }`}
          >
            {status === "all" ? "সকল" : status === "pending" ? "পেন্ডিং" : status === "approved" ? "অ্যাপ্রুভড" : "রিজেক্টেড"}
            <span className="ml-1 opacity-70">({statusCounts[status]})</span>
          </button>
        ))}
      </div>

      <div className="space-y-2">
        {filtered.length === 0 && (
          <div className="text-center py-8 text-muted-foreground text-sm">কোনো স্টুডেন্ট পাওয়া যায়নি</div>
        )}
        {filtered.map((u) => {
          const pendingCount = getUserRequests(u.id).filter(r => r.status === "pending").length;
          return (
            <button key={u.id} onClick={() => setSelectedUser(u)} className="w-full text-left p-3 bg-card rounded-xl border border-border flex items-center gap-3 hover:bg-accent/50 transition-colors">
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
                {pendingCount > 0 && (
                  <p className="text-[11px] text-warning mt-0.5 flex items-center gap-1">
                    <Clock className="h-3 w-3" /> {pendingCount} পেন্ডিং রিকোয়েস্ট
                  </p>
                )}
              </div>
              <span className={`text-xs px-2 py-0.5 rounded-full flex-shrink-0 font-medium ${
                u.status === "approved" ? "bg-success/10 text-success" :
                u.status === "pending" ? "bg-warning/10 text-warning" :
                "bg-destructive/10 text-destructive"
              }`}>
                {u.status === "approved" ? "অ্যাপ্রুভড" : u.status === "pending" ? "পেন্ডিং" : "রিজেক্টেড"}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[11px] text-muted-foreground">{label}</p>
      <p className="text-foreground text-sm">{value || "—"}</p>
    </div>
  );
}