"""Scarica i dati veri del tennis e li scrive in docs/data/*.json.

Fonti:
- ESPN (endpoint pubblici JSON): classifiche, partite, calendario tornei, schede giocatori
- Wikipedia (wikitext delle pagine "2026 ATP Tour" / "2026 WTA Tour"): categoria e superficie dei tornei
- Feed RSS pubblici: solo titolo + link + fonte + data

Uso:  python3 build_data.py            (scrive docs/data/)
      TENNIS_CACHE=/tmp/cache python3 build_data.py   (riusa le risposte gia' scaricate: utile in sviluppo)

Regola: se un dato non c'e' nella fonte, resta vuoto (null). Niente dati inventati,
niente quote di scommesse.
"""

import hashlib
import json
import os
import re
import sys
import time
import unicodedata
import urllib.request
import xml.etree.ElementTree as ET
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timedelta, timezone
from email.utils import parsedate_to_datetime
from pathlib import Path
from zoneinfo import ZoneInfo

QUI = Path(__file__).parent
OUT = QUI / "docs" / "data"
CACHE = Path(os.environ["TENNIS_CACHE"]) if os.environ.get("TENNIS_CACHE") else None
ROMA = ZoneInfo("Europe/Rome")
UA = "Mozilla/5.0 (compatible; TennisOggiBot/0.1; +https://github.com/gr-build/tennisoggi)"

ESPN = "https://site.api.espn.com/apis/site/v2/sports/tennis"
CORE = "https://sports.core.api.espn.com/v2/sports/tennis/leagues"
GIORNI_INDIETRO = 28   # finestra dei risultati recenti (serve per "ultimi risultati" dei giocatori)
GIORNI_AVANTI = 7      # finestra delle partite in programma
ANNO = datetime.now(ROMA).year

TOURS = {"atp": "Uomini", "wta": "Donne"}

# Nomi dei paesi in italiano (codice ISO a 3 lettere, preso dalla bandiera ESPN)
PAESI = {
    "ita": "Italia", "esp": "Spagna", "fra": "Francia", "usa": "Stati Uniti", "gbr": "Regno Unito", "ger": "Germania",
    "deu": "Germania", "arg": "Argentina", "aus": "Australia", "can": "Canada", "cze": "Rep. Ceca", "pol": "Polonia",
    "rus": "Russia", "srb": "Serbia", "gre": "Grecia", "nor": "Norvegia", "den": "Danimarca", "swe": "Svezia",
    "sui": "Svizzera", "aut": "Austria", "bel": "Belgio", "ned": "Paesi Bassi", "bra": "Brasile", "chi": "Cile",
    "chn": "Cina", "jpn": "Giappone", "kaz": "Kazakistan", "bul": "Bulgaria", "cro": "Croazia", "hun": "Ungheria",
    "mon": "Monaco", "geo": "Georgia", "ukr": "Ucraina", "rou": "Romania", "svk": "Slovacchia", "slo": "Slovenia",
    "por": "Portogallo", "tun": "Tunisia", "col": "Colombia", "per": "Perù", "bih": "Bosnia", "lat": "Lettonia",
    "ltu": "Lituania", "est": "Estonia", "blr": "Bielorussia", "mex": "Messico", "tpe": "Taipei", "kor": "Corea del Sud",
    "ind": "India", "tur": "Turchia", "isr": "Israele", "rsa": "Sudafrica", "nzl": "Nuova Zelanda", "irl": "Irlanda",
    "fin": "Finlandia", "cyp": "Cipro", "uzb": "Uzbekistan", "hkg": "Hong Kong", "thai": "Thailandia", "tha": "Thailandia",
    "ecu": "Ecuador", "uru": "Uruguay", "bol": "Bolivia", "par": "Paraguay", "ven": "Venezuela", "dom": "Rep. Dominicana",
    "egy": "Egitto", "mar": "Marocco", "alg": "Algeria", "lux": "Lussemburgo", "mda": "Moldavia", "mkd": "Macedonia del Nord",
    "mne": "Montenegro", "alb": "Albania", "isl": "Islanda", "arm": "Armenia", "aze": "Azerbaigian", "pur": "Porto Rico",
    "cub": "Cuba", "crc": "Costa Rica", "phi": "Filippine", "idn": "Indonesia", "ina": "Indonesia", "vie": "Vietnam",
    "mas": "Malesia", "sgp": "Singapore", "jor": "Giordania", "uae": "Emirati Arabi", "qat": "Qatar", "ksa": "Arabia Saudita",
    "rus-": "Russia", "aia": "Anguilla", "lib": "Libano", "ltu-": "Lituania", "ger-": "Germania", "kos": "Kosovo",
    "gua": "Guatemala", "pan": "Panama", "esa": "El Salvador", "hon": "Honduras", "ber": "Bermuda", "jam": "Giamaica", "rom": "Romania", "ser": "Serbia", "mlt": "Malta", "and": "Andorra", "lao": "Laos",
    "sin": "Singapore", "tpo": "Taipei", "mon-": "Monaco",
}

