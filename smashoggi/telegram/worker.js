// Smash Oggi — Worker Cloudflare per il canale Telegram.
// Due compiti, entrambi con dati ESPN: messaggio del mattino ("Oggi in campo") e
// risultati degli italiani appena finiti. Mai quote né pronostici.
// Segreti (da impostare su Cloudflare, mai nel codice): TELEGRAM_TOKEN, TELEGRAM_CANALE.
// KV opzionale (binding STATO): evita di ripubblicare lo stesso risultato.

const ESPN = "https://site.api.espn.com/apis/site/v2/sports/tennis";
const SITO = "https://gr-build.github.io/smashoggi/";
const TOUR = ["atp", "wta"];

const ore = (iso) => new Date(iso).toLocaleTimeString("it-IT", { timeZone: "Europe/Rome", hour: "2-digit", minute: "2-digit" });
const giorno = (iso) => new Date(iso).toLocaleDateString("sv-SE", { timeZone: "Europe/Rome" });
const TURNI = { "Round 1": "Primo turno", "Round 2": "Secondo turno", "Round 3": "Terzo turno", "Round of 16": "Ottavi", "Quarterfinals": "Quarti", "Semifinals": "Semifinale", "Final": "Finale", "Round of 32": "Trentaduesimi", "Round of 64": "Sessantaquattresimi", "Round of 128": "Primo turno" };
const esc = (t) => String(t ?? "").replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" })[c]);

async function partite() {
  const out = [];
  for (const tour of TOUR) {
    const r = await fetch(`${ESPN}/${tour}/scoreboard`, { headers: { "User-Agent": "Mozilla/5.0" } });
    if (!r.ok) continue;
    const sb = await r.json();
    for (const ev of sb.events || []) {
      for (const gr of ev.groupings || []) {
        const tipo = gr.grouping?.slug;
        if (tipo !== "mens-singles" && tipo !== "womens-singles") continue;
        for (const c of gr.competitions || []) {
          const comp = (c.competitors || []).sort((a, b) => (a.order || 0) - (b.order || 0));
          if (comp.length !== 2) continue;
          out.push({
            id: c.id, torneo: ev.name, turno: TURNI[c.round?.displayName] || c.round?.displayName || "", data: c.startDate || c.date,
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

function mattino(lista) {
  const ita = lista.filter((p) => conItaliano(p) && p.stato !== "post" && giorno(p.data) === giorno(new Date())).sort((a, b) => a.data.localeCompare(b.data));
  const live = lista.filter((p) => p.stato === "in").length;
  let t = "🎾 <b>Smash Oggi — Oggi in campo</b>\n";
  if (ita.length) {
    t += "\n🇮🇹 <b>Gli italiani</b>\n";
    for (const p of ita) t += `• ${ore(p.data)} — ${esc(p.g[0].nome)} vs ${esc(p.g[1].nome)} (${esc(p.torneo)}${p.turno ? ", " + esc(p.turno) : ""})\n`;
  } else t += "\nOggi nessun italiano in programma nei tabelloni principali.\n";
  if (live) t += `\n🔴 Partite in corso adesso: ${live}\n`;
  return t + `\n👉 Tutte le partite: ${SITO}partite.html`;
}

function risultato(p) {
  const [a, b] = p.g;
  const punti = (x, y) => x.set.map((s, i) => `${s}-${y.set[i]}`).join(" ");
  const v = a.vince ? a : b, s = a.vince ? b : a;
  return `✅ <b>${esc(v.nome)}</b> batte ${esc(s.nome)} ${punti(v, s)}\n${esc(p.torneo)}${p.turno ? " · " + esc(p.turno) : ""}\n${SITO}partita.html?id=${p.id}`;
}

async function invia(env, testo) {
  const r = await fetch(`https://api.telegram.org/bot${env.TELEGRAM_TOKEN}/sendMessage`, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: env.TELEGRAM_CANALE, text: testo, parse_mode: "HTML", disable_web_page_preview: true }),
  });
  if (!r.ok) console.log("Telegram", r.status, await r.text());
}

async function lavora(env, cron) {
  const lista = await partite();
  if (cron === "0 6 * * *") return invia(env, mattino(lista));
  if (!env.STATO) return; // senza KV niente risultati: rischio di doppioni
  for (const p of lista.filter((x) => x.stato === "post" && conItaliano(x))) {
    if (await env.STATO.get("r" + p.id)) continue;
    await invia(env, risultato(p));
    await env.STATO.put("r" + p.id, "1", { expirationTtl: 60 * 60 * 24 * 3 });
  }
}

export default {
  scheduled(ev, env, ctx) { ctx.waitUntil(lavora(env, ev.cron)); },
  async fetch() { return new Response("Smash Oggi worker attivo", { status: 200 }); },
};
