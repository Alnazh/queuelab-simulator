/** Tampilan tab Skenario: membandingkan beberapa nilai kapasitas sumber daya. */
import { h, clear } from "./dom.js";
import { renderBarChart, percentLabel } from "./charts.js";
import { formatInterval, formatNumber } from "./format.js";
import { insightBox } from "./insight-box.js";
import { scenarioUsageInsight, scenarioWaitInsight } from "./insights.js";

const BAR_COLORS = ["var(--blue)", "var(--orange)", "var(--purple)", "var(--green)", "var(--pink)", "var(--cyan)"];

function chartBlock(title) {
  const host = h("div", { class: "chart-host" });
  return { host, element: h("div", { class: "chart-card" }, h("h4", {}, title), host) };
}

function comparisonTable(outcome) {
  const unit = outcome.time_unit;
  return h(
    "div",
    { class: "table-scroll" },
    h(
      "table",
      { class: "table" },
      h(
        "thead",
        {},
        h("tr", {}, [`${outcome.resource}`, `Rata-rata tunggu (${unit})`, "Selang 95%", `Waktu di sistem (${unit})`, "Utilisasi"].map((text) => h("th", {}, text)))
      ),
      h(
        "tbody",
        {},
        outcome.scenarios.map((item) =>
          h(
            "tr",
            {},
            h("td", {}, item.capacity),
            h("td", { class: "num" }, formatNumber(item.avg_wait.mean)),
            h("td", { class: "num" }, formatInterval(item.avg_wait)),
            h("td", { class: "num" }, formatNumber(item.avg_system_time.mean)),
            h("td", { class: "num" }, percentLabel(item.utilization.mean))
          )
        )
      )
    )
  );
}

function conclusion(outcome) {
  const first = outcome.scenarios[0];
  const last = outcome.scenarios.at(-1);
  if (first === last) return null;
  const change = first.avg_wait.mean - last.avg_wait.mean;
  const direction = change >= 0 ? "turun" : "naik";
  return h(
    "p",
    { class: "alert alert-info" },
    `Dari ${first.capacity} ke ${last.capacity} ${outcome.resource}, rata-rata waktu tunggu ${direction} ` +
      `${formatNumber(Math.abs(change))} ${outcome.time_unit}.`
  );
}

export function renderScenario(host, outcome) {
  const wait = chartBlock("Rata-rata waktu tunggu per kapasitas");
  const usage = chartBlock("Utilisasi per kapasitas");
  clear(host).append(conclusion(outcome), wait.element, usage.element, comparisonTable(outcome));

  const colorFor = (index) => BAR_COLORS[index % BAR_COLORS.length];
  renderBarChart(wait.host, {
    yTitle: `Waktu tunggu (${outcome.time_unit})`,
    formatValue: (value) => formatNumber(value, 1),
    bars: outcome.scenarios.map((item, index) => ({
      label: `${item.capacity} ${outcome.resource}`,
      value: item.avg_wait.mean,
      low: Math.max(0, item.avg_wait.ci_low),
      high: item.avg_wait.ci_high,
      color: colorFor(index),
    })),
  });
  renderBarChart(usage.host, {
    yTitle: "Utilisasi",
    maxValue: 1,
    formatValue: percentLabel,
    bars: outcome.scenarios.map((item, index) => ({
      label: `${item.capacity} ${outcome.resource}`,
      value: item.utilization.mean,
      color: colorFor(index),
    })),
  });
  wait.element.append(insightBox(scenarioWaitInsight(outcome)));
  usage.element.append(insightBox(scenarioUsageInsight(outcome)));
}
