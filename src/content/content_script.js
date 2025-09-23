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
        courseTextEl: ".metadata-action-bar p",
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
};

// --- STATE MANAGEMENT ---
const state = {
    playlistId: null,
    videoWatchStatus: {},
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
    PPProgressDivPlacementHandler: null,
    mediaQuery: null,
    playlistActions: null,
};

const PAGE_TYPE = {
    WATCH: "watch",
    PLAYLIST: "playlist",
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
} else {
    state.currentPage = null;
}
handleFullPageUpdate();

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
        await updateStateVariables({ signal });

        // Decide which update function to call based on the page type.
        const updateFunction = pageType === PAGE_TYPE.WATCH ? updateWatchPage : updatePlaylistPage;
        await updateFunction({ signal });
        toggleFocusModeUI(state.focusMode);
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

        // Populate the newly created UI with data.
        refreshWatchPageUI({ signal });
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
}

async function updatePlaylistPage({ signal }) {
    state.isYtCourse = await checkIsYtCourse({ signal });

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

        // Populate the newly created UI with data.
        refreshPlaylistPageUI({ signal });
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
        const isNewPlaylist =
            !(state.currentPage === PAGE_TYPE.WATCH) || state.playlistId !== request.playlistId;

        await waitForNavigation();
        if (isNewPlaylist) {
            await handleFullPageUpdate(PAGE_TYPE.WATCH);
        } else {
            // this happens when video is changed on the same playlist
            // youtube changes content in the same html structure which removes checkboxes. Hence again adding it.
            await handlePartialUpdate();
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

    const changedPlaylistId = Object.keys(changes)[0];
    if (changedPlaylistId !== state.playlistId) return;

    const currentURL = window.location.href;

    if (currentURL.includes("watch?v=") && currentURL.includes("list=")) {
        state.currentPage = PAGE_TYPE.WATCH;
    } else if (currentURL.includes("playlist?list=")) {
        state.currentPage = PAGE_TYPE.PLAYLIST;
    } else {
        state.currentPage = null;
    }

    const change = changes[changedPlaylistId];
    if (!change.oldValue || !change.newValue) {
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
    menu.appendChild(startCourseBtn);

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
    buttonContainerEl.innerHTML = `
    <button disabled class="tmc-wp-start-course-btn disabled-tmc-wp-start-course-btn">Start Course</button>
    <div class="tooltip">
      This playlist has <b>200+ videos</b>, so please start the course from the <a target="_blank" href=https://www.youtube.com/playlist?list=${state.playlistId}>playlist page </a>.
    </div>
    `;

    menu.appendChild(buttonContainerEl);

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
            setupCheckbox(video, PAGE_TYPE.WATCH);
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
            setupCheckbox(video, PAGE_TYPE.PLAYLIST);
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
                        setupCheckbox(video, PAGE_TYPE.PLAYLIST);
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

function setupCheckbox(video, pageType) {
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
        state.videoWatchStatus[videoId] = e.target.checked;
        let videoDuration;
        if (video.querySelector(SELECTORS.videoDuration)) {
            videoDuration = video.querySelector(SELECTORS.videoDuration).textContent;
        } else {
            videoDuration = (
                await waitForElement({
                    selector: SELECTORS.videoDuration,
                    parentEl: video,
                    signal,
                })
            ).textContent;
        }

        if (e.target.checked) addDurationTo(videoDuration, "watched");
        else removeFromWatchDuration(videoDuration);
        setToStorage();
    });

    const menu = video.querySelector("#menu");
    menu.appendChild(checkboxWrapper);
}

async function renderWPProgressDiv({ signal }) {
    if (signal?.aborted) return;

    const progressDiv = document.createElement("div");
    progressDiv.classList.add("tmc-progress-div", "tmc-wp-progress-div");
    progressDiv.innerHTML = `
        <div class="progress-content-wrapper">
            <div class="time-container">
                <div id="watched-time">${`${state.watchedDuration.hours}h ${state.watchedDuration.minutes}m ${state.watchedDuration.seconds}s`}</div>
                <div class="completed-videos">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="2"/>
                        <path d="M8.5 12.5L11 15l5-5.5" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                    </svg>
                    <span><span id="watched-videos-count">${
                        Object.values(state.videoWatchStatus).filter((s) => s).length
                    }</span>/<span id="total-videos-count">${
                        Object.keys(state.videoWatchStatus).length
                    }</span> watched</span>
                </div>
                <div id="total-time">${`${state.totalDuration.hours}h ${state.totalDuration.minutes}m ${state.totalDuration.seconds}s`}</div>
            </div>
            <div class="progress-bar-outer-container">
                <div class="progress-bar-container">
                    <div id="progress-bar" style="width: ${calculateCompletionPercentage()}%;"></div>
                </div>
            </div>
            <div class="completed-in"><b id="completed-percentage">${calculateCompletionPercentage()}</b><b>%</b> completed in <b id="invested-time">0h 0m</b></div>
            <div class="tmc-delete-btn">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M6 7h12M10 11v6M14 11v6M5 7l1 12a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2l1-12M9 7V5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                </svg>
            </div>
        </div>
        <div class="tmc-delete-popup">
            <p>Remove this course?</p>
            <div class="tmc-delete-buttons">
                <button class="tmc-confirm-delete">Yes</button>
                <button class="tmc-cancel-delete">No</button>
            </div>
        </div>
    `;

    const headerContents = await waitForElement({
        selector: SELECTORS.watchPage.headerContents,
        signal,
    });
    state.playlistActions = await waitForElement({
        selector: SELECTORS.watchPage.playlistActions,
        signal,
    });

    if (state.playlistActions) {
        state.playlistActions.remove();
    }

    if (signal.aborted) throw createAbortError();
    headerContents.appendChild(progressDiv);

    const deleteBtn = progressDiv.querySelector(".tmc-delete-btn");
    const confirmDeleteBtn = progressDiv.querySelector(".tmc-confirm-delete");
    const cancelDeleteBtn = progressDiv.querySelector(".tmc-cancel-delete");

    progressDiv.addEventListener("click", (e) => {
        e.stopPropagation();
    });

    deleteBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        progressDiv.classList.add("deleting");
    });

    cancelDeleteBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        progressDiv.classList.remove("deleting");
    });

    confirmDeleteBtn.addEventListener("click", async (e) => {
        e.stopPropagation();
        if (state.investedTimeTrackerCleanup) {
            state.investedTimeTrackerCleanup();
        }
        await chrome.storage.local.remove(state.playlistId);
        showToast("Course Removed");
    });
}

