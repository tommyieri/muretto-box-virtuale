#!/usr/bin/env python3
"""stima_mescola.py — FASE MESCOLA, eseguita come pre-registrata.

banco/prereg/PREREG_mescola.md fissa unita', appaiamento, null, bootstrap,
leave-one-year-out e cancello. Questo file li esegue e scrive l'esito: non
decide niente.

Regola 8: non simula. Regola 1/E12: non ri-definisce "verde" — legge la vista
degli stint esportata dal modulo che possiede la definizione.
"""

import hashlib
import json
import os
import sys

import numpy as np

RADICE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
VISTA = os.path.join(RADICE, "data", "viste", "stint_fondo.json")
USCITA = os.path.join(RADICE, "banco", "prereg", "ESITO_mescola.json")

# parametri PRE-REGISTRATI
ANNI = list(range(2019, 2026))
ANNO_ESCLUSO = 2018
FUORI_CAMPIONE = [2024, 2025]
DENTRO_CAMPIONE = [2019, 2020, 2021, 2022, 2023]
MIN_UNITA_STAGIONE = 20
RIPETIZIONI = 10000
SEME = 20260729


def carica():
    with open(VISTA, encoding="utf-8") as f:
        vista = json.load(f)
    with open(VISTA, "rb") as f:
        sha = hashlib.sha256(f.read()).hexdigest()
    return vista, sha


def unita_appaiate(stint, anni):
    """Una per (anno, gara, pilota) con almeno uno stint SOFT e uno HARD."""
    gruppi = {}
    for s in stint:
        if s["anno"] not in anni:
            continue
        if s["mescola"] not in ("SOFT", "HARD"):
            continue
        chiave = (s["anno"], s["gara"], s["drv"])
        gruppi.setdefault(chiave, {"SOFT": [], "HARD": []})
        gruppi[chiave][s["mescola"]].append(s)
    unita = []
    for (anno, gara, drv), g in sorted(gruppi.items()):
        if not g["SOFT"] or not g["HARD"]:
            continue
        soft = np.array([x["pendenza"] for x in g["SOFT"]], float)
        hard = np.array([x["pendenza"] for x in g["HARD"]], float)
        n_soft = sum(x["n"] for x in g["SOFT"])
        n_hard = sum(x["n"] for x in g["HARD"])
        unita.append({
            "anno": anno, "gara": gara, "drv": drv,
            "delta": float(soft.mean() - hard.mean()),
            "peso": float(min(n_soft, n_hard)),
            "n_soft_stint": len(g["SOFT"]), "n_hard_stint": len(g["HARD"]),
        })
    return unita


def bootstrap_blocchi_gare(unita, rng, ripetizioni=RIPETIZIONI):
    """Blocchi = gare (E11): si ricampionano le gare, non le unita'."""
    per_gara = {}
    for u in unita:
        per_gara.setdefault((u["anno"], u["gara"]), []).append(u["delta"])
    gare = list(per_gara.keys())
    if len(gare) < 2:
        return None
    medie = []
    for _ in range(ripetizioni):
        estratte = rng.integers(0, len(gare), len(gare))
        valori = [d for i in estratte for d in per_gara[gare[i]]]
        medie.append(np.mean(valori))
    return [float(np.percentile(medie, 2.5)), float(np.percentile(medie, 97.5))]


def permutazione(unita, rng, ripetizioni=RIPETIZIONI):
    """Test dei segni per permutazione: sotto il null le etichette dentro
    l'unita' appaiata sono scambiabili, e scambiarle inverte il segno di Delta."""
    delte = np.array([u["delta"] for u in unita], float)
    osservata = abs(delte.mean())
    segni = rng.choice([-1.0, 1.0], size=(ripetizioni, len(delte)))
    nulle = np.abs((segni * delte).mean(axis=1))
    # +1 al numeratore e al denominatore: un p-value esattamente 0 non esiste
    return float((np.sum(nulle >= osservata) + 1) / (ripetizioni + 1))


def riassumi(unita, rng, etichetta):
    if len(unita) == 0:
        return {"etichetta": etichetta, "n_unita": 0, "sufficiente": False,
                "media": None, "mediana": None, "media_pesata": None,
                "ic95": None, "p_permutazione": None, "n_gare": 0}
    delte = np.array([u["delta"] for u in unita], float)
    pesi = np.array([u["peso"] for u in unita], float)
    gare = {(u["anno"], u["gara"]) for u in unita}
    return {
        "etichetta": etichetta,
        "n_unita": len(unita),
        "n_gare": len(gare),
        "sufficiente": len(unita) >= MIN_UNITA_STAGIONE,
        "media": round(float(delte.mean()), 6),
        "mediana": round(float(np.median(delte)), 6),
        "media_pesata": round(float((delte * pesi).sum() / pesi.sum()), 6),
        "ic95": [round(v, 6) for v in (bootstrap_blocchi_gare(unita, rng) or [float("nan")] * 2)],
        "p_permutazione": round(permutazione(unita, rng), 6),
    }


