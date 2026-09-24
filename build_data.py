"""
Genera i file JSON statici per il frontend (docs/data/) a partire dai dati
scaricati da scraper_ufc.py. Va rilanciato ogni volta che si vogliono dati
aggiornati (rilancia anche lo scraping se la cache CSV non c'e' o e' vecchia).

Il dettaglio di ogni lottatore (infobox + storico incontri) viene
pre-scaricato qui per tutti i lottatori con una pagina Wikipedia, cosi' il
sito finale e' completamente statico (nessun server Python da tenere
acceso) — ogni lottatore diventa un file JSON separato in
docs/data/lottatori/<slug>.json, scaricato dal browser solo quando serve.
"""

import json
import re
import time
from datetime import date, datetime, timedelta
from pathlib import Path

import pandas as pd

from scraper_ufc import (
    scarica_card_evento,
    scarica_dettaglio_lottatore,
    scarica_eventi,
    scarica_eventi_organizzazione_anno,
    scarica_orari_evento,
    scarica_roster,
    scarica_roster_organizzazione,
    fuso_da_luogo,
)

WEB_DATA = Path(__file__).parent / "docs" / "data"
WEB_DATA_LOTTATORI = WEB_DATA / "lottatori"
WEB_DATA_EVENTI = WEB_DATA / "eventi"
WEB_DATA_EUROPA = WEB_DATA / "europa"
WEB_DATA_LOTTATORI.mkdir(parents=True, exist_ok=True)
WEB_DATA_EVENTI.mkdir(parents=True, exist_ok=True)
WEB_DATA_EUROPA.mkdir(parents=True, exist_ok=True)

# Le uniche due organizzazioni europee con una pagina Wikipedia "List of
# current X fighters" strutturata come quella UFC (Cage Warriors e ARES FC
# non ce l'hanno — restano solo con i campioni curati a mano in
# europa-data.js). Anni coperti per gli eventi: 2025 e 2026 (passato
# recente + programma dell'anno corrente).
ORGANIZZAZIONI_EUROPA = {
    "ksw": {
        "roster_url": "https://en.wikipedia.org/wiki/List_of_current_Konfrontacja_Sztuk_Walki_fighters",
        "anni_eventi": [
            "https://en.wikipedia.org/wiki/2025_in_Konfrontacja_Sztuk_Walki",
            "https://en.wikipedia.org/wiki/2026_in_Konfrontacja_Sztuk_Walki",
        ],
    },
    "oktagon": {
        "roster_url": "https://en.wikipedia.org/wiki/List_of_current_Oktagon_MMA_fighters",
        "anni_eventi": [
            "https://en.wikipedia.org/wiki/2025_in_Oktagon_MMA",
            "https://en.wikipedia.org/wiki/2026_in_Oktagon_MMA",
        ],
    },
}


def _slug_da_link(link):
    return re.sub(r"[^a-z0-9]+", "-", link.rstrip("/").split("/")[-1].lower()).strip("-")


def _pulisci_per_json(df):
    """NaN non e' JSON valido: lo convertiamo in None."""
    return json.loads(df.where(pd.notna(df), None).to_json(orient="records", force_ascii=False))


def _tipo_evento(nome):
    """Gli eventi UFC hanno due numerazioni separate e indipendenti che si
    accavallano se mostrate senza distinzione (es. 'UFC 293' del 2023 e
    'UFC Fight Night 293' del 2026 sembrano lo stesso evento a chi legge
    solo il numero) — la tag esplicita evita l'equivoco."""
    if re.match(r"^UFC \d+", nome):
        return "Numerato"
    if "Fight Night" in nome:
        return "Fight Night"
    return "Altro"


