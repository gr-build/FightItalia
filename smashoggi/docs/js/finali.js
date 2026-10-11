// Chi ha vinto la finale? Le finali vere della stagione (ATP, WTA e Challenger): scegli il vincitore e allunga la serie.
import { montaPagina, esc, fetchJSON, caricaGiocatori, etichettaCategoria, iniziali } from "./common.js?v=202610110114";
import { leggi, scrivi, condividi, mescola } from "./giochi-comuni.js?v=202610110114";
import { punteggioFinale } from "./archivio-comune.js?v=202610110114";

montaPagina("giochi.html");
const box = document.getElementById("gioco");

async function avvia() {
  const [{ finali }, giocatori] = await Promise.all([fetchJSON("data/archivio.json"), caricaGiocatori()]);
  // prima le finali con giocatori noti (con foto), poi le altre
  let mazzo = mescola(finali.filter((f) => f.vincitore.id && f.finalista.id));
  let serie = 0, record = leggi("smash-finali-record", 0), f;
  const lato = (p) => { const g = giocatori[p.id] || p; return `<button type="button" class="fin-lato" data-id="${esc(p.id)}">
      ${g.foto ? `<img src="${esc(g.foto)}" alt="">` : `<span class="fin-ini">${esc(iniziali(p.nome))}</span>`}<b>${esc(p.nome)}</b><small>${esc(p.paese || "")}</small></button>`; };
  const turno = () => {
    f = mazzo.pop() || (mazzo = mescola(finali)).pop();
    const [x, y] = mescola([f.vincitore, f.finalista]);
    const cat = etichettaCategoria(f);
    box.innerHTML = `<div class="gioco-testa"><span class="gioco-tag">Serie: ${serie}</span><span class="vite">Record: ${record}</span></div>
      <div class="fin-torneo"><span class="tag ${cat.classe}">${esc(cat.testo)}</span><b>${esc(f.nome)}</b><small>Finale · ${esc(f.fine.split("-").reverse().join("/"))}</small></div>
      <p class="pom-domanda">Chi ha vinto?</p>
      <div class="fin-coppia">${lato(x)}${lato(y)}</div><div id="esito"></div>`;
  };
  box.addEventListener("click", (e) => {
    const b = e.target.closest(".fin-lato:not([disabled])");
    if (!b) return;
    const giusto = b.dataset.id === f.vincitore.id;
    box.querySelectorAll(".fin-lato").forEach((x) => { x.disabled = true; x.classList.add(x.dataset.id === f.vincitore.id ? "giusta" : "sbagliata"); });
    const esito = document.getElementById("esito");
    if (giusto) {
      serie++; if (serie > record) { record = serie; scrivi("smash-finali-record", record); }
      esito.innerHTML = `<div class="esito vinto"><h2>Giusto!</h2><p>${esc(punteggioFinale(f))}</p></div>`;
      setTimeout(turno, 1400);
    } else {
      esito.innerHTML = `<div class="esito perso"><h2>No: ha vinto ${esc(f.vincitore.nome)}</h2><p>${esc(punteggioFinale(f))} · Serie finale: <b>${serie}</b></p>
        <div class="esito-azioni"><button type="button" class="pill attiva" id="condividi">Condividi</button><button type="button" class="pill" id="ricomincia">Ricomincia</button></div></div>`;
      const fatta = serie;
      document.getElementById("condividi").addEventListener("click", (ev) => condividi(`Smash Oggi · Chi ha vinto la finale? Serie di ${fatta} 🏆`, ev.currentTarget));
      document.getElementById("ricomincia").addEventListener("click", () => { serie = 0; turno(); });
    }
  });
  turno();
}
avvia().catch((e) => { console.error(e); box.innerHTML = `<div class="vuoto">Non riesco a caricare il gioco. Riprova tra poco.</div>`; });
