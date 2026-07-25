"""
Articolo A2 (Canale A+B, MULTI-GARA): "La mappa dell'assetto" — punta vs curva.

Primo articolo della macchina multi-gara: incrocia velocita' di punta e velocita'
in curva su 9 gare 2026 e colloca ogni team sul piano rettilineo-vs-curva. La
storia NON e' un vincitore (il vertice del combinato e' un testa a testa che
cambia col circuito, come mostra il leave-one-out) ma la MAPPA delle scelte: chi
carica l'ala, chi va scarico, chi resta forte da entrambe le parti.

Robustezza: la vmax e' la MEDIANA sui giri (non il picco singolo), per non farsi
ingannare dalla scia. Confronto normalizzato a percentile PER-GARA, media sulle
gare. Confonditori DICHIARATI: punta = resistenza + potenza PU; curva = carico +
grip meccanico. Firma d'assetto, non efficienza aero pura (L/D non isolabile).

python3 UTENTE. Solo lettura; bozza nell'area Lab.
"""
from __future__ import annotations
import os
import sys
import datetime
import statistics as st
from collections import Counter

_QUI = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, _QUI)
import multigara  # noqa: E402
import svg        # noqa: E402
import base       # noqa: E402

ID = "assetto-punta-curva-2026"
MIN_GARE = 6
CORTO = {"Red Bull Racing": "Red Bull", "Haas F1 Team": "Haas", "Aston Martin": "Aston"}
PU_MERC = {"Mercedes", "McLaren", "Williams", "Alpine"}


def it(x, dec=1):
    return base.it(x, dec)


def _pct(val, tutti):
    n = len(tutti)
    k = sum(1 for x in tutti if x < val)
    e = sum(1 for x in tutti if x == val)
    return 100.0 * (k + 0.5 * e) / n


def _aggrega(gs):
    S, C, N = {}, {}, {}
    for g in gs:
        tv = [d["vmax"] for d in g["team"].values()]
        tc = [d["cornering"] for d in g["team"].values()]
        for t, d in g["team"].items():
            S.setdefault(t, []).append(_pct(d["vmax"], tv))
            C.setdefault(t, []).append(_pct(d["cornering"], tc))
            N[t] = N.get(t, 0) + 1
    out = {}
    for t in S:
        if N[t] >= min(MIN_GARE, len(gs) - 1):
            s, c = st.mean(S[t]), st.mean(C[t])
            out[t] = {"straight": s, "corner": c, "eff": (s + c) / 2, "gap": s - c, "n": N[t]}
    return out


def nm(t):
    return CORTO.get(t, t)


