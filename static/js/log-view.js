/** Tampilan tab Log Kejadian dan unduhan CSV. */
import { h, clear } from "./dom.js";
import { formatNumber } from "./format.js";

function headers(studyCase) {
  return [
    "No",
    "Waktu",
    "Kejadian",
    studyCase.entity_name,
    "Tahap",
    "Keterangan",
    ...studyCase.resources.flatMap((resource) => [`Antrian ${resource.name}`, `Sibuk ${resource.name}`]),
  ];
}

function busyCount(state) {
  return state.busy.filter((occupant) => occupant !== null).length;
}

function rowCells(row, index, studyCase) {
  return [
    index + 1,
    row.clock,
    row.event,
    row.entity,
    row.stage,
    row.note,
    ...studyCase.resources.flatMap((resource) => {
      const state = row.state[resource.name];
      return [state.queue, `${busyCount(state)}/${resource.capacity}`];
    }),
  ];
}

export function renderLog(host, result, studyCase) {
  const log = result.detail.log;
  const table = h(
    "table",
    { class: "table" },
    h("thead", {}, h("tr", {}, headers(studyCase).map((text) => h("th", {}, text)))),
    h(
      "tbody",
      {},
      log.map((row, index) =>
        h(
          "tr",
          {},
          rowCells(row, index, studyCase).map((cell, column) =>
            h("td", { class: column === 1 ? "num" : "" }, column === 1 ? formatNumber(cell) : cell)
          )
        )
      )
    )
  );
  clear(host).append(
    h("p", { class: "muted small" }, `Replikasi pertama, ${log.length} kejadian terurut menurut waktu.`),
    h("div", { class: "table-scroll tall" }, table),
    result.detail.log_truncated ? h("p", { class: "alert" }, "Log dipotong pada 4000 kejadian pertama.") : ""
  );
}

function csvCell(value) {
  const text = String(value);
  return /[",\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

export function downloadLogCsv(result, studyCase) {
  const lines = [
    headers(studyCase),
    ...result.detail.log.map((row, index) => rowCells(row, index, studyCase)),
  ].map((cells) => cells.map(csvCell).join(","));
  const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8" });
  const link = h("a", { href: URL.createObjectURL(blob), download: "log-kejadian.csv" });
  link.click();
  setTimeout(() => URL.revokeObjectURL(link.href), 1000);
}
