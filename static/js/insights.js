/**
 * Teks penjelasan untuk setiap diagram dan grafik.
 * Semua kalimat dihitung dari angka hasil simulasi, jadi isinya berubah mengikuti datanya.
 */
import { formatNumber as num, formatPercent as pct } from "./format.js";
import { binValues, busiestBin } from "./histogram.js";
import { MAX_PARALLEL_SHOWN } from "./flowchart-limits.js";

const CLOSE_TO_ZERO = 0.005;
const SKEW_RATIO = 1.3;
const LONG_IDLE_SHARE = 0.05;
const LOW_USAGE = 0.6;

const lower = (text) => text.toLowerCase();

/** Gabung daftar menjadi "A, B, dan C". */
function joinList(items) {
  if (items.length <= 1) return items.join("");
  return `${items.slice(0, -1).join(", ")} dan ${items.at(-1)}`;
}

const middleOf = (sortedValues) => {
  const middle = Math.floor(sortedValues.length / 2);
  return sortedValues.length % 2
    ? sortedValues[middle]
    : (sortedValues[middle - 1] + sortedValues[middle]) / 2;
};

const intervalText = (stat, scale = 1) =>
  stat.ci_high > stat.ci_low
    ? ` (selang 95%: ${num(stat.ci_low * scale, 1)} sampai ${num(stat.ci_high * scale, 1)}${scale === 100 ? "%" : ""})`
    : "";

// ----- Flowchart --------------------------------------------------------------

export function flowchartInsight(studyCase) {
  const entity = lower(studyCase.entity_name);
  const steps = studyCase.stages.map((stage) => `${stage.name} (${stage.resource})`);
  const lines = [
    `Satu ${entity} melewati ${studyCase.stages.length} tahap berurutan: ${joinList(steps)}.`,
    `Sebelum tiap tahap ada pengecekan petugas. Jika ada yang tersedia, ${entity} langsung dilayani. Jika semua sibuk, ${entity} menunggu lalu mengecek lagi.`,
  ];

  for (const resource of studyCase.resources) {
    const users = studyCase.stages.filter((stage) => stage.resource === resource.name);
    if (users.length === 0) continue;
    if (resource.capacity > 1) {
      lines.push(`${resource.name} punya ${resource.capacity} petugas yang bekerja bersamaan, jadi sampai ${resource.capacity} ${entity} bisa dilayani sekaligus.`);
    }
    if (resource.capacity > MAX_PARALLEL_SHOWN) {
      lines.push(`Pada gambar, ${resource.name} diringkas menjadi ${MAX_PARALLEL_SHOWN} kotak.`);
    }
    if (users.length > 1) {
      lines.push(`${resource.name} dipakai oleh ${users.length} tahap (${joinList(users.map((stage) => stage.name))}), jadi tahap-tahap itu berbagi satu antrian.`);
    }
  }
  return lines;
}

// ----- Grafik panjang antrian -------------------------------------------------

/** Rata-rata, puncak, dan porsi waktu antrian tidak kosong dari titik-titik grafik tangga. */
function queueStats(points, endTime) {
  let area = 0;
  let nonEmptyTime = 0;
  let max = 0;
  let maxTime = 0;
  points.forEach(([time, length], index) => {
    const next = index + 1 < points.length ? points[index + 1][0] : endTime;
    const duration = Math.max(0, next - time);
    area += length * duration;
    if (length > 0) nonEmptyTime += duration;
    if (length > max) {
      max = length;
      maxTime = time;
    }
  });
  return { average: area / endTime, share: nonEmptyTime / endTime, max, maxTime };
}

function queueLevelSentence(share) {
  if (share >= 0.5) return "Antrian hampir selalu ada, tanda sumber daya ini kewalahan.";
  if (share <= 0.15) return "Antrian jarang muncul dan cepat habis.";
  return "Antrian muncul sesekali, biasanya saat kedatangan mengelompok.";
}

