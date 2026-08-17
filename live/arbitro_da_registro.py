#!/usr/bin/env python
"""Arbitro di gara costruito dagli artefatti DEL REPO — solo stdlib.

PERCHE' ESISTE. La Fase 1B ha validato il replay sulla gara di Spa contro un
arbitro CONGELATO A MANO la sera stessa (`gara_spa_2026_pubblicata.json`:
classifica raccolta da formula1.com, tre soste come spot-check, cronaca delle
neutralizzazioni da motorsport.com). Quel congelamento era necessario — f1db
era fermo a un rilascio pre-Spa — ma ha due difetti che si pagano appena si
vuole ripetere la prova su un'altra gara:

  (a) non si rigenera: e' una trascrizione, e la trascrizione umana e' un bug
      in attesa (la griglia di Monaco sbagliata a mano, 02/07);
  (b) NON aveva la tabella pit per-pilota, e per questo il KPI 3 della Fase 1B
      e' RINVIATO — non fallito: mancava l'arbitro, non il dato.

Questo script costruisce lo STESSO arbitro leggendo artefatti che nel repo
hanno un generatore e una fonte:

  data/arrivi_2026.csv        <- gen_arrivi.py (grezzo TI + f1db)
                                 classifica, giri, e le SOSTE per-pilota con
                                 il giro: e' l'arbitro che a Spa mancava
  data/race_control_2026.csv  <- gen_race_control.py (messaggi di direzione
                                 gara: SC/VSC/rossa con il giro)
  data/ti_archive/2026/<GP>/  <- grezzo della sessione: colonne `drv`/`dNum`,
    Race.json                    cioe' sigla e NUMERO DI GARA, perche' il feed
                                 live parla per numero e gli artefatti del sito
                                 per sigla

IL NUMERO DI GARA NON E' IL NUMERO PERMANENTE, e questa distinzione mi e'
costata la prima stesura. Prendevo la mappa da `demo/data/schede_2026.json`, che
sembra la fonte ovvia — e' generata, ha targhetta, viene da f1db. Ma
`gen_schede.py:144` riempie quel campo con `permanentNumber`: per Norris,
campione in carica che nel 2026 corre col numero 1, schede dice 4. UN SOLO
pilota su 22, e per forza il piu' pesante — il vincitore, la prima riga della
classifica. L'effetto era che il KPI 2 confrontava un ordine in cui la prima
auto non esisteva nel feed, e il KPI 3 dava «zero soste» a chi ne aveva fatte
tre. Il grezzo TI porta `dNum`, che e' il numero con cui l'auto E' SCESA IN
PISTA in quella sessione, e combacia con la DriverList del feed su 22 su 22.
Il confronto con schede resta, ma come CROSS-CHECK riportato
(`disaccordi_numero`): un disaccordo li' e' una notizia sul sito, non un
dettaglio da assorbire in silenzio.

INDIPENDENZA, che e' il punto di un arbitro. Nessuna di queste tre fonti passa
dalla registrazione live: vengono dall'archivio della sessione e da f1db. Il
replay non puo' quindi "avere ragione per costruzione".

LIMITE DICHIARATO, e non si aggiusta. La colonna `soste` di arrivi_2026.csv
elenca le soste come `giro:mescola`, e per qualche pilota il conteggio non
combacia con la colonna `n_soste` della stessa riga (una sosta senza mescola
nota, o un ritiro). Qui fa fede la LISTA (le soste che hanno un giro), e le
righe in disaccordo vengono riportate in `disaccordi_n_soste`: sono una
proprieta' dell'arbitro, non del replay, e chi legge il verdetto deve vederle.

Uso:
    .venv/bin/python live/arbitro_da_registro.py --gara Ungheria
    -> data/live_derived/gara_ungheria_arbitro.json
"""

import argparse
import csv
import json
import re
import sys
import unicodedata
from pathlib import Path

RADICE = Path(__file__).resolve().parent.parent
DERIVATI = RADICE / "data/live_derived"
ARRIVI = RADICE / "data/arrivi_2026.csv"
RACE_CONTROL = RADICE / "data/race_control_2026.csv"
SCHEDE = RADICE / "demo/data/schede_2026.json"
REGISTRO = RADICE / "data/gare_registro.json"

