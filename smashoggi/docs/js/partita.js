// Pagina di una partita: tabellone, bilancio dei game (calcolato dal punteggio), confronto, scontri diretti, forma.
// ESPN non da' statistiche punto per punto per il tennis (ace, break, % prime): qui solo dati veri.
import { partiteLive } from "./live.js?v=202610140902";
import { fetchJSON, esc, montaPagina, caricaGiocatori, avatar, frecciaIndietro, messaggioErrore, etichettaCategoria, oraRoma, dataLunga, schedaPartita, bandiera } from "./common.js?v=202610140902";
import { punteggioFinale } from "./archivio-comune.js?v=202610140902";

montaPagina("live.html");
frecciaIndietro(document.getElementById("indietro"), "partite.html", "Indietro");

const q = new URLSearchParams(location.search);
const tour = q.get("tour") === "wta" ? "wta" : "atp", id = q.get("id");
const datiPartite = partiteLive(() => avvia().catch(() => {}));
const box = document.getElementById("contenuto-partita");

const cognome = (g) => (g.nome || "").split(" ").slice(-1)[0];
const meglio = (a, b, verso) => (a == null || b == null || a === b ? [false, false] : verso === "alto" ? [a > b, b > a] : [a < b, b < a]);

function analisi(p) {
  const [a, b] = p.giocatori;
  const giochi = (g) => g.set.reduce((n, s) => n + s.g, 0);
  const ga = giochi(a), gb = giochi(b);
  const setVinti = (x, y) => x.set.filter((s, i) => y.set[i] && s.g > y.set[i].g).length;
  const tb = a.set.filter((s) => s.tb !== undefined).length + b.set.filter((s) => s.tb !== undefined).length;
  const sets = a.set.length;
  const tot = ga + gb;
  return { ga, gb, sa: setVinti(a, b), sb: setVinti(b, a), tb, sets, tot, pa: tot ? Math.round((ga / tot) * 100) : 50 };
}

function carattere(p, an) {
  if (p.stato === "pre") return "";
  const chiusi = p.stato === "post";
  const diff = Math.abs(an.ga - an.gb);
  const decisivo = an.sets >= 3 && an.sa + an.sb >= 3 && !(p.giocatori.some((g) => g.set.length >= 5 && g.vince === false && false));
  if (!chiusi) return "";
  if (p.speciale === "Ritiro") return "Partita chiusa per ritiro.";
  if (p.speciale === "Walkover") return "Walkover: la partita non si è giocata.";
  if (an.tb >= 2) return "Partita equilibratissima: più tie-break.";
  if (an.sets >= 5 || (an.sets === 3 && an.sa && an.sb && an.tot >= 30)) return "Lunga battaglia fino all'ultimo set.";
  if (diff >= 8) return "Dominio netto.";
  if (diff <= 2 && an.sets >= 2) return "Partita molto equilibrata.";
  return "";
}

function forma(giocatore, partite) {
  return partite.filter((x) => x.stato === "post" && !x.qualifica && x.giocatori.some((g) => g.id === giocatore.id))
    .sort((x, y) => (x.data < y.data ? 1 : -1)).slice(0, 5).map((x) => x.giocatori.find((g) => g.id === giocatore.id).vince);
}

function scontri(a, b, partite, finali, escludiId) {
  const tra = (ids) => ids.includes(a.id) && ids.includes(b.id);
  const out = [];
  for (const f of finali) if (tra([f.vincitore.id, f.finalista.id])) out.push({ data: f.fine, vince: f.vincitore.id, dove: `${f.nome}, finale`, punteggio: punteggioFinale(f), chiave: f.nome + "Finale" });
  for (const x of partite) {
    if (x.stato !== "post" || String(x.id) === String(escludiId) || !tra(x.giocatori.map((g) => g.id))) continue;
    if (out.some((o) => o.chiave === x.torneo + x.turno)) continue;
    const v = x.giocatori.find((g) => g.vince), p = x.giocatori.find((g) => g !== v);
    out.push({ data: x.data.slice(0, 10), vince: v?.id, dove: `${x.torneo}, ${x.turno.toLowerCase()}`, punteggio: v ? v.set.map((s, i) => `${s.g}-${p.set[i]?.g ?? ""}`).join(" ") : "" });
  }
  return out.sort((x, y) => (x.data < y.data ? 1 : -1));
}

