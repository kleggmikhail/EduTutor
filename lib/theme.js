// Цветовая гамма: light | dark | system

export function loadThemePref() {
  if (typeof window === "undefined") return "system";
  return localStorage.getItem("edututor_theme") || "system";
}

export function saveThemePref(pref) {
  localStorage.setItem("edututor_theme", pref);
  applyThemePref(pref);
}

export function applyThemePref(pref) {
  if (typeof window === "undefined") return;
  const dark =
    pref === "dark" ||
    (pref === "system" &&
      window.matchMedia("(prefers-color-scheme: dark)").matches);
  document.documentElement.dataset.theme = dark ? "dark" : "light";
}

// Следить за сменой системной темы
export function watchSystemTheme(getPref) {
  const mq = window.matchMedia("(prefers-color-scheme: dark)");
  const handler = () => {
    if (getPref() === "system") applyThemePref("system");
  };
  mq.addEventListener("change", handler);
  return () => mq.removeEventListener("change", handler);
}
