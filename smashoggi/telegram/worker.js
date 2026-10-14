/**
 * Bot Telegram di Smash Oggi: Cloudflare Worker (gratuito), sempre sveglio.
 * Telegram chiama questo indirizzo appena scrivi un comando (webhook) e il Worker risponde in chat
 * con partite, risultati e italiani letti da ESPN. In più, ogni mattina manda "Oggi in campo" e,
 * durante il giorno, i risultati degli italiani appena finiti. Mai quote né pronostici.
 *
 * Segreti (Cloudflare -> Settings -> Variables and Secrets, tipo "Secret"):
 *   TELEGRAM_TOKEN   token del bot (BotFather)
 *   WEBHOOK_SECRET   una parola lunga a caso inventata da te (Telegram la rimanda a ogni messaggio)
 *   GITHUB_TOKEN     solo se un giorno colleghi dei workflow (vedi COMANDI): per ora non serve
 * Variabili di testo:
 *   CHAT_ID          la tua chat: chiunque altro viene ignorato in silenzio
 *   CANALE           facoltativo, es. @smashoggi: ci va anche il messaggio del mattino
 *   BOT_USERNAME     nome atteso del bot (protegge dal token sbagliato), es. SmashOggiBot
 *   REPO             facoltativo, repository dei workflow (solo con GITHUB_TOKEN)
 *   DATI_URL         facoltativo, cartella "data" del sito online (serve a /radar), es. https://tuodominio.it/data
 * KV facoltativo (binding STATO): evita di ripubblicare lo stesso risultato.
 *
 * Pagine di servizio (per te, con la parola segreta; i token non compaiono mai):
 *   /stato?k=PAROLA     dice di che bot si tratta e che webhook c'è adesso (non cambia niente)
 *   /attiva?k=PAROLA    imposta il webhook, solo se il bot è quello atteso e non c'è un webhook di altri
 *                       (con &forza=1 sostituisce un webhook esistente)
 */

const ESPN = "https://site.api.espn.com/apis/site/v2/sports/tennis";
const SITO = "https://gr-build.github.io/smashoggi/";   // da cambiare quando c'è il dominio
const BOT_BASE = "SmashOggiBot";
const FUSO = "Europe/Rome";
const RAMO = "main";
const VERSIONE = "bot-1 2026-10-14";
const ETA_MASSIMA_SECONDI = 600;   // un comando più vecchio di 10 minuti non si esegue

// comando -> [file del workflow GitHub, input o null, descrizione]. Vuoto finché non esistono workflow.
const COMANDI = {};

const AIUTO = [
  "/oggi · Le partite di oggi, con gli italiani in cima",
  "/live · Le partite in corso adesso",
  "/italiani · Cosa fanno oggi e domani gli italiani",
  "/risultati · Gli ultimi risultati (italiani prima)",
  "/radar · Le ultime notizie di tennis (serve DATI_URL)",
  ...Object.entries(COMANDI).map(([c, [, , d]]) => `${c} · ${d}`),
].join("\n");

const TURNI = { "Round 1": "Primo turno", "Round 2": "Secondo turno", "Round 3": "Terzo turno", "Round of 16": "Ottavi", "Quarterfinals": "Quarti", "Semifinals": "Semifinale", "Final": "Finale", "Round of 32": "Trentaduesimi", "Round of 64": "Sessantaquattresimi", "Round of 128": "Primo turno" };

const esc = (t) => String(t ?? "").replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" })[c]);
const ore = (iso) => new Date(iso).toLocaleTimeString("it-IT", { timeZone: FUSO, hour: "2-digit", minute: "2-digit" });
const giorno = (iso) => new Date(iso).toLocaleDateString("sv-SE", { timeZone: FUSO });
const testo = (s, stato = 200) => new Response(s, { status: stato, headers: { "Content-Type": "text/plain; charset=utf-8" } });

// confronto che non si ferma al primo carattere diverso (la parola segreta non si indovina dai tempi)
function uguali(a, b) {
  a = String(a ?? ""); b = String(b ?? "");
  let d = a.length ^ b.length;
  for (let i = 0; i < Math.max(a.length, b.length); i++) d |= (a.charCodeAt(i) || 0) ^ (b.charCodeAt(i) || 0);
  return d === 0;
}

const tg = (env, metodo, corpo) =>
  fetch(`https://api.telegram.org/bot${env.TELEGRAM_TOKEN}/${metodo}`, {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(corpo || {}),
  }).then((r) => r.json().catch(() => ({ ok: false })));

const rispondi = (env, chat, t) => tg(env, "sendMessage", { chat_id: chat, text: t, parse_mode: "HTML", disable_web_page_preview: true });

