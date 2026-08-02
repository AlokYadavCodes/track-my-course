import { hmsToSeconds } from "@repo/core/duration";
import { getVideoId } from "@repo/core/url";

import type { PlaylistMetadata, ScannedVideo } from "../../types";
import { courseRepository } from "../../../../storage/course-repository";
import { createAbortError, waitForElement } from "../../core/dom-utils";
import { lifecycle } from "../../core/lifecycle";
import { SELECTORS } from "../../core/selectors";
import { isEnrolledCourse, saveCourseState, state } from "../../core/state";
import { startCourse } from "../../services/course-service";
import {
  removeVideoCheckboxes,
  renderWPVideoCheckboxes
} from "../../ui/checkbox";
import {
  refreshWatchPageUI as refreshWatchProgressUI,
  removeWPProgressDiv,
  renderWPProgressDiv
} from "../../ui/progress-bar";
import {
  removeStartCourseButtons,
  renderDisabledStartCourseBtn,
  renderWPStartCourseBtn
} from "../../ui/start-course-btn";
import { showToast } from "../../ui/toast";
import { renderVideoCourseMatches } from "../../ui/video-course-panel";
import { renderVideoWatchedButton } from "../../ui/watched-button";
import { initializeInvestedTimeTracker } from "./time-tracker";

export async function updateWatchPlaylistPage(
  signal: AbortSignal
): Promise<void> {
  const playlistItems = await waitForElement({
    selector: SELECTORS.watchPage.playlistItems,
    signal
  });

  if (isEnrolledCourse()) {
    removeStartCourseButtons();
    await renderWPProgressDiv({
      signal,
      onDeleteCourse: async (playlistId) => {
        await courseRepository.deleteCourse(playlistId);
        showToast("Course Removed");
      }
    });
    await renderWPVideoCheckboxes({ signal });

    const cleanup = initializeInvestedTimeTracker({ signal });
    lifecycle.onCleanup(cleanup);

    markCurrentVideoInteraction();
  } else {
    removeWPProgressDiv();
    removeVideoCheckboxes();

    if (playlistItems.children.length >= 200) {
      await renderDisabledStartCourseBtn({ signal });
    } else {
      await renderWPStartCourseBtn({
        signal,
        onStartCourse: async () => {
          const videos = await scanWatchPlaylistVideos(playlistItems, signal);
          const metadata = getWatchPlaylistMetadata(playlistItems);
          await startCourse(state.playlistId!, videos, metadata);
          showToast("Course Started");
        }
      });
    }
  }

  await renderVideoCourseMatches({ signal });
  await renderVideoWatchedButton({ signal });
}

export async function updateWatchPlaylistPartial(
  signal: AbortSignal
): Promise<void> {
  if (!isEnrolledCourse()) return;

  removeVideoCheckboxes();
  await renderWPVideoCheckboxes({ signal });
  await renderVideoCourseMatches({ signal });
  await renderVideoWatchedButton({ signal });
  markCurrentVideoInteraction();
}

export async function refreshWatchPageUI(signal: AbortSignal): Promise<void> {
  refreshWatchProgressUI({ signal });
  await renderVideoWatchedButton({ signal });
}

function markCurrentVideoInteraction(): void {
  state.lastWatchedVideoId = getVideoId(window.location.href);
  state.lastInteractedAt = Date.now();
  saveCourseState();
}

async function scanWatchPlaylistVideos(
  playlistItems: Element,
  signal: AbortSignal
): Promise<ScannedVideo[]> {
  const videos: ScannedVideo[] = [];

  for (const video of Array.from(playlistItems.children)) {
    if (signal.aborted) throw createAbortError();
    if (video.tagName.toLowerCase() !== "ytd-playlist-panel-video-renderer") {
      continue;
    }

    const link = video.querySelector<HTMLAnchorElement>(
      "#wc-endpoint, #video-title"
    );
    const videoId = link?.href ? getVideoId(link.href) : null;
    if (!videoId) continue;

    const durationEl =
      video.querySelector(SELECTORS.videoDuration) ??
      (await waitForElement({
        selector: SELECTORS.videoDuration,
        parentEl: video,
        signal
      }));

    videos.push({
      videoId,
      durationSeconds: hmsToSeconds(durationEl.textContent ?? "")
    });
  }

  return videos;
}

function getWatchPlaylistMetadata(playlistItems: Element): PlaylistMetadata {
  const titleElement = document.querySelector<HTMLElement>(
    "#playlist:not([hidden]) #header-contents .title"
  );
  const imageElement = playlistItems.querySelector<HTMLImageElement>("img");

  return {
    name: titleElement?.title || titleElement?.textContent?.trim() || null,
    thumbnailSrc: imageElement?.src || null
  };
}
