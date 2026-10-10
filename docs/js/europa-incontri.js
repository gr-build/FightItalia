// Aiuti condivisi per le card degli eventi europei (data/europa/<org>-incontri.json,
// prodotto da build_europa_incontri.py). slug() deve restare identico a quello Python.
import { fetchJSON } from "./common.js?v=202610100416";

export function slug(testo) {
  return (testo || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}

export async function caricaIncontri(org) {
  try {
    return await fetchJSON(`data/europa/${org}-incontri.json`);
  } catch {
    return [];
  }
}

export function linkEvento(org, evento) {
  return `evento-europa.html?org=${org}&e=${evento.slug || slug(evento.evento)}`;
}

const SENZA_NOME = new Set(["", "tba", "tbd", "tbc"]);
export function linkLottatore(org, nome, slugNome) {
  if (SENZA_NOME.has((slugNome || "").toLowerCase())) return `<span>${nome || "Da annunciare"}</span>`;
  return `<a href="lottatore-europa.html?org=${org}&l=${slugNome}" style="color:inherit;text-decoration:underline;text-decoration-color:var(--accent);text-underline-offset:3px;">${nome}</a>`;
}

export function dataIt(iso, opzioni = { day: "numeric", month: "long", year: "numeric" }) {
  const d = new Date(iso + "T12:00:00");
  return isNaN(d) ? "" : d.toLocaleDateString("it-IT", opzioni);
}
