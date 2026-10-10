// Pagina Live: solo le partite in corso adesso, aggiornate ogni 30 secondi.
import { partiteLive } from "./live.js?v=202610101448";
import { fetchJSON, esc, montaPagina, caricaGiocatori, listaPartite, punteggioPartita, dataBreve, oraRoma, messaggioErrore } from "./common.js?v=202610101448";

montaPagina("live.html");

const FILTRI = [["tutti", "Tutte"], ["atp", "ATP"], ["wta", "WTA"], ["ita", "Solo italiani"]];
let filtro = "tutti", tutte = [], giocatori = {};

const passa = (p) => filtro === "tutti" || (filtro === "ita" ? p.giocatori.some((g) => g.paese === "ITA") : p.tour === filtro);

function disegna() {
  document.getElementById("filtri").innerHTML = FILTRI.map(([v, t]) => `<button type="button" class="pill" data-f="${v}" aria-pressed="${v === filtro}">${t}</button>`).join("");
  // tornei con un italiano o con i giocatori meglio classificati in cima
  const peso = (lista) => Math.max(...lista.map((p) => punteggioPartita(p, giocatori)));
  const live = tutte.filter((p) => p.stato === "in" && passa(p));
  const gruppi = Object.values(live.reduce((acc, p) => ((acc[p.tour + p.torneoId] ??= []).push(p), acc), {}))
    .map((l) => l.sort((a, b) => punteggioPartita(b, giocatori) - punteggioPartita(a, giocatori)))
    .sort((a, b) => peso(b) - peso(a));
  const el = document.getElementById("elenco");
  if (live.length) {
    el.innerHTML = `<h2 class="section-title" style="margin-top:6px">In corso <span class="count">${live.length} ${live.length === 1 ? "partita" : "partite"}</span></h2>
      <div class="griglia-partite">${listaPartite(gruppi.flat(), giocatori)}</div>`;
    return;
  }
  // niente in corso: le prossime in programma
  const adesso = new Date().toISOString();
  const prossime = tutte.filter((p) => p.stato === "pre" && passa(p) && p.data >= adesso).sort((a, b) => (a.data < b.data ? -1 : 1)).slice(0, 8);
  el.innerHTML = `<div class="vuoto">Nessuna partita in corso in questo momento${filtro !== "tutti" ? " con questo filtro" : ""}.</div>` +
    (prossime.length ? `<h2 class="section-title">Le prossime <span class="count">dalle ${esc(oraRoma(prossime[0].data))} di ${esc(dataBreve(prossime[0].data))}</span></h2>
      <div class="griglia-partite">${listaPartite(prossime, giocatori)}</div>` : "");
}

document.getElementById("filtri").addEventListener("click", (e) => {
  const b = e.target.closest(".pill[data-f]");
  if (!b) return;
  filtro = b.dataset.f;
  disegna();
});

Promise.all([partiteLive((l) => { tutte = l; disegna(); }, { sempre: true }), caricaGiocatori()]).then(([{ partite }, g]) => {
  tutte = partite; giocatori = g;
  disegna();
}).catch(() => messaggioErrore(document.getElementById("elenco")));

// Challenger in corso: niente diretta (ESPN non li copre), tabellone da Wikipedia aggiornato a fine partita
const persona = (p) => (p ? `<span class="ch-p${p.paese === "ITA" ? " ita" : ""}"><span class="codice">${esc(p.paese || "–")}</span>${esc(p.nome)}</span>` : `<span class="ch-p attesa">da definire</span>`);
const sfida = (l) => `<div class="ch-sfida">${persona(l?.[0])}<span class="ch-vs">vs</span>${persona(l?.[1])}</div>`;
fetchJSON("data/challenger.json").then(({ tornei }) => {
  const ora = tornei.filter((t) => t.stato === "in corso");
  if (!ora.length) return;
  document.getElementById("challenger").innerHTML = `<h2 class="section-title">Challenger in corso <span class="count">${ora.length} tornei</span></h2>
    <p class="ch-avviso"><b>Live senza punteggio punto per punto:</b> per i Challenger il risultato è disponibile a fine partita.</p>
    <div class="ch-griglia">${ora.map((t) => `<article class="af ch-torneo">
      <div class="af-testa"><span class="af-torneo">${esc(t.nome)}</span><span class="af-data">${esc(t.citta || "")}</span></div>
      <div class="af-sub"><span class="tag challenger">${esc(t.categoria)}</span>${esc(t.superficie || "")}</div>
      ${t.finale ? `<div class="ch-turno">Finale</div>${sfida(t.finale)}` : ""}
      ${t.semifinali?.length ? `<div class="ch-turno">Semifinali</div>${t.semifinali.map((s) => (s.length === 2 ? sfida(s) : `<div class="ch-sfida">${persona(s[0])}<span class="ch-vs testo">in finale</span></div>`)).join("")}` : ""}
    </article>`).join("")}</div>`;
}).catch(() => {});
