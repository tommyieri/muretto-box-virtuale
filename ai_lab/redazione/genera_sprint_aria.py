"""
Il prezzo dell'aria sporca — pezzo della SPRINT (weekend sprint, sessione "S").

LA DOMANDA. Stare attaccati a chi ti precede conviene sul dritto e costa in curva:
e' il primo fatto che ogni telecronaca ripete e che quasi nessuno misura. Qui si
misura, e si misura nel modo piu' onesto possibile: STESSA macchina, STESSA
sessione, STESSA mescola. Per ogni pilota si confrontano i suoi giri passati entro
1 s dalla macchina davanti con i suoi giri in aria libera.

COME. Un confronto grezzo fra i due gruppi mentirebbe due volte:
 1) chi vive in scia e' sistematicamente UN ALTRO pilota (chi sta dietro);
 2) i giri in scia cadono in un momento diverso della sprint (misurato: a Miami
    circa 2 giri prima), e lungo la sessione cambiano benzina, gomma e pista.
Lo stimatore e' quindi a EFFETTI FISSI: una costante per pilota (toglie il livello
del pilota) piu' una tendenza lineare sul numero di giro (toglie cio' che si muove
lungo la sessione). Resta il confronto ENTRO pilota, a parita' di momento. La
differenza fra il numero grezzo e quello corretto viene PUBBLICATA: e' il pezzo.

LE DUE CORREZIONI CHE CAMBIANO IL RISULTATO (verificate, non ereditate):
 - la velocita' minima di curva e' ancorata alla POSIZIONE GPS della curva, giro
   per giro, non a un percentile cieco: la Distance della telemetria deriva fino a
   ~20 m su un giro, e un percentile su una pista con curve sopraelevate o kink
   velocissimi misura un rettilineo e lo chiama curva;
 - si tengono solo le CURVE VERE (apice sotto il 70% della Vmax di sessione). A
   Miami le curve 9 e 10 di circuit_info si percorrono a 317 e 326 km/h: li' la
   scia fa GUADAGNARE 5 e 9 km/h, perche' quello e' rettilineo. Mescolarle alle
   curve vere cancella il segnale.

IL t CHE SI PUBBLICA E' CLUSTER-ROBUSTO. I giri di uno stesso pilota non sono
indipendenti: arrivano a BLOCCHI consecutivi dentro o fuori dalla scia (chi insegue
insegue per cinque giri di fila, non a giri alterni). Il SE classico e' percio' troppo
piccolo, e il t esce gonfiato di circa un quarto. Misurato sui quattro sprint:
    Vmax    Miami 8,91 -> 7,07   Cina 5,54 -> 3,93   Canada 7,29 -> 7,33   GB 4,75 -> 4,21
    vmin    Miami -4,67 -> -3,31  Cina -1,78 -> -1,83  Canada -3,09 -> -4,04  GB -4,71 -> -5,57
Il verdetto non cambia in nessuno dei quattro, ma il numero pubblicato dev'essere
quello che i dati sostengono: i cancelli si applicano al t cluster-robusto.

L'ALTRO CANALE DI VELOCITA', DICHIARATO. La Vmax della telemetria e' il PICCO del
giro; il feed ha anche SpeedST, la velocita' al rilevamento del cronometraggio. Sono
due punti diversi della pista, e il pezzo lo dice invece di lasciarlo intendere. Dove
i due canali concordano si guadagna una corroborazione indipendente; dove no, e' un
limite da scrivere in provenienza (misurato: Cina +14,55 vs +11,09, Canada +14,02 vs
+9,70, GB +8,44 vs +6,62 concordano; MIAMI NO — SpeedST +2,87 con t=1,4 contro +8,62
della Vmax telemetrica).

COSA NON SI DICE. Il tempo sul giro NON e' un numero portante di questo pezzo: la
stima corretta non regge la soglia. Si cita solo come non conclusivo. Sul confronto
grezzo si dice quel che e': media e mediana hanno segno opposto in 1 evento su 4
(Canada -0,143 / +0,198), non "in piu' di uno" — negli altri tre sono concordi
(Cina +0,158/+0,297, Miami +0,717/+1,177, GB -0,321/-0,124), e l'articolo NON puo'
annunciare una contraddizione che i suoi numeri non mostrano. E il canale DRS vale 0
su tutti i giri del 2026: nessuna differenza di velocita' qui misurata e' attribuibile
all'ala mobile — se il canale tornasse vivo, il pezzo si fermerebbe da solo (cancello).

python3 UTENTE (fastf1 3.8.3 + numpy). Solo lettura; bozza nell'area Lab. Mai demo/.
"""
from __future__ import annotations
import os
import sys
import json
import datetime
import statistics as st

_QUI = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, _QUI)
import tele     # noqa: E402
import sprint   # noqa: E402
import svg      # noqa: E402
import base     # noqa: E402

ID = "sprint-aria"
REPO = base.REPO

# --- cancelli, fissati prima di guardare i dati -------------------------------
MIN_PILOTI = 8      # piloti con entrambe le condizioni: sotto, non e' un campo
MIN_GIRI = 60       # giri utilizzabili totali
T_PORTANTE = 3.0    # |t| richiesto al numero che regge il pezzo (Vmax)
T_CITABILE = 2.0    # |t| sotto cui un numero e' dichiarato NON conclusivo


def it(x, dec=1):
    return base.it(x, dec)


def _slug(s):
    out = []
    for ch in str(s).lower().strip():
        if ch.isalnum():
            out.append(ch)
        elif out and out[-1] != "-":
            out.append("-")
    return "".join(out).strip("-") or "gp"


