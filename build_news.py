"""
Sezione News: aggrega gli articoli piu' recenti da 4 feed RSS di siti MMA
in inglese (BJPenn.com, MMA Mania, MMA Fighting, LowKick MMA) e li riscrive
in italiano con Gemini — MMA Junkie e' escluso perche' il suo feed non e'
raggiungibile (DNS irrisolvibile al momento di questa scrittura).

Va rilanciato periodicamente (ogni 2-3 ore, non in tempo reale) per
aggiornare docs/data/news.json. Ogni articolo viene riscritto una sola
volta: l'esito (titolo+riassunto in italiano) resta in cache/news_cache.json
usando l'URL dell'articolo come chiave, cosi' le run successive richiamano
Gemini solo sugli articoli davvero nuovi. La cache viene anche potata degli
articoli piu' vecchi di CACHE_GIORNI, altrimenti crescerebbe senza limite
(i feed mostrano solo gli articoli recenti, ma non li rimuovono mai dalla
cache locale una volta scaricati).
"""

import html
import json
import os
import time
from datetime import datetime, timedelta, timezone
from pathlib import Path

import feedparser
import requests
from bs4 import BeautifulSoup

FEEDS = {
    "BJPenn.com": "https://www.bjpenn.com/feed/",
    "MMA Mania": "https://www.mmamania.com/rss/index.xml",
    "MMA Fighting": "https://www.mmafighting.com/rss/index.xml",
    "LowKick MMA": "https://www.lowkickmma.com/feed/",
}

MAX_PER_FEED = 15
MAX_TOTALE = 40
CACHE_GIORNI = 21
PAUSA_GEMINI = 4.5  # il piano gratuito Gemini ha un limite di richieste al minuto basso
NUOVI_MAX_PER_RUN = 20  # tiene una singola run breve; il resto lo prende la run successiva (ogni 2-3h)
TENTATIVI_MAX = 4

HEADERS = {
    "User-Agent": "FightItaliaBot/1.0 (+progetto personale non commerciale, aggrega feed RSS pubblici)"
}

# Il modello principale ogni tanto e' sovraccarico (503 per ore): si passa
# al successivo della lista, e solo se falliscono tutti si rinuncia.
GEMINI_MODELLI = ["gemini-flash-latest", "gemini-flash-lite-latest", "gemini-2.5-flash-lite"]
GEMINI_URL = "https://generativelanguage.googleapis.com/v1beta/models/{modello}:generateContent"

ROOT = Path(__file__).parent
CACHE_DIR = ROOT / "cache"
CACHE_FILE = CACHE_DIR / "news_cache.json"
NEWS_FILE = ROOT / "docs" / "data" / "news.json"


def _leggi_env():
    env_file = ROOT / ".env"
    valori = {}
    if env_file.exists():
        for riga in env_file.read_text(encoding="utf-8").splitlines():
            riga = riga.strip()
            if not riga or riga.startswith("#") or "=" not in riga:
                continue
            chiave, _, valore = riga.partition("=")
            valori[chiave.strip()] = valore.strip()
    return valori


def _carica_cache():
    if CACHE_FILE.exists():
        try:
            return json.loads(CACHE_FILE.read_text(encoding="utf-8"))
        except json.JSONDecodeError:
            # Cache troncata (es. run precedente interrotta a meta' scrittura
            # da _salva_cache, non atomica): meglio ripartire da zero — nel
            # peggiore dei casi si rimanda a Gemini qualche articolo gia'
            # riscritto — che restare bloccati per sempre su ogni run futura.
            return {}
    return {}


def _salva_cache(cache):
    CACHE_DIR.mkdir(exist_ok=True)
    CACHE_FILE.write_text(json.dumps(cache, ensure_ascii=False), encoding="utf-8")


def _pulisci_html(testo):
    """Le description dei feed contengono HTML (tag <p>, <img>, entita')
    — a Gemini serve solo il testo semplice."""
    return BeautifulSoup(testo or "", "html.parser").get_text(" ", strip=True)


