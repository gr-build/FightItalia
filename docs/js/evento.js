import { fetchJSON, renderChrome, icon, slugDaLink, classeRisultato, impostaMetaPagina, fotoDi, classeFoto, traccia } from "./common.js?v=202610072237";

renderChrome(null);

const MESI = ["gennaio", "febbraio", "marzo", "aprile", "maggio", "giugno", "luglio", "agosto", "settembre", "ottobre", "novembre", "dicembre"];

function dataEstesa(dataStr) {
  const d = new Date(dataStr);
  if (isNaN(d)) return dataStr || "";
  return `${d.getDate()} ${MESI[d.getMonth()]} ${d.getFullYear()}`;
}

const ETICHETTE_ORARI = { early_prelims: "Early Prelims", prelims: "Prelims", main_card: "Main Card" };

const CLASSE_FASE = { early_prelims: "early", prelims: "prelims", main_card: "main" };

function rigaOrario(chiave, etichetta, o, citta) {
  if (!o) return "";
  // giorno_it (es. "Dom") arriva dai dati nuovi; sui vecchi non ancora
  // rigenerati resta il vecchio "(giorno dopo)" come rete di sicurezza.
  const giorno = o.giorno_dopo ? `<span class="fase-giorno-dopo">${o.giorno_it || "giorno dopo"}</span>` : "";
  return `
    <div class="orario-fase ${CLASSE_FASE[chiave]}" data-fase="${CLASSE_FASE[chiave]}" role="button" tabindex="0" title="Mostra solo ${etichetta}">
      <div class="fase-label"><span class="fase-dot"></span>${etichetta}</div>
      <div class="fase-orari">
        <div class="fase-italia">${o.italia} ${giorno}</div>
        <div class="fase-sede">${o.locale}${citta ? ` a ${citta}` : " ora sede"}</div>
      </div>
    </div>`;
}

function blocoOrari(orari, citta) {
  if (!orari) return "";
  const righe = Object.entries(ETICHETTE_ORARI)
    .map(([chiave, etichetta]) => rigaOrario(chiave, etichetta, orari[chiave], citta))
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

async function traduciInItaliano(testo) {
  // Stesso endpoint gratuito di Google Traduttore gia' usato in
  // build_news.py come rete di sicurezza quando Gemini non traduce: qui
  // e' l'unica opzione, il riassunto arriva al volo nel browser, non in
  // fase di build. Se fallisce (rete, limite), resta l'inglese originale.
  try {
    const res = await fetch(
      `https://translate.googleapis.com/translate_a/single?client=gtx&sl=en&tl=it&dt=t&q=${encodeURIComponent(testo)}`
    );
    if (!res.ok) return null;
    const frasi = (await res.json())[0];
    return frasi.map((f) => f[0]).join("");
  } catch {
    return null;
  }
}

// Il testo del metodo per una decision finisce sempre con le tre schede dei
// giudici tra parentesi, es. "Decision (unanimous) (29–28, 29–28, 29–27)":
// ogni coppia e' il punteggio di un giudice, primo numero al fighter1 (il
// vincitore, tranne pareggi/no contest — vedi vinceA in rigaIncontro).
function schedeGiudici(metodo) {
  const m = (metodo || "").match(/\(([\d]+[–-][\d]+(?:,\s*[\d]+[–-][\d]+)*)\)\s*$/);
  if (!m) return null;
  return m[1].split(",").map((s, i) => `G${i + 1} ${s.trim()}`).join(" · ");
}

// Al posto di "Confronta" su un evento gia' disputato: il tale of the tape
// (eta', record, fisico) non serve piu', ma un'etichetta "Fight" resta,
// con le schede dei giudici quando l'incontro e' andato a decision (unico
// dato di dettaglio che oggi non e' gia' altrove sulla card) — su
// richiesta di Giovanni.
function badgeFight(b) {
  const schede = schedeGiudici(b?.metodo);
  return `<span class="bout-fight-pill"><span class="bout-fight-tag">Fight</span>${schede ? `<span class="bout-fight-score">${schede}</span>` : ""}</span>`;
}

// "Confronta ->" verso il Tale of the Tape: solo se ENTRAMBI i lottatori
// hanno una scheda (molti esordienti non hanno una pagina Wikipedia). La
// riga ha comunque sempre la stessa struttura: dove il link non c'e' resta
// una nota discreta, cosi' la card non alterna righe piene e righe vuote.
// Il confronto pre-fight (fisico, record) resta solo sugli eventi futuri.
function azioneConfronto(rigaA, rigaB, b, contestoEvento) {
  if (contestoEvento?.passato) return badgeFight(b);
  if (!(rigaA?.slug && rigaB?.slug)) {
    return `<span class="bout-confronto-na">Confronto non disponibile</span>`;
  }
  return `<a href="confronto.html?a=${rigaA.slug}&b=${rigaB.slug}" class="bout-confronto-link">Confronta →</a>`;
}

function iniziali(nome) {
  return (nome || "?").split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p[0]).join("").toUpperCase();
}

