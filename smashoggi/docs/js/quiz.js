// Quiz: 10 domande al giorno costruite dai dati veri (paesi, titoli, finali della stagione, citta' dei tornei).
import { montaPagina, esc, fetchJSON } from "./common.js?v=202610101053";
import { caricaGiocatoriGioco, casualeConSeme, numeroGiorno, mescola, leggi, scrivi, oggiItalia, condividi } from "./giochi-comuni.js?v=202610101053";

montaPagina("giochi.html");
const box = document.getElementById("gioco");
const N = 10;

// ogni generatore restituisce { testo, opzioni: [4 stringhe], giusta: indice } oppure null
function generatori(tutti, finali, tornei) {
  const quattro = (giusta, sbagliate, r) => {
    const opz = mescola([giusta, ...mescola([...new Set(sbagliate)].filter((x) => x && x !== giusta), r).slice(0, 3)], r);
    return opz.length === 4 ? { opzioni: opz, giusta: opz.indexOf(giusta) } : null;
  };
  const a = (l, r) => l[Math.floor(r() * l.length)];
  return [
    (r) => { const g = a(tutti, r); const q = quattro(g.paeseNome, tutti.map((x) => x.paeseNome), r); return q && { testo: `Di che paese è <b>${esc(g.nome)}</b>?`, ...q }; },
    (r) => { const f = a(finali, r); const pool = tutti.filter((x) => x.tour === f.tour).map((x) => x.nome);
      const q = quattro(f.vincitore.nome, [f.finalista.nome, ...mescola(pool, r)], r); return q && { testo: `Chi ha vinto il <b>${esc(f.nome)}</b> ${f.tour === "atp" ? "maschile" : "femminile"} quest'anno?`, ...q }; },
    (r) => { const g = a(tutti.filter((x) => x.titoli > 0), r); if (!g) return null; const t = g.titoli;
      const q = quattro(String(t), [t + 1, t + 2, Math.max(0, t - 1), Math.max(0, t - 2), t + 3, t * 2].map(String), r); return q && { testo: `Quanti titoli in carriera ha vinto <b>${esc(g.nome)}</b>?`, ...q }; },
    (r) => { const tour = r() < .5 ? "atp" : "wta"; const sx = tutti.filter((x) => x.tour === tour && x.mano === "Sinistra"); if (!sx.length) return null;
      const g = a(sx, r); const q = quattro(g.nome, mescola(tutti.filter((x) => x.tour === tour && x.mano === "Destra"), r).map((x) => x.nome), r); return q && { testo: "Chi di questi gioca con la <b>sinistra</b>?", ...q }; },
    (r) => { const tour = r() < .5 ? "atp" : "wta"; const c = mescola(tutti.filter((x) => x.tour === tour && x.altezzaCm), r).slice(0, 4);
      if (c.length < 4) return null; const max = Math.max(...c.map((x) => x.altezzaCm)); if (c.filter((x) => x.altezzaCm === max).length > 1) return null;
      const g = c.find((x) => x.altezzaCm === max); const opz = c.map((x) => x.nome); return { testo: "Chi è il più <b>alto</b>?", opzioni: opz, giusta: opz.indexOf(g.nome), spiega: `${g.nome}: ${g.altezzaCm} cm` }; },
    (r) => { const t = a(tornei.filter((x) => x.citta && x.categoria), r); const q = quattro(t.citta, tornei.map((x) => x.citta), r); return q && { testo: `In che città si gioca il <b>${esc(t.nome)}</b>?`, ...q }; },
    (r) => { const g = a(tutti.filter((x) => x.pos <= 20), r); const q = quattro(`N° ${g.pos}`, [g.pos - 1, g.pos + 1, g.pos + 2, g.pos - 2, g.pos + 4].filter((n) => n > 0).map((n) => `N° ${n}`), r);
      return q && { testo: `In che posizione è <b>${esc(g.nome)}</b> nella classifica ${g.tour.toUpperCase()}?`, ...q }; },
  ];
}

