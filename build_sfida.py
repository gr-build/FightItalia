"""Domande della "Sfida del giorno": docs/data/sfida.json.

Ogni domanda nasce da dati che il sito ha gia' (roster, classifiche UFC, schede
degli eventi) e viene scartata se non e' certa e senza ambiguita':

- main: "Chi ha vinto il main event di UFC N?" solo per gli eventi numerati dal
  2016, quando la prima riga della scheda e' davvero il main event (i due nomi
  sono nel titolo dell'evento) e c'e' un vincitore. Le risposte sbagliate sono
  lo sconfitto e due lottatori della stessa categoria che non erano in quella
  scheda.
- bat: "Chi ha battuto X a UFC N?", dalle prime cinque righe (card principale)
  quando vincitore e sconfitto sono nel roster del gioco.
- camp: "Chi e' il campione dei pesi X?" solo se roster.json e classifiche.json
  (sito UFC) indicano lo stesso campione.
- paese / cat / nick: paese, categoria o soprannome di un lottatore del roster
  del gioco (classificati o campioni; il soprannome solo se e' unico).
- ko: "Chi ha piu' vittorie per KO tra questi quattro?" solo se il primo ha
  almeno 4 KO piu' del secondo.

Formato di ogni domanda: {"q": titolo, "k": riquadro grande, "s": riga piccola,
"r": risposta giusta, "d": [3 sbagliate], "n": [slug dei lottatori coinvolti]}.

Uso: python build_sfida.py   (dopo build_data.py e build_griglia.py; gira nel workflow dati)
"""

import json
import random
import re
import unicodedata
from datetime import datetime
from pathlib import Path

DOCS = Path(__file__).parent / "docs"
DATA = DOCS / "data"
DAL = datetime(2016, 1, 1)
MESI = ["gennaio", "febbraio", "marzo", "aprile", "maggio", "giugno", "luglio", "agosto",
        "settembre", "ottobre", "novembre", "dicembre"]
CATEGORIE_UOMINI = {"Flyweight": "Mosca", "Bantamweight": "Gallo", "Featherweight": "Piuma",
                    "Lightweight": "Leggeri", "Welterweight": "Welter", "Middleweight": "Medi",
                    "Light Heavyweight": "Mediomassimi", "Heavyweight": "Massimi"}
CATEGORIE_DONNE = {"Strawweight": "Paglia", "Flyweight": "Mosca", "Bantamweight": "Gallo"}
SENZA_ESITO = re.compile(r"draw|no contest|nc|overturned", re.I)


def slug_da_link(link):
    if not link:
        return None
    ultimo = link.rstrip("/").split("/")[-1].lower()
    return re.sub(r"^-+|-+$", "", re.sub(r"[^a-z0-9]+", "-", ultimo))


def pulito(n):
    """Toglie il (c) / (ic) dei campioni che Wikipedia mette dopo il nome."""
    return re.sub(r"\s*\((?:c|ic)\)\s*$", "", str(n or "")).strip()


def norma(t):
    t = unicodedata.normalize("NFKD", str(t or "")).encode("ascii", "ignore").decode().lower()
    return re.sub(r"[^a-z0-9 ]", " ", t).split()


def carica(nome):
    return json.loads((DATA / nome).read_text(encoding="utf-8"))


def peso(c):
    return "pesi " + c.lower()


def italiano(cat):
    donne = cat.startswith("Women's ")
    base = cat.replace("Women's ", "")
    c = (CATEGORIE_DONNE if donne else CATEGORIE_UOMINI).get(base)
    if not c:
        return "Categoria " + cat
    return f"{peso(c).capitalize()}{' donne' if donne else ''}"


def data_it(d):
    return f"{d.day} {MESI[d.month - 1]} {d.year}"


