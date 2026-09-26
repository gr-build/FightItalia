import { fetchJSON, renderChrome } from "./common.js?v=202609260950";

renderChrome("classifiche");

function rigaAtleta(x, principale = false) {
  const nome = x.nome || "";
  const contenuto = principale ? `${nome} <span class="rank-c">C</span>` : nome;
  return x.slug
    ? `<a class="rank-row${principale ? " rank-row-c" : ""}" href="lottatore.html?slug=${x.slug}"><span class="rank-pos">${principale ? "C" : x.pos}</span><span class="rank-nome">${contenuto}</span></a>`
    : `<div class="rank-row${principale ? " rank-row-c" : ""}"><span class="rank-pos">${principale ? "C" : x.pos}</span><span class="rank-nome">${contenuto}</span></div>`;
}

function cardDivisione(d) {
  return `
    <div class="rank-card">
      <div class="rank-card-titolo">${d.categoria}</div>
      ${d.campione ? rigaAtleta(d.campione, true) : ""}
      ${(d.classifica || []).map((x) => rigaAtleta(x)).join("")}
    </div>`;
}

function cardP4P(d) {
  return `
    <div class="rank-card rank-card-p4p">
      <div class="rank-card-titolo">Pound-for-Pound</div>
      ${(d.classifica || []).slice(0, 10).map((x) => rigaAtleta(x, x.pos === 1)).join("")}
    </div>`;
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
    return;
  }

  function render(genere) {
    document.getElementById("rank-p4p").innerHTML = divisioni
      .filter((d) => d.tipo === `p4p_${genere}`)
      .map(cardP4P)
      .join("");
    document.getElementById("rank-divisioni").innerHTML = divisioni
      .filter((d) => d.tipo === genere)
      .map(cardDivisione)
      .join("");
  }
  render("uomini");

  document.querySelectorAll(".org-tab").forEach((btn) => {
    btn.addEventListener("click", () => {
      document.querySelectorAll(".org-tab").forEach((b) => b.classList.toggle("active", b === btn));
      render(btn.dataset.genere);
    });
  });

  const generato = dati.generato_il ? new Date(dati.generato_il).toLocaleDateString("it-IT", { day: "numeric", month: "long", year: "numeric" }) : "";
  document.getElementById("rank-nota").textContent = `Classifiche ufficiali da ufc.com${generato ? ", aggiornate al " + generato : ""}. "C" indica il campione in carica; chi non ha ancora una scheda su MMA Oggi è mostrato senza link.`;
}

init();
