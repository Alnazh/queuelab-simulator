/** Membuat flowchart (SVG) dari sebuah studi kasus. Mendatar bila muat, vertikal bila layar sempit. */
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
import { buildVerticalFlowchart } from "./flowchart-vertical.js";

const GAP = 64;
const PARALLEL_SPACING = 78;
const WAIT_OFFSET = 150;

// ----- Tata letak mendatar ------------------------------------------------

/** Daftar kolom dari kiri ke kanan, masing-masing dengan jenis dan lebarnya. */
function planColumns(studyCase) {
  const byName = new Map(studyCase.resources.map((resource, index) => [resource.name, { resource, index }]));
  const columns = [
    { kind: "start", width: SIZE.terminator.w },
    { kind: "arrival", width: SIZE.process.w },
  ];
  studyCase.stages.forEach((stage) => {
    const { resource, index } = byName.get(stage.resource);
    columns.push({ kind: "decision", width: SIZE.decision.w, resource });
    columns.push({
      kind: "service",
      width: SIZE.process.w,
      stage,
      resource,
      colorClass: resourceClass(index),
      boxes: shownBoxes(resource.capacity),
    });
  });
  columns.push({ kind: "leave", width: SIZE.process.w });
  columns.push({ kind: "end", width: SIZE.terminator.w });

  let cursor = PAD;
  for (const column of columns) {
    column.left = cursor;
    column.cx = cursor + column.width / 2;
    column.right = cursor + column.width;
    cursor += column.width + GAP;
  }
  return { columns, totalWidth: cursor - GAP + PAD + SHADOW };
}

function boxCenters(column, centerY) {
  return Array.from(
    { length: column.boxes },
    (_, i) => centerY + (i - (column.boxes - 1) / 2) * PARALLEL_SPACING
  );
}

function drawColumn(column, studyCase, centerY, waitY) {
  switch (column.kind) {
    case "start":
      return [terminator(column.cx, centerY, "Mulai", "fc-start")];
    case "arrival":
      return [box(column.cx, centerY, { title: `Kedatangan ${studyCase.entity_name}`, fillClass: "fc-arrival" })];
    case "decision":
      return drawDecision(column, centerY, waitY);
    case "service":
      return boxCenters(column, centerY).map((y, i) =>
        box(column.cx, y, {
          ...serviceLabels(column.stage, column.resource, column.boxes, i),
          fillClass: column.colorClass,
        })
      );
    case "leave":
      return [box(column.cx, centerY, { title: `${studyCase.entity_name} pergi`, fillClass: "fc-leave" })];
    default:
      return [terminator(column.cx, centerY, "Selesai", "fc-end")];
  }
}

function drawDecision(column, centerY, waitY) {
  const bottom = centerY + SIZE.decision.h / 2;
  return [
    diamond(column.cx, centerY, `Ada ${column.resource.name} tersedia?`),
    box(column.cx, waitY, {
      title: `Menunggu ${column.resource.name}`,
      subtitle: "lalu cek ulang",
      fillClass: "fc-wait",
      kind: "wait",
    }),
    edge(`M ${column.cx} ${bottom} V ${waitY - SIZE.wait.h / 2}`, { arrowStart: true }),
    edgeLabel(column.cx + 28, bottom + 30, "Tidak"),
  ];
}

/** Garis dari satu kolom ke kolom berikutnya, termasuk percabangan ke kotak paralel. */
function drawConnection(from, to, centerY) {
  const bend = from.right + GAP / 2;
  if (to.kind === "service" && to.boxes > 1) {
    return boxCenters(to, centerY).map((y) => edge(`M ${from.right} ${centerY} H ${bend} V ${y} H ${to.left}`));
  }
  if (from.kind === "service" && from.boxes > 1) {
    return boxCenters(from, centerY).map((y) => edge(`M ${from.right} ${y} H ${bend} V ${centerY} H ${to.left}`));
  }
  return [edge(`M ${from.right} ${centerY} H ${to.left}`)];
}

function buildHorizontalFlowchart(studyCase, plan) {
  const { columns, totalWidth } = plan;
  const maxBoxes = Math.max(1, ...columns.filter((c) => c.kind === "service").map((c) => c.boxes));
  const spread = ((maxBoxes - 1) / 2) * PARALLEL_SPACING;
  const centerY = PAD + spread + SIZE.process.h / 2;
  const waitY = centerY + WAIT_OFFSET;
  const height = waitY + SIZE.wait.h / 2 + PAD + SHADOW;

  const svg = s("svg", {
    xmlns: "http://www.w3.org/2000/svg",
    viewBox: `0 0 ${totalWidth} ${height}`,
    width: totalWidth,
    height,
    role: "img",
    "aria-label": `Flowchart ${studyCase.name}`,
  });
  svg.append(arrowDefinition());

  columns.forEach((column, index) => {
    if (index > 0) svg.append(...drawConnection(columns[index - 1], column, centerY));
  });
  columns.forEach((column) => {
    svg.append(...drawColumn(column, studyCase, centerY, waitY));
    if (column.kind === "service") {
      svg.append(edgeLabel(column.left - GAP + 18, centerY - 12, "Ya"));
    }
  });
  return svg;
}

/**
 * Bangun flowchart lengkap. Jika versi mendatar lebih lebar dari ruang yang tersedia,
 * diagram otomatis disusun ke bawah supaya tidak perlu digeser.
 */
export function buildFlowchart(studyCase, availableWidth) {
  const plan = planColumns(studyCase);
  if (plan.totalWidth > availableWidth) return buildVerticalFlowchart(studyCase);
  return buildHorizontalFlowchart(studyCase, plan);
}
