"""
Radar notizie di MMA Oggi: gira ogni 30 minuti su GitHub Actions
(.github/workflows/radar.yml) e fa da due "agenti" in fila.

1. Agente News: legge le fonti MMA piu' veloci, raggruppa gli articoli che
   parlano della stessa cosa, da' a ogni notizia un voto da 0 a 100 (piu'
   fonti, nomi grossi, parole forti, italiani/Torino; meno se in Italia e'
   gia' uscita) e ricorda cosa ha gia' visto in radar/stato.json.
2. Agente Social: solo per le notizie sopra VOTO_AVVISO scrive con Gemini il
   pacchetto pronto da pubblicare (gancio, testo del video, didascalia
   Instagram, messaggio WhatsApp, domanda, hashtag) e lo manda su Telegram.
   Le notizie medie finiscono nel riepilogo delle 8 e delle 20.

La pubblicazione resta a mano: il radar propone, la persona controlla.
Variabili d'ambiente: TELEGRAM_TOKEN, TELEGRAM_CHAT_ID, GEMINI_API_KEY.
"""

import html
import json
import os
import re
import sys
import time
from datetime import datetime, timedelta, timezone
from pathlib import Path
from zoneinfo import ZoneInfo

import feedparser
import requests

ROOT = Path(__file__).parent
STATO_FILE = ROOT / "radar" / "stato.json"
ROSTER_FILE = ROOT / "docs" / "data" / "roster.json"

HEADERS = {"User-Agent": "MMAOggiRadar/1.0 (+https://gr-build.github.io/FightItalia/)"}

FONTI = {
    "MMA Fighting": "https://www.mmafighting.com/rss/index.xml",
    "MMA Mania": "https://www.mmamania.com/rss/index.xml",
    "BJPenn.com": "https://www.bjpenn.com/feed/",
    "Sherdog": "https://www.sherdog.com/rss/news.xml",
    "Bloody Elbow": "https://bloodyelbow.com/feed/",
    "Cageside Press": "https://cagesidepress.com/feed/",
    "Google News": "https://news.google.com/rss/search?q=UFC+OR+MMA+when:1d&hl=en-US&gl=US&ceid=US:en",
    # Spesso la prima a dare le notizie, ma da alcuni indirizzi risponde 429:
    # se non risponde si salta, senza fermare il radar.
    "Reddit r/MMA": "https://www.reddit.com/r/MMA/new/.rss",
}
# Per capire se in Italia la notizia e' gia' uscita.
FONTE_ITALIA = "https://news.google.com/rss/search?q=UFC+OR+MMA+when:1d&hl=it&gl=IT&ceid=IT:it"

VOTO_AVVISO = 70      # sopra: messaggio subito
VOTO_RIEPILOGO = 40   # tra questo e VOTO_AVVISO: riepilogo mattina/sera
ORE_RIEPILOGO = (8, 20)
FINESTRA_ORE = 36     # notizie piu' vecchie non interessano piu'
MEMORIA_GIORNI = 4    # dopo quanti giorni dimenticare una notizia vista

# Nomi che da soli fanno notizia anche se non sono campioni in carica.
NOMI_GROSSI = {
    "mcgregor", "jones", "topuria", "makhachev", "pereira", "aspinall", "chimaev",
    "adesanya", "poirier", "holloway", "o'malley", "omalley", "dana white", "gaethje",
    "strickland", "du plessis", "volkanovski", "nunes", "shevchenko", "harrison",
    "ngannou", "khabib", "tsarukyan", "dvalishvili", "yan", "pantoja", "van",
}
ITALIA = {
    "italy", "italian", "italia", "torino", "turin", "rome", "roma", "milan", "milano",
    "vettori", "nuzzi", "bellandi", "cerilli", "borando", "flamini",
}
PAROLE_FORTI = {
    # parola chiave -> punti
    "official": 12, "breaking": 15, "retire": 14, "retires": 14, "retirement": 12,
    "vacate": 15, "vacates": 15, "vacated": 12, "stripped": 15, "title": 8, "champion": 6,
    "arrested": 15, "suspended": 12, "banned": 12, "injury": 10, "injured": 10,
    "withdraws": 12, "pulled": 10, "out of": 8, "replaces": 10, "replacement": 8,
    "released": 10, "cut": 6, "signs": 10, "signed": 8, "booked": 10, "set for": 8,
    "rematch": 8, "dies": 20, "dead": 15, "knockout": 5, "upset": 8, "returns": 6,
    "announces": 8, "announced": 8, "headline": 6, "main event": 6,
}
PAROLE_VUOTE = set(
    "the a an to of in on at for and or vs vs. with his her he she it is are was be by from after "
    "as says said reveals reacts react video watch ufc mma fight fighter news report".split()
)


