# WXT API Reference

Complete API documentation for WXT framework functions and utilities.

## Core APIs

### defineBackground()

Define service worker (background script) behavior.

```typescript
export default defineBackground({
  type: 'module' | 'esm',
  persistent: boolean,
  main(ctx) {
    // Background logic
  }
});
```

### defineContentScript()

Define content script that runs on web pages.

```typescript
export default defineContentScript({
  matches: string[],
  excludeMatches?: string[],
  runAt: 'document_start' | 'document_end' | 'document_idle',
  world: 'ISOLATED' | 'MAIN',
  cssInjectionMode: 'ui' | 'inline' | 'manual',

  main(ctx: ContentScriptContext) {
    // Content script logic
  }
});
```

### createShadowRootUi()

Create isolated UI components in content scripts.

```typescript
const ui = createShadowRootUi(ctx, {
  name: string,
  position: 'inline' | 'overlay' | 'modal',
  anchor: string | HTMLElement,

  onMount(container: HTMLElement) {
    // Mount UI framework
  },

  onRemove?(container: HTMLElement) {
    // Cleanup
  }
});

ui.mount();
ui.remove();
```

### storage

WXT storage API with type safety.

```typescript
import { storage } from 'wxt/storage';

// Get item
const value = await storage.getItem<T>('local:key');

// Set item
await storage.setItem('local:key', value);

// Remove item
await storage.removeItem('local:key');

// Watch for changes
const unwatch = storage.watch<T>('local:key', (newValue, oldValue) => {
  // Handle change
});
```

### injectScript()

Inject scripts into page context.

```typescript
import { injectScript } from 'wxt/client';

await injectScript('/script.js', {
  keepInDom: boolean,
});
```

## Browser API

WXT provides unified `browser` API that works across all browsers:

```typescript
// Tabs
await browser.tabs.query({ active: true });
await browser.tabs.sendMessage(tabId, message);

// Runtime
await browser.runtime.sendMessage(message);
browser.runtime.onMessage.addListener(handler);

// Storage
await browser.storage.local.get(key);
await browser.storage.local.set({ key: value });
await browser.storage.sync.set({ key: value });

// Action (toolbar icon)
browser.action.onClicked.addListener(handler);
await browser.action.setBadgeText({ text: '5' });
await browser.action.setIcon({ path: '/icon.png' });
```

## Configuration API

### defineConfig()

```typescript
import { defineConfig } from 'wxt';

export default defineConfig({
  // Target browser
  browser: 'chrome' | 'firefox' | 'edge' | 'safari',

  // Modules (framework integration)
  modules: ['@wxt-dev/module-react'],

  // Manifest overrides
  manifest: {
    name: string,
    description: string,
    version: string,
    permissions: string[],
    host_permissions: string[],
    content_security_policy: {
      extension_pages: string,
    },
  },

  // Vite configuration
  vite: () => ({
    // Vite config
  }),
});
```

### defineWebExtConfig()

Configure browser runner behavior during development.

```typescript
import { defineWebExtConfig } from 'wxt';

export default defineWebExtConfig({
  // Custom browser binary paths
  binaries: {
    chrome: '/Applications/Google Chrome Beta.app/Contents/MacOS/Google Chrome Beta',
    firefox: 'firefoxdeveloperedition',
    edge: '/usr/bin/microsoft-edge-dev',
  },

  // Chrome/Chromium-specific arguments
  chromiumArgs: [
    '--user-data-dir=./.wxt/chrome-data',
    '--disable-features=DialMediaRouteProvider',
  ],

  // Firefox-specific arguments
  firefoxArgs: [
    '--profile',
    './.wxt/firefox-profile',
  ],

  // Keep profile data between runs (preserves logins, storage)
  keepProfileChanges: true,

  // Browser to launch (overrides wxt.config.ts)
  target: 'chrome-mv3',

  // Start URL when browser opens
  startUrl: 'https://example.com',

  // Additional preferences
  chromiumProfile: './.wxt/chrome-profile',
  firefoxProfile: './.wxt/firefox-profile',
});
```

**Common Use Cases:**

#### Development with Chrome Beta/Canary

```typescript
// web-ext.config.ts
export default defineWebExtConfig({
  binaries: {
    chrome: '/Applications/Google Chrome Canary.app/Contents/MacOS/Google Chrome Canary',
  },
  chromiumArgs: [
    '--user-data-dir=./.wxt/chrome-canary-data',
  ],
});
```

#### Persistent Login Sessions

```typescript
// web-ext.config.ts
export default defineWebExtConfig({
  keepProfileChanges: true,
  chromiumProfile: './.wxt/dev-profile',

  // Start with test page open
  startUrl: 'https://app.example.com/dashboard',
});
```

#### Firefox Developer Edition

```typescript
// web-ext.config.ts
export default defineWebExtConfig({
  binaries: {
    firefox: 'firefoxdeveloperedition',
  },
  firefoxArgs: [
    '--profile',
    './.wxt/firefox-dev-profile',
  ],
  keepProfileChanges: true,
});
```

**Configuration File Location:** `web-ext.config.ts` in project root

## Context APIs

### ContentScriptContext

Available in content scripts:

```typescript
interface ContentScriptContext {
  addEventListener<K extends keyof WindowEventMap>(
    target: Window | Document | HTMLElement,
    type: K,
    listener: (event: WindowEventMap[K]) => void
  ): void;

  isValid: boolean;

  signal: AbortSignal;
}
```

## Utility Functions

### MatchPattern

Pattern matching for URLs:

```typescript
import { MatchPattern } from 'wxt/match-pattern';

const pattern = new MatchPattern('*://*.youtube.com/*');

if (pattern.includes('https://www.youtube.com/watch')) {
  // Matches
}
```

### Location Change Detection

Detect SPA navigation:

```typescript
ctx.addEventListener(window, 'wxt:locationchange', ({ newUrl }) => {
  console.log('Navigated to:', newUrl);
});
```

## Build APIs

### Environment Variables

```typescript
// Available at build time
import.meta.env.MODE // 'development' | 'production'
import.meta.env.BROWSER // 'chrome' | 'firefox' | etc.
import.meta.env.VITE_* // Custom env variables
```

### Asset URLs

```typescript
// Get public asset URL
const iconUrl = browser.runtime.getURL('/icon/128.png');
```

## Hooks System

WXT provides build hooks for customization:

```typescript
export default defineConfig({
  hooks: {
    'build:manifestGenerated': (wxt, manifest) => {
      // Modify manifest before writing
    },

    'build:publicAssets': (wxt, assets) => {
      // Add/modify public assets
    },
  },
});
```
