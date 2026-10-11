/*
shared constants and utility functions used by both content scripts and popup
content scripts load this via manifest.json (listed first in the content_scripts js array)
popup loads this via a <script> tag placed before popup.js in popup.html
*/

// --- activity log constants (consistency heatmap) ---
// daily watch activity is stored under this key. it is not a course, so it is filtered out
// everywhere courses are read (see PREFERENCE_KEYS below)
const ACTIVITY_STORAGE_KEY = "activityLog";

// how many days of history to keep. a little over a year so the 12-month heatmap stays complete
const ACTIVITY_RETENTION_DAYS = 400;

// a day's shade is derived from the *better* of these two signals, so a slow rewatch session
// still counts as a consistent day even when no new video gets ticked off
const ACTIVITY_LEVEL_VIDEOS = [1, 2, 4, 7];
const ACTIVITY_LEVEL_MINUTES = [5, 30, 60, 120];

// heatmap grid geometry
const HEATMAP_WEEKS = { HALF_YEAR: 26, YEAR: 53 };

// keys that are preferences, not courses. used to filter them out when reading all courses from storage
const PREFERENCE_KEYS = new Set(["focusMode", ACTIVITY_STORAGE_KEY]);

// --- storage helpers ---
async function getFromStorage(key) {
    try {
        return await chrome.storage.local.get(key);
    } catch (err) {
        return {};
    }
}

async function saveToStorage(data) {
    await chrome.storage.local.set(data);
}

async function removeFromStorage(key) {
    await chrome.storage.local.remove(key);
}

function getCourseEntries(storageData) {
    return Object.entries(storageData).filter(([key]) => !PREFERENCE_KEYS.has(key));
}

function getCourseKeys(storageData) {
    return Object.keys(storageData).filter((key) => !PREFERENCE_KEYS.has(key));
}

async function isPlaylistTracked(playlistId) {
    if (!playlistId) return false;
    const data = await getFromStorage(playlistId);
    return Boolean(data[playlistId]);
}

// --- duration helpers ---
function durationToSeconds(duration) {
    if (!duration) return 0;
    return (duration.hours || 0) * 3600 + (duration.minutes || 0) * 60 + (duration.seconds || 0);
}

function secondsToDuration(seconds) {
    return {
        hours: Math.floor(seconds / 3600),
        minutes: Math.floor((seconds % 3600) / 60),
        seconds: seconds % 60,
    };
}

// --- progress helpers ---
function getProgressPercent(course) {
    const watchedSeconds = durationToSeconds(course.watchedDuration);
    const totalSeconds = durationToSeconds(course.totalDuration);
    if (totalSeconds === 0) return 0;
    return Math.round((watchedSeconds / totalSeconds) * 100);
}

// --- url helpers ---
function getPlaylistId(url) {
    try {
        const urlObj = new URL(url);
        return urlObj.searchParams.get("list");
    } catch {
        return null;
    }
}

function getVideoId(url) {
    try {
        const urlObj = new URL(url);
        return urlObj.searchParams.get("v");
    } catch {
        return null;
    }
}

function getCourseHref(course) {
    return course.lastWatchedVideoId
        ? `https://www.youtube.com/watch?v=${course.lastWatchedVideoId}&list=${course.id}`
        : `https://www.youtube.com/playlist?list=${course.id}`;
}

// --- activity log (consistency heatmap) ---
/*
The activity log is a day-keyed map of what happened while studying on YouTube:

    {
        "2025-06-12": { videoIds: ["abc123", "def456"], seconds: 1800 },
        "2025-06-13": { videoIds: ["ghi789"], seconds: 600 },
    }

`videoIds` keeps the ids watched that day so re-ticking a video does not inflate the count,
and `seconds` accumulates the time spent on enrolled course pages.
*/

// local-time date key ("YYYY-MM-DD"). intentionally avoids toISOString, which is UTC and
// would shift the day for everyone east or west of Greenwich
function getDateKey(date = new Date()) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
}

