import { PlaylistLayout } from "@repo/core/types";

import { createAbortError, waitForElement } from "../../../core/dom-utils";
import { getPlaylistContentSelectors } from "../../../core/selectors";
import { state } from "../../../core/state";

export async function renderPlaylistScanning({
  signal,
  scannedCount = 0
}: {
  signal: AbortSignal;
  scannedCount?: number;
}): Promise<void> {
  if (signal.aborted) throw createAbortError();
  if (document.querySelector(".tmc-scanning-playlist")) return;

  const selectors = getPlaylistContentSelectors(
    state.playlistLayout ?? PlaylistLayout.LOCKUP
  );
  const contentDiv = await waitForElement({
    selector: selectors.contentDiv,
    signal
  });
  contentDiv.setAttribute(
    "style",
    `${contentDiv.getAttribute("style") ?? ""}; position: relative;`
  );

  const scanningPlaylistEl = document.createElement("div");
  scanningPlaylistEl.className = "tmc-scanning-playlist";

  const scanningTextEl = document.createElement("div");
  scanningTextEl.className = "tmc-scanning-text";
  scanningTextEl.innerHTML = `Scanning Playlist..<p><span id="scanned-videos-count">${scannedCount}</span> videos scanned</p>`;

  contentDiv.append(scanningPlaylistEl, scanningTextEl);
  updateScanningTextLeft(scanningPlaylistEl, scanningTextEl);

  document.querySelector(".tmc-refresh-svg")?.classList.add("scanning");

  const resizeObserver = new ResizeObserver(() => {
    updateScanningTextLeft(scanningPlaylistEl, scanningTextEl);
  });
  resizeObserver.observe(scanningPlaylistEl);
  signal.addEventListener(
    "abort",
    () => {
      resizeObserver.disconnect();
      removePlaylistScanning();
    },
    { once: true }
  );
}

export function updatePlaylistScanningCount(scannedCount: number): void {
  const count = document.getElementById("scanned-videos-count");
  if (count) count.textContent = scannedCount.toString();
}

export function removePlaylistScanning(): void {
  document.querySelector(".tmc-scanning-playlist")?.remove();
  document.querySelector(".tmc-scanning-text")?.remove();
  document.querySelector(".tmc-refresh-svg")?.classList.remove("scanning");
}

function updateScanningTextLeft(overlay: Element, text: HTMLElement): void {
  const rect = overlay.getBoundingClientRect();
  text.style.left = `${rect.left + rect.width / 2}px`;
}
