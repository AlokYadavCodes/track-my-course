# Chrome Extension API Reference

Comprehensive guide to Chrome Extension APIs with WXT. Based on official Chrome Extension documentation at https://developer.chrome.com/docs/extensions.

## Core APIs

### chrome.action (Manifest V3)

Control the extension's toolbar icon.

**Official Docs:** https://developer.chrome.com/docs/extensions/reference/api/action

```typescript
// Set badge text (shows number on icon)
await browser.action.setBadgeText({ text: '5' });

// Set badge background color
await browser.action.setBadgeBackgroundColor({ color: '#FF0000' });

// Set icon
await browser.action.setIcon({
  path: {
    16: '/icon/16.png',
    32: '/icon/32.png',
  }
});

// Set title (tooltip)
await browser.action.setTitle({ title: 'Extension tooltip' });

// Enable/disable for specific tabs
await browser.action.enable(tabId);
await browser.action.disable(tabId);

// Listen for icon clicks
browser.action.onClicked.addListener((tab) => {
  console.log('Extension icon clicked in tab:', tab.id);
});

// Set popup programmatically
await browser.action.setPopup({ popup: 'popup.html' });
```

### chrome.tabs

Interact with browser tabs.

**Official Docs:** https://developer.chrome.com/docs/extensions/reference/api/tabs

```typescript
// Query tabs
const tabs = await browser.tabs.query({
  active: true,
  currentWindow: true
});

// Get specific tab
const tab = await browser.tabs.get(tabId);

// Create new tab
const newTab = await browser.tabs.create({
  url: 'https://example.com',
  active: true,
  pinned: false,
});

// Update tab
await browser.tabs.update(tabId, {
  url: 'https://example.com',
  active: true,
});

// Close tab
await browser.tabs.remove(tabId);

// Duplicate tab
await browser.tabs.duplicate(tabId);

// Send message to content script
const response = await browser.tabs.sendMessage(tabId, {
  type: 'getMessage',
  data: 'hello'
});

// Note: tabs.executeScript and tabs.insertCSS are deprecated in MV3
// Use chrome.scripting API instead (see scripting section below)

// Tab events
browser.tabs.onCreated.addListener((tab) => {
  console.log('Tab created:', tab.id);
});

browser.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === 'complete') {
    console.log('Tab loaded:', tab.url);
  }
});

browser.tabs.onRemoved.addListener((tabId, removeInfo) => {
  console.log('Tab closed:', tabId);
});

browser.tabs.onActivated.addListener((activeInfo) => {
  console.log('Tab activated:', activeInfo.tabId);
});
```

### chrome.runtime

Access extension runtime information and communicate between components.

**Official Docs:** https://developer.chrome.com/docs/extensions/reference/api/runtime

```typescript
// Get extension ID
const extensionId = browser.runtime.id;

// Get manifest
const manifest = browser.runtime.getManifest();
console.log('Version:', manifest.version);

// Get URL of extension resource
const iconUrl = browser.runtime.getURL('icon/128.png');

// Send message to background
const response = await browser.runtime.sendMessage({
  type: 'getData',
  payload: { key: 'value' }
});

// Listen for messages
browser.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log('Message from:', sender.tab?.url || 'extension');

  if (message.type === 'getData') {
    // Handle async with Promise
    (async () => {
      const result = await fetchData(message.payload);
      sendResponse(result);
    })();

    return true; // Keep channel open for async
  }
});

// Connect for long-lived connections
const port = browser.runtime.connect({ name: 'my-channel' });
port.postMessage({ data: 'hello' });
port.onMessage.addListener((msg) => {
  console.log('Received:', msg);
});

// Listen for connection
browser.runtime.onConnect.addListener((port) => {
  console.log('Connected:', port.name);

  port.onMessage.addListener((msg) => {
    console.log('Message:', msg);
    port.postMessage({ response: 'received' });
  });
});

// Install/update events
browser.runtime.onInstalled.addListener((details) => {
  if (details.reason === 'install') {
    console.log('Extension installed');
  } else if (details.reason === 'update') {
    console.log('Extension updated to version:', manifest.version);
  }
});

// Extension suspend warning
browser.runtime.onSuspend.addListener(() => {
  console.log('Service worker about to suspend');
  // Clean up resources
});
```

