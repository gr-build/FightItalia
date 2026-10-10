"""Aggiorna il numero di versione (?v=...) di tutti i file JavaScript e CSS del sito.

GitHub Pages tiene i file in cache 10 minuti: senza ?v=<data> il browser puo' mescolare file nuovi e vecchi.
Uso: python3 bump_versione.py   (prima di pubblicare modifiche a docs/js o docs/css)
"""
import re
from datetime import datetime, timezone
from pathlib import Path

DOCS = Path(__file__).parent / "docs"
VERSIONE = datetime.now(timezone.utc).strftime("%Y%m%d%H%M")
html_re = re.compile(r'((?:src="js/[\w-]+\.js)|(?:href="css/[\w-]+\.css))(\?v=\w+)?(")')
import_re = re.compile(r'(from "\./[\w-]+\.js)(\?v=\w+)?(")')

for path in list(DOCS.glob("*.html")) + list((DOCS / "js").glob("*.js")):
    testo = path.read_text(encoding="utf-8")
    nuovo = import_re.sub(rf"\g<1>?v={VERSIONE}\g<3>", html_re.sub(rf"\g<1>?v={VERSIONE}\g<3>", testo))
    if nuovo != testo:
        path.write_text(nuovo, encoding="utf-8")
print(f"Versione JS e CSS: {VERSIONE}")
