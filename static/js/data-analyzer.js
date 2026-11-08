/** Halaman Data Historis: analisis data waktu dan penerapan hasilnya ke studi kasus. */
import { $, h, clear } from "./dom.js";
import { analyzeValues } from "./api.js";
import { cloneCase, distributionTargets, setDistribution } from "./case-utils.js";
import { getActiveCase, saveCase, setActiveCase } from "./cases-store.js";
import { describeDistribution } from "./distributions.js";
import { formatNumber, parseNumbers } from "./format.js";
import { renderHistogram } from "./charts.js";
import { insightBox } from "./insight-box.js";
import { dataInsight } from "./insights.js";
import { goToPage, onPageChange } from "./navigation.js";
import { showToast } from "./toast.js";

const EXAMPLE_DATA = "3\n5\n4\n8\n12\n6\n9\n4\n7\n5";

const el = {
  input: $("#data-input"),
  error: $("#data-error"),
  result: $("#data-result"),
  unit: $("#data-unit"),
  apply: $("#data-apply"),
  caseName: $("#apply-case-name"),
  target: $("#apply-target"),
  mode: $("#apply-mode"),
};

let lastAnalysis = null;

function showError(message) {
  el.error.textContent = message;
  el.error.hidden = !message;
}

function statItem(label, value) {
  return h("div", {}, h("dt", {}, label), h("dd", {}, value));
}

function renderResult(analysis) {
  const chart = h("div", { class: "chart-host" });
  const suggestion = analysis.suggestion;
  clear(el.result).append(
    h("h3", {}, "Hasil analisis"),
    h(
      "dl",
      { class: "data-stats" },
      statItem("Jumlah data", formatNumber(analysis.count, 0)),
      statItem("Rata-rata", formatNumber(analysis.mean)),
      statItem("Median", formatNumber(analysis.median)),
      statItem("Simpangan baku", formatNumber(analysis.std)),
      statItem("Minimum", formatNumber(analysis.min)),
      statItem("Maksimum", formatNumber(analysis.max)),
      statItem("Koef. variasi", formatNumber(analysis.cv))
    ),
    chart,
    insightBox(dataInsight(analysis, lastAnalysis.values, getActiveCase().time_unit)),
    h("p", { class: "alert alert-info" }, `Saran: ${describeDistribution(suggestion.spec)}. ${suggestion.reason}`),
    ...analysis.notes.map((note) => h("p", { class: "alert" }, note)),
    h("p", { class: "muted small" }, "Saran ini hanya patokan awal. Pertimbangkan juga alasan dari sisi prosesnya, bukan hanya bentuk data.")
  );
  renderHistogram(chart, { values: lastAnalysis.values, xTitle: `Waktu (${getActiveCase().time_unit})`, color: "var(--blue)" });
}

async function analyze() {
  showError("");
  const values = parseNumbers(el.input.value);
  if (values.length === 0 || values.some((value) => Number.isNaN(value))) {
    showError("Isi dengan angka saja, minimal dua nilai.");
    return;
  }
  try {
    const analysis = await analyzeValues(values);
    lastAnalysis = { values, suggestion: analysis.suggestion };
    renderResult(analysis);
    prepareApplyPanel();
  } catch (error) {
    showError(error.message);
  }
}

function prepareApplyPanel() {
  const studyCase = getActiveCase();
  el.caseName.textContent = studyCase.name;
  clear(el.target).append(...distributionTargets(studyCase).map((item) => h("option", { value: item.id }, item.label)));
  el.apply.hidden = !lastAnalysis;
}

function chosenSpec() {
  const { values, suggestion } = lastAnalysis;
  if (el.mode.value === "suggestion") return suggestion.spec;
  return { type: "data", values, mode: el.mode.value };
}

function applyToCase() {
  let target = getActiveCase();
  if (target.builtin) target = cloneCase(target);
  setDistribution(target, el.target.value, chosenSpec());
  saveCase(target);
  setActiveCase(target.id);
  goToPage("simulator");
  showToast(`Distribusi diterapkan ke "${target.name}".`);
}

export function initDataAnalyzer() {
  $("#data-analyze").addEventListener("click", analyze);
  $("#data-example").addEventListener("click", () => {
    el.input.value = EXAMPLE_DATA;
    showToast("Angka contoh hanya ilustrasi, ganti dengan data observasimu.");
  });
  $("#apply-button").addEventListener("click", applyToCase);
  onPageChange((page) => {
    if (page !== "data") return;
    el.unit.textContent = getActiveCase().time_unit;
    if (lastAnalysis) prepareApplyPanel();
  });
}