### chrome.storage

Store and sync data.

**Official Docs:** https://developer.chrome.com/docs/extensions/reference/api/storage

```typescript
// Local storage (not synced)
await browser.storage.local.set({ key: 'value' });
const result = await browser.storage.local.get('key');
console.log(result.key); // 'value'

// Sync storage (synced across devices)
await browser.storage.sync.set({ settings: { theme: 'dark' } });
const settings = await browser.storage.sync.get('settings');

// Get multiple items
const data = await browser.storage.local.get(['key1', 'key2']);
console.log(data.key1, data.key2);

// Get all items
const all = await browser.storage.local.get(null);

// Remove items
await browser.storage.local.remove('key');
await browser.storage.local.remove(['key1', 'key2']);

// Clear all
await browser.storage.local.clear();

// Get bytes in use
const bytes = await browser.storage.local.getBytesInUse('key');

// Listen for changes
browser.storage.onChanged.addListener((changes, area) => {
  console.log('Storage area:', area); // 'local' or 'sync'

  for (const [key, { oldValue, newValue }] of Object.entries(changes)) {
    console.log(`${key} changed from ${oldValue} to ${newValue}`);
  }
});

// Storage limits
// local: ~10MB
// sync: 100KB total, 8KB per item
```

### chrome.alarms

Schedule periodic tasks.

**Official Docs:** https://developer.chrome.com/docs/extensions/reference/api/alarms

```typescript
// Create alarm that fires once
await browser.alarms.create('reminder', {
  delayInMinutes: 1,
});

// Create periodic alarm
await browser.alarms.create('daily-sync', {
  periodInMinutes: 1440, // 24 hours
});

// Create alarm at specific time
await browser.alarms.create('scheduled', {
  when: Date.now() + 60000, // 1 minute from now
});

// Get alarm
const alarm = await browser.alarms.get('reminder');

// Get all alarms
const alarms = await browser.alarms.getAll();

// Clear alarm
await browser.alarms.clear('reminder');

// Clear all alarms
await browser.alarms.clearAll();

// Listen for alarms
browser.alarms.onAlarm.addListener((alarm) => {
  console.log('Alarm fired:', alarm.name);

  if (alarm.name === 'daily-sync') {
    performDailySync();
  }
});
```

### chrome.notifications

Display system notifications.

**Official Docs:** https://developer.chrome.com/docs/extensions/reference/api/notifications

```typescript
// Basic notification
await browser.notifications.create({
  type: 'basic',
  iconUrl: '/icon/128.png',
  title: 'Notification Title',
  message: 'This is the notification message',
  priority: 2,
});

// Notification with buttons
await browser.notifications.create('my-notification-id', {
  type: 'basic',
  iconUrl: '/icon/128.png',
  title: 'Action Required',
  message: 'Click a button to respond',
  buttons: [
    { title: 'Accept' },
    { title: 'Decline' }
  ],
  requireInteraction: true, // Don't auto-dismiss
});

// Progress notification
await browser.notifications.create({
  type: 'progress',
  iconUrl: '/icon/128.png',
  title: 'Downloading...',
  message: 'File download in progress',
  progress: 50,
});

// List notification
await browser.notifications.create({
  type: 'list',
  iconUrl: '/icon/128.png',
  title: 'Multiple Items',
  message: 'Summary message',
  items: [
    { title: 'Item 1', message: 'First item' },
    { title: 'Item 2', message: 'Second item' },
  ],
});

// Image notification
await browser.notifications.create({
  type: 'image',
  iconUrl: '/icon/128.png',
  title: 'Image Notification',
  message: 'Notification with image',
  imageUrl: '/images/preview.png',
});

// Update notification
await browser.notifications.update('my-notification-id', {
  progress: 75,
});

// Clear notification
await browser.notifications.clear('my-notification-id');

// Notification events
browser.notifications.onClicked.addListener((notificationId) => {
  console.log('Notification clicked:', notificationId);
});

browser.notifications.onButtonClicked.addListener((notificationId, buttonIndex) => {
  console.log(`Button ${buttonIndex} clicked on ${notificationId}`);
});

browser.notifications.onClosed.addListener((notificationId, byUser) => {
  console.log(`Notification ${notificationId} closed by user: ${byUser}`);
});
```