def _reg():
    try:
        return json.load(open(os.path.join(REPO, "data", "gare_registro.json")))
    except Exception:
        return {}


# ---------------------------------------------------------------------------
# MISURA
# ---------------------------------------------------------------------------
def _misura(anno, gara):
    ses = tele.carica_sessione(anno, gara, "S")
    if not sprint.e_sprint(ses):
        return None
    piloti = tele.piloti_sessione(ses)
    inv = {v["num"]: (k, v["team"]) for k, v in piloti.items()}

    quota_drs, campioni_drs = sprint.canale_drs_nullo(ses)
    if quota_drs is None or quota_drs > 0:
        # CANCELLO: col DRS vivo il guadagno sul dritto non e' della sola scia.
        return {"stop": "drs", "quota_drs": quota_drs}

    curve_l, curve_scartate, vmax_med = sprint.curve_vere(ses)
    if not curve_l:
        return {"stop": "curve"}

    puliti = sprint.giri_puliti(ses)
    righe = []
    n_gps = n_lap_tel = 0
    for num, rr in puliti.items():
        sig, team = inv.get(num, (num, "?"))
        modale = sprint.mescola_modale(rr)
        for r in rr:
            if r["mescola"] != modale:
                continue                      # "stessa gomma": mai fra mescole diverse
            cls = sprint.classe_aria(r["gap"])
            if cls is None:
                continue                      # cuscinetto fra 1 e 2 s: escluso
            try:
                tel = tele.canale_giro(r["lap"])
            except Exception:
                continue
            ap, gps = sprint.apici_giro(r["lap"], tel, curve_l)
            # la minima di curva del giro e' la MEDIA sulle curve vere: perche' sia
            # confrontabile fra giri devono esserci TUTTE (una mediana "sulle curve
            # disponibili" salta da una curva all'altra e diventa rumore: misurato,
            # a Miami la mediana da' t=-1,5 dove la media da' t=-4,7).
            if any(a is None for a in ap):
                continue
            n_lap_tel += 1
            n_gps += 1 if gps else 0
            # SpeedST: velocita' alla TRAPPOLA del cronometraggio, canale del feed
            # indipendente dalla telemetria vettura. Serve a corroborare (o smentire)
            # il numero portante: sono due punti diversi della pista, e dirlo e' il
            # minimo — la Vmax e' il PICCO del giro, non la velocita' al rilevamento.
            v_st = r["lap"].get("SpeedST")
            try:
                v_st = float(v_st) if v_st == v_st else None
            except Exception:
                v_st = None
            righe.append({
                "sig": sig, "team": team, "num": num, "ln": r["ln"], "scia": cls,
                "gap": r["gap"], "mescola": modale, "eta": r["eta"],
                "vmax": float(tel["Speed"].max()),
                "vmin": st.mean(ap),
                "st": v_st,
                "lap_s": r["sec"],
                "apici": ap,
            })
    import curve as _curve
    return {"ses": ses, "righe": righe, "curve": curve_l, "curve_scartate": curve_scartate,
            "n_curve_pista": len(_curve.curve(ses)),
            "vmax_med": vmax_med, "quota_drs": quota_drs, "campioni_drs": campioni_drs,
            "n_gps": n_gps, "n_lap_tel": n_lap_tel, "piloti": piloti,
            "n_giri_sprint": int(ses.laps["LapNumber"].max()) if len(ses.laps) else 0}


def t_pub(s):
    """Il t che si PUBBLICA: quello con SE cluster-robusto per pilota.

    Il SE classico assume giri indipendenti; i giri di uno stesso pilota arrivano
    invece a blocchi consecutivi dentro o fuori dalla scia, e il t ne esce gonfiato di
    circa un quarto (misurato: Vmax Miami 8,9 -> 7,1). I cancelli si applicano a
    QUESTO t, non a quello ottimista."""
    if not s:
        return None
    return s["t_cluster"] if s.get("t_cluster") is not None else s.get("t")


def se_pub(s):
    """Il ± che si pubblica, coerente con t_pub."""
    if not s:
        return None
    return s["se_cluster"] if s.get("se_cluster") is not None else s.get("se")


def _stima_curve(righe, curve_l, trend_tempo="ln"):
    """Coefficiente a effetti fissi curva per curva (chi paga dove)."""
    out = []
    for i, c in enumerate(curve_l):
        rr = [dict(r, y=r["apici"][i]) for r in righe if r["apici"][i] is not None]
        s = sprint.effetti_fissi(rr, "y")
        if s:
            out.append({"numero": c["numero"], "lettera": c["lettera"],
                        "dist": c["dist"], "apice_med": c["apice_med"],
                        "coef": s["coef"], "t": t_pub(s), "t_classico": s["t"],
                        "n": s["n"]})
    return out


