/** Kotak penjelasan yang ditempel di bawah diagram atau grafik. */
import { h } from "./dom.js";

export function insightBox(lines) {
  return h(
    "aside",
    { class: "insight", "aria-label": "Penjelasan grafik" },
    h("strong", { class: "insight-title" }, "Penjelasan"),
    lines.map((line) => h("p", {}, line))
  );
}
