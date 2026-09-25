import { fetchJSON, renderChrome, icon, slugDaLink, newsSu, cardNewsBreve, fotoDi, classeFoto } from "./common.js?v=202609250816";
import { ORGANIZZAZIONI } from "./europa-data.js?v=202609250816";

renderChrome("campioni");

const ORDINE_CATEGORIE = [
  "Heavyweights (265lb, 120 kg)",
  "Light heavyweights (205 lb, 93 kg)",
  "Middleweights (185 lb, 84 kg)",
  "Welterweights (170 lb, 77 kg)",
  "Lightweights (155 lb, 70 kg)",
  "Featherweights (145 lb, 65 kg)",
  "Bantamweights (135 lb, 61 kg)",
  "Flyweights (125 lb, 56 kg)",
  "Women's bantamweights (135 lb, 61 kg)",
  "Women's flyweights (125 lb, 56 kg)",
  "Women's strawweights (115 lb, 52 kg)",
];

function nomeBreveCategoria(cat) {
  return (cat || "").replace(/\s*\([^)]*\)/, "");
}

function cardCampione(r) {
  const href = r.slug ? `lottatore.html?slug=${r.slug}` : "#";
  const url = fotoDi(r);
  const foto = url
    ? `<img src="${url}" alt="" onerror="this.parentElement.classList.add('senza-foto')" class="champ-foto${classeFoto(url)}">`
    : "";
  const iniziali = (r.nome || "?").split(/\s+/).slice(0, 2).map((p) => p[0]).join("");
  return `
    <a href="${href}" class="champ-card${url ? "" : " senza-foto"}">
      ${foto}
      <span class="champ-iniziali" aria-hidden="true">${iniziali}</span>
      <div class="champ-overlay">
        <span class="champ-div">${nomeBreveCategoria(r.categoria)}</span>
        <div class="champ-nome-grande">${r.nome}</div>
        <div class="champ-record-grande">${r.record_mma || ""}</div>
      </div>
    </a>`;
}

// Titoli senza campione e senza lottatrici nel roster (Wikipedia non ha una
// sezione per la categoria), quindi non ricavabili dai dati: vanno a mano.
const TITOLI_VACANTI = [
  { categoria: "Women's featherweights", peso: "145 lb, 66 kg", nota: "Ultima campionessa: Amanda Nunes, ritirata nel 2023" },
];

function cardVacante(t) {
  return `
    <div class="champ-card senza-foto vacante">
      <span class="champ-iniziali" aria-hidden="true">—</span>
      <div class="champ-overlay">
        <span class="champ-div">${t.categoria}</span>
        <div class="champ-nome-grande">Vacante</div>
        <div class="champ-record-grande">${t.peso} · ${t.nota}</div>
      </div>
    </div>`;
}

function cardLeggenda(r) {
  const href = r.slug ? `lottatore.html?slug=${r.slug}` : null;
  const urlFoto = fotoDi(r);
  const foto = urlFoto
    ? `<img src="${urlFoto}" alt="" onerror="this.style.display='none'" class="card-foto${classeFoto(urlFoto)}">`
    : `<div class="card-foto card-foto-placeholder">${(r.nome || "?").charAt(0)}</div>`;
  return `
    <div class="fighter-card">
      <div class="top-row">
        ${foto}
        <div style="flex:1; min-width:0;">
          <div class="name">${href ? `<a href="${href}">${r.nome}</a>` : r.nome}</div>
        </div>
      </div>
      <div class="record"><div><div class="value">${r.record_mma || "—"}</div></div></div>
    </div>`;
}

const MESI = ["gen", "feb", "mar", "apr", "mag", "giu", "lug", "ago", "set", "ott", "nov", "dic"];

function rigaEventoBreve(ev) {
  const d = new Date(ev.data);
  const luogo = [ev.sede, ev.luogo].filter(Boolean).join(" — ");
  return `
    <div class="event-row">
      <div class="event-date"><span class="day">${isNaN(d) ? "?" : d.getDate()}</span><span class="month">${isNaN(d) ? "" : MESI[d.getMonth()] + " " + d.getFullYear()}</span></div>
      <div class="event-main">
        <div class="name">${ev.evento}</div>
        ${luogo ? `<div class="venue">${icon("pin")} ${luogo}</div>` : ""}
      </div>
      ${ev.link ? `<a class="event-link" href="evento.html?slug=${slugDaLink(ev.link)}">Dettagli →</a>` : "<span></span>"}
    </div>`;
}

function cardOrgBreve(org) {
  return `
    <div class="org-card">
      <div class="org-head">
        <div>
          <h2>${org.nome}</h2>
          <div class="org-sub">${org.paese} · dal ${org.fondata}</div>
        </div>
        ${org.id ? `<a href="organizzazione.html?org=${org.id}" class="event-link">Roster →</a>` : ""}
      </div>
      <div class="champ-list">
        ${org.campioni
          .slice(0, 3)
          .map((c) => `<div class="champ-row"><span class="champ-cat">${c.categoria}</span><span class="champ-nome">${c.nome}</span></div>`)
          .join("")}
      </div>
    </div>`;
}

async function init() {
  const roster = await fetchJSON("data/roster.json");

  const campioni = ORDINE_CATEGORIE.map((cat) => roster.find((r) => r.categoria === cat && r.campione_attuale)).filter(Boolean);
  const donna = (r) => r.categoria.startsWith("Women's");
  document.getElementById("griglia-campioni").innerHTML = campioni.filter((r) => !donna(r)).map(cardCampione).join("");
  document.getElementById("griglia-campionesse").innerHTML = TITOLI_VACANTI.map(cardVacante).join("") + campioni.filter(donna).map(cardCampione).join("");

  // News che parlano dei campioni attuali, dalla piu' recente. Una notizia
  // che cita due campioni compare una volta sola.
  const news = await fetchJSON("data/news.json").then((d) => d.articoli || []).catch(() => []);
  const viste = new Set();
  const newsCampioni = [];
  campioni.forEach((c) => newsSu(c, news).forEach((a) => {
    if (!viste.has(a.url)) {
      viste.add(a.url);
      newsCampioni.push({ a, c });
    }
  }));
  newsCampioni.sort((x, y) => (y.a.pubblicato || "").localeCompare(x.a.pubblicato || ""));
  document.getElementById("news-campioni").innerHTML =
    newsCampioni.slice(0, 12).map(({ a, c }) => cardNewsBreve(a, c.nome)).join("") ||
    `<div class="empty-state">Nessuna notizia sui campioni in questo momento.</div>`;

  const leggende = roster.filter((r) => r.ex_campione);
  document.getElementById("griglia-leggende").innerHTML = leggende.map(cardLeggenda).join("");

  const eventi = await fetchJSON("data/eventi.json");
  const prossimi = eventi
    .filter((e) => e.stato === "programmato")
    .sort((a, b) => new Date(a.data) - new Date(b.data))
    .slice(0, 4);
  document.getElementById("anteprima-eventi").innerHTML = prossimi.map(rigaEventoBreve).join("");

  document.getElementById("anteprima-europa").innerHTML = ORGANIZZAZIONI.map(cardOrgBreve).join("");
}

init();
