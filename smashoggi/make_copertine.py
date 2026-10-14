"""Copertine per Instagram/TikTok: sistema a griglia (margine 60 px, tutto multiplo di 12).
Formati: storie 1080x1920 e feed 1080x1350.
Uso:  python3 make_copertine.py [cartella_uscita]
Serve: pip install playwright ; il file Oswald-Bold.ttf (OFL) in OSWALD (variabile d'ambiente o percorso sotto).
Foto dei tennisti da ESPN (cutout con fondo trasparente): ok per prove, non licenziate per uso commerciale.
Solo fatti: mai quote né pronostici."""
import base64, os, sys, urllib.request, html
from pathlib import Path
from playwright.sync_api import sync_playwright

QUI = Path(__file__).parent
OSWALD = os.environ.get("OSWALD", "/tmp/claude-0/oswald700.ttf")
CACHE = QUI / "copertine" / "cache"
LIME, SCURO, ROSSO, BIANCO = "#c5f535", "#14171c", "#e11d2e", "#ffffff"
SUPERFICI = {"cemento": "#2c5d8f", "terra": "#b5532a", "erba": "#2f7a3e", "indoor": "#2a2f3a"}
M = 60            # margine
U = 12            # unità della griglia
W = 1080


def b64(path, mime):
    return f"data:{mime};base64," + base64.b64encode(Path(path).read_bytes()).decode()


UA = {"User-Agent": "SmashOggiBot/1.0 (prototipo; contatto: sito Smash Oggi)"}
_NOMI = {}


def _scarica(url, tentativi=5, pausa=25):
    """Scarica con pause: Wikimedia risponde 429 se si chiede troppo in fretta."""
    import time, urllib.error
    for t in range(tentativi):
        try:
            return urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=40).read()
        except urllib.error.HTTPError as err:
            if err.code not in (429, 503) or t == tentativi - 1:
                raise
            time.sleep(pausa * (t + 1))


def _nome(pid):
    if not _NOMI:
        import json
        g = json.load(open(QUI / "docs/data/giocatori.json"))
        for x in (g if isinstance(g, list) else g.values()):
            _NOMI[str(x["id"])] = x["nome"]
    return _NOMI.get(str(pid))


def foto_wiki(pid):
    """Foto da Wikimedia Commons (licenza libera): (data URI, credito) oppure None se non c'è o non è usabile."""
    import json, re, urllib.parse
    CACHE.mkdir(parents=True, exist_ok=True)
    meta = CACHE / f"wiki-{pid}.json"
    img = CACHE / f"wiki-{pid}.jpg"
    if meta.exists() and img.exists():
        return b64(img, "image/jpeg"), json.loads(meta.read_text())["credito"]
    nome = _nome(pid)
    memo = json.load(open(QUI / "docs/data/foto-wiki.json"))
    url = memo.get(nome) if nome else None
    m = url and re.search(r"/thumb/./../([^/]+)/\d+px-", url)
    if not m:
        return None
    titolo = urllib.parse.unquote(m.group(1))
    api = ("https://commons.wikimedia.org/w/api.php?action=query&prop=imageinfo&iiprop=url|extmetadata&iiurlwidth=1400&format=json&titles="
           + urllib.parse.quote("File:" + titolo))
    pagine = json.loads(_scarica(api))["query"]["pages"]
    info = next(iter(pagine.values())).get("imageinfo", [{}])[0]
    ext = info.get("extmetadata", {})
    pulito = lambda k: re.sub(r"\s+", " ", re.sub(r"<[^>]+>", "", (ext.get(k) or {}).get("value", ""))).strip()
    licenza = pulito("LicenseShortName")
    if not info.get("thumburl") or not licenza or "fair" in licenza.lower() or "non" in licenza.lower():
        return None
    autore = pulito("Artist") or "autore su Commons"
    autore = re.sub(r"^Original:\s*", "", autore).split(", Derivative")[0].split(" Derivative")[0]
    credito = f"Foto: {autore[:48]} / Wikimedia Commons · {licenza}"
    img.write_bytes(_scarica(info["thumburl"]))
    meta.write_text(json.dumps({"credito": credito, "file": titolo}))
    return b64(img, "image/jpeg"), credito


def foto(pid):
    """Foto ESPN con fondo trasparente (ripiego: non licenziata per uso commerciale)."""
    CACHE.mkdir(parents=True, exist_ok=True)
    f = CACHE / f"{pid}.png"
    if not f.exists():
        f.write_bytes(_scarica(f"https://a.espncdn.com/i/headshots/tennis/players/full/{pid}.png"))   # originale: w/h fissi del combiner stirano la faccia
    return b64(f, "image/png")