// Chiave tipo|categoria|nome per l'indice delle classifiche: "Women's X" /
// "Women's X" (apostrofo tipografico incluso) e' "donne", il resto "uomini" —
// stesse categorie (senza il prefisso) usate in classifiche.json.
function chiaveClassifica(categoriaBout, nome) {
  const c = (categoriaBout || "").trim();
  const donne = /^women[''’]?s\s+/i.test(c);
  const cat = c.replace(/^women[''’]?s\s+/i, "").toLowerCase();
  return `${donne ? "donne" : "uomini"}|${cat}|${normalizzaNome(nome)}`;
}

function indiceClassifiche(classifiche) {
  const idx = new Map();
  for (const div of classifiche?.divisioni || []) {
    if (!div.categoria) continue; // pound-for-pound: non e' una categoria di peso
    const cat = div.categoria.toLowerCase();
    if (div.campione) idx.set(`${div.tipo}|${cat}|${normalizzaNome(div.campione.nome)}`, "C");
    for (const x of div.classifica || []) idx.set(`${div.tipo}|${cat}|${normalizzaNome(x.nome)}`, x.pos);
  }
  return idx;
}

// Su richiesta di Giovanni, dopo un errore vero (un lottatore dato "non in
// classifica" mentre era gia' #12): il numero vero o "Non in classifica"
// sempre visibile, mai un'affermazione implicita non controllata.
function badgeRanking(categoriaBout, nome, idxClassifiche) {
  if (!nome || !idxClassifiche) return "";
  const pos = idxClassifiche.get(chiaveClassifica(categoriaBout, nome));
  if (pos === "C") return `<span class="bout-ranking campione">Campione</span>`;
  if (pos) return `<span class="bout-ranking">#${pos}</span>`;
  return `<span class="bout-ranking non-ranked">Non in classifica</span>`;
}

