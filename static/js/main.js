/** Titik masuk front-end: memuat studi kasus bawaan lalu menyalakan semua halaman. */
import { fetchPresets } from "./api.js";
import { initCases } from "./cases-store.js";
import { initTheme } from "./theme.js";
import { initNavigation } from "./navigation.js";
import { showToast } from "./toast.js";

async function start() {
  initTheme(async () => {
    const { refreshVisuals } = await import("./simulator.js");
    refreshVisuals();
  });
  try {
    initCases(await fetchPresets());
  } catch (error) {
    showToast(error.message, true);
    initNavigation();
    return;
  }
  // Modul halaman dimuat setelah studi kasus siap karena mereka membaca elemen dan data saat diimpor.
  const [{ initSimulator }, { initCaseList }, { initCaseEditor }, { initDataAnalyzer }] = await Promise.all([
    import("./simulator.js"),
    import("./case-list.js"),
    import("./case-editor.js"),
    import("./data-analyzer.js"),
  ]);
  initSimulator();
  initCaseList();
  initCaseEditor();
  initDataAnalyzer();
  initNavigation();
}

start();