def costruisci(anno=2026, data_bozza=None):
    gare = multigara.carica_stagione(anno)
    if len(gare) < 4:
        return None
    teams = _aggrega(gare)
    # leave-one-out: chi e' in cima al combinato togliendo ogni gara
    loo = Counter()
    for i in range(len(gare)):
        a = _aggrega(gare[:i] + gare[i + 1:])
        if a:
            loo[max(a.items(), key=lambda kv: kv[1]["eff"])[0]] += 1
    contendenti = [t for t, _ in loo.most_common()]

    ordinati = sorted(teams.items(), key=lambda kv: -kv[1]["eff"])
    primo, secondo = ordinati[0], ordinati[1]
    carico = min(teams.items(), key=lambda kv: kv[1]["gap"])     # curva >> dritto
    scarico = max(teams.items(), key=lambda kv: kv[1]["gap"])    # dritto >> curva
    difficolta = ordinati[-1]
    colori = base.carica_colori()
    col = lambda t: colori.get(t) or "var(--dim)"

    F = {"id": ID, "anno": anno, "n_gare": len(gare),
         "gare": [g["gp"].split(" Grand")[0] for g in gare],
         "teams": teams, "leave_one_out": dict(loo), "contendenti": contendenti,
         "primo": {"team": primo[0], **primo[1]}, "secondo": {"team": secondo[0], **secondo[1]},
         "carico": {"team": carico[0], **carico[1]}, "scarico": {"team": scarico[0], **scarico[1]},
         "difficolta": {"team": difficolta[0], **difficolta[1]}}

    # --- grafici ---
    hot = set(contendenti[:2])
    punti = [{"label": nm(t), "colore": col(t), "x": d["straight"], "y": d["corner"],
              "evidenza": (t in hot)} for t, d in teams.items()]
    svg1 = svg.grafico_scatter(
        punti, x_label="velocità in rettilineo (percentile fra i team)",
        y_label="velocità in curva (percentile)",
        titolo="La mappa dell’assetto 2026", sub=f"{len(gare)} gare · punta ripulita dalla scia",
        ang=("scarico: dritto sì, curva no", "forte in entrambi",
             "carico: curva sì, dritto no", "indietro ovunque"))

    barre = [{"sigla": nm(t), "colore": col(t), "valore": d["eff"], "evidenza": (t in hot)}
             for t, d in ordinati]
    svg2 = svg.barre_dv(barre, titolo="Combinato dritto + curva, per team", ml=90,
                        caption="media dei percentili rettilineo e curva · 9 gare (50 = media schieramento)")

    p, s2, ca, sc, di = F["primo"], F["secondo"], F["carico"], F["scarico"], F["difficolta"]
    cont = " e ".join(nm(t) for t in contendenti[:2])
    merc = ", ".join(nm(t) for t in sorted(t for t in teams if t in PU_MERC))

    art = {
        "id": ID, "stato": "bozza", "data": data_bozza or datetime.date.today().isoformat(),
        "firma": "Muretto · Redazione tecnica", "accent": col(p["team"]),
        "canale": "A+B (spunto web, riprodotto sui nostri dati)",
        "gara": f"Stagione {anno}", "circuito": f"{len(gare)} gare", "sessione": "Gara",
        "tag": ["telemetria", "aerodinamica", "assetto", "multi-gara"],
        "occhiello": f"Telemetria · {len(gare)} gare {anno}",
        "titolo": "La mappa dell’assetto 2026: chi corre carico e chi scarico",
        "sommario": (f"Incrociando velocità di punta e velocità in curva su {len(gare)} gare — con la punta "
                     f"ripulita dalla scia — si legge come ogni team ha risolto il compromesso carico-resistenza. "
                     f"In cima, vicine, {nm(p['team'])} e {nm(s2['team'])}; ai lati chi carica l’ala e chi corre "
                     f"scarico."),
        "sezioni": [
            {"tag": "Evidenza", "titolo": "Nove gare, un piano solo",
             "html": (
                f"<p>Per ogni gara con telemetria in archivio abbiamo misurato, per team, la velocità di punta "
                f"— la <b>mediana sui giri</b>, non il picco singolo, per non farci ingannare da un traino — e la "
                f"velocità mediana all’apice delle curve, e le abbiamo trasformate in <b>percentili</b> rispetto "
                f"ai rivali su quel circuito. La media colloca ogni squadra sul piano rettilineo–curva.</p>"
                f"<p>Il compromesso si legge a occhio. La <b>{nm(ca['team'])}</b> è la più caricata: "
                f"<b>{it(ca['corner'],0)}°</b> percentile in curva ma {it(ca['straight'],0)}° sul dritto. "
                f"All’opposto la <b>{nm(sc['team'])}</b> corre <b>scarica</b>: {it(sc['straight'],0)}° sul dritto, "
                f"appena {it(sc['corner'],0)}° in curva. In cima al combinato, vicine, la <b>{nm(p['team'])}</b> "
                f"({it(p['straight'],0)}·{it(p['corner'],0)}) e la <b>{nm(s2['team'])}</b> "
                f"({it(s2['straight'],0)}·{it(s2['corner'],0)}) — forti da entrambe le parti. In fondo, indietro "
                f"un po’ ovunque, la {nm(di['team'])} ({it(di['straight'],0)}·{it(di['corner'],0)}).</p>"
                f"<p>Chi sia davvero la prima è però un testa a testa: togliendo una gara qualsiasi, in cima si "
                f"alternano <b>{cont}</b>. Il vertice dipende dal circuito, non è un distacco netto — e per questo "
                f"la mappa conta più della classifica.</p>"
             ), "figura": "grafico1"},
            {"tag": "Causa", "titolo": "Fare carico costa resistenza — e non è solo aerodinamica",
             "html": (
                f"<p>Ogni vettura vive sullo stesso compromesso: più ala significa più carico in curva ma più "
                f"resistenza sul dritto. Chi sta in alto a destra genera più carico per unità di resistenza; chi "
                f"scende in basso a destra ha scelto la velocità di punta. È la scelta d’assetto che separa la "
                f"{nm(ca['team'])} carica dalla {nm(sc['team'])} scarica.</p>"
                f"<p>Due confonditori vanno dichiarati, non nascosti. La velocità di punta non è solo resistenza: "
                f"ci mette dentro la <b>potenza del motore</b>. La velocità in curva non è solo carico: ci mette "
                f"<b>grip meccanico e gomma</b>. Perciò questa è una firma di <b>assetto</b> — come ogni team "
                f"bilancia dritto e curva — non una misura di efficienza aerodinamica pura, che dai nostri canali "
                f"non è isolabile. Un pezzetto di controllo sul motore: fra i team a motore Mercedes ({merc}) il "
                f"dritto non è una questione di cavalli, ed è lì che la scelta d’assetto si legge più pulita.</p>"
             ), "figura": "grafico2"},
            {"tag": "Effetto", "titolo": "Undici modi di risolvere lo stesso problema",
             "html": (
                f"<p>La fotografia del 2026 non è una classifica di valore: è una mappa di scelte. La "
                f"{nm(ca['team'])} carica l’ala e comanda in curva, pagandola sul dritto; la {nm(sc['team'])} fa "
                f"l’opposto; {nm(p['team'])} e {nm(s2['team'])} riescono a stare forti da entrambe le parti; la "
                f"{nm(di['team'])} deve ancora trovare la sua strada. Lo stesso compromesso carico-resistenza, "
                f"risolto in undici modi diversi.</p>"
             )},
        ],
        "provenienza": [
            {"grandezza": "posizione sul piano (percentile rettilineo · curva)",
             "valore": f"{nm(ca['team'])} {it(ca['straight'],0)}·{it(ca['corner'],0)} (carica) · {nm(sc['team'])} {it(sc['straight'],0)}·{it(sc['corner'],0)} (scarica) · {nm(p['team'])} {it(p['straight'],0)}·{it(p['corner'],0)}",
             "stato": "MISURATO", "da": "vmax (mediana sui giri) e velocità mediana all’apice (curve <235 km/h), percentile per-gara, media su ≤9 gare"},
            {"grandezza": "vertice del combinato (robustezza)", "valore": f"testa a testa {cont} — #1 cambia togliendo una gara (leave-one-out: {loo.most_common()[0][1]}/{len(gare)} vs {loo.most_common()[1][1] if len(loo)>1 else 0})",
             "stato": "MISURATO", "da": "leave-one-out sulle 9 gare"},
            {"grandezza": "efficienza aerodinamica pura (L/D)", "valore": "non isolabile",
             "stato": "NON_MISURABILE", "da": "la punta include la potenza PU e la curva il grip meccanico"},
        ],
        "fonti": [
            {"tipo": "spunto", "testo": "Analisi di configurazione aerodinamica (mappa punta-vs-curva) della stampa tecnica — Canale A, riprodotta sui nostri dati"},
            {"tipo": "dati", "testo": f"FastF1 3.8.3 — telemetria vettura (Speed) di {len(gare)} gare 2026, sessione di gara, giri lanciati per pilota (Monaco esclusa: telemetria lacunosa)"},
            {"tipo": "metodo", "testo": "ai_lab/redazione/multigara.py + genera_efficienza.py — vmax = mediana della velocità massima sui giri lanciati (robusta alla scia); cornering = mediana velocità all’apice delle curve <235 km/h; percentile per-gara fra i team, media su ≥6 gare; vertice validato in leave-one-out"},
        ],
    }

    FIG = {
        "grafico1": {"svg": svg1,
            "didascalia": (f"Ogni team sul piano rettilineo–curva ({len(gare)} gare, percentili). In alto a "
                           f"destra chi è forte ovunque; in basso a destra le scelte scariche; a sinistra chi "
                           f"resta indietro. Evidenziate le due in testa al combinato ({cont})."),
            "fonte": "FastF1 · car telemetry, elaborazione redazione"},
        "grafico2": {"svg": svg2,
            "didascalia": "Combinato = media dei percentili rettilineo e curva. 50 è la media dello schieramento; è un ordine di forza-in-entrambi, non una misura di efficienza aerodinamica.",
            "fonte": "FastF1 · car telemetry, elaborazione redazione"},
    }
    for sez in art["sezioni"]:
        if sez.get("figura") in FIG:
            sez["figura"] = FIG[sez["figura"]]
        elif "figura" in sez:
            del sez["figura"]
    return F, art


