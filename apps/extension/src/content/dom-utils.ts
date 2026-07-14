import { SELECTORS } from "./selectors";

/**
 * Creates an AbortError DOMException.
 * Thrown by async DOM utilities when their signal is aborted.
 */
export function createAbortError(): DOMException {
  return new DOMException("Aborted", "AbortError");
}

/**
 * Checks if an error is an AbortError.
 * Use in catch blocks to silently swallow cancellation errors.
 */
export function isAbortError(err: unknown): boolean {
  return err instanceof DOMException && err.name === "AbortError";
}

// --- Element Waiting ---

export interface WaitForElementOptions {
  /** CSS selector to watch for */
  selector: string;
  /** AbortSignal to cancel the wait */
  signal: AbortSignal;
  /** Parent element to observe (defaults to document.body) */
  parentEl?: Element;
}

/**
 * Returns a promise that resolves when an element matching the selector
 * appears in the DOM. Uses MutationObserver internally.
 *
 * Resolves immediately if the element already exists.
 * Rejects with AbortError if the signal is aborted.
 */
export function waitForElement({
  selector,
  signal,
  parentEl,
}: WaitForElementOptions): Promise<Element> {
  return new Promise((resolve, reject) => {
    if (signal.aborted) {
      reject(createAbortError());
      return;
    }

    const target = parentEl ?? document.body;
    const existing = target.querySelector(selector);
    if (existing) {
      resolve(existing);
      return;
    }

    const observer = new MutationObserver(() => {
      const el = target.querySelector(selector);
      if (el) {
        observer.disconnect();
        signal.removeEventListener("abort", onAbort);
        resolve(el);
      }
    });

    function onAbort() {
      observer.disconnect();
      reject(createAbortError());
    }

    signal.addEventListener("abort", onAbort, { once: true });

    observer.observe(target, {
      childList: true,
      subtree: true,
    });
  });
}

// --- Navigation ---

/**
 * Waits for YouTube's SPA navigation to complete.
 *
 * YouTube shows a progress bar at the top during navigation.
 * This waits for the bar to appear (navigation started) and then
 * disappear (navigation finished). Resolves immediately if no
 * progress bar is visible.
 */
export async function waitForNavigation(): Promise<void> {
  const progressBar = document.querySelector(
    SELECTORS.ytNavigationProgress,
  );
  if (!progressBar) return;

  return new Promise((resolve) => {
    const observer = new MutationObserver(() => {
      const bar = document.querySelector(
        SELECTORS.ytNavigationProgress,
      );
      if (!bar) {
        observer.disconnect();
        resolve();
      }
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true,
    });
  });
}

// --- Image Conversion ---

/**
 * Converts an image URL to a base64-encoded data URL.
 * Used to snapshot playlist thumbnails for offline display.
 *
 * Returns `null` if conversion fails (CORS, network error, etc).
 */
export async function imgSrcToBase64(
  imgSrc: string,
): Promise<string | null> {
  try {
    const response = await fetch(imgSrc);
    const blob = await response.blob();
    return await new Promise<string | null>((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}
