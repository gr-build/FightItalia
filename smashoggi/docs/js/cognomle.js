// Cognomle: il cognome di un giocatore dei primi 100 ATP e WTA in 6 tentativi, come Wordle.
// Verde: lettera giusta al posto giusto. Giallo: c'e' ma in un altro posto. Grigio: non c'e'.
import { montaPagina, esc } from "./common.js?v=202610101448";
import { caricaGiocatoriGioco, delGiorno, leggi, scrivi, oggiItalia, condividi, normale } from "./giochi-comuni.js?v=202610101448";

montaPagina("giochi.html");

const MAX = 6;
const box = document.getElementById("gioco");
const RIGHE_TASTI = ["QWERTYUIOP", "ASDFGHJKL", "⏎ZXCVBNM⌫"];

// cognome giocabile: solo lettere A-Z dopo aver tolto accenti, spazi e trattini, da 4 a 8 lettere
const parola = (g) => normale(g.cognome || g.nome.split(" ").slice(-1)[0]).replace(/[^A-Z]/g, "");
const valida = (g) => { const p = parola(g); return p.length >= 4 && p.length <= 8; };

function colori(tentativo, soluzione) {
  const esito = Array(soluzione.length).fill("no");
  const resto = {};
  [...soluzione].forEach((c, i) => { if (tentativo[i] === c) esito[i] = "si"; else resto[c] = (resto[c] || 0) + 1; });
  [...tentativo].forEach((c, i) => { if (esito[i] !== "si" && resto[c]) { esito[i] = "quasi"; resto[c]--; } });
  return esito;
}

async function avvia() {
  const tutti = (await caricaGiocatoriGioco()).filter(valida);
  let modo = "giorno", sol = delGiorno(tutti, 23);
  const chiave = `smash-cognomle-${oggiItalia()}`;
  let tentativi = leggi(chiave, []), attuale = "", messaggio = "";

  const disegna = () => {
    const S = parola(sol), n = S.length;
    const vinto = tentativi.includes(S), finito = vinto || tentativi.length >= MAX;
    const stato = {};
    const peso = { no: 1, quasi: 2, si: 3 };  // sulla tastiera vince il colore migliore visto per quella lettera
    tentativi.forEach((t) => colori(t, S).forEach((c, i) => { if (peso[c] > (peso[stato[t[i]]] || 0)) stato[t[i]] = c; }));
    const righe = [];
    for (let r = 0; r < MAX; r++) {
      const t = tentativi[r] ?? (r === tentativi.length && !finito ? attuale.padEnd(n) : "".padEnd(n));
      const c = tentativi[r] ? colori(t, S) : [];
      righe.push(`<div class="cg-riga" style="grid-template-columns:repeat(${n},1fr)">${[...t].map((ch, i) => `<span class="cg-cella ${c[i] || (ch.trim() ? "piena" : "")}">${esc(ch.trim())}</span>`).join("")}</div>`);
    }
    box.innerHTML = `
      <div class="gioco-testa"><span class="gioco-tag">${modo === "giorno" ? "Cognome del giorno" : "Partita libera"}</span><span class="vite">${n} lettere · ${sol.tour === "atp" ? "uomo" : "donna"}</span></div>
      <div class="cg-griglia" aria-label="Griglia dei tentativi">${righe.join("")}</div>
      <p class="nota cg-msg" aria-live="polite">${esc(messaggio)}</p>
      ${finito ? `<div class="esito ${vinto ? "vinto" : "perso"}"><h2>${vinto ? "Indovinato!" : "Peccato"}</h2>
        <p>Era <a href="giocatore.html?id=${encodeURIComponent(sol.id)}"><b>${esc(sol.nome)}</b></a> (${esc(sol.paeseNome || sol.paese || "")}, N° ${sol.pos} ${sol.tour.toUpperCase()}).</p>
        <div class="esito-azioni">${modo === "giorno" ? `<button type="button" class="pill attiva" id="condividi">Condividi</button>` : ""}<button type="button" class="pill" id="ancora">Gioca ancora (cognome a caso)</button></div></div>`
      : `<div class="cg-tastiera">${RIGHE_TASTI.map((r) => `<div>${[...r].map((k) => `<button type="button" class="cg-tasto ${stato[k] || ""}${k === "⏎" || k === "⌫" ? " largo" : ""}" data-k="${k}" aria-label="${k === "⏎" ? "Invio" : k === "⌫" ? "Cancella" : k}">${k === "⏎" ? "INVIO" : k}</button>`).join("")}</div>`).join("")}</div>`}`;
    if (finito) {
      const grigia = tentativi.map((t) => colori(t, S).map((c) => (c === "si" ? "🟩" : c === "quasi" ? "🟨" : "⬛")).join("")).join("\n");
      document.getElementById("condividi")?.addEventListener("click", (e) => condividi(`Smash Oggi · Cognomle ${oggiItalia()} ${vinto ? tentativi.length : "X"}/${MAX}\n${grigia}`, e.currentTarget));
      document.getElementById("ancora").addEventListener("click", () => { modo = "libero"; sol = tutti[Math.floor(Math.random() * tutti.length)]; tentativi = []; attuale = ""; messaggio = ""; disegna(); });
    }
  };

  const tasto = (k) => {
    const S = parola(sol);
    if (tentativi.includes(S) || tentativi.length >= MAX) return;
    messaggio = "";
    if (k === "⌫") attuale = attuale.slice(0, -1);
    else if (k === "⏎") {
      if (attuale.length < S.length) messaggio = `Servono ${S.length} lettere.`;
      else {
        tentativi.push(attuale); attuale = "";
        if (modo === "giorno") scrivi(chiave, tentativi);
      }
    } else if (/^[A-Z]$/.test(k) && attuale.length < S.length) attuale += k;
    disegna();
  };

  box.addEventListener("click", (e) => { const b = e.target.closest(".cg-tasto"); if (b) tasto(b.dataset.k); });
  document.addEventListener("keydown", (e) => {
    if (e.ctrlKey || e.metaKey || e.altKey || e.target.closest("input, select, textarea")) return;
    if (e.key === "Enter") tasto("⏎"); else if (e.key === "Backspace") tasto("⌫"); else if (/^[a-z]$/i.test(e.key)) tasto(e.key.toUpperCase());
  });
  disegna();
}

avvia().catch((e) => { console.error(e); box.innerHTML = `<div class="vuoto">Non riesco a caricare il gioco. Riprova tra poco.</div>`; });
