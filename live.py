"""Aggiorna docs/data/live.json: la card "in diretta" del sito (visibile
solo quando c'e' un incontro in corso o appena finito). Va rilanciato
spesso (vedi .github/workflows/live.yml), a differenza di build_data.py
che genera tutto il resto una volta al giorno con dati.yml — per questo e'
un file a se', con la sola dipendenza "requests": il workflow frequente
non deve installare pandas/bs4/lxml/Playwright ne' toccare roster/eventi/
schede solo per sapere se un incontro e' in corso.

Nota: ESPN_SCOREBOARD e' lo stesso URL usato in build_data.py (constant
duplicata di proposito, per non importare quel modulo — vedi sopra)."""

import json
import re
from datetime import datetime, timedelta, timezone
from pathlib import Path

import requests

WEB_DATA = Path(__file__).parent / "docs" / "data"
ESPN_SCOREBOARD = "https://site.api.espn.com/apis/site/v2/sports/mma/ufc/scoreboard"
FINESTRA_RISULTATO_RECENTE_MIN = 90  # minuti dall'inizio programmato dell'ultimo incontro concluso


def genera_live():
    """Guarda lo scoreboard ESPN di oggi e ieri (fuso UTC: i main event UFC
    iniziano spesso in tarda serata US e finiscono dopo mezzanotte UTC) e
    scrive lo stato "in diretta". Nessun incontro in corso o appena concluso
    -> stato "nessuno" (il sito non mostra nulla). ESPN non da' il metodo
    (KO/Sub/Decisione) su questo endpoint, solo il vincitore — il metodo
    arriva dopo, con il resto della card, nella run quotidiana di dati.yml."""
    adesso = datetime.now(timezone.utc)
    risultato = {"generato_il": adesso.isoformat(), "stato": "nessuno"}
    for giorno in (adesso.date(), adesso.date() - timedelta(days=1)):
        try:
            r = requests.get(ESPN_SCOREBOARD, params={"dates": giorno.strftime("%Y%m%d")}, timeout=15)
            r.raise_for_status()
            eventi = r.json().get("events") or []
        except Exception as errore:
            print(f"  [live] {giorno}: scoreboard non raggiungibile ({errore})")
            continue
        if not eventi:
            continue
        ev = eventi[0]
        incontri = []
        for c in ev.get("competitions") or []:
            try:
                inizio = datetime.strptime(c["date"], "%Y-%m-%dT%H:%MZ").replace(tzinfo=timezone.utc)
            except (KeyError, ValueError):
                continue
            atleti = sorted(c.get("competitors") or [], key=lambda x: x.get("order", 9))
            if len(atleti) != 2:
                continue
            stato_comp = ((c.get("status") or {}).get("type") or {}).get("state")  # "pre"/"in"/"post"
            vincitore = next((a["athlete"]["displayName"] for a in atleti if a.get("winner")), None)
            incontri.append({
                "inizio": inizio, "stato": stato_comp,
                "categoria": re.sub(r"^W\s+", "Women's ", (c.get("type") or {}).get("abbreviation") or ""),
                "nomi": [a["athlete"]["displayName"] for a in atleti],
                "round": (c.get("status") or {}).get("period"),
                "clock": (c.get("status") or {}).get("displayClock"),
                "vincitore": vincitore,
            })
        if not incontri:
            continue
        incontri.sort(key=lambda x: x["inizio"])
        corrente = next((x for x in incontri if x["stato"] == "in"), None)
        conclusi = [x for x in incontri if x["stato"] == "post" and x["vincitore"]]
        ultimo = max(conclusi, key=lambda x: x["inizio"]) if conclusi else None
        recente = ultimo and (adesso - ultimo["inizio"]).total_seconds() < FINESTRA_RISULTATO_RECENTE_MIN * 60
        if not corrente and not recente:
            continue  # niente di "vivo" in questo giorno: prova l'altro
        risultato = {
            "generato_il": adesso.isoformat(),
            "evento": ev.get("name"),
            "stato": "in_corso" if corrente else "risultato_recente",
            "incontro_corrente": {
                "nomi": corrente["nomi"], "categoria": corrente["categoria"],
                "round": corrente["round"], "clock": corrente["clock"],
            } if corrente else None,
            "ultimo_risultato": {
                "nomi": ultimo["nomi"], "categoria": ultimo["categoria"], "vincitore": ultimo["vincitore"],
            } if ultimo else None,
        }
        break
    WEB_DATA.mkdir(parents=True, exist_ok=True)
    (WEB_DATA / "live.json").write_text(json.dumps(risultato, ensure_ascii=False), encoding="utf-8")
    print(f"[live] stato: {risultato['stato']}" + (f" — {risultato.get('evento')}" if risultato.get("evento") else ""))


if __name__ == "__main__":
    genera_live()
