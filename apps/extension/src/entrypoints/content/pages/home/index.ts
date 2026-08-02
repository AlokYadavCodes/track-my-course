import { courseRepository } from "../../../../storage/course-repository";
import { createAbortError, waitForElement } from "../../core/dom-utils";
import { SELECTORS } from "../../core/selectors";
import { createCourseCard } from "./components/course-card";

export async function updateHomePage(signal: AbortSignal): Promise<void> {
  await renderHomeCoursesSection(signal);
}

export async function updateHomeCoursesContent(
  signal: AbortSignal
): Promise<void> {
  await renderHomeCoursesSection(signal);
}

export function removeHomeCoursesSection(): void {
  document.querySelector(".tmc-home-section")?.remove();
}

async function renderHomeCoursesSection(signal: AbortSignal): Promise<void> {
  if (signal.aborted) throw createAbortError();

  const courses = (await courseRepository.getAllCourses()).sort(
    (a, b) => (b.lastInteractedAt ?? 0) - (a.lastInteractedAt ?? 0)
  );

  removeHomeCoursesSection();
  if (courses.length === 0 || signal.aborted) return;

  const coursesSection = document.createElement("div");
  coursesSection.className = "tmc-home-section";

  const sectionTitle = document.createElement("div");
  sectionTitle.className = "tmc-home-section-title";
  sectionTitle.textContent = "Your Courses";

  const coursesScroller = document.createElement("div");
  coursesScroller.className = "tmc-home-courses-scroller";
  for (const course of courses) {
    coursesScroller.append(createCourseCard(course));
  }

  coursesSection.append(sectionTitle, coursesScroller);

  const homePage = await waitForElement({
    selector: SELECTORS.homePage.homePage,
    signal
  });

  if (signal.aborted) throw createAbortError();
  if (homePage.firstChild !== coursesSection) {
    homePage.insertBefore(coursesSection, homePage.firstChild);
  }
}
