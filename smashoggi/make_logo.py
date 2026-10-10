"""Genera il logo di Smash Oggi: SVG pulito (testo trasformato in tracciati) + PNG (favicon, apple-touch-icon, og-image).

Serve:  pip install fonttools playwright   e il file Oswald-Bold.ttf (Google Fonts, licenza OFL).
Uso:    python3 make_logo.py /percorso/Oswald-Bold.ttf
Tutto e' disegnato qui: nessuna immagine di terzi.
"""
import sys
from pathlib import Path

from fontTools.pens.svgPathPen import SVGPathPen
from fontTools.pens.transformPen import TransformPen
from fontTools.ttLib import TTFont

ACCENT = "#c6f432"
SCURO = "#0a0a0d"
IMG = Path(__file__).parent / "docs" / "img"
font = TTFont(sys.argv[1])
gs, cmap, upm = font.getGlyphSet(), font.getBestCmap(), font["head"].unitsPerEm


def testo_path(testo, size, spaziatura=0.0):
    """Restituisce (d, larghezza) del testo come tracciato SVG, con origine in (0,0) sulla linea di base."""
    scala, x, d = size / upm, 0.0, []
    for ch in testo:
        g = gs[cmap[ord(ch)]]
        pen = SVGPathPen(gs)
        g.draw(TransformPen(pen, (scala, 0, 0, -scala, x, 0)))
        d.append(pen.getCommands())
        x += g.width * scala + spaziatura
    return " ".join(d), x - spaziatura


def emblema(x=0, y=0, s=1.0):
    d, w = testo_path("SMASH", 22, 2)
    return f'''<g transform="translate({x} {y}) scale({s})">
  <circle cx="60" cy="60" r="57" fill="{SCURO}" stroke="{ACCENT}" stroke-width="5"/>
  <clipPath id="pallina"><circle cx="60" cy="47" r="30"/></clipPath>
  <circle cx="60" cy="47" r="30" fill="{ACCENT}"/>
  <g clip-path="url(#pallina)" fill="none" stroke="{SCURO}" stroke-width="3.6" stroke-linecap="round">
    <circle cx="19" cy="47" r="29"/><circle cx="101" cy="47" r="29"/>
  </g>
  <path d="{d}" fill="#ffffff" transform="translate({60 - w / 2:.2f} 99)"/>
</g>'''


def svg(w, h, corpo, titolo):
    return (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {w} {h}" width="{w}" height="{h}" role="img" '
            f'aria-label="{titolo}"><title>{titolo}</title>\n{corpo}\n</svg>\n')


IMG.mkdir(parents=True, exist_ok=True)
(IMG / "logo.svg").write_text(svg(120, 120, emblema(), "Smash Oggi"), encoding="utf-8")

# versione orizzontale: emblema + marchio "SMASH•Oggi" (testo bianco, per fondi scuri)
dt, wt = testo_path("SMASH", 54, 2)
dd, wd = testo_path("•", 54)
do, wo = testo_path("Oggi", 54, 1)
x0 = 140
corpo = emblema() + f'''
<path d="{dt}" fill="#ffffff" transform="translate({x0} 78)"/>
<path d="{dd}" fill="{ACCENT}" transform="translate({x0 + wt + 4:.1f} 78)"/>
<path d="{do}" fill="{ACCENT}" transform="translate({x0 + wt + wd + 12:.1f} 78)"/>'''
larg = int(x0 + wt + wd + 12 + wo + 10)
(IMG / "logo-orizzontale.svg").write_text(svg(larg, 120, corpo, "Smash Oggi"), encoding="utf-8")

# PNG con Chromium (gia' installato): favicon, apple-touch-icon, icona 512, og-image
from playwright.sync_api import sync_playwright

emb = (IMG / "logo.svg").read_text(encoding="utf-8")
orizz = (IMG / "logo-orizzontale.svg").read_text(encoding="utf-8")


def fluido(svg_testo):
    """Fa riempire all'SVG la larghezza del contenitore."""
    return svg_testo.replace("<svg ", '<svg style="width:100%;height:auto;display:block" ', 1)


with sync_playwright() as p:
    b = p.chromium.launch(executable_path="/opt/pw-browsers/chromium")

    def png(nome, w, h, html, trasparente=True):
        pg = b.new_page(viewport={"width": w, "height": h})
        pg.set_content(f'<body style="margin:0;background:transparent">{html}</body>')
        pg.screenshot(path=str(IMG / nome), omit_background=trasparente)
        pg.close()

    for nome, lato in (("favicon-64.png", 64), ("apple-touch-icon.png", 180), ("icon-512.png", 512)):
        apple = "apple" in nome
        larghezza = lato * 0.86 if apple else lato
        fondo = SCURO if apple else "transparent"
        png(nome, lato, lato, f'<div style="width:{lato}px;height:{lato}px;background:{fondo};display:grid;place-items:center">'
            f'<div style="width:{larghezza}px">{fluido(emb)}</div></div>')
    pg = b.new_page(viewport={"width": 1200, "height": 630})
    pg.set_content(f'''<body style="margin:0;width:1200px;height:630px;background:radial-gradient(circle at 20% 20%,#1c2208,{SCURO} 60%);
      display:flex;flex-direction:column;align-items:center;justify-content:center;gap:34px;font-family:Inter,Arial,sans-serif">
      <div style="width:900px">{fluido(orizz)}</div>
      <div style="color:#c9c9d4;font-size:34px;letter-spacing:.02em">Risultati, calendario e classifiche del tennis, in italiano</div></body>''')
    pg.screenshot(path=str(IMG / "og-image.png"))
    b.close()
print("Logo creato in", IMG)