# ---------------------------------------------------------------------------
# COSTRUZIONE
# ---------------------------------------------------------------------------
def costruisci(anno, gara, data_bozza=None):
    m = _misura(anno, gara)
    if not m or m.get("stop"):
        return None
    righe = m["righe"]
    if len(righe) < MIN_GIRI:
        return None

    s_vmax = sprint.effetti_fissi(righe, "vmax")
    if not s_vmax or s_vmax["n_piloti"] < MIN_PILOTI:
        return None
    # CANCELLO PORTANTE: senza un guadagno di Vmax netto e solido non c'e' pezzo.
    # Il t e' quello CLUSTER-ROBUSTO per pilota (t_pub), non quello classico: i giri
    # di uno stesso pilota non sono indipendenti e il t classico e' gonfio di ~25%.
    t_vmax = t_pub(s_vmax)
    if not (s_vmax["coef"] > 0 and t_vmax is not None and t_vmax >= T_PORTANTE):
        return None

    s_vmin = sprint.effetti_fissi(righe, "vmin")
    s_lap = sprint.effetti_fissi(righe, "lap_s")
    # l'altro canale di velocita' del feed: SpeedST, la velocita' al rilevamento.
    righe_st = [r for r in righe if r.get("st") is not None]
    s_st = sprint.effetti_fissi(righe_st, "st") if len(righe_st) >= MIN_GIRI // 2 else None
    t_vmin, t_lap, t_st = t_pub(s_vmin), t_pub(s_lap), t_pub(s_st)
    vmin_solido = bool(t_vmin is not None and abs(t_vmin) >= T_CITABILE)
    lap_solido = bool(t_lap is not None and abs(t_lap) >= T_CITABILE)
    st_conferma = bool(s_st and s_st["coef"] > 0 and t_st is not None and t_st >= T_CITABILE)

    ses = m["ses"]
    colori = base.carica_colori()
    reg = _reg()
    ev = ses.event
    circuito = str(ev["Location"]) if "Location" in ev else gara
    gp_it = next((k for k, v in reg.items() if v.get("ti") == str(ev["EventName"])), None) or gara
    try:
        rnd = int(ev["RoundNumber"])
    except Exception:
        rnd = None
    slug = _slug(circuito)

    def col(team):
        return colori.get(team) or "var(--dim)"

    scia = [r for r in righe if r["scia"] == 1]
    libera = [r for r in righe if r["scia"] == 0]
    grezzo_vmax = st.mean([r["vmax"] for r in scia]) - st.mean([r["vmax"] for r in libera])
    grezzo_vmin = st.mean([r["vmin"] for r in scia]) - st.mean([r["vmin"] for r in libera])
    grezzo_lap_media = st.mean([r["lap_s"] for r in scia]) - st.mean([r["lap_s"] for r in libera])
    grezzo_lap_mediana = st.median([r["lap_s"] for r in scia]) - st.median([r["lap_s"] for r in libera])
    dgiro = st.mean([r["ln"] for r in scia]) - st.mean([r["ln"] for r in libera])
    gonfio = grezzo_vmax - s_vmax["coef"]

    per_pilota = sprint.delta_per_pilota(righe, "vmax", s_vmax["trend"])
    ordinati = sorted(per_pilota.items(), key=lambda kv: -kv[1]["delta"])
    n_pos = sum(1 for _s, d in per_pilota.items() if d["delta"] > 0)
    team_di = {r["sig"]: r["team"] for r in righe}
    mescola_di = {r["sig"]: r["mescola"] for r in righe}

    # esposizione: quota di giri passati in scia, per pilota
    esposiz = {}
    for r in righe:
        e = esposiz.setdefault(r["sig"], [0, 0])
        e[0] += 1 if r["scia"] else 0
        e[1] += 1
    esp_ord = sorted(esposiz.items(), key=lambda kv: -(kv[1][0] / kv[1][1]))

    curve_stim = _stima_curve(righe, m["curve"])
    curve_perse = [c for c in curve_stim if c["coef"] < 0 and c["t"] is not None and c["t"] <= -T_CITABILE]
    peggiore = min(curve_stim, key=lambda c: c["coef"]) if curve_stim else None

    accent = col(team_di.get(ordinati[0][0], "")) if ordinati else "var(--accent)"

    # ------------------------------------------------------------------ FIGURE
    fig_a = svg.barre_divergenti(
        [{"label": s, "valore": d["delta"],
          "nota": f"{d['n_scia']}+{d['n_libera']} giri"} for s, d in ordinati],
        col_pos=accent, col_neg="var(--dim)",
        lbl_pos="più veloce in scia", lbl_neg="più veloce in aria libera",
        titolo="Quanti km/h regala la scia, pilota per pilota",
        sub=f"Sprint {gp_it} {anno} · {len(ordinati)} piloti",
        unita="km/h",
        caption=("velocità massima del giro, differenza entro-pilota fra giri in scia e giri "
                 "liberi, al netto della tendenza comune sul numero di giro (km/h, arrotondati)"))

    fig_b = svg.barre_dv(
        [{"sigla": s, "colore": col(team_di.get(s, "")),
          "valore": 100.0 * v[0] / v[1], "evidenza": v[0] / v[1] >= 0.5}
         for s, v in esp_ord],
        titolo="Chi ha passato la sprint dentro la scia di un altro",
        sub=f"Sprint {gp_it} {anno}", unita="%", base=0.0, ml=58, dec=0,
        caption=(f"% dei giri puliti passati entro {it(sprint.SCIA_S,1)} s dalla macchina davanti "
                 f"— è la composizione che rende ingannevole il confronto grezzo"))

    fig_c = None
    if curve_stim:
        fig_c = svg.barre_divergenti(
            [{"label": f"T{c['numero']}{c['lettera']}", "valore": c["coef"],
              "nota": f"apice {c['apice_med']:.0f} km/h"} for c in curve_stim],
            col_pos="var(--dim)", col_neg=accent,
            lbl_pos="più veloce in scia", lbl_neg="più lento in scia",
            titolo="Dove si paga il conto: la minima all'apice, curva per curva",
            sub=f"Sprint {gp_it} {anno} · {len(m['curve'])} curve vere",
            unita="km/h",
            caption=("curve in ordine di giro; solo quelle con apice sotto il "
                     f"{int(sprint.QUOTA_LENTA*100)}% della Vmax di sessione (le altre sono "
                     "rettilineo). Stima a effetti fissi, km/h arrotondati"))

    # ------------------------------------------------------------------ FACTS
    F = {
        "id": ID, "anno": anno, "gara": gp_it, "circuito": circuito, "round": rnd,
        "sessione": "Sprint", "n_giri_sprint": m["n_giri_sprint"],
        "campione": {
            "giri_usati": len(righe), "in_scia": len(scia), "in_aria_libera": len(libera),
            "piloti_confrontabili": s_vmax["n_piloti"], "piloti": s_vmax["piloti"],
            "mescole": sorted({r["mescola"] for r in righe}),
            "ancoraggio_gps": f"{m['n_gps']}/{m['n_lap_tel']} giri",
        },
        "parametri": {"scia_s": sprint.SCIA_S, "libera_s": sprint.LIBERA_S,
                      "quota_curva_lenta": sprint.QUOTA_LENTA,
                      "finestra_apice_m": [-sprint.FIN_INDIETRO, sprint.FIN_AVANTI],
                      "t_portante": T_PORTANTE, "t_citabile": T_CITABILE},
        "vmax": {"netto": s_vmax["coef"], "se": se_pub(s_vmax), "t": t_vmax,
                 "se_classico": s_vmax["se"], "t_classico": s_vmax["t"],
                 "grezzo": grezzo_vmax, "gonfiaggio": gonfio,
                 "trend_per_giro": s_vmax["trend"], "delta_giro_medio": dgiro,
                 "piloti_positivi": n_pos, "piloti_totali": len(per_pilota)},
        "vmax_trappola": {"netto": s_st["coef"] if s_st else None,
                          "se": se_pub(s_st), "t": t_st,
                          "n": s_st["n"] if s_st else 0,
                          "conferma": st_conferma,
                          "cosa_e": ("SpeedST: velocità al rilevamento del cronometraggio, "
                                     "canale del feed indipendente dalla telemetria vettura. "
                                     "La Vmax è invece il PICCO del giro: sono due punti "
                                     "diversi della pista")},
        "vmin_curva": {"netto": s_vmin["coef"] if s_vmin else None,
                       "se": se_pub(s_vmin), "t": t_vmin,
                       "se_classico": s_vmin["se"] if s_vmin else None,
                       "t_classico": s_vmin["t"] if s_vmin else None,
                       "grezzo": grezzo_vmin, "solido": vmin_solido},
        "tempo_sul_giro": {"netto": s_lap["coef"] if s_lap else None,
                           "se": se_pub(s_lap), "t": t_lap,
                           "se_classico": s_lap["se"] if s_lap else None,
                           "t_classico": s_lap["t"] if s_lap else None,
                           "grezzo_media": grezzo_lap_media,
                           "grezzo_mediana": grezzo_lap_mediana,
                           "solido": lap_solido},
        "curve": {"vere": [{"numero": c["numero"], "lettera": c["lettera"],
                            "dist": c["dist"], "apice_med": c["apice_med"]} for c in m["curve"]],
                  "scartate": [{"numero": c["numero"], "apice_med": c["apice_med"]}
                               for c in m["curve_scartate"]],
                  "vmax_sessione": m["vmax_med"],
                  "stima": curve_stim,
                  "peggiore": peggiore,
                  "perse_solide": [f"T{c['numero']}{c['lettera']}" for c in curve_perse]},
        "drs": {"quota_non_nulla": m["quota_drs"], "campioni": m["campioni_drs"]},
        "per_pilota": [{"sig": s, "team": team_di.get(s), "mescola": mescola_di.get(s),
                        "delta_vmax": d["delta"], "n_scia": d["n_scia"],
                        "n_libera": d["n_libera"],
                        "quota_scia": esposiz[s][0] / esposiz[s][1]} for s, d in ordinati],
    }

    # ------------------------------------------------------------------ PROSA
    # il "caso più marcato" si sceglie fra chi ha abbastanza giri da entrambe le
    # parti: un pilota con due giri in scia farebbe un titolo su niente.
    solidi_pil = [(s, d) for s, d in ordinati if d["n_scia"] >= 4 and d["n_libera"] >= 4]
    primo = (solidi_pil or ordinati)[0] if ordinati else None
    n_fuse = m["n_curve_pista"] - len(m["curve"]) - len(m["curve_scartate"])
    scart_txt = ""
    if m["curve_scartate"]:
        cc = sorted(m["curve_scartate"], key=lambda c: -c["apice_med"])[:2]
        altre = len(m["curve_scartate"]) - len(cc)
        scart_txt = (" Restano fuori le curve che curve non sono: "
                     + ", ".join(f"T{c['numero']} (apice {it(c['apice_med'],0)} km/h)" for c in cc)
                     + ("" if altre <= 0 else (" e un'altra" if altre == 1 else f" e altre {altre}"))
                     + f", con la Vmax di sessione a {it(m['vmax_med'],0)} km/h: lì la scia fa "
                       f"guadagnare velocità, perché quello è rettilineo.")
    if n_fuse > 0:
        scart_txt += (f" Altre {n_fuse} spariscono per fusione: curve a meno di "
                      f"{it(sprint.DIST_MIN_CURVE,0)} m l'una dall'altra sono una staccata sola, e "
                      f"si tiene la più lenta." if n_fuse > 1 else
                      f" Un'altra sparisce per fusione: due curve a meno di "
                      f"{it(sprint.DIST_MIN_CURVE,0)} m l'una dall'altra sono una staccata sola, e "
                      f"si tiene la più lenta.")

    if vmin_solido:
        curva_txt = (f"All'apice delle curve vere la stessa scia costa "
                     f"<b>{it(abs(s_vmin['coef']),1)} km/h</b> "
                     f"(±{it(se_pub(s_vmin),1)}): meno aria pulita sulle ali, meno appoggio.")
        prov_vmin = {
            "grandezza": "velocità minima all'apice, effetto della scia",
            "valore": f"{it(s_vmin['coef'],2)} km/h (±{it(se_pub(s_vmin),2)}, t={it(t_vmin,1)})",
            "stato": "MISURATO",
            "da": (f"media delle minime sulle {len(m['curve'])} curve vere (apice ancorato al GPS "
                   f"giro per giro, tutte presenti), stessa stima a effetti fissi")}
    else:
        curva_txt = (f"All'apice la stima è nella direzione attesa "
                     f"({it(s_vmin['coef'],1) if s_vmin else '–'} km/h) ma <b>non regge la soglia</b> "
                     f"che ci siamo dati (|t| ≥ {it(T_CITABILE,0)}): in questa sprint la perdita in "
                     f"curva non è un numero da titolo.")
        prov_vmin = {
            "grandezza": "velocità minima all'apice, effetto della scia",
            "valore": (f"{it(s_vmin['coef'],2)} km/h ma t={it(t_vmin,1)}: non conclusivo"
                       if s_vmin else "non stimabile"),
            "stato": "NON_MISURABILE",
            "da": f"sotto la soglia |t| ≥ {it(T_CITABILE,0)} fissata prima della misura"}

    if lap_solido:
        lap_txt = (f"Sul tempo sul giro l'effetto qui si vede: "
                   f"<b>{it(s_lap['coef'],3)} s</b> (±{it(se_pub(s_lap),3)}). Resta però il numero "
                   f"più fragile del pezzo — in altre sprint cambia di segno.")
    else:
        # ATTENZIONE: la frase sul "confronto grezzo che si contraddice" vale SOLO se
        # media e mediana hanno davvero segno opposto. Prima era cablata nel ramo else
        # e usciva sempre: a Miami diceva "si contraddice da solo (media 0,717, mediana
        # 1,177)" — due numeri positivi e concordi, con la mediana anzi PIU' grande.
        # Misurato sui quattro sprint: segno opposto in 1 evento su 4 (Canada).
        grezzo_discorde = (grezzo_lap_media > 0) != (grezzo_lap_mediana > 0)
        if grezzo_discorde:
            grezzo_txt = (f"e il confronto grezzo si contraddice da solo (media "
                          f"{it(grezzo_lap_media,3)} s, mediana {it(grezzo_lap_mediana,3)} s: "
                          f"segno opposto)")
        else:
            grezzo_txt = (f"e nemmeno il confronto grezzo aiuta (media "
                          f"{it(grezzo_lap_media,3)} s, mediana {it(grezzo_lap_mediana,3)} s: "
                          f"stesso verso, ma è un numero non corretto — dentro ci sono chi e "
                          f"quando, non la scia)")
        lap_txt = (f"Sul <b>tempo sul giro</b>, invece, non c'è verdetto: la stima corretta vale "
                   f"{it(s_lap['coef'],3) if s_lap else '–'} s e non regge la soglia, "
                   f"{grezzo_txt}. Chi sta in scia perde tempo, ma quanto non lo "
                   f"dicono questi dati.")

    art = {
        "id": ID, "slug": slug, "stato": "bozza",
        "data": data_bozza or datetime.date.today().isoformat(),
        "firma": "Muretto · Redazione tecnica", "accent": accent,
        "canale": "A (sprint, tutto il gruppo)",
        "gp": gp_it, "gara": gp_it, "circuito": circuito, "sessione": "Sprint", "round": rnd,
        "tag": ["sprint", "aria sporca", "scia", "telemetria", circuito],
        "occhiello": f"Sprint · {gp_it} {anno}",
        "titolo": (f"Il prezzo dell'aria sporca a {circuito}: "
                   f"+{it(s_vmax['coef'],1)} km/h sul dritto"
                   + (f", {it(abs(s_vmin['coef']),1)} in meno all'apice" if vmin_solido else "")),
        "sommario": (
            f"Nella sprint di {gp_it} abbiamo confrontato, per ogni pilota e sulla stessa mescola, "
            f"i giri passati entro {it(sprint.SCIA_S,1)} s dalla macchina davanti con i suoi giri "
            f"in aria libera: {len(scia)} contro {len(libera)}. Stare in scia vale "
            f"<b>{it(s_vmax['coef'],1)} km/h</b> di velocità massima, e vale per "
            f"{n_pos} piloti su {len(per_pilota)}. Il confronto grezzo direbbe "
            f"{it(grezzo_vmax,1)} km/h: {it(gonfio,1)} km/h sono un artefatto di chi e quando, non "
            f"della scia. {curva_txt} Il canale DRS è nullo su tutti i giri: qui non c'entra."),
        "sezioni": [
            {"tag": "Evidenza",
             "titolo": f"Sul dritto la scia vale {it(s_vmax['coef'],1)} km/h",
             "html": (
                f"<p>La misura è la più semplice che si possa fare e la più difficile da fare bene: "
                f"<b>stessa macchina, stessa sessione, stessa mescola</b>. Di ogni pilota prendiamo i "
                f"giri puliti della sprint e li dividiamo in due: quelli corsi entro "
                f"<b>{it(sprint.SCIA_S,1)} s</b> dalla macchina davanti e quelli in aria libera (oltre "
                f"{it(sprint.LIBERA_S,1)} s, o in testa). In mezzo c'è un cuscinetto che scartiamo: un "
                f"giro a un secondo e mezzo non è né una cosa né l'altra.</p>"
                f"<p>Sui {len(righe)} giri utilizzabili di {s_vmax['n_piloti']} piloti, la scia vale "
                f"<b>+{it(s_vmax['coef'],2)} km/h</b> di velocità massima (±{it(se_pub(s_vmax),2)}, "
                f"t={it(t_vmax,1)}). L'incertezza è raggruppata per pilota, non per giro: i giri "
                f"di uno stesso pilota arrivano a blocchi consecutivi dentro o fuori dalla scia — "
                f"chi insegue insegue per cinque giri di fila — e trattarli come indipendenti "
                f"gonfierebbe il t di circa un quarto (qui direbbe {it(s_vmax['t'],1)}). Non è una "
                f"media di gruppo: è la differenza <b>dentro</b> "
                f"ciascun pilota, e va nella stessa direzione per "
                f"<b>{n_pos} piloti su {len(per_pilota)}</b>. "
                + (f"Il caso più marcato è {primo[0]}, {it(primo[1]['delta'],1)} km/h "
                   f"({primo[1]['n_scia']} giri in scia contro {primo[1]['n_libera']} liberi).</p>"
                   if primo else "</p>")),
             "figura": {"svg": fig_a,
                "didascalia": (
                    "Differenza di velocità massima fra i giri in scia e i giri in aria libera, "
                    "pilota per pilota, dopo aver tolto la tendenza comune sul numero di giro. "
                    "A destra chi guadagna in scia."),
                "fonte": f"FastF1 · telemetria vettura Sprint {gp_it} {anno} — confronto entro pilota"}},

            {"tag": "Causa",
             "titolo": f"Perché il numero grezzo ({it(grezzo_vmax,1)} km/h) è gonfiato",
             "html": (
                f"<p>Se ci si limita a mettere in fila tutti i giri in scia contro tutti i giri liberi, "
                f"viene <b>{it(grezzo_vmax,1)} km/h</b>. È un numero sbagliato, e si può dire "
                f"esattamente di quanto: <b>{it(gonfio,1)} km/h</b>. Il confronto grezzo mescola due "
                f"cose che con la scia non c'entrano.</p>"
                f"<p>La prima è <b>chi</b>: in scia ci sta chi insegue, cioè sistematicamente un altro "
                f"pilota, con un'altra macchina. La seconda è <b>quando</b>: i giri in scia cadono in "
                f"media {it(abs(dgiro),1)} giri "
                f"{'prima' if dgiro < 0 else 'dopo'} di quelli liberi, e lungo la sprint la velocità "
                f"massima si sposta da sola di {it(abs(s_vmax['trend']),2)} km/h al giro "
                f"({'in calo' if s_vmax['trend'] < 0 else 'in crescita'}) fra benzina che cala, gomma "
                f"che invecchia e pista che gomma. Una costante per pilota toglie il primo effetto, "
                f"una tendenza lineare sul numero di giro toglie il secondo: quello che resta è la "
                f"scia. La figura mostra la composizione del campione — chi ha vissuto lì dentro e "
                f"chi no.</p>"),
             "figura": {"svg": fig_b,
                "didascalia": (
                    f"Quota dei giri puliti passati entro {it(sprint.SCIA_S,1)} s dalla macchina "
                    f"davanti. Più il campione è sbilanciato, più il confronto grezzo confonde la "
                    f"scia con l'identità del pilota."),
                "fonte": f"FastF1 · laps Sprint {gp_it} {anno} — gap alla macchina davanti per giro"}},

            {"tag": "Effetto",
             "titolo": "Il conto si paga all'apice",
             "html": (
                f"<p>{curva_txt} La minima di curva è misurata dove la curva è davvero: l'apice viene "
                f"ancorato alla <b>posizione GPS</b> della curva giro per giro, non a un percentile "
                f"sulla distribuzione delle velocità. La differenza non è accademica: la distanza "
                f"ricostruita dalla telemetria deriva fino a una ventina di metri nell'arco di un "
                f"giro, e con curve a poche decine di metri l'una dall'altra si finisce a misurare la "
                f"curva sbagliata. Poi si tengono solo le <b>curve vere</b>: quelle con l'apice sotto "
                f"il {int(sprint.QUOTA_LENTA*100)}% della velocità massima di sessione, "
                f"{len(m['curve'])} sulle {m['n_curve_pista']} del tracciato.{scart_txt}</p>"
                f"<p>Una precisazione sul numero portante, perché il titolo non dica più di quello "
                f"che c'è: quei {it(s_vmax['coef'],1)} km/h sono il <b>picco del giro</b>, non la "
                f"velocità al rilevamento. Il feed porta anche l'altro canale, SpeedST, che misura "
                f"alla trappola del cronometraggio — un punto diverso della pista. "
                + (f"Lì la stessa scia vale {it(s_st['coef'],1)} km/h (t={it(t_st,1)}), "
                   + ("e corrobora il numero della telemetria da una fonte indipendente."
                      if st_conferma else
                      "cioè <b>non corrobora</b>: stesso verso, ma sotto la soglia. Non è una "
                      "contraddizione — sono due punti della pista — ma il lettore ha diritto di "
                      "sapere che la conferma indipendente qui non c'è.")
                   if s_st else "Su questa sprint quel canale non è stimabile.")
                + f"</p>"
                f"<p>{lap_txt} Un'ultima cosa da mettere per iscritto: nel 2026 il canale <b>DRS è "
                f"nullo su tutti i giri di tutte le sessioni</b> — verificato su "
                f"{m['campioni_drs']} campioni di questa sprint. Nessuno dei km/h di cui sopra è "
                f"attribuibile a un'ala mobile: è aria, e basta.</p>"),
             **({"figura": {"svg": fig_c,
                "didascalia": (
                    f"Effetto della scia sulla minima all'apice, curva per curva, nell'ordine del "
                    f"giro. A sinistra le curve dove stare in scia costa velocità"
                    + (f"; la peggiore è T{peggiore['numero']}{peggiore['lettera']} "
                       f"({it(peggiore['coef'],1)} km/h)" if peggiore else "") + "."),
                "fonte": f"FastF1 · telemetria + circuit_info Sprint {gp_it} {anno} — apice ancorato al GPS"}}
                if fig_c else {})},
        ],
        "provenienza": [
            {"grandezza": "guadagno di velocità massima in scia",
             "valore": f"+{it(s_vmax['coef'],2)} km/h (±{it(se_pub(s_vmax),2)}, t={it(t_vmax,1)}, "
                       f"{len(righe)} giri, {s_vmax['n_piloti']} piloti)",
             "stato": "MISURATO",
             "da": ("stima a effetti fissi di pilota con tendenza lineare sul numero di giro; "
                    f"scia ≤{it(sprint.SCIA_S,1)} s, aria libera >{it(sprint.LIBERA_S,1)} s, "
                    "confronto solo entro la stessa mescola")},
            {"grandezza": "che velocità è il numero portante",
             "valore": "il PICCO del giro (telemetria vettura), non la velocità al rilevamento",
             "stato": "MISURATO",
             "da": ("Speed.max() sul canale di telemetria del giro. Il feed ha anche SpeedST, "
                    "che è la velocità alla trappola del cronometraggio: punto diverso della "
                    "pista, quindi un numero diverso — non una contraddizione, ma va detto")},
            {"grandezza": "corroborazione sull'altro canale (SpeedST)",
             "valore": (f"{it(s_st['coef'],2)} km/h (±{it(se_pub(s_st),2)}, t={it(t_st,1)}, "
                        f"{s_st['n']} giri) — "
                        + ("CONFERMA il verso e la solidità"
                           if st_conferma else
                           "NON conferma: stesso verso ma sotto la soglia, "
                           f"|t| < {it(T_CITABILE,0)}")
                        if s_st else "non stimabile su questa sprint"),
             "stato": "MISURATO" if st_conferma else "NON_MISURABILE",
             "da": ("stessa stima a effetti fissi sulla colonna SpeedST dei laps, canale del "
                    "cronometraggio indipendente dalla telemetria vettura. Non è un cancello: "
                    "i due canali misurano punti diversi della pista e possono legittimamente "
                    "differire — è la loro DIVERGENZA che va dichiarata, non nascosta")},
            {"grandezza": "confronto grezzo (non corretto)",
             "valore": f"{it(grezzo_vmax,2)} km/h — {it(gonfio,2)} km/h di gonfiaggio",
             "stato": "MISURATO",
             "da": ("differenza fra le medie dei due gruppi senza correzione: mescola piloti diversi "
                    f"e momenti diversi (i giri in scia cadono {it(abs(dgiro),1)} giri "
                    f"{'prima' if dgiro < 0 else 'dopo'})")},
            {"grandezza": "concordanza fra i piloti",
             "valore": f"{n_pos} piloti su {len(per_pilota)} nella stessa direzione",
             "stato": "MISURATO",
             "da": "differenza entro-pilota al netto della tendenza comune sul numero di giro"},
            prov_vmin,
            {"grandezza": "effetto sul tempo sul giro",
             "valore": (f"{it(s_lap['coef'],3)} s (t={it(t_lap,1)}) — "
                        + ("citabile" if lap_solido else "NON conclusivo")
                        + f"; grezzo: media {it(grezzo_lap_media,3)} s, mediana "
                          f"{it(grezzo_lap_mediana,3)} s" if s_lap else "non stimabile"),
             "stato": "MISURATO" if lap_solido else "NON_MISURABILE",
             "da": ("stessa stima; NON è un numero portante di questo pezzo: media e mediana del "
                    "confronto grezzo possono avere segno opposto")},
            {"grandezza": "curve tenute nella misura",
             "valore": (f"{len(m['curve'])} curve vere sulle {m['n_curve_pista']} del "
                        f"tracciato (apice < "
                        f"{int(sprint.QUOTA_LENTA*100)}% di {it(m['vmax_med'],0)} km/h)"),
             "stato": "MISURATO",
             "da": ("circuit_info FastF1; apice ancorato alla posizione GPS della curva giro per "
                    f"giro ({m['n_gps']}/{m['n_lap_tel']} giri), finestra "
                    f"−{it(sprint.FIN_INDIETRO,0)}/+{it(sprint.FIN_AVANTI,0)} m")},
            {"grandezza": "canale DRS",
             "valore": "nullo su tutti i giri campionati",
             "stato": "MISURATO",
             "da": (f"{m['campioni_drs']} campioni di telemetria di questa sprint: nessuna differenza "
                    "di velocità qui misurata è attribuibile all'ala mobile")},
            {"grandezza": "carico di carburante e mappe motore",
             "valore": "non separabili dall'evoluzione della pista",
             "stato": "NON_MISURABILE",
             "da": ("la tendenza lineare sul numero di giro li assorbe insieme; nessun canale di "
                    "carburante o di mappa è nel feed")},
            {"grandezza": "chi era la macchina davanti",
             "valore": "non entra nella misura",
             "stato": "NON_MISURABILE",
             "da": ("il gap dice la distanza, non quanta scia produce quella macchina né se il "
                    "pilota stesse attaccando o gestendo")},
        ],
        "fonti": [
            {"tipo": "dati",
             "testo": (f"FastF1 3.8.3 — laps + telemetria vettura (Speed/DRS) + posizione GPS + "
                       f"circuit_info, Sprint {str(ev['EventName'])} {anno} "
                       f"(round {rnd}, {circuito})")},
            {"tipo": "metodo",
             "testo": ("ai_lab/redazione/genera_sprint_aria.py (misure in sprint.py) — giri verdi "
                       "puliti (TrackStatus «1», senza out/in-lap, cancellati, primo giro di stint), "
                       "confronto solo entro la stessa mescola; scia ≤"
                       f"{it(sprint.SCIA_S,1)} s vs aria libera >{it(sprint.LIBERA_S,1)} s con "
                       "cuscinetto escluso; stima a effetti fissi di pilota + tendenza lineare sul "
                       "numero di giro; minima di curva ancorata al GPS e limitata alle curve con "
                       f"apice < {int(sprint.QUOTA_LENTA*100)}% della Vmax di sessione. Cancelli: "
                       f"DRS non nullo, |t| < {it(T_PORTANTE,0)} sulla Vmax, meno di {MIN_PILOTI} "
                       f"piloti o {MIN_GIRI} giri → l'articolo non esce.")},
        ],
    }
    return F, art


