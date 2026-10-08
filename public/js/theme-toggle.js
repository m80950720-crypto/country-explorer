// Wires up the navbar dark/light toggle button on both pages.
(function () {
  const btn = document.getElementById("themeToggle");
  if (!btn) return;

  const sunIcon = document.getElementById("iconSun");
  const moonIcon = document.getElementById("iconMoon");

  function render() {
    const isDark = document.documentElement.classList.contains("dark");
    if (sunIcon && moonIcon) {
      sunIcon.classList.toggle("hidden", !isDark);
      moonIcon.classList.toggle("hidden", isDark);
    }
  }

  btn.addEventListener("click", () => {
    const isDark = document.documentElement.classList.toggle("dark");
    localStorage.setItem("theme", isDark ? "dark" : "light");
    render();
  });

  render();
})();
