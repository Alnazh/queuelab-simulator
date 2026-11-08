/** Fungsi bantu untuk membuat dan mengosongkan elemen DOM. */

const SVG_NAMESPACE = "http://www.w3.org/2000/svg";

export const $ = (selector, root = document) => root.querySelector(selector);
export const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];

function appendChildren(parent, children) {
  for (const child of children.flat(Infinity)) {
    if (child === null || child === undefined || child === false) continue;
    parent.append(child instanceof Node ? child : document.createTextNode(String(child)));
  }
}

function applyProps(element, props) {
  for (const [key, value] of Object.entries(props)) {
    if (value === null || value === undefined || value === false) continue;
    if (key === "class") element.setAttribute("class", value);
    else if (key === "text") element.textContent = value;
    else if (key.startsWith("on")) element.addEventListener(key.slice(2), value);
    else element.setAttribute(key, value === true ? "" : value);
  }
}

/** Buat elemen HTML. Contoh: h("button", { class: "btn", onclick: fn }, "Simpan"). */
export function h(tag, props = {}, ...children) {
  const element = document.createElement(tag);
  applyProps(element, props);
  appendChildren(element, children);
  return element;
}

/** Buat elemen SVG dengan namespace yang benar. */
export function s(tag, props = {}, ...children) {
  const element = document.createElementNS(SVG_NAMESPACE, tag);
  applyProps(element, props);
  appendChildren(element, children);
  return element;
}

export function clear(node) {
  node.replaceChildren();
  return node;
}
