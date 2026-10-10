import { fetchJSON, esc, montaPagina, oggiRoma, etichettaCategoria, intervalloDate, nomeTour, mesiIt, messaggioErrore, dataSolo } from "./common.js?v=202610101448";

montaPagina("calendario.html");

const stato = { cat: "tutti", tour: "tutti", periodo: "prossimi" };
const CATEGORIE = [["tutti", "Tutti"], ["Grand Slam", "Slam"], ["1000", "1000"], ["500", "500"], ["250", "250"], ["Finals", "Finals"], ["altri", "Altri tornei"]];
const TOUR = [["tutti", "Uomini e donne"], ["atp", "Uomini"], ["wta", "Donne"]];
const PERIODO = [["prossimi", "In corso e prossimi"], ["tutti", "Tutta la stagione"], ["passati", "Già giocati"]];

let tornei = [];

function pillole(chiave, voci) {
  return `<div class="gruppo-filtri" role="group" aria-label="Filtro">${voci.map(([v, t]) =>
    `<button type="button" class="pill" data-k="${chiave}" data-v="${esc(v)}" aria-pressed="${stato[chiave] === v}">${esc(t)}</button>`).join("")}</div>`;
}

function card(t, oggi) {
  const cat = etichettaCategoria(t);
  const a = new Date(t.inizio + "T12:00:00Z");
  const mese = new Intl.DateTimeFormat("it-IT", { timeZone: "UTC", month: "short" }).format(a);
  const inCorso = !t.concluso && t.inizio <= oggi && t.fine >= oggi;
  return `<a class="torneo-card" href="torneo.html?tour=${t.tour}&id=${encodeURIComponent(t.id)}">
    <div class="date"><b>${a.getUTCDate()}</b><span>${esc(mese)}</span></div>
    <div><h3>${esc(t.nome)}</h3>
      <div class="sub"><span class="tag ${cat.classe}">${esc(cat.testo)}</span>${inCorso ? '<span class="tag corso">In corso</span>' : ""}${esc(nomeTour(t.tour))}${t.superficie ? ` · ${esc(t.superficie)}` : ""}</div>
      <div class="sub">${esc([t.citta, t.paese].filter(Boolean).join(", "))} · ${esc(intervalloDate(t.inizio, t.fine))}</div></div></a>`;
}

function disegna() {
  const oggi = oggiRoma();
  let lista = tornei.filter((t) => {
    if (stato.tour !== "tutti" && t.tour !== stato.tour) return false;
    if (stato.cat === "altri") { if (t.categoria) return false; }
    else {
      if (!t.categoria) return false;               // "Tutti" = circuito principale
      if (stato.cat !== "tutti" && t.categoria !== stato.cat) return false;
    }
    if (stato.periodo === "prossimi") return t.fine >= oggi;
    if (stato.periodo === "passati") return t.fine < oggi;
    return true;
  });
  if (stato.periodo === "passati") lista = lista.reverse();
  let html = "", mese = "";
  for (const t of lista) {
    const m = t.inizio.slice(0, 7);
    if (m !== mese) { mese = m; html += `<h3 class="mese">${esc(mesiIt(t.inizio))}</h3>`; }
    html += card(t, oggi);
  }
  document.getElementById("elenco").innerHTML = lista.length ? `<div class="lista-tornei">${html}</div>` : `<div class="vuoto">Nessun torneo con questi filtri.</div>`;
  document.getElementById("conta").textContent = `${lista.length} tornei`;
  document.querySelectorAll(".pill[data-k]").forEach((b) => b.setAttribute("aria-pressed", String(stato[b.dataset.k] === b.dataset.v)));
}

// ---------- Agenda del mese (stesso schema del calendario di GP Oggi) ----------
const agenda = { mese: null, giorno: null, tour: { atp: true, wta: true }, limiti: null };
const GIORNI_SETT = ["Lun", "Mar", "Mer", "Gio", "Ven", "Sab", "Dom"];
const iso = (d) => d.toISOString().slice(0, 10);
const principali = () => tornei.filter((t) => t.categoria && agenda.tour[t.tour]);
const inCorsoIl = (g) => principali().filter((t) => t.inizio <= g && t.fine >= g);
const pesante = (t) => ["Grand Slam", "Finals", "1000"].includes(t.categoria);

