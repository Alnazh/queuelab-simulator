/** Uji teks penjelasan grafik. Jalankan dengan: node --test tests/insights.test.mjs */
import assert from "node:assert/strict";
import test from "node:test";

import {
  dataInsight,
  flowchartInsight,
  queueInsight,
  scenarioUsageInsight,
  scenarioWaitInsight,
  utilizationInsight,
  waitInsight,
} from "../static/js/insights.js";

const workshop = {
  entity_name: "Mobil",
  resources: [
    { name: "Resepsionis", capacity: 1 },
    { name: "Montir", capacity: 2 },
  ],
  stages: [
    { name: "Pendaftaran", resource: "Resepsionis" },
    { name: "Perbaikan", resource: "Montir" },
    { name: "Pembayaran", resource: "Resepsionis" },
  ],
};

const joined = (lines) => lines.join(" ");
const stat = (mean, low = mean, high = mean) => ({ mean, ci_low: low, ci_high: high });

test("flowchart menyebut tahap, petugas paralel, dan sumber daya bersama", () => {
  const text = joined(flowchartInsight(workshop));
  assert.match(text, /3 tahap berurutan/);
  assert.match(text, /Montir punya 2 petugas/);
  assert.match(text, /Resepsionis dipakai oleh 2 tahap \(Pendaftaran dan Pembayaran\)/);
});

test("flowchart berubah saat jumlah montir berubah", () => {
  const bigger = { ...workshop, resources: [workshop.resources[0], { name: "Montir", capacity: 5 }] };
  const text = joined(flowchartInsight(bigger));
  assert.match(text, /Montir punya 5 petugas/);
  assert.doesNotMatch(text, /diringkas/);
});

test("flowchart meringkas kotak hanya jika petugas lebih dari 10", () => {
  const huge = { ...workshop, resources: [workshop.resources[0], { name: "Montir", capacity: 12 }] };
  assert.match(joined(flowchartInsight(huge)), /Montir diringkas menjadi 10 kotak/);
});

test("antrian kosong dijelaskan sebagai tanpa antrian", () => {
  const detail = { end_time: 100, queue_series: { Resepsionis: [[0, 0]], Montir: [[0, 0]] } };
  assert.match(joined(queueInsight(detail, workshop, "menit")), /Tidak ada antrian sama sekali/);
});

test("antrian menyebut puncak, rata-rata, dan porsi waktu", () => {
  const detail = {
    end_time: 100,
    queue_series: { Resepsionis: [[0, 0]], Montir: [[0, 0], [20, 3], [60, 0]] },
  };
  const text = joined(queueInsight(detail, workshop, "menit"));
  assert.match(text, /ada di Montir: 3 mobil pada waktu 20,00 menit/);
  assert.match(text, /Rata-ratanya 1,20 mobil/);
  assert.match(text, /40% waktu simulasi/);
  assert.match(text, /Tidak pernah ada antrian di Resepsionis/);
});

test("utilisasi memilih sumber daya tersibuk dan membaca tingkat bebannya", () => {
  const resources = [
    { name: "Resepsionis", utilization: stat(0.3) },
    { name: "Montir", utilization: stat(0.97, 0.9, 1) },
  ];
  const text = joined(utilizationInsight(resources));
  assert.match(text, /Montir paling sibuk, bekerja 97,0%/);
  assert.match(text, /hampir tidak pernah menganggur/);
  assert.match(text, /titik tersempit/);
});

test("utilisasi rendah tetapi ada peringatan beban memberi catatan, bukan kata wajar", () => {
  const resources = [{ name: "Montir", utilization: stat(0.7) }];
  const warnings = ["Beban Montir sekitar 155 persen dari kapasitasnya."];
  const text = joined(utilizationInsight(resources, warnings, 8));
  assert.match(text, /hanya 8 entitas/);
  assert.doesNotMatch(text, /wajar/);
});

test("waktu tunggu: semua langsung dilayani", () => {
  assert.match(joined(waitInsight([0, 0, 0], workshop, "menit")), /Semua 3 mobil langsung dilayani/);
});

test("waktu tunggu: menghitung yang tidak menunggu dan menyebut ekor panjang", () => {
  const text = joined(waitInsight([0, 0, 0, 0, 0, 0, 1, 20], workshop, "menit"));
  assert.match(text, /6 dari 8 mobil \(75%\) tidak menunggu/);
  assert.match(text, /Yang terlama menunggu 20,00 menit/);
  assert.match(text, /beberapa mobil menunggu jauh lebih lama/);
});

const scenario = (waits, usages) => ({
  resource: "Montir",
  time_unit: "menit",
  scenarios: waits.map((wait, index) => ({
    capacity: index + 1,
    avg_wait: stat(wait),
    utilization: stat(usages[index]),
  })),
});

test("skenario: kalimat mengikuti angka penurunan waktu tunggu", () => {
  const text = joined(scenarioWaitInsight(scenario([40, 10, 8, 7.5], [1, 0.8, 0.55, 0.4])));
  assert.match(text, /Dengan 1 Montir, rata-rata waktu tunggu 40,00 menit/);
  assert.match(text, /turun 32,50 menit, 81%/);
  assert.match(text, /dari 1 ke 2 Montir, turun 30,00 menit/);
  assert.match(text, /mulai kurang bermanfaat/);
});

test("skenario: arah berubah jika waktu tunggu justru naik", () => {
  const text = joined(scenarioWaitInsight(scenario([5, 9], [0.9, 0.6])));
  assert.match(text, /naik 4,00 menit/);
});

test("skenario: utilisasi menyebut kapasitas saat petugas mulai menganggur", () => {
  const text = joined(scenarioUsageInsight(scenario([40, 10, 8], [0.98, 0.7, 0.45])));
  assert.match(text, /turun dari 98,0% \(1 petugas\) menjadi 45,0% \(3 petugas\)/);
  assert.match(text, /Mulai 3 Montir, utilisasi di bawah 60%/);
});

test("data historis: menjelaskan kelompok terbanyak, kemiringan, dan variasi", () => {
  const values = [3, 4, 4, 5, 5, 5, 6, 20];
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  const analysis = { count: values.length, mean, median: 5, std: 5.5, cv: 0.9 };
  const text = joined(dataInsight(analysis, values, "menit"));
  assert.match(text, /Dari 8 data, kelompok terbanyak/);
  assert.match(text, /menarik rata-rata ke kanan/);
  assert.match(text, /Koefisien variasi 0,90 besar/);
  assert.match(text, /baru 8/);
});
