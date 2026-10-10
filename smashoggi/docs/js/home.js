import { fetchJSON, esc, montaPagina, caricaGiocatori, listaPartite, punteggioPartita, giornoRoma, oggiRoma, dataLunga, aggiornatoIl,
  messaggioErrore, etichettaCategoria, intervalloDate, nomeTour, dataBreve, oraRoma, avatar, iniziali } from "./common.js?v=202610101009";

import { partiteLive } from "./live.js?v=202610101009";

montaPagina("index.html");

const LIMITE = 10;
const ordina = (partite, giocatori) => [...partite].sort((a, b) =>
  (b.stato === "in") - (a.stato === "in") || punteggioPartita(b, giocatori) - punteggioPartita(a, giocatori) || (a.data < b.data ? -1 : 1));

// Blocco di partite con "Solo italiani" e "Mostra tutte"
function blocco(contenitore, partite, giocatori, vuoto) {
  // lo stato dei bottoni resta sul contenitore: un aggiornamento in diretta non lo azzera
  const st = (contenitore._stato ??= { soloIta: false, tutte: false });
  let { soloIta, tutte } = st;
  const ordinate = ordina(partite, giocatori);
  const disegna = () => {
    const base = soloIta ? ordinate.filter((p) => p.giocatori.some((g) => g.paese === "ITA")) : ordinate;
    const mostra = tutte ? base : base.slice(0, LIMITE);
    const perTorneo = [...mostra].sort((a, b) => (a.torneo + a.tour).localeCompare(b.torneo + b.tour));
    const ita = partite.some((p) => p.giocatori.some((g) => g.paese === "ITA"));
    contenitore.innerHTML =
      (ita ? `<div class="filtri" style="margin-top:0"><button type="button" class="pill" aria-pressed="${soloIta}" data-ita>Solo italiani</button></div>` : "") +
      (mostra.length ? `<div class="griglia-partite">${listaPartite(tutte ? perTorneo : mostra, giocatori, { raggruppa: tutte })}</div>` : `<div class="vuoto">${esc(vuoto)}</div>`) +
      (base.length > LIMITE ? `<p><button type="button" class="pill" data-tutte>${tutte ? "Mostra meno" : `Mostra tutte (${base.length})`}</button></p>` : "") +
      (!tutte && base.length > 1 ? `<p class="nota">Prima gli italiani e i giocatori meglio classificati.</p>` : "");
    contenitore.querySelector("[data-ita]")?.addEventListener("click", () => { st.soloIta = soloIta = !soloIta; disegna(); });
    contenitore.querySelector("[data-tutte]")?.addEventListener("click", () => { st.tutte = tutte = !tutte; disegna(); });
  };
  disegna();
}

// ---------- Scheda grande: la partita in evidenza ----------
function sceltaEvidenza(principali, giocatori) {
  const ora = Date.now();
  const migliore = (l) => ordina(l, giocatori)[0];
  const live = principali.filter((p) => p.stato === "in");
  if (live.length) return migliore(live);
  const prossime = principali.filter((p) => p.stato === "pre" && new Date(p.data) - ora < 36 * 36e5 && new Date(p.data) > ora - 36e5);
  if (prossime.length) return migliore(prossime);
  const finite = principali.filter((p) => p.stato === "post" && ora - new Date(p.data) < 72 * 36e5);
  return finite.length ? migliore(finite) : null;
}

