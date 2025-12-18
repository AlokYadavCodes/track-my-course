function getCompletedPercentage(course) {
    const { watchedDuration, totalDuration } = course;
    if (
        !totalDuration ||
        (totalDuration.hours === 0 && totalDuration.minutes === 0 && totalDuration.seconds === 0)
    ) {
        return 0;
    }
    const watchedSeconds =
        watchedDuration.hours * 3600 + watchedDuration.minutes * 60 + watchedDuration.seconds;
    const totalSeconds =
        totalDuration.hours * 3600 + totalDuration.minutes * 60 + totalDuration.seconds;
    return Math.round((watchedSeconds / totalSeconds) * 100);
}

function updateCoursesCount() {
    const inProgressEl = document.querySelector(".in-progress-course-count");
    const completedEl = document.querySelector(".completed-course-count");
    if (inProgressEl) inProgressEl.textContent = inProgressCoursesCount;
    if (completedEl) completedEl.textContent = completedCoursesCount;
}

const NO_COURSES_IN_PROGRESS = "All caught up! Time to find your next course.";
const NO_COURSES_COMPLETED =
    "Keep up the great work! Can't wait to see your first completed course here.";

function createNoCourseElement(message) {
    const noCourseDiv = document.createElement("div");
    noCourseDiv.className = "no-course-message";
    noCourseDiv.textContent = message;
    return noCourseDiv;
}

document.addEventListener("DOMContentLoaded", async () => {
    const storageData = await chrome.storage.local.get(null);
    const isFocusModeEnabled = storageData.focusMode || false;
    const courses = { ...storageData };
    delete courses.focusMode; // Exclude focusMode from course list

    initializeFocusMode(isFocusModeEnabled);
    await renderCourses(courses);
    addClickListeners();
});

let inProgressCoursesCount = 0;
let completedCoursesCount = 0;

function initializeFocusMode(isEnabled) {
    const focusModeToggle = document.getElementById("focus-mode-toggle");
    if (focusModeToggle) {
        focusModeToggle.checked = isEnabled;
    }
}

async function renderCourses(courses) {
    inProgressCoursesCount = 0;
    completedCoursesCount = 0;

    const inProgressCoursesEl = document.querySelector(".in-progress-courses");
    const completedCoursesEl = document.querySelector(".completed-courses");

    const welcomeMessageEl = document.getElementById("welcome-message");
    const courseListsContainerEl = document.getElementById("course-lists-container");

    inProgressCoursesEl.innerHTML = "";
    completedCoursesEl.innerHTML = "";

    if (!courses) {
        courses = await chrome.storage.local.get(null);
        delete courses.focusMode; // Exclude focusMode from course list
    }
    const courseValues = Object.values(courses);

    // If there are no courses, show the welcome message and hide the lists
    if (courseValues.length === 0) {
        welcomeMessageEl.classList.remove("hidden");
        courseListsContainerEl.classList.add("hidden");
        updateCoursesCount();
        return;
    }

    // If courses exist, show the lists and hide the welcome message
    welcomeMessageEl.classList.add("hidden");
    courseListsContainerEl.classList.remove("hidden");

    for (const courseId in courses) {
        const course = courses[courseId];
        const courseElement = createCourseElement(courseId, course);

        if (getCompletedPercentage(course) === 100) {
            completedCoursesCount++;
            completedCoursesEl.append(courseElement);
        } else {
            inProgressCoursesCount++;
            inProgressCoursesEl.append(courseElement);
        }
    }

    if (inProgressCoursesCount === 0) {
        inProgressCoursesEl.append(createNoCourseElement(NO_COURSES_IN_PROGRESS));
    }
    if (completedCoursesCount === 0) {
        completedCoursesEl.append(createNoCourseElement(NO_COURSES_COMPLETED));
    }
    updateCoursesCount();
}

