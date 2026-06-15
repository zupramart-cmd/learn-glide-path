import { Skeleton } from "@/components/ui/skeleton";

// ── Course Skeletons ──

export function CourseCardSkeleton() {
  return (
    <div className="bg-card rounded-md shadow-card overflow-hidden border border-border">
      <Skeleton className="w-full aspect-video" />
      <div className="p-3 space-y-1">
        <Skeleton className="h-5 w-full" />
        <Skeleton className="h-5 w-2/3" />
        <Skeleton className="h-4 w-16 mt-1" />
        <Skeleton className="h-8 w-28 mt-3" />
      </div>
    </div>
  );
}

export function CourseGridSkeleton({ count = 6 }: { count?: number }) {
  return (
    <div className="flex flex-col gap-2 sm:grid sm:grid-cols-2 lg:grid-cols-3 sm:gap-4">
      {Array.from({ length: count }).map((_, i) => (
        <CourseCardSkeleton key={i} />
      ))}
    </div>
  );
}

export function CourseDetailsSkeleton() {
  return (
    <div className="p-4 max-w-3xl mx-auto space-y-4">
      <Skeleton className="w-full h-48 sm:h-64 rounded-lg" />
      <Skeleton className="h-7 w-2/3" />
      <Skeleton className="h-6 w-20" />
      <div className="space-y-2 mt-4">
        <Skeleton className="h-5 w-24" />
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-4 w-full" />
        ))}
      </div>
      <div className="mt-6 space-y-3">
        <Skeleton className="h-5 w-28" />
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {Array.from({ length: 2 }).map((_, i) => (
            <div key={i} className="flex items-center gap-3 p-3 bg-card rounded-lg border border-border">
              <Skeleton className="w-10 h-10 rounded-full" />
              <div className="space-y-1">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-3 w-16" />
              </div>
            </div>
          ))}
        </div>
      </div>
      <Skeleton className="h-11 w-32 mt-6" />
    </div>
  );
}

// ── Video Skeletons ──

export function VideoCardSkeleton() {
  return (
    <div className="bg-card rounded-xl overflow-hidden border border-border">
      <Skeleton className="w-full aspect-video" />
      <div className="p-3 space-y-2">
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-3 w-2/3" />
      </div>
    </div>
  );
}

export function VideoGridSkeleton({ count = 6 }: { count?: number }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
      {Array.from({ length: count }).map((_, i) => (
        <VideoCardSkeleton key={i} />
      ))}
    </div>
  );
}

export function VideoListItemSkeleton() {
  return (
    <div className="flex gap-3 p-2">
      <Skeleton className="w-28 h-16 rounded-md flex-shrink-0" />
      <div className="flex-1 space-y-2">
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-3 w-20" />
      </div>
    </div>
  );
}

export function VideoPlayerSkeleton() {
  return (
    <div className="lg:flex lg:gap-4 lg:p-4 h-[calc(100vh-3.5rem)]">
      <div className="lg:flex-1 flex flex-col h-full">
        <div className="shrink-0">
          <Skeleton className="w-full aspect-video" />
          <div className="p-4 space-y-3">
            <Skeleton className="h-5 w-3/4" />
            <div className="flex gap-2">
              <Skeleton className="h-9 w-24" />
              <Skeleton className="h-9 w-20" />
              <Skeleton className="h-9 w-16" />
            </div>
          </div>
        </div>
        <div className="flex-1 p-4 lg:hidden space-y-2">
          <Skeleton className="h-5 w-28 mb-3" />
          {Array.from({ length: 4 }).map((_, i) => (
            <VideoListItemSkeleton key={i} />
          ))}
        </div>
      </div>
      <div className="hidden lg:block lg:w-80 space-y-2">
        <Skeleton className="h-5 w-28 mb-3" />
        {Array.from({ length: 5 }).map((_, i) => (
          <VideoListItemSkeleton key={i} />
        ))}
      </div>
    </div>
  );
}

// ── Admin Skeletons ──

