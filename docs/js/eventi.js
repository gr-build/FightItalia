import { fetchJSON, renderChrome, icon, slugDaLink } from "./common.js?v=202609251251";

renderChrome("eventi");

const MESI = ["gen", "feb", "mar", "apr", "mag", "giu", "lug", "ago", "set", "ott", "nov", "dic"];

function blocchettoData(dataStr) {
  const d = new Date(dataStr);
  if (isNaN(d)) return `<div class="event-date"><span class="day">?</span></div>`;
  return `<div class="event-date"><span class="day">${d.getDate()}</span><span class="month">${MESI[d.getMonth()]} ${d.getFullYear()}</span></div>`;
}

function tagTipo(tipo) {
  if (tipo === "Numerato") return `<span class="tag numerato">Numerato</span>`;
  if (tipo === "Fight Night") return `<span class="tag fight-night">Fight Night</span>`;
  return "";
}

function rigaEvento(ev) {
  const luogo = [ev.sede, ev.luogo].filter(Boolean).join(" — ");
  return `
    <div class="event-row">
      ${blocchettoData(ev.data)}
      <div class="event-main">
        <div class="name">${ev.evento} ${tagTipo(ev.tipo)}</div>
        ${luogo ? `<div class="venue">${icon("pin")} ${luogo}</div>` : ""}
      </div>
      ${ev.link ? `<a class="event-link" href="evento.html?slug=${slugDaLink(ev.link)}">Dettagli →</a>` : "<span></span>"}
    </div>`;
}

function ordinaData(lista, crescente) {
  return [...lista].sort((x, y) => {
    const dx = new Date(x.data), dy = new Date(y.data);
    return crescente ? dx - dy : dy - dx;
  });
}

let passati = [];
let filtrati = [];
let mostrati = 15;

// Ricerca senza accenti e maiuscole: "sao paulo" trova "São Paulo".
const normalizza = (t) => (t || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();

function applicaFiltri() {
  const parole = normalizza(document.getElementById("cerca-evento").value).split(/\s+/).filter(Boolean);
  const anno = document.getElementById("filtro-anno").value;
  const tipo = document.getElementById("filtro-tipo").value;
  const data = document.getElementById("filtro-data").value;
  const giorno = data ? Date.parse(data) : null;
  filtrati = passati.filter((ev) => {
    const d = new Date(ev.data);
    if (anno && d.getFullYear() !== Number(anno)) return false;
    if (tipo && ev.tipo !== tipo) return false;
    // Per data: stesso giorno o fino a 3 giorni di distanza (fusi orari e
    // date "americane" della serata spostano spesso di un giorno).
    if (giorno && (isNaN(d) || Math.abs(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) - giorno) > 3 * 86400000)) return false;
    if (parole.length) {
      const testo = normalizza([ev.evento, ev.sede, ev.luogo, isNaN(d) ? "" : `${d.getDate()} ${MESI[d.getMonth()]} ${d.getFullYear()}`].join(" "));
      if (!parole.every((p) => testo.includes(p))) return false;
    }
    return true;
  });
  mostrati = 15;
  renderPassati();
}

function renderPassati() {
  const filtrando = filtrati.length !== passati.length;
  document.getElementById("eventi-passati").innerHTML =
    filtrati.slice(0, mostrati).map(rigaEvento).join("") ||
    `<div class="empty-state">Nessun evento trovato. Prova con un altro nome, un'altra città o un altro anno.</div>`;
  document.getElementById("passati-count").textContent = filtrando ? `(${filtrati.length} di ${passati.length})` : `(${passati.length})`;
  document.getElementById("load-more").style.display = mostrati >= filtrati.length ? "none" : "block";
}

async function init() {
  const eventi = await fetchJSON("data/eventi.json");
  // Ordine cronologico crescente: il prossimo evento (il più vicino da
  // oggi) va per primo, non il più lontano nel tempo.
  const prossimi = ordinaData(eventi.filter((e) => e.stato === "programmato"), true);
  passati = ordinaData(eventi.filter((e) => e.stato === "passato"), false);

  document.getElementById("eventi-prossimi").innerHTML =
    prossimi.map(rigaEvento).join("") || `<div class="empty-state">Nessun evento programmato trovato.</div>`;
  const anni = [...new Set(passati.map((e) => new Date(e.data).getFullYear()).filter((a) => !isNaN(a)))].sort((a, b) => b - a);
  document.getElementById("filtro-anno").insertAdjacentHTML("beforeend", anni.map((a) => `<option value="${a}">${a}</option>`).join(""));
  ["cerca-evento", "filtro-anno", "filtro-tipo", "filtro-data"].forEach((id) => {
    document.getElementById(id).addEventListener(id === "cerca-evento" ? "input" : "change", applicaFiltri);
  });
  applicaFiltri();
  document.getElementById("load-more").addEventListener("click", () => {
    mostrati += 20;
    renderPassati();
  });
}

init();
