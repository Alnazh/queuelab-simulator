/** Tampilan tab Ringkasan: kartu angka utama dan dua tabel rincian. */
import { h, clear } from "./dom.js";
import { formatInterval, formatNumber, formatPercent } from "./format.js";

function statCard(colorIndex, label, value, note) {
  return h(
    "div",
    { class: `stat stat-${colorIndex}` },
    h("div", { class: "stat-label" }, label),
    h("div", { class: "stat-value" }, value),
    note ? h("div", { class: "stat-note" }, note) : null
  );
}

function table(headers, rows) {
  return h(
    "div",
    { class: "table-scroll" },
    h(
      "table",
      { class: "table" },
      h("thead", {}, h("tr", {}, headers.map((text) => h("th", {}, text)))),
      h("tbody", {}, rows.map((cells) => h("tr", {}, cells.map((cell, i) => h("td", { class: i > 0 ? "num" : "" }, cell)))))
    )
  );
}

function overallCards(overall, unit) {
  const wait = overall.avg_wait;
  return h(
    "div",
    { class: "stat-grid" },
    statCard(1, "Rata-rata waktu tunggu", `${formatNumber(wait.mean)} ${unit}`, `95%: ${formatInterval(wait)}`),
    statCard(2, "Waktu tunggu terlama", `${formatNumber(overall.max_wait.mean)} ${unit}`, "rata-rata antar replikasi"),
    statCard(3, "Rata-rata waktu di sistem", `${formatNumber(overall.avg_system_time.mean)} ${unit}`, `95%: ${formatInterval(overall.avg_system_time)}`),
    statCard(4, "Entitas selesai", formatNumber(overall.completed.mean, 0), "per replikasi"),
    statCard(5, "Durasi simulasi", `${formatNumber(overall.end_time.mean)} ${unit}`, "sampai entitas terakhir pergi"),
    statCard(6, "Laju selesai", `${formatNumber(overall.throughput.mean, 3)} per ${unit}`, "entitas selesai per satuan waktu")
  );
}

function resourceTable(resources) {
  return table(
    ["Sumber daya", "Kapasitas", "Utilisasi", "Rata-rata antrian", "Antrian terpanjang"],
    resources.map((item) => [
      item.name,
      formatNumber(item.capacity, 0),
      `${formatPercent(item.utilization.mean)} ${formatInterval({ ci_low: item.utilization.ci_low * 100, ci_high: item.utilization.ci_high * 100 }, 1)}`,
      formatNumber(item.avg_queue_length.mean),
      formatNumber(item.max_queue.mean, 1),
    ])
  );
}

function stageTable(stages, unit) {
  return table(
    ["Tahap", "Sumber daya", `Rata-rata tunggu (${unit})`],
    stages.map((item) => [item.name, item.resource, `${formatNumber(item.avg_wait.mean)} ${formatInterval(item.avg_wait)}`])
  );
}

export function renderSummary(host, result) {
  const { summary, settings } = result;
  clear(host).append(
    h(
      "p",
      { class: "muted small" },
      `Rata-rata dari ${settings.replications} replikasi, ${settings.max_entities} entitas per replikasi, seed awal ${settings.seed}.`
    ),
    overallCards(summary.overall, settings.time_unit),
    h("h4", {}, "Sumber daya"),
    resourceTable(summary.resources),
    h("h4", {}, "Waktu tunggu per tahap"),
    stageTable(summary.stages, settings.time_unit)
  );
}
