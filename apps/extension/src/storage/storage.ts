import { browser } from "wxt/browser";

// --- Types ---

export interface StorageChangeInfo {
  oldValue?: unknown;
  newValue?: unknown;
}

export type StorageChangeCallback = (
  changes: Record<string, StorageChangeInfo>
) => void;

/**
 * Low-level storage adapter interface.
 *
 * Currently backed by chrome.storage.local.
 * When adding a database/API backend later, create a new class
 * implementing this interface; all consumers stay untouched.
 */
export interface StorageAdapter {
  /** Retrieve values by key(s). Pass `null` to get everything. */
  get(keys: string | string[] | null): Promise<Record<string, unknown>>;

  /** Set one or more key-value pairs. */
  set(data: Record<string, unknown>): Promise<void>;

  /** Remove one or more keys. */
  remove(key: string | string[]): Promise<void>;

  /**
   * Subscribe to storage changes.
   * @returns An unsubscribe function.
   */
  onChanged(callback: StorageChangeCallback): () => void;
}

// --- Implementation ---

class ChromeLocalStorageAdapter implements StorageAdapter {
  async get(keys: string | string[] | null): Promise<Record<string, unknown>> {
    try {
      return await browser.storage.local.get(keys);
    } catch {
      return {};
    }
  }

  async set(data: Record<string, unknown>): Promise<void> {
    await browser.storage.local.set(data);
  }

  async remove(key: string | string[]): Promise<void> {
    await browser.storage.local.remove(key);
  }

  onChanged(callback: StorageChangeCallback): () => void {
    const listener = (
      changes: Record<string, StorageChangeInfo>,
      areaName: string
    ) => {
      if (areaName !== "local") return;
      callback(changes);
    };

    browser.storage.onChanged.addListener(listener);
    return () => browser.storage.onChanged.removeListener(listener);
  }
}

/** Default storage adapter: wraps chrome.storage.local */
export const storage: StorageAdapter = new ChromeLocalStorageAdapter();
