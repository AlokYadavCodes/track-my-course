import { createAbortError, waitForElement } from "../core/dom-utils";
import { SELECTORS } from "../core/selectors";
import { state } from "../core/state";

export interface StartCourseButtonOptions {
  signal: AbortSignal;
  onStartCourse: () => Promise<void>;
}

export async function renderWPStartCourseBtn({
  signal,
  onStartCourse
}: StartCourseButtonOptions): Promise<void> {
  if (signal.aborted) throw createAbortError();
  if (document.querySelector(".tmc-wp-start-course-btn")) return;

  const menu = await waitForElement({
    selector: SELECTORS.watchPage.playlistMenu,
    signal
  });

  const startCourseBtn = document.createElement("button");
  startCourseBtn.type = "button";
  startCourseBtn.textContent = "Start Course";
  startCourseBtn.classList.add(
    "tmc-start-course-btn",
    "tmc-wp-start-course-btn"
  );

  if (signal.aborted) throw createAbortError();
  menu.append(startCourseBtn);
  bindStartCourseClick(startCourseBtn, onStartCourse);
}

export async function renderPPStartCourseBtn({
  signal,
  onStartCourse
}: StartCourseButtonOptions): Promise<void> {
  if (signal.aborted) throw createAbortError();
  if (document.querySelector(".tmc-pp-start-course-btn")) return;

  const selector = state.isYtCourse
    ? SELECTORS.playlistPage.ytCourse.startCourseBtnWideScreenRefEl
    : SELECTORS.playlistPage.startCourseBtnWideScreenRefEl;
  const refEl = await waitForElement({ selector, signal });

  const startCourseBtn = document.createElement("a");
  startCourseBtn.textContent = "Start Course";
  startCourseBtn.className = "tmc-start-course-btn tmc-pp-start-course-btn";
  startCourseBtn.href = "javascript:void 0";
  startCourseBtn.style.margin = state.isYtCourse
    ? "-6px 0px 10px 0px"
    : "10px 0px";

  refEl.insertAdjacentElement("afterend", startCourseBtn);
  if (signal.aborted) throw createAbortError();
  bindStartCourseClick(startCourseBtn, onStartCourse);
}

export async function renderDisabledStartCourseBtn({
  signal
}: {
  signal: AbortSignal;
}): Promise<void> {
  if (signal.aborted) throw createAbortError();
  if (document.querySelector(".disabled-btn-container")) return;

  const menu = await waitForElement({
    selector: SELECTORS.watchPage.playlistMenu,
    signal
  });
  const buttonContainerEl = document.createElement("div");
  buttonContainerEl.className = "disabled-btn-container";

  const startBtn = document.createElement("button");
  startBtn.type = "button";
  startBtn.disabled = true;
  startBtn.className =
    "tmc-wp-start-course-btn disabled-tmc-wp-start-course-btn";
  startBtn.textContent = "Start Course";

  const tooltip = document.createElement("div");
  tooltip.className = "tooltip";
  tooltip.append(
    document.createTextNode("This playlist has "),
    boldText("200+ videos"),
    document.createTextNode(", so please start the course from the "),
    playlistPageLink(),
    document.createTextNode(".")
  );

  buttonContainerEl.append(startBtn, tooltip);
  menu.append(buttonContainerEl);

  buttonContainerEl.addEventListener("click", (event) => {
    event.stopPropagation();
  });
}

export function removeStartCourseButtons(): void {
  for (const selector of [".tmc-start-course-btn", ".disabled-btn-container"]) {
    document.querySelector(selector)?.remove();
  }
}

function bindStartCourseClick(
  button: HTMLElement,
  onStartCourse: () => Promise<void>
): void {
  button.addEventListener("click", async (event) => {
    event.preventDefault();
    event.stopPropagation();
    if (button.dataset.processing) return;

    button.dataset.processing = "true";
    button.style.cursor = "not-allowed";
    button.style.opacity = "0.7";

    try {
      await onStartCourse();
    } catch (error) {
      delete button.dataset.processing;
      button.style.cursor = "";
      button.style.opacity = "";
      throw error;
    }
  });
}

function boldText(text: string): HTMLElement {
  const bold = document.createElement("b");
  bold.textContent = text;
  return bold;
}

function playlistPageLink(): HTMLAnchorElement {
  const link = document.createElement("a");
  link.href = state.playlistId
    ? `https://www.youtube.com/playlist?list=${state.playlistId}`
    : "https://www.youtube.com/";
  link.target = "_blank";
  link.rel = "noreferrer";
  link.textContent = "playlist page";
  return link;
}
