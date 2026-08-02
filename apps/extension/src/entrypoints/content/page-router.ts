import type { ContentScriptContext } from "wxt/utils/content-script-context";

import { PageType } from "@repo/core/types";
import { getPlaylistId } from "@repo/core/url";

import type { StorageChangeEvent } from "../../storage/course-repository";
import { courseRepository } from "../../storage/course-repository";
import { isAbortError, waitForNavigation } from "./core/dom-utils";
import { lifecycle } from "./core/lifecycle";
import {
  isEnrolledCourse,
  loadCourseData,
  resetCourseData,
  state
} from "./core/state";
import {
  removeHomeCoursesSection,
  updateHomeCoursesContent,
  updateHomePage
} from "./pages/home";
import {
  cleanupPlaylistPage,
  refreshPlaylistPageUI,
  updatePlaylistPage
} from "./pages/playlist";
import {
  refreshWatchPageUI,
  updateWatchPlaylistPage,
  updateWatchPlaylistPartial
} from "./pages/watch-playlist";
import {
  removeCommentsToggleButton,
  toggleFocusModeUI
} from "./pages/watch-playlist/components/focus-mode";
import { updateWatchStandalonePage } from "./pages/watch-standalone";
import { removeVideoCheckboxes } from "./ui/checkbox";
import { removeProgressDiv } from "./ui/progress-bar";
import { removeStartCourseButtons } from "./ui/start-course-btn";
import { removeVideoCourseList } from "./ui/video-course-panel";
import { removeVideoWatchedButton } from "./ui/watched-button";

// --- Initialization ---

/**
 * Entry point for the content script.
 * Call once from the content script's `main(ctx)` function.
 *
 * Sets up:
 * 1. Initial page detection (runs once on load)
 * 2. SPA navigation listener (via WXT's wxt:locationchange)
 * 3. Storage change listener (cross-tab sync, popup actions)
 */
export function initializeRouter(ctx: ContentScriptContext): void {
  handleInitialLoad();

  // SPA navigation events detected directly in the content script.
  // WXT patches History.pushState/replaceState and listens for popstate,
  // firing wxt:locationchange on every URL change. No background script
  // or webNavigation permission needed.
  ctx.addEventListener(window, "wxt:locationchange", (event) => {
    handleLocationChange(event.newUrl).catch((err) => {
      if (!isAbortError(err)) {
        console.error("[TMC] Error handling navigation:", err);
      }
    });
  });

  // Clean up page lifecycle when the content script context is invalidated
  // (e.g. extension update while the tab is still open)
  ctx.onInvalidated(() => lifecycle.teardown());

  // Storage change events (cross-tab sync, popup actions)
  courseRepository.onChanged(handleStorageChanges);
}

// --- Page Detection ---

interface DetectedPage {
  page: PageType;
  playlistId: string | null;
}

/**
 * Determines the page type from a YouTube URL.
 * Returns null for pages we don't manage.
 */
function detectPageType(url: string): DetectedPage | null {
  if (url.includes("watch?v=") && url.includes("list=")) {
    return { page: PageType.WATCH, playlistId: getPlaylistId(url) };
  }
  if (url.includes("playlist?list=")) {
    return { page: PageType.PLAYLIST, playlistId: getPlaylistId(url) };
  }
  if (url === "https://www.youtube.com/" || url === "https://www.youtube.com") {
    return { page: PageType.HOME, playlistId: null };
  }
  return null;
}

/** Returns true if the current URL is a standalone video (no playlist). */
function isOnStandaloneVideo(): boolean {
  const url = window.location.href;
  return url.includes("/watch?v=") && !url.includes("list=");
}

// --- Initial Load ---

/** Runs once when the content script first loads. */
function handleInitialLoad(): void {
  const url = window.location.href;
  const detected = detectPageType(url);

  if (detected) {
    state.currentPage = detected.page;
    state.playlistId = detected.playlistId;
    handleFullPageUpdate(detected.page);
  } else if (isOnStandaloneVideo()) {
    // Standalone video: no playlist context, but video-level features
    state.currentPage = null;
    console.log("It's a standalone video...");
    handleStandaloneVideo();
  }
}

// --- SPA Navigation Handling ---

/**
 * Handles YouTube SPA navigation by classifying the new URL
 * and dispatching to the appropriate page handler.
 *
 * Called on every wxt:locationchange event (History API navigation).
 */
