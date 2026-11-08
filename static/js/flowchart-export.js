/** Mengunduh flowchart sebagai SVG atau PNG, dengan gaya CSS ditanam langsung ke dalam gambar. */

const STYLE_PROPERTIES = [
  "fill",
  "stroke",
  "stroke-width",
  "stroke-dasharray",
  "font-family",
  "font-size",
  "font-weight",
  "text-anchor",
  "dominant-baseline",
  "opacity",
];
const PNG_SCALE = 2;

/** Salin gaya terhitung ke atribut style agar gambar tampil sama di luar halaman. */
function inlineStyles(source, target) {
  const computed = window.getComputedStyle(source);
  const rules = STYLE_PROPERTIES.map((name) => `${name}:${computed.getPropertyValue(name)}`).join(";");
  target.setAttribute("style", rules);
  [...source.children].forEach((child, index) => inlineStyles(child, target.children[index]));
}

function standaloneSvg(svgElement) {
  const clone = svgElement.cloneNode(true);
  inlineStyles(svgElement, clone);
  const width = Number(svgElement.getAttribute("width"));
  const height = Number(svgElement.getAttribute("height"));
  const background = document.createElementNS("http://www.w3.org/2000/svg", "rect");
  const paper = window.getComputedStyle(document.body).getPropertyValue("--card").trim() || "#ffffff";
  background.setAttribute("width", width);
  background.setAttribute("height", height);
  background.setAttribute("fill", paper);
  clone.insertBefore(background, clone.firstChild.nextSibling);
  return { markup: new XMLSerializer().serializeToString(clone), width, height };
}

function download(blob, filename) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function safeName(name) {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "flowchart";
}

export function downloadSvg(svgElement, caseName) {
  const { markup } = standaloneSvg(svgElement);
  download(new Blob([markup], { type: "image/svg+xml" }), `flowchart-${safeName(caseName)}.svg`);
}

export function downloadPng(svgElement, caseName) {
  const { markup, width, height } = standaloneSvg(svgElement);
  const image = new Image();
  image.onload = () => {
    const canvas = document.createElement("canvas");
    canvas.width = width * PNG_SCALE;
    canvas.height = height * PNG_SCALE;
    const context = canvas.getContext("2d");
    context.scale(PNG_SCALE, PNG_SCALE);
    context.drawImage(image, 0, 0, width, height);
    canvas.toBlob((blob) => download(blob, `flowchart-${safeName(caseName)}.png`), "image/png");
  };
  image.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(markup)}`;
}
