#!/usr/bin/env python3
"""stima_bagnato.py — FASE BAGNATO, eseguita come pre-registrata.

banco/prereg/PREREG_bagnato.md fissa la definizione misurabile di crossover, il
minimo di piloti per famiglia, il cancello e — soprattutto — la condizione di
NON ESEGUIBILITÀ (≥ 8 gare giudicabili). Questo file esegue: non decide.

L'ordine conta. Si misura PRIMA quante gare sono giudicabili, e solo se sono
abbastanza si stima il modello. Non è pignoleria procedurale: stimare `a` e `b`
su una gara e scriverli in un esito produce due numeri che qualcuno, fra sei
mesi, userà come se fossero misurati (E22). Se la fase non è eseguibile, i
coefficienti non esistono — non "esistono ma non si usano".

Produce banco/prereg/ESITO_bagnato.json. NON scrive in data/modelli/: la prereg
lo vieta esplicitamente, perché un file lì dentro verrebbe prima o poi consumato
come modello e questa fase non ne ha prodotto uno.
"""

import hashlib
import json
import os

import numpy as np

RADICE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
# I due percorsi sono sovrascrivibili SOLO per poter provare la sentinella s23
# su un fondo sintetico: senza questo, "lo stimatore fallisce se la fase diventa
# eseguibile" resterebbe una promessa nel commento, non un comportamento
# verificato (regola 4). In esecuzione normale valgono i percorsi reali.
VISTA = os.environ.get("MB_VISTA_BAGNATO") or os.path.join(RADICE, "data", "viste", "bagnato_fondo.json")
USCITA = os.environ.get("MB_ESITO_BAGNATO") or os.path.join(RADICE, "banco", "prereg", "ESITO_bagnato.json")

# parametri PRE-REGISTRATI (PREREG_bagnato.md)
MIN_PILOTI = 3          # per famiglia, perché una mediana sia una mediana
MIN_GIRI_MISTI = 5      # ampiezza minima della finestra osservabile
MIN_GARE_GIUDICABILI = 8
TOLLERANZA_GIRI = 3     # |previsto − reale| ≤ 3 → crossover riprodotto
MAX_ERRORE_MEDIANO = 2
QUOTA_RIPRODOTTE = 0.70

# la tabella di sensibilità: gli stessi criteri del censimento, riprodotti qui
# perché l'esito non dipenda da un conteggio fatto a mano una volta sola
GRIGLIA = [(1, 3), (1, 5), (1, 8), (2, 3), (2, 5), (3, 3), (3, 5)]


def finestra_mista(gara, min_piloti, min_giri):
    """I giri in cui ENTRAMBE le famiglie hanno una mediana degna del nome."""
    misti = [g for g in gara["giri"]
             if g["n_slick"] >= min_piloti and g["n_bagnato"] >= min_piloti]
    return misti if len(misti) >= min_giri else []


def crossover_reale(misti):
    """Il primo giro in cui Δ = mediana(bagnato) − mediana(slick) cambia segno.

    None se il segno non cambia mai: la gara ha una finestra mista ma non
    contiene il fenomeno, e non è giudicabile."""
    delta = [g["mediana_bagnato"] - g["mediana_slick"] for g in misti]
    segno0 = np.sign(delta[0])
    if segno0 == 0:
        return None
    for g, d in zip(misti[1:], delta[1:]):
        if np.sign(d) != 0 and np.sign(d) != segno0:
            return g["giro"]
    return None


