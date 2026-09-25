import { fetchJSON, renderChrome, debounce } from "./common.js?v=202609251306";
import { ORGANIZZAZIONI } from "./europa-data.js?v=202609251306";

renderChrome("europa");

function pulisciCategoria(cat) {
  if (!cat) return "—";
  return cat.replace(/\bIb\b/g, "lb").replace(/\s*\([^)]*\)/, "");
}

function cardLottatoreOrg(r) {
  const record = r["MMA record"] || r["MMA Record"] || "—";
  const recordOrg = r["KSW record"] || r["Oktagon record"] || null;
  const campione = /\((c|ic)\)/i.test(r.nome || "");
  const nomePulito = (r.nome || "").replace(/\s*\((c|ic)\)\s*/i, "");
  return `
    <div class="fighter-card">
      <div class="top-row">
        <div>
          <div class="name">${nomePulito}${campione ? " 🏆" : ""}</div>
          ${r.Nickname ? `<div class="nickname">"${r.Nickname}"</div>` : ""}
        </div>
        <span class="tag">${pulisciCategoria(r.categoria)}</span>
      </div>
      <div class="meta-row">${r.Paese ? `<span>${r.Paese}</span>` : ""}</div>
      <div class="record">
        <div><div class="value">${record}</div></div>
        ${recordOrg ? `<div class="last">Nell'organizzazione: ${recordOrg}</div>` : ""}
      </div>
    </div>`;
}

function rigaEventoOrg(ev) {
  const luogo = [ev.sede, ev.luogo].filter(Boolean).join(" — ");
  const d = new Date(ev.data);
  const giorno = isNaN(d) ? "?" : d.getDate();
  const mese = isNaN(d) ? "" : d.toLocaleDateString("it-IT", { month: "short", year: "numeric" });
  return `
    <div class="event-row">
      <div class="event-date"><span class="day">${giorno}</span><span class="month">${mese}</span></div>
      <div class="event-main">
        <div class="name">${ev.evento}${/italy/i.test(ev.luogo || "") ? ` <span class="tag numerato">In Italia</span>` : ""}</div>
        ${luogo ? `<div class="venue">${luogo.replace(/Italy/, "Italia")}</div>` : ""}
      </div>
      <span></span>
    </div>`;
}

async function init() {
  const params = new URLSearchParams(location.search);
  const orgId = params.get("org");
  const out = document.getElementById("pagina");

  const meta = ORGANIZZAZIONI.find((o) => o.id === orgId);
  if (!orgId) {
    out.innerHTML = `<div class="empty-state">Organizzazione non specificata. <a href="europa.html">Torna a Europa</a>.</div>`;
    return;
  }

  let roster = [], eventi = [];
  try { roster = await fetchJSON(`data/europa/${orgId}-roster.json`); } catch { roster = []; }
  try { eventi = await fetchJSON(`data/europa/${orgId}-eventi.json`); } catch { eventi = []; }
  // Prossimi (dal piu' vicino) e passati (dal piu' recente) in due liste
  // separate, come in eventi.js: qui non c'era divisione ed erano mischiati.
  const adesso = new Date();
  const quando = (e) => new Date(e.data);
  const prossimiOrg = eventi.filter((e) => quando(e) >= adesso).sort((a, b) => quando(a) - quando(b));
  const passatiOrg = eventi.filter((e) => !(quando(e) >= adesso)).sort((a, b) => quando(b) - quando(a));

  const nomeOrg = meta ? meta.nome : orgId.toUpperCase();
  // Senza roster su Wikipedia (es. Cage Warriors) la pagina mostra solo
  // campioni ed eventi, senza la scheda Roster vuota.
  const soloEventi = !roster.length;
  document.title = `${nomeOrg} — MMA Oggi`;

  out.innerHTML = `
    <section class="hero" style="padding:44px 0 24px; border-bottom:none;">
      <h1 style="font-size:clamp(28px,4vw,42px);">${nomeOrg}</h1>
      ${meta ? `<p>${meta.descrizione}</p>` : ""}
      <div class="stat-strip">
        ${roster.length ? `<div class="stat"><div class="value">${roster.length}</div><div class="label">Lottatori nel roster</div></div>` : ""}
        <div class="stat"><div class="value">${prossimiOrg.length}</div><div class="label">Eventi in arrivo</div></div>
        <div class="stat"><div class="value">${passatiOrg.length}</div><div class="label">Eventi passati</div></div>
      </div>
    </section>

    ${soloEventi && meta?.campioni?.length ? `
      <div class="section-title" style="margin-top:24px;">Campioni attuali</div>
      <div class="champ-list" style="max-width:520px;">${meta.campioni.map((c) => `<div class="champ-row"><span class="champ-cat">${c.categoria}</span><span class="champ-nome">${c.nome}</span></div>`).join("")}</div>` : ""}

    <div class="org-tabs"${soloEventi ? " hidden" : ""}>
      <button class="org-tab active" data-tab="eventi">Eventi</button>
      <button class="org-tab" data-tab="roster">Roster</button>
    </div>

    <div id="tab-roster" style="display:none;"${soloEventi ? " hidden" : ""}>
      <div class="filter-bar">
        <div class="search-input"><input id="ricerca-org" type="text" placeholder="Cerca un lottatore..."></div>
      </div>
      <div class="section-title">Roster <span class="count" id="count-org"></span></div>
      <div class="fighter-grid" id="grid-org"></div>
    </div>

    <div id="tab-eventi">
      <div class="section-title" style="margin-top:24px;">Prossimi eventi</div>
      <div id="eventi-org-prossimi">${prossimiOrg.length ? prossimiOrg.map(rigaEventoOrg).join("") : `<div class="empty-state">Nessun evento programmato trovato.</div>`}</div>
      <div class="section-title" style="margin-top:24px;">Eventi passati</div>
      <div id="eventi-org-passati">${passatiOrg.length ? passatiOrg.map(rigaEventoOrg).join("") : `<div class="empty-state">Nessun evento passato trovato.</div>`}</div>
    </div>

    <p style="margin:14px 0 60px; font-size:12px; color:var(--text-muted);">Roster ed eventi da Wikipedia. Scheda di dettaglio per singolo lottatore/evento non ancora disponibile per questa organizzazione (solo per UFC per ora).</p>
  `;

  function renderGrid() {
    const q = document.getElementById("ricerca-org").value.trim().toLowerCase();
    const filtrati = q ? roster.filter((r) => r.nome.toLowerCase().includes(q)) : roster;
    document.getElementById("count-org").textContent = `(${filtrati.length})`;
    const grid = document.getElementById("grid-org");
    grid.innerHTML = filtrati.length
      ? filtrati.slice(0, 300).map(cardLottatoreOrg).join("")
      : `<div class="empty-state">Nessun lottatore trovato.</div>`;
  }

  renderGrid();
  document.getElementById("ricerca-org").addEventListener("input", debounce(renderGrid, 120));

  document.querySelectorAll(".org-tab").forEach((btn) => {
    btn.addEventListener("click", () => {
      document.querySelectorAll(".org-tab").forEach((b) => b.classList.toggle("active", b === btn));
      document.getElementById("tab-roster").style.display = btn.dataset.tab === "roster" ? "block" : "none";
      document.getElementById("tab-eventi").style.display = btn.dataset.tab === "eventi" ? "block" : "none";
    });
  });
}

init();
