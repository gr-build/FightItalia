"""Schede lottatore da ESPN per chi non ha una pagina Wikipedia.

Il roster UFC viene da Wikipedia, ma 310 lottatori su 718 non hanno una pagina
propria e restavano senza scheda (cliccandoli non si apriva niente: Tommy
McMillen, Sedriques Dumas...). ESPN ha per tutti biografia, record, storico
completo (avversario, esito, metodo, round, tempo, evento) e le statistiche
dei colpi incontro per incontro.

Per ogni lottatore del roster senza scheda:
  1. cerca l'atleta su ESPN per nome (nome identico, sport MMA)
  2. scrive docs/data/lottatori/<slug>.json nello stesso formato delle schede
     Wikipedia (infobox + storico), con "fonte": "ESPN"
  3. aggiunge lo slug alla riga del roster, cosi' la scheda si apre dal sito

Le schede ESPN si riscaricano dopo GIORNI_VALIDITA giorni (record e storico
cambiano dopo ogni incontro). Niente foto: le foto ESPN non hanno una licenza
libera, restano quelle di Wikimedia dove ci sono.

Uso: python build_espn.py            (dopo build_data.py)
     python build_espn.py "Nome"     (solo quel lottatore, per prova)
"""

import json
import re
import sys
import time
import unicodedata
from datetime import date, datetime, timedelta
from pathlib import Path

import requests

ROOT = Path(__file__).parent
DATI = ROOT / "docs" / "data"
LOTTATORI = DATI / "lottatori"
CACHE = ROOT / "cache" / "espn_cache.json"  # nomi di avversari ed eventi: non cambiano
GIORNI_VALIDITA = 7
MAX_PER_RUN = int(__import__("os").environ.get("ESPN_MAX", "400"))  # nel workflow 60: il rinnovo settimanale si spalma sui giorni
PAUSA = 0.05

CORE = "https://sports.core.api.espn.com/v2/sports/mma"
SITE = "https://site.web.api.espn.com/apis/common/v3/sports/mma"
CERCA = "https://site.web.api.espn.com/apis/search/v2"
PAESI = {
    "USA": "Stati Uniti", "BRA": "Brasile", "RUS": "Russia", "GBR": "Regno Unito", "ENG": "Regno Unito", "MEX": "Messico",
    "CAN": "Canada", "AUS": "Australia", "CHN": "Cina", "POL": "Polonia", "JPN": "Giappone", "FRA": "Francia",
    "GER": "Germania", "IRL": "Irlanda", "SWE": "Svezia", "NZL": "Nuova Zelanda", "KOR": "Corea del Sud",
    "GEO": "Georgia", "KAZ": "Kazakistan", "UZB": "Uzbekistan", "KGZ": "Kirghizistan", "TJK": "Tagikistan",
    "ARM": "Armenia", "AZE": "Azerbaigian", "UKR": "Ucraina", "CZE": "Cechia", "NED": "Paesi Bassi", "ITA": "Italia",
    "ESP": "Spagna", "POR": "Portogallo", "ARG": "Argentina", "PER": "Perù", "CHI": "Cile", "ECU": "Ecuador",
    "VEN": "Venezuela", "COL": "Colombia", "CUB": "Cuba", "NGR": "Nigeria", "CMR": "Camerun", "RSA": "Sudafrica",
    "MAR": "Marocco", "TUR": "Turchia", "SUI": "Svizzera", "AUT": "Austria", "BEL": "Belgio", "DEN": "Danimarca",
    "NOR": "Norvegia", "FIN": "Finlandia", "ISL": "Islanda", "CRO": "Croazia", "SRB": "Serbia", "BIH": "Bosnia",
    "MDA": "Moldavia", "ROU": "Romania", "BUL": "Bulgaria", "LTU": "Lituania", "PHI": "Filippine", "THA": "Thailandia",
    "IND": "India", "MGL": "Mongolia", "JAM": "Giamaica", "DOM": "Rep. Dominicana", "PAN": "Panama", "BLR": "Bielorussia",
}

sessione = requests.Session()
sessione.headers["User-Agent"] = "MMAOggi/1.0 (+https://gr-build.github.io/FightItalia/)"