# Roster attuale (scarica_roster) elenca solo chi e' sotto contratto oggi —
# leggende ritirate come Khabib o Jon Jones (al momento del ritiro) non ci
# sono. Le aggiungiamo a mano: e' una lista curata, non uno scraping
# automatico, quindi va estesa manualmente se manca qualcuno di importante.
LEGGENDE = [
    ("Khabib Nurmagomedov", "https://en.wikipedia.org/wiki/Khabib_Nurmagomedov"),
    ("Jon Jones", "https://en.wikipedia.org/wiki/Jon_Jones"),
    ("Georges St-Pierre", "https://en.wikipedia.org/wiki/Georges_St-Pierre"),
    ("Anderson Silva", "https://en.wikipedia.org/wiki/Anderson_Silva"),
    ("BJ Penn", "https://en.wikipedia.org/wiki/BJ_Penn"),
    ("Chuck Liddell", "https://en.wikipedia.org/wiki/Chuck_Liddell"),
    ("Randy Couture", "https://en.wikipedia.org/wiki/Randy_Couture"),
    ("Demetrious Johnson", "https://en.wikipedia.org/wiki/Demetrious_Johnson_(fighter)"),
    ("Daniel Cormier", "https://en.wikipedia.org/wiki/Daniel_Cormier"),
    ("Cain Velasquez", "https://en.wikipedia.org/wiki/Cain_Velasquez"),
    ("Ronda Rousey", "https://en.wikipedia.org/wiki/Ronda_Rousey"),
    ("Brock Lesnar", "https://en.wikipedia.org/wiki/Brock_Lesnar"),
    ("Michael Bisping", "https://en.wikipedia.org/wiki/Michael_Bisping"),
    ("Vitor Belfort", "https://en.wikipedia.org/wiki/Vitor_Belfort"),
    ("Tito Ortiz", "https://en.wikipedia.org/wiki/Tito_Ortiz"),
    ("Matt Hughes", "https://en.wikipedia.org/wiki/Matt_Hughes_(fighter)"),
    ("Frankie Edgar", "https://en.wikipedia.org/wiki/Frankie_Edgar"),
    ("Junior dos Santos", "https://en.wikipedia.org/wiki/Junior_dos_Santos"),
    ("José Aldo", "https://en.wikipedia.org/wiki/Jos%C3%A9_Aldo"),
    ("Forrest Griffin", "https://en.wikipedia.org/wiki/Forrest_Griffin"),
]

CATEGORIA_LEGGENDE = "Leggende (ex campioni)"


def _righe_leggende():
    return pd.DataFrame(
        [{"categoria": CATEGORIA_LEGGENDE, "nome": nome, "link": link, "slug": _slug_da_link(link)} for nome, link in LEGGENDE]
    )


def _record_da_storico_json(path):
    if not path.exists():
        return None
    storico = json.loads(path.read_text(encoding="utf-8")).get("storico") or []
    if not storico:
        return None
    vinte = sum(1 for f in storico if str(f.get("res.", "")).strip().lower() == "win")
    perse = sum(1 for f in storico if str(f.get("res.", "")).strip().lower() == "loss")
    return f"{vinte}–{perse}"


def _foto_da_json(path):
    if not path.exists():
        return None
    return json.loads(path.read_text(encoding="utf-8")).get("infobox", {}).get("_immagine")


def _cm_da_stringa(testo):
    """Le stringhe Height/Reach nell'infobox mostrano il metrico per primo
    (vedi migrazione dati Wikipedia), es. '191 cm (6 ft 3 in)' — ma
    Wikipedia esprime l'altezza in metri per alcuni lottatori invece che in
    cm, es. '1.88 m (6 ft 2 in)': gestiamo entrambe le unita'."""
    if not isinstance(testo, str):
        return None
    m = re.match(r"([\d.]+)\s*(cm|m)\b", testo.strip())
    if not m:
        return None
    valore = float(m.group(1))
    return valore * 100 if m.group(2) == "m" else valore


def _fisico_da_json(path):
    if not path.exists():
        return None, None
    inf = json.loads(path.read_text(encoding="utf-8")).get("infobox", {})
    return _cm_da_stringa(inf.get("Height")), _cm_da_stringa(inf.get("Reach"))


# Orari tipici UFC, usati solo quando quelli ufficiali di ufc.com non sono
# disponibili (il JSON li marca "indicativo" e la pagina lo dice). In Nord
# America la UFC ragiona in orario della costa Est qualunque sia la sede
# (Las Vegas compresa); altrove l'orario e' quello locale di prima serata.
ORARI_TIPICI_NORD_AMERICA = {"fuso_orari": "America/New_York", "early_prelims": "18:00", "prelims": "20:00", "main_card": "22:00"}
ORARI_TIPICI_RESTO_DEL_MONDO = {"early_prelims": "16:00", "prelims": "18:00", "main_card": "21:00"}


def _orari_tipici(luogo):
    fuso = fuso_da_luogo(luogo)
    if not fuso:
        return None
    if fuso.startswith("America/"):
        return {**ORARI_TIPICI_NORD_AMERICA, "fuso_sede": fuso}
    return {**ORARI_TIPICI_RESTO_DEL_MONDO, "fuso_orari": fuso, "fuso_sede": fuso}


