import { partiteLive } from "./live.js?v=202610101053";
import { fetchJSON, esc, montaPagina, caricaGiocatori, listaPartite, punteggioPartita, giornoRoma, oggiRoma, dataSolo, messaggioErrore } from "./common.js?v=202610101053";

montaPagina("partite.html");

const stato = { giorno: null, filtro: "tutti" };
let principali = [], giocatori = {};
const FILTRI = [["tutti", "Tutte"], ["atp", "ATP"], ["wta", "WTA"], ["ita", "Solo italiani"]];

function etichettaGiorno(g, oggi) {
  const diff = Math.round((dataSolo(g) - dataSolo(oggi)) / 864e5);
  if (diff === 0) return "Oggi";
  if (diff === -1) return "Ieri";
  if (diff === 1) return "Domani";
  return new Intl.DateTimeFormat("it-IT", { timeZone: "UTC", weekday: "short", day: "numeric", month: "short" }).format(dataSolo(g));
}

const sposta = (g, n) => { const d = dataSolo(g); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };

function disegna(oggi, minimo, massimo) {
  const fmt = (o) => new Intl.DateTimeFormat("it-IT", { timeZone: "UTC", day: "numeric", ...o }).format(dataSolo(stato.giorno));
  const breve = etichettaGiorno(stato.giorno, oggi);
  document.getElementById("g-etichetta").textContent = /^[A-Z]/.test(breve) ? `${breve} · ${fmt({ weekday: "short", month: "short" })}` : fmt({ weekday: "long", month: "long" });
  const inp = document.getElementById("g-data");
  inp.value = stato.giorno; inp.min = minimo; inp.max = massimo;
  document.getElementById("g-prec").disabled = stato.giorno <= minimo;
  document.getElementById("g-succ").disabled = stato.giorno >= massimo;
  document.getElementById("g-oggi").setAttribute("aria-pressed", String(stato.giorno === oggi));
  document.getElementById("filtri").innerHTML = FILTRI.map(([v, t]) => `<button type="button" class="pill" data-f="${v}" aria-pressed="${v === stato.filtro}">${t}</button>`).join("");
  const lista = principali.filter((p) => giornoRoma(p.data) === stato.giorno && (stato.filtro === "tutti" ||
    (stato.filtro === "ita" ? p.giocatori.some((g) => g.paese === "ITA") : p.tour === stato.filtro)))
    .sort((a, b) => (a.torneo + a.tour).localeCompare(b.torneo + b.tour) || punteggioPartita(b, giocatori) - punteggioPartita(a, giocatori) || (a.data < b.data ? -1 : 1));
  document.getElementById("elenco").innerHTML = lista.length ? `<div class="griglia-partite">${listaPartite(lista, giocatori)}</div>` : `<div class="vuoto">Nessuna partita in questo giorno con questi filtri.</div>`;
}

let ridisegna = () => {};
Promise.all([partiteLive((tutte) => { principali = tutte.filter((p) => !p.qualifica); ridisegna(); }), caricaGiocatori()]).then(([{ partite }, g]) => {
  giocatori = g;
  principali = partite.filter((p) => !p.qualifica);
  const oggi = oggiRoma();
  const giorni = [...new Set(principali.map((p) => giornoRoma(p.data)))].sort();
  const minimo = giorni[0] < oggi ? giorni[0] : oggi, massimo = giorni[giorni.length - 1] > oggi ? giorni[giorni.length - 1] : oggi;
  const dalLink = new URLSearchParams(location.search).get("giorno");
  stato.giorno = dalLink && dalLink >= minimo && dalLink <= massimo ? dalLink : oggi;
  ridisegna = () => disegna(oggi, minimo, massimo);
  const vai = (gg) => { if (gg >= minimo && gg <= massimo) { stato.giorno = gg; ridisegna(); } };
  document.getElementById("g-prec").addEventListener("click", () => vai(sposta(stato.giorno, -1)));
  document.getElementById("g-succ").addEventListener("click", () => vai(sposta(stato.giorno, 1)));
  document.getElementById("g-oggi").addEventListener("click", () => vai(oggi));
  document.getElementById("g-data").addEventListener("change", (e) => e.target.value && vai(e.target.value));
  document.getElementById("filtri").addEventListener("click", (e) => {
    const b = e.target.closest(".pill[data-f]");
    if (!b) return;
    stato.filtro = b.dataset.f;
    ridisegna();
  });
  ridisegna();
}).catch(() => messaggioErrore(document.getElementById("elenco")));