export function AdminDashboardSkeleton() {
  return (
    <div className="p-4 space-y-4">
      <Skeleton className="h-7 w-32" />
      <div className="grid grid-cols-2 gap-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="p-4 bg-card rounded-lg border border-border space-y-2">
            <Skeleton className="h-6 w-6 rounded" />
            <Skeleton className="h-8 w-12" />
            <Skeleton className="h-4 w-20" />
          </div>
        ))}
      </div>
    </div>
  );
}

export function AdminListSkeleton({ count = 5 }: { count?: number }) {
  return (
    <div className="p-4 max-w-4xl mx-auto space-y-4">
      <div className="flex items-center justify-between">
        <Skeleton className="h-7 w-32" />
        <Skeleton className="h-9 w-20" />
      </div>
      <Skeleton className="h-10 w-full rounded-md" />
      <div className="space-y-2">
        {Array.from({ length: count }).map((_, i) => (
          <div key={i} className="p-3 bg-card rounded-lg border border-border flex items-center gap-3">
            <Skeleton className="w-10 h-10 rounded-full flex-shrink-0" />
            <div className="flex-1 space-y-1">
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-3 w-48" />
            </div>
            <Skeleton className="h-5 w-16 rounded-full" />
          </div>
        ))}
      </div>
    </div>
  );
}

