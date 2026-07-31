#!/usr/bin/env python3
"""stima_pitloss.py — PROMOZIONE DEI PIT-LOSS, eseguita come pre-registrata.

banco/prereg/PREREG_pitloss.md fissa metodologia, cancello A (per circuito),
cancello B (prodotto) e il ruolo NON decisivo del cross-check col prior.
Questo file esegue: non decide.

Produce data/modelli/pitloss_interno.json — la misura interna, con targhetta —
che provenienza/pitloss.mjs consuma al posto del prior sui circuiti promossi.
"""

import hashlib
import json
import os
import sys

import numpy as np

RADICE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
VISTA = os.path.join(RADICE, "data", "viste", "soste_fondo.json")
PRIOR = os.path.join(RADICE, "data", "priors", "pitloss_priors.json")
USCITA = os.path.join(RADICE, "data", "modelli", "pitloss_interno.json")

# parametri PRE-REGISTRATI
FINESTRA_PRIMARIA = "3"
MIN_SOSTE = 20
MAX_SPOSTAMENTO_FINESTRA = 0.30
PLAUSIBILE = (10.0, 45.0)
ERA_CROSS_CHECK = (2022, 2025)
SOGLIA_DISCORDANZA = 2.0
RIPETIZIONI = 5000
SEME = 20260729

# corrispondenza dichiarata prior → Gran Premio (PREREG_pitloss.md)
PRIOR_A_GP = {
    "miami": "Miami_Grand_Prix",
    "silverstone": "British_Grand_Prix",
    "spielberg": "Austrian_Grand_Prix",
    "monaco": "Monaco_Grand_Prix",
    "barcelona": "Spanish_Grand_Prix",
    "spa": "Belgian_Grand_Prix",
    "imola": "Emilia_Romagna_Grand_Prix",
    "singapore": "Singapore_Grand_Prix",
    "lusail": "Qatar_Grand_Prix",
}


