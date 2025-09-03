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

        if (url.includes("/watch") && url.includes("list=")) {
            sendMessage(tabId, {
                action: "updateWatchPage",
                playlistId: getPlaylistId(url),
            });
        } else if (url.includes("/playlist") && url.includes("list=")) {
            sendMessage(tabId, {
                action: "updatePlaylistPage",
                playlistId: getPlaylistId(url),
            });
        } else {
            sendMessage(tabId, { action: "someOtherPage" });
        }
    },
    { url: [{ hostContains: "youtube.com" }] }
);