async function handleLocationChange(newUrl: URL): Promise<void> {
  const detected = detectPageType(newUrl.href);

  console.log("newUrl", newUrl);
  console.log("detected", detected);

  if (detected) {
    switch (detected.page) {
      case PageType.WATCH:
        await handleWatchPageNavigation(detected.playlistId);
        break;
      case PageType.PLAYLIST:
        await handlePlaylistPageNavigation(detected.playlistId!);
        break;
      case PageType.HOME:
        await handleHomePageNavigation();
        break;
    }
  } else if (isOnStandaloneVideo()) {
    // Standalone video (no playlist in URL)
    await handleWatchPageNavigation(null);
  } else {
    // Non-managed page (channel, search, shorts, etc.)
    handleLeavingManagedPage();
  }
}

async function handleWatchPageNavigation(
  playlistId: string | null
): Promise<void> {
  // Standalone video (no playlist)
  if (playlistId === null) {
    lifecycle.teardown();
    state.currentPage = null;
    state.playlistId = null;
    resetCourseData();
    handleStandaloneVideo();
    return;
  }

  const isNewContext =
    state.currentPage !== PageType.WATCH || state.playlistId !== playlistId;

  state.currentPage = PageType.WATCH;
  state.playlistId = playlistId;

  await waitForNavigation();

  if (isNewContext) {
    await handleFullPageUpdate(PageType.WATCH);
  } else {
    // Same playlist, different video: partial update
    await handlePartialUpdate();
  }
}

async function handlePlaylistPageNavigation(playlistId: string): Promise<void> {
  const isNewContext =
    state.currentPage !== PageType.PLAYLIST || state.playlistId !== playlistId;

  state.currentPage = PageType.PLAYLIST;
  state.playlistId = playlistId;

  if (isNewContext) {
    await waitForNavigation();
    await handleFullPageUpdate(PageType.PLAYLIST);
  }
}

async function handleHomePageNavigation(): Promise<void> {
  state.currentPage = PageType.HOME;
  console.log("handleHomePageNavigation called");
  console.log("waitForNavigation pending");
  await waitForNavigation();
  console.log("waitForNavigation done");
  await handleFullPageUpdate(PageType.HOME);
}

function handleLeavingManagedPage(): void {
  console.log("un-managed page");
  lifecycle.teardown();
  state.currentPage = null;
  state.playlistId = null;
  resetCourseData();
}

// --- Storage Change Handling ---

/**
 * Handles typed storage change events from the CourseRepository.
 * Dispatches to appropriate UI refresh logic based on current page context.
 *
 * Course changes are processed as a batch, not individually.
 * This matters for cross-course sync: when `synchronizeVideoStatus`
 * updates multiple courses at once (e.g. playlists A, B, C), the
 * storage fires a single `onChanged` event with all three changes.
 * We need to decide our action based on the batch as a whole.
 */
function handleStorageChanges(changes: StorageChangeEvent[]): void {
  const courseChanges: Extract<StorageChangeEvent, { type: "course" }>[] = [];

  for (const change of changes) {
    if (change.type === "focusMode") {
      state.focusMode = change.value;
      toggleFocusModeUI(change.value);
    } else {
      courseChanges.push(change);
    }
  }

  if (courseChanges.length > 0) {
    handleCourseStorageChanges(courseChanges);
  }
}

/**
 * Processes a batch of course storage changes.
 *
 * Extracts the current playlist's change (if present) and dispatches
 * to the page-specific handler. This avoids redundant UI updates:
 * e.g. on the watch page, if the current playlist was updated,
 * `handleRefreshUI` already covers video-level UI — no need to also
 * call `handleStandaloneVideo` for the other playlist changes.
 */
function handleCourseStorageChanges(
  changes: Extract<StorageChangeEvent, { type: "course" }>[]
): void {
  const currentPlaylistChange = state.playlistId
    ? changes.find((c) => c.playlistId === state.playlistId)
    : undefined;

  switch (state.currentPage) {
    case PageType.HOME:
      handleHomeStorageChange();
      return;

    case PageType.WATCH:
      handleWatchPageStorageChange(currentPlaylistChange);
      return;

    case PageType.PLAYLIST:
      handlePlaylistPageStorageChange(currentPlaylistChange);
      return;

    case null:
      if (isOnStandaloneVideo()) handleStandaloneVideo();
      return;
  }
}

