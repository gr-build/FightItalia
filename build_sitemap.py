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

import json
import re
from datetime import date
from pathlib import Path

ROOT = Path(__file__).parent
DOCS = ROOT / "docs"
BASE_URL = "https://gr-build.github.io/FightItalia"
OGGI = date.today().isoformat()

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
    ("confronto.html", "monthly", "0.7"),
    ("campioni.html", "monthly", "0.6"),
    ("europa.html", "monthly", "0.6"),
]


def url_entry(path, changefreq, priority):
    loc = f"{BASE_URL}/{path}" if path else f"{BASE_URL}/"
    loc = loc.replace("&", "&amp;")
    return f"  <url>\n    <loc>{loc}</loc>\n    <lastmod>{OGGI}</lastmod>\n    <changefreq>{changefreq}</changefreq>\n    <priority>{priority}</priority>\n  </url>"


def main():
    roster = json.loads((DOCS / "data" / "roster.json").read_text(encoding="utf-8"))
    eventi = json.loads((DOCS / "data" / "eventi.json").read_text(encoding="utf-8"))

    entries = [url_entry(path, freq, pri) for path, freq, pri in PAGINE_STATICHE]

    slug_lottatori = sorted({r["slug"] for r in roster if r.get("slug")})
    entries += [url_entry(f"lottatore.html?slug={slug}", "monthly", "0.5") for slug in slug_lottatori]

    slug_eventi = sorted({s for e in eventi if (s := slug_da_link(e.get("link")))})
    entries += [url_entry(f"evento.html?slug={slug}", "monthly", "0.4") for slug in slug_eventi]

    xml = (
        '<?xml version="1.0" encoding="UTF-8"?>\n'
        '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n'
        + "\n".join(entries)
        + "\n</urlset>\n"
    )
    (DOCS / "sitemap.xml").write_text(xml, encoding="utf-8")
    print(f"sitemap.xml generato: {len(entries)} URL ({len(slug_lottatori)} lottatori, {len(slug_eventi)} eventi, {len(PAGINE_STATICHE)} pagine statiche).")


if __name__ == "__main__":
    main()