def _orari_evento_italia(nome_evento, luogo, data_evento):
    """Orari locali sede + conversione Italia (Europe/Rome, DST automatica
    via zoneinfo) per un singolo evento futuro. Ritorna None se manca uno
    fuso sede o data leggibile. Senza orario ufficiale da ufc.com usa gli
    orari tipici (_orari_tipici) e marca il risultato "indicativo"."""
    from datetime import datetime
    from zoneinfo import ZoneInfo

    try:
        orari = scarica_orari_evento(nome_evento, luogo)
    except Exception as errore:
        print(f"  [orari] {nome_evento}: scraping fallito ({errore})")
        orari = None
    try:
        giorno = datetime.strptime(data_evento, "%b %d, %Y").date()
    except (ValueError, TypeError):
        return None

    indicativo = False
    if not orari:
        # ufc.com non leggibile (Selenium+Edge non c'e' su GitHub Actions,
        # o pagina evento non ancora pubblicata): meglio un orario tipico
        # dichiarato come tale che nessun orario — vedi ORARI_TIPICI.
        orari = _orari_tipici(luogo)
        if not orari:
            return None
        indicativo = True

    fuso_sede = ZoneInfo(orari["fuso_sede"])
    fuso_italia = ZoneInfo("Europe/Rome")
    risultato = {"fuso_sede": orari["fuso_sede"], "indicativo": indicativo}
    for chiave in ("early_prelims", "prelims", "main_card"):
        ora_testo = orari.get(chiave)
        if not ora_testo:
            risultato[chiave] = None
            continue
        ore, minuti = (int(x) for x in ora_testo.split(":"))
        fuso_orario = ZoneInfo(orari.get("fuso_orari", orari["fuso_sede"]))
        istante_sede = datetime(giorno.year, giorno.month, giorno.day, ore, minuti, tzinfo=fuso_orario).astimezone(fuso_sede)
        istante_italia = istante_sede.astimezone(fuso_italia)
        risultato[chiave] = {
            "locale": istante_sede.strftime("%H:%M"),
            "italia": istante_italia.strftime("%H:%M"),
            "giorno_dopo": istante_italia.date() != istante_sede.date(),
        }
    return risultato if any(risultato[k] for k in ("early_prelims", "prelims", "main_card")) else None


def genera_roster_e_eventi():
    roster = scarica_roster()
    eventi = scarica_eventi()

    roster = roster.assign(slug=roster["link"].apply(lambda l: _slug_da_link(l) if isinstance(l, str) else None))
    # Wikipedia marca i campioni in carica con "(c)" appeso al nome nella
    # tabella roster — lo isoliamo in un campo dedicato (per il filtro
    # "Campioni") e puliamo il nome per la visualizzazione.
    roster["campione_attuale"] = roster["nome"].str.contains(r"\(c\)", regex=True, na=False)
    roster["nome"] = roster["nome"].str.replace(r"\s*\(c\)\s*", "", regex=True)
    roster["ex_campione"] = False

    leggende = _righe_leggende()
    leggende["ex_campione"] = True
    leggende["campione_attuale"] = False
    roster = pd.concat([roster, leggende], ignore_index=True)
    eventi = eventi.assign(tipo=eventi["evento"].apply(_tipo_evento))

    # Orario di inizio (sede + Italia): solo per eventi futuri con card
    # gia' annunciata su ufc.com — vedi _orari_evento_italia. Selenium apre
    # un browser per ogni evento, quindi lo facciamo solo per il sottoinsieme
    # "programmato" (poche decine al piu', mai per gli 800 eventi passati).
    programmati = eventi["stato"] == "programmato"
    print(f"Orari evento: calcolo per {programmati.sum()} eventi futuri...")
    eventi["orari"] = None
    eventi.loc[programmati, "orari"] = eventi.loc[programmati].apply(
        lambda r: _orari_evento_italia(r["evento"], r["luogo"], r["data"]), axis=1
    )

    (WEB_DATA / "eventi.json").write_text(
        json.dumps(_pulisci_per_json(eventi), ensure_ascii=False, indent=None), encoding="utf-8"
    )
    print(f"eventi.json: {len(eventi)} eventi")
    return roster


