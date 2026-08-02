import { durationToSeconds, secondsToDuration } from "@repo/core/duration";

import { courseRepository } from "../../../../storage/course-repository";
import { createAbortError } from "../../core/dom-utils";
import { buildCourseData, isEnrolledCourse, state } from "../../core/state";

const TRACKING_INCREMENT_SECONDS = 30;
const TRACKING_INTERVAL_MS = TRACKING_INCREMENT_SECONDS * 1000;

export interface InvestedTimeTrackerOptions {
  signal: AbortSignal;
}

/**
 * Tracks invested time while the enrolled course tab is visible.
 *
 * The tracker mutates and persists course state only. UI updates remain the
 * responsibility of storage listeners and page UI modules.
 */
export function initializeInvestedTimeTracker({
  signal
}: InvestedTimeTrackerOptions): () => void {
  if (signal.aborted) throw createAbortError();

  let intervalId: ReturnType<typeof setInterval> | null = null;
  let isDisposed = false;

  function persistTick(): void {
    const playlistId = state.playlistId;
    if (!playlistId || !isEnrolledCourse()) return;

    state.investedTime = secondsToDuration(
      durationToSeconds(state.investedTime) + TRACKING_INCREMENT_SECONDS
    );

    void courseRepository
      .saveCourse(playlistId, buildCourseData())
      .catch((error: unknown) => {
        console.error("[TMC] Failed to persist invested time:", error);
      });
  }

  function startTracking(): void {
    if (
      isDisposed ||
      intervalId !== null ||
      document.visibilityState !== "visible" ||
      !isEnrolledCourse()
    ) {
      return;
    }

    intervalId = setInterval(persistTick, TRACKING_INTERVAL_MS);
  }

  function stopTracking(): void {
    if (intervalId === null) return;
    clearInterval(intervalId);
    intervalId = null;
  }

  function handleVisibilityChange(): void {
    if (document.visibilityState === "hidden") {
      stopTracking();
    } else {
      startTracking();
    }
  }

  function cleanup(): void {
    if (isDisposed) return;
    isDisposed = true;
    stopTracking();
    document.removeEventListener("visibilitychange", handleVisibilityChange);
  }

  if (isEnrolledCourse()) {
    document.addEventListener("visibilitychange", handleVisibilityChange);
    startTracking();
  }

  return cleanup;
}
