import { fetchJSON, renderChrome, icon, debounce, fotoDi, classeFoto } from "./common.js?v=202610181710";

// Gira sia in home sia in tutti-i-lottatori.html, che non ha statistiche ne' campioni in evidenza.
renderChrome(document.body.dataset.pagina || "database");
const haLista = !!document.getElementById("fighter-grid");  // la home non ha piu' la lista: i lottatori hanno la loro pagina
if (haLista) document.getElementById("search-icon").innerHTML = icon("search");

const ORDINE_CATEGORIE = [
  "Leggende (ex campioni)",
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

let roster = [];
let categoriaAttiva = null;
// Sul telefono la lista e' fatta di righe compatte (tutta la riga e' un tocco unico)
// e si allunga a piccoli passi con "Mostra altri": 665 schede alte tutte insieme
// rendevano la pagina lunghissima e pesante.
const telefono = window.matchMedia("(max-width: 900px)");
const PASSO = () => (telefono.matches ? 30 : 60);
let mostrati = PASSO();

function nomeBreveCategoria(cat) {
  if (!cat) return "—";
  return cat.replace(/\s*\([^)]*\)/, "");
}

function renderStatStrip() {
  const strip = document.getElementById("stat-strip");
  if (!strip) return;
  const categorie = new Set(roster.map((r) => r.categoria).filter((c) => ORDINE_CATEGORIE.includes(c)));
  strip.innerHTML = `
    <div class="stat"><div class="value">${roster.length}</div><div class="label">Lottatori</div></div>
    <div class="stat"><div class="value">${categorie.size}</div><div class="label">Categorie di peso</div></div>
  `;
}

function cardEvidenza(r) {
  const href = r.slug ? `lottatore.html?slug=${r.slug}` : "#";
  const url = fotoDi(r);
  const foto = url ? `<img src="${url}" alt="" onerror="this.parentElement.classList.add('senza-foto')" class="champ-foto${classeFoto(url)}">` : "";
  return `
    <a href="${href}" class="champ-card${url ? "" : " senza-foto"}" style="aspect-ratio:3/4;">
      ${foto}
      <div class="champ-overlay">
        <span class="champ-div">${nomeBreveCategoria(r.categoria)}</span>
        <div class="champ-nome-grande" style="font-size:16px;">${r.nome}</div>
      </div>
    </a>`;
}

const FILTRO_CAMPIONI = "__CAMPIONI__";

function renderPills() {
  const presenti = ORDINE_CATEGORIE.filter((c) => roster.some((r) => r.categoria === c));
  const cont = document.getElementById("category-pills");
  const pillCampioni = `<button class="pill" data-cat="${FILTRO_CAMPIONI}">🏆 Campioni (attuali ed ex)</button>`;
  cont.innerHTML = pillCampioni + presenti.map((c) => `<button class="pill" data-cat="${c}">${nomeBreveCategoria(c)}</button>`).join("");
  cont.querySelectorAll(".pill").forEach((btn) => {
    btn.addEventListener("click", () => {
      const cat = btn.dataset.cat;
      categoriaAttiva = categoriaAttiva === cat ? null : cat;
      cont.querySelectorAll(".pill").forEach((b) => b.classList.toggle("active", b.dataset.cat === categoriaAttiva));
      renderGrid();
    });
  });
}

function cardLottatore(r) {
  const eta = r.eta ? `<span>${icon("age")} ${r.eta} anni</span>` : "";
  const altezza = r.altezza ? `<span>${icon("ruler")} ${r.altezza}</span>` : "";
  const href = r.slug ? `lottatore.html?slug=${r.slug}` : null;
  const nome = href ? `<a href="${href}">${r.nome}</a>` : r.nome;
  const link = href ? `<a href="${href}">${icon("link")}</a>` : "";
  const badge = r.campione_attuale
    ? `<span class="tag numerato">🏆 Campione</span>`
    : r.ex_campione
    ? `<span class="tag numerato">🥊 Ex campione</span>`
    : "";
  const urlFoto = fotoDi(r);
  const foto = urlFoto
    ? `<img src="${urlFoto}" alt="" onerror="this.style.display='none'" class="card-foto${classeFoto(urlFoto)}">`
    : `<div class="card-foto card-foto-placeholder">${(r.nome || "?").charAt(0)}</div>`;
  return `
    <div class="fighter-card">
      <div class="top-row">
        ${foto}
        <div style="flex:1; min-width:0;">
          <div class="name">${nome}</div>
          ${r.soprannome ? `<div class="nickname">"${r.soprannome}"</div>` : ""}
          ${badge ? `<div style="margin-top:4px;">${badge}</div>` : ""}
        </div>
        <span class="tag">${nomeBreveCategoria(r.categoria)}</span>
      </div>
      <div class="meta-row">${eta}${altezza}</div>
      <div class="record">
        <div>
          <div class="value">${r.record_mma || "—"}</div>
        </div>
        <div class="last">${r.risultato_recente || ""} ${link}</div>
      </div>
    </div>`;
}