def scrivi_roster_json(roster):
    """Va chiamata DOPO genera_dettagli_lottatori: solo allora lo storico
    delle leggende e' in cache e possiamo calcolarne il record vinte-perse
    (le leggende non hanno un record_mma dalla pagina roster, a differenza
    degli attuali)."""
    mask = roster["categoria"] == CATEGORIA_LEGGENDE
    roster.loc[mask, "record_mma"] = roster.loc[mask, "slug"].apply(
        lambda s: _record_da_storico_json(WEB_DATA_LOTTATORI / f"{s}.json")
    )
    # La foto vive nel JSON per-lottatore (scaricato da genera_dettagli_lottatori),
    # non nella pagina roster — la copiamo qui cosi' anche le card della
    # lista lottatori (non solo Confronto/scheda singola) possono mostrarla.
    roster["foto"] = roster["slug"].apply(
        lambda s: _foto_da_json(WEB_DATA_LOTTATORI / f"{s}.json") if isinstance(s, str) else None
    )

    # Percentile di altezza/reach nella propria categoria di peso (es. "piu'
    # alto dell'80% dei massimi"): calcolato qui, non nel browser, perche'
    # richiederebbe scaricare il JSON di ogni lottatore della categoria solo
    # per confrontarne due. "Leggende" non e' una vera categoria di peso
    # (mischia pesi diversi), quindi resta esclusa dal calcolo.
    fisico = roster["slug"].apply(
        lambda s: pd.Series(_fisico_da_json(WEB_DATA_LOTTATORI / f"{s}.json") if isinstance(s, str) else (None, None))
    )
    roster[["altezza_cm", "reach_cm"]] = fisico
    con_percentile = roster["categoria"] != CATEGORIA_LEGGENDE
    for campo, percentile in (("altezza_cm", "percentile_altezza"), ("reach_cm", "percentile_reach")):
        roster[percentile] = None
        roster.loc[con_percentile, percentile] = (
            roster.loc[con_percentile].groupby("categoria")[campo].rank(pct=True) * 100
        ).round()

    (WEB_DATA / "roster.json").write_text(
        json.dumps(_pulisci_per_json(roster), ensure_ascii=False, indent=None), encoding="utf-8"
    )
    print(f"roster.json: {len(roster)} lottatori ({mask.sum()} leggende)")


# Una scheda scaricata restava uguale per sempre: storico incontri fermo
# e foto mai aggiunte (es. Joshua Van, campione dei mosca, rimasto senza
# foto anche dopo che Wikipedia l'aveva pubblicata). Ora si riscarica
# quando e' vecchia: ~1/30 del roster al giorno, i campioni ogni settimana.
GIORNI_AGGIORNAMENTO_SCHEDA = 30
GIORNI_AGGIORNAMENTO_CAMPIONE = 7
# Tetto per run: la prima volta sono scadute tutte le ~2.000 schede insieme,
# e riscaricarle in un colpo sforerebbe il timeout del workflow (30 min).
MAX_AGGIORNAMENTI_PER_RUN = 100


def _scheda_da_aggiornare(path, campione):
    try:
        ultimo = date.fromisoformat(json.loads(path.read_text(encoding="utf-8")).get("ultimo_aggiornamento", ""))
    except (ValueError, OSError, json.JSONDecodeError):
        return True
    giorni = GIORNI_AGGIORNAMENTO_CAMPIONE if campione else GIORNI_AGGIORNAMENTO_SCHEDA
    return (date.today() - ultimo).days >= giorni


def genera_dettagli_lottatori(roster, limite=None, pausa=0.3):
    con_link = roster.dropna(subset=["link"]).reset_index(drop=True)
    if limite:
        con_link = con_link.head(limite)

    # Campioni per primi, cosi' rientrano sempre nel tetto di aggiornamenti.
    if "campione_attuale" in con_link:
        con_link = con_link.sort_values("campione_attuale", ascending=False, kind="stable").reset_index(drop=True)

    fatti, saltati, aggiornati = 0, 0, 0
    for i, riga in con_link.iterrows():
        slug = riga["slug"]
        out_file = WEB_DATA_LOTTATORI / f"{slug}.json"
        if out_file.exists():
            if aggiornati >= MAX_AGGIORNAMENTI_PER_RUN or not _scheda_da_aggiornare(out_file, bool(riga.get("campione_attuale"))):
                saltati += 1
                continue
            aggiornati += 1

        try:
            dettaglio = scarica_dettaglio_lottatore(riga["link"], usa_cache=not out_file.exists())
        except Exception as e:
            print(f"  [{i+1}/{len(con_link)}] ERRORE {riga['nome']}: {e}")
            continue

        storico = dettaglio["storico"]
        out = {
            "nome": dettaglio["nome"],
            "link": riga["link"],
            "infobox": dettaglio["infobox"],
            "storico": _pulisci_per_json(storico) if not storico.empty else [],
            "ultimo_aggiornamento": date.today().isoformat(),
        }
        out_file.write_text(json.dumps(out, ensure_ascii=False), encoding="utf-8")
        fatti += 1
        if fatti % 20 == 0:
            print(f"  [{i+1}/{len(con_link)}] fatti {fatti}, ultimo: {riga['nome']}")
        time.sleep(pausa)

    print(f"Dettagli lottatori: {fatti} scaricati/aggiornati ora, {saltati} ancora recenti. Totale file: {len(list(WEB_DATA_LOTTATORI.glob('*.json')))}")


