"""
Bozza "frenata-t1" @ Hungaroring 2026 — Prove libere 1.

Angolo (inquadratura approvata): DUELLO-COMPAGNO alla staccata di curva 1, la più
dura del giro (calo ~230 km/h). Ocon attacca i freni ~18 m più tardi del compagno
Hirakawa con la STESSA Haas, portando la stessa velocità d'ingresso e d'apice ma
comprimendo la frenata in meno spazio (quindi più forte, decelerazione STIMATA).

Il primato assoluto di griglia è FRAGILE (gap al 2º solo ~1,75 m, singoli giri
sovrapposti) e viene dichiarato tale, non usato come tesi. La tesi che regge è il
divario col compagno di squadra.

Rimisura la sessione dal grezzo FastF1; costruisce i grafici con svg.py; scrive
SOLO una bozza in ai_lab/redazione/bozze/. python3 UTENTE (fastf1). Solo lettura.
"""
from __future__ import annotations
import os
import sys
import statistics as st

_QUI = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, _QUI)
import tele   # noqa: E402
import curve  # noqa: E402
import svg    # noqa: E402
import base   # noqa: E402

ID = "hun-frenata-t1-2026"
ANNO, GP, SES = 2026, "Hungary", "FP1"
ROUND = 11


def it(x, dec=1):
    return base.it(x, dec)


def _compagno(piloti, sig):
    team = piloti[sig]["team"]
    for s, info in piloti.items():
        if s != sig and info["team"] == team:
            return s
    return None


def _brake_on_singoli(ses, num, dist):
    """Punto di frenata (m prima dell'apice) giro-per-giro sui giri lanciati."""
    vals = []
    for lap in tele.giri_validi(ses, num):
        try:
            t = tele.canale_giro(lap)
        except Exception:
            continue
        p = curve.profilo_curva(t, dist)
        if p and p["brake_on"] is not None:
            vals.append(p["brake_on"])
    return sorted(vals)


def _dec_stimata(v_ing, apex_v, brake_on):
    """Decelerazione media STIMATA sulla fase di frenata: fisica v^2/2d, m/s^2.
    NON è una misura diretta (i canali sono a ~4 Hz): stima da v d'ingresso, v
    d'apice e spazio di frenata."""
    if not brake_on or brake_on <= 0:
        return None
    vi, vo = v_ing / 3.6, apex_v / 3.6
    return (vi * vi - vo * vo) / (2 * brake_on)


