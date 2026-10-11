// Riga di una finale dell'archivio: usata dalla pagina Archivio e dalle schede dei giocatori.
import { esc, etichettaCategoria, intervalloDate, superficie } from "./common.js?v=202610110114";

export const punteggioFinale = (a) => a.punteggioTesto ?? a.punteggio.map(([v, f, tb]) => `${v}-${f}${tb !== undefined ? `(${tb})` : ""}`).join(" ")
  + (a.speciale === "Ritiro" ? " rit." : a.speciale === "Walkover" ? " w.o." : "");

const persona = (g, cls, evidenzia) => `<a class="af-persona ${cls}${g.id === evidenzia ? " lui" : ""}${g.paese === "ITA" ? " ita" : ""}" href="giocatore.html?id=${encodeURIComponent(g.id)}">
    <span class="codice">${esc(g.paese || "–")}</span><span class="af-nome">${esc(g.nome)}</span></a>`;

export function rigaFinale(a, evidenzia) {
  const cat = etichettaCategoria(a);
  return `<article class="af">
    <div class="af-testa"><a class="af-torneo" href="${a.challenger ? `torneo.html?ch=${encodeURIComponent(a.torneoId)}` : `torneo.html?tour=${a.tour}&id=${encodeURIComponent(a.torneoId)}`}">${esc(a.nome)}</a>
      <span class="af-data">${esc(intervalloDate(a.inizio, a.fine))}</span></div>
    <div class="af-sub"><span class="tag ${cat.classe}">${esc(cat.testo)}</span>${esc(a.tour === "atp" ? "Uomini" : "Donne")}${a.superficie ? ` · ${superficie(a.superficie)}` : ""}${a.citta ? ` · ${esc(a.citta)}` : ""}</div>
    <div class="af-righe">
      <div class="af-riga"><span class="af-coppa" aria-label="Vincitore" title="Vincitore">🏆</span>${persona(a.vincitore, "vince", evidenzia)}<span class="af-punteggio">${esc(punteggioFinale(a))}</span></div>
      <div class="af-riga"><span class="af-coppa" aria-label="Finalista" title="Finalista">🥈</span>${persona(a.finalista, "", evidenzia)}</div>
    </div></article>`;
}