def ritratto(pid, pw, ph, scala):
    """HTML della foto dentro il pannello pw x ph. Prima licenza libera (riempie il riquadro), poi ESPN (cutout). Ritorna (html, credito)."""
    try:
        w = foto_wiki(pid)
    except Exception as err:   # rete, 429, file strano: si ripiega su ESPN
        print("  wiki non disponibile per", pid, "->", str(err)[:60])
        w = None
    if w:
        return f'<img src="{w[0]}" style="position:absolute;inset:0;width:100%;height:100%;object-fit:cover;object-position:50% 18%">', w[1]
    return f'<img class=f src="{foto(pid)}" style="width:{int(pw*scala)}px">', "Foto: ESPN (solo prova)"


def e(t): return html.escape(t)


def telaio(alt, colore, contenuto, tag, credito="smashoggi"):
    """Struttura comune: riga alta (logo + tag), area centrale, riga bassa con filetto."""
    logo = b64(QUI / "docs/img/logo-orizzontale.svg", "image/svg+xml")
    css = f"""@font-face{{font-family:Osw;src:url({b64(OSWALD, 'font/ttf')}) format('truetype');font-weight:700}}
*{{box-sizing:border-box;margin:0;padding:0}}
body{{width:{W}px;height:{alt}px;overflow:hidden;background:{SCURO};font-family:Osw,Impact,sans-serif;color:{BIANCO};position:relative}}
.alto{{position:absolute;left:{M}px;right:{M}px;top:{M}px;height:72px;display:flex;justify-content:space-between;align-items:center}}
.alto img{{height:72px;display:block}}
.tag{{height:60px;display:flex;align-items:center;padding:0 24px;background:{ROSSO};font-size:36px;letter-spacing:3px;text-transform:uppercase}}
.pannello{{position:absolute;left:{M}px;right:{M}px;top:{M+72+36}px;background:{colore};overflow:hidden;border-bottom:12px solid {LIME}}}
.pannello img.f{{position:absolute;left:50%;transform:translateX(-50%);bottom:0}}
.linee{{position:absolute;inset:0;width:100%;height:100%}}
.blocchi{{position:absolute;left:{M}px;right:{M}px;display:flex;flex-direction:column;align-items:flex-start;gap:{U}px}}
.b{{height:{U*12}px;display:flex;align-items:center;padding:0 {U*2}px;font-size:{U*10}px;text-transform:uppercase;white-space:nowrap}}
.l{{background:{LIME};color:{SCURO}}}.w{{background:{BIANCO};color:{SCURO}}}.s{{background:{SCURO};color:{BIANCO};border:6px solid {BIANCO}}}
.sotto{{height:{U*4}px;display:flex;align-items:center;font-size:{U*3+6}px;letter-spacing:2px;text-transform:uppercase}}
.piede{{position:absolute;left:{M}px;right:{M}px;bottom:{M}px;height:{U*5}px;border-top:3px solid rgba(255,255,255,.3);display:flex;justify-content:space-between;align-items:flex-end;font-size:{U*2+10}px;letter-spacing:3px}}
.piede span:last-child{{font:500 24px Arial,sans-serif;letter-spacing:0;opacity:.75;max-width:640px;text-align:right;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}}
"""
    piede = f'<div class=piede><span>SMASH OGGI</span><span>{e(credito) if credito else "smashoggi"}</span></div>'
    return (f'<html><head><meta charset=utf-8><style>{css}</style></head><body>'
            f'<div class=alto><img src="{logo}"><div class=tag>{e(tag)}</div></div>{contenuto}{piede}</body></html>')


def linee(w, h):
    """Campo da singolare stilizzato, linee sulla griglia: filigrana geometrica del pannello."""
    return (f'<svg class=linee viewBox="0 0 {w} {h}" preserveAspectRatio="none"><g fill="none" stroke="#fff" stroke-opacity=".22" stroke-width="4">'
            f'<rect x="{U*6}" y="{U*4}" width="{w-U*12}" height="{h-U*4}"/><line x1="{w/2}" y1="{U*4}" x2="{w/2}" y2="{h}"/>'
            f'<line x1="{U*6}" y1="{U*4+int((h-U*4)*0.45)}" x2="{w-U*6}" y2="{U*4+int((h-U*4)*0.45)}"/></g></svg>')


def dims(alt):
    pw = W - 2 * M
    ph = 960 if alt == 1920 else 576
    top = M + 72 + 36
    return pw, ph, top + ph + 12 + 48       # larghezza pannello, altezza pannello, y dei blocchi di testo


