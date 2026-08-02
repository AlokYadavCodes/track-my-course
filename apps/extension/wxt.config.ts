import { defineConfig } from "wxt";

// See https://wxt.dev/api/config.html
export default defineConfig({
  modules: ["@wxt-dev/module-react"],
  imports: {
    eslintrc: {
      enabled: 9
    }
  },
  srcDir: "src",
  manifest: {
    name: "TrackMyCourse: YouTube Playlist Progress Tracker",
    description:
      "Turn YouTube playlists into courses. Track with checkmarks, progress bar, total and watched duration, and completion percentage.",
    permissions: ["storage", "downloads"],
    host_permissions: ["https://www.youtube.com/*"]
  }
});