### chrome.contextMenus

Add items to browser context menu (right-click menu).

**Official Docs:** https://developer.chrome.com/docs/extensions/reference/api/contextMenus

```typescript
// Create context menu in background script
browser.runtime.onInstalled.addListener(() => {
  // Simple menu item
  browser.contextMenus.create({
    id: 'search-selection',
    title: 'Search "%s"',
    contexts: ['selection'],
  });

  // Menu with submenu
  browser.contextMenus.create({
    id: 'parent',
    title: 'Extension Actions',
    contexts: ['page', 'selection'],
  });

  browser.contextMenus.create({
    id: 'child1',
    parentId: 'parent',
    title: 'Action 1',
    contexts: ['page'],
  });

  browser.contextMenus.create({
    id: 'child2',
    parentId: 'parent',
    title: 'Action 2',
    contexts: ['page'],
  });

  // Menu for specific URL patterns
  browser.contextMenus.create({
    id: 'github-actions',
    title: 'GitHub Actions',
    contexts: ['page'],
    documentUrlPatterns: ['*://github.com/*'],
  });
});

// Listen for clicks
browser.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId === 'search-selection') {
    const query = info.selectionText;
    browser.tabs.create({
      url: `https://www.google.com/search?q=${encodeURIComponent(query)}`,
    });
  }
});

// Context types
// 'all', 'page', 'selection', 'link', 'editable', 'image', 'video', 'audio'
```

### chrome.webRequest

Intercept and modify network requests.

**Official Docs:** https://developer.chrome.com/docs/extensions/reference/api/webRequest

**Requires permission:** `"webRequest"` and host permissions

```typescript
// Block requests
browser.webRequest.onBeforeRequest.addListener(
  (details) => {
    // Block requests to certain URLs
    if (details.url.includes('ads.com')) {
      return { cancel: true };
    }
  },
  { urls: ['<all_urls>'] },
  ['blocking']
);

// Modify request headers
browser.webRequest.onBeforeSendHeaders.addListener(
  (details) => {
    const headers = details.requestHeaders || [];

    // Add custom header
    headers.push({
      name: 'X-Custom-Header',
      value: 'my-value',
    });

    // Remove header
    const filtered = headers.filter(h => h.name !== 'User-Agent');

    return { requestHeaders: filtered };
  },
  { urls: ['*://*.example.com/*'] },
  ['blocking', 'requestHeaders']
);

// Modify response headers
browser.webRequest.onHeadersReceived.addListener(
  (details) => {
    const headers = details.responseHeaders || [];

    // Modify CORS headers
    headers.push({
      name: 'Access-Control-Allow-Origin',
      value: '*',
    });

    return { responseHeaders: headers };
  },
  { urls: ['*://*.api.com/*'] },
  ['blocking', 'responseHeaders']
);

// Redirect requests
browser.webRequest.onBeforeRequest.addListener(
  (details) => {
    return { redirectUrl: 'https://alternative.com' };
  },
  { urls: ['*://blocked.com/*'] },
  ['blocking']
);
```

### chrome.cookies

Manage browser cookies.

**Official Docs:** https://developer.chrome.com/docs/extensions/reference/api/cookies

```typescript
// Get cookie
const cookie = await browser.cookies.get({
  url: 'https://example.com',
  name: 'session',
});

// Get all cookies for URL
const cookies = await browser.cookies.getAll({
  url: 'https://example.com',
});

// Set cookie
await browser.cookies.set({
  url: 'https://example.com',
  name: 'session',
  value: 'abc123',
  expirationDate: Date.now() / 1000 + 3600, // 1 hour
  httpOnly: true,
  secure: true,
  sameSite: 'lax',
});

// Remove cookie
await browser.cookies.remove({
  url: 'https://example.com',
  name: 'session',
});

// Listen for cookie changes
browser.cookies.onChanged.addListener((changeInfo) => {
  console.log('Cookie changed:', changeInfo.cookie.name);
  console.log('Removed:', changeInfo.removed);
});
```

### chrome.downloads

Manage file downloads.

**Official Docs:** https://developer.chrome.com/docs/extensions/reference/api/downloads

```typescript
// Download file
const downloadId = await browser.downloads.download({
  url: 'https://example.com/file.pdf',
  filename: 'downloaded-file.pdf',
  saveAs: true, // Show save dialog
});

