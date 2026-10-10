# Tennis Oggi — prototipo

Sito statico (HTML, CSS e JavaScript semplici, nessun framework) per seguire il tennis in italiano:
partite di oggi, risultati, calendario tornei, classifiche ATP/WTA con scheda giocatore, notizie.
Stesso stile di MMA Oggi e GP Oggi (tema scuro/chiaro, Oswald + Inter), accento giallo-verde "pallina".

## Come aprirlo in locale
```
cd tennisoggi/docs
python3 -m http.server 8000
```
Poi apri http://localhost:8000 (non funziona aprendo i file con doppio clic: i dati si caricano via rete).

## Come rigenerare i dati
```
cd tennisoggi
python3 build_data.py
```
Scrive i file JSON in `docs/data/`. Fonti: ESPN (classifiche, partite, calendario, schede), Wikipedia (categoria e
superficie dei tornei), RSS di Ubitennis, Tennis Italiano, OA Sport, Gazzetta, Corriere dello Sport, Tuttosport
(solo titolo + link). Se una classifica non si scarica lo script si ferma senza toccare i dati vecchi.
Titoli di notizie che parlano di quote, pronostici o scommesse vengono scartati (divieto pubblicità gioco d'azzardo).
Per sviluppare senza riscaricare tutto: `TENNIS_CACHE=/tmp/cache python3 build_data.py`.

Altri script:
- `python3 bump_versione.py` — cambia il numero `?v=` di JS e CSS (da lanciare prima di ogni pubblicazione).
- `python3 build_sitemap.py` — scrive `sitemap.xml` e `robots.txt` (usa `docs/CNAME` se esiste).
- `python3 controlla_pagine.py` — screenshot a 420px in tema scuro e chiaro, segnala scorrimenti orizzontali ed errori.
- `python3 make_logo.py Oswald-Bold.ttf` — rigenera logo SVG e PNG (serve `pip install fonttools playwright`).

## Come spostare tutto nel repo gr-build/tennisoggi
1. Crea a mano il repo vuoto `gr-build/tennisoggi` su GitHub.
2. Copia il **contenuto** della cartella `tennisoggi/` (non la cartella stessa) nella radice del nuovo repo:
   `docs/`, `build_data.py`, `bump_versione.py`, `build_sitemap.py`, `controlla_pagine.py`, `make_logo.py`, `LEGGIMI.md`, `.gitignore`.
3. `git add . && git commit -m "Prima versione" && git push`.
4. Su GitHub: Settings → Pages → Branch `main`, cartella `/docs`.
I percorsi sono tutti relativi e il codice non cita MMA Oggi, quindi non serve cambiare nulla.

## Come collegare un dominio
1. Scegli il dominio (vedi sotto) e crea `docs/CNAME` con una sola riga, per esempio `tennisoggi.net`.
2. Dal registrar punta il DNS a GitHub Pages (record A/CNAME come da guida GitHub) e attiva "Enforce HTTPS".
3. Sostituisci l'indirizzo provvisorio `https://gr-build.github.io/tennisoggi` nelle pagine HTML (tag canonical, og:url, og:image):
   `grep -rl "gr-build.github.io/tennisoggi" docs | xargs sed -i 's#https://gr-build.github.io/tennisoggi#https://TUODOMINIO#g'`
   poi `python3 build_sitemap.py`.

**Nome e dominio:** [Certo] tennisoggi.com e tennisoggi.it sono di altri (reindirizzano a tennis.it): non usarli.
[Probabile] tennisoggi.net e tennisoggi.org sono liberi, ma non l'ho verificato col registrar. Non ho comprato nulla.

## Cosa resta da fare
- Aggiornamento automatico con GitHub Actions (volutamente non creato ora): lancia `build_data.py` più volte al giorno e pubblica.
- Dominio vero e statistiche visite (nessuno script di analytics inserito).
- Pagina Seguici: i canali social non esistono ancora; mancano anche un contatto per segnalare errori e una pagina privacy.
- Calendario: i tornei WTA 125 e ITF non hanno la categoria (Wikipedia non li elenca) e stanno sotto "Altri tornei". Alcuni tornei ATP
  (Finals e qualcuno con nome diverso su Wikipedia) possono restare senza categoria.
- Risultati e schede giocatore coprono le ultime 4 settimane di partite (finestra scaricata da ESPN), solo singolare e tabellone principale.
- Luogo di nascita dei giocatori: arriva da ESPN in inglese ("Florence, Italy"), non tradotto.
- Mancano: classifica oltre il 100º posto, doppi, testa a testa, tabellone (bracket), orari in diretta (la pagina non si aggiorna da sola).

## Limiti verificati e non
- Verificato: pagine a 420px, scuro e chiaro, senza scorrimento orizzontale e senza errori in console; contrasti calcolati (tutti sopra 4,5:1).
- Non verificato: apertura su telefoni veri, Safari, lettore di schermo, comportamento con dati ESPN incompleti durante un torneo in corso.
