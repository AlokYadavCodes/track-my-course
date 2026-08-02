/**
 * Manages the lifecycle of a content script page session.
 *
 * Handles two concerns:
 * 1. **AbortController** for cancelling async DOM operations on navigation.
 * 2. **Cleanup functions** registered by UI modules, run automatically on teardown.
 *
 * Three operations:
 * - `start()`:   Full teardown (abort + cleanup) then new signal. Use for full page transitions.
 * - `restart()`: Abort only (no cleanup) then new signal. Use for partial updates where UI stays.
 * - `teardown()`: Full teardown, no new signal. Use when leaving a managed page entirely.
 *
 * @example
 * ```ts
 * // Full page transition
 * const signal = lifecycle.start();
 * await updateWatchPage(signal);
 *
 * // UI module registers its own cleanup
 * lifecycle.onCleanup(() => removeProgressBar());
 *
 * // Partial update (e.g., same playlist, different video)
 * const newSignal = lifecycle.restart(); // UI stays, async work cancelled
 * await renderCheckboxes(newSignal);
 *
 * // Navigating away
 * lifecycle.teardown(); // runs all cleanups, aborts signal
 * ```
 */
export class PageLifecycle {
  private controller: AbortController | null = null;
  private cleanupFns: (() => void)[] = [];

  /**
   * Full teardown + start fresh.
   * Aborts the previous signal, runs all cleanup functions, then creates a new signal.
   */
  start(): AbortSignal {
    this.teardown();
    this.controller = new AbortController();
    return this.controller.signal;
  }

  /**
   * Abort only + new signal. Does NOT run cleanup functions.
   * Use for partial updates where existing UI should stay but
   * in-flight async operations should be cancelled.
   */
  restart(): AbortSignal {
    this.controller?.abort();
    this.controller = new AbortController();
    return this.controller.signal;
  }

  /**
   * Full teardown: abort signal + run all registered cleanup functions.
   * Does not create a new signal.
   */
  teardown(): void {
    this.controller?.abort();
    this.controller = null;
    for (const fn of this.cleanupFns) {
      try {
        fn();
      } catch {
        // Never crash during cleanup
      }
    }
    this.cleanupFns = [];
  }

  /**
   * Register a cleanup function. It will be called on `start()` or `teardown()`,
   * but NOT on `restart()`.
   *
   * Each UI module should register its own cleanup here instead of
   * relying on a centralized cleanup function.
   */
  onCleanup(fn: () => void): void {
    this.cleanupFns.push(fn);
  }

  /** The current AbortSignal, or null if no lifecycle is active. */
  get signal(): AbortSignal | null {
    return this.controller?.signal ?? null;
  }
}

/** Singleton instance used by the content script */
export const lifecycle = new PageLifecycle();
