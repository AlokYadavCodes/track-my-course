const SELECTORS = {
    ytNavigationProgress: "yt-page-navigation-progress",
    videoDuration: ".yt-badge-shape__text",

    watchPage: {
        playlistItems: "#playlist:not([hidden]) #items",
        playlistMenu:
            "#playlist:not([hidden]) h3.ytd-playlist-panel-renderer:has(yt-formatted-string.title)",
        headerContents: "#playlist:not([hidden]) #header-contents",
        playlistActions: "#playlist:not([hidden]) #playlist-actions",
        recommendations: "#related",
        comments: "#comments",
    },

    playlistPage: {
        startCourseBtnWideScreenRefEl:
            "ytd-browse[page-subtype=playlist] > yt-page-header-renderer .yt-page-header-view-model__page-header-headline-info:has(yt-description-preview-view-model)",
        startCourseBtnSmallScreenRefEl: "ytd-tabbed-page-header yt-flexible-actions-view-model",
        contentDiv: "#contents:has(>ytd-playlist-video-renderer)",
        progressDivWideScreenRefEl:
            "ytd-browse[page-subtype=playlist] > yt-page-header-renderer .yt-page-header-view-model__page-header-headline-info:has(yt-description-preview-view-model)",
        progressDivSmallScreenRefEl: "ytd-tabbed-page-header yt-flexible-actions-view-model",
        courseTextEl: ".metadata-wrapper badge-shape",
        playlistTextEl: ".page-header-sidebar .yt-content-metadata-view-model__metadata-text",
        playlistNameEl:
            "ytd-browse[page-subtype=playlist] > yt-page-header-renderer .yt-page-header-view-model__page-header-headline-info yt-dynamic-text-view-model span",
        recommendations: "ytd-watch-next-secondary-results-renderer",

        ytCourse: {
            startCourseBtnWideScreenRefEl: ".play-menu.wide-screen-form",
            startCourseBtnSmallScreenRefEl: ".play-menu.small-screen-form",
            progressDivWideScreenRefEl: ".metadata-wrapper > .metadata-action-bar",
            progressDivSmallScreenRefEl: ".metadata-wrapper > .metadata-action-bar",
            playlistNameEl:
                ".metadata-wrapper > yt-dynamic-sizing-formatted-string #container yt-formatted-string",
        },
    },
    homePage: {
        homeFeed: "ytd-rich-grid-renderer #contents",
        gridRenderer: "ytd-rich-grid-renderer",
    },
};

// --- STATE MANAGEMENT ---
const state = {
    playlistId: null,
    videoWatchStatus: {},
    lastWatchedVideoId: null,
    lastInteractedAt: null,
    totalDuration: { hours: 0, minutes: 0, seconds: 0 },
    watchedDuration: { hours: 0, minutes: 0, seconds: 0 },
    investedTime: { hours: 0, minutes: 0, seconds: 0 },
    courseImgSrc: null,
    courseName: null,

    currentPage: null, // set it using PAGE_TYPE
    isYtCourse: false,
    focusMode: false,

    activePageUpdateController: null,
    investedTimeTrackerCleanup: null,
    PPPlacementHandler: null,
    mediaQuery: null,
    playlistActions: null,
};

const PAGE_TYPE = {
    WATCH: "watch",
    PLAYLIST: "playlist",
    HOME: "home",
};

async function updateStateVariables({ signal }) {
    if (signal.aborted) throw createAbortError();
    state.playlistId = getPlaylistId(window.location.href);

    const defaultDuration = { hours: 0, minutes: 0, seconds: 0 };
    const storageData = await getFromStorage([state.playlistId, "focusMode"]);

    const courseData = storageData[state.playlistId] || {};
    state.focusMode = storageData.focusMode || false;

    state.videoWatchStatus = courseData.videoWatchStatus ?? {};
    state.totalDuration = courseData.totalDuration ?? {
        ...defaultDuration,
    };
    state.watchedDuration = courseData.watchedDuration ?? {
        ...defaultDuration,
    };
    state.lastWatchedVideoId = courseData.lastWatchedVideoId || null;
    state.lastInteractedAt = courseData.lastInteractedAt || null;
    state.investedTime = courseData.investedTime ?? { ...defaultDuration };
    state.courseImgSrc = courseData.courseImgSrc ?? null;
    state.courseName = courseData.courseName ?? null;
}

// ---- Runs once when the script first loads ---
const currentURL = window.location.href;
if (currentURL.includes("watch?v=") && currentURL.includes("list=")) {
    state.currentPage = PAGE_TYPE.WATCH;
} else if (currentURL.includes("playlist?list=")) {
    state.currentPage = PAGE_TYPE.PLAYLIST;
} else if (currentURL.includes("/watch?v=")) {
    renderVideoCourseMatches();
} else if (currentURL === "https://www.youtube.com/") {
    state.currentPage = PAGE_TYPE.HOME;
} else {
    state.currentPage = null;
}
if (state.currentPage !== null) handleFullPageUpdate();

// --- EVENT HANDLING & PAGE UPDATES ---

// Handles a full page update: aborts old tasks, cleans the UI, and calls the main update function for the given page type.
async function handleFullPageUpdate(pageType = state.currentPage) {
    try {
        if (state.activePageUpdateController) {
            state.activePageUpdateController.abort();
        }
        state.activePageUpdateController = new AbortController();
        const { signal } = state.activePageUpdateController;

        performCleanUp();
        if (pageType === PAGE_TYPE.WATCH || pageType === PAGE_TYPE.PLAYLIST)
            await updateStateVariables({ signal });
        if (pageType === PAGE_TYPE.WATCH) toggleFocusModeUI(state.focusMode);

        // Decide which update function to call based on the page type.
        if (pageType === PAGE_TYPE.WATCH) await updateWatchPage({ signal });
        else if (pageType === PAGE_TYPE.PLAYLIST) await updatePlaylistPage({ signal });
        else if (pageType === PAGE_TYPE.HOME) await renderHomeCoursesSection({ signal });
    } catch (err) {
        if (err.name !== "AbortError") {
            console.error(`Unexpected error during full update of ${pageType} page:`, err);
        }
    }
}

// Handles a partial update on the Watch Page when navigating within the same playlist. Only re-renders the video checkboxes if it is an enrolled course.
async function handlePartialUpdate() {
    try {
        const isEnrolledCourse = Object.keys(state.videoWatchStatus).length > 0;
        if (!isEnrolledCourse) {
            return;
        }

        if (state.activePageUpdateController) {
            state.activePageUpdateController.abort();
        }
        state.activePageUpdateController = new AbortController();
        const { signal } = state.activePageUpdateController;

        removeVideoCheckboxes();
        await renderWPVideoCheckboxes({ signal });

        state.lastWatchedVideoId = getVideoId(window.location.href);
        state.lastInteractedAt = Date.now();
        setToStorage();
    } catch (err) {
        if (err.name !== "AbortError") {
            console.error("Unexpected error during partial update:", err);
        }
    }
}

async function updateWatchPage({ signal }) {
    const playlistItems = await waitForElement({
        selector: SELECTORS.watchPage.playlistItems,
        signal,
    });

    const isEnrolledCourse = Object.keys(state.videoWatchStatus).length > 0;
    if (isEnrolledCourse) {
        removeWPStartCourseBtn(); // Clean up start button if it exists
        await renderWPProgressDiv({ signal });
        await renderWPVideoCheckboxes({ signal });

        // Start tracking time
        if (state.investedTimeTrackerCleanup) state.investedTimeTrackerCleanup();
        state.investedTimeTrackerCleanup = initializeInvestedTimeTracker({
            signal,
        });

        state.lastWatchedVideoId = getVideoId(window.location.href);
        state.lastInteractedAt = Date.now();
        setToStorage();
    } else {
        removeWPProgressDiv(); // Clean up progress bar if it exists
        removeVideoCheckboxes(); // Clean up checkboxes if exists
        const videoCount = playlistItems.children.length;
        if (videoCount >= 200) {
            await renderDisabledStartCourseBtn({ signal });
        } else {
            await renderWPStartCourseBtn({ signal });
        }
    }
    await renderVideoCourseMatches({ signal });
}

async function updatePlaylistPage({ signal }) {
    state.isYtCourse = await isYtCourse({ signal });

    if (!state.mediaQuery) {
        state.mediaQuery = window.matchMedia("(min-width: 1080px)");
        state.PPPlacementHandler = () => updatePlaylistPageLayout(state.mediaQuery);
        state.mediaQuery.addEventListener("change", state.PPPlacementHandler);
    }

    const isEnrolledCourse = Object.keys(state.videoWatchStatus).length > 0;
    if (isEnrolledCourse) {
        removePPStartCourseBtn();
        await renderPPProgressDiv({ signal });
        await renderPPVideoCheckboxes({ signal });
    } else {
        removePPProgressDiv();
        removeVideoCheckboxes();
        await renderPPStartCourseBtn({ signal });
    }
    await updatePlaylistPageLayout(state.mediaQuery);
}