def _norm(t):
    t = unicodedata.normalize("NFKD", t or "").encode("ascii", "ignore").decode().lower()
    return re.sub(r"[^a-z0-9]", "", t)


def _slug(nome):
    t = unicodedata.normalize("NFKD", nome).encode("ascii", "ignore").decode().lower()
    return re.sub(r"[^a-z0-9]+", "-", t).strip("-")


def _get(url, **params):
    for tentativo in range(3):
        try:
            r = sessione.get(url.replace("http://", "https://"), params=params or None, timeout=20)
            if r.status_code == 404:
                return None
            r.raise_for_status()
            time.sleep(PAUSA)
            return r.json()
        except (requests.RequestException, ValueError):
            time.sleep(1.5 * (tentativo + 1))
    return None


def _parole(nome):
    """Parole del nome senza ordine, trattini e 'Jr.': 'Lee Yi-sak' == 'Yisak Lee'."""
    t = unicodedata.normalize("NFKD", nome or "").encode("ascii", "ignore").decode().lower().replace("-", "")
    lettere = "".join(p for p in re.findall(r"[a-z]+", t) if p not in ("jr", "sr", "ii", "iii"))
    return "".join(sorted(lettere))  # stesse lettere, qualsiasi ordine e spaziatura


def cerca_atleta(nome):
    candidati = []
    parti = nome.split()
    rovesciato = " ".join(parti[1:] + parti[:1]) if len(parti) >= 2 else nome  # "Lee Yi-sak" -> "Yi-sak Lee"
    for query in (nome, re.sub(r"\s+(Jr\.?|Sr\.?)$", "", nome), rovesciato, rovesciato.replace("-", "")):
        dati = _get(CERCA, query=query, limit=10) or {}
        for gruppo in dati.get("results") or []:
            for c in gruppo.get("contents") or []:
                m = re.search(r"a:(\d+)", c.get("uid") or "")
                if c.get("sport") == "mma" and m:
                    candidati.append((c.get("displayName") or "", m.group(1)))
        if candidati:
            break
    for nome_espn, id_atleta in candidati:  # nome identico
        if _norm(nome_espn) == _norm(nome):
            return id_atleta
    for nome_espn, id_atleta in candidati:  # stesse parole in altro ordine (nomi coreani, cinesi)
        if _parole(nome_espn) == _parole(nome):
            return id_atleta
    return None


def _metodo(nome_esito):
    """'Decision - Unanimous' -> 'Decision (unanimous)', come nelle schede Wikipedia
    (common.js conta i metodi guardando l'inizio: ko/tko, submission, decision)."""
    if not nome_esito:
        return ""
    parti = [p.strip() for p in nome_esito.split(" - ", 1)]
    base = parti[0]
    if base.upper() in ("KO", "TKO", "KO/TKO"):
        base = "TKO" if "T" in base.upper() else "KO"
    return f"{base} ({parti[1].lower()})" if len(parti) > 1 else base


def storico_espn(id_atleta, cache):
    log = _get(f"{CORE}/athletes/{id_atleta}/eventlog") or {}
    righe = []
    for voce in (log.get("events") or {}).get("items") or []:
        if not voce.get("played"):
            continue
        comp = _get(voce["competition"]["$ref"])
        if not comp:
            continue
        io = next((c for c in comp.get("competitors") or [] if str(c.get("id")) == str(id_atleta)), None)
        lui = next((c for c in comp.get("competitors") or [] if str(c.get("id")) != str(id_atleta)), None)
        if not io or not lui:
            continue
        chiave_avv = f"a{lui['id']}"
        if chiave_avv not in cache:
            a = _get((lui.get("athlete") or {}).get("$ref", "")) or {}
            cache[chiave_avv] = a.get("displayName") or ""
        ev_ref = voce["event"]["$ref"]
        chiave_ev = "e" + re.search(r"events/(\d+)", ev_ref).group(1)
        if chiave_ev not in cache:
            e = _get(ev_ref) or {}
            cache[chiave_ev] = e.get("name") or e.get("shortName") or ""
        stato = _get((comp.get("status") or {}).get("$ref", "")) or {}
        esito = (stato.get("result") or {}).get("displayName") or ""
        if io.get("winner"):
            res = "Win"
        elif lui.get("winner"):
            res = "Loss"
        else:
            res = "Draw" if "draw" in esito.lower() else "NC"
        quando = datetime.strptime(comp["date"][:10], "%Y-%m-%d") if comp.get("date") else None
        righe.append({
            "res.": res, "record": "", "opponent": cache[chiave_avv], "method": _metodo(esito),
            "event": cache[chiave_ev], "date": quando.strftime("%B %-d, %Y") if quando else "",
            "round": str(stato.get("period") or ""), "time": stato.get("displayClock") or "",
            "location": "", "notes": "", "_ordine": comp.get("date") or "",
        })
    righe.sort(key=lambda r: r["_ordine"])
    v = s = p = 0
    for r in righe:  # record progressivo, dal primo incontro
        v += r["res."] == "Win"
        s += r["res."] == "Loss"
        p += r["res."] == "Draw"
        r["record"] = f"{v}–{s}" + (f"–{p}" if p else "")
        del r["_ordine"]
    return righe[::-1]


