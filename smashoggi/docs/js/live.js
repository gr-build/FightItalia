// Risultati in diretta: il browser chiede i punteggi a ESPN (che lo consente, CORS aperto) e li unisce ai dati del sito.
// Se la richiesta non riesce (rete, blocchi) restano i dati dell'ultimo aggiornamento: nessun errore per chi legge.
import { fetchJSON, oggiRoma } from "./common.js?v=202610101053";

const ESPN = "https://site.api.espn.com/apis/site/v2/sports/tennis";
const OGNI = 30000; // 30 secondi
// stessi nomi dei turni usati da build_data.py
const TURNI = {"Final": "Finale", "Semifinal": "Semifinale", "Semifinals": "Semifinale", "Quarterfinal": "Quarti di finale", "Quarterfinals": "Quarti di finale", "Round of 16": "Ottavi di finale", "Round of 32": "Sedicesimi di finale", "Round of 64": "Trentaduesimi di finale", "Round of 128": "Primo turno", "3rd Round": "Terzo turno", "2nd Round": "Secondo turno", "1st Round": "Primo turno", "Third Place": "Finale 3º posto", "Qualifying 1st Round": "Qualificazioni, 1º turno", "Qualifying 2nd Round": "Qualificazioni, 2º turno", "Qualifying 3rd Round": "Qualificazioni, 3º turno", "Qualifying Final": "Qualificazioni, finale", "Qualifying Round of 16": "Qualificazioni, ottavi", "Qualifying Round of 32": "Qualificazioni, sedicesimi", "Round Robin": "Girone", "Round 1": "Primo turno", "Round 2": "Secondo turno", "Round 3": "Terzo turno", "Round 4": "Quarto turno"};

const ultimo = (note, fine) => note.trim().endsWith(fine);

function estrai(sb) {
  const out = [];
  for (const ev of sb?.events || []) {
    for (const gr of ev.groupings || []) {
      const tipo = gr.grouping?.slug || "";
      if (tipo !== "mens-singles" && tipo !== "womens-singles") continue;
      for (const c of gr.competitions || []) {
        const comp = c.competitors || [];
        if (comp.length !== 2) continue;
        const st = c.status?.type || {};
        const giocatori = [...comp].sort((a, b) => (a.order || 0) - (b.order || 0)).map((p) => {
          const a = p.athlete || {};
          const cod = /\/countries\/\d+\/([a-z]+)\.png/.exec(a.flag?.href || "")?.[1];
          return {
            id: p.id, nome: a.displayName || a.fullName, breve: a.shortName, paese: cod ? cod.toUpperCase() : null,
            vince: Boolean(p.winner),
            set: (p.linescores || []).map((s) => ({ g: Math.trunc(s.value), ...("tiebreak" in s ? { tb: Math.trunc(s.tiebreak) } : {}) })),
          };
        });
        const turno = c.round?.displayName || "";
        const note = (c.notes || []).map((n) => n.text || "").join(" ");
        out.push({
          id: c.id, tour: tipo === "mens-singles" ? "atp" : "wta", torneoId: String(c.tournamentId || String(ev.id).split("-")[0]),
          torneo: ev.name, turno: TURNI[turno] || turno, qualifica: turno.includes("Qualifying"),
          data: c.startDate || c.date, stato: st.state, dettaglio: st.state !== "pre" ? st.detail || null : null,
          campo: c.venue?.court || null, giocatori,
          speciale: st.state === "post" ? (ultimo(note, " ret") ? "Ritiro" : ultimo(note, " w/o") ? "Walkover" : null) : null,
        });
      }
    }
  }
  return out;
}

async function scaricaLive() {
  const giorno = oggiRoma().replaceAll("-", "");
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 8000);
  try {
    // il giorno italiano e, senza data, quello "corrente" di ESPN (copre le partite serali in America)
    const url = ["atp", "wta"].flatMap((tour) => [`${ESPN}/${tour}/scoreboard?dates=${giorno}`, `${ESPN}/${tour}/scoreboard`]);
    const risposte = await Promise.allSettled(url.map((u) =>
      fetch(u, { signal: ctrl.signal, cache: "no-store" }).then((r) => (r.ok ? r.json() : Promise.reject(r.status)))));
    if (!risposte.some((r) => r.status === "fulfilled")) throw new Error("ESPN non raggiungibile");
    return risposte.filter((r) => r.status === "fulfilled").flatMap((r) => estrai(r.value));
  } finally { clearTimeout(t); }
}

// Aggiorna l'elenco sul posto. Restituisce true se qualcosa e' cambiato.
function unisci(partite, nuove) {
  const perId = new Map(partite.map((p) => [String(p.id), p]));
  let cambiato = false;
  for (const n of nuove) {
    const v = perId.get(String(n.id));
    if (!v) { partite.push(n); perId.set(String(n.id), n); cambiato = true; continue; }
    if (v.stato === "post" && n.stato !== "post") continue; // un risultato finale non torna indietro
    const prima = JSON.stringify([v.stato, v.dettaglio, v.giocatori.map((g) => [g.set, g.vince]), v.speciale]);
    Object.assign(v, { stato: n.stato, dettaglio: n.dettaglio, speciale: n.speciale, data: n.data || v.data, campo: n.campo || v.campo });
    n.giocatori.forEach((g, i) => { const w = v.giocatori.find((x) => String(x.id) === String(g.id)) || v.giocatori[i]; if (w) Object.assign(w, { set: g.set, vince: g.vince }); });
    if (prima !== JSON.stringify([v.stato, v.dettaglio, v.giocatori.map((g) => [g.set, g.vince]), v.speciale])) cambiato = true;
  }
  return cambiato;
}

const ora = (d) => new Intl.DateTimeFormat("it-IT", { timeZone: "Europe/Rome", hour: "2-digit", minute: "2-digit" }).format(d);

function mostraStato(live) {
  document.querySelectorAll("[data-live]").forEach((el) => {
    el.hidden = false;
    el.className = `live-stato${live ? " attivo" : ""}`;
    el.innerHTML = live ? `<i class="live-punto" aria-hidden="true"></i>Risultati in diretta · aggiornati alle ${ora(live)}`
      : `Risultati dell'ultimo aggiornamento del sito`;
  });
}

// Dati del sito + punteggi in diretta. aggiorna() viene chiamata a ogni cambiamento successivo.
export async function partiteLive(aggiorna, { sempre = false } = {}) {
  const dati = await fetchJSON("data/partite.json");
  let live = null;
  try { unisci(dati.partite, await scaricaLive()); live = new Date(); } catch (e) { /* restano i dati del sito */ }
  mostraStato(live);
  const giro = async () => {
    if (document.hidden) return;
    const oggi = oggiRoma();
    const attese = dati.partite.some((p) => p.stato === "in" || (p.stato === "pre" && p.data.slice(0, 10) <= oggi));
    if (!attese && !sempre) return;
    try {
      const cambiato = unisci(dati.partite, await scaricaLive());
      live = new Date();
      mostraStato(live);
      if ((cambiato || sempre) && aggiorna) aggiorna(dati.partite);
    } catch (e) { /* riprova al prossimo giro */ }
  };
  setInterval(giro, OGNI);
  document.addEventListener("visibilitychange", () => { if (!document.hidden) giro(); });
  return dati;
}
