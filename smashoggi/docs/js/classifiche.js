import { fetchJSON, esc, montaPagina, messaggioErrore, avatar } from "./common.js?v=202610110114";

montaPagina("classifiche.html");

const q = new URLSearchParams(location.search);
const stato = { tour: q.get("tour") === "wta" ? "wta" : "atp", soloIta: false, cerca: "" };
const dati = {};

const norm = (t) => t.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

function disegna() {
  const c = dati[stato.tour];
  let righe = c.righe.filter((r) => (!stato.soloIta || r.paese === "ITA") && (!stato.cerca || norm(r.nome).includes(stato.cerca)));
  // podio: i primi tre in grande, quando non c'e' un filtro
  let podio = "";
  if (!stato.soloIta && !stato.cerca && righe.length > 3) {
    const [p1, p2, p3] = righe;
    const gradino = (r, n) => `<a class="podio-g g${n}${r.paese === "ITA" ? " ita" : ""}" href="giocatore.html?id=${encodeURIComponent(r.id)}">
      <span class="podio-foto">${r.foto ? `<img src="${esc(r.foto)}" alt="" loading="lazy">` : `<span>${esc(r.nome.split(" ").map((x) => x[0]).join("").slice(0, 2))}</span>`}<i>${n}</i></span>
      <b>${esc(r.nome.split(" ").slice(-1)[0])}</b><small>${esc(r.paese || "")} · ${(r.punti ?? 0).toLocaleString("it-IT")} pt</small>
      <span class="podio-base"></span></a>`;
    podio = `<div class="podio">${gradino(p2, 2)}${gradino(p1, 1)}${gradino(p3, 3)}</div>`;
    righe = righe.slice(3);
  }
  document.getElementById("elenco").innerHTML = podio + (righe.length ? `<div class="tabella">${righe.map((r) => {
    const delta = r.prec ? r.prec - r.pos : 0;
    const v = delta > 0 ? `<span class="var su" aria-label="salito di ${delta}">▲${delta}</span>` : delta < 0 ? `<span class="var giu" aria-label="sceso di ${-delta}">▼${-delta}</span>` : "";
    return `<a class="riga-class${r.paese === "ITA" ? " ita" : ""}" href="giocatore.html?id=${encodeURIComponent(r.id)}">
      <span class="pos">${r.pos}</span>${avatar(r)}
      <span class="chi"><b>${esc(r.nome)}${v}</b><small>${esc(r.paeseNome || r.paese || "")}${r.eta ? ` · ${r.eta} anni` : ""}</small></span>
      <span class="punti">${r.punti ?? "–"}<small>punti</small></span></a>`;
  }).join("")}</div>` : `<div class="vuoto">Nessun giocatore trovato.</div>`);
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
