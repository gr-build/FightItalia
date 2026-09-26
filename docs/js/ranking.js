import { fetchJSON, renderChrome } from "./common.js?v=202609261139";

renderChrome("ranking");

// Ordine "di riconoscibilita'" per gli uomini (dai pesi leggeri, dove
// gira di piu' l'attenzione in Italia in questo periodo, ai massimi),
// stesso criterio per le donne.
const ORDINE_UOMINI = ["Flyweight", "Bantamweight", "Featherweight", "Lightweight", "Welterweight", "Middleweight", "Light Heavyweight", "Heavyweight"];
const ORDINE_DONNE = ["Strawweight", "Flyweight", "Bantamweight"];

// Stesso peso, stesso formato usato altrove sul sito (confronto.js,
// campioni.js): libbre e chili, cosi' si capisce la categoria anche senza
// conoscere i nomi inglesi a memoria.
const PESO = {
  "Heavyweight": "265 lb, 120 kg", "Light Heavyweight": "205 lb, 93 kg", "Middleweight": "185 lb, 84 kg",
  "Welterweight": "170 lb, 77 kg", "Lightweight": "155 lb, 70 kg", "Featherweight": "145 lb, 65 kg",
  "Bantamweight": "135 lb, 61 kg", "Flyweight": "125 lb, 56 kg", "Strawweight": "115 lb, 52 kg",
};

function rigaAtleta(x, principale = false) {
  const nome = x.nome || "";
  const contenuto = principale ? `${nome} <span class="rank-c">C</span>` : nome;
  return x.slug
    ? `<a class="rank-row${principale ? " rank-row-c" : ""}" href="lottatore.html?slug=${x.slug}"><span class="rank-pos">${principale ? "C" : x.pos}</span><span class="rank-nome">${contenuto}</span></a>`
    : `<div class="rank-row${principale ? " rank-row-c" : ""}"><span class="rank-pos">${principale ? "C" : x.pos}</span><span class="rank-nome">${contenuto}</span></div>`;
}

function cardDivisione(d) {
  const titolo = d.categoria || "Pound-for-Pound";
  const peso = d.categoria && PESO[d.categoria] ? ` <span class="rank-peso">(${PESO[d.categoria]})</span>` : "";
  return `
    <div class="rank-card${d.categoria ? "" : " rank-card-p4p"}">
      <div class="rank-card-titolo">${titolo}${peso}</div>
      ${d.campione ? rigaAtleta(d.campione, true) : ""}
      ${(d.classifica || []).map((x) => rigaAtleta(x)).join("")}
    </div>`;
}

function etichetta(d) {
  if (!d.categoria) return d.tipo === "p4p_donne" ? "Pound-for-Pound · Donne" : "Pound-for-Pound · Uomini";
  const peso = PESO[d.categoria] ? ` (${PESO[d.categoria]})` : "";
  return `${d.categoria}${peso}${d.tipo === "donne" ? " · Donne" : ""}`;
}

function chiave(d) {
  return `${d.tipo}|${d.categoria || ""}`;
}

async function init() {
  let dati;
  try {
    dati = await fetchJSON("data/classifiche.json");
  } catch {
    dati = null;
  }
  const divisioni = dati?.divisioni || [];
  if (!divisioni.length) {
    document.getElementById("rank-vuoto").hidden = false;
    document.querySelector(".rank-picker").hidden = true;
    return;
  }

  const peso = (d) => (d.tipo === "uomini" ? ORDINE_UOMINI : ORDINE_DONNE).indexOf(d.categoria);
  const ordinate = [
    ...divisioni.filter((d) => d.tipo === "p4p_uomini"),
    ...divisioni.filter((d) => d.tipo === "uomini").sort((a, b) => peso(a) - peso(b)),
    ...divisioni.filter((d) => d.tipo === "p4p_donne"),
    ...divisioni.filter((d) => d.tipo === "donne").sort((a, b) => peso(a) - peso(b)),
  ];

  const select = document.getElementById("rank-select");
  select.innerHTML = `
    <optgroup label="Uomini">
      ${ordinate.filter((d) => d.tipo === "p4p_uomini" || d.tipo === "uomini").map((d) => `<option value="${chiave(d)}">${etichetta(d)}</option>`).join("")}
    </optgroup>
    <optgroup label="Donne">
      ${ordinate.filter((d) => d.tipo === "p4p_donne" || d.tipo === "donne").map((d) => `<option value="${chiave(d)}">${etichetta(d)}</option>`).join("")}
    </optgroup>`;

  function render(k) {
    const d = ordinate.find((d) => chiave(d) === k);
    document.getElementById("rank-divisioni").innerHTML = d ? cardDivisione(d) : "";
  }

  // Di default i Pesi Gallo uomini: la categoria del main event di questa
  // settimana, un punto di partenza piu' interessante del primo della lista.
  const default_ = ordinate.find((d) => d.tipo === "uomini" && d.categoria === "Bantamweight") || ordinate[0];
  select.value = chiave(default_);
  render(select.value);
  select.addEventListener("change", () => render(select.value));

  const generato = dati.generato_il ? new Date(dati.generato_il).toLocaleDateString("it-IT", { day: "numeric", month: "long", year: "numeric" }) : "";
  document.getElementById("rank-nota").textContent = `Ranking ufficiale da ufc.com${generato ? ", aggiornato al " + generato : ""}. "C" indica il campione in carica; chi non ha ancora una scheda su MMA Oggi è mostrato senza link.`;
}

init();
