"""Risultati degli incontri appena finiti, in pochi minuti invece che il giorno dopo.

Legge dalla pagina Wikipedia dell'evento (tabella "Results", che i volontari
aggiornano in diretta) il metodo, il round e il tempo di ogni incontro finito
e li scrive in docs/data/eventi/<slug>.json, nello stesso formato del
build_data.py quotidiano (vincitore a sinistra, metodo tipo "KO (head kick)").
Poi il workflow live.yml rigenera le pagine statiche (build_static.py, 2 secondi)
e quindi le schede incontro dei match finiti compaiono subito.

Solo requests: gira ogni 15 minuti nel weekend, come live.py.
Uso: python risultati_live.py   (stampa "CAMBIATO" se ha modificato dei file)
"""

import difflib
import json
import re
import unicodedata
from datetime import datetime, timedelta, timezone
from pathlib import Path

import requests

DOCS = Path(__file__).parent / "docs"
HEADERS = {"User-Agent": "MMAOggi/1.0 (https://mmaoggi.it)"}


def slug_da_link(link):
    return re.sub(r"[^a-z0-9]+", "-", link.rstrip("/").split("/")[-1].lower()).strip("-")


def _norm(t):
    t = unicodedata.normalize("NFD", t or "")
    return re.sub(r"[^a-z]", "", "".join(c for c in t if not unicodedata.combining(c)).lower())


def simile(a, b):
    return difflib.SequenceMatcher(None, _norm(a), _norm(b)).ratio() >= 0.8


def _data(s):
    for f in ("%b %d, %Y", "%B %d, %Y"):
        try:
            return datetime.strptime(s, f).date()
        except (ValueError, TypeError):
            pass
    return None


# ---- piccolo lettore del wikitext (template MMAevent bout) ----
def _spezza(testo):
    parti, corrente, liv_l, liv_g, i = [], [], 0, 0, 0
    while i < len(testo):
        due = testo[i:i + 2]
        if due in ("[[", "]]", "{{", "}}"):
            if due == "[[": liv_l += 1
            elif due == "]]": liv_l -= 1
            elif due == "{{": liv_g += 1
            else: liv_g -= 1
            corrente.append(due); i += 2; continue
        if testo[i] == "|" and liv_l == 0 and liv_g == 0:
            parti.append("".join(corrente)); corrente = []
        else:
            corrente.append(testo[i])
        i += 1
    parti.append("".join(corrente))
    return [p.strip() for p in parti]


def _blocchi(testo, apertura):
    for m in re.finditer(re.escape(apertura), testo):
        i, livello = m.end(), 1
        while i < len(testo) and livello:
            if testo[i:i + 2] == "{{": livello += 1; i += 2
            elif testo[i:i + 2] == "}}": livello -= 1; i += 2
            else: i += 1
        yield m.start(), testo[m.end():i - 2]


def _pulisci(t):
    t = re.sub(r"<ref[^>]*>.*?</ref>|<ref[^>]*/>", "", t or "", flags=re.S)
    t = re.sub(r"<br\s*/?>", " ", t)
    t = re.sub(r"\[\[(?:[^\]|]*\|)?([^\]]*)\]\]", r"\1", t)
    t = re.sub(r"\{\{[^}]*\}\}", "", t)
    t = re.sub(r"'''?", "", t)
    return re.sub(r"\s+", " ", t).strip()


def _wikitext(link):
    titolo = link.split("/wiki/")[-1]
    for _ in range(3):  # segue i redirect (es. UFC_Fight_Night_290 -> UFC_Fight_Night:_Allen_vs._Duncan)
        r = requests.get("https://en.wikipedia.org/w/index.php", params={"title": titolo, "action": "raw"}, headers=HEADERS, timeout=30)
        r.raise_for_status()
        m = re.match(r"\s*#REDIRECT\s*\[\[([^\]#|]+)", r.text, re.I)
        if not m:
            return r.text
        titolo = m.group(1).strip().replace(" ", "_")
    return r.text


def risultati_wikipedia(link):
    t = _wikitext(link)
    if "==Results==" in t:
        t = t[t.index("==Results=="):]
    out = []
    for _, par in _blocchi(t, "{{MMAevent bout"):
        p = _spezza(par)[1:] + [""] * 8
        esito = _pulisci(p[2]).lower()
        out.append({"a": _pulisci(re.sub(r"\((?:c|ic)\)", "", p[1])), "b": _pulisci(re.sub(r"\((?:c|ic)\)", "", p[3])),
                    "vince_a": esito.startswith("def"), "metodo": _pulisci(p[4]), "round": _pulisci(p[5]), "tempo": _pulisci(p[6]), "note": _pulisci(p[7])})
    return out


def unisci(card, wiki):
    """Mette nei bout di 'card' il risultato di Wikipedia. Ritorna quanti ne ha cambiati."""
    cambiati = 0
    for b in card:
        w = next((x for x in wiki if x["metodo"] and
                  ((simile(b["fighter1"], x["a"]) and simile(b["fighter2"], x["b"])) or (simile(b["fighter1"], x["b"]) and simile(b["fighter2"], x["a"])))), None)
        if w is None:
            continue
        # vincitore a sinistra (convenzione del sito); pareggi e no contest restano come sono
        if w["vince_a"] and not simile(b["fighter1"], w["a"]):
            b["fighter1"], b["fighter2"] = b["fighter2"], b["fighter1"]
            b["fighter1_link"], b["fighter2_link"] = b.get("fighter2_link"), b.get("fighter1_link")
            cambiati += 1
        nuovo = {"metodo": w["metodo"], "round": w["round"], "tempo": w["tempo"]}
        if w["note"]:
            nuovo["note"] = w["note"]
        if any(b.get(k) != v for k, v in nuovo.items()):
            b.update(nuovo)
            cambiati += 1
    return cambiati


def main():
    oggi = datetime.now(timezone.utc).date()
    eventi = json.loads((DOCS / "data" / "eventi.json").read_text(encoding="utf-8"))
    cambiato = False
    for ev in eventi:
        d = _data(ev.get("data"))
        if not d or not (oggi - timedelta(days=2) <= d <= oggi + timedelta(days=1)) or not ev.get("link"):
            continue
        percorso = DOCS / "data" / "eventi" / f"{slug_da_link(ev['link'])}.json"
        if not percorso.exists():
            continue
        try:
            wiki = risultati_wikipedia(ev["link"])
        except Exception as errore:
            print(f"  [risultati-live] {ev['evento']}: Wikipedia non risponde ({errore})")
            continue
        card = json.loads(percorso.read_text(encoding="utf-8"))
        n = unisci(card, wiki)
        finiti = sum(1 for x in wiki if x["metodo"])
        print(f"{ev['evento']}: {finiti}/{len(wiki)} incontri finiti su Wikipedia, {n} modifiche")
        if n:
            percorso.write_text(json.dumps(card, ensure_ascii=False), encoding="utf-8")
            cambiato = True
    if cambiato:
        print("CAMBIATO")


if __name__ == "__main__":
    main()