def diagnosi_post_hoc(stint):
    """DIAGNOSI POST-HOC, non pre-registrata e non un cancello.

    Serve a capire DA DOVE viene un effetto col segno sbagliato. Va letta come
    descrizione, non come misura: e' stata guardata dopo l'esito, e per questo
    non puo' confermare niente (la stessa disciplina di PREREG_G0_secondo).
    """
    fuori = {}
    per_ultimo = {}
    for s in stint:
        k = (s["anno"], s["gara"], s["drv"])
        per_ultimo[k] = max(per_ultimo.get(k, 0), s["stint"])
    for m in ("SOFT", "HARD"):
        a = [s for s in stint if s["mescola"] == m and 2019 <= s["anno"] <= 2025]
        if not a:
            continue
        fuori[m] = {
            "n_stint": len(a),
            "giri_per_stint_mediana": float(np.median([s["n"] for s in a])),
            "eta_media": round(float(np.mean([s["eta_media"] for s in a])), 2),
            "posizione_nella_gara_mediana": round(float(np.median([s["giro_inizio"] / s["n_giri_gara"] for s in a])), 3),
            "quota_ultimo_stint": round(sum(1 for s in a if s["stint"] == per_ultimo[(s["anno"], s["gara"], s["drv"])]) / len(a), 3),
            "pendenza_mediana": round(float(np.median([s["pendenza"] for s in a])), 6),
        }
    fuori["_lettura"] = (
        "la SOFT e' la gomma di PARTENZA (posizione mediana 0,05 della distanza contro 0,35 della HARD) e i suoi "
        "stint sono meno che meta' di quelli HARD (13 giri contro 24). L'evoluzione della pista NON si cancella "
        "nell'appaiamento come fa il carburante, perche' non e' lineare nel giro: e' rapida all'inizio e va a "
        "plateau. Uno stint che sta sulla parte ripida vede i tempi scendere e prende una pendenza piu' negativa. "
        "E' la stessa non-linearita' che al PROMPT 03 ha fatto litigare la stima entro-blocco di delta70 (3,11) col "
        "replay (2,2)."
    )
    return fuori


