"""Dati per la Griglia MMA (il Tiki Taka Toe dell'MMA): docs/data/griglia.json.

Per ogni lottatore passato dalla UFC (schede in docs/data/lottatori) si
ricavano le condizioni che rispetta: nazionalita', categorie in cui ha
combattuto, titoli, numeri di carriera, bonus, altre organizzazioni, paesi
in cui ha combattuto, avversari famosi, epoca. Il gioco poi incrocia due
condizioni per casella.

Formato (compatto, ~100 KB):
  l: [[nome, slug, foto?], ...]  l'indice e' l'id; foto senza il prefisso PREFISSO_FOTO
  u: [incontri UFC, ...]         per la "rarita'" delle risposte
  c: [{id, t, f, p, b?, m: [id, ...]}]  condizione: testo, famiglia,
                                  notorieta' 1-3, bandiera (codice paese), membri

Uso: python build_griglia.py   (dopo build_data.py; gira anche nel workflow dati)
"""

import json
import re
import unicodedata
from collections import defaultdict
from datetime import datetime
from pathlib import Path

from build_data import _PAESI_IT

DOCS = Path(__file__).parent / "docs"
LOTTATORI = DOCS / "data" / "lottatori"
MIN_MEMBRI = 15
PREFISSO_FOTO = "https://upload.wikimedia.org/wikipedia/commons/thumb/"

# Nazionalita' scritte come aggettivi nell'infobox di Wikipedia.
NAZIONALITA = {
    "American": "Stati Uniti", "Brazilian": "Brasile", "Russian": "Russia", "Japanese": "Giappone",
    "English": "Regno Unito", "British": "Regno Unito", "Scottish": "Regno Unito", "Welsh": "Regno Unito",
    "Canadian": "Canada", "Australian": "Australia", "Swedish": "Svezia", "Polish": "Polonia",
    "French": "Francia", "German": "Germania", "Mexican": "Messico", "Chinese": "Cina",
    "Korean": "Corea del Sud", "Dutch": "Paesi Bassi", "Georgian": "Georgia", "Irish": "Irlanda",
    "Norwegian": "Norvegia", "Serbian": "Serbia", "Croatian": "Croazia", "Filipino": "Filippine",
    "Nigerian": "Nigeria", "Kazakh": "Kazakistan", "Cuban": "Cuba", "Italian": "Italia",
    "Spanish": "Spagna", "Armenian": "Armenia", "Ukrainian": "Ucraina", "Argentine": "Argentina",
    "Argentinian": "Argentina", "Peruvian": "Perù", "Chilean": "Cile", "Czech": "Cechia",
    "Portuguese": "Portogallo", "Danish": "Danimarca", "Finnish": "Finlandia", "Turkish": "Turchia",
    "Austrian": "Austria", "Moroccan": "Marocco", "Cameroonian": "Camerun", "Uzbek": "Uzbekistan",
    "Belarusian": "Bielorussia", "Lithuanian": "Lituania", "Icelandic": "Islanda", "Swiss": "Svizzera",
    "Kyrgyz": "Kirghizistan", "Tajik": "Tagikistan", "Ecuadorian": "Ecuador", "Venezuelan": "Venezuela",
    "Jamaican": "Giamaica", "Iranian": "Iran", "Thai": "Thailandia", "Bulgarian": "Bulgaria",
    "Hungarian": "Ungheria", "Romanian": "Romania", "Belgian": "Belgio", "Israeli": "Israele",
}
BANDIERE = {nome: bandiera for nome, bandiera in _PAESI_IT.values()}
BANDIERE.update({"Norvegia": "🇳🇴", "Serbia": "🇷🇸", "Cechia": "🇨🇿", "Finlandia": "🇫🇮", "Bielorussia": "🇧🇾",
                 "Bulgaria": "🇧🇬", "Ungheria": "🇭🇺", "Romania": "🇷🇴", "Belgio": "🇧🇪", "Israele": "🇮🇱"})
