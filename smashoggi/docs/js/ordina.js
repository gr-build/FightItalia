// Ordina: cinque tennisti veri da mettere in ordine (classifica, titoli, eta' o altezza). Uno al giorno, uguale per tutti.
import { montaPagina, esc, iniziali } from "./common.js?v=202610101448";
import { caricaGiocatoriGioco, casualeConSeme, numeroGiorno, mescola, leggi, scrivi, oggiItalia, condividi } from "./giochi-comuni.js?v=202610101448";

montaPagina("giochi.html");

const box = document.getElementById("gioco");
const CRITERI = [
  { k: "pos", titolo: "dal migliore in classifica al peggiore", valore: (g) => `N° ${g.pos}`, cresce: true },
  { k: "titoli", titolo: "da chi ha più titoli in carriera a chi ne ha meno", valore: (g) => `${g.titoli} titoli`, cresce: false },
  { k: "eta", titolo: "dal più giovane al più anziano", valore: (g) => `${g.eta} anni`, cresce: true },
  { k: "altezzaCm", titolo: "dal più alto al più basso", valore: (g) => `${g.altezzaCm} cm`, cresce: false },
];

function pesca(tutti, r) {
  for (let i = 0; i < 300; i++) {
    const c = CRITERI[Math.floor(r() * CRITERI.length)];
    const tour = r() < 0.5 ? "atp" : "wta";
    const pool = mescola(tutti.filter((g) => g.tour === tour && g[c.k] != null), r);
    const scelti = [];
    for (const g of pool) { if (!scelti.some((x) => x[c.k] === g[c.k])) scelti.push(g); if (scelti.length === 5) break; }
    if (scelti.length === 5) return { c, scelti };
  }
  return null;
}

async function avvia() {
  const tutti = await caricaGiocatoriGioco();
  let modo = "giorno", partita = pesca(tutti, casualeConSeme(numeroGiorno() * 31 + 5));
  const chiave = `smash-ordina-${oggiItalia()}`;
  let scelta = leggi(chiave, []);

  const disegna = () => {
    const { c, scelti } = partita;
    const giusto = [...scelti].sort((a, b) => (c.cresce ? a[c.k] - b[c.k] : b[c.k] - a[c.k]));
    const finito = scelta.length === 5;
    const esatti = finito ? scelta.filter((id, i) => id === giusto[i].id).length : 0;
    box.innerHTML = `
      <div class="gioco-testa"><span class="gioco-tag">${modo === "giorno" ? "Sfida del giorno" : "Partita libera"}</span><span class="vite">${scelti[0].tour === "atp" ? "Uomini" : "Donne"}</span></div>
      <p class="pom-domanda">Tocca i tennisti in ordine <b>${esc(c.titolo)}</b>.</p>
      <div class="ord-lista">${(finito ? scelta.map((id) => scelti.find((g) => g.id === id)) : scelti).map((g, i) => {
        const n = scelta.indexOf(g.id);
        const ok = finito && giusto[i].id === g.id;
        return `<button type="button" class="ord-carta${n >= 0 ? " scelta" : ""}${finito ? (ok ? " giusta" : " sbagliata") : ""}" data-id="${g.id}" ${finito || n >= 0 ? "disabled" : ""}>
          <span class="ord-num">${n >= 0 ? n + 1 : ""}</span>
          ${g.foto ? `<img src="${esc(g.foto)}" alt="" width="48" height="48">` : `<span class="ord-ini">${esc(iniziali(g.nome))}</span>`}
          <span class="ord-nome"><b>${esc(g.nome)}</b><small>${esc(g.paeseNome || g.paese || "")}</small></span>
          ${finito ? `<span class="ord-val">${esc(c.valore(g))}</span>` : ""}</button>`;
      }).join("")}</div>
      ${!finito && scelta.length ? `<p style="text-align:center"><button type="button" class="pill" id="annulla">Annulla l'ultimo</button></p>` : ""}
      ${finito ? `<div class="esito ${esatti === 5 ? "vinto" : ""}"><h2>${esatti}/5 al posto giusto</h2>
        ${esatti < 5 ? `<p class="nota">Ordine giusto: ${giusto.map((g) => esc(g.nome.split(" ").slice(-1)[0])).join(" → ")}</p>` : "<p>Perfetto!</p>"}
        <div class="esito-azioni">${modo === "giorno" ? `<button type="button" class="pill attiva" id="condividi">Condividi</button>` : ""}<button type="button" class="pill" id="ancora">Gioca ancora</button></div></div>` : ""}`;
    if (finito) {
      document.getElementById("condividi")?.addEventListener("click", (e) => condividi(`Smash Oggi · Ordina ${oggiItalia()}: ${esatti}/5\n${scelta.map((id, i) => (id === giusto[i].id ? "🟩" : "🟥")).join("")}`, e.currentTarget));
      document.getElementById("ancora").addEventListener("click", () => { modo = "libero"; partita = pesca(tutti, Math.random); scelta = []; disegna(); });
    }
    document.getElementById("annulla")?.addEventListener("click", () => { scelta.pop(); salva(); disegna(); });
  };
  const salva = () => { if (modo === "giorno") scrivi(chiave, scelta); };
  box.addEventListener("click", (e) => {
    const b = e.target.closest(".ord-carta:not([disabled])");
    if (!b) return;
    scelta.push(b.dataset.id); salva(); disegna();
  });
  if (!partita) { box.innerHTML = `<div class="vuoto">Dati insufficienti.</div>`; return; }
  disegna();
}
avvia().catch((e) => { console.error(e); box.innerHTML = `<div class="vuoto">Non riesco a caricare il gioco. Riprova tra poco.</div>`; });
