"""Classifiche del gioco Top 10: docs/data/top10.json.

Una classifica al giorno, uguale per tutti: viene fissata quando arriva il suo
giorno (oggi e domani) e poi non cambia piu', cosi' chi gioca alle 8 e chi gioca
alle 23 vede la stessa. Due tipi, tutti da dati ufficiali:

- classifica ufficiale UFC di una categoria (primi 10, dal sito UFC via
  classifiche.json); il campione e' mostrato come indizio. Esce solo se tutti e
  10 sono nel roster del gioco;
- classifica per numeri (vittorie, KO, sottomissioni) VERIFICATA su due fonti:
  il sito (Wikipedia) e ESPN. Esce solo se i dieci posti (con i pari merito)
  sono gli stessi con le due fonti, con lo stesso posto per ciascuno, e nessun
  lottatore senza dati ESPN e' vicino alla soglia. Il numero accanto al nome
  si mostra solo dove le due fonti coincidono.

Se non c'e' nessuna classifica verificata, il gioco dice che torna domani. Non si
inventa nulla e non si aggiunge nessun giorno se ESPN non risponde.

Formato: {"g": {"2026-10-08": {"t": titolo, "u": unita, "c": campione?, "v": [[slug, valore|null, posto], ...]}}, "ver": data}

Uso: python build_top10.py   (dopo build_data.py e build_griglia.py; gira nel workflow dati)
"""

import concurrent.futures as cf
import json
import random
import re
import unicodedata
import urllib.request
from datetime import datetime, timedelta
from pathlib import Path
from zoneinfo import ZoneInfo

DOCS = Path(__file__).parent / "docs"
GIORNI_AVANTI = 3  # oggi e i 3 giorni dopo (se il workflow dei dati salta un giro, la classifica c'e comunque)
GIORNI_INDIETRO = 10
SENZA_RIPETERE = 7  # giorni prima di ripetere la stessa classifica
MAX_VALIDI = 13
MIN_SOGLIA = {"v": 15, "ko": 6, "sub": 4}
STAT = {
    "v": ("wins", "più vittorie in carriera", "vittorie"),
    "ko": ("tkos", "più vittorie per KO/TKO", "KO"),
    "sub": ("submissions", "più vittorie per sottomissione", "sottomissioni"),
}
DIVISIONI = ["Massimi", "Mediomassimi", "Medi", "Welter", "Leggeri", "Piuma", "Gallo", "Mosca", "Paglia"]
UA = {"User-Agent": "Mozilla/5.0"}


def _get(url):
    for _ in range(3):
        try:
            return json.load(urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=25))
        except Exception:
            pass
    return None


def _espn(x):
    m = re.search(r"/full/(\d+)\.png", x.get("f") or "")
    if not m:
        return x["s"], None
    r = _get(f"https://sports.core.api.espn.com/v2/sports/mma/athletes/{m.group(1)}/records")
    if not r or not r.get("items"):
        return x["s"], None
    return x["s"], {s["name"]: int(float(s["value"])) for s in r["items"][0]["stats"]
                    if s.get("name") in ("wins", "tkos", "submissions")}


def filtri(pool):
    f = [("tutti", "", lambda x: True), ("uomini", "uomini", lambda x: x.get("g") != "F"),
         ("donne", "donne", lambda x: x.get("g") == "F")]
    for c in DIVISIONI:
        for g, nome in (("M", "uomini"), ("F", "donne")):
            def ok(x, c=c, g=g):
                return x.get("c") == c and (x.get("g") == "F") == (g == "F")
            if sum(1 for x in pool if ok(x)) >= 25:
                f.append((f"{c.lower()}-{g}", f"pesi {c.lower()} · {nome}", ok))
    return f


def _ordine(val):
    """[(slug, valore, posto)] ordinato, con i pari merito allo stesso posto."""
    o = sorted(val.items(), key=lambda kv: -kv[1])
    out, posto, prec = [], 0, None
    for i, (s, v) in enumerate(o):
        if v != prec:
            posto = i + 1
        prec = v
        out.append((s, v, posto))
    return out


def classifica(pool, ok, k, espn):
    """Lista verificata [[slug, valore o None, posto]] oppure None."""
    gruppo = [x for x in pool if ok(x)]
    if len(gruppo) < 25:
        return None
    letture = {}
    for fonte in ("sito", "espn"):
        val = {}
        for x in gruppo:
            v = round(x[k]) if fonte == "sito" and x.get(k) is not None else (espn.get(x["s"]) or {}).get(STAT[k][0]) if fonte == "espn" else None
            if v is not None:
                val[x["s"]] = v
        o = _ordine(val)
        if len(o) < 10:
            return None
        soglia = o[9][1]
        letture[fonte] = ([r for r in o if r[1] >= soglia], soglia)
    (a, sa), (b, sb) = letture["sito"], letture["espn"]
    posti_a = {s: p for s, _, p in a}
    posti_b = {s: p for s, _, p in b}
    if posti_a != posti_b or len(a) > MAX_VALIDI or min(sa, sb) < MIN_SOGLIA[k]:
        return None  # stessi lottatori, stesso posto per tutti, soglia sensata
    senza_espn = [x for x in gruppo if not espn.get(x["s"])]
    if any(x.get(k) is not None and round(x[k]) >= min(sa, sb) - 2 for x in senza_espn):
        return None
    valori_a = {s: v for s, v, _ in a}
    return [[s, v if valori_a.get(s) == v else None, p] for s, v, p in b]


