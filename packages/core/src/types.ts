// --- Duration ---

/**
 * Represents a time duration broken into hours, minutes, and seconds.
 */
export interface Duration {
  hours: number;
  minutes: number;
  seconds: number;
}

// --- Course Data ---

/**
 * Complete data for a single tracked course (YouTube playlist).
 * This is the shape stored in chrome.storage.local per playlist ID.
 */
export interface CourseData {
  /** Map of videoId → watched status */
  videoWatchStatus: Record<string, boolean>;
  /** Total duration of all videos in the playlist */
  totalDuration: Duration;
  /** Sum of durations of all watched videos */
  watchedDuration: Duration;
  /** Time the user has spent actively watching this course */
  investedTime: Duration;
  /** Base64-encoded thumbnail image */
  courseImgSrc: string | null;
  /** Name of the course/playlist */
  courseName: string | null;
  /** ID of the last video the user watched */
  lastWatchedVideoId: string | null;
  /** Timestamp (Date.now()) of the last interaction */
  lastInteractedAt: number | null;
}

/**
 * CourseData enriched with its playlist ID; used when rendering lists.
 */
export interface CourseEntry extends CourseData {
  id: string;
}

/**
 * A course that contains a specific video, with its watched status.
 */
export interface MatchedCourse {
  playlistId: string;
  courseName: string | null;
  isWatched: boolean;
}

// --- Storage ---

/**
 * Shape of the full storage data.
 * Keys are either playlist IDs (containing CourseData) or preference keys.
 */
export type StorageData = Record<string, unknown>;

/**
 * Export/import data envelope.
 */
export interface ExportData {
  version: number;
  exportedAt: string;
  data: StorageData;
}

export interface ImportResult {
  importedCount: number;
  skippedCount: number;
}

// --- Messaging ---

/**
 * Messages sent from background script to content script.
 */
export type BackgroundMessage =
  | { action: "updateWatchPage"; playlistId: string | null }
  | { action: "updatePlaylistPage"; playlistId: string }
  | { action: "updateHomePage" }
  | { action: "someOtherPage" };

// --- Enums ---

export const PageType = {
  WATCH: "watch",
  PLAYLIST: "playlist",
  HOME: "home",
} as const;

export type PageType = (typeof PageType)[keyof typeof PageType];

export const PlaylistLayout = {
  /** Other's channel playlists: uses yt-lockup-view-model */
  LOCKUP: "lockup",
  /** Own/user-created playlists: uses ytd-playlist-video-renderer */
  RENDERER: "renderer",
} as const;

export type PlaylistLayout =
  (typeof PlaylistLayout)[keyof typeof PlaylistLayout];