MESI = ["gen", "feb", "mar", "apr", "mag", "giu", "lug", "ago", "set", "ott", "nov", "dic"]

TURNI = {
    "Final": "Finale", "Semifinal": "Semifinale", "Semifinals": "Semifinale", "Quarterfinal": "Quarti di finale",
    "Quarterfinals": "Quarti di finale", "Round of 16": "Ottavi di finale", "Round of 32": "Sedicesimi di finale",
    "Round of 64": "Trentaduesimi di finale", "Round of 128": "Primo turno", "3rd Round": "Terzo turno",
    "2nd Round": "Secondo turno", "1st Round": "Primo turno", "Third Place": "Finale 3º posto",
    "Qualifying 1st Round": "Qualificazioni, 1º turno", "Qualifying 2nd Round": "Qualificazioni, 2º turno",
    "Qualifying 3rd Round": "Qualificazioni, 3º turno", "Qualifying Final": "Qualificazioni, finale",
    "Qualifying Round of 16": "Qualificazioni, ottavi", "Qualifying Round of 32": "Qualificazioni, sedicesimi",
    "Round Robin": "Girone", "Round 1": "Primo turno", "Round 2": "Secondo turno",
    "Round 3": "Terzo turno", "Round 4": "Quarto turno",
}


def log(*a):
    print(*a, file=sys.stderr, flush=True)


def scarica(url, tentativi=3, testo=False):
    """GET con ritentativi. Restituisce JSON (o testo). None se non si riesce."""
    chiave = None
    if CACHE:
        CACHE.mkdir(parents=True, exist_ok=True)
        chiave = CACHE / hashlib.md5(url.encode()).hexdigest()
        if chiave.exists():
            raw = chiave.read_text(encoding="utf-8")
            return raw if testo else json.loads(raw)
    for t in range(tentativi):
        try:
            req = urllib.request.Request(url, headers={"User-Agent": UA, "Accept": "*/*"})
            with urllib.request.urlopen(req, timeout=30) as r:
                raw = r.read().decode("utf-8", "replace")
            if chiave:
                chiave.write_text(raw, encoding="utf-8")
            return raw if testo else json.loads(raw)
        except Exception as e:  # noqa: BLE001 - qualunque errore di rete = ritento
            if t == tentativi - 1:
                log(f"  ! non riesco a scaricare {url[:110]}: {e}")
                return None
            time.sleep(1.5 * (t + 1))


def paralleli(funzione, elementi, n=10):
    with ThreadPoolExecutor(max_workers=n) as ex:
        return list(ex.map(funzione, elementi))


def iso3(url):
    m = re.search(r"/countries/\d+/([a-z]+)\.png", url or "")
    return m.group(1) if m else None


def paese(url, alt=None):
    c = iso3(url)
    if not c:
        return None, None
    return c.upper(), PAESI.get(c, alt or c.upper())