// testo lungo in più messaggi, spezzato sulle righe (Telegram: massimo 4096 caratteri)
async function invia(env, chat, lungo) {
  let blocco = "";
  for (const r of lungo.split("\n")) {
    if (blocco.length + r.length + 1 > 3800) { await rispondi(env, chat, blocco); blocco = ""; }
    blocco += (blocco ? "\n" : "") + r;
  }
  if (blocco.trim()) await rispondi(env, chat, blocco);
}

// ---------- dati ESPN
async function partite(date) {
  const out = [];
  for (const tour of ["atp", "wta"]) {
    const r = await fetch(`${ESPN}/${tour}/scoreboard${date ? `?dates=${date}` : ""}`, { headers: { "User-Agent": "Mozilla/5.0" } });
    if (!r.ok) continue;
    const sb = await r.json();
    for (const ev of sb.events || []) {
      for (const gr of ev.groupings || []) {
        const tipo = gr.grouping?.slug;
        if (tipo !== "mens-singles" && tipo !== "womens-singles") continue;
        for (const c of gr.competitions || []) {
          const comp = (c.competitors || []).sort((a, b) => (a.order || 0) - (b.order || 0));
          if (comp.length !== 2) continue;
          const rd = c.round?.displayName || "";
          out.push({
            id: c.id, torneo: ev.name, turno: TURNI[rd] || rd, data: c.startDate || c.date,
            stato: c.status?.type?.state, dettaglio: c.status?.type?.detail,
            g: comp.map((p) => ({
              nome: p.athlete?.displayName || p.athlete?.fullName || "?",
              ita: /\/ita\.png/i.test(p.athlete?.flag?.href || "") || p.athlete?.flag?.alt === "Italy",
              vince: !!p.winner, set: (p.linescores || []).map((s) => s.value),
            })),
          });
        }
      }
    }
  }
  return out;
}

const conItaliano = (p) => p.g.some((x) => x.ita);
const perOra = (a, b) => String(a.data).localeCompare(String(b.data));
const ISO = (d) => d.toISOString().slice(0, 10).replace(/-/g, "");
const sfida = (p) => `${esc(p.g[0].nome)} vs ${esc(p.g[1].nome)}`;
const dove = (p) => `${esc(p.torneo)}${p.turno ? ", " + esc(p.turno) : ""}`;
const punteggio = (p) => {
  const [a, b] = p.g;
  return a.set.map((s, i) => `${s}-${b.set[i]}`).join(" ");
};

function rigaPartita(p) {
  if (p.stato === "pre") return `• ${ore(p.data)} — ${sfida(p)} (${dove(p)})`;
  const [a, b] = p.g;
  if (p.stato === "in") return `🔴 ${sfida(p)} ${punteggio(p)} (${dove(p)})`;
  const v = a.vince ? a : b, s = a.vince ? b : a;
  const ps = (a.vince ? a : b).set.map((x, i) => `${x}-${s.set[i]}`).join(" ");
  return `✅ <b>${esc(v.nome)}</b> batte ${esc(s.nome)} ${ps} (${dove(p)})`;
}

function elencoPartite(titolo, lista, vuoto) {
  if (!lista.length) return `${titolo}\n\n${vuoto}`;
  const ita = lista.filter(conItaliano), altre = lista.filter((p) => !conItaliano(p));
  let t = `${titolo}\n`;
  if (ita.length) t += `\n🇮🇹 <b>Italiani</b>\n${ita.map(rigaPartita).join("\n")}\n`;
  if (altre.length) t += `\n<b>Altre partite</b>\n${altre.slice(0, 25).map(rigaPartita).join("\n")}${altre.length > 25 ? `\n… e altre ${altre.length - 25}` : ""}\n`;
  return t;
}

// ---------- comandi
async function cmdOggi(env, chat) {
  const oggi = giorno(new Date());
  const l = (await partite()).filter((p) => giorno(p.data) === oggi).sort(perOra);
  await invia(env, chat, elencoPartite("🎾 <b>Partite di oggi</b>", l, "Oggi non risultano partite.") + `\n👉 ${SITO}partite.html`);
}

async function cmdLive(env, chat) {
  const l = (await partite()).filter((p) => p.stato === "in").sort(perOra);
  await invia(env, chat, elencoPartite("🔴 <b>In corso adesso</b>", l, "Nessuna partita in corso in questo momento."));
}

async function cmdItaliani(env, chat) {
  const ora = new Date(), domani = new Date(ora.getTime() + 86400000);
  const tutte = [...(await partite()), ...(await partite(ISO(domani)))];
  const visti = new Set();
  const l = tutte.filter((p) => conItaliano(p) && !visti.has(p.id) && visti.add(p.id)).sort(perOra);
  const g0 = giorno(ora), g1 = giorno(domani);
  const per = (g) => l.filter((p) => giorno(p.data) === g);
  const blocco = (titolo, lista) => (lista.length ? `\n<b>${titolo}</b>\n${lista.map(rigaPartita).join("\n")}\n` : "");
  const corpo = blocco("Oggi", per(g0)) + blocco("Domani", per(g1));
  await invia(env, chat, `🇮🇹 <b>Gli italiani</b>\n${corpo || "\nNessun italiano in programma oggi e domani nei tabelloni principali.\n"}`);
}

