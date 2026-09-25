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