function disegnaAgenda() {
  const oggi = oggiRoma();
  const [y, m] = agenda.mese.split("-").map(Number);
  document.getElementById("mese-titolo").textContent = mesiIt(`${agenda.mese}-01`);
  document.getElementById("mese-prec").disabled = agenda.mese <= agenda.limiti[0];
  document.getElementById("mese-succ").disabled = agenda.mese >= agenda.limiti[1];
  const primo = new Date(Date.UTC(y, m - 1, 1));
  const vuoti = (primo.getUTCDay() + 6) % 7;
  const nGiorni = new Date(Date.UTC(y, m, 0)).getUTCDate();
  let html = GIORNI_SETT.map((g) => `<div class="ag-sett" aria-hidden="true">${g}</div>`).join("") + "<div></div>".repeat(vuoti);
  for (let d = 1; d <= nGiorni; d++) {
    const g = iso(new Date(Date.UTC(y, m - 1, d)));
    const lista = inCorsoIl(g);
    const tours = ["atp", "wta"].filter((t) => lista.some((x) => x.tour === t));
    const cls = ["ag-giorno", lista.length ? "pieno" : "", lista.some(pesante) ? "grande" : "", g === oggi ? "oggi" : "", g === agenda.giorno ? "scelto" : ""].filter(Boolean).join(" ");
    const descr = `${d} ${mesiIt(g)}: ${lista.length ? `${lista.length} tornei in corso` : "nessun torneo"}`;
    html += `<button type="button" class="${cls}" data-g="${g}" aria-label="${esc(descr)}" aria-pressed="${g === agenda.giorno}"><span class="ag-num">${d}</span><span class="ag-pallini">${tours.map((t) => `<i class="pallino ${t}"></i>`).join("")}</span></button>`;
  }
  document.getElementById("agenda").innerHTML = html;
  disegnaDettaglio();
}

function disegnaDettaglio() {
  const el = document.getElementById("dettaglio");
  if (!agenda.giorno) { el.innerHTML = `<p class="nota">Tocca un giorno per vedere i tornei in corso.</p>`; return; }
  const oggi = oggiRoma();
  const lista = inCorsoIl(agenda.giorno).sort((a, b) => Number(pesante(b)) - Number(pesante(a)) || a.tour.localeCompare(b.tour));
  const titolo = new Intl.DateTimeFormat("it-IT", { timeZone: "UTC", weekday: "long", day: "numeric", month: "long" }).format(dataSolo(agenda.giorno));
  el.innerHTML = `<h3 class="ag-titolo">${esc(titolo)}</h3>
    ${lista.length ? `<div class="lista-tornei">${lista.map((t) => card(t, oggi)).join("")}</div>` : `<div class="vuoto">Nessun torneo del circuito principale in questo giorno.</div>`}
    <a class="widget-tutti" href="partite.html?giorno=${agenda.giorno}">Risultati e partite di questo giorno →</a>`;
}

function montaAgenda() {
  const mesi = tornei.map((t) => t.inizio.slice(0, 7)).concat(tornei.map((t) => t.fine.slice(0, 7))).sort();
  agenda.limiti = [mesi[0], mesi[mesi.length - 1]];
  const oggi = oggiRoma();
  agenda.mese = oggi.slice(0, 7);
  agenda.giorno = oggi;
  const sposta = (n) => { const [y, m] = agenda.mese.split("-").map(Number); agenda.mese = iso(new Date(Date.UTC(y, m - 1 + n, 1))).slice(0, 7); disegnaAgenda(); };
  document.getElementById("mese-prec").addEventListener("click", () => sposta(-1));
  document.getElementById("mese-succ").addEventListener("click", () => sposta(1));
  document.getElementById("mese-oggi").addEventListener("click", () => { agenda.mese = oggi.slice(0, 7); agenda.giorno = oggi; disegnaAgenda(); });
  document.getElementById("agenda").addEventListener("click", (e) => {
    const b = e.target.closest(".ag-giorno");
    if (!b) return;
    agenda.giorno = b.dataset.g;
    disegnaAgenda();
    if (matchMedia("(max-width: 980px)").matches) document.getElementById("dettaglio").scrollIntoView({ behavior: "smooth", block: "nearest" });
  });
  document.getElementById("filtri-tour").addEventListener("click", (e) => {
    const b = e.target.closest(".pill[data-t]");
    if (!b) return;
    const t = b.dataset.t, altro = t === "atp" ? "wta" : "atp";
    agenda.tour[t] = !agenda.tour[t];
    if (!agenda.tour[t] && !agenda.tour[altro]) agenda.tour[altro] = true; // almeno un circuito resta acceso
    document.querySelectorAll("#filtri-tour .pill").forEach((p) => p.setAttribute("aria-pressed", String(agenda.tour[p.dataset.t])));
    disegnaAgenda();
  });
  disegnaAgenda();
}

fetchJSON("data/tornei.json").then((d) => {
  tornei = d.tornei;
  montaAgenda();
  document.getElementById("filtri").innerHTML = pillole("periodo", PERIODO) + pillole("cat", CATEGORIE) + pillole("tour", TOUR);
  document.getElementById("filtri").addEventListener("click", (e) => {
    const b = e.target.closest(".pill[data-k]");
    if (!b) return;
    stato[b.dataset.k] = b.dataset.v;
    disegna();
  });
  disegna();
}).catch(() => messaggioErrore(document.getElementById("elenco")));
