"""
Genera le pagine statiche di lottatori ed eventi, una per indirizzo:

  docs/lottatore/<slug>.html   (uno per ogni lottatore del roster)
  docs/evento/<slug>.html      (uno per ogni evento in eventi.json)

Perche': le schede vere (lottatore.html?slug=..., evento.html?slug=...) sono
una sola pagina che si riempie con JavaScript. Google le vedeva come un unico
indirizzo con il canonical senza il nome, quindi non le indicizzava una per
una. Queste pagine hanno il loro indirizzo, il titolo e la descrizione giusti,
il testo gia' scritto nell'HTML (per Google e per chi legge subito) e poi si
riempiono con la stessa scheda interattiva di sempre (lottatore.js / evento.js
leggono lo slug da <body data-slug>).

Va rilanciato dopo ogni aggiornamento dei dati (lo fa dati.yml). Le pagine non
contengono date "di oggi", cosi' se i dati non cambiano i file non cambiano.

Uso: python build_static.py
"""

import json
import re
from datetime import datetime
from html import escape
from pathlib import Path

ROOT = Path(__file__).parent
DOCS = ROOT / "docs"
BASE_URL = "https://mmaoggi.it"

MESI = ["gennaio", "febbraio", "marzo", "aprile", "maggio", "giugno", "luglio",
        "agosto", "settembre", "ottobre", "novembre", "dicembre"]

CATEGORIE = [  # (parola inglese, italiano) - dal piu' specifico
    ("light heavyweight", "pesi mediomassimi"),
    ("heavyweight", "pesi massimi"),
    ("middleweight", "pesi medi"),
    ("welterweight", "pesi welter"),
    ("lightweight", "pesi leggeri"),
    ("featherweight", "pesi piuma"),
    ("bantamweight", "pesi gallo"),
    ("flyweight", "pesi mosca"),
    ("strawweight", "pesi paglia"),
]


def slug_da_link(link):
    """Deve restare identico a slugDaLink() in docs/js/common.js."""
    if not link:
        return None
    slug = link.rstrip("/").split("/")[-1].lower()
    return re.sub(r"[^a-z0-9]+", "-", slug).strip("-")


def esc(s):
    return escape(str(s if s is not None else ""), quote=True)


def categoria_it(categoria):
    c = (categoria or "").lower()
    for en, it in CATEGORIE:
        if en in c:
            return f"{it} femminili" if c.startswith("women") else it
    return ""


def data_it(testo):
    for fmt in ("%b %d, %Y", "%B %d, %Y", "%d %B %Y", "%d %b %Y"):
        try:
            d = datetime.strptime(str(testo).strip(), fmt)
            return f"{d.day} {MESI[d.month - 1]} {d.year}"
        except ValueError:
            continue
    return str(testo or "").strip()


def pulisci_luogo(s):
    return re.sub(r"\s+,", ",", s or "").strip()


def testa(base_html, *, titolo, descrizione, canonical, jsonld, slug, immagine=None):
    h = base_html
    h = h.replace('<meta charset="utf-8">', '<meta charset="utf-8">\n<base href="/">', 1)
    h = re.sub(r"<title>.*?</title>", f"<title>{esc(titolo)}</title>", h, count=1, flags=re.S)
    h = re.sub(r'(<meta name="description" content=")[^"]*(")', lambda m: m.group(1) + esc(descrizione) + m.group(2), h, count=1)
    h = re.sub(r'(<meta property="og:title" content=")[^"]*(")', lambda m: m.group(1) + esc(titolo) + m.group(2), h, count=1)
    h = re.sub(r'(<meta property="og:description" content=")[^"]*(")', lambda m: m.group(1) + esc(descrizione) + m.group(2), h, count=1)
    h = re.sub(r'(<meta property="og:url" content=")[^"]*(")', lambda m: m.group(1) + canonical + m.group(2), h, count=1)
    h = re.sub(r'(<meta name="twitter:title" content=")[^"]*(")', lambda m: m.group(1) + esc(titolo) + m.group(2), h, count=1)
    h = re.sub(r'(<meta name="twitter:description" content=")[^"]*(")', lambda m: m.group(1) + esc(descrizione) + m.group(2), h, count=1)
    h = re.sub(r'(<link rel="canonical" href=")[^"]*(")', lambda m: m.group(1) + canonical + m.group(2), h, count=1)
    ld = json.dumps(jsonld, ensure_ascii=False)
    h = h.replace("</head>", f'<script type="application/ld+json">{ld}</script>\n</head>', 1)
    h = h.replace("<body>", f'<body data-slug="{esc(slug)}">', 1)
    return h


# ------------------------------------------------------------------ lottatori

