// Cognomle — il cognome del lottatore UFC del giorno, alla Wordle: 6
// tentativi, tastiera a schermo, lettere verdi/gialle/grigie. La lunghezza
// della griglia cambia ogni giorno in base al cognome da indovinare. Si
// puo' scrivere qualsiasi sequenza di lettere della lunghezza giusta, non
// serve che sia un cognome vero: come nel Wordle originale, il feedback
// lettera per lettera funziona comunque.

import { renderChrome } from "./common.js?v=202609292310";
import { caricaLottatori, leggi, scrivi, casualeConSeme, oggiItalia, condividi, SITO } from "./giochi-comuni.js?v=202609292310";

renderChrome("giochi");

const TENTATIVI = 6;
const INIZIO = "2026-09-27"; // giorno #1
const MIN_POOL = 8; // lunghezze di cognome troppo rare non entrano in rotazione

// Particelle che restano attaccate al cognome vero e proprio (de Ridder, du
// Plessis, dos Anjos, da Silva...). Coreani e cinesi mettono il cognome per
// primo (es. "Park Jun-yong", cognome "Park"): l'unico modo per saperlo e'
// il paese, non c'e' una regola grammaticale.
const PARTICELLE = new Set(["de", "du", "da", "dos", "das", "von"]);
const FAMIGLIA_PRIMA = new Set(["Corea del Sud", "Cina"]);
const SUFFISSI = /^(jr\.?|sr\.?|ii|iii|iv)$/i;

// Ritorna anche la particella a parte (es. "da"), cosi' chi disegna la
// griglia sa dopo quante lettere mettere uno spacer visivo: "DASILVA" tutto
// attaccato si legge come una parola sola, non come "da" + "Silva".
function cognome(x) {
  const parole = x.n.replace(/\*/g, "").trim().split(/\s+/);
  while (parole.length > 1 && SUFFISSI.test(parole[parole.length - 1])) parole.pop();
  if (FAMIGLIA_PRIMA.has(x.p)) return { testo: parole[0], particella: "" };
  if (parole.length >= 2 && PARTICELLE.has(parole[parole.length - 2].toLowerCase())) {
    const particella = parole[parole.length - 2];
    return { testo: `${particella} ${parole[parole.length - 1]}`, particella };
  }
  return { testo: parole[parole.length - 1], particella: "" };
}

