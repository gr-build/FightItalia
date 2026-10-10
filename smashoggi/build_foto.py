"""Completa le foto dei giocatori mancanti con le immagini di Wikipedia (Wikimedia Commons, licenze libere).
Uso: python3 build_foto.py   (dopo build_data.py). Salva docs/data/foto-wiki.json come memoria per non richiedere due volte."""
import json, os, time, urllib.parse, urllib.request

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
    n = 0
    for c in classifiche.values():
        for r in c["righe"]:
            if not r.get("foto") and memo.get(r["nome"]): r["foto"] = memo[r["nome"]]; n += 1
    for t, c in classifiche.items():
        json.dump(c, open(os.path.join(DATA, f"classifica-{t}.json"), "w", encoding="utf-8"), ensure_ascii=False, separators=(",", ":"))
    items = giocatori.values() if isinstance(giocatori, dict) else giocatori
    for g in items:
        if isinstance(g, dict) and not g.get("foto") and memo.get(g.get("nome")): g["foto"] = memo[g["nome"]]
    json.dump(giocatori, open(os.path.join(DATA, "giocatori.json"), "w", encoding="utf-8"), ensure_ascii=False, separators=(",", ":"))
    tot = sum(1 for c in classifiche.values() for r in c["righe"] if r.get("foto"))
    print(f"Foto aggiunte da Wikipedia: {n}. Giocatori con foto: {tot}/200")

main()
