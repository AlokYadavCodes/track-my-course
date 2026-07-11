# React Integration with WXT

Complete guide for building Chrome extensions with React and WXT.

## Setup

### Initialize with React Template

```bash
npm create wxt@latest -- --template react-ts
cd my-extension
npm install
```

### Manual Setup

```bash
npm install react react-dom
npm install -D @types/react @types/react-dom @wxt-dev/module-react
```

**wxt.config.ts:**
```typescript
import { defineConfig } from 'wxt';

export default defineConfig({
  modules: ['@wxt-dev/module-react'],

  manifest: {
    content_security_policy: {
      extension_pages: "script-src 'self' 'wasm-unsafe-eval'; object-src 'self'",
    },
  },
});
```

## Entry Point Patterns

### Popup with React

**Directory structure:**
```
entrypoints/popup/
├── index.html
├── main.tsx        # Entry point
├── App.tsx         # Root component
└── components/     # UI components
    ├── Header.tsx
    └── Settings.tsx
```

**entrypoints/popup/index.html:**
```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Extension Popup</title>
</head>
<body>
  <div id="root"></div>
  <script type="module" src="./main.tsx"></script>
</body>
</html>
```

**entrypoints/popup/main.tsx:**
```typescript
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './style.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
```

**entrypoints/popup/App.tsx:**
```typescript
import { useState, useEffect } from 'react';

export default function App() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    try {
      // Get current tab
      const [tab] = await browser.tabs.query({
        active: true,
        currentWindow: true
      });

      // Load from storage
      const result = await browser.storage.local.get('settings');
      setData(result.settings);
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  }

  async function handleSave(newSettings: any) {
    await browser.storage.local.set({ settings: newSettings });
    setData(newSettings);
  }

  if (loading) {
    return <div className="loading">Loading...</div>;
  }

  return (
    <div className="app">
      <h1>My Extension</h1>
      <div className="content">
        {/* Your UI here */}
      </div>
    </div>
  );
}
```

### Options Page with React

**entrypoints/options/index.html:**
```html
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Extension Options</title>
</head>
<body>
  <div id="root"></div>
  <script type="module" src="./main.tsx"></script>
</body>
</html>
```

**entrypoints/options/App.tsx:**
```typescript
import { useState, useEffect } from 'react';

export default function Options() {
  const [settings, setSettings] = useState({
    theme: 'light',
    notifications: true,
    apiKey: '',
  });

  useEffect(() => {
    // Load settings
    browser.storage.sync.get('settings').then((result) => {
      if (result.settings) {
        setSettings(result.settings);
      }
    });
  }, []);

  async function handleSave() {
    await browser.storage.sync.set({ settings });

    // Show success notification
    await browser.notifications.create({
      type: 'basic',
      title: 'Settings Saved',
      message: 'Your settings have been saved successfully',
      iconUrl: '/icon/128.png',
    });
  }

  return (
    <div className="options-page">
      <h1>Extension Settings</h1>

      <section>
        <label>
          Theme:
          <select
            value={settings.theme}
            onChange={(e) => setSettings({ ...settings, theme: e.target.value })}
          >
            <option value="light">Light</option>
            <option value="dark">Dark</option>
          </select>
        </label>
      </section>

      <section>
        <label>
          <input
            type="checkbox"
            checked={settings.notifications}
            onChange={(e) => setSettings({ ...settings, notifications: e.target.checked })}
          />
          Enable Notifications
        </label>
      </section>

      <section>
        <label>
          API Key:
          <input
            type="password"
            value={settings.apiKey}
            onChange={(e) => setSettings({ ...settings, apiKey: e.target.value })}
            placeholder="Enter your API key"
          />
        </label>
      </section>

      <button onClick={handleSave}>Save Settings</button>
    </div>
  );
}
```

### Content Script with React UI

