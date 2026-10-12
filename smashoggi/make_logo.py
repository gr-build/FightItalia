"""Genera il logo di Smash Oggi: SVG pulito (testo trasformato in tracciati) + PNG (favicon, apple-touch-icon, og-image).

Stile della famiglia (GP Oggi, MMA Oggi): parola dello sport in un riquadro scuro + OGGI su riquadro colorato,
sotto un disegno dello sport (qui: campo da tennis in prospettiva, racchetta e pallina).
Serve:  pip install fonttools playwright   e il file Oswald-Bold.ttf (Google Fonts, licenza OFL).
Uso:    python3 make_logo.py /percorso/Oswald-Bold.ttf
Tutto e' disegnato qui: nessuna immagine di terzi.
"""
import sys
from pathlib import Path

from fontTools.pens.svgPathPen import SVGPathPen
from fontTools.pens.transformPen import TransformPen
from fontTools.ttLib import TTFont

LIME = "#c6f432"
SCURO = "#14171c"
IMG = Path(__file__).parent / "docs" / "img"
font = TTFont(sys.argv[1])
gs, cmap, upm = font.getGlyphSet(), font.getBestCmap(), font["head"].unitsPerEm
CAP = font["OS/2"].sCapHeight / upm


def testo_path(testo, size, spaziatura=0.0):
    scala, x, d = size / upm, 0.0, []
    for ch in testo:
        g = gs[cmap[ord(ch)]]
        pen = SVGPathPen(gs)
        g.draw(TransformPen(pen, (scala, 0, 0, -scala, x, 0)))
        d.append(pen.getCommands())
        x += g.width * scala + spaziatura
    return " ".join(d), x - spaziatura


def scritta(cx_box_x, y0, h, size=60):
    """Riquadro scuro SMASH + riquadro lime OGGI, centrati a partire da cx_box_x (centro)."""
    d1, w1 = testo_path("SMASH", size, 2)
    d2, w2 = testo_path("OGGI", size, 2)
    pad = 20
    W = w1 + w2 + 4 * pad
    x = cx_box_x - W / 2
    base = y0 + (h + size * CAP) / 2
    return (f'<rect x="{x:.1f}" y="{y0}" width="{w1 + 2 * pad:.1f}" height="{h}" fill="{SCURO}" stroke="#ffffff" stroke-opacity=".28" stroke-width="2"/>'
            f'<rect x="{x + w1 + 2 * pad:.1f}" y="{y0}" width="{w2 + 2 * pad:.1f}" height="{h}" fill="{LIME}"/>'
            f'<path d="{d1}" fill="#ffffff" transform="translate({x + pad:.1f} {base:.1f})"/>'
            f'<path d="{d2}" fill="{SCURO}" transform="translate({x + w1 + 3 * pad:.1f} {base:.1f})"/>'), W


def campo():
    """Campo visto in prospettiva: trapezio con righe, rete e linee di servizio (colore neutro: va bene su fondo chiaro e scuro)."""
    BL, BR, TL, TR = (40, 272), (480, 272), (130, 122), (390, 122)

    def p(t, u):  # t = 0 linea di fondo vicina, 1 lontana; u = 0 sinistra, 1 destra
        y = BL[1] + (TL[1] - BL[1]) * t
        sx = BL[0] + (TL[0] - BL[0]) * t
        ex = BR[0] + (TR[0] - BR[0]) * t
        return sx + (ex - sx) * u, y

    def linea(a, b, extra=""):
        return f'<line x1="{a[0]:.1f}" y1="{a[1]:.1f}" x2="{b[0]:.1f}" y2="{b[1]:.1f}" {extra}/>'
    s1, s2 = 0.125, 0.875
    righe = [linea(p(0, s1), p(1, s1)), linea(p(0, s2), p(1, s2)),
             linea(p(0.231, s1), p(0.231, s2)), linea(p(0.769, s1), p(0.769, s2)), linea(p(0.231, .5), p(0.769, .5))]
    rete = linea(p(0.5, -0.04), p(0.5, 1.04), 'stroke-width="5" stroke-dasharray="9 6"')
    poly = f'M{BL[0]} {BL[1]} L{BR[0]} {BR[1]} L{TR[0]} {TR[1]} L{TL[0]} {TL[1]} Z'
    return (f'<g stroke="#8d9680" stroke-opacity=".7" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round" fill="none">'
            f'<path d="{poly}" fill="#8d9680" fill-opacity=".10"/>{"".join(righe)}{rete}</g>')


