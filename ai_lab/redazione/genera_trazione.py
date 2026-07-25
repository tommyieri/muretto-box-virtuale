"""
Articolo T2 (Canale B): "Chi rimette il gas per primo" — la trazione in uscita.

Sulla mappa-curve: trova la curva piu' lenta (uscita traction-limited) e misura,
pilota per pilota, dopo quanti metri dall'apice torna a gas pieno. Feature: il
piu' pronto della griglia, col contrasto del compagno.

python3 UTENTE (fastf1). Solo lettura; bozza nell'area Lab.
"""
from __future__ import annotations
import os
import sys
import json
import datetime
import statistics as st

_QUI = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, _QUI)
import tele   # noqa: E402
import curve  # noqa: E402
import svg    # noqa: E402
import base   # noqa: E402

ID = "trazione-loop-gb-2026"
PISTA_GB = os.path.join(base.REPO, "demo", "data", "pista_Gran Bretagna.json")
NOMI_CURVE = {4: "The Loop", 3: "Village", 6: "Brooklands", 7: "Aintree", 16: "Vale"}


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

    # 1) curva piu' lenta (uscita traction-limited): dal giro veloce di LEC, apex_v min
    ref = piloti.get("LEC") or next(iter(piloti.values()))
    tel_ref = tele.canale_giro(ses.laps.pick_drivers(ref["num"]).pick_fastest())
    lente = []
    for c in cs:
        p = curve.profilo_curva(tel_ref, c["dist"])
        if p and p["full_after"] is not None and p["apex_v"]:
            lente.append((p["apex_v"], c))
    lente.sort(key=lambda x: x[0])
    cv = lente[0][1]
    nome = NOMI_CURVE.get(cv["numero"], f"curva {cv['numero']}")

    # 2) ripresa gas di tutti; il ranking di schieramento e' ristretto ai campioni
    #    solidi (>=4 giri): con 2-3 giri la mediana e' fragile. La soglia e' pero'
    #    DETERMINANTE (a >=3 vince un altro), quindi il primato di gruppo va detto
    #    con onesta' e il fatto forte resta il confronto in casa.
    rank_tutti = []
    for s, info in piloti.items():
        a = curve.aggrega(ses, info["num"], cv["dist"])
        if a and a["full_after"] is not None:
            rank_tutti.append({"sigla": s, "team": info["team"], "full_after": a["full_after"],
                               "apex_v": a["apex_v"], "n": a["n"]})
    rank = sorted([r for r in rank_tutti if r["n"] >= 4], key=lambda r: r["full_after"])
    feat = rank[0]
    sF = feat["sigla"]; team = feat["team"]; colF = colori.get(team) or "var(--dim)"
    comp = _compagno(piloti, sF)
    rc = next((r for r in rank if r["sigla"] == comp), None)
    mediana = st.median(r["full_after"] for r in rank)
    piu_tardi = rank[-1]
    apex_v = st.median(r["apex_v"] for r in rank)
    margine2 = (rank[1]["full_after"] - feat["full_after"]) if len(rank) > 1 else None
    davanti_thin = sorted([r for r in rank_tutti if r["full_after"] < feat["full_after"] and r["n"] < 4],
                          key=lambda r: r["full_after"])
    if davanti_thin:
        _sg = " e ".join(r["sigla"] for r in davanti_thin)
        _ng = "–".join(str(x) for x in sorted(set(r["n"] for r in davanti_thin)))
        thin_txt = f"{_sg} {'figurano' if len(davanti_thin) > 1 else 'figura'} più avanti, ma su appena {_ng} giri, fuori dal campione robusto"
    else:
        thin_txt = ""

    F = {
        "id": ID, "anno": anno, "gara": "Gran Bretagna", "circuito": "Silverstone",
        "sessione": "Qualifiche", "curva": {"numero": cv["numero"], "nome": nome, "dist": cv["dist"]},
        "feat": feat, "compagno": rc, "mediana_full_after": mediana, "piu_tardi": piu_tardi,
        "apex_v": apex_v, "rank": rank,
    }

    tF = curve.traccia_gas(ses, piloti[sF]["num"], cv["dist"])
    serie = [{"sigla": sF, "colore": colF, "tratteggio": False, "marker": feat["full_after"], "punti": tF}]
    if rc:
        tC = curve.traccia_gas(ses, piloti[comp]["num"], cv["dist"])
        serie.append({"sigla": comp, "colore": colF, "tratteggio": True, "marker": rc["full_after"], "punti": tC})
    vmin_plot = int(min(p[1] for s in serie for p in s["punti"]) // 25 * 25)
    vmax_plot = int(max(p[1] for s in serie for p in s["punti"]) // 25 * 25 + 25)
    svg1 = svg.grafico_gas_curva(
        serie, v_range=(vmin_plot, vmax_plot),
        marker_label="● gas pieno",
        titolo=f"{nome}: chi rimette il gas prima — {sF} vs {comp or 'campo'}",
        sub="velocità + gas · Qualifiche GB 2026")

    barre = [{"sigla": r["sigla"], "colore": colori.get(r["team"]) or "var(--dim)",
              "valore": r["full_after"], "evidenza": (r["sigla"] == sF)} for r in rank]
    base_bar = int(min(r["full_after"] for r in rank) // 5 * 5 - 5)
    svg2 = svg.barre_dv(barre, titolo="Dopo quanti metri torna il gas pieno, per pilota",
                        base=base_bar,
                        caption=f"metri dopo l’apice · barra più corta = rimette il gas prima (asse da {base_bar})")
    svgP = svg_pista(punto_pista(cv["dist"]), nome)

    dv_comp = (rc["full_after"] - feat["full_after"]) if rc else None
    dv_med = mediana - feat["full_after"]

    if rc:
        titolo = f"{nome}, stessa {team}: {sF} rimette il gas prima del compagno {comp}"
        som = (f"Fuori dalla curva più lenta di Silverstone, con la stessa {team}, {sF} torna a gas pieno "
               f"{it(dv_comp,0)} metri prima del compagno {comp} — ed è tra i più pronti dello schieramento. "
               f"Trazione, o fiducia sull’anteriore.")
        ev_html = (
            f"<p>{nome} è la curva più lenta del giro: l’apice si passa a circa <b>{it(feat['apex_v'],0)} "
            f"km/h</b>, ed è tutta trazione in uscita. La telemetria misura dopo quanti metri dall’apice ogni "
            f"pilota torna a gas pieno. Il confronto più pulito è in casa: <b>{sF}</b> spalanca il gas a "
            f"<b>{it(feat['full_after'],0)} metri</b> dall’apice, il compagno <b>{comp}</b> — stessa {team} — a "
            f"<b>{it(rc['full_after'],0)}</b>, <b>{it(dv_comp,0)} metri più tardi</b>. Stessa vettura, stessa "
            f"uscita: la differenza è nella gestione del gas.</p>"
            f"<p>Sullo schieramento {sF} è tra i più pronti — mediana {it(mediana,0)} m, {piu_tardi['sigla']} "
            f"il più cauto a {it(piu_tardi['full_after'],0)}. Al vertice, però, i margini sono di pochi metri"
            + (f" ({thin_txt})" if thin_txt else "") + f": più un primato di gruppo che un distacco netto. Il "
            f"dato solido è il confronto in casa.</p>")
    else:
        titolo = f"{nome}: {sF} tra i più pronti a rimettere il gas"
        som = (f"Fuori dalla curva più lenta di Silverstone {sF} è tra i più pronti a tornare sul gas, a "
               f"{it(feat['full_after'],0)} metri dall’apice. Trazione, o coraggio.")
        ev_html = (
            f"<p>{nome} è la curva più lenta del giro: l’apice a circa <b>{it(feat['apex_v'],0)} km/h</b>, "
            f"tutta trazione in uscita. <b>{sF}</b> è tra i più pronti a rimettere il gas — "
            f"<b>{it(feat['full_after'],0)} metri</b> dall’apice, contro una mediana di {it(mediana,0)}"
            + (f"; {thin_txt}" if thin_txt else "") + f". Al vertice i margini sono di pochi metri.</p>")

    art = {
        "id": ID, "stato": "bozza", "data": data_bozza or datetime.date.today().isoformat(),
        "firma": "Muretto · Redazione tecnica", "accent": colF, "canale": "B (anomalia nei nostri dati)",
        "gara": F["gara"], "circuito": F["circuito"], "sessione": F["sessione"],
        "tag": ["telemetria", team, "trazione", "qualifiche"],
        "occhiello": f"Telemetria · Qualifiche {F['gara']} {anno}",
        "titolo": titolo,
        "sommario": som,
        "sezioni": [
            {"tag": "Evidenza", "titolo": "In casa, e sullo schieramento",
             "html": ev_html, "figura": "grafico1"},
            {"tag": "Causa", "titolo": "In una curva lenta il tempo si fa col gas, non con la velocità",
             "html": (
                f"<p>All’uscita di una curva lenta la coppia è enorme e la trazione è il limite: spalancare "
                f"troppo presto fa pattinare le gomme e, paradossalmente, si accelera di meno. Rimettere il gas "
                f"prima senza pattinare vuol dire fidarsi dell’anteriore in appoggio e dosare la coppia sul "
                f"filo dell’aderenza — {sF} è tra i più pronti a farlo.</p>"
                f"<p>Nel 2026 c’è un ingrediente in più che non vediamo: la spinta elettrica in uscita è "
                f"gestita dall’unità ibrida, e i canali di deployment non sono nel feed pubblico. Quanta parte "
                f"del gas-prima sia mano del pilota e quanta mappa di erogazione resta una variabile latente: "
                f"lo dichiariamo. Ma il gesto è misurato, e {sF} è all’estremo dello schieramento.</p>"
             ), "figura": "pista"},
            {"tag": "Effetto", "titolo": "Metri guadagnati dove parte il rettilineo",
             "html": (
                f"<p>Rimettere il gas <b>{it(dv_med,0)} metri</b> prima della mediana, all’uscita che immette "
                f"su un tratto veloce, è tempo che si accumula per tutto l’allungo successivo: chi accelera "
                f"prima arriva più veloce in fondo. È un vantaggio piccolo per giro e ripetuto ogni giro — la "
                f"definizione di una firma di guida.</p>"
             )},
        ],
        "provenienza": [
            {"grandezza": "ripresa del gas pieno (m dopo l’apice)",
             "valore": f"{sF} {it(feat['full_after'],0)} m · " + (f"{comp} {it(rc['full_after'],0)} m · " if rc else "") + f"mediana {it(mediana,0)} m",
             "stato": "MISURATO", "da": "prima distanza dall’apice con throttle ≥95%, mediana sui giri lanciati (FastF1 + mappa-curve)"},
            {"grandezza": "velocità all’apice", "valore": f"≈ {it(apex_v,0)} km/h (curva più lenta del giro)",
             "stato": "MISURATO", "da": "mediana della velocità minima all’apice"},
            {"grandezza": "spinta elettrica in uscita (deployment ERS)", "valore": "non quantificabile",
             "stato": "NON_MISURABILE", "da": "canali ERS/deployment assenti dal feed pubblico 2026"},
        ],
        "fonti": [
            {"tipo": "dati", "testo": "FastF1 3.8.3 — telemetria vettura (Throttle/Speed) + mappa curve (circuit_info), Qualifiche Gran Premio di Gran Bretagna 2026"},
            {"tipo": "metodo", "testo": f"ai_lab/redazione/genera_trazione.py su curve.py — curva più lenta = apice più basso; ripresa gas = prima distanza dall’apice con throttle ≥95% (l’ordinamento fine dipende dalla soglia; regge a 98%). Mediana su ≥3 giri per pilota; il ranking di schieramento è ristretto ai piloti con ≥4 giri validi — con 2-3 giri altri piloti figurano davanti, quindi il fatto solido è il confronto in casa, non il primato assoluto"},
        ],
    }

    FIG = {
        "grafico1": {"svg": svg1,
            "didascalia": (f"Attorno a {nome}: {sF} (pieno) riporta il gas al 100% prima (marcatore più "
                           f"vicino all’apice)" + (f" del compagno {comp} (tratteggio)" if rc else "") + "."),
            "fonte": "FastF1 · car telemetry (Throttle/Speed), Qualifiche GB 2026"},
        "pista": {"svg": svgP,
            "didascalia": f"{nome} (curva {cv['numero']}) sul tracciato di Silverstone: la curva più lenta del giro.",
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
    "titolo": "Chi rimette il gas per primo (curva lenta)",
    "tag": ["telemetria", "trazione", "qualifiche"],
    "descrizione": "ripresa del gas all’uscita della curva più lenta (tema T2)",
    "richiede": "telemetria", "gare": ["Gran Bretagna"], "sessioni": ["Q"],
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
    print(f"  {F['curva']['nome']}: {f['sigla']} gas a +{it(f['full_after'],0)}m (prima) | "
          f"compagno {c['sigla'] if c else '-'} +{it(c['full_after'],0) if c else '-'}m | mediana +{it(F['mediana_full_after'],0)}m")
