/** Flowchart vertikal (atas ke bawah), dipakai saat layar terlalu sempit untuk tata letak mendatar. */
import { s } from "./dom.js";
import { resourceClass } from "./case-utils.js";
import {
  PAD,
  SHADOW,
  SIZE,
  arrowDefinition,
  box,
  diamond,
  edge,
  edgeLabel,
  serviceLabels,
  shownBoxes,
  terminator,
} from "./flowchart-shapes.js";

const ROW_GAP = 54;
const SIDE_GAP = 44;
const PARALLEL_SPACING = 170;
const GRID_COLUMNS = 3;
const GRID_GAP = 16;
const GROUP_PAD = 12;
const FAN_OUT_LIMIT = 3;

/**
 * Susunan kotak petugas paralel. Sampai 3 kotak dibuat sejajar dengan percabangan garis.
 * Lebih dari itu disusun dalam kotak putus-putus berisi grid, supaya diagram tidak terlalu lebar.
 */
function serviceLayout(resource) {
  const boxes = shownBoxes(resource.capacity);
  const grouped = boxes > FAN_OUT_LIMIT;
  const cols = grouped ? GRID_COLUMNS : boxes;
  const gridRows = Math.ceil(boxes / cols);
  const gridHeight = gridRows * SIZE.process.h + (gridRows - 1) * GRID_GAP;
  return { boxes, grouped, cols, gridRows, height: grouped ? gridHeight + 2 * GROUP_PAD : gridHeight };
}

/** Daftar baris dari atas ke bawah, lengkap dengan posisi vertikalnya. */
function planRows(studyCase) {
  const byName = new Map(studyCase.resources.map((resource, index) => [resource.name, { resource, index }]));
  const rows = [
    { kind: "start", height: SIZE.terminator.h },
    { kind: "arrival", height: SIZE.process.h },
  ];
  studyCase.stages.forEach((stage) => {
    const { resource, index } = byName.get(stage.resource);
    rows.push({ kind: "decision", height: SIZE.decision.h, resource });
    rows.push({ kind: "service", stage, resource, colorClass: resourceClass(index), ...serviceLayout(resource) });
  });
  rows.push({ kind: "leave", height: SIZE.process.h });
  rows.push({ kind: "end", height: SIZE.terminator.h });

  let cursor = PAD;
  for (const row of rows) {
    row.top = cursor;
    row.cy = cursor + row.height / 2;
    row.bottom = cursor + row.height;
    cursor += row.height + ROW_GAP;
  }
  return { rows, totalHeight: cursor - ROW_GAP + PAD + SHADOW };
}

/** Titik tengah tiap kotak paralel dalam satu baris layanan. */
function boxCenters(row, cx) {
  const offsetTop = row.top + (row.grouped ? GROUP_PAD : 0) + SIZE.process.h / 2;
  return Array.from({ length: row.boxes }, (_, i) => ({
    x: cx + ((i % row.cols) - (row.cols - 1) / 2) * PARALLEL_SPACING,
    y: offsetTop + Math.floor(i / row.cols) * (SIZE.process.h + GRID_GAP),
  }));
}

/** Kotak putus-putus yang membingkai grid petugas paralel. */
function groupFrame(row, cx) {
  const half = ((row.cols - 1) / 2) * PARALLEL_SPACING + SIZE.process.w / 2 + GROUP_PAD;
  return s("rect", { class: "fc-group", x: cx - half, y: row.top, width: half * 2, height: row.height, rx: 10 });
}

/** Lebar kiri dan kanan dari garis tengah, supaya semua bentuk muat di dalam gambar. */
function measureSides(rows) {
  const widest = Math.max(1, ...rows.filter((row) => row.kind === "service").map((row) => row.cols));
  const parallelHalf = ((widest - 1) / 2) * PARALLEL_SPACING + SIZE.process.w / 2 + GROUP_PAD;
  const waitOffset = SIZE.decision.w / 2 + SIDE_GAP + SIZE.wait.w / 2;
  return {
    left: Math.max(parallelHalf, SIZE.decision.w / 2),
    right: Math.max(parallelHalf, waitOffset + SIZE.wait.w / 2),
    waitOffset,
  };
}

function drawRow(row, studyCase, cx, waitOffset) {
  switch (row.kind) {
    case "start":
      return [terminator(cx, row.cy, "Mulai", "fc-start")];
    case "arrival":
      return [box(cx, row.cy, { title: `Kedatangan ${studyCase.entity_name}`, fillClass: "fc-arrival" })];
    case "decision":
      return drawDecision(row, cx, waitOffset);
    case "service":
      return [
        ...(row.grouped ? [groupFrame(row, cx)] : []),
        ...boxCenters(row, cx).map(({ x, y }, i) =>
          box(x, y, { ...serviceLabels(row.stage, row.resource, row.boxes, i), fillClass: row.colorClass })
        ),
      ];
    case "leave":
      return [box(cx, row.cy, { title: `${studyCase.entity_name} pergi`, fillClass: "fc-leave" })];
    default:
      return [terminator(cx, row.cy, "Selesai", "fc-end")];
  }
}

function drawDecision(row, cx, waitOffset) {
  const waitCx = cx + waitOffset;
  const diamondRight = cx + SIZE.decision.w / 2;
  return [
    diamond(cx, row.cy, `Ada ${row.resource.name} tersedia?`),
    box(waitCx, row.cy, {
      title: `Menunggu ${row.resource.name}`,
      subtitle: "lalu cek ulang",
      fillClass: "fc-wait",
      kind: "wait",
    }),
    edge(`M ${diamondRight} ${row.cy} H ${waitCx - SIZE.wait.w / 2}`, { arrowStart: true }),
    edgeLabel(diamondRight + SIDE_GAP / 2, row.cy - 10, "Tidak"),
  ];
}

/** Garis dari satu baris ke baris berikutnya, termasuk percabangan ke kotak paralel. */
function drawConnection(from, to, cx) {
  const middle = from.bottom + ROW_GAP / 2;
  if (to.kind === "service" && to.boxes > 1 && !to.grouped) {
    return boxCenters(to, cx).map(({ x }) => edge(`M ${cx} ${from.bottom} V ${middle} H ${x} V ${to.top}`));
  }
  if (from.kind === "service" && from.boxes > 1 && !from.grouped) {
    return boxCenters(from, cx).map(({ x }) => edge(`M ${x} ${from.bottom} V ${middle} H ${cx} V ${to.top}`));
  }
  return [edge(`M ${cx} ${from.bottom} V ${to.top}`)];
}

export function buildVerticalFlowchart(studyCase) {
  const { rows, totalHeight } = planRows(studyCase);
  const sides = measureSides(rows);
  const cx = PAD + sides.left;
  const width = PAD + sides.left + sides.right + PAD + SHADOW;

  const svg = s("svg", {
    xmlns: "http://www.w3.org/2000/svg",
    class: "fc-vertical",
    viewBox: `0 0 ${width} ${totalHeight}`,
    width,
    height: totalHeight,
    role: "img",
    "aria-label": `Flowchart ${studyCase.name}`,
  });
  svg.append(arrowDefinition());

  rows.forEach((row, index) => {
    if (index > 0) svg.append(...drawConnection(rows[index - 1], row, cx));
  });
  rows.forEach((row) => {
    svg.append(...drawRow(row, studyCase, cx, sides.waitOffset));
    if (row.kind === "service") svg.append(edgeLabel(cx + 18, row.top - 14, "Ya"));
  });
  return svg;
}
