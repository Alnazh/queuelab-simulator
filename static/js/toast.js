/** Notifikasi singkat di bagian bawah layar. */

const DURATION_MS = 3200;
let timer = null;

export function showToast(message, isError = false) {
  const toast = document.getElementById("toast");
  toast.textContent = message;
  toast.classList.toggle("is-error", isError);
  toast.hidden = false;
  clearTimeout(timer);
  timer = setTimeout(() => {
    toast.hidden = true;
  }, DURATION_MS);
}
