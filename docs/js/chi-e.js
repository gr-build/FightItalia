// "Chi e'?" — il lottatore UFC del giorno. Foto pixelata che si schiarisce a
// ogni errore (come nei giochi calcistici tipo Tiki-Taka-Toe/Who Are Ya) e
// ultimi incontri svelati uno alla volta come indizi.

import { renderChrome } from "./common.js?v=202609241256";
import { caricaLottatori, leggi, scrivi, iniziali, casualeConSeme, oggiItalia, condividi, SITO, bandiera, genere } from "./giochi-comuni.js?v=202609241256";

renderChrome("giochi");

const TENTATIVI = 8;
// Lato in blocchi della foto per numero di errori: 5x5 all'inizio, poi
// sempre piu' fine. L'ultimo livello (0) e' la foto nitida.
const PIXEL = [5, 7, 10, 14, 19, 26, 36, 52];
const INIZIO = "2026-09-25"; // giorno #1

const box = document.getElementById("chie");
const params = new URLSearchParams(location.search);
const libero = params.has("libero");

function numeroGiorno(oggi) {
  return Math.round((Date.parse(oggi) - Date.parse(INIZIO)) / 86400000) + 1;
}

// Lottatore del giorno: pool mescolato una volta con seme fisso, poi uno al
// giorno in ordine. Tutti vedono lo stesso lottatore nello stesso giorno.
function lottatoreDelGiorno(pool, n) {
  const ordinati = [...pool].sort((a, b) => a.s.localeCompare(b.s));
  const rnd = casualeConSeme(20270613);
  for (let i = ordinati.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [ordinati[i], ordinati[j]] = [ordinati[j], ordinati[i]];
  }
  const idx = (((n - 1) % ordinati.length) + ordinati.length) % ordinati.length;
  return ordinati[idx];
}

// ---------- foto pixelata ----------
let immagine = null;
function caricaFoto(url) {
  return new Promise((ok) => {
    const img = new Image();
    img.onload = () => ok(img);
    img.onerror = () => ok(null);
    img.src = url;
  });
}

