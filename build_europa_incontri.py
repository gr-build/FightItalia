"""Card degli eventi europei (KSW, Oktagon, Cage Warriors) da Wikipedia.

Per ogni evento delle pagine "2025/2026 in <organizzazione>" legge la sezione
"Fight card" / "Results" (template MMAevent bout) e scrive
docs/data/europa/<org>-incontri.json: eventi con sezioni (main card, prelims)
e incontri (nomi, categoria, campione, e per i passati vincitore/metodo).
Le pagine docs/evento-europa.html e docs/lottatore-europa.html leggono questi file.

Uso: python3 build_europa_incontri.py
"""

import json
import re
import unicodedata
from datetime import datetime
from pathlib import Path

import requests

WEB_DATA_EUROPA = Path(__file__).parent / "docs" / "data" / "europa"
HEADERS = {"User-Agent": "MMAOggi/1.0 (https://mmaoggi.it)"}
PAGINE = {
    "ksw": ["2025_in_Konfrontacja_Sztuk_Walki", "2026_in_Konfrontacja_Sztuk_Walki"],
    "oktagon": ["2025_in_Oktagon_MMA", "2026_in_Oktagon_MMA"],
    "cagewarriors": ["2025_in_Cage_Warriors", "2026_in_Cage_Warriors"],
}


def slug(testo):
    """Stesso algoritmo di slug() in docs/js/europa-incontri.js."""
    t = unicodedata.normalize("NFD", testo or "")
    t = "".join(c for c in t if not unicodedata.combining(c)).lower()
    return re.sub(r"[^a-z0-9]+", "-", t).strip("-")


def _pagina(titolo):
    r = requests.get("https://en.wikipedia.org/w/index.php", params={"title": titolo, "action": "raw"}, headers=HEADERS, timeout=60)
    r.raise_for_status()
    return r.text


def _spezza(testo):
    """Divide sui '|' del primo livello, ignorando quelli dentro [[ ]] e {{ }}."""
    parti, corrente, livello_l, livello_g = [], [], 0, 0
    i = 0
    while i < len(testo):
        due = testo[i:i + 2]
        if due == "[[":
            livello_l += 1; corrente.append(due); i += 2; continue
        if due == "]]":
            livello_l -= 1; corrente.append(due); i += 2; continue
        if due == "{{":
            livello_g += 1; corrente.append(due); i += 2; continue
        if due == "}}":
            livello_g -= 1; corrente.append(due); i += 2; continue
        if testo[i] == "|" and livello_l == 0 and livello_g == 0:
            parti.append("".join(corrente)); corrente = []
        else:
            corrente.append(testo[i])
        i += 1
    parti.append("".join(corrente))
    return [p.strip() for p in parti]


def _pulisci(t):
    t = re.sub(r"<ref[^>]*>.*?</ref>|<ref[^>]*/>", "", t, flags=re.S)
    t = re.sub(r"\[\[(?:[^\]|]*\|)?([^\]]*)\]\]", r"\1", t)
    t = re.sub(r"\{\{[^}]*\}\}", "", t)
    t = re.sub(r"'''?", "", t)
    return re.sub(r"\s+", " ", t).strip()


def _lottatore(grezzo):
    campione = bool(re.search(r"\((?:c|ic)\)", grezzo, re.I))
    nome = re.sub(r"\s*\((?:c|ic)\)\s*", " ", _pulisci(grezzo), flags=re.I).strip()
    return nome, campione


def _blocchi(testo, apertura):
    """Contenuto di ogni {{apertura ... }} (parentesi graffe bilanciate)."""
    for m in re.finditer(re.escape(apertura), testo):
        i, livello = m.end(), 1
        while i < len(testo) and livello:
            if testo[i:i + 2] == "{{":
                livello += 1; i += 2
            elif testo[i:i + 2] == "}}":
                livello -= 1; i += 2
            else:
                i += 1
        yield m.start(), testo[m.end():i - 2]


def _data_iso(s):
    s = _pulisci(s or "")
    for f in ("%B %d, %Y", "%b %d, %Y"):
        try:
            return datetime.strptime(s, f).date().isoformat()
        except ValueError:
            pass
    return None


