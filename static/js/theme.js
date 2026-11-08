/** Pengaturan tema terang dan gelap. Terang adalah bawaan. */
import { loadTheme, saveTheme } from "./storage.js";

function applyTheme(theme) {
  const dark = theme === "dark";
  document.documentElement.dataset.theme = theme;
  const button = document.getElementById("theme-toggle");
  button.setAttribute("aria-pressed", String(dark));
  button.setAttribute("aria-label", dark ? "Ganti ke tema terang" : "Ganti ke tema gelap");
}

export function initTheme(onChange) {
  applyTheme(loadTheme() === "dark" ? "dark" : "light");
  document.getElementById("theme-toggle").addEventListener("click", () => {
    const next = document.documentElement.dataset.theme === "dark" ? "light" : "dark";
    applyTheme(next);
    saveTheme(next);
    onChange?.();
  });
}