function handleWatchPageStorageChange(
  change: Extract<StorageChangeEvent, { type: "course" }> | undefined
): void {
  // No change for the current playlist: refresh video-level UI (cross-course sync)
  if (!change) {
    handleStandaloneVideo();
    return;
  }

  // Current course created or deleted: full rebuild
  if (!change.oldValue || !change.newValue) {
    handleFullPageUpdate(PageType.WATCH);
    return;
  }

  // Current course updated: refresh in place
  handleRefreshUI();
}

function handlePlaylistPageStorageChange(
  change: Extract<StorageChangeEvent, { type: "course" }> | undefined
): void {
  if (!change) return;

  // Current course created or deleted: full rebuild
  if (!change.oldValue || !change.newValue) {
    handleFullPageUpdate(PageType.PLAYLIST);
    return;
  }

  // Current course updated: refresh in place
  handleRefreshUI();
}

// --- Page Handler Registry ---

type PageHandler = (signal: AbortSignal) => Promise<void>;

/**
 * Maps page types to their update handler functions.
 */
const PAGE_HANDLERS: Record<PageType, PageHandler> = {
  [PageType.WATCH]: updateWatchPlaylistPage,
  [PageType.PLAYLIST]: updatePlaylistPage,
  [PageType.HOME]: updateHomePage
};

// --- Page Update Orchestration ---

/**
 * Full page update: tears down previous lifecycle, loads fresh state,
 * and dispatches to the page-specific handler.
 */
async function handleFullPageUpdate(pageType: PageType): Promise<void> {
  try {
    console.log("handle full page update, PAGE: ", pageType);
    const signal = lifecycle.start();
    lifecycle.onCleanup(cleanupContentUI);

    // Load course data for watch/playlist pages
    if (
      (pageType === PageType.WATCH || pageType === PageType.PLAYLIST) &&
      state.playlistId
    ) {
      await loadCourseData(state.playlistId, signal);
    }

    // Focus mode applies to watch page only
    if (pageType === PageType.WATCH) {
      toggleFocusModeUI(state.focusMode);
    }

    // Dispatch to page handler
    const handler = PAGE_HANDLERS[pageType];
    if (handler) {
      console.log("Calling handler: ", pageType);
      await handler(signal);
    }
  } catch (err) {
    if (!isAbortError(err)) {
      console.error(`[TMC] Error during ${pageType} page update:`, err);
    }
  }
}

/**
 * Partial update for the **watch page**: same playlist, different video.
 * Aborts in-flight async work but keeps existing UI (progress bar, etc).
 * Only re-renders checkboxes and video-level features.
 */
async function handlePartialUpdate(): Promise<void> {
  try {
    if (!isEnrolledCourse()) return;

    const signal = lifecycle.restart();

    await updateWatchPlaylistPartial(signal);
  } catch (err) {
    if (!isAbortError(err)) {
      console.error("[TMC] Error during partial update:", err);
    }
  }
}

/**
 * Refresh UI in place: re-reads state from storage and updates
 * existing UI elements without full teardown. Used when storage
 * changes from another tab or the popup.
 */
async function handleRefreshUI(): Promise<void> {
  try {
    const signal = lifecycle.restart();

    if (state.playlistId) {
      await loadCourseData(state.playlistId, signal);
    }

    if (state.currentPage === PageType.WATCH) {
      await refreshWatchPageUI(signal);
    } else if (state.currentPage === PageType.PLAYLIST) {
      await refreshPlaylistPageUI(signal);
    } else if (state.currentPage === PageType.HOME) {
      await updateHomeCoursesContent(signal);
    }
  } catch (err) {
    if (!isAbortError(err)) {
      console.error("[TMC] Error during UI refresh:", err);
    }
  }
}

/** Renders video-level features on standalone video pages. */
function handleStandaloneVideo(): void {
  console.log("handleStandaloneVideo function called");
  const signal = lifecycle.restart();
  updateWatchStandalonePage(signal).catch((err) => {
    if (!isAbortError(err)) {
      console.error("[TMC] Error rendering standalone video UI:", err);
    }
  });
}

function handleHomeStorageChange(): void {
  const signal = lifecycle.restart();
  updateHomeCoursesContent(signal).catch((err) => {
    if (!isAbortError(err)) {
      console.error("[TMC] Error refreshing home courses:", err);
    }
  });
}

function cleanupContentUI(): void {
  removeStartCourseButtons();
  removeVideoCheckboxes();
  removeProgressDiv();
  removeHomeCoursesSection();
  removeVideoCourseList();
  removeVideoWatchedButton();
  removeCommentsToggleButton();
  cleanupPlaylistPage();
  document.body.classList.remove("tmc-focus-mode");
}
