import type { CourseData, Duration, PageType, PlaylistLayout } from "@repo/core/types";
import { ZERO_DURATION } from "@repo/core/constants";
import { courseRepository } from "../storage/course-repository";
import { createAbortError } from "./dom-utils";

// --- Content State ---

/**
 * Mutable state for the content script.
 *
 * Split into three logical groups:
 * - **Page context**: set by the router on navigation
 * - **Course data cache**: loaded from CourseRepository, refreshed on storage changes
 * - **Preferences**: user settings synced across tabs
 */
export interface ContentState {
  // Page context (set by the router)
  currentPage: PageType | null;
  playlistId: string | null;
  isYtCourse: boolean;
  playlistLayout: PlaylistLayout | null;

  // Course data cache (loaded from CourseRepository)
  videoWatchStatus: Record<string, boolean>;
  totalDuration: Duration;
  watchedDuration: Duration;
  investedTime: Duration;
  courseImgSrc: string | null;
  courseName: string | null;
  lastWatchedVideoId: string | null;
  lastInteractedAt: number | null;

  // Preferences
  focusMode: boolean;
}

export const state: ContentState = {
  currentPage: null,
  playlistId: null,
  isYtCourse: false,
  playlistLayout: null,

  videoWatchStatus: {},
  totalDuration: { ...ZERO_DURATION },
  watchedDuration: { ...ZERO_DURATION },
  investedTime: { ...ZERO_DURATION },
  courseImgSrc: null,
  courseName: null,
  lastWatchedVideoId: null,
  lastInteractedAt: null,

  focusMode: false,
};

// --- State Helpers ---

/**
 * Returns true if the current playlist is an enrolled (tracked) course.
 */
export function isEnrolledCourse(): boolean {
  return Object.keys(state.videoWatchStatus).length > 0;
}

/**
 * Builds a {@link CourseData} object from the current state cache.
 * Used when saving to the CourseRepository.
 */
export function buildCourseData(): CourseData {
  return {
    videoWatchStatus: state.videoWatchStatus,
    totalDuration: state.totalDuration,
    watchedDuration: state.watchedDuration,
    investedTime: state.investedTime,
    courseImgSrc: state.courseImgSrc,
    courseName: state.courseName,
    lastWatchedVideoId: state.lastWatchedVideoId,
    lastInteractedAt: state.lastInteractedAt,
  };
}

/**
 * Loads course data from the CourseRepository into the state cache.
 * Also loads the focusMode preference.
 *
 * @throws AbortError if the signal is aborted.
 */
export async function loadCourseData(
  playlistId: string,
  signal: AbortSignal,
): Promise<void> {
  if (signal.aborted) throw createAbortError();

  const [courseData, focusMode] = await Promise.all([
    courseRepository.getCourse(playlistId),
    courseRepository.getFocusMode(),
  ]);

  if (signal.aborted) throw createAbortError();

  state.playlistId = playlistId;
  state.focusMode = focusMode;

  if (courseData) {
    state.videoWatchStatus = courseData.videoWatchStatus;
    state.totalDuration = courseData.totalDuration;
    state.watchedDuration = courseData.watchedDuration;
    state.investedTime = courseData.investedTime;
    state.courseImgSrc = courseData.courseImgSrc;
    state.courseName = courseData.courseName;
    state.lastWatchedVideoId = courseData.lastWatchedVideoId;
    state.lastInteractedAt = courseData.lastInteractedAt;
  } else {
    resetCourseData();
  }
}

/**
 * Resets the course data cache to defaults.
 * Called when navigating to an unenrolled playlist or away from a course page.
 */
export function resetCourseData(): void {
  state.videoWatchStatus = {};
  state.totalDuration = { ...ZERO_DURATION };
  state.watchedDuration = { ...ZERO_DURATION };
  state.investedTime = { ...ZERO_DURATION };
  state.courseImgSrc = null;
  state.courseName = null;
  state.lastWatchedVideoId = null;
  state.lastInteractedAt = null;
}

/**
 * Saves the current state cache back to the CourseRepository.
 * No-op if there's no active playlist.
 */
export function saveCourseState(): void {
  if (!state.playlistId) return;
  courseRepository.saveCourse(state.playlistId, buildCourseData());
}
