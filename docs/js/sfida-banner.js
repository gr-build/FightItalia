// Fascia "Sfida del giorno" in home: numero della sfida e, se hai gia' giocato oggi, il tuo risultato.
import { leggi, oggiItalia } from "./giochi-comuni.js?v=202610181710";

const EPOCA = Date.UTC(2026, 9, 19); // come in sfida.js: sfida n. 1 = 19/10/2026
const box = document.getElementById("sfida-banner");

if (box) {
  const oggi = oggiItalia();
  const [a, m, g] = oggi.split("-").map(Number);
  const numero = Math.round((Date.UTC(a, m - 1, g) - EPOCA) / 86400000) + 1;
  const fatta = leggi(`sfida-${oggi}`, null);
  const giocata = fatta && Array.isArray(fatta.e);
  box.innerHTML = `
    <span class="sfida-banner-testo">
      <span class="sfida-banner-tag"><span>Sfida del giorno #${numero}</span><span>${giocata ? "Fatta ✓" : "Nuova oggi!"}</span></span>
      <h2>${giocata ? `Hai fatto ${fatta.p} su 5` : "Quante ne indovini su 5?"}</h2>
      <p>${giocata ? "Domani una nuova sfida. Intanto sfida un amico." : "Un minuto, gratis. Poi sfida un amico su WhatsApp."}</p>
    </span>
    <span class="sfida-banner-cta">${giocata ? "Vedi il risultato →" : "Gioca ora →"}</span>`;
}
