import { formatDuration, formatDurationShort } from "@repo/core/duration";
import { getProgressPercent, getRemainingDuration } from "@repo/core/progress";

import { createAbortError, waitForElement } from "../core/dom-utils";
import { SELECTORS } from "../core/selectors";
import { state } from "../core/state";
import { updateVideoCheckboxes } from "./checkbox";

const RING_RADIUS = 9;
const RING_CIRCUMFERENCE = 2 * Math.PI * RING_RADIUS;
let detachedWatchPlaylistActions: Element | null = null;

export interface ProgressBarOptions {
  signal: AbortSignal;
  onDeleteCourse?: (playlistId: string) => Promise<void> | void;
  onUpdatePlaylist?: () => Promise<void> | void;
}

export async function renderWPProgressDiv({
  signal,
  onDeleteCourse
}: ProgressBarOptions): Promise<void> {
  if (signal.aborted) throw createAbortError();
  if (document.querySelector(".tmc-wp-progress-div")) return;

  const progressDiv = document.createElement("div");
  progressDiv.classList.add("tmc-progress-div", "tmc-wp-progress-div");

  const wrapper = document.createElement("div");
  wrapper.className = "progress-content-wrapper";

  const timeContainer = document.createElement("div");
  timeContainer.className = "time-container";

  const watchedTime = document.createElement("div");
  watchedTime.id = "watched-time";
  watchedTime.textContent = formatDuration(state.watchedDuration);

  const completedVideos = document.createElement("div");
  completedVideos.className = "completed-videos";
  completedVideos.append(
    checkedCircleIcon(16),
    watchedCountText("watched-videos-count", "total-videos-count")
  );

  const totalTime = document.createElement("div");
  totalTime.id = "total-time";
  totalTime.textContent = formatDuration(state.totalDuration);
  timeContainer.append(watchedTime, completedVideos, totalTime);

  const progressBarOuter = document.createElement("div");
  progressBarOuter.className = "progress-bar-outer-container";

  const progressBarContainer = document.createElement("div");
  progressBarContainer.className = "progress-bar-container";

  const progressBar = document.createElement("div");
  progressBar.id = "progress-bar";
  progressBar.style.width = `${getProgressPercent(state)}%`;
  progressBarContainer.append(progressBar);
  progressBarOuter.append(progressBarContainer);

  const completedDiv = document.createElement("div");
  completedDiv.className = "completed-in";
  completedDiv.append(
    progressPercentElement(),
    boldText("%"),
    document.createTextNode(" completed in "),
    investedTimeElement()
  );

  const { deleteBtn, deletePopup } = createDeleteControls({
    onConfirm: () => deleteCurrentCourse(onDeleteCourse)
  });

  wrapper.append(timeContainer, progressBarOuter, completedDiv, deleteBtn);
  progressDiv.append(wrapper, deletePopup);

  const headerContents = await waitForElement({
    selector: SELECTORS.watchPage.headerContents,
    signal
  });
  const playlistActions = await waitForElement({
    selector: SELECTORS.watchPage.playlistActions,
    signal
  });

  if (signal.aborted) throw createAbortError();
  detachedWatchPlaylistActions = playlistActions;
  playlistActions.remove();
  headerContents.append(progressDiv);

  progressDiv.addEventListener("click", (event) => event.stopPropagation());
}

export async function renderPPProgressDiv({
  signal,
  onDeleteCourse,
  onUpdatePlaylist
}: ProgressBarOptions): Promise<void> {
  if (signal.aborted) throw createAbortError();
  if (document.querySelector(".tmc-pp-progress-div")) return;

  const progressDiv = document.createElement("div");
  progressDiv.classList.add("tmc-progress-div", "tmc-pp-progress-div");

  const wrapper = document.createElement("div");
  wrapper.className = "progress-content-wrapper";
  wrapper.append(
    playlistStatBlock("tmc-total", videoIcon(), totalVideoCountText()),
    playlistStatBlock(
      "tmc-duration",
      clockIcon(),
      textSpan("tmc-duration-text", formatDuration(state.totalDuration))
    ),
    playlistStatBlock("tmc-watched", checkedCircleIcon(16), watchedText()),
    remainingBlock(),
    playlistActions(onUpdatePlaylist)
  );

  const { deletePopup } = createDeleteControls({
    onConfirm: () => deleteCurrentCourse(onDeleteCourse)
  });
  progressDiv.append(wrapper, deletePopup);

  const selector = state.isYtCourse
    ? SELECTORS.playlistPage.ytCourse.progressDivWideScreenRefEl
    : SELECTORS.playlistPage.progressDivWideScreenRefEl;
  const targetEl = await waitForElement({ selector, signal });

  if (signal.aborted) throw createAbortError();
  targetEl.insertAdjacentElement("beforebegin", progressDiv);
}