def precisione_colpi(id_atleta):
    """Precisione dei colpi significativi su tutti gli incontri ESPN (SSL/SSA)."""
    dati = _get(f"{SITE}/athletes/{id_atleta}/stats") or {}
    for cat in dati.get("categories") or []:
        if cat.get("displayName") != "striking":
            continue
        etichette = cat.get("labels") or []
        if "SSL" not in etichette or "SSA" not in etichette:
            return None
        i_l, i_a = etichette.index("SSL"), etichette.index("SSA")
        a_segno = tentati = 0
        for s in cat.get("statistics") or []:
            try:
                a_segno += float(s["stats"][i_l])
                tentati += float(s["stats"][i_a])
            except (ValueError, IndexError, KeyError):
                continue
        return f"{round(100 * a_segno / tentati)}%" if tentati >= 30 else None
    return None


def scheda_espn(id_atleta, nome, cache):
    a = _get(f"{CORE}/athletes/{id_atleta}") or {}
    if not a:
        return None
    ib = {"_nome": nome}
    if a.get("height"):
        ib["Height"] = f"{round(a['height'] * 2.54)} cm ({a.get('displayHeight', '')})"
    if a.get("weight"):
        ib["Weight"] = f"{round(a['weight'] * 0.4536)} kg ({int(a['weight'])} lb)"
    if a.get("reach"):
        ib["Reach"] = f"{round(a['reach'] * 2.54)} cm ({int(a['reach'])} in)"
    guardie = {"orthodox": "destra", "southpaw": "mancina", "switch": "che cambia", "open stance": "aperta"}
    if (a.get("stance") or {}).get("text"):
        t = a["stance"]["text"].lower()
        ib["Style"] = f"Guardia {guardie.get(t, t)}"
    if (a.get("association") or {}).get("name"):
        ib["Team"] = a["association"]["name"]
    if a.get("dateOfBirth"):
        nascita = datetime.strptime(a["dateOfBirth"][:10], "%Y-%m-%d")
        paese = PAESI.get(a.get("citizenship") or "", a.get("citizenship") or "")
        ib["Born"] = f"{nascita.strftime('%d/%m/%Y')} ({a.get('age', '')} anni)" + (f" · {paese}" if paese else "")
    if a.get("citizenship"):
        ib["Nationality"] = PAESI.get(a["citizenship"], a["citizenship"])
    if (a.get("weightClass") or {}).get("text"):
        ib["Division"] = a["weightClass"]["text"]
    if a.get("nickname"):
        ib["Other names"] = a["nickname"]
    prec = precisione_colpi(id_atleta)
    if prec:
        ib["Striking accuracy"] = prec
    storico = storico_espn(id_atleta, cache)
    return {
        "nome": nome,
        "link": f"https://www.espn.com/mma/fighter/_/id/{id_atleta}",
        "infobox": ib,
        "storico": storico,
        "fonte": "ESPN",
        "espn_id": id_atleta,
        "ultimo_aggiornamento": date.today().isoformat(),
    }