def pagina_foto(pid, righe, sotto, tag, sup="cemento", alt=1920, giga=None):
    pw, ph, y = dims(alt)
    scala = 1.3 if alt == 1920 else 1.15
    img, cred = ritratto(pid, pw, ph, scala)
    blocchi = "".join(f'<div class="b {c}">{e(x)}</div>' for x, c in righe)
    extra = f'<div class="sotto">{e(sotto)}</div>' if sotto else ""
    cont = (f'<div class=pannello style="height:{ph}px">{linee(pw, ph)}{img}</div>'
            f'<div class=blocchi style="top:{y}px">{blocchi}{extra}</div>')
    return telaio(alt, SUPERFICI[sup], cont, tag, cred)


def numero(pid, grande, riga1, riga2, sup="cemento", alt=1920):
    pw, ph, y = dims(alt)
    img, cred = ritratto(pid, pw, ph, 1.3 if alt == 1920 else 1.15)
    cont = (f'<div class=pannello style="height:{ph}px">{linee(pw, ph)}{img}</div>'
            f'<div class=blocchi style="top:{y}px"><div class="b" style="height:{U*24}px;padding:0;font-size:{U*22}px;color:{LIME};background:none">{e(grande)}</div>'
            f'<div class="b w" style="font-size:{U*8}px">{e(riga1)}</div><div class="sotto">{e(riga2)}</div></div>')
    return telaio(alt, SUPERFICI[sup], cont, "Il numero", cred)


def incampo(titolo, partite, sup="terra", alt=1920):
    pw, ph, y = dims(alt)
    riga = U * 16 if alt == 1920 else U * 11
    righe = "".join(
        f'<div style="display:flex;height:{riga}px;border-top:3px solid rgba(255,255,255,.4)"><div style="width:{U*21}px;font-size:{U*7}px;color:{LIME};display:flex;align-items:center;padding-left:{U*2}px">{e(o)}</div>'
        f'<div style="display:flex;flex-direction:column;justify-content:center"><div style="font-size:{U*4+6}px;text-transform:uppercase;line-height:1.1">{e(m)}</div>'
        f'<div style="font-size:{U*2+6}px;opacity:.8;letter-spacing:2px;text-transform:uppercase">{e(tn)}</div></div></div>' for o, m, tn in partite)
    lista = f'<div style="position:absolute;left:0;right:0;top:50%;transform:translateY(-50%);border-bottom:3px solid rgba(255,255,255,.4)">{righe}</div>'
    cont = (f'<div class=pannello style="height:{ph}px">{linee(pw, ph)}{lista}</div>'
            f'<div class=blocchi style="top:{y}px"><div class="b l">{e(titolo[0])}</div><div class="b w">{e(titolo[1])}</div></div>')
    return telaio(alt, SUPERFICI[sup], cont, "Oggi", "")


def disegna(lavori, uscita):
    uscita.mkdir(parents=True, exist_ok=True)
    with sync_playwright() as p:
        b = p.chromium.launch(executable_path="/opt/pw-browsers/chromium", args=["--no-sandbox"])
        for nome, (h, alt) in lavori.items():
            pg = b.new_page(viewport={"width": W, "height": alt})
            pg.set_content(h); pg.wait_for_timeout(600)
            pg.screenshot(path=str(uscita / f"{nome}.png")); pg.close()
        b.close()


if __name__ == "__main__":
    out = Path(sys.argv[1]) if len(sys.argv) > 1 else QUI / "copertine"
    disegna({
        "1-ultimora-vince-swiatek": (pagina_foto("3730", [("Vince", "l"), ("Swiatek!", "l"), ("6-2 6-1", "w")], "Secondo turno · Wuhan Open", "Ultim'ora"), 1920),
        "2-italiani-in-campo-oggi": (incampo(("Italiani in", "campo oggi"), [("15:30", "Teichmann vs Bronzetti", "Rovereto · Secondo turno"), ("17:30", "Tan vs Stefanini", "Rovereto · Secondo turno"), ("19:30", "Pigato vs Havlickova", "Rovereto · Secondo turno")]), 1920),
        "3-il-numero-sinner": (numero("3623", "30", "titoli in carriera", "Jannik Sinner · n.1"), 1920),
        "4-ultimora-feed-4x5": (pagina_foto("3730", [("Vince Swiatek!", "l"), ("6-2 6-1", "w")], "Secondo turno · Wuhan Open", "Ultim'ora", alt=1350), 1350),
    }, out)
    print("fatto:", out)
