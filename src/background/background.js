function sendMessage(tabId, message) {
    chrome.tabs.sendMessage(tabId, message, () => {
        if (chrome.runtime.lastError) {
            // ignore
        }
    });
}

function getPlaylistId(url) {
    try {
        const urlObj = new URL(url);
        return urlObj.searchParams.get("list");
    } catch {
        return null;
    }
}

chrome.webNavigation.onHistoryStateUpdated.addListener(
    (details) => {
        const { url, tabId } = details;

        if (url.includes("/watch")) {
            sendMessage(tabId, {
                action: "updateWatchPage",
                playlistId: getPlaylistId(url), // can be null
            });
        } else if (url.includes("/playlist") && url.includes("list=")) {
            sendMessage(tabId, {
                action: "updatePlaylistPage",
                playlistId: getPlaylistId(url),
            });
        } else if (url === "https://www.youtube.com/") {
            sendMessage(tabId, {
                action: "updateHomePage",
            });
        } else {
            sendMessage(tabId, { action: "someOtherPage" });
        }
    },
    { url: [{ hostContains: "youtube.com" }] }
);

// handle export download requests from popup
// the popup can't reliably trigger downloads itself (closes on focus loss)
chrome.runtime.onMessage.addListener((message) => {
    if (message.type !== "exportData") return;
    let url;
    if (typeof URL.createObjectURL === "function") {
        // Firefox blocks data: URIs navigation or downloads
        // But Firefox runs the background script in context of a hidden generated page,
        // so it has access to DOM APIs and can use blob URLs
        const blob = new Blob([message.json], { type: "application/json" });
        url = URL.createObjectURL(blob);
    } else {
        // Chrome service worker has no DOM, use data URL instead
        url = "data:application/json;charset=utf-8," + encodeURIComponent(message.json);
    }

    chrome.downloads.download({ url, filename: message.filename, saveAs: true });
});