**entrypoints/content.ts:**
```typescript
import ReactDOM from 'react-dom/client';
import { ContentScriptApp } from './ContentScriptApp';

export default defineContentScript({
  matches: ['*://*.example.com/*'],
  cssInjectionMode: 'ui',

  async main(ctx) {
    // Create shadow root UI
    const ui = await createShadowRootUi(ctx, {
      name: 'my-extension-overlay',
      position: 'overlay',
      anchor: 'body',

      onMount: (container) => {
        // Mount React app in shadow DOM
        const root = ReactDOM.createRoot(container);
        root.render(<ContentScriptApp />);

        return root;
      },

      onRemove: (root) => {
        // Cleanup
        root?.unmount();
      },
    });

    // Mount UI
    ui.mount();
  },
});
```

**entrypoints/ContentScriptApp.tsx:**
```typescript
import { useState } from 'react';
import './content.css';

export function ContentScriptApp() {
  const [visible, setVisible] = useState(false);

  return (
    <div className="extension-overlay">
      <button
        className="toggle-button"
        onClick={() => setVisible(!visible)}
      >
        Toggle Panel
      </button>

      {visible && (
        <div className="extension-panel">
          <h2>Extension Panel</h2>
          <p>This is injected into the page!</p>
        </div>
      )}
    </div>
  );
}
```

## React Hooks for Extensions

### useStorage Hook

```typescript
// hooks/useStorage.ts
import { useState, useEffect } from 'react';

export function useStorage<T>(key: string, defaultValue: T) {
  const [value, setValue] = useState<T>(defaultValue);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Load initial value
    browser.storage.local.get(key).then((result) => {
      if (result[key] !== undefined) {
        setValue(result[key]);
      }
      setLoading(false);
    });

    // Listen for changes
    const listener = (changes: any, area: string) => {
      if (area === 'local' && changes[key]) {
        setValue(changes[key].newValue);
      }
    };

    browser.storage.onChanged.addListener(listener);

    return () => {
      browser.storage.onChanged.removeListener(listener);
    };
  }, [key]);

  const updateValue = async (newValue: T) => {
    await browser.storage.local.set({ [key]: newValue });
    setValue(newValue);
  };

  return [value, updateValue, loading] as const;
}

// Usage
function MyComponent() {
  const [theme, setTheme, loading] = useStorage('theme', 'light');

  if (loading) return <div>Loading...</div>;

  return (
    <button onClick={() => setTheme(theme === 'light' ? 'dark' : 'light')}>
      Current theme: {theme}
    </button>
  );
}
```

### useMessage Hook

```typescript
// hooks/useMessage.ts
import { useEffect, useCallback } from 'react';

type MessageHandler<T = any> = (
  message: T,
  sender: browser.Runtime.MessageSender
) => any | Promise<any>;

export function useMessage<T = any>(
  type: string,
  handler: MessageHandler<T>
) {
  useEffect(() => {
    const listener = (
      message: any,
      sender: browser.Runtime.MessageSender,
      sendResponse: (response?: any) => void
    ) => {
      if (message.type === type) {
        Promise.resolve(handler(message.payload, sender))
          .then(sendResponse)
          .catch((error) => {
            console.error(`Error handling message ${type}:`, error);
            sendResponse({ error: error.message });
          });
        return true; // Keep channel open
      }
    };

    browser.runtime.onMessage.addListener(listener);

    return () => {
      browser.runtime.onMessage.removeListener(listener);
    };
  }, [type, handler]);
}

// Usage
function MyComponent() {
  useMessage('get-data', async (payload, sender) => {
    console.log('Message from:', sender.tab?.url);
    return { data: 'some data' };
  });

  return <div>Component listening for messages</div>;
}
```

### useTabs Hook