FINESTRA_RIPROVA_RISULTATI = timedelta(days=45)


def _data_evento(s):
    try:
        return datetime.strptime(s, "%b %d, %Y").date()
    except (ValueError, TypeError):
        return None


def genera_card_eventi(eventi, limite=None, pausa=0.3):
    """Card completa (main + preliminary + early preliminary) per ogni
    evento con una pagina Wikipedia propria — un JSON per evento in
    docs/data/eventi/<slug>.json, scaricato dal browser solo quando si
    apre quella scheda specifica."""
    con_link = eventi.dropna(subset=["link"]).reset_index(drop=True)
    con_link = con_link.assign(slug=con_link["link"].apply(_slug_da_link))
    if limite:
        con_link = con_link.head(limite)

    fatti, saltati, aggiornati, vuoti = 0, 0, 0, 0
    for i, riga in con_link.iterrows():
        out_file = WEB_DATA_EVENTI / f"{riga['slug']}.json"
        ricarica = False
        if out_file.exists():
            # Un evento "passato" la cui card salvata e' ancora senza
            # risultati (scaricata mentre l'evento era "programmato", prima
            # di disputarsi) va ripresa da capo: altrimenti il file esiste
            # gia', viene solo saltato, e i risultati non arrivano mai —
            # anche rilanciando lo script ogni giorno. Limitato agli eventi
            # disputati di recente: oltre la finestra assumiamo che i
            # risultati mancanti siano definitivi (es. evento cancellato,
            # come UFC 151), altrimenti li riproveremmo in eterno ogni giorno.
            data_ev = _data_evento(riga.get("data"))
            entro_finestra = riga["stato"] == "passato" and data_ev and (date.today() - data_ev) <= FINESTRA_RIPROVA_RISULTATI
            card_esistente = []
            if riga["stato"] == "programmato":
                # La card di un evento futuro cambia fino all'ultimo su
                # Wikipedia: incontri aggiunti/cancellati, divisione in
                # main/preliminary/early che arriva solo a card completa,
                # ordine dei bout che si assesta. Scaricata una volta sola
                # restava congelata alla prima versione (es. UFC 332 con
                # tutto sotto "Main card" e senza il main event) — quindi
                # si riprende sempre. Sono ~10-15 eventi, costa poco.
                try:
                    card_esistente = json.loads(out_file.read_text(encoding="utf-8"))
                except (json.JSONDecodeError, OSError):
                    card_esistente = []
                ricarica = True
            elif entro_finestra:
                try:
                    card_esistente = json.loads(out_file.read_text(encoding="utf-8"))
                except (json.JSONDecodeError, OSError):
                    card_esistente = []
                # "not card_esistente" copre anche il caso di una card
                # salvata vuota (pagina Wikipedia non ancora pronta al
                # momento dello scraping): senza, "[] and ..." e' sempre
                # falsy e quell'evento non verrebbe MAI piu' riprovato,
                # a differenza di uno con risultati solo parziali.
                if not card_esistente or any(not (b.get("metodo") or "").strip() for b in card_esistente):
                    ricarica = True
            if not ricarica:
                saltati += 1
                continue

        try:
            card = scarica_card_evento(riga["link"], usa_cache=not ricarica)
        except Exception as e:
            print(f"  [{i+1}/{len(con_link)}] ERRORE {riga['evento']}: {e}")
            continue

        if ricarica and not card and card_esistente:
            # Il tentativo di riscaricare non ha trovato nulla (probabile
            # intoppo temporaneo di rete/parsing, non un vero azzeramento
            # della card su Wikipedia): meglio tenere i risultati buoni
            # gia' salvati che sovrascriverli con un risultato vuoto.
            saltati += 1
            continue

        out_file.write_text(json.dumps(card, ensure_ascii=False), encoding="utf-8")
        if ricarica:
            aggiornati += 1
        else:
            fatti += 1
        if not card:
            vuoti += 1
        if (fatti + aggiornati) % 20 == 0:
            print(f"  [{i+1}/{len(con_link)}] fatti {fatti}, ultimo: {riga['evento']}")
        time.sleep(pausa)

    print(f"Card eventi: {fatti} scaricate ora, {aggiornati} riscaricate (eventi futuri o senza risultati) ({vuoti} vuote/non trovate), {saltati} gia' in cache.")


