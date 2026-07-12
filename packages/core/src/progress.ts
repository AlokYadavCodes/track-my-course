import type { Duration } from "./types.js";
import { durationToSeconds, secondsToDuration } from "./duration.js";

/**
 * Calculates the completion percentage of a course.
 *
 * @returns An integer from 0 to 100.
 */
export function getProgressPercent(course: {
  watchedDuration: Duration | undefined | null;
  totalDuration: Duration | undefined | null;
}): number {
  const watchedSeconds = durationToSeconds(course.watchedDuration);
  const totalSeconds = durationToSeconds(course.totalDuration);
  if (totalSeconds === 0) return 0;
  return Math.round((watchedSeconds / totalSeconds) * 100);
}

/**
 * Calculates the remaining duration of a course.
 *
 * @returns A {@link Duration} object representing time left.
 */
export function getRemainingDuration(course: {
  watchedDuration: Duration | undefined | null;
  totalDuration: Duration | undefined | null;
}): Duration {
  const totalSec = durationToSeconds(course.totalDuration);
  const watchedSec = durationToSeconds(course.watchedDuration);
  return secondsToDuration(Math.max(0, totalSec - watchedSec));
}
