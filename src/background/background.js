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
        } else if (url === "https://www.youtube.com/" || (url.includes("youtube.com/") && !url.includes("/watch") && !url.includes("/playlist") && !url.includes("/shorts"))) {
            sendMessage(tabId, {
                action: "updateHomePage"
            });
        } else {
            sendMessage(tabId, { action: "someOtherPage" });
        }
    },
    { url: [{ hostContains: "youtube.com" }] }
);
