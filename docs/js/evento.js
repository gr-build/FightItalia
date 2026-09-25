import { fetchJSON, renderChrome, icon, slugDaLink, classeRisultato, impostaMetaPagina, fotoDi, classeFoto } from "./common.js?v=202609251321";

renderChrome(null);

const MESI = ["gennaio", "febbraio", "marzo", "aprile", "maggio", "giugno", "luglio", "agosto", "settembre", "ottobre", "novembre", "dicembre"];

function dataEstesa(dataStr) {
  const d = new Date(dataStr);
  if (isNaN(d)) return dataStr || "";
  return `${d.getDate()} ${MESI[d.getMonth()]} ${d.getFullYear()}`;
}

const ETICHETTE_ORARI = { early_prelims: "Early Prelims", prelims: "Prelims", main_card: "Main Card" };

const CLASSE_FASE = { early_prelims: "early", prelims: "prelims", main_card: "main" };

function rigaOrario(chiave, etichetta, o) {
  if (!o) return "";
  const italia = o.giorno_dopo ? `${o.italia} <span class="fase-giorno-dopo">giorno dopo</span>` : o.italia;
  return `
    <div class="orario-fase ${CLASSE_FASE[chiave]}">
      <div class="fase-label"><span class="fase-dot"></span>${etichetta}</div>
      <div class="fase-orari">
        <div class="fase-italia">${italia}</div>
        <div class="fase-sede">${o.locale} ora sede</div>
      </div>
    </div>`;
}

function blocoOrari(orari) {
  if (!orari) return "";
  const righe = Object.entries(ETICHETTE_ORARI)
    .map(([chiave, etichetta]) => rigaOrario(chiave, etichetta, orari[chiave]))
    .join("");
  if (!righe) return "";
  return `
    <div style="margin-top:24px; max-width:440px;">
      <div class="section-title" style="margin-top:0;">Orario di inizio${orari.indicativo ? " (indicativo)" : ""}</div>
      <div class="orari-card">${righe}</div>
      <p style="margin-top:10px; font-size:11.5px; color:var(--text-muted);">
        ${orari.indicativo
          ? `Orario indicativo: è l'orario tipico UFC per questa sede, quello ufficiale non è ancora pubblicato. Fuso sede: ${orari.fuso_sede}.`
          : `Fuso sede: ${orari.fuso_sede}. Orario Italia calcolato automaticamente (cambio ora legale incluso). Fonte: ${orari.fonte || "orari tipici"}.`}
      </p>
    </div>`;
}

function tagTipo(tipo) {
  if (tipo === "Numerato") return `<span class="tag numerato">Numerato</span>`;
  if (tipo === "Fight Night") return `<span class="tag fight-night">Fight Night</span>`;
  return "";
}

async function riassuntoWikipedia(link) {
  // Non abbiamo scaricato il testo di tutti gli 806 eventi in fase di
  // build (troppo pesante) — qui, solo quando l'utente apre la scheda di
  // QUESTO singolo evento, chiediamo un riassunto alla API pubblica REST
  // di Wikipedia (supporta CORS, pensata apposta per essere richiamata da
  // pagine come questa) cosi' il contenuto resta dentro la nostra pagina
  // invece di mandare l'utente via.
  const titolo = link.split("/wiki/")[1];
  if (!titolo) return null;
  try {
    const res = await fetch(`https://en.wikipedia.org/api/rest_v1/page/summary/${titolo}`);
    if (!res.ok) return null;
    return res.json();
  } catch {
    return null;
  }
}

// "Confronta ->" verso il Tale of the Tape: solo se ENTRAMBI i lottatori
// hanno una scheda (molti esordienti non hanno una pagina Wikipedia). La
// riga ha comunque sempre la stessa struttura: dove il link non c'e' resta
// una nota discreta, cosi' la card non alterna righe piene e righe vuote.
function azioneConfronto(rigaA, rigaB) {
  if (rigaA?.slug && rigaB?.slug) {
    return `<a href="confronto.html?a=${rigaA.slug}&b=${rigaB.slug}" class="bout-confronto-link">Confronta →</a>`;
  }
  return `<span class="bout-confronto-na">Confronto non disponibile</span>`;
}

function iniziali(nome) {
  return (nome || "?").split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p[0]).join("").toUpperCase();
}