function createCourseElement(courseId, course) {
    const completedPercentage = getCompletedPercentage(course);

    const courseElement = document.createElement("div");
    courseElement.className = "course";
    courseElement.dataset.courseId = courseId;

    // Course content container
    const content = document.createElement("div");
    content.className = "course-content";

    // Course thumbnail
    const courseHref = course.lastWatchedVideoId
        ? `https://www.youtube.com/watch?v=${course.lastWatchedVideoId}&list=${courseId}`
        : `https://www.youtube.com/playlist?list=${courseId}`;

    const thumbnail = document.createElement("a");
    thumbnail.className = "thumbnail";
    thumbnail.href = courseHref;
    thumbnail.target = "_blank";
    thumbnail.rel = "noopener noreferrer";
    const img = document.createElement("img");
    img.src = course.courseImgSrc;
    img.alt = "Course Image";
    thumbnail.append(img);

    // Thumbnail overlay
    const thumbnailOverlay = document.createElement("div");
    thumbnailOverlay.className = "thumbnail-overlay";
    const overlayIcon = document.createElement("div");
    overlayIcon.className = "icon";
    overlayIcon.innerHTML = course.lastWatchedVideoId
        ? `<svg
            xmlns="http://www.w3.org/2000/svg"
            height="28"
            width="28"
            viewBox="0 0 24 24"
            fill="currentColor"
            focusable="false"
            aria-hidden="true"
            style="pointer-events: none; display: inherit; width: 100%; height: 100%;"
        >
            <path d="M5 4.623V19.38a1.5 1.5 0 002.26 1.29L22 12 7.26 3.33A1.5 1.5 0 005 4.623Z"></path>
        </svg>`
        : `<svg
            xmlns="http://www.w3.org/2000/svg"
            height="28"
            width="28"
            viewBox="0 0 24 24"
            fill="currentColor"
            focusable="false"
            aria-hidden="true"
            style="pointer-events: none; display: inherit; width: 100%; height: 100%;"
        >
            <path d="M11.485 2.143 1.486 8.148a1 1 0 000 1.715l10 5.994a1 1 0 001.028 0L21 10.77V18a1 1 0 002 0V9a1 1 0 00-.485-.852l-10-6.005a1 1 0 00-1.03 0ZM19 16.926V14.3l-5.458 3.27a3 3 0 01-3.084 0L5 14.3v2.625a2 2 0 00.992 1.73l5.504 3.21a1 1 0 001.008 0l5.504-3.212A2 2 0 0019 16.926Z"></path>
        </svg>`;
    const overlayText = document.createElement("div");
    overlayText.className = "text";
    overlayText.textContent = course.lastWatchedVideoId ? "Resume" : "View Course";
    thumbnailOverlay.append(overlayIcon, overlayText);
    thumbnail.append(thumbnailOverlay);

    // Course info
    const info = document.createElement("a");
    info.className = "course-info";
    info.href = `https://www.youtube.com/playlist?list=${courseId}`;
    info.target = "_blank";
    info.rel = "noopener noreferrer";
    const title = document.createElement("h3");
    title.textContent = course.courseName || "Untitled Course";
    const completion = document.createElement("p");
    completion.className = "completion";
    completion.textContent = `${completedPercentage}% completed`;

    // Progress bar
    const progressBar = document.createElement("div");
    progressBar.className = "progress-bar";
    const progressFill = document.createElement("div");
    progressFill.className = "progress-fill";
    progressFill.style.width = `${completedPercentage}%`;
    progressBar.append(progressFill);

    info.append(title, completion, progressBar);
    content.append(thumbnail, info);
    courseElement.append(content);

    // Delete button
    const deleteBtn = document.createElement("button");
    deleteBtn.className = "delete-btn";
    deleteBtn.title = "Remove Course";
    deleteBtn.innerHTML = `<svg width="16" height="16" viewBox="0 0 24 24"><path d="M6 7H12M18 7H12M12 7V7C12 7 12 7.58172 12 8.5C12 9.41828 12 10 12 10M12 7V7C12 7 12 6.41828 12 5.5C12 4.58172 12 4 12 4M10 11V17M14 11V17M5 7L6 19C6 20.1046 6.89543 21 8 21H16C17.1046 21 18 20.1046 18 19L19 7M9 4C9 3.44772 9.44772 3 10 3H14C14.5523 3 15 3.44772 15 4V7H9V4Z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
    courseElement.append(deleteBtn);

    // Delete confirmation
    const deleteConfirmation = document.createElement("div");
    deleteConfirmation.className = "delete-confirmation";
    const p = document.createElement("p");
    p.textContent = "Are you sure you want to remove this course?";
    const actions = document.createElement("div");
    actions.className = "delete-confirmation-actions";

    const cancelBtn = document.createElement("button");
    cancelBtn.className = "cancel-delete-btn";
    cancelBtn.textContent = "Cancel";

    const confirmBtn = document.createElement("button");
    confirmBtn.className = "confirm-delete-btn";
    confirmBtn.textContent = "Remove Course";

    actions.append(cancelBtn, confirmBtn);
    deleteConfirmation.append(p, actions);
    courseElement.append(deleteConfirmation);

    return courseElement;
}

function addClickListeners() {
    document.body.addEventListener("click", (e) => {
        const target = e.target;

        const focusModeToggle = target.closest("#focus-mode-toggle");
        if (focusModeToggle) {
            chrome.storage.local.set({ focusMode: target.checked });
        }

        const summary = target.closest(".courses-summary");
        if (summary) {
            const coursesContainer = summary.nextElementSibling;
            const arrow = summary.querySelector("svg");
            if (coursesContainer) coursesContainer.classList.toggle("hide");
            if (arrow) arrow.classList.toggle("rotate");
            return;
        }

        const course = target.closest(".course");
        if (!course) return;

        if (target.closest(".delete-btn")) {
            course.classList.add("deleting");
        } else if (target.closest(".cancel-delete-btn")) {
            course.classList.remove("deleting");
        } else if (target.closest(".confirm-delete-btn")) {
            const isCompleted = course.parentElement.classList.contains("completed-courses");

            if (isCompleted) {
                completedCoursesCount--;
                if (completedCoursesCount === 0) {
                    document
                        .querySelector(".completed-courses")
                        .append(createNoCourseElement(NO_COURSES_COMPLETED));
                }
            } else {
                inProgressCoursesCount--;
                if (inProgressCoursesCount === 0) {
                    document
                        .querySelector(".in-progress-courses")
                        .append(createNoCourseElement(NO_COURSES_IN_PROGRESS));
                }
            }
            updateCoursesCount();

            chrome.storage.local.remove(course.dataset.courseId);
            course.classList.add("fading-out");
            course.addEventListener("transitionend", () => course.remove(), {
                once: true,
            });
        }
    });
}
