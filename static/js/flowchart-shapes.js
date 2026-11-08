/** Bentuk dasar flowchart (SVG) yang dipakai tata letak mendatar maupun vertikal. */
import { s } from "./dom.js";
import { MAX_PARALLEL_SHOWN } from "./flowchart-limits.js";
import { wrapText } from "./text-utils.js";

export const PAD = 28;
export const SHADOW = 4;

export const SIZE = {
  terminator: { w: 118, h: 52 },
  process: { w: 150, h: 60 },
  decision: { w: 176, h: 108 },
  wait: { w: 150, h: 52 },
};

function textLines(cx, cy, lines, lineHeight) {
  const top = cy - ((lines.length - 1) * lineHeight) / 2;
  return lines.map(({ text, className }, index) =>
    s("text", { class: className, x: cx, y: top + index * lineHeight, "dominant-baseline": "middle" }, text)
  );
}

/** Bentuk dengan bayangan keras ala neubrutalism. */
function shadowed(makeShape, fillClass) {
  return s(
    "g",
    {},
    makeShape({ class: "fc-shadow", transform: `translate(${SHADOW} ${SHADOW})` }),
    makeShape({ class: `fc-shape ${fillClass}` })
  );
}

export function terminator(cx, cy, label, fillClass) {
  const { w, h } = SIZE.terminator;
  const shape = (extra) =>
    s("rect", { x: cx - w / 2, y: cy - h / 2, width: w, height: h, rx: h / 2, ...extra });
  return s("g", {}, shadowed(shape, fillClass), ...textLines(cx, cy, [{ text: label, className: "fc-text" }], 16));
}

export function box(cx, cy, { title, subtitle, fillClass, kind = "process" }) {
  const { w, h } = SIZE[kind];
  const shape = (extra) =>
    s("rect", { x: cx - w / 2, y: cy - h / 2, width: w, height: h, rx: 6, ...extra });
  const lines = wrapText(title, 18).map((text) => ({ text, className: "fc-text" }));
  if (subtitle) lines.push({ text: subtitle, className: "fc-subtext" });
  return s("g", {}, shadowed(shape, fillClass), ...textLines(cx, cy, lines, 15));
}

export function diamond(cx, cy, label) {
  const { w, h } = SIZE.decision;
  const points = `${cx},${cy - h / 2} ${cx + w / 2},${cy} ${cx},${cy + h / 2} ${cx - w / 2},${cy}`;
  const shape = (extra) => s("polygon", { points, ...extra });
  const lines = wrapText(label, 13).map((text) => ({ text, className: "fc-text" }));
  return s("g", {}, shadowed(shape, "fc-decision"), ...textLines(cx, cy, lines, 15));
}

export function edge(pathData, { arrowStart = false } = {}) {
  return s("path", {
    class: "fc-edge",
    d: pathData,
    "marker-end": "url(#fc-arrow)",
    "marker-start": arrowStart ? "url(#fc-arrow)" : null,
  });
}

export function edgeLabel(x, y, text) {
  return s("text", { class: "fc-label", x, y }, text);
}

export function arrowDefinition() {
  return s(
    "defs",
    {},
    s(
      "marker",
      {
        id: "fc-arrow",
        viewBox: "0 0 10 10",
        refX: 8,
        refY: 5,
        markerWidth: 6,
        markerHeight: 6,
        orient: "auto-start-reverse",
      },
      s("path", { class: "fc-arrow-head", d: "M 0 0 L 10 5 L 0 10 z" })
    )
  );
}

/** Jumlah kotak paralel yang digambar untuk sebuah sumber daya. */
export function shownBoxes(capacity) {
  return Math.min(capacity, MAX_PARALLEL_SHOWN);
}

/** Label kotak paralel. Kotak terakhir merangkum sisa petugas bila kapasitas besar. */
export function parallelLabel(resource, boxIndex) {
  const collapsed = resource.capacity > MAX_PARALLEL_SHOWN && boxIndex === MAX_PARALLEL_SHOWN - 1;
  return collapsed
    ? `${resource.name} ${boxIndex + 1} sampai ${resource.capacity}`
    : `${resource.name} ${boxIndex + 1}`;
}

/** Judul dan subjudul kotak layanan, tergantung ada tidaknya kotak paralel. */
export function serviceLabels(stage, resource, boxCount, boxIndex) {
  return boxCount === 1
    ? { title: stage.name, subtitle: resource.name }
    : { title: parallelLabel(resource, boxIndex), subtitle: stage.name };
}
