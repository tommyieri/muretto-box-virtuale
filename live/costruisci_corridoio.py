#!/usr/bin/env python
"""Costruzione del corridoio pit di un circuito da una registrazione
(Fase 3, parte A — da usare nel runbook del weekend tra FP1 e FP2).

Metodo di Fase 1 (verify_alignment.polilinea_pit): campioni posizione dei
periodi pit noti -> proiezione sull'asse principale, mediana trasversale
per bin di 5 m, gruppo contiguo principale (cluster fuori corridoio
scartati e riportati, mai inclusi in silenzio).

Periodi pit noti:
  - registrazione SignalR (.txt, Mac): intervalli InPit del timing
    (stesso criterio di Fase 1);
  - registrazione OpenF1 (.jsonl, server): finestre attorno ai messaggi
    v1/pit — APPROSSIMAZIONE dichiarata: [date-25s, date+durata+25s]
    (v1/pit arriva a stop concluso e la semantica esatta di `date` va
    verificata alla prima sessione reale). Il corridoio prodotto va
    SEMPRE controllato visivamente prima dell'uso (runbook);
  - campioni pre-estratti (.json, es. da live/estrai_precostruzione.py):
    {"punti": [[x, y], ...]} in decimi di metro, gia' filtrati sui
    periodi pit (pre-costruzione da FastF1 anno precedente,
    PREREG_HUN_PREP). La costruzione del corridoio resta identica.

Uso:
  .venv/bin/python live/costruisci_corridoio.py REGISTRAZIONE... \
      --circuito Ungheria --out data/live_derived/pitlane_ungheria.json
"""

import argparse
import json
import sys
from datetime import timedelta
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
sys.path.insert(0, str(Path(__file__).resolve().parent / "collector"))
from decoder import StatoSessione, campioni_posizione, messaggi  # noqa: E402
from verify_alignment import in_intervallo, polilinea_pit  # noqa: E402

FINESTRA_PIT_OPENF1_S = 25.0
MIN_PUNTI = 200


def campioni_pit_signalr(paths):
    """Campioni (x, y) nei periodi InPit del timing (metodo Fase 1)."""
    stato = StatoSessione()
    campioni = {}
    in_pit_da = {}
    intervalli = {}
    ultimo_ts = None
    for path in paths:
        for topic, payload, ts in messaggi(path):
            if ts is not None:
                ultimo_ts = ts
            if topic == "Position.z":
                for c in campioni_posizione(payload):
                    if c.t is not None:
                        campioni.setdefault(c.auto, []).append(
                            (c.t, float(c.x), float(c.y)))
                continue
            if topic == "TimingData":
                prima = {a: stato.vista_pilota(a)["in_pit"]
                         for a in payload.get("Lines", {})}
                stato.aggiorna(topic, payload, ts)
                for auto in prima:
                    dopo = stato.vista_pilota(auto)["in_pit"]
                    if dopo and not prima[auto] and auto not in in_pit_da:
                        in_pit_da[auto] = ts or ultimo_ts
                    elif prima[auto] and not dopo and auto in in_pit_da:
                        intervalli.setdefault(auto, []).append(
                            (in_pit_da.pop(auto), ts or ultimo_ts))
                continue
            stato.aggiorna(topic, payload, ts)
    for auto, t0 in in_pit_da.items():
        intervalli.setdefault(auto, []).append((t0, None))
    punti = []
    for auto, serie in campioni.items():
        finestre = intervalli.get(auto, [])
        punti += [(x, y) for t, x, y in serie
                  if in_intervallo(t, finestre)]
    return punti


def campioni_pit_openf1(paths):
    """Campioni (x, y) nelle finestre attorno ai v1/pit (approssimazione
    dichiarata in testa al file)."""
    from ingress_openf1 import leggi_jsonl
    from mappa_openf1 import parse_data
    posizioni = {}
    finestre = {}
    for path in paths:
        for topic, payload, _ts in leggi_jsonl(path):
            oggetti = payload if isinstance(payload, list) else [payload]
            for o in (o for o in oggetti if isinstance(o, dict)):
                if topic == "v1/location":
                    t = parse_data(o.get("date"))
                    num = o.get("driver_number")
                    x, y = o.get("x", 0), o.get("y", 0)
                    if t and num is not None \
                            and not (x == 0 and y == 0):
                        posizioni.setdefault(str(num), []).append(
                            (t, float(x), float(y)))
                elif topic == "v1/pit":
                    t = parse_data(o.get("date"))
                    num = o.get("driver_number")
                    if t is None or num is None:
                        continue
                    durata = o.get("pit_duration")
                    durata = float(durata) if isinstance(
                        durata, (int, float)) else 0.0
                    finestre.setdefault(str(num), []).append(
                        (t - timedelta(seconds=FINESTRA_PIT_OPENF1_S),
                         t + timedelta(seconds=durata
                                       + FINESTRA_PIT_OPENF1_S)))
    punti = []
    for auto, serie in posizioni.items():
        fin = finestre.get(auto, [])
        punti += [(x, y) for t, x, y in serie if in_intervallo(t, fin)]
    return punti