// Un lato dell'incontro: foto (o iniziali), nome, record ed eta'. Stessi
// campi per tutti, con "—" dove il dato manca.
function latoIncontro(nome, riga, slugLink, lato, vincitore, categoriaBout, idxClassifiche) {
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
        ${badgeRanking(categoriaBout, nome, idxClassifiche)}
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

// Schede degli incontri gia' disputati (docs/incontro/): data/incontri.json
// elenca gli indirizzi che esistono. Lo slug si costruisce come in
// slug_testo() di build_static.py.
let SCHEDE_INCONTRI = new Set();
let SLUG_EVENTO = "";

function slugTesto(t) {
  return String(t || "").normalize("NFKD").replace(/[^\x00-\x7f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}

function nomePulito(n) {
  return String(n || "").replace(/\s*\((?:c|ic)\)\s*$/, "").trim();
}

function linkSchedaIncontro(b) {
  const s = `${SLUG_EVENTO}-${slugTesto(nomePulito(b.fighter1))}-vs-${slugTesto(nomePulito(b.fighter2))}`;
  return SCHEDE_INCONTRI.has(s) ? `<a href="incontro/${s}.html" class="bout-scheda-btn">Scheda incontro <span aria-hidden="true">→</span></a>` : "";
}

// Piede della riga per un incontro disputato che ha la sua scheda: il
// risultato (con i cartellini sotto, piu' piccoli) a sinistra e un bottone
// ben visibile per la scheda; su telefono il bottone va a tutta larghezza.
function piedeConScheda(b, linkScheda) {
  const schede = schedeGiudici(b.metodo);
  const metodo = String(b.metodo || "").replace(/\s*\(\d+[–-]\d+(?:,\s*\d+[–-]\d+)*\)\s*$/, "");
  const dettagli = [b.round ? `R${b.round}` : "", b.tempo || ""].filter(Boolean).join(" · ");
  return `<div class="bout-foot bout-foot-scheda">
    <div class="bout-esito-box">
      <span class="bout-esito">${metodo}${dettagli ? ` · ${dettagli}` : ""}</span>
      ${schede ? `<span class="bout-fight-score">${schede}</span>` : ""}
    </div>
    ${linkScheda}
  </div>`;
}

function rigaIncontro(b, roster, posizione = "", contestoEvento, idxClassifiche) {
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
        ${latoIncontro(b.fighter1, rigaA, slugA, "a", vinceA, b.categoria, idxClassifiche)}
        <span class="bout-vs">vs</span>
        ${latoIncontro(b.fighter2, rigaB, slugB, "b", false, b.categoria, idxClassifiche)}
      </div>
      ${linkSchedaIncontro(b) && haRisultato ? piedeConScheda(b, linkSchedaIncontro(b)) : `<div class="bout-foot">${esito}${azioneConfronto(rigaA, rigaB, b, contestoEvento)}</div>`}
    </div>`;
}

// Wikipedia elenca la main card dal main event in giu': il primo bout e'
// il main event, il secondo il co-main — lo stesso ordine della serata.
function sezioneCard(titolo, incontri, roster, conPosizioni = false, contestoEvento, idxClassifiche, fase = "") {
  if (!incontri.length) return "";
  return `
    <div class="fase-sezione" data-fase="${fase}">
      <div class="event-group-title">${titolo}</div>
      <div class="bout-list">${incontri.map((b, i) => rigaIncontro(b, roster, conPosizioni ? ["Main event", "Co-main event"][i] || "" : "", contestoEvento, idxClassifiche)).join("")}</div>
    </div>`;
}

// Barra sotto gli orari: un tocco mostra solo main card / prelims / early
// prelims, un secondo tocco sullo stesso bottone torna a tutta la card.
// Compare solo se la card ha almeno due sezioni.
function barraFasi(fasi) {
  if (fasi.length < 2) return "";
  const bottoni = fasi
    .map(([chiave, etichetta]) => `<button type="button" class="fase-btn" data-fase="${chiave}" aria-pressed="false">${etichetta}</button>`)
    .join("");
  return `<div class="fase-filtro" role="group" aria-label="Mostra una parte della card">${bottoni}</div>`;
}

function attivaFiltroFasi(radice) {
  const bottoni = [...radice.querySelectorAll(".fase-btn")];
  if (!bottoni.length) return;
  const mostra = (fase) => {
    radice.querySelectorAll(".fase-sezione").forEach((el) => { el.hidden = fase !== "tutte" && el.dataset.fase !== fase; });
    bottoni.forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.fase === fase)));
    document.querySelectorAll(".orario-fase").forEach((r) => r.classList.toggle("scelta", fase !== "tutte" && r.dataset.fase === fase));
  };
  bottoni.forEach((b) => b.addEventListener("click", () => mostra(b.getAttribute("aria-pressed") === "true" ? "tutte" : b.dataset.fase)));
  // toccare un orario equivale a scegliere quella parte della card
  document.querySelectorAll(".orario-fase[data-fase]").forEach((r) => {
    const vai = () => {
      if (!bottoni.some((b) => b.dataset.fase === r.dataset.fase)) return;
      mostra(r.classList.contains("scelta") ? "tutte" : r.dataset.fase);
      radice.scrollIntoView({ behavior: "smooth", block: "start" });
    };
    r.addEventListener("click", vai);
    r.addEventListener("keydown", (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); vai(); } });
  });
}

// Se i dati del sito non hanno ancora il risultato (l'aggiornamento
// programmato puo' ritardare di ore), li prende da ESPN nel browser: chi ha
// vinto, round e tempo. Il metodo preciso (KO, sottomissione...) arriva piu'
// tardi con l'aggiornamento dei dati; qui si distingue solo ai punti / prima
// del limite. Se ESPN non risponde la pagina resta com'e'.
const ESPN_SCOREBOARD_EVENTO = "https://site.api.espn.com/apis/site/v2/sports/mma/ufc/scoreboard";
const chiaveNome = (n) => (n || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z]/g, "");

async function conRisultatiEspn(card, ev) {
  if (!card.some((b) => !(b.metodo || "").trim())) return card;
  const giorno = new Date(`${ev.data} 12:00 UTC`);
  if (Number.isNaN(giorno.getTime()) || giorno.getTime() > Date.now() + 86400000 || Date.now() - giorno.getTime() > 5 * 86400000) return card;
  try {
    const d = `${giorno.getUTCFullYear()}${String(giorno.getUTCMonth() + 1).padStart(2, "0")}${String(giorno.getUTCDate()).padStart(2, "0")}`;
    const r = await fetch(`${ESPN_SCOREBOARD_EVENTO}?dates=${d}`, { signal: AbortSignal.timeout(6000) });
    if (!r.ok) return card;
    const evEspn = ((await r.json()).events || [])[0];
    if (!evEspn) return card;
    const finiti = new Map();
    for (const c of evEspn.competitions || []) {
      if (c.status?.type?.state !== "post") continue;
      const atleti = c.competitors || [];
      const vincitore = atleti.find((a) => a.winner);
      if (atleti.length !== 2 || !vincitore) continue;
      const chiave = atleti.map((a) => chiaveNome(a.athlete?.displayName)).sort().join("|");
      const periodi = c.format?.regulation?.periods || 3;
      const alLimite = c.status.period === periodi && ["5:00", "0:00"].includes(c.status.displayClock);
      finiti.set(chiave, { vincitore: chiaveNome(vincitore.athlete.displayName), metodo: alLimite ? "Decision" : "Finish", round: String(c.status.period), tempo: c.status.displayClock });
    }
    return card.map((b) => {
      if ((b.metodo || "").trim()) return b;
      const x = finiti.get([chiaveNome(b.fighter1), chiaveNome(b.fighter2)].sort().join("|"));
      if (!x) return b;
      const scambia = chiaveNome(b.fighter1) !== x.vincitore;
      return {
        ...b,
        ...(scambia ? { fighter1: b.fighter2, fighter2: b.fighter1, fighter1_link: b.fighter2_link, fighter2_link: b.fighter1_link } : {}),
        metodo: x.metodo, round: x.round, tempo: x.tempo,
      };
    });
  } catch {
    return card;
  }
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
  const slug = params.get("slug") || document.body.dataset.slug;
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

  traccia("Scheda evento", { evento: slug });
  const luogo = [ev.sede, ev.luogo].filter(Boolean).join(", ");
  const citta = (ev.luogo || "").split(",")[0].trim() || null;
  const dataParsata = new Date(ev.data);
  impostaMetaPagina({
    titolo: `${ev.evento} — MMA Oggi`,
    canonical: `https://mmaoggi.it/evento/${slug}.html`,
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
      ${blocoOrari(ev.orari, citta)}
    </section>

    <div id="card-evento" style="max-width:720px;"><div class="empty-state">Carico la card...</div></div>
    <div id="riassunto" style="max-width:640px; margin-bottom:50px;"></div>
  `;

  const cardBox = document.getElementById("card-evento");
  // extra-lottatori.json copre chi compare in una card evento ma non nel
  // roster UFC attuale (undercard di eventi passati, o un nome uscito dal
  // roster su Wikipedia pur avendo appena combattuto) — senza, per loro non
  // comparirebbe mai il link "Confronta" (vedi commento su azioneConfronto).
  const [cardBase, roster, extra, classifiche] = ev.link
    ? await Promise.all([
        caricaCard(ev.link),
        fetchJSON("data/roster.json").catch(() => []),
        fetchJSON("data/extra-lottatori.json").catch(() => []),
        fetchJSON("data/classifiche.json").catch(() => null),
      ])
    : [[], [], [], null];
  const card = await conRisultatiEspn(cardBase, ev);
  SLUG_EVENTO = slug;
  SCHEDE_INCONTRI = new Set(await fetchJSON("data/incontri.json").catch(() => []));
  const idxClassifiche = indiceClassifiche(classifiche);
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
    const contestoEvento = { evento: ev.evento, data: ev.data, luogo, passato: ev.stato === "passato" };
    const fasi = [["main", main, "Main card"], ["prelims", prelim, "Prelims"], ["early", early, "Early prelims"]]
      .filter(([, lista]) => lista.length)
      .map(([chiave, , etichetta]) => [chiave, etichetta]);
    cardBox.innerHTML = barraFasi(fasi)
      + sezioneCard("Main Card", main, rosterCompleto, true, contestoEvento, idxClassifiche, "main")
      + sezioneCard("Preliminary Card", prelim, rosterCompleto, false, contestoEvento, idxClassifiche, "prelims")
      + sezioneCard("Early Preliminary Card", early, rosterCompleto, false, contestoEvento, idxClassifiche, "early");
    attivaFiltroFasi(cardBox);
  } else {
    cardBox.innerHTML = `<div class="empty-state">Card non ancora disponibile per questo evento.</div>`;
  }

  const riassuntoBox = document.getElementById("riassunto");
  const dati = ev.link ? await riassuntoWikipedia(ev.link) : null;

  if (dati && dati.extract) {
    const tradotto = await traduciInItaliano(dati.extract);
    const nota = tradotto
      ? "Riassunto automatico da Wikipedia, tradotto dall'inglese (fonte originale)."
      : "Riassunto automatico da Wikipedia (in inglese, fonte originale: la traduzione non è riuscita).";
    riassuntoBox.innerHTML = `
      <div class="section-title">Riassunto</div>
      <div style="display:flex; gap:18px; align-items:flex-start;">
        ${dati.thumbnail ? `<img src="${dati.thumbnail.source}" alt="" style="width:120px; border-radius:var(--radius-sm); flex-shrink:0;">` : ""}
        <p style="color:var(--text-secondary); line-height:1.7;">${tradotto || dati.extract}</p>
      </div>
      <p style="margin-top:14px; font-size:11.5px; color:var(--text-muted);">${nota}</p>
    `;
  } else {
    riassuntoBox.innerHTML = "";
  }
}

init();
