/** Empat jenis grafik SVG: garis tangga, batang, histogram, dan Gantt. */
import { h, s, clear } from "./dom.js";
import { createFrame, drawNumericXAxis, drawYAxis, drawXAxisLine, linearScale, niceTicks, MARGIN } from "./chart-core.js";
import { formatNumber } from "./format.js";
import { wrapText } from "./text-utils.js";
import { binValues } from "./histogram.js";

const MIN_WIDTH = 300;
const CHART_HEIGHT = 260;
const GANTT_ROW_HEIGHT = 30;
const GANTT_LABEL_WIDTH = 110;
const GANTT_MIN_WIDTH = 620;

const widthOf = (host) => Math.max(MIN_WIDTH, Math.floor(host.clientWidth));

export function legend(items) {
  return h(
    "ul",
    { class: "legend" },
    items.map((item) =>
      h("li", {}, h("span", { class: "legend-swatch", style: `background:${item.color}` }), item.label)
    )
  );
}

/** Grafik garis tangga: panjang antrian dari waktu ke waktu. */
export function renderStepChart(host, { series, endTime, unit }) {
  const width = widthOf(host);
  const frame = createFrame(width, CHART_HEIGHT);
  const { svg, plot } = frame;
  const maxValue = Math.max(1, ...series.flatMap((item) => item.points.map((point) => point[1])));
  const yTicks = niceTicks(maxValue, 4);
  const xTicks = niceTicks(endTime, Math.max(3, Math.floor(plot.width / 90)));
  const xScale = linearScale(0, xTicks.at(-1), plot.left, plot.right);
  const yScale = linearScale(0, yTicks.at(-1), plot.bottom, plot.top);

  drawYAxis(frame, yTicks, yScale, "Panjang antrian");
  drawNumericXAxis(frame, xTicks, xScale, `Waktu (${unit})`);
  for (const item of series) {
    svg.append(s("path", { class: "ch-line", d: stepPath(item.points, endTime, xScale, yScale), style: `stroke:${item.color}` }));
  }
  clear(host).append(svg, legend(series.map((item) => ({ label: item.name, color: item.color }))));
}

function stepPath(points, endTime, xScale, yScale) {
  const [first, ...rest] = points;
  let path = `M ${xScale(first[0])} ${yScale(first[1])}`;
  for (const [time, value] of rest) path += ` H ${xScale(time)} V ${yScale(value)}`;
  return `${path} H ${xScale(endTime)}`;
}

/** Grafik batang dengan batang galat (selang kepercayaan) opsional. */
export function renderBarChart(host, { bars, formatValue, yTitle, maxValue }) {
  const width = widthOf(host);
  const frame = createFrame(width, CHART_HEIGHT + 20, { ...MARGIN, bottom: 64 });
  const { svg, plot } = frame;
  const top = Math.max(maxValue ?? 0, ...bars.map((bar) => bar.high ?? bar.value));
  const yTicks = niceTicks(top, 4);
  const yScale = linearScale(0, yTicks.at(-1), plot.bottom, plot.top);
  const slot = plot.width / bars.length;
  const barWidth = Math.min(72, slot * 0.6);

  drawYAxis(frame, yTicks, yScale, yTitle);
  drawXAxisLine(frame);
  bars.forEach((bar, index) => {
    const cx = plot.left + slot * (index + 0.5);
    const y = yScale(bar.value);
    svg.append(
      s("rect", { class: "ch-bar", x: cx - barWidth / 2, y, width: barWidth, height: Math.max(0, plot.bottom - y), style: `fill:${bar.color}` })
    );
    if (bar.low !== undefined) svg.append(errorBar(cx, yScale(bar.low), yScale(bar.high)));
    svg.append(s("text", { class: "ch-value", x: cx, y: y - 8 - (bar.low !== undefined ? 8 : 0) }, formatValue(bar.value)));
    wrapText(bar.label, Math.max(8, Math.floor(slot / 7))).slice(0, 3).forEach((line, lineIndex) =>
      svg.append(s("text", { class: "ch-tick", x: cx, y: plot.bottom + 18 + lineIndex * 13, "text-anchor": "middle" }, line))
    );
  });
  clear(host).append(svg);
}

function errorBar(cx, lowY, highY) {
  const cap = 7;
  return s("path", { class: "ch-error", d: `M ${cx} ${lowY} V ${highY} M ${cx - cap} ${lowY} H ${cx + cap} M ${cx - cap} ${highY} H ${cx + cap}` });
}

