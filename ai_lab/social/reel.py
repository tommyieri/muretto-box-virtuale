#!/usr/bin/env python3
"""reel.py — il video verticale: la classifica che si riordina, giro per giro.

PERCHE' IL REEL CONTA PIU' DEL POST, per noi in particolare. Un post nel flusso
viene mostrato soprattutto a chi ti segue gia'. Il reel no: viene spinto a chi
NON ti segue. Con una pagina da quindicimila iscritti che non hanno mai visto un
contenuto, il post nel flusso atterra su un pubblico addormentato e l'algoritmo
legge quel silenzio come «roba scadente». Il reel scavalca il problema: e' l'unico
formato la cui distribuzione non dipende da quanto sono vivi i tuoi iscritti.

L'ANIMAZIONE NON E' UN'INTERPOLAZIONE. Fra il giro prima della sosta e otto giri
dopo, ogni fotogramma legge la classifica VERA di quel giro (`posizioni_al_giro`)
e le posizioni scorrono da una all'altra. Non e' un effetto grafico: e' il
sorpasso come e' successo. Sarebbe stato piu' facile interpolare fra due
istantanee, e sarebbe stato un disegno animato.

LA CODIFICA VUOLE FFMPEG. Pillow disegna i fotogrammi, ma non fa un MP4 e
Instagram non prende altro. Se manca, `codifica()` lo dice e spiega come
installarlo, invece di fallire con un errore oscuro.
"""
from __future__ import annotations
import os
import shutil
import subprocess

from . import marca as M
from . import fatti as F
from .tela import Tela
from .formati import base

FPS = 30
LARGA, ALTA = M.FORMATI["storia"]

# LA ZONA SICURA. Su un reel la tela e' 1080x1920 ma non si vede tutta:
# Instagram ci stampa sopra la sua interfaccia — in basso nome, didascalia e
# pulsanti, a destra la colonna dei tasti. Cio' che finisce li' sotto e' come se
# non fosse stato disegnato. La prima versione metteva il verdetto a y=1620:
# esattamente sotto la didascalia, cioe' il punto piu' importante del video
# nascosto dall'unica cosa che non possiamo spostare.
SICURO_ALTO = 210
SICURO_BASSO = ALTA - 430      # 1490: sotto questa riga non va niente che conti
SICURO_DESTRA = LARGA - 170    # la colonna dei tasti a destra


def ffmpeg() -> str | None:
    return shutil.which("ffmpeg")


def _ease(t: float) -> float:
    """Partenza e arrivo morbidi. Un movimento lineare, su una classifica, sembra
    un foglio di calcolo che si ordina; con l'attenuazione sembra una gara."""
    return t * t * (3 - 2 * t)


def _y_riga(indice: float, y0: float, passo: float) -> float:
    return y0 + indice * passo


