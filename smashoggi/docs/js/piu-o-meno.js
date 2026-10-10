// Piu' o meno: due giocatori, una statistica vera. Indovina se il secondo ha un valore piu' alto o piu' basso e allunga la serie.
import { montaPagina, esc, iniziali } from "./common.js?v=202610101023";
import { caricaGiocatoriGioco, leggi, scrivi, condividi } from "./giochi-comuni.js?v=202610101023";

montaPagina("giochi.html");

const box = document.getElementById("gioco");
// solo statistiche presenti nei dati; i punti si confrontano nello stesso circuito
const DOMANDE = [
  { k: "punti", testo: "punti in classifica", fmt: (v) => v.toLocaleString("it-IT"), stessoTour: true },
  { k: "eta", testo: "anni", fmt: (v) => String(v) },
  { k: "altezzaCm", testo: "cm di altezza", fmt: (v) => String(v) },
];

const foto = (g) => (g.foto ? `<img src="${esc(g.foto)}" alt="" width="120" height="120">` : `<span class="pom-iniziali" aria-hidden="true">${esc(iniziali(g.nome))}</span>`);

async function avvia() {
  const tutti = await caricaGiocatoriGioco();
  let record = leggi("smash-pom-record", 0), serie = 0, a, b, d;

  const pesca = (escludi) => {
    for (let i = 0; i < 200; i++) {
      const dd = DOMANDE[Math.floor(Math.random() * DOMANDE.length)];
      const base = escludi || tutti[Math.floor(Math.random() * tutti.length)];
      const pool = tutti.filter((g) => g.id !== base.id && g[dd.k] != null && base[dd.k] != null && g[dd.k] !== base[dd.k] && (!dd.stessoTour || g.tour === base.tour));
      if (pool.length) return [base, pool[Math.floor(Math.random() * pool.length)], dd];
    }
    return null;
  };

  const carta = (g, mostra, dd) => `<div class="pom-carta">
      ${foto(g)}<b>${esc(g.nome)}</b><small>${esc(g.paeseNome || g.paese || "")} · ${g.tour.toUpperCase()} N° ${g.pos}</small>
      ${mostra ? `<div class="pom-valore">${esc(dd.fmt(g[dd.k]))}</div><small>${esc(dd.testo)}</small>` : ""}</div>`;

  const disegna = (stato) => {
    const nuovo = stato === "gioca";
    box.innerHTML = `
      <div class="gioco-testa"><span class="gioco-tag">Serie: ${serie}</span><span class="vite">Record: ${record}</span></div>
      <div class="pom-coppia">${carta(a, true, d)}<div class="pom-vs">VS</div>${carta(b, !nuovo, d)}</div>
      <p class="pom-domanda">${esc(b.nome)} ha <b>più</b> o <b>meno</b> ${esc(d.testo)}?</p>
      ${nuovo ? `<div class="pom-bottoni"><button type="button" class="pom-btn" data-r="piu">▲ Più</button><button type="button" class="pom-btn" data-r="meno">▼ Meno</button></div>` : `<div id="esito"></div>`}`;
  };

  const turno = (base) => {
    const r = pesca(base);
    if (!r) { box.innerHTML = `<div class="vuoto">Dati insufficienti per il gioco.</div>`; return; }
    [a, b, d] = r;
    disegna("gioca");
  };

  box.addEventListener("click", (e) => {
    const bt = e.target.closest(".pom-btn");
    if (bt) {
      const giusto = (bt.dataset.r === "piu") === (b[d.k] > a[d.k]);
      disegna("risposta");
      const esito = document.getElementById("esito");
      if (giusto) {
        serie++;
        if (serie > record) { record = serie; scrivi("smash-pom-record", record); }
        esito.innerHTML = `<div class="esito vinto"><h2>Giusto!</h2><p>Serie: ${serie}</p></div>`;
        setTimeout(() => turno(b), 1300);
      } else {
        esito.innerHTML = `<div class="esito perso"><h2>Sbagliato</h2><p>Serie finale: <b>${serie}</b> · Record: ${record}</p>
          <div class="esito-azioni"><button type="button" class="pill attiva" id="condividi">Condividi</button><button type="button" class="pill" id="ricomincia">Ricomincia</button></div></div>`;
        const fatta = serie;
        document.getElementById("condividi").addEventListener("click", (ev) => condividi(`Smash Oggi · Più o meno: serie di ${fatta} 🎾`, ev.currentTarget));
        document.getElementById("ricomincia").addEventListener("click", () => { serie = 0; turno(); });
      }
    }
  });
  turno();
}

avvia().catch((e) => { console.error(e); box.innerHTML = `<div class="vuoto">Non riesco a caricare il gioco. Riprova tra poco.</div>`; });
