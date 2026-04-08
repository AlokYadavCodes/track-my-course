/*
shared constants and utility functions used by both content scripts and popup
content scripts load this via manifest.json (listed first in the content_scripts js array)
popup loads this via a <script> tag placed before popup.js in popup.html
*/

// keys that are preferences, not courses. used to filter them out when reading all courses from storage
const PREFERENCE_KEYS = new Set(["focusMode"]);

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