export function queueInsight(detail, studyCase, unit) {
  const entity = lower(studyCase.entity_name);
  const stats = studyCase.resources.map((resource) => ({
    name: resource.name,
    ...queueStats(detail.queue_series[resource.name] ?? [[0, 0]], detail.end_time),
  }));
  const worst = stats.reduce((best, item) => (item.average > best.average ? item : best));
  if (worst.max === 0) {
    return [`Tidak ada antrian sama sekali pada replikasi ini. Semua ${entity} langsung dilayani begitu datang.`];
  }

  const lines = [
    `Antrian terpanjang ada di ${worst.name}: ${worst.max} ${entity} pada waktu ${num(worst.maxTime)} ${unit}. ` +
      `Rata-ratanya ${num(worst.average)} ${entity}, dan antrian tidak kosong selama ${pct(worst.share, 0)} waktu simulasi.`,
    queueLevelSentence(worst.share),
  ];
  const others = stats.filter((item) => item !== worst);
  const waiting = others.filter((item) => item.max > 0).map((item) => `${item.name} (puncak ${item.max})`);
  const calm = others.filter((item) => item.max === 0).map((item) => item.name);
  if (waiting.length) lines.push(`Antrian juga muncul di ${joinList(waiting)}.`);
  if (calm.length) lines.push(`Tidak pernah ada antrian di ${joinList(calm)}.`);
  return lines;
}

// ----- Grafik utilisasi -------------------------------------------------------

function usageLevelSentence(name, usage) {
  if (usage >= 0.95) return `${name} hampir tidak pernah menganggur. Sedikit lonjakan kedatangan saja bisa membuat antrian menumpuk.`;
  if (usage >= 0.8) return `${name} sangat sibuk tetapi masih punya sedikit jeda. Antrian muncul saat kedatangan mengelompok.`;
  if (usage >= 0.5) return `Beban ${name} wajar. Masih ada waktu menganggur untuk menyerap lonjakan kedatangan.`;
  return `${name} lebih sering menganggur. Kapasitasnya longgar, jumlah petugas mungkin bisa dikurangi.`;
}

/**
 * Peringatan beban menghitung kondisi jangka panjang, sedangkan utilisasi diukur pada simulasi yang
 * pendek. Bila keduanya tampak bertentangan, kalimat penjelasan harus menyebutkannya.
 */
function overloadNote(entityCount) {
  return `Peringatan beban di atas menghitung kondisi jangka panjang. Simulasi ini hanya ${entityCount} entitas, jadi utilisasi yang terukur bisa tampak lebih rendah dari beban sebenarnya.`;
}

export function utilizationInsight(resources, warnings = [], entityCount = 0) {
  const ranked = [...resources].sort((a, b) => b.utilization.mean - a.utilization.mean);
  const top = ranked[0];
  const flagged = warnings.some((text) => text.includes(top.name));
  const lines = [
    `${top.name} paling sibuk, bekerja ${pct(top.utilization.mean)} dari waktu simulasi${intervalText(top.utilization, 100)}.`,
    flagged ? overloadNote(entityCount) : usageLevelSentence(top.name, top.utilization.mean),
  ];
  if (ranked.length > 1) {
    lines.push(`Sumber daya lain: ${joinList(ranked.slice(1).map((item) => `${item.name} ${pct(item.utilization.mean)}`))}.`);
    const gap = top.utilization.mean - ranked[1].utilization.mean;
    if (gap >= 0.2) {
      lines.push(`Selisih ${num(gap * 100, 0)} poin dari sumber daya berikutnya menunjukkan ${top.name} adalah titik tersempit sistem.`);
    }
  }
  return lines;
}

// ----- Histogram waktu tunggu -------------------------------------------------

