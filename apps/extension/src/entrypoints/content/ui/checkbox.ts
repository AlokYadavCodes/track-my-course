import { hmsToSeconds } from "@repo/core/duration";
import { PageType, PlaylistLayout } from "@repo/core/types";
import { getVideoId } from "@repo/core/url";

import { createAbortError, waitForElement } from "../core/dom-utils";
import { getPlaylistContentSelectors, SELECTORS } from "../core/selectors";
import { state } from "../core/state";
import { synchronizeVideoStatus } from "../services/course-service";
import { showToast } from "./toast";

type CheckboxPageType = typeof PageType.WATCH | typeof PageType.PLAYLIST;

export interface SetupCheckboxOptions {
  video: Element;
  pageType: CheckboxPageType;
  signal: AbortSignal;
}

export interface RenderPlaylistCheckboxesOptions {
  videoElements: Iterable<Element>;
  signal: AbortSignal;
}

export async function renderWPVideoCheckboxes({
  signal
}: {
  signal: AbortSignal;
}): Promise<void> {
  if (signal.aborted) throw createAbortError();

  const playlistItems = await waitForElement({
    selector: SELECTORS.watchPage.playlistItems,
    signal
  });

  if (signal.aborted) throw createAbortError();

  for (const video of Array.from(playlistItems.children)) {
    if (signal.aborted) throw createAbortError();
    if (video.tagName.toLowerCase() !== "ytd-playlist-panel-video-renderer") {
      continue;
    }
    setupCheckbox({ video, pageType: PageType.WATCH, signal });
  }
}

export function renderPPVideoCheckboxes({
  videoElements,
  signal
}: RenderPlaylistCheckboxesOptions): void {
  if (signal.aborted) throw createAbortError();

  for (const video of videoElements) {
    if (signal.aborted) throw createAbortError();
    setupCheckbox({ video, pageType: PageType.PLAYLIST, signal });
  }
}

export function setupCheckbox({
  video,
  pageType,
  signal
}: SetupCheckboxOptions): void {
  const existing = video.querySelector(".tmc-checkbox-wrapper");
  if (existing) return;

  const checkboxWrapper = createCheckbox(pageType);
  const checkbox = checkboxWrapper.querySelector<HTMLInputElement>(
    "input[type=checkbox]"
  );
  if (!checkbox) return;

  const selectors = getPlaylistContentSelectors(
    state.playlistLayout ?? PlaylistLayout.LOCKUP
  );
  const titleEl = video.querySelector<HTMLAnchorElement>(
    selectors.playlistVideoLink
  );

  if (pageType === PageType.PLAYLIST) {
    titleEl?.style.setProperty("padding-right", "64px");
  }

  const href =
    pageType === PageType.PLAYLIST
      ? titleEl?.href
      : video.querySelector<HTMLAnchorElement>("#wc-endpoint")?.href;
  const videoId = href ? getVideoId(href) : null;
  if (!videoId) return;

  checkbox.id = videoId;
  checkbox.checked = state.videoWatchStatus[videoId] ?? false;

  checkbox.addEventListener("click", (event) => {
    void handleCheckboxClick(event, video, videoId, signal);
  });

  const menuSelector =
    pageType === PageType.PLAYLIST ? selectors.playlistVideoMenu : "#menu";
  const menu = video.querySelector(menuSelector);
  menu?.append(checkboxWrapper);
}

export function createCheckbox(pageType: CheckboxPageType): HTMLDivElement {
  const checkbox = document.createElement("input");
  checkbox.type = "checkbox";

  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("viewBox", "0 0 35.6 35.6");

  const background = document.createElementNS(
    "http://www.w3.org/2000/svg",
    "circle"
  );
  background.setAttribute("class", "background");
  background.setAttribute("cx", "17.8");
  background.setAttribute("cy", "17.8");
  background.setAttribute("r", "17.8");

  const ring = document.createElementNS("http://www.w3.org/2000/svg", "circle");
  ring.setAttribute("class", "ring");
  ring.setAttribute("cx", "17.8");
  ring.setAttribute("cy", "17.8");
  ring.setAttribute("r", "12.37");

  const stroke = document.createElementNS(
    "http://www.w3.org/2000/svg",
    "circle"
  );
  stroke.setAttribute("class", "stroke");
  stroke.setAttribute("cx", "17.8");
  stroke.setAttribute("cy", "17.8");
  stroke.setAttribute("r", "14.37");

  const check = document.createElementNS(
    "http://www.w3.org/2000/svg",
    "polyline"
  );
  check.setAttribute("class", "check");
  check.setAttribute("points", "11.78 18.12 15.55 22.23 25.17 12.87");

  const hoverTick = document.createElementNS(
    "http://www.w3.org/2000/svg",
    "polyline"
  );
  hoverTick.setAttribute("class", "hover-tick");
  hoverTick.setAttribute("points", "13.5 18 16.5 21 23.5 14");

  svg.append(background, ring, stroke, check, hoverTick);

  const wrapper = document.createElement("div");
  wrapper.classList.add("tmc-checkbox-wrapper");
  wrapper.classList.add(
    pageType === PageType.WATCH
      ? "tmc-wp-checkbox-wrapper"
      : "tmc-pp-checkbox-wrapper"
  );
  wrapper.append(checkbox, svg);
  return wrapper;
}

export function updateVideoCheckboxes(pageType: CheckboxPageType): void {
  const selector =
    pageType === PageType.WATCH
      ? ".tmc-wp-checkbox-wrapper"
      : ".tmc-pp-checkbox-wrapper";

  for (const checkboxWrapper of document.querySelectorAll(selector)) {
    const checkbox = checkboxWrapper.querySelector<HTMLInputElement>(
      "input[type=checkbox]"
    );
    if (!checkbox) continue;
    checkbox.checked = state.videoWatchStatus[checkbox.id] ?? false;
  }
}

export function removeWPVideoCheckboxes(): void {
  removeElements(".tmc-wp-checkbox-wrapper");
}

export function removePPVideoCheckboxes(): void {
  removeElements(".tmc-pp-checkbox-wrapper");
}

export function removeVideoCheckboxes(): void {
  removeElements(".tmc-checkbox-wrapper");
}

async function handleCheckboxClick(
  event: MouseEvent,
  video: Element,
  videoId: string,
  signal: AbortSignal
): Promise<void> {
  try {
    event.stopPropagation();

    const target = event.currentTarget;
    if (!(target instanceof HTMLInputElement)) return;

    const durationSeconds = await readVideoDurationSeconds(video, signal);
    const result = await synchronizeVideoStatus(
      videoId,
      target.checked,
      durationSeconds
    );

    showToast(
      result.coursesUpdated > 1
        ? `Progress updated in ${result.coursesUpdated} courses`
        : "Progress updated"
    );
  } catch (err) {
    if (err instanceof DOMException && err.name === "AbortError") return;
    console.error("[TMC] Unexpected error during checkbox update:", err);
  }
}

async function readVideoDurationSeconds(
  video: Element,
  signal: AbortSignal
): Promise<number> {
  const existingDuration = video.querySelector(
    SELECTORS.videoDuration
  )?.textContent;
  if (existingDuration) return hmsToSeconds(existingDuration);

  const durationEl = await waitForElement({
    selector: SELECTORS.videoDuration,
    parentEl: video,
    signal
  });
  return hmsToSeconds(durationEl.textContent ?? "");
}

function removeElements(selector: string): void {
  for (const el of document.querySelectorAll(selector)) {
    el.remove();
  }
}
