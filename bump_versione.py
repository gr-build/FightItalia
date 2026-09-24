"""Aggiorna il numero di versione (?v=...) di tutti i file JavaScript e CSS del sito.

GitHub Pages tiene i file in cache 10 minuti: dopo un aggiornamento il
browser poteva mescolare file nuovi e vecchi (un import che non esiste
ancora nella versione vecchia blocca tutta la pagina). Con ?v=<data> in ogni
<script> e in ogni import, a ogni rilascio il browser riscarica tutto.

Uso: python bump_versione.py   (prima di pubblicare modifiche a docs/js)
"""

import re
from datetime import datetime, timezone
from pathlib import Path

DOCS = Path(__file__).parent / "docs"
VERSIONE = datetime.now(timezone.utc).strftime("%Y%m%d%H%M")

html_re = re.compile(r'((?:src="js/[\w-]+\.js)|(?:href="css/[\w-]+\.css))(\?v=\d+)?(")')
import_re = re.compile(r'(from "\./[\w-]+\.js)(\?v=\d+)?(")')

for path in list(DOCS.glob("*.html")) + list((DOCS / "js").glob("*.js")):
    testo = path.read_text(encoding="utf-8")
    nuovo = html_re.sub(rf"\g<1>?v={VERSIONE}\g<3>", testo)
    nuovo = import_re.sub(rf"\g<1>?v={VERSIONE}\g<3>", nuovo)
    if nuovo != testo:
        path.write_text(nuovo, encoding="utf-8")

print(f"Versione JS e CSS: {VERSIONE}")
