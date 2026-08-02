import { initializeRouter } from "./page-router";

import "./styles/content.css";

export default defineContentScript({
  matches: ["*://*.youtube.com/*"],
  main(ctx) {
    initializeRouter(ctx);
  }
});