async function avvia() {
  const [tutti, { finali }, { tornei }] = await Promise.all([caricaGiocatoriGioco(), fetchJSON("data/archivio.json"), fetchJSON("data/tornei.json")]);
  const gen = generatori(tutti, finali.filter((f) => f.categoria), tornei);
  const crea = (r) => {
    const out = [], visti = new Set();
    for (let i = 0; out.length < N && i < 500; i++) {
      const d = gen[(out.length + Math.floor(r() * 3)) % gen.length](r);
      if (d && !visti.has(d.testo)) { visti.add(d.testo); out.push(d); }
    }
    return out;
  };
  let modo = "giorno", domande = crea(casualeConSeme(numeroGiorno() * 97 + 3));
  const chiave = `smash-quiz-${oggiItalia()}`;
  let risposte = leggi(chiave, []);

  const disegna = () => {
    const i = risposte.length, giuste = risposte.filter((x, k) => x === domande[k].giusta).length;
    if (i >= domande.length) {
      const quadri = risposte.map((x, k) => (x === domande[k].giusta ? "🟩" : "🟥")).join("");
      box.innerHTML = `<div class="esito ${giuste >= 7 ? "vinto" : ""}"><h2>${giuste}/${domande.length}</h2><p>${quadri}</p>
        <p>${giuste === domande.length ? "Perfetto, sei un'enciclopedia del tennis!" : giuste >= 7 ? "Ottimo risultato." : "Domani si riprova."}</p>
        <div class="esito-azioni">${modo === "giorno" ? `<button type="button" class="pill attiva" id="condividi">Condividi</button>` : ""}<button type="button" class="pill" id="ancora">Altre 10 domande</button></div></div>`;
      document.getElementById("condividi")?.addEventListener("click", (e) => condividi(`Smash Oggi · Quiz ${oggiItalia()}: ${giuste}/${domande.length}\n${quadri}`, e.currentTarget));
      document.getElementById("ancora").addEventListener("click", () => { modo = "libero"; domande = crea(Math.random); risposte = []; disegna(); });
      return;
    }
    const d = domande[i];
    box.innerHTML = `<div class="gioco-testa"><span class="gioco-tag">${modo === "giorno" ? "Quiz del giorno" : "Partita libera"}</span><span class="vite">Domanda ${i + 1}/${domande.length} · ${giuste} giuste</span></div>
      <div class="quiz-barra"><i style="width:${(i / domande.length) * 100}%"></i></div>
      <p class="quiz-domanda">${d.testo}</p>
      <div class="quiz-opzioni">${d.opzioni.map((o, k) => `<button type="button" class="quiz-opz" data-k="${k}">${esc(o)}</button>`).join("")}</div>
      <div id="dopo"></div>`;
  };
  box.addEventListener("click", (e) => {
    const b = e.target.closest(".quiz-opz:not([disabled])");
    if (!b) return;
    const d = domande[risposte.length], k = Number(b.dataset.k);
    box.querySelectorAll(".quiz-opz").forEach((x, j) => { x.disabled = true; if (j === d.giusta) x.classList.add("giusta"); else if (j === k) x.classList.add("sbagliata"); });
    risposte.push(k);
    if (modo === "giorno") scrivi(chiave, risposte);
    document.getElementById("dopo").innerHTML = `${d.spiega ? `<p class="nota" style="text-align:center">${esc(d.spiega)}</p>` : ""}<p style="text-align:center"><button type="button" class="pill attiva" id="avanti">${risposte.length < domande.length ? "Avanti →" : "Vedi il risultato"}</button></p>`;
    document.getElementById("avanti").addEventListener("click", disegna);
  });
  disegna();
}
avvia().catch((e) => { console.error(e); box.innerHTML = `<div class="vuoto">Non riesco a caricare il gioco. Riprova tra poco.</div>`; });
