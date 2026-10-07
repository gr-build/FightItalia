// "Top 10": una classifica UFC (es. piu' vittorie per KO), dieci posti, tre
// cuori. Si scrive un lottatore: se e' in top 10 prende il suo posto, altrimenti
// si perde un cuore. Una classifica nuova ogni giorno, piu' l'allenamento.
// Le classifiche si calcolano dai dati di data/giochi.json (i lottatori del
// roster UFC con foto): niente dati nuovi da tenere aggiornati.

import { renderChrome, tracciaGioco } from "./common.js?v=202610071111";
import { caricaLottatori, leggi, scrivi, iniziali, condividi, casualeConSeme, oggiItalia, SITO } from "./giochi-comuni.js?v=202610071111";

renderChrome("giochi");

const STATISTICHE = [
  { k: "v", nome: "vittorie in carriera", unita: "vittorie" },
  { k: "ko", nome: "vittorie per KO/TKO", unita: "KO" },
  { k: "sub", nome: "vittorie per sottomissione", unita: "sottomissioni" },
  { k: "r", nome: "allungo", unita: "cm", piu: "l'allungo più lungo" },
  { k: "h", nome: "altezza", unita: "cm", piu: "i più alti" },
  { k: "l", nome: "sconfitte in carriera", unita: "sconfitte", piu: "più sconfitte in carriera" },
];
const FILTRI = [
  { id: "tutti", testo: "", ok: () => true },
  { id: "uomini", testo: "uomini", ok: (x) => x.g !== "F" },
  { id: "donne", testo: "donne", ok: (x) => x.g === "F" },
  ...["Massimi", "Mediomassimi", "Medi", "Welter", "Leggeri", "Piuma", "Gallo", "Mosca", "Paglia"].map((c) => ({
    id: c.toLowerCase(), testo: `pesi ${c.toLowerCase()}`, ok: (x) => x.c === c,
  })),
];
const VITE = 3;
const EPOCA = Date.UTC(2026, 9, 7); // il giorno 1 e' il 7/10/2026

const box = document.getElementById("top10");
let pool = [];
let puzzle = null;
let modo = "giorno";
let stato = null;