export function refreshWatchPageUI({ signal }: { signal: AbortSignal }): void {
  const progressDiv = document.querySelector(".tmc-wp-progress-div");
  if (!progressDiv || signal.aborted) return;

  setText(progressDiv, "#watched-time", formatDuration(state.watchedDuration));
  setText(progressDiv, "#total-time", formatDuration(state.totalDuration));
  setText(
    progressDiv,
    "#invested-time",
    formatDurationShort(state.investedTime)
  );
  setText(progressDiv, "#watched-videos-count", watchedVideoCount().toString());
  setText(progressDiv, "#total-videos-count", totalVideoCount().toString());

  const percentage = getProgressPercent(state);
  setText(progressDiv, "#progress-percent", percentage.toString());
  const progressBar = progressDiv.querySelector<HTMLElement>("#progress-bar");
  if (progressBar) progressBar.style.width = `${percentage}%`;

  if (!signal.aborted) updateVideoCheckboxes("watch");
}

export function refreshPlaylistPageUI({
  signal
}: {
  signal: AbortSignal;
}): void {
  const progressDiv = document.querySelector(".tmc-pp-progress-div");
  if (!progressDiv || signal.aborted) return;

  setText(progressDiv, ".tmc-total-text", `${totalVideoCount()} videos`);
  setText(
    progressDiv,
    ".tmc-duration-text",
    formatDuration(state.totalDuration)
  );
  setText(
    progressDiv,
    ".tmc-watched-text",
    `${watchedVideoCount()} / ${totalVideoCount()} watched`
  );

  const percent = getProgressPercent(state);
  const ringOffset = RING_CIRCUMFERENCE * (1 - percent / 100);
  progressDiv
    .querySelector(".tmc-ring-progress")
    ?.setAttribute("stroke-dashoffset", ringOffset.toString());
  setText(
    progressDiv,
    ".tmc-remaining-text",
    `${percent}% · ${remainingDurationText()} left`
  );

  updateVideoCheckboxes("playlist");
}

export function removeWPProgressDiv(): void {
  document.querySelector(".tmc-wp-progress-div")?.remove();
  restoreWatchPlaylistActions();
}

export function removePPProgressDiv(): void {
  document.querySelector(".tmc-pp-progress-div")?.remove();
}

export function removeProgressDiv(): void {
  document.querySelector(".tmc-progress-div")?.remove();
  restoreWatchPlaylistActions();
}

function restoreWatchPlaylistActions(): void {
  if (!detachedWatchPlaylistActions) return;

  const headerContents = document.querySelector(
    SELECTORS.watchPage.headerContents
  );
  if (headerContents && !detachedWatchPlaylistActions.isConnected) {
    headerContents.append(detachedWatchPlaylistActions);
  }
  detachedWatchPlaylistActions = null;
}

