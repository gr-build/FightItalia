// Griglia MMA: il Tiki Taka Toe dell'MMA. Tre condizioni sulle righe, tre
// sulle colonne: in ogni casella va un lottatore UFC che le rispetta tutte e
// due. Tre modi:
//   - giorno:       la griglia del giorno, uguale per tutti, 9 tentativi
//   - sfida:        due giocatori sullo stesso telefono, tris come Tiki Taka Toe
//   - allenamento:  griglie casuali senza limiti
// I dati (data/griglia.json) li prepara build_griglia.py.

import { renderChrome, fetchJSON, SOCIAL } from "./common.js?v=202609261139";
import { leggi, scrivi, iniziali, casualeConSeme, oggiItalia, condividi, SITO } from "./giochi-comuni.js?v=202609261139";

renderChrome("giochi");

const TENTATIVI = 9;
const INIZIO = "2026-09-25"; // griglia #1
const PREFISSO_FOTO = "https://upload.wikimedia.org/wikipedia/commons/thumb/";
const FAMIGLIE = {
  paese: "Nazionalità", divisione: "Categoria", titolo: "Titolo", numeri: "Numeri", bonus: "Bonus",
  org: "Ha lottato in", luogo: "Ha lottato in", avversario: "Ha affrontato", epoca: "Epoca", stile: "Stile",
};
// Nelle intestazioni la famiglia dice gia' "Ha affrontato"/"Ha lottato in":
// il testo si accorcia per stare nelle caselle del telefono.
const breve = (c) => c.t.replace(/^Ha (affrontato|combattuto (in|nel|negli|nei|a)|partecipato a) /, "");
// Famiglie che non si incrociano con se stesse (nessuno e' di due paesi o epoche).
const ESCLUSIVE = new Set(["paese", "epoca"]);
const LINEE = [[0, 1, 2], [3, 4, 5], [6, 7, 8], [0, 3, 6], [1, 4, 7], [2, 5, 8], [0, 4, 8], [2, 4, 6]];

const box = document.getElementById("griglia");
const params = new URLSearchParams(location.search);
let modo = ["sfida", "allenamento"].includes(params.get("modo")) ? params.get("modo") : "giorno";
// Sfida con link: ?s=<6 id delle condizioni separati da ~>&p=<indovinate>-<rarita'>
// L'amico gioca la stessa griglia e vede il punteggio da battere. Niente server:
// la griglia sta tutta nel link.
let sfidaLink = params.get("s") ? { ids: params.get("s").split("~"), punti: (params.get("p") || "").split("-").map(Number) } : null;

const normalizza = (t) => t.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
const numeroGriglia = (oggi) => Math.round((Date.parse(oggi) - Date.parse(INIZIO)) / 86400000) + 1;

function semeDaTesto(t) {
  let h = 2166136261;
  for (const c of t) h = Math.imul(h ^ c.charCodeAt(0), 16777619);
  return h >>> 0;
}

// ------------------------------------------------------------ generatore