export function AdminVideoListSkeleton({ count = 5 }: { count?: number }) {
  return (
    <div className="p-4 max-w-4xl mx-auto space-y-4">
      <div className="flex items-center justify-between">
        <Skeleton className="h-7 w-32" />
        <Skeleton className="h-9 w-20" />
      </div>
      <Skeleton className="h-10 w-full rounded-md" />
      <div className="space-y-2">
        {Array.from({ length: count }).map((_, i) => (
          <div key={i} className="p-3 bg-card rounded-lg border border-border flex items-center gap-3">
            <Skeleton className="w-20 h-12 rounded-md flex-shrink-0" />
            <div className="flex-1 space-y-1">
              <Skeleton className="h-4 w-40" />
              <Skeleton className="h-3 w-28" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function AdminCourseListSkeleton({ count = 4 }: { count?: number }) {
  return (
    <div className="p-4 max-w-4xl mx-auto space-y-4">
      <div className="flex items-center justify-between">
        <Skeleton className="h-7 w-32" />
        <Skeleton className="h-9 w-20" />
      </div>
      <div className="space-y-3">
        {Array.from({ length: count }).map((_, i) => (
          <div key={i} className="p-3 bg-card rounded-lg border border-border flex items-center gap-3">
            <Skeleton className="w-16 h-16 rounded-md flex-shrink-0" />
            <div className="flex-1 space-y-1">
              <Skeleton className="h-4 w-40" />
              <Skeleton className="h-3 w-28" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Exam Skeletons ──

export function ExamListSkeleton({ count = 4 }: { count?: number }) {
  return (
    <div className="p-4 max-w-2xl mx-auto space-y-3">
      <Skeleton className="h-7 w-28 mb-4" />
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="bg-card rounded-2xl border border-border overflow-hidden">
          <div className="p-4 space-y-3">
            <div className="flex items-start justify-between">
              <Skeleton className="h-4 w-3/5" />
              <Skeleton className="h-5 w-16 rounded-full" />
            </div>
            <div className="flex gap-1.5">
              <Skeleton className="h-5 w-14 rounded-full" />
              <Skeleton className="h-5 w-16 rounded-full" />
              <Skeleton className="h-5 w-20 rounded-full" />
            </div>
            <Skeleton className="h-3 w-32" />
          </div>
        </div>
      ))}
    </div>
  );
}

export function ExamLoadingSkeleton() {
  return (
    <div className="p-4 max-w-lg mx-auto space-y-4">
      <Skeleton className="h-5 w-20" />
      <div className="bg-card rounded-2xl border border-border overflow-hidden">
        <div className="p-5 space-y-3">
          <Skeleton className="h-10 w-10 rounded-xl" />
          <Skeleton className="h-5 w-3/4" />
          <Skeleton className="h-4 w-1/2" />
        </div>
        <div className="grid grid-cols-2 gap-px bg-border">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="bg-card px-4 py-3 space-y-1">
              <Skeleton className="h-3 w-12" />
              <Skeleton className="h-4 w-16" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export function ProfileSkeleton() {
  return (
    <div className="p-4 max-w-lg mx-auto space-y-4">
      <div className="bg-card rounded-xl border border-border p-5 text-center space-y-3">
        <Skeleton className="w-16 h-16 rounded-full mx-auto" />
        <Skeleton className="h-5 w-32 mx-auto" />
        <Skeleton className="h-4 w-48 mx-auto" />
      </div>
      <div className="bg-card rounded-xl border border-border p-4 space-y-3">
        <Skeleton className="h-4 w-32" />
        {Array.from({ length: 2 }).map((_, i) => (
          <div key={i} className="flex items-center gap-3 p-3 rounded-lg border border-border">
            <Skeleton className="w-10 h-10 rounded-md" />
            <div className="flex-1 space-y-1">
              <Skeleton className="h-4 w-28" />
              <Skeleton className="h-3 w-16" />
            </div>
          </div>
        ))}
      </div>
      <Skeleton className="h-12 w-full rounded-xl" />
    </div>
  );
}

// ── Form Page Skeleton (Add/Edit Video, Course, Exam) ──
export function FormPageSkeleton({ sections = 3, fieldsPerSection = 3 }: { sections?: number; fieldsPerSection?: number }) {
  return (
    <div className="w-full max-w-2xl mx-auto px-3 sm:px-4 pt-4 pb-8 space-y-4">
      <div className="flex items-center gap-2 mb-2">
        <Skeleton className="h-5 w-5 rounded" />
        <Skeleton className="h-6 w-44" />
      </div>
      {Array.from({ length: sections }).map((_, s) => (
        <div key={s} className="rounded-xl border border-border bg-card/50 overflow-hidden">
          <div className="flex items-center gap-2 px-4 py-2.5 bg-accent/30 border-b border-border">
            <Skeleton className="h-4 w-4 rounded" />
            <Skeleton className="h-4 w-32" />
          </div>
          <div className="p-4 space-y-3">
            {Array.from({ length: fieldsPerSection }).map((_, i) => (
              <div key={i} className="space-y-1.5">
                <Skeleton className="h-3 w-24" />
                <Skeleton className="h-10 w-full rounded-lg" />
              </div>
            ))}
          </div>
        </div>
      ))}
      <Skeleton className="h-11 w-full rounded-lg" />
    </div>
  );
}

// ── Settings Page Skeleton ──
export function SettingsPageSkeleton() {
  return <FormPageSkeleton sections={4} fieldsPerSection={3} />;
}

// ── Submission/Results list (admin exam results) ──
export function SubmissionListSkeleton({ count = 5 }: { count?: number }) {
  return (
    <div className="space-y-2">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="bg-card border border-border rounded-xl p-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Skeleton className="w-8 h-8 rounded-full" />
            <div className="space-y-1.5">
              <Skeleton className="h-4 w-28" />
              <Skeleton className="h-3 w-20" />
            </div>
          </div>
          <Skeleton className="h-5 w-12 rounded-full" />
        </div>
      ))}
    </div>
  );
}

// ── Backup / Data Page Skeleton ──
export function DataPageSkeleton() {
  return (
    <div className="p-4 max-w-3xl mx-auto space-y-4">
      <Skeleton className="h-7 w-40" />
      {Array.from({ length: 3 }).map((_, i) => (
        <div key={i} className="rounded-xl border border-border bg-card p-4 space-y-3">
          <div className="flex items-center gap-2">
            <Skeleton className="h-5 w-5 rounded" />
            <Skeleton className="h-4 w-32" />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <Skeleton className="h-10 rounded-lg" />
            <Skeleton className="h-10 rounded-lg" />
          </div>
        </div>
      ))}
    </div>
  );
}