def _data_iso(entry):
    """feedparser normalizza le date di RSS 2.0 e Atom in una struct_time
    UTC (published_parsed/updated_parsed) — usiamo quella invece del testo
    grezzo, che ha formati diversi tra i due tipi di feed."""
    struct = entry.get("published_parsed") or entry.get("updated_parsed")
    if not struct:
        return None
    from calendar import timegm

    return datetime.fromtimestamp(timegm(struct), tz=timezone.utc).isoformat()


class LimiteRaggiunto(Exception):
    """Il piano gratuito Gemini ha rifiutato la richiesta anche dopo i
    retry: niente panico, si riprova alla prossima run (ogni 2-3h)."""


def _ritardo_da_errore_429(risposta, attesa_base):
    try:
        for dettaglio in risposta.json()["error"]["details"]:
            if dettaglio.get("@type", "").endswith("RetryInfo"):
                return float(dettaglio["retryDelay"].rstrip("s")) + 1
    except Exception:
        pass
    return attesa_base


class ModelloNonDisponibile(Exception):
    """503/timeout: il modello e' sovraccarico, conviene provarne un altro."""


def _chiama_gemini_con_retry(body, api_key):
    ultimo_errore = None
    for modello in GEMINI_MODELLI:
        try:
            return _chiama_modello(body, api_key, modello)
        except ModelloNonDisponibile as errore:
            ultimo_errore = errore
            continue
    raise ultimo_errore


def _chiama_modello(body, api_key, modello):
    attesa = 5
    url = GEMINI_URL.format(modello=modello)
    for tentativo in range(TENTATIVI_MAX):
        try:
            r = requests.post(f"{url}?key={api_key}", json=body, timeout=30)
        except requests.Timeout as errore:
            raise ModelloNonDisponibile(f"{modello}: timeout") from errore
        if r.status_code in (500, 503):
            raise ModelloNonDisponibile(f"{modello}: {r.status_code}")
        if r.status_code == 400 and "thinkingConfig" in body.get("generationConfig", {}):
            # Non tutti i modelli accettano thinkingConfig (flash-lite -> 400):
            # si riprova la stessa richiesta senza.
            body = {**body, "generationConfig": {k: v for k, v in body["generationConfig"].items() if k != "thinkingConfig"}}
            continue
        if r.status_code != 429:
            r.raise_for_status()
            return r
        if tentativo == TENTATIVI_MAX - 1:
            raise LimiteRaggiunto(f"rate limit Gemini dopo {TENTATIVI_MAX} tentativi")
        ritardo = _ritardo_da_errore_429(r, attesa)
        print(f"  [news] rate limit Gemini, riprovo tra {ritardo:.0f}s...")
        time.sleep(ritardo)
        attesa *= 2
    raise LimiteRaggiunto("rate limit Gemini")


def _riscrivi_con_gemini(api_key, titolo, estratto, fonte):
    prompt = (
        "Sei un redattore sportivo italiano che scrive per un sito di MMA/UFC. "
        "Ti do il titolo e l'estratto (in inglese) di una notizia presa da "
        f"{fonte}. Scrivi DA ZERO in italiano, senza tradurre parola per parola "
        "e senza copiare frasi dell'originale:\n"
        "1. Un titolo riassuntivo su una riga (max ~90 caratteri)\n"
        "2. Un riassunto di 2-3 frasi\n\n"
        f"Titolo originale: {titolo}\n"
        f"Estratto originale: {estratto}\n\n"
        "Rispondi SOLO in JSON valido, senza markdown, con questo formato "
        'esatto: {"titolo": "...", "riassunto": "..."}'
    )
    body = {
        "contents": [{"parts": [{"text": prompt}]}],
        "generationConfig": {
            "temperature": 0.4,
            "responseMimeType": "application/json",
            "thinkingConfig": {"thinkingBudget": 0},
        },
    }
    r = _chiama_gemini_con_retry(body, api_key)
    testo = r.json()["candidates"][0]["content"]["parts"][0]["text"]
    dati = json.loads(testo)
    return dati["titolo"].strip(), dati["riassunto"].strip()


def _voce_originale(titolo, estratto, fonte, link, pubblicato):
    """Notizia com'e' nel feed (inglese), usata quando Gemini non risponde o
    si e' gia' raggiunto il tetto della run. Non va in cache: alla run
    successiva si riprova a riscriverla in italiano."""
    riassunto = estratto if len(estratto) <= 280 else estratto[:280].rsplit(" ", 1)[0] + "…"
    return {"titolo": titolo, "riassunto": riassunto, "fonte": fonte, "url": link, "pubblicato": pubblicato, "lingua": "en"}


