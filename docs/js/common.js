// Utility condivise tra le pagine del sito.

// Evento personalizzato per Plausible (statistiche senza cookie): dice quale
// scheda e' stata aperta, cosi' si vede quali lottatori/eventi interessano
// davvero. Plausible toglie da solo la parte dopo il "?" dall'indirizzo, senza
// questo vedremmo un'unica pagina "lottatore.html" per tutti.
export function traccia(nome, props) {
  try {
    window.plausible = window.plausible || function () { (window.plausible.q = window.plausible.q || []).push(arguments); };
    // Plausible distingue maiuscole e minuscole nei nomi delle proprieta': le mando
    // in entrambe le forme ("lottatore" e "Lottatore"), quelle non registrate
    // nel cruscotto vengono semplicemente ignorate.
    const doppie = {};
    for (const [k, v] of Object.entries(props || {})) {
      doppie[k] = v;
      doppie[k.charAt(0).toUpperCase() + k.slice(1)] = v;
    }
    window.plausible(nome, { props: doppie });
  } catch (e) { /* le statistiche non devono mai rompere la pagina */ }
}

export async function fetchJSON(path) {
  // "no-cache": il browser ricontrolla sempre col server (se il file non e'
  // cambiato risponde 304, costa pochissimo). Senza, GitHub Pages lascia in
  // cache i dati per 10 minuti e dopo un aggiornamento si vedevano ancora le
  // news vuote o i dati vecchi.
  const res = await fetch(path, { cache: "no-cache" });
  if (!res.ok) throw new Error(`Errore caricando ${path}: ${res.status}`);
  return res.json();
}

const ICONS = {
  search: `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="7"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>`,
  ruler: `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 17h18v4H3zM7 17v-3M11 17v-3M15 17v-3M19 17v-3M3 17L17 3l4 4L7 21z"/></svg>`,
  age: `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="8" r="4"/><path d="M4 21v-1a8 8 0 0 1 16 0v1"/></svg>`,
  pin: `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 22s7-7.4 7-12a7 7 0 1 0-14 0c0 4.6 7 12 7 12z"/><circle cx="12" cy="10" r="2.5"/></svg>`,
  link: `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10 14a5 5 0 0 0 7 0l3-3a5 5 0 0 0-7-7l-1.5 1.5"/><path d="M14 10a5 5 0 0 0-7 0l-3 3a5 5 0 0 0 7 7l1.5-1.5"/></svg>`,
};

export function icon(name) {
  return ICONS[name] || "";
}

// I bot dei social (WhatsApp/Twitter/Facebook) non eseguono JS, quindi vedono
// solo i meta tag statici dell'HTML (title/description generici) — questa
// funzione serve invece Google, che le pagine JS le esegue davvero: aggiorna
// document.title + meta description con i dati veri del lottatore/evento, e
// inietta JSON-LD (schema.org) cosi' i risultati di ricerca possono mostrare
// record, data, sede ecc. invece del solo link.
export function impostaMetaPagina({ titolo, descrizione, jsonLd, canonical }) {
  // nelle pagine statiche titolo e descrizione sono gia' giusti nell'HTML: non li tocco
  const statica = Boolean(document.body.dataset.slug);
  if (titolo && !statica) document.title = titolo;
  if (canonical) {
    // ogni scheda ha il suo indirizzo "ufficiale": senza, Google le vede tutte come la stessa pagina
    const link = document.querySelector('link[rel="canonical"]');
    if (link) link.setAttribute("href", canonical);
    const og = document.querySelector('meta[property="og:url"]');
    if (og) og.setAttribute("content", canonical);
  }
  if (descrizione && !statica) {
    const meta = document.querySelector('meta[name="description"]');
    if (meta) meta.setAttribute("content", descrizione);
  }
  if (jsonLd) {
    let script = document.querySelector('script[type="application/ld+json"]');
    if (!script) {
      script = document.createElement("script");
      script.type = "application/ld+json";
      document.head.appendChild(script);
    }
    script.textContent = JSON.stringify(jsonLd);
  }
}

// ---------- Lingue ----------
// Il sito nasce e resta in italiano. Le altre lingue usano il traduttore di
// Google DENTRO la pagina (non piu' il proxy <host>.translate.goog, che
// metteva la barra di Google in cima, cambiava l'indirizzo e traduceva
// "MMA Oggi" in "MMA Today" e "Lottatori" in "Wrestlers"). La scelta vive nel
// cookie googtrans (/it/<lingua>) che il traduttore legge da solo.
// Sopra la traduzione automatica: il nome del sito non si traduce mai, e in
// inglese menu e categorie di peso usano i termini giusti dell'MMA (GLOSSARIO_EN).
const LINGUE = [
  ["it", "Italiano"], ["en", "English"], ["es", "Español"], ["fr", "Français"],
  ["de", "Deutsch"], ["pt", "Português"], ["pl", "Polski"], ["ro", "Română"],
  ["sq", "Shqip"], ["ar", "العربية"], ["ru", "Русский"], ["uk", "Українська"],
  ["tr", "Türkçe"], ["zh-CN", "中文"], ["ja", "日本語"],
];