// Runs whenever there is a navigation (background script sends message and it acts accordingly)
chrome.runtime.onMessage.addListener(async (request, sender, sendResponse) => {
    if (!(request.action === "updateWatchPage") && state.investedTimeTrackerCleanup) {
        state.investedTimeTrackerCleanup();
    }

    if (request.action === "updateWatchPage") {
        const isStandaloneVideo = request.playlistId === null;
        if (isStandaloneVideo) {
            performCleanUp();
            state.currentPage = null;
            await renderVideoCourseMatches();
            return;
        }
        const isNewPlaylist =
            !(state.currentPage === PAGE_TYPE.WATCH) || state.playlistId !== request.playlistId;

        await waitForNavigation();
        if (isNewPlaylist) {
            await handleFullPageUpdate(PAGE_TYPE.WATCH);
        } else {
            // this happens when video is changed on the same playlist
            // youtube changes content in the same html structure which removes checkboxes. Hence again adding it.
            await handlePartialUpdate();
            await renderVideoCourseMatches();
        }
        state.currentPage = PAGE_TYPE.WATCH;
    } else if (request.action === "updatePlaylistPage") {
        const isNewPlaylist =
            !(state.currentPage === PAGE_TYPE.PLAYLIST) || state.playlistId !== request.playlistId;

        if (isNewPlaylist) {
            await waitForNavigation();
            await handleFullPageUpdate(PAGE_TYPE.PLAYLIST);
        }
        state.currentPage = PAGE_TYPE.PLAYLIST;
    } else if (request.action === "updateHomePage") {
        await waitForNavigation();
        await handleFullPageUpdate(PAGE_TYPE.HOME);
        state.currentPage = PAGE_TYPE.HOME;
    } else if (request.action === "someOtherPage") {
        performCleanUp();
        state.currentPage = null;
        state.playlistId = null;
        state.videoWatchStatus = {}; // Setting this to empty makes the page "not a course"
        document.body.classList.remove("tmc-focus-mode");
        removeCommentsToggleButton();
    }
    return true;
});

chrome.storage.onChanged.addListener((changes, areaName) => {
    if (areaName !== "local") return;

    if (changes.focusMode) {
        state.focusMode = changes.focusMode.newValue;
        toggleFocusModeUI(state.focusMode);
        return;
    }

    const currentURL = window.location.href;

    if (currentURL.includes("watch?v=") && currentURL.includes("list=")) {
        state.currentPage = PAGE_TYPE.WATCH;
    } else if (currentURL.includes("playlist?list=")) {
        state.currentPage = PAGE_TYPE.PLAYLIST;
    } else if (currentURL.includes("watch?v=")) {
        state.currentPage = null;
        renderVideoCourseMatches();
    } else if (currentURL === "https://www.youtube.com/") {
        state.currentPage = PAGE_TYPE.HOME;
        updateHomeCoursesContent();
        return;
    } else {
        state.currentPage = null;
    }

    const currentPlaylistUpdated = changes.hasOwnProperty(state.playlistId);
    if (!currentPlaylistUpdated && state.currentPage === PAGE_TYPE.WATCH) {
        renderVideoCourseMatches();
    }
    if (!currentPlaylistUpdated || state.currentPage === null) return;

    const { oldValue, newValue } = changes[state.playlistId];
    if (!oldValue || !newValue) {
        // course started or deleted
        handleFullPageUpdate();
    } else {
        // some updation in existing course
        refreshUI();
    }
});

// --- UI RENDERING AND MANIPULATION FUNCTIONS ---
function toggleFocusModeUI(isFocusModeOn) {
    const body = document.body;
    const isEnrolledCourse = Object.keys(state.videoWatchStatus).length > 0;

    if (isFocusModeOn && isEnrolledCourse) {
        body.classList.add("tmc-focus-mode");
        addCommentsToggleButton();
    } else {
        body.classList.remove("tmc-focus-mode");
        removeCommentsToggleButton();
    }
}

function addCommentsToggleButton() {
    if (document.getElementById("tmc-toggle-comments-btn")) return;

    const commentsSection = document.querySelector(SELECTORS.watchPage.comments);
    if (!commentsSection) return;

    commentsSection.classList.add("tmc-comments-hidden");
    const button = document.createElement("button");
    button.id = "tmc-toggle-comments-btn";
    button.textContent = "Show Comments";
    button.onclick = () => {
        const isHidden = commentsSection.classList.toggle("tmc-comments-hidden");
        button.textContent = isHidden ? "Show Comments" : "Hide Comments";
    };

    commentsSection.parentNode.insertBefore(button, commentsSection);
}

function removeCommentsToggleButton() {
    const btn = document.getElementById("tmc-toggle-comments-btn");
    if (btn) btn.remove();
}

async function renderWPStartCourseBtn({ signal }) {
    if (signal.aborted) throw createAbortError();

    const menu = await waitForElement({
        selector: SELECTORS.watchPage.playlistMenu,
        signal,
    });

    const playlistItems = await waitForElement({
        selector: SELECTORS.watchPage.playlistItems,
        signal,
    });

    const startCourseBtn = document.createElement("button");
    startCourseBtn.textContent = "Start Course";
    startCourseBtn.classList.add("tmc-start-course-btn", "tmc-wp-start-course-btn");
    if (signal.aborted) throw createAbortError();
    menu.append(startCourseBtn);

    startCourseBtn.addEventListener("click", async () => {
        try {
            startCourseBtn.remove();
            const signal = state.activePageUpdateController.signal;

            const courseData = await scanPlaylistForCourseData({
                videoElements: playlistItems.children,
                signal,
            });
            state.videoWatchStatus = courseData.videoWatchStatus;
            state.totalDuration = courseData.totalDuration;
            state.watchedDuration = { hours: 0, minutes: 0, seconds: 0 }; // Reset
            state.investedTime = { hours: 0, minutes: 0, seconds: 0 }; // Reset
            state.lastInteractedAt = Date.now();
            state.courseImgSrc = await imgSrcToBase64(playlistItems.querySelector("img")?.src);
            state.courseName = document.querySelector(
                "#playlist:not([hidden]) #header-contents .title"
            ).title;
            setToStorage();
            showToast("Course Started");
        } catch (err) {
            if (err.name !== "AbortError") {
                console.error("Unexpected error during starting course:", err);
            }
        }
    });
}

async function renderPPStartCourseBtn({ signal }) {
    if (signal.aborted) throw createAbortError();

    let startCourseBtnWideScreenRefEl;
    if (state.isYtCourse) {
        startCourseBtnWideScreenRefEl = await waitForElement({
            selector: SELECTORS.playlistPage.ytCourse.startCourseBtnWideScreenRefEl,
            signal,
        });
    } else {
        startCourseBtnWideScreenRefEl = await waitForElement({
            selector: SELECTORS.playlistPage.startCourseBtnWideScreenRefEl,
            signal,
        });
    }

    const startCourseBtn = document.createElement("a");
    startCourseBtn.textContent = "Start Course";
    startCourseBtn.className = "tmc-start-course-btn tmc-pp-start-course-btn";

    startCourseBtnWideScreenRefEl.insertAdjacentElement("afterend", startCourseBtn);

    if (state.isYtCourse) {
        startCourseBtn.style.margin = "-6px 0px 10px 0px";
    } else {
        startCourseBtn.style.margin = "10px 0px";
    }

    if (signal.aborted) throw createAbortError();
    startCourseBtn.addEventListener("click", async () => {
        await updatePlaylistData();
        showToast("Course Started");
    });
}

async function renderDisabledStartCourseBtn({ signal }) {
    if (signal.aborted) throw createAbortError();
    const menu = await waitForElement({
        selector: SELECTORS.watchPage.playlistMenu,
        signal,
    });
    const buttonContainerEl = document.createElement("div");
    buttonContainerEl.className = "disabled-btn-container";

    // Start button
    const startBtn = document.createElement("button");
    startBtn.disabled = true;
    startBtn.className = "tmc-wp-start-course-btn disabled-tmc-wp-start-course-btn";
    startBtn.textContent = "Start Course";

    // Tooltip
    const tooltip = document.createElement("div");
    tooltip.className = "tooltip";

    // Tooltip content
    const textNode1 = document.createTextNode("This playlist has ");
    const bold = document.createElement("b");
    bold.textContent = "200+ videos";
    const textNode2 = document.createTextNode(", so please start the course from the ");

    const link = document.createElement("a");
    link.href = `https://www.youtube.com/playlist?list=${state.playlistId}`;
    link.target = "_blank";
    link.textContent = "playlist page";

    const textNode3 = document.createTextNode(".");

    tooltip.append(textNode1, bold, textNode2, link, textNode3);
    buttonContainerEl.append(startBtn, tooltip);
    menu.append(buttonContainerEl);

    buttonContainerEl.addEventListener("click", (e) => {
        e.stopPropagation();
    });
}

