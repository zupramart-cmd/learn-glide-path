import { Skeleton } from "@/components/ui/skeleton";

export function CourseCardSkeleton() {
  return (
    <div className="bg-card rounded-md shadow-card overflow-hidden border border-border">
      {/* Thumbnail */}
      <Skeleton className="w-full aspect-video" />

      {/* Content — matches actual card's p-3 padding */}
      <div className="p-3 space-y-1">
        {/* Course name — two lines like line-clamp-2 */}
        <Skeleton className="h-5 w-full" />
        <Skeleton className="h-5 w-2/3" />

        {/* Price */}
        <Skeleton className="h-4 w-16 mt-1" />

        {/* View Details button */}
        <Skeleton className="h-8 w-28 mt-3" />
      </div>
    </div>
  );
}

export function CourseGridSkeleton({ count = 6 }: { count?: number }) {
  return (
    // Matches HomePage's actual grid: flex-col on mobile, grid on sm+
    <div className="flex flex-col gap-2 sm:grid sm:grid-cols-2 lg:grid-cols-3 sm:gap-4">
      {Array.from({ length: count }).map((_, i) => (
        <CourseCardSkeleton key={i} />
      ))}
    </div>
  );
}