# Paesi in cui si e' combattuto, dall'ultima parte del campo location.
LUOGHI = {
    "Brazil": "in Brasile", "United Kingdom": "nel Regno Unito", "England": "nel Regno Unito", "Scotland": "nel Regno Unito",
    "Wales": "nel Regno Unito", "Northern Ireland": "nel Regno Unito", "Canada": "in Canada", "Australia": "in Australia",
    "United Arab Emirates": "negli Emirati (Abu Dhabi)", "Mexico": "in Messico", "Japan": "in Giappone",
    "Germany": "in Germania", "France": "in Francia", "Sweden": "in Svezia", "Poland": "in Polonia", "Russia": "in Russia",
    "China": "in Cina", "Singapore": "a Singapore", "South Korea": "in Corea del Sud", "Ireland": "in Irlanda",
    "Netherlands": "nei Paesi Bassi", "Italy": "in Italia", "Saudi Arabia": "in Arabia Saudita", "New Zealand": "in Nuova Zelanda",
}
DIVISIONI = [
    ("Light Heavyweight", "Mediomassimi"), ("Heavyweight", "Massimi"), ("Middleweight", "Medi"),
    ("Welterweight", "Welter"), ("Lightweight", "Leggeri"), ("Featherweight", "Piuma"),
    ("Bantamweight", "Gallo"), ("Flyweight", "Mosca"), ("Strawweight", "Paglia"),
]
ORGANIZZAZIONI = [
    ("Bellator", "Bellator"), ("PFL", "PFL"), ("Strikeforce", "Strikeforce"), ("WEC", "WEC"),
    ("PRIDE", "PRIDE"), ("Pride", "PRIDE"), ("ONE", "ONE Championship"), ("Cage Warriors", "Cage Warriors"),
    ("KSW", "KSW"), ("Rizin", "Rizin"), ("RIZIN", "Rizin"), ("M-1", "M-1"), ("Invicta", "Invicta"),
    ("LFA", "LFA"), ("Dana White's Contender Series", "Contender Series"), ("The Ultimate Fighter", "The Ultimate Fighter"),
]
FAMOSI = [
    "Jon Jones", "Khabib Nurmagomedov", "Conor McGregor", "Anderson Silva", "Georges St-Pierre", "Israel Adesanya",
    "Alex Pereira", "Islam Makhachev", "Max Holloway", "Charles Oliveira", "Dustin Poirier", "Daniel Cormier",
    "Stipe Miocic", "Amanda Nunes", "Valentina Shevchenko", "Donald Cerrone", "José Aldo", "Francis Ngannou",
    "Kamaru Usman", "Justin Gaethje", "Ilia Topuria", "Nate Diaz", "Tony Ferguson", "B.J. Penn", "BJ Penn",
    "Chuck Liddell", "Demetrious Johnson", "Cain Velasquez", "Robbie Lawler", "Rose Namajunas", "Tom Aspinall",
    "Sean O'Malley", "Merab Dvalishvili", "Alexander Volkanovski", "Glover Teixeira", "Michael Bisping",
    "Frankie Edgar", "Dan Henderson", "Rafael dos Santos", "Rafael dos Anjos", "Derrick Lewis", "Jiří Procházka",
    "Leon Edwards", "Belal Muhammad", "Zhang Weili", "Henry Cejudo", "Dominick Cruz", "Urijah Faber", "Vitor Belfort",
]


# Quanto e' conosciuta una condizione (3 = la sanno tutti, 1 = per esperti):
# la griglia del giorno usa solo 2 e 3, come Tiki Taka Toe usa le squadre famose.
NOTE_3 = {"Stati Uniti", "Brasile", "Russia", "Regno Unito", "Canada", "Messico", "Irlanda", "Australia",
          "Campione UFC", "Ha combattuto per un titolo UFC", "Ha combattuto in Bellator", "Ha combattuto in PFL",
          "Ha combattuto in PRIDE", "Ha combattuto in Strikeforce", "Ha combattuto in WEC",
          "Ha partecipato a The Ultimate Fighter", "Ha combattuto in Brasile", "Ha combattuto nel Regno Unito",
          "Ha combattuto in Canada", "Ha combattuto negli Emirati (Abu Dhabi)", "Ha combattuto in Australia",
          "Bonus Fight of the Night", "Bonus Performance of the Night", "In UFC prima del 2010",
          "Debutto UFC dal 2020 in poi", "10+ vittorie per KO", "7+ vittorie per sottomissione",
          "25+ vittorie in carriera", "Mancino (guardia southpaw)"}
