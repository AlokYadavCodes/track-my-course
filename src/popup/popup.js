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
    const storageData = await getFromStorage(null);
    const isFocusModeEnabled = storageData.focusMode || false;
    const courses = getCourseEntries(storageData).map(([key, value]) => ({ ...value, id: key }));

    initializeFocusMode(isFocusModeEnabled);
    initializeViewTabs();
    await renderCourses(courses);
    await renderConsistency();
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

    // If there are no courses, show the welcome message and hide the lists
    if (courses.length === 0) {
        welcomeMessageEl.classList.remove("hidden");
        courseListsContainerEl.classList.add("hidden");
        updateCoursesCount();
        return;
    }

    // If courses exist, show the lists and hide the welcome message
    welcomeMessageEl.classList.add("hidden");
    courseListsContainerEl.classList.remove("hidden");

    courses.sort((a, b) => (b.lastInteractedAt ?? 0) - (a.lastInteractedAt ?? 0));
    courses.forEach((course) => {
        const courseElement = createCourseElement(course);

        if (getProgressPercent(course) === 100) {
            completedCoursesCount++;
            completedCoursesEl.append(courseElement);
        } else {
            inProgressCoursesCount++;
            inProgressCoursesEl.append(courseElement);
        }
    });

    if (inProgressCoursesCount === 0) {
        inProgressCoursesEl.append(createNoCourseElement(NO_COURSES_IN_PROGRESS));
    }
    if (completedCoursesCount === 0) {
        completedCoursesEl.append(createNoCourseElement(NO_COURSES_COMPLETED));
    }
    updateCoursesCount();
}