function createDeleteControls({
  onConfirm
}: {
  onConfirm: () => Promise<void> | void;
}): {
  deleteBtn: HTMLDivElement;
  deletePopup: HTMLDivElement;
} {
  const deleteBtn = document.createElement("div");
  deleteBtn.className = "tmc-delete-btn";
  deleteBtn.innerHTML = deleteIcon();

  const deletePopup = document.createElement("div");
  deletePopup.className = "tmc-delete-popup";

  const popupText = document.createElement("p");
  popupText.textContent = "Remove this course?";

  const deleteButtons = document.createElement("div");
  deleteButtons.className = "tmc-delete-buttons";

  const confirmBtn = document.createElement("button");
  confirmBtn.type = "button";
  confirmBtn.className = "tmc-confirm-delete";
  confirmBtn.textContent = "Yes";

  const cancelBtn = document.createElement("button");
  cancelBtn.type = "button";
  cancelBtn.className = "tmc-cancel-delete";
  cancelBtn.textContent = "No";

  deleteButtons.append(confirmBtn, cancelBtn);
  deletePopup.append(popupText, deleteButtons);

  deleteBtn.addEventListener("click", (event) => {
    event.stopPropagation();
    deleteBtn.closest(".tmc-progress-div")?.classList.add("deleting");
  });
  cancelBtn.addEventListener("click", (event) => {
    event.stopPropagation();
    cancelBtn.closest(".tmc-progress-div")?.classList.remove("deleting");
  });
  confirmBtn.addEventListener("click", (event) => {
    event.stopPropagation();
    void onConfirm();
  });

  return { deleteBtn, deletePopup };
}

async function deleteCurrentCourse(
  onDeleteCourse: ProgressBarOptions["onDeleteCourse"]
): Promise<void> {
  if (!state.playlistId || !onDeleteCourse) return;
  await onDeleteCourse(state.playlistId);
}

function playlistActions(
  onUpdatePlaylist: ProgressBarOptions["onUpdatePlaylist"]
): HTMLDivElement {
  const actionsDiv = document.createElement("div");
  actionsDiv.className = "tmc-actions";

  const refreshDiv = document.createElement("div");
  refreshDiv.className = "tmc-refresh";
  refreshDiv.title = "Update Playlist";
  refreshDiv.innerHTML = refreshIcon();
  refreshDiv.addEventListener("click", async () => {
    const svg = refreshDiv.querySelector("svg");
    if (
      svg?.classList.contains("rotating") ||
      svg?.classList.contains("scanning")
    ) {
      return;
    }
    svg?.classList.add("rotating");
    window.setTimeout(() => svg?.classList.remove("rotating"), 400);
    await onUpdatePlaylist?.();
  });

  const deleteDiv = document.createElement("div");
  deleteDiv.className = "tmc-delete tmc-delete-btn";
  deleteDiv.title = "Remove Course";
  deleteDiv.innerHTML = deleteIcon();
  deleteDiv.addEventListener("click", () => {
    deleteDiv.closest(".tmc-progress-div")?.classList.add("deleting");
  });

  actionsDiv.append(refreshDiv, deleteDiv);
  return actionsDiv;
}

function playlistStatBlock(
  className: string,
  icon: SVGElement,
  text: HTMLElement
): HTMLDivElement {
  const block = document.createElement("div");
  block.className = className;
  block.append(icon, text);
  return block;
}

function remainingBlock(): HTMLDivElement {
  const remainingDiv = document.createElement("div");
  remainingDiv.className = "tmc-remaining";
  remainingDiv.append(progressRing(), textSpan("tmc-remaining-text", ""));
  setText(
    remainingDiv,
    ".tmc-remaining-text",
    `${getProgressPercent(state)}% · ${remainingDurationText()} left`
  );
  return remainingDiv;
}

function progressRing(): SVGElement {
  const percent = getProgressPercent(state);
  const ringOffset = RING_CIRCUMFERENCE * (1 - percent / 100);
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("width", "20");
  svg.setAttribute("height", "20");
  svg.setAttribute("viewBox", "0 0 24 24");
  svg.setAttribute("fill", "none");
  svg.classList.add("tmc-progress-ring");
  svg.innerHTML = `
    <circle cx="12" cy="12" r="${RING_RADIUS}" stroke="currentColor" stroke-width="2.5" opacity="0.2"></circle>
    <circle class="tmc-ring-progress" cx="12" cy="12" r="${RING_RADIUS}" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-dasharray="${RING_CIRCUMFERENCE}" stroke-dashoffset="${ringOffset}" transform="rotate(-90 12 12)"></circle>
  `;
  return svg;
}

function watchedCountText(watchedId: string, totalId: string): HTMLSpanElement {
  const videosSpan = document.createElement("span");
  const watchedCount = document.createElement("span");
  watchedCount.id = watchedId;
  watchedCount.textContent = watchedVideoCount().toString();

  const totalCount = document.createElement("span");
  totalCount.id = totalId;
  totalCount.textContent = totalVideoCount().toString();

  videosSpan.append(watchedCount, "/", totalCount, "watched");
  return videosSpan;
}

