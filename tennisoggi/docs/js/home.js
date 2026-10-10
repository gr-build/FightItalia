import { fetchJSON, esc, montaPagina, caricaGiocatori, listaPartite, punteggioPartita, giornoRoma, oggiRoma, dataLunga,
  aggiornatoIl, messaggioErrore, etichettaCategoria, intervalloDate, nomeTour, dataBreve } from "./common.js?v=202610100420";

montaPagina("index.html");

const LIMITE = 10;

function prioritaria(partite, giocatori) {
  return [...partite].sort((a, b) =>
    (b.stato === "in") - (a.stato === "in") || punteggioPartita(b, giocatori) - punteggioPartita(a, giocatori) || (a.data < b.data ? -1 : 1));
}

// Blocco di partite con filtro "Solo italiani" e "Mostra tutte"
function blocco(contenitore, partite, giocatori, vuoto) {
  let soloIta = false, tutte = false;
  const ordinate = prioritaria(partite, giocatori);
  const disegna = () => {
    const base = soloIta ? ordinate.filter((p) => p.giocatori.some((g) => g.paese === "ITA")) : ordinate;
    const mostra = tutte ? base : base.slice(0, LIMITE);
    const ordinaPerTorneo = [...mostra].sort((a, b) => (a.torneo + a.tour < b.torneo + b.tour ? -1 : a.torneo + a.tour > b.torneo + b.tour ? 1 : 0));
    const ita = partite.some((p) => p.giocatori.some((g) => g.paese === "ITA"));
    contenitore.innerHTML =
      (partite.length && ita ? `<div class="filtri"><button type="button" class="pill" aria-pressed="${soloIta}" data-ita>Solo italiani</button></div>` : "") +
      (mostra.length ? `<div class="griglia-partite">${listaPartite(tutte ? ordinaPerTorneo : mostra, giocatori, { raggruppa: tutte })}</div>` : `<div class="vuoto">${esc(vuoto)}</div>`) +
      (base.length > LIMITE ? `<p><button type="button" class="pill" data-tutte>${tutte ? "Mostra meno" : `Mostra tutte (${base.length})`}</button></p>` : "") +
      (!tutte && base.length > 1 ? `<p class="nota">Prima gli italiani e i giocatori meglio classificati.</p>` : "");
    contenitore.querySelector("[data-ita]")?.addEventListener("click", () => { soloIta = !soloIta; disegna(); });
    contenitore.querySelector("[data-tutte]")?.addEventListener("click", () => { tutte = !tutte; disegna(); });
  };
  disegna();
}

function cardTorneo(t) {
  const cat = etichettaCategoria(t);
  const g = new Date(t.inizio + "T12:00:00Z");
  const mese = new Intl.DateTimeFormat("it-IT", { timeZone: "UTC", month: "short" }).format(g);
  const inCorso = t.inizio <= oggiRoma() && t.fine >= oggiRoma();
  return `<a class="torneo-card" href="torneo.html?tour=${t.tour}&id=${encodeURIComponent(t.id)}">
    <div class="date"><b>${g.getUTCDate()}</b><span>${esc(mese)}</span></div>
    <div><h3>${esc(t.nome)}</h3>
      <div class="sub"><span class="tag ${cat.classe}">${esc(cat.testo)}</span>${inCorso ? '<span class="tag corso">In corso</span>' : ""}${esc(nomeTour(t.tour))}</div>
      <div class="sub">${esc([t.citta, t.paese].filter(Boolean).join(", "))} · ${esc(intervalloDate(t.inizio, t.fine))}</div></div></a>`;
}

async function avvia() {
  const [{ partite, generato }, giocatori, { tornei }, { notizie }, atp, wta] = await Promise.all([
    fetchJSON("data/partite.json"), caricaGiocatori(), fetchJSON("data/tornei.json"), fetchJSON("data/notizie.json"),
    fetchJSON("data/classifica-atp.json"), fetchJSON("data/classifica-wta.json"),
  ]);
  const oggi = oggiRoma();
  document.getElementById("data-oggi").textContent = dataLunga(new Date());
  document.getElementById("agg").textContent = aggiornatoIl(generato);

  const principali = partite.filter((p) => !p.qualifica);
  // Oggi: in corso o in programma/giocate oggi
  const deOggi = principali.filter((p) => p.stato === "in" || giornoRoma(p.data) === oggi);
  const boxOggi = document.getElementById("oggi");
  if (deOggi.length) {
    blocco(boxOggi, deOggi, giocatori, "Nessuna partita.");
  } else {
    const prossime = principali.filter((p) => p.stato === "pre").sort((a, b) => (a.data < b.data ? -1 : 1));
    if (prossime.length) {
      const giorno = giornoRoma(prossime[0].data);
      document.getElementById("titolo-oggi").firstChild.textContent = `Prossime partite · ${dataBreve(prossime[0].data)} `;
      blocco(boxOggi, prossime.filter((p) => giornoRoma(p.data) === giorno), giocatori, "Nessuna partita.");
    } else {
      boxOggi.innerHTML = `<div class="vuoto">Oggi non ci sono partite del tabellone principale nei dati disponibili.</div>`;
    }
  }

  // Risultati recenti: concluse negli ultimi 3 giorni, escluse quelle di oggi (gia' sopra)
  const tre = new Date(Date.now() - 3 * 864e5).toISOString().slice(0, 10);
  const idOggi = new Set(deOggi.map((p) => p.tour + p.id));
  const recenti = principali.filter((p) => p.stato === "post" && giornoRoma(p.data) >= tre && !idOggi.has(p.tour + p.id));
  blocco(document.getElementById("recenti"), recenti, giocatori, "Nessun risultato recente nei dati disponibili.");

  // Prossimi tornei: quelli del circuito principale (con categoria), in corso o futuri
  const prossimi = tornei.filter((t) => t.categoria && t.fine >= oggi).sort((a, b) => (a.inizio < b.inizio ? -1 : 1)).slice(0, 6);
  document.getElementById("tornei").innerHTML = prossimi.length ? prossimi.map(cardTorneo).join("") : `<div class="vuoto">Nessun torneo in calendario.</div>`;

  // Notizie
  document.getElementById("notizie").innerHTML = notizie.slice(0, 8).map((n) => `<a class="notizia" href="${esc(n.link)}" target="_blank" rel="noopener noreferrer">
      <b>${esc(n.titolo)}</b><small><span class="fonte">${esc(n.fonte)}</span> · ${esc(dataBreve(n.data))}</small></a>`).join("");

  // Italiani in classifica (primi 6 per tour)
  const ita = (c, nome) => {
    const righe = c.righe.filter((r) => r.paese === "ITA").slice(0, 6);
    return `<h3>${nome}</h3>${righe.map((r) => `<a class="riga-class ita" href="giocatore.html?id=${encodeURIComponent(r.id)}"><span class="pos">${r.pos}</span><span class="chi"><b>${esc(r.nome)}</b></span><span class="punti">${r.punti ?? ""}</span></a>`).join("") || '<div class="vuoto" style="border:0">Nessun italiano nei primi 100.</div>'}`;
  };
  document.getElementById("italiani").innerHTML = ita(atp, "ATP, uomini") + ita(wta, "WTA, donne");
}

avvia().catch(() => document.querySelectorAll("[data-carica]").forEach((el) => messaggioErrore(el)));