// Un lato dell'incontro: foto (o iniziali), nome, record ed eta'. Stessi
// campi per tutti, con "—" dove il dato manca.
function latoIncontro(nome, riga, slugLink, lato, vincitore) {
  const slug = riga?.slug || slugLink;
  const nomeHtml = nome ? (slug ? `<a href="lottatore.html?slug=${slug}">${nome}</a>` : nome) : "—";
  const vuoto = `<span class="bout-avatar bout-avatar-vuoto" aria-hidden="true">${iniziali(nome)}</span>`;
  // Se la foto Wikimedia non carica, al suo posto le iniziali come per
  // chi la foto non ce l'ha.
  const urlFoto = fotoDi(riga);
  const avatar = urlFoto
    ? `<img class="bout-avatar${classeFoto(urlFoto)}" src="${urlFoto}" alt="" loading="lazy" onerror="this.outerHTML=this.dataset.vuoto" data-vuoto='${vuoto}'>`
    : vuoto;
  const meta = `<div class="bout-meta">${riga?.record_mma || "—"}</div><div class="bout-meta k">${riga?.eta ? `${riga.eta} anni` : "—"}</div>`;
  return `
    <div class="bout-lato ${lato}${vincitore ? " vincitore" : ""}">
      ${avatar}
      <div class="bout-lato-testo">
        <div class="bout-nome">${nomeHtml}${vincitore ? ` <span class="bout-w">W</span>` : ""}</div>
        ${meta}
      </div>
    </div>`;
}

