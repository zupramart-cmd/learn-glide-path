import { useEffect, useState } from "react";
import { db } from "@/lib/firebase";
import { Course } from "@/types";
import { Link } from "react-router-dom";
import { FloatingButtons } from "@/components/FloatingButtons";
import { CourseGridSkeleton } from "@/components/skeletons/CourseCardSkeleton";
import { getCachedCollection } from "@/lib/firestoreCache";

export default function HomePage() {
  const [courses, setCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetch = async () => {
      const list = await getCachedCollection<Course>(db, "courses");
      list.sort((a: any, b: any) => (a.order || 0) - (b.order || 0));
      setCourses(list);
      setLoading(false);
    };
    fetch();
  }, []);

  if (loading) {
    return (
      <div className="px-3 pt-4 sm:p-4">
        <h2 className="text-xl font-semibold text-foreground mb-4">
          All Courses
        </h2>
        <CourseGridSkeleton count={6} />
      </div>
    );
  }

  return (
    <div className="px-3 pt-4 sm:p-4">
      <h2 className="text-xl font-semibold text-foreground mb-4">
        All Courses
      </h2>

      {courses.length === 0 ? (
        <p className="text-muted-foreground text-center py-8">
          No courses available yet.
        </p>
      ) : (
        <div className="flex flex-col gap-2 sm:grid sm:grid-cols-2 lg:grid-cols-3 sm:gap-4">
          {courses.map((course) => (
            <div
              key={course.id}
              className="bg-card rounded-md shadow-card overflow-hidden border border-border hover:shadow-md transition-shadow"
            >
              {course.thumbnail ? (
                <img
                  src={course.thumbnail}
                  alt={course.courseName}
                  className="w-full aspect-video object-cover"
                />
              ) : (
                <div className="w-full aspect-video bg-muted flex items-center justify-center">
                  <span className="text-muted-foreground">No Image</span>
                </div>
              )}

              <div className="p-3">
                <h3 className="font-semibold text-foreground text-base line-clamp-2">
                  {course.courseName}
                </h3>

                <p className="text-muted-foreground mt-1 font-medium">
                  ৳{course.price}
                </p>

                <Link
                  to={`/course/${course.id}`}
                  className="inline-block mt-3 px-3 py-1.5 text-sm font-medium rounded-md bg-primary text-primary-foreground hover:opacity-90 transition-opacity"
                >
                  View Details
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}

      <FloatingButtons />
    </div>
  );
}
