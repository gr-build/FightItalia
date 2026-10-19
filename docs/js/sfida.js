// "Sfida del giorno": cinque domande a risposta multipla, uguali per tutti.
// Le domande sono in data/sfida.json (le prepara e le verifica build_sfida.py);
// qui le sceglie un generatore con seme (la data italiana), quindi chi gioca
// nello stesso giorno vede le stesse cinque domande con le stesse opzioni
// nello stesso ordine. Niente premi, soldi o pronostici.

import { renderChrome, tracciaGioco, fetchJSON } from "./common.js?v=202610181710";
import { leggi, scrivi, condividi, oggiItalia, casualeConSeme, SITO } from "./giochi-comuni.js?v=202610181710";

renderChrome("giochi");

const EPOCA = Date.UTC(2026, 9, 19); // sfida n. 1 = 19/10/2026
const TOTALE = 5;
const box = document.getElementById("sfida");

// ordine delle domande; l'ultima ruota ogni giorno. Se un tipo non ha domande, ne prende un altro.
const PIANO = [["main", "bat"], ["camp", "cat"], ["paese"], ["nick"], ["bat", "ko", "cat"]];

const esc = (t) => String(t).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

function hash(testo) { // FNV-1a
  let h = 0x811c9dc5;
  for (const c of testo) { h ^= c.codePointAt(0); h = Math.imul(h, 0x01000193); }
  return h >>> 0;
}

function numeroDelGiorno(oggi) {
  const [a, m, g] = oggi.split("-").map(Number);
  return Math.round((Date.UTC(a, m - 1, g) - EPOCA) / 86400000) + 1;
}

function mescola(lista, rng) {
  const l = [...lista];
  for (let i = l.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [l[i], l[j]] = [l[j], l[i]]; }
  return l;
}

// le cinque domande del giorno: stessa data, stesse domande
function scegli(dati, oggi, numero) {
  const seme = hash("mmaoggi-" + oggi);
  const usati = new Set();
  const fatte = [];
  PIANO.forEach((tipi, i) => {
    const rng = casualeConSeme(seme + i * 7919);
    const ordine = i === PIANO.length - 1 ? tipi.slice((numero % tipi.length)).concat(tipi.slice(0, numero % tipi.length)) : tipi;
    for (const tipo of ordine) {
      const pool = (dati[tipo] || []).filter((d) => !d.n.some((s) => usati.has(s)));
      if (!pool.length) continue;
      const d = pool[Math.floor(rng() * pool.length)];
      d.n.forEach((s) => usati.add(s));
      fatte.push({ ...d, opzioni: mescola([d.r, ...d.d], rng) });
      break;
    }
  });
  return fatte;
}

const chiaveOggi = (oggi) => `sfida-${oggi}`;

function aggiornaSerie(oggi) {
  const s = leggi("sfida-serie", { ultimo: null, serie: 0, migliore: 0 });
  if (s.ultimo === oggi) return s;
  const [a, m, g] = oggi.split("-").map(Number);
  const ieri = new Date(Date.UTC(a, m - 1, g - 1)).toISOString().slice(0, 10);
  s.serie = s.ultimo === ieri ? s.serie + 1 : 1;
  s.ultimo = oggi;
  s.migliore = Math.max(s.migliore || 0, s.serie);
  scrivi("sfida-serie", s);
  return s;
}

function giorni(n) { return `${n} ${n === 1 ? "giorno" : "giorni"} di fila`; }

function schermataFine(numero, risultato, serie) {
  const caselle = risultato.e.map((x) => (x ? "🟩" : "🟥")).join("");
  const testoSerie = `🔥 ${giorni(serie.serie)}${serie.migliore > serie.serie ? ` · record ${serie.migliore}` : ""}`;
  const testo = `🥊 MMA Oggi · Sfida del giorno #${numero}\n${risultato.p}/${TOTALE} ${caselle}\n🔥 ${giorni(serie.serie)}\nLe domande sono uguali per tutti: riesci a fare meglio?\n👉 ${SITO}sfida.html?sfida=1`;
  box.innerHTML = `
    <div class="sfida-carta sfida-fine">
      <div class="sfida-num">Sfida del giorno #${numero}</div>
      <div class="sfida-punti">${risultato.p}/${TOTALE}</div>
      <div class="sfida-caselle" aria-label="Esiti">${caselle}</div>
      <h2 class="sfida-titolo">Quante ne indovini su 5?</h2>
      <p class="sfida-serie">${testoSerie}</p>
      <p class="sfida-nota">Le domande sono uguali per tutti: sfida un amico e confrontate il risultato. Domani una nuova sfida.</p>
      <div class="sfida-azioni">
        <button type="button" class="btn-gioco" id="sfida-cond">📲 Sfida un amico</button>
        <a class="btn-gioco secondario" href="giochi.html">Altri giochi</a>
      </div>
    </div>`;
  const b = document.getElementById("sfida-cond");
  b.addEventListener("click", () => condividi(testo, b));
}

