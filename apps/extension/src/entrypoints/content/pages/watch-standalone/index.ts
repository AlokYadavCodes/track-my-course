import { renderVideoCourseMatches } from "../../ui/video-course-panel";
import { renderVideoWatchedButton } from "../../ui/watched-button";

export async function updateWatchStandalonePage(
  signal: AbortSignal
): Promise<void> {
  await renderVideoCourseMatches({ signal });
  await renderVideoWatchedButton({ signal });
}
