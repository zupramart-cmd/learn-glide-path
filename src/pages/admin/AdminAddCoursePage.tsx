import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { collection, addDoc, updateDoc, doc, getDoc, Timestamp } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { getCachedCollection, invalidateCache, bumpVersion } from "@/lib/firestoreCache";
import { Course, Subject, Instructor, DiscussionGroup } from "@/types";
import { toast } from "sonner";
import {
  Plus, Trash2, X, ArrowLeft, GripVertical,
  BookOpen, Users, MessageSquare, FileText, Link2,
} from "lucide-react";
import { ImageUrlInput } from "@/components/ImageUrlInput";
import { FormPageSkeleton } from "@/components/skeletons";

/* ── Section wrapper ── */
const FormSection = ({ icon: Icon, title, children }: { icon: any; title: string; children: React.ReactNode }) => (
  <div className="rounded-xl border border-border bg-card/50 overflow-hidden">
    <div className="flex items-center gap-2 px-4 py-2.5 bg-accent/30 border-b border-border">
      <Icon className="h-4 w-4 text-primary" />
      <span className="text-sm font-medium text-foreground">{title}</span>
    </div>
    <div className="p-4 space-y-3">{children}</div>
  </div>
);

const FormInput = ({ label, ...props }: { label?: string } & React.InputHTMLAttributes<HTMLInputElement>) => (
  <div className="space-y-1">
    {label && <label className="text-xs font-medium text-muted-foreground">{label}</label>}
    <input {...props} className="w-full px-3 py-2.5 rounded-lg bg-background border border-border text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-all placeholder:text-muted-foreground/60" />
  </div>
);

