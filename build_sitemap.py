"""
Genera docs/sitemap.xml a partire dai dati gia' presenti in docs/data/:
pagine statiche principali + una entry per ogni lottatore con scheda
(docs/data/lottatori/{slug}.json) + una entry per ogni evento con una
pagina dettaglio raggiungibile (evento.html?slug=...).

Va rilanciato ogni volta che roster.json o eventi.json cambiano (dopo
build_data.py / scraper_ufc.py) per tenere il sitemap allineato ai
contenuti realmente pubblicati — non e' agganciato a nessuna GitHub
Action, e' manuale come gli altri script di build (vedi README).
"""

import hashlib
import json
import re
from datetime import date
from pathlib import Path

ROOT = Path(__file__).parent
DOCS = ROOT / "docs"
BASE_URL = "https://mmaoggi.it"
OGGI = date.today().isoformat()
PRIMO_ANNO_SITEMAP = 2020   # eventi in sitemap: dal 2020 in poi (anche quelli futuri)
STATO = DOCS / "data" / "sitemap-lastmod.json"   # {indirizzo: {"hash": ..., "lastmod": ...}}: la data cambia solo se cambia la pagina
_stato = {}

# Deve restare identico a slugDaLink() in docs/js/common.js, altrimenti gli
# URL generati per gli eventi non corrispondono a quelli che il sito usa
# davvero per i link "Dettagli ->" in eventi.js.
def slug_da_link(link):
    if not link:
        return None
    ultimo = link.rstrip("/").split("/")[-1]
    slug = ultimo.lower()
    slug = re.sub(r"[^a-z0-9]+", "-", slug)
    return slug.strip("-")


PAGINE_STATICHE = [
    ("", "weekly", "1.0"),
    ("eventi.html", "daily", "0.8"),
    ("news.html", "daily", "0.7"),
    ("lottatori.html", "monthly", "0.7"),
    ("tutti-i-lottatori.html", "weekly", "0.8"),
    ("confronto.html", "monthly", "0.7"),
    ("campioni.html", "monthly", "0.6"),
    ("europa.html", "monthly", "0.6"),
    ("giochi.html", "weekly", "0.7"),
    ("griglia.html", "daily", "0.8"),
    ("seguici.html", "monthly", "0.4"),
    ("chi-e.html", "daily", "0.7"),
    ("cognomle.html", "daily", "0.7"),
    ("top10.html", "daily", "0.8"),
    ("higher-or-lower.html", "monthly", "0.6"),
    ("gauntlet.html", "monthly", "0.6"),
]


def _lastmod(path):
    """Data dell'ultima modifica vera della pagina: si aggiorna solo se il contenuto e' cambiato
    (senza il numero di versione di CSS e JS, che cambia a ogni build). Alla prima volta vale oggi."""
    file = DOCS / (path or "index.html")
    try:
        html = file.read_text(encoding="utf-8")
    except OSError:
        return OGGI
    impronta = hashlib.sha1(re.sub(r"\?v=\d+", "", html).encode("utf-8")).hexdigest()
    vecchio = _stato.get(path or "/")
    data = vecchio["lastmod"] if vecchio and vecchio.get("hash") == impronta else OGGI
    _stato[path or "/"] = {"hash": impronta, "lastmod": data}
    return data


def url_entry(path, changefreq, priority):
    loc = f"{BASE_URL}/{path}" if path else f"{BASE_URL}/"
    loc = loc.replace("&", "&amp;")
    return f"  <url>\n    <loc>{loc}</loc>\n    <lastmod>{_lastmod(path)}</lastmod>\n    <changefreq>{changefreq}</changefreq>\n    <priority>{priority}</priority>\n  </url>"


def main():
    global _stato
    try:
        _stato = json.loads(STATO.read_text(encoding="utf-8"))
    except (OSError, ValueError):
        _stato = {}
    roster = json.loads((DOCS / "data" / "roster.json").read_text(encoding="utf-8"))
    eventi = json.loads((DOCS / "data" / "eventi.json").read_text(encoding="utf-8"))

    entries = [url_entry(path, freq, pri) for path, freq, pri in PAGINE_STATICHE]

    # Solo le pagine statiche che esistono davvero (le genera build_static.py):
    # ogni lottatore/evento ha il suo indirizzo, non piu' lottatore.html?slug=...
    slug_lottatori = sorted(p.stem for p in (DOCS / "lottatore").glob("*.html"))
    entries += [url_entry(f"lottatore/{slug}.html", "monthly", "0.5") for slug in slug_lottatori]

    # Eventi vecchi o annullati: la pagina resta online ma fuori dalla sitemap, cosi' Google concentra le scansioni
    # su quelli recenti (Search Console: centinaia di pagine di eventi del 2005-2012 "rilevate ma mai scansionate").
    recenti = set()
    for e in eventi:
        s = slug_da_link(e.get("link"))
        m = re.search(r"(\d{4})", str(e.get("data", "")))
        if s and m and int(m.group(1)) >= PRIMO_ANNO_SITEMAP and "cancel" not in s:
            recenti.add(s)
    slug_eventi = sorted(p.stem for p in (DOCS / "evento").glob("*.html") if p.stem in recenti)
    entries += [url_entry(f"evento/{slug}.html", "monthly", "0.4") for slug in slug_eventi]

    slug_incontri = sorted(p.stem for p in (DOCS / "incontro").glob("*.html"))
    entries += [url_entry(f"incontro/{slug}.html", "yearly", "0.3") for slug in slug_incontri]

    xml = (
        '<?xml version="1.0" encoding="UTF-8"?>\n'
        '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n'
        + "\n".join(entries)
        + "\n</urlset>\n"
    )
    (DOCS / "sitemap.xml").write_text(xml, encoding="utf-8")
    STATO.write_text(json.dumps(_stato, ensure_ascii=False, separators=(",", ":"), sort_keys=True), encoding="utf-8")
    print(f"sitemap.xml generato: {len(entries)} URL ({len(slug_lottatori)} lottatori, {len(slug_eventi)} eventi, {len(PAGINE_STATICHE)} pagine statiche).")


if __name__ == "__main__":
    main()