# ---------------------------------------------------------------- utilita'

def _ora():
    return datetime.now(timezone.utc)


def _carica_stato():
    try:
        return json.loads(STATO_FILE.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        return {"viste": {}, "da_riepilogare": [], "ultimo_riepilogo": None}


def _salva_stato(stato):
    STATO_FILE.parent.mkdir(exist_ok=True)
    STATO_FILE.write_text(json.dumps(stato, ensure_ascii=False, indent=1), encoding="utf-8")


def _normalizza(testo):
    testo = html.unescape(testo or "").lower()
    testo = re.sub(r"[’'`]", "'", testo)
    return re.sub(r"\s+", " ", testo).strip()


def _parole(titolo):
    return {p for p in re.findall(r"[a-z0-9']+", _normalizza(titolo)) if len(p) > 2 and p not in PAROLE_VUOTE}


def _nomi_lottatori():
    """Cognomi e nomi completi del roster UFC, per riconoscere chi e' nella
    notizia e se e' un campione."""
    try:
        roster = json.loads(ROSTER_FILE.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        return {}, set()
    nomi, campioni = {}, set()
    for r in roster:
        nome = _normalizza(r.get("nome"))
        if not nome:
            continue
        nomi[nome] = nome
        if r.get("campione_attuale"):
            campioni.add(nome)
            campioni.add(nome.split()[-1])
    return nomi, campioni


def _leggi_fonte(nome, url):
    try:
        r = requests.get(url, headers=HEADERS, timeout=20)
        r.raise_for_status()
    except requests.RequestException as errore:
        print(f"  [radar] {nome}: non raggiungibile ({errore.__class__.__name__}), salto")
        return []
    articoli = []
    for e in feedparser.parse(r.content).entries[:40]:
        struct = e.get("published_parsed") or e.get("updated_parsed")
        quando = datetime(*struct[:6], tzinfo=timezone.utc) if struct else _ora()
        titolo = html.unescape(e.get("title", "")).strip()
        # Google News aggiunge " - Nome sito" in fondo al titolo.
        fonte = nome
        if nome == "Google News" and " - " in titolo:
            titolo, fonte = titolo.rsplit(" - ", 1)
        if titolo:
            articoli.append({"titolo": titolo, "fonte": fonte, "link": e.get("link"), "quando": quando.isoformat()})
    return articoli


# ------------------------------------------------------------ agente News

def raggruppa(articoli, nomi):
    """Due articoli sono la stessa notizia se nominano lo stesso lottatore e
    hanno almeno 2 parole importanti in comune, oppure si somigliano molto."""
    gruppi = []
    for a in sorted(articoli, key=lambda x: x["quando"]):
        testo = _normalizza(a["titolo"])
        a_nomi = {n for n in nomi if n in testo}
        a_parole = _parole(a["titolo"])
        for g in gruppi:
            comuni = len(a_parole & g["parole"])
            simile = comuni / max(1, min(len(a_parole), len(g["parole"])))
            if (a_nomi & g["nomi"] and comuni >= 2) or simile >= 0.6:
                g["articoli"].append(a)
                g["parole"] |= a_parole
                g["nomi"] |= a_nomi
                break
        else:
            gruppi.append({"articoli": [a], "parole": set(a_parole), "nomi": set(a_nomi)})
    return gruppi


def voto(gruppo, campioni, titoli_italia):
    articoli = gruppo["articoli"]
    fonti = {a["fonte"] for a in articoli}
    testo = " ".join(_normalizza(a["titolo"]) for a in articoli)
    punti, motivi = 0, []

    p = min(40, 12 * len(fonti))
    punti += p
    motivi.append(f"{len(fonti)} fonti")

    if any(c in testo for c in campioni) or any(n in testo for n in NOMI_GROSSI):
        punti += 15
        motivi.append("nome grosso")

    forti = [k for k in PAROLE_FORTI if re.search(rf"\b{re.escape(k)}\b", testo)]
    if forti:
        punti += min(25, sum(PAROLE_FORTI[k] for k in forti))
        motivi.append(", ".join(forti[:3]))

    if any(re.search(rf"\b{re.escape(k)}\b", testo) for k in ITALIA):
        punti += 20
        motivi.append("Italia")

    primo = min(datetime.fromisoformat(a["quando"]) for a in articoli)
    if _ora() - primo < timedelta(hours=1):
        punti += 10
        motivi.append("fresca")

    # Gia' uscita in italiano? Se un titolo italiano nomina gli stessi
    # lottatori, qualcuno e' arrivato prima.
    gia_in_italia = bool(gruppo["nomi"]) and any(
        all(n.split()[-1] in t for n in list(gruppo["nomi"])[:2]) for t in titoli_italia
    )
    if gia_in_italia:
        punti -= 25
        motivi.append("già uscita in Italia")

    return max(0, min(100, punti)), motivi, gia_in_italia, primo


def chiave(gruppo):
    base = sorted(gruppo["nomi"]) or sorted(gruppo["parole"])[:4]
    return "|".join(base)[:120]


# ----------------------------------------------------------- agente Social

def pacchetto_social(gruppo, api_key):
    """Testi pronti da pubblicare, scritti da Gemini. Se Gemini non risponde
    si manda comunque l'avviso, solo senza bozze."""
    if not api_key:
        return None
    try:
        from build_news import _chiama_gemini_con_retry
    except ImportError:
        return None
    titoli = "\n".join(f"- {a['titolo']} ({a['fonte']})" for a in gruppo["articoli"][:6])
    una_fonte = len({a["fonte"] for a in gruppo["articoli"]}) == 1
    prompt = (
        "Sei il social media manager di MMA Oggi, account italiano di MMA/UFC senza volto "
        "(solo grafiche e voce sintetica). Regole: tempestivita', gancio forte nel primo secondo, "
        "un'opinione dichiarata come tale, onesta' assoluta: mai inventare fatti non presenti nei titoli. "
        + ("La notizia ha UNA sola fonte: presentala come 'Indiscrezione'. " if una_fonte else "")
        + "Ecco i titoli (in inglese) di una notizia appena uscita:\n" + titoli + "\n\n"
        "Rispondi SOLO in JSON valido con queste chiavi, tutto in italiano:\n"
        '{"gancio": "max 8 parole, da mettere in grande nel primo secondo del video", '
        '"testo_video": "40-70 parole da leggere con voce sintetica, frasi brevi", '
        '"didascalia_instagram": "2-3 righe", "whatsapp": "1-2 righe per il canale WhatsApp", '
        '"domanda": "una domanda secca che divide, per i commenti", "hashtag": "5 hashtag"}'
    )
    body = {
        "contents": [{"parts": [{"text": prompt}]}],
        "generationConfig": {"temperature": 0.6, "responseMimeType": "application/json", "thinkingConfig": {"thinkingBudget": 0}},
    }
    try:
        r = _chiama_gemini_con_retry(body, api_key)
        return json.loads(r.json()["candidates"][0]["content"]["parts"][0]["text"])
    except Exception as errore:
        print(f"  [radar] Gemini non disponibile per il pacchetto social: {errore}")
        return None


# ---------------------------------------------------------------- Telegram

def invia(token, chat_id, testo):
    if not token or not chat_id:
        print("  [radar] Telegram non configurato: messaggio non inviato\n" + testo)
        return False
    r = requests.post(
        f"https://api.telegram.org/bot{token}/sendMessage",
        json={"chat_id": chat_id, "text": testo[:4000], "parse_mode": "HTML", "disable_web_page_preview": True},
        timeout=20,
    )
    if not r.ok:
        print(f"  [radar] Telegram ha rifiutato il messaggio: {r.status_code} {r.text[:200]}")
    return r.ok


def e(t):
    return html.escape(str(t or ""))


def messaggio_avviso(n, social):
    icona = "🔴" if n["voto"] >= 85 else "🟠"
    fonti = sorted({a["fonte"] for a in n["articoli"]})
    stato = f"Confermata ({len(fonti)} fonti)" if len(fonti) > 1 else "⚠️ Una sola fonte: pubblicala come Indiscrezione"
    righe = [
        f"{icona} <b>VOTO {n['voto']} · {e(stato)}</b>",
        e(n["articoli"][0]["titolo"]),
        "In Italia: " + ("già pubblicata da qualcuno" if n["gia_in_italia"] else "<b>nessuno l'ha ancora pubblicata</b>"),
        f"<i>{e(', '.join(n['motivi']))}</i>",
    ]
    if social:
        righe += [
            "",
            f"🎬 <b>Gancio:</b> {e(social.get('gancio'))}",
            f"<b>Testo video:</b> {e(social.get('testo_video'))}",
            f"❓ <b>Domanda:</b> {e(social.get('domanda'))}",
            "",
            f"📸 <b>Instagram:</b> {e(social.get('didascalia_instagram'))}",
            f"💬 <b>WhatsApp:</b> {e(social.get('whatsapp'))}",
            f"# {e(social.get('hashtag'))}",
        ]
    righe += ["", "Fonti: " + ", ".join(f'<a href="{e(a["link"])}">{e(a["fonte"])}</a>' for a in n["articoli"][:5])]
    return "\n".join(righe)


def messaggio_riepilogo(voci):
    ora = datetime.now(ZoneInfo("Europe/Rome")).strftime("%H:%M")
    righe = [f"🗞 <b>Riepilogo delle {ora}</b> · {len(voci)} notizie medie", ""]
    for v in sorted(voci, key=lambda x: -x["voto"])[:12]:
        righe.append(f"• <b>{v['voto']}</b> · <a href=\"{e(v['link'])}\">{e(v['titolo'])}</a> <i>({e(v['fonte'])})</i>")
    return "\n".join(righe)


# ------------------------------------------------------------------- main

def main():
    token = os.environ.get("TELEGRAM_TOKEN", "").strip()
    chat_id = os.environ.get("TELEGRAM_CHAT_ID", "").strip()
    api_key = (os.environ.get("GEMINI_API_KEY") or "").strip()
    prova = "--prova" in sys.argv  # nessun invio, stampa soltanto

    stato = _carica_stato()
    primo_giro = not stato["viste"]
    nomi, campioni = _nomi_lottatori()

    articoli = []
    for nome, url in FONTI.items():
        articoli += _leggi_fonte(nome, url)
    limite = _ora() - timedelta(hours=FINESTRA_ORE)
    articoli = [a for a in articoli if datetime.fromisoformat(a["quando"]) >= limite]
    titoli_italia = [_normalizza(a["titolo"]) for a in _leggi_fonte("Google News Italia", FONTE_ITALIA)]

    notizie = []
    for g in raggruppa(articoli, nomi):
        v, motivi, gia, primo = voto(g, campioni, titoli_italia)
        notizie.append({**g, "voto": v, "motivi": motivi, "gia_in_italia": gia, "primo": primo, "chiave": chiave(g)})
    notizie.sort(key=lambda n: -n["voto"])
    print(f"[radar] {len(articoli)} articoli, {len(notizie)} notizie; migliori: " +
          "; ".join(f"{n['voto']} {n['articoli'][0]['titolo'][:50]}" for n in notizie[:5]))

    avvisi = 0
    for n in notizie:
        k = n["chiave"]
        vista = stato["viste"].get(k)
        # Si riavvisa solo se la notizia e' salita di almeno 15 punti (es. da
        # 1 fonte a 4): e' il momento in cui una voce diventa un fatto.
        if vista and n["voto"] < vista["voto"] + 15:
            continue
        stato["viste"][k] = {"voto": n["voto"], "quando": _ora().isoformat(), "titolo": n["articoli"][0]["titolo"]}
        if primo_giro:
            continue  # al primo avvio si impara cosa c'e' gia', senza raffica di messaggi
        if n["voto"] >= VOTO_AVVISO:
            social = pacchetto_social(n, api_key)
            testo = messaggio_avviso(n, social)
            if prova:
                print("\n" + re.sub(r"<[^>]+>", "", testo) + "\n")
            else:
                invia(token, chat_id, testo)
            avvisi += 1
        elif n["voto"] >= VOTO_RIEPILOGO:
            a = n["articoli"][0]
            stato["da_riepilogare"].append({"voto": n["voto"], "titolo": a["titolo"], "fonte": a["fonte"], "link": a["link"]})

    # Riepilogo alle 8 e alle 20 ora italiana (una volta per fascia).
    adesso = datetime.now(ZoneInfo("Europe/Rome"))
    fascia = f"{adesso.date()}-{adesso.hour}"
    if adesso.hour in ORE_RIEPILOGO and stato.get("ultimo_riepilogo") != fascia and stato["da_riepilogare"]:
        testo = messaggio_riepilogo(stato["da_riepilogare"])
        if prova:
            print(re.sub(r"<[^>]+>", "", testo))
        elif invia(token, chat_id, testo):
            stato["da_riepilogare"] = []
        stato["ultimo_riepilogo"] = fascia

    # Memoria corta: si dimenticano le notizie vecchie.
    soglia = _ora() - timedelta(days=MEMORIA_GIORNI)
    stato["viste"] = {k: v for k, v in stato["viste"].items() if datetime.fromisoformat(v["quando"]) >= soglia}
    stato["da_riepilogare"] = stato["da_riepilogare"][-40:]
    if not prova:
        _salva_stato(stato)
    print(f"[radar] avvisi inviati: {avvisi}" + (" (primo giro: solo memorizzazione)" if primo_giro else ""))


if __name__ == "__main__":
    main()
