import type { PlaylistLayout } from "@repo/core/types";
import { hmsToSeconds } from "@repo/core/duration";
import { PlaylistLayout as PlaylistLayoutValue } from "@repo/core/types";
import { getVideoId } from "@repo/core/url";

import type { PlaylistContentSelectors } from "../../core/selectors";
import type { PlaylistMetadata, ScannedVideo } from "../../types";
import { createAbortError, waitForElement } from "../../core/dom-utils";
import { getPlaylistContentSelectors, SELECTORS } from "../../core/selectors";

const LAYOUT_DETECTION_TIMEOUT_MS = 30_000;
const COURSE_DETECTION_TIMEOUT_MS = 120_000;
const CONTINUATION_BATCH_TIMEOUT_MS = 60_000;
const BATCH_SETTLE_DELAY_MS = 100;

const COURSE_LABELS = new Set([
  "Course",
  "कोर्स",
  "Curso",
  "Курс",
  "دورة تدريبية",
  "Kursus",
  "Cours",
  "コース",
  "课程"
]);

const NON_COURSE_LABELS = new Set([
  "Playlist",
  "प्लेलिस्ट",
  "Lista de reproducción",
  "Плейлист",
  "قائمة تشغيل",
  "Senarai main",
  "Liste de lecture",
  "再生リスト",
  "播放列表",
  "Podcast",
  "पॉडकास्ट",
  "Подкаст",
  "بودكاست",
  "Audio siar",
  "ポッドキャスト",
  "播客"
]);

/**
 * Detects which of YouTube's two supported playlist DOM layouts is active.
 */
export function detectPlaylistLayout(
  signal: AbortSignal
): Promise<PlaylistLayout> {
  return new Promise((resolve, reject) => {
    if (signal.aborted) {
      reject(createAbortError());
      return;
    }

    const existingLayout = getCurrentPlaylistLayout();
    if (existingLayout) {
      resolve(existingLayout);
      return;
    }

    let timeoutId: ReturnType<typeof setTimeout> | undefined;
    const observer = new MutationObserver(() => {
      const layout = getCurrentPlaylistLayout();
      if (!layout) return;

      cleanup();
      resolve(layout);
    });

    function cleanup(): void {
      observer.disconnect();
      if (timeoutId !== undefined) clearTimeout(timeoutId);
      signal.removeEventListener("abort", onAbort);
    }

    function onAbort(): void {
      cleanup();
      reject(createAbortError());
    }

    signal.addEventListener("abort", onAbort, { once: true });
    observer.observe(document.body, { childList: true, subtree: true });

    timeoutId = setTimeout(() => {
      cleanup();
      resolve(PlaylistLayoutValue.LOCKUP);
    }, LAYOUT_DETECTION_TIMEOUT_MS);
  });
}

/**
 * Loads a playlist incrementally and yields each newly available video batch.
 *
 * Scrolling belongs here because it is part of loading YouTube's DOM. Scroll
 * restoration and scanning UI belong to the consuming page orchestrator.
 */
export async function* loadPlaylistBatches(
  signal: AbortSignal,
  layout?: PlaylistLayout
): AsyncGenerator<Element[]> {
  if (signal.aborted) throw createAbortError();

  const resolvedLayout = layout ?? (await detectPlaylistLayout(signal));
  const selectors = getPlaylistContentSelectors(resolvedLayout);
  const contentDiv = await waitForElement({
    selector: selectors.contentDiv,
    signal
  });
  const yieldedElements = new Set<Element>();
  const initialBatch = collectVideoElements(
    Array.from(contentDiv.children),
    selectors,
    yieldedElements
  );

  if (initialBatch.length > 0) yield initialBatch;

  while (hasContinuation(contentDiv, selectors)) {
    if (signal.aborted) throw createAbortError();

    const nextBatchPromise = waitForNextContinuationBatch(
      contentDiv,
      selectors,
      yieldedElements,
      signal
    );

    window.scrollBy({
      top: 10_000_000,
      left: 0,
      behavior: "smooth"
    });

    const nextBatch = await nextBatchPromise;
    if (nextBatch.length > 0) yield nextBatch;
  }
}

/**
 * Synchronously parses raw video facts from already-loaded DOM elements.
 * Missing durations are represented as zero rather than waiting or mutating UI.
 */
export function parseVideoElements(
  elements: readonly Element[]
): ScannedVideo[] {
  const videos: ScannedVideo[] = [];

  for (const video of elements) {
    const link = video.querySelector(
      "#wc-endpoint, #video-title, .ytLockupMetadataViewModelTitle"
    );
    const href = (link as HTMLAnchorElement | null)?.href;
    const videoId = href ? getVideoId(href) : null;
    if (!videoId) continue;

    const durationText = video.querySelector(
      SELECTORS.videoDuration
    )?.textContent;
    videos.push({
      videoId,
      durationSeconds: hmsToSeconds(durationText ?? "")
    });
  }

  return videos;
}

/**
 * Parses raw video facts from loaded playlist elements, waiting for durations
 * that YouTube renders asynchronously.
 */
export async function scanPlaylistVideos(
  elements: readonly Element[],
  signal: AbortSignal
): Promise<ScannedVideo[]> {
  const videos: ScannedVideo[] = [];

  for (const video of elements) {
    if (signal.aborted) throw createAbortError();

    const link = video.querySelector(
      "#wc-endpoint, #video-title, .ytLockupMetadataViewModelTitle"
    );
    const href = (link as HTMLAnchorElement | null)?.href;
    const videoId = href ? getVideoId(href) : null;
    if (!videoId) continue;

    const durationElement =
      video.querySelector(SELECTORS.videoDuration) ??
      (await waitForElement({
        selector: SELECTORS.videoDuration,
        parentEl: video,
        signal
      }));

    videos.push({
      videoId,
      durationSeconds: hmsToSeconds(durationElement.textContent ?? "")
    });
  }

  return videos;
}