```typescript
// hooks/useTabs.ts
import { useState, useEffect } from 'react';

export function useTabs() {
  const [tabs, setTabs] = useState<browser.Tabs.Tab[]>([]);

  useEffect(() => {
    // Load initial tabs
    browser.tabs.query({}).then(setTabs);

    // Listen for tab changes
    const onCreated = (tab: browser.Tabs.Tab) => {
      setTabs((prev) => [...prev, tab]);
    };

    const onRemoved = (tabId: number) => {
      setTabs((prev) => prev.filter((t) => t.id !== tabId));
    };

    const onUpdated = (tabId: number, changeInfo: any, tab: browser.Tabs.Tab) => {
      setTabs((prev) =>
        prev.map((t) => (t.id === tabId ? tab : t))
      );
    };

    browser.tabs.onCreated.addListener(onCreated);
    browser.tabs.onRemoved.addListener(onRemoved);
    browser.tabs.onUpdated.addListener(onUpdated);

    return () => {
      browser.tabs.onCreated.removeListener(onCreated);
      browser.tabs.onRemoved.removeListener(onRemoved);
      browser.tabs.onUpdated.removeListener(onUpdated);
    };
  }, []);

  return tabs;
}

// Usage
function TabList() {
  const tabs = useTabs();

  return (
    <ul>
      {tabs.map((tab) => (
        <li key={tab.id}>
          {tab.title} - {tab.url}
        </li>
      ))}
    </ul>
  );
}
```

## State Management

### Context API for Extension State

```typescript
// contexts/ExtensionContext.tsx
import { createContext, useContext, useEffect, useState } from 'react';

interface ExtensionState {
  settings: any;
  user: any;
  updateSettings: (settings: any) => Promise<void>;
}

const ExtensionContext = createContext<ExtensionState | null>(null);

export function ExtensionProvider({ children }: { children: React.ReactNode }) {
  const [settings, setSettings] = useState({});
  const [user, setUser] = useState(null);

  useEffect(() => {
    // Load initial state
    browser.storage.local.get(['settings', 'user']).then((result) => {
      setSettings(result.settings || {});
      setUser(result.user || null);
    });

    // Listen for storage changes
    const listener = (changes: any) => {
      if (changes.settings) {
        setSettings(changes.settings.newValue);
      }
      if (changes.user) {
        setUser(changes.user.newValue);
      }
    };

    browser.storage.onChanged.addListener(listener);

    return () => {
      browser.storage.onChanged.removeListener(listener);
    };
  }, []);

  const updateSettings = async (newSettings: any) => {
    await browser.storage.local.set({ settings: newSettings });
    setSettings(newSettings);
  };

  return (
    <ExtensionContext.Provider value={{ settings, user, updateSettings }}>
      {children}
    </ExtensionContext.Provider>
  );
}

export function useExtension() {
  const context = useContext(ExtensionContext);
  if (!context) {
    throw new Error('useExtension must be used within ExtensionProvider');
  }
  return context;
}

// Usage in App
function App() {
  return (
    <ExtensionProvider>
      <YourComponents />
    </ExtensionProvider>
  );
}
```

### Zustand for Extension State

```typescript
// store/useStore.ts
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface ExtensionStore {
  theme: 'light' | 'dark';
  notifications: boolean;
  apiKey: string;
  setTheme: (theme: 'light' | 'dark') => void;
  setNotifications: (enabled: boolean) => void;
  setApiKey: (key: string) => void;
}

export const useStore = create<ExtensionStore>()(
  persist(
    (set) => ({
      theme: 'light',
      notifications: true,
      apiKey: '',

      setTheme: (theme) => set({ theme }),
      setNotifications: (notifications) => set({ notifications }),
      setApiKey: (apiKey) => set({ apiKey }),
    }),
    {
      name: 'extension-storage',
      getStorage: () => ({
        getItem: async (name) => {
          const result = await browser.storage.local.get(name);
          return result[name] || null;
        },
        setItem: async (name, value) => {
          await browser.storage.local.set({ [name]: value });
        },
        removeItem: async (name) => {
          await browser.storage.local.remove(name);
        },
      }),
    }
  )
);

// Usage
function SettingsComponent() {
  const { theme, setTheme } = useStore();

  return (
    <button onClick={() => setTheme(theme === 'light' ? 'dark' : 'light')}>
      Toggle Theme (current: {theme})
    </button>
  );
}
```

