import type { CourseData } from "@repo/core/types";
import { ZERO_DURATION } from "@repo/core/constants";
import { durationToSeconds, secondsToDuration } from "@repo/core/duration";

import type { PlaylistMetadata, ScannedVideo } from "../types";
import { courseRepository } from "../../../storage/course-repository";
import { imgSrcToBase64 } from "../core/dom-utils";
import { state } from "../core/state";

export interface SyncResult {
  coursesUpdated: number;
}

/**
 * Creates and persists a course from raw playlist data.
 *
 * This service owns domain shaping and persistence. It intentionally does not
 * read from or render into YouTube's DOM.
 */
export async function startCourse(
  playlistId: string,
  videos: readonly ScannedVideo[],
  metadata: PlaylistMetadata
): Promise<CourseData> {
  if (!playlistId) {
    throw new Error("Cannot start a course without a playlist ID");
  }

  const videoWatchStatus: Record<string, boolean> = {};
  let totalSeconds = 0;

  for (const video of videos) {
    if (!video.videoId || video.videoId in videoWatchStatus) continue;

    videoWatchStatus[video.videoId] = false;
    totalSeconds += normalizeDurationSeconds(video.durationSeconds);
  }

  if (Object.keys(videoWatchStatus).length === 0) {
    throw new Error("Cannot start a course without any scannable videos");
  }

  const courseData: CourseData = {
    videoWatchStatus,
    totalDuration: secondsToDuration(totalSeconds),
    watchedDuration: { ...ZERO_DURATION },
    investedTime: { ...ZERO_DURATION },
    courseImgSrc: metadata.thumbnailSrc
      ? await imgSrcToBase64(metadata.thumbnailSrc)
      : null,
    courseName: normalizeNullableText(metadata.name),
    lastWatchedVideoId: null,
    lastInteractedAt: Date.now()
  };

  updateCurrentCourseState(playlistId, courseData);
  await courseRepository.saveCourse(playlistId, courseData);

  return courseData;
}

/**
 * Rebuilds the current course from a fresh playlist scan while preserving
 * watched status for videos that were already known.
 */
export async function updateCourseFromPlaylist(
  playlistId: string,
  videos: readonly ScannedVideo[],
  metadata: PlaylistMetadata
): Promise<CourseData> {
  if (!playlistId) {
    throw new Error("Cannot update a course without a playlist ID");
  }

  const previousCourse =
    state.playlistId === playlistId
      ? state
      : await courseRepository.getCourse(playlistId);
  const previousStatus = previousCourse?.videoWatchStatus ?? {};

  const videoWatchStatus: Record<string, boolean> = {};
  let totalSeconds = 0;
  let watchedSeconds = 0;

  for (const video of videos) {
    if (!video.videoId || video.videoId in videoWatchStatus) continue;

    const durationSeconds = normalizeDurationSeconds(video.durationSeconds);
    const isWatched = previousStatus[video.videoId] ?? false;

    videoWatchStatus[video.videoId] = isWatched;
    totalSeconds += durationSeconds;
    if (isWatched) watchedSeconds += durationSeconds;
  }

  if (Object.keys(videoWatchStatus).length === 0) {
    throw new Error("Cannot update a course without any scannable videos");
  }

  const courseData: CourseData = {
    videoWatchStatus,
    totalDuration: secondsToDuration(totalSeconds),
    watchedDuration: secondsToDuration(watchedSeconds),
    investedTime:
      previousCourse && "investedTime" in previousCourse
        ? previousCourse.investedTime
        : { ...ZERO_DURATION },
    courseImgSrc: metadata.thumbnailSrc
      ? await imgSrcToBase64(metadata.thumbnailSrc)
      : previousCourse && "courseImgSrc" in previousCourse
        ? previousCourse.courseImgSrc
        : null,
    courseName:
      normalizeNullableText(metadata.name) ??
      (previousCourse && "courseName" in previousCourse
        ? previousCourse.courseName
        : null),
    lastWatchedVideoId:
      previousCourse && "lastWatchedVideoId" in previousCourse
        ? previousCourse.lastWatchedVideoId
        : null,
    lastInteractedAt: Date.now()
  };

  updateCurrentCourseState(playlistId, courseData);
  await courseRepository.saveCourse(playlistId, courseData);

  return courseData;
}

/**
 * Synchronizes one video's watched status across every course containing it.
 * All affected courses are persisted in one batch write.
 */
export async function synchronizeVideoStatus(
  videoId: string,
  isChecked: boolean,
  durationSeconds: number
): Promise<SyncResult> {
  if (!videoId) return { coursesUpdated: 0 };

  const allCourses = await courseRepository.getAllCourses();
  const updatedCourses: Record<string, CourseData> = {};
  const normalizedDuration = normalizeDurationSeconds(durationSeconds);

  for (const course of allCourses) {
    if (!course.videoWatchStatus.hasOwnProperty(videoId)) {
      continue;
    }
    if (course.videoWatchStatus[videoId] === isChecked) continue;

    const watchedSeconds = durationToSeconds(course.watchedDuration);
    const nextWatchedSeconds = isChecked
      ? watchedSeconds + normalizedDuration
      : Math.max(0, watchedSeconds - normalizedDuration);

    const updatedCourse: CourseData = {
      videoWatchStatus: {
        ...course.videoWatchStatus,
        [videoId]: isChecked
      },
      totalDuration: course.totalDuration,
      watchedDuration: secondsToDuration(nextWatchedSeconds),
      investedTime: course.investedTime,
      courseImgSrc: course.courseImgSrc,
      courseName: course.courseName,
      lastWatchedVideoId: course.lastWatchedVideoId,
      lastInteractedAt: course.lastInteractedAt
    };

    updatedCourses[course.id] = updatedCourse;
  }

  const coursesUpdated = Object.keys(updatedCourses).length;
  if (coursesUpdated === 0) return { coursesUpdated };

  const currentPlaylistId = state.playlistId;
  if (currentPlaylistId && updatedCourses[currentPlaylistId]) {
    updateCurrentCourseState(
      currentPlaylistId,
      updatedCourses[currentPlaylistId]
    );
  }

  await courseRepository.saveManyCourses(updatedCourses);
  return { coursesUpdated };
}

function updateCurrentCourseState(
  playlistId: string,
  courseData: CourseData
): void {
  if (state.playlistId !== playlistId) return;

  state.videoWatchStatus = courseData.videoWatchStatus;
  state.totalDuration = courseData.totalDuration;
  state.watchedDuration = courseData.watchedDuration;
  state.investedTime = courseData.investedTime;
  state.courseImgSrc = courseData.courseImgSrc;
  state.courseName = courseData.courseName;
  state.lastWatchedVideoId = courseData.lastWatchedVideoId;
  state.lastInteractedAt = courseData.lastInteractedAt;
}

function normalizeDurationSeconds(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.round(value));
}

function normalizeNullableText(value: string | null): string | null {
  const normalized = value?.trim();
  return normalized ? normalized : null;
}