async function cmdRisultati(env, chat) {
  const ieri = new Date(Date.now() - 86400000);
  const tutte = [...(await partite()), ...(await partite(ISO(ieri)))];
  const visti = new Set();
  const l = tutte.filter((p) => p.stato === "post" && !visti.has(p.id) && visti.add(p.id)).sort((a, b) => perOra(b, a));
  await invia(env, chat, elencoPartite("✅ <b>Ultimi risultati</b>", l.slice(0, 40), "Nessun risultato recente.") + `\n👉 ${SITO}partite.html`);
}

async function cmdRadar(env, chat) {
  if (!env.DATI_URL) { await rispondi(env, chat, "Le notizie arrivano dal sito: finché non è online, /radar non è attivo. Quando c'è, imposta la variabile DATI_URL."); return; }
  const r = await fetch(`${env.DATI_URL}/notizie.json`, { headers: { "User-Agent": "smashoggi-bot" } });
  if (!r.ok) throw new Error(`notizie ${r.status}`);
  const d = await r.json();
  const l = (Array.isArray(d) ? d : d.notizie || d.articoli || []).slice(0, 15);
  if (!l.length) { await rispondi(env, chat, "Non trovo notizie al momento. Riprova tra poco."); return; }
  await invia(env, chat, `📰 <b>Ultime notizie di tennis</b>\n\n${l.map((n, i) => `${i + 1}. ${esc(n.titolo)} (${esc(n.fonte || "")})\n${esc(n.url || n.link || "")}`).join("\n\n")}`);
}

// ---------- messaggi automatici
function mattino(lista) {
  const oggi = giorno(new Date());
  const ita = lista.filter((p) => conItaliano(p) && p.stato !== "post" && giorno(p.data) === oggi).sort(perOra);
  const live = lista.filter((p) => p.stato === "in").length;
  let t = "🎾 <b>Smash Oggi — Oggi in campo</b>\n";
  t += ita.length ? `\n🇮🇹 <b>Gli italiani</b>\n${ita.map(rigaPartita).join("\n")}\n` : "\nOggi nessun italiano in programma nei tabelloni principali.\n";
  if (live) t += `\n🔴 Partite in corso adesso: ${live}\n`;
  return t + `\n👉 ${SITO}partite.html`;
}

const destinatari = (env) => [env.CHAT_ID, env.CANALE].filter(Boolean);

async function automatico(env, cron) {
  const lista = await partite();
  if (cron === "0 6 * * *") {
    for (const d of destinatari(env)) await rispondi(env, d, mattino(lista));
    return;
  }
  if (!env.STATO) return;   // senza KV niente risultati: rischio di doppioni
  for (const p of lista.filter((x) => x.stato === "post" && conItaliano(x))) {
    if (await env.STATO.get("r" + p.id)) continue;
    for (const d of destinatari(env)) await rispondi(env, d, `${rigaPartita(p)}\n${SITO}partita.html?id=${p.id}`);
    await env.STATO.put("r" + p.id, "1", { expirationTtl: 60 * 60 * 24 * 3 });
  }
}

// ---------- workflow GitHub (spenti finché COMANDI è vuoto)
async function lancia(env, file, inputs) {
  const r = await fetch(`https://api.github.com/repos/${env.REPO}/actions/workflows/${file}/dispatches`, {
    method: "POST",
    headers: { Authorization: `Bearer ${env.GITHUB_TOKEN}`, Accept: "application/vnd.github+json", "X-GitHub-Api-Version": "2022-11-28", "User-Agent": "smashoggi-bot", "Content-Type": "application/json" },
    body: JSON.stringify({ ref: RAMO, ...(inputs ? { inputs } : {}) }),
  });
  return { ok: r.status === 204, stato: r.status, dettaglio: r.status === 204 ? "" : (await r.text()).slice(0, 200) };
}

async function eseguiLancio(env, chat, file, inputs, descrizione) {
  if (!env.GITHUB_TOKEN || !env.REPO) { await rispondi(env, chat, "Questo comando richiede GITHUB_TOKEN e REPO, non ancora impostati."); return; }
  const e = await lancia(env, file, inputs);
  await rispondi(env, chat, e.ok ? `✅ Lanciato: ${esc(descrizione)}. Arriva tra qualche minuto.` : `⚠️ Non sono riuscito a lanciare "${esc(descrizione)}" (GitHub ${e.stato}).\n${esc(e.dettaglio)}`);
}