def main():
    vista, sha = carica()
    stint = vista["stint"]
    rng = np.random.default_rng(SEME)

    tutte = unita_appaiate(stint, ANNI)
    if len(tutte) == 0:
        print("nessuna unita' appaiata: esperimento non eseguibile", file=sys.stderr)
        sys.exit(1)

    complessivo = riassumi(tutte, rng, "2019-2025 (tutte)")
    dentro = riassumi(unita_appaiate(stint, DENTRO_CAMPIONE), rng, "dentro campione 2019-2023")
    per_stagione = {
        str(a): riassumi([u for u in tutte if u["anno"] == a], rng, f"stagione {a}")
        for a in ANNI
    }
    loyo = {
        str(a): riassumi([u for u in tutte if u["anno"] != a], rng, f"tutte tranne {a}")
        for a in ANNI
    }

    # ── CANCELLO, come pre-registrato ────────────────────────────────────────
    segno_dentro = np.sign(dentro["media"]) if dentro["media"] is not None else 0.0
    esiti_fuori = {}
    for a in FUORI_CAMPIONE:
        s = per_stagione[str(a)]
        giudicabile = s["sufficiente"] and s["ic95"] is not None and not any(np.isnan(s["ic95"]))
        esclude_zero = giudicabile and (s["ic95"][0] > 0 or s["ic95"][1] < 0)
        segno_concorde = giudicabile and np.sign(s["media"]) == segno_dentro and segno_dentro != 0
        esiti_fuori[str(a)] = {
            "giudicabile": bool(giudicabile),
            "ic95_esclude_zero": bool(esclude_zero),
            "segno_concorde_col_dentro_campione": bool(segno_concorde),
            "passa": bool(esclude_zero and segno_concorde),
        }
    giudicabili = [e for e in esiti_fuori.values() if e["giudicabile"]]
    fuori_ok = len(giudicabili) == len(FUORI_CAMPIONE) and all(e["passa"] for e in esiti_fuori.values())

    # ATTESA DIREZIONALE, terza condizione del cancello e non un commento.
    # PREREG_mescola.md: "Se l'effetto risultasse significativo col segno
    # opposto, il cancello NON passa: sarebbe un segnale di confondimento, non
    # una misura di fisica della gomma." La prima stesura di questo file aveva
    # dimenticato la clausola e avrebbe dichiarato PASSA su un effetto col segno
    # sbagliato: la prereg e' l'autorita', il codice si adegua.
    attesa_direzionale = bool(dentro["media"] is not None and dentro["media"] > 0)
    cancello_passa = bool(fuori_ok and attesa_direzionale)

    esito = {
        "_targhetta": {
            "tipo": "esito della FASE MESCOLA, eseguita come pre-registrata",
            "prereg": "banco/prereg/PREREG_mescola.md",
            "eseguito_da": "fisica/stima_mescola.py",
            "fonte": "data/viste/stint_fondo.json",
            "sha256_vista": sha,
            "data": "2026-07-29",
            "unita": "Delta = media(pendenze SOFT) - media(pendenze HARD) entro (anno, gara, pilota), in s/giro per giro di eta'",
            "anno_escluso": ANNO_ESCLUSO,
            "motivo_anno_escluso": "nomenclatura 2018 diversa e 2 soli stint HARD: il contrasto SOFT-HARD non esiste",
            "bootstrap": f"{RIPETIZIONI} ripetizioni, blocchi = gare (E11), seme {SEME}",
            "permutazione": f"test dei segni, {RIPETIZIONI} permutazioni",
        },
        "complessivo": complessivo,
        "dentro_campione": dentro,
        "per_stagione": per_stagione,
        "leave_one_year_out": loyo,
        "cancello": {
            "condizioni": [
                "IC95 esclude lo zero su ENTRAMBE le stagioni fuori campione",
                "segno concorde con la stima dentro campione",
                "segno concorde con l'attesa direzionale dichiarata (Delta > 0: SOFT degrada piu' in fretta)",
            ],
            "fuori_campione_soddisfatto": fuori_ok,
            "fuori_campione": FUORI_CAMPIONE,
            "dentro_campione": DENTRO_CAMPIONE,
            "min_unita_stagione": MIN_UNITA_STAGIONE,
            "esiti_per_stagione": esiti_fuori,
            "attesa_direzionale_soft_piu_veloce_a_degradare": attesa_direzionale,
            "passa": bool(cancello_passa),
        },
        "diagnosi_post_hoc": diagnosi_post_hoc(stint),
        "conseguenza": (
            "la separazione per mescola ENTRA nel modello" if cancello_passa else
            "la separazione per mescola NON entra nel modello: rho resta comune e la pagina continua a "
            "dichiarare che la mescola scelta non cambia il degrado. Il ripiego 'delta nominale Pirelli' "
            "si adottera' solo con una fonte citabile: qui non se ne inventa uno (PREREG_mescola.md)"
        ),
    }
    with open(USCITA, "w", encoding="utf-8") as f:
        json.dump(esito, f, indent=2, ensure_ascii=False)
        f.write("\n")

    def riga(r):
        ic = "—" if r["ic95"] is None or any(np.isnan(r["ic95"])) else f"[{r['ic95'][0]:+.4f}; {r['ic95'][1]:+.4f}]"
        m = "—" if r["media"] is None else f"{r['media']:+.4f}"
        p = "—" if r["p_permutazione"] is None else f"{r['p_permutazione']:.4f}"
        return f"{r['etichetta']:26s} n={r['n_unita']:4d} gare={r['n_gare']:3d}  media={m}  IC95 {ic}  p={p}{'' if r['sufficiente'] else '  (INSUFFICIENTE)'}"

    print(riga(complessivo))
    print(riga(dentro))
    print("\nper stagione:")
    for a in ANNI:
        print("  " + riga(per_stagione[str(a)]))
    print("\nleave-one-year-out:")
    for a in ANNI:
        print("  " + riga(loyo[str(a)]))
    print(f"\nCANCELLO: {'PASSA' if cancello_passa else 'NON PASSA'}")
    print(f"  fuori campione soddisfatto: {fuori_ok}")
    print(f"  attesa direzionale (Delta > 0, SOFT degrada piu' in fretta): {attesa_direzionale}"
          f"{'' if attesa_direzionale else '  ← EFFETTO COL SEGNO OPPOSTO: confondimento, non fisica della gomma'}")
    for a, e in esiti_fuori.items():
        print(f"  {a}: giudicabile={e['giudicabile']} IC esclude zero={e['ic95_esclude_zero']} segno concorde={e['segno_concorde_col_dentro_campione']}")
    print(f"esito scritto: {os.path.relpath(USCITA, RADICE)}")


if __name__ == "__main__":
    main()