async function avvia() {
  const [{ partite }, giocatori, { finali }, { tornei }] = await Promise.all([datiPartite, caricaGiocatori(), fetchJSON("data/archivio.json").catch(() => ({ finali: [] })), fetchJSON("data/tornei.json")]);
  const p = partite.find((x) => String(x.id) === String(id) && x.tour === tour);
  if (!p) return messaggioErrore(box, "Partita non trovata: i dati contengono le ultime quattro settimane.");
  const [a, b] = p.giocatori;
  const A = { ...(giocatori[a.id] || {}), ...a }, B = { ...(giocatori[b.id] || {}), ...b };
  const t = tornei.find((x) => x.id === p.torneoId && x.tour === p.tour);
  document.title = `${A.nome} vs ${B.nome} — Smash Oggi`;
  const an = analisi(p);
  const live = p.stato === "in", finita = p.stato === "post";
  const stato = live ? `<span class="tag corso">In corso</span>` : finita ? `<span class="tag neutro">Finita</span>` : `<span class="tag neutro">${esc(oraRoma(p.data))}</span>`;
  const cat = t ? etichettaCategoria(t) : null;

  const lato = (g, f) => `<a class="pg-lato${g.vince ? " vince" : ""}" href="${giocatori[g.id] ? `giocatore.html?id=${encodeURIComponent(g.id)}` : "#"}">
      ${avatar(f, true)}<b>${esc(g.nome)}</b><small>${bandiera(g.paese)}${esc(g.paese || "")}${f.pos ? ` · N° ${f.pos}` : ""}${g.seed ? ` · TdS ${g.seed}` : ""}</small></a>`;
  const zero = live && p.giocatori.every((g) => g.set.length <= 1 && g.set.every((s) => s.g === 0));
  const nSet = Math.max(a.set.length, b.set.length, 1);
  const celle = (g, o) => Array.from({ length: nSet }, (_, i) => { const s = g.set[i], r = o.set[i]; const v = s && r && s.g > r.g;
    return `<span class="pg-set${v ? " v" : ""}">${s ? `${s.g}${s.tb !== undefined ? `<sup>${s.tb}</sup>` : ""}` : "–"}</span>`; }).join("");
  const riga = (g) => `<div class="pg-riga${g.vince ? " vince" : ""}"><span class="tb-codice">${bandiera(g.paese)}${esc(g.paese || "")}</span><span class="pg-nome">${esc(g.nome)}</span><span class="pg-sets">${celle(g, g === a ? b : a)}</span></div>`;

  const righe = [
    ["Classifica", A.pos, B.pos, (v) => `N° ${v}`, "basso"], ["Punti", A.punti, B.punti, (v) => v.toLocaleString("it-IT"), "alto"],
    ["Titoli in carriera", A.titoli, B.titoli, String, "alto"], ["Vittorie in carriera", A.vinte, B.vinte, (v) => v.toLocaleString("it-IT"), "alto"],
    ["Età", A.eta, B.eta, (v) => `${v} anni`, null], ["Altezza", A.altezzaCm, B.altezzaCm, (v) => `${v} cm`, null], ["Mano", A.mano, B.mano, String, null],
  ].filter(([, x, y]) => x != null || y != null).map(([n, x, y, f, verso]) => { const [ma, mb] = meglio(x, y, verso);
    return `<div class="cf-riga"><span class="cf-v ${ma ? "meglio" : ""}">${x != null ? esc(f(x)) : "–"}</span><span class="cf-nome">${esc(n)}</span><span class="cf-v ${mb ? "meglio" : ""}">${y != null ? esc(f(y)) : "–"}</span></div>`; }).join("");

  const sc = scontri(A, B, partite, finali, p.id);
  const va = sc.filter((s) => s.vince === A.id).length, vb = sc.filter((s) => s.vince === B.id).length;
  const fA = forma(A, partite), fB = forma(B, partite);
  const pallini = (f) => f.length ? f.map((v) => `<span class="${v ? "v" : "s"}">${v ? "V" : "S"}</span>`).join("") : "<small>n.d.</small>";
  const note = carattere(p, an);

  box.innerHTML = `
    <div class="pg-testa">
      <div class="pg-meta">${t ? `<a href="torneo.html?tour=${p.tour}&id=${encodeURIComponent(p.torneoId)}">${esc(p.torneo)}</a>` : esc(p.torneo)}${cat ? ` <span class="tag ${cat.classe}">${esc(cat.testo)}</span>` : ""}</div>
      <div class="pg-meta2">${esc(p.turno)}${p.campo ? ` · ${esc(p.campo)}` : ""} · ${esc(dataLunga(p.data))}${p.stato === "pre" ? ` · ore ${esc(oraRoma(p.data))}` : ""} ${stato}</div>
      <div class="pg-vs">${lato(a, A)}<span class="vs-badge">VS</span>${lato(b, B)}</div>
      ${p.stato === "pre" ? `<div class="conto-box"><div class="conto-nota">Inizio previsto</div><div class="conto" style="font-size:28px">${esc(oraRoma(p.data))}</div><div class="conto-nota">ora italiana</div></div>`
        : `<div class="pg-tabellone">${riga(a)}${riga(b)}${p.speciale ? `<div class="tb-nota">${esc(p.speciale)}</div>` : ""}</div>`}
      ${live && !zero ? `<p class="nota" style="text-align:center">Punteggio in diretta, aggiornato ogni 30 secondi.</p>` : ""}
    </div>
    ${p.stato !== "pre" && !zero ? `<h2 class="section-title">Dati della partita</h2>
      <div class="pg-stat">
        <div class="pg-barra"><div class="pg-barra-testa"><b>${an.ga}</b><span>Game vinti</span><b>${an.gb}</b></div><div class="pg-barra-fondo"><i style="width:${an.pa}%"></i></div></div>
        <div class="pg-numeri"><div><b>${an.sa} – ${an.sb}</b><small>Set</small></div><div><b>${an.tot}</b><small>Game giocati</small></div><div><b>${an.tb}</b><small>Tie-break</small></div></div>
        ${note ? `<p class="pg-nota">${esc(note)}</p>` : ""}
      </div>` : ""}
    <h2 class="section-title">Confronto</h2>
    <div class="cf-tabella">${righe || `<div class="vuoto">Dati non disponibili.</div>`}</div>
    <h2 class="section-title">Forma recente</h2>
    <div class="pg-forma"><div><b>${esc(cognome(A))}</b><span class="gh-forma">${pallini(fA)}</span></div><div><b>${esc(cognome(B))}</b><span class="gh-forma">${pallini(fB)}</span></div></div>
    <h2 class="section-title">Scontri diretti <span class="count">${sc.length ? `${esc(cognome(A))} ${va} – ${vb} ${esc(cognome(B))}` : ""}</span></h2>
    ${sc.length ? `<div class="cf-scontri">${sc.map((s) => `<div class="cf-scontro"><span>${esc(s.data.split("-").reverse().join("/"))}</span><span>${esc(s.dove)}</span><b>${esc(cognome(s.vince === A.id ? A : B))}</b><span class="cf-ris">${esc(s.punteggio)}</span></div>`).join("")}</div>`
      : `<div class="vuoto">Nessuno scontro nei nostri dati (finali e ultime quattro settimane).</div>`}
    ${giocatori[a.id] && giocatori[b.id] ? `<p style="text-align:center;margin-top:16px"><a class="pill attiva btn-confronta" href="confronto.html?a=${encodeURIComponent(a.id)}&b=${encodeURIComponent(b.id)}">⚖️ Confronto completo</a></p>` : ""}
    <p class="nota">ESPN non fornisce le statistiche punto per punto del tennis (ace, break, prime di servizio): i dati qui sopra sono calcolati dal punteggio. TdS = testa di serie.</p>`;
}
avvia().catch(() => messaggioErrore(box));