// ---------- /stato e /attiva: accendono il bot senza mai scrivere il token da nessuna parte
async function servizio(env, u) {
  if (!env.WEBHOOK_SECRET || !uguali(u.searchParams.get("k"), env.WEBHOOK_SECRET)) return testo("non autorizzato", 401);
  if (!env.TELEGRAM_TOKEN) return testo("Manca la variabile TELEGRAM_TOKEN sul Worker.", 500);
  const me = await tg(env, "getMe");
  if (!me.ok) return testo("Telegram non riconosce TELEGRAM_TOKEN (token sbagliato o scaduto). Non ho cambiato niente.", 502);
  const nome = me.result.username, atteso = env.BOT_USERNAME || BOT_BASE;
  const info = (await tg(env, "getWebhookInfo")).result || {};
  const mio = `${u.origin}/`;
  const righe = [
    `Bot del token: @${nome}`, `Bot atteso: @${atteso}`,
    `Webhook attuale: ${info.url || "(nessuno)"}`, `Messaggi in attesa: ${info.pending_update_count ?? "?"}`,
    ...(info.last_error_message ? [`Ultimo errore di Telegram: ${info.last_error_message}`] : []),
  ];
  if (u.pathname === "/stato") return testo(righe.join("\n"));
  if (String(nome).toLowerCase() !== String(atteso).toLowerCase()) return testo(`${righe.join("\n")}\n\nFERMO: il token non è del bot @${atteso}. Non ho cambiato niente.`, 409);
  if (info.url === mio) return testo(`${righe.join("\n")}\n\nGià attivo: non serve rifarlo.`);
  if (info.url && u.searchParams.get("forza") !== "1") return testo(`${righe.join("\n")}\n\nFERMO: c'è già un webhook di qualcun altro. Se è proprio da sostituire, aggiungi &forza=1 all'indirizzo.`, 409);
  const r = await tg(env, "setWebhook", { url: mio, secret_token: env.WEBHOOK_SECRET, allowed_updates: ["message"] });
  return testo(r.ok ? `${righe.join("\n")}\n\nFatto: webhook attivato su ${mio}\nOra scrivi /start al bot.` : `Telegram ha rifiutato: ${r.description || "errore sconosciuto"}`, r.ok ? 200 : 502);
}

export default {
  async fetch(req, env, ctx) {
    const u = new URL(req.url);
    if (req.method === "GET") {
      if (u.pathname === "/stato" || u.pathname === "/attiva") return servizio(env, u);
      return testo(`Smash Oggi bot: ok · versione ${VERSIONE}`);
    }
    if (req.method !== "POST") return testo("non consentito", 405);
    // Solo Telegram, che conosce la parola segreta, può farci eseguire qualcosa.
    if (!env.WEBHOOK_SECRET || !uguali(req.headers.get("X-Telegram-Bot-Api-Secret-Token"), env.WEBHOOK_SECRET)) return testo("non autorizzato", 401);
    const update = await req.json().catch(() => ({}));
    const msg = update.message;
    if (!msg || !msg.text) return testo("ok");
    if (!env.CHAT_ID || String(msg.chat?.id) !== String(env.CHAT_ID)) return testo("ok");   // chiunque altro: ignorato in silenzio

    const lavoro = (async () => {
      if (Date.now() / 1000 - (msg.date || 0) > ETA_MASSIMA_SECONDI) return;
      const t = msg.text.trim();
      const c = t.startsWith("/") ? t.split(/\s+/)[0].toLowerCase().split("@")[0] : "";
      const chat = msg.chat.id;
      if (c === "/oggi") return cmdOggi(env, chat);
      if (c === "/live") return cmdLive(env, chat);
      if (c === "/italiani") return cmdItaliani(env, chat);
      if (c === "/risultati") return cmdRisultati(env, chat);
      if (c === "/radar" || c === "/notizie") return cmdRadar(env, chat);
      if (COMANDI[c]) { const [file, inputs, d] = COMANDI[c]; return eseguiLancio(env, chat, file, inputs, d); }
      await rispondi(env, chat, `Sono sveglio. Scrivi uno di questi comandi:\n${AIUTO}`);
    })();
    // Risponde subito a Telegram e finisce il lavoro in coda: Telegram non aspetta e non ripete l'invio.
    ctx.waitUntil(lavoro.catch((e) => { console.error(e); return rispondi(env, msg.chat.id, `⚠️ Qualcosa non ha funzionato: riprova tra poco.\n(${esc(String(e?.message || e).slice(0, 200))})`); }));
    return testo("ok");
  },
  scheduled(ev, env, ctx) { ctx.waitUntil(automatico(env, ev.cron)); },
};