// facile: solo condizioni conosciute (notorieta' 2-3, le 3 piu' spesso).
function creaGriglia(dati, rnd, minimo, facile) {
  const cond = dati.c;
  const insiemi = cond.map((c) => new Set(c.m));
  const pesi = cond.map((c) => (facile ? [0, 0, 1, 4][c.p || 2] : [0, 1, 2, 3][c.p || 2]));
  const totale = pesi.reduce((a, b) => a + b, 0);
  const scegli = () => {
    let x = rnd() * totale;
    for (let i = 0; i < pesi.length; i++) {
      x -= pesi[i];
      if (x < 0) return i;
    }
    return pesi.length - 1;
  };
  for (let prova = 0; prova < 6000; prova++) {
    const idx = [];
    while (idx.length < 6) {
      const i = scegli();
      if (!idx.includes(i)) idx.push(i);
    }
    const righe = idx.slice(0, 3);
    const colonne = idx.slice(3);
    const fam = (i) => cond[i].f;
    // varieta': niente due righe (o due colonne) della stessa famiglia
    if (new Set(righe.map(fam)).size < 3 || new Set(colonne.map(fam)).size < 3) continue;
    if (righe.some((r) => colonne.some((c) => fam(r) === fam(c) && ESCLUSIVE.has(fam(r))))) continue;
    const celle = [];
    let ok = true;
    for (const r of righe) {
      for (const c of colonne) {
        const [a, b] = insiemi[r].size < insiemi[c].size ? [r, c] : [c, r];
        const dentro = cond[a].m.filter((x) => insiemi[b].has(x));
        if (dentro.length < minimo) {
          ok = false;
          break;
        }
        celle.push(dentro);
      }
      if (!ok) break;
    }
    if (!ok) continue;
    // difficolta': qualche casella difficile, nessuna regalata
    const difficili = celle.filter((c) => c.length <= 12).length;
    const facili = celle.filter((c) => c.length > 150).length;
    if ((facile ? difficili > 3 : difficili < 1 || difficili > 5) || facili > 1) continue;
    return { righe: righe.map((i) => cond[i]), colonne: colonne.map((i) => cond[i]), celle: celle.map((c) => new Set(c)) };
  }
  return null;
}

function grigliaDaId(dati, ids) {
  const cond = ids.map((id) => dati.c.find((c) => c.id === id));
  if (cond.some((c) => !c)) return null;
  const righe = cond.slice(0, 3);
  const colonne = cond.slice(3);
  const celle = [];
  for (const r of righe) {
    const dentro = new Set(r.m);
    for (const c of colonne) celle.push(new Set(c.m.filter((x) => dentro.has(x))));
  }
  return { righe, colonne, celle };
}

// -------------------------------------------------------------- disegno

function intestazione(c) {
  const icona = c.b ? `<img class="bandiera grande" src="https://flagcdn.com/w80/${c.b}.png" alt="" width="36" height="27">` : "";
  return `<span class="gr-fam">${FAMIGLIE[c.f] || ""}</span>${icona}<span class="gr-cond">${breve(c)}</span>`;
}

function fotoDi(dati, id) {
  const f = dati.l[id][2];
  return !f ? "" : f.startsWith("http") ? f : PREFISSO_FOTO + f; // ESPN: indirizzo completo
}

function avatar(dati, id, classe = "gr-av") {
  const f = fotoDi(dati, id);
  const nome = dati.l[id][0];
  return f
    ? `<img class="${classe}${f.includes("espncdn.com") ? " foto-bianca" : ""}" src="${f}" alt="" loading="lazy" onerror="this.replaceWith(Object.assign(document.createElement('span'),{className:'${classe} vuoto',textContent:'${iniziali(nome).replace(/'/g, "")}'}))">`
    : `<span class="${classe} vuoto">${iniziali(nome)}</span>`;
}

// Rarita' di una risposta: quanta parte delle risposte possibili ha fatto
// piu' incontri UFC (piu' incontri = piu' famoso = scelta piu' comune).
function rarita(dati, cella, id) {
  const mio = dati.u[id];
  let piuFamosi = 0;
  for (const x of cella) if (dati.u[x] > mio) piuFamosi++;
  return Math.round((100 * piuFamosi) / Math.max(1, cella.size - 1));
}

function esempi(dati, cella, quanti = 3) {
  return [...cella].sort((a, b) => dati.u[b] - dati.u[a]).slice(0, quanti).map((x) => dati.l[x][0]);
}

// -------------------------------------------------------------- partita

