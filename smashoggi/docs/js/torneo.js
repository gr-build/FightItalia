import { partiteLive } from "./live.js?v=202610101009";
import { fetchJSON, esc, montaPagina, caricaGiocatori, listaPartite, schedaPartita, etichettaCategoria, intervalloDate, nomeTour, frecciaIndietro,
  messaggioErrore, oggiRoma, giornoRoma, dataBreve, punteggioPartita } from "./common.js?v=202610101009";

montaPagina("calendario.html");
frecciaIndietro(document.getElementById("indietro"), "calendario.html", "Calendario");

const q = new URLSearchParams(location.search);
const tour = q.get("tour") === "wta" ? "wta" : "atp";
const id = q.get("id");

// punteggi in diretta: a ogni cambiamento la pagina si ridisegna
const datiPartite = partiteLive(() => avvia().catch(() => {}));

async function avvia() {
  const [{ tornei }, { partite }, giocatori] = await Promise.all([fetchJSON("data/tornei.json"), datiPartite, caricaGiocatori()]);
  const t = tornei.find((x) => x.id === id && x.tour === tour);
  if (!t) return messaggioErrore(document.getElementById("contenuto-torneo"), "Torneo non trovato.");
  document.title = `${t.nome} — Smash Oggi`;
  const cat = etichettaCategoria(t);
  const oggi = oggiRoma();
  const inCorso = t.inizio <= oggi && t.fine >= oggi;
  const dato = (k, v, testo) => (v ? `<div class="dato"><span>${k}</span><b class="${testo ? "testo" : ""}">${esc(v)}</b></div>` : "");

  const sue = partite.filter((p) => p.torneoId === t.id && p.tour === t.tour && !p.qualifica);
  const inGioco = sue.filter((p) => p.stato === "in");
  const programma = sue.filter((p) => p.stato === "pre").sort((a, b) => (a.data < b.data ? -1 : 1));
  const risultati = sue.filter((p) => p.stato === "post").sort((a, b) => (a.data < b.data ? 1 : -1));

  const sez = (titolo, lista, ord) => (lista.length
    ? `<div class="section-title">${titolo} <span class="count">${lista.length}</span></div><div class="griglia-partite">${lista.slice(0, 40).map((p) => schedaPartita(p, giocatori)).join("")}</div>` : "");

  document.getElementById("contenuto-torneo").innerHTML = `
    <div class="scheda-testa"><div><h1>${esc(t.nome)}</h1>
      <div class="sub"><span class="tag ${cat.classe}">${esc(cat.testo)}</span>${inCorso ? '<span class="tag corso">In corso</span>' : ""}${esc(nomeTour(t.tour))}</div></div></div>
    <div class="dati">
      ${dato("Date", intervalloDate(t.inizio, t.fine), true)}
      ${dato("Luogo", [t.citta, t.paese].filter(Boolean).join(", "), true)}
      ${dato("Superficie", t.superficie, true)}
      ${dato("Categoria", cat.testo, true)}
    </div>
    ${sez("In campo adesso", inGioco)}
    ${sez("Prossime partite", programma)}
    ${sez("Ultimi risultati", risultati)}
    ${sue.length ? "" : `<div class="vuoto" style="margin-top:20px">Partite non disponibili: ${t.fine < oggi ? "il torneo è concluso e conserviamo solo le ultime quattro settimane." : "il tabellone non è ancora uscito."}</div>`}
    <p class="nota">Singolare, tabellone principale. Dati ESPN${t.categoria ? " e Wikipedia" : ""}.</p>`;
}
avvia().catch(() => messaggioErrore(document.getElementById("contenuto-torneo")));