function linguaAttuale() {
  const m = document.cookie.match(/(?:^|;\s*)googtrans=\/it\/([^;]+)/);
  return m && LINGUE.some(([c]) => c === m[1]) ? m[1] : "it";
}

function cambiaLingua(lingua) {
  const scadenza = lingua === "it" ? "; expires=Thu, 01 Jan 1970 00:00:00 GMT" : "; max-age=31536000";
  const valore = lingua === "it" ? "" : `/it/${lingua}`;
  // il traduttore scrive il cookie anche sul dominio "punto": si puliscono tutti e due
  for (const dominio of ["", `; domain=${location.hostname}`, `; domain=.${location.hostname}`]) {
    document.cookie = `googtrans=${valore}; path=/${dominio}${scadenza}`;
  }
  location.reload();
}

// Termini dell'MMA che Google traduce male: in inglese si sostituiscono PRIMA
// che il traduttore passi (un testo gia' in inglese lui lo lascia com'e').
const GLOSSARIO_EN = [
  [/\bPesi Mediomassimi\b/g, "Light Heavyweight"], [/\bPesi Massimi\b/g, "Heavyweight"],
  [/\bPesi Medi\b/g, "Middleweight"], [/\bPesi Welter\b/g, "Welterweight"],
  [/\bPesi Leggeri\b/g, "Lightweight"], [/\bPesi Piuma\b/g, "Featherweight"],
  [/\bPesi Gallo\b/g, "Bantamweight"], [/\bPesi Mosca\b/g, "Flyweight"], [/\bPesi Paglia\b/g, "Strawweight"],
  [/\bLottatori\b/g, "Fighters"], [/\blottatori\b/g, "fighters"], [/\bLottatore\b/g, "Fighter"], [/\blottatore\b/g, "fighter"],
  [/\blottatrici\b/g, "fighters"], [/\blottatrice\b/g, "fighter"],
];
const CATEGORIE_EN = { Massimi: "Heavyweight", Mediomassimi: "Light Heavyweight", Medi: "Middleweight", Welter: "Welterweight", Leggeri: "Lightweight", Piuma: "Featherweight", Gallo: "Bantamweight", Mosca: "Flyweight", Paglia: "Strawweight" };

function applicaGlossario(radice) {
  const giro = document.createTreeWalker(radice, NodeFilter.SHOW_TEXT);
  const nodi = [];
  while (giro.nextNode()) nodi.push(giro.currentNode);
  for (const n of nodi) {
    if (n.parentElement && n.parentElement.closest(".notranslate, script, style")) continue;
    const t = n.nodeValue;
    const nudo = t.trim();
    let nuovo = CATEGORIE_EN[nudo] ? t.replace(nudo, CATEGORIE_EN[nudo]) : t;
    for (const [re, en] of GLOSSARIO_EN) nuovo = nuovo.replace(re, en);
    if (nuovo !== t) n.nodeValue = nuovo;
  }
}

// Nomi di lottatori ed eventi: il traduttore li storpiava ("Ciryl" -> "Cyryl").
const SELETTORE_NOMI = ".name, .nickname, .champ-nome, .champ-nome-grande, .pom-nome, .gr-nome, .ac-nome, .chie-fine-nome, .tent-nome, .personaggio-nome, .bout-nome, .rank-nome, .live-nome";

function proteggiNomi(radice) {
  const elementi = radice.matches && radice.matches(SELETTORE_NOMI) ? [radice] : [];
  for (const e of [...elementi, ...radice.querySelectorAll(SELETTORE_NOMI)]) {
    e.classList.add("notranslate");
    e.setAttribute("translate", "no");
  }
}

function avviaTraduzione() {
  const lingua = linguaAttuale();
  if (lingua === "it") return;
  document.documentElement.classList.add("tradotto");
  const sistema = (n) => {
    proteggiNomi(n);
    if (lingua === "en") applicaGlossario(n);
  };
  sistema(document.body);
  new MutationObserver((cambi) => {
    for (const c of cambi) for (const n of c.addedNodes) {
      if (n.nodeType === 1 && !n.closest(".skiptranslate")) sistema(n);
    }
  }).observe(document.body, { childList: true, subtree: true });
  const box = document.createElement("div");
  box.id = "google_translate_element";
  box.hidden = true;
  document.body.appendChild(box);
  window.googleTranslateElementInit = () => {
    new window.google.translate.TranslateElement({ pageLanguage: "it", autoDisplay: false }, "google_translate_element");
  };
  const s = document.createElement("script");
  s.src = "https://translate.google.com/translate_a/element.js?cb=googleTranslateElementInit";
  document.body.appendChild(s);
}

