// Griglia: in ogni casella un tennista che rispetta riga e colonna. Griglia del giorno uguale per tutti; 3 errori al massimo.
import { montaPagina, esc, fetchJSON } from "./common.js?v=202610101053";
import { caricaTuttiGioco, casualeConSeme, numeroGiorno, mescola, leggi, scrivi, oggiItalia, condividi, cercaGiocatore } from "./giochi-comuni.js?v=202610101053";

montaPagina("giochi.html");
const box = document.getElementById("gioco");
const ERRORI = 3;

function criteri(finali) {
  const finalisti = new Set(finali.flatMap((f) => [f.vincitore.id, f.finalista.id]));
  const paese = (c, n) => ({ id: `p-${c}`, testo: n, ok: (g) => g.paese === c, tipo: "paese" });
  return {
    righe: [paese("ITA", "🇮🇹 Italia"), paese("ESP", "🇪🇸 Spagna"), paese("USA", "🇺🇸 Stati Uniti"), paese("FRA", "🇫🇷 Francia"), paese("RUS", "Russia"),
      paese("CZE", "🇨🇿 Rep. Ceca"), paese("AUS", "🇦🇺 Australia"), paese("GER", "🇩🇪 Germania"), paese("ARG", "🇦🇷 Argentina"), paese("CHN", "🇨🇳 Cina"),
      paese("CAN", "🇨🇦 Canada"), paese("GBR", "🇬🇧 Gran Bretagna"), paese("POL", "🇵🇱 Polonia"), paese("UKR", "🇺🇦 Ucraina"),
      { id: "uomo", testo: "Uomo (ATP)", ok: (g) => g.tour === "atp" }, { id: "donna", testo: "Donna (WTA)", ok: (g) => g.tour === "wta" }],
    colonne: [
      { id: "top10", testo: "Nei primi 10", ok: (g) => g.pos && g.pos <= 10 },
      { id: "top50", testo: "Nei primi 50", ok: (g) => g.pos && g.pos <= 50 },
      { id: "fuori50", testo: "Dal 51º al 150º", ok: (g) => g.pos > 50 },
      { id: "mancino", testo: "Mancino", ok: (g) => g.mano === "Sinistra" },
      { id: "u23", testo: "Under 23", ok: (g) => g.eta && g.eta < 23 },
      { id: "o30", testo: "30 anni o più", ok: (g) => g.eta >= 30 },
      { id: "alto", testo: "Almeno 188 cm", ok: (g) => g.altezzaCm >= 188 },
      { id: "t10", testo: "10+ titoli in carriera", ok: (g) => g.titoli >= 10 },
      { id: "t1", testo: "Almeno 1 titolo in carriera", ok: (g) => g.titoli >= 1 },
      { id: "t0", testo: "Nessun titolo in carriera", ok: (g) => g.titoli === 0 },
      { id: "anno", testo: "Ha vinto un titolo quest'anno", ok: (g) => g.titoliAnno >= 1 },
      { id: "finale", testo: "Ha giocato una finale quest'anno", ok: (g) => finalisti.has(g.id) },
    ],
  };
}

function creaGriglia(tutti, c, r) {
  for (let i = 0; i < 2000; i++) {
    const righe = mescola(c.righe, r).slice(0, 3), colonne = mescola(c.colonne, r).slice(0, 3);
    if (righe.filter((x) => x.id === "uomo" || x.id === "donna").length > 1) continue;
    const celle = righe.map((ri) => colonne.map((co) => tutti.filter((g) => ri.ok(g) && co.ok(g))));
    if (celle.flat().every((l) => l.length >= 2)) return { righe, colonne, celle };
  }
  return null;
}