def genera_lottatori_extra(pausa=0.3):
    """Lottatori che compaiono in almeno una card evento ma non nel roster
    UFC attuale ne' tra le leggende (undercard di eventi passati, o un nome
    uscito dal roster su Wikipedia pur avendo appena combattuto — succede,
    verificato con Gilbert Burns) — senza una scheda propria non hanno ne'
    un link "Confronta" ne' una pagina di dettaglio (vedi commento in
    evento.js). Scrive comunque un JSON in docs/data/lottatori/<slug>.json
    (stesso formato/posizione dei lottatori del roster, cosi' lottatore.html
    e confronto.js non richiedono modifiche per leggerlo) piu' un indice
    leggero in docs/data/extra-lottatori.json (nome/slug/record/foto) che
    confronto.js ed evento.js caricano IN AGGIUNTA a roster.json. Restano
    fuori apposta dalla pagina "Database Lottatori": quella resta solo
    roster attuale + leggende, come descritto nel README."""
    roster_slugs = {r["slug"] for r in json.loads((WEB_DATA / "roster.json").read_text(encoding="utf-8"))}

    trovati = {}  # slug -> (nome, link, categoria)
    for path in sorted(WEB_DATA_EVENTI.glob("*.json")):
        card = json.loads(path.read_text(encoding="utf-8"))
        for b in card:
            for lato in ("fighter1", "fighter2"):
                link = b.get(f"{lato}_link")
                slug = _slug_da_link(link) if link else None
                if slug and slug not in roster_slugs and slug not in trovati:
                    trovati[slug] = (b.get(lato), link, b.get("categoria"))

    fatti, saltati = 0, 0
    for slug, (nome, link, categoria) in trovati.items():
        out_file = WEB_DATA_LOTTATORI / f"{slug}.json"
        if out_file.exists():
            saltati += 1
            continue
        try:
            dettaglio = scarica_dettaglio_lottatore(link)
        except Exception as e:
            print(f"  ERRORE {nome}: {e}")
            continue

        storico = dettaglio["storico"]
        out = {
            "nome": dettaglio["nome"] or nome,
            "link": link,
            "infobox": dettaglio["infobox"],
            "storico": _pulisci_per_json(storico) if not storico.empty else [],
            "ultimo_aggiornamento": date.today().isoformat(),
        }
        out_file.write_text(json.dumps(out, ensure_ascii=False), encoding="utf-8")
        fatti += 1
        if fatti % 50 == 0:
            print(f"  [{fatti}/{len(trovati)}] fatti, ultimo: {nome}")
        time.sleep(pausa)

    print(f"Lottatori extra: {fatti} scaricati ora, {saltati} gia' in cache. Candidati totali: {len(trovati)}")

    indice = []
    for slug, (nome, link, categoria) in trovati.items():
        path = WEB_DATA_LOTTATORI / f"{slug}.json"
        if not path.exists():
            continue
        indice.append({
            "slug": slug,
            "nome": nome,
            "link": link,
            "categoria": categoria,
            "record_mma": _record_da_storico_json(path),
            "foto": _foto_da_json(path),
            "eta": None,
            "campione_attuale": False,
            "ex_campione": False,
            "percentile_altezza": None,
            "percentile_reach": None,
        })
    (WEB_DATA / "extra-lottatori.json").write_text(json.dumps(indice, ensure_ascii=False), encoding="utf-8")
    print(f"extra-lottatori.json: {len(indice)} lottatori")


def genera_europa():
    for org, cfg in ORGANIZZAZIONI_EUROPA.items():
        roster = scarica_roster_organizzazione(cfg["roster_url"], f"{org}_roster")
        if not roster.empty:
            roster = roster.assign(slug=roster["link"].apply(lambda l: _slug_da_link(l) if isinstance(l, str) else None))
            (WEB_DATA_EUROPA / f"{org}-roster.json").write_text(
                json.dumps(_pulisci_per_json(roster), ensure_ascii=False), encoding="utf-8"
            )
        print(f"{org}: {len(roster)} lottatori nel roster")

        eventi_anni = []
        for url_anno in cfg["anni_eventi"]:
            df_anno = scarica_eventi_organizzazione_anno(url_anno)
            if not df_anno.empty:
                eventi_anni.append(df_anno)
        eventi = pd.concat(eventi_anni, ignore_index=True) if eventi_anni else pd.DataFrame()
        if not eventi.empty:
            (WEB_DATA_EUROPA / f"{org}-eventi.json").write_text(
                json.dumps(_pulisci_per_json(eventi), ensure_ascii=False), encoding="utf-8"
            )
        print(f"{org}: {len(eventi)} eventi")



