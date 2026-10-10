import { renderChrome, fetchJSON } from "./common.js?v=202610102159";
import { ORGANIZZAZIONI } from "./europa-data.js?v=202610102159";
import { slug, caricaIncontri, linkEvento, linkLottatore, dataIt } from "./europa-incontri.js?v=202610102159";

renderChrome("europa");

function esito(b, io) {
  if (!b.vincitore) return null;
  return (b.vincitore === 1) === (io === 1) ? "V" : "S";
}

async function init() {
  const p = new URLSearchParams(location.search);
  const org = p.get("org");
  const l = p.get("l");
  const out = document.getElementById("pagina");
  const meta = ORGANIZZAZIONI.find((o) => o.id === org);
  const eventi = org ? await caricaIncontri(org) : [];
  const mie = [];
  let nome = null;
  for (const ev of eventi) {
    for (const s of ev.sezioni) {
      for (const b of s.incontri) {
        const io = b.f1_slug === l ? 1 : b.f2_slug === l ? 2 : 0;
        if (!io) continue;
        nome = nome || (io === 1 ? b.f1 : b.f2);
        mie.push({ ev, b, io });
      }
    }
  }
  if (!nome) {
    out.innerHTML = `<div class="empty-state">Lottatore non trovato. <a href="europa.html">Torna a Europa</a>.</div>`;
    return;
  }
  let roster = [];
  try { roster = await fetchJSON(`data/europa/${org}-roster.json`); } catch { roster = []; }
  const r = roster.find((x) => slug((x.nome || "").replace(/\s*\((?:c|ic)\)\s*/i, "")) === l);
  document.title = `${nome} — MMA Oggi`;
  const oggi = new Date().toISOString().slice(0, 10);
  const prossimi = mie.filter((m) => m.ev.data && m.ev.data >= oggi).sort((a, b) => a.ev.data.localeCompare(b.ev.data));
  const passati = mie.filter((m) => !(m.ev.data && m.ev.data >= oggi)).sort((a, b) => (b.ev.data || "").localeCompare(a.ev.data || ""));
  const riga = (m) => {
    const avv = m.io === 1 ? m.b : m.b;
    const nomeAvv = m.io === 1 ? m.b.f2 : m.b.f1;
    const slugAvv = m.io === 1 ? m.b.f2_slug : m.b.f1_slug;
    const e = esito(m.b, m.io);
    const mese = m.ev.data ? dataIt(m.ev.data, { day: "numeric", month: "short", year: "numeric" }) : "";
    return `
    <div class="event-row" style="display:block;">
      <div class="event-main">
        <div class="name">${e ? (e === "V" ? "✅ Vittoria" : "❌ Sconfitta") + " contro " : "Contro "}${linkLottatore(org, nomeAvv, slugAvv)}</div>
        <div class="venue"><a href="${linkEvento(org, m.ev)}" style="color:inherit;">${m.ev.evento}</a> · ${mese}${e && m.b.metodo ? " · " + m.b.metodo + (m.b.round ? ` (R${m.b.round}${m.b.tempo ? " " + m.b.tempo : ""})` : "") : ""}</div>
      </div>
    </div>`;
  };
  const dati = [
    r && r["MMA record"] ? ["Record MMA", r["MMA record"]] : null,
    r && (r["KSW record"] || r["Oktagon record"]) ? [`Record ${meta ? meta.nome : ""}`, r["KSW record"] || r["Oktagon record"]] : null,
    r && r.Paese ? ["Paese", r.Paese] : null,
    r && r.Nickname ? ["Soprannome", r.Nickname] : null,
  ].filter(Boolean);
  out.innerHTML = `
    <section class="hero" style="padding:44px 0 24px; border-bottom:none;">
      <p style="margin:0 0 6px;"><a href="organizzazione.html?org=${org}">← ${meta ? meta.nome : org.toUpperCase()}</a></p>
      <h1 style="font-size:clamp(28px,4vw,42px);">${nome}</h1>
      <p>${meta ? meta.nome : ""}${r && r.categoria ? " · " + r.categoria.replace(/\bIb\b/g, "lb").replace(/\s*\([^)]*\)/, "") : ""}</p>
      ${dati.length ? `<div class="stat-strip">${dati.map(([k, v]) => `<div class="stat"><div class="value" style="font-size:20px;">${v}</div><div class="label">${k}</div></div>`).join("")}</div>` : ""}
    </section>
    ${prossimi.length ? `<div class="section-title" style="margin-top:24px;">Prossimo incontro</div>${prossimi.map(riga).join("")}` : ""}
    <div class="section-title" style="margin-top:24px;">Incontri noti <span class="count">(${passati.length})</span></div>
    ${passati.length ? passati.map(riga).join("") : '<div class="empty-state">Nessun incontro passato nei dati (2025–2026).</div>'}
    <p style="margin:14px 0 60px; font-size:12px; color:var(--text-muted);">Dati da Wikipedia sugli eventi 2025–2026: la carriera completa non è inclusa.</p>`;
}
init();