## Styling

### Popular UI Libraries (2025)

Modern Chrome extensions commonly use these UI libraries with React:

#### shadcn/ui
Most popular choice for Chrome extensions in 2025.

```bash
npx shadcn@latest init
npx shadcn@latest add button card dialog
```

**Benefits:**
- Tailwind CSS-based components
- Full customization and ownership of code
- Copy-paste philosophy - components live in your codebase
- Excellent TypeScript support
- Works seamlessly with WXT

**Example Setup:**
```typescript
// components/ui/button.tsx (generated by shadcn)
import * as React from "react"
import { cn } from "@/lib/utils"

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, ...props }, ref) => {
    return (
      <button
        className={cn(
          "inline-flex items-center justify-center rounded-md px-4 py-2",
          className
        )}
        ref={ref}
        {...props}
      />
    )
  }
)
```

**Popular Template:** https://github.com/imtiger/wxt-react-shadcn-tailwindcss-chrome-extension

#### Mantine UI
Complete component library with 100+ components.

```bash
npm install @mantine/core @mantine/hooks
npm install -D postcss-preset-mantine postcss-simple-vars
```

**Benefits:**
- Rich component ecosystem (100+ components)
- Built-in dark mode support
- Comprehensive form management with @mantine/form
- Accessible by default
- Excellent documentation

**Example Setup:**
```typescript
// entrypoints/popup/main.tsx
import { MantineProvider } from '@mantine/core';
import '@mantine/core/styles.css';

function App() {
  return (
    <MantineProvider>
      <YourApp />
    </MantineProvider>
  );
}
```

**Popular Template:** https://github.com/ongkay/WXT-Mantine-Tailwind-Browser-Extension

#### Tailwind CSS (Utility-First)
Most flexible option for custom designs.

```bash
npm install -D tailwindcss postcss autoprefixer
npx tailwindcss init -p
```

**Benefits:**
- Maximum design flexibility
- Small bundle size with purging
- No additional component library needed
- Works with shadcn/ui for pre-built components

### Tailwind CSS Setup

```bash
npm install -D tailwindcss postcss autoprefixer
npx tailwindcss init -p
```

**tailwind.config.js:**
```javascript
export default {
  content: [
    './entrypoints/**/*.{html,tsx}',
    './components/**/*.tsx',
  ],
  theme: {
    extend: {},
  },
  plugins: [],
};
```

**entrypoints/popup/style.css:**
```css
@tailwind base;
@tailwind components;
@tailwind utilities;

/* Extension-specific styles */
.popup-container {
  @apply w-96 h-[500px] p-4;
}
```

### CSS Modules

WXT supports CSS Modules automatically:

**Button.module.css:**
```css
.button {
  padding: 8px 16px;
  background: blue;
  color: white;
  border: none;
  border-radius: 4px;
}

.button:hover {
  background: darkblue;
}
```

**Button.tsx:**
```typescript
import styles from './Button.module.css';

export function Button({ children, onClick }: any) {
  return (
    <button className={styles.button} onClick={onClick}>
      {children}
    </button>
  );
}
```

### Styled Components

```bash
npm install styled-components
npm install -D @types/styled-components
```

```typescript
import styled from 'styled-components';

const Button = styled.button`
  padding: 8px 16px;
  background: ${(props) => props.theme.primary};
  color: white;
  border: none;
  border-radius: 4px;

  &:hover {
    opacity: 0.8;
  }
`;

export function MyComponent() {
  return <Button>Click me</Button>;
}
```

## Performance Optimization

### Code Splitting

