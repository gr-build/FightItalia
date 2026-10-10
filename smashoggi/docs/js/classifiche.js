import { fetchJSON, esc, montaPagina, messaggioErrore, avatar } from "./common.js?v=202610101009";

montaPagina("classifiche.html");

const q = new URLSearchParams(location.search);
const stato = { tour: q.get("tour") === "wta" ? "wta" : "atp", soloIta: false, cerca: "" };
const dati = {};

const norm = (t) => t.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

function disegna() {
  const c = dati[stato.tour];
  const righe = c.righe.filter((r) => (!stato.soloIta || r.paese === "ITA") && (!stato.cerca || norm(r.nome).includes(stato.cerca)));
  document.getElementById("elenco").innerHTML = righe.length ? `<div class="tabella">${righe.map((r) => {
    const delta = r.prec ? r.prec - r.pos : 0;
    const v = delta > 0 ? `<span class="var su" aria-label="salito di ${delta}">▲${delta}</span>` : delta < 0 ? `<span class="var giu" aria-label="sceso di ${-delta}">▼${-delta}</span>` : "";
    return `<a class="riga-class${r.paese === "ITA" ? " ita" : ""}" href="giocatore.html?id=${encodeURIComponent(r.id)}">
      <span class="pos">${r.pos}</span>${avatar(r)}
      <span class="chi"><b>${esc(r.nome)}${v}</b><small>${esc(r.paeseNome || r.paese || "")}${r.eta ? ` · ${r.eta} anni` : ""}</small></span>
      <span class="punti">${r.punti ?? "–"}<small>punti</small></span></a>`;
  }).join("")}</div>` : `<div class="vuoto">Nessun giocatore trovato.</div>`;
  document.getElementById("agg").textContent = c.aggiornata
    ? `Classifica aggiornata il ${new Intl.DateTimeFormat("it-IT", { timeZone: "Europe/Rome", day: "numeric", month: "long", year: "numeric" }).format(new Date(c.aggiornata))}. Primi 100.`
    : "Primi 100.";
  document.querySelectorAll("[data-tour]").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.tour === stato.tour)));
  document.querySelector("[data-ita]").setAttribute("aria-pressed", String(stato.soloIta));
}

Promise.all([fetchJSON("data/classifica-atp.json"), fetchJSON("data/classifica-wta.json")]).then(([atp, wta]) => {
  dati.atp = atp; dati.wta = wta;
  document.getElementById("filtri").addEventListener("click", (e) => {
    const b = e.target.closest("button");
    if (!b) return;
    if (b.dataset.tour) stato.tour = b.dataset.tour;
    if (b.hasAttribute("data-ita")) stato.soloIta = !stato.soloIta;
    disegna();
  });
  document.getElementById("cerca").addEventListener("input", (e) => { stato.cerca = norm(e.target.value.trim()); disegna(); });
  disegna();
}).catch(() => messaggioErrore(document.getElementById("elenco")));