// Tema chiaro/scuro: di base scuro (e' l'aspetto di MMA Oggi); la scelta resta sul telefono.
const ICONA_SOLE = '<svg class="ico-sole" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></svg>';
const ICONA_LUNA = '<svg class="ico-luna" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"/></svg>';

function temaCorrente() {
  return document.documentElement.dataset.theme === "light" ? "light" : "dark";
}

function applicaTema(tema) {
  document.documentElement.dataset.theme = tema;
  try { localStorage.setItem("tema", tema); } catch (e) {}
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute("content", tema === "light" ? "#f4f4f6" : "#0a0a0d");
}

function selettoreLingua() {
  const attuale = linguaAttuale();
  const opzioni = LINGUE.map(([codice, nome]) => `<option value="${codice}"${codice === attuale ? " selected" : ""}>${nome}</option>`).join("");
  return `
    <label class="lingua" title="Lingua / Language">
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18"/></svg>
      <span class="sr-only">Lingua</span>
      <select id="lingua" aria-label="Lingua / Language">${opzioni}</select>
    </label>`;
}

// Foto di un lottatore: il ritratto ufficiale ESPN (sfondo trasparente, stesso
// taglio per tutti) se c'e', altrimenti quella di Wikimedia. Le foto ESPN hanno
// dietro uno sfondo chiaro (classe foto-bianca), come su UFC.com.
export function fotoDi(r) {
  return (r && (r.foto_espn || r.foto)) || null;
}
export function classeFoto(url) {
  return url && url.includes("espncdn.com") ? " foto-bianca" : "";
}

// Email pubblica: resta nascosta finche' l'inoltro del dominio non funziona
// (EMAIL_ATTIVA = true quando redazione@mmaoggi.it arriva davvero).
export const EMAIL = "redazione@mmaoggi.it";
export const EMAIL_ATTIVA = false;
// Chiave pubblica di Web3Forms (web3forms.com): fa arrivare i messaggi del modulo
// alla casella scelta senza scrivere l'indirizzo nel sito. Vuota = modulo nascosto.
export const FORM_KEY = "ddf0c991-62a3-4f61-b5e1-3042eeef2d41";

// Profili social di MMA Oggi (pagina seguici.html, piede del sito, fine dei giochi).
export const SOCIAL = [
  { id: "instagram", nome: "Instagram", testo: "@mmaoggi", url: "https://www.instagram.com/mmaoggi/", desc: "Card, analisi e numeri degli incontri in grafica." },
  { id: "tiktok", nome: "TikTok", testo: "@mmaoggi", url: "https://www.tiktok.com/@mmaoggi", desc: "La Griglia del giorno, i risultati in 60 secondi, le notizie in video." },
];

export function linkSocial(classe = "social-link") {
  return SOCIAL.map((x) => `<a class="${classe} ${x.id}" href="${x.url}" target="_blank" rel="noopener"><span class="social-nome">${x.nome}</span><span class="social-testo">${x.testo}</span></a>`).join("");
}

// Nelle schede (lottatore, evento, incontro) una freccia fissa in alto per
// tornare indietro: nell'app installata non c'e' il tasto del browser.
function aggiungiIndietro(header) {
  const m = location.pathname.match(/^\/(lottatore|evento|incontro)(\.html|\/)/);
  if (!m) return;
  const genitore = m[1] === "lottatore" ? "lottatori.html" : "eventi.html";
  const riga = document.createElement("div");
  riga.className = "container indietro-riga";
  riga.innerHTML = `<button type="button" class="indietro" aria-label="Torna indietro"><span aria-hidden="true">←</span> Indietro</button>`;
  riga.querySelector("button").addEventListener("click", () => {
    // Si torna indietro solo se si arriva da un'altra pagina del sito;
    // altrimenti (link esterno, ingresso diretto) all'elenco.
    if (history.length > 1 && document.referrer.startsWith(location.origin)) history.back();
    else location.href = genitore;
  });
  header.appendChild(riga);
}