def main():
    with open(VISTA, encoding="utf-8") as f:
        vista = json.load(f)
    with open(VISTA, "rb") as f:
        sha = hashlib.sha256(f.read()).hexdigest()

    # ── passo 1: quante gare sono GIUDICABILI, al variare dei criteri ──
    sensibilita = []
    for min_piloti, min_giri in GRIGLIA:
        con_finestra, con_cambio = 0, 0
        for gara in vista["gare"]:
            misti = finestra_mista(gara, min_piloti, min_giri)
            if not misti:
                continue
            con_finestra += 1
            if crossover_reale(misti) is not None:
                con_cambio += 1
        sensibilita.append({
            "min_piloti": min_piloti, "min_giri_misti": min_giri,
            "gare_con_finestra": con_finestra, "gare_con_cambio_di_segno": con_cambio,
            "dichiarato": min_piloti == MIN_PILOTI and min_giri == MIN_GIRI_MISTI,
        })

    # ── passo 2: le gare giudicabili col criterio DICHIARATO ──
    per_gara = []
    giudicabili = []
    for gara in vista["gare"]:
        misti = finestra_mista(gara, MIN_PILOTI, MIN_GIRI_MISTI)
        # diagnostica descrittiva: quanto è più lenta la gomma da bagnato
        # rispetto al riferimento asciutto della gara. Etichettata, non modello.
        rif = gara["riferimento_asciutto_s"]
        bagnati = [g["mediana_bagnato"] for g in gara["giri"] if g["mediana_bagnato"] is not None]
        eccesso = (None if rif is None or not bagnati
                   else round(float(np.median(bagnati)) / rif - 1.0, 4))
        dispersione = (None if rif is None or len(bagnati) < 3
                       else round(float(np.percentile(bagnati, 90) - np.percentile(bagnati, 10)) / rif, 4))
        voce = {
            "chiave": gara["chiave"],
            "giri_su_bagnato": gara["giri_su_bagnato"],
            "riferimento_asciutto_s": rif,
            "giri_finestra_mista": len(misti),
            "primo_giro_misto": misti[0]["giro"] if misti else None,
            "ultimo_giro_misto": misti[-1]["giro"] if misti else None,
            "crossover_reale": crossover_reale(misti) if misti else None,
            "eccesso_mediano_bagnato_su_asciutto": eccesso,
            "dispersione_p10_p90_relativa": dispersione,
        }
        voce["giudicabile"] = voce["crossover_reale"] is not None
        if voce["giudicabile"]:
            giudicabili.append(voce["chiave"])
        per_gara.append(voce)

    n_giudicabili = len(giudicabili)
    eseguibile = n_giudicabili >= MIN_GARE_GIUDICABILI

    # Ostacolo secondo, emerso misurando e non previsto dalla prereg: l'indicatore
    # `w` del modello ha al denominatore il riferimento asciutto della gara, e le
    # gare più bagnate non ne hanno uno (meno di 30 giri slick puliti → null,
    # regola 6). Si mette a referto perché è una seconda ragione indipendente,
    # non perché serva al verdetto: quello lo decide già il conteggio sopra.
    senza_riferimento = [g["chiave"] for g in vista["gare"] if g["riferimento_asciutto_s"] is None]

    # ── passo 3: il verdetto. Il modello si stima SOLO se la fase è eseguibile ──
    if eseguibile:
        raise SystemExit(
            "La fase è diventata eseguibile: {} gare giudicabili (≥ {}).\n"
            "Il modello pre-registrato (Δ = a + b·w, leave-one-race-out) non è "
            "implementato qui perché su questo fondo la condizione non si dava. "
            "Va scritto ora, senza toccare PREREG_bagnato.md.".format(
                n_giudicabili, MIN_GARE_GIUDICABILI))

    esito = {
        "_targhetta": {
            "tipo": "ESITO di fase — misurato sul fondo 2018-2025, gare bagnate",
            "prereg": "banco/prereg/PREREG_bagnato.md",
            "prodotto_da": "fisica/stima_bagnato.py",
            "fonte": "data/viste/bagnato_fondo.json",
            "sha256_vista": sha,
            "data": "2026-07-29",
            "avvertenza": "le grandezze qui dentro sono DIAGNOSTICA DESCRITTIVA, non un modello: nessuna è stata validata da un cancello e nessuna deve essere consumata come parametro (per questo l'esito non sta in data/modelli/)",
        },
        "verdetto": "NON ESEGUIBILE SU QUESTO FONDO",
        "motivo": (
            f"{n_giudicabili} gare giudicabili su {vista['n_gare']} bagnate, contro le "
            f"{MIN_GARE_GIUDICABILI} richieste dalla prereg. Una validazione "
            "leave-one-race-out sotto quella soglia non è una misura."
        ),
        "conseguenza": "il selettore Wet resta SPENTO, con la sua targhetta «modello non ancora misurato». Sentinella: banco/sentinelle/s23_bagnato.mjs",
        "criterio_dichiarato": {
            "min_piloti_per_famiglia": MIN_PILOTI,
            "min_giri_misti": MIN_GIRI_MISTI,
            "min_gare_giudicabili": MIN_GARE_GIUDICABILI,
            "tolleranza_giri": TOLLERANZA_GIRI,
            "max_errore_assoluto_mediano": MAX_ERRORE_MEDIANO,
            "quota_riprodotte": QUOTA_RIPRODOTTE,
        },
        "n_gare_bagnate": vista["n_gare"],
        "n_gare_giudicabili": n_giudicabili,
        "gare_giudicabili": giudicabili,
        "sensibilita_al_criterio": sensibilita,
        "nota_sensibilita": (
            "il massimo di gare con cambio di segno si ottiene col criterio più permissivo, "
            "quello in cui la «mediana» di una famiglia è un giro singolo: resta comunque "
            f"sotto le {MIN_GARE_GIUDICABILI} richieste, quindi la conclusione non dipende "
            "dalla soglia scelta. La prereg vieta comunque di abbassarla."
        ),
        "gare_senza_riferimento_asciutto": senza_riferimento,
        "nota_riferimento_asciutto": (
            f"{len(senza_riferimento)} gare su {vista['n_gare']} non hanno un riferimento "
            "asciutto (meno di 30 giri slick puliti: resta null, regola 6). Sono le gare più "
            "bagnate, e sono proprio quelle in cui l'indicatore w del modello pre-registrato "
            "non è calcolabile, perché il riferimento sta al suo denominatore. Ostacolo "
            "indipendente dal conteggio delle gare giudicabili, messo a referto per la "
            "riesecuzione: chi riprenderà la fase dovrà scegliere un indicatore di bagnato "
            "che non richieda asciutto nella stessa gara, e quella scelta va pre-registrata."
        ),
        "causa_strutturale": (
            "la transizione fra famiglie avviene ai box: i giri di cambio sono in-lap e "
            "out-lap (esclusi dal passo pulito) e molto spesso sotto Safety Car (esclusa). "
            "La finestra in cui due famiglie corrono davvero fianco a fianco e pulite è quasi vuota."
        ),
        "riesecuzione": (
            "la fase si rieseguirà senza ridiscutere nulla quando il fondo conterrà più gare "
            "bagnate, o quando esisterà una fonte per-auto delle bandiere che permetta di "
            "ammettere giri oggi esclusi. Questo stimatore fallisce rumorosamente se la "
            "condizione di eseguibilità si dà, perché il modello va scritto allora."
        ),
        "diagnostica_per_gara": per_gara,
    }

    with open(USCITA, "w", encoding="utf-8") as f:
        json.dump(esito, f, indent=2, ensure_ascii=False)
        f.write("\n")

    print(f"{vista['n_gare']} gare bagnate · {vista['giri_su_bagnato_totali']} giri su gomma da bagnato\n")
    print(f"{'min piloti':>10s} {'min giri misti':>15s} {'con finestra':>13s} {'con cambio di segno':>20s}")
    for s in sensibilita:
        marchio = "  ← dichiarato" if s["dichiarato"] else ""
        print(f"{s['min_piloti']:10d} {s['min_giri_misti']:15d} {s['gare_con_finestra']:13d} "
              f"{s['gare_con_cambio_di_segno']:20d}{marchio}")
    print(f"\ngare giudicabili (criterio dichiarato): {n_giudicabili} / {vista['n_gare']} "
          f"— richieste {MIN_GARE_GIUDICABILI}")
    for k in giudicabili:
        print(f"  {k}")
    print(f"\nVERDETTO: {esito['verdetto']} — il selettore Wet resta spento.")
    print("\ndiagnostica descrittiva (NON un modello):")
    print(f"{'gara':34s} {'giri bagn.':>10s} {'rif. asc.':>10s} {'eccesso':>9s} {'p10-p90':>8s}")
    for v in per_gara:
        rif = "—" if v["riferimento_asciutto_s"] is None else f"{v['riferimento_asciutto_s']:.2f}"
        ecc = "—" if v["eccesso_mediano_bagnato_su_asciutto"] is None else f"{v['eccesso_mediano_bagnato_su_asciutto'] * 100:+.1f}%"
        dsp = "—" if v["dispersione_p10_p90_relativa"] is None else f"{v['dispersione_p10_p90_relativa'] * 100:.1f}%"
        print(f"{v['chiave']:34s} {v['giri_su_bagnato']:10d} {rif:>10s} {ecc:>9s} {dsp:>8s}")
    print(f"\nscritto: {os.path.relpath(USCITA, RADICE)}")


if __name__ == "__main__":
    main()
