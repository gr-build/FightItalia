import { fetchJSON, esc, montaPagina, dataBreve, aggiornatoIl, messaggioErrore } from "./common.js?v=202610110114";

montaPagina("notizie.html");
let notizie = [];
let fonte = "tutte";

function disegna() {
  const lista = notizie.filter((n) => fonte === "tutte" || n.fonte === fonte);
  document.getElementById("elenco").innerHTML = lista.length ? `<div class="lista-notizie">${lista.map((n) => `<a class="notizia" href="${esc(n.link)}" target="_blank" rel="noopener noreferrer">
    <b>${esc(n.titolo)}</b><small><span class="fonte">${esc(n.fonte)}</span> · ${esc(dataBreve(n.data))} · si apre il sito della testata</small></a>`).join("")}</div>` : `<div class="vuoto">Nessuna notizia.</div>`;
  document.querySelectorAll(".pill[data-f]").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.f === fonte)));
}

fetchJSON("data/notizie.json").then((d) => {
  notizie = d.notizie;
  document.getElementById("agg").textContent = aggiornatoIl(d.generato);
  const fonti = [...new Set(notizie.map((n) => n.fonte))].sort();
  document.getElementById("filtri").innerHTML = ["tutte", ...fonti].map((f) => `<button type="button" class="pill" data-f="${esc(f)}" aria-pressed="${f === fonte}">${f === "tutte" ? "Tutte le fonti" : esc(f)}</button>`).join("");
  document.getElementById("filtri").addEventListener("click", (e) => { const b = e.target.closest(".pill"); if (b) { fonte = b.dataset.f; disegna(); } });
  disegna();
}).catch(() => messaggioErrore(document.getElementById("elenco")));
