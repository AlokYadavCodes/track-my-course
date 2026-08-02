import type { PlaylistLayout } from "@repo/core/types";
import { PlaylistLayout as PlaylistLayoutValue } from "@repo/core/types";

import type { ScannedVideo } from "../../types";
import { courseRepository } from "../../../../storage/course-repository";
import { createAbortError, waitForElement } from "../../core/dom-utils";
import { getPlaylistContentSelectors, SELECTORS } from "../../core/selectors";
import { isEnrolledCourse, state } from "../../core/state";
import {
  startCourse,
  updateCourseFromPlaylist
} from "../../services/course-service";
import {
  removeVideoCheckboxes,
  renderPPVideoCheckboxes
} from "../../ui/checkbox";
import {
  refreshPlaylistPageUI as refreshPlaylistProgressUI,
  removePPProgressDiv,
  renderPPProgressDiv
} from "../../ui/progress-bar";
import {
  removeStartCourseButtons,
  renderPPStartCourseBtn
} from "../../ui/start-course-btn";
import { showToast } from "../../ui/toast";
import {
  removePlaylistScanning,
  renderPlaylistScanning,
  updatePlaylistScanningCount
} from "./components/scanning-overlay";
import {
  detectPlaylistLayout,
  getPlaylistMetadata,
  isYtCourse,
  loadPlaylistBatches,
  scanPlaylistVideos
} from "./playlist-scanner";

let mediaQuery: MediaQueryList | null = null;
let mediaQueryHandler: (() => void) | null = null;

export async function updatePlaylistPage(signal: AbortSignal): Promise<void> {
  state.playlistLayout = await detectPlaylistLayout(signal);
  state.isYtCourse =
    state.playlistLayout === PlaylistLayoutValue.RENDERER
      ? false
      : await isYtCourse(signal);

  setupPlaylistLayoutListener(signal);

  if (isEnrolledCourse()) {
    removeStartCourseButtons();
    await renderPPProgressDiv({
      signal,
      onDeleteCourse: async (playlistId) => {
        removePPMediaQueryListener();
        await courseRepository.deleteCourse(playlistId);
        showToast("Course Removed");
      },
      onUpdatePlaylist: async () => {
        await updatePlaylistData(signal);
        showToast("Playlist Updated");
      }
    });
    await renderVisiblePlaylistCheckboxes(signal);
  } else {
    removePPProgressDiv();
    removeVideoCheckboxes();
    await renderPPStartCourseBtn({
      signal,
      onStartCourse: async () => {
        await startPlaylistCourse(signal);
        showToast("Course Started");
      }
    });
  }

  await updatePlaylistPageLayout(signal);
}

export async function refreshPlaylistPageUI(
  signal: AbortSignal
): Promise<void> {
  refreshPlaylistProgressUI({ signal });
  await renderVisiblePlaylistCheckboxes(signal);
}

export function cleanupPlaylistPage(): void {
  removePPMediaQueryListener();
  removePlaylistScanning();
}

async function startPlaylistCourse(signal: AbortSignal): Promise<void> {
  const [videos, metadata] = await Promise.all([
    collectPlaylistVideos(signal),
    getPlaylistMetadata(signal)
  ]);

  await startCourse(state.playlistId!, videos, metadata);
}

async function updatePlaylistData(signal: AbortSignal): Promise<void> {
  const [videos, metadata] = await Promise.all([
    collectPlaylistVideos(signal),
    getPlaylistMetadata(signal)
  ]);

  await updateCourseFromPlaylist(state.playlistId!, videos, metadata);
}

async function collectPlaylistVideos(
  signal: AbortSignal
): Promise<ScannedVideo[]> {
  const html = document.documentElement;
  const originalScroll = html.scrollTop;
  const videos: ScannedVideo[] = [];
  let hasShownScanningOverlay = false;

  try {
    for await (const batch of loadPlaylistBatches(
      signal,
      state.playlistLayout ?? undefined
    )) {
      if (signal.aborted) throw createAbortError();

      if (!hasShownScanningOverlay && hasPlaylistContinuation()) {
        hasShownScanningOverlay = true;
        await renderPlaylistScanning({
          signal,
          scannedCount: videos.length
        });
      }

      videos.push(...(await scanPlaylistVideos(batch, signal)));
      updatePlaylistScanningCount(videos.length);
    }
  } finally {
    removePlaylistScanning();
    html.scrollTo({
      top: originalScroll,
      left: 0,
      behavior: "instant"
    });
  }

  return videos;
}