async function renderWPVideoCheckboxes({ signal }) {
    if (signal?.aborted) return;
    const playlistItems = await waitForElement({
        selector: SELECTORS.watchPage.playlistItems,
        signal,
    });
    const playlistVideos = playlistItems.children;
    if (signal.aborted) throw createAbortError();
    for (const video of playlistVideos) {
        if (video.tagName.toLowerCase() === "ytd-playlist-panel-video-renderer") {
            if (video.querySelector(".tmc-wp-checkbox-wrapper")) continue;
            setupCheckbox({ video, pageType: PAGE_TYPE.WATCH, signal });
        }
    }
}

async function renderPPVideoCheckboxes({ signal }) {
    if (signal.aborted) throw createAbortError();
    const contentDiv = await waitForElement({
        selector: SELECTORS.playlistPage.contentDiv,
        signal,
    });
    let playlistVideos = contentDiv.children;
    if (signal.aborted) throw createAbortError();
    for (const video of playlistVideos) {
        if (video.tagName.toLowerCase() === "ytd-playlist-video-renderer") {
            setupCheckbox({ video, pageType: PAGE_TYPE.PLAYLIST, signal });
        } else {
            const config = { childList: true };
            const callback = (mutationList, observer) => {
                observer.disconnect();
                playlistVideos = [];
                for (const mutation of mutationList) {
                    if (mutation.addedNodes.length > 0) {
                        playlistVideos = [...playlistVideos, ...mutation.addedNodes];
                    }
                }
                for (const video of playlistVideos) {
                    if (video.tagName.toLowerCase() === "ytd-playlist-video-renderer") {
                        setupCheckbox({ video, pageType: PAGE_TYPE.PLAYLIST, signal });
                    } else {
                        observer.observe(contentDiv, config);
                    }
                }
            };
            const observer = new MutationObserver(callback);
            observer.observe(contentDiv, config);

            signal.addEventListener("abort", abortListener);
            function abortListener() {
                observer.disconnect();
                signal.removeEventListener("abort", abortListener);
            }
        }
    }
}

function setupCheckbox({ video, pageType, signal }) {
    if (pageType !== PAGE_TYPE.PLAYLIST && pageType !== PAGE_TYPE.WATCH) {
        throw new Error("Invalid page type for checkbox setup");
    }
    const checkboxWrapper = getCheckboxWrapper(pageType);
    const checkbox = checkboxWrapper.querySelector("input[type=checkbox]");
    const url = video.querySelector(
        `${pageType === PAGE_TYPE.PLAYLIST ? "#video-title" : "#wc-endpoint"}`
    ).href;
    const videoId = getVideoId(url);
    checkbox.id = videoId;
    checkbox.checked = state.videoWatchStatus[videoId] ?? false;

    checkbox.addEventListener("click", async (e) => {
        const isChecked = e.target.checked;
        let videoDuration = video.querySelector(SELECTORS.videoDuration)?.textContent;
        if (!videoDuration) {
            videoDuration = (
                await waitForElement({
                    selector: SELECTORS.videoDuration,
                    parentEl: video,
                    signal,
                })
            ).textContent;
        }
        await synchronizeVideoStatus(videoId, isChecked, videoDuration);
    });

    const menu = video.querySelector("#menu");
    menu.append(checkboxWrapper);
}

/**
 * Synchronizes the watched status of a single video across ALL tracked courses.
 * It fetches all courses, updates the status and watched duration in all affected
 * courses and saves them to storage.
 */
async function synchronizeVideoStatus(videoId, isChecked, videoDuration) {
    const storageData = await getFromStorage(null);
    const playlistIds = Object.keys(storageData).filter((key) => key !== "focusMode");

    const videoDurationSeconds = parseDurationToSeconds(videoDuration);
    const updatedCourses = {};

    for (const playlistId of playlistIds) {
        const course = storageData[playlistId];

        // Check if the video exists in this course
        if (course.videoWatchStatus && course.videoWatchStatus.hasOwnProperty(videoId)) {
            const oldStatus = course.videoWatchStatus[videoId];
            const newStatus = isChecked;

            // Only update if the status has changed for this video in this course
            if (oldStatus !== newStatus) {
                course.videoWatchStatus[videoId] = newStatus;
                let watchedSeconds =
                    course.watchedDuration.hours * 3600 +
                    course.watchedDuration.minutes * 60 +
                    course.watchedDuration.seconds;

                if (isChecked) watchedSeconds += videoDurationSeconds;
                else watchedSeconds = Math.max(0, watchedSeconds - videoDurationSeconds);

                course.watchedDuration = formatDuration(watchedSeconds);
                updatedCourses[playlistId] = course;

                if (playlistId === state.playlistId) {
                    state.videoWatchStatus = course.videoWatchStatus;
                    state.watchedDuration = course.watchedDuration;
                }
            }
        }
    }

    chrome.storage.local.set(updatedCourses);
    const coursesAffected = Object.keys(updatedCourses).length;
    const syncMessage =
        coursesAffected > 1 ? `Progress updated in ${coursesAffected} courses` : "Progress updated";

    showToast(syncMessage);
}

async function renderWPProgressDiv({ signal }) {
    if (signal?.aborted) return;

    const progressDiv = document.createElement("div");
    progressDiv.classList.add("tmc-progress-div", "tmc-wp-progress-div");

    // Wrapper
    const wrapper = document.createElement("div");
    wrapper.className = "progress-content-wrapper";

    // Time container
    const timeContainer = document.createElement("div");
    timeContainer.className = "time-container";

    // Watched time
    const watchedTime = document.createElement("div");
    watchedTime.id = "watched-time";
    watchedTime.textContent = `${state.watchedDuration.hours}h ${state.watchedDuration.minutes}m ${state.watchedDuration.seconds}s`;

    // Completed videos
    const completedVideos = document.createElement("div");
    completedVideos.className = "completed-videos";

    const svgCheck = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svgCheck.setAttribute("width", "16");
    svgCheck.setAttribute("height", "16");
    svgCheck.setAttribute("viewBox", "0 0 24 24");
    svgCheck.setAttribute("fill", "none");
    svgCheck.innerHTML = `
        <circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="2"/>
        <path d="M8.5 12.5L11 15l5-5.5" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
    `;

    const videosSpan = document.createElement("span");
    const watchedCount = document.createElement("span");
    watchedCount.id = "watched-videos-count";
    watchedCount.textContent = Object.values(state.videoWatchStatus).filter(Boolean).length;

    const totalCount = document.createElement("span");
    totalCount.id = "total-videos-count";
    totalCount.textContent = Object.keys(state.videoWatchStatus).length;

    videosSpan.append(watchedCount, "/", totalCount, "watched");
    completedVideos.append(svgCheck, videosSpan);

    // Total time
    const totalTime = document.createElement("div");
    totalTime.id = "total-time";
    totalTime.textContent = `${state.totalDuration.hours}h ${state.totalDuration.minutes}m ${state.totalDuration.seconds}s`;

    // Append to time container
    timeContainer.append(watchedTime, completedVideos, totalTime);

    // Progress bar
    const progressBarOuter = document.createElement("div");
    progressBarOuter.className = "progress-bar-outer-container";

    const progressBarContainer = document.createElement("div");
    progressBarContainer.className = "progress-bar-container";

    const progressBar = document.createElement("div");
    progressBar.id = "progress-bar";
    progressBar.style.width = `${calculateCompletionPercentage()}%`;

    progressBarContainer.append(progressBar);
    progressBarOuter.append(progressBarContainer);

    // Completed percentage & invested time
    const completedDiv = document.createElement("div");
    completedDiv.className = "completed-in";

    const completedPercent = document.createElement("b");
    completedPercent.id = "completed-percentage";
    completedPercent.textContent = calculateCompletionPercentage();

    const percentText = document.createElement("b");
    percentText.textContent = "%";

    const investedTime = document.createElement("b");
    investedTime.id = "invested-time";
    investedTime.textContent = `${state.investedTime.hours}h ${state.investedTime.minutes}m`;

    completedDiv.append(completedPercent, percentText, " completed in ", investedTime);

    // Delete button
    const deleteBtn = document.createElement("div");
    deleteBtn.className = "tmc-delete-btn";
    deleteBtn.innerHTML = `
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M6 7h12M10 11v6M14 11v6M5 7l1 12a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2l1-12M9 7V5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
    `;

    // Delete popup
    const deletePopup = document.createElement("div");
    deletePopup.className = "tmc-delete-popup";

    const popupText = document.createElement("p");
    popupText.textContent = "Remove this course?";

    const deleteButtons = document.createElement("div");
    deleteButtons.className = "tmc-delete-buttons";

    const confirmBtn = document.createElement("button");
    confirmBtn.className = "tmc-confirm-delete";
    confirmBtn.textContent = "Yes";

    const cancelBtn = document.createElement("button");
    cancelBtn.className = "tmc-cancel-delete";
    cancelBtn.textContent = "No";

    deleteButtons.append(confirmBtn, cancelBtn);
    deletePopup.append(popupText, deleteButtons);
    wrapper.append(timeContainer, progressBarOuter, completedDiv, deleteBtn);
    progressDiv.append(wrapper, deletePopup);

    // Append to header
    const headerContents = await waitForElement({
        selector: SELECTORS.watchPage.headerContents,
        signal,
    });
    state.playlistActions = await waitForElement({
        selector: SELECTORS.watchPage.playlistActions,
        signal,
    });
    if (state.playlistActions) state.playlistActions.remove();
    if (signal.aborted) throw createAbortError();

    headerContents.append(progressDiv);

    // Event listeners
    progressDiv.addEventListener("click", (e) => e.stopPropagation());
    deleteBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        progressDiv.classList.add("deleting");
    });
    cancelBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        progressDiv.classList.remove("deleting");
    });
    confirmBtn.addEventListener("click", async (e) => {
        e.stopPropagation();
        if (state.investedTimeTrackerCleanup) state.investedTimeTrackerCleanup();
        await chrome.storage.local.remove(state.playlistId);
        showToast("Course Removed");
    });
}