def genera_news():
    # In locale la chiave sta in .env (gitignored); su GitHub Actions arriva
    # come variabile d'ambiente dal secret GEMINI_API_KEY, non c'e' un .env.
    api_key = os.environ.get("GEMINI_API_KEY") or _leggi_env().get("GEMINI_API_KEY")
    # Il secret su GitHub era stato incollato con un "a capo" finale: finiva
    # nell'URL come %0A e Gemini rispondeva 401 a ogni articolo, per settimane,
    # con news.json sempre vuoto. Spazi e a capo non fanno mai parte della chiave.
    api_key = (api_key or "").strip()
    if not api_key:
        print("[news] GEMINI_API_KEY mancante (ne' in .env ne' nell'ambiente): impossibile generare le news.")
        return

    cache = _carica_cache()
    soglia_cache = datetime.now(timezone.utc) - timedelta(days=CACHE_GIORNI)
    articoli = []
    nuovi, da_cache, falliti = 0, 0, 0

    limite_raggiunto = False
    for fonte, url_feed in FEEDS.items():
        try:
            feed = feedparser.parse(url_feed, agent=HEADERS["User-Agent"])
            if feed.bozo and not feed.entries:
                raise feed.bozo_exception
        except Exception as errore:
            print(f"  [news] {fonte}: feed non raggiungibile ({errore}), salto")
            continue

        for entry in feed.entries[:MAX_PER_FEED]:
            link = entry.get("link")
            if not link:
                continue

            if link in cache:
                articoli.append(cache[link])
                da_cache += 1
                continue

            titolo_orig = html.unescape(entry.get("title", "")).strip()
            estratto = _pulisci_html(entry.get("summary", "") or entry.get("description", ""))[:1200]
            pubblicato = _data_iso(entry)
            if not titolo_orig:
                continue

            if nuovi >= NUOVI_MAX_PER_RUN or limite_raggiunto:
                articoli.append(_voce_originale(titolo_orig, estratto, fonte, link, pubblicato))
                continue

            try:
                titolo_it, riassunto_it = _riscrivi_con_gemini(api_key, titolo_orig, estratto, fonte)
            except LimiteRaggiunto as errore:
                print(f"  [news] {errore}: niente piu' Gemini in questa run, il resto resta in inglese")
                limite_raggiunto = True
                articoli.append(_voce_originale(titolo_orig, estratto, fonte, link, pubblicato))
                continue
            except Exception as errore:
                print(f"  [news] Gemini fallito per '{titolo_orig[:60]}': {errore}")
                falliti += 1
                articoli.append(_voce_originale(titolo_orig, estratto, fonte, link, pubblicato))
                continue

            voce = {
                "titolo": titolo_it,
                "riassunto": riassunto_it,
                "fonte": fonte,
                "url": link,
                "pubblicato": pubblicato,
            }
            cache[link] = voce
            articoli.append(voce)
            nuovi += 1
            time.sleep(PAUSA_GEMINI)

    # Pota la cache: solo articoli visti negli ultimi CACHE_GIORNI (o senza
    # data leggibile, per sicurezza) — i feed espongono solo il recente, la
    # cache non deve invece crescere all'infinito.
    cache_potata = {
        url: voce
        for url, voce in cache.items()
        if not voce.get("pubblicato") or datetime.fromisoformat(voce["pubblicato"]) >= soglia_cache
    }
    _salva_cache(cache_potata)

    articoli.sort(key=lambda v: v.get("pubblicato") or "", reverse=True)
    articoli = articoli[:MAX_TOTALE]

    NEWS_FILE.parent.mkdir(parents=True, exist_ok=True)
    NEWS_FILE.write_text(
        json.dumps(
            {"generato_il": datetime.now(timezone.utc).isoformat(), "articoli": articoli},
            ensure_ascii=False,
        ),
        encoding="utf-8",
    )
    print(f"[news] news.json: {len(articoli)} articoli ({nuovi} nuovi, {da_cache} da cache, {falliti} falliti)")


if __name__ == "__main__":
    genera_news()
