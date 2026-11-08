/** Penyimpanan daftar studi kasus (bawaan dan buatan pengguna) beserta studi kasus aktif. */
import { loadActiveCaseId, loadCustomCases, saveActiveCaseId, saveCustomCases } from "./storage.js";
import { isValidCaseShape } from "./case-utils.js";

const bus = new EventTarget();
let builtinCases = [];
let customCases = [];
let activeId = null;

export function onStore(eventName, listener) {
  bus.addEventListener(eventName, () => listener());
}

const notify = (eventName) => bus.dispatchEvent(new Event(eventName));

export function initCases(presets) {
  builtinCases = presets;
  customCases = loadCustomCases().filter(isValidCaseShape);
  const saved = loadActiveCaseId();
  activeId = getCases().some((item) => item.id === saved) ? saved : builtinCases[0].id;
}

export const getCases = () => [...builtinCases, ...customCases];
export const getActiveCase = () => getCases().find((item) => item.id === activeId);

export function setActiveCase(id) {
  if (!getCases().some((item) => item.id === id)) return;
  activeId = id;
  saveActiveCaseId(id);
  notify("active");
}

/** Simpan studi kasus buatan pengguna. Studi kasus dengan id yang sama akan diganti. */
export function saveCase(studyCase) {
  const index = customCases.findIndex((item) => item.id === studyCase.id);
  if (index >= 0) customCases[index] = studyCase;
  else customCases.push(studyCase);
  saveCustomCases(customCases);
  notify("cases");
}

export function deleteCase(id) {
  customCases = customCases.filter((item) => item.id !== id);
  saveCustomCases(customCases);
  if (activeId === id) setActiveCase(builtinCases[0].id);
  notify("cases");
}
