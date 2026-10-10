// Utilita' condivise tra le pagine di Tennis Oggi: intestazione, pie' di pagina, tema, date, schede partita.

export const SITO = { nome: "Tennis Oggi" };

export function esc(t) {
  return String(t ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

export async function fetchJSON(percorso) {
  // "no-cache": il browser ricontrolla sempre col server (304 se non e' cambiato)
  const res = await fetch(percorso, { cache: "no-cache" });
  if (!res.ok) throw new Error(`Errore caricando ${percorso}: ${res.status}`);
  return res.json();
}

export function messaggioErrore(contenitore, testo = "Non riesco a caricare i dati. Riprova tra poco.") {
  contenitore.innerHTML = `<div class="vuoto" role="alert">${esc(testo)}</div>`;
}

// ---------- Date (sempre ora italiana) ----------
const FUSO = "Europe/Rome";
const fmtGiorno = new Intl.DateTimeFormat("en-CA", { timeZone: FUSO });
const fmtOra = new Intl.DateTimeFormat("it-IT", { timeZone: FUSO, hour: "2-digit", minute: "2-digit" });
const fmtLungo = new Intl.DateTimeFormat("it-IT", { timeZone: FUSO, weekday: "long", day: "numeric", month: "long" });
const fmtBreve = new Intl.DateTimeFormat("it-IT", { timeZone: FUSO, day: "numeric", month: "short" });

export const giornoRoma = (iso) => fmtGiorno.format(new Date(iso));
export const oraRoma = (iso) => fmtOra.format(new Date(iso));
export const dataLunga = (iso) => fmtLungo.format(new Date(iso));
export const dataBreve = (iso) => fmtBreve.format(new Date(iso));
export const oggiRoma = () => fmtGiorno.format(new Date());
// "2026-10-05" (solo data, senza ora) -> oggetto Date a mezzogiorno UTC, cosi' il fuso non sposta il giorno
export const dataSolo = (s) => new Date(`${s}T12:00:00Z`);
export const giornoMese = (s) => ({ g: dataSolo(s).getUTCDate(), m: new Intl.DateTimeFormat("it-IT", { timeZone: "UTC", month: "short" }).format(dataSolo(s)) });
export function intervalloDate(inizio, fine) {
  const a = giornoMese(inizio);
  if (!fine || fine === inizio) return `${a.g} ${a.m}`;
  const b = giornoMese(fine);
  return a.m === b.m ? `${a.g}–${b.g} ${b.m}` : `${a.g} ${a.m} – ${b.g} ${b.m}`;
}
export function mesiIt(s) {
  const t = new Intl.DateTimeFormat("it-IT", { timeZone: "UTC", month: "long", year: "numeric" }).format(dataSolo(s));
  return t.charAt(0).toUpperCase() + t.slice(1);
}

// ---------- Categorie dei tornei ----------
export function etichettaCategoria(t) {
  const c = t.categoria;
  if (c === "Grand Slam") return { testo: "Slam", classe: "slam" };
  if (c === "1000") return { testo: t.tour === "atp" ? "Masters 1000" : "WTA 1000", classe: "" };
  if (c === "500" || c === "250") return { testo: `${t.tour === "atp" ? "ATP" : "WTA"} ${c}`, classe: "" };
  if (c === "Finals") return { testo: "Finals", classe: "" };
  return { testo: "Altro torneo", classe: "neutro" };
}
export const nomeTour = (t) => (t === "atp" ? "Uomini" : "Donne");

// ---------- Giocatori e partite ----------
let cacheGiocatori;
export function caricaGiocatori() {
  cacheGiocatori ??= fetchJSON("data/giocatori.json");
  return cacheGiocatori;
}

export const linkGiocatore = (g, giocatori) =>
  giocatori[g.id] ? `<a href="giocatore.html?id=${encodeURIComponent(g.id)}">${esc(g.nome)}</a>` : esc(g.nome);

function setHtml(giocatore) {
  return giocatore.set.map((s) => `<b class="${s.v ? "v" : ""}">${s.g}${s.tb !== undefined ? `<sup>${s.tb}</sup>` : ""}</b>`).join("");
}

export function schedaPartita(p, giocatori) {
  const finita = p.stato === "post";
  const inCorso = p.stato === "in";
  // segno quali set ha vinto ciascuno, per evidenziarli
  // partita appena iniziata: 0-0 nel primo set non e' un risultato da mostrare
  const zero = inCorso && p.giocatori.every((g) => g.set.length <= 1 && g.set.every((s) => s.g === 0));
  const [a, b] = p.giocatori.map((g) => ({ ...g, set: zero ? [] : g.set.map((s) => ({ ...s })) }));
  a.set.forEach((s, i) => { const o = b.set[i]; if (o) { s.v = s.g > o.g; o.v = o.g > s.g; } });
  const stato = inCorso ? `<span class="stato live">In corso</span>`
    : finita ? `<span class="stato">Finita</span>` : `<span class="stato">${esc(oraRoma(p.data))}</span>`;
  const riga = (g) => `<div class="riga-giocatore${g.paese === "ITA" ? " ita" : ""}${g.vince ? " vince" : ""}">
      <span class="codice" title="${esc(g.paese || "")}">${esc(g.paese || "–")}</span>
      <span class="nome">${linkGiocatore(g, giocatori)}</span>
      <span class="set">${setHtml(g)}</span></div>`;
  return `<article class="partita">
    <div class="meta"><span>${esc(p.turno)}${p.campo ? ` · ${esc(p.campo)}` : ""}</span>${stato}</div>
    ${riga(a)}${riga(b)}
    ${p.speciale ? `<div class="speciale">${esc(p.speciale)}</div>` : ""}
  </article>`;
}

// Chi mostrare per primo: italiani, poi i giocatori meglio classificati
export function punteggioPartita(p, giocatori) {
  let s = 0;
  for (const g of p.giocatori) {
    if (g.paese === "ITA") s += 1000;
    const r = giocatori[g.id]?.pos;
    if (r) s += Math.max(0, 200 - r);
  }
  return s;
}

export function listaPartite(partite, giocatori, { raggruppa = true } = {}) {
  if (!partite.length) return "";
  let html = "";
  let ultimo = null;
  for (const p of partite) {
    if (raggruppa && p.torneoId + p.tour !== ultimo) {
      ultimo = p.torneoId + p.tour;
      html += `<div class="gruppo-torneo"><a href="torneo.html?tour=${p.tour}&id=${encodeURIComponent(p.torneoId)}">${esc(p.torneo)}</a><span class="tag neutro">${p.tour === "atp" ? "ATP" : "WTA"}</span></div>`;
    }
    html += schedaPartita(p, giocatori);
  }
  return html;
}

// ---------- Tema chiaro/scuro ----------
const SOLE = `<svg class="ico-sole" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></svg>`;
const LUNA = `<svg class="ico-luna" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"/></svg>`;
const MENU = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M4 6h16M4 12h16M4 18h16"/></svg>`;

const temaCorrente = () => (document.documentElement.dataset.theme === "light" ? "light" : "dark");
function applicaTema(tema) {
  document.documentElement.dataset.theme = tema;
  try { localStorage.setItem("tema", tema); } catch (e) { /* senza memoria locale il tema vale solo per questa visita */ }
  document.querySelector('meta[name="theme-color"]')?.setAttribute("content", tema === "light" ? "#f4f4f6" : "#0a0a0d");
}

// ---------- Intestazione e pie' di pagina ----------
const VOCI = [
  ["index.html", "Oggi"], ["calendario.html", "Calendario"], ["classifiche.html", "Classifiche"], ["notizie.html", "Notizie"],
];

export function montaPagina(paginaCorrente) {
  const voce = (h, t) => `<a href="${h}"${h === paginaCorrente ? ' aria-current="page"' : ""}>${t}</a>`;
  const header = document.getElementById("site-header");
  if (header) {
    header.innerHTML = `<div class="container nav">
        <a class="brand" href="index.html" aria-label="Tennis Oggi, pagina iniziale"><img src="img/logo.svg" alt="" width="38" height="38"><span>TENNIS<span class="dot">•</span><span class="oggi">Oggi</span></span></a>
        <nav class="nav-links" aria-label="Menu principale">${VOCI.map(([h, t]) => voce(h, t)).join("")}</nav>
        <div class="nav-azioni">
          <button type="button" class="icon-btn tema-btn" id="tema-btn" aria-label="Cambia tema, chiaro o scuro">${SOLE}${LUNA}</button>
          <button type="button" class="icon-btn menu-btn" id="menu-btn" aria-label="Apri il menu" aria-expanded="false" aria-controls="menu-mobile">${MENU}</button>
        </div>
      </div>
      <nav class="menu-mobile" id="menu-mobile" aria-label="Menu principale">${VOCI.map(([h, t]) => voce(h, t)).join("")}</nav>`;
    applicaTema(temaCorrente());
    header.querySelector("#tema-btn").addEventListener("click", () => applicaTema(temaCorrente() === "dark" ? "light" : "dark"));
    const btn = header.querySelector("#menu-btn");
    btn.addEventListener("click", () => {
      const aperto = header.querySelector("#menu-mobile").classList.toggle("aperto");
      btn.setAttribute("aria-expanded", String(aperto));
    });
  }
  const footer = document.getElementById("site-footer");
  if (footer) {
    footer.innerHTML = `<div class="container colonne">
        <div><a class="brand" href="index.html" style="font-size:20px"><img src="img/logo.svg" alt="" width="30" height="30"><span>TENNIS<span class="dot">•</span><span class="oggi">Oggi</span></span></a>
          <p style="margin:10px 0 0;max-width:42ch">Classifiche, calendario e risultati del tennis, in italiano. Dati da fonti pubbliche, mai quote né pronostici.</p></div>
        <div><h4>Il sito</h4><div class="links">${VOCI.map(([h, t]) => `<a href="${h}">${t}</a>`).join("")}</div></div>
        <div><h4>Info</h4><div class="links"><a href="chi-siamo.html">Chi siamo</a><a href="seguici.html">Seguici</a></div>
          <p class="nota">Fonti: ESPN, Wikipedia e le testate indicate accanto a ogni notizia.</p></div>
      </div>`;
  }
  const main = document.querySelector("main");
  if (main && !main.id) main.id = "contenuto";
}

// Freccia "Indietro" per le pagine di dettaglio
export function frecciaIndietro(contenitore, fallback, etichetta) {
  contenitore.innerHTML = `<div class="container indietro-riga"><button type="button" class="indietro" id="indietro-btn"><span aria-hidden="true">←</span>${esc(etichetta)}</button></div>`;
  contenitore.querySelector("#indietro-btn").addEventListener("click", () => {
    if (document.referrer && new URL(document.referrer).origin === location.origin && history.length > 1) history.back();
    else location.href = fallback;
  });
}

export function aggiornatoIl(iso) {
  const d = new Date(iso);
  return `Aggiornato il ${new Intl.DateTimeFormat("it-IT", { timeZone: FUSO, day: "numeric", month: "long" }).format(d)} alle ${oraRoma(iso)}`;
}
