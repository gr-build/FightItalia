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
  if (c && c.startsWith("Challenger")) return { testo: c, classe: "challenger" };
  return { testo: "Altro torneo", classe: "neutro" };
}
// superficie con il quadratino del colore del campo (terra arancione, erba verde, cemento blu, indoor viola)
export function superficie(s) {
  if (!s) return "";
  const c = /indoor/i.test(s) ? "indoor" : /terra/i.test(s) ? "terra" : /erba/i.test(s) ? "erba" : "cemento";
  return `<span class="sup sup-${c}">${esc(s)}</span>`;
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
      <span class="codice" title="${esc(g.paeseNome || g.paese || "")}">${bandiera(g.paese)}${esc(g.paese || "–")}</span>
      ${giocatori[g.id]?.foto ? `<img class="mini-foto" src="${esc(giocatori[g.id].foto)}" alt="" loading="lazy" width="26" height="26">` : `<span class="mini-foto" aria-hidden="true">${esc(iniziali(g.nome))}</span>`}<span class="nome">${linkGiocatore(g, giocatori)}</span>
      <span class="set">${setHtml(g)}</span></div>`;
  return `<article class="partita" data-href="partita.html?tour=${p.tour}&id=${encodeURIComponent(p.id)}">
    <div class="meta"><span>${esc(p.turno)}${p.campo ? ` · ${esc(p.campo)}` : ""}</span>${stato}</div>
    ${riga(a)}${riga(b)}
    ${p.speciale ? `<div class="speciale">${esc(p.speciale)}</div>` : ""}
    <div class="dettagli-link">Dati della partita <span aria-hidden="true">›</span></div>
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

// ---------- Temi: le superfici dei campi (Indoor scuro, Erba, Terra battuta, Cemento); la scelta resta sul telefono ----------
const TEMI = [
  { id: "indoor", nome: "Indoor", citta: "Torino", nota: "scuro", colore: "#4b3fb8", ink: "#ffffff", tono: "scuro", meta: "#0f0c24" },
  { id: "erba", nome: "Erba", citta: "Londra", nota: "chiaro", colore: "#8fc23a", ink: "#14200a", tono: "chiaro", meta: "#eaeee1" },
  { id: "terra", nome: "Terra battuta", citta: "Parigi", nota: "arancio", colore: "#d9622b", ink: "#ffffff", tono: "chiaro", meta: "#f0d3ba" },
  { id: "cemento", nome: "Cemento", citta: "New York", nota: "blu", colore: "#2f7bff", ink: "#ffffff", tono: "chiaro", meta: "#cfe0f5" },
];
const TEMA_BASE = "cemento";   // si apre sul cemento: il blu dice subito "campo da tennis"
const temaCorrente = () => TEMI.find((t) => t.id === document.documentElement.dataset.theme) || TEMI.find((t) => t.id === TEMA_BASE);
function applicaTema(id) {
  const t = TEMI.find((x) => x.id === id) || TEMI.find((x) => x.id === TEMA_BASE);
  document.documentElement.dataset.theme = t.id;
  document.documentElement.dataset.tono = t.tono;
  try { localStorage.setItem("tema", t.id); } catch (e) { /* senza memoria locale il tema vale solo per questa visita */ }
  document.querySelector('meta[name="theme-color"]')?.setAttribute("content", t.meta);
  document.querySelectorAll(".tema-q").forEach((b) => b.setAttribute("aria-checked", String(b.dataset.tema === t.id)));
}
function montaSceltaTema(header) {
  const gruppo = header.querySelector("#temi");
  gruppo.innerHTML = TEMI.map((t) => `<button type="button" class="tema-q" role="radio" data-tema="${t.id}" aria-checked="false" aria-label="${t.nome} (${t.citta})" title="${t.nome} · ${t.citta}" style="--sw:${t.colore};--ink:${t.ink}">${t.citta[0]}</button>`).join("");
  gruppo.addEventListener("click", (e) => { const q = e.target.closest(".tema-q"); if (q) applicaTema(q.dataset.tema); });
  applicaTema(temaCorrente().id);
}

// ---------- Bandiere (copiate nel sito: img/bandiere/xxx.webp, codice ISO3 minuscolo) ----------
export const bandiera = (cod, c = "flag") => (cod ? `<img class="${c}" src="img/bandiere/${esc(String(cod).toLowerCase())}.webp" alt="" width="18" height="12" loading="lazy" onerror="this.remove()">` : "");

// ---------- Foto e iniziali ----------
export const iniziali = (nome) => (nome || "?").split(/\s+/).filter(Boolean).map((p) => p[0]).slice(0, 2).join("").toUpperCase();
export function avatar(g, grande = false) {
  const c = `avatar${grande ? " avatar-grande" : ""}`;
  return g.foto ? `<img class="${c}" src="${esc(g.foto)}" alt="" loading="lazy" width="40" height="40">` : `<span class="${c}" aria-hidden="true">${esc(iniziali(g.nome))}</span>`;
}

// ---------- Intestazione e pie' di pagina ----------
const VOCI = [
  ["index.html", "Home"], ["live.html", "Live"], ["partite.html", "Risultati"], ["calendario.html", "Calendario"], ["classifiche.html", "Classifiche"],
  ["tennisti.html", "Tennisti"], ["archivio.html", "Archivio"], ["notizie.html", "News"]
];

// tocco su una scheda partita (fuori dai nomi dei giocatori) = apre la pagina con i dati della partita
document.addEventListener("click", (e) => {
  const a = e.target.closest(".partita[data-href]");
  if (!a || e.target.closest("a, button")) return;
  location.href = a.dataset.href;
});

export function montaPagina(paginaCorrente) {
  const header = document.getElementById("site-header");
  if (header) {
    header.innerHTML = `<div class="container nav">
        <a href="index.html" class="brand notranslate" translate="no" aria-label="Smash Oggi, home"><img src="img/logo.svg" alt="Smash Oggi" class="brand-logo" width="97" height="56"></a>
        <div class="nav-riga2"><a class="btn-giochi${paginaCorrente === "giochi.html" ? " attivo" : ""}" href="giochi.html"${paginaCorrente === "giochi.html" ? ' aria-current="page"' : ""}><span aria-hidden="true">🎮</span>Giochi</a>
        <div class="nav-menu" id="nav-menu"><ul class="nav-links" id="nav-links">${VOCI.map(([h, t]) => `<li><a href="${h}" class="${h === paginaCorrente ? "active" : ""}${h === "giochi.html" ? " voce-giochi" : ""}${h === "live.html" ? " voce-live" : ""}"${h === paginaCorrente ? ' aria-current="page"' : ""}>${t}</a></li>`).join("")}</ul></div></div>
        <div class="nav-strumenti">${selettoreLingua()}
          <div class="temi" id="temi" role="radiogroup" aria-label="Colore del campo"></div></div>
      </div>`;
    // la barra scorre: porta la voce attiva al centro e toglie la sfumatura quando si e' arrivati in fondo
    const lista = header.querySelector("#nav-links"), menu = header.querySelector("#nav-menu"), attiva = lista.querySelector(".active");
    const fondo = () => menu.classList.toggle("fine", lista.scrollLeft + lista.clientWidth >= lista.scrollWidth - 4);
    if (attiva) lista.scrollLeft = attiva.offsetLeft - (lista.clientWidth - attiva.offsetWidth) / 2;
    lista.addEventListener("scroll", fondo, { passive: true });
    requestAnimationFrame(fondo);
    header.querySelector("#lingua").addEventListener("change", (e) => cambiaLingua(e.target.value));
    montaSceltaTema(header);
  }
  const footer = document.getElementById("site-footer");
  if (footer) {
    footer.innerHTML = `<div class="container">
        <details class="feedback" id="feedback">
          <summary><span class="fb-titolo">Aiutaci a migliorare <b aria-hidden="true">+</b></span><span class="fb-stelle" aria-hidden="true">★★★★★</span></summary>
          <form class="fb-form" id="fb-form">
            <div class="fb-stelle-scelta" role="radiogroup" aria-label="Voto">${[1, 2, 3, 4, 5].map((n) => `<button type="button" class="fb-stella" role="radio" aria-checked="false" aria-label="${n} su 5" data-v="${n}">★</button>`).join("")}</div>
            <label class="sr-only" for="fb-tipo">Che cosa vuoi dirci</label>
            <select id="fb-tipo"><option>Vorrei una funzione nuova</option><option>Ho trovato un errore</option><option>Un dato è sbagliato</option><option>Un complimento</option></select>
            <label class="sr-only" for="fb-testo">Il tuo messaggio</label>
            <textarea id="fb-testo" rows="3" maxlength="600" placeholder="Cosa miglioreresti in questa pagina?"></textarea>
            <button type="submit" class="fb-invia">Invia</button>
            <p class="fb-esito" id="fb-esito" role="status"></p>
          </form>
        </details>
        <div class="footer-colonne">
          <div><h3>Sezioni</h3>${[["index.html", "Home"], ["live.html", "Live"], ["partite.html", "Risultati"], ["calendario.html", "Calendario"], ["classifiche.html", "Classifiche"], ["tennisti.html", "Tennisti"], ["archivio.html", "Archivio"], ["giochi.html", "Giochi"], ["notizie.html", "News"]].map(([h, t]) => `<a href="${h}">${t}</a>`).join("")}</div>
          <div><h3>Fonte dati</h3><span>ESPN: classifiche, partite, tornei</span><span>Wikipedia: Challenger e categorie</span><span>Wikimedia Commons: foto</span><span>Notizie: Ubitennis, Tennis Italiano, OA Sport, Gazzetta, Corriere dello Sport, Tuttosport</span></div>
          <div><h3>Seguici</h3><a href="seguici.html">Dove trovarci</a><a href="chi-siamo.html">Chi siamo</a><h3 style="margin-top:14px">Legale</h3><span>Sito non ufficiale</span><span>Nessuna quota né pronostici</span></div>
        </div>
        <p class="footer-nota">I dati riportati hanno scopo informativo e statistico; non costituiscono consiglio di scommessa. Gioca responsabilmente.</p>
        <p class="footer-nota">Smash Oggi è un progetto indipendente, non affiliato né sponsorizzato da ATP, WTA, ITF o dai tornei citati. Dati aggiornati periodicamente.</p>
      </div>`;
    // Feedback: l'invio vero si attiva con un indirizzo di raccolta (FEEDBACK_URL); finche' manca, il modulo lo dice chiaramente
    const FEEDBACK_URL = "";
    let voto = 0;
    footer.querySelectorAll(".fb-stella").forEach((b) => b.addEventListener("click", () => {
      voto = Number(b.dataset.v);
      footer.querySelectorAll(".fb-stella").forEach((x) => { const on = Number(x.dataset.v) <= voto; x.classList.toggle("on", on); x.setAttribute("aria-checked", String(Number(x.dataset.v) === voto)); });
    }));
    footer.querySelector("#fb-form").addEventListener("submit", async (e) => {
      e.preventDefault();
      const out = footer.querySelector("#fb-esito"), testo = footer.querySelector("#fb-testo").value.trim();
      if (!testo && !voto) { out.textContent = "Scrivi un messaggio o scegli un voto."; return; }
      if (!FEEDBACK_URL) { out.textContent = "Grazie! In questa versione di prova i messaggi non vengono ancora inviati: l'invio si attiva con il sito online."; return; }
      try {
        await fetch(FEEDBACK_URL, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ voto, tipo: footer.querySelector("#fb-tipo").value, testo, pagina: location.pathname }) });
        out.textContent = "Grazie, messaggio inviato."; footer.querySelector("#fb-testo").value = "";
      } catch (err) { out.textContent = "Invio non riuscito. Riprova tra poco."; }
    });
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
