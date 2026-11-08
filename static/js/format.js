/** Pemformat angka dan teks dalam gaya Indonesia. */

const numberFormats = new Map();

function formatterFor(digits) {
  if (!numberFormats.has(digits)) {
    numberFormats.set(
      digits,
      new Intl.NumberFormat("id-ID", { minimumFractionDigits: digits, maximumFractionDigits: digits })
    );
  }
  return numberFormats.get(digits);
}

export function formatNumber(value, digits = 2) {
  return formatterFor(digits).format(value);
}

export function formatPercent(fraction, digits = 1) {
  return `${formatNumber(fraction * 100, digits)}%`;
}

/** Format selang kepercayaan, misalnya "[1,20 sampai 3,40]". */
export function formatInterval(stat, digits = 2) {
  return `[${formatNumber(stat.ci_low, digits)} sampai ${formatNumber(stat.ci_high, digits)}]`;
}

/** Ubah teks bebas menjadi daftar angka. Koma dianggap pemisah desimal. */
export function parseNumbers(text) {
  return text
    .split(/[\s;]+/)
    .map((token) => token.replace(",", "."))
    .filter((token) => token !== "")
    .map(Number);
}