def racchetta(x, y, s, ang):
    cx, cy, rx, ry = 50, 78, 36, 48
    fili = "".join(f'<line x1="{cx - rx + 2 * rx * i / 7:.1f}" y1="{cy - ry}" x2="{cx - rx + 2 * rx * i / 7:.1f}" y2="{cy + ry}"/>' for i in range(1, 7))
    fili += "".join(f'<line x1="{cx - rx}" y1="{cy - ry + 2 * ry * j / 9:.1f}" x2="{cx + rx}" y2="{cy - ry + 2 * ry * j / 9:.1f}"/>' for j in range(1, 9))
    forma = (f'<ellipse cx="{cx}" cy="{cy}" rx="{rx + 3}" ry="{ry + 3}"/>'
             f'<path d="M{cx - 17} {cy + ry - 4} L{cx - 4} 168 M{cx + 17} {cy + ry - 4} L{cx + 4} 168"/>')
    return f'''<g transform="translate({x} {y}) rotate({ang}) scale({s}) translate(-50 -150)">
  <clipPath id="rc"><ellipse cx="{cx}" cy="{cy}" rx="{rx}" ry="{ry}"/></clipPath>
  <g fill="none" stroke-linecap="round" stroke-linejoin="round">
    <g stroke="#ffffff" stroke-width="19">{forma}</g><rect x="{cx - 8}" y="164" width="16" height="108" rx="8" fill="#ffffff" stroke="#ffffff" stroke-width="5"/>
    <g clip-path="url(#rc)" stroke="{LIME}" stroke-width="3.6">{fili}</g>
    <g stroke="{SCURO}" stroke-width="12">{forma}</g>
  </g>
  <rect x="{cx - 8}" y="164" width="16" height="108" rx="8" fill="{SCURO}"/>
  <rect x="{cx - 8}" y="196" width="16" height="9" fill="{LIME}"/><rect x="{cx - 8}" y="214" width="16" height="9" fill="{LIME}"/><rect x="{cx - 8}" y="232" width="16" height="9" fill="{LIME}"/>
</g>'''


def pallina(x, y, r):
    return f'''<g>
  <ellipse cx="{x}" cy="{y + r + 9}" rx="{r * 1.05}" ry="{r * 0.22}" fill="#000" fill-opacity=".18"/>
  <clipPath id="pal"><circle cx="{x}" cy="{y}" r="{r}"/></clipPath>
  <circle cx="{x}" cy="{y}" r="{r}" fill="{LIME}" stroke="{SCURO}" stroke-width="3"/>
  <g clip-path="url(#pal)" fill="none" stroke="#ffffff" stroke-width="3.4" stroke-linecap="round">
    <path d="M{x - r * 0.98} {y - r * 0.55} Q{x - r * 0.15} {y} {x - r * 0.98} {y + r * 0.55}"/><path d="M{x + r * 0.98} {y - r * 0.55} Q{x + r * 0.15} {y} {x + r * 0.98} {y + r * 0.55}"/>
  </g>
</g>'''


def svg(w, h, corpo, titolo):
    return (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {w} {h}" width="{w}" height="{h}" role="img" '
            f'aria-label="{titolo}"><title>{titolo}</title>\n{corpo}\n</svg>\n')


IMG.mkdir(parents=True, exist_ok=True)
scr, Wscr = scritta(260, 14, 76)
completo = scr + campo() + racchetta(178, 214, 0.64, -22) + pallina(388, 222, 28)
(IMG / "logo.svg").write_text(svg(520, 300, completo, "Smash Oggi"), encoding="utf-8")
scr2, W2 = scritta(Wscr / 2 + 6, 6, 76)
(IMG / "logo-orizzontale.svg").write_text(svg(int(Wscr + 12), 88, scr2, "Smash Oggi"), encoding="utf-8")


def icona(rx):
    d, w = testo_path("OGGI", 80, 2)
    return svg(256, 256, f'<rect width="256" height="256" rx="{rx}" fill="{SCURO}"/>'
               f'<rect x="38" y="30" width="180" height="82" rx="6" fill="{LIME}"/>'
               f'<path d="{d}" fill="{SCURO}" transform="translate({128 - w / 2:.1f} {30 + (82 + 80 * CAP) / 2:.1f})"/>'
               + pallina(128, 176, 46).replace('stroke-width="3"', 'stroke-width="5"').replace('stroke-width="3.4"', 'stroke-width="6"'),
               "Smash Oggi")


(IMG / "icona.svg").write_text(icona(44), encoding="utf-8")
(IMG / "icona-piena.svg").write_text(icona(0), encoding="utf-8")

# PNG con Chromium (gia' installato)
from playwright.sync_api import sync_playwright

comp = (IMG / "logo.svg").read_text(encoding="utf-8")


def fluido(testo):
    return testo.replace("<svg ", '<svg style="width:100%;height:auto;display:block" ', 1)


with sync_playwright() as p:
    b = p.chromium.launch(executable_path="/opt/pw-browsers/chromium")

    def png(nome, w, h, html, trasparente=True):
        pg = b.new_page(viewport={"width": w, "height": h})
        pg.set_content(f'<body style="margin:0;background:transparent">{html}</body>')
        pg.screenshot(path=str(IMG / nome), omit_background=trasparente)
        pg.close()

    for nome, lato, file in (("favicon-64.png", 64, "icona.svg"), ("apple-touch-icon.png", 180, "icona-piena.svg"), ("icon-512.png", 512, "icona.svg")):
        png(nome, lato, lato, f'<div style="width:{lato}px;height:{lato}px">{fluido((IMG / file).read_text(encoding="utf-8"))}</div>')
    pg = b.new_page(viewport={"width": 1200, "height": 630})
    pg.set_content(f'''<body style="margin:0;width:1200px;height:630px;background:linear-gradient(160deg,#f2f5ea,#dfe6cf);
      display:flex;flex-direction:column;align-items:center;justify-content:center;gap:26px;font-family:Inter,Arial,sans-serif">
      <div style="width:820px">{fluido(comp)}</div>
      <div style="color:#2d3322;font-size:34px;letter-spacing:.01em">Risultati, calendario e classifiche del tennis, in italiano</div></body>''')
    pg.screenshot(path=str(IMG / "og-image.png"))
    b.close()
print("Logo creato in", IMG)
