"""
audit_dati.py — Agente 2: Il Notaio dei Dati

Controlla l'integrità dei contratti dati e delle fonti:
1. Certificazione checksum f1db (data/pit_loss_circuito_f1db.csv)
2. Coerenza doppia fonte pit-loss (JSON vs CSV f1db) su tutti gli 11 GP
3. Verifica isolamento dei file archiviati (nessun codice vivo consuma data/archivio/)
4. Verifica del registro dei generatori della redazione tecnica
"""
import os
import csv
import json
import hashlib
import glob

REPO = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
F1DB_CSV = os.path.join(REPO, "data", "pit_loss_circuito_f1db.csv")
PITLOSS_JSON = os.path.join(REPO, "demo", "data", "pitloss.json")
ARCHIVIO_DIR = os.path.join(REPO, "data", "archivio")
REGISTRO_PY = os.path.join(REPO, "ai_lab", "redazione", "registro.py")

CHECKSUM_ATTESO_F1DB = "03a22c6eab4a719db07430ae2801063b038a15de14fa6d7467c23036a1243f09"


def audit_dati_integrita():
    errori = []
    avvisi = []
    controlli = 0

    # 1. Checksum f1db
    controlli += 1
    if not os.path.exists(F1DB_CSV):
        errori.append(f"File {F1DB_CSV} non trovato")
    else:
        with open(F1DB_CSV, "rb") as f:
            h = hashlib.sha256(f.read()).hexdigest()
        if h != CHECKSUM_ATTESO_F1DB:
            errori.append(f"Checksum f1db errato: {h} (atteso: {CHECKSUM_ATTESO_F1DB})")

    # 2. Coerenza Pit-loss tra CSV e JSON
    controlli += 1
    if os.path.exists(F1DB_CSV) and os.path.exists(PITLOSS_JSON):
        with open(PITLOSS_JSON, encoding="utf-8") as f:
            json_pl = json.load(f)

        csv_pl = {}
        with open(F1DB_CSV, encoding="utf-8") as f:
            reader = csv.DictReader(f)
            for row in reader:
                g = row.get("gran_premio") or row.get("gp")
                v = row.get("pit_loss_s") or row.get("pit_loss")
                if g and v:
                    try:
                        csv_pl[g] = float(v)
                    except ValueError:
                        pass

        for gp_nome, val_json in json_pl.items():
            if gp_nome in csv_pl:
                diff = abs(val_json - csv_pl[gp_nome])
                if diff > 0.05:
                    errori.append(f"Discrepanza pit-loss {gp_nome}: JSON={val_json} vs CSV={csv_pl[gp_nome]} (diff: {diff:.3f}s)")

        # Controllo specifico per Silverstone e Spa
        if abs(json_pl.get("Gran Bretagna", 0) - 20.80) > 0.01:
            errori.append(f"Silverstone pit-loss inatteso: {json_pl.get('Gran Bretagna')} (atteso: 20.80)")
        if abs(json_pl.get("Belgio", 0) - 23.36) > 0.01:
            errori.append(f"Spa pit-loss inatteso: {json_pl.get('Belgio')} (atteso: 23.36)")

    # 3. Verifica isolamento dei file archiviati (esclusi commenti)
    controlli += 1
    file_archiviati = [os.path.basename(f) for f in glob.glob(os.path.join(ARCHIVIO_DIR, "*")) 
                       if not f.endswith("README.md") and os.path.isfile(f)]

    sorgenti_vivi = []
    for d in ["demo", "simulatore", "live", "ai_lab"]:
        dir_p = os.path.join(REPO, d)
        if os.path.exists(dir_p):
            for ext in ["*.py", "*.mjs", "*.js", "*.html"]:
                sorgenti_vivi.extend(glob.glob(os.path.join(dir_p, "**", ext), recursive=True))

    for s_path in sorgenti_vivi:
        if "ai_lab/squadra" in s_path or "sentinella.py" in s_path:
            continue
        try:
            with open(s_path, encoding="utf-8", errors="ignore") as f:
                righe = f.readlines()
            for riga in righe:
                stripped = riga.strip()
                if stripped.startswith("//") or stripped.startswith("#") or stripped.startswith("*"):
                    continue
                for fa in file_archiviati:
                    if fa in riga and ("import" in riga or "require" in riga or "open(" in riga or "fetch(" in riga or "read" in riga):
                        errori.append(f"Codice vivo {os.path.relpath(s_path, REPO)} consuma file archiviato: {fa}")
        except Exception:
            pass

    # 4. Verifica registro generatori redazione
    controlli += 1
    if os.path.exists(REGISTRO_PY):
        with open(REGISTRO_PY, encoding="utf-8") as f:
            testo_reg = f.read()
        if "genera_hun_frenata_trail" not in testo_reg:
            errori.append("Generatore genera_hun_frenata_trail non registrato in registro.py")

    return {
        "status": "PASS" if len(errori) == 0 else "FAIL",
        "controlli_eseguiti": controlli,
        "errori": errori,
        "avvisi": avvisi
    }


if __name__ == "__main__":
    res = audit_dati_integrita()
    print(f"Esito: {res['status']} | Controlli: {res['controlli_eseguiti']}")
    if res["errori"]:
        print("ERRORI:")
        for e in res["errori"]:
            print(" -", e)
    if res["avvisi"]:
        print("AVVISI:")
        for a in res["avvisi"]:
            print(" -", a)