function schedaEvidenza(p, giocatori, tornei) {
  const t = tornei.find((x) => x.id === p.torneoId && x.tour === p.tour);
  const lato = (g) => {
    const sc = giocatori[g.id] || {};
    const foto = sc.foto ? `<img class="vs-foto" src="${esc(sc.foto)}" alt="" loading="lazy">` : `<span class="vs-iniziali" aria-hidden="true">${esc(iniziali(g.nome))}</span>`;
    return `<div class="vs-lato">${foto}<div class="vs-nome"><span class="${g.paese === "ITA" ? "ita" : ""}">${esc(g.nome)}</span><small>${esc(g.paese || "")}${sc.pos ? ` · N° ${sc.pos}` : ""}</small></div></div>`;
  };
  const [a, b] = p.giocatori;
  const etichetta = p.stato === "in" ? `<span class="etichetta live">In corso</span>` : p.stato === "post" ? `<span class="etichetta">Risultato</span>` : `<span class="etichetta">Partita in evidenza</span>`;
  const sets = (g) => g.set.map((s) => `${s.g}${s.tb !== undefined ? `<sup>${s.tb}</sup>` : ""}`).join(" ");
  let extra = "";
  if (p.stato === "pre") extra = `<div class="conto" id="conto" data-quando="${esc(p.data)}">…</div><div class="conto-nota">All'inizio previsto · ora italiana</div>`;
  else {
    const zero = p.giocatori.every((g) => g.set.length <= 1 && g.set.every((s) => s.g === 0));
    if (!zero) extra = `<div class="punteggio-grande">${[a, b].map((g) => `<div><span class="${g.vince ? "accent" : ""}"><b>${esc(g.breve || g.nome)}</b></span><span>${sets(g)}</span></div>`).join("")}</div>`;
  }
  return `<a class="evidenza" href="${t ? `torneo.html?tour=${p.tour}&id=${encodeURIComponent(p.torneoId)}` : "partite.html"}" style="display:block">
    ${etichetta}
    <div class="vs-riga">${lato(a)}<div class="vs-badge">VS</div>${lato(b)}</div>
    <div class="corpo">
      <div class="piccolo">${p.tour === "atp" ? "ATP" : "WTA"}${t ? ` · ${esc(etichettaCategoria(t).testo)}` : ""}</div>
      <h2>${esc(p.torneo)}</h2>
      <div class="luogo">${esc(p.turno)}${p.campo ? ` · ${esc(p.campo)}` : ""}${t && t.citta ? ` — ${esc(t.citta)}` : ""}</div>
      <div class="quando"><b>${esc(dataLunga(p.data))}</b>${p.stato === "pre" ? ` · ore <b>${esc(oraRoma(p.data))}</b>` : ""}</div>
      ${extra}
    </div></a>`;
}

let timerConto;
function avviaConto() {
  clearInterval(timerConto);
  const el = document.getElementById("conto");
  if (!el) return;
  const fine = new Date(el.dataset.quando).getTime();
  const tic = () => {
    let s = Math.floor((fine - Date.now()) / 1000);
    if (s <= 0) { el.textContent = "Sta per iniziare"; return; }
    const g = Math.floor(s / 86400); s -= g * 86400;
    const h = Math.floor(s / 3600); s -= h * 3600;
    const m = Math.floor(s / 60); s -= m * 60;
    el.textContent = (g ? `${g}g ` : "") + `${h}h ${String(m).padStart(2, "0")}m ${String(s).padStart(2, "0")}s`;
  };
  tic();
  timerConto = setInterval(tic, 1000);
}

function miniTorneo(t) {
  const inCorso = t.inizio <= oggiRoma() && t.fine >= oggiRoma();
  return `<a class="mini" href="torneo.html?tour=${t.tour}&id=${encodeURIComponent(t.id)}"><div class="mini-data">${inCorso ? "In corso · " : ""}${esc(intervalloDate(t.inizio, t.fine))}</div>
    <div class="mini-nome">${esc(t.nome)}</div><div class="mini-sub">${esc(etichettaCategoria(t).testo)} · ${esc(nomeTour(t.tour))}</div></a>`;
}

function cardGiocatore(g, etichetta) {
  const sub = [g.paeseNome, g.eta ? `${g.eta} anni` : null].filter(Boolean).join(" · ");
  return `<a class="champ-card" href="giocatore.html?id=${encodeURIComponent(g.id)}">
    ${g.foto ? `<img class="champ-foto" src="${esc(g.foto)}" alt="" loading="lazy">` : `<span class="champ-iniziali" aria-hidden="true">${esc(iniziali(g.nome))}</span>`}
    <div class="champ-overlay"><span class="champ-div">${esc(etichetta)}</span><div class="champ-nome">${esc(g.nome)}</div><div class="champ-sub">${esc(sub)}</div></div></a>`;
}

let ridisegnaLive = () => {};

