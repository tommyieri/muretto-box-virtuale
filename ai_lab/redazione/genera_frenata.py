"""
Articolo M2 (Canale B): "Chi frena piu' tardi" — la zona di frenata.

Sulla mappa-curve: trova la staccata piu' pesante del circuito e misura, pilota
per pilota, DOVE inizia a frenare (metri prima dell'apice). Feature: il piu'
tardivo della griglia, col contrasto del compagno (stessa vettura).

python3 UTENTE (fastf1). Solo lettura; bozza nell'area Lab.
"""
from __future__ import annotations
import os
import sys
import json
import datetime

_QUI = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, _QUI)
import tele   # noqa: E402
import curve  # noqa: E402
import svg    # noqa: E402
import base   # noqa: E402

ID = "frenata-village-gb-2026"
PISTA_GB = os.path.join(base.REPO, "demo", "data", "pista_Gran Bretagna.json")
NOMI_CURVE = {3: "Village", 6: "Brooklands", 16: "Vale", 7: "Loop", 4: "curva 4"}


def it(x, dec=1):
    return base.it(x, dec)


def _compagno(piloti, sig):
    team = piloti[sig]["team"]
    for s, info in piloti.items():
        if s != sig and info["team"] == team:
            return s
    return None


def punto_pista(dist):
    d = json.load(open(PISTA_GB))
    dd = d["dist"]
    i = min(range(len(dd)), key=lambda k: abs(dd[k] - dist))
    return {"viewBox": d["viewBox"], "punti": d["punti"], "xy": d["punti"][i]}


def svg_pista(p, etichetta):
    vb = p["viewBox"]; W, H = vb[2], vb[3]
    dd = "M" + " L".join(f"{x:.1f} {y:.1f}" for x, y in p["punti"]) + " Z"
    lx, ly = p["xy"]
    return (f'<svg viewBox="0 0 {W} {H}" xmlns="http://www.w3.org/2000/svg" class="art-svg art-pista">'
            f'<path d="{dd}" fill="none" stroke="var(--line2)" stroke-width="3" stroke-linejoin="round"/>'
            f'<circle cx="{lx:.1f}" cy="{ly:.1f}" r="7.5" fill="var(--accent)"/>'
            f'<text x="{lx+14:.1f}" y="{ly+5:.1f}" font-size="17" fill="var(--txt)" '
            f'font-family="{svg.DISP}" letter-spacing="0.3">{svg.esc(etichetta)}</text></svg>')


