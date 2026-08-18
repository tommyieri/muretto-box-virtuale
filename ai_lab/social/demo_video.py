#!/usr/bin/env python3
"""demo_video.py — il video che mostra IL SITO VERO mentre risponde.

PERCHE' NON E' UNA RICOSTRUZIONE. Si poteva ridisegnare l'interfaccia dentro
`tela.py` e animarla: sarebbe stato piu' facile da controllare e sarebbe stato un
falso — un'interfaccia che assomiglia al prodotto invece del prodotto. Qui si
apre murettobox.com in un browser vero, si clicca davvero, e si registra quello
che risponde. Se un giorno il sito cambia, cambia il video: e' la stessa regola
del resto del progetto.

COSA REGISTRA. La hero della home E' gia' la domanda del muretto: «box ora o fra
tre giri?», con la risposta del motore. Il video preme uno dei due bottoni e
mostra dove rientri. Non serve inventare una sceneggiatura: il prodotto ne ha
gia' una.

IL PUNTATORE. Playwright non disegna il cursore nel video, quindi i clic
sembrerebbero cose che succedono da sole. Se ne inietta uno finto — un pallino
rosso che si muove fino al bersaglio e pulsa al clic — altrimenti chi guarda non
capisce che qualcuno sta *usando* qualcosa.

    python3 -m ai_lab.social.demo_video                 # in demo_video/
    python3 -m ai_lab.social.demo_video --dove /tmp/x   # altrove
"""
from __future__ import annotations
import os
import glob
import shutil
import argparse
import subprocess

QUI = os.path.dirname(os.path.abspath(__file__))
REPO = os.path.abspath(os.path.join(QUI, "..", ".."))
SITO = "https://murettobox.com/"
LARGO, ALTO = 1080, 1920

# LA VISTA E' QUELLA DEL TELEFONO, e non e' un dettaglio. Aprendo il sito in una
# finestra larga 1080 il layout che risponde e' quello DESKTOP: il video mostrava
# la home intera rimpicciolita dentro un fotogramma verticale, illeggibile. Si
# apre invece a 540x960 — sotto le soglie del foglio di stile, quindi impaginazione
# mobile — e si registra a 1080x1920. E' anche come lo useranno davvero: chi arriva
# da Instagram apre il sito col telefono.
VISTA_L, VISTA_A = 540, 960

# Il puntatore finto: sta sopra tutto, non intercetta i clic veri, e ha una
# transizione lenta abbastanza da leggersi in un video da sei secondi.
CURSORE = """
(() => {
  const p = document.createElement('div');
  p.id = '__mur_cur';
  p.style.cssText = `position:fixed;left:0;top:0;width:34px;height:34px;border-radius:50%;
    background:rgba(255,30,60,.30);border:3px solid #FF1E3C;z-index:2147483647;
    pointer-events:none;transform:translate(-50%,-50%) scale(1);
    transition:left .55s cubic-bezier(.4,0,.2,1),top .55s cubic-bezier(.4,0,.2,1),
               transform .18s ease;box-shadow:0 0 22px rgba(255,30,60,.55);opacity:0`;
  document.body.appendChild(p);
  window.__murCur = (x, y, giu) => {
    p.style.opacity = '1';
    if (x !== null) { p.style.left = x + 'px'; p.style.top = y + 'px'; }
    p.style.transform = 'translate(-50%,-50%) scale(' + (giu ? 0.62 : 1) + ')';
  };
})()
"""


def _muovi(pg, sel, giu=False):
    box = pg.query_selector(sel).bounding_box()
    x, y = box["x"] + box["width"] / 2, box["y"] + box["height"] / 2
    pg.evaluate(f"window.__murCur({x}, {y}, {str(giu).lower()})")
    return x, y


def registra(dove: str) -> str:
    from playwright.sync_api import sync_playwright
    os.makedirs(dove, exist_ok=True)
    grezzi = os.path.join(dove, "_grezzo")
    shutil.rmtree(grezzi, ignore_errors=True)

    with sync_playwright() as pw:
        b = pw.chromium.launch()
        ctx = b.new_context(viewport={"width": VISTA_L, "height": VISTA_A},
                            device_scale_factor=1,
                            is_mobile=True, has_touch=True,
                            record_video_dir=grezzi,
                            # SI REGISTRA ALLA MISURA DELLA VISTA, e si ingrandisce
                            # dopo con ffmpeg. Lasciando scalare Playwright (vista
                            # 540x960, registrazione 1080x1920) il contenuto finiva
                            # nella meta' alta del fotogramma con sotto una fascia
                            # nera: due scalature in fila, e nessuna delle due
                            # controllabile da qui.
                            record_video_size={"width": VISTA_L, "height": VISTA_A})
        pg = ctx.new_page()
        pg.goto(SITO, wait_until="networkidle", timeout=90000)
        # la hero si riempie dal motore: si aspetta il testo, non un tempo a caso
        pg.wait_for_selector("text=BOX ORA", timeout=30000)
        pg.wait_for_timeout(1800)
        pg.evaluate(CURSORE)

        # 1. si legge la domanda
        pg.wait_for_timeout(900)
        # 2. il puntatore va sulla prima scelta e clicca
        _muovi(pg, "text=BOX ORA")
        pg.wait_for_timeout(750)
        _muovi(pg, "text=BOX ORA", giu=True)
        pg.click("text=BOX ORA")
        pg.wait_for_timeout(160)
        _muovi(pg, "text=BOX ORA")
        pg.wait_for_timeout(2400)          # si legge il verdetto
        # 3. e adesso l'altra: e' il confronto che fa capire il prodotto
        _muovi(pg, "text=ASPETTA 3 GIRI")
        pg.wait_for_timeout(700)
        _muovi(pg, "text=ASPETTA 3 GIRI", giu=True)
        pg.click("text=ASPETTA 3 GIRI")
        pg.wait_for_timeout(160)
        _muovi(pg, "text=ASPETTA 3 GIRI")
        pg.wait_for_timeout(2800)

        ctx.close()
        b.close()

    webm = sorted(glob.glob(os.path.join(grezzi, "*.webm")))
    if not webm:
        raise SystemExit("[demo] playwright non ha prodotto nessun video")
    return webm[-1]


def in_mp4(webm: str, uscita: str) -> str:
    exe = shutil.which("ffmpeg")
    if not exe:
        raise SystemExit("[demo] manca ffmpeg:  brew install ffmpeg")
    subprocess.run([exe, "-y", "-i", webm,
                    # Instagram vuole dimensioni pari e yuv420p, o mostra un video nero
                    # lanczos: ingrandire 2x del testo piccolo col filtro
                    # predefinito lo impasta
                    "-vf", f"scale={LARGO}:{ALTO}:flags=lanczos,fps=30",
                    "-c:v", "libx264", "-preset", "medium", "-crf", "20",
                    "-pix_fmt", "yuv420p", "-movflags", "+faststart", uscita],
                   check=True, capture_output=True)
    return uscita


def costruisci(dove: str) -> str:
    webm = registra(dove)
    mp4 = in_mp4(webm, os.path.join(dove, "demo-prodotto.mp4"))
    shutil.rmtree(os.path.join(dove, "_grezzo"), ignore_errors=True)
    return mp4


if __name__ == "__main__":
    ap = argparse.ArgumentParser(description="registra il sito vero mentre risponde")
    ap.add_argument("--dove", default=os.path.join(QUI, "demo_video"))
    a = ap.parse_args()
    p = costruisci(a.dove)
    print("video:", p, f"({os.path.getsize(p) // 1024} KB)")
