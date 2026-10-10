"""Controllo visivo: apre ogni pagina a 420px in tema scuro e chiaro, salva gli screenshot e segnala
scorrimento orizzontale ed errori in console. Uso: python3 controlla_pagine.py [cartella_screenshot]"""
import subprocess, sys, time
from pathlib import Path
from playwright.sync_api import sync_playwright

OUT = Path(sys.argv[1] if len(sys.argv) > 1 else "/tmp/shots"); OUT.mkdir(parents=True, exist_ok=True)
PAGINE = ["index.html", "calendario.html", "torneo.html?tour=atp&id=315", "classifiche.html", "giocatore.html?id=3623",
          "notizie.html", "chi-siamo.html", "seguici.html"]
srv = subprocess.Popen([sys.executable, "-m", "http.server", "8765", "-d", str(Path(__file__).parent / "docs")],
                       stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
time.sleep(1)
problemi = 0
try:
    with sync_playwright() as p:
        b = p.chromium.launch(executable_path="/opt/pw-browsers/chromium")
        for tema in ("dark", "light"):
            ctx = b.new_context(viewport={"width": 420, "height": 900}, device_scale_factor=1, color_scheme=tema)
            ctx.add_init_script(f"try{{localStorage.setItem('tema','{tema}')}}catch(e){{}}")
            for pag in PAGINE:
                pg = ctx.new_page()
                errori = []
                pg.on("console", lambda m: errori.append(m.text) if m.type == "error" and "fonts.g" not in m.text else None)
                pg.on("pageerror", lambda e: errori.append(str(e)))
                pg.goto(f"http://localhost:8765/{pag}", wait_until="networkidle")
                pg.wait_for_timeout(300)
                # overflow-x: clip nasconde lo scorrimento: misuro davvero dove finiscono gli elementi
                larg = pg.evaluate("""Math.ceil(Math.max(...[...document.querySelectorAll('body *')].filter(e => e.offsetParent !== null || e.tagName==='svg')
                    .filter(e => !e.closest('.menu-mobile:not(.aperto)')).map(e => e.getBoundingClientRect().right)))""")
                nome = pag.split("?")[0].replace(".html", "") + f"-{tema}.png"
                pg.screenshot(path=str(OUT / nome), full_page=True)
                stato = "OK" if larg <= 420 and not errori else "PROBLEMA"
                if stato != "OK": problemi += 1
                print(f"{stato:9} {tema:5} {pag:32} scrollWidth={larg} {errori[:2] if errori else ''}")
                pg.close()
            ctx.close()
        b.close()
finally:
    srv.terminate()
sys.exit(1 if problemi else 0)