# ---------- Dati per i giochi (Chi e'?, Piu' o meno) ----------
# Un file unico e leggero con solo i campi che servono ai giochi, invece di
# far scaricare al browser centinaia di schede. Il paese e' quello di
# nascita (il campo Nationality di Wikipedia manca in 3 schede su 4).

_PAESI_IT = {
    "U.S.": ("Stati Uniti", "🇺🇸"), "United States": ("Stati Uniti", "🇺🇸"), "United States of America": ("Stati Uniti", "🇺🇸"),
    "Brazil": ("Brasile", "🇧🇷"), "Russia": ("Russia", "🇷🇺"), "Soviet Union": ("Russia/URSS", "🇷🇺"),
    "China": ("Cina", "🇨🇳"), "Poland": ("Polonia", "🇵🇱"), "Mexico": ("Messico", "🇲🇽"), "México": ("Messico", "🇲🇽"),
    "England": ("Regno Unito", "🇬🇧"), "Scotland": ("Regno Unito", "🇬🇧"), "Wales": ("Regno Unito", "🇬🇧"),
    "Australia": ("Australia", "🇦🇺"), "South Australia": ("Australia", "🇦🇺"), "Canada": ("Canada", "🇨🇦"),
    "France": ("Francia", "🇫🇷"), "New Zealand": ("Nuova Zelanda", "🇳🇿"), "Japan": ("Giappone", "🇯🇵"),
    "Nigeria": ("Nigeria", "🇳🇬"), "Argentina": ("Argentina", "🇦🇷"), "Uzbekistan": ("Uzbekistan", "🇺🇿"),
    "South Korea": ("Corea del Sud", "🇰🇷"), "FR Yugoslavia": ("Jugoslavia", "🏳️"), "SFR Yugoslavia": ("Jugoslavia", "🏳️"),
    "Germany": ("Germania", "🇩🇪"), "West Germany": ("Germania", "🇩🇪"), "Iran": ("Iran", "🇮🇷"), "Slovakia": ("Slovacchia", "🇸🇰"),
    "Kyrgyzstan": ("Kirghizistan", "🇰🇬"), "Switzerland": ("Svizzera", "🇨🇭"), "Moldova": ("Moldavia", "🇲🇩"),
    "Ukraine": ("Ucraina", "🇺🇦"), "Netherlands": ("Paesi Bassi", "🇳🇱"), "South Africa": ("Sudafrica", "🇿🇦"),
    "Ireland": ("Irlanda", "🇮🇪"), "Jamaica": ("Giamaica", "🇯🇲"), "Ecuador": ("Ecuador", "🇪🇨"), "Kazakhstan": ("Kazakistan", "🇰🇿"),
    "India": ("India", "🇮🇳"), "Tajikistan": ("Tagikistan", "🇹🇯"), "Bosnia and Herzegovina": ("Bosnia", "🇧🇦"),
    "Austria": ("Austria", "🇦🇹"), "Dominican Republic": ("Rep. Dominicana", "🇩🇴"), "Cuba": ("Cuba", "🇨🇺"),
    "Portugal": ("Portogallo", "🇵🇹"), "Croatia": ("Croazia", "🇭🇷"), "Czechoslovakia": ("Cechia/Slovacchia", "🇨🇿"),
    "Lithuania": ("Lituania", "🇱🇹"), "Turkey": ("Turchia", "🇹🇷"), "Italy": ("Italia", "🇮🇹"), "Cameroon": ("Camerun", "🇨🇲"),
    "Iceland": ("Islanda", "🇮🇸"), "Denmark": ("Danimarca", "🇩🇰"), "Sweden": ("Svezia", "🇸🇪"), "Spain": ("Spagna", "🇪🇸"),
    "Chile": ("Cile", "🇨🇱"), "Peru": ("Perù", "🇵🇪"), "Georgia": ("Georgia", "🇬🇪"), "Morocco": ("Marocco", "🇲🇦"),
    "Armenia": ("Armenia", "🇦🇲"), "Uganda": ("Uganda", "🇺🇬"), "Philippines": ("Filippine", "🇵🇭"), "Guinea": ("Guinea", "🇬🇳"),
    "Afghanistan": ("Afghanistan", "🇦🇫"), "Iraq": ("Iraq", "🇮🇶"), "Angola": ("Angola", "🇦🇴"), "Myanmar": ("Myanmar", "🇲🇲"),
    "Panama": ("Panama", "🇵🇦"), "Venezuela": ("Venezuela", "🇻🇪"), "Thailand": ("Thailandia", "🇹🇭"), "Cyprus": ("Cipro", "🇨🇾"),
}