/** Reads raw playlist-level metadata without shaping a CourseData object. */
export async function getPlaylistMetadata(
  signal: AbortSignal
): Promise<PlaylistMetadata> {
  if (signal.aborted) throw createAbortError();

  const layout = await detectPlaylistLayout(signal);
  const selectors = getPlaylistContentSelectors(layout);
  const contentDiv = await waitForElement({
    selector: selectors.contentDiv,
    signal
  });

  if (signal.aborted) throw createAbortError();

  const nameElement = document.querySelector(
    `${SELECTORS.playlistPage.ytCourse.playlistNameEl}, ${SELECTORS.playlistPage.playlistNameEl}`
  );
  const imageElement = contentDiv.querySelector(
    "img"
  ) as HTMLImageElement | null;

  return {
    name: nameElement?.textContent?.trim() || null,
    thumbnailSrc: imageElement?.src || null
  };
}

/** Detects whether the current lockup playlist is a YouTube-native Course. */
export function isYtCourse(signal: AbortSignal): Promise<boolean> {
  return new Promise((resolve, reject) => {
    if (signal.aborted) {
      reject(createAbortError());
      return;
    }

    const initialResult = readYtCourseLabel();
    if (initialResult !== null) {
      resolve(initialResult);
      return;
    }

    let timeoutId: ReturnType<typeof setTimeout> | undefined;
    const observer = new MutationObserver(() => {
      const result = readYtCourseLabel();
      if (result === null) return;

      cleanup();
      resolve(result);
    });

    function cleanup(): void {
      observer.disconnect();
      if (timeoutId !== undefined) clearTimeout(timeoutId);
      signal.removeEventListener("abort", onAbort);
    }

    function onAbort(): void {
      cleanup();
      reject(createAbortError());
    }

    signal.addEventListener("abort", onAbort, { once: true });
    observer.observe(document.body, { childList: true, subtree: true });

    timeoutId = setTimeout(() => {
      cleanup();
      reject(
        new Error("Timed out while determining the YouTube playlist type")
      );
    }, COURSE_DETECTION_TIMEOUT_MS);
  });
}

function getCurrentPlaylistLayout(): PlaylistLayout | null {
  if (document.querySelector(SELECTORS.playlistPage.contentDiv)) {
    return PlaylistLayoutValue.LOCKUP;
  }
  if (document.querySelector(SELECTORS.playlistPage.ownPlaylist.contentDiv)) {
    return PlaylistLayoutValue.RENDERER;
  }
  return null;
}

function collectVideoElements(
  nodes: readonly Element[],
  selectors: PlaylistContentSelectors,
  seenElements: Set<Element>
): Element[] {
  const videos: Element[] = [];

  for (const node of nodes) {
    const candidates = node.matches(selectors.playlistVideo)
      ? [node, ...node.querySelectorAll(selectors.playlistVideo)]
      : Array.from(node.querySelectorAll(selectors.playlistVideo));

    for (const candidate of candidates) {
      if (seenElements.has(candidate)) continue;
      seenElements.add(candidate);
      videos.push(candidate);
    }
  }

  return videos;
}

function hasContinuation(
  contentDiv: Element,
  selectors: PlaylistContentSelectors
): boolean {
  return Boolean(contentDiv.querySelector(selectors.playlistContinuation));
}

function waitForNextContinuationBatch(
  contentDiv: Element,
  selectors: PlaylistContentSelectors,
  seenElements: Set<Element>,
  signal: AbortSignal
): Promise<Element[]> {
  return new Promise((resolve, reject) => {
    if (signal.aborted) {
      reject(createAbortError());
      return;
    }

    const pendingVideos = new Set<Element>();
    let settleTimer: ReturnType<typeof setTimeout> | undefined;
    let timeoutId: ReturnType<typeof setTimeout> | undefined;

    const observer = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        const addedElements = Array.from(mutation.addedNodes).filter(
          (node): node is Element => node instanceof Element
        );
        const videos = collectVideoElements(
          addedElements,
          selectors,
          seenElements
        );
        for (const video of videos) pendingVideos.add(video);
      }

      if (pendingVideos.size === 0) return;
      if (settleTimer !== undefined) clearTimeout(settleTimer);
      settleTimer = setTimeout(finish, BATCH_SETTLE_DELAY_MS);
    });

    function cleanup(): void {
      observer.disconnect();
      if (settleTimer !== undefined) clearTimeout(settleTimer);
      if (timeoutId !== undefined) clearTimeout(timeoutId);
      signal.removeEventListener("abort", onAbort);
    }

    function finish(): void {
      const batch = Array.from(pendingVideos);
      cleanup();
      resolve(batch);
    }

    function onAbort(): void {
      cleanup();
      reject(createAbortError());
    }

    signal.addEventListener("abort", onAbort, { once: true });
    observer.observe(contentDiv, { childList: true, subtree: true });

    timeoutId = setTimeout(() => {
      cleanup();
      reject(new Error("Timed out while loading the next playlist batch"));
    }, CONTINUATION_BATCH_TIMEOUT_MS);
  });
}

function readYtCourseLabel(): boolean | null {
  const courseLabels = document.querySelectorAll(
    SELECTORS.playlistPage.courseTextEl
  );
  for (const element of courseLabels) {
    if (COURSE_LABELS.has(element.textContent?.trim() ?? "")) return true;
  }

  const playlistLabels = document.querySelectorAll(
    SELECTORS.playlistPage.playlistTextEl
  );
  for (const element of playlistLabels) {
    if (NON_COURSE_LABELS.has(element.textContent?.trim() ?? "")) return false;
  }

  return null;
}