def _norm(t):
    t = unicodedata.normalize("NFKD", str(t or "")).encode("ascii", "ignore").decode()
    return re.sub(r"[^a-z0-9]", "", t.lower().replace("*", ""))


IT_DIV = {"Flyweight": "mosca", "Bantamweight": "gallo", "Featherweight": "piuma", "Lightweight": "leggeri",
          "Welterweight": "welter", "Middleweight": "medi", "Light Heavyweight": "mediomassimi",
          "Heavyweight": "massimi", "Strawweight": "paglia"}


def classifiche_ufc(tutti):
    """Classifiche ufficiali UFC (primi 10) con tutti e 10 nel roster del gioco."""
    try:
        data = json.loads((DOCS / "data" / "classifiche.json").read_text(encoding="utf-8"))["divisioni"]
    except (OSError, ValueError, KeyError):
        return []
    per_nome = {_norm(x["n"]): x["s"] for x in tutti}
    out = []
    for d in data:
        posti = {c["pos"]: c for c in d.get("classifica", [])}
        if not all(i in posti for i in range(1, 11)):
            continue
        slug = [per_nome.get(_norm(posti[i]["nome"])) for i in range(1, 11)]
        if None in slug:
            continue
        tipo = d["tipo"]
        if tipo.startswith("p4p"):
            titolo = f"Top 10: classifica pound-for-pound UFC ({'uomini' if tipo.endswith('uomini') else 'donne'})"
            campione = None
        else:
            titolo = f"Top 10: classifica UFC · pesi {IT_DIV.get(d['categoria'], d['categoria']).lower()} ({'uomini' if tipo == 'uomini' else 'donne'})"
            campione = (d.get("campione") or {}).get("nome")
        puzzle = {"t": titolo, "u": "", "v": [[slug[i - 1], None, i] for i in range(1, 11)]}
        if campione:
            puzzle["c"] = campione
        out.append((f"rank-{tipo}-{d['categoria']}", puzzle))
    return out


def classifiche_numeri(pool, espn):
    out, viste = [], set()
    for k in STAT:
        for fid, testo, ok in filtri(pool):
            lista = classifica(pool, ok, k, espn)
            if lista:
                insieme = (k, tuple(sorted(s for s, _, _ in lista)))
                if insieme in viste:  # "tutti" e "uomini" possono dare la stessa lista
                    continue
                viste.add(insieme)
                titolo = f"Top 10: {STAT[k][1]}" + (f" · {testo}" if testo else "")
                out.append((f"{k}-{fid}", {"t": titolo, "u": STAT[k][2], "v": lista}))
    return out


def main():
    tutti = json.loads((DOCS / "data" / "giochi.json").read_text(encoding="utf-8"))
    pool = [x for x in tutti if x.get("f") and x.get("v") is not None]
    oggi = datetime.now(ZoneInfo("Europe/Rome")).date()
    path = DOCS / "data" / "top10.json"
    try:
        vecchie = json.loads(path.read_text(encoding="utf-8")).get("g", {})
    except (OSError, ValueError):
        vecchie = {}
    inizio = (oggi - timedelta(days=GIORNI_INDIETRO)).isoformat()
    out = {g: p for g, p in vecchie.items() if g >= inizio}
    mancanti = [(oggi + timedelta(days=d)).isoformat() for d in range(0, GIORNI_AVANTI + 1)]
    mancanti = [g for g in mancanti if g not in out]
    if mancanti:
        candidate = classifiche_ufc(tutti)
        espn = {}
        with cf.ThreadPoolExecutor(12) as ex:
            espn = dict(ex.map(_espn, pool))
        if sum(1 for v in espn.values() if v) >= 0.85 * len(pool):
            candidate += classifiche_numeri(pool, espn)
        else:
            print("Top 10: ESPN non risponde abbastanza, solo classifiche ufficiali UFC")
        for giorno in mancanti:
            recenti = {p["t"] for g, p in out.items() if g < giorno and g >= (datetime.fromisoformat(giorno) - timedelta(days=SENZA_RIPETERE)).date().isoformat()}
            scelte = [c for c in candidate if c[1]["t"] not in recenti] or candidate
            if not scelte:
                print(f"Top 10: nessuna classifica verificata per {giorno}")
                continue
            out[giorno] = random.Random(f"top10-{giorno}").choice(scelte)[1]
        print(f"Top 10: {len(candidate)} classifiche disponibili, {len(mancanti)} giorni fissati")
    else:
        print("Top 10: oggi e domani gia' fissati")
    path.write_text(json.dumps({"g": out, "ver": oggi.isoformat()}, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")


if __name__ == "__main__":
    main()
