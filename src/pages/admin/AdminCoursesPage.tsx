import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { deleteDoc, doc, updateDoc, writeBatch } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { getCachedCollection, invalidateCache, bumpVersion } from "@/lib/firestoreCache";
import { Course } from "@/types";
import { toast } from "sonner";
import {
  Plus, Edit, Trash2, ChevronUp, ChevronDown, ChevronLeft, ChevronRight,
  Image, PowerOff, Power,
} from "lucide-react";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { AdminCourseListSkeleton } from "@/components/skeletons";

const PAGE_SIZE = 20;

export default function AdminCoursesPage() {
  const navigate = useNavigate();
  const [courses, setCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);

  const fetchCourses = async (forceRefresh = false) => {
    if (forceRefresh) invalidateCache("courses");
    const list = await getCachedCollection<Course>(db, "courses");
    list.sort((a: any, b: any) => (a.order || 0) - (b.order || 0));
    setCourses(list);
    setLoading(false);
  };

  useEffect(() => { fetchCourses(); }, []);

  const handleDelete = async (id: string) => {
    await deleteDoc(doc(db, "courses", id));
    await bumpVersion(db, "courses");
    toast.success("Course deleted");
    fetchCourses(true);
  };

  const handleToggleActive = async (c: Course) => {
    const newValue = (c as any).isActive === false ? true : false;
    await updateDoc(doc(db, "courses", c.id), { isActive: newValue });
    await bumpVersion(db, "courses");
    toast.success(newValue ? "Course restored — students can now access exams" : "Course expired — exam access blocked for students");
    fetchCourses(true);
  };

  const moveCourse = async (index: number, direction: "up" | "down") => {
    const swapIndex = direction === "up" ? index - 1 : index + 1;
    if (swapIndex < 0 || swapIndex >= courses.length) return;
    const batch = writeBatch(db);
    const orderA = (courses[index] as any).order ?? index;
    const orderB = (courses[swapIndex] as any).order ?? swapIndex;
    batch.update(doc(db, "courses", courses[index].id), { order: orderB });
    batch.update(doc(db, "courses", courses[swapIndex].id), { order: orderA });
    await batch.commit();
    toast.success("Order updated");
    fetchCourses(true);
  };

  if (loading) return <AdminCourseListSkeleton count={4} />;

  return (
    <div className="p-3 sm:p-4 animate-fade-in max-w-4xl mx-auto overflow-x-hidden w-full box-border">
      <div className="flex items-center justify-between mb-4 gap-2">
        <h2 className="text-lg font-semibold text-foreground">Courses ({courses.length})</h2>
        <button
          onClick={() => navigate("/admin/courses/add")}
          className="inline-flex items-center gap-1.5 px-3 py-2 text-sm rounded-lg bg-primary text-primary-foreground hover:opacity-90 active:scale-95 transition-all shadow-sm font-medium"
        >
          <Plus className="h-4 w-4" /> Add
        </button>
      </div>

      <div className="space-y-2.5">
        {courses.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE).map((c, localIdx) => {
          const idx = (currentPage - 1) * PAGE_SIZE + localIdx;
          return (
          <div key={c.id} className="p-3 bg-card rounded-xl border border-border flex gap-3 items-center hover:border-primary/20 transition-colors">
            <div className="flex flex-col gap-0.5 flex-shrink-0">
              <button onClick={() => moveCourse(idx, "up")} disabled={idx === 0} className="p-1 rounded-lg hover:bg-accent disabled:opacity-20 transition-colors">
                <ChevronUp className="h-4 w-4 text-muted-foreground" />
              </button>
              <button onClick={() => moveCourse(idx, "down")} disabled={idx === courses.length - 1} className="p-1 rounded-lg hover:bg-accent disabled:opacity-20 transition-colors">
                <ChevronDown className="h-4 w-4 text-muted-foreground" />
              </button>
            </div>
            {c.thumbnail ? <img src={c.thumbnail} alt="" className="w-24 sm:w-28 aspect-video rounded-lg object-cover flex-shrink-0" /> : <div className="w-24 sm:w-28 aspect-video bg-muted rounded-lg flex-shrink-0 flex items-center justify-center"><Image className="h-5 w-5 text-muted-foreground/40" /></div>}
            <div className="flex-1 min-w-0">
              <p className="font-medium text-foreground text-sm truncate">{c.courseName}</p>
              <p className="text-xs text-muted-foreground mt-0.5">৳{c.price} • {c.subjects?.length || 0} subjects</p>
              {(c as any).isActive === false && (
                <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-destructive/10 text-destructive border border-destructive/20 mt-1">
                  <PowerOff className="h-2.5 w-2.5" /> Expired
                </span>
              )}
            </div>
            <div className="flex gap-1 flex-shrink-0">
              <button onClick={() => navigate(`/admin/courses/add?edit=${c.id}`)} className="p-2 rounded-lg hover:bg-accent transition-colors"><Edit className="h-4 w-4 text-muted-foreground" /></button>

              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <button
                    className={`p-2 rounded-lg transition-colors ${
                      (c as any).isActive === false
                        ? "hover:bg-green-500/10 text-green-600"
                        : "hover:bg-amber-500/10 text-amber-600"
                    }`}
                    title={(c as any).isActive === false ? "Restore Course" : "Expire Course"}
                  >
                    {(c as any).isActive === false
                      ? <Power className="h-4 w-4" />
                      : <PowerOff className="h-4 w-4" />}
                  </button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>
                      {(c as any).isActive === false ? "কোর্স Restore করবেন?" : "কোর্স Expire করবেন?"}
                    </AlertDialogTitle>
                    <AlertDialogDescription>
                      {(c as any).isActive === false
                        ? `"${c.courseName}" কোর্সটি আবার active করা হবে। students পুনরায় exam access পাবে।`
                        : `"${c.courseName}" কোর্সটি expired করা হবে। সকল enrolled students-এর exam access বন্ধ হয়ে যাবে।`}
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>বাতিল</AlertDialogCancel>
                    <AlertDialogAction
                      onClick={() => handleToggleActive(c)}
                      className={(c as any).isActive === false
                        ? "bg-green-600 hover:bg-green-700"
                        : "bg-amber-600 hover:bg-amber-700"}
                    >
                      {(c as any).isActive === false ? "হ্যাঁ, Restore করুন" : "হ্যাঁ, Expire করুন"}
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>

              <AlertDialog>
                <AlertDialogTrigger asChild><button className="p-2 rounded-lg hover:bg-destructive/10 transition-colors"><Trash2 className="h-4 w-4 text-destructive/70" /></button></AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader><AlertDialogTitle>Delete Course</AlertDialogTitle><AlertDialogDescription>This will permanently delete "{c.courseName}".</AlertDialogDescription></AlertDialogHeader>
                  <AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel><AlertDialogAction onClick={() => handleDelete(c.id)}>Delete</AlertDialogAction></AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          </div>
        );})}
      </div>

      {courses.length > PAGE_SIZE && (
        <div className="flex items-center justify-center gap-2 mt-4">
          <button onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1}
            className="p-2 rounded-lg bg-card border border-border disabled:opacity-30">
            <ChevronLeft className="h-4 w-4" />
          </button>
          <span className="text-sm text-muted-foreground">
            {currentPage} / {Math.ceil(courses.length / PAGE_SIZE)}
          </span>
          <button onClick={() => setCurrentPage(p => Math.min(Math.ceil(courses.length / PAGE_SIZE), p + 1))}
            disabled={currentPage >= Math.ceil(courses.length / PAGE_SIZE)}
            className="p-2 rounded-lg bg-card border border-border disabled:opacity-30">
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      )}
    </div>
  );
}
