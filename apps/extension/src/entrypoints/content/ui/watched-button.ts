import { hmsToSeconds } from "@repo/core/duration";
import { getVideoId } from "@repo/core/url";

import { courseRepository } from "../../../storage/course-repository";
import { waitForElement, waitForNavigation } from "../core/dom-utils";
import { synchronizeVideoStatus } from "../services/course-service";
import { showToast } from "./toast";

const SPARK_COLORS = [
  "#FF6D93",
  "#FF4878",
  "#FFD54F",
  "#FF6D93",
  "#FFD54F",
  "#FF4878",
  "#FFD54F",
  "#FF6D93"
];

export async function renderVideoWatchedButton({
  signal
}: {
  signal: AbortSignal;
}): Promise<void> {
  const videoId = getVideoId(window.location.href);
  if (!videoId) {
    removeVideoWatchedButton();
    return;
  }

  const matchedCourses =
    await courseRepository.getCoursesContainingVideo(videoId);
  if (matchedCourses.length === 0) {
    removeVideoWatchedButton();
    return;
  }

  const isWatched = matchedCourses.some((course) => course.isWatched);

  await waitForNavigation();
  const ytVideoActionDiv = await waitForElement({
    selector: "ytd-watch-metadata #top-level-buttons-computed",
    signal
  });
  if (signal.aborted) return;

  const existingButton =
    document.querySelector<HTMLButtonElement>(".tmc-watched-btn");
  if (existingButton) {
    existingButton.classList.toggle("watched", isWatched);
    return;
  }

  const watchedBtn = document.createElement("button");
  watchedBtn.type = "button";
  watchedBtn.className = `tmc-watched-btn${isWatched ? " watched" : ""}`;
  watchedBtn.innerHTML = `
    <svg class="tmc-watched-icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="24" height="24" fill="none">
      <circle class="tmc-circle-outline" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
      <circle class="tmc-circle-fill" cx="12" cy="12" r="11" fill="currentColor"/>
      <path class="tmc-watched-tick" d="M8.5 12.5L11 15L16 9" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
    </svg>
  `;

  const label = document.createElement("span");
  label.className = "tmc-watched-label";
  label.textContent = "Watched";
  watchedBtn.append(label);

  watchedBtn.addEventListener("click", () => {
    void handleWatchedButtonClick(watchedBtn, videoId);
  });

  ytVideoActionDiv.children[0]?.insertAdjacentElement("afterend", watchedBtn);
}

export function removeVideoWatchedButton(): void {
  document.querySelector(".tmc-watched-btn")?.remove();
}

async function handleWatchedButtonClick(
  watchedBtn: HTMLButtonElement,
  videoId: string
): Promise<void> {
  const player = document.querySelector("#movie_player");
  const isAdShowing = player?.classList.contains("ad-showing");
  if (isAdShowing) {
    showToast("Cannot mark as watched while an ad is playing.");
    return;
  }

  const nextWatchedState = watchedBtn.classList.toggle("watched");
  if (nextWatchedState) animateWatchedButton(watchedBtn);

  const durationText =
    document.querySelector(".ytp-time-duration")?.textContent ?? "";
  const result = await synchronizeVideoStatus(
    videoId,
    nextWatchedState,
    hmsToSeconds(durationText)
  );

  showToast(
    result.coursesUpdated > 1
      ? `Progress updated in ${result.coursesUpdated} courses`
      : "Progress updated"
  );
}

function animateWatchedButton(watchedBtn: HTMLButtonElement): void {
  watchedBtn.classList.add("tmc-watched-btn--animating");

  const sparks = SPARK_COLORS.map((color, index) => {
    const spark = document.createElement("span");
    spark.className = "tmc-spark";
    const angle = (index / SPARK_COLORS.length) * 2 * Math.PI;
    spark.style.setProperty("--angle", `${angle}rad`);
    spark.style.backgroundColor = color;
    watchedBtn.append(spark);
    return spark;
  });

  window.setTimeout(() => {
    watchedBtn.classList.remove("tmc-watched-btn--animating");
    sparks.forEach((spark) => spark.remove());
  }, 1000);
}
