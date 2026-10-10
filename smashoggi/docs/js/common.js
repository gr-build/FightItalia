// Utilita' condivise tra le pagine di Smash Oggi: intestazione, pie' di pagina, tema, date, schede partita.

export const SITO = { nome: "Smash Oggi" };

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

// ---------- Lingue ----------
// Il sito nasce in italiano. Le altre lingue usano il traduttore di Google DENTRO la pagina (come MMA Oggi):
// la scelta vive nel cookie googtrans (/it/<lingua>) che il traduttore legge da solo.
const LINGUE = [
  ["it", "Italiano"], ["en", "English"], ["es", "Español"], ["fr", "Français"], ["de", "Deutsch"], ["pt", "Português"],
  ["pl", "Polski"], ["ro", "Română"], ["sq", "Shqip"], ["ar", "العربية"], ["ru", "Русский"], ["uk", "Українська"],
  ["tr", "Türkçe"], ["zh-CN", "中文"], ["ja", "日本語"],
];

function linguaAttuale() {
  const m = document.cookie.match(/(?:^|;\s*)googtrans=\/it\/([^;]+)/);
  return m && LINGUE.some(([c]) => c === m[1]) ? m[1] : "it";
}

function cambiaLingua(lingua) {
  const scadenza = lingua === "it" ? "; expires=Thu, 01 Jan 1970 00:00:00 GMT" : "; max-age=31536000";
  const valore = lingua === "it" ? "" : `/it/${lingua}`;
  for (const dominio of ["", `; domain=${location.hostname}`, `; domain=.${location.hostname}`]) {
    document.cookie = `googtrans=${valore}; path=/${dominio}${scadenza}`;
  }
  location.reload();
}

// I nomi di giocatori e tornei non si traducono ("Ciryl" -> "Cyryl")
const SELETTORE_NOMI = ".nome, .vs-nome, .champ-nome, .chi b, .brand, h1, .gruppo-torneo a, .mini-nome, .torneo-card h3";
function proteggiNomi(radice) {
  const elementi = radice.matches && radice.matches(SELETTORE_NOMI) ? [radice] : [];
  for (const e of [...elementi, ...radice.querySelectorAll(SELETTORE_NOMI)]) {
    e.classList.add("notranslate");
    e.setAttribute("translate", "no");
  }
}

function avviaTraduzione() {
  if (linguaAttuale() === "it") return;
  document.documentElement.classList.add("tradotto");
  proteggiNomi(document.body);
  new MutationObserver((cambi) => {
    for (const c of cambi) for (const n of c.addedNodes) if (n.nodeType === 1 && !n.closest(".skiptranslate")) proteggiNomi(n);
  }).observe(document.body, { childList: true, subtree: true });
  const box = document.createElement("div");
  box.id = "google_translate_element";
  box.hidden = true;
  document.body.appendChild(box);
  window.googleTranslateElementInit = () => {
    new window.google.translate.TranslateElement({ pageLanguage: "it", autoDisplay: false }, "google_translate_element");
  };
  const sc = document.createElement("script");
  sc.src = "https://translate.google.com/translate_a/element.js?cb=googleTranslateElementInit";
  document.body.appendChild(sc);
}

function selettoreLingua() {
  const attuale = linguaAttuale();
  const opzioni = LINGUE.map(([codice, nome]) => `<option value="${codice}"${codice === attuale ? " selected" : ""}>${nome}</option>`).join("");
  return `<label class="lingua" title="Lingua / Language">
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18"/></svg>
      <span class="sr-only">Lingua</span>
      <select id="lingua" aria-label="Lingua / Language">${opzioni}</select></label>`;
}

// ---------- Tema chiaro/scuro (di base scuro, come MMA Oggi; la scelta resta sul telefono) ----------
const SOLE = '<svg class="ico-sole" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></svg>';
const LUNA = '<svg class="ico-luna" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"/></svg>';

const temaCorrente = () => (document.documentElement.dataset.theme === "light" ? "light" : "dark");
function applicaTema(tema) {
  document.documentElement.dataset.theme = tema;
  try { localStorage.setItem("tema", tema); } catch (e) { /* senza memoria locale il tema vale solo per questa visita */ }
  const b = document.getElementById("tema-btn");
  if (b) b.setAttribute("aria-checked", tema === "light" ? "true" : "false");
  document.querySelector('meta[name="theme-color"]')?.setAttribute("content", tema === "light" ? "#f4f4f6" : "#0a0a0d");
}

// ---------- Foto e iniziali ----------
export const iniziali = (nome) => (nome || "?").split(/\s+/).filter(Boolean).map((p) => p[0]).slice(0, 2).join("").toUpperCase();
export function avatar(g, grande = false) {
  const c = `avatar${grande ? " avatar-grande" : ""}`;
  return g.foto ? `<img class="${c}" src="${esc(g.foto)}" alt="" loading="lazy" width="40" height="40">` : `<span class="${c}" aria-hidden="true">${esc(iniziali(g.nome))}</span>`;
}

// ---------- Intestazione e pie' di pagina ----------
const VOCI = [
  ["index.html", "Home"], ["partite.html", "Partite"], ["calendario.html", "Calendario"], ["classifiche.html", "Classifiche"], ["notizie.html", "News"],
];

export function montaPagina(paginaCorrente) {
  const header = document.getElementById("site-header");
  if (header) {
    header.innerHTML = `<div class="container nav">
        <a href="index.html" class="brand notranslate" translate="no" aria-label="Smash Oggi, home"><img src="img/logo.svg" alt="" class="brand-logo" width="56" height="56"><span>SMASH<span class="dot">•</span><span class="oggi">Oggi</span></span></a>
        <ul class="nav-links">${VOCI.map(([h, t]) => `<li><a href="${h}" class="${h === paginaCorrente ? "active" : ""}"${h === paginaCorrente ? ' aria-current="page"' : ""}>${t}</a></li>`).join("")}</ul>
        <div class="nav-strumenti">${selettoreLingua()}
          <button type="button" class="tema-btn" id="tema-btn" role="switch" aria-label="Tema chiaro" title="Chiaro / scuro">${SOLE}${LUNA}<span class="tema-pallino" aria-hidden="true"></span></button></div>
      </div>`;
    header.querySelector("#lingua").addEventListener("change", (e) => cambiaLingua(e.target.value));
    applicaTema(temaCorrente());
    header.querySelector("#tema-btn").addEventListener("click", () => applicaTema(temaCorrente() === "dark" ? "light" : "dark"));
  }
  const footer = document.getElementById("site-footer");
  if (footer) {
    footer.innerHTML = `<div class="container">
        <div class="footer-social"><span>Segui Smash Oggi</span><a class="social-link" href="seguici.html"><span>Seguici</span></a><a class="social-link" href="chi-siamo.html"><span>Chi siamo</span></a></div>
        <p>I dati riportati hanno scopo informativo e statistico; non costituiscono consiglio di scommessa. Gioca responsabilmente.</p>
        <p>Smash Oggi — risultati, calendario e classifiche del tennis. Dati da ESPN e Wikipedia, foto da ESPN e Wikimedia Commons (licenze libere), notizie con link alle testate originali, aggiornati periodicamente.</p>
        <p style="font-size:11.5px">Smash Oggi è un progetto indipendente, non affiliato né sponsorizzato da ATP, WTA, ITF o dai tornei citati.</p>
      </div>`;
  }
  const main = document.querySelector("main");
  if (main && !main.id) main.id = "contenuto";
  avviaTraduzione();
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
