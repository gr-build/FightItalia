import { renderChrome } from "./common.js?v=202610110106";
import { ORGANIZZAZIONI } from "./europa-data.js?v=202610110106";
import { caricaIncontri, linkLottatore, dataIt } from "./europa-incontri.js?v=202610110106";

renderChrome("europa");

function pulisciCategoria(cat) {
  return (cat || "").replace(/\bIb\b/g, "lb");
}

function rigaIncontro(org, b) {
  const campione = (b.campione1 || b.campione2) ? " 🏆" : "";
  const risultato = b.vincitore
    ? `<div class="risultato-riga"><b>${b.vincitore === 1 ? b.f1 : b.f2}</b> batte ${b.vincitore === 1 ? b.f2 : b.f1}${b.metodo ? " — " + b.metodo : ""}${b.round ? ` (R${b.round}${b.tempo ? " " + b.tempo : ""})` : ""}</div>`
    : "";
  return `
    <div class="event-row" style="display:block;">
      <div class="event-main">
        <div class="name">${linkLottatore(org, b.f1 + (b.campione1 ? " (c)" : ""), b.f1_slug)} <span style="color:var(--accent);">vs</span> ${linkLottatore(org, b.f2 + (b.campione2 ? " (c)" : ""), b.f2_slug)}${campione}</div>
        <div class="venue">${pulisciCategoria(b.categoria)}${b.note ? " · " + b.note : ""}</div>
        ${risultato}
      </div>
    </div>`;
}

async function init() {
  const p = new URLSearchParams(location.search);
  const org = p.get("org");
  const idEvento = p.get("e");
  const out = document.getElementById("pagina");
  const meta = ORGANIZZAZIONI.find((o) => o.id === org);
  const eventi = org ? await caricaIncontri(org) : [];
  const ev = eventi.find((e) => e.slug === idEvento);
  if (!ev) {
    out.innerHTML = `<div class="empty-state">Evento non trovato. <a href="europa.html">Torna a Europa</a>.</div>`;
    return;
  }
  document.title = `${ev.evento} — MMA Oggi`;
  const luogo = [ev.sede, ev.luogo].filter(Boolean).join(" — ").replace(/Italy/, "Italia");
  const inItalia = /italy/i.test(ev.luogo || "");
  out.innerHTML = `
    <section class="hero" style="padding:44px 0 24px; border-bottom:none;">
      <p style="margin:0 0 6px;"><a href="organizzazione.html?org=${org}">← ${meta ? meta.nome : org.toUpperCase()}</a></p>
      <h1 style="font-size:clamp(26px,4vw,40px);">${ev.evento}</h1>
      <p>${ev.data ? dataIt(ev.data) : ""}${luogo ? " · " + luogo : ""}${inItalia ? ' <span class="tag numerato">In Italia</span>' : ""}</p>
    </section>
    ${ev.sezioni.map((s) => `
      <div class="section-title" style="margin-top:24px;">${s.nome} <span class="count">(${s.incontri.length})</span></div>
      ${s.incontri.map((b) => rigaIncontro(org, b)).join("")}`).join("")}
    <p style="margin:14px 0 60px; font-size:12px; color:var(--text-muted);">Card da Wikipedia: può cambiare fino al giorno dell'evento.</p>`;
}
init();