export function renderChrome(active) {
  const header = document.getElementById("site-header");
  if (header) {
    // "Lottatori" e' la pagina indice (Campioni + Ranking), separata dalla
    // home (il database/ricerca, che ora nel menu si chiama "Home") — su
    // richiesta di Giovanni. Il tentativo precedente con un sottomenu a
    // freccetta e' stato sostituito da questa pagina vera e propria.
    const suLottatori = active === "lottatori" || active === "campioni" || active === "ranking";
    header.innerHTML = `
      <div class="container nav">
        <a href="/" class="brand" aria-label="MMA Oggi, home"><img src="img/logo-128.png?v=2" alt="" class="brand-logo" width="56" height="56"><span class="brand-testo notranslate" translate="no">MMA<span class="dot">•</span>Oggi</span></a>
        <ul class="nav-links">
          <li><a href="/" class="${active === "database" ? "active" : ""}">Home</a></li>
          <li><a href="lottatori.html" class="${suLottatori ? "active" : ""}">Lottatori</a></li>
          <li><a href="confronto.html" class="${active === "confronto" ? "active" : ""}">Confronto</a></li>
          <li><a href="eventi.html" class="${active === "eventi" ? "active" : ""}">Eventi</a></li>
          <li><a href="europa.html" class="${active === "europa" ? "active" : ""}">Europa</a></li>
          <li><a href="news.html" class="${active === "news" ? "active" : ""}">News</a></li>
          <li><a href="giochi.html" class="nav-gauntlet ${active === "giochi" || active === "gauntlet" ? "active" : ""}">Giochi</a></li>
        </ul>
        <a href="eventi.html" id="live-badge" class="live-badge" hidden></a>
        <div class="nav-strumenti">
          <button type="button" class="tema-btn" id="tema-btn" aria-label="Cambia tema, chiaro o scuro">${ICONA_SOLE}${ICONA_LUNA}</button>
          ${selettoreLingua()}
        </div>
      </div>`;
    const sel = header.querySelector("#lingua");
    if (sel) sel.addEventListener("change", () => cambiaLingua(sel.value));
    applicaTema(temaCorrente());
    header.querySelector("#tema-btn").addEventListener("click", () => applicaTema(temaCorrente() === "dark" ? "light" : "dark"));
    aggiungiIndietro(header);
  }
  if (!window.__liveAvviato) {
    window.__liveAvviato = true;
    aggiornaLive();
    setInterval(aggiornaLive, 45000);
  }
  if (!window.__traduzioneAvviata) {
    window.__traduzioneAvviata = true;
    avviaTraduzione();
  }
  const footer = document.getElementById("site-footer");
  if (footer) {
    footer.innerHTML = `
      <div class="container">
        <div class="footer-feedback">
          <div class="footer-feedback-riga">
            <button type="button" class="ff-apri" aria-expanded="false">Aiutaci a migliorare <span>+</span></button>
            <span class="ff-stelle" role="group" aria-label="Dai un voto da 1 a 5 stelle">${[1, 2, 3, 4, 5].map((s) => `<button type="button" class="ff-stella" data-stelle="${s}" aria-label="${s} ${s === 1 ? "stella" : "stelle"}">★</button>`).join("")}</span>
          </div>
          <p class="ff-invito" hidden></p>
          <div class="footer-feedback-corpo" hidden></div>
        </div>
        <div class="footer-social"><span>Segui MMA Oggi</span>${linkSocial()}<a class="social-link" href="seguici.html"><span class="social-nome">Contatti</span></a></div>
        <p style="margin:0 0 6px;">I dati riportati hanno scopo informativo e statistico; non costituiscono consiglio di scommessa. Gioca responsabilmente.</p>
        <p style="margin:0 0 6px;">MMA Oggi — statistiche e confronti sugli sport da combattimento. Dati e immagini da Wikipedia (licenza CC BY-SA), aggiornati periodicamente. In Italia gli eventi UFC si seguono in streaming legale su discovery+ (e in parte su Eurosport).</p>
        <p style="margin:0; font-size:11.5px; color:var(--text-muted);">MMA Oggi è un progetto indipendente, non affiliato né sponsorizzato da UFC o Zuffa, LLC.</p>
      </div>`;
    const ff = footer.querySelector(".footer-feedback");
    const corpo = ff.querySelector(".footer-feedback-corpo");
    const apri = ff.querySelector(".ff-apri");
    const invito = ff.querySelector(".ff-invito");
    let stelle = 0;
    try { stelle = Number(localStorage.getItem("voto-sito")) || 0; } catch (e) { /* senza memoria locale va bene lo stesso */ }
    const coloraStelle = () => ff.querySelectorAll(".ff-stella").forEach((b) => b.classList.toggle("piena", Number(b.dataset.stelle) <= stelle));
    const mostra = (aperto) => {
      corpo.hidden = !aperto;
      apri.setAttribute("aria-expanded", String(aperto));
      apri.querySelector("span").textContent = aperto ? "−" : "+";
      if (aperto) montaFeedback(corpo, () => stelle);
    };
    apri.addEventListener("click", () => mostra(corpo.hidden));
    ff.querySelector(".ff-stelle").addEventListener("click", (e) => {
      const b = e.target.closest(".ff-stella");
      if (!b) return;
      stelle = Number(b.dataset.stelle);
      try { localStorage.setItem("voto-sito", String(stelle)); } catch (err) { /* ignora */ }
      traccia("Valutazione", { stelle: String(stelle) });
      coloraStelle();
      invito.hidden = false;
      invito.textContent = `Grazie per le ${stelle} ${stelle === 1 ? "stella" : "stelle"}! Vuoi dirci cosa migliorare? Manda un feedback.`;
      mostra(true);
    });
    coloraStelle();
  }
}

// Eventi anonimi dei giochi (solo numeri, nessun dato personale): quando parte una
// partita e quando finisce, con l'esito. Servono a contare quanti giocano davvero.
export function tracciaGioco(gioco, fase, extra = {}) {
  traccia(fase === "inizio" ? "Gioco iniziato" : "Gioco finito", { gioco, ...extra });
}

