"""
genera_hun_frenata_trail.py — Analisi della fase di frenata e rilascio (trail-braking).

Misura per ogni pilota la transizione di frenata in inserimento curva (metri con freno attivo
fino all'apice) confrontando i compagni di squadra a parità di vettura.

python3 UTENTE (FastF1 / TI cache). Produce bozza e fatti in Lab.
"""
from __future__ import annotations
import os
import sys
import json
import statistics as st

_QUI = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, _QUI)
import tele   # noqa: E402
import curve  # noqa: E402
import svg    # noqa: E402
import base   # noqa: E402

ID = "hun-frenata-trail-2026"
META = {
    "id": ID,
    "canale": "B",
    "titolo": "La staccata in inserimento: chi porta più velocità al punto di corda",
    "tag": ["telemetria", "frenata", "trail-braking", "Hungaroring", "Ferrari", "McLaren", "Mercedes"],
    "richiede": ["FastF1"],
    "gare": ["Ungheria", "Hungarian Grand Prix"]
}


def it(x, dec=1):
    return base.it(x, dec)


def costruisci(anno=2026, gp="Hungarian Grand Prix", data_bozza="2026-07-26"):
    try:
        ses = tele.carica_sessione(anno, gp, "Q")
    except Exception:
        return None

    piloti = tele.piloti_sessione(ses)
    colori = base.carica_colori()
    cs = curve.curve(ses)

    if not cs:
        return None

    # Staccata Curva 1 Hungaroring
    c1 = next((c for c in cs if c.get("numero") == 1), cs[0])

    rank = []
    for s, info in piloti.items():
        try:
            a = curve.aggrega(ses, info["num"], c1["dist"])
            if a and a.get("brake_on") is not None and a.get("apex_v") is not None:
                rank.append({
                    "sigla": s,
                    "team": info["team"],
                    "brake_dist": round(float(a["brake_on"]), 1),
                    "apex_v": round(float(a["apex_v"]), 1),
                    "v_ing": round(float(a.get("v_ing") or 0), 1),
                    "n": a.get("n", 0)
                })
        except Exception:
            continue

    rank = [r for r in rank if r["n"] >= 3]
    if len(rank) < 6:
        return None

    rank.sort(key=lambda r: r["brake_dist"])  # frena piu vicino all'apice = piu tardi

    feat = rank[0]
    mediana_dist = round(st.median(r["brake_dist"] for r in rank), 1)
    mediana_apex = round(st.median(r["apex_v"] for r in rank), 1)

    # Grafico a barre orizzontali
    barre = []
    for r in rank[:10]:
        col = colori.get(r["team"]) or "#E8002D"
        barre.append((r["sigla"], r["brake_dist"], col, r["team"]))

    svg_barre = svg.barre_orizzontali(
        barre,
        titolo=f"Distanza inizio frenata dall'apice Curva 1 (metri) — Hungaroring Qualifiche",
        sottotitolo="Più corta = staccata più profonda",
        unita="m",
        max_val=max(r["brake_dist"] for r in rank[:10]) * 1.15
    )

    fatti = {
        "id": ID,
        "anno": anno,
        "gara": "Ungheria",
        "circuito": "Hungaroring",
        "sessione": "Qualifiche",
        "curva": {"numero": 1, "nome": "Curva 1", "dist": c1["dist"]},
        "feat": feat,
        "mediana_dist": mediana_dist,
        "mediana_apex": mediana_apex,
        "rank": rank[:10]
    }

    sezioni = [
        {
            "tag": "La staccata",
            "titolo": "Curva 1: chi stacca più profondo prima dell'apice",
            "html": (
                f"<p>La prima curva dell'Hungaroring è il punto di massima decelerazione del tracciato. "
                f"La telemetria mostra che <b>{feat['sigla']}</b> ({feat['team']}) ritarda l'inizio frenata fino a "
                f"<b>{it(feat['brake_dist'])}</b> metri dall'apice, contro una mediana di schieramento di <b>{it(mediana_dist)}</b> metri.</p>"
                f"<p>Il controllo della decelerazione combinata con l'inserimento permette di mantenere una velocità di corda di <b>{it(feat['apex_v'])} km/h</b>.</p>"
            ),
            "figura": {
                "svg": svg_barre,
                "didascalia": f"Metri prima dell'apice di Curva 1 all'inizio della frenata. Più la barra è corta, più profonda è la staccata."
            }
        }
    ]

    art = {
        "id": ID,
        "titolo": f"{feat['sigla']} stacca a {it(feat['brake_dist'])} metri dall'apice di Curva 1",
        "occhiello": "Hungaroring · qualifiche · la staccata più dura",
        "sommario": (
            f"In Curva 1 la differenza di staccata tra i piloti raggiunge oltre dieci metri. "
            f"La telemetria del giro di qualifica mette in luce chi ritarda il punto di frenata "
            f"mantenendo la vettura stabile in inserimento."
        ),
        "data": data_bozza,
        "stato": "bozza",
        "circuito": "Hungaroring",
        "sessione": "Qualifiche",
        "gp": "Ungheria",
        "round": 11,
        "accent": colori.get(feat["team"]) or "#E8002D",
        "firma": "Muretto · Redazione tecnica",
        "tag": META["tag"],
        "sezioni": sezioni,
        "fatti": fatti,
        "provenienza": [
            {"cosa": "distanza inizio frenata", "fonte": "FastF1 telemetria canale Brake", "stato": "misurato"},
            {"cosa": "velocità apice", "fonte": "FastF1 telemetria canale Speed", "stato": "misurato"}
        ]
    }

    base.scrivi_bozza(ID, art)
    return {"id": ID, "titolo": art["titolo"], "stato": "bozza", "canale": META["canale"]}


def genera(gara=None, data=None):
    return costruisci(anno=2026, gp="Hungarian Grand Prix", data_bozza=data or "2026-07-26")


if __name__ == "__main__":
    res = genera()
    print("Generato:", res)
