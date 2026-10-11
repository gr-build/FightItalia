// Top 10: una classifica vera al giorno da completare scrivendo i nomi. Tre errori e la partita finisce.
import { montaPagina, esc, iniziali } from "./common.js?v=202610110114";
import { caricaTuttiGioco, casualeConSeme, numeroGiorno, leggi, scrivi, oggiItalia, condividi, cercaGiocatore } from "./giochi-comuni.js?v=202610110114";

montaPagina("giochi.html");
const box = document.getElementById("gioco");
const VITE = 3;

const LISTE = (tutti) => {
  const cl = (tour) => tutti.filter((g) => g.tour === tour && g.pos);
  return [
    { titolo: "I primi 10 della classifica ATP", lista: cl("atp").sort((a, b) => a.pos - b.pos), val: (g) => `N° ${g.pos}` },
    { titolo: "Le prime 10 della classifica WTA", lista: cl("wta").sort((a, b) => a.pos - b.pos), val: (g) => `N° ${g.pos}` },
    { titolo: "ATP: i 10 con più titoli in carriera (tra i primi 150)", lista: cl("atp").filter((g) => g.titoli != null).sort((a, b) => b.titoli - a.titoli), val: (g) => `${g.titoli} titoli` },
    { titolo: "WTA: le 10 con più titoli in carriera (tra le prime 150)", lista: cl("wta").filter((g) => g.titoli != null).sort((a, b) => b.titoli - a.titoli), val: (g) => `${g.titoli} titoli` },
    { titolo: "I 10 italiani e italiane meglio classificati", lista: tutti.filter((g) => g.paese === "ITA" && g.pos).sort((a, b) => a.pos - b.pos), val: (g) => `${g.tour.toUpperCase()} N° ${g.pos}` },
    { titolo: "ATP: i 10 più alti tra i primi 150", lista: cl("atp").filter((g) => g.altezzaCm).sort((a, b) => b.altezzaCm - a.altezzaCm), val: (g) => `${g.altezzaCm} cm` },
    { titolo: "ATP: i 10 più giovani tra i primi 150", lista: cl("atp").filter((g) => g.eta).sort((a, b) => a.eta - b.eta || a.pos - b.pos), val: (g) => `${g.eta} anni` },
    { titolo: "WTA: le 10 più giovani tra le prime 150", lista: cl("wta").filter((g) => g.eta).sort((a, b) => a.eta - b.eta || a.pos - b.pos), val: (g) => `${g.eta} anni` },
  ].map((l) => ({ ...l, lista: l.lista.slice(0, 10) })).filter((l) => l.lista.length === 10);
};

async function avvia() {
  const tutti = await caricaTuttiGioco();
  const liste = LISTE(tutti);
  let modo = "giorno", L = liste[Math.floor(casualeConSeme(numeroGiorno() * 17 + 9)() * liste.length)];
  const chiave = `smash-top10-${oggiItalia()}`;
  let st = leggi(chiave, { presi: [], errori: 0 });

  const disegna = () => {
    const finito = st.presi.length === 10 || st.errori >= VITE;
    box.innerHTML = `<div class="gioco-testa"><span class="gioco-tag">${modo === "giorno" ? "Top 10 del giorno" : "Partita libera"}</span>
        <span class="vite">${"❤️".repeat(Math.max(0, VITE - st.errori))}${"🖤".repeat(Math.min(VITE, st.errori))}</span></div>
      <p class="pom-domanda"><b>${esc(L.titolo)}</b></p>
      ${finito ? "" : `<div id="cerca"></div>`}
      <ol class="t10">${L.lista.map((g, i) => {
        const preso = st.presi.includes(g.id);
        return `<li class="${preso ? "preso" : finito ? "mancato" : ""}"><span class="t10-n">${i + 1}</span>${preso || finito ? `${g.foto ? `<img src="${esc(g.foto)}" alt="">` : `<span class="t10-ini">${esc(iniziali(g.nome))}</span>`}<b>${esc(g.nome)}</b><small>${esc(L.val(g))}</small>` : `<span class="t10-vuoto">?</span>`}</li>`;
      }).join("")}</ol>
      ${finito ? `<div class="esito ${st.presi.length === 10 ? "vinto" : ""}"><h2>${st.presi.length}/10</h2>
        <div class="esito-azioni">${modo === "giorno" ? `<button type="button" class="pill attiva" id="condividi">Condividi</button>` : ""}<button type="button" class="pill" id="ancora">Un'altra Top 10</button></div></div>` : ""}`;
    if (!finito) {
      cercaGiocatore(document.getElementById("cerca"), tutti, (g) => {
        if (L.lista.some((x) => x.id === g.id)) st.presi.push(g.id); else st.errori++;
        salva(); disegna();
      }, (g) => st.presi.includes(g.id));
    } else {
      document.getElementById("condividi")?.addEventListener("click", (e) => condividi(`Smash Oggi · Top 10 ${oggiItalia()}: ${st.presi.length}/10\n${L.lista.map((g) => (st.presi.includes(g.id) ? "🟩" : "⬛")).join("")}`, e.currentTarget));
      document.getElementById("ancora").addEventListener("click", () => { modo = "libero"; L = liste[Math.floor(Math.random() * liste.length)]; st = { presi: [], errori: 0 }; disegna(); });
    }
  };
  const salva = () => { if (modo === "giorno") scrivi(chiave, st); };
  disegna();
}
avvia().catch((e) => { console.error(e); box.innerHTML = `<div class="vuoto">Non riesco a caricare il gioco. Riprova tra poco.</div>`; });