function gioca(domande, oggi, numero) {
  let i = 0, punti = 0;
  const esiti = [];
  tracciaGioco("sfida", "inizio");

  function mostra() {
    const d = domande[i];
    box.innerHTML = `
      <div class="sfida-carta">
        <div class="sfida-testa"><span>Domanda ${i + 1} di ${domande.length}</span><span id="sfida-p">Punti: ${punti}</span></div>
        <h2 class="sfida-titolo">${esc(d.q)}</h2>
        <div class="sfida-contesto"><b>${esc(d.k)}</b><span>${esc(d.s)}</span></div>
        <div class="sfida-opzioni" role="group" aria-label="Risposte">
          ${d.opzioni.map((o) => `<button type="button" class="sfida-opz" data-r="${esc(o)}">${esc(o)}</button>`).join("")}
        </div>
        <div class="sfida-azioni"><button type="button" class="btn-gioco" id="sfida-avanti" hidden>${i + 1 === domande.length ? "Vedi il risultato" : "Avanti →"}</button></div>
      </div>`;
    box.querySelectorAll(".sfida-opz").forEach((b) => b.addEventListener("click", () => risposta(b, d)));
    document.getElementById("sfida-avanti").addEventListener("click", avanti);
  }

  function risposta(scelto, d) {
    const giusta = scelto.dataset.r === d.r;
    box.querySelectorAll(".sfida-opz").forEach((b) => {
      b.disabled = true;
      if (b.dataset.r === d.r) b.classList.add("giusta");
    });
    if (!giusta) scelto.classList.add("sbagliata");
    punti += giusta ? 1 : 0;
    esiti.push(giusta ? 1 : 0);
    document.getElementById("sfida-p").textContent = `Punti: ${punti}`;
    const avanti = document.getElementById("sfida-avanti");
    avanti.hidden = false;
    avanti.focus();
  }

  function avanti() {
    i++;
    if (i < domande.length) return mostra();
    const risultato = { p: punti, e: esiti };
    scrivi(chiaveOggi(oggi), risultato);
    const serie = aggiornaSerie(oggi);
    tracciaGioco("sfida", "fine", { punti });
    schermataFine(numero, risultato, serie);
  }

  mostra();
}

function intro(numero, partenza) {
  box.innerHTML = `
    <div class="sfida-carta sfida-intro">
      <div class="sfida-num">Sfida del giorno #${numero}</div>
      <h2 class="sfida-titolo">Quante ne indovini su 5?</h2>
      <p class="sfida-nota">Cinque domande a risposta multipla, uguali per tutti. Un minuto, gratis. Poi sfida un amico.</p>
      <div class="sfida-azioni"><button type="button" class="btn-gioco" id="sfida-via">Comincia</button></div>
    </div>`;
  document.getElementById("sfida-via").addEventListener("click", partenza);
}

async function avvia() {
  const oggi = oggiItalia();
  const numero = numeroDelGiorno(oggi);
  let dati;
  try {
    dati = await fetchJSON("data/sfida.json");
  } catch {
    dati = null;
  }
  const domande = dati ? scegli(dati, oggi, numero) : [];
  if (domande.length < 3) {
    box.innerHTML = `<div class="empty-state">Non ci sono abbastanza dati per la sfida di oggi: riprova più tardi.</div>`;
    return;
  }
  const fatta = leggi(chiaveOggi(oggi), null);
  if (fatta && Array.isArray(fatta.e)) {
    schermataFine(numero, fatta, leggi("sfida-serie", { serie: 1, migliore: 1 }));
    return;
  }
  const subito = new URLSearchParams(location.search).get("sfida") === "1";
  if (subito) gioca(domande, oggi, numero);
  else intro(numero, () => gioca(domande, oggi, numero));
}

avvia();
