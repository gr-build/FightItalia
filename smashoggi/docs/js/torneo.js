import { partiteLive } from "./live.js?v=202610110114";
import { fetchJSON, esc, montaPagina, caricaGiocatori, listaPartite, schedaPartita, etichettaCategoria, intervalloDate, nomeTour, frecciaIndietro,
  messaggioErrore, oggiRoma, giornoRoma, dataBreve, punteggioPartita, superficie, avatar } from "./common.js?v=202610110114";

montaPagina("calendario.html");
frecciaIndietro(document.getElementById("indietro"), "calendario.html", "Calendario");

import { punteggioFinale } from "./archivio-comune.js?v=202610110114";

const q = new URLSearchParams(location.search);
const idChallenger = q.get("ch");
const tour = q.get("tour") === "wta" ? "wta" : "atp";
const id = q.get("id");

// punteggi in diretta: a ogni cambiamento la pagina si ridisegna
const datiPartite = idChallenger ? null : partiteLive(() => avvia().catch(() => {}));
const datiArchivio = fetchJSON("data/archivio.json").catch(() => ({ finali: [] }));

// Testata del torneo: fascia colorata come il campo (terra, erba, cemento, indoor)
const classeCampo = (s) => (!s ? "cemento" : /indoor/i.test(s) ? "indoor" : /terra/i.test(s) ? "terra" : /erba/i.test(s) ? "erba" : "cemento");
function testata(t, cat, statoHtml) {
  return `<div class="torneo-hero campo-${classeCampo(t.superficie)}">
      <div class="th-righe" aria-hidden="true"></div>
      <div class="th-tag"><span class="tag ${cat.classe}">${esc(cat.testo)}</span>${statoHtml}</div>
      <h1>${esc(t.nome)}</h1>
      <div class="th-info">${esc(intervalloDate(t.inizio, t.fine))}${t.citta ? ` · ${esc(t.citta)}` : ""}${t.paese ? `, ${esc(t.paese)}` : ""}</div>
      <div class="th-info">${esc(nomeTour(t.tour))}${t.superficie ? ` · ${superficie(t.superficie)}` : ""}</div>
    </div>`;
}
// Il campione, quando il torneo e' finito
function campione(f, giocatori) {
  if (!f) return "";
  const v = giocatori[f.vincitore.id] || f.vincitore;
  const tagA = f.vincitore.id ? `a href="giocatore.html?id=${encodeURIComponent(f.vincitore.id)}"` : "div";
  return `<${tagA} class="campione">
      <span class="campione-coppa" aria-hidden="true">🏆</span>${avatar({ ...v, nome: f.vincitore.nome }, true)}
      <span class="campione-testo"><small>Campione</small><b>${esc(f.vincitore.nome)}</b><span>batte ${esc(f.finalista.nome)} · <strong>${esc(punteggioFinale(f))}</strong></span></span></${tagA.split(" ")[0]}>`;
}

// Turni in ordine di tabellone, con un'etichetta corta per i bottoni
const TURNI = [["Girone", "Gironi"], ["Primo turno", "1° turno"], ["Secondo turno", "2° turno"], ["Terzo turno", "3° turno"], ["Quarto turno", "4° turno"],
  ["Trentaduesimi di finale", "32esimi"], ["Sedicesimi di finale", "16esimi"], ["Ottavi di finale", "Ottavi"], ["Quarti di finale", "Quarti"],
  ["Semifinale", "Semifinali"], ["Finale 3º posto", "3º posto"], ["Finale", "Finale"]];
const ordineTurno = (t) => { const i = TURNI.findIndex(([n]) => n === t); return i < 0 ? 50 : i; };
const corto = (t) => TURNI.find(([n]) => n === t)?.[1] || t;
let turnoScelto = null; // resta scelto anche quando arrivano i punteggi in diretta

