/**
 * Extracts the playlist ID ("list" query param) from a YouTube URL.
 *
 * @returns The playlist ID, or `null` if not present.
 */
export function getPlaylistId(url: string): string | null {
  try {
    const urlObj = new URL(url);
    return urlObj.searchParams.get("list");
  } catch {
    return null;
  }
}

/**
 * Extracts the video ID ("v" query param) from a YouTube URL.
 *
 * @returns The video ID, or `null` if not present.
 */
export function getVideoId(url: string): string | null {
  try {
    const urlObj = new URL(url);
    return urlObj.searchParams.get("v");
  } catch {
    return null;
  }
}

/**
 * Builds the best URL to navigate to for a given course.
 * If the user has a last-watched video, links to the video within the playlist.
 * Otherwise, links to the playlist page.
 */
export function getCourseHref(course: {
  id: string;
  lastWatchedVideoId: string | null;
}): string {
  return course.lastWatchedVideoId
    ? `https://www.youtube.com/watch?v=${course.lastWatchedVideoId}&list=${course.id}`
    : `https://www.youtube.com/playlist?list=${course.id}`;
}
