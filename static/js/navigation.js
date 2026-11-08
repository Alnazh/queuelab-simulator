/** Perpindahan halaman berdasarkan hash URL dan tab hasil di halaman Simulator. */
import { $, $$ } from "./dom.js";

const DEFAULT_PAGE = "beranda";
const listeners = [];

function currentPage() {
  const name = window.location.hash.replace("#", "");
  return $(`[data-page="${name}"]`) ? name : DEFAULT_PAGE;
}

function showPage() {
  const name = currentPage();
  for (const page of $$("[data-page]")) page.hidden = page.dataset.page !== name;
  for (const link of $$("[data-page-link]")) {
    link.classList.toggle("is-active", link.dataset.pageLink === name);
    link.toggleAttribute("aria-current", link.dataset.pageLink === name);
  }
  window.scrollTo({ top: 0 });
  listeners.forEach((listener) => listener(name));
}

export function onPageChange(listener) {
  listeners.push(listener);
}

export function goToPage(name) {
  window.location.hash = name;
}

export function initNavigation() {
  window.addEventListener("hashchange", showPage);
  showPage();
}

/** Tab hasil simulasi. Mengembalikan fungsi untuk membuka tab dari kode. */
export function initResultTabs(onOpen) {
  const buttons = $$("[data-result-tab]");

  function open(name) {
    for (const button of buttons) {
      const active = button.dataset.resultTab === name;
      button.classList.toggle("is-active", active);
      button.setAttribute("aria-selected", String(active));
    }
    for (const panel of $$("[data-result-panel]")) panel.hidden = panel.dataset.resultPanel !== name;
    onOpen?.(name);
  }

  buttons.forEach((button) => button.addEventListener("click", () => open(button.dataset.resultTab)));
  return open;
}