def contenuto_lottatore(r, dett):
    nome = r["nome"]
    inf = dett.get("infobox", {}) if dett else {}
    cat = categoria_it(r.get("categoria"))
    nick = r.get("soprannome") or inf.get("Other names") or ""
    frasi = [f"{esc(nome)}" + (f", detto &laquo;{esc(nick)}&raquo;," if nick else "") + " è un lottatore di MMA"
             + (f" della categoria {esc(cat)}" if cat else "") + "."]
    record = r.get("record_mma")
    if inf.get("Wins") and inf.get("Losses"):
        # l'infobox e' piu' aggiornato del roster (es. dopo l'ultimo incontro)
        record = f"{inf['Wins']}–{inf['Losses']}" + (f"–{inf['Draws']}" if inf.get("Draws") else "")
    if record:
        frasi.append(f"Il suo record nelle arti marziali miste è {esc(record)} (vittorie–sconfitte–pareggi).")
    dettagli = []
    if r.get("eta"):
        dettagli.append(f"{esc(r['eta'])} anni")
    if r.get("altezza_cm"):
        dettagli.append(f"altezza {int(r['altezza_cm'])} cm")
    if r.get("reach_cm"):
        dettagli.append(f"allungo {int(r['reach_cm'])} cm")
    if dettagli:
        frasi.append("Scheda: " + ", ".join(dettagli) + ".")
    if r.get("campione_attuale"):
        frasi.append("È il campione UFC in carica della sua categoria.")
    elif r.get("ex_campione"):
        frasi.append("È un ex campione UFC.")

    righe = ""
    storico = (dett or {}).get("storico") or []
    for f in storico[:10]:
        righe += ("<tr><td>{}</td><td>{}</td><td>{}</td><td>{}</td><td>{}</td></tr>".format(
            esc(f.get("res.", "")), esc(f.get("opponent", "")), esc(f.get("method", "")),
            esc(f.get("event", "")), esc(f.get("date", ""))))
    tabella = ""
    if righe:
        tabella = ('<h2>Ultimi incontri</h2><table><thead><tr><th>Esito</th><th>Avversario</th><th>Metodo</th>'
                   f'<th>Evento</th><th>Data</th></tr></thead><tbody>{righe}</tbody></table>')
    slug = r["slug"]
    return (f'<section class="hero" style="padding:44px 0 24px;"><h1>{esc(nome)}</h1></section>'
            f'<p>{" ".join(frasi)}</p>{tabella}'
            f'<p><a href="confronto.html?a={esc(slug)}">Confronta {esc(nome)} con un altro lottatore</a> · '
            '<a href="tutti-i-lottatori.html">Tutti i lottatori</a> · <a href="ranking.html">Ranking UFC</a></p>'
            '<noscript><p>Per la scheda interattiva completa serve JavaScript.</p></noscript>')


def record_desc(r, dett):
    inf = (dett or {}).get("infobox", {})
    if inf.get("Wins") and inf.get("Losses"):
        return f"{inf['Wins']}–{inf['Losses']}" + (f"–{inf['Draws']}" if inf.get("Draws") else "")
    return r.get("record_mma") or ""


def genera_lottatori(base):
    roster = json.loads((DOCS / "data" / "roster.json").read_text(encoding="utf-8"))
    out = DOCS / "lottatore"
    out.mkdir(exist_ok=True)
    vivi, slugs = set(), []
    for r in roster:
        slug = r.get("slug")
        if not slug or not re.fullmatch(r"[a-z0-9-]+", slug):
            continue
        dett_file = DOCS / "data" / "lottatori" / f"{slug}.json"
        dett = json.loads(dett_file.read_text(encoding="utf-8")) if dett_file.exists() else None
        cat = categoria_it(r.get("categoria"))
        descr = (f"{r['nome']}" + (f", {cat}" if cat else "")
                 + (f", record {record_desc(r, dett)}" if record_desc(r, dett) else "")
                 + ". Statistiche, storico degli incontri e confronto con altri lottatori UFC su MMA Oggi.")
        canonical = f"{BASE_URL}/lottatore/{slug}.html"
        ld = {"@context": "https://schema.org", "@type": "Person", "name": r["nome"], "url": canonical,
              "knowsAbout": "Mixed Martial Arts",
              **({"image": r.get("foto_espn") or r.get("foto")} if (r.get("foto_espn") or r.get("foto")) else {}),
              **({"jobTitle": f"Lottatore MMA, {cat}"} if cat else {}),
              **({"alternateName": r["soprannome"]} if r.get("soprannome") else {})}
        html = testa(base, titolo=f"{r['nome']}: record, statistiche e incontri | MMA Oggi", descrizione=descr,
                     canonical=canonical, jsonld=ld, slug=slug)
        html = html.replace('<div id="profilo"><div class="empty-state">Carico...</div></div>',
                            f'<div id="profilo">{contenuto_lottatore(r, dett)}</div>', 1)
        (out / f"{slug}.html").write_text(html, encoding="utf-8")
        vivi.add(f"{slug}.html")
        slugs.append(slug)
    for f in out.glob("*.html"):
        if f.name not in vivi:
            f.unlink()
    return slugs


