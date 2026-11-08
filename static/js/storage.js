/** Penyimpanan lokal browser. Semua akses dibungkus agar tidak error saat storage diblokir. */

const KEYS = {
  customCases: "queuelab.customCases",
  theme: "queuelab.theme",
  activeCase: "queuelab.activeCase",
};

function read(key, fallback) {
  try {
    const raw = window.localStorage.getItem(key);
    return raw === null ? fallback : JSON.parse(raw);
  } catch {
    return fallback;
  }
}

function write(key, value) {
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Penyimpanan penuh atau diblokir, aplikasi tetap jalan tanpa penyimpanan.
  }
}

export const loadCustomCases = () => {
  const stored = read(KEYS.customCases, []);
  return Array.isArray(stored) ? stored : [];
};
export const saveCustomCases = (cases) => write(KEYS.customCases, cases);

export const loadTheme = () => read(KEYS.theme, "light");
export const saveTheme = (theme) => write(KEYS.theme, theme);

export const loadActiveCaseId = () => read(KEYS.activeCase, null);
export const saveActiveCaseId = (id) => write(KEYS.activeCase, id);
