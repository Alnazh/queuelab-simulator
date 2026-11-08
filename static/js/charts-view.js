/** Tampilan tab Grafik. Dirender ulang saat tab dibuka atau ukuran layar berubah. */
import { h, clear } from "./dom.js";
import { renderBarChart, renderGantt, renderHistogram, renderStepChart, legend, percentLabel } from "./charts.js";
import { resourceColor } from "./case-utils.js";
import { insightBox } from "./insight-box.js";
import { ganttInsight, queueInsight, utilizationInsight, waitInsight } from "./insights.js";

function chartCard(title, note) {
  const host = h("div", { class: "chart-host" });
  const card = h("div", { class: "chart-card" }, h("h4", {}, title), note ? h("p", { class: "muted small" }, note) : null, host);
  return { card, host };
}

export function renderCharts(container, result, studyCase) {
  const { detail, summary, settings } = result;
  const unit = settings.time_unit;
  const queue = chartCard("Panjang antrian dari waktu ke waktu", "Replikasi pertama.");
  const utilization = chartCard("Utilisasi sumber daya", "Rata-rata semua replikasi dengan selang kepercayaan 95%.");
  const waits = chartCard("Sebaran waktu tunggu", "Replikasi pertama, satu data per entitas.");
  const gantt = chartCard("Diagram Gantt sumber daya", "Replikasi pertama. Angka di dalam batang adalah nomor entitas.");

  clear(container).append(queue.card, utilization.card, waits.card, gantt.card);

  renderStepChart(queue.host, {
    unit,
    endTime: detail.end_time,
    series: studyCase.resources.map((resource, index) => ({
      name: `Antrian ${resource.name}`,
      color: resourceColor(index),
      points: detail.queue_series[resource.name] ?? [[0, 0]],
    })),
  });

  renderBarChart(utilization.host, {
    yTitle: "Utilisasi",
    maxValue: 1,
    formatValue: percentLabel,
    bars: summary.resources.map((item, index) => ({
      label: item.name,
      value: item.utilization.mean,
      low: Math.max(0, item.utilization.ci_low),
      high: Math.min(1, item.utilization.ci_high),
      color: resourceColor(index),
    })),
  });

  renderHistogram(waits.host, {
    values: detail.waits,
    xTitle: `Waktu tunggu (${unit})`,
    yTitle: "Jumlah entitas",
    color: "var(--pink)",
  });

  renderGantt(gantt.host, {
    gantt: detail.gantt,
    resources: studyCase.resources,
    endTime: detail.end_time,
    unit,
    colorOf: resourceColor,
  });
  gantt.card.append(
    legend(studyCase.resources.map((resource, index) => ({ label: resource.name, color: resourceColor(index) })))
  );

  queue.card.append(insightBox(queueInsight(detail, studyCase, unit)));
  utilization.card.append(insightBox(utilizationInsight(summary.resources, result.warnings, settings.max_entities)));
  waits.card.append(insightBox(waitInsight(detail.waits, studyCase, unit)));
  gantt.card.append(insightBox(ganttInsight(detail, studyCase, unit)));
}