```typescript
// Lazy load heavy components
import { lazy, Suspense } from 'react';

const HeavyComponent = lazy(() => import('./HeavyComponent'));

function App() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <HeavyComponent />
    </Suspense>
  );
}
```

### React.memo for Expensive Components

```typescript
import { memo } from 'react';

const ExpensiveComponent = memo(({ data }: { data: any }) => {
  // Expensive rendering logic
  return <div>{/* rendered content */}</div>;
});
```

### useMemo and useCallback

```typescript
import { useMemo, useCallback } from 'react';

function DataTable({ data }: { data: any[] }) {
  // Memoize expensive calculations
  const sortedData = useMemo(() => {
    return data.sort((a, b) => a.value - b.value);
  }, [data]);

  // Memoize callbacks
  const handleClick = useCallback((id: number) => {
    console.log('Clicked:', id);
  }, []);

  return (
    <table>
      {sortedData.map((item) => (
        <tr key={item.id} onClick={() => handleClick(item.id)}>
          <td>{item.name}</td>
        </tr>
      ))}
    </table>
  );
}
```

## Common Patterns

### Loading States

```typescript
function DataLoader() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    fetchData()
      .then(setData)
      .catch(setError)
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <LoadingSpinner />;
  if (error) return <ErrorMessage error={error} />;
  if (!data) return <EmptyState />;

  return <DataDisplay data={data} />;
}
```

### Form Handling

```typescript
import { useState, FormEvent } from 'react';

function SettingsForm() {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    notifications: true,
  });

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();

    try {
      await browser.storage.sync.set({ settings: formData });
      console.log('Settings saved');
    } catch (error) {
      console.error('Failed to save:', error);
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      <input
        type="text"
        value={formData.name}
        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
      />
      <input
        type="email"
        value={formData.email}
        onChange={(e) => setFormData({ ...formData, email: e.target.value })}
      />
      <label>
        <input
          type="checkbox"
          checked={formData.notifications}
          onChange={(e) => setFormData({ ...formData, notifications: e.target.checked })}
        />
        Enable Notifications
      </label>
      <button type="submit">Save</button>
    </form>
  );
}
```

### Modal/Dialog Patterns

```typescript
function ConfirmDialog({ isOpen, onConfirm, onCancel }: any) {
  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={onCancel}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <h2>Are you sure?</h2>
        <div className="modal-actions">
          <button onClick={onConfirm}>Confirm</button>
          <button onClick={onCancel}>Cancel</button>
        </div>
      </div>
    </div>
  );
}
```

## Testing React Extensions

### Component Testing with Vitest

```typescript
// Button.test.tsx
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { Button } from './Button';

describe('Button', () => {
  it('renders children', () => {
    render(<Button>Click me</Button>);
    expect(screen.getByText('Click me')).toBeInTheDocument();
  });

  it('calls onClick when clicked', () => {
    const handleClick = vi.fn();
    render(<Button onClick={handleClick}>Click me</Button>);

    fireEvent.click(screen.getByText('Click me'));
    expect(handleClick).toHaveBeenCalledTimes(1);
  });
});
```

## Common Issues & Solutions

### Issue: React DevTools not working

**Solution:** Add to manifest:
```typescript
manifest: {
  content_security_policy: {
    extension_pages: "script-src 'self' 'unsafe-eval'; object-src 'self'",
  },
}
```

### Issue: Hot reload breaks React state

**Solution:** Use React Fast Refresh properly:
```typescript
// In components, ensure proper export
export default function MyComponent() {
  // Component logic
}
```

### Issue: Storage not syncing between components

**Solution:** Use storage change listeners:
```typescript
useEffect(() => {
  const listener = (changes: any) => {
    if (changes.key) {
      setState(changes.key.newValue);
    }
  };

  browser.storage.onChanged.addListener(listener);
  return () => browser.storage.onChanged.removeListener(listener);
}, []);
```