async function renderVisiblePlaylistCheckboxes(
  signal: AbortSignal
): Promise<void> {
  const selectors = getPlaylistContentSelectors(
    state.playlistLayout ?? PlaylistLayoutValue.LOCKUP
  );
  const contentDiv = await waitForElement({
    selector: selectors.contentDiv,
    signal
  });

  const videos = Array.from(
    contentDiv.querySelectorAll(selectors.playlistVideo)
  );
  renderPPVideoCheckboxes({ videoElements: videos, signal });
}

function setupPlaylistLayoutListener(signal: AbortSignal): void {
  if (mediaQuery) return;

  mediaQuery = window.matchMedia("(min-width: 1080px)");
  mediaQueryHandler = () => {
    if (signal.aborted) return;
    void updatePlaylistPageLayout(signal);
  };
  mediaQuery.addEventListener("change", mediaQueryHandler);
  signal.addEventListener("abort", cleanupPlaylistPage, { once: true });
}

async function updatePlaylistPageLayout(signal: AbortSignal): Promise<void> {
  if (!mediaQuery) return;

  const progressDiv = document.querySelector(".tmc-pp-progress-div");
  const startCourseBtn = document.querySelector<HTMLElement>(
    ".tmc-pp-start-course-btn"
  );

  const anchors = await getPlaylistLayoutAnchors(signal, state.isYtCourse);
  const progressAnchor = mediaQuery.matches
    ? anchors.progressWide
    : anchors.progressSmall;
  const startAnchor = mediaQuery.matches
    ? anchors.startWide
    : anchors.startSmall;

  if (progressDiv)
    progressAnchor.insertAdjacentElement("beforebegin", progressDiv);
  if (startCourseBtn) {
    startAnchor.insertAdjacentElement("afterend", startCourseBtn);
    if (state.isYtCourse) {
      startCourseBtn.style.margin =
        startAnchor === anchors.startSmall
          ? "6px 0px 10px 0px"
          : "-6px 0px 10px 0px";
    }
  }
}

async function getPlaylistLayoutAnchors(
  signal: AbortSignal,
  isCourse: boolean
): Promise<{
  progressWide: Element;
  progressSmall: Element;
  startWide: Element;
  startSmall: Element;
}> {
  if (isCourse) {
    const [progressAnchor, startWide, startSmall] = await Promise.all([
      waitForElement({
        selector: SELECTORS.playlistPage.ytCourse.progressDivWideScreenRefEl,
        signal
      }),
      waitForElement({
        selector: SELECTORS.playlistPage.ytCourse.startCourseBtnWideScreenRefEl,
        signal
      }),
      waitForElement({
        selector:
          SELECTORS.playlistPage.ytCourse.startCourseBtnSmallScreenRefEl,
        signal
      })
    ]);

    return {
      progressWide: progressAnchor,
      progressSmall: progressAnchor,
      startWide,
      startSmall
    };
  }

  const [progressWide, progressSmall, startWide, startSmall] =
    await Promise.all([
      waitForElement({
        selector: SELECTORS.playlistPage.progressDivWideScreenRefEl,
        signal
      }),
      waitForElement({
        selector: SELECTORS.playlistPage.progressDivSmallScreenRefEl,
        signal
      }),
      waitForElement({
        selector: SELECTORS.playlistPage.startCourseBtnWideScreenRefEl,
        signal
      }),
      waitForElement({
        selector: SELECTORS.playlistPage.startCourseBtnSmallScreenRefEl,
        signal
      })
    ]);

  return { progressWide, progressSmall, startWide, startSmall };
}

function hasPlaylistContinuation(): boolean {
  const layout: PlaylistLayout =
    state.playlistLayout ?? PlaylistLayoutValue.LOCKUP;
  const selectors = getPlaylistContentSelectors(layout);
  return Boolean(
    document
      .querySelector(selectors.contentDiv)
      ?.querySelector(selectors.playlistContinuation)
  );
}

function removePPMediaQueryListener(): void {
  if (mediaQuery && mediaQueryHandler) {
    mediaQuery.removeEventListener("change", mediaQueryHandler);
  }
  mediaQuery = null;
  mediaQueryHandler = null;
}
