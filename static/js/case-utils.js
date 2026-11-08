/** Fungsi bantu untuk objek studi kasus. */
import { defaultSpec } from "./distributions.js";

const COLOR_COUNT = 6;

export function resourceClass(index) {
  return `fc-res-${(index % COLOR_COUNT) + 1}`;
}

export function resourceColor(index) {
  return `var(--c-res-${(index % COLOR_COUNT) + 1})`;
}

export function resourceChipClass(index) {
  return ["chip-blue", "chip-orange", "chip-purple", "chip-green", "chip-yellow", "chip-blue"][
    index % COLOR_COUNT
  ];
}

export function makeId() {
  return `kasus-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
}

export function cloneCase(source) {
  const copy = structuredClone(source);
  copy.id = makeId();
  copy.builtin = false;
  copy.name = `${source.name} (salinan)`.slice(0, 40);
  return copy;
}

export function newCaseTemplate() {
  return {
    id: makeId(),
    builtin: false,
    name: "",
    description: "",
    entity_name: "Pelanggan",
    time_unit: "menit",
    max_entities: 20,
    arrival: defaultSpec("exponential"),
    resources: [{ name: "Petugas", capacity: 1 }],
    stages: [{ name: "Layanan", resource: "Petugas", service: defaultSpec("normal") }],
  };
}

/** Ambil hanya field yang dibutuhkan server. */
export function toPayload(studyCase) {
  const { name, entity_name, time_unit, max_entities, arrival, resources, stages } = studyCase;
  return { name, entity_name, time_unit, max_entities, arrival, resources, stages };
}

/** Pastikan objek hasil impor memiliki bentuk dasar yang benar sebelum disimpan. */
export function isValidCaseShape(value) {
  return Boolean(
    value &&
      typeof value.name === "string" &&
      value.arrival &&
      Array.isArray(value.resources) &&
      Array.isArray(value.stages)
  );
}

/** Daftar target distribusi (kedatangan dan tiap tahap) untuk dipilih di halaman Data Historis. */
export function distributionTargets(studyCase) {
  return [
    { id: "arrival", label: "Waktu antar-kedatangan" },
    ...studyCase.stages.map((stage, index) => ({ id: `stage-${index}`, label: `Layanan ${stage.name}` })),
  ];
}

export function setDistribution(studyCase, targetId, spec) {
  if (targetId === "arrival") {
    studyCase.arrival = spec;
  } else {
    studyCase.stages[Number(targetId.split("-")[1])].service = spec;
  }
}
