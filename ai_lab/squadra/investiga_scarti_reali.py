"""
investiga_scarti_reali.py — Analisi Scientifica Lap-by-Lap dei 4 Casi con Delta > 5s

Indaga nel dettaglio:
1. Belgio (LEC al giro 14)
2. Austria (RUS al giro 25)
3. Canada (SAI al giro 26)
4. Australia (BEA al giro 19)
"""
import os
import json
import statistics as stats

REPO = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
DEMO = os.path.join(REPO, "demo")
DATA_DIR = os.path.join(DEMO, "data")
PITLOSS_FILE = os.path.join(DATA_DIR, "pitloss.json")

CASI = [
    {"gara": "Belgio", "pilota": "LEC", "pit_test": 14},
    {"gara": "Austria", "pilota": "RUS", "pit_test": 25},
    {"gara": "Canada", "pilota": "SAI", "pit_test": 26},
    {"gara": "Australia", "pilota": "BEA", "pit_test": 19}
]

with open(PITLOSS_FILE, encoding="utf-8") as f:
    pitloss_map = json.load(f)

for c in CASI:
    gara = c["gara"]
    pilota = c["pilota"]
    path_g = os.path.join(DATA_DIR, f"{gara}.json")
    
    with open(path_g, encoding="utf-8") as f:
        dati = json.load(f)

    laps = dati.get("laps", [])
    pl_nominale = pitloss_map.get(gara, 22.0)

    # Estrai cronologia completa del pilota
    giri_pilota = []
    for l in laps:
        num = l.get("lap")
        cars = l.get("cars", {})
        if pilota in cars:
            info = cars[pilota]
            info["lap"] = num
            giri_pilota.append(info)

    print(f"\n================================================================================")
    print(f"  INDAGINE: {gara.upper()} — Pilota: {pilota} (Giri totali: {len(giri_pilota)})")
    print(f"================================================================================")
    print(f"Pit-loss nominale circuito ({PITLOSS_FILE}): {pl_nominale} s")

    # Identifica TUTTI gli stint e le soste reali
    stints = {}
    soste = []
    in_laps = []
    out_laps = []
    neutralizzati = []

    for g in giri_pilota:
        st = g.get("stint", 1)
        stints.setdefault(st, []).append(g)
        if g.get("in_lap"):
            in_laps.append(g["lap"])
            soste.append(g["lap"])
        if g.get("out_lap"):
            out_laps.append(g["lap"])
        if g.get("neutralized"):
            neutralizzati.append(g["lap"])

    print(f"Numero totale di stint reali: {len(stints)}")
    for st_num, l_list in stints.items():
        comp = l_list[0].get("compound", "N/D")
        giri_stint = [g["lap_time"] for g in l_list if g.get("lap_time") and not g.get("in_lap") and not g.get("out_lap")]
        mediana_p = stats.median(giri_stint) if giri_stint else 0.0
        print(f"  - Stint {st_num}: {len(l_list)} giri (Giro {l_list[0]['lap']} -> {l_list[-1]['lap']}) su mescola {comp} | Passo mediano: {mediana_p:.3f} s")

    print(f"Soste reali effettuate: in_lap={in_laps}, out_lap={out_laps}")
    print(f"Giri neutralizzati/gialli: {neutralizzati}")

    # Calcolo tempo perso reale al pit-stop
    for idx_s, in_l in enumerate(in_laps):
        out_l = in_l + 1
        g_in = next((g for g in giri_pilota if g["lap"] == in_l), None)
        g_out = next((g for g in giri_pilota if g["lap"] == out_l), None)
        
        # Passo base di riferimento attorno alla sosta
        giri_vicini = [g["lap_time"] for g in giri_pilota if abs(g["lap"] - in_l) <= 4 and g["lap"] not in (in_l, out_l) and g.get("lap_time")]
        passo_rif = stats.median(giri_vicini) if giri_vicini else 0.0

        if g_in and g_out and g_in.get("lap_time") and g_out.get("lap_time") and passo_rif:
            loss_reale = (g_in["lap_time"] - passo_rif) + (g_out["lap_time"] - passo_rif)
            print(f"\n  [Sosta {idx_s+1} al giro {in_l}]:")
            print(f"    • In-lap {in_l}: {g_in['lap_time']:.3f} s (Passo rif: {passo_rif:.3f} s -> delta in: +{g_in['lap_time']-passo_rif:.3f} s)")
            print(f"    • Out-lap {out_l}: {g_out['lap_time']:.3f} s (Passo rif: {passo_rif:.3f} s -> delta out: +{g_out['lap_time']-passo_rif:.3f} s)")
            print(f"    • Pit-loss REALE misurato (in_lap + out_lap - 2*passo): {loss_reale:.3f} s")
            print(f"    • Discrepanza con pit-loss nominale ({pl_nominale} s): {loss_reale - pl_nominale:+.3f} s")

    # Dettaglio evoluzione cronometrica stint 2
    if len(stints) >= 2:
        st2 = stints.get(2, [])
        print(f"\n  Evoluzione Stint 2 (primi 10 giri):")
        for g in st2[:10]:
            print(f"    Giro {g['lap']} (gomma età {g.get('tyre_age')}): {g.get('lap_time')} s (cum: {g.get('cum_time')} s)")