function createCourseElement(course) {
    const progressPercent = getProgressPercent(course);

    const courseElement = document.createElement("div");
    courseElement.className = "course";
    courseElement.dataset.courseId = course.id;

    // Course content container
    const content = document.createElement("div");
    content.className = "course-content";

    // Course thumbnail
    const courseHref = getCourseHref(course);

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
    if (course.lastWatchedVideoId && progressPercent < 100) {
        // Resume icon
        overlayIcon.innerHTML = `<svg
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
        </svg>`;
    } else {
        // View Course icon
        overlayIcon.innerHTML = `<svg
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
    }

    const overlayText = document.createElement("div");
    overlayText.className = "text";
    overlayText.textContent =
        course.lastWatchedVideoId && progressPercent < 100 ? "Resume" : "View Course";
    thumbnailOverlay.append(overlayIcon, overlayText);
    thumbnail.append(thumbnailOverlay);

    // Course info
    const info = document.createElement("a");
    info.className = "course-info";
    info.href = `https://www.youtube.com/playlist?list=${course.id}`;
    info.target = "_blank";
    info.rel = "noopener noreferrer";
    const title = document.createElement("h3");
    title.textContent = course.courseName || "Untitled Course";
    const completion = document.createElement("p");
    completion.className = "completion";
    completion.textContent = `${progressPercent}% completed`;

    // Progress bar
    const progressBar = document.createElement("div");
    progressBar.className = "progress-bar";
    const progressFill = document.createElement("div");
    progressFill.className = "progress-fill";
    progressFill.style.width = `${progressPercent}%`;
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
    const menuDropdown = document.getElementById("kebab-dropdown");

    document.body.addEventListener("click", (e) => {
        const clickedEl = e.target;
        const isInsideDropdown = clickedEl.closest("#kebab-dropdown");

        // --- Kebab menu toggle ---
        if (clickedEl.closest("#kebab-menu-btn")) {
            menuDropdown.classList.toggle("open");
            return;
        }

        // --- Heatmap range toggle ---
        const rangeBtn = clickedEl.closest(".range-btn");
        if (rangeBtn) {
            const weeks = Number(rangeBtn.dataset.weeks);
            if (weeks !== heatmapWeeks) {
                heatmapWeeks = weeks;
                renderConsistency();
            }
            return;
        }

        // --- Focus mode toggle ---
        if (clickedEl.closest("#focus-mode-item")) {
            const focusModeCheckbox = document.getElementById("focus-mode-toggle");
            focusModeCheckbox.checked = !focusModeCheckbox.checked;
            saveToStorage({ focusMode: focusModeCheckbox.checked });
            return;
        }

        // --- Export ---
        if (clickedEl.closest("#export-data-btn")) {
            handleExport();
            return;
        }

        // --- Import ---
        if (clickedEl.closest("#import-data-btn")) {
            chrome.tabs.create({ url: chrome.runtime.getURL("src/pages/import/import.html") });
            menuDropdown.classList.remove("open");
            return;
        }

        // --- Close dropdown on any outside click ---
        if (!isInsideDropdown) {
            menuDropdown.classList.remove("open");
        }

        // --- Section collapse/expand ---
        const sectionHeader = clickedEl.closest(".courses-summary");
        if (sectionHeader) {
            const coursesList = sectionHeader.nextElementSibling;
            const chevron = sectionHeader.querySelector("svg");
            if (coursesList) coursesList.classList.toggle("hide");
            if (chevron) chevron.classList.toggle("rotate");
            return;
        }

        // --- Course card actions ---
        const courseCard = clickedEl.closest(".course");
        if (!courseCard) return;

        if (clickedEl.closest(".delete-btn")) {
            courseCard.classList.add("deleting");
        } else if (clickedEl.closest(".cancel-delete-btn")) {
            courseCard.classList.remove("deleting");
        } else if (clickedEl.closest(".confirm-delete-btn")) {
            const isCompleted = courseCard.parentElement.classList.contains("completed-courses");

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

            removeFromStorage(courseCard.dataset.courseId);
            courseCard.classList.add("fading-out");
            courseCard.addEventListener("transitionend", () => courseCard.remove(), {
                once: true,
            });
        }
    });
}

async function handleExport() {
    const EXPORT_VERSION = 2; // v2 adds the activityLog payload
    const storageData = await getFromStorage(null);

    const exportData = {
        version: EXPORT_VERSION,
        exportedAt: new Date().toISOString(),
        data: storageData,
    };

    const json = JSON.stringify(exportData, null, 2);

    chrome.runtime.sendMessage({
        type: "exportData",
        json,
        filename: `trackmycourse-backup-${new Date().toISOString().slice(0, 10)}.json`,
    });

    document.getElementById("kebab-dropdown").classList.remove("open");
}

// --- consistency view ---
// daily watch activity is logged by the content script (see recordVideoWatched / recordWatchTime
// in shared/utils.js) and drawn here as a GitHub/LeetCode style heatmap in shades of YouTube red

let heatmapWeeks = HEATMAP_WEEKS.HALF_YEAR;

const EMPTY_ACTIVITY_MESSAGE = "No activity yet";

/**
 * Switches between the Courses and Consistency panels. Both panels are rendered up front,
 * so this only moves the `hidden` class around.
 */
function initializeViewTabs() {
    const tabs = Array.from(document.querySelectorAll(".view-tab"));
    const panels = Array.from(document.querySelectorAll(".view-panel"));

    tabs.forEach((tab) => {
        tab.addEventListener("click", () => {
            tabs.forEach((otherTab) => {
                const isActive = otherTab === tab;
                otherTab.classList.toggle("is-active", isActive);
                otherTab.setAttribute("aria-selected", String(isActive));
            });

            panels.forEach((panel) => {
                panel.classList.toggle("hidden", panel.dataset.view !== tab.dataset.view);
            });
        });
    });
}

async function renderConsistency() {
    const log = await getActivityLog();
    const stats = getActivityStats(log);

    setStatValue("current-streak", stats.currentStreak, stats.currentStreak === 0);
    setStatValue("longest-streak", stats.longestStreak, stats.longestStreak === 0);
    setStatValue("active-days", stats.activeDays, stats.activeDays === 0);

    document.getElementById("heatmap-total").textContent = describeTotals(stats);
    document.getElementById("heatmap-title").textContent =
        heatmapWeeks === HEATMAP_WEEKS.YEAR
            ? "Every day of the last 12 months"
            : "Every day of the last 6 months";
    document.getElementById("heatmap-hint").textContent = describeToday(stats);
    document
        .getElementById("heatmap-grid")
        ?.setAttribute("aria-label", `Daily study activity: ${describeTotals(stats)}`);

    document.querySelectorAll(".range-btn").forEach((btn) => {
        btn.classList.toggle("is-active", Number(btn.dataset.weeks) === heatmapWeeks);
    });

    renderHeatmap(buildActivityWeeks(log, { weeks: heatmapWeeks }));
}

function setStatValue(id, value, isCold) {
    const valueEl = document.getElementById(id);
    if (!valueEl) return;
    valueEl.textContent = value;
    valueEl.closest(".streak-card")?.classList.toggle("is-cold", Boolean(isCold));
}

function describeTotals(stats) {
    if (stats.totalVideos === 0 && stats.totalSeconds === 0) return EMPTY_ACTIVITY_MESSAGE;

    const videos = `${stats.totalVideos} video${stats.totalVideos === 1 ? "" : "s"}`;
    return `${videos} watched · ${formatActivityDuration(stats.totalSeconds)} invested`;
}

function describeToday(stats) {
    if (stats.todayVideos === 0 && stats.todaySeconds === 0) {
        return stats.activeDays === 0
            ? "Tick off a video to start your streak."
            : "Nothing logged today yet — keep the streak alive.";
    }

    const parts = [];
    if (stats.todayVideos > 0) {
        parts.push(`${stats.todayVideos} video${stats.todayVideos === 1 ? "" : "s"}`);
    }
    if (stats.todaySeconds > 0) parts.push(formatActivityDuration(stats.todaySeconds));

    return `Today: ${parts.join(" · ")}`;
}

function describeDay(day) {
    const date = day.date.toLocaleDateString(undefined, {
        weekday: "short",
        month: "short",
        day: "numeric",
        year: "numeric",
    });

    if (day.videos === 0 && day.seconds === 0) return `No activity on ${date}`;

    const parts = [];
    if (day.videos > 0) parts.push(`${day.videos} video${day.videos === 1 ? "" : "s"} watched`);
    if (day.seconds > 0) parts.push(formatActivityDuration(day.seconds));

    return `${parts.join(" · ")} on ${date}`;
}

/**
 * @param {Array<Array<{key: string, date: Date, level: number, isToday: boolean, isFuture: boolean}>>} weeks
 */
function renderHeatmap(weeks) {
    const gridEl = document.getElementById("heatmap-grid");
    const scrollEl = document.getElementById("heatmap-scroll");
    if (!gridEl) return;

    gridEl.innerHTML = "";

    weeks.forEach((days) => {
        const weekEl = document.createElement("div");
        weekEl.className = "heatmap-week";

        days.forEach((day) => {
            const cell = document.createElement("span");
            cell.className = `heatmap-cell level-${day.level}`;
            if (day.isFuture) {
                // slots left in the current week — keep them invisible but occupying space
                cell.classList.add("is-empty");
                cell.setAttribute("aria-hidden", "true");
            } else {
                cell.title = describeDay(day);
            }
            if (day.isToday) cell.classList.add("is-today");
            weekEl.append(cell);
        });

        // a month label sits above the column holding that month's first day
        const firstOfMonth = days.find((day) => !day.isFuture && day.date.getDate() === 1);
        if (firstOfMonth) {
            const label = document.createElement("span");
            label.className = "heatmap-month";
            label.textContent = firstOfMonth.date.toLocaleDateString(undefined, { month: "short" });
            weekEl.append(label);
        }

        gridEl.append(weekEl);
    });

    // the year view is wider than the popup, so keep the most recent weeks in sight
    if (scrollEl) {
        scrollEl.scrollLeft = heatmapWeeks === HEATMAP_WEEKS.YEAR ? scrollEl.scrollWidth : 0;
    }
}