async function avvia() {
  if (idChallenger) return avviaChallenger();
  const [{ tornei }, { partite }, giocatori, { finali }] = await Promise.all([fetchJSON("data/tornei.json"), datiPartite, caricaGiocatori(), datiArchivio]);
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
    ${testata(t, cat, concluso ? '<span class="tag neutro">Concluso</span>' : inCorso ? '<span class="tag corso">In corso</span>' : "")}
    ${campione(finali.find((f) => f.tour === t.tour && f.torneoId === String(t.id)), giocatori)}
    ${turni.length > 1 ? `<div class="turni-barra" role="group" aria-label="Scegli il turno">${[...turni, "tutti"].map((x) =>
      `<button type="button" class="pill" data-turno="${esc(x)}" aria-pressed="${x === turnoScelto}">${esc(x === "tutti" ? "Tutti" : corto(x))}</button>`).join("")}</div>` : ""}
    ${sez("In campo adesso", inGioco)}
    ${sez("Prossime partite", programma)}
    ${sez(turnoScelto === "tutti" ? "Ultimi risultati" : "Risultati", risultati)}
    ${sue.length ? "" : `<div class="vuoto" style="margin-top:20px">${t.fine < oggi ? "Torneo concluso: delle partite conserviamo solo le ultime quattro settimane, la finale resta nell'archivio." : "Il tabellone non è ancora uscito."}</div>`}
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

// ---------- Pagina di un Challenger (dati Wikipedia) ----------
async function avviaChallenger() {
  const [{ tornei }, giocatori] = await Promise.all([fetchJSON("data/challenger.json"), caricaGiocatori()]);
  const t = tornei.find((x) => x.id === idChallenger);
  const box = document.getElementById("contenuto-torneo");
  if (!t) return messaggioErrore(box, "Torneo non trovato.");
  document.title = `${t.nome} — Smash Oggi`;
  const cat = etichettaCategoria(t);
  // i nomi di Wikipedia si collegano alle schede per nome
  const norma = (x) => (x || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
  const perNome = new Map(Object.values(giocatori).filter((g) => g.tour === "atp").map((g) => [norma(g.nome), g.id]));
  const conId = (p) => (p ? { ...p, id: p.id || perNome.get(norma(p.nome)) } : p);
  const stato = { concluso: '<span class="tag neutro">Concluso</span>', "in corso": '<span class="tag corso">In corso</span>', programma: '<span class="tag neutro">In programma</span>' }[t.stato] || "";
  const persona = (p0) => { const p = conId(p0); return p ? `<span class="ch-p${p.paese === "ITA" ? " ita" : ""}"><span class="codice">${esc(p.paese || "–")}</span>${p.id ? `<a href="giocatore.html?id=${encodeURIComponent(p.id)}">${esc(p.nome)}</a>` : esc(p.nome)}</span>` : `<span class="ch-p attesa">da definire</span>`; };
  const sfida = (l) => `<div class="ch-sfida">${persona(l?.[0])}${persona(l?.[1])}</div>`;
  let corpo = "";
  if (t.stato === "concluso") {
    corpo = campione({ vincitore: conId(t.vincitore), finalista: t.finalista, punteggioTesto: t.punteggioTesto }, giocatori)
      + (t.semifinali?.length ? `<h2 class="section-title">Semifinalisti</h2><div class="af">${t.semifinali.flat().map((p) => `<div class="ch-sfida">${persona(p)}</div>`).join("")}</div>` : "")
      + (t.quarti?.length ? `<h2 class="section-title">Quarti di finale</h2><div class="af">${t.quarti.map((p) => `<div class="ch-sfida">${persona(p)}</div>`).join("")}</div>` : "");
  } else {
    corpo = `<p class="ch-avviso"><b>Live senza punteggio punto per punto:</b> per i Challenger il risultato è disponibile a fine partita.</p>`
      + (t.finale ? `<h2 class="section-title">Finale</h2><div class="af">${sfida(t.finale)}</div>` : "")
      + (t.semifinali?.length ? `<h2 class="section-title">Semifinali</h2><div class="af">${t.semifinali.map((s) => (s.length === 2 ? sfida(s) : `<div class="ch-sfida">${persona(s[0])}<span class="ch-vs testo">in finale</span></div>`)).join("")}</div>` : "")
      + (t.quarti?.length ? `<h2 class="section-title">Eliminati nei quarti</h2><div class="af">${t.quarti.map((p) => `<div class="ch-sfida">${persona(p)}</div>`).join("")}</div>` : "")
      + (!t.finale && !t.semifinali?.length ? `<div class="vuoto">Tabellone non ancora disponibile.</div>` : "");
  }
  box.innerHTML = testata(t, cat, stato) + corpo + `<p class="nota">ATP Challenger Tour. Dati: Wikipedia (CC BY-SA), aggiornati a fine partita.</p>`;
}