def scrivi_svg(dest, punti, corridoio, ref=None):
    """SVG per la verifica visiva obbligatoria: campioni pit (punti),
    corridoio costruito (linea), eventuale tracciato di riferimento."""
    serie = list(punti) + list(corridoio) + \
        ([tuple(p) for p in ref] if ref else [])
    xs = [p[0] for p in serie]
    ys = [p[1] for p in serie]
    x0, y0, x1, y1 = min(xs), min(ys), max(xs), max(ys)
    m = 0.03 * max(x1 - x0, y1 - y0)

    def path(pp):
        return " ".join(f"{'M' if i == 0 else 'L'}{x:.0f},{-y:.0f}"
                        for i, (x, y) in enumerate(pp))

    righe = [f'<svg xmlns="http://www.w3.org/2000/svg" '
             f'viewBox="{x0 - m:.0f} {-(y1 + m):.0f} '
             f'{x1 - x0 + 2 * m:.0f} {y1 - y0 + 2 * m:.0f}">',
             '<rect x="-999999" y="-999999" width="9999999" '
             'height="9999999" fill="#10151d"/>']
    if ref:
        righe.append(f'<path d="{path([tuple(p) for p in ref])}" '
                     'fill="none" stroke="#3a4557" stroke-width="30"/>')
    righe += [f'<circle cx="{x:.0f}" cy="{-y:.0f}" r="8" fill="#f5d43c" '
              'fill-opacity="0.35"/>' for x, y in punti]
    righe.append(f'<path d="{path(corridoio)}" fill="none" '
                 'stroke="#3fbf6f" stroke-width="18"/>')
    righe.append('</svg>')
    Path(dest).write_text("\n".join(righe), encoding="utf-8")


def main() -> int:
    ap = argparse.ArgumentParser(
        description="Corridoio pit di un circuito da una registrazione.")
    ap.add_argument("file", nargs="+", help="registrazioni (.txt o .jsonl)")
    ap.add_argument("--circuito", required=True)
    ap.add_argument("--out", required=True)
    ap.add_argument("--svg", help="SVG di verifica visiva (campioni + "
                                  "corridoio + eventuale --ref)")
    ap.add_argument("--ref", help="polilinea tracciato per lo sfondo "
                                  "dell'SVG (<circuito>_ref_track.json)")
    args = ap.parse_args()

    percorsi = [Path(f) for f in args.file]
    suffissi = {p.suffix for p in percorsi}
    if len(suffissi) > 1:
        print("mix di formati non supportato", file=sys.stderr)
        return 1
    if suffissi == {".jsonl"}:
        punti, fonte = campioni_pit_openf1(percorsi), \
            "OpenF1 v1/pit (finestre approssimate: verifica visiva!)"
    elif suffissi == {".json"}:
        punti = [tuple(p) for percorso in percorsi
                 for p in json.loads(percorso.read_text())["punti"]]
        fonte = ("campioni pre-estratti (FastF1 PitInTime/PitOutTime, "
                 "pre-costruzione: verifica visiva!)")
    else:
        punti, fonte = campioni_pit_signalr(percorsi), \
            "SignalR InPit del timing (metodo Fase 1)"

    print(f"campioni pit: {len(punti)} ({fonte})")
    if len(punti) < MIN_PUNTI:
        print(f"TROPPO POCHI campioni (<{MIN_PUNTI}): servono piu' pit "
              "stop registrati (riprova dopo la sessione)", file=sys.stderr)
        return 1
    corridoio, scarti = polilinea_pit(punti)
    if not corridoio:
        print("nessun corridoio costruibile", file=sys.stderr)
        return 1
    lung = sum(((x1 - x0) ** 2 + (y1 - y0) ** 2) ** 0.5
               for (x0, y0), (x1, y1) in zip(corridoio, corridoio[1:])) / 10
    out = {
        "_nota": ("polilinea pit lane da costruisci_corridoio.py (metodo "
                  "Fase 1: mediana trasversale per bin di 5 m sull'asse "
                  "principale; cluster fuori dal corridoio contiguo "
                  "principale scartati e riportati). "
                  f"Fonte periodi pit: {fonte}."),
        "circuito": args.circuito,
        "sorgenti": [str(p) for p in percorsi],
        "campioni": len(punti),
        "punti": [[round(x, 1), round(y, 1)] for x, y in corridoio],
        "cluster_scartati": scarti,
    }
    Path(args.out).parent.mkdir(parents=True, exist_ok=True)
    Path(args.out).write_text(json.dumps(out, ensure_ascii=False, indent=1),
                              encoding="utf-8")
    print(f"corridoio: {len(corridoio)} punti, {lung:.0f} m, "
          f"{len(scarti)} cluster scartati -> {args.out}")
    if args.svg:
        ref = json.loads(Path(args.ref).read_text())["punti"] \
            if args.ref else None
        scrivi_svg(args.svg, punti, corridoio, ref)
        print(f"verifica visiva -> {args.svg}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