function rigaLottatore(r) {
  const href = r.slug ? `lottatore.html?slug=${r.slug}` : null;
  const urlFoto = fotoDi(r);
  const iniziale = (r.nome || "?").charAt(0);
  const foto = urlFoto
    ? `<img src="${urlFoto}" alt="" loading="lazy" onerror="this.remove()" class="fr-img${classeFoto(urlFoto)}">`
    : "";
  const medaglia = r.campione_attuale ? "🏆" : r.ex_campione ? "🥊" : "";
  const sotto = [nomeBreveCategoria(r.categoria), r.eta ? `${r.eta} anni` : ""].filter(Boolean).join(" · ");
  const tag = href ? "a" : "div";
  return `
    <${tag} class="fr"${href ? ` href="${href}"` : ""}>
      <span class="fr-foto"><span class="fr-iniziale">${iniziale}</span>${foto}</span>
      <span class="fr-testo">
        <span class="fr-nome">${medaglia ? medaglia + " " : ""}${r.nome}</span>
        <span class="fr-sub">${sotto}</span>
      </span>
      <span class="fr-record">${r.record_mma || "—"}</span>
    </${tag}>`;
}

function renderGrid(reset = true) {
  if (reset === true) mostrati = PASSO();
  const q = document.getElementById("search").value.trim().toLowerCase();
  // Le pillole delle categorie occupano spazio utile e su telefono spingono
  // i risultati sotto la piega: mentre si cerca per nome non servono (la
  // ricerca gia' guarda in tutte le categorie), quindi si nascondono.
  document.getElementById("category-pills").hidden = !!q;
  let filtrati = roster;
  // Senza ricerca o filtro attivo, mostriamo solo le vere categorie di peso:
  // le sezioni speciali (release, sospesi...) hanno etichette troppo lunghe
  // per le card e interessano solo chi cerca quel lottatore per nome.
  if (!q && !categoriaAttiva) filtrati = filtrati.filter((r) => ORDINE_CATEGORIE.includes(r.categoria));
  if (categoriaAttiva === FILTRO_CAMPIONI) filtrati = filtrati.filter((r) => r.campione_attuale || r.ex_campione);
  else if (categoriaAttiva) filtrati = filtrati.filter((r) => r.categoria === categoriaAttiva);
  if (q) filtrati = filtrati.filter((r) => r.nome.toLowerCase().includes(q));

  document.getElementById("result-count").textContent = `(${filtrati.length})`;
  const grid = document.getElementById("fighter-grid");

  if (!filtrati.length) {
    grid.innerHTML = `<div class="empty-state">Nessun lottatore trovato.</div>`;
    return;
  }
  const disegna = telefono.matches ? rigaLottatore : cardLottatore;
  grid.classList.toggle("lista-righe", telefono.matches);
  grid.innerHTML = filtrati.slice(0, mostrati).map(disegna).join("");
  const altri = document.getElementById("mostra-altri");
  if (altri) {
    const resto = filtrati.length - mostrati;
    altri.hidden = resto <= 0;
    if (resto > 0) altri.textContent = `Mostra altri ${Math.min(PASSO(), resto)} · ne restano ${resto}`;
  }
}

async function init() {
  roster = await fetchJSON("data/roster.json");

  renderStatStrip();
  if (haLista) {
    renderPills();
    renderGrid();
  }
  if (haLista) document.getElementById("search").addEventListener("input", debounce(() => renderGrid(true), 120));
  const altri = document.getElementById("mostra-altri");
  if (haLista && altri) altri.addEventListener("click", () => { mostrati += PASSO(); renderGrid(false); });
  if (haLista) telefono.addEventListener("change", () => renderGrid(true));

  if (!document.getElementById("in-evidenza")) return;
  const inEvidenza = ORDINE_CATEGORIE.map((cat) => roster.find((r) => r.categoria === cat && r.campione_attuale)).filter(Boolean).slice(0, 4);
  document.getElementById("in-evidenza").innerHTML = inEvidenza.map(cardEvidenza).join("");
  document.getElementById("riassunto-nota").innerHTML = `Campioni attuali per categoria — <a href="campioni.html" style="text-decoration:underline;">vedi tutti i campioni e le leggende →</a>`;
}

init();
