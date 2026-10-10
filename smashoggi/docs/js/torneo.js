import { partiteLive } from "./live.js?v=202610101448";
import { fetchJSON, esc, montaPagina, caricaGiocatori, listaPartite, schedaPartita, etichettaCategoria, intervalloDate, nomeTour, frecciaIndietro,
  messaggioErrore, oggiRoma, giornoRoma, dataBreve, punteggioPartita } from "./common.js?v=202610101448";

montaPagina("calendario.html");
frecciaIndietro(document.getElementById("indietro"), "calendario.html", "Calendario");

const q = new URLSearchParams(location.search);
const tour = q.get("tour") === "wta" ? "wta" : "atp";
const id = q.get("id");

// punteggi in diretta: a ogni cambiamento la pagina si ridisegna
const datiPartite = partiteLive(() => avvia().catch(() => {}));

// Turni in ordine di tabellone, con un'etichetta corta per i bottoni
const TURNI = [["Girone", "Gironi"], ["Primo turno", "1° turno"], ["Secondo turno", "2° turno"], ["Terzo turno", "3° turno"], ["Quarto turno", "4° turno"],
  ["Trentaduesimi di finale", "32esimi"], ["Sedicesimi di finale", "16esimi"], ["Ottavi di finale", "Ottavi"], ["Quarti di finale", "Quarti"],
  ["Semifinale", "Semifinali"], ["Finale 3º posto", "3º posto"], ["Finale", "Finale"]];
const ordineTurno = (t) => { const i = TURNI.findIndex(([n]) => n === t); return i < 0 ? 50 : i; };
const corto = (t) => TURNI.find(([n]) => n === t)?.[1] || t;
let turnoScelto = null; // resta scelto anche quando arrivano i punteggi in diretta

async function avvia() {
  const [{ tornei }, { partite }, giocatori] = await Promise.all([fetchJSON("data/tornei.json"), datiPartite, caricaGiocatori()]);
  const t = tornei.find((x) => x.id === id && x.tour === tour);
  if (!t) return messaggioErrore(document.getElementById("contenuto-torneo"), "Torneo non trovato.");
  document.title = `${t.nome} — Smash Oggi`;
  const cat = etichettaCategoria(t);
  const oggi = oggiRoma();
  const inCorso = t.inizio <= oggi && t.fine >= oggi;
  const dato = (k, v, testo) => (v ? `<div class="dato"><span>${k}</span><b class="${testo ? "testo" : ""}">${esc(v)}</b></div>` : "");

  const tutteSue = partite.filter((p) => p.torneoId === t.id && p.tour === t.tour && !p.qualifica);
  const turni = [...new Set(tutteSue.map((p) => p.turno))].sort((a, b) => ordineTurno(a) - ordineTurno(b));
  // di base: il turno in campo adesso; altrimenti il primo con partite in programma tra giocatori gia' noti; altrimenti l'ultimo giocato
  const noti = (p) => p.giocatori.every((g) => g.nome && g.nome !== "TBD");
  const perOrdine = (l) => l.sort((a, b) => ordineTurno(a.turno) - ordineTurno(b.turno));
  const base = perOrdine(tutteSue.filter((p) => p.stato === "in")).pop()?.turno
    || perOrdine(tutteSue.filter((p) => p.stato === "pre" && noti(p)))[0]?.turno
    || perOrdine(tutteSue.filter((p) => p.stato === "post")).pop()?.turno;
  if (!turnoScelto || (turnoScelto !== "tutti" && !turni.includes(turnoScelto))) turnoScelto = base || "tutti";
  const sue = turnoScelto === "tutti" ? tutteSue : tutteSue.filter((p) => p.turno === turnoScelto);
  const finale = tutteSue.find((p) => p.turno === "Finale");
  const concluso = finale?.stato === "post";
  const inGioco = sue.filter((p) => p.stato === "in");
  const programma = sue.filter((p) => p.stato === "pre").sort((a, b) => (a.data < b.data ? -1 : 1));
  const risultati = sue.filter((p) => p.stato === "post").sort((a, b) => (a.data < b.data ? 1 : -1));

  const sez = (titolo, lista, ord) => (lista.length
    ? `<div class="section-title">${titolo} <span class="count">${lista.length}</span></div><div class="griglia-partite">${lista.slice(0, turnoScelto === "tutti" ? 40 : 200).map((p) => schedaPartita(p, giocatori)).join("")}</div>` : "");

  document.getElementById("contenuto-torneo").innerHTML = `
    <div class="scheda-testa"><div><h1>${esc(t.nome)}</h1>
      <div class="sub"><span class="tag ${cat.classe}">${esc(cat.testo)}</span>${concluso ? '<span class="tag neutro">Concluso</span>' : inCorso ? '<span class="tag corso">In corso</span>' : ""}${esc(nomeTour(t.tour))}</div></div></div>
    <div class="dati">
      ${dato("Date", intervalloDate(t.inizio, t.fine), true)}
      ${dato("Luogo", [t.citta, t.paese].filter(Boolean).join(", "), true)}
      ${dato("Superficie", t.superficie, true)}
      ${dato("Categoria", cat.testo, true)}
    </div>
    ${turni.length > 1 ? `<div class="turni-barra" role="group" aria-label="Scegli il turno">${[...turni, "tutti"].map((x) =>
      `<button type="button" class="pill" data-turno="${esc(x)}" aria-pressed="${x === turnoScelto}">${esc(x === "tutti" ? "Tutti" : corto(x))}</button>`).join("")}</div>` : ""}
    ${sez("In campo adesso", inGioco)}
    ${sez("Prossime partite", programma)}
    ${sez(turnoScelto === "tutti" ? "Ultimi risultati" : "Risultati", risultati)}
    ${sue.length ? "" : `<div class="vuoto" style="margin-top:20px">Partite non disponibili: ${t.fine < oggi ? "il torneo è concluso e conserviamo solo le ultime quattro settimane." : "il tabellone non è ancora uscito."}</div>`}
    <p class="nota">Singolare, tabellone principale. Dati ESPN${t.categoria ? " e Wikipedia" : ""}.</p>`;
  const barra = document.querySelector(".turni-barra"), scelto = barra?.querySelector("[aria-pressed=true]");
  if (scelto) barra.scrollLeft = scelto.offsetLeft - (barra.clientWidth - scelto.offsetWidth) / 2;
}
document.getElementById("contenuto-torneo").addEventListener("click", (e) => {
  const b = e.target.closest("[data-turno]");
  if (!b) return;
  turnoScelto = b.dataset.turno;
  avvia();
});
avvia().catch(() => messaggioErrore(document.getElementById("contenuto-torneo")));