# --------------------------------------------------------------------- eventi

def contenuto_evento(ev, card, roster_slugs):
    nome = ev["evento"]
    luogo = ", ".join(x for x in (ev.get("sede"), pulisci_luogo(ev.get("luogo"))) if x)
    quando = data_it(ev.get("data"))
    frasi = [f"{esc(nome)} è un evento di MMA" + (f" in programma il {esc(quando)}" if ev.get("stato") == "programmato" else f" del {esc(quando)}") + "."]
    if luogo:
        frasi.append(f"Si tiene a {esc(luogo)}.")
    if ev.get("stato") == "programmato":
        frasi.append("Qui trovi la card completa e, quando saranno disponibili, gli orari in Italia.")
    else:
        frasi.append("Qui trovi la card completa con i risultati degli incontri.")

    tabella = ""
    if card:
        righe = ""
        sezione = None
        for c in card:
            if c.get("sezione") != sezione:
                sezione = c.get("sezione")
                righe += f'<tr><th colspan="3">{esc(sezione)}</th></tr>'
            def lott(nome_f, link):
                s = slug_da_link(link)
                return f'<a href="lottatore/{s}.html">{esc(nome_f)}</a>' if s in roster_slugs else esc(nome_f)
            esito = " ".join(x for x in (c.get("metodo"), f"R{c['round']}" if c.get("round") else "", c.get("tempo")) if x)
            righe += (f"<tr><td>{esc(c.get('categoria', ''))}</td>"
                      f"<td>{lott(c.get('fighter1'), c.get('fighter1_link'))} vs {lott(c.get('fighter2'), c.get('fighter2_link'))}</td>"
                      f"<td>{esc(esito)}</td></tr>")
        tabella = ('<h2>Card e risultati</h2><table><thead><tr><th>Categoria</th><th>Incontro</th><th>Esito</th></tr></thead>'
                   f'<tbody>{righe}</tbody></table>')
    return (f'<section class="hero" style="padding:44px 0 24px;"><h1>{esc(nome)}</h1></section>'
            f'<p>{" ".join(frasi)}</p>{tabella}'
            '<p><a href="eventi.html">Tutti gli eventi</a> · <a href="giochi.html">Giochi</a></p>'
            '<noscript><p>Per la scheda interattiva completa serve JavaScript.</p></noscript>')


def genera_eventi(base, roster_slugs):
    eventi = json.loads((DOCS / "data" / "eventi.json").read_text(encoding="utf-8"))
    out = DOCS / "evento"
    out.mkdir(exist_ok=True)
    vivi, slugs = set(), []
    for ev in eventi:
        slug = slug_da_link(ev.get("link"))
        if not slug or not re.fullmatch(r"[a-z0-9-]+", slug) or f"{slug}.html" in vivi:
            continue
        card_file = DOCS / "data" / "eventi" / f"{slug}.json"
        card = json.loads(card_file.read_text(encoding="utf-8")) if card_file.exists() else []
        quando = data_it(ev.get("data"))
        luogo = pulisci_luogo(ev.get("luogo"))
        descr = (f"{ev['evento']}: " + (f"{quando}" if quando else "") + (f", {luogo}" if luogo else "")
                 + ". Card completa, incontri e risultati su MMA Oggi.")
        canonical = f"{BASE_URL}/evento/{slug}.html"
        ld = {"@context": "https://schema.org", "@type": "SportsEvent", "name": ev["evento"], "url": canonical,
              "sport": "Mixed Martial Arts",
              **({"location": {"@type": "Place", "name": ", ".join(x for x in (ev.get("sede"), luogo) if x)}} if (ev.get("sede") or luogo) else {})}
        try:
            ld["startDate"] = datetime.strptime(str(ev.get("data")).strip(), "%b %d, %Y").date().isoformat()
        except ValueError:
            pass
        html = testa(base, titolo=f"{ev['evento']}: card, orari e risultati | MMA Oggi", descrizione=descr,
                     canonical=canonical, jsonld=ld, slug=slug)
        html = html.replace('<div id="scheda-evento"><div class="empty-state">Carico...</div></div>',
                            f'<div id="scheda-evento">{contenuto_evento(ev, card, roster_slugs)}</div>', 1)
        (out / f"{slug}.html").write_text(html, encoding="utf-8")
        vivi.add(f"{slug}.html")
        slugs.append(slug)
    for f in out.glob("*.html"):
        if f.name not in vivi:
            f.unlink()
    return slugs


def main():
    base_l = (DOCS / "lottatore.html").read_text(encoding="utf-8")
    base_e = (DOCS / "evento.html").read_text(encoding="utf-8")
    lott = genera_lottatori(base_l)
    ev = genera_eventi(base_e, set(lott))
    print(f"Pagine statiche: {len(lott)} lottatori, {len(ev)} eventi.")


if __name__ == "__main__":
    main()