META = {
    "id": ID, "canale": "A",
    "titolo": "Il prezzo dell'aria sporca (sprint)",
    "tag": ["sprint", "scia", "aria sporca", "telemetria"],
    "descrizione": ("quanto vale stare attaccati: velocità massima e minima di curva, stessa "
                    "macchina e stessa gomma, a effetti fissi di pilota"),
    "richiede": "telemetria", "sessioni": ["S"], "gare": ["*"],
}


def genera(gara=None, data=None, sessione=None):
    if gara is None:
        return None
    anno = int(str(data)[:4]) if data else datetime.date.today().year
    try:
        r = costruisci(anno, gara, data_bozza=data)
    except Exception:
        if os.environ.get("REDAZIONE_DEBUG"):
            raise
        return None
    if not r:
        return None
    F, art = r
    bid = f"{ID}-{art['slug']}-{F['anno']}"
    art["id"] = bid
    base.scrivi_bozza(bid, art, F)
    return {"id": bid, "titolo": art["titolo"], "stato": art["stato"], "canale": "A"}


if __name__ == "__main__":
    import argparse
    ap = argparse.ArgumentParser()
    ap.add_argument("--gara", required=True)
    ap.add_argument("--anno", type=int, default=2026)
    ap.add_argument("--data", default=None)
    ap.add_argument("--solo-misura", action="store_true")
    a = ap.parse_args()
    r = costruisci(a.anno, a.gara, data_bozza=a.data)
    if not r:
        print(f"{a.gara}: cancello chiuso o evento senza sprint — nessuna bozza")
        sys.exit(1)
    F, art = r
    bid = f"{ID}-{art['slug']}-{F['anno']}"
    art["id"] = bid
    print(f"TITOLO: {art['titolo']}")
    print(f"  campione: {F['campione']['giri_usati']} giri "
          f"({F['campione']['in_scia']} scia / {F['campione']['in_aria_libera']} liberi), "
          f"{F['campione']['piloti_confrontabili']} piloti, mescole {F['campione']['mescole']}")
    print(f"  ancoraggio GPS: {F['campione']['ancoraggio_gps']}")
    print(f"  Vmax netto {it(F['vmax']['netto'],2)} km/h (se {it(F['vmax']['se'],2)}, "
          f"t {it(F['vmax']['t'],2)} cluster; t classico {it(F['vmax']['t_classico'],2)}) · "
          f"grezzo {it(F['vmax']['grezzo'],2)} "
          f"(gonfiaggio {it(F['vmax']['gonfiaggio'],2)}) · concordi "
          f"{F['vmax']['piloti_positivi']}/{F['vmax']['piloti_totali']}")
    print(f"  SpeedST (trappola, canale indipendente) {it(F['vmax_trappola']['netto'],2)} km/h "
          f"(t {it(F['vmax_trappola']['t'],2)}, conferma={F['vmax_trappola']['conferma']})")
    print(f"  minima curva netto {it(F['vmin_curva']['netto'],2)} km/h "
          f"(t {it(F['vmin_curva']['t'],2)}, solido={F['vmin_curva']['solido']}) · "
          f"grezzo {it(F['vmin_curva']['grezzo'],2)}")
    print(f"  tempo sul giro {it(F['tempo_sul_giro']['netto'],3)} s "
          f"(t {it(F['tempo_sul_giro']['t'],2)}, solido={F['tempo_sul_giro']['solido']}) · "
          f"grezzo media {it(F['tempo_sul_giro']['grezzo_media'],3)} / "
          f"mediana {it(F['tempo_sul_giro']['grezzo_mediana'],3)}")
    print(f"  curve vere {len(F['curve']['vere'])} · scartate "
          f"{[c['numero'] for c in F['curve']['scartate']]} · Vmax sessione "
          f"{it(F['curve']['vmax_sessione'],0)}")
    print(f"  curve dove si perde (solide): {F['curve']['perse_solide']}")
    print(f"  DRS non nullo: {F['drs']['quota_non_nulla']} su {F['drs']['campioni']} campioni")
    if not a.solo_misura:
        out = base.scrivi_bozza(bid, art, F)
        print(f"  Bozza {bid} scritta in {out} (prosa {art.get('scrittura','template')})")
