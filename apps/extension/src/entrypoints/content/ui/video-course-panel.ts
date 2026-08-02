import type { MatchedCourse } from "@repo/core/types";
import { getPlaylistId, getVideoId } from "@repo/core/url";

import { courseRepository } from "../../../storage/course-repository";
import { createAbortError, waitForElement } from "../core/dom-utils";

export interface RenderVideoCourseMatchesOptions {
  signal: AbortSignal;
}

export async function renderVideoCourseMatches({
  signal
}: RenderVideoCourseMatchesOptions): Promise<void> {
  if (signal.aborted) throw createAbortError();

  const playlistId = getPlaylistId(window.location.href);
  const videoId = getVideoId(window.location.href);
  if (!videoId) {
    removeVideoCourseList();
    return;
  }

  const [isCurrentPlaylistTracked, matches] = await Promise.all([
    playlistId
      ? courseRepository.isTracked(playlistId)
      : Promise.resolve(false),
    courseRepository.getCoursesContainingVideo(videoId)
  ]);

  const courses =
    isCurrentPlaylistTracked && playlistId
      ? matches.filter((course) => course.playlistId !== playlistId)
      : matches;

  if (courses.length === 0) {
    removeVideoCourseList();
    return;
  }

  await renderVideoCourseList({
    signal,
    courses,
    isCurrentPlaylistTracked
  });
}

export async function renderVideoCourseList({
  signal,
  courses,
  isCurrentPlaylistTracked
}: {
  signal: AbortSignal;
  courses: readonly MatchedCourse[];
  isCurrentPlaylistTracked: boolean;
}): Promise<void> {
  if (signal.aborted) throw createAbortError();

  const secondaryCol = await waitForElement({
    selector: "#secondary-inner",
    signal
  });

  let container = document.querySelector<HTMLDivElement>(
    ".tmc-video-course-panel"
  );
  if (!container) {
    container = document.createElement("div");
    container.className = "tmc-video-course-panel";
    secondaryCol.prepend(container);
  } else {
    container.innerHTML = "";
  }

  const header = document.createElement("div");
  header.className = "tmc-video-course-header";
  header.textContent = `${isCurrentPlaylistTracked ? "Also included in" : "Included in"} ${
    courses.length > 1 ? "these" : "this"
  } ${courses.length > 1 ? "courses" : "course"}`;
  container.append(header);

  const list = document.createElement("div");
  list.className = "tmc-video-course-list";

  for (const course of courses) {
    list.append(createCourseMatchLink(course));
  }

  container.append(list);
}

export function removeVideoCourseList(): void {
  document.querySelector(".tmc-video-course-panel")?.remove();
}

function createCourseMatchLink(course: MatchedCourse): HTMLAnchorElement {
  const item = document.createElement("a");
  item.className = "tmc-video-course-item";
  item.href = `https://www.youtube.com/playlist?list=${course.playlistId}`;
  item.target = "_blank";
  item.rel = "noreferrer";
  item.title = `Open Course: ${course.courseName ?? "Untitled Course"}`;

  const name = document.createElement("span");
  name.className = "tmc-video-course-name";
  name.textContent = course.courseName ?? "Untitled Course";

  const icon = document.createElement("span");
  icon.className = "tmc-video-course-icon";
  icon.innerHTML = `
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
      <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path>
      <polyline points="15 3 21 3 21 9"></polyline>
      <line x1="10" y1="14" x2="21" y2="3"></line>
    </svg>
  `;

  item.append(name, icon);
  return item;
}