function parseDateKey(key) {
    const [year, month, day] = key.split("-").map(Number);
    return new Date(year, month - 1, day);
}

function startOfDay(date = new Date()) {
    return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function addDays(date, days) {
    const next = startOfDay(date);
    next.setDate(next.getDate() + days);
    return next;
}

function getVideosWatched(entry) {
    return entry?.videoIds?.length || 0;
}

function getSecondsWatched(entry) {
    return entry?.seconds || 0;
}

function isActiveDay(entry) {
    return getVideosWatched(entry) > 0 || getSecondsWatched(entry) > 0;
}

/**
 * Maps a day of activity onto one of 5 shades (0 = nothing recorded).
 * A day takes the highest level reached by either videos watched or minutes watched.
 */
function getActivityLevel(videos = 0, seconds = 0) {
    if (videos <= 0 && seconds <= 0) return 0;

    const minutes = seconds / 60;
    let level = 0;
    for (let i = 0; i < ACTIVITY_LEVEL_VIDEOS.length; i++) {
        if (videos >= ACTIVITY_LEVEL_VIDEOS[i] || minutes >= ACTIVITY_LEVEL_MINUTES[i]) {
            level = i + 1;
        }
    }
    // something was recorded, so never leave the day blank
    return level || 1;
}

function pruneActivityLog(log) {
    const cutoffKey = getDateKey(addDays(new Date(), -ACTIVITY_RETENTION_DAYS));
    for (const key of Object.keys(log)) {
        // date keys sort lexicographically, so a plain string compare is enough
        if (key < cutoffKey) delete log[key];
    }
}

/**
 * Read-modify-write of today's entry in the activity log.
 * @param {(day: {videoIds: string[], seconds: number}) => object} mutateDay
 */
async function updateActivityLog(mutateDay) {
    const stored = await getFromStorage(ACTIVITY_STORAGE_KEY);
    const storedLog = stored[ACTIVITY_STORAGE_KEY];
    // defensive: a corrupted or hand-edited entry should never break recording
    const log = storedLog && typeof storedLog === "object" ? storedLog : {};
    const todayKey = getDateKey();
    const day = log[todayKey] || { videoIds: [], seconds: 0 };

    log[todayKey] = mutateDay(day) || day;
    pruneActivityLog(log);

    await saveToStorage({ [ACTIVITY_STORAGE_KEY]: log });
}

// called when a video is ticked as watched (from a checkbox or the watch-page button)
async function recordVideoWatched(videoId) {
    if (!videoId) return;
    await updateActivityLog((day) => {
        if (!Array.isArray(day.videoIds)) day.videoIds = [];
        if (!day.videoIds.includes(videoId)) day.videoIds.push(videoId);
        return day;
    });
}

// called by the watch-time tracker every time it ticks along
async function recordWatchTime(seconds) {
    if (!seconds || seconds < 0) return;
    await updateActivityLog((day) => {
        day.seconds = (day.seconds || 0) + seconds;
        return day;
    });
}

async function getActivityLog() {
    const stored = await getFromStorage(ACTIVITY_STORAGE_KEY);
    return stored[ACTIVITY_STORAGE_KEY] || {};
}

/**
 * Totals, streaks and today's numbers for the stats row.
 */
function getActivityStats(log = {}) {
    const dayKeys = Object.keys(log).filter((key) => isActiveDay(log[key]));

    let totalVideos = 0;
    let totalSeconds = 0;
    for (const key of dayKeys) {
        totalVideos += getVideosWatched(log[key]);
        totalSeconds += getSecondsWatched(log[key]);
    }

    const { currentStreak, longestStreak } = getActivityStreaks(log);
    const todayKey = getDateKey();

    return {
        activeDays: dayKeys.length,
        totalVideos,
        totalSeconds,
        currentStreak,
        longestStreak,
        todayVideos: getVideosWatched(log[todayKey]),
        todaySeconds: getSecondsWatched(log[todayKey]),
    };
}

/**
 * Walks every day from the first recorded one until today, so a gap in the log breaks the run.
 * The current streak survives a still-empty today (the day isn't over yet).
 */
function getActivityStreaks(log = {}) {
    const dayKeys = Object.keys(log)
        .filter((key) => isActiveDay(log[key]))
        .sort();
    if (dayKeys.length === 0) return { currentStreak: 0, longestStreak: 0 };

    const today = startOfDay();
    let longestStreak = 0;
    let run = 0;

    for (let date = parseDateKey(dayKeys[0]); date <= today; date = addDays(date, 1)) {
        if (isActiveDay(log[getDateKey(date)])) {
            run++;
            if (run > longestStreak) longestStreak = run;
        } else {
            run = 0;
        }
    }

    let currentStreak = 0;
    let cursor = isActiveDay(log[getDateKey(today)]) ? today : addDays(today, -1);
    while (isActiveDay(log[getDateKey(cursor)])) {
        currentStreak++;
        cursor = addDays(cursor, -1);
    }

    return { currentStreak, longestStreak };
}

/**
 * Builds the heatmap grid as an array of weeks (columns), each holding 7 days (rows).
 * Weeks start on Sunday and the last column always covers the full current week, so days
 * after today are flagged with `isFuture` and rendered as empty slots.
 */
function buildActivityWeeks(
    log = {},
    { weeks = HEATMAP_WEEKS.HALF_YEAR, endDate = new Date() } = {}
) {
    const lastDay = startOfDay(endDate);
    const gridEnd = addDays(lastDay, 6 - lastDay.getDay()); // saturday of the current week
    const gridStart = addDays(gridEnd, -(weeks * 7 - 1)); // sunday `weeks - 1` weeks earlier

    const grid = [];
    for (let weekStart = gridStart; weekStart <= gridEnd; weekStart = addDays(weekStart, 7)) {
        const days = [];
        for (let offset = 0; offset < 7; offset++) {
            const date = addDays(weekStart, offset);
            const key = getDateKey(date);
            const entry = log[key];
            const videos = getVideosWatched(entry);
            const seconds = getSecondsWatched(entry);

            days.push({
                key,
                date,
                videos,
                seconds,
                level: getActivityLevel(videos, seconds),
                isToday: key === getDateKey(lastDay),
                isFuture: date > lastDay,
            });
        }
        grid.push(days);
    }

    return grid;
}

/**
 * "1h 05m" / "12m" / "30s" — used in tooltips and the stats row.
 */
function formatActivityDuration(seconds = 0) {
    if (seconds <= 0) return "0m";

    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);

    if (hours > 0) return `${hours}h ${String(minutes).padStart(2, "0")}m`;
    if (minutes > 0) return `${minutes}m`;
    return `${Math.round(seconds)}s`;
}

/**
 * Folds an imported activity log into the stored one (used by the import page).
 * For every day the busier side wins and the video ids are unioned, so importing the same
 * backup twice never double counts.
 *
 * @returns {Promise<number>} how many days the import covered
 */
async function mergeActivityLog(incomingLog) {
    if (!incomingLog || typeof incomingLog !== "object") return 0;

    const stored = await getFromStorage(ACTIVITY_STORAGE_KEY);
    const log = stored[ACTIVITY_STORAGE_KEY] || {};
    let mergedDays = 0;

    for (const [key, entry] of Object.entries(incomingLog)) {
        // stay defensive: this data comes from a user-supplied file
        if (!/^\d{4}-\d{2}-\d{2}$/.test(key) || !entry || typeof entry !== "object") continue;

        const current = log[key] || { videoIds: [], seconds: 0 };
        const videoIds = Array.from(
            new Set([...(current.videoIds || []), ...(entry.videoIds || [])])
        );

        log[key] = {
            videoIds,
            seconds: Math.max(current.seconds || 0, entry.seconds || 0),
        };
        mergedDays++;
    }

    pruneActivityLog(log);
    await saveToStorage({ [ACTIVITY_STORAGE_KEY]: log });

    return mergedDays;
}