# QUALI MESSAGGI DICHIARANO UN REGIME, e i due modi in cui ho sbagliato a
# riconoscerli. La sorgente e' PROSA, non un codice di stato, e la prosa del
# race control parla di neutralizzazioni anche quando non ne sta dichiarando
# una. Due trappole prese in mezz'ora, entrambe sulla stessa parola:
#
#  1. "RED FLAG" cercata come sottostringa trova la BANDIERA A SCACCHI:
#     «CHEQUE-RED FLAG» contiene quella sequenza esatta. Effetto: una rossa
#     fantasma al giro del traguardo di OGNI gara della stagione (11 su 11).
#     L'ho visto perche' l'Ungheria non ha avuto rosse e nel referto ne
#     compariva una; su una gara con una rossa vera sarebbe passata liscia.
#  2. Col confine di parola (`\bRED FLAG\b`) la scacchi non passa piu', ma
#     passano le note dei commissari: a Monaco «INCIDENT INVOLVING CAR 6 (HAD)
#     NOTED - RED FLAG INFRINGEMENT» apriva una rossa al giro 73, cioe' cinque
#     giri DOPO quella vera. Una nota su un'infrazione non e' una
#     dichiarazione di regime.
#
# LA REGOLA CHE REGGE, letta dai dati e non indovinata: SC e VSC arrivano
# sempre con `categoria == "SafetyCar"` (45 righe su 45 nella stagione 2026);
# nessuna rossa arriva mai come `Flag/RED` — l'unica rossa del 2026 (Monaco
# giro 68) e' `Other` con testo «RED FLAG - RACE SUSPENDED». Quindi la rossa si
# riconosce solo dalla prosa, e la si distingue dalle note dei commissari
# pretendendo che il messaggio COMINCI col regime: una dichiarazione apre la
# riga, una nota lo cita a meta' frase, dopo «NOTED - » o «: ».
CATEGORIA_REGIME = "SafetyCar"
APERTURE_SAFETY = {
    r"^SAFETY CAR DEPLOYED\b": "SC",
    r"^VSC DEPLOYED\b": "VSC",
    r"^VIRTUAL SAFETY CAR DEPLOYED\b": "VSC",
}
APERTURA_ROSSA = r"^RED FLAG\b"
CHIUSURE = (r"^SAFETY CAR IN THIS LAP\b", r"^VSC ENDING\b",
            r"^VIRTUAL SAFETY CAR ENDING\b", r"\bTRACK CLEAR\b")
# La rossa SOSPENDE la gara: se arriva mentre una SC e' aperta, la SC finisce
# li' e comincia la rossa. Ignorarla (com'e' naturale in una macchina a stati
# che tiene un solo periodo aperto) perderebbe l'evento piu' grave della gara.
FORZA = {"SC": 1, "VSC": 1, "Red": 2}


def slug(testo):
    """'Ungheria' -> 'ungheria'; accenti via NFKD (nomi file senza sorprese)."""
    piatto = unicodedata.normalize("NFKD", testo)
    piatto = "".join(c for c in piatto if not unicodedata.combining(c))
    return piatto.lower().replace(" ", "-").replace("'", "")


def mappa_numeri(gara, registro):
    """sigla -> numero DI GARA, dal grezzo TI della sessione (`drv`/`dNum`).

    Una sigla che nel grezzo porta due numeri diversi ferma tutto: l'arbitro
    sarebbe ambiguo, e un arbitro ambiguo non e' un arbitro.

    Ritorna (mappa, disaccordi_con_schede)."""
    voce = registro.get(gara)
    if not voce or "ti" not in voce:
        raise SystemExit(
            f"gara '{gara}' assente da data/gare_registro.json: non so quale "
            "sessione grezza leggere per i numeri di gara.")
    grezzo = RADICE / "data/ti_archive/2026" / voce["ti"] / "Race.json"
    if not grezzo.exists():
        raise SystemExit(f"grezzo della sessione assente: {grezzo}")
    dati = json.loads(grezzo.read_text(encoding="utf-8"))

    esito = {}
    for sigla, numero in zip(dati["drv"], dati["dNum"]):
        sigla, numero = str(sigla), str(numero)
        if sigla in esito and esito[sigla] != numero:
            raise SystemExit(
                f"sigla {sigla} scesa in pista con due numeri "
                f"({esito[sigla]} e {numero}) nel grezzo di {gara}: "
                "l'arbitro sarebbe ambiguo, si ferma qui")
        esito[sigla] = numero

    # CROSS-CHECK, non fallback: se il sito pubblica un numero diverso da quello
    # con cui l'auto e' scesa in pista, lo si scrive nel referto.
    disaccordi = []
    if SCHEDE.exists():
        schede = json.loads(SCHEDE.read_text(encoding="utf-8"))
        for v in schede["piloti"].values():
            sigla, pubblicato = v.get("sigla"), v.get("numero")
            if sigla in esito and pubblicato and str(pubblicato) != esito[sigla]:
                disaccordi.append({
                    "sigla": sigla,
                    "numero_di_gara_grezzo": esito[sigla],
                    "numero_in_schede_2026": str(pubblicato),
                    "nota": "gen_schede.py usa permanentNumber; il numero di "
                            "gara puo' differire (es. il #1 del campione)",
                })
    return esito, disaccordi


