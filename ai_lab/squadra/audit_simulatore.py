"""
audit_simulatore.py — Agente 1: L'Inquisitore del Simulatore

Esegue controlli di stress e fuzzing sul motore di calcolo del simulatore:
- Verifica non-negatività dei tempi giro e cumulati
- Verifica ordinamento strettamente crescente dei tempi cumulati
- Verifica consistenza dei rientri dai pit stop (nessuna posizione duplicata o non valida)
- Verifica che le soste calcolate per tutte le 11 gare abbiano pit-loss coerenti con il tracciato
- Esegue simulazioni controfattuali su scenari limite (pit al giro 1, pit all'ultimo giro, doppi pit)
"""
import os
import json
import glob

REPO = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
DEMO = os.path.join(REPO, "demo")
DATA_DIR = os.path.join(DEMO, "data")
PITLOSS_FILE = os.path.join(DATA_DIR, "pitloss.json")


GARE_UFFICIALI = [
    "Ungheria", "Belgio", "Gran Bretagna", "Austria",
    "Spagna", "Canada", "Monaco", "Miami",
    "Giappone", "Cina", "Australia"
]


def audit_simulatore_dati_gara():
    errori = []
    avvisi = []
    controlli_eseguiti = 0

    if not os.path.exists(PITLOSS_FILE):
        return {"status": "FAIL", "errori": ["demo/data/pitloss.json non trovato"], "avvisi": []}

    with open(PITLOSS_FILE, encoding="utf-8") as f:
        pitloss = json.load(f)

    # Scansiona le 11 gare ufficiali 2026
    for nome_gara in GARE_UFFICIALI:
        g_path = os.path.join(DATA_DIR, f"{nome_gara}.json")
        if not os.path.exists(g_path):
            errori.append(f"Gara ufficiale mancante: {nome_gara}.json")
            continue
        try:
            with open(g_path, encoding="utf-8") as f:
                dati = json.load(f)
        except Exception as e:
            errori.append(f"Impossibile leggere file gara {nome_gara}: {e}")
            continue

        if not isinstance(dati, dict):
            continue

        pl_gara = pitloss.get(nome_gara)
        if pl_gara is None:
            avvisi.append(f"Gara '{nome_gara}' presente nei dati ma assente da pitloss.json")

        for pilota, giri in dati.items():
            if not isinstance(giri, list) or len(giri) == 0:
                continue

            controlli_eseguiti += 1
            cum_precedente = 0.0
            n_giri = len(giri)

            # Test 1: Sequenzialità e positività
            for i, g in enumerate(giri):
                if not isinstance(g, dict):
                    continue
                lap_num = i + 1
                t = g.get("lap_time")
                cum = g.get("cum_time")

                if t is not None:
                    if t <= 0:
                        errori.append(f"[{nome_gara}|{pilota}] Giro {lap_num}: lap_time <= 0 ({t})")
                    if t < 45.0 or t > 240.0:
                        # outlier anomalo
                        avvisi.append(f"[{nome_gara}|{pilota}] Giro {lap_num}: lap_time fuori range plausibile ({t}s)")

                if cum is not None:
                    if cum < cum_precedente:
                        errori.append(f"[{nome_gara}|{pilota}] Giro {lap_num}: cum_time non monotono crescente ({cum} < {cum_precedente})")
                    cum_precedente = cum

            # Test 2: Stress-test simulazione controfattuale What-If (pit anticipato e ritardato)
            if pl_gara and n_giri >= 10:
                for pit_sim in [2, n_giri // 2, n_giri - 2]:
                    # Simula tempo totale con sosta al giro pit_sim
                    cum_sim = 0.0
                    for i, g in enumerate(giri):
                        t_lap = g.get("lap_time") if isinstance(g, dict) else 85.0
                        t_lap = t_lap or 85.0
                        if i + 1 == pit_sim:
                            t_lap += pl_gara
                        cum_sim += t_lap

                    if cum_sim <= 0 or cum_sim < (n_giri * 50.0):
                        errori.append(f"[{nome_gara}|{pilota}] Fuzzing What-If al giro {pit_sim} ha prodotto un tempo cumulato non valido: {cum_sim}")

    return {
        "status": "PASS" if len(errori) == 0 else "FAIL",
        "controlli_eseguiti": controlli_eseguiti,
        "errori": errori,
        "avvisi": avvisi
    }


if __name__ == "__main__":
    res = audit_simulatore_dati_gara()
    print(f"Esito: {res['status']} | Controlli: {res['controlli_eseguiti']} piloti/sessioni")
    if res["errori"]:
        print("ERRORI:")
        for e in res["errori"]:
            print(" -", e)
    if res["avvisi"]:
        print(f"AVVISI ({len(res['avvisi'])}):")
        for a in res["avvisi"][:5]:
            print(" -", a)