export function waitInsight(waits, studyCase, unit) {
  const entity = lower(studyCase.entity_name);
  const total = waits.length;
  const noWait = waits.filter((value) => value < CLOSE_TO_ZERO).length;
  if (noWait === total) return [`Semua ${total} ${entity} langsung dilayani tanpa menunggu.`];

  const sorted = [...waits].sort((a, b) => a - b);
  const mean = sorted.reduce((sum, value) => sum + value, 0) / total;
  const median = middleOf(sorted);
  const busiest = busiestBin(binValues(waits));
  const lines = [
    `${noWait} dari ${total} ${entity} (${pct(noWait / total, 0)}) tidak menunggu sama sekali. Yang terlama menunggu ${num(sorted.at(-1))} ${unit}.`,
    `Rata-rata menunggu ${num(mean)} ${unit} dan nilai tengahnya (median) ${num(median)} ${unit}.`,
    mean > median * SKEW_RATIO
      ? `Rata-rata lebih tinggi dari median, artinya beberapa ${entity} menunggu jauh lebih lama dari kebanyakan.`
      : `Lama menunggu cukup merata antar ${entity}.`,
    `Kelompok terbanyak ada di rentang ${num(busiest.from, 1)} sampai ${num(busiest.to, 1)} ${unit} (${busiest.count} ${entity}).`,
  ];
  return lines;
}

// ----- Diagram Gantt ----------------------------------------------------------

function ganttRows(detail, studyCase) {
  const rows = new Map();
  for (const item of detail.gantt) {
    const key = `${item.resource}:${item.slot}`;
    if (!rows.has(key)) {
      const capacity = studyCase.resources.find((resource) => resource.name === item.resource).capacity;
      rows.set(key, { label: capacity > 1 ? `${item.resource} ${item.slot + 1}` : item.resource, busy: 0, bars: [] });
    }
    const row = rows.get(key);
    row.busy += item.end - item.start;
    row.bars.push(item);
  }
  return [...rows.values()];
}

function longestIdle(row) {
  const bars = [...row.bars].sort((a, b) => a.start - b.start);
  let gap = 0;
  for (let i = 1; i < bars.length; i += 1) gap = Math.max(gap, bars[i].start - bars[i - 1].end);
  return gap;
}

export function ganttInsight(detail, studyCase, unit) {
  const entity = lower(studyCase.entity_name);
  const rows = ganttRows(detail, studyCase);
  const longest = detail.gantt.reduce((best, item) => (item.end - item.start > best.end - best.start ? item : best));
  const longestRow = rows.find((row) => row.bars.includes(longest));
  const lines = [
    `Batang terpanjang: ${longestRow.label} mengerjakan tahap ${longest.stage} untuk ${entity} nomor ${longest.entity} selama ` +
      `${num(longest.end - longest.start)} ${unit} (dari waktu ${num(longest.start)} sampai ${num(longest.end)}).`,
  ];

  const byBusy = [...rows].sort((a, b) => b.busy - a.busy);
  const [busiest, calmest] = [byBusy[0], byBusy.at(-1)];
  if (busiest !== calmest) {
    lines.push(
      `${busiest.label} paling sibuk (${pct(busiest.busy / detail.end_time, 0)} dari ${num(detail.end_time)} ${unit}), ` +
        `${calmest.label} paling longgar (${pct(calmest.busy / detail.end_time, 0)}).`
    );
  }

  const idleRow = rows.reduce((best, row) => (longestIdle(row) > longestIdle(best) ? row : best));
  const idle = longestIdle(idleRow);
  if (idle >= detail.end_time * LONG_IDLE_SHARE) {
    lines.push(`Jeda kosong terlama ada di ${idleRow.label}: ${num(idle)} ${unit} tanpa pekerjaan di antara dua batang.`);
  }
  return lines;
}

// ----- Skenario kapasitas -----------------------------------------------------

