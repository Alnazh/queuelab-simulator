/** Pembungkus panggilan ke API Flask. */

async function request(path, body) {
  const options = body
    ? { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }
    : {};
  let response;
  try {
    response = await fetch(path, options);
  } catch {
    throw new Error("Tidak bisa terhubung ke server. Periksa koneksi lalu coba lagi.");
  }
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.error || "Terjadi kesalahan pada server.");
  }
  return data;
}

export const fetchPresets = () => request("/api/presets");
export const runSimulation = (payload) => request("/api/simulate", payload);
export const runSweep = (payload) => request("/api/sweep", payload);
export const analyzeValues = (values) => request("/api/analyze", { values });