function disegna(canvas, img, blocchi, nome) {
  const ctx = canvas.getContext("2d");
  const L = canvas.width;
  ctx.fillStyle = "#16161c";
  ctx.fillRect(0, 0, L, L);
  if (!img) {
    ctx.fillStyle = "#2a2a33";
    ctx.font = `600 ${L / 3}px Oswald, sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(blocchi ? "?" : iniziali(nome), L / 2, L / 2);
    return;
  }
  // Ritaglio quadrato in alto (le foto Wikipedia sono spesso a mezzo busto).
  const lato = Math.min(img.naturalWidth, img.naturalHeight);
  const sx = (img.naturalWidth - lato) / 2;
  const sy = img.naturalHeight > img.naturalWidth ? Math.min((img.naturalHeight - lato) * 0.15, img.naturalHeight - lato) : 0;
  if (!blocchi) {
    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(img, sx, sy, lato, lato, 0, 0, L, L);
    return;
  }
  const piccolo = document.createElement("canvas");
  piccolo.width = piccolo.height = blocchi;
  const pctx = piccolo.getContext("2d");
  pctx.drawImage(img, sx, sy, lato, lato, 0, 0, blocchi, blocchi);
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(piccolo, 0, 0, blocchi, blocchi, 0, 0, L, L);
}

// ---------- confronto tentativo ----------
function freccia(tentativo, segreto, tolleranza) {
  if (tentativo == null || segreto == null) return { cls: "na", txt: "—" };
  if (tentativo === segreto) return { cls: "ok", txt: `${tentativo}` };
  const vicino = Math.abs(tentativo - segreto) <= tolleranza;
  return { cls: vicino ? "vicino" : "no", txt: `${tentativo} ${tentativo < segreto ? "↑" : "↓"}` };
}

function rigaTentativo(t, s) {
  const cat = t.c === s.c && t.g === s.g ? "ok" : t.g === s.g ? "vicino" : "no";
  const paese = t.p && t.p === s.p ? "ok" : "no";
  const eta = freccia(t.e, s.e, 2);
  const alt = freccia(t.h && Math.round(t.h), s.h && Math.round(s.h), 3);
  const vit = freccia(t.v, s.v, 3);
  return `
    <div class="tent-riga${t.s === s.s ? " vinto" : ""}">
      <div class="tent-nome">${t.n}</div>
      <div class="tent-cella ${cat}"><span class="k">Categoria</span>${t.c}${t.g === "F" ? " (F)" : ""}</div>
      <div class="tent-cella ${paese}"><span class="k">Paese</span>${bandiera(t.b)} ${t.p || "—"}</div>
      <div class="tent-cella ${eta.cls}"><span class="k">Età</span>${eta.txt}</div>
      <div class="tent-cella ${alt.cls}"><span class="k">Altezza</span>${alt.txt}</div>
      <div class="tent-cella ${vit.cls}"><span class="k">Vittorie</span>${vit.txt}</div>
    </div>`;
}

// Indizi svelati in base agli errori: ultimi incontri uno alla volta, poi
// paese e categoria.
function indizi(s, errori, finito) {
  const quanti = finito ? 5 : Math.min(1 + errori, 5);
  const esito = { V: ["V", "win"], S: ["S", "loss"], P: ["P", "draw"], NC: ["NC", "draw"] };
  const incontri = s.u.slice(0, quanti).map(([e, avv, metodo, evento]) => {
    const [lettera, cls] = esito[e] || ["?", "draw"];
    return `<li><span class="esito ${cls}">${lettera}</span><span class="avv">vs ${avv}</span><span class="met">${metodo}${evento ? ` · ${evento}` : ""}</span></li>`;
  });
  const nascosti = Math.max(0, Math.min(5, s.u.length) - quanti);
  for (let i = 0; i < nascosti; i++) incontri.push(`<li class="nascosto"><span class="esito">?</span><span class="avv">Indizio al prossimo errore</span></li>`);
  const extra = [];
  if (finito || errori >= 5) extra.push(`<div class="indizio-extra"><span class="k">Paese di nascita</span>${bandiera(s.b)} ${s.p || "—"}</div>`);
  if (finito || errori >= 6) extra.push(`<div class="indizio-extra"><span class="k">Categoria</span>${s.c}${s.g === "F" ? " femminile" : ""}</div>`);
  if (finito || errori >= 7) extra.push(`<div class="indizio-extra"><span class="k">Record</span>${s.v}–${s.l}</div>`);
  return `
    <div class="indizi">
      <div class="indizi-titolo">Ultimi incontri</div>
      <ul class="storico-indizi">${incontri.join("") || "<li>Nessun incontro in archivio</li>"}</ul>
      ${extra.join("")}
    </div>`;
}

function quadratini(tentativi, segreto) {
  return tentativi.map((t) => (t.s === segreto.s ? "🟩" : t.c === segreto.c && t.g === segreto.g ? "🟨" : "🟥")).join("");
}

async function init() {
  const tutti = await caricaLottatori();
  const pool = tutti.filter((x) => x.f && x.v + x.l >= 8 && x.u.length >= 3);
  const oggi = oggiItalia();
  const n = numeroGiorno(oggi);
  const segreto = libero ? pool[Math.floor(Math.random() * pool.length)] : lottatoreDelGiorno(pool, n);
  const chiave = `chie-${oggi}`;
  const perSlug = new Map(tutti.map((x) => [x.s, x]));
  let tentativi = libero ? [] : (leggi(chiave, []) || []).map((s) => perSlug.get(s)).filter(Boolean);

  immagine = await caricaFoto(segreto.f);

  box.innerHTML = `
    <div class="chie-top">
      <div class="chie-foto">
        <canvas id="foto" width="320" height="320" aria-label="Foto del lottatore da indovinare"></canvas>
        <div class="chie-contatore" id="contatore"></div>
      </div>
      <div id="indizi"></div>
    </div>
    <form class="chie-form" id="form" autocomplete="off">
      <label for="tentativo" class="sr-only">Nome del lottatore</label>
      <div class="ac">
        <input id="tentativo" placeholder="Scrivi il nome del lottatore…" role="combobox" aria-autocomplete="list" aria-expanded="false" aria-controls="ac-lista" required>
        <ul class="ac-lista" id="ac-lista" role="listbox" hidden></ul>
      </div>
      <button type="submit" class="btn-gioco">Prova</button>
    </form>
    <p class="chie-msg" id="msg" role="status"></p>
    <div id="fine"></div>
    <div class="tent-lista" id="lista"></div>
    <p class="chie-legenda"><span class="ok">■</span> giusto <span class="vicino">■</span> vicino (stessa divisione, ±2 anni, ±3 cm, ±3 vittorie) <span class="no">■</span> sbagliato · ↑↓ il lottatore segreto ha di più / di meno</p>`;

  const canvas = document.getElementById("foto");
  const form = document.getElementById("form");
  const input = document.getElementById("tentativo");
  const msg = document.getElementById("msg");

  function aggiorna() {
    const vinto = tentativi.some((t) => t.s === segreto.s);
    const errori = tentativi.filter((t) => t.s !== segreto.s).length;
    const finito = vinto || tentativi.length >= TENTATIVI;
    disegna(canvas, immagine, finito ? 0 : PIXEL[Math.min(errori, PIXEL.length - 1)], segreto.n);
    document.getElementById("contatore").textContent = finito ? "" : `Tentativo ${tentativi.length + 1} di ${TENTATIVI}`;
    document.getElementById("indizi").innerHTML = indizi(segreto, errori, finito);
    document.getElementById("lista").innerHTML = tentativi.slice().reverse().map((t) => rigaTentativo(t, segreto)).join("");
    form.hidden = finito;
    if (finito) mostraFine(vinto);
  }

  function mostraFine(vinto) {
    const esito = vinto ? `${tentativi.length}/${TENTATIVI}` : `X/${TENTATIVI}`;
    const testo = `FightItalia · Chi è? ${libero ? "(libero)" : `#${n}`} ${esito}\n${quadratini(tentativi, segreto)}\n${SITO}chi-e.html`;
    const serie = libero ? null : leggi("chie-serie", { attuale: 0, migliore: 0, ultimo: null });
    document.getElementById("fine").innerHTML = `
      <div class="chie-fine ${vinto ? "vinto" : "perso"}">
        <div class="chie-fine-titolo">${vinto ? "Preso!" : "Era lui"}</div>
        <div class="chie-fine-nome"><a href="lottatore.html?slug=${segreto.s}">${segreto.n}</a></div>
        <div class="chie-fine-sub">${bandiera(segreto.b)} ${segreto.c}${segreto.g === "F" ? " femminile" : ""} · ${segreto.v}–${segreto.l}</div>
        ${serie ? `<div class="chie-fine-sub">Serie: ${serie.attuale} · Migliore: ${serie.migliore}</div>` : ""}
        <div class="finale-azioni">
          <button type="button" class="btn-gioco" id="condividi">Condividi il risultato</button>
          <a class="btn-gioco secondario" href="chi-e.html?libero=1">Gioca ancora (libero)</a>
        </div>
        ${libero ? "" : `<p class="chie-fine-sub">Nuovo lottatore domani a mezzanotte.</p>`}
      </div>`;
    document.getElementById("condividi").addEventListener("click", (e) => condividi(testo, e.currentTarget));
  }

  function aggiornaSerie(vinto) {
    const serie = leggi("chie-serie", { attuale: 0, migliore: 0, ultimo: null });
    if (serie.ultimo === oggi) return;
    const ieri = new Date(Date.parse(oggi) - 86400000).toISOString().slice(0, 10);
    serie.attuale = vinto ? (serie.ultimo === ieri ? serie.attuale + 1 : 1) : 0;
    serie.migliore = Math.max(serie.migliore, serie.attuale);
    serie.ultimo = oggi;
    scrivi("chie-serie", serie);
  }

  // ---------- menu a tendina con foto, categoria e sesso ----------
  const lista = document.getElementById("ac-lista");
  const normalizza = (t) => t.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  const indice = tutti.map((x) => ({ x, chiave: normalizza(x.n) }));
  let proposte = [];
  let attiva = -1;

  function voce(x, i) {
    const avatar = x.f
      ? `<img src="${x.f}" alt="" loading="lazy" onerror="this.replaceWith(Object.assign(document.createElement('span'),{className:'ac-av vuoto',textContent:'${iniziali(x.n)}'}))" class="ac-av">`
      : `<span class="ac-av vuoto">${iniziali(x.n)}</span>`;
    return `<li role="option" id="ac-${i}" class="${i === attiva ? "attiva" : ""}" data-i="${i}" aria-selected="${i === attiva}">
      ${avatar}
      <span class="ac-testo"><span class="ac-nome">${x.n}</span><span class="ac-info">${bandiera(x.b)} ${x.c} · ${genere(x)}</span></span>
      <span class="ac-sesso ${x.g === "F" ? "f" : "m"}">${x.g === "F" ? "F" : "M"}</span>
    </li>`;
  }

  function mostraProposte() {
    const q = normalizza(input.value.trim());
    const giaProvati = new Set(tentativi.map((t) => t.s));
    proposte = q.length < 2 ? [] : indice
      .filter(({ x, chiave }) => !giaProvati.has(x.s) && chiave.split(/\s+/).some((p) => p.startsWith(q)) || (q.length > 2 && chiave.includes(q)))
      .map(({ x }) => x)
      .filter((x) => !giaProvati.has(x.s))
      .slice(0, 8);
    attiva = proposte.length ? 0 : -1;
    lista.innerHTML = proposte.map(voce).join("");
    lista.hidden = !proposte.length;
    input.setAttribute("aria-expanded", String(!!proposte.length));
  }

  function scegli(i) {
    if (!proposte[i]) return;
    input.value = proposte[i].n;
    lista.hidden = true;
    form.requestSubmit();
  }

  input.addEventListener("input", mostraProposte);
  input.addEventListener("keydown", (e) => {
    if (lista.hidden) return;
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      attiva = (attiva + (e.key === "ArrowDown" ? 1 : -1) + proposte.length) % proposte.length;
      lista.innerHTML = proposte.map(voce).join("");
      input.setAttribute("aria-activedescendant", `ac-${attiva}`);
    } else if (e.key === "Enter" && attiva >= 0) {
      e.preventDefault();
      scegli(attiva);
    } else if (e.key === "Escape") {
      lista.hidden = true;
    }
  });
  lista.addEventListener("mousedown", (e) => {
    const li = e.target.closest("li[data-i]");
    if (li) {
      e.preventDefault();
      scegli(Number(li.dataset.i));
    }
  });
  input.addEventListener("blur", () => setTimeout(() => (lista.hidden = true), 120));

  form.addEventListener("submit", (e) => {
    e.preventDefault();
    const nome = input.value.trim().toLowerCase();
    const scelto = tutti.find((x) => x.n.toLowerCase() === nome);
    if (!scelto) {
      msg.textContent = "Scegli un nome dall'elenco dei suggerimenti.";
      return;
    }
    if (tentativi.some((t) => t.s === scelto.s)) {
      msg.textContent = `${scelto.n} l'hai già provato.`;
      return;
    }
    msg.textContent = "";
    input.value = "";
    lista.hidden = true;
    tentativi.push(scelto);
    if (!libero) scrivi(chiave, tentativi.map((t) => t.s));
    const vinto = scelto.s === segreto.s;
    if (!libero && (vinto || tentativi.length >= TENTATIVI)) aggiornaSerie(vinto);
    aggiorna();
  });

  aggiorna();
}

init().catch(() => {
  box.innerHTML = `<div class="empty-state">Non riesco a caricare il gioco. Riprova tra poco.</div>`;
});