def scrivi(nome, dati):
    OUT.mkdir(parents=True, exist_ok=True)
    (OUT / nome).write_text(json.dumps(dati, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    log(f"  scritto {nome} ({(OUT / nome).stat().st_size // 1024} KB)")


# ---------------------------------------------------------------- classifiche
def classifica(tour):
    d = scarica(f"{ESPN}/{tour}/rankings")
    if not d:
        return None
    blocco = d["rankings"][0]
    righe = []
    for r in blocco["ranks"][:100]:
        a = r["athlete"]
        cod, nome_paese = paese(a.get("flag"), a.get("flagAltText"))
        righe.append({
            "pos": r["current"], "prec": r.get("previous"), "punti": int(r["points"]) if r.get("points") is not None else None,
            "id": a["id"], "nome": a["displayName"], "cognome": a.get("lastName"),
            "paese": cod, "paeseNome": nome_paese, "eta": a.get("age"),
            "luogoNascita": (a.get("birthPlace") or {}).get("summary"),
        })
    return {"tour": tour, "aggiornata": blocco.get("update"), "righe": righe}


# ---------------------------------------------------------------- partite
def lista_giorni():
    oggi = datetime.now(ROMA).date()
    return [oggi + timedelta(days=i) for i in range(-GIORNI_INDIETRO, GIORNI_AVANTI + 1)]


def partite_giorno(args):
    tour, giorno = args
    return tour, scarica(f"{ESPN}/{tour}/scoreboard?dates={giorno:%Y%m%d}")


def estrai_partite(tour, sb):
    out = []
    if not sb:
        return out
    for ev in sb.get("events", []):
        for gr in ev.get("groupings", []):
            tipo = gr["grouping"].get("slug") or ""
            if tipo not in ("mens-singles", "womens-singles"):
                continue
            for c in gr["competitions"]:
                comp = c.get("competitors") or []
                if len(comp) != 2:
                    continue
                stato = c["status"]["type"]
                giocatori = []
                for p in sorted(comp, key=lambda x: x.get("order", 0)):
                    a = p.get("athlete") or {}
                    cod, nome_paese = paese((a.get("flag") or {}).get("href"), (a.get("flag") or {}).get("alt"))
                    giocatori.append({
                        "id": p.get("id"), "nome": a.get("displayName") or a.get("fullName"),
                        "breve": a.get("shortName"), "paese": cod,
                        "vince": bool(p.get("winner")),
                        "set": [{"g": int(s["value"]), **({"tb": int(s["tiebreak"])} if "tiebreak" in s else {})}
                                for s in p.get("linescores", [])],
                    })
                turno = (c.get("round") or {}).get("displayName") or ""
                note = " ".join(n["text"] for n in c.get("notes", []) if n.get("text"))
                out.append({
                    "id": c["id"], "tour": tour, "torneoId": str(c.get("tournamentId") or ev["id"].split("-")[0]),
                    "torneo": ev["name"], "turno": TURNI.get(turno, turno), "qualifica": "Qualifying" in turno,
                    "data": c.get("startDate") or c.get("date"), "stato": stato["state"],  # pre / in / post
                    "dettaglio": stato.get("detail") if stato["state"] != "pre" else None,
                    "campo": (c.get("venue") or {}).get("court"), "giocatori": giocatori,
                    "esito": note if stato["state"] == "post" and not note.startswith("bt") else None,
                })
    return out


# ---------------------------------------------------------------- tornei
def norm(t):
    t = unicodedata.normalize("NFKD", t or "").encode("ascii", "ignore").decode().lower()
    return re.sub(r"[^a-z0-9 ]+", " ", t)


PAROLE_VUOTE = {"open", "tennis", "championships", "classic", "international", "the", "presented", "by", "de", "du", "of",
                "masters", "cup", "ladies", "women", "wta", "atp", "grand", "prix", "powered", "and", "internazionali", "bnl"}


def parole(t):
    return {w for w in norm(t).split() if w not in PAROLE_VUOTE and len(w) > 2}


def lista_wiki(tour):
    """Legge la tabella della pagina Wikipedia: [(data_inizio, nome, citta, categoria, superficie)]."""
    t = scarica(f"https://en.wikipedia.org/w/index.php?title={ANNO}_{tour.upper()}_Tour&action=raw", testo=True)
    if not t:
        return []
    mesi = {m: i + 1 for i, m in enumerate(["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"])}
    ultima = None
    out = []
    for riga in t.splitlines():
        m = re.match(r"^\|\s*(?:rowspan=\"?\d+\"?\s*\|\s*)?(\d{1,2}) ([A-Z][a-z]{2})\b", riga)
        if m and m.group(2) in mesi:
            ultima = datetime(ANNO, mesi[m.group(2)], int(m.group(1))).date()
        for c in re.finditer(r"\[\[(?:[^\]|]*\|)?([^\]]*)\]\]\s*<br\s*/?>\s*\[\[([^\]|]*)(?:\|[^\]]*)?\]\][^<]*<br\s*/?>\s*"
                             r"((?:ATP|WTA) (?:1000|500|250)|Grand Slam)\s*<br\s*/?>\s*([^<]*)", riga):
            out.append((ultima, c.group(1).strip(), c.group(2).strip(), c.group(3).replace("ATP ", "").replace("WTA ", ""),
                        c.group(4).split(" – ")[0].strip()))
    return out


def trova_wiki(wiki, nome, citta, ini):
    """Il torneo ESPN corrisponde a una riga di Wikipedia se citta' o parole del nome coincidono e la data e' vicina."""
    pn, pc = parole(nome), parole(citta)
    migliori = []
    for w in wiki:
        if w[0] is not None and abs((w[0] - ini).days) > 12:
            continue
        pw, pcw = parole(w[1]), parole(w[2])
        if (pc and pc & pcw) or (pn & pw):
            migliori.append((abs((w[0] - ini).days) if w[0] else 99, w))
    return min(migliori, key=lambda x: x[0])[1] if migliori else None


SLAM = {"Australian Open", "Roland Garros", "Wimbledon", "US Open"}
SUPERFICI = {"hard": "Cemento", "clay": "Terra battuta", "grass": "Erba", "carpet": "Sintetico"}


def superficie_it(s):
    if not s:
        return None
    base = s.lower()
    for k, v in SUPERFICI.items():
        if base.startswith(k):
            return v + (" indoor" if "(i)" in base else "")
    return None


def torneo_dettaglio(args):
    tour, eid = args
    return tour, eid, scarica(f"{CORE}/{tour}/events/{eid}?lang=en")


def calendario(tour):
    # tutti gli id dei tornei della stagione
    ids = []
    pag = 1
    while True:
        d = scarica(f"{CORE}/{tour}/seasons/{ANNO}/types/2/events?limit=100&page={pag}")
        if not d:
            break
        ids += [re.search(r"/events/([^?]+)", i["$ref"]).group(1) for i in d["items"]]
        if pag >= d.get("pageCount", 1):
            break
        pag += 1
    log(f"  {tour}: {len(ids)} tornei in calendario")
    dettagli = paralleli(torneo_dettaglio, [(tour, i) for i in ids], 12)
    wiki = lista_wiki(tour)
    out = []
    for _, eid, d in dettagli:
        if not d:
            continue
        inizio = d["date"][:10]
        fine = (datetime.fromisoformat(d["endDate"].replace("Z", "+00:00")) - timedelta(days=1)).date().isoformat() if d.get("endDate") else None
        loc = d.get("location") or {}
        citta = (loc.get("city") or "").strip()
        categoria = superficie = None
        ini = datetime.fromisoformat(inizio).date()
        w = trova_wiki(wiki, d["name"], citta, ini)
        if w:
            categoria, superficie = w[3], superficie_it(w[4])
        elif d["name"] in SLAM:
            categoria = "Grand Slam"
        elif "Finals" in d["name"]:
            categoria = "Finals"
        out.append({
            "id": eid.split("-")[0], "tour": tour, "nome": d["name"], "inizio": inizio, "fine": fine,
            "citta": citta or None, "paese": (loc.get("country") or "").strip() or None,
            "slam": bool(categoria == "Grand Slam"), "categoria": categoria, "superficie": superficie,
        })
    out.sort(key=lambda x: (x["inizio"], x["nome"]))
    return out


# ---------------------------------------------------------------- schede giocatore
def scheda_giocatore(args):
    tour, pid = args
    d = scarica(f"{CORE}/{tour}/athletes/{pid}?lang=en")
    if not d:
        return pid, {}
    cm = round(d["height"] * 2.54) if d.get("height") else None
    kg = round(d["weight"] * 0.45359237) if d.get("weight") else None
    return pid, {
        "mano": {"RIGHT": "Destra", "LEFT": "Sinistra"}.get((d.get("hand") or {}).get("type")),
        "altezzaCm": cm, "pesoKg": kg, "esordio": d.get("debutYear"),
        "nascita": (d.get("dateOfBirth") or "")[:10] or None,
    }


# ---------------------------------------------------------------- notizie
FONTI_RSS = [
    ("Ubitennis", "https://www.ubitennis.com/feed/"),
    ("Tennis Italiano", "https://www.tennisitaliano.it/feed/"),
    ("OA Sport", "https://www.oasport.it/category/tennis/feed/"),
    ("Gazzetta dello Sport", "https://www.gazzetta.it/rss/tennis.xml"),
    ("Corriere dello Sport", "https://www.corrieredellosport.it/rss/tennis"),
    ("Tuttosport", "https://www.tuttosport.com/rss/tennis"),
]


def notizie_fonte(f):
    nome, url = f
    raw = scarica(url, testo=True)
    if not raw:
        return []
    try:
        radice = ET.fromstring(raw.encode("utf-8"))
    except ET.ParseError as e:
        log(f"  ! RSS non valido {nome}: {e}")
        return []
    out = []
    for it in radice.iter("item"):
        titolo = (it.findtext("title") or "").strip()
        link = (it.findtext("link") or "").strip()
        if not titolo or not link.startswith("http"):
            continue
        try:
            data = parsedate_to_datetime(it.findtext("pubDate")).astimezone(timezone.utc).isoformat(timespec="minutes")
        except Exception:  # noqa: BLE001
            data = None
        out.append({"titolo": re.sub(r"\s+", " ", titolo), "link": link, "fonte": nome, "data": data})
    log(f"  {nome}: {len(out)} notizie")
    return out


def notizie():
    tutte = [n for lista in paralleli(notizie_fonte, FONTI_RSS, 6) for n in lista]
    visti, uniche = set(), []
    for n in sorted(tutte, key=lambda x: x["data"] or "", reverse=True):
        if n["link"] in visti or not n["data"]:
            continue
        visti.add(n["link"])
        uniche.append(n)
    return uniche[:80]


# ---------------------------------------------------------------- main
def main():
    ora = datetime.now(timezone.utc)
    log("Classifiche...")
    classifiche = {t: classifica(t) for t in TOURS}
    for t, c in classifiche.items():
        if not c:
            sys.exit(f"Classifica {t} non scaricata: mi fermo senza toccare i dati vecchi.")
        scrivi(f"classifica-{t}.json", c)

    log("Partite...")
    giorni = [(t, g) for t in TOURS for g in lista_giorni()]
    partite = {}
    mancanti = 0
    for tour, sb in paralleli(partite_giorno, giorni, 8):
        if sb is None:
            mancanti += 1
        for p in estrai_partite(tour, sb):
            partite[(p["tour"], p["id"])] = p
    # le qualificazioni concluse da piu' di 2 giorni non servono: alleggerisce il file
    limite = (datetime.now(timezone.utc) - timedelta(days=2)).strftime("%Y-%m-%dT%H:%M")
    tutte = sorted((p for p in partite.values() if not (p["qualifica"] and p["stato"] == "post" and (p["data"] or "") < limite)),
                   key=lambda p: p["data"] or "")
    if mancanti:
        log(f"  ! {mancanti} giorni non scaricati")
    scrivi("partite.json", {"generato": ora.isoformat(timespec="minutes"), "partite": tutte})

    log("Calendario tornei...")
    tornei = []
    for t in TOURS:
        tornei += calendario(t)
    scrivi("tornei.json", {"anno": ANNO, "tornei": tornei})

    log("Schede giocatori...")
    richieste = [(t, r["id"]) for t in TOURS for r in classifiche[t]["righe"]]
    schede = {}
    for pid, s in paralleli(scheda_giocatore, richieste, 12):
        schede[pid] = s
    giocatori = {}
    for t in TOURS:
        for r in classifiche[t]["righe"]:
            giocatori[r["id"]] = {**r, "tour": t, **schede.get(r["id"], {})}
    # ultimi risultati: dalle partite concluse nella finestra scaricata (solo tabellone principale)
    for p in tutte:
        if p["stato"] != "post":
            continue
        for i, g in enumerate(p["giocatori"]):
            sc = giocatori.get(g["id"])
            if sc is not None:
                sc.setdefault("risultati", []).append({"partita": p["id"], "tour": p["tour"]})
    scrivi("giocatori.json", giocatori)

    log("Notizie...")
    scrivi("notizie.json", {"generato": ora.isoformat(timespec="minutes"), "notizie": notizie()})

    scrivi("meta.json", {"generato": ora.isoformat(timespec="minutes"),
                         "fonti": ["ESPN", "Wikipedia", *[n for n, _ in FONTI_RSS]]})
    log("Fatto.")


if __name__ == "__main__":
    main()
