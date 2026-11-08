/** Pengelompokan nilai ke dalam kelas histogram. Dipakai grafik dan teks penjelasannya. */

const MIN_BINS = 3;
const MAX_BINS = 10;

/** Aturan Sturges: jumlah kelas = 1 + log2(n), dibatasi supaya grafik tetap terbaca. */
export function binValues(values) {
  const bins = Math.max(MIN_BINS, Math.min(MAX_BINS, Math.ceil(1 + Math.log2(values.length))));
  const low = Math.min(...values);
  const high = Math.max(...values);
  const span = high > low ? (high - low) / bins : 1;
  const counts = new Array(bins).fill(0);
  for (const value of values) counts[Math.min(Math.floor((value - low) / span), bins - 1)] += 1;
  return { bins, low, span, counts };
}

/** Kelas dengan data terbanyak, lengkap dengan batas bawah dan atasnya. */
export function busiestBin({ low, span, counts }) {
  const index = counts.indexOf(Math.max(...counts));
  return { count: counts[index], from: low + span * index, to: low + span * (index + 1) };
}