async function init() {
  const dati = await fetchJSON("data/griglia.json");
  const perNome = new Map(dati.l.map((x, i) => [x[0].toLowerCase(), i]));
  const indice = dati.l.map((x, i) => ({ i, chiave: normalizza(x[0]) }));
  const oggi = oggiItalia();
  const numero = numeroGriglia(oggi);

  box.innerHTML = `
    <div class="gr-modi" role="tablist" aria-label="Modalità">
      <button type="button" role="tab" data-modo="giorno">Griglia del giorno</button>
      <button type="button" role="tab" data-modo="sfida">Sfida a 2</button>
      <button type="button" role="tab" data-modo="allenamento">Allenamento</button>
    </div>
    <div id="gr-partita"></div>
    <dialog class="gr-dialog" id="gr-dialog" aria-labelledby="gr-d-titolo">
      <form method="dialog" class="gr-d-box" id="gr-form" autocomplete="off">
        <div class="gr-d-titolo" id="gr-d-titolo"></div>
        <div class="ac">
          <label for="gr-input" class="sr-only">Nome del lottatore</label>
          <input id="gr-input" placeholder="Scrivi il nome del lottatore…" role="combobox" aria-autocomplete="list" aria-expanded="false" aria-controls="gr-lista">
          <ul class="ac-lista" id="gr-lista" role="listbox" hidden></ul>
        </div>
        <p class="chie-msg" id="gr-msg" role="status"></p>
        <div class="gr-d-azioni">
          <button type="button" class="btn-gioco secondario" id="gr-annulla">Annulla</button>
          <button type="submit" class="btn-gioco" id="gr-conferma">Conferma</button>
        </div>
      </form>
    </dialog>`;

  const dialog = document.getElementById("gr-dialog");
  const input = document.getElementById("gr-input");
  const lista = document.getElementById("gr-lista");
  const msg = document.getElementById("gr-msg");
  const partita = document.getElementById("gr-partita");
  let proposte = [];
  let attiva = -1;
  let suScelta = null; // callback(id) quando si conferma un nome
  let usati = new Set();
  let fermaTimer = () => {}; // il cronometro della sfida va fermato cambiando modo

  // ---- menu a tendina (solo nomi: foto o paese darebbero la risposta)
  function voce(i, k) {
    return `<li role="option" id="gr-ac-${k}" class="${k === attiva ? "attiva" : ""}" data-k="${k}" aria-selected="${k === attiva}">
      <span class="ac-testo"><span class="ac-nome">${dati.l[i][0]}</span></span></li>`;
  }
  function mostraProposte() {
    const q = normalizza(input.value.trim());
    proposte = q.length < 2 ? [] : indice
      .filter(({ i, chiave }) => !usati.has(i) && (chiave.split(/\s+/).some((p) => p.startsWith(q)) || (q.length > 2 && chiave.includes(q))))
      .slice(0, 8)
      .map(({ i }) => i);
    attiva = proposte.length ? 0 : -1;
    lista.innerHTML = proposte.map(voce).join("");
    lista.hidden = !proposte.length;
    input.setAttribute("aria-expanded", String(!!proposte.length));
  }
  input.addEventListener("input", mostraProposte);
  input.addEventListener("keydown", (e) => {
    if (lista.hidden) return;
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      attiva = (attiva + (e.key === "ArrowDown" ? 1 : -1) + proposte.length) % proposte.length;
      lista.innerHTML = proposte.map(voce).join("");
      input.setAttribute("aria-activedescendant", `gr-ac-${attiva}`);
    } else if (e.key === "Enter" && attiva >= 0) {
      e.preventDefault();
      input.value = dati.l[proposte[attiva]][0];
      lista.hidden = true;
      conferma();
    }
  });
  lista.addEventListener("mousedown", (e) => {
    const li = e.target.closest("li[data-k]");
    if (!li) return;
    e.preventDefault();
    input.value = dati.l[proposte[Number(li.dataset.k)]][0];
    lista.hidden = true;
    conferma();
  });
  function conferma() {
    const id = perNome.get(input.value.trim().toLowerCase());
    if (id === undefined) {
      msg.textContent = "Scegli un nome dall'elenco dei suggerimenti.";
      return;
    }
    if (usati.has(id)) {
      msg.textContent = `${dati.l[id][0]} è già nella griglia.`;
      return;
    }
    suScelta?.(id);
  }
  document.getElementById("gr-form").addEventListener("submit", (e) => {
    e.preventDefault();
    conferma();
  });
  document.getElementById("gr-annulla").addEventListener("click", () => dialog.close());
  dialog.addEventListener("close", () => {
    suScelta = null;
    lista.hidden = true;
  });

  function apriDialog(riga, colonna, sotto, callback) {
    document.getElementById("gr-d-titolo").innerHTML = `
      <div class="gr-d-cond">${intestazione(riga)}</div><span class="gr-per">×</span><div class="gr-d-cond">${intestazione(colonna)}</div>
      ${sotto ? `<div class="gr-d-sotto">${sotto}</div>` : ""}`;
    input.value = "";
    msg.textContent = "";
    lista.hidden = true;
    suScelta = callback;
    dialog.showModal();
    input.focus();
  }

  function motivo(griglia, k, id) {
    const r = griglia.righe[Math.floor(k / 3)];
    const c = griglia.colonne[k % 3];
    const manca = [r, c].filter((x) => !x.m.includes(id)).map((x) => `«${x.t}»`);
    return `No: ${dati.l[id][0]} non rispetta ${manca.join(" e ")}.`;
  }

  // ---- disegno della griglia (comune ai tre modi)
  function tabellone(griglia, contenuto, cliccabile) {
    const celle = [];
    for (let k = 0; k < 9; k++) {
      const c = contenuto(k);
      celle.push(`<button type="button" class="gr-cella ${c.classe || ""}" data-k="${k}" ${cliccabile(k) ? "" : "disabled"} aria-label="${griglia.righe[Math.floor(k / 3)].t} e ${griglia.colonne[k % 3].t}">${c.html}</button>`);
    }
    return `<div class="gr-tab">
      <div class="gr-angolo"><img src="img/logo-128.png?v=2" alt="" width="54" height="54"></div>
      ${griglia.colonne.map((c) => `<div class="gr-int gr-col">${intestazione(c)}</div>`).join("")}
      ${[0, 1, 2].map((r) => `<div class="gr-int gr-riga">${intestazione(griglia.righe[r])}</div>${celle.slice(r * 3, r * 3 + 3).join("")}`).join("")}
    </div>`;
  }

  function cellaPiena(id, extra = "") {
    return `${avatar(dati, id)}<span class="gr-nome">${dati.l[id][0]}</span>${extra}`;
  }

  // ================================================== modo giorno / allenamento
  function giocaSolo(allenamento, sfida = null) {
    const rnd = casualeConSeme(allenamento ? Math.floor(Math.random() * 2 ** 31) : semeDaTesto(`griglia-${oggi}`));
    // la griglia del giorno e' fissata in anticipo da build_griglia.py (campo g)
    const delGiorno = dati.g && dati.g[oggi];
    const daLink = sfida ? grigliaDaId(dati, sfida.ids) : null;
    if (sfida && !daLink) sfida = null; // link rotto o condizioni cambiate: si gioca la griglia normale
    // il link con la griglia di oggi vale come griglia del giorno
    if (sfida && delGiorno && sfida.ids.join(",") === delGiorno.join(",")) allenamento = false;
    else if (sfida) allenamento = true;
    const fissata = !allenamento && delGiorno ? grigliaDaId(dati, delGiorno) : null;
    const griglia = daLink || fissata || creaGriglia(dati, rnd, allenamento ? 3 : 4, !allenamento);
    const firma = [...griglia.righe, ...griglia.colonne].map((c) => c.id).join(",");
    // le griglie arrivate da un link si ricordano anche in allenamento
    const chiave = allenamento && sfida ? `griglia-link-${semeDaTesto(firma)}` : `griglia-${oggi}`;
    const salvaSempre = !allenamento || !!sfida;
    const salvato = salvaSempre && leggi(chiave, null);
    const stato = salvato && salvato.firma === firma ? salvato : { firma, celle: {}, usati: 0, finito: false };
    const aggiornaUsati = () => (usati = new Set(Object.values(stato.celle)));

    function salva() {
      if (salvaSempre) scrivi(chiave, stato);
    }

    function disegna() {
      aggiornaUsati();
      const rimasti = TENTATIVI - stato.usati;
      const indovinate = Object.keys(stato.celle).length;
      if (!stato.finito && (rimasti <= 0 || indovinate === 9)) {
        stato.finito = true;
        salva();
        if (!allenamento) aggiornaSerie(indovinate);
      }
      const punti = Object.entries(stato.celle).reduce((s, [k, id]) => s + rarita(dati, griglia.celle[k], id), 0);
      const [amicoN, amicoR] = sfida ? sfida.punti : [];
      partita.innerHTML = `
        ${sfida && Number.isFinite(amicoN) ? `<div class="gr-sfida-banner">🥊 Un amico ti sfida: ha fatto <b>${amicoN}/9</b>${Number.isFinite(amicoR) ? ` con rarità <b>${amicoR}</b>` : ""}. Riesci a fare meglio?</div>` : ""}
        <div class="gr-barra">
          <div><b>${allenamento ? (sfida ? "Griglia della sfida" : "Allenamento") : `Griglia #${numero}`}</b> · ${indovinate}/9</div>
          <div class="gr-tentativi" aria-label="Tentativi rimasti">${"●".repeat(Math.max(0, rimasti))}${"○".repeat(Math.min(TENTATIVI, stato.usati))} <span>${Math.max(0, rimasti)} tentativi</span></div>
        </div>
        ${tabellone(griglia, (k) => {
          const id = stato.celle[k];
          if (id !== undefined) {
            const r = rarita(dati, griglia.celle[k], id);
            return { classe: "piena", html: cellaPiena(id, `<span class="gr-rar ${r >= 70 ? "alta" : ""}">rarità ${r}%</span>`) };
          }
          if (stato.finito) {
            return { classe: "vuota fine", html: `<span class="gr-poss">${griglia.celle[k].size} possibili</span><span class="gr-es">${esempi(dati, griglia.celle[k], 2).join("<br>")}</span>` };
          }
          return { classe: "vuota", html: `<span class="gr-piu">+</span><span class="gr-poss">${griglia.celle[k].size} possibili</span>` };
        }, (k) => !stato.finito && stato.celle[k] === undefined)}
        <div id="gr-fine"></div>
        <p class="chie-legenda">Tocca una casella e scrivi un lottatore UFC che rispetta la riga e la colonna. Ogni lottatore si usa una volta sola. Ogni risposta, giusta o sbagliata, consuma un tentativo. <b>Rarità</b>: più è alta, meno è ovvia la tua scelta.</p>`;

      partita.querySelectorAll(".gr-cella:not([disabled])").forEach((b) =>
        b.addEventListener("click", () => {
          const k = Number(b.dataset.k);
          apriDialog(griglia.righe[Math.floor(k / 3)], griglia.colonne[k % 3], `Tentativi rimasti: ${TENTATIVI - stato.usati}`, (id) => {
            stato.usati++;
            if (griglia.celle[k].has(id)) {
              stato.celle[k] = id;
              salva();
              dialog.close();
              disegna();
            } else {
              salva();
              msg.textContent = motivo(griglia, k, id);
              input.value = "";
              document.querySelector(".gr-d-sotto").textContent = `Tentativi rimasti: ${TENTATIVI - stato.usati}`;
              if (stato.usati >= TENTATIVI) {
                setTimeout(() => dialog.close(), 1400);
                disegna();
              }
            }
          });
        })
      );

      if (stato.finito) {
        const quadrati = [0, 1, 2].map((r) => [0, 1, 2].map((c) => (stato.celle[r * 3 + c] !== undefined ? "🟩" : "⬛")).join("")).join("\n");
        const link = `${SITO}griglia.html?s=${encodeURIComponent(firma.split(",").join("~"))}&p=${indovinate}-${punti}`;
        const testo = `MMA Oggi · Griglia ${allenamento ? "(allenamento)" : `#${numero}`} · ${indovinate}/9\n${quadrati}\nRarità: ${punti}\n${SITO}griglia.html`;
        const testoSfida = `Ho fatto ${indovinate}/9 alla Griglia MMA${allenamento ? "" : ` #${numero}`} (rarità ${punti}). Riesci a battermi? 🥊\n${link}`;
        let confronto = "";
        if (sfida && Number.isFinite(amicoN)) {
          const meglio = indovinate > amicoN || (indovinate === amicoN && punti > (amicoR || 0));
          const pari = indovinate === amicoN && punti === (amicoR || 0);
          confronto = `<div class="chie-fine-sub gr-confronto">Tu ${indovinate}/9 · rarità ${punti} — Amico ${amicoN}/9${Number.isFinite(amicoR) ? ` · rarità ${amicoR}` : ""}<br><b>${pari ? "Pareggio!" : meglio ? "Hai vinto la sfida!" : "Ha vinto il tuo amico"}</b></div>`;
        }
        const serie = allenamento ? null : leggi("griglia-serie", { attuale: 0, migliore: 0 });
        document.getElementById("gr-fine").innerHTML = `
          <div class="chie-fine ${indovinate >= 6 ? "vinto" : "perso"}">
            <div class="chie-fine-titolo">${indovinate === 9 ? "Griglia completa!" : "Fine dei tentativi"}</div>
            <div class="chie-fine-nome">${indovinate}/9 · rarità ${punti}</div>
            ${confronto}
            ${serie ? `<div class="chie-fine-sub">Serie di griglie complete: ${serie.attuale} · Migliore: ${serie.migliore}</div>` : ""}
            <div class="finale-azioni">
              <button type="button" class="btn-gioco" id="gr-sfida-link">Sfida un amico con un link</button>
              <button type="button" class="btn-gioco secondario" id="gr-condividi">Condividi il risultato</button>
              ${allenamento ? `<button type="button" class="btn-gioco secondario" id="gr-nuova">Nuova griglia</button>` : `<a class="btn-gioco secondario" href="griglia.html?modo=sfida">Gioca a 2 sullo stesso telefono</a>`}
            </div>
            ${allenamento ? "" : `<p class="chie-fine-sub">Nuova griglia domani a mezzanotte.</p>`}
            <p class="gr-whatsapp">Ogni mattina la griglia nuova sul <a href="${SOCIAL[0].url}" target="_blank" rel="noopener">canale WhatsApp di MMA Oggi</a></p>
          </div>`;
        document.getElementById("gr-condividi").addEventListener("click", (e) => condividi(testo, e.currentTarget));
        document.getElementById("gr-sfida-link").addEventListener("click", (e) => condividi(testoSfida, e.currentTarget));
        document.getElementById("gr-nuova")?.addEventListener("click", () => giocaSolo(true, null));
      } else if (allenamento) {
        document.getElementById("gr-fine").innerHTML = `<div class="finale-azioni"><button type="button" class="btn-gioco secondario" id="gr-nuova">Nuova griglia</button></div>`;
        document.getElementById("gr-nuova").addEventListener("click", () => giocaSolo(true, null));
      }
    }

    function aggiornaSerie(indovinate) {
      const serie = leggi("griglia-serie", { attuale: 0, migliore: 0, ultimo: null });
      if (serie.ultimo === oggi) return;
      const ieri = new Date(Date.parse(oggi) - 86400000).toISOString().slice(0, 10);
      serie.attuale = indovinate === 9 ? (serie.ultimo === ieri ? serie.attuale + 1 : 1) : 0;
      serie.migliore = Math.max(serie.migliore, serie.attuale);
      serie.ultimo = oggi;
      scrivi("griglia-serie", serie);
    }

    disegna();
  }

  // ======================================================== modo sfida a 2
  function giocaSfida() {
    const opzioni = leggi("griglia-sfida-opzioni", { tempo: 30, ruba: true });
    let griglia, celle, turno, vincitore, tempo, timer, fine, passiDiFila;
    const GIOCATORI = [{ nome: "Rosso", classe: "g1", simbolo: "✕" }, { nome: "Oro", classe: "g2", simbolo: "◯" }];

    fermaTimer = () => clearInterval(timer);

    function nuova() {
      griglia = creaGriglia(dati, Math.random, 4, true);
      celle = Array(9).fill(null); // {g, id}
      turno = Math.random() < 0.5 ? 0 : 1;
      vincitore = null;
      fine = false;
      passiDiFila = 0;
      avviaTempo();
      disegna();
    }

    function avviaTempo() {
      clearInterval(timer);
      tempo = opzioni.tempo;
      if (!tempo || fine) return;
      timer = setInterval(() => {
        tempo--;
        const t = document.getElementById("gr-tempo");
        if (t) t.textContent = `${tempo}s`;
        if (tempo <= 0) {
          if (dialog.open) dialog.close();
          cambiaTurno(true);
        }
      }, 1000);
    }

    function cambiaTurno(passato) {
      passiDiFila = passato ? passiDiFila + 1 : 0;
      turno = 1 - turno;
      if (passiDiFila >= 4) {
        // quattro turni a vuoto di fila: nessuno trova piu' niente
        fine = true;
        clearInterval(timer);
      }
      avviaTempo();
      disegna();
    }

    function controlla() {
      for (const linea of LINEE) {
        const [a, b, c] = linea.map((k) => celle[k]);
        if (a && b && c && a.g === b.g && b.g === c.g) return { g: a.g, linea };
      }
      return null;
    }

    function disegna() {
      usati = new Set(celle.filter(Boolean).map((c) => c.id));
      const vinta = controlla();
      if (vinta && !fine) {
        fine = true;
        vincitore = vinta;
        clearInterval(timer);
      }
      if (!fine && celle.every(Boolean)) {
        fine = true;
        clearInterval(timer);
      }
      const g = GIOCATORI[turno];
      const punteggi = GIOCATORI.map((_, i) => celle.filter((c) => c && c.g === i).length);
      partita.innerHTML = `
        <div class="gr-sfida-top">
          <div class="gr-giocatore g1 ${!fine && turno === 0 ? "attivo" : ""}"><span>✕</span> Rosso · ${punteggi[0]}</div>
          <div class="gr-turno">${fine ? (vincitore ? `Vince <b>${GIOCATORI[vincitore.g].nome}</b>!` : "Pareggio") : `Tocca a <b class="${g.classe}">${g.nome}</b>${opzioni.tempo ? ` · <span id="gr-tempo">${tempo}s</span>` : ""}`}</div>
          <div class="gr-giocatore g2 ${!fine && turno === 1 ? "attivo" : ""}">Oro · ${punteggi[1]} <span>◯</span></div>
        </div>
        ${tabellone(griglia, (k) => {
          const c = celle[k];
          const inLinea = vincitore && vincitore.linea.includes(k);
          if (c) return { classe: `piena ${GIOCATORI[c.g].classe} ${inLinea ? "linea" : ""}`, html: `<span class="gr-segno">${GIOCATORI[c.g].simbolo}</span>${cellaPiena(c.id)}` };
          if (fine) return { classe: "vuota fine", html: `<span class="gr-es">${esempi(dati, griglia.celle[k], 2).join("<br>")}</span>` };
          return { classe: "vuota", html: `<span class="gr-piu">+</span>` };
        }, (k) => !fine && (!celle[k] || (opzioni.ruba && celle[k].g !== turno && !vincitore)))}
        <div class="finale-azioni gr-azioni">
          ${fine ? `<button type="button" class="btn-gioco" id="gr-rivincita">Rivincita</button>` : `<button type="button" class="btn-gioco secondario" id="gr-passa">Passa il turno</button>`}
          <button type="button" class="btn-gioco secondario" id="gr-nuova">Nuova griglia</button>
        </div>
        <div class="gr-opzioni">
          <label>Tempo per turno
            <select id="gr-opt-tempo">${[0, 20, 30, 60].map((s) => `<option value="${s}" ${opzioni.tempo === s ? "selected" : ""}>${s ? `${s} secondi` : "Nessun limite"}</option>`).join("")}</select>
          </label>
          <label><input type="checkbox" id="gr-opt-ruba" ${opzioni.ruba ? "checked" : ""}> Si possono rubare le caselle</label>
        </div>
        <p class="chie-legenda">Passatevi il telefono. A turno scegliete una casella e scrivete un lottatore che rispetta riga e colonna: se è giusto la casella è vostra, se è sbagliato il turno passa. Vince chi fa tris. ${opzioni.ruba ? "Una casella dell'avversario si può rubare scrivendo un altro lottatore giusto." : ""}</p>`;

      partita.querySelectorAll(".gr-cella:not([disabled])").forEach((b) =>
        b.addEventListener("click", () => {
          const k = Number(b.dataset.k);
          apriDialog(griglia.righe[Math.floor(k / 3)], griglia.colonne[k % 3], `Tocca a ${GIOCATORI[turno].nome}${celle[k] ? " · stai rubando la casella" : ""}`, (id) => {
            if (griglia.celle[k].has(id)) {
              celle[k] = { g: turno, id };
              dialog.close();
              cambiaTurno(false);
            } else {
              msg.textContent = motivo(griglia, k, id);
              setTimeout(() => {
                if (dialog.open) dialog.close();
                cambiaTurno(false);
              }, 1500);
            }
          });
        })
      );
      document.getElementById("gr-passa")?.addEventListener("click", () => cambiaTurno(true));
      document.getElementById("gr-rivincita")?.addEventListener("click", nuova);
      document.getElementById("gr-nuova").addEventListener("click", nuova);
      document.getElementById("gr-opt-tempo").addEventListener("change", (e) => {
        opzioni.tempo = Number(e.target.value);
        scrivi("griglia-sfida-opzioni", opzioni);
        avviaTempo();
        disegna();
      });
      document.getElementById("gr-opt-ruba").addEventListener("change", (e) => {
        opzioni.ruba = e.target.checked;
        scrivi("griglia-sfida-opzioni", opzioni);
        disegna();
      });
    }

    nuova();
  }

  // ------------------------------------------------------------ cambio modo
  function avvia() {
    fermaTimer();
    if (dialog.open) dialog.close();
    box.querySelectorAll(".gr-modi button").forEach((b) => b.setAttribute("aria-selected", String(b.dataset.modo === modo)));
    if (modo === "sfida") giocaSfida();
    else giocaSolo(modo === "allenamento", sfidaLink);
  }
  box.querySelectorAll(".gr-modi button").forEach((b) =>
    b.addEventListener("click", () => {
      modo = b.dataset.modo;
      sfidaLink = null; // cambiando modo si lascia la griglia del link
      history.replaceState(null, "", modo === "giorno" ? "griglia.html" : `griglia.html?modo=${modo}`);
      avvia();
    })
  );
  avvia();
}

init().catch((e) => {
  console.error(e);
  box.innerHTML = `<div class="empty-state">Non riesco a caricare il gioco. Riprova tra poco.</div>`;
});
