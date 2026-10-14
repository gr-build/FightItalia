"""Copertine per Instagram/TikTok in stile "ultim'ora" (1080x1920 e 1080x1350).
Uso:  python3 make_copertine.py [cartella_uscita]
Serve: pip install playwright pillow ; il file Oswald-Bold.ttf (OFL) in OSWALD (variabile d'ambiente o percorso sotto).
Le foto dei tennisti arrivano da ESPN (solo per prove: non sono licenziate per l'uso commerciale).
Solo fatti: mai quote né pronostici."""
import base64, os, sys, urllib.request, html
from pathlib import Path
from playwright.sync_api import sync_playwright

QUI = Path(__file__).parent
OSWALD = os.environ.get("OSWALD", "/tmp/claude-0/oswald700.ttf")
CACHE = QUI / "copertine" / "cache"
LIME, SCURO, ROSSO = "#c5f535", "#14171c", "#e11d2e"


def b64(path, mime):
    return f"data:{mime};base64," + base64.b64encode(Path(path).read_bytes()).decode()


def foto(pid):
    CACHE.mkdir(parents=True, exist_ok=True)
    f = CACHE / f"{pid}.png"
    if not f.exists():
        u = f"https://a.espncdn.com/combiner/i?img=/i/headshots/tennis/players/full/{pid}.png&w=1000&h=1000"
        f.write_bytes(urllib.request.urlopen(urllib.request.Request(u, headers={"User-Agent": "Mozilla/5.0"}), timeout=30).read())
    return b64(f, "image/png")


CSS = """
@font-face{font-family:Osw;src:url(%s) format('truetype');font-weight:700}
*{box-sizing:border-box;margin:0}
body{width:1080px;height:%dpx;overflow:hidden;background:#14171c;font-family:Osw,Impact,sans-serif;position:relative;color:#fff}
.sfondo{position:absolute;inset:0;background:radial-gradient(circle at 50%% 38%%,%s 0,#1b2430 55%%,#0c0f13 100%%)}
.linee{position:absolute;inset:0;opacity:.13}
.foto{position:absolute;left:50%%;bottom:%dpx;width:%dpx;transform:translateX(-50%%);-webkit-mask-image:linear-gradient(#000 62%%,transparent 97%%);mask-image:linear-gradient(#000 62%%,transparent 97%%)}
.ombra{position:absolute;left:0;right:0;bottom:0;height:48%%;background:linear-gradient(transparent,rgba(8,10,13,.88) 60%%,#080a0d)}
.alto{position:absolute;left:48px;top:56px;display:flex;align-items:center;gap:22px}
.alto img{height:72px}
.tag{background:%s;color:#fff;font-size:38px;letter-spacing:2px;padding:6px 18px;text-transform:uppercase}
.titolo{position:absolute;left:48px;right:48px;bottom:%dpx;display:flex;flex-direction:column;align-items:flex-start;gap:10px}
.r{font-size:%dpx;line-height:1.05;text-transform:uppercase;padding:2px 22px 0;display:inline-block}
.l{background:%s;color:%s}.w{background:#fff;color:%s}.s{background:%s;color:#fff}
.piccolo{font-size:46px;color:#fff;text-transform:uppercase;letter-spacing:1px;margin-top:10px;text-shadow:0 2px 12px #000}
.foot{position:absolute;left:48px;right:48px;bottom:44px;display:flex;justify-content:space-between;font-size:34px;letter-spacing:3px;opacity:.9}
.foot b{color:%s;font-weight:700}
"""

LINEE = """<svg class="linee" viewBox="0 0 1080 1920" preserveAspectRatio="xMidYMid slice"><g fill="none" stroke="#fff" stroke-width="6">
<rect x="150" y="200" width="780" height="1500"/><line x1="285" y1="200" x2="285" y2="1700"/><line x1="795" y1="200" x2="795" y2="1700"/>
<line x1="285" y1="640" x2="795" y2="640"/><line x1="285" y1="1260" x2="795" y2="1260"/><line x1="540" y1="640" x2="540" y2="1260"/><line x1="150" y1="950" x2="930" y2="950" stroke-width="10"/></g></svg>"""


def pagina(corpo, alt, tinta="#2a4a6b", base=0, fonte=150, bottom=170, fw=1000):
    logo = b64(QUI / "docs/img/logo-orizzontale.svg", "image/svg+xml")
    css = CSS % (b64(OSWALD, "font/ttf"), alt, tinta, base, fw, ROSSO, bottom, fonte, LIME, SCURO, SCURO, ROSSO, LIME)
    return f"<html><head><meta charset=utf-8><style>{css}</style></head><body><div class=sfondo></div>{LINEE}{corpo.replace('%LOGO%', logo)}</body></html>"


def e(t): return html.escape(t)


