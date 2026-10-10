// Archivio: albo d'oro della stagione, una finale per torneo concluso.
import { fetchJSON, esc, montaPagina, mesiIt, messaggioErrore } from "./common.js?v=202610101053";
import { rigaFinale } from "./archivio-comune.js?v=202610101053";
import { normale } from "./giochi-comuni.js?v=202610101053";

montaPagina("archivio.html");

const stato = { tour: "tutti", cat: "tutti", ita: false, q: "" };
const TOUR = [["tutti", "Uomini e donne"], ["atp", "Uomini"], ["wta", "Donne"]];
const CAT = [["tutti", "Tutte"], ["Grand Slam", "Slam"], ["1000", "1000"], ["500", "500"], ["250", "250"], ["Finals", "Finals"], ["altri", "Altri"]];
let finali = [];

const pillole = (k, voci) => `<div class="gruppo-filtri" role="group">${voci.map(([v, t]) =>
  `<button type="button" class="pill" data-k="${k}" data-v="${esc(v)}" aria-pressed="${stato[k] === v}">${esc(t)}</button>`).join("")}</div>`;

function disegna() {
  const q = normale(stato.q.trim());
  const lista = finali.filter((a) => (stato.tour === "tutti" || a.tour === stato.tour)
    && (stato.cat === "tutti" || (stato.cat === "altri" ? !a.categoria : a.categoria === stato.cat))
    && (!stato.ita || a.vincitore.paese === "ITA" || a.finalista.paese === "ITA")
    && (!q || [a.nome, a.citta, a.vincitore.nome, a.finalista.nome].some((x) => normale(x).includes(q))));
  let html = "", mese = "";
  for (const a of lista) {
    const m = a.fine.slice(0, 7);
    if (m !== mese) { mese = m; html += `<h3 class="mese">${esc(mesiIt(a.fine))}</h3>`; }
    html += rigaFinale(a);
  }
  document.getElementById("elenco").innerHTML = lista.length ? `<div class="lista-finali">${html}</div>` : `<div class="vuoto">Nessuna finale con questi filtri.</div>`;
  document.querySelectorAll(".pill[data-k]").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.k === "ita" ? stato.ita : stato[b.dataset.k] === b.dataset.v)));
}

fetchJSON("data/archivio.json").then((d) => {
  finali = d.finali;
  document.getElementById("anno").textContent = d.anno;
  // numeri della stagione
  const conta = {};
  for (const a of finali) conta[a.vincitore.id] = { n: (conta[a.vincitore.id]?.n || 0) + 1, g: a.vincitore };
  const re = Object.values(conta).sort((a, b) => b.n - a.n)[0];
  const ita = finali.filter((a) => a.vincitore.paese === "ITA").length;
  document.getElementById("numeri").innerHTML = [
    ["#elenco", finali.length, "finali giocate", ""],
    ["#elenco", ita, "titoli italiani", "ita"],
    [re ? `giocatore.html?id=${encodeURIComponent(re.g.id)}` : "#", re ? re.n : 0, re ? `titoli per ${esc(re.g.nome.split(" ").slice(-1)[0])}, il più vincente` : "", ""],
  ].map(([h, v, l]) => `<a class="stat" href="${h}"><span class="value">${v}</span><span class="label">${l}</span></a>`).join("");
  document.getElementById("filtri").innerHTML = pillole("tour", TOUR) + pillole("cat", CAT) +
    `<div class="gruppo-filtri"><button type="button" class="pill" data-k="ita" data-v="1" aria-pressed="false">🇮🇹 Con italiani</button></div>`;
  document.getElementById("filtri").addEventListener("click", (e) => {
    const b = e.target.closest(".pill[data-k]");
    if (!b) return;
    if (b.dataset.k === "ita") stato.ita = !stato.ita; else stato[b.dataset.k] = b.dataset.v;
    disegna();
  });
  document.getElementById("cerca").addEventListener("input", (e) => { stato.q = e.target.value; disegna(); });
  disegna();
}).catch(() => messaggioErrore(document.getElementById("elenco")));
