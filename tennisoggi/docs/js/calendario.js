import { fetchJSON, esc, montaPagina, oggiRoma, etichettaCategoria, intervalloDate, nomeTour, mesiIt, messaggioErrore } from "./common.js?v=202610100420";

montaPagina("calendario.html");

const stato = { cat: "tutti", tour: "tutti", periodo: "prossimi" };
const CATEGORIE = [["tutti", "Tutti"], ["Grand Slam", "Slam"], ["1000", "1000"], ["500", "500"], ["250", "250"], ["Finals", "Finals"], ["altri", "Altri tornei"]];
const TOUR = [["tutti", "Uomini e donne"], ["atp", "Uomini"], ["wta", "Donne"]];
const PERIODO = [["prossimi", "In corso e prossimi"], ["tutti", "Tutta la stagione"], ["passati", "Già giocati"]];

let tornei = [];

function pillole(chiave, voci) {
  return `<div class="gruppo-filtri" role="group" aria-label="Filtro">${voci.map(([v, t]) =>
    `<button type="button" class="pill" data-k="${chiave}" data-v="${esc(v)}" aria-pressed="${stato[chiave] === v}">${esc(t)}</button>`).join("")}</div>`;
}

function card(t, oggi) {
  const cat = etichettaCategoria(t);
  const a = new Date(t.inizio + "T12:00:00Z");
  const mese = new Intl.DateTimeFormat("it-IT", { timeZone: "UTC", month: "short" }).format(a);
  const inCorso = t.inizio <= oggi && t.fine >= oggi;
  return `<a class="torneo-card" href="torneo.html?tour=${t.tour}&id=${encodeURIComponent(t.id)}">
    <div class="date"><b>${a.getUTCDate()}</b><span>${esc(mese)}</span></div>
    <div><h3>${esc(t.nome)}</h3>
      <div class="sub"><span class="tag ${cat.classe}">${esc(cat.testo)}</span>${inCorso ? '<span class="tag corso">In corso</span>' : ""}${esc(nomeTour(t.tour))}${t.superficie ? ` · ${esc(t.superficie)}` : ""}</div>
      <div class="sub">${esc([t.citta, t.paese].filter(Boolean).join(", "))} · ${esc(intervalloDate(t.inizio, t.fine))}</div></div></a>`;
}

function disegna() {
  const oggi = oggiRoma();
  let lista = tornei.filter((t) => {
    if (stato.tour !== "tutti" && t.tour !== stato.tour) return false;
    if (stato.cat === "altri") { if (t.categoria) return false; }
    else {
      if (!t.categoria) return false;               // "Tutti" = circuito principale
      if (stato.cat !== "tutti" && t.categoria !== stato.cat) return false;
    }
    if (stato.periodo === "prossimi") return t.fine >= oggi;
    if (stato.periodo === "passati") return t.fine < oggi;
    return true;
  });
  if (stato.periodo === "passati") lista = lista.reverse();
  let html = "", mese = "";
  for (const t of lista) {
    const m = t.inizio.slice(0, 7);
    if (m !== mese) { mese = m; html += `<h3 class="mese">${esc(mesiIt(t.inizio))}</h3>`; }
    html += card(t, oggi);
  }
  document.getElementById("elenco").innerHTML = lista.length ? `<div class="lista-tornei">${html}</div>` : `<div class="vuoto">Nessun torneo con questi filtri.</div>`;
  document.getElementById("conta").textContent = `${lista.length} tornei`;
  document.querySelectorAll(".pill[data-k]").forEach((b) => b.setAttribute("aria-pressed", String(stato[b.dataset.k] === b.dataset.v)));
}

fetchJSON("data/tornei.json").then((d) => {
  tornei = d.tornei;
  document.getElementById("filtri").innerHTML = pillole("periodo", PERIODO) + pillole("cat", CATEGORIE) + pillole("tour", TOUR);
  document.getElementById("filtri").addEventListener("click", (e) => {
    const b = e.target.closest(".pill[data-k]");
    if (!b) return;
    stato[b.dataset.k] = b.dataset.v;
    disegna();
  });
  disegna();
}).catch(() => messaggioErrore(document.getElementById("elenco")));
