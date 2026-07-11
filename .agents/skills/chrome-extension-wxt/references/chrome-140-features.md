# Chrome 140+ Features (September 2025+)

New Chrome Extension APIs introduced in Chrome 140 and later versions.

## Chrome 140 (September 2025)

### sidePanel.getLayout()

Determines the position of the side panel (left or right) in the browser window.

**Official Documentation:** https://developer.chrome.com/docs/extensions/reference/api/sidePanel#method-getLayout

#### API Signature

```typescript
chrome.sidePanel.getLayout(): Promise<{
  side: 'left' | 'right';
}>
```

#### Basic Usage

```typescript
// Get current side panel layout
const layout = await chrome.sidePanel.getLayout();
console.log('Side panel is positioned on the:', layout.side);

if (layout.side === 'right') {
  console.log('Side panel is on the right');
} else {
  console.log('Side panel is on the left');
}
```

#### Use Cases

##### 1. RTL Language Support

```typescript
export default defineContentScript({
  matches: ['*://*'],
  async main() {
    const layout = await chrome.sidePanel.getLayout();
    const documentDir = document.documentElement.dir;

    // Adjust UI based on panel side and text direction
    if (layout.side === 'right' && documentDir === 'rtl') {
      // Apply RTL-optimized positioning
      applyRTLStyles();
    }
  },
});
```

##### 2. Dynamic Content Positioning

```typescript
// Popup component
function App() {
  const [panelSide, setPanelSide] = useState<'left' | 'right'>('left');

  useEffect(() => {
    chrome.sidePanel.getLayout().then(({ side }) => {
      setPanelSide(side);
    });
  }, []);

  return (
    <div className={`panel-${panelSide}`}>
      <p>Panel is positioned on the {panelSide}</p>
      {/* Adjust UI layout based on panel side */}
    </div>
  );
}
```

##### 3. Optimal Notification Placement

```typescript
// Background script
browser.alarms.onAlarm.addListener(async (alarm) => {
  const layout = await chrome.sidePanel.getLayout();

  // Position notifications away from side panel
  const notificationPosition = layout.side === 'right'
    ? 'bottom-left'
    : 'bottom-right';

  await chrome.notifications.create({
    type: 'basic',
    title: 'Reminder',
    message: 'Task is due',
    iconUrl: '/icon/128.png',
  });
});
```

#### Browser Compatibility

- **Chrome:** 140+ (September 2025)
- **Firefox:** Not yet supported
- **Edge:** 140+ (follows Chromium)
- **Safari:** Not applicable (no side panel API)

#### Feature Detection

Always check if the API is available:

```typescript
async function getSidePanelSide(): Promise<'left' | 'right' | null> {
  if (chrome.sidePanel?.getLayout) {
    try {
      const layout = await chrome.sidePanel.getLayout();
      return layout.side;
    } catch (error) {
      console.error('Failed to get side panel layout:', error);
      return null;
    }
  }
  return null; // API not available
}
```

#### Integration with WXT

```typescript
// entrypoints/sidepanel/main.tsx
import { useState, useEffect } from 'react';

function SidePanel() {
  const [side, setSide] = useState<'left' | 'right'>('left');

  useEffect(() => {
    // Get initial side
    chrome.sidePanel.getLayout().then(({ side }) => {
      setSide(side);
    });

    // Note: Chrome doesn't fire events when user changes panel side
    // You may need to periodically check or reload when panel is opened
  }, []);

  return (
    <div className={`sidepanel-container side-${side}`}>
      <header className={side === 'right' ? 'rtl' : 'ltr'}>
        <h1>Side Panel Content</h1>
      </header>
      <main>
        <p>Current side: {side}</p>
      </main>
    </div>
  );
}
```

#### Default Behavior

- **New Chrome installations (2025+):** May default to right side
- **Upgraded Chrome installations:** Retains user's previous preference
- **User can change:** Users can move side panel between left and right at any time

#### Common Patterns

##### Responsive Layout Adjustment

```typescript
// hooks/useSidePanelPosition.ts
import { useState, useEffect } from 'react';

export function useSidePanelSide() {
  const [side, setSide] = useState<'left' | 'right'>('left');
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (chrome.sidePanel?.getLayout) {
      chrome.sidePanel
        .getLayout()
        .then(({ side }) => {
          setSide(side);
        })
        .catch((error) => {
          console.error('Failed to get side panel side:', error);
        })
        .finally(() => {
          setIsLoading(false);
        });
    } else {
      setIsLoading(false);
    }
  }, []);

  return { side, isLoading };
}

// Usage in component
function MyComponent() {
  const { side, isLoading } = useSidePanelSide();

  if (isLoading) return <LoadingSpinner />;

  return (
    <div className={`content-${side}`}>
      {/* Content positioned based on panel location */}
    </div>
  );
}
```

#### Styling Based on Side

```css
/* CSS for panel-aware layouts */
.content-left {
  /* Panel is on left, content flows from right */
  margin-left: 20px;
  margin-right: 0;
  text-align: left;
}

.content-right {
  /* Panel is on right, content flows from left */
  margin-left: 0;
  margin-right: 20px;
  text-align: right;
}

/* RTL support */
[dir="rtl"] .content-left {
  direction: rtl;
}
```

## Staying Updated

To stay informed about new Chrome Extension features:

1. **Chrome Extensions What's New:** https://developer.chrome.com/docs/extensions/whats-new
2. **Chrome Developers Blog:** https://developer.chrome.com/blog
3. **Chrome Platform Status:** https://chromestatus.com/features
4. **WXT Changelog:** https://github.com/wxt-dev/wxt/releases

## Migration Guide

If your extension currently assumes side panel is always on the left:

### Before (Assumed Left Side)

```typescript
// Old code - assumes left side
function positionContent() {
  const content = document.getElementById('content');
  content.style.marginLeft = '400px'; // Fixed left margin
}
```

### After (Side-Aware)

```typescript
// New code - adapts to panel side
async function positionContent() {
  const content = document.getElementById('content');

  if (chrome.sidePanel?.getLayout) {
    const { side } = await chrome.sidePanel.getLayout();

    if (side === 'right') {
      content.style.marginRight = '400px';
      content.style.marginLeft = '0';
    } else {
      content.style.marginLeft = '400px';
      content.style.marginRight = '0';
    }
  }
}
```

## Related APIs

- **chrome.sidePanel.open()** - Open side panel programmatically
- **chrome.sidePanel.close()** - Close side panel
- **chrome.sidePanel.setOptions()** - Configure side panel behavior
- **chrome.sidePanel.getOptions()** - Get current side panel configuration

**Full Side Panel API:** https://developer.chrome.com/docs/extensions/reference/api/sidePanel
