import { useEffect, useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { doc, getDoc, collection, query, where, getDocs } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/contexts/AuthContext";
import { Course } from "@/types";
import { FileText, Users, Clock, BookOpen, MessageSquare, ExternalLink, Lock, ClipboardList } from "lucide-react";
import { CourseDetailsSkeleton } from "@/components/skeletons/CourseDetailsSkeleton";
import { FloatingButtons } from "@/components/FloatingButtons";

export default function CourseDetailsPage() {
  const { courseId } = useParams();
  const { user, userDoc } = useAuth();
  const navigate = useNavigate();
  const [course, setCourse] = useState<Course | null>(null);
  const [loading, setLoading] = useState(true);
  const [hasPendingRequest, setHasPendingRequest] = useState(false);
  const [enrollmentStatus, setEnrollmentStatus] = useState<string | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      if (!courseId) return;
      const snap = await getDoc(doc(db, "courses", courseId));
      if (snap.exists()) setCourse({ id: snap.id, ...snap.data() } as Course);
      
      if (user) {
        const q = query(collection(db, "enrollRequests"), where("userId", "==", user.uid), where("courseId", "==", courseId));
        const reqSnap = await getDocs(q);
        if (!reqSnap.empty) {
          const statuses = reqSnap.docs.map(d => d.data().status as string);
          if (statuses.includes("approved")) setEnrollmentStatus("approved");
          else if (statuses.includes("pending")) { setEnrollmentStatus("pending"); setHasPendingRequest(true); }
          else setEnrollmentStatus(statuses[0]);
        }
      }
      
      setLoading(false);
    };
    fetchData();
  }, [courseId, user]);

  if (loading) return <CourseDetailsSkeleton />;
  if (!course) return <div className="p-4 text-center text-muted-foreground">Course not found.</div>;

  const isEnrolled = userDoc?.enrolledCourses?.some((c) => c.courseId === courseId);
  const isApproved = enrollmentStatus === "approved";
  const isPending = enrollmentStatus === "pending";

  const handleEnroll = () => {
    if (!user) navigate(`/auth?mode=register&courseId=${courseId}`);
    else if (!isEnrolled) navigate(`/auth?mode=register&courseId=${courseId}`);
  };

  return (
    <div className="animate-fade-in">
      <div className="max-w-6xl mx-auto p-4 lg:p-6">
        <div className="lg:grid lg:grid-cols-5 lg:gap-8">
          {/* Left: Thumbnail */}
          <div className="lg:col-span-2">
            <div className="lg:sticky lg:top-20">
              {course.thumbnail ? (
                <img src={course.thumbnail} alt={course.courseName} className="w-full aspect-video lg:aspect-[3/4] object-cover rounded-xl shadow-lg" />
              ) : (
                <div className="w-full aspect-video lg:aspect-[3/4] bg-muted rounded-xl flex items-center justify-center">
                  <BookOpen className="h-12 w-12 text-muted-foreground/30" />
                </div>
              )}

              {/* Desktop CTA */}
              <div className="hidden lg:block mt-4">
                {isEnrolled && isApproved ? (
                  <Link to="/my-courses" className="block w-full text-center px-6 py-3.5 text-sm font-semibold rounded-xl bg-success text-success-foreground shadow-sm hover:opacity-90 transition-opacity">
                    ✅ Start Course
                  </Link>
                ) : isPending ? (
                  <div className="w-full flex items-center justify-center gap-2 px-6 py-3.5 text-sm font-medium rounded-xl bg-warning/15 text-warning border border-warning/30">
                    <Clock className="h-4 w-4" /> Pending Enrollment
                  </div>
                ) : (
                  <button onClick={handleEnroll} className="w-full px-6 py-3.5 text-sm font-semibold rounded-xl bg-primary text-primary-foreground shadow-sm hover:opacity-90 transition-opacity active:scale-[0.98]">
                    Enroll Now — ৳{course.price}
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Right: Details */}
          <div className="lg:col-span-3 mt-5 lg:mt-0 space-y-6">
            <div>
              <h1 className="text-2xl lg:text-3xl font-bold text-foreground">{course.courseName}</h1>
              <p className="text-xl font-semibold text-primary mt-2">৳{course.price}</p>
              {isPending && (
                <div className="mt-3 flex items-center gap-2 px-4 py-2.5 rounded-lg bg-warning/10 border border-warning/30 text-warning text-sm font-medium">
                  <Clock className="h-4 w-4" /> Your enrollment is pending approval
                </div>
              )}
            </div>

            {/* Overview */}
            {course.overview?.length > 0 && (
              <div className="bg-card border border-border rounded-xl p-4">
                <h3 className="font-semibold text-foreground mb-3 flex items-center gap-2">
                  <BookOpen className="h-4 w-4 text-primary" /> Overview
                </h3>
                <ul className="space-y-2">
                  {course.overview.map((point, i) => (
                    <li key={i} className="text-muted-foreground text-sm flex gap-2.5">
                      <span className="text-primary font-bold mt-0.5">•</span>
                      <span>{point}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Subjects */}
            {course.subjects?.length > 0 && (
              <div className="bg-card border border-border rounded-xl p-4">
                <h3 className="font-semibold text-foreground mb-3 flex items-center gap-2">
                  <BookOpen className="h-4 w-4 text-primary" /> Subjects ({course.subjects.length})
                </h3>
                <div className="space-y-2">
                  {course.subjects.map((s) => (
                    <div key={s.subjectId} className="rounded-lg bg-accent/30 overflow-hidden">
                      <div className="flex items-center justify-between px-3 py-2.5">
                        <span className="text-sm font-medium text-foreground">{s.subjectName}</span>
                        {s.chapters?.length ? (
                          <span className="text-xs text-muted-foreground">{s.chapters.length} chapters</span>
                        ) : null}
                      </div>
                      {s.chapters?.length > 0 && (
                        <div className="px-3 pb-2.5 space-y-1">
                          {s.chapters.map((ch, ci) => (
                            <div key={ch.chapterId} className="text-xs text-muted-foreground pl-3 flex items-center gap-2">
                              <span className="text-primary/50">{ci + 1}.</span> {ch.chapterName}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Instructors */}
            {course.instructors?.length > 0 && (
              <div className="bg-card border border-border rounded-xl p-4">
                <h3 className="font-semibold text-foreground mb-3 flex items-center gap-2">
                  <Users className="h-4 w-4 text-primary" /> Instructors
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {course.instructors.map((inst, i) => (
                    <div key={i} className="flex items-center gap-3 p-3 rounded-lg bg-accent/30">
                      {inst.image ? (
                        <img src={inst.image} alt={inst.name} className="w-11 h-11 rounded-full object-cover ring-2 ring-primary/20" />
                      ) : (
                        <div className="w-11 h-11 rounded-full bg-primary/10 flex items-center justify-center text-sm font-bold text-primary">{inst.name[0]}</div>
                      )}
                      <div>
                        <p className="text-sm font-medium text-foreground">{inst.name}</p>
                        <p className="text-xs text-muted-foreground">{inst.subject}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Resources - Routine PDF always visible */}
            {course.routinePDF && (
              <div className="flex flex-wrap gap-3">
                <a href={course.routinePDF} target="_blank" rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 px-4 py-2.5 text-sm font-medium rounded-lg bg-card border border-border hover:bg-accent transition-colors">
                  <FileText className="h-4 w-4 text-primary" /> Routine PDF
                </a>
              </div>
            )}

            {/* Enrolled-only content: All Materials, Discussion Groups, Exams */}
            {isEnrolled && isApproved ? (
              <div className="space-y-3">
                <h3 className="font-semibold text-foreground text-sm flex items-center gap-2">
                  🎓 Enrolled Content
                </h3>
                
                {course.allMaterialsLink && (
                  <a href={course.allMaterialsLink} target="_blank" rel="noopener noreferrer"
                    className="flex items-center gap-3 p-3 bg-primary/5 border-2 border-primary/20 rounded-xl text-sm font-medium text-foreground hover:bg-primary/10 transition-colors">
                    <FileText className="h-5 w-5 text-primary" />
                    <span className="flex-1">All Materials</span>
                    <ExternalLink className="h-4 w-4 text-primary" />
                  </a>
                )}

                {course.discussionGroups?.filter(g => g.name && g.link).length > 0 && (
                  <div className="space-y-2">
                    <p className="text-xs font-medium text-muted-foreground uppercase">Discussion Groups</p>
                    {course.discussionGroups.filter(g => g.name && g.link).map((g, i) => (
                      <a key={i} href={g.link} target="_blank" rel="noopener noreferrer"
                        className="flex items-center gap-3 p-3 bg-primary/5 border-2 border-primary/20 rounded-xl text-sm font-medium text-foreground hover:bg-primary/10 transition-colors">
                        <MessageSquare className="h-5 w-5 text-primary" />
                        <span className="flex-1">{g.name}</span>
                        <ExternalLink className="h-4 w-4 text-primary" />
                      </a>
                    ))}
                  </div>
                )}

                <Link to="/exams"
                  className="flex items-center gap-3 p-3 bg-primary/5 border-2 border-primary/20 rounded-xl text-sm font-medium text-foreground hover:bg-primary/10 transition-colors">
                  <ClipboardList className="h-5 w-5 text-primary" />
                  <span className="flex-1">Exams</span>
                </Link>
              </div>
            ) : isEnrolled && !isApproved ? (
              <div className="bg-accent/50 border border-border rounded-xl p-4 text-center space-y-2">
                <Lock className="h-6 w-6 text-muted-foreground mx-auto" />
                <p className="text-sm text-muted-foreground">All Materials, Discussion Groups & Exams will be available after enrollment approval.</p>
              </div>
            ) : null}

            {/* Mobile CTA */}
            <div className="lg:hidden pt-2">
              {isEnrolled && isApproved ? (
                <Link to="/my-courses" className="block w-full text-center px-6 py-3.5 text-sm font-semibold rounded-xl bg-success text-success-foreground shadow-sm">
                  ✅ Start Course
                </Link>
              ) : isPending ? (
                <div className="w-full flex items-center justify-center gap-2 px-6 py-3.5 text-sm font-medium rounded-xl bg-warning/15 text-warning border border-warning/30">
                  <Clock className="h-4 w-4" /> Pending Enrollment
                </div>
              ) : (
                <button onClick={handleEnroll} className="w-full px-6 py-3.5 text-sm font-semibold rounded-xl bg-primary text-primary-foreground shadow-sm active:scale-[0.98] transition-all">
                  Enroll Now — ৳{course.price}
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      <FloatingButtons course={course} />
    </div>
  );
}