// Search downloads
const downloads = await browser.downloads.search({
  query: ['pdf'],
  orderBy: ['-startTime'],
  limit: 10,
});

// Pause download
await browser.downloads.pause(downloadId);

// Resume download
await browser.downloads.resume(downloadId);

// Cancel download
await browser.downloads.cancel(downloadId);

// Show download in folder
await browser.downloads.show(downloadId);

// Open downloaded file
await browser.downloads.open(downloadId);

// Listen for download changes
browser.downloads.onChanged.addListener((delta) => {
  if (delta.state?.current === 'complete') {
    console.log('Download complete:', delta.id);
  }
});

browser.downloads.onCreated.addListener((item) => {
  console.log('Download started:', item.filename);
});
```

### chrome.bookmarks

Access and modify bookmarks.

**Official Docs:** https://developer.chrome.com/docs/extensions/reference/api/bookmarks

```typescript
// Get bookmarks
const bookmarks = await browser.bookmarks.getTree();

// Search bookmarks
const results = await browser.bookmarks.search('github');

// Create bookmark
const bookmark = await browser.bookmarks.create({
  parentId: '1',
  title: 'GitHub',
  url: 'https://github.com',
});

// Create folder
const folder = await browser.bookmarks.create({
  parentId: '1',
  title: 'My Folder',
});

// Update bookmark
await browser.bookmarks.update(bookmark.id, {
  title: 'GitHub - Updated',
  url: 'https://github.com/explore',
});

// Move bookmark
await browser.bookmarks.move(bookmark.id, {
  parentId: folder.id,
  index: 0,
});

// Remove bookmark
await browser.bookmarks.remove(bookmark.id);

// Remove folder recursively
await browser.bookmarks.removeTree(folder.id);

// Listen for changes
browser.bookmarks.onCreated.addListener((id, bookmark) => {
  console.log('Bookmark created:', bookmark.title);
});

browser.bookmarks.onRemoved.addListener((id, removeInfo) => {
  console.log('Bookmark removed:', id);
});
```

### chrome.scripting

Inject JavaScript and CSS into web pages (replaces deprecated tabs.executeScript/insertCSS).

**Official Docs:** https://developer.chrome.com/docs/extensions/reference/api/scripting

**Required permission:** `"scripting"`

```typescript
// Execute script in tab
await chrome.scripting.executeScript({
  target: { tabId: tabId },
  files: ['content.js'],
});

// Execute inline function
await chrome.scripting.executeScript({
  target: { tabId: tabId },
  func: () => {
    console.log('Hello from injected script');
  },
});

// Execute with arguments
await chrome.scripting.executeScript({
  target: { tabId: tabId },
  func: (color) => {
    document.body.style.backgroundColor = color;
  },
  args: ['red'],
});

// Inject CSS file
await chrome.scripting.insertCSS({
  target: { tabId: tabId },
  files: ['styles.css'],
});

// Inject inline CSS
await chrome.scripting.insertCSS({
  target: { tabId: tabId },
  css: 'body { background: red; }',
});

// Remove CSS
await chrome.scripting.removeCSS({
  target: { tabId: tabId },
  css: 'body { background: red; }',
});

// Register content scripts dynamically
await chrome.scripting.registerContentScripts([{
  id: 'my-script',
  matches: ['*://example.com/*'],
  js: ['content.js'],
  runAt: 'document_idle',
}]);

// Get registered scripts
const scripts = await chrome.scripting.getRegisteredContentScripts();

// Unregister scripts
await chrome.scripting.unregisterContentScripts({
  ids: ['my-script'],
});

// Update existing scripts
await chrome.scripting.updateContentScripts([{
  id: 'my-script',
  matches: ['*://example.com/*', '*://example.org/*'],
}]);
```

### chrome.history

Access browser history.

**Official Docs:** https://developer.chrome.com/docs/extensions/reference/api/history

```typescript
// Search history
const history = await browser.history.search({
  text: 'github',
  startTime: Date.now() - 7 * 24 * 60 * 60 * 1000, // Last 7 days
  maxResults: 100,
});

// Get visits for URL
const visits = await browser.history.getVisits({
  url: 'https://github.com',
});