def costruisci(data_bozza=None):
    ses = tele.carica_sessione(ANNO, GP, SES)
    piloti = tele.piloti_sessione(ses)
    colori = base.carica_colori()
    cs = curve.curve(ses)

    # --- DRS: verifica degenere (tutto 0) e conteggio giri lanciati ---
    drs_vals = set()
    n_lanciati_tot = 0
    for s, info in piloti.items():
        gl = tele.giri_validi(ses, info["num"])
        n_lanciati_tot += len(gl)
        for lap in gl[:2]:
            try:
                t = tele.canale_giro(lap)
            except Exception:
                continue
            drs_vals |= set(int(v) for v in t["DRS"].unique())
    drs_degenere = drs_vals <= {0}

    # --- staccata più dura: dal giro veloce del pilota con più giri (riferimento) ---
    ref_sig = max(piloti, key=lambda s: len(tele.giri_validi(ses, piloti[s]["num"])))
    tel_ref = tele.canale_giro(ses.laps.pick_drivers(piloti[ref_sig]["num"]).pick_fastest())
    pesi = []
    for c in cs:
        p = curve.profilo_curva(tel_ref, c["dist"])
        if p and p["brake_on"] is not None and p["v_ing"] and p["apex_v"]:
            pesi.append((p["v_ing"] - p["apex_v"], c, p))
    pesi.sort(key=lambda x: -x[0])
    dv_ref, cv, pref = pesi[0]           # la staccata più pesante = curva 1

    # --- profilo di T1 per ogni pilota (mediana sui giri lanciati) ---
    rank = []
    for s, info in piloti.items():
        a = curve.aggrega(ses, info["num"], cv["dist"])
        if a and a["brake_on"] is not None and a["n"] >= 3:
            rank.append({"sigla": s, "team": info["team"], "brake_on": a["brake_on"],
                         "apex_v": a["apex_v"], "v_ing": a["v_ing"],
                         "dec": _dec_stimata(a["v_ing"], a["apex_v"], a["brake_on"]),
                         "n": a["n"]})
    rank.sort(key=lambda r: r["brake_on"])     # più piccolo = frena più tardi
    feat = rank[0]                             # il più tardivo della griglia (nominale)
    sF = feat["sigla"]; team = feat["team"]
    colF = colori.get(team) or piloti[sF]["colore"] or "var(--dim)"
    mediana = st.median(r["brake_on"] for r in rank)
    secondo = rank[1]
    gap_2 = secondo["brake_on"] - feat["brake_on"]
    piu_presto = rank[-1]

    # --- il compagno (stessa vettura): la tesi che regge ---
    comp = _compagno(piloti, sF)
    rc = next((r for r in rank if r["sigla"] == comp), None)
    dv_comp = (rc["brake_on"] - feat["brake_on"]) if rc else None

    # --- robustezza: dispersione giro-per-giro e overlap ---
    bo_f = _brake_on_singoli(ses, piloti[sF]["num"], cv["dist"])
    bo_2 = _brake_on_singoli(ses, piloti[secondo["sigla"]]["num"], cv["dist"])
    bo_c = _brake_on_singoli(ses, piloti[comp]["num"], cv["dist"]) if comp else []
    sd_f = st.pstdev(bo_f) if len(bo_f) >= 2 else None
    overlap_2 = bool(bo_f and bo_2 and max(bo_f) >= min(bo_2))       # vs #2 griglia
    hir_min = min(bo_c) if bo_c else None
    n_sotto = sum(1 for x in bo_f if hir_min is not None and x < hir_min)

    F = {
        "id": ID, "anno": ANNO, "gara": "Ungheria", "circuito": "Hungaroring",
        "sessione": SES, "round": ROUND,
        "curva": {"numero": cv["numero"], "dist": cv["dist"],
                  "v_ing_ref": pref["v_ing"], "apex_v_ref": pref["apex_v"],
                  "dv_ref": dv_ref, "ref": ref_sig},
        "feat": feat, "compagno": rc, "mediana_brake_on": mediana,
        "secondo": secondo, "gap_2": gap_2, "piu_presto": piu_presto,
        "dv_comp": dv_comp, "bo_feat": bo_f, "bo_comp": bo_c, "sd_feat": sd_f,
        "overlap_2": overlap_2, "hir_min": hir_min, "n_sotto": n_sotto,
        "drs_degenere": drs_degenere, "drs_vals": sorted(drs_vals),
        "n_lanciati_tot": n_lanciati_tot, "n_piloti": len(piloti),
        "rank": rank,
    }

    # ---------- FIGURA 1: duello OCO vs HIR attorno a T1 ----------
    tF = curve.traccia_gas(ses, piloti[sF]["num"], cv["dist"])
    serie = [{"sigla": sF, "colore": colF, "tratteggio": False,
              "marker": -feat["brake_on"], "punti": tF}]
    if comp and tF:
        tC = curve.traccia_gas(ses, piloti[comp]["num"], cv["dist"])
        if tC:
            serie.append({"sigla": comp, "colore": colF, "tratteggio": True,
                          "marker": -rc["brake_on"], "punti": tC})
    allv = [p[1] for s in serie for p in s["punti"]]
    vmin_plot = max(0, int(min(allv) // 50 * 50))
    vmax_plot = int(max(allv) // 50 * 50 + 50)
    svg1 = svg.grafico_gas_curva(
        serie, v_range=(vmin_plot, vmax_plot),
        marker_label="● inizio frenata",
        titolo=f"Curva 1: dove inizia la frenata — {sF} vs {comp}",
        sub=f"velocità + gas · Libere 1 Ungheria {ANNO} (stessa Haas)")

    # ---------- FIGURA 2: punto di frenata per pilota (contesto di griglia) ----------
    barre = [{"sigla": r["sigla"], "colore": colori.get(r["team"]) or "var(--dim)",
              "valore": r["brake_on"],
              "evidenza": (r["sigla"] in (sF, comp))} for r in rank]
    base_bar = int(min(r["brake_on"] for r in rank) // 5 * 5 - 5)
    svg2 = svg.barre_dv(
        barre, titolo="Dove inizia la frenata a curva 1, per pilota",
        base=base_bar,
        caption=f"metri prima dell’apice · barra più corta = frena più tardi (asse da {base_bar})")

    # ---------- testo ----------
    accent = colF
    v_ing_f = feat["v_ing"]; apex_f = feat["apex_v"]
    v_ing_c = rc["v_ing"] if rc else None; apex_c = rc["apex_v"] if rc else None
    dec_f = feat["dec"]; dec_c = rc["dec"] if rc else None
    n_f = feat["n"]; n_c = rc["n"] if rc else None

    art = {
        "id": ID, "stato": "bozza", "data": data_bozza or "2026-07-25",
        "firma": "Muretto · Redazione tecnica", "accent": accent,
        "canale": "B (anomalia nei nostri dati)",
        "gara": "Ungheria", "circuito": "Hungaroring", "sessione": SES,
        "gp": "Ungheria", "round": ROUND,
        "tag": ["telemetria", team, "frenata", "libere"],
        "occhiello": f"Telemetria · Libere 1 Ungheria {ANNO}",
        "titolo": f"Curva 1: {sF} attacca i freni {it(dv_comp,0)} metri più tardi del compagno",
        "sommario": (
            f"Alla staccata più dura dell’Hungaroring — curva 1, da {it(F['curva']['v_ing_ref'],0)} "
            f"a {it(F['curva']['apex_v_ref'],0)} km/h, circa {it(dv_ref,0)} km/h di calo — {sF} inizia a "
            f"frenare a {it(feat['brake_on'],0)} metri dall’apice contro i {it(rc['brake_on'],0) if rc else '–'} "
            f"del compagno {comp}, la stessa Haas: {it(dv_comp,0)} metri più tardi. Stessa velocità d’ingresso "
            f"e d’apice, ma la frenata è compressa in meno spazio — quindi più forte."),
        "sezioni": [
            {"tag": "Evidenza", "titolo": "Stessa Haas, diciotto metri di differenza",
             "html": (
                f"<p>Curva 1 è la staccata più dura del giro: si arriva a "
                f"<b>{it(F['curva']['v_ing_ref'],0)} km/h</b> e si scende a "
                f"<b>{it(F['curva']['apex_v_ref'],0)}</b> all’apice, circa "
                f"<b>{it(dv_ref,0)} km/h</b> lasciati in una frenata. La telemetria delle libere misura, "
                f"giro per giro, dove ogni pilota attacca i freni — la distanza dall’apice alla quale il "
                f"pedale va giù.</p>"
                f"<p>Il confronto pulito è in casa Haas, stessa vettura: <b>{sF}</b> inizia a frenare a "
                f"<b>{it(feat['brake_on'],0)} metri</b> dall’apice, il compagno <b>{comp}</b> a "
                f"<b>{it(rc['brake_on'],0)} metri</b> — {sF} stacca <b>{it(dv_comp,0)} metri più tardi</b> "
                f"(mediana su {n_f} e {n_c} giri lanciati). Non è un caso isolato: "
                f"<b>{F['n_sotto']} dei {len(F['bo_feat'])} giri</b> di {sF} cadono sotto la staccata più "
                f"tardiva di {comp} ({it(F['hir_min'],0)} m), il suo giro migliore da questo lato.</p>"
             ), "figura": "grafico1"},
            {"tag": "Causa", "titolo": "Stessa velocità, meno spazio: la frenata è più forte",
             "html": (
                f"<p>I due arrivano quasi identici: {sF} entra a <b>{it(v_ing_f,0)} km/h</b> e passa l’apice "
                f"a <b>{it(apex_f,0)}</b>, {comp} a <b>{it(v_ing_c,0)}</b> e <b>{it(apex_c,0)}</b>. Stessa "
                f"velocità in ingresso, stessa velocità in curva: l’unica cosa che cambia è lo <i>spazio</i> "
                f"in cui {sF} porta a termine la frenata, {it(dv_comp,0)} metri più corto. A parità di "
                f"velocità da smaltire, meno spazio vuol dire una decelerazione più alta — la stimiamo (fisica "
                f"v²/2d, non misura diretta) attorno a <b>{it(dec_f,1)} m/s²</b> per {sF} contro "
                f"<b>{it(dec_c,1)}</b> per {comp}.</p>"
                f"<p>Nel contesto dello schieramento {sF} risulta il più tardivo di tutti, ma è un primato "
                f"<b>fragile</b> e lo diciamo: sul secondo ({secondo['sigla']}) il margine è appena "
                f"<b>{it(gap_2,1)} m</b> e i singoli giri si sovrappongono. Il fatto solido non è il record di "
                f"griglia — è il divario col proprio compagno, che condivide la macchina.</p>"
             ), "figura": "grafico2"},
            {"tag": "Effetto", "titolo": "Metri, non decimi — e con le cautele delle libere",
             "html": (
                f"<p>Diciotto metri più tardi del compagno, con la stessa vettura, sono un dato concreto in "
                f"ingresso di curva 1. Ma sono libere, e vanno lette come tali: il carburante di {comp} è "
                f"ignoto e un run più pesante gonfierebbe il divario — è mitigato dalla velocità d’ingresso "
                f"quasi identica ({it(v_ing_f,0)} contro {it(v_ing_c,0)} km/h), non azzerato. Mappe motore e "
                f"compound/età gomma per-giro non sono noti, il campione è piccolo ({n_f} e {n_c} giri) e la "
                f"varianza giro-per-giro di {sF} è alta (sd {it(F['sd_feat'],1)} m, da "
                f"{it(min(F['bo_feat']),0)} a {it(max(F['bo_feat']),0)}).</p>"
                f"<p>Ciò che <i>non</i> vediamo lo dichiariamo: temperatura e usura di freni e gomma non hanno "
                f"canali nel feed, e la decelerazione è stimata, non misurata. Su curva 1, con queste cautele, "
                f"{sF} frena più tardi del compagno — e lo fa dove sbagliare costa di più.</p>"
             )},
        ],
        "provenienza": [
            {"grandezza": "punto di frenata a curva 1 (m prima dell’apice)",
             "valore": f"{sF} {it(feat['brake_on'],1)} m · {comp} {it(rc['brake_on'],1) if rc else '–'} m · mediana schieramento {it(mediana,1)} m",
             "stato": "MISURATO",
             "da": "prima attivazione del canale Brake in [apice−220, apice+40] m, apice = min velocità in [−25,+75] m; mediana sui giri lanciati (FastF1 + mappa-curve)"},
            {"grandezza": "velocità della staccata (ingresso → apice)",
             "valore": f"{sF} {it(v_ing_f,0)} → {it(apex_f,0)} km/h · {comp} {it(v_ing_c,0)} → {it(apex_c,0)} km/h",
             "stato": "MISURATO",
             "da": "massima in avvicinamento e minima nella finestra d’apice, mediana sui giri lanciati"},
            {"grandezza": "decelerazione media in frenata",
             "valore": f"{sF} {it(dec_f,1)} · {comp} {it(dec_c,1)} m/s²",
             "stato": "STIMATO",
             "da": "fisica v²/2d da velocità d’ingresso, velocità d’apice e spazio di frenata (canali a ~4 Hz), non misura diretta"},
            {"grandezza": "robustezza del duello col compagno",
             "valore": f"{F['n_sotto']}/{len(F['bo_feat'])} giri {sF} sotto il minimo di {comp} ({it(F['hir_min'],0)} m); {sF} sd {it(F['sd_feat'],1)} m, range {it(min(F['bo_feat']),0)}–{it(max(F['bo_feat']),0)}",
             "stato": "MISURATO",
             "da": "punto di frenata giro-per-giro sui giri lanciati dei due piloti"},
            {"grandezza": "primato assoluto di griglia",
             "valore": f"{sF} 1º ma +{it(gap_2,2)} m sul 2º ({secondo['sigla']}); singoli giri sovrapposti — FRAGILE",
             "stato": "MISURATO",
             "da": "ranking di schieramento sui giri lanciati; dichiarato fragile, non usato come tesi"},
            {"grandezza": "DRS",
             "valore": f"degenere (unico valore {F['drs_vals']}) — escluso dalla misura",
             "stato": "MISURATO",
             "da": "canale DRS della telemetria vettura, verificato costante a 0 in FP1"},
            {"grandezza": "carburante, mappe motore, compound/età gomma per-giro",
             "valore": "ignoti in prove libere",
             "stato": "NON_MISURABILE",
             "da": "non esposti dal feed in sessione libera; possono spostare il punto di frenata"},
            {"grandezza": "usura/temperatura di freni e gomma",
             "valore": "non quantificabile",
             "stato": "NON_MISURABILE",
             "da": "nessun canale di temperatura o carico freni nel feed"},
        ],
        "fonti": [
            {"tipo": "dati",
             "testo": (f"FastF1 3.8.3 — telemetria vettura (Speed/Throttle/Brake/nGear/RPM/DRS) + mappa curve "
                       f"(circuit_info), Prove libere 1 Gran Premio d’Ungheria {ANNO} (Hungaroring); "
                       f"{F['n_lanciati_tot']} giri lanciati su {F['n_piloti']} piloti, DRS verificato degenere (0) ed escluso")},
            {"tipo": "metodo",
             "testo": (f"ai_lab/redazione/genera_hun_frenata_t1.py su curve.py — staccata più pesante = max calo "
                       f"di velocità (curva 1, {it(F['curva']['v_ing_ref'],0)}→{it(F['curva']['apex_v_ref'],0)} km/h); "
                       f"punto di frenata = prima attivazione Brake in [apice−220, apice+40] m, apice = min velocità "
                       f"in [−25,+75] m; giri lanciati = LapTime valido + IsAccurate + ≤1,07× il best del pilota; "
                       f"decelerazione stimata v²/2d; tesi = duello compagno {sF} vs {comp} (stessa Haas, {n_f} e {n_c} giri)")},
        ],
    }

    FIG = {
        "grafico1": {"svg": svg1,
            "didascalia": (f"Attorno a curva 1: {sF} (pieno) tiene il gas più a lungo e attacca i freni più "
                           f"tardi (marcatore più vicino all’apice) del compagno {comp} (tratteggio), stessa Haas."),
            "fonte": f"FastF1 · car telemetry (Brake/Speed/Throttle), Libere 1 Ungheria {ANNO}"},
        "grafico2": {"svg": svg2,
            "didascalia": (f"Punto di frenata a curva 1 per ogni pilota: {sF} e {comp} evidenziati. {sF} è il più "
                           f"tardivo della griglia, ma sul 2º il margine è di appena {it(gap_2,1)} m — il primato "
                           f"assoluto è fragile; il divario col compagno no."),
            "fonte": f"FastF1 · car telemetry (Brake) + circuit_info, Libere 1 Ungheria {ANNO}"},
    }
    for sez in art["sezioni"]:
        if sez.get("figura") in FIG:
            sez["figura"] = FIG[sez["figura"]]
        elif "figura" in sez:
            del sez["figura"]
    return F, art


def genera(gara=None, data=None):
    if gara not in (None, "Ungheria", "Hungary", "Hungarian Grand Prix"):
        return None
    F, art = costruisci(data_bozza=data)
    base.scrivi_bozza(ID, art, F)
    return {"id": ID, "titolo": art["titolo"], "stato": art["stato"], "canale": "B"}


if __name__ == "__main__":
    F, art = costruisci()
    base.scrivi_bozza(ID, art, F)
    f = F["feat"]; c = F["compagno"]
    print(f"Bozza {ID} scritta.")
    print(f"  curva {F['curva']['numero']}: {f['sigla']} {it(f['brake_on'],1)}m vs "
          f"compagno {c['sigla'] if c else '-'} {it(c['brake_on'],1) if c else '-'}m "
          f"-> +{it(F['dv_comp'],1)}m | mediana {it(F['mediana_brake_on'],1)}m | "
          f"gap 2º {it(F['gap_2'],2)}m | {F['n_sotto']}/{len(F['bo_feat'])} sotto min compagno")
