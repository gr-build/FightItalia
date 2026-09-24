// Utility condivise dai giochi (Chi e'?, Piu' o meno).
// Chi e'/Piu' o meno la importano con "?v=<data>": GitHub Pages tiene i file
// in cache 10 minuti e un gioco nuovo con questo file vecchio non partiva.
// Quando si cambia questo file, aggiornare il ?v= negli import e negli HTML.

import { fetchJSON } from "./common.js";

let cacheLottatori = null;

// data/giochi.json e' generato da build_data.genera_dati_giochi: un record
// compatto per lottatore (n nome, s slug, c categoria, g genere, p paese,
// b bandiera, e eta, h altezza, r allungo, v/l vittorie/sconfitte, ko, sub,
// f foto, ch campione, u ultimi 5 incontri [esito, avversario, metodo, evento]).
export async function caricaLottatori() {
  if (!cacheLottatori) cacheLottatori = await fetchJSON("data/giochi.json");
  return cacheLottatori;
}

// localStorage puo' non esserci (navigazione privata, cookie bloccati):
// i giochi devono funzionare lo stesso, solo senza memoria.
export function leggi(chiave, predefinito) {
  try {
    const v = localStorage.getItem(chiave);
    return v ? JSON.parse(v) : predefinito;
  } catch {
    return predefinito;
  }
}

export function scrivi(chiave, valore) {
  try {
    localStorage.setItem(chiave, JSON.stringify(valore));
  } catch {
    /* niente memoria, pazienza */
  }
}

export function iniziali(nome) {
  return (nome || "?").split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p[0]).join("").toUpperCase();
}

// Generatore pseudo-casuale con seme: stesso seme, stessa sequenza per tutti.
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

// Data di oggi in Italia (il lottatore del giorno cambia a mezzanotte italiana).
export function oggiItalia() {
  return new Intl.DateTimeFormat("sv-SE", { timeZone: "Europe/Rome" }).format(new Date());
}

export async function condividi(testo, bottone) {
  const originale = bottone.textContent;
  // Da telefono il menu di condivisione nativo (WhatsApp, Instagram...).
  if (navigator.share && matchMedia("(pointer: coarse)").matches) {
    try {
      await navigator.share({ text: testo });
      return;
    } catch {
      /* annullato o non permesso: si passa agli appunti */
    }
  }
  try {
    await navigator.clipboard.writeText(testo);
    bottone.textContent = "Copiato!";
  } catch {
    window.prompt("Copia il risultato:", testo);
  }
  setTimeout(() => (bottone.textContent = originale), 1800);
}

// Indirizzo pubblico da mettere nei risultati condivisi (come URL_GIOCO in
// gauntlet.js): da aggiornare al passaggio a fightitalia.it.
export const SITO = "https://gr-build.github.io/FightItalia/";

// Windows non disegna le bandiere emoji (mostra "US", "BR"...): dalla
// bandiera emoji si ricava il codice paese e si usa un'immagine.
export function bandiera(emoji) {
  const lettere = [...(emoji || "")].map((c) => c.codePointAt(0) - 0x1f1e6).filter((n) => n >= 0 && n < 26);
  if (lettere.length !== 2) return "";
  const codice = String.fromCharCode(...lettere.map((n) => 97 + n));
  return `<img class="bandiera" src="https://flagcdn.com/w40/${codice}.png" alt="" width="20" height="15" loading="lazy">`;
}

export const genere = (x) => (x.g === "F" ? "Donna" : "Uomo");
