// Memory: trova le coppie foto + cognome dei tennisti. Meno mosse, meglio e'.
import { montaPagina, esc } from "./common.js?v=202610110114";
import { caricaGiocatoriGioco, casualeConSeme, numeroGiorno, mescola, leggi, scrivi, condividi, oggiItalia } from "./giochi-comuni.js?v=202610110114";

montaPagina("giochi.html");
const box = document.getElementById("gioco");
const COPPIE = 6;

async function avvia() {
  const conFoto = (await caricaGiocatoriGioco()).filter((g) => g.foto);
  let modo = "giorno", r = casualeConSeme(numeroGiorno() * 41 + 2);
  let carte, girate, prese, mosse, blocco = false;
  const record = () => leggi("smash-memory-record", null);
  const nuova = () => {
    const scelti = mescola(conFoto, r).slice(0, COPPIE);
    carte = mescola(scelti.flatMap((g) => [{ id: g.id, tipo: "foto", g }, { id: g.id, tipo: "nome", g }]), r);
    girate = []; prese = new Set(); mosse = 0;
  };
  const disegna = () => {
    const finito = prese.size === COPPIE;
    box.innerHTML = `<div class="gioco-testa"><span class="gioco-tag">${modo === "giorno" ? "Memory del giorno" : "Partita libera"}</span><span class="vite">Mosse: ${mosse}${record() ? ` · Record: ${record()}` : ""}</span></div>
      <div class="mem-griglia">${carte.map((c, i) => {
        const su = girate.includes(i) || prese.has(c.id);
        return `<button type="button" class="mem-carta${su ? " su" : ""}${prese.has(c.id) ? " presa" : ""}" data-i="${i}" ${su ? "disabled" : ""} aria-label="${su ? esc(c.g.nome) : "Carta coperta"}">
          ${su ? (c.tipo === "foto" ? `<img src="${esc(c.g.foto)}" alt="">` : `<span>${esc(c.g.nome.split(" ").slice(-1)[0])}</span>`) : `<span class="mem-dorso">🎾</span>`}</button>`;
      }).join("")}</div>
      ${finito ? `<div class="esito vinto"><h2>Fatto in ${mosse} mosse</h2><div class="esito-azioni">${modo === "giorno" ? `<button type="button" class="pill attiva" id="condividi">Condividi</button>` : ""}<button type="button" class="pill" id="ancora">Nuova partita</button></div></div>` : `<p class="nota" style="text-align:center">Gira due carte: trova la foto e il cognome dello stesso tennista.</p>`}`;
    if (finito) {
      if (!record() || mosse < record()) scrivi("smash-memory-record", mosse);
      document.getElementById("condividi")?.addEventListener("click", (e) => condividi(`Smash Oggi · Memory ${oggiItalia()}: ${COPPIE} coppie in ${mosse} mosse 🎾`, e.currentTarget));
      document.getElementById("ancora").addEventListener("click", () => { modo = "libero"; r = Math.random; nuova(); disegna(); });
    }
  };
  box.addEventListener("click", (e) => {
    const b = e.target.closest(".mem-carta:not([disabled])");
    if (!b || blocco) return;
    girate.push(Number(b.dataset.i));
    if (girate.length === 2) {
      mosse++;
      const [x, y] = girate.map((i) => carte[i]);
      if (x.id === y.id) { prese.add(x.id); girate = []; disegna(); }
      else { blocco = true; disegna(); setTimeout(() => { girate = []; blocco = false; disegna(); }, 900); }
    } else disegna();
  });
  nuova(); disegna();
}
avvia().catch((e) => { console.error(e); box.innerHTML = `<div class="vuoto">Non riesco a caricare il gioco. Riprova tra poco.</div>`; });
