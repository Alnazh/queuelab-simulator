/** Formulir untuk membuat dan mengubah studi kasus. */
import { $, h, clear } from "./dom.js";
import { runSimulation } from "./api.js";
import { newCaseTemplate, toPayload } from "./case-utils.js";
import { saveCase, setActiveCase } from "./cases-store.js";
import { defaultSpec } from "./distributions.js";
import { createDistributionEditor } from "./distribution-editor.js";
import { goToPage } from "./navigation.js";
import { showToast } from "./toast.js";

const MAX_RESOURCES = 8;
const MAX_STAGES = 8;

const el = {
  panel: $("#case-editor"),
  title: $("#editor-title"),
  form: $("#editor-form"),
  name: $("#editor-name"),
  entity: $("#editor-entity"),
  unit: $("#editor-unit"),
  entities: $("#editor-entities"),
  description: $("#editor-description"),
  arrival: $("#editor-arrival"),
  resources: $("#editor-resources"),
  stages: $("#editor-stages"),
  error: $("#editor-error"),
};

let editingId = null;
let arrivalEditor = null;
let resourceRows = [];
let stageRows = [];

function showError(message) {
  el.error.textContent = message;
  el.error.hidden = !message;
}

// ----- Baris sumber daya ----------------------------------------------------

function resourceLabel(row, index) {
  return row.nameInput.value.trim() || `Sumber daya ${index + 1}`;
}

function refreshResourceOptions() {
  for (const stage of stageRows) {
    const selected = stage.resourceSelect.value;
    clear(stage.resourceSelect).append(
      ...resourceRows.map((row, index) => h("option", { value: index, selected: String(index) === selected }, resourceLabel(row, index)))
    );
  }
}

function addResourceRow(resource) {
  const nameInput = h("input", { class: "input", type: "text", maxlength: 40, value: resource.name, "aria-label": "Nama sumber daya" });
  const capacityInput = h("input", { class: "input", type: "number", min: 1, max: 20, step: 1, value: resource.capacity, "aria-label": "Kapasitas" });
  const row = { nameInput, capacityInput };
  row.element = h(
    "div",
    { class: "row-card" },
    h(
      "div",
      { class: "field-grid" },
      h("label", { class: "field" }, h("span", { class: "field-label" }, "Nama"), nameInput),
      h("label", { class: "field" }, h("span", { class: "field-label" }, "Kapasitas (jumlah petugas)"), capacityInput)
    ),
    h("div", { class: "row-card-actions" }, h("button", { class: "btn btn-small btn-danger", type: "button", onclick: () => removeResource(row) }, "Hapus"))
  );
  nameInput.addEventListener("input", refreshResourceOptions);
  resourceRows.push(row);
  el.resources.append(row.element);
  refreshResourceOptions();
}

function removeResource(row) {
  if (resourceRows.length === 1) {
    showError("Minimal harus ada satu sumber daya.");
    return;
  }
  const removedIndex = resourceRows.indexOf(row);
  resourceRows = resourceRows.filter((item) => item !== row);
  row.element.remove();
  for (const stage of stageRows) {
    const current = Number(stage.resourceSelect.value);
    stage.resourceSelect.value = String(current === removedIndex ? 0 : current > removedIndex ? current - 1 : current);
  }
  refreshResourceOptions();
}

// ----- Baris tahap ----------------------------------------------------------

function addStageRow(stage, resourceIndex) {
  const nameInput = h("input", { class: "input", type: "text", maxlength: 40, value: stage.name, "aria-label": "Nama tahap" });
  const resourceSelect = h("select", { class: "input", "aria-label": "Sumber daya tahap" });
  const editor = createDistributionEditor(stage.service);
  const row = { nameInput, resourceSelect, editor };
  row.element = h(
    "div",
    { class: "row-card" },
    h(
      "div",
      { class: "field-grid" },
      h("label", { class: "field" }, h("span", { class: "field-label" }, "Nama tahap"), nameInput),
      h("label", { class: "field" }, h("span", { class: "field-label" }, "Dilayani oleh"), resourceSelect)
    ),
    h("p", { class: "field-label" }, "Waktu layanan"),
    editor.element,
    h(
      "div",
      { class: "row-card-actions" },
      h("button", { class: "btn btn-small", type: "button", onclick: () => moveStage(row, -1) }, "Naik"),
      h("button", { class: "btn btn-small", type: "button", onclick: () => moveStage(row, 1) }, "Turun"),
      h("button", { class: "btn btn-small btn-danger", type: "button", onclick: () => removeStage(row) }, "Hapus")
    )
  );
  stageRows.push(row);
  el.stages.append(row.element);
  resourceSelect.value = String(resourceIndex);
  refreshResourceOptions();
  resourceSelect.value = String(resourceIndex);
}

