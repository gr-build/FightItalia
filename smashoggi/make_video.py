"""Video verticali 1080x1920 con voce e sottotitoli, stesso sistema a griglia delle copertine.
Uso:  python3 make_video.py [cartella_uscita]
Serve: ffmpeg, playwright, gTTS (prova) o un'altra voce (vedi parla()).
Scene: copertina + frasi con sottotitoli (le parole tra *asterischi* vanno in lime) + schermata finale.
La barra di avanzamento in alto è lime. Solo fatti: mai quote né pronostici."""
import subprocess, sys, tempfile
from pathlib import Path
import make_copertine as mc
from make_copertine import U, M, W, LIME, BIANCO, SCURO, SUPERFICI, e, foto, dims, telaio, linee, disegna
import re

ALT = 1920


def parla(testo, dest):
    """Genera la voce. Con AZURE_SPEECH_KEY e AZURE_SPEECH_REGION usa Azure Speech (voci neurali italiane);
    altrimenti ripiega su gTTS (voce di Google Traduttore, gratuita, di qualità discreta).
    AZURE_VOICE sceglie la voce (di base it-IT-IsabellaNeural; altre: it-IT-ElsaNeural, it-IT-DiegoNeural).
    La chiave va solo nelle variabili d'ambiente (o nei segreti di GitHub), mai nei file."""
    import os
    chiave, regione = os.environ.get("AZURE_SPEECH_KEY"), os.environ.get("AZURE_SPEECH_REGION")
    if chiave and regione:
        import urllib.request
        voce = os.environ.get("AZURE_VOICE", "it-IT-IsabellaNeural")
        ssml = (f"<speak version='1.0' xml:lang='it-IT'><voice name='{voce}'>"
                f"<prosody rate='+5%'>{e(testo)}</prosody></voice></speak>").encode("utf-8")
        rich = urllib.request.Request(
            f"https://{regione}.tts.speech.microsoft.com/cognitiveservices/v1", data=ssml, method="POST",
            headers={"Ocp-Apim-Subscription-Key": chiave, "Content-Type": "application/ssml+xml",
                     "X-Microsoft-OutputFormat": "audio-24khz-96kbitrate-mono-mp3", "User-Agent": "smashoggi"})
        Path(dest).write_bytes(urllib.request.urlopen(rich, timeout=60).read())
        return
    from gtts import gTTS
    gTTS(testo, lang="it").save(str(dest))


def evidenzia(t):
    return re.sub(r"\*(.+?)\*", lambda m: f'<span style="color:{LIME}">{e(m.group(1))}</span>', e(t).replace("&#x27;", "'")) if "*" in t else e(t)


def scena_sottotitolo(pid, testo, sup, tag="Ultim'ora"):
    pw, ph, y = dims(ALT)
    fw = int(pw * 1.3)
    sott = (f'<div style="position:absolute;left:{M}px;right:{M}px;top:{y}px;height:{ALT-M-U*5-U*3-y}px;display:flex;align-items:center;'
            f'font-size:{U*9}px;line-height:1.12;text-transform:uppercase"><div>{evidenzia(testo)}</div></div>')
    cont = f'<div class=pannello style="height:{ph}px">{linee(pw, ph)}<img class=f src="{foto(pid)}" style="width:{fw}px"></div>{sott}'
    return telaio(ALT, SUPERFICI[sup], cont, tag)


def scena_finale(testo1, testo2):
    logo = mc.b64(mc.QUI / "docs/img/logo.svg", "image/svg+xml")
    cont = (f'<div style="position:absolute;left:{M}px;right:{M}px;top:{M+72+36}px;height:{ALT-2*M-72-36-U*8}px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:{U*4}px;text-align:center">'
            f'<img src="{logo}" style="width:{W-2*M-U*10}px"><div style="font-size:{U*8}px;text-transform:uppercase;line-height:1.1">{evidenzia(testo1)}</div>'
            f'<div class="b l" style="font-size:{U*5}px;height:{U*8}px">{e(testo2)}</div></div>')
    return telaio(ALT, SUPERFICI["indoor"], cont, "Smash Oggi", credito=False)


