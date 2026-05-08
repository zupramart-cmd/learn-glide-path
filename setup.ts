import { useEffect, useState } from "react";
import { collection, addDoc, Timestamp } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Course, Video } from "@/types";
import { getCachedCollection, invalidateCache } from "@/lib/firestoreCache";
import { toast } from "sonner";
import { ImageUrlInput } from "@/components/ImageUrlInput";
import { Film, CheckCircle, Radio } from "lucide-react";

export default function AdminAddVideoPage() {
  const [courses, setCourses] = useState<Course[]>([]);
  const [videos, setVideos] = useState<Video[]>([]);
  const [courseId, setCourseId] = useState("");
  const [subjectId, setSubjectId] = useState("");
  const [chapterId, setChapterId] = useState("");
  const [title, setTitle] = useState("");
  const [thumbnail, setThumbnail] = useState("");
  const [videoURL, setVideoURL] = useState("");
  const [pdfURL, setPdfURL] = useState("");
  const [isLive, setIsLive] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    Promise.all([
      getCachedCollection<Course>(db, "courses"),
      getCachedCollection<Video>(db, "videos"),
    ]).then(([courses_, videos_]) => {
      setCourses(courses_);
      setVideos(videos_);
    });
  }, []);

  const selectedCourse = courses.find((c) => c.id === courseId);
  const selectedSubject = selectedCourse?.subjects?.find((s) => s.subjectId === subjectId);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const course = courses.find((c) => c.id === courseId);
      const subject = course?.subjects?.find((s) => s.subjectId === subjectId);
      const chapter = subject?.chapters?.find((ch) => ch.chapterId === chapterId);

      const sameSubjectVideos = videos.filter(
        (v) => v.courseId === courseId && v.subjectId === subjectId
      );
      const maxOrder =
        sameSubjectVideos.length > 0
          ? Math.max(...sameSubjectVideos.map((v) => v.order || 0))
          : -1;

      await addDoc(collection(db, "videos"), {
        courseId,
        courseName: course?.courseName || "",
        subjectId,
        subjectName: subject?.subjectName || "",
        chapterId: chapterId || "",
        chapterName: chapter?.chapterName || "",
        title,
        thumbnail,
        videoURL,
        pdfURL,
        isLive,
        order: maxOrder + 1,
        createdAt: Timestamp.now(),
      });

      toast.success("Video added successfully!");
      setSuccess(true);
      setTimeout(() => setSuccess(false), 2000);
      setTitle("");
      setThumbnail("");
      setVideoURL("");
      setPdfURL("");
      setChapterId("");
      setIsLive(false);

      invalidateCache("videos");
      const freshVideos = await getCachedCollection<Video>(db, "videos");
      setVideos(freshVideos);
    } catch (err: any) {
      toast.error(err.message);
    }
    setSubmitting(false);
  };

  return (
    <div
      className="animate-fade-in w-full max-w-2xl mx-auto overflow-x-hidden overflow-y-auto pb-8 px-3 sm:px-4 pt-4"
      style={{ maxWidth: "100vw" }}
    >
      <h2 className="text-lg font-semibold text-foreground mb-4 flex items-center gap-2">
        <Film className="h-5 w-5" /> Quick Add Video
      </h2>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="rounded-xl border border-border bg-card/50 overflow-hidden">
          <div className="flex items-center gap-2 px-4 py-2.5 bg-accent/30 border-b border-border">
            <Film className="h-4 w-4 text-primary" />
            <span className="text-sm font-medium text-foreground">Video Details</span>
          </div>
          <div className="p-4 space-y-3">
            {/* Course */}
            <div>
              <label className="text-xs font-medium text-muted-foreground">Course</label>
              <select
                value={courseId}
                onChange={(e) => {
                  setCourseId(e.target.value);
                  setSubjectId("");
                  setChapterId("");
                }}
                required
                className="w-full px-3 py-2.5 rounded-lg bg-background border border-border text-foreground text-sm mt-1 focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-all"
              >
                <option value="">Select Course</option>
                {courses.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.courseName}
                  </option>
                ))}
              </select>
            </div>

            {/* Subject */}
            {selectedCourse?.subjects?.length ? (
              <div>
                <label className="text-xs font-medium text-muted-foreground">Subject</label>
                <select
                  value={subjectId}
                  onChange={(e) => {
                    setSubjectId(e.target.value);
                    setChapterId("");
                  }}
                  required
                  className="w-full px-3 py-2.5 rounded-lg bg-background border border-border text-foreground text-sm mt-1 focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-all"
                >
                  <option value="">Select Subject</option>
                  {selectedCourse.subjects.map((s) => (
                    <option key={s.subjectId} value={s.subjectId}>
                      {s.subjectName}
                    </option>
                  ))}
                </select>
              </div>
            ) : null}

            {/* Chapter */}
            {selectedSubject?.chapters?.length ? (
              <div>
                <label className="text-xs font-medium text-muted-foreground">
                  Chapter (Optional)
                </label>
                <select
                  value={chapterId}
                  onChange={(e) => setChapterId(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-lg bg-background border border-border text-foreground text-sm mt-1 focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-all"
                >
                  <option value="">Select Chapter</option>
                  {selectedSubject.chapters.map((ch) => (
                    <option key={ch.chapterId} value={ch.chapterId}>
                      {ch.chapterName}
                    </option>
                  ))}
                </select>
              </div>
            ) : null}

            {/* Title */}
            <div>
              <label className="text-xs font-medium text-muted-foreground">Video Title</label>
              <input
                type="text"
                placeholder="Video Title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                required
                className="w-full px-3 py-2.5 rounded-lg bg-background border border-border text-foreground text-sm mt-1 focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-all"
              />
            </div>

            <ImageUrlInput
              label="Thumbnail URL"
              value={thumbnail}
              onChange={setThumbnail}
              placeholder="https://i.postimg.cc/..."
            />

            {/* YouTube URL */}
            <div>
              <label className="text-xs font-medium text-muted-foreground">YouTube Video URL</label>
              <input
                type="text"
                placeholder="https://youtube.com/..."
                value={videoURL}
                onChange={(e) => setVideoURL(e.target.value)}
                required
                className="w-full px-3 py-2.5 rounded-lg bg-background border border-border text-foreground text-sm mt-1 focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-all"
              />
            </div>

            {/* PDF URL */}
            <div>
              <label className="text-xs font-medium text-muted-foreground">PDF URL (Optional)</label>
              <input
                type="text"
                placeholder="https://..."
                value={pdfURL}
                onChange={(e) => setPdfURL(e.target.value)}
                className="w-full px-3 py-2.5 rounded-lg bg-background border border-border text-foreground text-sm mt-1 focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-all"
              />
            </div>

            {/* ── Live Video Toggle ── */}
            <div
              onClick={() => setIsLive((prev) => !prev)}
              className={`flex items-center justify-between px-4 py-3 rounded-lg border cursor-pointer transition-all select-none ${
                isLive
                  ? "bg-red-500/10 border-red-500/40"
                  : "bg-background border-border hover:bg-accent/40"
              }`}
            >
              <div className="flex items-center gap-2.5">
                <Radio
                  className={`h-4 w-4 ${isLive ? "text-red-500" : "text-muted-foreground"}`}
                />
                <div>
                  <p
                    className={`text-sm font-medium ${
                      isLive ? "text-red-500" : "text-foreground"
                    }`}
                  >
                    Live Class
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {isLive
                      ? "Students will see a LIVE indicator"
                      : "Mark this video as a live class"}
                  </p>
                </div>
              </div>
              {/* Toggle pill */}
              <div
                className={`relative w-11 h-6 rounded-full transition-colors duration-200 ${
                  isLive ? "bg-red-500" : "bg-muted"
                }`}
              >
                <div
                  className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform duration-200 ${
                    isLive ? "translate-x-5" : "translate-x-0"
                  }`}
                />
              </div>
            </div>
          </div>
        </div>

        <button
          type="submit"
          disabled={submitting}
          className={`w-full py-3 rounded-xl font-semibold text-sm disabled:opacity-50 transition-all active:scale-[0.98] shadow-sm flex items-center justify-center gap-2 ${
            success ? "bg-success text-white" : "bg-primary text-primary-foreground"
          }`}
        >
          {success ? (
            <>
              <CheckCircle className="h-4 w-4" /> Added!
            </>
          ) : submitting ? (
            "Adding..."
          ) : (
            "Add Video"
          )}
        </button>
      </form>
    </div>
  );
}
