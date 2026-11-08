/** Fungsi bantu teks yang dipakai oleh flowchart dan grafik. */

/** Pecah teks menjadi baris pendek supaya muat di dalam bentuk. */
export function wrapText(text, maxChars) {
  const lines = [];
  let line = "";
  for (const word of text.split(" ")) {
    const candidate = line ? `${line} ${word}` : word;
    if (candidate.length > maxChars && line) {
      lines.push(line);
      line = word;
    } else {
      line = candidate;
    }
  }
  if (line) lines.push(line);
  return lines;
}
