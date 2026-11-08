/** Definisi jenis distribusi: label, parameter, nilai bawaan, dan deskripsi teks. */
import { formatNumber } from "./format.js";

export const DISTRIBUTION_TYPES = {
  constant: {
    label: "Tetap",
    fields: [{ key: "value", label: "Nilai" }],
    defaults: { value: 5 },
  },
  exponential: {
    label: "Eksponensial",
    fields: [{ key: "mean", label: "Rata-rata" }],
    defaults: { mean: 5 },
  },
  uniform: {
    label: "Seragam",
    fields: [
      { key: "min", label: "Minimum" },
      { key: "max", label: "Maksimum" },
    ],
    defaults: { min: 2, max: 6 },
  },
  normal: {
    label: "Normal",
    fields: [
      { key: "mean", label: "Rata-rata" },
      { key: "std", label: "Simpangan baku" },
      { key: "min", label: "Batas bawah" },
    ],
    defaults: { mean: 8, std: 2, min: 1 },
  },
  triangular: {
    label: "Segitiga",
    fields: [
      { key: "min", label: "Minimum" },
      { key: "mode", label: "Paling sering" },
      { key: "max", label: "Maksimum" },
    ],
    defaults: { min: 2, mode: 4, max: 8 },
  },
  data: {
    label: "Data sendiri",
    fields: [],
    defaults: { values: [3, 4, 5], mode: "random" },
  },
};

export function defaultSpec(type) {
  return { type, ...structuredClone(DISTRIBUTION_TYPES[type].defaults) };
}

const n = (value) => formatNumber(value, Number.isInteger(value) ? 0 : 2);

/** Deskripsi singkat untuk ditampilkan di kartu dan daftar. */
export function describeDistribution(spec) {
  switch (spec.type) {
    case "constant":
      return `Tetap ${n(spec.value)}`;
    case "exponential":
      return `Eksponensial, rata-rata ${n(spec.mean)}`;
    case "uniform":
      return `Seragam ${n(spec.min)} sampai ${n(spec.max)}`;
    case "normal":
      return `Normal, rata-rata ${n(spec.mean)}, simpangan baku ${n(spec.std)}`;
    case "triangular":
      return `Segitiga ${n(spec.min)}, ${n(spec.mode)}, ${n(spec.max)}`;
    case "data": {
      const order = spec.mode === "random" ? "acak" : "berurutan";
      return `Data ${spec.values.length} nilai, ${order}`;
    }
    default:
      return "Tidak diketahui";
  }
}
