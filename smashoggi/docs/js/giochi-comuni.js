// Utilita' condivise dai giochi di Smash Oggi: dati dei giocatori, memoria locale, giocatore del giorno, condivisione.
import { fetchJSON, esc } from "./common.js?v=202610110114";

// I giochi usano i primi 100 di ATP e WTA (data/giocatori.json, dati ESPN veri); la Griglia accetta tutti i classificati.
let cache;
export async function caricaTuttiGioco() {
  cache ??= fetchJSON("data/giocatori.json").then((g) => Object.values(g).filter((x) => x.nome));
  return cache;
}
export async function caricaGiocatoriGioco() {
  return (await caricaTuttiGioco()).filter((x) => x.pos && x.pos <= 100);
}
// mescola con un generatore dato (stesso seme, stesso ordine)
export function mescola(lista, r = Math.random) {
  const a = [...lista];
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
}

// La memoria del telefono puo' mancare (navigazione privata): i giochi funzionano lo stesso, senza record.
export function leggi(chiave, predefinito) {
  try { const v = localStorage.getItem(chiave); return v ? JSON.parse(v) : predefinito; } catch { return predefinito; }
}
export function scrivi(chiave, valore) {
  try { localStorage.setItem(chiave, JSON.stringify(valore)); } catch { /* niente memoria */ }
}

// Stesso seme, stessa sequenza: il giocatore del giorno e' uguale per tutti.
export function casualeConSeme(seme) {
  let a = seme >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const oggiItalia = () => new Intl.DateTimeFormat("sv-SE", { timeZone: "Europe/Rome" }).format(new Date());
// numero del giorno (cambia a mezzanotte italiana)
export const numeroGiorno = () => Math.round(new Date(`${oggiItalia()}T12:00:00Z`).getTime() / 864e5);

// Sceglie un elemento "del giorno": ordina per id per non dipendere dall'ordine della classifica.
export function delGiorno(lista, sale) {
  const ordinata = [...lista].sort((a, b) => String(a.id).localeCompare(String(b.id)));
  const r = casualeConSeme(numeroGiorno() * 7919 + sale);
  r(); r();
  return ordinata[Math.floor(r() * ordinata.length)];
}

// Senza accenti, maiuscolo: "Muchová" -> "MUCHOVA"
export const normale = (s) => (s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toUpperCase();

export async function condividi(testo, bottone) {
  const prima = bottone.textContent;
  try {
    if (navigator.share && matchMedia("(pointer: coarse)").matches) { await navigator.share({ text: testo }); return; }
    await navigator.clipboard.writeText(testo);
    bottone.textContent = "Copiato!";
  } catch { bottone.textContent = "Non riuscito"; }
  setTimeout(() => { bottone.textContent = prima; }, 1800);
}

// Casella di ricerca con suggerimenti (funziona uguale su iPhone e Android, senza <datalist>).
export function cercaGiocatore(contenitore, giocatori, alScelto, escludi = () => false) {
  contenitore.innerHTML = `<div class="cerca gioco-cerca"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="m20 20-4-4"/></svg>
    <input type="search" placeholder="Scrivi un nome…" aria-label="Scrivi il nome di un giocatore" autocomplete="off" autocapitalize="words" spellcheck="false"></div>
    <div class="suggerimenti" role="listbox"></div>`;
  const input = contenitore.querySelector("input"), box = contenitore.querySelector(".suggerimenti");
  const disegna = () => {
    const q = normale(input.value.trim());
    if (q.length < 2) { box.innerHTML = ""; return; }
    const trovati = giocatori.filter((g) => {
      if (escludi(g)) return false;
      const n = normale(g.nome);
      return n.startsWith(q) || n.split(/[\s-]+/).some((p) => p.startsWith(q));
    }).slice(0, 6);
    box.innerHTML = trovati.length ? trovati.map((g) => `<button type="button" role="option" data-id="${g.id}">${esc(g.nome)} <small>${g.tour.toUpperCase()} · ${esc(g.paese || "")}</small></button>`).join("")
      : `<div class="nota" style="padding:8px 4px">Nessun giocatore tra i primi 100 con questo nome.</div>`;
  };
  input.addEventListener("input", disegna);
  input.addEventListener("keydown", (e) => { if (e.key === "Enter") box.querySelector("button")?.click(); });
  box.addEventListener("click", (e) => {
    const b = e.target.closest("button[data-id]");
    if (!b) return;
    input.value = ""; box.innerHTML = "";
    alScelto(giocatori.find((g) => String(g.id) === b.dataset.id));
  });
  return input;
}