async function avvia() {
  const [tutti0, { finali }] = await Promise.all([caricaTuttiGioco(), fetchJSON("data/archivio.json")]);
  const tutti = tutti0.filter((g) => g.pos); // classificati (primi 150): giocatori con dati completi
  const c = criteri(finali);
  let modo = "giorno", griglia = creaGriglia(tutti, c, casualeConSeme(numeroGiorno() * 13 + 1));
  const chiave = `smash-griglia-${oggiItalia()}`;
  let st = leggi(chiave, { celle: {}, errori: 0 });
  let attiva = null;

  const disegna = () => {
    const { righe, colonne, celle } = griglia;
    const piene = Object.keys(st.celle).length;
    const finito = piene === 9 || st.errori >= ERRORI;
    const usati = new Set(Object.values(st.celle));
    const cella = (i, j) => {
      const k = `${i}${j}`, id = st.celle[k];
      if (id) { const g = tutti.find((x) => x.id === id); return `<div class="gr-cella piena">${g.foto ? `<img src="${esc(g.foto)}" alt="">` : ""}<span>${esc(g.nome.split(" ").slice(-1)[0])}</span></div>`; }
      if (finito) { const g = celle[i][j][0]; return `<div class="gr-cella rivelata"><span>${esc(g.nome)}</span><small>${celle[i][j].length} possibili</small></div>`; }
      return `<button type="button" class="gr-cella${attiva === k ? " attiva" : ""}" data-c="${k}" aria-label="${esc(righe[i].testo)} e ${esc(colonne[j].testo)}">+</button>`;
    };
    box.innerHTML = `<div class="gioco-testa"><span class="gioco-tag">${modo === "giorno" ? "Griglia del giorno" : "Partita libera"}</span>
        <span class="vite" aria-label="Errori rimasti">${"❤️".repeat(Math.max(0, ERRORI - st.errori))}${"🖤".repeat(Math.min(ERRORI, st.errori))}</span></div>
      <div class="griglia-gioco">
        <div></div>${colonne.map((co) => `<div class="gr-testa">${esc(co.testo)}</div>`).join("")}
        ${righe.map((ri, i) => `<div class="gr-testa riga">${esc(ri.testo)}</div>${[0, 1, 2].map((j) => cella(i, j)).join("")}`).join("")}
      </div>
      <div id="scelta"></div>
      ${finito ? `<div class="esito ${piene === 9 ? "vinto" : ""}"><h2>${piene}/9</h2><p>${piene === 9 ? "Griglia completata!" : "Le caselle vuote mostrano una risposta possibile."}</p>
        <div class="esito-azioni">${modo === "giorno" ? `<button type="button" class="pill attiva" id="condividi">Condividi</button>` : ""}<button type="button" class="pill" id="ancora">Nuova griglia</button></div></div>`
        : `<p class="nota" style="text-align:center">Tocca una casella e scrivi un tennista dei primi 150 che rispetta riga e colonna. Ogni tennista vale una volta sola.</p>`}`;
    if (attiva && !finito) {
      const [i, j] = attiva.split("").map(Number);
      document.getElementById("scelta").innerHTML = `<p class="gr-chiede"><b>${esc(righe[i].testo)}</b> + <b>${esc(colonne[j].testo)}</b></p><div id="cerca"></div>`;
      const input = cercaGiocatore(document.getElementById("cerca"), tutti, (g) => {
        if (celle[i][j].some((x) => x.id === g.id)) st.celle[attiva] = g.id;
        else st.errori++;
        const sbagliato = !st.celle[attiva];
        attiva = null; salva(); disegna();
        if (sbagliato) box.querySelector(".vite")?.classList.add("scossa");
      }, (g) => usati.has(g.id));
      input.focus();
    }
    if (finito) {
      const quadri = [0, 1, 2].map((i) => [0, 1, 2].map((j) => (st.celle[`${i}${j}`] ? "🟩" : "⬜")).join("")).join("\n");
      document.getElementById("condividi")?.addEventListener("click", (e) => condividi(`Smash Oggi · Griglia ${oggiItalia()}: ${piene}/9\n${quadri}`, e.currentTarget));
      document.getElementById("ancora").addEventListener("click", () => { modo = "libero"; griglia = creaGriglia(tutti, c, Math.random); st = { celle: {}, errori: 0 }; attiva = null; disegna(); });
    }
  };
  const salva = () => { if (modo === "giorno") scrivi(chiave, st); };
  box.addEventListener("click", (e) => { const b = e.target.closest("button.gr-cella"); if (b) { attiva = b.dataset.c; disegna(); } });
  if (!griglia) { box.innerHTML = `<div class="vuoto">Dati insufficienti.</div>`; return; }
  disegna();
}
avvia().catch((e) => { console.error(e); box.innerHTML = `<div class="vuoto">Non riesco a caricare il gioco. Riprova tra poco.</div>`; });