// Modulo "Aiutaci a migliorare": lo stesso in fondo a ogni pagina e nella pagina
// Giochi. Il messaggio parte via Web3Forms verso la casella della redazione;
// senza FORM_KEY (o senza rete) resta l'invito ai DM.
let contaModuli = 0;
export function montaFeedback(box, stelleDi = () => 0) {
  if (!box || box.dataset.pronto) return;
  box.dataset.pronto = "1";
  const n = ++contaModuli;
  const social = (id) => (SOCIAL.find((x) => x.id === id) || {}).url || "#";
  const dm = `<p class="feedback-scrivici">Puoi anche scriverci in DM su <a href="${social("instagram")}" target="_blank" rel="noopener">Instagram</a> o <a href="${social("tiktok")}" target="_blank" rel="noopener">TikTok</a>.</p>`;
  if (!FORM_KEY) {
    box.innerHTML = `<p class="feedback-scrivici">Hai un'idea, un errore o qualcosa che non ti piace? Scrivici in DM su <a href="${social("instagram")}" target="_blank" rel="noopener">Instagram</a> o <a href="${social("tiktok")}" target="_blank" rel="noopener">TikTok</a>.</p>`;
    return;
  }
  box.innerHTML = `
    <form class="feedback-form">
      <label for="fb-tipo-${n}">Di cosa vuoi parlarci?</label>
      <select id="fb-tipo-${n}" name="tipo">
        <option>Un'idea o un gioco che vorrei</option>
        <option>Un errore da segnalare</option>
        <option>Qualcosa che non mi piace</option>
        <option>Altro</option>
      </select>
      <label for="fb-msg-${n}">Il tuo messaggio</label>
      <textarea id="fb-msg-${n}" name="messaggio" rows="4" maxlength="1500" required placeholder="Scrivi qui, anche in due righe."></textarea>
      <label for="fb-mail-${n}">La tua email <span>(solo se vuoi una risposta)</span></label>
      <input id="fb-mail-${n}" name="email" type="email" autocomplete="email" placeholder="nome@esempio.it">
      <input type="text" name="botcheck" tabindex="-1" autocomplete="off" aria-hidden="true" style="position:absolute;left:-9999px;">
      <button type="submit" class="btn-gioco">Invia</button>
      <p class="feedback-esito" role="status"></p>
      <p class="feedback-privacy">Il messaggio arriva alla redazione via email (servizio Web3Forms). Non usiamo cookie e non conserviamo altro.</p>
    </form>${dm}`;
  const form = box.querySelector("form");
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const esito = form.querySelector(".feedback-esito");
    const bottone = form.querySelector("button");
    if (form.elements.botcheck.value) return; // e' un bot
    const messaggio = form.elements.messaggio.value.trim();
    if (!messaggio) return;
    bottone.disabled = true;
    esito.textContent = "Invio in corso...";
    try {
      const mail = form.elements.email.value.trim();
      const risposta = await fetch("https://api.web3forms.com/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({
          access_key: FORM_KEY,
          subject: `MMA Oggi · ${form.elements.tipo.value}`,
          from_name: "Modulo mmaoggi.it",
          message: `${messaggio}${stelleDi() ? `\n\nVoto: ${stelleDi()}/5` : ""}\n\nPagina: ${location.href}`,
          ...(mail ? { email: mail } : {}),
          botcheck: "",
        }),
      });
      const esitoJson = await risposta.json().catch(() => ({}));
      if (!risposta.ok || esitoJson.success === false) throw new Error(String(risposta.status));
      esito.textContent = "Grazie! Il messaggio è arrivato.";
      traccia("Feedback inviato", { tipo: form.elements.tipo.value });
      form.reset();
    } catch (err) {
      esito.textContent = "Non sono riuscito a inviarlo. Riprova tra poco, oppure scrivici in DM.";
    }
    bottone.disabled = false;
  });
}

const ESPN_SCOREBOARD = "https://site.api.espn.com/apis/site/v2/sports/mma/ufc/scoreboard";
const FINESTRA_RISULTATO_RECENTE_MIN = 90; // come in live.py

