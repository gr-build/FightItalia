// Tennisti: tutti i giocatori che ricaviamo dai dati, con ricerca e filtri.
import { esc, montaPagina, caricaGiocatori, avatar, messaggioErrore } from "./common.js?v=202610101452";
import { normale } from "./giochi-comuni.js?v=202610101452";

montaPagina("tennisti.html");

const stato = { tour: "tutti", gruppo: "tutti", ordine: "classifica", q: "" };
const TOUR = [["tutti", "Tutti"], ["atp", "Uomini"], ["wta", "Donne"]];
const GRUPPI = [["tutti", "Tutti"], ["ita", "🇮🇹 Italiani"], ["top", "Primi 150"], ["titoli", "Hanno vinto un titolo quest'anno"], ["challenger", "Challenger"], ["mancini", "Mancini"]];
const ORDINE = [["classifica", "Classifica"], ["az", "A–Z"], ["titoli", "Titoli in carriera"], ["giovani", "Più giovani"]];
const PASSO = 60;
let tutti = [], quanti = PASSO;

const pillole = (k, voci) => `<div class="gruppo-filtri" role="group">${voci.map(([v, t]) =>
  `<button type="button" class="pill" data-k="${k}" data-v="${esc(v)}" aria-pressed="${stato[k] === v}">${esc(t)}</button>`).join("")}</div>`;

const scheda = (g) => `<a class="tennista" href="giocatore.html?id=${encodeURIComponent(g.id)}">
    ${avatar(g, true)}
    <span class="tn-chi"><b>${esc(g.nome)}</b><small>${esc(g.paeseNome || g.paese || "")}${g.eta ? ` · ${g.eta} anni` : ""}</small></span>
    <span class="tn-pos">${g.pos ? `<b>${g.pos}</b><small>${g.tour.toUpperCase()}</small>` : `<small>${g.tour.toUpperCase()}</small>`}</span></a>`;

function disegna() {
  const q = normale(stato.q.trim());
  const lista = tutti.filter((g) => (stato.tour === "tutti" || g.tour === stato.tour)
    && (stato.gruppo === "tutti" || (stato.gruppo === "ita" && g.paese === "ITA") || (stato.gruppo === "top" && g.pos)
      || (stato.gruppo === "titoli" && g.titoliAnno) || (stato.gruppo === "challenger" && (g.titoliChallenger || g.soloChallenger)) || (stato.gruppo === "mancini" && g.mano === "Sinistra"))
    && (!q || normale(`${g.nome} ${g.paeseNome || ""} ${g.paese || ""}`).includes(q)));
  const cmp = {
    classifica: (a, b) => (a.pos || 999) - (b.pos || 999) || a.nome.localeCompare(b.nome),
    az: (a, b) => (a.cognome || a.nome).localeCompare(b.cognome || b.nome, "it"),
    titoli: (a, b) => (b.titoli || 0) - (a.titoli || 0) || (a.pos || 999) - (b.pos || 999),
    giovani: (a, b) => (a.eta || 99) - (b.eta || 99) || (a.pos || 999) - (b.pos || 999),
  }[stato.ordine];
  lista.sort(cmp);
  document.getElementById("conta").textContent = `${lista.length} tennisti`;
  document.getElementById("elenco").innerHTML = lista.length
    ? lista.slice(0, quanti).map(scheda).join("") + (lista.length > quanti ? `<button type="button" class="pill altri" id="altri">Mostra altri ${Math.min(PASSO, lista.length - quanti)}</button>` : "")
    : `<div class="vuoto">Nessun tennista trovato.</div>`;
  document.getElementById("altri")?.addEventListener("click", () => { quanti += PASSO; disegna(); });
  document.querySelectorAll(".pill[data-k]").forEach((b) => b.setAttribute("aria-pressed", String(stato[b.dataset.k] === b.dataset.v)));
}

caricaGiocatori().then((g) => {
  tutti = Object.values(g).filter((x) => x.nome);
  const q = new URLSearchParams(location.search).get("q");
  if (q) { stato.q = q; document.getElementById("cerca").value = q; }
  document.getElementById("filtri").innerHTML = pillole("tour", TOUR) + pillole("gruppo", GRUPPI) + `<div class="gruppo-filtri"><span class="nota" style="margin:0">Ordina:</span>${ORDINE.map(([v, t]) =>
    `<button type="button" class="pill" data-k="ordine" data-v="${v}" aria-pressed="${stato.ordine === v}">${t}</button>`).join("")}</div>`;
  document.getElementById("filtri").addEventListener("click", (e) => {
    const b = e.target.closest(".pill[data-k]");
    if (!b) return;
    stato[b.dataset.k] = b.dataset.v; quanti = PASSO;
    disegna();
  });
  document.getElementById("cerca").addEventListener("input", (e) => { stato.q = e.target.value; quanti = PASSO; disegna(); });
  disegna();
}).catch(() => messaggioErrore(document.getElementById("elenco")));