async function renderPPProgressDiv({ signal }) {
    if (signal?.aborted) throw createAbortError();

    const progressDiv = document.createElement("div");
    progressDiv.classList.add("tmc-progress-div", "tmc-pp-progress-div");

    // Wrapper
    const wrapper = document.createElement("div");
    wrapper.className = "progress-content-wrapper";

    // Total videos
    const totalDiv = document.createElement("div");
    totalDiv.className = "tmc-total";

    const totalSvg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    totalSvg.setAttribute("viewBox", "0 0 24 24");
    totalSvg.setAttribute("width", "20");
    totalSvg.setAttribute("height", "20");
    totalSvg.setAttribute("fill", "currentColor");
    totalSvg.setAttribute("aria-hidden", "true");
    totalSvg.innerHTML = `<path d="M17 10.5V7c0-1.1-.9-2-2-2H5C3.9 5 3 5.9 3 7v10c0 1.1.9 2 2 2h10c1.1 0 2-.9 2-2v-3.5l4 4v-11l-4 4z"></path>`;

    const totalText = document.createElement("span");
    totalText.className = "tmc-total-text";
    totalText.textContent = `${Object.keys(state.videoWatchStatus).length} videos`;

    totalDiv.append(totalSvg, totalText);

    // Duration
    const durationDiv = document.createElement("div");
    durationDiv.className = "tmc-duration";

    const durationSvg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    durationSvg.setAttribute("width", "16");
    durationSvg.setAttribute("height", "16");
    durationSvg.setAttribute("viewBox", "0 0 24 24");
    durationSvg.setAttribute("fill", "none");
    durationSvg.setAttribute("stroke", "currentColor");
    durationSvg.setAttribute("stroke-width", "2");
    durationSvg.innerHTML = `<circle cx="12" cy="12" r="10"></circle>
                             <line x1="12" y1="12" x2="12" y2="8" stroke-linecap="round"></line>
                             <line x1="12" y1="12" x2="15" y2="12" stroke-linecap="round"></line>`;

    const durationText = document.createElement("span");
    durationText.className = "tmc-duration-text";
    durationText.textContent = `${state.totalDuration.hours}h ${state.totalDuration.minutes}m ${state.totalDuration.seconds}s`;

    durationDiv.append(durationSvg, durationText);

    // Watched
    const watchedDiv = document.createElement("div");
    watchedDiv.className = "tmc-watched";

    const watchedSvg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    watchedSvg.setAttribute("width", "16");
    watchedSvg.setAttribute("height", "16");
    watchedSvg.setAttribute("viewBox", "0 0 24 24");
    watchedSvg.setAttribute("fill", "none");
    watchedSvg.setAttribute("stroke", "currentColor");
    watchedSvg.setAttribute("stroke-width", "2");
    watchedSvg.innerHTML = `<circle cx="12" cy="12" r="10"></circle>
                            <path d="M8.5 12.5L11 15l5-5.5" stroke-linecap="round" stroke-linejoin="round"></path>`;

    const watchedText = document.createElement("span");
    watchedText.className = "tmc-watched-text";
    const watchedCount = Object.values(state.videoWatchStatus).filter(Boolean).length;
    const totalCount = Object.keys(state.videoWatchStatus).length;
    watchedText.textContent = `${watchedCount} / ${totalCount} watched`;

    watchedDiv.append(watchedSvg, watchedText);

    const actionsDiv = document.createElement("div");
    actionsDiv.className = "tmc-actions";

    // Refresh button
    const refreshDiv = document.createElement("div");
    refreshDiv.className = "tmc-refresh";
    refreshDiv.title = "Update Playlist";
    refreshDiv.innerHTML = `<svg class="tmc-refresh-svg" xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 24 24">
        <path d="M17.65 6.35A7.95 7.95 0 0 0 12 4a8 8 0 0 0-8 8h2a6 6 0 0 1 6-6c1.66 0 3.14.69 4.22 1.78L13 11h7V4l-2.35 2.35zM6.35 17.65A7.95 7.95 0 0 0 12 20a8 8 0 0 0 8-8h-2a6 6 0 0 1-6 6c-1.66 0-3.14-.69-4.22-1.78L11 13H4v7l2.35-2.35z"/>
    </svg>`;

    // Delete button
    const deleteDiv = document.createElement("div");
    deleteDiv.className = "tmc-delete";
    deleteDiv.title = "Remove Course";
    deleteDiv.innerHTML = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M6 7h12M10 11v6M14 11v6M5 7l1 12a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2l1-12M9 7V5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2" stroke-linecap="round" stroke-linejoin="round"></path>
    </svg>`;

    actionsDiv.append(refreshDiv, deleteDiv);
    wrapper.append(totalDiv, durationDiv, watchedDiv, actionsDiv);

    // Delete popup
    const deletePopup = document.createElement("div");
    deletePopup.className = "tmc-delete-popup";

    const popupText = document.createElement("p");
    popupText.textContent = "Remove this course?";

    const deleteButtons = document.createElement("div");
    deleteButtons.className = "tmc-delete-buttons";

    const confirmBtn = document.createElement("button");
    confirmBtn.className = "tmc-confirm-delete";
    confirmBtn.textContent = "Yes";

    const cancelBtn = document.createElement("button");
    cancelBtn.className = "tmc-cancel-delete";
    cancelBtn.textContent = "No";

    deleteButtons.append(confirmBtn, cancelBtn);
    deletePopup.append(popupText, deleteButtons);
    progressDiv.append(wrapper, deletePopup);

    // Append progressDiv to page
    let targetEl;
    if (state.isYtCourse) {
        targetEl = await waitForElement({
            selector: SELECTORS.playlistPage.ytCourse.progressDivWideScreenRefEl,
            signal,
        });
    } else {
        targetEl = await waitForElement({
            selector: SELECTORS.playlistPage.progressDivWideScreenRefEl,
            signal,
        });
    }
    targetEl.insertAdjacentElement("beforebegin", progressDiv);

    // Event listeners
    refreshDiv.addEventListener("click", async () => {
        const svg = refreshDiv.querySelector("svg");
        if (svg.classList.contains("rotating") || svg.classList.contains("scanning")) return;
        svg.classList.add("rotating");
        setTimeout(() => svg.classList.remove("rotating"), 400);
        await updatePlaylistData();
        showToast("Playlist Updated");
    });

    deleteDiv.addEventListener("click", () => progressDiv.classList.add("deleting"));
    cancelBtn.addEventListener("click", () => progressDiv.classList.remove("deleting"));
    confirmBtn.addEventListener("click", async () => {
        removePPMediaQueryListener();
        await chrome.storage.local.remove(state.playlistId);
        showToast("Course Removed");
    });
}

async function renderVideoCourseMatches({ signal } = {}) {
    const isCurrentPlaylistTracked = await isPlaylistTracked(getPlaylistId(window.location.href));
    const videoId = getVideoId(window.location.href);
    let matchedCourses = await getCoursesContainingVideo(videoId);
    if (
        (isCurrentPlaylistTracked && matchedCourses.length === 1) ||
        (!isCurrentPlaylistTracked && matchedCourses.length === 0)
    ) {
        removeVideoCourseList();
        removeVideoWatchCheckbox();
        return;
    }
    if (!signal) {
        if (state.activePageUpdateController) {
            state.activePageUpdateController.abort();
        }
        state.activePageUpdateController = new AbortController();
        signal = state.activePageUpdateController.signal;
    }

    if (isCurrentPlaylistTracked) {
        matchedCourses = matchedCourses.filter(
            (c) => c.playlistId !== getPlaylistId(window.location.href)
        );
        renderVideoCourseList({ signal, courses: matchedCourses });
    } else {
        const isWatched = matchedCourses.some((c) => c.isWatched);

        renderVideoCourseList({ signal, courses: matchedCourses });
        renderVideoWatchCheckbox({ signal, isWatched, videoId });
    }
}

async function renderPlaylistScanning({ signal }) {
    if (signal.aborted) throw createAbortError();

    const contentDiv = await waitForElement({
        selector: SELECTORS.playlistPage.contentDiv,
        signal,
    });

    const scanningPlaylistEl = document.createElement("div");
    scanningPlaylistEl.className = "tmc-scanning-playlist";
    const scanningTextEl = document.createElement("div");
    scanningTextEl.className = "tmc-scanning-text";
    scanningTextEl.innerHTML = `Scanning Playlist..
        <p> <span id="scanned-videos-count">${100}</span> videos scanned</p>
        `;
    contentDiv.append(scanningPlaylistEl, scanningTextEl);
    updateScanningTextLeft();

    const refreshBtnSVG = document.querySelector(".tmc-refresh-svg");
    if (refreshBtnSVG) refreshBtnSVG.classList.add("scanning");

    function updateScanningTextLeft() {
        const rect = scanningPlaylistEl.getBoundingClientRect();
        scanningTextEl.style.left = `${rect.left + rect.width / 2}px`;
    }
    const resizeObserver = new ResizeObserver(updateScanningTextLeft);
    resizeObserver.observe(scanningPlaylistEl);
}

function removePlaylistScanning() {
    const scanningPlaylistEl = document.querySelector(".tmc-scanning-playlist");
    const scanningTextEl = document.querySelector(".tmc-scanning-text");
    if (scanningPlaylistEl) scanningPlaylistEl.remove();
    if (scanningTextEl) scanningTextEl.remove();

    const refreshBtnSVG = document.querySelector(".tmc-refresh-svg");
    if (refreshBtnSVG) refreshBtnSVG.classList.remove("scanning");
}

async function refreshUI() {
    if (state.activePageUpdateController) {
        state.activePageUpdateController.abort();
    }
    state.activePageUpdateController = new AbortController();
    const { signal } = state.activePageUpdateController;

    try {
        await updateStateVariables({ signal });

        if (state.currentPage === PAGE_TYPE.WATCH) {
            refreshWatchPageUI({ signal });
        } else if (state.currentPage === PAGE_TYPE.PLAYLIST) {
            refreshPlaylistPageUI({ signal });
        }
    } catch (err) {
        if (err.name !== "AbortError") {
            console.error("Unexpected error during refreshUI:", err);
        }
    }
}

function refreshWatchPageUI({ signal }) {
    const progressDiv = document.querySelector(".tmc-wp-progress-div");
    if (!progressDiv) return; // Exit if the UI isn't rendered

    // Update time displays
    progressDiv.querySelector("#watched-time").textContent =
        `${state.watchedDuration.hours}h ${state.watchedDuration.minutes}m ${state.watchedDuration.seconds}s`;
    progressDiv.querySelector("#total-time").textContent =
        `${state.totalDuration.hours}h ${state.totalDuration.minutes}m ${state.totalDuration.seconds}s`;
    progressDiv.querySelector("#invested-time").textContent =
        `${state.investedTime.hours}h ${state.investedTime.minutes}m`;

    if (signal.aborted) return;
    progressDiv.querySelector("#watched-videos-count").textContent = Object.values(
        state.videoWatchStatus
    ).filter(Boolean).length;
    progressDiv.querySelector("#total-videos-count").textContent = Object.keys(
        state.videoWatchStatus
    ).length;

    const percentage = calculateCompletionPercentage();
    progressDiv.querySelector("#completed-percentage").textContent = percentage;
    progressDiv.querySelector("#progress-bar").style.width = `${percentage}%`;

    if (signal.aborted) return;

    updateVideoCheckboxes(PAGE_TYPE.WATCH);
}

function refreshPlaylistPageUI({ signal }) {
    const progressDiv = document.querySelector(".tmc-pp-progress-div");
    if (!progressDiv) return;
    if (signal.aborted) return;

    progressDiv.querySelector(".tmc-total-text").textContent = `${
        Object.keys(state.videoWatchStatus).length
    } videos`;

    progressDiv.querySelector(".tmc-duration-text").textContent =
        `${state.totalDuration.hours}h ${state.totalDuration.minutes}m ${state.totalDuration.seconds}s`;

    progressDiv.querySelector(".tmc-watched-text").textContent = `${
        Object.values(state.videoWatchStatus).filter(Boolean).length
    } / ${Object.keys(state.videoWatchStatus).length} watched`;

    updateVideoCheckboxes(PAGE_TYPE.PLAYLIST);
}

function updateVideoCheckboxes(page) {
    let allCheckboxesWrapper;
    if (page === PAGE_TYPE.WATCH) {
        allCheckboxesWrapper = document.querySelectorAll(".tmc-wp-checkbox-wrapper");
    } else if (page === PAGE_TYPE.PLAYLIST) {
        allCheckboxesWrapper = document.querySelectorAll(".tmc-pp-checkbox-wrapper");
    }
    if (allCheckboxesWrapper && allCheckboxesWrapper.length === 0) return;
    for (const checkboxWrapper of allCheckboxesWrapper) {
        const checkbox = checkboxWrapper.querySelector("input[type=checkbox]");
        checkbox.checked = state.videoWatchStatus[checkbox.id] ?? false;
    }
}

// Handles the responsive placement of all custom UI (progress div, start button) on the playlist page.
async function updatePlaylistPageLayout(mediaQuery) {
    const progressDiv = document.querySelector(".tmc-pp-progress-div");
    const startCourseBtn = document.querySelector(".tmc-pp-start-course-btn");

    let progressDivWideScreenRefEl;
    let progressDivSmallScreenRefEl;

    let startCourseBtnWideScreenRefEl;
    let startCourseBtnSmallScreenRefEl;

    const signal = state.activePageUpdateController.signal;
    if (state.isYtCourse) {
        progressDivWideScreenRefEl = await waitForElement({
            selector: SELECTORS.playlistPage.ytCourse.progressDivWideScreenRefEl,
            signal,
        });
        progressDivSmallScreenRefEl = progressDivWideScreenRefEl;

        [startCourseBtnWideScreenRefEl, startCourseBtnSmallScreenRefEl] = await Promise.all([
            waitForElement({
                selector: SELECTORS.playlistPage.ytCourse.startCourseBtnWideScreenRefEl,
                signal,
            }),
            waitForElement({
                selector: SELECTORS.playlistPage.ytCourse.startCourseBtnSmallScreenRefEl,
                signal,
            }),
        ]);
    } else {
        [progressDivWideScreenRefEl, progressDivSmallScreenRefEl] = await Promise.all([
            waitForElement({
                selector: SELECTORS.playlistPage.progressDivWideScreenRefEl,
                signal,
            }),
            waitForElement({
                selector: SELECTORS.playlistPage.progressDivSmallScreenRefEl,
                signal,
            }),
        ]);

        [startCourseBtnWideScreenRefEl, startCourseBtnSmallScreenRefEl] = await Promise.all([
            waitForElement({
                selector: SELECTORS.playlistPage.startCourseBtnWideScreenRefEl,
                signal,
            }),
            waitForElement({
                selector: SELECTORS.playlistPage.startCourseBtnSmallScreenRefEl,
                signal,
            }),
        ]);
    }

    // Determine the correct target based on screen size
    const progressDivTargetAnchor = mediaQuery.matches
        ? progressDivWideScreenRefEl
        : progressDivSmallScreenRefEl;

    const startCourseBtnTargetAnchor = mediaQuery.matches
        ? startCourseBtnWideScreenRefEl
        : startCourseBtnSmallScreenRefEl;

    if (progressDiv) {
        progressDivTargetAnchor.insertAdjacentElement("beforebegin", progressDiv);
    }
    if (startCourseBtn) {
        startCourseBtnTargetAnchor.insertAdjacentElement("afterend", startCourseBtn);
        if (state.isYtCourse) {
            if (startCourseBtnTargetAnchor == startCourseBtnSmallScreenRefEl)
                startCourseBtn.style.margin = "6px 0px 10px 0px";
            else startCourseBtn.style.margin = "-6px 0px 10px 0px";
        }
    }
}

// ---UI CLEANUP---
function removeWPStartCourseBtn() {
    const startCourseBtn = document.querySelector(".tmc-wp-start-course-btn");
    if (startCourseBtn) startCourseBtn.remove();
}

function removePPStartCourseBtn() {
    const startCourseBtn = document.querySelector(".tmc-pp-start-course-btn");
    if (startCourseBtn) startCourseBtn.remove();
}

function removeStartCourseBtn() {
    const startCourseBtn = document.querySelector(".tmc-start-course-btn");
    if (startCourseBtn) startCourseBtn.remove();
}

function removeWPProgressDiv() {
    const progressDiv = document.querySelector(".tmc-wp-progress-div");

    if (progressDiv) {
        progressDiv.remove();
    }

    const headerContents = document.querySelector(SELECTORS.watchPage.headerContents);
    if (headerContents && state.playlistActions) {
        headerContents.append(state.playlistActions);
    }
}

function removePPProgressDiv() {
    const progressDiv = document.querySelector(".tmc-pp-progress-div");
    if (progressDiv) {
        progressDiv.remove();
    }
}

function removeProgressDiv() {
    const progressDiv = document.querySelector(".tmc-progress-div");

    if (progressDiv) {
        progressDiv.remove();
    }

    const headerContents = document.querySelector(SELECTORS.watchPage.headerContents);

    if (headerContents && state.playlistActions) headerContents.append(state.playlistActions);
}

function removeWPVideoCheckboxes() {
    const allCheckboxes = document.querySelectorAll(".tmc-wp-checkbox-wrapper");
    if (allCheckboxes.length > 0) {
        allCheckboxes.forEach((checkbox) => {
            checkbox.remove();
        });
    }
}

function removePPVideoCheckboxes() {
    const allCheckboxes = document.querySelectorAll(".tmc-pp-checkbox-wrapper");
    if (allCheckboxes.length > 0) {
        allCheckboxes.forEach((checkbox) => {
            checkbox.remove();
        });
    }
}

function removeVideoCheckboxes() {
    const allCheckboxes = document.querySelectorAll(".tmc-checkbox-wrapper");
    if (allCheckboxes.length > 0) {
        allCheckboxes.forEach((checkbox) => {
            checkbox.remove();
        });
    }
}

function removeVideoCourseList() {
    const container = document.querySelector(".tmc-video-course-panel");
    if (container) {
        container.remove();
    }
}

function removeVideoWatchCheckbox() {
    const checkboxWrapper = document.querySelector(".tmc-video-watch-checkbox-wrapper");
    if (checkboxWrapper) {
        checkboxWrapper.remove();
    }
}

function removeHomeCoursesSection() {
    document.querySelector(".tmc-home-section")?.remove();
}

function performCleanUp() {
    removeStartCourseBtn();
    removeVideoCheckboxes();
    removeProgressDiv();
    removePPMediaQueryListener();
    removeHomeCoursesSection();
    if (state.investedTimeTrackerCleanup) state.investedTimeTrackerCleanup();
}

// --- UTILITY FUNCTIONS ---
function getPlaylistId(url) {
    if (!url || !url.includes("list=")) return null;
    const playlistId = url.split("list=")[1].split("&")[0];
    return playlistId;
}

function getVideoId(url) {
    if (!url || !url.includes("v=")) return null;
    const videoId = url.split("v=")[1].split("&")[0];
    return videoId;
}

function parseDurationToSeconds(durationString) {
    const parts = durationString.trim().split(":").map(Number);
    if (parts.length === 3) {
        // [HH, MM, SS]
        return parts[0] * 3600 + parts[1] * 60 + parts[2];
    }
    if (parts.length === 2) {
        // [MM, SS]
        return parts[0] * 60 + parts[1];
    }
    return 0;
}

function calculateCompletionPercentage() {
    const watchedSeconds =
        state.watchedDuration.hours * 3600 +
        state.watchedDuration.minutes * 60 +
        state.watchedDuration.seconds;
    const totalSeconds =
        state.totalDuration.hours * 3600 +
        state.totalDuration.minutes * 60 +
        state.totalDuration.seconds;
    if (totalSeconds === 0) return 0;
    return Math.round((watchedSeconds / totalSeconds) * 100);
}

function createAbortError() {
    return new DOMException("The operation was aborted.", "AbortError");
}

function waitForNavigation() {
    return new Promise((resolve) => {
        const navProgress = document.querySelector(SELECTORS.ytNavigationProgress);

        // If there's no progress bar, navigation is instant or already done.
        if (!navProgress || navProgress.getAttribute("aria-valuenow") === "100") {
            return resolve();
        }

        const observer = new MutationObserver((mutations, obs) => {
            if (navProgress.getAttribute("aria-valuenow") === "100") {
                obs.disconnect();
                resolve();
            }
        });

        observer.observe(navProgress, {
            attributes: true,
            attributeFilter: ["aria-valuenow"],
        });
    });
}

function waitForElement({ selector, signal, parentEl = document.body }) {
    return new Promise((resolve, reject) => {
        if (signal?.aborted) {
            return reject(createAbortError());
        }

        // First, check if the element already exists
        const element = parentEl.querySelector(selector);
        if (element) {
            return resolve(element);
        }

        // If it doesn't exist, set up the observer
        const observer = new MutationObserver((mutations, obs) => {
            // Check each mutation for added nodes
            for (const mutation of mutations) {
                if (mutation.type === "childList" && mutation.addedNodes.length) {
                    const element = parentEl.querySelector(selector);
                    if (element) {
                        obs.disconnect();
                        resolve(element);
                        return;
                    }
                }
            }
        });

        // Start observing the parent element for changes to its children and subtree
        observer.observe(parentEl, {
            childList: true,
            subtree: true,
        });

        // Handle abortion
        const abortListener = () => {
            observer.disconnect();
            reject(createAbortError());
        };

        if (signal) {
            signal.addEventListener("abort", abortListener, { once: true });
        }
    });
}

async function imgSrcToBase64(imgSrc) {
    return new Promise((resolve, reject) => {
        const canvas = document.createElement("canvas");
        const ctx = canvas.getContext("2d");
        const image = new Image();

        image.crossOrigin = "anonymous";

        image.onload = () => {
            canvas.width = image.naturalWidth;
            canvas.height = image.naturalHeight;

            ctx.drawImage(image, 0, 0);

            const dataURL = canvas.toDataURL("image/webp");

            resolve(dataURL);
        };

        image.onerror = () => {
            reject(new Error("Could not load the image."));
        };
        image.src = imgSrc;
    });
}

function addDurationTo(duration, target /* "watched" | "total" */) {
    if (target !== "watched" && target !== "total") {
        throw new Error(`Invalid target: ${target}. Must be "watched" or "total"`);
    }
    const secondsToAdd = parseDurationToSeconds(duration);
    let bucket = state[`${target}Duration`];
    let totalSeconds = bucket.hours * 3600 + bucket.minutes * 60 + bucket.seconds;
    totalSeconds += secondsToAdd;

    // Normalize back to h:m:s
    state[`${target}Duration`] = formatDuration(totalSeconds);
}

function removeFromWatchDuration(videoDuration) {
    const removeSeconds = parseDurationToSeconds(videoDuration);
    let currentSeconds =
        state.watchedDuration.hours * 3600 +
        state.watchedDuration.minutes * 60 +
        state.watchedDuration.seconds;

    currentSeconds -= removeSeconds;

    // Normalize back to h:m:s
    state.watchedDuration = formatDuration(currentSeconds);
    setToStorage();
}

function formatDuration(seconds) {
    return {
        hours: Math.floor(seconds / 3600),
        minutes: Math.floor((seconds % 3600) / 60),
        seconds: seconds % 60,
    };
}

async function scanPlaylistForCourseData({ videoElements, signal }) {
    let totalSeconds = 0;
    const videoWatchStatus = {};

    for (const video of videoElements) {
        if (signal.aborted) throw createAbortError();

        if (video.tagName.toLowerCase().includes("video-renderer")) {
            const durationEl = await waitForElement({
                selector: SELECTORS.videoDuration,
                parentEl: video,
                signal,
            });
            totalSeconds += parseDurationToSeconds(durationEl.textContent);

            const linkEl =
                video.querySelector("#wc-endpoint") || video.querySelector("#video-title");
            if (linkEl) {
                const videoId = getVideoId(linkEl.href);
                if (videoId) {
                    videoWatchStatus[videoId] = false;
                }
            }
        }
    }

    // Convert total seconds back into an H:M:S object
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;

    return {
        totalDuration: { hours, minutes, seconds },
        videoWatchStatus,
    };
}

async function updatePlaylistData() {
    const signal = state.activePageUpdateController.signal;
    const contentDiv = await waitForElement({
        selector: SELECTORS.playlistPage.contentDiv,
        signal,
    });
    let isThereMoreVideos = true;
    let isScanning = false;
    let videoWatchStatus = {};
    let playlistVideos = contentDiv.children;
    // TODO: if length is 0, it never reaches here. It keeps waiting for contentDiv indefinitely (above) because of contentDiv selector having :has() and it's empty
    // so it will not update when playlist is empty. Needs to be fixed.
    if (playlistVideos.length === 0) return;
    state.totalDuration = { hours: 0, minutes: 0, seconds: 0 }; // Reset
    state.watchedDuration = { hours: 0, minutes: 0, seconds: 0 }; // Reset

    const html = document.querySelector("html");
    const originalScroll = html.scrollTop;

    while (isThereMoreVideos) {
        isThereMoreVideos = false;
        for (const video of playlistVideos) {
            if (video.tagName.toLowerCase() === "ytd-playlist-video-renderer") {
                let videoDuration = video.querySelector(SELECTORS.videoDuration)?.textContent;
                if (!videoDuration) {
                    videoDuration = (
                        await waitForElement({
                            selector: SELECTORS.videoDuration,
                            parentEl: video,
                            signal,
                        })
                    ).textContent;
                }
                addDurationTo(videoDuration, "total");
                const url = video.querySelector("#video-title").href;
                const videoId = getVideoId(url);
                videoWatchStatus[videoId] = state.videoWatchStatus[videoId] ?? false;
                if (videoWatchStatus[videoId] === true) {
                    addDurationTo(videoDuration, "watched");
                }
                const scannedVideoCountEl = document.querySelector("#scanned-videos-count");
                if (scannedVideoCountEl)
                    scannedVideoCountEl.textContent = Object.keys(videoWatchStatus).length;
            } else if (video.tagName.toLowerCase() === "ytd-continuation-item-renderer") {
                if (!isScanning) renderPlaylistScanning({ signal });
                isScanning = true;
                isThereMoreVideos = true;
                waitForDuration = true;
                html.scrollBy({
                    top: 10000000,
                    left: 0,
                    behavior: "smooth",
                });

                playlistVideos = await getMoreVideos({
                    originalScroll,
                    signal,
                });

                break;
            }
        }
    }

    if (isScanning) removePlaylistScanning();

    state.videoWatchStatus = videoWatchStatus;
    state.lastInteractedAt = Date.now();
    const playlistImageSrc = document.querySelector(
        "#contents:has(>ytd-playlist-video-renderer) img"
    )?.src;
    state.courseImgSrc = await imgSrcToBase64(playlistImageSrc);
    if (state.isYtCourse) {
        state.courseName = document.querySelector(
            SELECTORS.playlistPage.ytCourse.playlistNameEl
        )?.textContent;
    } else {
        state.courseName = document.querySelector(
            SELECTORS.playlistPage.playlistNameEl
        )?.textContent;
    }

    html.scrollTo({
        top: originalScroll,
        left: 0,
        behavior: "instant",
    });
    setToStorage();
}

async function getFromStorage(key) {
    try {
        return await chrome.storage.local.get(key);
    } catch (err) {
        return {};
    }
}

function setToStorage() {
    chrome.storage.local.set(
        {
            [state.playlistId]: {
                totalDuration: state.totalDuration,
                watchedDuration: state.watchedDuration,
                videoWatchStatus: state.videoWatchStatus,
                investedTime: state.investedTime,
                courseImgSrc: state.courseImgSrc,
                courseName: state.courseName,
                lastWatchedVideoId: state.lastWatchedVideoId,
                lastInteractedAt: state.lastInteractedAt,
            },
        },
        () => {
            if (chrome.runtime.lastError) {
                // ignore
            }
        }
    );
}

async function getMoreVideos({ signal }) {
    if (signal?.aborted) return Promise.reject(createAbortError());

    return new Promise(async (resolve, reject) => {
        const timeout = setTimeout(() => {
            observer.disconnect();
            reject(createAbortError());
        }, 60000);

        // Handle abortion signal
        const abortListener = () => {
            clearTimeout(timeout);
            observer.disconnect();
            reject(createAbortError());
        };
        signal.addEventListener("abort", abortListener, { once: true });
        const contentDiv = await waitForElement({
            selector: SELECTORS.playlistPage.contentDiv,
            signal,
        });

        const callback = (mutationList, obs) => {
            for (const mutation of mutationList) {
                if (mutation.addedNodes.length > 0) {
                    clearTimeout(timeout);
                    signal?.removeEventListener("abort", abortListener);
                    observer.disconnect();
                    resolve(mutation.addedNodes);
                }
            }
        };

        const observer = new MutationObserver(callback);
        observer.observe(contentDiv, { childList: true });
    });
}

async function isYtCourse({ signal }) {
    const performCheck = () => {
        const courseTextEl = document.querySelectorAll(SELECTORS.playlistPage.courseTextEl);
        for (const el of courseTextEl) {
            if (el?.textContent.toLowerCase() === "course") {
                return { found: true, isCourse: true };
            }
        }

        const playlistTextEl = document.querySelectorAll(SELECTORS.playlistPage.playlistTextEl);
        for (const el of playlistTextEl) {
            if (
                el?.textContent.toLowerCase() === "playlist" ||
                el?.textContent.toLowerCase() === "podcast"
            ) {
                return { found: true, isCourse: false };
            }
        }
        return { found: false };
    };

    return new Promise((resolve, reject) => {
        if (signal?.aborted) return reject(createAbortError());

        const initialCheck = performCheck();
        if (initialCheck.found) {
            return resolve(initialCheck.isCourse);
        }

        const observer = new MutationObserver(() => {
            const subsequentCheck = performCheck();
            if (subsequentCheck.found) {
                clearTimeout(timeoutId);
                observer.disconnect();
                resolve(subsequentCheck.isCourse);
            }
        });

        observer.observe(document.body, {
            childList: true,
            subtree: true,
        });

        const timeoutId = setTimeout(() => {
            observer.disconnect();
            reject(createAbortError());
        }, 120000); // 2 minutes timeout

        const abortListener = () => {
            observer.disconnect();
            clearTimeout(timeoutId);
            reject(createAbortError());
        };

        if (signal) {
            signal.addEventListener("abort", abortListener, { once: true });
        }
    });
}

async function isPlaylistTracked(playlistId) {
    if (!playlistId) return;
    const data = await chrome.storage.local.get(playlistId);
    return Boolean(data[playlistId]);
}

function initializeInvestedTimeTracker({ signal }) {
    if (signal.aborted) throw createAbortError();

    let intervalId = null;
    function startTracking() {
        if (intervalId !== null) return;
        intervalId = setInterval(() => {
            state.investedTime.seconds += 30;
            if (state.investedTime.seconds >= 60) {
                state.investedTime.minutes++;
                state.investedTime.seconds %= 60;
            }
            if (state.investedTime.minutes >= 60) {
                state.investedTime.hours++;
                state.investedTime.minutes %= 60;
            }
            const investedTimeEl = document.querySelector("#invested-time");
            if (investedTimeEl) {
                investedTimeEl.textContent = `${state.investedTime.hours}h ${state.investedTime.minutes}m`;
            }
            setToStorage();
        }, 30000);
    }

    function stopTracking() {
        if (intervalId === null) return;
        clearInterval(intervalId);
        intervalId = null;
    }

    if (Object.keys(state.videoWatchStatus).length === 0) {
        stopTracking();
    } else {
        startTracking();

        document.addEventListener("visibilitychange", visibilitychangeListener);
    }

    function visibilitychangeListener() {
        if (document.visibilityState === "hidden") {
            stopTracking();
        } else if (document.visibilityState === "visible") {
            startTracking();
        }
    }

    function cleanup() {
        if (intervalId !== null) {
            clearInterval(intervalId);
            intervalId = null;
        }
        document.removeEventListener("visibilitychange", visibilitychangeListener);
        state.investedTimeTrackerCleanup = null;
    }
    return cleanup;
}

function removePPMediaQueryListener() {
    if (state.mediaQuery && state.PPPlacementHandler) {
        state.mediaQuery.removeEventListener("change", state.PPPlacementHandler);
        state.mediaQuery = null;
        state.PPPlacementHandler = null;
    }
}

// --- SVG/ICON COMPONENTS ---
function getCheckboxWrapper(page) {
    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";

    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.setAttribute("viewBox", "0 0 35.6 35.6");

    const background = document.createElementNS("http://www.w3.org/2000/svg", "circle");
    background.setAttribute("class", "background");
    background.setAttribute("cx", "17.8");
    background.setAttribute("cy", "17.8");
    background.setAttribute("r", "17.8");

    const ring = document.createElementNS("http://www.w3.org/2000/svg", "circle");
    ring.setAttribute("class", "ring");
    ring.setAttribute("cx", "17.8");
    ring.setAttribute("cy", "17.8");
    ring.setAttribute("r", "12.37"); // Matches stroke

    const stroke = document.createElementNS("http://www.w3.org/2000/svg", "circle");
    stroke.setAttribute("class", "stroke");
    stroke.setAttribute("cx", "17.8");
    stroke.setAttribute("cy", "17.8");
    stroke.setAttribute("r", "14.37");

    const check = document.createElementNS("http://www.w3.org/2000/svg", "polyline");
    check.setAttribute("class", "check");
    check.setAttribute("points", "11.78 18.12 15.55 22.23 25.17 12.87");

    const hoverTick = document.createElementNS("http://www.w3.org/2000/svg", "polyline");
    hoverTick.setAttribute("class", "hover-tick");
    hoverTick.setAttribute("points", "13.5 18 16.5 21 23.5 14");

    svg.append(background, ring, stroke, check, hoverTick);

    const wrapper = document.createElement("div");
    if (page === "watch") {
        wrapper.classList.add("tmc-checkbox-wrapper", "tmc-wp-checkbox-wrapper");
    } else if (page === "playlist") {
        wrapper.classList.add("tmc-checkbox-wrapper", "tmc-pp-checkbox-wrapper");
    }
    wrapper.append(checkbox, svg);
    return wrapper;
}

async function getCoursesContainingVideo(videoId) {
    if (!videoId) return [];

    const storageData = await getFromStorage(null);
    const playlistIds = Object.keys(storageData).filter((key) => key !== "focusMode");

    const matchedCourses = [];

    for (const playlistId of playlistIds) {
        const course = storageData[playlistId];
        if (!course || !course.videoWatchStatus) continue;

        if (course.videoWatchStatus.hasOwnProperty(videoId)) {
            matchedCourses.push({
                playlistId,
                courseName: course.courseName,
                isWatched: course.videoWatchStatus[videoId],
            });
        }
    }

    return matchedCourses;
}

async function renderVideoCourseList({ signal, courses }) {
    if (signal?.aborted) return;

    const secondaryCol = await waitForElement({ selector: "#secondary-inner", signal });
    if (!secondaryCol) return;

    const isCurrentPlaylistTracked = await isPlaylistTracked(getPlaylistId(window.location.href));
    // Create or reset the container
    let container = document.querySelector(".tmc-video-course-panel");
    if (!container) {
        container = document.createElement("div");
        container.className = "tmc-video-course-panel";
        secondaryCol.prepend(container);
    } else {
        container.innerHTML = "";
    }
    // Header
    const header = document.createElement("div");
    header.className = "tmc-video-course-header";
    const count = courses.length;
    header.textContent = `${isCurrentPlaylistTracked ? "Also included in" : "Included in"} ${count > 1 ? "these" : "this"} ${count > 1 ? "courses" : "course"}`;
    container.append(header);

    // List
    const list = document.createElement("div");
    list.className = "tmc-video-course-list";

    courses.forEach((course) => {
        const item = document.createElement("a");
        item.className = "tmc-video-course-item";
        item.href = `https://www.youtube.com/playlist?list=${course.playlistId}`;
        item.target = "_blank";
        item.title = `Open Course: ${course.courseName}`;

        const name = document.createElement("span");
        name.className = "tmc-video-course-name";
        name.textContent = course.courseName;

        const icon = document.createElement("span");
        icon.className = "tmc-video-course-icon";
        icon.innerHTML = `
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
                 stroke="currentColor" stroke-width="2">
                <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 
                2 0 0 1 2-2h6"></path>
                <polyline points="15 3 21 3 21 9"></polyline>
                <line x1="10" y1="14" x2="21" y2="3"></line>
            </svg>
        `;

        item.append(name, icon);
        list.append(item);
    });

    container.append(list);
}