export default function AdminAddCoursePage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const editId = searchParams.get("edit");

  const [editCourse, setEditCourse] = useState<Course | null>(null);
  const [loading, setLoading] = useState(!!editId);
  const [coursesCount, setCoursesCount] = useState(0);

  const [courseName, setCourseName] = useState("");
  const [thumbnailUrl, setThumbnailUrl] = useState("");
  const [price, setPrice] = useState(0);
  const [overview, setOverview] = useState<string[]>([""]);
  const [subjects, setSubjects] = useState<Subject[]>([{ subjectId: crypto.randomUUID(), subjectName: "", chapters: [] }]);
  const [instructors, setInstructors] = useState<Instructor[]>([{ name: "", subject: "", image: "" }]);
  const [discussionGroups, setDiscussionGroups] = useState<DiscussionGroup[]>([{ name: "", link: "" }]);
  const [routinePDF, setRoutinePDF] = useState("");
  const [allMaterialsLink, setAllMaterialsLink] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    getCachedCollection<Course>(db, "courses").then((list) => setCoursesCount(list.length));
  }, []);

  useEffect(() => {
    if (!editId) return;
    getDoc(doc(db, "courses", editId)).then((snap) => {
      if (snap.exists()) {
        const c = { id: snap.id, ...snap.data() } as Course;
        setEditCourse(c);
        setCourseName(c.courseName); setThumbnailUrl(c.thumbnail); setPrice(c.price);
        setOverview(c.overview?.length ? c.overview : [""]);
        setSubjects(c.subjects?.length ? c.subjects : [{ subjectId: crypto.randomUUID(), subjectName: "", chapters: [] }]);
        setInstructors(c.instructors?.length ? c.instructors : [{ name: "", subject: "", image: "" }]);
        setDiscussionGroups(c.discussionGroups?.length ? c.discussionGroups : [{ name: "", link: "" }]);
        setRoutinePDF(c.routinePDF || "");
        setAllMaterialsLink(c.allMaterialsLink || "");
      } else {
        toast.error("Course not found");
      }
      setLoading(false);
    }).catch(() => setLoading(false));
  }, [editId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault(); setSubmitting(true);
    try {
      const filteredSubjects = subjects.filter((s) => s.subjectName);
      const data: any = {
        courseName, thumbnail: thumbnailUrl, price, overview: overview.map(p => p.trim()).filter(Boolean),
        subjects: filteredSubjects,
        instructors: instructors.filter((i) => i.name),
        discussionGroups: discussionGroups.filter((g) => g.name && g.link),
        routinePDF, allMaterialsLink, createdAt: Timestamp.now(),
      };
      if (editCourse) {
        data.order = (editCourse as any).order || 0;
        await updateDoc(doc(db, "courses", editCourse.id), data);
        toast.success("Course updated");
      } else {
        data.order = coursesCount;
        await addDoc(collection(db, "courses"), data);
        toast.success("Course added");
      }
      invalidateCache("courses");
      await bumpVersion(db, "courses");
      navigate("/admin/courses");
    } catch (err: any) { toast.error(err.message); }
    setSubmitting(false);
  };

  if (loading) return <FormPageSkeleton sections={5} fieldsPerSection={2} />;

  return (
    <div className="animate-fade-in w-full max-w-2xl mx-auto overflow-x-hidden overflow-y-auto pb-8 box-border">
      <div className="sticky top-0 z-10 bg-background/80 backdrop-blur-md border-b border-border px-4 py-3 flex items-center gap-2">
        <button onClick={() => navigate("/admin/courses")} className="text-sm text-muted-foreground hover:text-foreground transition-colors">
          <ArrowLeft className="h-5 w-5" />
        </button>
        <h2 className="text-lg font-semibold text-foreground flex items-center gap-2">
          <BookOpen className="h-5 w-5" /> {editCourse ? "Edit Course" : "Add Course"}
        </h2>
      </div>

      <form onSubmit={handleSubmit} className="px-3 sm:px-4 pt-4 space-y-4 overflow-x-hidden">
        <FormSection icon={BookOpen} title="Basic Information">
          <FormInput label="Course Name" type="text" placeholder="e.g. HSC Physics 2025" value={courseName} onChange={(e) => setCourseName(e.target.value)} required />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <ImageUrlInput label="Thumbnail URL" value={thumbnailUrl} onChange={setThumbnailUrl} placeholder="https://i.postimg.cc/..." />
            <FormInput label="Price (৳)" type="number" placeholder="0" value={price} onChange={(e) => setPrice(Number(e.target.value))} />
          </div>
        </FormSection>

        <FormSection icon={FileText} title="Overview Points">
          <div className="space-y-1.5">
            <textarea
              value={overview.join("\n")}
              onChange={(e) => setOverview(e.target.value.split("\n"))}
              placeholder={"প্রতিটা লাইনে একটি পয়েন্ট লিখুন\nEnter চাপলে নতুন পয়েন্ট হবে"}
              rows={Math.max(4, overview.length + 1)}
              className="w-full px-3 py-2.5 rounded-lg bg-background border border-border text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-all resize-y leading-relaxed"
            />
            <p className="text-[11px] text-muted-foreground/70">
              {overview.filter(Boolean).length} point{overview.filter(Boolean).length !== 1 ? "s" : ""} — প্রতি লাইন একটি পয়েন্ট
            </p>
          </div>
        </FormSection>

        <FormSection icon={BookOpen} title="Subjects & Chapters">
          {subjects.map((s, i) => (
            <div key={i} className="rounded-lg border border-border/60 bg-accent/10 overflow-hidden">
              <div className="flex gap-2 items-center p-3 bg-accent/20">
                <GripVertical className="h-4 w-4 text-muted-foreground/40 flex-shrink-0" />
                <input value={s.subjectName} onChange={(e) => { const a = [...subjects]; a[i] = { ...a[i], subjectName: e.target.value }; setSubjects(a); }} placeholder="Subject Name" className="flex-1 min-w-0 px-3 py-2 rounded-lg bg-background border border-border text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-all" />
                {subjects.length > 1 && (
                  <button type="button" onClick={() => setSubjects(subjects.filter((_, j) => j !== i))} className="p-1.5 rounded-lg hover:bg-destructive/10 text-destructive/60 hover:text-destructive transition-colors flex-shrink-0">
                    <X className="h-4 w-4" />
                  </button>
                )}
              </div>
              <div className="px-3 pb-3 pt-2 space-y-2">
                <span className="text-[11px] uppercase tracking-wider text-muted-foreground/60 font-medium">Chapters</span>
                {(s.chapters || []).map((ch, ci) => (
                  <div key={ci} className="flex gap-2 items-center pl-2">
                    <span className="text-[10px] text-muted-foreground/40 w-4 text-center flex-shrink-0">{ci + 1}</span>
                    <input value={ch.chapterName} onChange={(e) => {
                      const a = [...subjects];
                      const chapters = [...(a[i].chapters || [])];
                      chapters[ci] = { ...chapters[ci], chapterName: e.target.value };
                      a[i] = { ...a[i], chapters };
                      setSubjects(a);
                    }} placeholder={`Chapter ${ci + 1}`} className="flex-1 min-w-0 px-3 py-1.5 rounded-lg bg-background border border-border text-foreground text-xs focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-all" />
                    <button type="button" onClick={() => {
                      const a = [...subjects];
                      const chapters = (a[i].chapters || []).filter((_, j) => j !== ci);
                      a[i] = { ...a[i], chapters };
                      setSubjects(a);
                    }} className="p-1 rounded-lg hover:bg-destructive/10 text-destructive/50 hover:text-destructive transition-colors flex-shrink-0">
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                ))}
                <button type="button" onClick={() => {
                  const a = [...subjects];
                  const chapters = [...(a[i].chapters || []), { chapterId: crypto.randomUUID(), chapterName: "" }];
                  a[i] = { ...a[i], chapters };
                  setSubjects(a);
                }} className="text-[11px] font-medium text-primary hover:text-primary/80 transition-colors flex items-center gap-1 pl-2">
                  <Plus className="h-3 w-3" /> Add Chapter
                </button>
              </div>
            </div>
          ))}
          <button type="button" onClick={() => setSubjects([...subjects, { subjectId: crypto.randomUUID(), subjectName: "", chapters: [] }])} className="text-xs font-medium text-primary hover:text-primary/80 transition-colors flex items-center gap-1">
            <Plus className="h-3 w-3" /> Add Subject
          </button>
        </FormSection>

        <FormSection icon={Users} title="Instructors">
          {instructors.map((inst, i) => (
            <div key={i} className="rounded-lg border border-border/60 bg-accent/10 p-3 space-y-2.5">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <FormInput label="Name" value={inst.name} onChange={(e) => { const a = [...instructors]; a[i] = { ...a[i], name: e.target.value }; setInstructors(a); }} placeholder="Instructor name" />
                <div className="space-y-1">
                  <label className="text-xs font-medium text-muted-foreground">Subject</label>
                  <select
                    value={inst.subject}
                    onChange={(e) => { const a = [...instructors]; a[i] = { ...a[i], subject: e.target.value }; setInstructors(a); }}
                    className="w-full px-3 py-2.5 rounded-lg bg-background border border-border text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-all"
                  >
                    <option value="">Select Subject</option>
                    {subjects.filter(s => s.subjectName).map((s) => (
                      <option key={s.subjectId} value={s.subjectName}>{s.subjectName}</option>
                    ))}
                  </select>
                </div>
              </div>
              <ImageUrlInput
                label="Photo URL"
                value={inst.image}
                onChange={(url) => { const a = [...instructors]; a[i] = { ...a[i], image: url }; setInstructors(a); }}
                placeholder="https://i.postimg.cc/..."
              />
              {instructors.length > 1 && (
                <button type="button" onClick={() => { setInstructors(instructors.filter((_, j) => j !== i)); }} className="text-xs text-destructive/70 hover:text-destructive transition-colors flex items-center gap-1">
                  <Trash2 className="h-3 w-3" /> Remove
                </button>
              )}
            </div>
          ))}
          <button type="button" onClick={() => { setInstructors([...instructors, { name: "", subject: "", image: "" }]); }} className="text-xs font-medium text-primary hover:text-primary/80 transition-colors flex items-center gap-1">
            <Plus className="h-3 w-3" /> Add Instructor
          </button>
        </FormSection>

        <FormSection icon={MessageSquare} title="Discussion Groups">
          {discussionGroups.map((g, i) => (
            <div key={i} className="rounded-lg border border-border/60 bg-accent/10 p-3 space-y-2">
              <div className="flex gap-2 items-start">
                <div className="flex-1 min-w-0 space-y-2">
                  <FormInput label="Group Name" value={g.name} onChange={(e) => { const a = [...discussionGroups]; a[i] = { ...a[i], name: e.target.value }; setDiscussionGroups(a); }} placeholder="e.g. Telegram Group" />
                  <FormInput label="Link" value={g.link} onChange={(e) => { const a = [...discussionGroups]; a[i] = { ...a[i], link: e.target.value }; setDiscussionGroups(a); }} placeholder="https://..." />
                </div>
                {discussionGroups.length > 1 && (
                  <button type="button" onClick={() => setDiscussionGroups(discussionGroups.filter((_, j) => j !== i))} className="p-1.5 mt-5 rounded-lg hover:bg-destructive/10 text-destructive/60 hover:text-destructive transition-colors flex-shrink-0">
                    <X className="h-4 w-4" />
                  </button>
                )}
              </div>
            </div>
          ))}
          <button type="button" onClick={() => setDiscussionGroups([...discussionGroups, { name: "", link: "" }])} className="text-xs font-medium text-primary hover:text-primary/80 transition-colors flex items-center gap-1">
            <Plus className="h-3 w-3" /> Add Group
          </button>
        </FormSection>

        <FormSection icon={Link2} title="Resources">
          <FormInput label="Routine PDF URL" type="text" placeholder="https://..." value={routinePDF} onChange={(e) => setRoutinePDF(e.target.value)} />
          <FormInput label="All Materials Link" type="text" placeholder="https://..." value={allMaterialsLink} onChange={(e) => setAllMaterialsLink(e.target.value)} />
        </FormSection>

        <button type="submit" disabled={submitting} className="w-full py-3 rounded-xl bg-primary text-primary-foreground font-semibold text-sm disabled:opacity-50 transition-all active:scale-[0.98] shadow-sm">
          {submitting ? "Saving..." : editCourse ? "Update Course" : "Add Course"}
        </button>
      </form>
    </div>
  );
}
