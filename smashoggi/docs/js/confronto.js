// Confronto: due tennisti fianco a fianco, il valore migliore evidenziato. L'indirizzo (?a=..&b=..) si puo' condividere.
import { fetchJSON, esc, montaPagina, caricaGiocatori, avatar, messaggioErrore } from "./common.js?v=202610101452";
import { cercaGiocatore, condividi } from "./giochi-comuni.js?v=202610101452";

montaPagina("tennisti.html");

const q = new URLSearchParams(location.search);
const scelti = { a: q.get("a"), b: q.get("b") };
let tutti = {}, lista = [], finali = [], partite = [];

// [etichetta, valore, formato, chi vince: "alto" | "basso" | null]
const RIGHE = [
  ["Classifica", (g) => g.pos, (v) => `${v}º`, "basso"],
  ["Punti", (g) => g.punti, (v) => v.toLocaleString("it-IT"), "alto"],
  ["Titoli in carriera", (g) => g.titoli, String, "alto"],
  ["Partite vinte in carriera", (g) => g.vinte, (v) => v.toLocaleString("it-IT"), "alto"],
  ["% vittorie in carriera", (g) => (g.vinte != null && g.perse != null && g.vinte + g.perse > 0 ? Math.round((g.vinte / (g.vinte + g.perse)) * 1000) / 10 : null), (v) => `${String(v).replace(".", ",")}%`, "alto"],
  [`Titoli ${new Date().getFullYear()}`, (g) => g.titoliAnno ?? (g.pos ? 0 : null), String, "alto"],
  [`Challenger vinti ${new Date().getFullYear()}`, (g) => g.titoliChallenger, String, "alto"],
  ["Età", (g) => g.eta, (v) => `${v} anni`, null],
  ["Altezza", (g) => g.altezzaCm, (v) => `${v} cm`, null],
  ["Peso", (g) => g.pesoKg, (v) => `${v} kg`, null],
  ["Mano", (g) => g.mano, String, null],
  ["Professionista dal", (g) => g.esordio, String, null],
];

function slot(lato) {
  const el = document.getElementById(`slot-${lato}`);
  const g = tutti[scelti[lato]];
  if (g) {
    el.innerHTML = `<div class="cf-gioc">${avatar(g, true)}<b>${esc(g.nome)}</b><small>${esc(g.paeseNome || g.paese || "")}${g.pos ? ` · ${g.tour.toUpperCase()} N° ${g.pos}` : ""}</small>
      <button type="button" class="pill cf-cambia" data-lato="${lato}">Cambia</button></div>`;
    el.querySelector(".cf-cambia").addEventListener("click", () => { scelti[lato] = null; aggiorna(); });
  } else {
    el.innerHTML = `<div class="cf-vuoto">Scegli il ${lato === "a" ? "primo" : "secondo"} tennista</div><div class="cf-cerca"></div>`;
    cercaGiocatore(el.querySelector(".cf-cerca"), lista, (x) => { scelti[lato] = x.id; aggiorna(); }, (x) => x.id === scelti[lato === "a" ? "b" : "a"]);
  }
}

function scontri(a, b) {
  const tra = (ids) => ids.includes(a.id) && ids.includes(b.id);
  const out = [];
  for (const f of finali) if (tra([f.vincitore.id, f.finalista.id])) out.push({ data: f.fine, vince: f.vincitore.id, dove: `${f.nome}, finale`, punteggio: f.punteggioTesto ?? f.punteggio.map(([x, y, tb]) => `${x}-${y}${tb !== undefined ? `(${tb})` : ""}`).join(" ") });
  for (const p of partite) {
    if (p.stato !== "post" || !tra(p.giocatori.map((x) => x.id))) continue;
    if (out.some((o) => o.dove.startsWith(p.torneo) && p.turno === "Finale")) continue;
    const v = p.giocatori.find((x) => x.vince);
    out.push({ data: p.data.slice(0, 10), vince: v?.id, dove: `${p.torneo}, ${p.turno.toLowerCase()}`, punteggio: v ? v.set.map((s, i) => `${s.g}-${p.giocatori.find((x) => x !== v).set[i]?.g ?? ""}`).join(" ") : "" });
  }
  return out.sort((x, y) => (x.data < y.data ? 1 : -1));
}

function aggiorna() {
  history.replaceState(null, "", `confronto.html${scelti.a || scelti.b ? `?${new URLSearchParams(Object.entries(scelti).filter(([, v]) => v))}` : ""}`);
  slot("a"); slot("b");
  const a = tutti[scelti.a], b = tutti[scelti.b], box = document.getElementById("confronto");
  if (!a || !b) { box.innerHTML = ""; return; }
  let punti = [0, 0];
  const righe = RIGHE.map(([nome, val, fmt, verso]) => {
    const va = val(a), vb = val(b);
    if (va == null && vb == null) return "";
    let ma = false, mb = false;
    if (verso && va != null && vb != null && va !== vb) {
      ma = verso === "alto" ? va > vb : va < vb; mb = !ma;
      punti[ma ? 0 : 1]++;
    }
    return `<div class="cf-riga"><span class="cf-v ${ma ? "meglio" : ""}">${va != null ? esc(fmt(va)) : "–"}</span><span class="cf-nome">${esc(nome)}</span><span class="cf-v ${mb ? "meglio" : ""}">${vb != null ? esc(fmt(vb)) : "–"}</span></div>`;
  }).join("");
  const sc = scontri(a, b);
  const vintiA = sc.filter((s) => s.vince === a.id).length, vintiB = sc.filter((s) => s.vince === b.id).length;
  const cognome = (g) => g.nome.split(" ").slice(-1)[0];
  box.innerHTML = `
    <div class="cf-tabella">
      <div class="cf-riga cf-testa"><b>${esc(cognome(a))}</b><span class="cf-nome">${punti[0]} – ${punti[1]}<small>voci in cui è meglio</small></span><b>${esc(cognome(b))}</b></div>
      ${righe}
    </div>
    <h2 class="section-title">Scontri diretti <span class="count">${sc.length ? `${esc(cognome(a))} ${vintiA} – ${vintiB} ${esc(cognome(b))}` : ""}</span></h2>
    ${sc.length ? `<div class="cf-scontri">${sc.map((s) => `<div class="cf-scontro"><span>${esc(s.data.split("-").reverse().join("/"))}</span><span>${esc(s.dove)}</span><b>${esc(cognome(tutti[s.vince] || { nome: "?" }))}</b><span class="cf-ris">${esc(s.punteggio)}</span></div>`).join("")}</div>`
      : `<div class="vuoto">Nessuno scontro diretto nei nostri dati (finali della stagione e ultime quattro settimane).</div>`}
    <p style="text-align:center;margin-top:16px"><button type="button" class="pill attiva" id="condividi">Condividi il confronto</button></p>`;
  document.getElementById("condividi").addEventListener("click", (e) => condividi(`${a.nome} vs ${b.nome} su Smash Oggi: ${location.href}`, e.currentTarget));
}

Promise.all([caricaGiocatori(), fetchJSON("data/archivio.json"), fetchJSON("data/partite.json")]).then(([g, ar, pa]) => {
  tutti = g; lista = Object.values(g).filter((x) => x.nome); finali = ar.finali; partite = pa.partite;
  if (!tutti[scelti.a]) scelti.a = null;
  if (!tutti[scelti.b]) scelti.b = null;
  aggiorna();
}).catch(() => messaggioErrore(document.getElementById("confronto")));