async function renderVideoWatchCheckbox({ signal, isWatched, videoId }) {
    if (signal?.aborted) return;

    const titleContainer = await waitForElement({
        selector: "#title > h1",
        signal,
    });
    if (!titleContainer) return;

    const existingWrapper = titleContainer.querySelector(".tmc-video-watch-checkbox-wrapper");
    if (existingWrapper) {
        const existingCheckbox = existingWrapper.querySelector("input[type=checkbox]");
        existingCheckbox.checked = isWatched;
        return;
    }

    const checkboxWrapper = getCheckboxWrapper(PAGE_TYPE.WATCH);
    checkboxWrapper.classList.add("tmc-video-watch-checkbox-wrapper");

    const checkbox = checkboxWrapper.querySelector("input[type=checkbox]");
    checkbox.id = videoId;
    checkbox.checked = isWatched;

    checkbox.addEventListener("click", async (e) => {
        const isChecked = e.target.checked;
        const videoDurationEl = document.querySelector(".ytp-time-duration");
        const videoDuration = videoDurationEl ? videoDurationEl.textContent : "0:00";

        await synchronizeVideoStatus(videoId, isChecked, videoDuration);
    });

    titleContainer.append(checkboxWrapper);
}

async function renderHomeCoursesSection({ signal }) {
    const storageData = await getFromStorage(null);
    const courses = Object.entries(storageData)
        .filter(([key]) => key !== "focusMode")
        .map(([key, value]) => ({ ...value, id: key }));

    if (courses.length === 0 || signal.aborted) return;
    courses.sort((a, b) => (b.lastInteractedAt ?? 0) - (a.lastInteractedAt ?? 0));

    const coursesSection = document.createElement("div");
    coursesSection.className = "tmc-home-section";

    const sectionTitle = document.createElement("h3");
    sectionTitle.textContent = "Your Courses";
    sectionTitle.className = "tmc-home-section-title";

    const coursesScroller = document.createElement("div");
    coursesScroller.className = "tmc-home-courses-scroller";

    courses.forEach((course) => {
        const card = createCourseCard(course);
        coursesScroller.append(card);
    });

    coursesSection.append(sectionTitle, coursesScroller);

    const [homeFeed, gridRenderer] = await Promise.all([
        waitForElement({
            selector: SELECTORS.homePage.homeFeed,
            signal,
        }),
        waitForElement({
            selector: SELECTORS.homePage.gridRenderer,
            signal,
        }),
    ]);

    if (signal.aborted) return;

    const ensureInserted = () => {
        if (homeFeed.firstChild !== coursesSection) {
            homeFeed.insertBefore(coursesSection, homeFeed.firstChild);
        }
    };

    const updateVisibility = () => {
        const isFiltered = gridRenderer.hasAttribute("is-filtered-feed");
        coursesSection.style.display = isFiltered ? "none" : "block";
    };

    ensureInserted();
    updateVisibility();

    const feedObserver = new MutationObserver(() => {
        if (signal.aborted) {
            feedObserver.disconnect();
            return;
        }
        ensureInserted();
    });

    feedObserver.observe(homeFeed, { childList: true });

    const filterObserver = new MutationObserver(() => {
        if (signal.aborted) {
            filterObserver.disconnect();
            return;
        }
        updateVisibility();
    });

    filterObserver.observe(gridRenderer, {
        attributes: true,
        attributeFilter: ["is-filtered-feed"],
    });

    signal.addEventListener("abort", () => {
        feedObserver.disconnect();
        filterObserver.disconnect();
    });
}

