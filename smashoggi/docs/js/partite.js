import { fetchJSON, esc, montaPagina, caricaGiocatori, listaPartite, punteggioPartita, giornoRoma, oggiRoma, dataSolo, messaggioErrore } from "./common.js?v=202610100815";

montaPagina("partite.html");

const stato = { giorno: null, filtro: "tutti" };
let principali = [], giocatori = {};
const FILTRI = [["tutti", "Tutte"], ["atp", "ATP"], ["wta", "WTA"], ["ita", "Solo italiani"]];

function etichettaGiorno(g, oggi) {
  const diff = Math.round((dataSolo(g) - dataSolo(oggi)) / 864e5);
  if (diff === 0) return "Oggi";
  if (diff === -1) return "Ieri";
  if (diff === 1) return "Domani";
  return new Intl.DateTimeFormat("it-IT", { timeZone: "UTC", weekday: "short", day: "numeric", month: "short" }).format(dataSolo(g));
}

function disegna(giorni, oggi) {
  document.getElementById("giorni").innerHTML = giorni.map((g) => `<button type="button" class="pill" data-g="${g}" aria-pressed="${g === stato.giorno}">${esc(etichettaGiorno(g, oggi))}</button>`).join("");
  document.getElementById("filtri").innerHTML = FILTRI.map(([v, t]) => `<button type="button" class="pill" data-f="${v}" aria-pressed="${v === stato.filtro}">${t}</button>`).join("");
  const lista = principali.filter((p) => giornoRoma(p.data) === stato.giorno && (stato.filtro === "tutti" ||
    (stato.filtro === "ita" ? p.giocatori.some((g) => g.paese === "ITA") : p.tour === stato.filtro)))
    .sort((a, b) => (a.torneo + a.tour).localeCompare(b.torneo + b.tour) || punteggioPartita(b, giocatori) - punteggioPartita(a, giocatori) || (a.data < b.data ? -1 : 1));
  document.getElementById("elenco").innerHTML = lista.length ? `<div class="griglia-partite">${listaPartite(lista, giocatori)}</div>` : `<div class="vuoto">Nessuna partita con questi filtri.</div>`;
}

Promise.all([fetchJSON("data/partite.json"), caricaGiocatori()]).then(([{ partite }, g]) => {
  giocatori = g;
  principali = partite.filter((p) => !p.qualifica);
  const oggi = oggiRoma();
  const giorni = [...new Set(principali.map((p) => giornoRoma(p.data)))].sort().filter((d) => { const n = Math.round((dataSolo(d) - dataSolo(oggi)) / 864e5); return n >= -6 && n <= 4; });
  stato.giorno = giorni.includes(oggi) ? oggi : giorni.find((d) => d > oggi) || giorni[giorni.length - 1];
  const ridisegna = () => disegna(giorni, oggi);
  document.querySelector("main").addEventListener("click", (e) => {
    const b = e.target.closest(".pill");
    if (!b) return;
    if (b.dataset.g) stato.giorno = b.dataset.g;
    if (b.dataset.f) stato.filtro = b.dataset.f;
    ridisegna();
  });
  ridisegna();
}).catch(() => messaggioErrore(document.getElementById("elenco")));