// Add URL to history
await browser.history.addUrl({
  url: 'https://example.com',
  title: 'Example Domain',
});

// Remove URL from history
await browser.history.deleteUrl({
  url: 'https://example.com',
});

// Remove all history in time range
await browser.history.deleteRange({
  startTime: Date.now() - 24 * 60 * 60 * 1000, // Last 24 hours
  endTime: Date.now(),
});

// Delete all history
await browser.history.deleteAll();

// Listen for history changes
browser.history.onVisited.addListener((result) => {
  console.log('Page visited:', result.url);
});
```

## Chrome 140+ Features (September 2025)

### sidePanel.getLayout()

New in Chrome 140 - determine side panel side (left or right).

**Official Docs:** https://developer.chrome.com/docs/extensions/reference/api/sidePanel#method-getLayout

```typescript
// Get side panel layout
const layout = await chrome.sidePanel.getLayout();
console.log('Side panel side:', layout.side); // 'left' or 'right'

// Useful for RTL language support
if (layout.side === 'right') {
  // Apply RTL-specific styling or behavior
}
```

**Use Cases:**
- Adapting UI for RTL languages
- Adjusting panel content based on side
- Optimizing user experience based on panel location

**Browser Support:** Chrome 140+ (September 2025)

## Permission Patterns

### Required Permissions

**manifest.json:**
```json
{
  "permissions": [
    "storage",
    "tabs",
    "activeTab",
    "alarms",
    "notifications",
    "contextMenus"
  ],
  "host_permissions": [
    "*://example.com/*",
    "*://api.example.com/*"
  ],
  "optional_permissions": [
    "downloads",
    "bookmarks",
    "history"
  ]
}
```

### Request Optional Permissions

```typescript
// Check if permission granted
const hasPermission = await browser.permissions.contains({
  permissions: ['downloads'],
  origins: ['*://downloads.example.com/*'],
});

// Request permission
const granted = await browser.permissions.request({
  permissions: ['downloads'],
  origins: ['*://downloads.example.com/*'],
});

if (granted) {
  // Permission granted, use the API
  await browser.downloads.download({ url: 'https://example.com/file.pdf' });
}

// Remove permission
await browser.permissions.remove({
  permissions: ['downloads'],
});

// Listen for permission changes
browser.permissions.onAdded.addListener((permissions) => {
  console.log('Permissions added:', permissions);
});

browser.permissions.onRemoved.addListener((permissions) => {
  console.log('Permissions removed:', permissions);
});
```

## Content Script Communication

### Sending Messages

```typescript
// Content script → Background
const response = await browser.runtime.sendMessage({
  type: 'getData',
  payload: { key: 'value' },
});

// Background → Content script
const response = await browser.tabs.sendMessage(tabId, {
  type: 'updateUI',
  payload: { theme: 'dark' },
});
```

### Long-Lived Connections

```typescript
// Content script
const port = browser.runtime.connect({ name: 'my-channel' });

port.postMessage({ type: 'init' });

port.onMessage.addListener((msg) => {
  console.log('Received:', msg);
});

port.onDisconnect.addListener(() => {
  console.log('Disconnected');
});

// Background script
browser.runtime.onConnect.addListener((port) => {
  if (port.name === 'my-channel') {
    port.onMessage.addListener((msg) => {
      // Handle message
      port.postMessage({ response: 'acknowledged' });
    });
  }
});
```

## Official Documentation Links

- **Get Started:** https://developer.chrome.com/docs/extensions/get-started
- **API Reference:** https://developer.chrome.com/docs/extensions/reference/api
- **Manifest V3:** https://developer.chrome.com/docs/extensions/develop/migrate/what-is-mv3
- **Content Scripts:** https://developer.chrome.com/docs/extensions/develop/concepts/content-scripts
- **Service Workers:** https://developer.chrome.com/docs/extensions/develop/concepts/service-workers
- **Message Passing:** https://developer.chrome.com/docs/extensions/develop/concepts/messaging
- **Storage:** https://developer.chrome.com/docs/extensions/reference/api/storage
- **Permissions:** https://developer.chrome.com/docs/extensions/develop/concepts/declare-permissions
- **Publishing:** https://developer.chrome.com/docs/webstore/publish
- **Best Practices:** https://developer.chrome.com/docs/extensions/develop/concepts/best-practices