export function scenarioWaitInsight(outcome) {
  const { scenarios, resource, time_unit: unit } = outcome;
  if (scenarios.length < 2) return ["Hanya satu kapasitas yang dibandingkan. Pilih rentang lebih lebar untuk melihat selisihnya."];

  const first = scenarios[0];
  const last = scenarios.at(-1);
  const change = first.avg_wait.mean - last.avg_wait.mean;
  const percent = first.avg_wait.mean > 0 ? `, ${num((Math.abs(change) / first.avg_wait.mean) * 100, 0)}%` : "";
  const lines = [
    `Dengan ${first.capacity} ${resource}, rata-rata waktu tunggu ${num(first.avg_wait.mean)} ${unit}. ` +
      `Dengan ${last.capacity} ${resource} menjadi ${num(last.avg_wait.mean)} ${unit} ` +
      `(${change >= 0 ? "turun" : "naik"} ${num(Math.abs(change))} ${unit}${percent}).`,
  ];

  const drops = scenarios.slice(1).map((item, index) => ({
    from: scenarios[index].capacity,
    to: item.capacity,
    value: scenarios[index].avg_wait.mean - item.avg_wait.mean,
  }));
  const biggest = drops.reduce((best, item) => (item.value > best.value ? item : best));
  lines.push(`Penambahan paling berpengaruh adalah dari ${biggest.from} ke ${biggest.to} ${resource}, turun ${num(biggest.value)} ${unit}.`);
  const lastDrop = drops.at(-1);
  if (drops.length > 1 && lastDrop !== biggest) {
    const weak = lastDrop.value < biggest.value * 0.25 ? ", jadi tambahan petugas mulai kurang bermanfaat" : "";
    lines.push(`Dari ${lastDrop.from} ke ${lastDrop.to} ${resource}, penurunannya tinggal ${num(lastDrop.value)} ${unit}${weak}.`);
  }
  return lines;
}

export function scenarioUsageInsight(outcome) {
  const { scenarios, resource } = outcome;
  const first = scenarios[0];
  const last = scenarios.at(-1);
  if (first === last) return [`Dengan ${first.capacity} ${resource}, utilisasinya ${pct(first.utilization.mean)}.`];

  const direction = last.utilization.mean <= first.utilization.mean ? "turun" : "naik";
  const lines = [
    `Utilisasi ${resource} ${direction} dari ${pct(first.utilization.mean)} (${first.capacity} petugas) menjadi ${pct(last.utilization.mean)} (${last.capacity} petugas) karena pekerjaan dibagi ke lebih banyak petugas.`,
  ];
  if (first.utilization.mean >= 0.95) {
    lines.push(`Dengan ${first.capacity} ${resource}, hampir tidak ada jeda, tanda kapasitas terlalu kecil.`);
  }
  const idle = scenarios.find((item) => item.utilization.mean < LOW_USAGE);
  lines.push(
    idle
      ? `Mulai ${idle.capacity} ${resource}, utilisasi di bawah ${pct(LOW_USAGE, 0)}, jadi sebagian petugas sering menganggur.`
      : `Utilisasi tetap di atas ${pct(LOW_USAGE, 0)} pada semua kapasitas, jadi petugas tambahan masih terpakai.`
  );
  return lines;
}

// ----- Data historis ----------------------------------------------------------

export function dataInsight(analysis, values, unit) {
  const busiest = busiestBin(binValues(values));
  const lines = [
    `Dari ${analysis.count} data, kelompok terbanyak ada di rentang ${num(busiest.from, 1)} sampai ${num(busiest.to, 1)} ${unit} ` +
      `(${busiest.count} data, ${pct(busiest.count / analysis.count, 0)}).`,
  ];

  const tilt = (analysis.mean - analysis.median) / (analysis.std || 1);
  if (tilt > 0.15) {
    lines.push(`Rata-rata (${num(analysis.mean)}) lebih tinggi dari median (${num(analysis.median)}), jadi ada beberapa nilai besar yang menarik rata-rata ke kanan.`);
  } else if (tilt < -0.15) {
    lines.push(`Rata-rata (${num(analysis.mean)}) lebih rendah dari median (${num(analysis.median)}), jadi ada beberapa nilai kecil yang menarik rata-rata ke kiri.`);
  } else {
    lines.push(`Rata-rata dan median hampir sama, jadi bentuk data relatif simetris.`);
  }

  if (analysis.cv < 0.3) lines.push(`Koefisien variasi ${num(analysis.cv)} kecil, artinya waktunya cukup seragam.`);
  else if (analysis.cv >= 0.8) lines.push(`Koefisien variasi ${num(analysis.cv)} besar, artinya waktunya sangat bervariasi. Nilai sekitar 1 biasanya cocok dengan distribusi eksponensial.`);
  else lines.push(`Koefisien variasi ${num(analysis.cv)} sedang, artinya variasi waktunya wajar.`);

  if (analysis.count < 30) lines.push(`Datanya baru ${analysis.count}, jadi bentuk histogram bisa berubah banyak jika data ditambah.`);
  return lines;
}