async function renderPPProgressDiv({ signal }) {
    if (signal.aborted) throw createAbortError();

    const progressDiv = document.createElement("div");
    progressDiv.classList.add("tmc-progress-div", "tmc-pp-progress-div");
    progressDiv.innerHTML = `
        <div class="progress-content-wrapper">
            <div class="tmc-total">
                <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor" aria-hidden="true">
                    <path d="M17 10.5V7c0-1.1-.9-2-2-2H5C3.9 5 3 5.9 3 7v10c0 1.1.9 2 2 2h10c1.1 0 2-.9 2-2v-3.5l4 4v-11l-4 4z"></path>
                </svg>
                <span class="tmc-total-text">${
                    Object.keys(state.videoWatchStatus).length
                } videos</span>
            </div>
            <div class="tmc-duration">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <circle cx="12" cy="12" r="10"></circle>
                    <line x1="12" y1="12" x2="12" y2="8" stroke-linecap="round"></line>
                    <line x1="12" y1="12" x2="15" y2="12" stroke-linecap="round"></line>
                </svg>
                <span class="tmc-duration-text">${state.totalDuration.hours}h ${
                    state.totalDuration.minutes
                }m ${state.totalDuration.seconds}s</span>
            </div>
            <div class="tmc-watched">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <circle cx="12" cy="12" r="10"></circle>
                    <path d="M8.5 12.5L11 15l5-5.5" stroke-linecap="round" stroke-linejoin="round"></path>
                </svg>
                <span class="tmc-watched-text">${
                    Object.values(state.videoWatchStatus).filter((s) => s).length
                } / ${Object.keys(state.videoWatchStatus).length} watched (${calculateCompletionPercentage()}%)</span>
            </div>
            <div class="tmc-actions">
                <div class="tmc-refresh" title="Update Playlist">
                    <svg class="tmc-refresh-svg" xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M17.65 6.35A7.95 7.95 0 0 0 12 4a8 8 0 0 0-8 8h2a6 6 0 0 1 6-6c1.66 0 3.14.69 4.22 1.78L13 11h7V4l-2.35 2.35zM6.35 17.65A7.95 7.95 0 0 0 12 20a8 8 0 0 0 8-8h-2a6 6 0 0 1-6 6c-1.66 0-3.14-.69-4.22-1.78L11 13H4v7l2.35-2.35z"/>
                    </svg>
                </div>
                <div class="tmc-delete" title="Remove Course">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M6 7h12M10 11v6M14 11v6M5 7l1 12a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2l1-12M9 7V5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2" stroke-linecap="round" stroke-linejoin="round"></path>
                    </svg>
                </div>
            </div>
        </div>
        <div class="tmc-delete-popup">
            <p>Remove this course?</p>
            <div class="tmc-delete-buttons">
                <button class="tmc-confirm-delete">Yes</button>
                <button class="tmc-cancel-delete">No</button>
            </div>
        </div>
    `;
    const refreshBtn = progressDiv.querySelector(".tmc-refresh");
    const deleteBtn = progressDiv.querySelector(".tmc-delete");
    const confirmDeleteBtn = progressDiv.querySelector(".tmc-confirm-delete");
    const cancelDeleteBtn = progressDiv.querySelector(".tmc-cancel-delete");

    refreshBtn.addEventListener("click", async () => {
        const refreshBtnSVG = refreshBtn.querySelector("svg");
        if (
            refreshBtnSVG.classList.contains("rotating") ||
            refreshBtnSVG.classList.contains("scanning")
        ) {
            return;
        }
        refreshBtnSVG.classList.add("rotating");
        setTimeout(() => {
            refreshBtnSVG.classList.remove("rotating");
        }, 400);
        await updatePlaylistData();
        showToast("Playlist Updated");
    });
    deleteBtn.addEventListener("click", () => {
        progressDiv.classList.add("deleting");
    });

    cancelDeleteBtn.addEventListener("click", () => {
        progressDiv.classList.remove("deleting");
    });

    confirmDeleteBtn.addEventListener("click", async () => {
        removePPMediaQueryListener();
        await chrome.storage.local.remove(state.playlistId);
        showToast("Course Removed");
    });

    let progressDivWideScreenRefEl;
    if (state.isYtCourse) {
        progressDivWideScreenRefEl = await waitForElement({
            selector: SELECTORS.playlistPage.ytCourse.progressDivWideScreenRefEl,
            signal,
        });
    } else {
        progressDivWideScreenRefEl = await waitForElement({
            selector: SELECTORS.playlistPage.progressDivWideScreenRefEl,
            signal,
        });
    }

    progressDivWideScreenRefEl.insertAdjacentElement("beforebegin", progressDiv);
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
    contentDiv.appendChild(scanningPlaylistEl);
    contentDiv.appendChild(scanningTextEl);
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
    
    const percentage = calculateCompletionPercentage();
    progressDiv.querySelector(".tmc-watched-text").textContent = `${
        Object.values(state.videoWatchStatus).filter(Boolean).length
    } / ${Object.keys(state.videoWatchStatus).length} watched (${percentage}%)`;

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
        headerContents.appendChild(state.playlistActions);
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

    if (headerContents && state.playlistActions) headerContents.appendChild(state.playlistActions);
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

function performCleanUp() {
    removeStartCourseBtn();
    removeVideoCheckboxes();
    removeProgressDiv();
    removePPMediaQueryListener();
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
                let videoDuration;
                if (video.querySelector(SELECTORS.videoDuration)) {
                    videoDuration = video.querySelector(SELECTORS.videoDuration).textContent;
                } else {
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

async function checkIsYtCourse({ signal }) {
    const performCheck = () => {
        const courseTextEl = document.querySelectorAll(SELECTORS.playlistPage.courseTextEl);
        for (el of courseTextEl) {
            if (el?.textContent.toLowerCase() === "course") {
                return { found: true, isCourse: true };
            }
        }

        const playlistTextEl = document.querySelectorAll(SELECTORS.playlistPage.playlistTextEl);
        for (el of playlistTextEl) {
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
    if (state.mediaQuery && state.PPProgressDivPlacementHandler) {
        state.mediaQuery.removeEventListener("change", state.PPProgressDivPlacementHandler);
        state.mediaQuery = null;
        state.PPProgressDivPlacementHandler = null;
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
