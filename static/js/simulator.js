/** Halaman Simulator: pilih studi kasus, jalankan simulasi, tampilkan hasil di tab. */
import { $, h, clear } from "./dom.js";
import { runSimulation, runSweep } from "./api.js";
import { getActiveCase, getCases, onStore, setActiveCase } from "./cases-store.js";
import { resourceChipClass, toPayload } from "./case-utils.js";
import { describeDistribution } from "./distributions.js";
import { buildFlowchart } from "./flowchart.js";
import { downloadPng, downloadSvg } from "./flowchart-export.js";
import { initResultTabs, onPageChange } from "./navigation.js";
import { insightBox } from "./insight-box.js";
import { flowchartInsight } from "./insights.js";
import { renderCharts } from "./charts-view.js";
import { downloadLogCsv, renderLog } from "./log-view.js";
import { renderReplay, stopReplay } from "./replay-view.js";
import { renderScenario } from "./scenario-view.js";
import { renderSummary } from "./summary-view.js";
import { showToast } from "./toast.js";

const RESIZE_DELAY_MS = 150;
const RERUN_DELAY_MS = 400;
const MIN_CAPACITY = 1;
const MAX_CAPACITY = 20;
const EMPTY_MESSAGE = "Belum ada hasil. Klik Jalankan Simulasi.";

const el = {
  select: $("#case-select"),
  description: $("#case-description"),
  chips: $("#case-chips"),
  capacities: $("#capacity-fields"),
  entities: $("#setting-entities"),
  replications: $("#setting-replications"),
  seed: $("#setting-seed"),
  runButton: $("#run-button"),
  status: $("#run-status"),
  warnings: $("#load-warnings"),
  flowchart: $("#flowchart-host"),
  flowchartInsight: $("#flowchart-insight"),
  summary: $("#summary-host"),
  charts: $("#charts-host"),
  replay: $("#replay-host"),
  log: $("#log-host"),
  csvButton: $("#download-csv"),
  scenarioResource: $("#scenario-resource"),
  scenarioLow: $("#scenario-low"),
  scenarioHigh: $("#scenario-high"),
  scenarioHost: $("#scenario-host"),
};

let lastRun = null;
let activeTab = "flowchart";
let openTab = () => {};
let capacities = {};
let rerunTimer = null;

/** Studi kasus aktif dengan jumlah entitas dan jumlah petugas dari kolom pengaturan. */
function currentCase() {
  const active = getActiveCase();
  return {
    ...active,
    max_entities: Number(el.entities.value),
    resources: active.resources.map((resource) => ({
      ...resource,
      capacity: capacities[resource.name] ?? resource.capacity,
    })),
  };
}

function readInteger(input, label) {
  const value = Number(input.value);
  if (!Number.isInteger(value)) throw new Error(`${label} harus berupa bilangan bulat.`);
  return value;
}

// ----- Tampilan studi kasus -------------------------------------------------

function renderSelect() {
  clear(el.select).append(
    ...getCases().map((item) => h("option", { value: item.id, selected: item.id === getActiveCase().id }, item.name))
  );
}

function renderCaseInfo() {
  const studyCase = getActiveCase();
  capacities = {};
  el.description.textContent = studyCase.description || "Studi kasus buatan sendiri.";
  el.entities.value = studyCase.max_entities;
  renderCapacityFields(studyCase);
  renderChips();
  renderScenarioOptions(studyCase);
  renderFlowchart();
}

function renderChips() {
  const studyCase = currentCase();
  clear(el.chips).append(
    h("span", { class: "chip chip-yellow" }, `Kedatangan: ${describeDistribution(studyCase.arrival)}`),
    ...studyCase.resources.map((resource, index) =>
      h("span", { class: `chip ${resourceChipClass(index)}` }, `${resource.name} x${resource.capacity}`)
    )
  );
}

/** Satu kolom angka per sumber daya, misalnya Resepsionis dan Montir pada bengkel atau Dokter dan Apoteker pada klinik. */
function renderCapacityFields(studyCase) {
  clear(el.capacities).append(
    ...studyCase.resources.map((resource) => {
      const input = h("input", {
        class: "input",
        type: "number",
        min: MIN_CAPACITY,
        max: MAX_CAPACITY,
        step: 1,
        value: resource.capacity,
        "aria-label": `Jumlah ${resource.name}`,
      });
      input.addEventListener("input", () => changeCapacity(resource.name, input.value));
      input.addEventListener("change", () => {
        input.value = capacities[resource.name] ?? resource.capacity;
      });
      return h("label", { class: "field" }, h("span", { class: "field-label" }, resource.name), input);
    })
  );
}

/** Terapkan jumlah petugas baru. Angka yang belum valid diabaikan sampai pengguna selesai mengetik. */
function changeCapacity(name, rawValue) {
  const value = Number(rawValue);
  if (!Number.isInteger(value) || value < MIN_CAPACITY || value > MAX_CAPACITY) return;
  capacities[name] = value;
  renderChips();
  renderFlowchart();
  scheduleRerun();
}

/** Jika sudah pernah ada hasil, jalankan ulang otomatis agar ringkasan dan grafik ikut berubah. */
function scheduleRerun() {
  clearTimeout(rerunTimer);
  if (!lastRun) return;
  rerunTimer = setTimeout(() => run({ switchTab: false }), RERUN_DELAY_MS);
}

