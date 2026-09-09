// Apply the system color preference before React hydrates.
(() => {
  const root = document.documentElement;
  if (root.dataset.theme !== "manual") {
    root.classList.toggle(
      "dark",
      window.matchMedia("(prefers-color-scheme: dark)").matches,
    );
    window.dispatchEvent(new Event("satslots-theme-change"));
  }
})();