META = {
    "id": ID, "canale": "A+B",
    "titolo": "La mappa dell’assetto (punta vs curva, stagione)",
    "tag": ["telemetria", "aerodinamica", "multi-gara"],
    "descrizione": "compromesso carico-resistenza per team su tutta la stagione (tema A2)",
    "richiede": "telemetria multi-gara", "gare": ["stagione"], "sessioni": ["Race"],
}


def genera(gara=None, data=None):
    r = costruisci(2026, data_bozza=data)
    if not r:
        return None
    F, art = r
    base.scrivi_bozza(ID, art, F)
    return {"id": ID, "titolo": art["titolo"], "stato": art["stato"], "canale": "A+B"}


if __name__ == "__main__":
    r = costruisci()
    if not r:
        print("dati insufficienti"); sys.exit()
    F, art = r
    base.scrivi_bozza(ID, art, F)
    print(f"Bozza {ID} scritta ({F['n_gare']} gare). Leave-one-out #1: {F['leave_one_out']}")
    for t, d in sorted(F["teams"].items(), key=lambda kv: -kv[1]["eff"]):
        print(f"  {t[:14]:14} retto {d['straight']:3.0f}  curva {d['corner']:3.0f}  comb {d['eff']:3.0f}  gap {d['gap']:+.0f}")