NOTE_1 = {"Ha combattuto in LFA", "Ha combattuto in Invicta", "Ha combattuto in M-1", "Ha combattuto in Rizin",
          "Ha combattuto a Singapore", "Ha combattuto in Polonia", "Ha combattuto in Svezia",
          "Ha combattuto in Nuova Zelanda", "Ha combattuto in Arabia Saudita", "Ha combattuto in Corea del Sud",
          "Ha combattuto nei Paesi Bassi", "Ha combattuto in Francia", "Paesi Bassi", "Svezia", "Corea del Sud",
          "Cina", "Francia", "Base di wrestling", "Mai sottomesso (15+ incontri)", "10+ sconfitte in carriera"}


def _notorieta(famiglia, testo):
    if famiglia in ("divisione",) or testo in NOTE_3:
        return 3
    if testo in NOTE_1:
        return 1
    return 2


def _norm(t):
    t = unicodedata.normalize("NFKD", t or "").encode("ascii", "ignore").decode()
    return re.sub(r"[^a-z0-9]", "", t.lower())


def _data(s):
    try:
        return datetime.strptime(re.sub(r"\s+", " ", str(s)).strip(), "%B %d, %Y")
    except ValueError:
        return None


def _paesi(ib):
    paesi = set()
    for parola in re.findall(r"[A-Z][a-z]+", ib.get("Nationality") or ""):
        if parola in NAZIONALITA:
            paesi.add(NAZIONALITA[parola])
    if not paesi:
        nato = re.sub(r"\[.*?\]|\(.*?\)", "", ib.get("Born") or "").strip()
        parti = [p.strip() for p in nato.split(",") if p.strip()]
        if len(parti) >= 2:
            ultimo = parti[-1]
            if ultimo in ("Soviet Union", "USSR", "SFR Yugoslavia", "FR Yugoslavia", "Yugoslavia", "Czechoslovakia"):
                # nato in URSS/Jugoslavia: conta la repubblica ("Russian SFSR", "Georgian SSR")
                for parola in re.findall(r"[A-Z][a-z]+", " ".join(parti[-3:-1])):
                    if parola in NAZIONALITA:
                        paesi.add(NAZIONALITA[parola])
                        break
            else:
                nome = _PAESI_IT.get(ultimo, (None, None))[0]
                if nome and "/" not in nome:
                    paesi.add(nome)
    return paesi


def _intero(v):
    m = re.match(r"\s*(\d+)", str(v or ""))
    return int(m.group(1)) if m else None


