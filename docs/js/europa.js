import { renderChrome } from "./common.js?v=202610100419";
import { ORGANIZZAZIONI } from "./europa-data.js?v=202610100419";
import { slug, caricaIncontri } from "./europa-incontri.js?v=202610100419";

renderChrome("europa");

function cardOrganizzazione(org) {
  return `
    <div class="org-card">
      <div class="org-head">
        <div>
          <h2>${org.nome}</h2>
          <div class="org-sub">${org.nomeCompleto} · ${org.paese} · dal ${org.fondata}</div>
        </div>
        ${org.id ? `<a href="organizzazione.html?org=${org.id}" class="event-link">Eventi e roster →</a>` : ""}
      </div>
      <p class="org-desc">${org.descrizione}</p>
      <div class="champ-list">
        ${org.campioni
          .map(
            (c) => `
          <div class="champ-row">
            <span class="champ-cat">${c.categoria}</span>
            <span class="champ-nome">${c.nome}</span>
          </div>`
          )
          .join("")}
      </div>
    </div>`;
}

document.getElementById("org-grid").innerHTML = ORGANIZZAZIONI.map(cardOrganizzazione).join("");

// Prossimi eventi di tutte le organizzazioni europee che hanno un calendario
// (data/europa/<id>-eventi.json, da Wikipedia): in ordine di data, con il nome
// dell'organizzazione e il link alla sua pagina. L'evento di oggi conta ancora
// come "prossimo" fino a mezzanotte.
async function prossimiEventi() {
  const inizioOggi = new Date();
  inizioOggi.setHours(0, 0, 0, 0);
  const righe = [];
  for (const org of ORGANIZZAZIONI.filter((o) => o.id)) {
    let eventi = [];
    try {
      const r = await fetch(`data/europa/${org.id}-eventi.json`);
      if (r.ok) eventi = await r.json();
    } catch {
      eventi = [];
    }
    const conCard = new Set((await caricaIncontri(org.id)).map((x) => x.slug));
    for (const e of eventi) {
      const d = new Date(e.data);
      if (!isNaN(d) && d >= inizioOggi) righe.push({ ...e, d, org, href: conCard.has(slug(e.evento)) ? `evento-europa.html?org=${org.id}&e=${slug(e.evento)}` : `organizzazione.html?org=${org.id}` });
    }
  }
  righe.sort((a, b) => a.d - b.d);
  const box = document.getElementById("europa-prossimi");
  document.getElementById("count-europa-prossimi").textContent = `(${righe.length})`;
  if (!righe.length) {
    box.innerHTML = `<div class="empty-state">Nessun evento europeo programmato trovato.</div>`;
    return;
  }
  box.innerHTML = righe
    .map((ev) => {
      const luogo = [ev.sede, ev.luogo].filter(Boolean).join(" — ").replace(/Italy/, "Italia");
      const mese = ev.d.toLocaleDateString("it-IT", { month: "short", year: "numeric" });
      return `
    <a class="event-row" style="align-items:start;text-decoration:none;color:inherit;" href="${ev.href}">
      <div class="event-date"><span class="day">${ev.d.getDate()}</span><span class="month">${mese}</span></div>
      <div class="event-main">
        <div class="name">${ev.evento} <span class="tag fight-night">${ev.org.nome}</span>${/italy/i.test(ev.luogo || "") ? ` <span class="tag numerato">In Italia</span>` : ""}</div>
        ${luogo ? `<div class="venue">${luogo}</div>` : ""}
      </div>
      <span></span>
    </a>`;
    })
    .join("");
}

prossimiEventi();
