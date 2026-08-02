import type { CourseEntry } from "@repo/core/types";
import { getProgressPercent } from "@repo/core/progress";
import { getCourseHref } from "@repo/core/url";

export function createCourseCard(course: CourseEntry): HTMLDivElement {
  const card = document.createElement("div");
  card.className = "tmc-home-course-card";

  const progressPercent = getProgressPercent(course);
  const courseHref = getCourseHref(course);

  const thumbnail = document.createElement("a");
  thumbnail.className = "tmc-home-course-card-thumbnail";
  thumbnail.href = courseHref;

  const img = document.createElement("img");
  img.src = course.courseImgSrc || "";
  img.alt = course.courseName ?? "Course thumbnail";
  thumbnail.append(img);

  const thumbnailOverlay = document.createElement("div");
  thumbnailOverlay.className = "tmc-home-course-card-thumbnail-overlay";

  const overlayIcon = document.createElement("div");
  overlayIcon.className = "icon";
  overlayIcon.innerHTML =
    course.lastWatchedVideoId && progressPercent < 100
      ? resumeIcon()
      : viewCourseIcon();

  const overlayText = document.createElement("div");
  overlayText.className = "text";
  overlayText.textContent =
    course.lastWatchedVideoId && progressPercent < 100
      ? "Resume Course"
      : "View Course";

  thumbnailOverlay.append(overlayIcon, overlayText);
  thumbnail.append(thumbnailOverlay);

  const info = document.createElement("a");
  info.className = "tmc-home-course-card-info";
  info.href = `https://www.youtube.com/playlist?list=${course.id}`;

  const title = document.createElement("div");
  title.className = "tmc-home-course-card-title";
  title.textContent = course.courseName || "Untitled Course";

  const stats = document.createElement("div");
  stats.className = "tmc-home-course-card-stats";
  stats.textContent = `${progressPercent}% completed`;

  const progressBg = document.createElement("div");
  progressBg.className = "tmc-home-course-card-progress-bg";

  const progressFill = document.createElement("div");
  progressFill.className = "tmc-home-course-card-progress-fill";
  progressFill.style.width = `${progressPercent}%`;
  progressBg.append(progressFill);

  info.append(title, stats, progressBg);
  card.append(thumbnail, info);
  return card;
}

function resumeIcon(): string {
  return '<svg xmlns="http://www.w3.org/2000/svg" height="28" width="28" viewBox="0 0 24 24" fill="currentColor" focusable="false" aria-hidden="true" style="pointer-events: none; display: inherit; width: 100%; height: 100%;"><path d="M5 4.623V19.38a1.5 1.5 0 002.26 1.29L22 12 7.26 3.33A1.5 1.5 0 005 4.623Z"></path></svg>';
}

function viewCourseIcon(): string {
  return '<svg xmlns="http://www.w3.org/2000/svg" height="28" width="28" viewBox="0 0 24 24" fill="currentColor" focusable="false" aria-hidden="true" style="pointer-events: none; display: inherit; width: 100%; height: 100%;"><path d="M11.485 2.143 1.486 8.148a1 1 0 000 1.715l10 5.994a1 1 0 001.028 0L21 10.77V18a1 1 0 002 0V9a1 1 0 00-.485-.852l-10-6.005a1 1 0 00-1.03 0ZM19 16.926V14.3l-5.458 3.27a3 3 0 01-3.084 0L5 14.3v2.625a2 2 0 00.992 1.73l5.504 3.21a1 1 0 001.008 0l5.504-3.212A2 2 0 0019 16.926Z"></path></svg>';
}
