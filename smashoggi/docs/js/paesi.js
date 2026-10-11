// Da dove viene? Foto e nome di un tennista, quattro paesi: indovina e allunga la serie.
import { montaPagina, esc } from "./common.js?v=202610110114";
import { caricaGiocatoriGioco, leggi, scrivi, condividi, mescola } from "./giochi-comuni.js?v=202610110114";

montaPagina("giochi.html");
const box = document.getElementById("gioco");

async function avvia() {
  const tutti = (await caricaGiocatoriGioco()).filter((g) => g.foto && g.paeseNome);
  const paesi = [...new Set(tutti.map((g) => g.paeseNome))];
  let serie = 0, record = leggi("smash-paesi-record", 0), g;
  const turno = () => {
    g = tutti[Math.floor(Math.random() * tutti.length)];
    const opz = mescola([g.paeseNome, ...mescola(paesi.filter((p) => p !== g.paeseNome)).slice(0, 3)]);
    box.innerHTML = `<div class="gioco-testa"><span class="gioco-tag">Serie: ${serie}</span><span class="vite">Record: ${record}</span></div>
      <div class="paesi-foto"><img src="${esc(g.foto)}" alt=""><b>${esc(g.nome)}</b><small>${g.tour.toUpperCase()} N° ${g.pos}</small></div>
      <p class="pom-domanda">Di che paese è?</p>
      <div class="quiz-opzioni">${opz.map((o) => `<button type="button" class="quiz-opz" data-p="${esc(o)}">${esc(o)}</button>`).join("")}</div><div id="esito"></div>`;
  };
  box.addEventListener("click", (e) => {
    const b = e.target.closest(".quiz-opz:not([disabled])");
    if (!b) return;
    const giusto = b.dataset.p === g.paeseNome;
    box.querySelectorAll(".quiz-opz").forEach((x) => { x.disabled = true; if (x.dataset.p === g.paeseNome) x.classList.add("giusta"); else if (x === b) x.classList.add("sbagliata"); });
    if (giusto) {
      serie++; if (serie > record) { record = serie; scrivi("smash-paesi-record", record); }
      setTimeout(turno, 900);
    } else {
      const fatta = serie;
      document.getElementById("esito").innerHTML = `<div class="esito perso"><h2>Serie finale: ${fatta}</h2><p>Record: ${record}</p>
        <div class="esito-azioni"><button type="button" class="pill attiva" id="condividi">Condividi</button><button type="button" class="pill" id="ricomincia">Ricomincia</button></div></div>`;
      document.getElementById("condividi").addEventListener("click", (ev) => condividi(`Smash Oggi · Da dove viene? Serie di ${fatta} 🌍`, ev.currentTarget));
      document.getElementById("ricomincia").addEventListener("click", () => { serie = 0; turno(); });
    }
  });
  turno();
}
avvia().catch((e) => { console.error(e); box.innerHTML = `<div class="vuoto">Non riesco a caricare il gioco. Riprova tra poco.</div>`; });