def _paese_nascita(infobox):
    nato = re.sub(r"\[.*?\]|\(.*?\)", "", infobox.get("Born") or "").strip()
    if "," not in nato:
        return None, None
    return _PAESI_IT.get(nato.split(",")[-1].strip(), (None, None))


def _intero(v):
    try:
        return int(str(v).strip().split()[0])
    except (ValueError, IndexError, TypeError):
        return None


def _categoria_giochi(cat):
    """'Women's flyweights (125 lb, 56 kg)' -> ('Mosca', 'F')."""
    nomi = {
        "heavyweights": "Massimi", "light heavyweights": "Mediomassimi", "middleweights": "Medi",
        "welterweights": "Welter", "lightweights": "Leggeri", "featherweights": "Piuma",
        "bantamweights": "Gallo", "flyweights": "Mosca", "strawweights": "Paglia",
    }
    base = re.sub(r"\s*\(.*", "", cat or "").lower()
    genere = "F" if base.startswith("women's") else "M"
    base = base.replace("women's ", "")
    return nomi.get(base), genere


def genera_dati_giochi():
    roster = json.loads((WEB_DATA / "roster.json").read_text(encoding="utf-8"))
    out = []
    for r in roster:
        cat, genere = _categoria_giochi(r.get("categoria"))
        if not r.get("slug") or not cat:
            continue  # leggende e liste speciali (recent signings...) senza categoria di peso
        path = WEB_DATA_LOTTATORI / f"{r['slug']}.json"
        if not path.exists():
            continue
        scheda = json.loads(path.read_text(encoding="utf-8"))
        ib = scheda.get("infobox", {})
        # Ultimi 5 incontri come indizi per "Chi e'?": esito, avversario, metodo.
        esiti = {"win": "V", "loss": "S", "draw": "P", "nc": "NC"}
        ultimi = [
            [esiti.get(str(f.get("res.", "")).strip().lower(), "?"), f.get("opponent") or "", (f.get("method") or "").split("(")[0].strip(), f.get("event") or ""]
            for f in (scheda.get("storico") or [])[:5]
        ]
        paese, bandiera = _paese_nascita(ib)
        # Il record viene dal roster (record_mma, "28–14 (1 NC)"): nell'infobox
        # Wins/Losses a volte mescolano pugilato e MMA (Derrick Lewis: 1-14).
        m = re.match(r"\s*(\d+)\D+(\d+)", r.get("record_mma") or "")
        if not m:
            continue
        vinte, perse = int(m.group(1)), int(m.group(2))
        # Vittorie per KO/sottomissione contate dallo storico incontri: i
        # campi "By knockout"/"By submission" dell'infobox sono spesso
        # indietro rispetto al record (Makhachev: 1+13+11 su 29 vittorie).
        vittorie = [str(f.get("method") or "").lower() for f in (scheda.get("storico") or []) if str(f.get("res.", "")).strip().lower() == "win"]
        if vittorie and abs(len(vittorie) - vinte) <= 1:
            ko = sum(1 for m in vittorie if m.startswith(("ko", "tko")))
            sub = sum(1 for m in vittorie if m.startswith(("submission", "technical submission")))
        else:
            ko = sub = None
        out.append({
            "n": r["nome"], "s": r["slug"], "c": cat, "g": genere,
            "p": paese, "b": bandiera,
            "e": _intero(r.get("eta")),
            "h": r.get("altezza_cm"), "r": r.get("reach_cm"),
            "v": vinte, "l": perse, "ko": ko, "sub": sub,
            "f": r.get("foto"), "ch": bool(r.get("campione_attuale")), "u": ultimi,
        })
    (WEB_DATA / "giochi.json").write_text(json.dumps(out, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    print(f"Dati giochi: {len(out)} lottatori ({sum(1 for x in out if x['p'])} con paese)")

if __name__ == "__main__":
    roster = genera_roster_e_eventi()
    genera_dettagli_lottatori(roster)
    scrivi_roster_json(roster)

    eventi = pd.read_json(WEB_DATA / "eventi.json")
    genera_card_eventi(eventi)
    genera_lottatori_extra()
    genera_dati_giochi()
