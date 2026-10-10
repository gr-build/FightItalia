"""Completa le foto dei giocatori mancanti con le immagini di Wikipedia (Wikimedia Commons, licenze libere).
Uso: python3 build_foto.py   (dopo build_data.py). Salva docs/data/foto-wiki.json come memoria per non richiedere due volte.
Poi copia tutte le foto (ESPN e Wikipedia) in docs/img/giocatori/ID.webp, quadrate e leggere:
il sito non dipende da server esterni per le immagini."""
import io, json, os, time, urllib.parse, urllib.request

DATA = os.path.join(os.path.dirname(os.path.abspath(__file__)), "docs", "data")
UA = {"User-Agent": "SmashOggi/1.0 (prototipo tennis; contatto via repository)"}
MEMO = os.path.join(DATA, "foto-wiki.json")

def carica(nome):
    p = os.path.join(DATA, nome)
    return json.load(open(p, encoding="utf-8"))

def cerca(nome):
    url = "https://en.wikipedia.org/api/rest_v1/page/summary/" + urllib.parse.quote(nome.replace(" ", "_"))
    for tentativo in range(3):
        try:
            with urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=20) as r:
                d = json.load(r)
            break
        except urllib.error.HTTPError as e:
            if e.code == 404: return None
            time.sleep(2 * (tentativo + 1))
        except Exception:
            time.sleep(2 * (tentativo + 1))
    else:
        return "ERRORE"
    if "tennis" not in (d.get("description", "") + d.get("extract", "")[:300]).lower():
        return None  # omonimo: meglio nessuna foto che quella sbagliata
    t = d.get("thumbnail", {}).get("source")
    return t.split("?")[0] if t else None

def salva(url, dest, lato=280):
    from PIL import Image  # pip install pillow
    try:
        with urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=30) as r:
            im = Image.open(io.BytesIO(r.read()))
        im = im.convert("RGBA")
        w, h = im.size
        q = min(w, h)
        im = im.crop(((w - q) // 2, 0, (w - q) // 2 + q, q)).resize((lato, lato), Image.LANCZOS)  # quadrato preso dall'alto: il viso resta dentro
        im.save(dest, "WEBP", quality=78)
        time.sleep(0.3)
        return True
    except Exception as e:
        print("  foto non scaricata:", url[:80], e)
        return False

def main():
    memo = json.load(open(MEMO, encoding="utf-8")) if os.path.exists(MEMO) else {}
    classifiche = {t: carica(f"classifica-{t}.json") for t in ("atp", "wta")}
    giocatori = carica("giocatori.json")
    for c in classifiche.values():
        for r in c["righe"]:
            if r.get("foto") or r["nome"] in memo: continue
            f = cerca(r["nome"])
            if f != "ERRORE": memo[r["nome"]] = f
            time.sleep(0.4)
    json.dump(memo, open(MEMO, "w", encoding="utf-8"), ensure_ascii=False, indent=1)
    cartella = os.path.join(os.path.dirname(DATA), "img", "giocatori")
    os.makedirs(cartella, exist_ok=True)
    locali = {}
    for c in classifiche.values():
        for r in c["righe"]:
            src = r.get("foto") if (r.get("foto") or "").startswith("http") else memo.get(r["nome"])
            if r.get("foto") and not r["foto"].startswith("http"): src = None
            dest = os.path.join(cartella, f"{r['id']}.webp")
            if src and not os.path.exists(dest) and not salva(src, dest): src = None
            if os.path.exists(dest): r["foto"] = f"img/giocatori/{r['id']}.webp"; locali[str(r["id"])] = r["foto"]
            else: r.pop("foto", None)
    n = len(locali)
    for t, c in classifiche.items():
        json.dump(c, open(os.path.join(DATA, f"classifica-{t}.json"), "w", encoding="utf-8"), ensure_ascii=False, separators=(",", ":"))
    items = giocatori.values() if isinstance(giocatori, dict) else giocatori
    for g in items:
        if not isinstance(g, dict): continue
        if str(g.get("id")) in locali: g["foto"] = locali[str(g["id"])]
        else: g.pop("foto", None)
    json.dump(giocatori, open(os.path.join(DATA, "giocatori.json"), "w", encoding="utf-8"), ensure_ascii=False, separators=(",", ":"))
    tot = sum(1 for c in classifiche.values() for r in c["righe"] if r.get("foto"))
    print(f"Foto salvate nel sito: {n}. Giocatori con foto: {tot}/200")

main()