def ultimora(pid, righe, sotto, alt=1920, tinta="#2a4a6b"):
    """Copertina 'ultim'ora' con la foto e il titolo in riquadri: righe = [(testo, 'l'|'w'|'s'), ...]"""
    t = "".join(f'<div class="r {c}">{e(x)}</div>' for x, c in righe)
    corpo = f'''<img class=foto src="{foto(pid)}"><div class=ombra></div>
<div class=alto><img src="%LOGO%"><div class=tag>Ultim'ora</div></div>
<div class=titolo>{t}<div class=piccolo>{e(sotto)}</div></div>
<div class=foot><span>SMASH OGGI</span><b>TUTTO IL TENNIS DI OGGI</b></div>'''
    return pagina(corpo, alt, tinta, base=540 if alt == 1920 else 330, fonte=150 if alt == 1920 else 130, bottom=170 if alt == 1920 else 150, fw=1000 if alt == 1920 else 820)


def incampo(titolo, partite, alt=1920):
    """Elenco 'in campo oggi': partite = [(orario, 'A vs B', torneo)]"""
    righe = "".join(f'''<div style="display:flex;gap:26px;align-items:center;background:rgba(8,10,13,.78);border-left:12px solid {LIME};padding:22px 28px;margin-bottom:20px">
<div style="font-size:76px;color:{LIME};min-width:190px">{e(o)}</div><div><div style="font-size:54px;line-height:1.05;text-transform:uppercase">{e(m)}</div><div style="font-size:30px;opacity:.75;letter-spacing:1px;text-transform:uppercase">{e(tn)}</div></div></div>''' for o, m, tn in partite)
    corpo = f'''<div class=alto><img src="%LOGO%"><div class=tag>Oggi</div></div>
<div style="position:absolute;left:48px;right:48px;top:210px">
<div class="r l" style="font-size:132px">🇮🇹 {e(titolo[0])}</div><br><div class="r w" style="font-size:132px;margin-top:10px">{e(titolo[1])}</div></div>
<div style="position:absolute;left:48px;right:48px;top:{560 if alt==1920 else 520}px">{righe}</div>
<div class=foot><span>SMASH OGGI</span><b>LINK IN BIO</b></div>'''
    return pagina(corpo, alt, "#1d3a28")


def numero(pid, grande, riga1, riga2, alt=1920):
    corpo = f'''<img class=foto src="{foto(pid)}"><div class=ombra></div>
<div class=alto><img src="%LOGO%"><div class=tag>Il numero</div></div>
<div class=titolo><div class=r style="font-size:330px;color:{LIME};background:none;padding:0;line-height:.95;text-shadow:0 6px 30px #000">{e(grande)}</div>
<div class="r w" style="font-size:110px">{e(riga1)}</div><div class="r l" style="font-size:80px">{e(riga2)}</div></div>
<div class=foot><span>SMASH OGGI</span><b>TUTTO IL TENNIS DI OGGI</b></div>'''
    return pagina(corpo, alt, "#5b3a1f", base=640 if alt == 1920 else 400, bottom=170 if alt == 1920 else 150, fw=1000 if alt == 1920 else 820)


def disegna(lavori, uscita):
    uscita.mkdir(parents=True, exist_ok=True)
    with sync_playwright() as p:
        b = p.chromium.launch(executable_path="/opt/pw-browsers/chromium", args=["--no-sandbox"])
        for nome, (h, alt) in lavori.items():
            pg = b.new_page(viewport={"width": 1080, "height": alt})
            pg.set_content(h); pg.wait_for_timeout(600)
            pg.screenshot(path=str(uscita / f"{nome}.png")); pg.close()
        b.close()


if __name__ == "__main__":
    out = Path(sys.argv[1]) if len(sys.argv) > 1 else QUI / "copertine"
    disegna({
        "1-ultimora-vince-swiatek": (ultimora("3730", [("Vince", "l"), ("Swiatek!", "l"), ("6-2 6-1", "w")], "Secondo turno · Wuhan Open"), 1920),
        "2-italiani-in-campo-oggi": (incampo(("Italiani in", "campo oggi"), [("15:30", "Teichmann vs Bronzetti", "Rovereto · Secondo turno"), ("17:30", "Tan vs Stefanini", "Rovereto · Secondo turno"), ("19:30", "Pigato vs Havlickova", "Rovereto · Secondo turno")]), 1920),
        "3-il-numero-sinner": (numero("3623", "30", "titoli in carriera", "Jannik Sinner · n.1"), 1920),
        "4-ultimora-feed-4x5": (ultimora("3730", [("Vince Swiatek!", "l"), ("6-2 6-1", "w")], "Secondo turno · Wuhan Open", alt=1350), 1350),
    }, out)
    print("fatto:", out)
