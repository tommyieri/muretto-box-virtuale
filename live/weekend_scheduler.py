#!/usr/bin/env python3
"""weekend_scheduler.py — registra da solo tutte le sessioni del prossimo GP.

    caffeinate -ims python3 weekend_scheduler.py        (tiene sveglio il Mac)

PERCHE' ESISTE. record_session.py registra UNA sessione e va avviato a mano. In un
weekend le sessioni sono cinque, a ore diverse su tre giorni: nessuno sta al Mac per
tutte. Questo le programma dal calendario e le avvia da solo.

LA LEZIONE DEL TEST (24/07/2026, 2h prima di FP1). Il feed SignalR si CONNETTE ma e'
MUTO fuori sessione: manda dati solo vicino all'orario. Quindi non basta "avvia e
aspetta" con un timeout lungo — se il server chiude la connessione inattiva, il
registratore esce credendo "niente dati". La difesa e' RITENTARE DENTRO UNA FINESTRA:
si riparte ~20 min prima e si rilancia il registratore ogni volta che esce, finche' lo
stream non arriva; a sessione finita la finestra si chiude e si passa alla prossima.

NON tocca il kernel ne' il sito. Scrive solo file grezzi in data/live_raw/, come
record_session a mano. Il Mac DEVE restare acceso, collegato e online.
"""
import json
import subprocess
import sys
import time
from datetime import datetime, timezone, timedelta
from pathlib import Path

QUI = Path(__file__).resolve().parent
REPO = QUI.parent
CALENDARIO = REPO / "demo" / "data" / "calendario_2026.json"
RECORD = QUI / "record_session.py"
# l'archivio vive nel checkout principale (dove sono le registrazioni gia' fatte)
OUT_DIR = Path("/Users/tommi/muretto/data/live_raw")
LOG = OUT_DIR / "weekend_scheduler.log"

PRE_MIN = 20        # si comincia N minuti prima dell'orario di sessione
FINESTRA_MIN = 110  # si tiene aperta la finestra N minuti dall'orario (sessione ~1h + margine)
TIMEOUT = 600       # record_session esce dopo N s di silenzio; poi la finestra lo rilancia
NOMI = {"fp1": "FP1", "fp2": "FP2", "fp3": "FP3",
        "sprint_quali": "SprintQuali", "sprint": "Sprint",
        "qualifiche": "Quali", "gara": "GARA"}


def log(msg):
    riga = f"{datetime.now(timezone.utc):%Y-%m-%d %H:%M:%S}Z  {msg}"
    print(riga, flush=True)
    try:
        with open(LOG, "a") as f:
            f.write(riga + "\n")
    except Exception:
        pass


def sessioni_future():
    """(label, inizio_utc, nome_gp) delle sessioni ancora da venire del SOLO weekend in
    corso — cioe' il GP che contiene la prossima sessione. NON tutta la stagione: senza
    questo limite lo schedulatore resterebbe vivo per mesi."""
    cal = json.loads(CALENDARIO.read_text())
    ora = datetime.now(timezone.utc)
    per_gp = []   # (prima_sessione_futura, gara)
    for g in cal.get("gare", []):
        future = []
        for k, s in (g.get("sessioni") or {}).items():
            data, ora_utc = s.get("data"), s.get("ora_utc")
            if not data or not ora_utc:
                continue
            try:
                inizio = datetime.fromisoformat(f"{data}T{ora_utc}:00+00:00")
            except ValueError:
                continue
            if inizio + timedelta(minutes=FINESTRA_MIN) > ora:
                future.append((NOMI.get(k, k), inizio, g.get("nome", "")))
        if future:
            future.sort(key=lambda x: x[1])
            per_gp.append((future[0][1], future))
    if not per_gp:
        return []
    per_gp.sort(key=lambda x: x[0])          # il GP con la sessione futura piu' vicina
    return per_gp[0][1]                        # solo le sue sessioni


def dormi_fino(quando, etichetta):
    """Attesa a passi (cosi' il log mostra che e' vivo, e regge un cambio d'ora)."""
    while True:
        manca = (quando - datetime.now(timezone.utc)).total_seconds()
        if manca <= 0:
            return
        if manca > 900:
            log(f"  attendo {etichetta}: mancano {manca/3600:.1f} h")
            time.sleep(600)
        else:
            time.sleep(min(manca, 30))


def registra_sessione(label, inizio, gp):
    apre = inizio - timedelta(minutes=PRE_MIN)
    chiude = inizio + timedelta(minutes=FINESTRA_MIN)
    log(f"== {label} ({gp}) alle {inizio:%Y-%m-%d %H:%M}Z — finestra {apre:%H:%M}–{chiude:%H:%M}Z ==")
    dormi_fino(apre, f"{label}")
    tentativo = 0
    while datetime.now(timezone.utc) < chiude:
        tentativo += 1
        ts = datetime.now(timezone.utc).strftime("%Y-%m-%d_%H-%M-%S")
        out = OUT_DIR / f"{label}_{ts}.txt"
        log(f"  {label}: tentativo {tentativo} -> {out.name} (timeout {TIMEOUT}s)")
        t0 = time.time()
        try:
            subprocess.run([sys.executable, str(RECORD),
                            "--out", str(out), "--timeout", str(TIMEOUT)],
                           cwd=str(QUI), check=False)
        except Exception as e:
            log(f"  {label}: errore nel registratore: {e!r}")
            time.sleep(10)
            continue
        durata = time.time() - t0
        # file prodotti (record_session aggiunge .par02, .parte... per riconnessione)
        prodotti = sorted(OUT_DIR.glob(f"{out.stem}*"))
        peso = sum(p.stat().st_size for p in prodotti if p.exists())
        log(f"  {label}: uscito dopo {durata:.0f}s, {len(prodotti)} file, {peso/1024:.0f} KB")
        # se ha catturato flusso vero (uscita ben oltre il timeout) l'ha registrato: la
        # finestra continua a coprire eventuali riprese (bandiere rosse) finche' non scade.
    log(f"== {label}: finestra chiusa ==")


def main():
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    ss = sessioni_future()
    if not ss:
        log("nessuna sessione futura in calendario: esco.")
        return 0
    log(f"schedulatore avviato. {len(ss)} sessioni in programma:")
    for label, inizio, gp in ss:
        log(f"   {label:12} {inizio:%a %d/%m %H:%M}Z   {gp}")
    for label, inizio, gp in ss:
        try:
            registra_sessione(label, inizio, gp)
        except Exception as e:
            log(f"{label}: saltata per errore {e!r}")
    log("tutte le sessioni passate: schedulatore concluso.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
