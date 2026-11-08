/** Komponen formulir untuk memilih jenis distribusi dan mengisi parameternya. */
import { h, clear } from "./dom.js";
import { DISTRIBUTION_TYPES, defaultSpec } from "./distributions.js";
import { parseNumbers } from "./format.js";

function numberField(field, value) {
  const input = h("input", { class: "input", type: "number", min: 0, step: "any", value, "data-key": field.key });
  return { element: h("label", { class: "field" }, h("span", { class: "field-label" }, field.label), input), input };
}

function dataFields(spec) {
  const textarea = h("textarea", { class: "input mono", rows: 3, "data-key": "values" }, spec.values.join(" "));
  const mode = h(
    "select",
    { class: "input", "data-key": "mode" },
    h("option", { value: "random", selected: spec.mode === "random" }, "Diambil acak"),
    h("option", { value: "sequence", selected: spec.mode === "sequence" }, "Dipakai berurutan")
  );
  return {
    elements: [
      h("label", { class: "field" }, h("span", { class: "field-label" }, "Nilai data (pisahkan dengan spasi atau baris baru)"), textarea),
      h("label", { class: "field" }, h("span", { class: "field-label" }, "Cara pemakaian"), mode),
    ],
    read: () => {
      const values = parseNumbers(textarea.value);
      if (values.length === 0 || values.some((value) => Number.isNaN(value))) {
        throw new Error("Data harus berisi angka saja dan minimal satu nilai.");
      }
      return { values, mode: mode.value };
    },
  };
}

/** Buat editor distribusi. read() mengembalikan spesifikasi atau melempar Error jika isinya salah. */
export function createDistributionEditor(initialSpec) {
  const typeSelect = h(
    "select",
    { class: "input" },
    Object.entries(DISTRIBUTION_TYPES).map(([key, definition]) =>
      h("option", { value: key, selected: key === initialSpec.type }, definition.label)
    )
  );
  const params = h("div", { class: "field-grid" });
  let reader = () => ({});

  function renderParams(spec) {
    clear(params);
    if (spec.type === "data") {
      const data = dataFields(spec);
      params.append(...data.elements);
      reader = data.read;
      return;
    }
    const fields = DISTRIBUTION_TYPES[spec.type].fields.map((field) => numberField(field, spec[field.key]));
    params.append(...fields.map((field) => field.element));
    reader = () =>
      Object.fromEntries(
        DISTRIBUTION_TYPES[spec.type].fields.map((field, index) => {
          const value = Number(fields[index].input.value);
          if (fields[index].input.value === "" || Number.isNaN(value)) {
            throw new Error(`Isi angka untuk "${field.label}".`);
          }
          return [field.key, value];
        })
      );
  }

  typeSelect.addEventListener("change", () => renderParams(defaultSpec(typeSelect.value)));
  renderParams({ ...defaultSpec(initialSpec.type), ...initialSpec });

  return {
    element: h("div", {}, h("label", { class: "field" }, h("span", { class: "field-label" }, "Jenis distribusi"), typeSelect), params),
    read: () => ({ type: typeSelect.value, ...reader() }),
  };
}