def soste_da_colonna(testo):
    """'17:HARD;39:HARD;56:SOFT' -> [17, 39, 56].

    Le voci senza giro intero vengono SALTATE e contate a parte: 'None' come
    mescola e' ammesso (il giro c'e' e vale), un giro non numerico no."""
    giri, scartate = [], 0
    for pezzo in (testo or "").split(";"):
        pezzo = pezzo.strip()
        if not pezzo:
            continue
        testa = pezzo.split(":", 1)[0].strip()
        try:
            giri.append(int(testa))
        except ValueError:
            scartate += 1
    return sorted(giri), scartate


def costruisci(gara):
    registro = json.loads(REGISTRO.read_text(encoding="utf-8"))
    numeri, disaccordi_numero = mappa_numeri(gara, registro)

    righe = [r for r in csv.DictReader(ARRIVI.open(encoding="utf-8"))
             if r["gara"] == gara]
    if not righe:
        gare = sorted({r["gara"] for r in
                       csv.DictReader(ARRIVI.open(encoding="utf-8"))})
        raise SystemExit(f"gara '{gara}' assente da {ARRIVI.name}. "
                         f"Disponibili: {', '.join(gare)}")

    senza_numero = sorted(r["pilota"] for r in righe
                          if r["pilota"] not in numeri)
    if senza_numero:
        raise SystemExit(
            "sigle senza numero di auto in schede_2026.json: "
            f"{', '.join(senza_numero)} — l'arbitro non puo' parlare la lingua "
            "del feed live (che identifica per numero). Si ferma qui.")

    # ---- classifica: l'ordine E' pos_finale, ritirati inclusi (come a Spa)
    def chiave(r):
        try:
            return (0, float(r["pos_finale"]))
        except (TypeError, ValueError):
            return (1, 0.0)

    classifica, soste_arbitro, disaccordi = [], {}, []
    for r in sorted(righe, key=chiave):
        auto = numeri[r["pilota"]]
        classificato = str(r["classificato"]).strip().lower() == "true"
        classifica.append({
            "pos": int(float(r["pos_finale"])) if r["pos_finale"] else None,
            "auto": auto,
            "sigla": r["pilota"],
            "stato": "classificato" if classificato else "ritirato",
            "giri": int(r["giri"]) if r["giri"] else None,
            "tipo_arrivo": r["tipo_arrivo"],
        })
        giri_sosta, scartate = soste_da_colonna(r["soste"])
        soste_arbitro[auto] = {"sigla": r["pilota"], "giri": giri_sosta,
                              "n_soste_dichiarato": int(r["n_soste"])
                              if r["n_soste"] else None}
        dichiarato = soste_arbitro[auto]["n_soste_dichiarato"]
        if dichiarato is not None and dichiarato != len(giri_sosta):
            disaccordi.append({
                "auto": auto, "sigla": r["pilota"],
                "giri_elencati": giri_sosta,
                "n_soste_dichiarato": dichiarato,
                "voci_senza_giro": scartate,
                "stato": "classificato" if classificato else "ritirato",
            })

    # giri_totali = giri del primo classificato (il vincitore), non il massimo:
    # un doppiato non puo' definire la distanza di gara.
    vincitore = next((v for v in classifica if v["stato"] == "classificato"),
                     None)
    giri_totali = vincitore["giri"] if vincitore else None

    # ---- cronaca delle neutralizzazioni dal race control
    cronaca, aperto = [], None
    for r in csv.DictReader(RACE_CONTROL.open(encoding="utf-8")):
        if r["gara"] != gara:
            continue
        testo = (r["testo"] or "").strip().upper()
        try:
            giro = int(r["giro"])
        except (TypeError, ValueError):
            continue
        if r["categoria"] == CATEGORIA_REGIME:
            tipo = next((t for schema, t in APERTURE_SAFETY.items()
                         if re.match(schema, testo)), None)
        else:
            tipo = "Red" if re.match(APERTURA_ROSSA, testo) else None

        if tipo and aperto is None:
            aperto = {"tipo": tipo, "giro_inizio": giro, "giro_fine": None,
                      "causa": r["testo"].strip(), "fonte": "race control"}
        elif tipo and aperto is not None and FORZA[tipo] > FORZA[aperto["tipo"]]:
            aperto["giro_fine"] = giro          # la rossa chiude la SC in corso
            aperto["nota"] = f"chiusa dall'arrivo di {tipo}"
            cronaca.append(aperto)
            aperto = {"tipo": tipo, "giro_inizio": giro, "giro_fine": None,
                      "causa": r["testo"].strip(), "fonte": "race control"}
        elif aperto is not None and any(re.search(c, testo)
                                        for c in CHIUSURE):
            aperto["giro_fine"] = giro
            cronaca.append(aperto)
            aperto = None
    if aperto is not None:
        cronaca.append(aperto)

    return {
        "_nota": "GENERATO da live/arbitro_da_registro.py da artefatti del "
                 "repo (arrivi_2026.csv, race_control_2026.csv, "
                 "schede_2026.json). Nessuna trascrizione a mano. Nessuna "
                 "fonte passa dalla registrazione live: il replay non puo' "
                 "avere ragione per costruzione.",
        "gara": gara,
        "fonti": {
            "classifica_e_soste": "data/arrivi_2026.csv (gen_arrivi.py)",
            "neutralizzazioni": "data/race_control_2026.csv "
                                "(gen_race_control.py)",
            "numeri_auto": "data/ti_archive/2026/<GP>/Race.json, colonne "
                           "drv/dNum (numero DI GARA, non permanentNumber)",
        },
        "giri_totali": giri_totali,
        "classifica": classifica,
        "soste_per_auto": soste_arbitro,
        "disaccordi_n_soste": disaccordi,
        "disaccordi_numero_vs_schede": disaccordi_numero,
        "neutralizzazioni_cronaca": cronaca,
        "granularita": "la cronaca del race control porta il GIRO, non "
                       "l'orario: la clausola ±30 s del KPI 5 si applica come "
                       "copertura del giro indicato dalla timeline replay "
                       "(stessa lettura dichiarata per Spa).",
    }


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--gara", required=True,
                    help="nome come in data/arrivi_2026.csv (es. Ungheria)")
    ap.add_argument("--out", default=None)
    args = ap.parse_args()

    arbitro = costruisci(args.gara)
    destinazione = Path(args.out) if args.out else (
        DERIVATI / f"gara_{slug(args.gara)}_arbitro.json")
    destinazione.parent.mkdir(parents=True, exist_ok=True)
    destinazione.write_text(
        json.dumps(arbitro, ensure_ascii=False, indent=1), encoding="utf-8")

    print(f"arbitro {args.gara} -> {destinazione.relative_to(RADICE)}")
    print(f"  classifica: {len(arbitro['classifica'])} auto, "
          f"giri_totali={arbitro['giri_totali']}")
    soste_tot = sum(len(v["giri"]) for v in arbitro["soste_per_auto"].values())
    print(f"  soste con giro: {soste_tot} su "
          f"{len(arbitro['soste_per_auto'])} piloti")
    if arbitro["disaccordi_n_soste"]:
        print(f"  !! {len(arbitro['disaccordi_n_soste'])} righe in cui "
              "n_soste non combacia con le soste elencate "
              "(riportate, non aggiustate):")
        for d in arbitro["disaccordi_n_soste"]:
            print(f"     {d['sigla']}: elencate {d['giri_elencati']} "
                  f"vs n_soste={d['n_soste_dichiarato']} ({d['stato']})")
    if arbitro["disaccordi_numero_vs_schede"]:
        print(f"  !! {len(arbitro['disaccordi_numero_vs_schede'])} numero(i) di "
              "gara diversi da demo/data/schede_2026.json "
              "(il sito pubblica permanentNumber):")
        for d in arbitro["disaccordi_numero_vs_schede"]:
            print(f"     {d['sigla']}: in pista {d['numero_di_gara_grezzo']}, "
                  f"schede {d['numero_in_schede_2026']}")
    print(f"  neutralizzazioni: {len(arbitro['neutralizzazioni_cronaca'])}")
    for n in arbitro["neutralizzazioni_cronaca"]:
        print(f"     {n['tipo']} giri {n['giro_inizio']}–{n['giro_fine']}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