// Scheda grande, numeri e partite di oggi: ridisegnati anche quando arrivano i punteggi in diretta
function disegnaOggi(principali, giocatori, tornei, atp, wta, oggi) {
  // Scheda grande
  const ev = sceltaEvidenza(principali, giocatori);
  document.getElementById("evidenza").innerHTML = ev ? schedaEvidenza(ev, giocatori, tornei) : "";
  avviaConto();

  // Numeri grandi (tutti calcolati dai dati)
  const deOggi = principali.filter((p) => p.stato === "in" || giornoRoma(p.data) === oggi);
  const itaTop = [...atp.righe, ...wta.righe].filter((r) => r.paese === "ITA").length;
  const principaliTornei = tornei.filter((t) => t.categoria && t.fine >= oggi).length;
  document.getElementById("stat-strip").innerHTML = [
    [deOggi.length, "partite oggi"], [itaTop, "italiani nei primi 100"], [principaliTornei, "tornei da giocare"],
  ].map(([v, l]) => `<div class="stat"><div class="value">${v}</div><div class="label">${l}</div></div>`).join("");

  // Partite di oggi (o le prossime, se oggi non ce ne sono)
  const boxOggi = document.getElementById("oggi");
  if (deOggi.length) blocco(boxOggi, deOggi, giocatori, "Nessuna partita.");
  else {
    const prossime = principali.filter((p) => p.stato === "pre").sort((a, b) => (a.data < b.data ? -1 : 1));
    if (prossime.length) {
      const giorno = giornoRoma(prossime[0].data);
      document.getElementById("titolo-oggi").firstChild.textContent = `Prossime partite · ${dataBreve(prossime[0].data)} `;
      blocco(boxOggi, prossime.filter((p) => giornoRoma(p.data) === giorno), giocatori, "Nessuna partita.");
    } else boxOggi.innerHTML = `<div class="vuoto">Oggi non ci sono partite del tabellone principale nei dati disponibili.</div>`;
  }

  return deOggi;
}

async function avvia() {
  const [{ partite, generato }, giocatori, { tornei }, { notizie }, atp, wta] = await Promise.all([
    partiteLive((tutte) => ridisegnaLive(tutte)), caricaGiocatori(), fetchJSON("data/tornei.json"), fetchJSON("data/notizie.json"),
    fetchJSON("data/classifica-atp.json"), fetchJSON("data/classifica-wta.json"),
  ]);
  const oggi = oggiRoma();
  document.getElementById("agg").textContent = aggiornatoIl(generato);
  const principali = partite.filter((p) => !p.qualifica);

  ridisegnaLive = (tutte) => disegnaOggi(tutte.filter((p) => !p.qualifica), giocatori, tornei, atp, wta, oggi);
  const deOggi = disegnaOggi(principali, giocatori, tornei, atp, wta, oggi);

  // In evidenza: numero 1 ATP e WTA, e il miglior italiano e la migliore italiana
  const scelti = [[atp.righe[0], "N° 1 ATP"], [wta.righe[0], "N° 1 WTA"],
    [atp.righe.find((r) => r.paese === "ITA"), "Miglior italiano"], [wta.righe.find((r) => r.paese === "ITA"), "Migliore italiana"]]
    .filter(([g]) => g).map(([g, e]) => ({ g, e: g.pos > 1 ? `${e} · N° ${g.pos}` : e }));
  const visti = new Set();
  document.getElementById("giocatori").innerHTML = scelti.filter(({ g }) => !visti.has(g.id) && visti.add(g.id)).map(({ g, e }) => cardGiocatore(g, e)).join("");

  // Risultati recenti (escluse le partite gia' mostrate sopra)
  const tre = new Date(Date.now() - 3 * 864e5).toISOString().slice(0, 10);
  const idOggi = new Set(deOggi.map((p) => p.tour + p.id));
  blocco(document.getElementById("recenti"), principali.filter((p) => p.stato === "post" && giornoRoma(p.data) >= tre && !idOggi.has(p.tour + p.id)),
    giocatori, "Nessun risultato recente nei dati disponibili.");

  // Box laterali
  const prossimi = tornei.filter((t) => t.categoria && t.fine >= oggi).sort((a, b) => (a.inizio < b.inizio ? -1 : 1)).slice(0, 5);
  document.getElementById("tornei").innerHTML = prossimi.length ? prossimi.map(miniTorneo).join("") : `<div class="vuoto">Nessun torneo in calendario.</div>`;
  const riga = (r, t) => `<a class="riga-class ita" href="giocatore.html?id=${encodeURIComponent(r.id)}"><span class="pos">${r.pos}</span>${avatar(r)}<span class="chi"><b>${esc(r.nome)}</b><small>${t}</small></span><span class="punti">${r.punti ?? ""}</span></a>`;
  document.getElementById("italiani").innerHTML = [...atp.righe.filter((r) => r.paese === "ITA").slice(0, 4).map((r) => riga(r, "ATP")),
    ...wta.righe.filter((r) => r.paese === "ITA").slice(0, 3).map((r) => riga(r, "WTA"))].join("");

  document.getElementById("notizie").innerHTML = notizie.slice(0, 8).map((n) => `<a class="notizia" href="${esc(n.link)}" target="_blank" rel="noopener noreferrer">
      <b>${esc(n.titolo)}</b><small><span class="fonte">${esc(n.fonte)}</span> · ${esc(dataBreve(n.data))}</small></a>`).join("");
}

avvia().catch((e) => { console.error(e); document.querySelectorAll("[data-carica]").forEach((el) => messaggioErrore(el)); });