function moveStage(row, delta) {
  const index = stageRows.indexOf(row);
  const target = index + delta;
  if (target < 0 || target >= stageRows.length) return;
  [stageRows[index], stageRows[target]] = [stageRows[target], stageRows[index]];
  el.stages.append(...stageRows.map((item) => item.element));
}

function removeStage(row) {
  if (stageRows.length === 1) {
    showError("Minimal harus ada satu tahap layanan.");
    return;
  }
  stageRows = stageRows.filter((item) => item !== row);
  row.element.remove();
}

// ----- Membuka dan menyimpan ------------------------------------------------

export function openEditor(existing = null) {
  const studyCase = existing ? structuredClone(existing) : newCaseTemplate();
  editingId = studyCase.id;
  el.title.textContent = existing ? `Ubah: ${existing.name}` : "Studi kasus baru";
  el.name.value = studyCase.name;
  el.entity.value = studyCase.entity_name;
  el.unit.value = studyCase.time_unit;
  el.entities.value = studyCase.max_entities;
  el.description.value = studyCase.description ?? "";
  showError("");

  arrivalEditor = createDistributionEditor(studyCase.arrival);
  clear(el.arrival).append(arrivalEditor.element);

  resourceRows = [];
  stageRows = [];
  clear(el.resources);
  clear(el.stages);
  studyCase.resources.forEach(addResourceRow);
  const indexByName = new Map(studyCase.resources.map((resource, index) => [resource.name, index]));
  studyCase.stages.forEach((stage) => addStageRow(stage, indexByName.get(stage.resource) ?? 0));

  el.panel.hidden = false;
  el.panel.scrollIntoView({ behavior: "smooth", block: "start" });
}

function closeEditor() {
  el.panel.hidden = true;
  editingId = null;
}

/** Baca isi formulir menjadi objek studi kasus. Melempar Error jika ada isian yang salah. */
function readForm() {
  const resources = resourceRows.map((row, index) => ({
    name: resourceLabel(row, index),
    capacity: Number(row.capacityInput.value),
  }));
  const stages = stageRows.map((row, index) => ({
    name: row.nameInput.value.trim() || `Tahap ${index + 1}`,
    resource: resources[Number(row.resourceSelect.value)].name,
    service: row.editor.read(),
  }));
  return {
    id: editingId,
    builtin: false,
    name: el.name.value.trim(),
    description: el.description.value.trim(),
    entity_name: el.entity.value.trim(),
    time_unit: el.unit.value,
    max_entities: Number(el.entities.value),
    arrival: arrivalEditor.read(),
    resources,
    stages,
  };
}

async function submit(event) {
  event.preventDefault();
  showError("");
  try {
    const studyCase = readForm();
    // Uji coba satu replikasi supaya kesalahan parameter ketahuan sebelum disimpan.
    await runSimulation({ case: toPayload(studyCase), replications: 1, seed: 1 });
    saveCase(studyCase);
    setActiveCase(studyCase.id);
    closeEditor();
    goToPage("simulator");
    showToast(`Studi kasus "${studyCase.name}" disimpan.`);
  } catch (error) {
    showError(error.message);
  }
}

export function initCaseEditor() {
  el.form.addEventListener("submit", submit);
  $("#editor-cancel").addEventListener("click", closeEditor);
  $("#editor-cancel-bottom").addEventListener("click", closeEditor);
  $("#add-resource").addEventListener("click", () => {
    if (resourceRows.length >= MAX_RESOURCES) return showError(`Sumber daya maksimal ${MAX_RESOURCES}.`);
    addResourceRow({ name: `Sumber daya ${resourceRows.length + 1}`, capacity: 1 });
  });
  $("#add-stage").addEventListener("click", () => {
    if (stageRows.length >= MAX_STAGES) return showError(`Tahap maksimal ${MAX_STAGES}.`);
    addStageRow({ name: `Tahap ${stageRows.length + 1}`, service: defaultSpec("exponential") }, 0);
  });
}
