// "Piu' o meno": due lottatori, una statistica. Il secondo ne ha di piu' o
// di meno del primo? Una risposta sbagliata e la serie finisce.

import { renderChrome } from "./common.js?v=202609250714";
import { caricaLottatori, leggi, scrivi, iniziali, condividi, SITO, bandiera } from "./giochi-comuni.js?v=202609250714";

renderChrome("giochi");

const STATISTICHE = [
  { k: "v", nome: "vittorie in carriera", unita: "vittorie" },
  { k: "ko", nome: "vittorie per KO/TKO", unita: "KO" },
  { k: "sub", nome: "vittorie per sottomissione", unita: "sottomissioni" },
  { k: "r", nome: "allungo", unita: "cm" },
  { k: "h", nome: "altezza", unita: "cm" },
  { k: "e", nome: "età", unita: "anni" },
];

const box = document.getElementById("pom");
let pool = [];
let serie = 0;
let coppia = null;

const valore = (x, k) => (x[k] == null ? null : Math.round(x[k]));

function nuovaCoppia(sinistra) {
  for (let tentativi = 0; tentativi < 200; tentativi++) {
    const stat = STATISTICHE[Math.floor(Math.random() * STATISTICHE.length)];
    const a = sinistra && valore(sinistra, stat.k) != null ? sinistra : pool[Math.floor(Math.random() * pool.length)];
    const b = pool[Math.floor(Math.random() * pool.length)];
    const va = valore(a, stat.k);
    const vb = valore(b, stat.k);
    if (a.s !== b.s && va != null && vb != null && va !== vb) return { a, b, stat };
  }
  return null;
}

function foto(x) {
  const vuoto = `<span class="pom-foto pom-foto-vuota">${iniziali(x.n)}</span>`;
  return x.f ? `<img class="pom-foto" src="${x.f}" alt="" onerror="this.outerHTML=this.dataset.vuoto" data-vuoto='${vuoto}'>` : vuoto;
}

function lato(x, stat, mostraValore, id) {
  return `
    <div class="pom-lato" id="${id}">
      ${foto(x)}
      <div class="pom-nome">${x.n}</div>
      <div class="pom-sub">${bandiera(x.b)} ${x.c}${x.g === "F" ? " (F)" : ""}</div>
      <div class="pom-valore">${mostraValore ? `${valore(x, stat.k)} <span>${stat.unita}</span>` : "?"}</div>
    </div>`;
}

function mostra() {
  const { a, b, stat } = coppia;
  const migliore = leggi("pom-migliore", 0);
  box.innerHTML = `
    <div class="pom-punteggio"><span>Serie <b>${serie}</b></span><span>Migliore <b>${migliore}</b></span></div>
    <div class="pom-domanda">${b.n} ha <b>più o meno ${stat.nome}</b> di ${a.n}?</div>
    <div class="pom-arena">
      ${lato(a, stat, true, "lato-a")}
      <div class="pom-vs">vs</div>
      ${lato(b, stat, false, "lato-b")}
    </div>
    <div class="pom-bottoni">
      <button type="button" class="btn-gioco" data-scelta="piu">▲ Più</button>
      <button type="button" class="btn-gioco" data-scelta="meno">▼ Meno</button>
    </div>
    <div id="pom-esito" role="status"></div>`;
  box.querySelectorAll("[data-scelta]").forEach((btn) => btn.addEventListener("click", () => rispondi(btn.dataset.scelta)));
}

function rispondi(scelta) {
  const { a, b, stat } = coppia;
  const giusto = (valore(b, stat.k) > valore(a, stat.k)) === (scelta === "piu");
  box.querySelectorAll("[data-scelta]").forEach((btn) => (btn.disabled = true));
  const latoB = document.getElementById("lato-b");
  latoB.querySelector(".pom-valore").innerHTML = `${valore(b, stat.k)} <span>${stat.unita}</span>`;
  latoB.classList.add(giusto ? "giusto" : "sbagliato");
  if (giusto) {
    serie++;
    if (serie > leggi("pom-migliore", 0)) scrivi("pom-migliore", serie);
    setTimeout(() => {
      coppia = nuovaCoppia(b);
      mostra();
    }, 1100);
    return;
  }
  const testo = `MMA Oggi · Più o meno: serie di ${serie} 🥊\nMi batti? ${SITO}piu-o-meno.html`;
  document.getElementById("pom-esito").innerHTML = `
    <div class="chie-fine perso">
      <div class="chie-fine-titolo">Serie finita: ${serie}</div>
      <div class="chie-fine-sub">Il tuo record: ${leggi("pom-migliore", 0)}</div>
      <div class="finale-azioni">
        <button type="button" class="btn-gioco" id="ricomincia">Ricomincia</button>
        <button type="button" class="btn-gioco secondario" id="condividi">Condividi</button>
      </div>
    </div>`;
  document.getElementById("ricomincia").addEventListener("click", () => {
    serie = 0;
    coppia = nuovaCoppia(null);
    mostra();
  });
  document.getElementById("condividi").addEventListener("click", (e) => condividi(testo, e.currentTarget));
}

async function init() {
  const tutti = await caricaLottatori();
  // Solo lottatori riconoscibili: con foto e almeno 8 incontri.
  pool = tutti.filter((x) => x.f && x.v + x.l >= 8);
  coppia = nuovaCoppia(null);
  mostra();
}

init().catch(() => {
  box.innerHTML = `<div class="empty-state">Non riesco a caricare il gioco. Riprova tra poco.</div>`;
});