// Molti esordienti e prelim non hanno una pagina Wikipedia: nella card
// arrivano senza link, ma il roster li ha comunque (con record, senza slug).
// Il fallback per nome serve a mostrare almeno record ed eta' affiancati.
const normalizzaNome = (n) => (n || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();

function trovaLottatore(slug, nome, roster) {
  if (slug) {
    const perSlug = roster.find((r) => r.slug === slug);
    if (perSlug) return perSlug;
  }
  const n = normalizzaNome(nome);
  return n ? roster.find((r) => normalizzaNome(r.nome) === n) || null : null;
}

function rigaIncontro(b, roster, posizione = "") {
  const haRisultato = b.metodo && b.metodo.trim();
  // Nelle tabelle risultati di Wikipedia il vincitore e' sempre a sinistra,
  // tranne pareggi e no contest.
  const vinceA = haRisultato && !/draw|no contest|pareggio/i.test(b.metodo);
  const slugA = b.fighter1_link ? slugDaLink(b.fighter1_link) : null;
  const slugB = b.fighter2_link ? slugDaLink(b.fighter2_link) : null;
  const rigaA = trovaLottatore(slugA, b.fighter1, roster);
  const rigaB = trovaLottatore(slugB, b.fighter2, roster);
  const esito = haRisultato
    ? `<span class="bout-esito">${b.metodo} · R${b.round} · ${b.tempo}</span>`
    : `<span class="bout-esito da-disputare">Da disputare</span>`;
  return `
    <div class="bout-row">
      <div class="bout-head">
        <span class="bout-cat">${b.categoria || ""}</span>
        ${posizione ? `<span class="bout-posizione">${posizione}</span>` : ""}
      </div>
      <div class="bout-grid">
        ${latoIncontro(b.fighter1, rigaA, slugA, "a", vinceA)}
        <span class="bout-vs">vs</span>
        ${latoIncontro(b.fighter2, rigaB, slugB, "b", false)}
      </div>
      <div class="bout-foot">${esito}${azioneConfronto(rigaA, rigaB)}</div>
    </div>`;
}

// Wikipedia elenca la main card dal main event in giu': il primo bout e'
// il main event, il secondo il co-main — lo stesso ordine della serata.
function sezioneCard(titolo, incontri, roster, conPosizioni = false) {
  if (!incontri.length) return "";
  return `
    <div class="event-group-title">${titolo}</div>
    <div class="bout-list">${incontri.map((b, i) => rigaIncontro(b, roster, conPosizioni ? ["Main event", "Co-main event"][i] || "" : "")).join("")}</div>`;
}

async function caricaCard(link) {
  const slug = slugDaLink(link);
  try {
    return await fetchJSON(`data/eventi/${slug}.json`);
  } catch {
    return [];
  }
}

async function init() {
  const params = new URLSearchParams(location.search);
  const slug = params.get("slug");
  const out = document.getElementById("scheda-evento");

  if (!slug) {
    out.innerHTML = `<div class="empty-state">Evento non specificato. <a href="eventi.html">Torna al calendario</a>.</div>`;
    return;
  }

  const eventi = await fetchJSON("data/eventi.json");
  const ev = eventi.find((e) => slugDaLink(e.link) === slug);

  if (!ev) {
    out.innerHTML = `<div class="empty-state">Evento non trovato. <a href="eventi.html">Torna al calendario</a>.</div>`;
    return;
  }

  const luogo = [ev.sede, ev.luogo].filter(Boolean).join(", ");
  const dataParsata = new Date(ev.data);
  impostaMetaPagina({
    titolo: `${ev.evento} — MMA Oggi`,
    descrizione: `${ev.evento}${luogo ? ` — ${luogo}` : ""}. Data, card completa e risultati su MMA Oggi.`,
    jsonLd: {
      "@context": "https://schema.org",
      "@type": "SportsEvent",
      name: ev.evento,
      startDate: isNaN(dataParsata) ? undefined : dataParsata.toISOString().slice(0, 10),
      location: luogo ? { "@type": "Place", name: luogo } : undefined,
      url: `https://mmaoggi.it/evento.html?slug=${slug}`,
      sport: "Mixed Martial Arts",
    },
  });

  out.innerHTML = `
    <section class="hero" style="padding:44px 0 24px; border-bottom:none;">
      <h1 class="notranslate" translate="no" style="font-size:clamp(26px,4vw,40px);">${ev.evento}</h1>
      <div style="margin-top:10px; display:flex; gap:10px; align-items:center; flex-wrap:wrap;">
        ${tagTipo(ev.tipo)}
        <span style="color:var(--text-secondary); font-size:14px;">${dataEstesa(ev.data)}</span>
      </div>
      ${luogo ? `<p style="margin-top:14px; color:var(--text-secondary); display:flex; align-items:center; gap:6px;">${icon("pin")} ${luogo}</p>` : ""}
      ${ev.spettatori ? `<p style="margin-top:6px; color:var(--text-muted); font-size:13px;">Spettatori: ${ev.spettatori}</p>` : ""}
      ${blocoOrari(ev.orari)}
    </section>

    <div id="card-evento" style="max-width:720px;"><div class="empty-state">Carico la card...</div></div>
    <div id="riassunto" style="max-width:640px; margin-bottom:50px;"></div>
  `;

  const cardBox = document.getElementById("card-evento");
  // extra-lottatori.json copre chi compare in una card evento ma non nel
  // roster UFC attuale (undercard di eventi passati, o un nome uscito dal
  // roster su Wikipedia pur avendo appena combattuto) — senza, per loro non
  // comparirebbe mai il link "Confronta" (vedi commento su azioneConfronto).
  const [card, roster, extra] = ev.link
    ? await Promise.all([
        caricaCard(ev.link),
        fetchJSON("data/roster.json").catch(() => []),
        fetchJSON("data/extra-lottatori.json").catch(() => []),
      ])
    : [[], [], []];
  const rosterCompleto = [...roster, ...extra];

  if (card.length) {
    // Dagli eventi trasmessi su Paramount+ (nuovo partner UFC) in poi,
    // Wikipedia etichetta la sezione principale della card "Fight card
    // (Paramount+)" invece di "Main card" — senza un fallback qui quei
    // bout (compresi i main event) sparivano del tutto dalla pagina,
    // perche' non iniziano per "main". "Main" resta quindi il bucket di
    // default per qualsiasi etichetta che non sia esplicitamente
    // preliminary/early (o mancante).
    const early = card.filter((b) => (b.sezione || "").toLowerCase().startsWith("early"));
    const prelim = card.filter((b) => (b.sezione || "").toLowerCase().startsWith("preliminary"));
    const main = card.filter((b) => !early.includes(b) && !prelim.includes(b));
    cardBox.innerHTML = sezioneCard("Main Card", main, rosterCompleto, true) + sezioneCard("Preliminary Card", prelim, rosterCompleto) + sezioneCard("Early Preliminary Card", early, rosterCompleto);
  } else {
    cardBox.innerHTML = `<div class="empty-state">Card non ancora disponibile per questo evento.</div>`;
  }

  const riassuntoBox = document.getElementById("riassunto");
  const dati = ev.link ? await riassuntoWikipedia(ev.link) : null;

  if (dati && dati.extract) {
    riassuntoBox.innerHTML = `
      <div class="section-title">Riassunto</div>
      <div style="display:flex; gap:18px; align-items:flex-start;">
        ${dati.thumbnail ? `<img src="${dati.thumbnail.source}" alt="" style="width:120px; border-radius:var(--radius-sm); flex-shrink:0;">` : ""}
        <p style="color:var(--text-secondary); line-height:1.7;">${dati.extract}</p>
      </div>
      <p style="margin-top:14px; font-size:11.5px; color:var(--text-muted);">Riassunto automatico da Wikipedia (in inglese, fonte originale).</p>
    `;
  } else {
    riassuntoBox.innerHTML = "";
  }
}

init();