// Stesso calcolo di live.py, fatto nel browser: il workflow di GitHub che
// scrive live.json parte con ore di ritardo, ESPN invece e' sempre aggiornato.
async function statoLiveDaEspn() {
  const adesso = new Date();
  for (const indietro of [0, 1]) {
    const g = new Date(adesso.getTime() - indietro * 86400000);
    const data = `${g.getUTCFullYear()}${String(g.getUTCMonth() + 1).padStart(2, "0")}${String(g.getUTCDate()).padStart(2, "0")}`;
    const r = await fetch(`${ESPN_SCOREBOARD}?dates=${data}`, { signal: AbortSignal.timeout(6000) });
    if (!r.ok) throw new Error("ESPN " + r.status);
    const ev = ((await r.json()).events || [])[0];
    if (!ev) continue;
    const incontri = [];
    for (const c of ev.competitions || []) {
      const atleti = [...(c.competitors || [])].sort((a, b) => (a.order ?? 9) - (b.order ?? 9));
      const inizio = Date.parse(c.date);
      if (atleti.length !== 2 || Number.isNaN(inizio)) continue;
      incontri.push({
        inizio,
        stato: c.status?.type?.state,
        nomi: atleti.map((a) => a.athlete.displayName),
        round: c.status?.period,
        clock: c.status?.displayClock,
        vincitore: atleti.find((a) => a.winner)?.athlete.displayName || null,
      });
    }
    if (!incontri.length) continue;
    const corrente = incontri.find((x) => x.stato === "in");
    const conclusi = incontri.filter((x) => x.stato === "post" && x.vincitore);
    const ultimo = conclusi.length ? conclusi.reduce((a, b) => (b.inizio > a.inizio ? b : a)) : null;
    const recente = ultimo && adesso.getTime() - ultimo.inizio < FINESTRA_RISULTATO_RECENTE_MIN * 60000;
    if (!corrente && !recente) continue;
    return {
      evento: ev.name,
      stato: corrente ? "in_corso" : "risultato_recente",
      incontro_corrente: corrente ? { nomi: corrente.nomi, round: corrente.round, clock: corrente.clock } : null,
      ultimo_risultato: ultimo ? { nomi: ultimo.nomi, vincitore: ultimo.vincitore } : null,
    };
  }
  return { stato: "nessuno" };
}

async function aggiornaLive() {
  const el = document.getElementById("live-badge");
  if (!el) return;
  let d;
  try {
    d = await statoLiveDaEspn();
  } catch {
    try {
      d = await fetchJSON("data/live.json");
    } catch {
      return; // non tocca il badge: meglio tenere l'ultimo stato buono che nasconderlo per un errore di rete
    }
  }
  if (!d || d.stato === "nessuno") {
    el.hidden = true;
    return;
  }
  let corpo;
  if (d.stato === "in_corso" && d.incontro_corrente) {
    const c = d.incontro_corrente;
    const rt = c.round ? `R${c.round}${c.clock ? " · " + c.clock : ""}` : "";
    corpo = `<span class="live-nome">${c.nomi[0]}</span> vs <span class="live-nome">${c.nomi[1]}</span>${rt ? ` <span class="live-round">${rt}</span>` : ""}`;
  } else if (d.ultimo_risultato) {
    const u = d.ultimo_risultato;
    const altro = u.nomi.find((n) => n !== u.vincitore) || u.nomi[0];
    corpo = `<span class="live-nome">${u.vincitore}</span> batte <span class="live-nome">${altro}</span>`;
  } else {
    el.hidden = true;
    return;
  }
  el.hidden = false;
  el.title = d.evento || "";
  el.innerHTML = `<span class="live-dot" aria-hidden="true"></span><span class="live-stato">${d.stato === "in_corso" ? "In diretta" : "Appena finito"}</span><span class="live-testo">${corpo}</span>`;
}

export function cmDaStringa(testo) {
  if (typeof testo !== "string") return null;
  // Es. "191 cm (6 ft 3 in)" o, per alcuni lottatori, "1.88 m (6 ft 2 in)"
  // — il valore metrico sta prima dell'unita', fuori dalle parentesi.
  const m = testo.trim().match(/^([\d.]+)\s*(cm|m)\b/);
  if (!m) return null;
  const valore = parseFloat(m[1]);
  return Math.round((m[2] === "m" ? valore * 100 : valore) * 10) / 10;
}

export function numeroDaRecord(record) {
  if (typeof record !== "string") return [null, null];
  const m = record.trim().match(/^(\d+)[–-](\d+)/);
  return m ? [parseInt(m[1], 10), parseInt(m[2], 10)] : [null, null];
}

export function classeRisultato(risultato) {
  const r = (risultato || "").trim().toLowerCase();
  if (r === "win") return "win";
  if (r === "loss") return "loss";
  if (r === "draw") return "draw";
  return "draw";
}

export function letteraRisultato(risultato) {
  const r = (risultato || "").trim().toLowerCase();
  if (r === "win") return "V";
  if (r === "loss") return "S";
  if (r === "draw") return "P";
  return "?";
}

export function debounce(fn, wait = 200) {
  let t;
  return (...args) => {
    clearTimeout(t);
    t = setTimeout(() => fn(...args), wait);
  };
}

// Unica fonte di verita' per "cosa conta come KO/TKO o sottomissione":
// usata sia qui (statistiche di carriera) sia da ritmoFinalizzazione
// (ultime 5 uscite), cosi' le due non possono disallinearsi in futuro.
const PREFISSI_KO = ["ko", "tko"];
const PREFISSI_SUB = ["submission"];

function metodoIniziaCon(method, prefissi) {
  const m = (method || "").toLowerCase();
  return prefissi.some((p) => m.startsWith(p));
}

