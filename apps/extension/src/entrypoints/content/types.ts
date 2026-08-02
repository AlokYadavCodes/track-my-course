/** Raw video data extracted from YouTube's playlist DOM. */
export interface ScannedVideo {
  videoId: string;
  durationSeconds: number;
}

/** Raw playlist metadata extracted from YouTube's DOM. */
export interface PlaylistMetadata {
  name: string | null;
  thumbnailSrc: string | null;
}