const pulito = (n) => String(n || "").replace(/\s*\*\s*$/, "").trim();
const norma = (t) => String(t || "").normalize("NFKD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9 ]/g, " ").replace(/\s+/g, " ").trim();
const valore = (x, k) => (x[k] == null ? null : Math.round(x[k]));

// Tutte le classifiche valide: dieci posti con valore > 0 e al massimo 3
// pari merito oltre il decimo (i pari merito sono tutti risposte giuste).
function tuttiIPuzzle() {
  const out = [];
  for (const stat of STATISTICHE) {
    for (const f of FILTRI) {
      const candidati = pool.filter((x) => f.ok(x) && valore(x, stat.k) != null).sort((a, b) => valore(b, stat.k) - valore(a, stat.k));
      if (candidati.length < 25 || valore(candidati[9], stat.k) <= 0) continue;
      const soglia = valore(candidati[9], stat.k);
      const validi = candidati.filter((x) => valore(x, stat.k) >= soglia);
      if (validi.length > 13) continue;
      out.push({ id: `${stat.k}-${f.id}`, stat, filtro: f, validi, soglia });
    }
  }
  return out;
}

function titolo(p) {
  const { stat, filtro } = p;
  const base = stat.piu ? `Top 10: ${stat.piu}` : `Top 10: più ${stat.nome}`;
  return `${base}${filtro.testo ? ` · ${filtro.testo}` : ""}`;
}

function numeroDelGiorno() {
  const [a, m, g] = oggiItalia().split("-").map(Number);
  return Math.round((Date.UTC(a, m - 1, g) - EPOCA) / 86400000) + 1;
}

function puzzleDelGiorno(tutti) {
  const n = numeroDelGiorno();
  const rnd = casualeConSeme(n * 7919 + 13);
  return { puzzle: tutti[Math.floor(rnd() * tutti.length)], n };
}

function nuovoStato() {
  return { trovati: [], vite: VITE, fine: null };
}

function chiave() {
  return `top10-${puzzle.id}-${modo === "giorno" ? numeroDelGiorno() : "allenamento"}`;
}

function salva() {
  if (modo === "giorno") scrivi(chiave(), stato);
}

function posti() {
  // trovati, ordinati dal migliore: i pari merito condividono il posto
  const ordinati = [...puzzle.validi];
  const righe = [];
  let posto = 0;
  let prec = null;
  ordinati.forEach((x, i) => {
    const v = valore(x, puzzle.stat.k);
    if (v !== prec) posto = i + 1;
    prec = v;
    righe.push({ x, posto, v });
  });
  return righe;
}

function foto(x) {
  const vuoto = `<span class="t10-foto t10-vuota">${iniziali(pulito(x.n))}</span>`;
  return x.f ? `<img class="t10-foto" src="${x.f}" alt="" onerror="this.outerHTML=this.dataset.vuoto" data-vuoto='${vuoto}'>` : vuoto;
}

function mostra() {
  const righe = posti();
  const finita = !!stato.fine;
  const cuori = Array.from({ length: VITE }, (_, i) => (i < stato.vite ? "❤️" : "🖤")).join("");
  const trovati = new Set(stato.trovati);
  const slot = righe.map(({ x, posto, v }) => {
    const aperto = trovati.has(x.s) || finita;
    const mancato = finita && !trovati.has(x.s);
    return `<li class="t10-riga ${trovati.has(x.s) ? "trovato" : ""} ${mancato ? "mancato" : ""}">
      <span class="t10-posto">${posto}</span>
      ${aperto ? `${foto(x)}<span class="t10-nome">${pulito(x.n)}</span><span class="t10-val">${v} <small>${puzzle.stat.unita}</small></span>` : `<span class="t10-segreto">?</span>`}
    </li>`;
  }).join("");
  box.innerHTML = `
    <div class="t10-testa">
      <span class="t10-modo">${modo === "giorno" ? `Classifica n. ${numeroDelGiorno()}` : "Allenamento"}</span>
      <span class="t10-cuori" aria-label="${stato.vite} cuori">${cuori}</span>
    </div>
    <h2 class="t10-titolo">${titolo(puzzle)}</h2>
    <p class="t10-nota">Tra i ${pool.length} lottatori del roster UFC del gioco (dati del sito). Pari merito: valgono tutti.</p>
    <ol class="t10-lista">${slot}</ol>
    ${finita ? "" : `
    <div class="t10-ricerca">
      <input id="t10-in" type="text" autocomplete="off" placeholder="Cerca un lottatore..." aria-label="Cerca un lottatore">
      <div id="t10-sug" class="t10-sug" role="listbox"></div>
    </div>
    <div class="t10-azioni"><button type="button" class="btn-gioco secondario" id="t10-resa">Mi arrendo</button></div>`}
    <div id="t10-msg" role="status"></div>
    <div id="t10-fine"></div>`;
  if (finita) mostraFine();
  else collegaRicerca();
}

function collegaRicerca() {
  const input = document.getElementById("t10-in");
  const sug = document.getElementById("t10-sug");
  document.getElementById("t10-resa").addEventListener("click", () => chiudi("resa"));
  const usati = new Set(stato.provati || []);
  const aggiorna = () => {
    const q = norma(input.value);
    if (q.length < 2) { sug.innerHTML = ""; return; }
    const trovate = pool
      .filter((x) => !usati.has(x.s) && norma(pulito(x.n)).split(" ").some((p) => p.startsWith(q)) || (q.length > 2 && norma(pulito(x.n)).includes(q) && !usati.has(x.s)))
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

let iniziata = false;

function prova(slug) {
  if (stato.fine) return;
  if (!iniziata) { iniziata = true; tracciaGioco("Top 10", "inizio", { classifica: puzzle.id }); }
  stato.provati = [...(stato.provati || []), slug];
  const x = pool.find((p) => p.s === slug);
  const giusto = puzzle.validi.some((p) => p.s === slug);
  let msg;
  if (giusto) {
    stato.trovati.push(slug);
    msg = `<span class="t10-ok">${pulito(x.n)} è in top 10!</span>`;
  } else {
    stato.vite--;
    msg = `<span class="t10-no">${pulito(x.n)} non è in questa classifica.</span>`;
  }
  if (stato.trovati.length === puzzle.validi.length) stato.fine = "vinto";
  else if (stato.vite <= 0) stato.fine = "perso";
  salva();
  mostra();
  const m = document.getElementById("t10-msg");
  if (m) m.innerHTML = msg;
  if (stato.fine) tracciaGioco("Top 10", "fine", { esito: stato.fine, trovati: String(stato.trovati.length) });
}

function chiudi(esito) {
  stato.fine = esito === "resa" ? "perso" : esito;
  salva();
  mostra();
  tracciaGioco("Top 10", "fine", { esito: "resa", trovati: String(stato.trovati.length) });
}

function mostraFine() {
  const n = Math.min(10, stato.trovati.length);
  const vinto = stato.fine === "vinto";
  const emoji = Array.from({ length: VITE }, (_, i) => (i < stato.vite ? "❤️" : "🖤")).join("");
  const testo = `MMA Oggi · Top 10 ${modo === "giorno" ? `n. ${numeroDelGiorno()}` : ""}\n${titolo(puzzle)}\n${vinto ? "✅ Tutti e 10!" : `${n}/${puzzle.validi.length} trovati`} ${emoji}\nMi batti? ${SITO}top10.html`;
  document.getElementById("t10-fine").innerHTML = `
    <div class="chie-fine ${vinto ? "vinto" : "perso"}">
      <div class="chie-fine-nome">${vinto ? "Classifica completa!" : `${n} su ${puzzle.validi.length}`}</div>
      <p class="chie-fine-sub">${vinto ? "Ti conosci davvero l'UFC." : "Ecco la classifica completa qui sopra."}</p>
      <div class="finale-azioni">
        <button type="button" class="btn-gioco" id="t10-altra">${modo === "giorno" ? "Allenamento" : "Un'altra classifica"}</button>
        <button type="button" class="btn-gioco secondario" id="t10-cond">Condividi</button>
      </div>
    </div>`;
  document.getElementById("t10-altra").addEventListener("click", () => {
    modo = "allenamento";
    iniziata = false;
    const tutti = tuttiIPuzzle();
    puzzle = tutti[Math.floor(Math.random() * tutti.length)];
    stato = nuovoStato();
    mostra();
    window.scrollTo({ top: 0, behavior: "smooth" });
  });
  document.getElementById("t10-cond").addEventListener("click", (e) => condividi(testo, e.currentTarget));
}

async function init() {
  const tutti = await caricaLottatori();
  pool = tutti.filter((x) => x.f && x.v != null);
  const p = tuttiIPuzzle();
  if (!p.length) throw new Error("nessuna classifica");
  puzzle = puzzleDelGiorno(p).puzzle;
  // se in giornata e' gia' stata giocata, si riprende da dove era rimasta
  stato = leggi(chiave(), null);
  if (!stato || !Array.isArray(stato.trovati)) stato = nuovoStato();
  mostra();
}

init().catch(() => {
  box.innerHTML = `<div class="empty-state">Non riesco a caricare il gioco. Riprova tra poco.</div>`;
});