def fotogrammi(fatto, cartella: str, secondi: float = 6.0) -> list:
    """Disegna tutti i PNG del reel e torna i percorsi, in ordine."""
    d = fatto.dati
    sigla, giro = d["sigla"], d["giro"]
    gara = fatto.gara
    g = F.carica(f"{gara}.json")
    if not g:
        raise SystemExit(f"[reel] dati di gara mancanti per {gara}")

    da_giro, a_giro = giro - 1, giro + 8
    tappe = [(n, F.posizioni_al_giro(g, n)) for n in range(da_giro, a_giro + 1)]
    tappe = [(n, p) for n, p in tappe if p]
    if len(tappe) < 2:
        raise SystemExit("[reel] classifiche insufficienti per animare")

    # chi mostrare: le posizioni toccate dal nostro pilota, piu' contesto
    lo = min(p.get(sigla, 99) for _, p in tappe)
    hi = max(p.get(sigla, 0) for _, p in tappe)
    primo, ultimo = max(1, lo - 2), hi + 2
    piloti = sorted({s for _, p in tappe for s, pos in p.items() if primo <= pos <= ultimo})
    colori = {s: F.colore(t) for s, t in d.get("team_di", {}).items()}

    os.makedirs(cartella, exist_ok=True)
    n_tot = int(secondi * FPS)
    # tre tempi: fermo all'inizio, il riordino, fermo alla fine col verdetto
    fermo_iniziale, fermo_finale = int(FPS * 1.1), int(FPS * 1.6)
    mobili = max(1, n_tot - fermo_iniziale - fermo_finale)

    y0, passo = 636, 96
    alt_riga = 84
    # la targa del verdetto entra qui: le righe devono FINIRE prima, non
    # semplicemente cominciare prima, o l'ultima resta tagliata a meta' sotto.
    y_verdetto = SICURO_BASSO - 190
    fondo_righe = y_verdetto - alt_riga - 12
    percorsi = []
    for k in range(n_tot):
        if k < fermo_iniziale:
            u = 0.0
        elif k >= fermo_iniziale + mobili:
            u = 1.0
        else:
            u = _ease((k - fermo_iniziale) / mobili)

        # dove siamo lungo la successione dei giri
        pos_f = u * (len(tappe) - 1)
        i0 = min(int(pos_f), len(tappe) - 2)
        fra = pos_f - i0
        giro_ora = tappe[i0][0] if fra < .5 else tappe[i0 + 1][0]

        t = Tela("storia", s=1)
        t.ground(alone="rosso")
        t.barra_alto("rosso")
        t.marchio(y=140)   # sotto la barra di stato del telefono

        t.occhiello(252, f"{d.get('circuito') or gara}", colore="rosso")
        t.testo(M.MARGINE, 306, f"{sigla} SI FERMA", "disp", 112, 700, "testo", tracking=.005)
        t.testo(M.MARGINE, 416, f"AL GIRO {giro}", "disp", 112, 700, "rosso", tracking=.005)

        # il contagiri: e' il segnale che il tempo scorre davvero
        t.testo(LARGA - M.MARGINE, 312, "GIRO", "mono", 26, 400, "fioco",
                tracking=.16, ancora="ra")
        t.testo(LARGA - M.MARGINE, 344, str(giro_ora), "mono", 92, 700, "ciano", ancora="ra")

        for s in piloti:
            pa = tappe[i0][1].get(s)
            pb = tappe[i0 + 1][1].get(s)
            if pa is None or pb is None:
                continue
            y = _y_riga((pa - primo) + (pb - pa) * fra, y0, passo)
            if not (y0 - passo < y < fondo_righe):
                continue
            t.riga_torre(M.MARGINE, y, M.LARGA, round(pa + (pb - pa) * fra), s,
                         colori.get(s, "#8A8F98"), None, h=alt_riga,
                         evidenzia=(s == sigla), dim=44)

        # il verdetto entra solo alla fine, quando il movimento e' finito
        if u >= 1.0:
            n = abs(d["delta"])
            su = d["delta"] > 0
            col = "verde" if su else "rosso"
            parola = ("guadagnata" if n == 1 else "guadagnate") if su else \
                     ("persa" if n == 1 else "perse")
            yv = y_verdetto
            t.piastra(M.MARGINE, yv, M.LARGA, 120, r=14, riemp="carbonio", bordo=col)
            base.freccia_su_giu(t, M.MARGINE + 28, yv + 44, 36, 1 if su else -1, col)
            t.testo(M.MARGINE + 84, yv + 34, f"{n} posizion{'e' if n == 1 else 'i'} {parola}",
                    "disp", 54, 700, col, tracking=.02, maiuscolo=True)

        # il dominio resta DENTRO la zona sicura, non in fondo alla tela
        t.testo(M.MARGINE, SICURO_BASSO - 44, M.DOMINIO, "disp", 40, 700, "testo",
                tracking=.10, ancora="la")

        p = os.path.join(cartella, f"f{k:04d}.png")
        t.salva(p)
        percorsi.append(p)
    return percorsi


def codifica(cartella_fotogrammi: str, uscita: str) -> str:
    exe = ffmpeg()
    if not exe:
        raise SystemExit(
            "[reel] i fotogrammi ci sono ma manca ffmpeg, e Instagram accetta solo MP4.\n"
            "  Installalo una volta sola:\n\n"
            "      brew install ffmpeg\n\n"
            "  poi rilancia questo comando: i PNG sono gia' pronti in\n"
            f"      {cartella_fotogrammi}")
    cmd = [exe, "-y", "-framerate", str(FPS),
           "-i", os.path.join(cartella_fotogrammi, "f%04d.png"),
           # yuv420p + dimensioni pari: senza, molti lettori mostrano un video nero
           "-c:v", "libx264", "-preset", "medium", "-crf", "20",
           "-pix_fmt", "yuv420p", "-movflags", "+faststart", uscita]
    subprocess.run(cmd, check=True, capture_output=True)
    return uscita


def costruisci(fatto, cartella: str, secondi: float = 6.0) -> dict:
    tmp = os.path.join(cartella, "_fotogrammi")
    fot = fotogrammi(fatto, tmp, secondi)
    uscita = os.path.join(cartella, "reel.mp4")
    try:
        codifica(tmp, uscita)
    except SystemExit as e:
        print(e)
        return {"fotogrammi": fot, "video": None}
    shutil.rmtree(tmp, ignore_errors=True)
    return {"fotogrammi": len(fot), "video": uscita}


if __name__ == "__main__":
    import sys
    sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..")))
    from ai_lab.social import fatti as FF
    gara = sys.argv[1] if len(sys.argv) > 1 else "Belgio"
    dove = sys.argv[2] if len(sys.argv) > 2 else "/tmp/reel"
    ff = [x for x in FF.raccogli(gara) if x.tipo == "sosta"]
    if not ff:
        raise SystemExit(f"nessun fatto 'sosta' per {gara}")
    print(costruisci(ff[0], dove))
