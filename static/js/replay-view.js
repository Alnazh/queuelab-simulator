/** Tampilan tab Replay: memutar ulang Event Calendar kejadian demi kejadian. */
import { h, clear } from "./dom.js";
import { resourceColor } from "./case-utils.js";
import { formatNumber } from "./format.js";

const STEP_INTERVAL_MS = 700;
let timer = null;

export function stopReplay() {
  clearInterval(timer);
  timer = null;
}

function station(resource, index) {
  const slots = h("div", { class: "station-row" });
  const waiting = h("div", { class: "station-row" });
  const element = h(
    "div",
    { class: "station" },
    h("h4", {}, resource.name),
    h("div", { class: "station-row" }, h("span", { class: "station-label" }, "Dilayani"), slots),
    h("div", { class: "station-row" }, h("span", { class: "station-label" }, "Antrian"), waiting)
  );
  return { element, update: (state) => updateStation(state, index, slots, waiting) };
}

function updateStation(state, index, slots, waiting) {
  clear(slots).append(
    ...state.busy.map((occupant) =>
      occupant === null
        ? h("span", { class: "slot is-free" }, "kosong")
        : h("span", { class: "slot is-busy", style: `background:${resourceColor(index)}` }, `#${occupant}`)
    )
  );
  clear(waiting);
  if (state.queue === 0) {
    waiting.append(h("span", { class: "muted small" }, "tidak ada"));
    return;
  }
  waiting.append(...state.waiting.map((id) => h("span", { class: "waiting-chip" }, `#${id}`)));
  const hidden = state.queue - state.waiting.length;
  if (hidden > 0) waiting.append(h("span", { class: "waiting-more" }, `+${hidden} lagi`));
}

export function renderReplay(host, result, studyCase) {
  stopReplay();
  const log = result.detail.log;
  const unit = result.settings.time_unit;
  if (log.length === 0) {
    clear(host).append(h("p", { class: "empty" }, "Tidak ada kejadian untuk diputar."));
    return;
  }

  const stations = studyCase.resources.map(station);
  const info = h("div", { class: "replay-info", role: "status" });
  const slider = h("input", { class: "replay-slider", type: "range", min: 0, max: log.length - 1, value: 0, "aria-label": "Posisi kejadian" });
  const playButton = h("button", { class: "btn btn-small btn-accent", type: "button" }, "Putar");

  function show(index) {
    const row = log[index];
    slider.value = index;
    info.textContent =
      `Kejadian ${index + 1} dari ${log.length} | Waktu ${formatNumber(row.clock)} ${unit} | ${row.event} | ` +
      `${studyCase.entity_name} ${row.entity} | ${row.note}`;
    stations.forEach((item, i) => item.update(row.state[studyCase.resources[i].name]));
  }

  function step(delta) {
    show(Math.min(log.length - 1, Math.max(0, Number(slider.value) + delta)));
  }

  function togglePlay() {
    if (timer) {
      stopReplay();
      playButton.textContent = "Putar";
      return;
    }
    if (Number(slider.value) >= log.length - 1) show(0);
    playButton.textContent = "Jeda";
    timer = setInterval(() => {
      if (Number(slider.value) >= log.length - 1) {
        stopReplay();
        playButton.textContent = "Putar";
        return;
      }
      step(1);
    }, STEP_INTERVAL_MS);
  }

  playButton.addEventListener("click", togglePlay);
  slider.addEventListener("input", () => show(Number(slider.value)));

  clear(host).append(
    h("p", { class: "muted small" }, "Geser penggeser atau tekan Putar untuk melihat siapa dilayani dan siapa menunggu di setiap kejadian."),
    h(
      "div",
      { class: "replay-controls" },
      h("button", { class: "btn btn-small", type: "button", onclick: () => step(-1) }, "Mundur"),
      playButton,
      h("button", { class: "btn btn-small", type: "button", onclick: () => step(1) }, "Maju"),
      slider
    ),
    info,
    h("div", { class: "replay-stage" }, stations.map((item) => item.element)),
    result.detail.log_truncated ? h("p", { class: "alert" }, "Log dipotong pada 4000 kejadian pertama.") : ""
  );
  show(0);
}