def _eventi_pagina(testo):
    eventi = []
    sezioni = list(re.finditer(r"^==\s*([^=\n][^\n]*?)\s*==\s*$", testo, re.M))
    for k, m in enumerate(sezioni):
        fine = sezioni[k + 1].start() if k + 1 < len(sezioni) else len(testo)
        corpo = testo[m.end():fine]
        if "{{MMAevent bout" not in corpo:
            continue
        titolo = _pulisci(m.group(1))
        info = next((c for _, c in _blocchi(corpo, "{{Infobox MMA event")), "")
        campi = {}
        for p in _spezza(info):
            if "=" in p:
                a, b = p.split("=", 1)
                campi[a.strip().lower()] = b.strip()
        # le card: "{{MMAevent card|Nome}}" separa le sezioni, i bout seguono
        marche = [(pos, _spezza(c)[1:]) for pos, c in _blocchi(corpo, "{{MMAevent card")]
        incontri = [(pos, _spezza(c)[1:]) for pos, c in _blocchi(corpo, "{{MMAevent bout")]
        sezioni_card = []
        for pos, par in incontri:
            nome_sez = "Card"
            for pm, pp in marche:
                if pm < pos and pp:
                    nome_sez = _pulisci(pp[0]) or "Card"
            if not sezioni_card or sezioni_card[-1]["nome"] != nome_sez:
                sezioni_card.append({"nome": nome_sez, "incontri": []})
            par += [""] * (8 - len(par))
            n1, c1 = _lottatore(par[1])
            n2, c2 = _lottatore(par[3])
            if not n1 and not n2:
                continue
            esito = _pulisci(par[2]).lower()
            sezioni_card[-1]["incontri"].append({
                "categoria": _pulisci(par[0]),
                "f1": n1, "f2": n2, "f1_slug": slug(n1), "f2_slug": slug(n2),
                "campione1": c1, "campione2": c2,
                "vincitore": 1 if esito.startswith("def") else None,
                "metodo": _pulisci(par[4]) or None,
                "round": _pulisci(par[5]) or None,
                "tempo": _pulisci(par[6]) or None,
                "note": _pulisci(par[7]) or None,
            })
        if not any(s["incontri"] for s in sezioni_card):
            continue
        eventi.append({
            "slug": slug(titolo), "evento": titolo,
            "data": _data_iso(campi.get("date")),
            "sede": _pulisci(campi.get("venue", "")) or None,
            "luogo": _pulisci(campi.get("city", "")) or None,
            "sezioni": sezioni_card,
        })
    return eventi


def main():
    WEB_DATA_EUROPA.mkdir(parents=True, exist_ok=True)
    for org, pagine in PAGINE.items():
        eventi = []
        for p in pagine:
            try:
                eventi += _eventi_pagina(_pagina(p))
            except Exception as errore:  # una pagina che non risponde non deve fermare le altre
                print(f"  [europa-incontri] {p}: {errore}")
        if not eventi:
            print(f"{org}: nessuna card trovata, file lasciato com'e'")
            continue
        # data e luogo mancanti nell'infobox: si prendono dall'elenco eventi gia' sul sito
        try:
            elenco = {slug(e["evento"]): e for e in json.loads((WEB_DATA_EUROPA / f"{org}-eventi.json").read_text(encoding="utf-8"))}
        except Exception:
            elenco = {}
        for ev in eventi:
            da = elenco.get(ev["slug"], {})
            ev["data"] = ev["data"] or _data_iso(da.get("data"))
            ev["sede"] = ev["sede"] or da.get("sede")
            ev["luogo"] = ev["luogo"] or da.get("luogo")
        (WEB_DATA_EUROPA / f"{org}-incontri.json").write_text(json.dumps(eventi, ensure_ascii=False), encoding="utf-8")
        n = sum(len(s["incontri"]) for e in eventi for s in e["sezioni"])
        print(f"{org}: {len(eventi)} eventi con card, {n} incontri")


if __name__ == "__main__":
    main()