def main():
    rng = random.Random(20261019)
    giochi = carica("giochi.json")
    da_slug = {g["s"]: g for g in giochi}
    roster = {r["slug"]: r for r in carica("roster.json")}
    classifiche = carica("classifiche.json")["divisioni"]

    domande = {k: [] for k in ("main", "bat", "camp", "paese", "cat", "nick", "ko")}

    # ---- eventi numerati dal 2016
    eventi = []
    for e in carica("eventi.json"):
        if e.get("stato") != "passato":
            continue
        m = re.match(r"^UFC (\d+)\b", e.get("evento", ""))
        try:
            d = datetime.strptime(e["data"], "%b %d, %Y")
        except (ValueError, KeyError):
            continue
        s = slug_da_link(e.get("link"))
        f = DATA / "eventi" / f"{s}.json"
        if not m or d < DAL or not f.exists():
            continue
        try:
            card = json.loads(f.read_text(encoding="utf-8"))
        except ValueError:
            continue
        if card:
            eventi.append({"nome": f"UFC {m.group(1)}", "titolo": e["evento"], "data": d, "card": card})

    def chiave(n):
        return " ".join(norma(pulito(n)))

    def in_card(ev, nome):
        return chiave(nome) in {chiave(r[k]) for r in ev["card"] for k in ("fighter1", "fighter2")}

    def main_event_valido(ev):
        r = ev["card"][0]
        if not r.get("metodo") or SENZA_ESITO.search(r["metodo"]):
            return False
        dopo = ev["titolo"].split(":", 1)[1] if ":" in ev["titolo"] else ""
        meta = re.split(r"\s+vs\.?\s+", dopo)
        if len(meta) != 2:
            return False
        for parte, nome in zip(meta, (r["fighter1"], r["fighter2"])):
            token = norma(parte)
            if not token or not all(t in norma(nome) for t in token):
                return False
        return True

    # main event
    for ev in eventi:
        if not main_event_valido(ev):
            continue
        r = ev["card"][0]
        cat = (r.get("categoria") or "").strip()
        if not cat:
            continue
        simili = []
        for altro in eventi:
            if altro is ev or abs((altro["data"] - ev["data"]).days) > 1100 or not main_event_valido(altro):
                continue
            a = altro["card"][0]
            if (a.get("categoria") or "").strip() != cat:
                continue
            for nome in map(pulito, (a["fighter1"], a["fighter2"])):
                if not in_card(ev, nome) and nome not in simili:
                    simili.append(nome)
        if len(simili) < 2:
            continue
        sbagliate = [pulito(r["fighter2"])] + rng.sample(simili, 2)
        domande["main"].append({
            "q": f"Chi ha vinto il main event di {ev['nome']}?",
            "k": ev["nome"], "s": f"{data_it(ev['data'])} · {italiano(cat)}",
            "r": pulito(r["fighter1"]), "d": sbagliate,
            "n": [slug_da_link(r.get("fighter1_link")), slug_da_link(r.get("fighter2_link"))]})

    # chi ha battuto X (card principale, entrambi nel roster del gioco)
    for ev in eventi:
        if ev["data"] < datetime(2019, 1, 1):
            continue
        for r in ev["card"][:5]:
            v, p = slug_da_link(r.get("fighter1_link")), slug_da_link(r.get("fighter2_link"))
            if v not in da_slug or p not in da_slug or not r.get("metodo") or SENZA_ESITO.search(r["metodo"]):
                continue
            c = da_slug[v]["c"]
            simili = [g["n"] for g in giochi if g["c"] == c and g["g"] == da_slug[v]["g"]
                      and g["s"] not in (v, p) and not in_card(ev, g["n"])]
            if len(simili) < 3:
                continue
            domande["bat"].append({
                "q": f"Chi ha battuto {da_slug[p]['n']} a {ev['nome']}?",
                "k": da_slug[p]["n"], "s": f"{ev['nome']} · {data_it(ev['data'])}",
                "r": da_slug[v]["n"], "d": rng.sample(simili, 3), "n": [v, p]})

    # ---- campioni attuali (due fonti d'accordo)
    famosi = set()
    for d in classifiche:
        for x in d["classifica"][:10]:
            famosi.add(x["slug"])
        if d["campione"]:
            famosi.add(d["campione"]["slug"])
    for d in classifiche:
        if d["tipo"] not in ("uomini", "donne") or not d["campione"]:
            continue
        mappa = CATEGORIE_UOMINI if d["tipo"] == "uomini" else CATEGORIE_DONNE
        cat = mappa.get(d["categoria"])
        c = d["campione"]
        r = roster.get(c["slug"])
        if not cat or not r or not r.get("campione_attuale"):
            continue
        sfidanti = [x["nome"] for x in d["classifica"] if x["slug"] != c["slug"]][:6]
        if len(sfidanti) < 3:
            continue
        donne = d["tipo"] == "donne"
        titolo = f"Chi è il campione UFC dei {peso(cat)}{' donne' if donne else ''}?"
        domande["camp"].append({
            "q": titolo, "k": f"{peso(cat).capitalize()}{' donne' if donne else ''}", "s": "Campione UFC oggi",
            "r": c["nome"], "d": rng.sample(sfidanti, 3), "n": [c["slug"]]})

    # ---- paese / categoria / soprannome (lottatori del roster del gioco, classificati o campioni)
    paesi = {}
    for g in giochi:
        if g["p"] and "/" not in g["p"]:
            paesi.setdefault(g["p"], 0)
            paesi[g["p"]] += 1
    comuni = [p for p, n in paesi.items() if n >= 3]
    nick = {}
    for r in roster.values():
        if r.get("soprannome"):
            nick.setdefault(r["soprannome"].strip().lower(), []).append(r["slug"])
    for g in giochi:
        if g["s"] not in famosi:
            continue
        if g["p"] and "/" not in g["p"]:
            altri = [p for p in comuni if p != g["p"]]
            if len(altri) >= 3:
                domande["paese"].append({
                    "q": f"Di quale paese è {g['n']}?", "k": g["n"], "s": f"{peso(g['c']).capitalize()}{' donne' if g['g'] == 'F' else ''}",
                    "r": g["p"], "d": rng.sample(altri, 3), "n": [g["s"]]})
        if g["g"] == "M" and g["c"] != "Paglia":
            altre = [c for c in CATEGORIE_UOMINI.values() if c != g["c"]]
            domande["cat"].append({
                "q": f"In quale categoria combatte {g['n']}?", "k": g["n"], "s": "Categoria UFC oggi",
                "r": peso(g["c"]).capitalize(), "d": [peso(c).capitalize() for c in rng.sample(altre, 3)], "n": [g["s"]]})
        r = roster.get(g["s"])
        sopr = (r or {}).get("soprannome")
        if sopr and len(nick.get(sopr.strip().lower(), [])) == 1:
            simili = [x["n"] for x in giochi if x["c"] == g["c"] and x["g"] == g["g"] and x["s"] != g["s"]
                      and (roster.get(x["s"]) or {}).get("soprannome") != sopr]
            if len(simili) >= 3:
                domande["nick"].append({
                    "q": f"Chi è chiamato «{sopr}»?", "k": f"«{sopr}»", "s": f"{peso(g['c']).capitalize()}{' donne' if g['g'] == 'F' else ''}",
                    "r": g["n"], "d": rng.sample(simili, 3), "n": [g["s"]]})

    # ---- KO: quattro lottatori della stessa categoria, il primo con 4 KO in piu'
    for c in sorted({g["c"] for g in giochi}):
        for sesso in ("M", "F"):
            gruppo = [g for g in giochi if g["c"] == c and g["g"] == sesso and g["v"] >= 8 and g["ko"] is not None]
            if len(gruppo) < 4:
                continue
            for _ in range(40):
                q = rng.sample(gruppo, 4)
                q.sort(key=lambda g: -g["ko"])
                if q[0]["ko"] - q[1]["ko"] >= 4:
                    domande["ko"].append({
                        "q": "Chi ha più vittorie per KO/TKO in carriera?", "k": f"{peso(c).capitalize()}{' donne' if sesso == 'F' else ''}",
                        "s": "Tra questi quattro",
                        "r": q[0]["n"], "d": [g["n"] for g in q[1:]], "n": [g["s"] for g in q]})

    dedup = {}
    for k, lista in domande.items():
        visti, pulita = set(), []
        for d in lista:
            chiave = (d["q"], d["r"], d["s"])
            opzioni = [d["r"]] + d["d"]
            if chiave in visti or len(set(opzioni)) != 4 or any(not o for o in opzioni):
                continue
            visti.add(chiave)
            pulita.append(d)
        dedup[k] = pulita
    dedup["ver"] = datetime.now().strftime("%Y-%m-%d")
    (DATA / "sfida.json").write_text(json.dumps(dedup, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    print("Sfida del giorno:", {k: len(v) for k, v in dedup.items() if k != "ver"})


if __name__ == "__main__":
    main()
