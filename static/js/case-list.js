/** Daftar studi kasus: pakai, salin, ubah, hapus, ekspor, dan impor. */
import { $, h, clear } from "./dom.js";
import { cloneCase, isValidCaseShape, makeId } from "./case-utils.js";
import { deleteCase, getActiveCase, getCases, onStore, saveCase, setActiveCase } from "./cases-store.js";
import { describeDistribution } from "./distributions.js";
import { openEditor } from "./case-editor.js";
import { goToPage } from "./navigation.js";
import { showToast } from "./toast.js";

const host = $("#case-list");

function exportCase(studyCase) {
  const { builtin, ...data } = studyCase;
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  const link = h("a", { href: URL.createObjectURL(blob), download: `${data.id}.json` });
  link.click();
  setTimeout(() => URL.revokeObjectURL(link.href), 1000);
}

function action(label, handler, extraClass = "") {
  return h("button", { class: `btn btn-small ${extraClass}`, type: "button", onclick: handler }, label);
}

function copyCase(studyCase) {
  const copy = cloneCase(studyCase);
  saveCase(copy);
  showToast(`Salinan "${copy.name}" dibuat. Klik Ubah untuk mengeditnya.`);
}

function removeCase(studyCase) {
  if (window.confirm(`Hapus studi kasus "${studyCase.name}"?`)) {
    deleteCase(studyCase.id);
    showToast("Studi kasus dihapus.");
  }
}

function card(studyCase) {
  const isActive = studyCase.id === getActiveCase().id;
  const buttons = [
    action("Pakai", () => {
      setActiveCase(studyCase.id);
      goToPage("simulator");
    }, "btn-accent"),
    action("Salin", () => copyCase(studyCase)),
    action("Ekspor", () => exportCase(studyCase)),
  ];
  if (!studyCase.builtin) {
    buttons.push(action("Ubah", () => openEditor(studyCase)), action("Hapus", () => removeCase(studyCase), "btn-danger"));
  }
  return h(
    "article",
    { class: `card case-card${isActive ? " is-active" : ""}` },
    h("h3", {}, studyCase.name, h("span", { class: `chip ${studyCase.builtin ? "chip-blue" : "chip-green"}` }, studyCase.builtin ? "Bawaan" : "Buatan")),
    h("p", { class: "small" }, studyCase.description || "Tanpa deskripsi."),
    h(
      "ul",
      { class: "case-meta" },
      h("li", {}, `Kedatangan: ${describeDistribution(studyCase.arrival)}`),
      h("li", {}, `Sumber daya: ${studyCase.resources.map((r) => `${r.name} x${r.capacity}`).join(", ")}`),
      h("li", {}, `Tahap: ${studyCase.stages.map((st) => st.name).join(" > ")}`),
      h("li", {}, `${studyCase.max_entities} ${studyCase.entity_name.toLowerCase()} per simulasi`)
    ),
    h("div", { class: "btn-row" }, buttons)
  );
}

function render() {
  clear(host).append(...getCases().map(card));
}

async function importFile(file) {
  try {
    const parsed = JSON.parse(await file.text());
    const items = Array.isArray(parsed) ? parsed : [parsed];
    if (!items.length || !items.every(isValidCaseShape)) throw new Error("Format file tidak sesuai.");
    items.forEach((item) => saveCase({ ...item, id: makeId(), builtin: false }));
    showToast(`${items.length} studi kasus diimpor.`);
  } catch {
    showToast("File gagal diimpor. Pastikan formatnya JSON studi kasus QueueLab Simulator.", true);
  }
}

export function initCaseList() {
  render();
  onStore("cases", render);
  onStore("active", render);
  $("#case-new").addEventListener("click", () => openEditor());
  $("#case-import").addEventListener("change", async (event) => {
    const [file] = event.target.files;
    if (file) await importFile(file);
    event.target.value = "";
  });
}