def completa_roster(solo=None):
    roster_file = DATI / "roster.json"
    roster = json.loads(roster_file.read_text(encoding="utf-8"))
    try:
        cache = json.loads(CACHE.read_text(encoding="utf-8"))
    except (OSError, ValueError):
        cache = {}
    oggi = date.today()
    fatte = saltate = non_trovate = 0
    for r in roster:
        if solo and _norm(r.get("nome")) != _norm(solo):
            continue
        slug = r.get("slug")
        if slug and (LOTTATORI / f"{slug}.json").exists():
            try:
                esistente = json.loads((LOTTATORI / f"{slug}.json").read_text(encoding="utf-8"))
            except (OSError, ValueError):
                esistente = {}
            if esistente.get("fonte") != "ESPN":
                continue  # ha gia' la scheda Wikipedia
        slug = slug or _slug(r["nome"])
        file = LOTTATORI / f"{slug}.json"
        if file.exists():
            try:
                vecchia = json.loads(file.read_text(encoding="utf-8"))
            except (OSError, ValueError):
                vecchia = {}
            if vecchia.get("fonte") == "ESPN" and (oggi - date.fromisoformat(vecchia.get("ultimo_aggiornamento", "2000-01-01"))).days < GIORNI_VALIDITA:
                r["slug"] = slug
                saltate += 1
                continue
            if vecchia and vecchia.get("fonte") != "ESPN":
                slug = f"{slug}-espn"  # stesso nome di una scheda Wikipedia di un'altra persona
                file = LOTTATORI / f"{slug}.json"
        if fatte >= MAX_PER_RUN:
            # limite della run: niente download, ma chi ha gia' una scheda ESPN
            # (anche scaduta) resta collegato: il roster e' appena stato rigenerato
            if file.exists():
                r["slug"] = slug
            continue
        id_atleta = (json.loads(file.read_text(encoding="utf-8")).get("espn_id") if file.exists() else None) or cerca_atleta(r["nome"])
        if not id_atleta:
            non_trovate += 1
            continue
        scheda = scheda_espn(id_atleta, r["nome"], cache)
        if not scheda:  # anche chi debutta (storico vuoto) ha la sua scheda: biografia e record
            non_trovate += 1
            continue
        file.write_text(json.dumps(scheda, ensure_ascii=False), encoding="utf-8")
        r["slug"] = slug
        fatte += 1
        if fatte % 20 == 0:
            print(f"  [espn] {fatte} schede...")
            CACHE.parent.mkdir(exist_ok=True)
            CACHE.write_text(json.dumps(cache, ensure_ascii=False), encoding="utf-8")
    roster_file.write_text(json.dumps(roster, ensure_ascii=False), encoding="utf-8")
    CACHE.parent.mkdir(exist_ok=True)
    CACHE.write_text(json.dumps(cache, ensure_ascii=False), encoding="utf-8")
    print(f"Schede ESPN: {fatte} nuove o aggiornate, {saltate} ancora valide, {non_trovate} non trovate su ESPN")


