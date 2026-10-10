import { fetchJSON, slugDaLink } from "./common.js?v=202610100416";

// Riquadro "Prossimo evento UFC" in cima alla home, con il conto alla rovescia
// (come il timer del prossimo GP su gpoggi.it). Parte dalla prima fascia della
// serata (early prelims o prelims, ora italiana) e passa a "In corso" fino a
// poco dopo l'inizio della main card; poi mostra l'evento successivo.
// Gli orari vengono da data/eventi.json (campo "orari", ora italiana).

const SEGMENTI = [
  ["early_prelims", "Early prelims"],
  ["prelims", "Prelims"],
  ["main_card", "Main card"],
];
const DURATA_MAIN_MS = 3.5 * 36e5; // oltre questo dopo l'inizio della main card l'evento e' finito

const fmtRoma = new Intl.DateTimeFormat("en-US", {
  timeZone: "Europe/Rome", hourCycle: "h23", year: "numeric", month: "numeric", day: "numeric", hour: "numeric", minute: "numeric",
});
function offsetRoma(t) {
  const p = Object.fromEntries(fmtRoma.formatToParts(new Date(t)).map((x) => [x.type, x.value]));
  return Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour, +p.minute) - t;
}
// ora italiana (anno, mese 1-12, giorno, ore, minuti) -> millisecondi UTC, con ora legale
function romaInUtc(y, m, d, hh, mm) {
  const voluto = Date.UTC(y, m - 1, d, hh, mm);
  let t = voluto - offsetRoma(voluto);
  t = voluto - offsetRoma(t);
  return t;
}

function segmentiEvento(ev) {
  const base = new Date(ev.data);
  if (isNaN(base) || !ev.orari) return [];
  const out = [];
  for (const [chiave, etichetta] of SEGMENTI) {
    const o = ev.orari[chiave];
    if (!o || !o.italia || !/^\d{1,2}:\d{2}$/.test(o.italia)) continue;
    const [hh, mm] = o.italia.split(":").map(Number);
    const g = new Date(Date.UTC(base.getFullYear(), base.getMonth(), base.getDate() + (o.giorno_dopo ? 1 : 0)));
    out.push({ chiave, etichetta, inizio: romaInUtc(g.getUTCFullYear(), g.getUTCMonth() + 1, g.getUTCDate(), hh, mm) });
  }
  return out.sort((a, b) => a.inizio - b.inizio);
}

const conto = (diff) => {
  const g = Math.floor(diff / 864e5), h = Math.floor(diff / 36e5) % 24, m = Math.floor(diff / 6e4) % 60, s = Math.floor(diff / 1e3) % 60, d = (n) => String(n).padStart(2, "0");
  return g > 0 ? `${g}g ${d(h)}h ${d(m)}m ${d(s)}s` : `${d(h)}h ${d(m)}m ${d(s)}s`;
};
const quando = (t) =>
  new Date(t).toLocaleString("it-IT", { timeZone: "Europe/Rome", weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }).replace(",", " ·");
const ora = (t) => new Date(t).toLocaleTimeString("it-IT", { timeZone: "Europe/Rome", hour: "2-digit", minute: "2-digit" });
const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

async function init() {
  const box = document.getElementById("countdown-evento");
  if (!box) return;
  let eventi = [];
  try { eventi = await fetchJSON("data/eventi.json"); } catch { return; }
  const adesso = Date.now();
  const prossimo = eventi
    .filter((e) => e.stato === "programmato")
    .map((e) => ({ e, seg: segmentiEvento(e) }))
    .filter((x) => x.seg.length)
    .map((x) => ({ ...x, primo: x.seg[0].inizio, fine: x.seg[x.seg.length - 1].inizio + DURATA_MAIN_MS }))
    .filter((x) => x.fine > adesso)
    .sort((a, b) => a.primo - b.primo)[0];
  if (!prossimo) return;
  const { e, seg, primo } = prossimo;
  const luogo = [e.sede, e.luogo].filter(Boolean).join(" — ").replace(/\s+,/g, ",");
  const indicativo = e.orari && e.orari.indicativo;
  box.href = e.link ? `evento.html?slug=${slugDaLink(e.link)}` : "eventi.html";
  box.innerHTML = `
    <span class="cd-kicker">Prossimo evento UFC</span>
    <strong class="cd-nome">${esc(e.evento)}</strong>
    <span class="cd-luogo">${esc(luogo)}</span>
    <span class="cd-orari">${seg.map((s) => `<span>${s.etichetta} <b>${esc(quando(s.inizio))}</b></span>`).join("")}</span>
    <span class="cd-timer" role="timer"></span>
    ${indicativo ? '<span class="cd-nota">Orari indicativi, ora italiana</span>' : '<span class="cd-nota">Ora italiana</span>'}`;
  box.hidden = false;
  const t = box.querySelector(".cd-timer");
  const aggiorna = () => {
    const diff = primo - Date.now();
    t.textContent = diff > 0 ? conto(diff) : "In corso";
    t.classList.toggle("live", diff <= 0);
  };
  aggiorna();
  setInterval(aggiorna, 1000);
}
init();
