// Runs before paint (loaded in <head>) to avoid a flash of the wrong theme.
(function () {
  try {
    const saved = localStorage.getItem("theme");
    const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    const isDark = saved ? saved === "dark" : prefersDark;
    document.documentElement.classList.toggle("dark", isDark);
  } catch (e) {
    // localStorage may be unavailable (private mode, etc.) - default to light.
  }
})();