/** Gambar flowchart sesuai lebar ruang yang tersedia. Panel yang tersembunyi dianggap selebar layar. */
function renderFlowchart() {
  const studyCase = currentCase();
  const width = el.flowchart.clientWidth || window.innerWidth;
  clear(el.flowchart).append(buildFlowchart(studyCase, width));
  clear(el.flowchartInsight).append(insightBox(flowchartInsight(studyCase)));
}

function renderScenarioOptions(studyCase) {
  clear(el.scenarioResource).append(
    ...studyCase.resources.map((resource) => h("option", { value: resource.name }, resource.name))
  );
  const first = studyCase.resources[0];
  el.scenarioLow.value = 1;
  el.scenarioHigh.value = Math.min(20, first.capacity + 2);
}

function resetResults() {
  lastRun = null;
  stopReplay();
  for (const host of [el.summary, el.charts, el.replay, el.log]) {
    clear(host).append(h("p", { class: "empty" }, EMPTY_MESSAGE));
  }
  clear(el.scenarioHost);
  clear(el.warnings);
  el.csvButton.disabled = true;
  el.status.textContent = "";
}

// ----- Menjalankan simulasi -------------------------------------------------

function renderWarnings(warnings) {
  clear(el.warnings).append(...warnings.map((text) => h("p", { class: "alert", role: "alert" }, text)));
}

async function run({ switchTab = true } = {}) {
  let payload;
  try {
    payload = {
      case: toPayload(currentCase()),
      replications: readInteger(el.replications, "Replikasi"),
      seed: readInteger(el.seed, "Seed"),
    };
    readInteger(el.entities, "Jumlah entitas");
  } catch (error) {
    showToast(error.message, true);
    return;
  }

  el.runButton.disabled = true;
  el.status.textContent = "Menjalankan simulasi...";
  try {
    const result = await runSimulation(payload);
    lastRun = { result, studyCase: currentCase() };
    renderWarnings(result.warnings);
    renderSummary(el.summary, result);
    renderLog(el.log, result, lastRun.studyCase);
    el.csvButton.disabled = false;
    el.status.textContent = `Selesai. ${result.settings.replications} replikasi dijalankan.`;
    if (switchTab) openTab("summary");
    else refreshOpenTab();
  } catch (error) {
    el.status.textContent = "";
    showToast(error.message, true);
  } finally {
    el.runButton.disabled = false;
  }
}

async function runScenario() {
  let payload;
  try {
    payload = {
      case: toPayload(currentCase()),
      resource: el.scenarioResource.value,
      low: readInteger(el.scenarioLow, "Batas bawah"),
      high: readInteger(el.scenarioHigh, "Batas atas"),
      replications: readInteger(el.replications, "Replikasi"),
      seed: readInteger(el.seed, "Seed"),
    };
  } catch (error) {
    showToast(error.message, true);
    return;
  }
  try {
    renderScenario(el.scenarioHost, await runSweep(payload));
  } catch (error) {
    showToast(error.message, true);
  }
}

// ----- Tab dan ukuran layar -------------------------------------------------

function onTabOpen(name) {
  activeTab = name;
  if (name !== "replay") stopReplay();
  if (name === "flowchart") renderFlowchart();
  if (!lastRun) return;
  if (name === "charts") renderCharts(el.charts, lastRun.result, lastRun.studyCase);
  if (name === "replay") renderReplay(el.replay, lastRun.result, lastRun.studyCase);
}

/** Gambar ulang tab yang sedang terbuka setelah hasil baru masuk. */
function refreshOpenTab() {
  if (activeTab === "charts") renderCharts(el.charts, lastRun.result, lastRun.studyCase);
  if (activeTab === "replay") renderReplay(el.replay, lastRun.result, lastRun.studyCase);
}

function watchResize() {
  let timer = null;
  window.addEventListener("resize", () => {
    clearTimeout(timer);
    timer = setTimeout(() => {
      if (activeTab === "flowchart") renderFlowchart();
      if (lastRun && activeTab === "charts") renderCharts(el.charts, lastRun.result, lastRun.studyCase);
    }, RESIZE_DELAY_MS);
  });
}

/** Gambar ulang diagram dan grafik, misalnya setelah tema berganti. */
export function refreshVisuals() {
  if (lastRun && activeTab === "charts") renderCharts(el.charts, lastRun.result, lastRun.studyCase);
}

export function initSimulator() {
  openTab = initResultTabs(onTabOpen);
  renderSelect();
  renderCaseInfo();
  resetResults();

  el.select.addEventListener("change", () => setActiveCase(el.select.value));
  el.runButton.addEventListener("click", () => run());
  $("#scenario-run").addEventListener("click", runScenario);
  onPageChange((page) => {
    if (page === "simulator" && activeTab === "flowchart") renderFlowchart();
  });
  $("#download-png").addEventListener("click", () => downloadPng($("svg", el.flowchart), getActiveCase().name));
  $("#download-svg").addEventListener("click", () => downloadSvg($("svg", el.flowchart), getActiveCase().name));
  el.csvButton.addEventListener("click", () => lastRun && downloadLogCsv(lastRun.result, lastRun.studyCase));

  onStore("active", () => {
    renderSelect();
    renderCaseInfo();
    resetResults();
    openTab("flowchart");
  });
  onStore("cases", () => {
    renderSelect();
    renderCaseInfo();
  });
  watchResize();
}
