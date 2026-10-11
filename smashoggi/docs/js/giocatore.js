import { partiteLive } from "./live.js?v=202610110114";
import { rigaFinale } from "./archivio-comune.js?v=202610110114";
import { fetchJSON, esc, montaPagina, caricaGiocatori, schedaPartita, frecciaIndietro, messaggioErrore, nomeTour, avatar } from "./common.js?v=202610110114";

montaPagina("classifiche.html");
frecciaIndietro(document.getElementById("indietro"), "tennisti.html", "Indietro");

const id = new URLSearchParams(location.search).get("id");

// punteggi in diretta: a ogni cambiamento la pagina si ridisegna
const datiPartite = partiteLive(() => avvia().catch(() => {}));

async function avvia() {
  const [giocatori, { partite }, { finali }] = await Promise.all([caricaGiocatori(), datiPartite, fetchJSON("data/archivio.json").catch(() => ({ finali: [] }))]);
  const g = giocatori[id];
  const box = document.getElementById("contenuto-giocatore");
  if (!g) return messaggioErrore(box, "Giocatore non trovato.");
  document.title = `${g.nome} — Smash Oggi`;
  const dato = (k, v, testo) => (v || v === 0 ? `<div class="dato"><span>${k}</span><b class="${testo ? "testo" : ""}">${esc(v)}</b></div>` : "");
  const sue = partite.filter((p) => !p.qualifica && p.giocatori.some((x) => x.id === id));
  const prossime = sue.filter((p) => p.stato === "in" || p.stato === "pre").sort((a, b) => (a.data < b.data ? -1 : 1));
  const finite = sue.filter((p) => p.stato === "post").sort((a, b) => (a.data < b.data ? 1 : -1));
  const forma = finite.slice(0, 5).map((p) => p.giocatori.find((x) => x.id === id).vince);
  const delta = g.prec ? g.prec - g.pos : 0;
  const anni = g.nascita ? new Intl.DateTimeFormat("it-IT", { timeZone: "UTC", day: "numeric", month: "long", year: "numeric" }).format(new Date(g.nascita + "T12:00:00Z")) : null;

  box.innerHTML = `
    <div class="gioc-hero${g.paese === "ITA" ? " ita" : ""}">
      <div class="gh-foto">${g.foto ? `<img src="${esc(g.foto)}" alt="">` : `<span>${esc(g.nome.split(" ").map((x) => x[0]).join("").slice(0, 2))}</span>`}</div>
      <div class="gh-testo">
        <div class="gh-tag">${g.pos ? `<span class="gh-rank">N° ${g.pos} <small>${g.tour.toUpperCase()}</small></span>` : `<span class="gh-rank muto">${g.soloChallenger ? "Challenger" : g.tour.toUpperCase()}</span>`}${delta ? `<span class="var ${delta > 0 ? "su" : "giu"}">${delta > 0 ? `▲${delta}` : `▼${-delta}`}</span>` : ""}</div>
        <h1>${esc(g.nome)}</h1>
        <div class="gh-sub"><span class="codice">${esc(g.paese || "–")}</span>${esc(g.paeseNome || "")}${g.eta ? ` · ${g.eta} anni` : ""}${g.mano ? ` · ${g.mano === "Sinistra" ? "mancino" : "destrorso"}` : ""}</div>
      </div>
    </div>
    ${g.vinte != null && g.perse != null && g.vinte + g.perse > 0 ? (() => {
      const pc = Math.round((g.vinte / (g.vinte + g.perse)) * 100);
      return `<div class="gh-bilancio"><div class="gh-num"><b>${g.titoli ?? 0}</b><small>titoli in carriera</small></div>
        <div class="gh-barra"><div class="gh-barra-testo"><span><b>${g.vinte}</b> vinte</span><span>${pc}%</span><span><b>${g.perse}</b> perse</span></div>
        <div class="gh-barra-fondo"><i style="width:${pc}%"></i></div></div>
        ${forma.length ? `<div class="gh-forma" aria-label="Forma: ultime partite">${forma.map((v) => `<span class="${v ? "v" : "s"}">${v ? "V" : "S"}</span>`).join("")}</div>` : ""}</div>`;
    })() : ""}
    <p style="margin:14px 0 0"><a class="pill attiva btn-confronta" href="confronto.html?a=${encodeURIComponent(g.id)}">⚖️ Confronta con un altro tennista</a></p>
    <div class="dati">
      ${dato("Classifica", g.pos && `${g.pos}º ${g.tour === "atp" ? "ATP" : "WTA"}${delta ? (delta > 0 ? ` (▲${delta})` : ` (▼${-delta})`) : ""}`)}
      ${dato("Punti", g.punti)}
      ${dato("Paese", g.paeseNome, true)}
      ${dato("Età", g.eta)}
      ${dato("Nato a", g.luogoNascita, true)}
      ${dato("Data di nascita", anni, true)}
      ${dato("Altezza", g.altezzaCm ? `${g.altezzaCm} cm` : null)}
      ${dato("Mano", g.mano, true)}
      ${dato("Esordio", g.esordio)}
      ${dato(`Titoli ${new Date().getFullYear()}`, g.titoliAnno)}
      ${dato(`Challenger vinti ${new Date().getFullYear()}`, g.titoliChallenger)}
    </div>
    ${(() => {
      const sueFinali = finali.filter((a) => a.vincitore.id === id || a.finalista.id === id);
      if (!sueFinali.length) return "";
      return `<div class="section-title">Finali della stagione <span class="count">${sueFinali.filter((a) => a.vincitore.id === id).length} vinte su ${sueFinali.length}</span></div>
        <div class="lista-finali">${sueFinali.map((a) => rigaFinale(a, id)).join("")}</div>`;
    })()}
    ${prossime.length ? `<div class="section-title">Prossima partita</div><div class="griglia-partite">${prossime.slice(0, 2).map((p) => schedaPartita(p, giocatori)).join("")}</div>` : ""}
    <div class="section-title">Ultimi risultati ${forma.length ? `<span class="count">${forma.map((v) => (v ? "V" : "S")).join(" ")}</span>` : ""}</div>
    ${finite.length ? `<div class="griglia-partite">${finite.slice(0, 10).map((p) => schedaPartita(p, giocatori)).join("")}</div>`
      : `<div class="vuoto">Nessuna partita del tabellone principale nelle ultime quattro settimane nei dati disponibili.</div>`}
    <p class="nota">V = vittoria, S = sconfitta. Singolare, tabellone principale, ultime quattro settimane. Titoli e vittorie in carriera: singolare. ${g.soloChallenger ? "Scheda ricavata dalle finali Challenger (Wikipedia)." : `${esc(nomeTour(g.tour))}: dati ESPN.`}</p>`;
}
avvia().catch(() => messaggioErrore(document.getElementById("contenuto-giocatore")));