/** Histogram sebaran nilai, misalnya waktu tunggu tiap entitas. */
export function renderHistogram(host, { values, xTitle, yTitle = "Jumlah data", color }) {
  const width = widthOf(host);
  const frame = createFrame(width, CHART_HEIGHT);
  const { svg, plot } = frame;
  const { bins, low, span, counts } = binValues(values);

  const yTicks = niceTicks(Math.max(...counts), 4);
  const xTicks = Array.from({ length: bins + 1 }, (_, i) => low + span * i);
  const xScale = linearScale(low, low + span * bins, plot.left, plot.right);
  const yScale = linearScale(0, yTicks.at(-1), plot.bottom, plot.top);

  drawYAxis(frame, yTicks, yScale, yTitle);
  counts.forEach((count, i) => {
    const x = xScale(low + span * i);
    const barWidth = xScale(low + span * (i + 1)) - x;
    svg.append(s("rect", { class: "ch-bar", x, y: yScale(count), width: barWidth, height: plot.bottom - yScale(count), style: `fill:${color}` }));
  });
  drawNumericXAxis(frame, thinOut(xTicks, plot.width), xScale, xTitle);
  clear(host).append(svg);
}

/** Kurangi jumlah label sumbu supaya tidak saling menimpa di layar sempit. */
function thinOut(ticks, availableWidth) {
  const maxLabels = Math.max(2, Math.floor(availableWidth / 56));
  const every = Math.ceil(ticks.length / maxLabels);
  return ticks.filter((_, index) => index % every === 0);
}

/** Diagram Gantt: kapan tiap slot sumber daya sibuk melayani entitas mana. */
export function renderGantt(host, { gantt, resources, endTime, unit, colorOf }) {
  const rows = resources.flatMap((resource, resourceIndex) =>
    Array.from({ length: resource.capacity }, (_, slot) => ({
      key: `${resource.name}:${slot}`,
      label: resource.capacity > 1 ? `${resource.name} ${slot + 1}` : resource.name,
      color: colorOf(resourceIndex),
    }))
  );
  const width = Math.max(GANTT_MIN_WIDTH, widthOf(host));
  const height = rows.length * GANTT_ROW_HEIGHT + 56;
  const frame = createFrame(width, height, { top: 12, right: 16, bottom: 44, left: GANTT_LABEL_WIDTH });
  const { svg, plot } = frame;
  const xTicks = niceTicks(endTime, Math.max(3, Math.floor(plot.width / 90)));
  const xScale = linearScale(0, xTicks.at(-1), plot.left, plot.right);
  const rowIndex = new Map(rows.map((row, index) => [row.key, index]));

  rows.forEach((row, index) => {
    const y = plot.top + index * GANTT_ROW_HEIGHT;
    svg.append(
      s("line", { class: "ch-grid", x1: plot.left, x2: plot.right, y1: y + GANTT_ROW_HEIGHT, y2: y + GANTT_ROW_HEIGHT }),
      s("text", { class: "ch-tick", x: plot.left - 8, y: y + GANTT_ROW_HEIGHT / 2 + 4, "text-anchor": "end" }, row.label)
    );
  });
  svg.append(s("line", { class: "ch-axis", x1: plot.left, x2: plot.left, y1: plot.top, y2: plot.top + rows.length * GANTT_ROW_HEIGHT }));
  svg.append(...gantt.flatMap((item) => ganttBar(item, rows, rowIndex, xScale, plot)));

  const axisFrame = { svg, plot: { ...plot, bottom: plot.top + rows.length * GANTT_ROW_HEIGHT } };
  drawNumericXAxis(axisFrame, xTicks, xScale, `Waktu (${unit})`);
  clear(host).append(svg);
}

function ganttBar(item, rows, rowIndex, xScale, plot) {
  const index = rowIndex.get(`${item.resource}:${item.slot}`);
  const x = xScale(item.start);
  const barWidth = Math.max(1, xScale(item.end) - x);
  const y = plot.top + index * GANTT_ROW_HEIGHT + 4;
  const elements = [
    s("rect", { class: "ch-gantt-bar", x, y, width: barWidth, height: GANTT_ROW_HEIGHT - 8, rx: 3, style: `fill:${rows[index].color}` }),
  ];
  if (barWidth >= 20) {
    elements.push(s("text", { class: "ch-gantt-text", x: x + barWidth / 2, y: y + (GANTT_ROW_HEIGHT - 8) / 2 + 3 }, item.entity));
  }
  return elements;
}

export const percentLabel = (fraction) => `${formatNumber(fraction * 100, 0)}%`;