export function metodoVittorie(storico) {
  const vittorie = (storico || []).filter((f) => classeRisultato(f["res."]) === "win");
  const conta = (prefissi) => vittorie.filter((f) => metodoIniziaCon(f.method, prefissi)).length;
  const ko = conta(PREFISSI_KO);
  const sub = conta(PREFISSI_SUB);
  const dec = conta(["decision"]);
  return { ko, sub, dec, altro: vittorie.length - ko - sub - dec, totale: vittorie.length };
}

export function streakAttuale(storico) {
  if (!storico || !storico.length) return null;
  const tipo = classeRisultato(storico[0]["res."]);
  if (tipo !== "win" && tipo !== "loss") return null;
  let n = 0;
  for (const f of storico) {
    if (classeRisultato(f["res."]) !== tipo) break;
    n++;
  }
  return n > 1 ? { tipo, n } : null;
}

export function badgeStreak(storico) {
  const streak = streakAttuale(storico);
  if (!streak) return "";
  const colore = streak.tipo === "win" ? "var(--win)" : "var(--loss)";
  const testo = streak.tipo === "win" ? "vittorie di fila" : "sconfitte di fila";
  return `<div class="streak-badge" style="color:${colore};">${streak.n} ${testo}</div>`;
}

// I pallini prendono :focus al tocco (niente :hover su telefono) e la
// tooltip resta bloccata aperta perche' i browser mobile non tolgono il
// focus da un div toccando altrove: un solo listener per pagina lo fa a
// mano, cosi' un tocco fuori dal pallino la chiude subito.
//
// La tooltip e' centrata sul pallino (left:50%; transform:translateX(-50%)):
// per il primo o l'ultimo pallino di una riga vicino al bordo dello schermo
// finisce tagliata fuori dalla viewport. Al focus/hover la riposizioniamo
// dentro i margini invece di lasciarla sempre centrata.
function _riposizionaTooltipPallino(e) {
  const dot = e.target.closest?.(".dot-result");
  const tip = dot?.querySelector(".dot-tooltip");
  if (!tip) return;
  tip.style.left = "";
  tip.style.transform = "";
  const margine = 10;
  const r = tip.getBoundingClientRect();
  if (r.left < margine) {
    tip.style.left = `${margine - dot.getBoundingClientRect().left}px`;
    tip.style.transform = "none";
  } else if (r.right > window.innerWidth - margine) {
    tip.style.left = `calc(50% - ${(r.right - (window.innerWidth - margine)).toFixed(0)}px)`;
  }
}

if (!window.__dotTooltipChiudi) {
  window.__dotTooltipChiudi = true;
  document.addEventListener("touchstart", (e) => {
    const attivo = document.activeElement;
    if (attivo?.classList?.contains("dot-result") && !attivo.contains(e.target)) attivo.blur();
  });
  document.addEventListener("focusin", _riposizionaTooltipPallino);
  document.addEventListener("mouseover", _riposizionaTooltipPallino);
}

export function formDots(storico, n = 5) {
  if (!storico || !storico.length) return "";
  const ultimi = storico.slice(0, n);
  return `<div class="form-dots">${ultimi
    .map(
      (f) => `
      <div class="dot-result ${classeRisultato(f["res."])}" tabindex="0">
        ${letteraRisultato(f["res."])}
        <span class="dot-tooltip">${f["res."] || ""} vs ${f.opponent || "?"}<br>${f.method || ""}<br>${f.date || ""}</span>
      </div>`
    )
    .join("")}</div>`;
}

