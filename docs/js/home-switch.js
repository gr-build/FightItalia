import { fetchJSON, slugDaLink } from "./common.js?v=202609251251";

// Switch fra le due viste della home (Eventi di default, Lottatori a
// richiesta). eventi.js e roster.js girano entrambi al caricamento della
// pagina e riempiono i rispettivi contenitori; qui mostriamo/nascondiamo
// solo il blocco giusto, senza rifare nessuna richiesta.
const btnEventi = document.getElementById("switch-eventi");
const btnLottatori = document.getElementById("switch-lottatori");
const vistaEventi = document.getElementById("vista-eventi");
const vistaLottatori = document.getElementById("vista-lottatori");

function mostra(vista) {
  const suEventi = vista === "eventi";
  vistaEventi.hidden = !suEventi;
  vistaLottatori.hidden = suEventi;
  btnEventi.classList.toggle("active", suEventi);
  btnLottatori.classList.toggle("active", !suEventi);
  btnEventi.setAttribute("aria-selected", suEventi);
  btnLottatori.setAttribute("aria-selected", !suEventi);
}

btnEventi.addEventListener("click", () => mostra("eventi"));
btnLottatori.addEventListener("click", () => mostra("lottatori"));

// Riquadro "Prossimi eventi" nella vista Lottatori: stessa data di
// eventi.js, ma una richiesta a parte (piccola, data/eventi.json e' gia'
// in cache del browser dopo il primo caricamento della vista Eventi).
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
    box.innerHTML = prossimi.length ? prossimi.map(rigaMini).join("") : `<p class="note" style="font-size:12px; color:var(--text-muted);">Nessun evento programmato trovato.</p>`;
  })
  .catch(() => {});

document.getElementById("vedi-tutti-eventi").addEventListener("click", () => mostra("eventi"));
