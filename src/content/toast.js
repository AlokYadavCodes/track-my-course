function showToast(message, duration = 3500) {
    const toast = document.createElement("div");
    toast.className = "tmc-toast";
    toast.textContent = message;
    document.body.append(toast);

    setTimeout(() => {
        toast.style.animation = "slideOut 0.2s forwards";
        toast.addEventListener("animationend", () => {
            toast.remove();
        });
    }, duration);
}