export function slugDaLink(link) {
  if (!link) return null;
  return link
    .replace(/\/$/, "")
    .split("/")
    .pop()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function pctDaStringa(testo) {
  if (typeof testo !== "string") return null;
  const m = testo.trim().match(/^([\d.]+)\s*%/);
  return m ? parseFloat(m[1]) : null;
}

function formattaNumero(n) {
  const arrotondato = Math.round(n * 10) / 10;
  return Number.isInteger(arrotondato) ? String(arrotondato) : arrotondato.toFixed(1);
}

// Percentuale di vittorie per KO/TKO o sottomissione sulle ultime 5 uscite
// (non sull'intera carriera): indica se un lottatore sta chiudendo gli
// incontri di recente. null se non ha vittorie negli ultimi 5 (dato non
// significativo, va omesso).
function ritmoFinalizzazione(storico) {
  const ultimi5 = (storico || []).slice(0, 5);
  const vittorie = ultimi5.filter((f) => classeRisultato(f["res."]) === "win");
  if (!vittorie.length) return null;
  const finish = vittorie.filter((f) => metodoIniziaCon(f.method, [...PREFISSI_KO, ...PREFISSI_SUB])).length;
  return Math.round((finish / vittorie.length) * 100);
}

// Punti chiave statistici e fattuali del fight, senza pronostico: ogni
// fatto compare solo se i dati necessari sono disponibili per entrambi i
// lottatori, altrimenti viene omesso invece di mostrare un buco/N-D.
// fA/fB: { nome, inf (infobox), storico }
export function puntiChiaveMatch(fA, fB) {
  const infA = fA.inf || {}, infB = fB.inf || {};
  const punti = [];

  const diffFavore = (etichetta, vA, vB, unita) => {
    if (vA == null || vB == null || vA === vB) return;
    const chi = vA > vB ? fA.nome : fB.nome;
    punti.push(`${etichetta}: +${formattaNumero(Math.abs(vA - vB))}${unita} a favore di ${chi}`);
  };

  diffFavore("Reach", cmDaStringa(infA.Reach), cmDaStringa(infB.Reach), "cm");
  diffFavore("Altezza", cmDaStringa(infA.Height), cmDaStringa(infB.Height), "cm");

  diffFavore("Striking accuracy", pctDaStringa(infA["Striking accuracy"]), pctDaStringa(infB["Striking accuracy"]), "%");
  diffFavore("Striking defense", pctDaStringa(infA["Striking defense"]), pctDaStringa(infB["Striking defense"]), "%");

  const tdAccA = pctDaStringa(infA["Takedown accuracy"]), tdAccB = pctDaStringa(infB["Takedown accuracy"]);
  const tdDefA = pctDaStringa(infA["Takedown defense"]), tdDefB = pctDaStringa(infB["Takedown defense"]);
  diffFavore("Takedown accuracy", tdAccA, tdAccB, "%");
  diffFavore("Takedown defense", tdDefA, tdDefB, "%");
  // Uno stile da grappler forte (takedown accuracy alta) che incontra una
  // takedown defense piu' bassa dell'altro, in entrambe le direzioni.
  if (tdAccA != null && tdDefB != null && tdAccA > tdDefB) {
    punti.push(`Takedown accuracy di ${fA.nome} (${formattaNumero(tdAccA)}%) supera la takedown defense di ${fB.nome} (${formattaNumero(tdDefB)}%)`);
  }
  if (tdAccB != null && tdDefA != null && tdAccB > tdDefA) {
    punti.push(`Takedown accuracy di ${fB.nome} (${formattaNumero(tdAccB)}%) supera la takedown defense di ${fA.nome} (${formattaNumero(tdDefA)}%)`);
  }

  const stanceA = (infA.Stance || "").trim(), stanceB = (infB.Stance || "").trim();
  if (stanceA && stanceB && stanceA.toLowerCase() !== stanceB.toLowerCase()) {
    punti.push(`Mismatch di stance: ${stanceA} vs ${stanceB} — combinazione statisticamente rilevante nell'MMA`);
  }

  const finA = ritmoFinalizzazione(fA.storico), finB = ritmoFinalizzazione(fB.storico);
  if (finA != null && finB != null && finA !== finB) {
    const chi = finA > finB ? fA.nome : fB.nome;
    punti.push(`Ritmo di finalizzazione più alto nelle ultime 5: ${chi} (${Math.max(finA, finB)}% delle vittorie per KO/TKO o sottomissione)`);
  }

  return punti;
}

export function blocPuntiChiave(punti) {
  if (!punti || !punti.length) return "";
  return `
    <div class="key-points">
      <div class="key-points-title">Punti chiave del fight</div>
      <ul>${punti.map((p) => `<li>${p}</li>`).join("")}</ul>
    </div>`;
}

// ---------- News sui campioni ----------
// Le news (data/news.json) non sono collegate ai lottatori: si cercano i
// cognomi nel titolo e nel riassunto. Solo per i campioni, come richiesto:
// per tutti gli altri i falsi positivi (cognomi comuni) sarebbero troppi.
const normalizzaTesto = (t) => (t || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();

export function newsSu(lottatore, articoli) {
  const parti = normalizzaTesto(lottatore.nome).split(/\s+/).filter(Boolean);
  const cognome = parti[parti.length - 1];
  const nomeCompleto = parti.join(" ");
  return articoli.filter((a) => {
    const testo = normalizzaTesto(`${a.titolo} ${a.riassunto}`);
    return testo.includes(nomeCompleto) || (cognome.length >= 4 && new RegExp(`\\b${cognome}\\b`).test(testo));
  });
}

export function cardNewsBreve(a, etichetta = "") {
  const d = a.pubblicato ? new Date(a.pubblicato) : null;
  const quando = d && !isNaN(d) ? d.toLocaleDateString("it-IT", { day: "numeric", month: "short" }) : "";
  return `
    <a class="news-breve" href="${a.url}" target="_blank" rel="noopener noreferrer">
      <span class="news-breve-meta">${etichetta ? `<b>${etichetta}</b> · ` : ""}${a.fonte}${quando ? ` · ${quando}` : ""}${a.lingua === "en" ? ` · <span class="news-lingua">EN</span>` : ""}</span>
      <span class="news-breve-titolo">${a.titolo}</span>
    </a>`;
}