// Accenti, trattini e apostrofi via: si gioca solo con A-Z, altrimenti su
// tastiera serve un tasto per ogni lettera accentata di ogni lingua. La "Ł"
// polacca (Błachowicz, Ruchała...) non e' un accento: NFD non la tocca,
// va sostituita a mano o resta ingiocabile.
function normalizza(s) {
  return s
    .replace(/[Łł]/g, "L")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[-'\s]/g, "")
    .toUpperCase();
}

const box = document.getElementById("cognomle");
const params = new URLSearchParams(location.search);
const libero = params.has("libero");

function numeroGiorno(oggi) {
  return Math.round((Date.parse(oggi) - Date.parse(INIZIO)) / 86400000) + 1;
}

// Stessa logica di chi-e.js: pool mescolato una volta con seme fisso, poi
// uno al giorno in ordine. Tutti vedono lo stesso cognome nello stesso giorno.
function lottatoreDelGiorno(pool, n) {
  const ordinati = [...pool].sort((a, b) => a.s.localeCompare(b.s));
  const rnd = casualeConSeme(71827364);
  for (let i = ordinati.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [ordinati[i], ordinati[j]] = [ordinati[j], ordinati[i]];
  }
  const idx = (((n - 1) % ordinati.length) + ordinati.length) % ordinati.length;
  return ordinati[idx];
}

const TASTIERA = ["QWERTYUIOP", "ASDFGHJKL", "⌫ZXCVBNM⏎"];

// Algoritmo classico Wordle: prima i verdi (posto giusto), poi i gialli sulle
// lettere restanti — cosi' i doppi (es. due "S") non vengono segnati due volte.
function valutaTentativo(tentativo, segreto) {
  const L = segreto.length;
  const stato = new Array(L).fill("no");
  const restanti = {};
  for (let i = 0; i < L; i++) {
    if (tentativo[i] === segreto[i]) stato[i] = "ok";
    else restanti[segreto[i]] = (restanti[segreto[i]] || 0) + 1;
  }
  for (let i = 0; i < L; i++) {
    if (stato[i] === "ok") continue;
    if (restanti[tentativo[i]] > 0) {
      stato[i] = "vicino";
      restanti[tentativo[i]]--;
    }
  }
  return stato;
}

function quadratini(tentativi, segreto) {
  const emoji = { ok: "🟩", vicino: "🟨", no: "⬛" };
  return tentativi.map((t) => valutaTentativo(t, segreto).map((s) => emoji[s]).join("")).join("\n");
}

async function init() {
  const tutti = await caricaLottatori();
  const arricchiti = tutti.map((x) => {
    const { testo, particella } = cognome(x);
    return { ...x, cognomeNorm: normalizza(testo), spacerDopo: particella ? normalizza(particella).length : 0 };
  });

  const conteggi = new Map();
  for (const x of arricchiti) conteggi.set(x.cognomeNorm.length, (conteggi.get(x.cognomeNorm.length) || 0) + 1);
  const pool = arricchiti.filter((x) => conteggi.get(x.cognomeNorm.length) >= MIN_POOL);

  const oggi = oggiItalia();
  const n = numeroGiorno(oggi);
  const segretoX = libero ? pool[Math.floor(Math.random() * pool.length)] : lottatoreDelGiorno(pool, n);
  const segreto = segretoX.cognomeNorm;
  const L = segreto.length;
  const spacerDopo = segretoX.spacerDopo; // indice (1-based) dell'ultima lettera della particella, 0 se non c'e'

  const chiave = `cognomle-${oggi}`;
  let tentativi = libero ? [] : leggi(chiave, []);
  let corrente = "";

  box.innerHTML = `
    <div class="cogn-info" id="cogn-info">Il cognome di oggi ha <b>${L}</b> lettere.</div>
    <div class="cogn-griglia" id="griglia" style="--lettere: ${L}"></div>
    <p class="cogn-msg" id="msg" role="status"></p>
    <div class="cogn-tastiera" id="tastiera"></div>
    <div id="fine"></div>`;

  const griglia = document.getElementById("griglia");
  const msg = document.getElementById("msg");
  const tastieraEl = document.getElementById("tastiera");
  const info = document.getElementById("cogn-info");

  function finito() {
    return tentativi.includes(segreto) || tentativi.length >= TENTATIVI;
  }

  function statoTastiera() {
    const rank = { no: 0, vicino: 1, ok: 2 };
    const stati = {};
    for (const t of tentativi) {
      const s = valutaTentativo(t, segreto);
      for (let i = 0; i < L; i++) {
        const lettera = t[i];
        if (!(lettera in stati) || rank[s[i]] > rank[stati[lettera]]) stati[lettera] = s[i];
      }
    }
    return stati;
  }

  function disegnaTastiera() {
    const stati = statoTastiera();
    const etichetta = { "⏎": "Invio", "⌫": "Canc" };
    tastieraEl.innerHTML = TASTIERA.map((riga) => `
      <div class="cogn-riga-tasti">
        ${[...riga].map((c) => {
          const speciale = c === "⏎" || c === "⌫";
          const cls = speciale ? "speciale" : stati[c] || "";
          const testo = speciale ? etichetta[c] : c;
          return `<button type="button" class="cogn-tasto ${cls}" data-tasto="${c}" aria-label="${speciale ? etichetta[c] : c}">${testo}</button>`;
        }).join("")}
      </div>`).join("");
  }

  function disegnaGriglia(fin) {
    const righe = [];
    for (let r = 0; r < TENTATIVI; r++) {
      const t = tentativi[r];
      const inCorso = r === tentativi.length && !fin;
      const lettereRiga = t ? [...t] : [...(inCorso ? corrente : "").padEnd(L, " ")];
      const stati = t ? valutaTentativo(t, segreto) : new Array(L).fill("");
      righe.push(`<div class="cogn-riga">${lettereRiga.map((c, i) => `<div class="cogn-cella ${stati[i] || ""} ${i === spacerDopo - 1 ? "cogn-cella-sep" : ""}">${c.trim()}</div>`).join("")}</div>`);
    }
    griglia.innerHTML = righe.join("");
  }

  function mostraFine(vinto) {
    const esito = vinto ? `${tentativi.length}/${TENTATIVI}` : `X/${TENTATIVI}`;
    const testo = `MMA Oggi · Cognomle ${libero ? "(libero)" : `#${n}`} ${esito}\n${quadratini(tentativi, segreto)}\n${SITO}cognomle.html`;
    const serie = libero ? null : leggi("cognomle-serie", { attuale: 0, migliore: 0, ultimo: null });
    document.getElementById("fine").innerHTML = `
      <div class="cogn-fine ${vinto ? "vinto" : "perso"}">
        <div class="cogn-fine-titolo">${vinto ? "Preso!" : "Era lui"}</div>
        <div class="cogn-fine-nome"><a href="lottatore.html?slug=${segretoX.s}">${segretoX.n}</a></div>
        ${serie ? `<div class="cogn-fine-sub">Serie: ${serie.attuale} · Migliore: ${serie.migliore}</div>` : ""}
        <div class="finale-azioni">
          <button type="button" class="btn-gioco" id="condividi">Condividi il risultato</button>
          <a class="btn-gioco secondario" href="cognomle.html?libero=1">Gioca ancora (libero)</a>
        </div>
        ${libero ? "" : `<p class="cogn-fine-sub">Nuovo cognome domani a mezzanotte.</p>`}
      </div>`;
    document.getElementById("condividi").addEventListener("click", (e) => condividi(testo, e.currentTarget));
  }

  function aggiornaSerie(vinto) {
    const serie = leggi("cognomle-serie", { attuale: 0, migliore: 0, ultimo: null });
    if (serie.ultimo === oggi) return;
    const ieri = new Date(Date.parse(oggi) - 86400000).toISOString().slice(0, 10);
    serie.attuale = vinto ? (serie.ultimo === ieri ? serie.attuale + 1 : 1) : 0;
    serie.migliore = Math.max(serie.migliore, serie.attuale);
    serie.ultimo = oggi;
    scrivi("cognomle-serie", serie);
  }

  function aggiorna(testoMsg) {
    const fin = finito();
    disegnaGriglia(fin);
    disegnaTastiera();
    msg.textContent = testoMsg || "";
    info.hidden = fin;
    if (fin) mostraFine(tentativi.includes(segreto));
  }

  function scuoti() {
    griglia.classList.remove("scuoti");
    void griglia.offsetWidth;
    griglia.classList.add("scuoti");
  }

  function invia() {
    if (finito()) return;
    if (corrente.length !== L) {
      scuoti();
      aggiorna(`Il cognome deve avere ${L} lettere.`);
      return;
    }
    tentativi.push(corrente);
    corrente = "";
    if (!libero) scrivi(chiave, tentativi);
    if (!libero && finito()) aggiornaSerie(tentativi.includes(segreto));
    aggiorna();
  }

  function tasto(c) {
    if (finito()) return;
    if (c === "⌫") corrente = corrente.slice(0, -1);
    else if (c === "⏎") return invia();
    else if (/^[a-zà-ÿ]$/i.test(c) && corrente.length < L) corrente += normalizza(c);
    aggiorna();
  }

  tastieraEl.addEventListener("click", (e) => {
    const b = e.target.closest("button[data-tasto]");
    if (b) tasto(b.dataset.tasto);
  });

  document.addEventListener("keydown", (e) => {
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    if (e.key === "Enter") tasto("⏎");
    else if (e.key === "Backspace") tasto("⌫");
    else if (/^[a-zà-ÿ]$/i.test(e.key)) tasto(e.key);
  });

  aggiorna();
}

init().catch(() => {
  box.innerHTML = `<div class="empty-state">Non riesco a caricare il gioco. Riprova tra poco.</div>`;
});
