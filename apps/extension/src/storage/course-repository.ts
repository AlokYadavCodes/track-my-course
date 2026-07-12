import type {
  CourseData,
  CourseEntry,
  MatchedCourse,
  ExportData,
  ImportResult,
  StorageData,
} from "@repo/core/types";
import { PREFERENCE_KEYS, EXPORT_VERSION } from "@repo/core/constants";
import type { StorageAdapter } from "./storage";
import { storage as defaultStorage } from "./storage";

// --- Change Event Types ---

export type StorageChangeEvent =
  | {
      type: "course";
      playlistId: string;
      oldValue: CourseData | undefined;
      newValue: CourseData | undefined;
    }
  | {
      type: "focusMode";
      value: boolean;
    };

// --- Course Repository ---

/**
 * Domain-level storage operations for courses and preferences.
 *
 * This is the ONLY place that knows how data is stored.
 * All consumers (content script, popup, services) go through here.
 *
 * Accepts a {@link StorageAdapter} via constructor injection; defaults to
 * chrome.storage.local but can be swapped for an API-backed adapter later.
 */
export class CourseRepository {
  private storage: StorageAdapter;

  constructor(storage: StorageAdapter = defaultStorage) {
    this.storage = storage;
  }

  // --- Course CRUD ---

  async getCourse(playlistId: string): Promise<CourseData | null> {
    const data = await this.storage.get(playlistId);
    return (data[playlistId] as CourseData) ?? null;
  }

  async getAllCourses(): Promise<CourseEntry[]> {
    const data = await this.storage.get(null);
    return Object.entries(data)
      .filter(([key]) => !PREFERENCE_KEYS.has(key))
      .map(([key, value]) => ({ ...(value as CourseData), id: key }));
  }

  async saveCourse(playlistId: string, data: CourseData): Promise<void> {
    await this.storage.set({ [playlistId]: data });
  }

  /**
   * Save multiple courses in a single storage write.
   * This is important for atomicity: e.g. when syncing a video's
   * watched status across multiple courses, all updates fire as
   * one `onChanged` event.
   */
  async saveManyCourses(courses: Record<string, CourseData>): Promise<void> {
    await this.storage.set(courses);
  }

  async deleteCourse(playlistId: string): Promise<void> {
    await this.storage.remove(playlistId);
  }

  async isTracked(playlistId: string): Promise<boolean> {
    if (!playlistId) return false;
    const data = await this.storage.get(playlistId);
    return Boolean(data[playlistId]);
  }

  // --- Cross-course Queries ---

  /**
   * Finds all tracked courses that contain a specific video.
   * Used to show "Included in these courses" panel and for cross-course sync.
   */
  async getCoursesContainingVideo(
    videoId: string,
  ): Promise<MatchedCourse[]> {
    if (!videoId) return [];

    const data = await this.storage.get(null);
    const matches: MatchedCourse[] = [];

    for (const [key, value] of Object.entries(data)) {
      if (PREFERENCE_KEYS.has(key)) continue;
      const course = value as CourseData;

      if (
        course.videoWatchStatus &&
        Object.prototype.hasOwnProperty.call(course.videoWatchStatus, videoId)
      ) {
        matches.push({
          playlistId: key,
          courseName: course.courseName,
          isWatched: course.videoWatchStatus[videoId] ?? false,
        });
      }
    }

    return matches;
  }

  // --- Preferences ---

  async getFocusMode(): Promise<boolean> {
    const data = await this.storage.get("focusMode");
    return (data.focusMode as boolean) ?? false;
  }

  async setFocusMode(enabled: boolean): Promise<void> {
    await this.storage.set({ focusMode: enabled });
  }

  // --- Export / Import ---

  async exportAll(): Promise<ExportData> {
    const data = await this.storage.get(null);
    return {
      version: EXPORT_VERSION,
      exportedAt: new Date().toISOString(),
      data,
    };
  }

  /**
   * Imports courses from exported data.
   * Only imports courses that don't already exist (no overwrites).
   * Imports focusMode preference only if not already set locally.
   */
  async importCourses(importData: StorageData): Promise<ImportResult> {
    const existingData = await this.storage.get(null);

    const importEntries = Object.entries(importData).filter(
      ([key]) => !PREFERENCE_KEYS.has(key),
    );

    let importedCount = 0;
    let skippedCount = 0;
    const dataToSave: Record<string, unknown> = {};

    for (const [key, value] of importEntries) {
      if (existingData[key]) {
        skippedCount++;
      } else {
        dataToSave[key] = value;
        importedCount++;
      }
    }

    // Import focusMode if user doesn't have it set yet
    if (
      importData["focusMode"] !== undefined &&
      existingData["focusMode"] === undefined
    ) {
      dataToSave["focusMode"] = importData["focusMode"];
    }

    if (importedCount > 0) {
      await this.storage.set(dataToSave);
    }

    return { importedCount, skippedCount };
  }

  // --- Change Listening ---

  /**
   * Subscribe to typed storage change events.
   * Raw chrome.storage changes are parsed into discriminated union events:
   * - `{ type: "course" }` : a course was created, updated, or deleted
   * - `{ type: "focusMode" }` : focus mode preference changed
   *
   * @returns An unsubscribe function.
   */
  onChanged(callback: (changes: StorageChangeEvent[]) => void): () => void {
    return this.storage.onChanged((rawChanges) => {
      const events: StorageChangeEvent[] = [];

      for (const [key, change] of Object.entries(rawChanges)) {
        if (key === "focusMode") {
          events.push({
            type: "focusMode",
            value: (change.newValue as boolean) ?? false,
          });
        } else if (!PREFERENCE_KEYS.has(key)) {
          events.push({
            type: "course",
            playlistId: key,
            oldValue: change.oldValue as CourseData | undefined,
            newValue: change.newValue as CourseData | undefined,
          });
        }
      }

      if (events.length > 0) {
        callback(events);
      }
    });
  }
}

/** Singleton instance with default chrome.storage.local adapter */
export const courseRepository = new CourseRepository();