def durata(f):
    return float(subprocess.check_output(["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", str(f)]).decode())


def video(scene, uscita, nome):
    """scene = [(html, testo_parlato)]; il parlato può essere '' per una scena muta di 2 secondi."""
    uscita.mkdir(parents=True, exist_ok=True)
    tmp = Path(tempfile.mkdtemp())
    lavori, voci, durate = {}, [], []
    for i, (h, parlato) in enumerate(scene):
        lavori[f"s{i}"] = (h, ALT)
        a = tmp / f"v{i}.mp3"
        if parlato: parla(parlato, a)
        d = (durata(a) if parlato else 2.0) + 0.35
        voci.append(a if parlato else None); durate.append(d)
    disegna(lavori, tmp)
    elenco = "".join(f"file '{tmp}/s{i}.png'\nduration {d:.3f}\n" for i, d in enumerate(durate)) + f"file '{tmp}/s{len(durate)-1}.png'\n"
    (tmp / "img.txt").write_text(elenco)
    # audio: ogni voce seguita da silenzio fino alla durata della scena
    filtri, ins = [], []
    cmd = ["ffmpeg", "-v", "error", "-y", "-f", "concat", "-safe", "0", "-i", str(tmp / "img.txt")]
    k = 1
    for i, v in enumerate(voci):
        if v: cmd += ["-i", str(v)]; filtri.append(f"[{k}:a]apad=whole_dur={durate[i]:.3f},aresample=44100[a{i}]"); k += 1
        else: filtri.append(f"anullsrc=r=44100:cl=mono,atrim=0:{durate[i]:.3f}[a{i}]")
        ins.append(f"[a{i}]")
    tot = sum(durate)
    filtri.append("".join(ins) + f"concat=n={len(ins)}:v=0:a=1[aud]")
    filtri.append(f"[0:v]drawbox=x=0:y=0:w='iw*t/{tot:.3f}':h=12:color=0xc5f535:t=fill,format=yuv420p[vid]")
    out = uscita / f"{nome}.mp4"
    cmd += ["-filter_complex", ";".join(filtri), "-map", "[vid]", "-map", "[aud]", "-r", "30", "-c:v", "libx264", "-preset", "fast", "-crf", "20", "-c:a", "aac", "-b:a", "160k", "-t", f"{tot:.3f}", str(out)]
    subprocess.run(cmd, check=True)
    return out, tot


if __name__ == "__main__":
    out = Path(sys.argv[1]) if len(sys.argv) > 1 else mc.QUI / "copertine"
    pid, sup = "3730", "cemento"
    frasi = [
        ("Ultim'ora dal *Wuhan Open*.", "Ultima ora dal Wuhan Open."),
        ("Iga *Swiatek* batte Magdalena Frech.", "Iga Swiatek batte Magdalena Frech."),
        ("Il punteggio finale: *6-2, 6-1*.", "Il punteggio finale: sei due, sei uno."),
        ("Successo netto nel *secondo turno*.", "Successo netto nel secondo turno."),
    ]
    scene = [(mc.pagina_foto(pid, [("Vince", "l"), ("Swiatek!", "l"), ("6-2 6-1", "w")], "Secondo turno · Wuhan Open", "Ultim'ora"), "Vince Swiatek!")]
    scene += [(scena_sottotitolo(pid, t, sup), p) for t, p in frasi]
    scene += [(scena_finale("Tutto il *tennis* di oggi", "Segui Smash Oggi"), "Tutto il tennis di oggi. Segui Smash Oggi.")]
    f, d = video(scene, out, "demo-vince-swiatek")
    print("fatto:", f, f"{d:.1f}s")
