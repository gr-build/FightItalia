// Chi e'? Foto sfocata del giocatore del giorno (primi 100 ATP e WTA): 6 tentativi, a ogni errore la foto si schiarisce.
import { montaPagina, esc } from "./common.js?v=202610101019";
import { caricaGiocatoriGioco, delGiorno, leggi, scrivi, oggiItalia, condividi, cercaGiocatore } from "./giochi-comuni.js?v=202610101019";

montaPagina("giochi.html");

const MAX = 6;
const PIXEL = [26, 18, 12, 8, 5, 3, 1]; // grandezza dei "quadretti" a ogni errore; 1 = foto nitida
const box = document.getElementById("gioco");

function disegnaFoto(canvas, img, livello) {
  const lato = canvas.width, px = PIXEL[Math.min(livello, PIXEL.length - 1)];
  const ctx = canvas.getContext("2d");
  const piccolo = Math.max(1, Math.round(lato / px));
  const tmp = document.createElement("canvas");
  tmp.width = tmp.height = piccolo;
  tmp.getContext("2d").drawImage(img, 0, 0, piccolo, piccolo);
  ctx.imageSmoothingEnabled = false;
  ctx.clearRect(0, 0, lato, lato);
  ctx.drawImage(tmp, 0, 0, piccolo, piccolo, 0, 0, lato, lato);
}

// confronto tra il tentativo e la soluzione, come indizio
function confronto(t, s) {
  // la freccia dice se il numero giusto e' piu' alto (↑) o piu' basso (↓)
  const freccia = (a, b) => (a === b ? "" : a < b ? " ↑" : " ↓");
  const c = (ok, testo, titolo) => `<span class="indizio ${ok ? "si" : "no"}" title="${esc(titolo)}">${esc(testo)}</span>`;
  return [
    c(t.tour === s.tour, t.tour === "atp" ? "ATP" : "WTA", "Circuito"),
    c(t.paese === s.paese, t.paese || "?", "Paese"),
    c(t.pos === s.pos, `N° ${t.pos}${freccia(t.pos, s.pos)}`, "Classifica: la freccia indica dove cercare"),
    t.eta && s.eta ? c(t.eta === s.eta, `${t.eta} anni${freccia(t.eta, s.eta)}`, "Età") : "",
    c(t.mano === s.mano, t.mano === "Sinistra" ? "Mancino" : "Destrorso", "Mano"),
  ].join("");
}

async function avvia() {
  const tutti = await caricaGiocatoriGioco();
  const conFoto = tutti.filter((g) => g.foto);
  let modo = "giorno", soluzione = delGiorno(conFoto, 11);
  const chiave = `smash-chie-${oggiItalia()}`;
  let tentativi = leggi(chiave, []);  // id provati oggi
  let finito = false;

  const img = new Image();
  const html = () => {
    box.innerHTML = `
      <div class="gioco-testa"><span class="gioco-tag">${modo === "giorno" ? "Giocatore del giorno" : "Partita libera"}</span><span id="vite" class="vite"></span></div>
      <div class="chie-foto"><canvas id="foto" width="280" height="280" aria-label="Foto sfocata del giocatore da indovinare" role="img"></canvas></div>
      <p class="nota" id="aiuto" style="text-align:center"></p>
      <div id="cerca"></div>
      <div id="esito"></div>
      <ol class="tentativi" id="tentativi" aria-label="I tuoi tentativi"></ol>`;
  };

  const aggiorna = () => {
    const canvas = document.getElementById("foto");
    const sbagli = tentativi.filter((id) => id !== soluzione.id).length;
    const vinto = tentativi.includes(soluzione.id);
    finito = vinto || tentativi.length >= MAX;
    if (img.complete && img.naturalWidth) disegnaFoto(canvas, img, finito ? 99 : sbagli);
    document.getElementById("vite").textContent = finito ? "" : `${MAX - tentativi.length} tentativi`;
    document.getElementById("aiuto").textContent = finito ? "" : tentativi.length ? "Verde: coincide. Frecce: il numero giusto è più alto ↑ o più basso ↓." : "Uomo o donna, primi 100 del mondo. Scrivi un nome.";
    document.getElementById("tentativi").innerHTML = tentativi.map((id) => {
      const g = tutti.find((x) => x.id === id);
      return g ? `<li class="${id === soluzione.id ? "giusto" : ""}"><b>${esc(g.nome)}</b><div class="indizi">${confronto(g, soluzione)}</div></li>` : "";
    }).reverse().join("");
    document.getElementById("cerca").hidden = finito;
    const esito = document.getElementById("esito");
    if (!finito) { esito.innerHTML = ""; return; }
    const quadri = tentativi.map((id) => (id === soluzione.id ? "🟩" : "🟥")).join("");
    esito.innerHTML = `<div class="esito ${vinto ? "vinto" : "perso"}">
        <h2>${vinto ? "Indovinato!" : "Peccato"}</h2>
        <p>Era <a href="giocatore.html?id=${encodeURIComponent(soluzione.id)}"><b>${esc(soluzione.nome)}</b></a>, N° ${soluzione.pos} ${soluzione.tour.toUpperCase()}.</p>
        <div class="esito-azioni">${modo === "giorno" ? `<button type="button" class="pill attiva" id="condividi">Condividi</button>` : ""}
        <button type="button" class="pill" id="ancora">Gioca ancora (giocatore a caso)</button></div>
        ${modo === "giorno" ? `<p class="nota">Domani un giocatore nuovo.</p>` : ""}</div>`;
    document.getElementById("condividi")?.addEventListener("click", (e) =>
      condividi(`Smash Oggi · Chi è? ${oggiItalia()}\n${quadri} ${vinto ? `${tentativi.length}/${MAX}` : `X/${MAX}`}`, e.currentTarget));
    document.getElementById("ancora").addEventListener("click", () => {
      modo = "libero";
      soluzione = conFoto[Math.floor(Math.random() * conFoto.length)];
      tentativi = [];
      parti();
    });
  };

  const parti = () => {
    html();
    img.onload = aggiorna;
    img.src = soluzione.foto;
    cercaGiocatore(document.getElementById("cerca"), tutti, (g) => {
      if (finito || tentativi.includes(g.id)) return;
      tentativi.push(g.id);
      if (modo === "giorno") scrivi(chiave, tentativi);
      aggiorna();
    }, (g) => tentativi.includes(g.id));
    aggiorna();
  };
  parti();
}

avvia().catch((e) => { console.error(e); box.innerHTML = `<div class="vuoto">Non riesco a caricare il gioco. Riprova tra poco.</div>`; });
