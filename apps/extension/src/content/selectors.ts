import type { PlaylistLayout } from "@repo/core/types";
import { PlaylistLayout as PlaylistLayoutValue } from "@repo/core/types";

/**
 * All YouTube DOM selectors used by the content script, prefixed by page type.
 */
export const SELECTORS = {
  ytNavigationProgress: "yt-page-navigation-progress",
  videoDuration: ".ytBadgeShapeText",

  watchPage: {
    playlistItems: "#playlist:not([hidden]) #items",
    playlistMenu:
      "#playlist:not([hidden]) h3.ytd-playlist-panel-renderer:has(yt-formatted-string.title)",
    headerContents: "#playlist:not([hidden]) #header-contents",
    playlistActions: "#playlist:not([hidden]) #playlist-actions",
    recommendations: "#related",
    comments: "#comments",
  },

  playlistPage: {
    startCourseBtnWideScreenRefEl:
      "ytd-browse[page-subtype=playlist] > yt-page-header-renderer .ytPageHeaderViewModelHeadlineInfo:has(yt-description-preview-view-model)",
    startCourseBtnSmallScreenRefEl:
      "ytd-tabbed-page-header yt-flexible-actions-view-model",
    contentDiv: "ytd-browse #contents:has(yt-lockup-view-model)",
    playlistVideo: "yt-lockup-view-model",
    playlistVideoLink: ".ytLockupMetadataViewModelTitle",
    playlistVideoMenu: ".ytLockupMetadataViewModelMenuButton",
    playlistContinuation: "yt-continuation-item-view-model",

    // Own/user-created playlist selectors (renderer layout)
    ownPlaylist: {
      contentDiv:
        "ytd-browse #contents:has(>ytd-playlist-video-renderer)",
      playlistVideo: "ytd-playlist-video-renderer",
      playlistVideoLink: "#video-title",
      playlistVideoMenu: "#menu",
      playlistContinuation: "ytd-continuation-item-renderer",
    },

    progressDivWideScreenRefEl:
      "ytd-browse[page-subtype=playlist] > yt-page-header-renderer .ytPageHeaderViewModelHeadlineInfo:has(yt-description-preview-view-model)",
    progressDivSmallScreenRefEl:
      "ytd-tabbed-page-header yt-flexible-actions-view-model",
    courseTextEl: ".metadata-wrapper badge-shape",
    playlistTextEl: ".ytContentMetadataViewModelMetadataText",
    playlistNameEl:
      "ytd-browse[page-subtype=playlist] > yt-page-header-renderer .ytPageHeaderViewModelHeadlineInfo yt-dynamic-text-view-model h1 span",
    recommendations: "ytd-watch-next-secondary-results-renderer",

    ytCourse: {
      startCourseBtnWideScreenRefEl: ".play-menu.wide-screen-form",
      startCourseBtnSmallScreenRefEl: ".play-menu.small-screen-form",
      progressDivWideScreenRefEl:
        ".metadata-wrapper > .metadata-action-bar",
      progressDivSmallScreenRefEl:
        ".metadata-wrapper > .metadata-action-bar",
      playlistNameEl:
        ".metadata-wrapper > yt-dynamic-sizing-formatted-string #container yt-formatted-string",
    },
  },

  homePage: {
    homePage: "ytd-browse[page-subtype=home]",
  },
} as const;

/** The subset of selectors used for playlist content areas (videos, links, menus). */
export interface PlaylistContentSelectors {
  contentDiv: string;
  playlistVideo: string;
  playlistVideoLink: string;
  playlistVideoMenu: string;
  playlistContinuation: string;
}

/**
 * Returns the appropriate content-area selectors based on the detected playlist layout.
 * - LOCKUP: Other's channel playlists (yt-lockup-view-model)
 * - RENDERER: Own/user-created playlists (ytd-playlist-video-renderer)
 */
export function getPlaylistContentSelectors(
  layout: PlaylistLayout,
): PlaylistContentSelectors {
  if (layout === PlaylistLayoutValue.RENDERER) {
    return SELECTORS.playlistPage.ownPlaylist;
  }
  return {
    contentDiv: SELECTORS.playlistPage.contentDiv,
    playlistVideo: SELECTORS.playlistPage.playlistVideo,
    playlistVideoLink: SELECTORS.playlistPage.playlistVideoLink,
    playlistVideoMenu: SELECTORS.playlistPage.playlistVideoMenu,
    playlistContinuation: SELECTORS.playlistPage.playlistContinuation,
  };
}
