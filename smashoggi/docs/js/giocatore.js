import { fetchJSON, esc, montaPagina, caricaGiocatori, schedaPartita, frecciaIndietro, messaggioErrore, nomeTour, avatar } from "./common.js?v=202610100426";

montaPagina("classifiche.html");
frecciaIndietro(document.getElementById("indietro"), "classifiche.html", "Classifiche");

const id = new URLSearchParams(location.search).get("id");

async function avvia() {
  const [giocatori, { partite }] = await Promise.all([caricaGiocatori(), fetchJSON("data/partite.json")]);
  const g = giocatori[id];
  const box = document.getElementById("contenuto-giocatore");
  if (!g) return messaggioErrore(box, "Giocatore non trovato. Le schede sono disponibili per i primi 100 di ATP e WTA.");
  document.title = `${g.nome} — Smash Oggi`;
  const dato = (k, v, testo) => (v || v === 0 ? `<div class="dato"><span>${k}</span><b class="${testo ? "testo" : ""}">${esc(v)}</b></div>` : "");
  const sue = partite.filter((p) => !p.qualifica && p.giocatori.some((x) => x.id === id));
  const prossime = sue.filter((p) => p.stato === "in" || p.stato === "pre").sort((a, b) => (a.data < b.data ? -1 : 1));
  const finite = sue.filter((p) => p.stato === "post").sort((a, b) => (a.data < b.data ? 1 : -1));
  const forma = finite.slice(0, 5).map((p) => p.giocatori.find((x) => x.id === id).vince);
  const delta = g.prec ? g.prec - g.pos : 0;
  const anni = g.nascita ? new Intl.DateTimeFormat("it-IT", { timeZone: "UTC", day: "numeric", month: "long", year: "numeric" }).format(new Date(g.nascita + "T12:00:00Z")) : null;

  box.innerHTML = `
    <div class="scheda-testa">
      <div class="grande">${g.pos}<small>${g.tour === "atp" ? "ATP" : "WTA"}</small></div>
      ${avatar(g, true)}
      <div><h1>${esc(g.nome)}</h1>
        <div class="sub">${g.paese === "ITA" ? '<span class="tag slam">Italia</span>' : ""}${esc(g.paese !== "ITA" ? g.paeseNome || g.paese || "" : "")}${g.eta ? ` · ${g.eta} anni` : ""}</div></div>
    </div>
    <div class="dati">
      ${dato("Classifica", `${g.pos}º ${g.tour === "atp" ? "ATP" : "WTA"}${delta ? (delta > 0 ? ` (▲${delta})` : ` (▼${-delta})`) : ""}`)}
      ${dato("Punti", g.punti)}
      ${dato("Paese", g.paeseNome, true)}
      ${dato("Età", g.eta)}
      ${dato("Nato a", g.luogoNascita, true)}
      ${dato("Data di nascita", anni, true)}
      ${dato("Altezza", g.altezzaCm ? `${g.altezzaCm} cm` : null)}
      ${dato("Mano", g.mano, true)}
      ${dato("Esordio", g.esordio)}
    </div>
    ${prossime.length ? `<div class="section-title">Prossima partita</div><div class="griglia-partite">${prossime.slice(0, 2).map((p) => schedaPartita(p, giocatori)).join("")}</div>` : ""}
    <div class="section-title">Ultimi risultati ${forma.length ? `<span class="count">${forma.map((v) => (v ? "V" : "S")).join(" ")}</span>` : ""}</div>
    ${finite.length ? `<div class="griglia-partite">${finite.slice(0, 10).map((p) => schedaPartita(p, giocatori)).join("")}</div>`
      : `<div class="vuoto">Nessuna partita del tabellone principale nelle ultime quattro settimane nei dati disponibili.</div>`}
    <p class="nota">V = vittoria, S = sconfitta. Singolare, tabellone principale, ultime quattro settimane. ${esc(nomeTour(g.tour))}: dati ESPN.</p>`;
}
avvia().catch(() => messaggioErrore(document.getElementById("contenuto-giocatore")));
