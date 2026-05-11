import { useEffect } from "react";
import { Exam } from "@/types/exam";

/**
 * Admin-side hook: auto-publishes results once an exam's endTime passes.
 * - On mount, immediately publishes any exams whose endTime is already in the past.
 * - Schedules a setTimeout for any exam whose endTime is in the future.
 */
export function useExamAutoPublish(
  exams: Exam[],
  publishFn: (exam: Exam) => Promise<void>
) {
  // Use a stable dep key so we don't re-run on every render.
  const key = exams.map(e => `${e.id}:${e.resultPublished ? 1 : 0}`).join(",");

  useEffect(() => {
    const timers: ReturnType<typeof setTimeout>[] = [];
    const now = Date.now();

    exams.forEach(exam => {
      if (exam.resultPublished) return;
      const endMs = exam.endTime?.toMillis?.() || 0;
      if (!endMs) return;

      if (endMs < now) {
        publishFn(exam).catch(console.error);
      } else {
        const delay = endMs - now + 10_000; // 10s after end
        const t = setTimeout(() => {
          publishFn(exam).catch(console.error);
        }, delay);
        timers.push(t);
      }
    });

    return () => timers.forEach(clearTimeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
}
