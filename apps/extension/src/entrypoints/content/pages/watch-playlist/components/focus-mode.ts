import { SELECTORS } from "../../../core/selectors";
import { isEnrolledCourse } from "../../../core/state";

export function toggleFocusModeUI(isFocusModeOn: boolean): void {
  const body = document.body;

  if (isFocusModeOn && isEnrolledCourse()) {
    body.classList.add("tmc-focus-mode");
    addCommentsToggleButton();
  } else {
    body.classList.remove("tmc-focus-mode");
    removeCommentsToggleButton();
  }
}

export function addCommentsToggleButton(): void {
  if (document.getElementById("tmc-toggle-comments-btn")) return;

  const commentsSection = document.querySelector(SELECTORS.watchPage.comments);
  if (!commentsSection || !commentsSection.parentNode) return;

  commentsSection.classList.add("tmc-comments-hidden");
  const button = document.createElement("button");
  button.id = "tmc-toggle-comments-btn";
  button.type = "button";
  button.textContent = "Show Comments";
  button.addEventListener("click", () => {
    const isHidden = commentsSection.classList.toggle("tmc-comments-hidden");
    button.textContent = isHidden ? "Show Comments" : "Hide Comments";
  });

  commentsSection.parentNode.insertBefore(button, commentsSection);
}

export function removeCommentsToggleButton(): void {
  document.getElementById("tmc-toggle-comments-btn")?.remove();
}
