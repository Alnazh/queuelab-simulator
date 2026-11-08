/** Bagian dasar grafik SVG: kerangka, skala, dan sumbu. */
import { s } from "./dom.js";
import { formatNumber } from "./format.js";

export const MARGIN = { top: 32, right: 16, bottom: 44, left: 52 };

export function linearScale(domainMin, domainMax, rangeMin, rangeMax) {
  const span = domainMax - domainMin || 1;
  return (value) => rangeMin + ((value - domainMin) / span) * (rangeMax - rangeMin);
}

/** Tick sumbu dengan langkah "bulat" (1, 2, 5 dikali pangkat sepuluh), mulai dari nol. */
export function niceTicks(maxValue, targetCount = 5) {
  const safeMax = maxValue > 0 ? maxValue : 1;
  const rough = safeMax / targetCount;
  const magnitude = 10 ** Math.floor(Math.log10(rough));
  const residual = rough / magnitude;
  const factor = residual <= 1 ? 1 : residual <= 2 ? 2 : residual <= 5 ? 5 : 10;
  const step = factor * magnitude;
  const ticks = [];
  for (let value = 0; value <= safeMax + step * 0.999; value += step) {
    ticks.push(Number(value.toFixed(10)));
  }
  return ticks;
}

/** Buat elemen svg dan ukuran area gambar di dalam margin. */
export function createFrame(width, height, margin = MARGIN) {
  const svg = s("svg", {
    xmlns: "http://www.w3.org/2000/svg",
    viewBox: `0 0 ${width} ${height}`,
    width,
    height,
    role: "img",
  });
  return {
    svg,
    margin,
    plot: {
      left: margin.left,
      top: margin.top,
      right: width - margin.right,
      bottom: height - margin.bottom,
      width: width - margin.left - margin.right,
      height: height - margin.top - margin.bottom,
    },
  };
}

function tickLabel(value) {
  return formatNumber(value, Number.isInteger(value) ? 0 : 1);
}

/** Gambar garis grid, sumbu Y, dan judul sumbu. Skala Y dikembalikan oleh pemanggil. */
export function drawYAxis(frame, ticks, yScale, title) {
  const { svg, plot } = frame;
  for (const tick of ticks) {
    const y = yScale(tick);
    svg.append(
      s("line", { class: "ch-grid", x1: plot.left, x2: plot.right, y1: y, y2: y }),
      s("text", { class: "ch-tick", x: plot.left - 8, y: y + 4, "text-anchor": "end" }, tickLabel(tick))
    );
  }
  svg.append(s("line", { class: "ch-axis", x1: plot.left, x2: plot.left, y1: plot.top, y2: plot.bottom }));
  if (title) {
    svg.append(s("text", { class: "ch-title", x: 4, y: 14 }, title));
  }
}

export function drawXAxisLine(frame) {
  const { svg, plot } = frame;
  svg.append(s("line", { class: "ch-axis", x1: plot.left, x2: plot.right, y1: plot.bottom, y2: plot.bottom }));
}

/** Tick sumbu X numerik beserta judulnya. */
export function drawNumericXAxis(frame, ticks, xScale, title) {
  const { svg, plot } = frame;
  drawXAxisLine(frame);
  for (const tick of ticks) {
    const x = xScale(tick);
    svg.append(
      s("line", { class: "ch-axis", x1: x, x2: x, y1: plot.bottom, y2: plot.bottom + 5 }),
      s("text", { class: "ch-tick", x, y: plot.bottom + 18, "text-anchor": "middle" }, tickLabel(tick))
    );
  }
  if (title) {
    svg.append(
      s("text", { class: "ch-title", x: plot.right, y: plot.bottom + 36, "text-anchor": "end" }, title)
    );
  }
}