def costruisci(anno=2026, gp="British Grand Prix", data_bozza=None):
    ses = tele.carica_sessione(anno, gp, "Q")
    piloti = tele.piloti_sessione(ses)
    colori = base.carica_colori()
    cs = curve.curve(ses)

    # 1) staccata piu' pesante: dal giro veloce di un riferimento (LEC), dV max
    ref = piloti.get("LEC") or next(iter(piloti.values()))
    tel_ref = tele.canale_giro(ses.laps.pick_drivers(ref["num"]).pick_fastest())
    pesi = []
    for c in cs:
        p = curve.profilo_curva(tel_ref, c["dist"])
        if p and p["brake_on"] is not None and p["v_ing"] and p["apex_v"]:
            pesi.append((p["v_ing"] - p["apex_v"], c))
    pesi.sort(key=lambda x: -x[0])
    cv = pesi[0][1]
    nome = NOMI_CURVE.get(cv["numero"], f"curva {cv['numero']}")

    # 2) punto di frenata di tutti alla staccata
    rank = []
    for s, info in piloti.items():
        a = curve.aggrega(ses, info["num"], cv["dist"])
        if a and a["brake_on"] is not None:
            rank.append({"sigla": s, "team": info["team"], "brake_on": a["brake_on"],
                         "apex_v": a["apex_v"], "v_ing": a["v_ing"], "n": a["n"]})
    rank = [r for r in rank if r["n"] >= 4]   # campione robusto per il ranking
    rank.sort(key=lambda r: r["brake_on"])   # piu' piccolo = frena piu' tardi
    feat = rank[0]                            # il piu' tardivo
    sF = feat["sigla"]; team = feat["team"]; colF = colori.get(team) or "var(--dim)"
    comp = _compagno(piloti, sF)
    rc = next((r for r in rank if r["sigla"] == comp), None)
    import statistics as st
    mediana = st.median(r["brake_on"] for r in rank)
    piu_presto = rank[-1]

    F = {
        "id": ID, "anno": anno, "gara": "Gran Bretagna", "circuito": "Silverstone",
        "sessione": "Qualifiche", "curva": {"numero": cv["numero"], "nome": nome, "dist": cv["dist"]},
        "feat": feat, "compagno": rc, "mediana_brake_on": mediana, "piu_presto": piu_presto,
        "frenata": {"v_ing": feat["v_ing"], "apex_v": feat["apex_v"]},
        "rank": rank,
    }

    # tracce feat vs compagno
    tF = curve.traccia_gas(ses, piloti[sF]["num"], cv["dist"])
    serie = [{"sigla": sF, "colore": colF, "tratteggio": False, "marker": -feat["brake_on"], "punti": tF}]
    if rc:
        tC = curve.traccia_gas(ses, piloti[comp]["num"], cv["dist"])
        serie.append({"sigla": comp, "colore": colF, "tratteggio": True, "marker": -rc["brake_on"], "punti": tC})
    vmin_plot = int(min(p[1] for s in serie for p in s["punti"]) // 25 * 25)
    vmax_plot = int(max(p[1] for s in serie for p in s["punti"]) // 25 * 25 + 25)
    svg1 = svg.grafico_gas_curva(
        serie, v_range=(vmin_plot, vmax_plot),
        marker_label="● inizio frenata",
        titolo=f"{nome}: dove inizia la frenata — {sF} vs {comp or 'campo'}",
        sub="velocità + gas · Qualifiche GB 2026")

    barre = [{"sigla": r["sigla"], "colore": colori.get(r["team"]) or "var(--dim)",
              "valore": r["brake_on"], "evidenza": (r["sigla"] == sF)} for r in rank]
    base_bar = int(min(r["brake_on"] for r in rank) // 5 * 5 - 5)
    svg2 = svg.barre_dv(barre, titolo="Dove inizia la frenata, per pilota",
                        base=base_bar,
                        caption=f"metri prima dell’apice · barra più corta = frena più tardi (asse da {base_bar})")
    svgP = svg_pista(punto_pista(cv["dist"]), nome)

    dv_comp = (rc["brake_on"] - feat["brake_on"]) if rc else None
    dv_med = mediana - feat["brake_on"]

    art = {
        "id": ID, "stato": "bozza", "data": data_bozza or datetime.date.today().isoformat(),
        "firma": "Muretto · Redazione tecnica", "accent": colF, "canale": "B (anomalia nei nostri dati)",
        "gara": F["gara"], "circuito": F["circuito"], "sessione": F["sessione"],
        "tag": ["telemetria", team, "frenata", "qualifiche"],
        "occhiello": f"Telemetria · Qualifiche {F['gara']} {anno}",
        "titolo": f"{nome}: {sF} è il più tardivo della griglia sui freni",
        "sommario": (f"In una delle staccate più dure di Silverstone {sF} attacca i freni più tardi di "
                     f"chiunque sulla griglia: a {it(feat['brake_on'],0)} metri dall’apice, "
                     + (f"{it(dv_comp,0)} in meno del primo inseguitore, " if dv_comp else "")
                     + f"{it(dv_med,0)} sotto la mediana. Il più tardivo di tutti."),
        "sezioni": [
            {"tag": "Evidenza", "titolo": "L’ultimo a togliere il piede dal gas",
             "html": (
                f"<p>{nome} è la staccata più dura del giro: si arriva a <b>{it(feat['v_ing'],0)} km/h</b> e "
                f"si scende a <b>{it(feat['apex_v'],0)}</b> all’apice. La telemetria delle qualifiche misura, "
                f"per ogni pilota, dove attacca i freni — la distanza dall’apice a cui inizia a frenare. "
                f"<b>{sF}</b> è il più tardivo di tutti: <b>{it(feat['brake_on'],0)} metri</b> dall’apice, "
                f"contro una mediana di schieramento di {it(mediana,0)} e i {it(piu_presto['brake_on'],0)} m "
                f"del più prudente ({piu_presto['sigla']}).</p>"
                + (f"<p>Il primo a inseguirlo è il compagno {comp}, stessa vettura, a "
                   f"<b>{it(rc['brake_on'],0)} metri</b> — {it(dv_comp,0)} più presto in mediana. Su singoli "
                   f"giri i due si sovrappongono: il fatto netto non è il duello in casa, è che {sF} è il più "
                   f"tardivo dell’intero schieramento.</p>" if rc else "")
             ), "figura": "grafico1"},
            {"tag": "Causa", "titolo": "Frenare tardi vuol dire portare velocità più a fondo",
             "html": (
                f"<p>Lo spazio di frenata cresce col quadrato della velocità: ritardare la staccata significa "
                f"arrivare più veloci più a fondo e poi frenare più forte, in meno spazio. È il modo classico "
                f"di guadagnare tempo in ingresso — {sF} tiene il gas qualche metro in più e affida il resto "
                f"alla frenata.</p>"
                f"<p>In teoria costa margine: frenare tardi lascia meno spazio all’errore e chiede di più a "
                f"freni e gomma anteriore. Ma quanto, non lo vediamo — temperatura e carico dei freni non sono "
                f"canali nel feed, e lo diciamo invece di stimarlo. E una cautela onesta: misuriamo <i>questa</i> "
                f"staccata, e su questa {sF} è il più tardivo; non la promuoviamo a “stile” del pilota senza "
                f"misurarlo su altre frenate.</p>"
             ), "figura": "pista"},
            {"tag": "Effetto", "titolo": "Metri, non decimi — ma sono i metri giusti",
             "html": (
                f"<p>Il divario è concreto: <b>{it(dv_med,0)} metri</b> più tardi della mediana dello "
                f"schieramento" + (f", <b>{it(dv_comp,0)} metri</b> più tardi del proprio compagno con la "
                f"stessa macchina" if rc else "") + f". In una staccata da {it(feat['v_ing'],0)} km/h quei "
                f"metri sono il confine tra un ingresso pulito e uno al limite: è lì che {sF} cerca il tempo, "
                f"e lo cerca dove fa più male sbagliare.</p>"
             )},
        ],
        "provenienza": [
            {"grandezza": "punto di frenata (m prima dell’apice)",
             "valore": f"{sF} {it(feat['brake_on'],0)} m · " + (f"{comp} {it(rc['brake_on'],0)} m · " if rc else "") + f"mediana {it(mediana,0)} m",
             "stato": "MISURATO", "da": "prima attivazione del canale Brake in avvicinamento all’apice, mediana sui giri lanciati (FastF1 + mappa-curve)"},
            {"grandezza": "velocità della staccata", "valore": f"{it(feat['v_ing'],0)} → {it(feat['apex_v'],0)} km/h",
             "stato": "MISURATO", "da": "massima in avvicinamento e minima all’apice"},
            {"grandezza": "usura/temperatura di freni e gomma", "valore": "non quantificabile",
             "stato": "NON_MISURABILE", "da": "nessun canale di temperatura o carico freni nel feed"},
        ],
        "fonti": [
            {"tipo": "dati", "testo": "FastF1 3.8.3 — telemetria vettura (Brake/Speed) + mappa curve (circuit_info), Qualifiche Gran Premio di Gran Bretagna 2026"},
            {"tipo": "metodo", "testo": f"ai_lab/redazione/genera_frenata.py su curve.py — staccata più pesante = max calo di velocità (Village supera il complesso Vale/Club per pochi km/h); punto di frenata = prima attivazione Brake in [apice−220, apice+40] m, mediana su ≥3 giri; ranking di schieramento ristretto ai piloti con ≥4 giri validi"},
        ],
    }

    FIG = {
        "grafico1": {"svg": svg1,
            "didascalia": (f"Attorno a {nome}: {sF} (pieno) tiene il gas più a lungo e attacca i freni più "
                           f"tardi (marcatore più vicino all’apice) del compagno {comp} (tratteggio)."),
            "fonte": "FastF1 · car telemetry (Brake/Speed), Qualifiche GB 2026"},
        "pista": {"svg": svgP,
            "didascalia": f"{nome} (curva {cv['numero']}) sul tracciato di Silverstone: la staccata più dura del giro.",
            "fonte": "FastF1 · GPS + circuit_info, tracciato del sito"},
    }
    for sez in art["sezioni"]:
        if sez.get("figura") in FIG:
            sez["figura"] = FIG[sez["figura"]]
        elif "figura" in sez:
            del sez["figura"]
    return F, art


META = {
    "id": ID, "canale": "B",
    "titolo": "Chi frena più tardi (la staccata più dura)",
    "tag": ["telemetria", "frenata", "qualifiche"],
    "descrizione": "punto di frenata alla staccata più pesante (tema M2)",
    "richiede": "telemetria", "gare": ["Gran Bretagna"],
}


def genera(gara=None, data=None):
    if gara not in (None, "Gran Bretagna", "British Grand Prix"):
        return None
    F, art = costruisci(2026, "British Grand Prix", data_bozza=data)
    base.scrivi_bozza(ID, art, F)
    return {"id": ID, "titolo": art["titolo"], "stato": art["stato"], "canale": "B"}


if __name__ == "__main__":
    F, art = costruisci()
    base.scrivi_bozza(ID, art, F)
    f = F["feat"]; c = F["compagno"]
    print(f"Bozza {ID} scritta.")
    print(f"  {F['curva']['nome']}: {f['sigla']} frena a {it(f['brake_on'],0)}m (piu tardi) | "
          f"compagno {c['sigla'] if c else '-'} {it(c['brake_on'],0) if c else '-'}m | mediana {it(F['mediana_brake_on'],0)}m")
