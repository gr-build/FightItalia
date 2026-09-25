import { fetchJSON, slugDaLink } from "./common.js?v=202609251318";

// Riquadro "Prossimi eventi" a destra della home: i prossimi 4 eventi
// programmati, con link alla scheda o a "Vedi tutti gli eventi" (eventi.html).
const MESI = ["gen", "feb", "mar", "apr", "mag", "giu", "lug", "ago", "set", "ott", "nov", "dic"];

function rigaMini(ev) {
  const d = new Date(ev.data);
  const data = isNaN(d) ? "" : `${d.getDate()} ${MESI[d.getMonth()]}`;
  const href = ev.link ? `evento.html?slug=${slugDaLink(ev.link)}` : "eventi.html";
  return `<a class="mini-evento" href="${href}"><div class="mini-data">${data}</div><div class="mini-nome">${ev.evento}</div></a>`;
}

fetchJSON("data/eventi.json")
  .then((eventi) => {
    const prossimi = eventi
      .filter((e) => e.stato === "programmato")
      .sort((a, b) => new Date(a.data) - new Date(b.data))
      .slice(0, 4);
    const box = document.getElementById("prossimi-mini");
    box.innerHTML = prossimi.length ? prossimi.map(rigaMini).join("") : `<p style="font-size:12px; color:var(--text-muted);">Nessun evento programmato trovato.</p>`;
  })
  .catch(() => {});
