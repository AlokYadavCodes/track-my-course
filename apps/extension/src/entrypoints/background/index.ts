export default defineBackground(() => {
  // --- Export Download Relay ---

  /**
   * Handles export download requests from the popup.
   * The popup can't reliably trigger downloads itself (closes on focus loss),
   * so it sends the JSON data here and we use the downloads API.
   */
  browser.runtime.onMessage.addListener(
    (message: { type: string; json: string; filename: string }) => {
      if (message.type !== "exportData") return;

      let url: string;
      if (typeof URL.createObjectURL === "function") {
        // Firefox: background runs in a hidden page with DOM access,
        // and blocks data: URI downloads. Use blob URLs instead.
        const blob = new Blob([message.json], { type: "application/json" });
        url = URL.createObjectURL(blob);
      } else {
        // Chrome: service worker has no DOM, use data URL
        url =
          "data:application/json;charset=utf-8," +
          encodeURIComponent(message.json);
      }

      browser.downloads.download({
        url,
        filename: message.filename,
        saveAs: true
      });
    }
  );
});