def genera():
    lottatori, incontri_ufc = [], []
    condizioni = defaultdict(set)  # (famiglia, testo, bandiera) -> ids
    famosi = {_norm(n): n.replace("BJ Penn", "B.J. Penn") for n in FAMOSI}
    visti = {}

    for path in sorted(LOTTATORI.glob("*.json")):
        scheda = json.loads(path.read_text(encoding="utf-8"))
        storico = scheda.get("storico") or []
        ufc = [x for x in storico if str(x.get("event", "")).startswith("UFC")]
        if not ufc or not scheda.get("nome"):
            continue
        ib = scheda.get("infobox") or {}
        foto = re.sub(r"\?.*$", "", ib.get("_immagine") or "")
        # prefisso comune tolto per risparmiare spazio: lo rimette il gioco
        foto = foto.replace(PREFISSO_FOTO, "") if foto.startswith(PREFISSO_FOTO) else ""
        nome = re.sub(r"\s*\(.*?\)\s*$", "", scheda["nome"]).strip()  # "Jon Hess (fighter)"
        if _norm(nome) in visti:
            # stessa persona con due schede (due link Wikipedia): si uniscono
            i = visti[_norm(nome)]
            incontri_ufc[i] = max(incontri_ufc[i], len(ufc))
            if foto and len(lottatori[i]) == 2:
                lottatori[i].append(foto)
        else:
            i = visti[_norm(nome)] = len(lottatori)
            lottatori.append([nome, path.stem] + ([foto] if foto else []))
            incontri_ufc.append(len(ufc))

        def metti(famiglia, testo, bandiera=None):
            condizioni[(famiglia, testo, bandiera)].add(i)

        for p in _paesi(ib):
            metti("paese", p, BANDIERE.get(p))

        divisione = ib.get("Division") or ""
        for inglese, italiano in DIVISIONI:
            if inglese in divisione:
                divisione = divisione.replace(inglese, "")  # "Light Heavyweight" non conta come "Heavyweight"
                metti("divisione", f"Pesi {italiano}")

        note = [str(x.get("notes") or "") for x in storico]
        titoli = [n for n in note if re.search(r"\bWon the\b[^.]*Championship", n)]
        if any("UFC" in n for n in titoli):
            metti("titolo", "Campione UFC")
        if any(re.search(r"\b(Bellator|PFL|WEC|Strikeforce|PRIDE|Pride|ONE|Rizin|RIZIN|KSW|Cage Warriors|M-1)\b", n) and "UFC" not in n for n in titoli):
            metti("titolo", "Campione Bellator, PFL, WEC, PRIDE, ONE o simili")
        if any(re.search(r"UFC[^.]*Championship", n) for n in (str(x.get("notes") or "") for x in ufc)):
            metti("titolo", "Ha combattuto per un titolo UFC")
        testo_note = " ".join(note)
        if "Performance of the Night" in testo_note:
            metti("bonus", "Bonus Performance of the Night")
        if "Fight of the Night" in testo_note:
            metti("bonus", "Bonus Fight of the Night")

        vittorie = [str(x.get("method") or "").lower() for x in storico if str(x.get("res.", "")).strip().lower() == "win"]
        sconfitte = [str(x.get("method") or "").lower() for x in storico if str(x.get("res.", "")).strip().lower() == "loss"]
        ko = sum(m.startswith(("ko", "tko")) for m in vittorie)
        sub = sum(m.startswith(("submission", "technical submission")) for m in vittorie)
        if ko >= 10:
            metti("numeri", "10+ vittorie per KO")
        if sub >= 7:
            metti("numeri", "7+ vittorie per sottomissione")
        if len(vittorie) >= 25:
            metti("numeri", "25+ vittorie in carriera")
        if len(sconfitte) >= 10:
            metti("numeri", "10+ sconfitte in carriera")
        if len(ufc) >= 20:
            metti("numeri", "20+ incontri in UFC")
        if any(m.startswith(("submission", "technical submission")) for m in sconfitte) is False and len(storico) >= 15:
            metti("numeri", "Mai sottomesso (15+ incontri)")

        if "southpaw" in (ib.get("Stance") or "").lower():
            metti("stile", "Mancino (guardia southpaw)")
        if re.search(r"black belt[^,;]*(brazilian )?jiu[- ]jitsu", (ib.get("Rank") or "").lower()):
            metti("stile", "Cintura nera di jiu-jitsu brasiliano")
        if ib.get("Wrestling") or re.search(r"wrestl", (ib.get("Rank") or "") + " " + (ib.get("Style") or ""), re.I):
            metti("stile", "Base di wrestling")

        eventi = " | ".join(str(x.get("event") or "") for x in storico)
        for chiave, nome in ORGANIZZAZIONI:
            if re.search(rf"(^|\| ){re.escape(chiave)}\b", eventi):
                metti("org", f"Ha combattuto in {nome}" if nome != "The Ultimate Fighter" else "Ha partecipato a The Ultimate Fighter")

        for x in storico:
            luogo = re.sub(r"\s+,", ",", str(x.get("location") or "")).split(",")[-1].strip()
            if luogo in LUOGHI:
                metti("luogo", f"Ha combattuto {LUOGHI[luogo]}")
            avversario = famosi.get(_norm(x.get("opponent")))
            if avversario and _norm(avversario) != _norm(scheda["nome"]):
                metti("avversario", f"Ha affrontato {avversario}")

        date_ufc = [d for d in (_data(x.get("date")) for x in ufc) if d]
        if date_ufc:
            if min(date_ufc).year < 2010:
                metti("epoca", "In UFC prima del 2010")
            if min(date_ufc).year >= 2020:
                metti("epoca", "Debutto UFC dal 2020 in poi")

    lista = []
    for (famiglia, testo, bandiera), membri in sorted(condizioni.items(), key=lambda kv: (kv[0][0], kv[0][1])):
        if len(membri) < MIN_MEMBRI:
            continue
        voce = {"id": _norm(famiglia + testo), "t": testo, "f": famiglia, "p": _notorieta(famiglia, testo), "m": sorted(membri)}
        if bandiera:
            lettere = [ord(c) - 0x1F1E6 for c in bandiera if 0 <= ord(c) - 0x1F1E6 < 26]
            if len(lettere) == 2:
                voce["b"] = "".join(chr(97 + n) for n in lettere)
        lista.append(voce)

    out = {"l": lottatori, "u": incontri_ufc, "c": lista, "g": griglie_del_giorno(lista)}
    (DOCS / "data" / "griglia.json").write_text(json.dumps(out, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    per_famiglia = defaultdict(int)
    for c in lista:
        per_famiglia[c["f"]] += 1
    print(f"Griglia: {len(lottatori)} lottatori, {len(lista)} condizioni {dict(per_famiglia)}")


ESCLUSIVE = {"paese", "epoca"}


def _crea_griglia(lista, rnd, minimo=4):
    """Stesse regole di creaGriglia in docs/js/griglia.js (modo facile)."""
    pesi = [[0, 0, 1, 4][c["p"]] for c in lista]
    insiemi = [set(c["m"]) for c in lista]
    for _ in range(20000):
        idx = []
        while len(idx) < 6:
            i = rnd.choices(range(len(lista)), weights=pesi)[0]
            if i not in idx:
                idx.append(i)
        righe, colonne = idx[:3], idx[3:]
        fam = lambda i: lista[i]["f"]
        if len({fam(i) for i in righe}) < 3 or len({fam(i) for i in colonne}) < 3:
            continue
        if any(fam(r) == fam(c) and fam(r) in ESCLUSIVE for r in righe for c in colonne):
            continue
        misure = [len(insiemi[r] & insiemi[c]) for r in righe for c in colonne]
        if min(misure) < minimo:
            continue
        if sum(m <= 12 for m in misure) > 3 or sum(m > 150 for m in misure) > 1:
            continue
        return [lista[i]["id"] for i in righe + colonne]
    return None


def griglie_del_giorno(lista, giorni_avanti=30, giorni_indietro=7):
    """Griglie del giorno fissate in anticipo: i dati cambiano ogni notte, la
    griglia di oggi no (ne' per chi gioca alle 8 ne' per chi gioca alle 23).
    Si conservano quelle gia' uscite, si aggiungono quelle mancanti."""
    import random
    from datetime import timedelta
    from zoneinfo import ZoneInfo

    try:
        vecchie = json.loads((DOCS / "data" / "griglia.json").read_text(encoding="utf-8")).get("g", {})
    except (OSError, ValueError):
        vecchie = {}
    ids = {c["id"] for c in lista}
    oggi = datetime.now(ZoneInfo("Europe/Rome")).date()  # la griglia cambia a mezzanotte italiana
    out = {}
    for d in range(-giorni_indietro, giorni_avanti + 1):
        giorno = (oggi + timedelta(days=d)).isoformat()
        g = vecchie.get(giorno)
        if g and all(x in ids for x in g):
            out[giorno] = g
        elif d >= 0:
            nuova = _crea_griglia(lista, random.Random(f"griglia-{giorno}"))
            if nuova:
                out[giorno] = nuova
    return out


if __name__ == "__main__":
    genera()
