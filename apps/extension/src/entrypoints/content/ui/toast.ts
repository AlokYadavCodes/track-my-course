const DEFAULT_TOAST_DURATION_MS = 3500;

export function showToast(
  message: string,
  duration = DEFAULT_TOAST_DURATION_MS
): void {
  const existingToast = document.querySelector(".tmc-toast");
  existingToast?.remove();

  const toast = document.createElement("div");
  toast.className = "tmc-toast";
  toast.textContent = message;
  document.body.append(toast);

  window.setTimeout(() => {
    toast.style.animation = "tmc-slide-out 0.2s forwards";
    toast.addEventListener("animationend", () => toast.remove(), {
      once: true
    });
  }, duration);
}