def completa_card(giorni=30, salva_cache=True):
    """Chi combatte negli eventi dei prossimi giorni ma non e' nel roster UFC
    (esordienti, sostituti: Tina Black a Rosas Jr. vs Barcelos) riceve una
    scheda ESPN e una riga in extra-lottatori.json: cosi' il "Confronta" della
    pagina evento funziona per tutti gli incontri."""
    roster = json.loads((DATI / "roster.json").read_text(encoding="utf-8"))
    extra_file = DATI / "extra-lottatori.json"
    extra = json.loads(extra_file.read_text(encoding="utf-8"))
    noti = {_norm(r.get("nome")) for r in roster + extra if r.get("slug")}
    try:
        cache = json.loads(CACHE.read_text(encoding="utf-8"))
    except (OSError, ValueError):
        cache = {}
    oggi = date.today()
    aggiunti = 0
    for ev in json.loads((DATI / "eventi.json").read_text(encoding="utf-8")):
        if ev.get("stato") != "programmato" or not ev.get("link"):
            continue
        try:
            giorno = datetime.strptime(ev["data"], "%b %d, %Y").date()
        except (KeyError, ValueError):
            continue
        if not (oggi <= giorno <= oggi + timedelta(days=giorni)):
            continue
        slug_ev = re.sub(r"[^a-z0-9]+", "-", ev["link"].rstrip("/").split("/")[-1].lower()).strip("-")
        try:
            card = json.loads((DATI / "eventi" / f"{slug_ev}.json").read_text(encoding="utf-8"))
        except (OSError, ValueError):
            continue
        for b in card:
            for k in ("fighter1", "fighter2"):
                nome = b.get(k)
                if not nome or _norm(nome) in noti:
                    continue
                id_atleta = cerca_atleta(nome)
                if not id_atleta:
                    continue
                scheda = scheda_espn(id_atleta, nome, cache)
                if not scheda:
                    continue
                slug = _slug(nome)
                if (LOTTATORI / f"{slug}.json").exists():
                    try:
                        if json.loads((LOTTATORI / f"{slug}.json").read_text(encoding="utf-8")).get("fonte") != "ESPN":
                            slug += "-espn"
                    except (OSError, ValueError):
                        pass
                (LOTTATORI / f"{slug}.json").write_text(json.dumps(scheda, ensure_ascii=False), encoding="utf-8")
                sito = (_get(f"{SITE}/athletes/{id_atleta}") or {}).get("athlete") or {}
                wld = next((x.get("displayValue") for x in (sito.get("statsSummary") or {}).get("statistics") or [] if x.get("name") == "wins-losses-draws"), "")
                v, l, p = (wld.split("-") + ["0", "0", "0"])[:3]
                extra = [x for x in extra if _norm(x.get("nome")) != _norm(nome)]
                extra.append({
                    "slug": slug, "nome": nome, "link": scheda["link"], "categoria": b.get("categoria"),
                    "record_mma": f"{v}–{l}" + (f"–{p}" if p not in ("", "0") else "") if wld else None,
                    "foto": None, "foto_espn": (sito.get("headshot") or {}).get("href"),
                    "eta": str(sito.get("age") or "") or None, "campione_attuale": False, "ex_campione": False,
                    "percentile_altezza": None, "percentile_reach": None, "fonte": "ESPN",
                })
                noti.add(_norm(nome))
                aggiunti += 1
    extra_file.write_text(json.dumps(extra, ensure_ascii=False), encoding="utf-8")
    if salva_cache:
        CACHE.parent.mkdir(exist_ok=True)
        CACHE.write_text(json.dumps(cache, ensure_ascii=False), encoding="utf-8")
    print(f"Card: {aggiunti} lottatori fuori roster con scheda ESPN")


def foto_roster():
    """Ritratto ufficiale ESPN (sfondo bianco, stesso taglio per tutti) per ogni
    lottatore del roster: roster.json campo foto_espn, e giochi.json campo f.
    Solo per il sito, e solo come collegamento ai server ESPN (non si copiano).
    Sui social si usano ancora solo foto a licenza libera."""
    roster_file = DATI / "roster.json"
    roster = json.loads(roster_file.read_text(encoding="utf-8"))
    try:
        cache = json.loads(CACHE.read_text(encoding="utf-8"))
    except (OSError, ValueError):
        cache = {}
    trovate = 0
    for r in roster:
        chiave = "f" + _norm(r.get("nome"))
        if chiave not in cache:
            id_atleta = cerca_atleta(r["nome"])
            url = None
            if id_atleta:
                a = _get(f"{CORE}/athletes/{id_atleta}") or {}
                url = (a.get("headshot") or {}).get("href")
            cache[chiave] = url or ""
        if cache[chiave]:
            r["foto_espn"] = cache[chiave]
            trovate += 1
    roster_file.write_text(json.dumps(roster, ensure_ascii=False), encoding="utf-8")
    # giochi.json (Chi e'?, Piu' o meno, Gauntlet): stessa foto, per slug
    per_slug = {r.get("slug"): r.get("foto_espn") for r in roster if r.get("slug") and r.get("foto_espn")}
    giochi_file = DATI / "giochi.json"
    if giochi_file.exists():
        giochi = json.loads(giochi_file.read_text(encoding="utf-8"))
        for g in giochi:
            if per_slug.get(g.get("s")):
                g["f"] = per_slug[g["s"]]
        giochi_file.write_text(json.dumps(giochi, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    CACHE.parent.mkdir(exist_ok=True)
    CACHE.write_text(json.dumps(cache, ensure_ascii=False), encoding="utf-8")
    print(f"Foto ESPN: {trovate} lottatori su {len(roster)}")


if __name__ == "__main__":
    completa_roster(sys.argv[1] if len(sys.argv) > 1 else None)
    if len(sys.argv) == 1:
        completa_card()
        foto_roster()