def main():
    with open(VISTA, encoding="utf-8") as f:
        vista = json.load(f)
    with open(VISTA, "rb") as f:
        sha = hashlib.sha256(f.read()).hexdigest()
    with open(PRIOR, encoding="utf-8") as f:
        prior = json.load(f)

    rng = np.random.default_rng(SEME)
    per_gp = {}
    for s in vista["soste"]:
        per_gp.setdefault(s["gara"], []).append(s)

    circuiti = {}
    for gp, soste in sorted(per_gp.items()):
        valori = {W: np.array([s["perdita"][W] for s in soste if s["perdita"].get(W) is not None], float)
                  for W in ("2", "3", "5")}
        primaria = valori[FINESTRA_PRIMARIA]
        n = len(primaria)
        if n == 0:
            continue
        mediana = float(np.median(primaria))
        mediane_finestra = {W: (float(np.median(v)) if len(v) else None) for W, v in valori.items()}
        spostamento = (None if mediane_finestra["2"] is None or mediane_finestra["5"] is None
                       else abs(mediane_finestra["2"] - mediane_finestra["5"]))

        # bootstrap a blocchi = gare (E11): si ricampionano le gare, non le soste
        per_gara = {}
        for s in soste:
            if s["perdita"].get(FINESTRA_PRIMARIA) is None:
                continue
            per_gara.setdefault((s["anno"], s["gara"]), []).append(s["perdita"][FINESTRA_PRIMARIA])
        blocchi = list(per_gara.values())
        ic = None
        if len(blocchi) >= 2:
            medie = []
            for _ in range(RIPETIZIONI):
                estratti = rng.integers(0, len(blocchi), len(blocchi))
                medie.append(np.median([v for i in estratti for v in blocchi[i]]))
            ic = [round(float(np.percentile(medie, 2.5)), 3), round(float(np.percentile(medie, 97.5)), 3)]

        # CANCELLO A, le tre condizioni
        c_numerosita = n >= MIN_SOSTE
        c_robustezza = spostamento is not None and spostamento <= MAX_SPOSTAMENTO_FINESTRA
        c_plausibile = PLAUSIBILE[0] <= mediana <= PLAUSIBILE[1]
        promosso = bool(c_numerosita and c_robustezza and c_plausibile)

        circuiti[gp] = {
            "n_soste": n,
            "n_gare": len(blocchi),
            "mediana_green_s": round(mediana, 3),
            "clean_10pct_s": round(float(np.percentile(primaria, 10)), 3),
            "ic95_mediana": ic,
            "mediane_per_finestra": {W: (None if v is None else round(v, 3)) for W, v in mediane_finestra.items()},
            "spostamento_finestra_2_5": None if spostamento is None else round(spostamento, 3),
            "cancello_A": {
                "numerosita": bool(c_numerosita),
                "robustezza_finestra": bool(c_robustezza),
                "plausibilita_fisica": bool(c_plausibile),
                "promosso": promosso,
            },
        }

    # ── cross-check col prior, sull'era sovrapposta: riportato, NON decisivo ──
    cross = {}
    for cid, gp in PRIOR_A_GP.items():
        atteso = prior["circuiti"].get(cid, {}).get("mediana_green_s")
        soste_era = [s["perdita"][FINESTRA_PRIMARIA] for s in per_gp.get(gp, [])
                     if s["perdita"].get(FINESTRA_PRIMARIA) is not None
                     and ERA_CROSS_CHECK[0] <= s["anno"] <= ERA_CROSS_CHECK[1]]
        if atteso is None or len(soste_era) == 0:
            cross[cid] = {"gp": gp, "prior_s": atteso, "interna_era_s": None,
                          "n_soste_era": len(soste_era), "differenza_s": None, "discordanza": None}
            continue
        interna = float(np.median(soste_era))
        diff = interna - atteso
        cross[cid] = {
            "gp": gp, "prior_s": atteso, "interna_era_s": round(interna, 3),
            "n_soste_era": len(soste_era), "differenza_s": round(diff, 3),
            "discordanza": bool(abs(diff) > SOGLIA_DISCORDANZA),
        }

    promossi = sorted(gp for gp, c in circuiti.items() if c["cancello_A"]["promosso"])
    fuori = {
        "_targhetta": {
            "tipo": "MISURATO sul fondo 2018-2025 — perdita ai box per Gran Premio",
            "prereg": "banco/prereg/PREREG_pitloss.md",
            "metodologia": "(in-lap + out-lap) − 2 × mediana del passo pulito del pilota adiacente alla sosta; solo soste verdi su gara asciutta; baseline W=3 giri per lato",
            "fonte": "data/viste/soste_fondo.json",
            "sha256_vista": sha,
            "prodotto_da": "fisica/stima_pitloss.py",
            "data": "2026-07-29",
            "incertezza": f"bootstrap {RIPETIZIONI} ripetizioni, blocchi = gare (E11), seme {SEME}",
            "uso": "provenienza/pitloss.mjs usa questi valori sui GP PROMOSSI; sugli altri resta il prior esterno, con la sua targhetta. Nessun valore misto (PREREG_pitloss.md).",
            "limite_dichiarato": "raggruppamento per Gran Premio, non per tracciato: si assume che nel 2018-2025 lo stesso GP si sia corso sullo stesso circuito",
        },
        "cancello_A": {
            "min_soste": MIN_SOSTE,
            "max_spostamento_finestra_s": MAX_SPOSTAMENTO_FINESTRA,
            "banda_plausibilita_s": list(PLAUSIBILE),
            "n_promossi": len(promossi),
            "promossi": promossi,
            "sufficiente": len(promossi) >= 5,
        },
        "cross_check_prior": {
            "era": list(ERA_CROSS_CHECK),
            "soglia_discordanza_s": SOGLIA_DISCORDANZA,
            "nota": "riportato, NON decisivo: il prior dichiara di cedere alla misura interna in caso di contraddizione",
            "per_circuito": cross,
        },
        "circuiti": circuiti,
    }
    os.makedirs(os.path.dirname(USCITA), exist_ok=True)
    with open(USCITA, "w", encoding="utf-8") as f:
        json.dump(fuori, f, indent=2, ensure_ascii=False)
        f.write("\n")

    print(f"{len(circuiti)} Gran Premi misurati · {len(promossi)} promossi (cancello A)\n")
    print(f"{'Gran Premio':34s} {'n':>4s} {'mediana':>8s} {'IC95':>18s} {'W2-W5':>7s}  promosso")
    for gp, c in sorted(circuiti.items(), key=lambda kv: -kv[1]["n_soste"]):
        ic = "—" if c["ic95_mediana"] is None else f"[{c['ic95_mediana'][0]:.2f}; {c['ic95_mediana'][1]:.2f}]"
        sp = "—" if c["spostamento_finestra_2_5"] is None else f"{c['spostamento_finestra_2_5']:.3f}"
        print(f"{gp:34s} {c['n_soste']:4d} {c['mediana_green_s']:8.2f} {ic:>18s} {sp:>7s}  {'SI' if c['cancello_A']['promosso'] else 'no'}")
    print("\ncross-check col prior (era 2022-2025, NON decisivo):")
    for cid, x in cross.items():
        if x["differenza_s"] is None:
            print(f"  {cid:12s} {x['gp']:28s} n={x['n_soste_era']:3d}  interna=—")
            continue
        print(f"  {cid:12s} {x['gp']:28s} n={x['n_soste_era']:3d}  prior={x['prior_s']:6.2f}  interna={x['interna_era_s']:6.2f}  diff={x['differenza_s']:+6.2f}{'  DISCORDANZA' if x['discordanza'] else ''}")
    print(f"\nscritto: {os.path.relpath(USCITA, RADICE)}")
    if len(promossi) < 5:
        print("FASE INSUFFICIENTE: meno di 5 GP promossi (PREREG_pitloss.md)", file=sys.stderr)


if __name__ == "__main__":
    main()
