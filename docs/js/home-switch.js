import { fetchJSON, slugDaLink } from "./common.js?v=202610181655";

// Riquadro "Prossimi eventi" della home (a destra sul computer, a carte da scorrere sul telefono): i prossimi 4 eventi
// programmati, con link alla scheda o a "Vedi tutti gli eventi" (eventi.html).
// In cima anche l'ultimo fight gia' disputato: senza, chi vuole i risultati
// di ieri sera non lo trova da qui (su richiesta di Giovanni).
const MESI = ["gen", "feb", "mar", "apr", "mag", "giu", "lug", "ago", "set", "ott", "nov", "dic"];

function dividi(ev) {
  const nome = ev.evento || "";
  const k = nome.indexOf(":");
  return k > 0 ? [nome.slice(0, k).trim(), nome.slice(k + 1).trim()] : [ev.tipo === "Numerato" ? "UFC" : "UFC Fight Night", nome];
}

function luogoBreve(ev) {
  const parti = String(ev.luogo || "").split(",").map((x) => x.trim()).filter(Boolean);
  if (!parti.length) return "";
  return parti.length > 1 ? `${parti[0]}, ${parti[parti.length - 1]}` : parti[0];
}

function carta(ev, risultato) {
  const d = new Date(ev.data);
  const href = ev.link ? `evento.html?slug=${slugDaLink(ev.link)}` : "eventi.html";
  const [kick, nome] = dividi(ev);
  const box = risultato
    ? `<span class="mini-data-box risultato"><b>✓</b><i>fatto</i></span>`
    : `<span class="mini-data-box"><b>${isNaN(d) ? "·" : d.getDate()}</b><i>${isNaN(d) ? "" : MESI[d.getMonth()]}</i></span>`;
  return `<a class="mini-evento${risultato ? " mini-evento-risultato" : ""}" href="${href}">
    ${box}
    <span class="mini-corpo">
      <span class="mini-kick">${risultato ? "Ultimo evento · risultati" : kick}</span>
      <span class="mini-nome">${nome || kick}</span>
      ${risultato ? `<span class="mini-esito" data-slug="${slugDaLink(ev.link)}">Risultati dell'evento →</span>` : `<span class="mini-luogo">${luogoBreve(ev)}</span>`}
    </span>
  </a>`;
}

// Sotto l'ultimo evento: chi ha vinto il main event e come (solo se l'esito e' chiaro: niente pareggi o no contest)
function esitoMain(incontri) {
  const m = incontri && incontri[0];
  const metodo = m && String(m.metodo || "").trim();
  if (!metodo || /draw|no contest/i.test(metodo)) return "";
  const breve = metodo.replace(/\s*\(.*$/, "").trim();
  const esc = (t) => String(t).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  return `<b>${esc(m.fighter1)}</b> batte ${esc(m.fighter2)} · ${esc(breve)}${m.round ? ` R${esc(m.round)}` : ""}`;
}

const cartaTutti = `<a class="mini-evento mini-tutti" href="eventi.html"><span class="mini-nome">Tutti gli eventi</span><span class="mini-luogo">anche i passati →</span></a>`;

fetchJSON("data/eventi.json")
  .then((eventi) => {
    const prossimi = eventi
      .filter((e) => e.stato === "programmato")
      .sort((a, b) => new Date(a.data) - new Date(b.data))
      .slice(0, 4);
    const [ultimoPassato] = eventi
      .filter((e) => e.stato === "passato")
      .sort((a, b) => new Date(b.data) - new Date(a.data));
    const box = document.getElementById("prossimi-mini");
    box.innerHTML =
      (ultimoPassato ? carta(ultimoPassato, true) : "") +
      (prossimi.length ? prossimi.map((e) => carta(e, false)).join("") + cartaTutti : `<p style="font-size:12px; color:var(--text-muted);">Nessun evento programmato trovato.</p>`);
    const esito = box.querySelector(".mini-esito");
    if (esito) {
      fetchJSON(`data/eventi/${esito.dataset.slug}.json`)
        .then((incontri) => { const t = esitoMain(incontri); if (t) esito.innerHTML = t; })
        .catch(() => {});
    }
  })
  .catch(() => {});
