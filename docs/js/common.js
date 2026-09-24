// Utility condivise tra le pagine del sito.

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
export function impostaMetaPagina({ titolo, descrizione, jsonLd }) {
  if (titolo) document.title = titolo;
  if (descrizione) {
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
// Il sito nasce e resta in italiano. Le altre lingue passano dal proxy di
// Google Traduttore (<host>.translate.goog), che traduce la pagina al volo
// senza bisogno di mantenere testi tradotti a mano: funziona con qualsiasi
// dominio, anche dopo il passaggio a fightitalia.it.
const LINGUE = [
  ["it", "Italiano"], ["en", "English"], ["es", "Español"], ["fr", "Français"],
  ["de", "Deutsch"], ["pt", "Português"], ["pl", "Polski"], ["ro", "Română"],
  ["sq", "Shqip"], ["ar", "العربية"], ["ru", "Русский"], ["uk", "Українська"],
  ["tr", "Türkçe"], ["zh-CN", "中文"], ["ja", "日本語"],
];

const SU_TRADUTTORE = location.hostname.endsWith(".translate.goog");

function linguaAttuale() {
  if (!SU_TRADUTTORE) return "it";
  return new URLSearchParams(location.search).get("_x_tr_tl") || "it";
}

function hostOriginale() {
  // gr--build-github-io.translate.goog -> gr-build.github.io
  return location.hostname
    .replace(/\.translate\.goog$/, "")
    .replace(/--/g, "\u0000")
    .replace(/-/g, ".")
    .replace(/\u0000/g, "-");
}

function cambiaLingua(lingua) {
  const params = new URLSearchParams(location.search);
  ["_x_tr_sl", "_x_tr_tl", "_x_tr_hl", "_x_tr_pto"].forEach((k) => params.delete(k));
  const host = SU_TRADUTTORE ? hostOriginale() : location.hostname;
  if (lingua === "it") {
    const q = params.toString();
    location.href = `https://${host}${location.pathname}${q ? `?${q}` : ""}${location.hash}`;
    return;
  }
  const hostTradotto = host.replace(/-/g, "--").replace(/\./g, "-") + ".translate.goog";
  params.set("_x_tr_sl", "it");
  params.set("_x_tr_tl", lingua);
  params.set("_x_tr_hl", lingua);
  location.href = `https://${hostTradotto}${location.pathname}?${params.toString()}${location.hash}`;
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

export function renderChrome(active) {
  const header = document.getElementById("site-header");
  if (header) {
    header.innerHTML = `
      <div class="container nav">
        <a href="index.html" class="brand">MMA<span class="dot">•</span>Oggi</a>
        <ul class="nav-links">
          <li><a href="index.html" class="${active === "database" ? "active" : ""}">Lottatori</a></li>
          <li><a href="confronto.html" class="${active === "confronto" ? "active" : ""}">Confronto</a></li>
          <li><a href="eventi.html" class="${active === "eventi" ? "active" : ""}">Eventi</a></li>
          <li><a href="europa.html" class="${active === "europa" ? "active" : ""}">Europa</a></li>
          <li><a href="campioni.html" class="${active === "campioni" ? "active" : ""}">Campioni</a></li>
          <li><a href="news.html" class="${active === "news" ? "active" : ""}">News</a></li>
          <li><a href="giochi.html" class="nav-gauntlet ${active === "giochi" || active === "gauntlet" ? "active" : ""}">Giochi</a></li>
        </ul>
        ${selettoreLingua()}
      </div>`;
    const sel = header.querySelector("#lingua");
    if (sel) sel.addEventListener("change", () => cambiaLingua(sel.value));
  }
  const footer = document.getElementById("site-footer");
  if (footer) {
    footer.innerHTML = `
      <div class="container">
        <p style="margin:0 0 6px;">I dati riportati hanno scopo informativo e statistico; non costituiscono consiglio di scommessa. Gioca responsabilmente.</p>
        <p style="margin:0 0 6px;">MMA Oggi — statistiche e confronti sugli sport da combattimento. Dati e immagini da Wikipedia (licenza CC BY-SA), aggiornati periodicamente. In Italia gli eventi UFC si seguono in streaming legale su discovery+ (e in parte su Eurosport).</p>
        <p style="margin:0; font-size:11.5px; color:var(--text-muted);">MMA Oggi è un progetto indipendente, non affiliato né sponsorizzato da UFC o Zuffa, LLC.</p>
      </div>`;
  }
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

// Punti chiave statistici e fattuali del match, senza pronostico: ogni
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
      <div class="key-points-title">Punti chiave del match</div>
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