function watchedText(): HTMLSpanElement {
  return textSpan(
    "tmc-watched-text",
    `${watchedVideoCount()} / ${totalVideoCount()} watched`
  );
}

function totalVideoCountText(): HTMLSpanElement {
  return textSpan("tmc-total-text", `${totalVideoCount()} videos`);
}

function progressPercentElement(): HTMLElement {
  const progressPercent = document.createElement("b");
  progressPercent.id = "progress-percent";
  progressPercent.textContent = getProgressPercent(state).toString();
  return progressPercent;
}

function investedTimeElement(): HTMLElement {
  const investedTime = document.createElement("b");
  investedTime.id = "invested-time";
  investedTime.textContent = formatDurationShort(state.investedTime);
  return investedTime;
}

function textSpan(className: string, text: string): HTMLSpanElement {
  const span = document.createElement("span");
  span.className = className;
  span.textContent = text;
  return span;
}

function boldText(text: string): HTMLElement {
  const bold = document.createElement("b");
  bold.textContent = text;
  return bold;
}

function watchedVideoCount(): number {
  return Object.values(state.videoWatchStatus).filter(Boolean).length;
}

function totalVideoCount(): number {
  return Object.keys(state.videoWatchStatus).length;
}

function remainingDurationText(): string {
  return formatDuration(getRemainingDuration(state));
}

function setText(root: ParentNode, selector: string, text: string): void {
  const element = root.querySelector(selector);
  if (element) element.textContent = text;
}

function videoIcon(): SVGElement {
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("viewBox", "0 0 24 24");
  svg.setAttribute("width", "20");
  svg.setAttribute("height", "20");
  svg.setAttribute("fill", "currentColor");
  svg.setAttribute("aria-hidden", "true");
  svg.innerHTML =
    '<path d="M17 10.5V7c0-1.1-.9-2-2-2H5C3.9 5 3 5.9 3 7v10c0 1.1.9 2 2 2h10c1.1 0 2-.9 2-2v-3.5l4 4v-11l-4 4z"></path>';
  return svg;
}

function clockIcon(): SVGElement {
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("width", "16");
  svg.setAttribute("height", "16");
  svg.setAttribute("viewBox", "0 0 24 24");
  svg.setAttribute("fill", "none");
  svg.setAttribute("stroke", "currentColor");
  svg.setAttribute("stroke-width", "2");
  svg.innerHTML =
    '<circle cx="12" cy="12" r="10"></circle><line x1="12" y1="12" x2="12" y2="8" stroke-linecap="round"></line><line x1="12" y1="12" x2="15" y2="12" stroke-linecap="round"></line>';
  return svg;
}

function checkedCircleIcon(size: number): SVGElement {
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("width", size.toString());
  svg.setAttribute("height", size.toString());
  svg.setAttribute("viewBox", "0 0 24 24");
  svg.setAttribute("fill", "none");
  svg.setAttribute("stroke", "currentColor");
  svg.setAttribute("stroke-width", "2");
  svg.innerHTML =
    '<circle cx="12" cy="12" r="10"></circle><path d="M8.5 12.5L11 15l5-5.5" stroke-linecap="round" stroke-linejoin="round"></path>';
  return svg;
}

function deleteIcon(): string {
  return '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 7h12M10 11v6M14 11v6M5 7l1 12a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2l1-12M9 7V5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2" stroke-linecap="round" stroke-linejoin="round"></path></svg>';
}

function refreshIcon(): string {
  return '<svg class="tmc-refresh-svg" xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 24 24"><path d="M17.65 6.35A7.95 7.95 0 0 0 12 4a8 8 0 0 0-8 8h2a6 6 0 0 1 6-6c1.66 0 3.14.69 4.22 1.78L13 11h7V4l-2.35 2.35zM6.35 17.65A7.95 7.95 0 0 0 12 20a8 8 0 0 0 8-8h-2a6 6 0 0 1-6 6c-1.66 0-3.14-.69-4.22-1.78L11 13H4v7l2.35-2.35z"/></svg>';
}