function createCourseCard(course) {
    const card = document.createElement("div");
    card.className = "tmc-home-course-card";

    const toSeconds = (d = {}) => (d.hours || 0) * 3600 + (d.minutes || 0) * 60 + (d.seconds || 0);

    const totalSec = toSeconds(course.totalDuration);
    const watchedSec = toSeconds(course.watchedDuration);
    const progressPercent = totalSec > 0 ? Math.round((watchedSec / totalSec) * 100) : 0;

    const courseHref = course.lastWatchedVideoId
        ? `https://www.youtube.com/watch?v=${course.lastWatchedVideoId}&list=${course.id}`
        : `https://www.youtube.com/playlist?list=${course.id}`;

    const thumbnail = document.createElement("a");
    thumbnail.className = "tmc-home-course-card-thumbnail";
    thumbnail.href = courseHref;
    const img = document.createElement("img");
    img.src = course.courseImgSrc || "";
    thumbnail.append(img);

    const thumbnailOverlay = document.createElement("div");
    thumbnailOverlay.className = "tmc-home-course-card-thumbnail-overlay";
    const overlayIcon = document.createElement("div");
    overlayIcon.className = "icon";
    overlayIcon.innerHTML =
        course.lastWatchedVideoId && progressPercent < 100
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
    overlayText.textContent =
        course.lastWatchedVideoId && progressPercent < 100 ? "Resume Course" : "View Course";
    thumbnailOverlay.append(overlayIcon, overlayText);
    thumbnail.append(thumbnailOverlay);

    const info = document.createElement("a");
    info.className = "tmc-home-course-card-info";
    info.href = `https://www.youtube.com/playlist?list=${course.id}`;

    const title = document.createElement("div");
    title.className = "tmc-home-course-card-title";
    title.textContent = course.courseName || "Untitled Course";

    const stats = document.createElement("div");
    stats.className = "tmc-home-course-card-stats";
    stats.textContent = `${progressPercent}% completed`;

    const progressBg = document.createElement("div");
    progressBg.className = "tmc-home-course-card-progress-bg";
    const progressFill = document.createElement("div");
    progressFill.className = "tmc-home-course-card-progress-fill";
    progressFill.style.width = `${progressPercent}%`;
    progressBg.append(progressFill);

    info.append(title, stats, progressBg);
    card.append(thumbnail, info);

    return card;
}

async function updateHomeCoursesContent({ signal } = {}) {
    if (!signal) signal = state.activePageUpdateController.signal;
    const homeCoursesSection = document.querySelector(".tmc-home-section");
    if (!homeCoursesSection) {
        renderHomeCoursesSection({ signal });
        return;
    }

    const storageData = await getFromStorage(null);
    const courses = Object.entries(storageData)
        .filter(([key]) => key !== "focusMode")
        .map(([key, value]) => ({ ...value, id: key }));
    if (courses.length === 0) {
        removeHomeCoursesSection();
        return;
    }

    const homeCoursesScroller = document.querySelector(".tmc-home-courses-scroller");
    homeCoursesScroller.innerHTML = "";
    courses.sort((a, b) => (b.lastInteractedAt ?? 0) - (a.lastInteractedAt ?? 0));
    for (const course of courses) {
        homeCoursesScroller.append(createCourseCard(course));
    }
}
