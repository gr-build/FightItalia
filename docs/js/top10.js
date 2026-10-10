// "Top 10": una classifica UFC, dieci posti, tre cuori. Si scrive un lottatore:
// se e' in classifica prende il suo posto, altrimenti si perde un cuore.
// Una sola classifica al giorno, uguale per tutti: la sceglie e la verifica
// build_top10.py (classifica ufficiale UFC oppure numeri controllati su due
// fonti) e la fissa in data/top10.json.

import { renderChrome, tracciaGioco, fetchJSON } from "./common.js?v=202610102159";
import { caricaLottatori, leggi, scrivi, iniziali, condividi, oggiItalia, casualeConSeme, SITO } from "./giochi-comuni.js?v=202610102159";

renderChrome("giochi");

const VITE = 3;
const EPOCA = Date.UTC(2026, 9, 7); // classifica n. 1 = 7/10/2026

const box = document.getElementById("top10");
let lottatori = [];
let daSlug = new Map();
let puzzle = null;
let stato = null;
let iniziata = false;
let modo = "indovina"; // "indovina" | "ordine"
let ord = null; // stato di "Metti in ordine"
let scelto = null; // riga selezionata per lo scambio
const TENTATIVI = 5;

const pulito = (n) => String(n || "").replace(/\s*\*\s*$/, "").trim();
const norma = (t) => String(t || "").normalize("NFKD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9 ]/g, " ").replace(/\s+/g, " ").trim();

function numeroDelGiorno() {
  const [a, m, g] = oggiItalia().split("-").map(Number);
  return Math.round((Date.UTC(a, m - 1, g) - EPOCA) / 86400000) + 1;
}

const chiave = () => `top10-${oggiItalia()}`;
const nuovoStato = () => ({ trovati: [], provati: [], vite: VITE, fine: null });
const salva = () => scrivi(chiave(), stato);

function foto(x) {
  const vuoto = `<span class="t10-foto t10-vuota">${iniziali(pulito(x.n))}</span>`;
  return x.f ? `<img class="t10-foto" src="${x.f}" alt="" onerror="this.outerHTML=this.dataset.vuoto" data-vuoto='${vuoto}'>` : vuoto;
}

function nota() {
  if (puzzle.c) return `Classifica ufficiale UFC, i primi 10 sfidanti. Il campione, ${puzzle.c}, è già dato.`;
  if (!puzzle.u) return "Classifica ufficiale UFC.";
  return "Tra i lottatori del roster UFC del gioco (numeri controllati su due fonti). Pari merito: valgono tutti.";
}

function schede() {
  const tab = (id, testo) => `<button type="button" class="t10-tab${modo === id ? " attivo" : ""}" data-modo="${id}" aria-pressed="${modo === id}">${testo}</button>`;
  return `<div class="t10-tabs" role="group" aria-label="Modalità">${tab("indovina", "Indovina")}${tab("ordine", "Metti in ordine")}</div>`;
}

function collegaSchede() {
  box.querySelectorAll("[data-modo]").forEach((b) => b.addEventListener("click", () => {
    if (modo === b.dataset.modo) return;
    modo = b.dataset.modo;
    scelto = null;
    mostra();
  }));
}

function mostra() {
  if (modo === "ordine") return mostraOrdine();
  mostraIndovina();
}

function mostraIndovina() {
  const finita = !!stato.fine;
  const cuori = Array.from({ length: VITE }, (_, i) => (i < stato.vite ? "❤️" : "🖤")).join("");
  const trovati = new Set(stato.trovati);
  const slot = puzzle.v.map(([slug, val, posto]) => {
    const x = daSlug.get(slug) || { n: slug, c: "" };
    const aperto = trovati.has(slug) || finita;
    const mancato = finita && !trovati.has(slug);
    return `<li class="t10-riga ${trovati.has(slug) ? "trovato" : ""} ${mancato ? "mancato" : ""}">
      <span class="t10-posto">${posto}</span>
      ${aperto ? `${foto(x)}<span class="t10-nome">${pulito(x.n)}</span>${val != null ? `<span class="t10-val">${val} <small>${puzzle.u}</small></span>` : ""}` : `<span class="t10-segreto">?</span>`}
    </li>`;
  }).join("");
  box.innerHTML = `
    ${schede()}
    <div class="t10-testa">
      <span class="t10-modo">Classifica n. ${numeroDelGiorno()}</span>
      <span class="t10-cuori" aria-label="${stato.vite} cuori">${cuori}</span>
    </div>
    <h2 class="t10-titolo">${puzzle.t}</h2>
    <p class="t10-nota">${nota()}</p>
    <ol class="t10-lista">${slot}</ol>
    ${finita ? "" : `
    <div class="t10-ricerca">
      <input id="t10-in" type="text" autocomplete="off" placeholder="Cerca un lottatore..." aria-label="Cerca un lottatore">
      <div id="t10-sug" class="t10-sug" role="listbox"></div>
    </div>
    <div class="t10-azioni"><button type="button" class="btn-gioco secondario" id="t10-resa">Mi arrendo</button></div>`}
    <div id="t10-msg" role="status"></div>
    <div id="t10-fine"></div>`;
  collegaSchede();
  if (finita) mostraFine();
  else collegaRicerca();
}

function collegaRicerca() {
  const input = document.getElementById("t10-in");
  const sug = document.getElementById("t10-sug");
  document.getElementById("t10-resa").addEventListener("click", () => chiudi());
  const usati = new Set(stato.provati);
  const aggiorna = () => {
    const q = norma(input.value);
    if (q.length < 2) { sug.innerHTML = ""; return; }
    const trovate = lottatori
      .filter((x) => !usati.has(x.s) && (norma(pulito(x.n)).split(" ").some((p) => p.startsWith(q)) || (q.length > 2 && norma(pulito(x.n)).includes(q))))
      .slice(0, 6);
    sug.innerHTML = trovate.map((x) => `<button type="button" class="t10-sug-voce" data-s="${x.s}">${foto(x)}<span>${pulito(x.n)}</span><small>${x.c}</small></button>`).join("")
      || `<div class="t10-sug-vuoto">Nessun lottatore con questo nome nel roster del gioco</div>`;
    sug.querySelectorAll("[data-s]").forEach((b) => b.addEventListener("click", () => prova(b.dataset.s)));
  };
  input.addEventListener("input", aggiorna);
  input.addEventListener("keydown", (e) => {
    if (e.key === "Enter") { const primo = sug.querySelector("[data-s]"); if (primo) prova(primo.dataset.s); }
  });
}

function prova(slug) {
  if (stato.fine) return;
  const x = daSlug.get(slug);
  if (puzzle.c && norma(pulito(x.n)) === norma(puzzle.c)) {
    // il campione e' gia' dato: nessun cuore perso
    const m = document.getElementById("t10-msg");
    if (m) m.innerHTML = `<span class="t10-no">${pulito(x.n)} è il campione, già dato: cerca i suoi sfidanti.</span>`;
    return;
  }
  if (!iniziata) { iniziata = true; tracciaGioco("Top 10", "inizio"); }
  stato.provati.push(slug);
  const giusto = puzzle.v.some(([s]) => s === slug);
  let msg;
  if (giusto) {
    stato.trovati.push(slug);
    msg = `<span class="t10-ok">${pulito(x.n)} è in classifica!</span>`;
  } else {
    stato.vite--;
    msg = `<span class="t10-no">${pulito(x.n)} non è in questa classifica.</span>`;
  }
  if (stato.trovati.length === puzzle.v.length) stato.fine = "vinto";
  else if (stato.vite <= 0) stato.fine = "perso";
  salva();
  mostra();
  const m = document.getElementById("t10-msg");
  if (m) m.innerHTML = msg;
  if (stato.fine) tracciaGioco("Top 10", "fine", { esito: stato.fine, trovati: String(stato.trovati.length) });
}

function chiudi() {
  stato.fine = "perso";
  salva();
  mostra();
  tracciaGioco("Top 10", "fine", { esito: "resa", trovati: String(stato.trovati.length) });
}

function mostraFine() {
  const n = stato.trovati.length;
  const vinto = stato.fine === "vinto";
  const emoji = Array.from({ length: VITE }, (_, i) => (i < stato.vite ? "❤️" : "🖤")).join("");
  const testo = `MMA Oggi · Top 10 n. ${numeroDelGiorno()}\n${puzzle.t}\n${vinto ? "✅ Tutti e 10!" : `${n}/${puzzle.v.length} trovati`} ${emoji}\nMi batti? ${SITO}top10.html`;
  document.getElementById("t10-fine").innerHTML = `
    <div class="chie-fine ${vinto ? "vinto" : "perso"}">
      <div class="chie-fine-nome">${vinto ? "Classifica completa!" : `${n} su ${puzzle.v.length}`}</div>
      <p class="chie-fine-sub">${vinto ? "Ti conosci davvero l'UFC." : "Qui sopra trovi la classifica completa."} Una nuova classifica domani, a mezzanotte.</p>
      <div class="finale-azioni">
        <button type="button" class="btn-gioco" id="t10-cond">Condividi</button>
      </div>
    </div>`;
  document.getElementById("t10-cond").addEventListener("click", (e) => condividi(testo, e.currentTarget));
}

// ---------------------------------------------------------------- Metti in ordine
// Gli stessi dieci (o pochi di piu', se ci sono pari merito) della classifica
// del giorno, mescolati: si toccano due righe per scambiarle e "Controlla"
// blocca quelle al posto giusto. Cinque controlli. I pari merito sono
// intercambiabili: conta il posto, non l'ordine tra due uguali.

const chiaveOrd = () => `top10-ordine-${oggiItalia()}`;
const salvaOrd = () => scrivi(chiaveOrd(), ord);

function mescolato() {
  const [a, m, g] = oggiItalia().split("-").map(Number);
  const rnd = casualeConSeme(a * 10000 + m * 100 + g + 4242);
  const slug = puzzle.v.map(([s]) => s);
  for (let prova = 0; prova < 50; prova++) {
    for (let i = slug.length - 1; i > 0; i--) {
      const j = Math.floor(rnd() * (i + 1));
      [slug[i], slug[j]] = [slug[j], slug[i]];
    }
    const postoDi = new Map(puzzle.v.map(([s, , p]) => [s, p]));
    const attesi = puzzle.v.map(([, , p]) => p);
    if (slug.filter((s, i) => postoDi.get(s) === attesi[i]).length === 0) break; // nessuno gia' al suo posto
  }
  return slug;
}

function mostraOrdine() {
  const postoDi = new Map(puzzle.v.map(([s, , p]) => [s, p]));
  const attesi = puzzle.v.map(([, , p]) => p);
  const finita = !!ord.fine;
  const bloccati = new Set(ord.bloccati);
  const righe = ord.ordine.map((slug, i) => {
    const x = daSlug.get(slug) || { n: slug };
    const v = puzzle.v.find(([s]) => s === slug);
    const giusto = bloccati.has(slug) || (finita && postoDi.get(slug) === attesi[i]);
    const sel = scelto === i;
    const val = finita && v[1] != null ? `<span class="t10-val">${v[1]} <small>${puzzle.u}</small></span>` : "";
    return `<li class="t10-riga ordina ${giusto ? "trovato" : ""} ${sel ? "selezionata" : ""} ${finita && !giusto ? "mancato" : ""}" data-i="${i}">
      <span class="t10-posto">${attesi[i]}</span>${foto(x)}<span class="t10-nome">${pulito(x.n)}</span>${val}
    </li>`;
  }).join("");
  const griglia = ord.tentativi.map((t) => t.map((ok) => (ok ? "🟩" : "🟥")).join("")).join("<br>");
  box.innerHTML = `
    ${schede()}
    <div class="t10-testa">
      <span class="t10-modo">Classifica n. ${numeroDelGiorno()}</span>
      <span class="t10-cuori">Controlli: ${ord.tentativi.length}/${TENTATIVI}</span>
    </div>
    <h2 class="t10-titolo">${puzzle.t}</h2>
    <p class="t10-nota">Metti i lottatori nell'ordine giusto: tocca una riga e poi un'altra per scambiarle. Le righe verdi sono al posto giusto.${puzzle.c ? ` Il campione, ${puzzle.c}, è già dato.` : ""}</p>
    <ol class="t10-lista">${righe}</ol>
    ${finita ? "" : `<div class="t10-azioni"><button type="button" class="btn-gioco" id="t10-controlla">Controlla</button></div>`}
    ${griglia ? `<div class="t10-tentativi" aria-label="Tentativi">${griglia}</div>` : ""}
    <div id="t10-msg" role="status"></div>
    <div id="t10-fine"></div>`;
  collegaSchede();
  if (finita) { mostraFineOrdine(); return; }
  box.querySelectorAll(".t10-riga.ordina").forEach((li) => li.addEventListener("click", () => tocca(Number(li.dataset.i))));
  document.getElementById("t10-controlla").addEventListener("click", controlla);
}

function tocca(i) {
  const slug = ord.ordine[i];
  if (ord.bloccati.includes(slug)) return;
  if (scelto == null) { scelto = i; mostraOrdine(); return; }
  if (scelto !== i) {
    const a = scelto;
    const bloccataA = ord.bloccati.includes(ord.ordine[a]);
    if (!bloccataA) {
      [ord.ordine[a], ord.ordine[i]] = [ord.ordine[i], ord.ordine[a]];
      salvaOrd();
    }
  }
  scelto = null;
  mostraOrdine();
}

function controlla() {
  if (!iniziata) { iniziata = true; tracciaGioco("Top 10", "inizio", { modo: "ordine" }); }
  const postoDi = new Map(puzzle.v.map(([s, , p]) => [s, p]));
  const attesi = puzzle.v.map(([, , p]) => p);
  const esito = ord.ordine.map((s, i) => postoDi.get(s) === attesi[i]);
  ord.tentativi.push(esito);
  ord.bloccati = ord.ordine.filter((s, i) => esito[i]);
  if (esito.every(Boolean)) ord.fine = "vinto";
  else if (ord.tentativi.length >= TENTATIVI) ord.fine = "perso";
  scelto = null;
  salvaOrd();
  mostraOrdine();
  if (ord.fine) tracciaGioco("Top 10", "fine", { modo: "ordine", esito: ord.fine, tentativi: String(ord.tentativi.length) });
  else {
    const m = document.getElementById("t10-msg");
    if (m) m.innerHTML = `<span class="t10-no">${esito.filter(Boolean).length} su ${esito.length} al posto giusto.</span>`;
  }
}

function mostraFineOrdine() {
  const vinto = ord.fine === "vinto";
  const t = ord.tentativi.length;
  const quadri = ord.tentativi.map((x) => x.map((ok) => (ok ? "🟩" : "🟥")).join("")).join("\n");
  const testo = `MMA Oggi · Top 10 n. ${numeroDelGiorno()} (metti in ordine)\n${puzzle.t}\n${vinto ? `✅ In ${t} ${t === 1 ? "controllo" : "controlli"}` : "❌ Non ce l'ho fatta"}\n${quadri}\nMi batti? ${SITO}top10.html`;
  document.getElementById("t10-fine").innerHTML = `
    <div class="chie-fine ${vinto ? "vinto" : "perso"}">
      <div class="chie-fine-nome">${vinto ? `In ${t} ${t === 1 ? "controllo" : "controlli"}!` : "Non è andata"}</div>
      <p class="chie-fine-sub">${vinto ? "Classifica in ordine." : "Qui sopra l'ordine giusto."} Una nuova classifica domani, a mezzanotte.</p>
      <div class="finale-azioni">
        <button type="button" class="btn-gioco" id="t10-cond">Condividi</button>
      </div>
    </div>`;
  document.getElementById("t10-cond").addEventListener("click", (e) => condividi(testo, e.currentTarget));
}

async function init() {
  const [dati, programma] = await Promise.all([caricaLottatori(), fetchJSON("data/top10.json").catch(() => null)]);
  lottatori = dati;
  daSlug = new Map(dati.map((x) => [x.s, x]));
  puzzle = programma && programma.g && programma.g[oggiItalia()];
  if (!puzzle || !puzzle.v.every(([s]) => daSlug.has(s))) {
    box.innerHTML = `<div class="empty-state">La classifica di oggi non è ancora pronta. Torna tra poco!</div>`;
    return;
  }
  stato = leggi(chiave(), null);
  if (!stato || !Array.isArray(stato.trovati)) stato = nuovoStato();
  ord = leggi(chiaveOrd(), null);
  if (!ord || !Array.isArray(ord.ordine) || ord.ordine.length !== puzzle.v.length) {
    ord = { ordine: mescolato(), bloccati: [], tentativi: [], fine: null };
  }
  mostra();
}

init().catch(() => {
  box.innerHTML = `<div class="empty-state">Non riesco a caricare il gioco. Riprova tra poco.</div>`;
});
