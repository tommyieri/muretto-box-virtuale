"""
Il passo della sprint — pezzo del SABATO nei weekend sprint (sessione "S").

PERCHE' ESISTE. In un weekend normale il passo si legge dalle prove libere lunghe
(genera_fp_passo, sessione FP2). In un weekend sprint FP2 e FP3 NON ESISTONO: c'e'
FP1, poi la Qualifica Sprint, poi la Sprint. L'unico posto dove si vede una vettura
girare a lungo con la stessa gomma e' la sprint stessa. Questo pezzo prende quel
posto, e lo prende con le regole della casa.

LA REGOLA DI TOMMI: MAI GIRI SPARSI. Il passo si misura su SEQUENZE di giri
CONSECUTIVI passati in aria libera, non su giri raccolti qua e la' fra un traffico
e l'altro. Un pilota che infila cinque giri di fila senza nessuno davanti sta
mostrando il suo passo; lo stesso pilota con cinque giri liberi sparpagliati fra
undici giri di coda sta mostrando cinque momenti fortunati.

IL CANCELLO DI COPERTURA (il motivo per cui questo pezzo a volte NON esce). Contare
le sequenze invece dei giri sparsi assottiglia il campione, e non di poco. Misurato
sui quattro sprint gia' corsi del 2026, con soglia 1,5 s, sequenza minima 5 giri e
la sola mescola di campo:
    Cina             4 piloti,  4 team   -> NON ESCE
    Canada           9 piloti,  6 team   -> esce
    Gran Bretagna   11 piloti,  8 team   -> esce
    Miami           12 piloti,  8 team   -> esce
La soglia (8 piloti, 5 team) e' scelta dentro quel salto: fra 4 e 9 c'e' il vuoto.
Sotto, non e' una classifica di passo: sono quattro macchine che hanno trovato
strada libera. In quel caso il generatore ritorna None e il weekend ha un pezzo in
meno — che e' esattamente il punto.

LA CORREZIONE CHE NON SI VEDE MA CAMBIA L'ORDINE. Le sequenze di piloti diversi
cadono in momenti diversi della sprint (misurato a Montreal: dal giro 7 al giro 20
di media). Chi gira libero alla fine ha meno benzina e una pista piu' gommata: e'
piu' veloce senza essere piu' forte. Il modello mette una costante per pilota piu'
UNA tendenza lineare sul numero di giro, comune a tutti: la tendenza si prende
benzina, evoluzione pista e usura media, le costanti restano i livelli. I distacchi
pubblicati sono i livelli, tutti riportati allo stesso giro di riferimento.

E LA RISOLUZIONE, DICHIARATA — MA COPPIA PER COPPIA. Il rumore di gara non sparisce:
da lui si ricava il distacco piu' piccolo che questi dati sanno separare (95%). Sotto
quella soglia due piloti NON sono ordinabili, e l'articolo lo scrive invece di stampare
una classifica al millesimo che non esiste. Per lo stesso motivo la classifica e'
pubblicata a GRUPPI: dentro un gruppo l'ordine e' arbitrario.

Due dettagli che sembrano tecnici e non lo sono, perche' senza di loro la frase "dentro
un gruppo l'ordine non e' informazione" (che implica: FRA gruppi lo e') sarebbe falsa
proprio ai confini.
 - La soglia e' della COPPIA, non del campo. I SE per pilota variano di un fattore 2-3
   dentro lo stesso evento (Miami 0,084-0,147 s; Canada 0,131-0,250; GB 0,240-0,405).
   Con un SE mediano unico, a Silverstone VER e LAW finivano in gruppi diversi per un
   distacco di 0,822 s contro una soglia di 0,820 (margine: 2 millesimi) mentre la
   soglia della LORO coppia e' 0,923 — cioe' NON erano separabili.
 - Il confronto e' col PRECEDENTE, non col capogruppo. Col capogruppo, a Miami ANT
   (0,242) e VER (0,316) finivano in gruppi DIVERSI a 74 millesimi l'uno dall'altro,
   mentre NOR->ANT, a 242 millesimi, stavano nello STESSO gruppo.
Il prezzo, dichiarato in pagina: un gruppo puo' essere piu' largo della soglia della
sua coppia estrema. E' una catena di vicini non separabili, ed e' l'unica affermazione
che i dati reggono.

COSA NON SI DICE. Il degrado: da uno stint solo le pendenze per-stint sono
inaffidabili (verdetto gia' agli atti della casa, rumore ~12x il segnale), e qui la
tendenza sul numero di giro e' UNA per tutti proprio per non fingere di misurarla
pilota per pilota. E l'eta' della gomma non e' separabile dal numero di giro in una
sprint con una sosta sola: si dichiara e basta.

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

ID = "sprint-passo"
REPO = base.REPO

# --- cancelli, fissati sui quattro sprint gia' corsi (vedi testata) -----------
SOGLIA_LIBERA = sprint.LIBERA_SEQ_S   # 1,5 s: oltre questo gap il giro e' libero
SEQ_MIN = 5          # giri CONSECUTIVI liberi perche' la sequenza sia un passo
MIN_PILOTI = 8       # piloti con una sequenza valida: sotto, non e' un campo
MIN_TEAM = 5         # squadre rappresentate: una classifica di 4 team non e' la griglia
MIN_GIRI = 45        # giri totali che entrano nella stima

# La CALIBRAZIONE del cancello, misurata sui quattro sprint gia' corsi del 2026 e
# messa nei fatti: la prosa cita il caso peggiore pescandolo da qui, cosi' nessun
# numero in pagina e' un literal scritto a mano.
CALIBRAZIONE = [
    {"gara": "Miami", "piloti": 12, "team": 8, "esce": True},
    {"gara": "Gran Bretagna", "piloti": 11, "team": 8, "esce": True},
    {"gara": "Canada", "piloti": 9, "team": 6, "esce": True},
    {"gara": "Cina", "piloti": 4, "team": 4, "esce": False},
]


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


def _tempo(sec):
    return base.lap_fmt(sec)


# ---------------------------------------------------------------------------
# MISURA
# ---------------------------------------------------------------------------
def _misura(anno, gara):
    ses = tele.carica_sessione(anno, gara, "S")
    if not sprint.e_sprint(ses):
        return None
    piloti = tele.piloti_sessione(ses)
    inv = {v["num"]: (k, v["team"]) for k, v in piloti.items()}
    puliti = sprint.giri_puliti(ses)
    if not puliti:
        return None

    mescola, giri_mes, giri_tot = sprint.mescola_di_campo(puliti)
    if not mescola:
        return None

    # sequenza libera piu' lunga di OGNI pilota (anche di chi non passera' il taglio:
    # serve alla figura della copertura, che e' il cancello reso visibile)
    copertura = []
    scelte = {}
    for num, rr in puliti.items():
        sig, team = inv.get(num, (num, "?"))
        rr_m = [r for r in rr if r["mescola"] == mescola]
        seqs = sprint.sequenze_libere(rr_m, soglia_s=SOGLIA_LIBERA)
        piu_lunga = max(seqs, key=len) if seqs else []
        copertura.append({"sig": sig, "team": team, "len": len(piu_lunga),
                          "giri_mescola": len(rr_m), "giri_puliti": len(rr)})
        if len(piu_lunga) >= SEQ_MIN:
            scelte[sig] = {"team": team, "num": num, "seq": piu_lunga}
    copertura.sort(key=lambda c: -c["len"])

    righe = []
    for sig, d in scelte.items():
        for r in d["seq"]:
            righe.append({"sig": sig, "team": d["team"], "ln": r["ln"],
                          "sec": r["sec"], "eta": r["eta"], "gap": r["gap"]})
    return {"ses": ses, "piloti": piloti, "mescola": mescola,
            "giri_mescola": giri_mes, "giri_puliti_tot": giri_tot,
            "copertura": copertura, "scelte": scelte, "righe": righe,
            "n_giri_sprint": int(ses.laps["LapNumber"].max()) if len(ses.laps) else 0,
            "n_piloti_sessione": len(piloti)}


# ---------------------------------------------------------------------------
# COSTRUZIONE
# ---------------------------------------------------------------------------
def costruisci(anno, gara, data_bozza=None):
    m = _misura(anno, gara)
    if not m:
        return None
    scelte, righe = m["scelte"], m["righe"]

    # --- CANCELLO DI COPERTURA -------------------------------------------------
    team_ok = {d["team"] for d in scelte.values()}
    if len(scelte) < MIN_PILOTI or len(team_ok) < MIN_TEAM or len(righe) < MIN_GIRI:
        return None

    stima = sprint.livelli_pilota(righe, y="sec", tempo="ln")
    if not stima:
        return None
    liv = stima["livelli"]
    ordinati = sorted(((s, v["livello"]) for s, v in liv.items()), key=lambda kv: kv[1])
    migliore, t_migliore = ordinati[0]
    # gruppi: confronto col PRECEDENTE e soglia della COPPIA (non il SE mediano).
    # Cosi' ogni confine e' una coppia davvero separabile al 95%, che e' quello che
    # la prosa lascia intendere quando dice "dentro un gruppo l'ordine non e' informazione".
    se_di = {s: v["se"] for s, v in liv.items()}
    gruppi, confini = sprint.gruppi_separabili(ordinati, se_di=se_di)
    _sig_ord = [s for s, _ in ordinati]
    soglie_consec = [sprint.soglia_coppia(se_di[a], se_di[b])
                     for a, b in zip(_sig_ord, _sig_ord[1:])]

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

    team_di = {s: d["team"] for s, d in scelte.items()}
    # eta' gomma media dentro ogni sequenza: diagnostica del confondente dichiarato
    eta_med = {}
    for s, d in scelte.items():
        e = [r["eta"] for r in d["seq"] if r["eta"] is not None]
        eta_med[s] = st.mean(e) if e else None
    eta_val = [v for v in eta_med.values() if v is not None]

    # --- FIGURE ---------------------------------------------------------------
    primi = {s for s, _ in gruppi[0]}
    fig_a = svg.barre_dv(
        [{"sigla": s, "colore": col(team_di.get(s, "")),
          "valore": v - t_migliore,
          "evidenza": s in primi}
         for s, v in ordinati],
        titolo=f"Il passo della sprint, distacchi dal migliore",
        sub=(f"Sprint {gp_it} {anno} · {len(ordinati)} piloti · gomma {m['mescola'].lower()} · "
             f"riferimento giro {int(stima['lref'])}"),
        unita="s/giro", base=0.0, ml=58, dec=3,
        caption=(f"secondi al giro persi da {migliore}, a parità di momento della sprint "
                 f"(costante per pilota + tendenza comune sul numero di giro). In evidenza il "
                 f"primo gruppo: al suo interno nessuna coppia consecutiva è separabile al 95%, "
                 f"e la soglia è calcolata coppia per coppia, non con un'unica risoluzione"))

    def _q(vals, p):
        """Percentile per interpolazione lineare (le sequenze sono corte: 5-17 giri,
        e statistics.quantiles non accetta campioni cosi' piccoli senza sorprese)."""
        v = sorted(vals)
        if len(v) == 1:
            return float(v[0])
        i = (len(v) - 1) * p
        lo_i = int(i)
        hi_i = min(lo_i + 1, len(v) - 1)
        return float(v[lo_i] + (v[hi_i] - v[lo_i]) * (i - lo_i))

    fig_b = svg.boxplot(
        [dict(sigla=s, colore=col(team_di.get(s, "")),
              med=st.median(_t), q1=_q(_t, 0.25), q3=_q(_t, 0.75),
              lo=min(_t), hi=max(_t), traffico=False,
              nota=f"giri {liv[s]['ln_min']}–{liv[s]['ln_max']}")
         for s, _v in ordinati
         for _t in [[r["sec"] for r in scelte[s]["seq"]]]],
        titolo="Le sequenze, così come sono state girate",
        sub=f"Sprint {gp_it} {anno} · tempi GREZZI, non corretti",
        unita="s", ml=104, dec=3, x_label="tempo sul giro (s)",
        fmt=lambda x: _tempo(x),
        caption=("i giri veri di ogni sequenza (nessuna correzione): il rettangolo è la "
                 "metà centrale dei giri, i baffi arrivano al più veloce e al più lento, "
                 "la linea è la mediana. L'ordine è quello "
                 "della stima corretta — dove i due ordini non coincidono, è il momento "
                 "della sprint a fare la differenza, non il passo"))

    fig_c = svg.barre_dv(
        [{"sigla": c["sig"], "colore": col(c["team"]),
          "valore": float(c["len"]), "evidenza": c["len"] >= SEQ_MIN}
         for c in m["copertura"]],
        titolo="Quanti giri di fila ha girato libero, ciascuno",
        sub=f"Sprint {gp_it} {anno} · soglia aria libera {it(SOGLIA_LIBERA,1)} s",
        unita="giri", base=0.0, ml=58, dec=0,
        caption=(f"sequenza più lunga di giri CONSECUTIVI in aria libera sulla gomma di "
                 f"campo. In evidenza chi arriva a {SEQ_MIN} giri ed entra nella misura: "
                 f"gli altri restano fuori, ed è questo il campione vero del pezzo"))

    # --- FACTS ----------------------------------------------------------------
    F = {
        "id": ID, "anno": anno, "gara": gp_it, "circuito": circuito, "round": rnd,
        "sessione": "Sprint", "n_giri_sprint": m["n_giri_sprint"],
        "parametri": {"soglia_aria_libera_s": SOGLIA_LIBERA, "sequenza_minima_giri": SEQ_MIN,
                      "min_piloti": MIN_PILOTI, "min_team": MIN_TEAM, "min_giri": MIN_GIRI},
        "mescola": m["mescola"],
        "calibrazione_del_cancello": CALIBRAZIONE,
        "copertura": {
            "piloti_in_misura": len(scelte), "piloti_in_sessione": m["n_piloti_sessione"],
            "team_in_misura": len(team_ok),
            "giri_in_misura": len(righe),
            "giri_puliti_sessione": m["giri_puliti_tot"],
            "giri_sulla_mescola_di_campo": m["giri_mescola"],
            "sequenza_piu_lunga_per_pilota": [
                {"sig": c["sig"], "team": c["team"], "giri": c["len"],
                 "dentro": c["len"] >= SEQ_MIN} for c in m["copertura"]],
        },
        "stima": {
            "trend_s_per_giro": stima["trend"], "trend_se": stima["trend_se"],
            "sigma_residuo_s": stima["sigma"], "dof": stima["dof"],
            "giro_riferimento": stima["lref"],
            "risoluzione_s": stima["risoluzione"],
        },
        "classifica": [
            {"sig": s, "team": team_di.get(s), "livello_s": v,
             "distacco_s": v - t_migliore, "se_s": liv[s]["se"],
             "giri": liv[s]["n"], "da_giro": liv[s]["ln_min"], "a_giro": liv[s]["ln_max"],
             "eta_gomma_media": eta_med.get(s)}
            for s, v in ordinati],
        "gruppi": [[s for s, _ in g] for g in gruppi],
        "confini_dei_gruppi": [
            {"da": c["da"], "a": c["a"], "distacco_s": c["distacco"],
             "soglia_della_coppia_s": c["soglia"],
             "margine_s": c["distacco"] - c["soglia"]} for c in confini],
        "se_per_pilota": {s: liv[s]["se"] for s, _ in ordinati},
        "eta_gomma": {"min": min(eta_val) if eta_val else None,
                      "max": max(eta_val) if eta_val else None},
    }

    # --- PROSA ----------------------------------------------------------------
    fuori = [c for c in m["copertura"] if c["len"] < SEQ_MIN]
    peggiore = min(CALIBRAZIONE, key=lambda c: c["piloti"])   # il caso che chiuse il cancello
    accent = col(team_di.get(migliore, ""))
    n_gruppi = len(gruppi)
    primo_gruppo = gruppi[0]
    # il margine col quale il PRIMO confine separa: e' il numero onesto da citare al
    # posto di "oltre la risoluzione" (che era una soglia unica per tutte le coppie)
    c0 = confini[0] if confini else None
    # il confine che passa per il rotto della cuffia: e' il numero da esporre, non da
    # nascondere — dice quanto e' fragile la spaccatura piu' fragile
    stretto = min(confini, key=lambda c: c["distacco"] - c["soglia"]) if confini else None
    if len(primo_gruppo) == 1 and c0:
        testa_txt = (f"<b>{migliore}</b> ha il passo migliore della sprint, e lo ha da solo: "
                     f"il primo inseguitore ({c0['a']}) è a {it(c0['distacco'],3)} s contro una "
                     f"soglia di separazione di {it(c0['soglia'],3)} s per quella coppia.")
    elif len(primo_gruppo) == 1:
        testa_txt = (f"<b>{migliore}</b> ha il passo migliore della sprint, e lo ha da solo.")
    else:
        testa_txt = (f"In testa non c'è un nome solo: <b>{', '.join(s for s, _ in primo_gruppo)}</b> "
                     f"sono una catena di vicini che questi dati non sanno separare — di nessuna "
                     f"coppia consecutiva il distacco supera la soglia al 95% di quella coppia. "
                     f"Metterli in fila lo stesso sarebbe inventare.")
    ultimo, t_ultimo = ordinati[-1]
    ampiezza = t_ultimo - t_migliore

    # una tendenza compatibile con lo zero non ha un verso: annunciarlo ("in più, si
    # rallenta") accanto a 0,000 s sarebbe una direzione inventata dal rumore.
    trend_nullo = abs(stima["trend"]) <= 1.96 * stima["trend_se"]
    trend_txt = (f"{it(abs(stima['trend']),3)} s al giro"
                 if trend_nullo else
                 f"{it(abs(stima['trend']),3)} s al giro "
                 f"{'in più (si rallenta)' if stima['trend'] > 0 else 'in meno (si accelera)'}")

    art = {
        "id": ID, "slug": slug, "stato": "bozza",
        "data": data_bozza or datetime.date.today().isoformat(),
        "firma": "Muretto · Redazione tecnica", "accent": accent,
        "canale": "A (sprint, tutto il gruppo)",
        "gp": gp_it, "gara": gp_it, "circuito": circuito, "sessione": "Sprint", "round": rnd,
        "tag": ["sprint", "passo", "aria libera", "telemetria", circuito],
        "occhiello": f"Sprint · {gp_it} {anno}",
        "titolo": (f"Il passo della sprint a {circuito}: "
                   + (f"{migliore} davanti di {it(ordinati[1][1] - t_migliore,3)} s al giro"
                      if len(primo_gruppo) == 1 else
                      f"{len(primo_gruppo)} macchine su {len(ordinati)} che i dati non separano")),
        "sommario": (
            f"Nel weekend sprint non ci sono prove libere lunghe: il passo si vede solo nella "
            f"sprint. Lo abbiamo letto dove va letto — su <b>sequenze di almeno {SEQ_MIN} giri "
            f"consecutivi</b> in aria libera, sulla gomma di campo ({m['mescola'].lower()}), mai "
            f"su giri sparsi. Ne restano <b>{len(scelte)} piloti su {m['n_piloti_sessione']}</b> "
            f"({len(team_ok)} squadre): il campione vero è questo, non l'intera griglia. "
            f"{'Davanti c’è ' + migliore + '.' if len(primo_gruppo) == 1 else 'In testa ci sono ' + ', '.join(s for s, _ in primo_gruppo) + '.'} "
            f"Fra il primo e l'ultimo del campione ci sono {it(ampiezza,3)} s al giro, e la "
            f"classifica è pubblicata a gruppi: due piloti finiscono in gruppi diversi solo se il "
            f"loro distacco supera la soglia al 95% <b>di quella coppia</b> — che qui va da "
            f"{it(min(soglie_consec),3)} a {it(max(soglie_consec),3)} s, non da un'unica "
            f"risoluzione."),
        "sezioni": [
            {"tag": "Evidenza",
             "titolo": f"Il passo, a parità di momento della sprint",
             "html": (
                f"<p>{testa_txt} La classifica qui sotto non è la media dei tempi sul giro: è il "
                f"<b>livello</b> di ciascuno riportato allo stesso giro della sprint (il "
                f"{int(stima['lref'])}º), perché le sequenze libere non cadono tutte nello stesso "
                f"momento — in questa sprint vanno dal giro {min(v['ln_min'] for v in liv.values())} "
                f"al giro {max(v['ln_max'] for v in liv.values())}.</p>"
                f"<p>Con {len(righe)} giri e un rumore di {it(stima['sigma'],3)} s per giro la "
                f"misura non regge il millesimo, e non lo regge <b>allo stesso modo per tutti</b>: "
                f"l'incertezza di ciascuno dipende da quanti giri liberi ha fatto e da quando, e "
                f"qui va da ±{it(min(se_di.values()),3)} a ±{it(max(se_di.values()),3)} s. Per "
                f"questo la soglia di separazione è calcolata <b>coppia per coppia</b> "
                f"({it(min(soglie_consec),3)}–{it(max(soglie_consec),3)} s fra piloti consecutivi) "
                f"e non con un unico numero: una soglia sola sarebbe troppo stretta per le coppie "
                f"rumorose e troppo larga per quelle precise. La lettura onesta è quindi a gruppi: "
                f"ne vengono <b>{n_gruppi}</b>, dentro ciascuno l'ordine non è informazione, e ogni "
                f"confine fra due gruppi è una coppia che i dati separano davvero"
                + (f" (il più stretto è {stretto['da']}–{stretto['a']}, che passa per "
                   f"{it(stretto['distacco'] - stretto['soglia'],3)} s)" if stretto else "")
                + f". Fra il primo e l'ultimo del campione "
                f"corrono {it(ampiezza,3)} s al giro — {'un abisso' if ampiezza > 2 else 'un mondo stretto'} "
                f"per una gara di {m['n_giri_sprint']} giri.</p>"),
             "figura": {"svg": fig_a,
                "didascalia": (f"Distacchi in secondi al giro dal passo di {migliore}, tutti "
                               f"riportati al giro {int(stima['lref'])}. In evidenza chi resta "
                               f"dentro la risoluzione della misura."),
                "fonte": f"FastF1 · laps Sprint {gp_it} {anno} — sequenze in aria libera"}},

            {"tag": "Causa",
             "titolo": f"Perché sequenze, e perché solo {len(scelte)} piloti",
             "html": (
                f"<p>Un passo non si legge su giri sparsi. Se un pilota infila cinque giri di fila "
                f"senza nessuno davanti, quelli sono il suo passo; se ne trova cinque liberi "
                f"sparpagliati in mezzo a una coda, quelli sono cinque momenti fortunati. Per "
                f"questo la misura parte dalla <b>sequenza consecutiva</b> più lunga di ogni "
                f"pilota, con il davanti oltre {it(SOGLIA_LIBERA,1)} s, sulla gomma su cui ha "
                f"girato la maggioranza del campo ({m['mescola'].lower()}: {m['giri_mescola']} "
                f"giri puliti su {m['giri_puliti_tot']}).</p>"
                f"<p>Il conto è severo, e va detto prima dei numeri: dei "
                f"{m['n_piloti_sessione']} piloti in pista ne arrivano a {SEQ_MIN} giri liberi "
                f"consecutivi soltanto <b>{len(scelte)}</b>"
                + (f" — restano fuori "
                   f"{', '.join(c['sig'] for c in fuori[:6])}"
                   f"{' e altri ' + str(len(fuori) - 6) if len(fuori) > 6 else ''}, "
                   f"che in aria libera non ci sono mai stati abbastanza a lungo." if fuori else ".")
                + f" Questo pezzo esce solo se il campione tiene: almeno {MIN_PILOTI} piloti e "
                f"{MIN_TEAM} squadre di {m['n_piloti_sessione']}. Non è una formalità: fra le "
                f"{len(CALIBRAZIONE)} sprint del 2026 già corse ce n'è una in cui i piloti "
                f"rimasti erano <b>{peggiore['piloti']}</b> di {peggiore['team']} squadre, e con "
                f"quel campione questo articolo non è uscito affatto.</p>"),
             "figura": {"svg": fig_c,
                "didascalia": (f"La sequenza libera più lunga di ogni pilota. In evidenza chi "
                               f"supera i {SEQ_MIN} giri ed entra nella misura."),
                "fonte": f"FastF1 · laps Sprint {gp_it} {anno} — gap alla macchina davanti per giro"}},

            {"tag": "Effetto",
             "titolo": "Cosa dice, e cosa questi numeri non possono dire",
             "html": (
                f"<p>Lungo la sprint il tempo sul giro si muove da solo: qui la tendenza comune "
                f"vale <b>{trend_txt}</b>"
                + (f", che con {it(stima['trend_se'],3)} s di incertezza è compatibile con lo zero: "
                   f"benzina che cala e gomma che si consuma quasi si annullano."
                   if trend_nullo else
                   f" (±{it(stima['trend_se'],3)}): è la somma di benzina che cala, gomma che "
                   f"invecchia e pista che gomma, e senza toglierla chi ha girato libero alla fine "
                   f"sembrerebbe più forte di quanto sia.")
                + f" È una tendenza <b>unica per tutti</b>, di proposito: fingere una pendenza per "
                f"pilota, su uno stint solo e con questo rumore, vorrebbe dire pubblicare degrado "
                f"che non c'è.</p>"
                f"<p>Due cose questi numeri non le sanno. L'<b>età della gomma</b> non è separabile "
                f"dal numero di giro in una sprint con una sosta sola: le sequenze arrivano con "
                f"gomme fra "
                + (f"{it(F['eta_gomma']['min'],0)} e {it(F['eta_gomma']['max'],0)} giri di vita"
                   if eta_val else "età diverse")
                + f", e quella differenza resta dentro il numero. E il <b>carico di carburante</b> "
                f"al via non è nel feed: nella sprint è uguale per tutti per regolamento, ma non lo "
                f"possiamo verificare. Infine, un avvertimento sul canale DRS: nel feed 2026 vale "
                f"zero su tutti i giri di tutte le sessioni, quindi nessuno di questi distacchi è "
                f"attribuibile all'ala mobile — né in un senso né nell'altro.</p>"),
             "figura": {"svg": fig_b,
                "didascalia": ("I giri veri di ogni sequenza, senza nessuna correzione, "
                               "nell'ordine della stima corretta."),
                "fonte": f"FastF1 · laps Sprint {gp_it} {anno} — tempi grezzi delle sequenze"}},
        ],
        "provenienza": [
            {"grandezza": "passo migliore della sprint",
             "valore": f"{migliore} — {_tempo(t_migliore)} al giro {int(stima['lref'])}",
             "stato": "MISURATO",
             "da": (f"livello a effetti fissi di pilota con tendenza comune sul numero di giro, "
                    f"su {liv[migliore]['n']} giri consecutivi in aria libera "
                    f"(giri {liv[migliore]['ln_min']}–{liv[migliore]['ln_max']}, "
                    f"gomma {m['mescola'].lower()})")},
            {"grandezza": "distacchi pubblicati",
             "valore": f"da {it(ordinati[1][1] - t_migliore,3)} a {it(ampiezza,3)} s al giro",
             "stato": "MISURATO",
             "da": (f"differenze fra i livelli, tutte riportate al giro {int(stima['lref'])}: "
                    f"non sono medie di tempi sul giro")},
            {"grandezza": "soglia di separazione (coppia per coppia)",
             "valore": (f"{it(min(soglie_consec),3)}–{it(max(soglie_consec),3)} s fra piloti "
                        f"consecutivi; incertezza per pilota ±{it(min(se_di.values()),3)}–"
                        f"±{it(max(se_di.values()),3)} s"),
             "stato": "MISURATO",
             "da": ("1,96·√(SE²+SE²) della COPPIA. Non un'unica risoluzione: i SE per pilota "
                    "variano di un fattore 2-3 dentro lo stesso evento, e una soglia sola sarebbe "
                    "troppo stretta per le coppie rumorose e troppo larga per quelle precise")},
            {"grandezza": "risoluzione tipica (solo contesto)",
             "valore": f"{it(stima['risoluzione'],3)} s al giro",
             "stato": "MISURATO",
             "da": (f"1,96·√2·SE mediano, dal rumore residuo {it(stima['sigma'],3)} s per giro su "
                    f"{len(righe)} giri ({stima['dof']} gradi di libertà). È l'ordine di grandezza "
                    f"del problema, NON il criterio: i gruppi si formano coppia per coppia")},
            {"grandezza": "criterio dei gruppi",
             "valore": (f"{len(gruppi)} gruppi; confine più stretto "
                        + (f"{stretto['da']}–{stretto['a']} per "
                           f"{it(stretto['distacco'] - stretto['soglia'],3)} s"
                           if stretto else "nessuno")),
             "stato": "MISURATO",
             "da": ("un gruppo nuovo si apre solo se il distacco dal pilota PRECEDENTE supera la "
                    "soglia di quella coppia (non dal capogruppo: col capogruppo si separavano "
                    "piloti a 74 millesimi mentre altri a 242 restavano insieme). Un gruppo può "
                    "essere più largo della soglia: significa catena di vicini non separabili, ed "
                    "è l'affermazione che i dati reggono")},
            {"grandezza": "copertura del campione",
             "valore": (f"{len(scelte)} piloti su {m['n_piloti_sessione']}, {len(team_ok)} squadre, "
                        f"{len(righe)} giri"),
             "stato": "MISURATO",
             "da": (f"solo chi ha almeno {SEQ_MIN} giri CONSECUTIVI con il davanti oltre "
                    f"{it(SOGLIA_LIBERA,1)} s, sulla mescola di campo; cancello: almeno "
                    f"{MIN_PILOTI} piloti e {MIN_TEAM} squadre, altrimenti l'articolo non esce")},
            {"grandezza": "tendenza lungo la sprint (benzina + pista + usura media)",
             "valore": f"{it(stima['trend'],3)} s al giro (±{it(stima['trend_se'],3)})",
             "stato": "MISURATO",
             "da": "coefficiente unico del numero di giro nella stessa stima"},
            {"grandezza": "degrado per pilota",
             "valore": "non stimato",
             "stato": "NON_MISURABILE",
             "da": ("da uno stint solo le pendenze per-stint sono inaffidabili (rumore di gara "
                    "molto maggiore del segnale): la tendenza qui è UNA per tutti, per scelta")},
            {"grandezza": "età della gomma dentro le sequenze",
             "valore": (f"da {it(F['eta_gomma']['min'],0)} a {it(F['eta_gomma']['max'],0)} giri"
                        if eta_val else "non disponibile"),
             "stato": "NON_MISURABILE",
             "da": ("in una sprint con una sosta sola l'età gomma e il numero di giro si muovono "
                    "insieme: non separabili, si dichiarano")},
            {"grandezza": "carico di carburante al via",
             "valore": "non nel feed",
             "stato": "NON_MISURABILE",
             "da": "uguale per tutti per regolamento nella sprint, ma non verificabile dai dati"},
            {"grandezza": "canale DRS",
             "valore": "nullo su tutte le sessioni 2026",
             "stato": "NON_MISURABILE",
             "da": ("nessun distacco qui misurato è attribuibile all'ala mobile: il canale non "
                    "distingue nulla")},
        ],
        "fonti": [
            {"tipo": "dati", "testo": (f"FastF1 3.8.3 — laps della Sprint, {gp_it} {anno} "
                                       f"(cache locale)")},
            {"tipo": "metodo", "testo": ("ai_lab/redazione/genera_sprint_passo.py su sprint.py — "
                                         "sequenze consecutive in aria libera, livelli a effetti "
                                         "fissi con tendenza comune sul numero di giro, "
                                         "risoluzione dal rumore residuo")},
        ],
    }
    return F, art


META = {
    "id": ID, "canale": "A",
    "titolo": "Il passo della sprint (sequenze in aria libera, weekend sprint)",
    "tag": ["sprint", "passo", "aria libera", "telemetria"],
    "descrizione": ("il passo vero letto su sequenze di giri consecutivi in aria libera nella "
                    "sprint — rimpiazza il passo del venerdì, che nel weekend sprint non esiste"),
    "richiede": "laps", "gare": ["*"], "sessioni": ["S"],
}


def genera(gara=None, data=None, sessione=None):
    if gara is None:
        return None
    anno = int(str(data)[:4]) if data else datetime.date.today().year
    try:
        r = costruisci(anno, gara, data_bozza=data)
    except Exception as e:
        print(f"  [sprint-passo] {gara}: {e} — salto.")
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
        print(f"{a.gara}: cancello di copertura chiuso (o evento senza sprint) — nessuna bozza")
        sys.exit(1)
    F, art = r
    bid = f"{ID}-{art['slug']}-{F['anno']}"
    art["id"] = bid
    C, S = F["copertura"], F["stima"]
    print(f"TITOLO: {art['titolo']}")
    print(f"  copertura: {C['piloti_in_misura']}/{C['piloti_in_sessione']} piloti, "
          f"{C['team_in_misura']} team, {C['giri_in_misura']} giri "
          f"(gomma di campo {F['mescola']}: {C['giri_sulla_mescola_di_campo']}/"
          f"{C['giri_puliti_sessione']} giri puliti)")
    print(f"  sequenze piu' lunghe: "
          f"{[(c['sig'], c['giri']) for c in C['sequenza_piu_lunga_per_pilota'][:8]]}")
    print(f"  trend {it(S['trend_s_per_giro'],3)} s/giro (±{it(S['trend_se'],3)}) · "
          f"sigma {it(S['sigma_residuo_s'],3)} s · risoluzione {it(S['risoluzione_s'],3)} s · "
          f"giro rif. {int(S['giro_riferimento'])}")
    for r_ in F["classifica"]:
        print(f"    {r_['sig']:4} {r_['team'][:16]:16} +{it(r_['distacco_s'],3):>6} s "
              f"(±{it(r_['se_s'],3)}) · {r_['giri']} giri {r_['da_giro']}–{r_['a_giro']}")
    print(f"  gruppi separabili: {F['gruppi']}")
    for c in F["confini_dei_gruppi"]:
        print(f"    confine {c['da']}|{c['a']}: distacco {it(c['distacco_s'],3)} s vs soglia "
              f"della coppia {it(c['soglia_della_coppia_s'],3)} s (margine "
              f"{it(c['margine_s'],3)} s)")
    if not a.solo_misura:
        out = base.scrivi_bozza(bid, art, F)
        print(f"  Bozza {bid} scritta in {out} (prosa {art.get('scrittura','template')})")
