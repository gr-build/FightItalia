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

# Foto per: classificati (primi 150), italiani e vincitori di un torneo della stagione.
# Gli altri restano con le iniziali: tiene il sito leggero (e sotto i limiti di file della demo).
def merita(g):
    return bool(g.get("pos")) or g.get("paese") == "ITA" or bool(g.get("titoliAnno"))


def main():
    memo = json.load(open(MEMO, encoding="utf-8")) if os.path.exists(MEMO) else {}
    classifiche = {t: carica(f"classifica-{t}.json") for t in ("atp", "wta")}
    giocatori = carica("giocatori.json")
    scelti = [g for g in giocatori.values() if merita(g)]
    for g in scelti:
        if (g.get("foto") or "").startswith("http") or g["nome"] in memo: continue
        f = cerca(g["nome"])
        if f != "ERRORE": memo[g["nome"]] = f
        time.sleep(0.4)
    json.dump(memo, open(MEMO, "w", encoding="utf-8"), ensure_ascii=False, indent=1)
    cartella = os.path.join(os.path.dirname(DATA), "img", "giocatori")
    os.makedirs(cartella, exist_ok=True)
    for g in giocatori.values():
        dest = os.path.join(cartella, f"{g['id']}.webp")
        if merita(g) and not os.path.exists(dest):
            src = g.get("foto") if (g.get("foto") or "").startswith("http") else memo.get(g["nome"])
            if src: salva(src, dest)
        if os.path.exists(dest): g["foto"] = f"img/giocatori/{g['id']}.webp"
        else: g.pop("foto", None)
    for t, c in classifiche.items():
        for r in c["righe"]:
            f = giocatori.get(str(r["id"]), {}).get("foto")
            if f: r["foto"] = f
            else: r.pop("foto", None)
        json.dump(c, open(os.path.join(DATA, f"classifica-{t}.json"), "w", encoding="utf-8"), ensure_ascii=False, separators=(",", ":"))
    json.dump(giocatori, open(os.path.join(DATA, "giocatori.json"), "w", encoding="utf-8"), ensure_ascii=False, separators=(",", ":"))
    con = sum(1 for g in giocatori.values() if g.get("foto"))
    print(f"Giocatori: {len(giocatori)}, con foto: {con} (cercate per {len(scelti)})")

main()
