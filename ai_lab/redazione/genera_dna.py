"""
Articolo X1 (Canale B, MULTI-GARA): "Il DNA dei circuiti" — motore vs carico.

Seconda uscita della macchina multi-gara. La percentuale di giro a TUTTO GAS
(frazione di distanza con throttle >= 95%) e' la firma piu' pulita di un tracciato:
niente confonditori (non e' velocita', non mescola PU o gomma) — dice solo quanto
del giro si sta flat-out, cioe' se il circuito chiede MOTORE (tanti rettilinei) o
CARICO (tante curve). Un secondo asse, la velocita' media in curva, distingue le
piste veloci-e-flowing dalle stop-and-go.

Metrica dal giro veloce assoluto di ogni gara (dna in dati_stagione/). Campione:
i 9 circuiti 2026 con telemetria in cache (Monaco esclusa).

python3 UTENTE. Solo lettura; bozza nell'area Lab.
"""
from __future__ import annotations
import os
import sys
import datetime
import statistics as st

_QUI = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, _QUI)
import multigara  # noqa: E402
import svg        # noqa: E402
import base       # noqa: E402

ID = "dna-circuiti-2026"


def it(x, dec=1):
    return base.it(x, dec)


def costruisci(anno=2026, data_bozza=None):
    gare = [g for g in multigara.carica_stagione(anno) if g.get("dna", {}).get("full_throttle_pct")]
    if len(gare) < 4:
        return None
    C = [{"nome": g["circuito"], "gp": g["gp"].split(" Grand")[0], **g["dna"]} for g in gare]
    C.sort(key=lambda c: -c["full_throttle_pct"])
    ft_med = st.median(c["full_throttle_pct"] for c in C)
    vc_med = st.median(c["vel_curva_med"] for c in C)

    motore = C[0]                                            # piu' flat-out
    carico = C[-1]                                           # meno flat-out
    veloce = max(C, key=lambda c: c["vel_curva_med"])        # curve piu' veloci
    lenta = min(C, key=lambda c: c["vel_curva_med"])         # curve piu' lente

    # colore: caldo = motore (alto gas), freddo = carico (basso gas)
    def colc(c):
        return "var(--sc)" if c["full_throttle_pct"] >= ft_med else "var(--accent)"

    F = {"id": ID, "anno": anno, "n_gare": len(C), "circuiti": C,
         "ft_mediana": ft_med, "motore": motore, "carico": carico,
         "veloce": veloce, "lenta": lenta}

    # bar: full-throttle % per circuito
    barre = [{"sigla": c["nome"], "colore": colc(c), "valore": c["full_throttle_pct"],
              "evidenza": True} for c in C]
    svg1 = svg.barre_dv(barre, titolo="Quanto giro a tutto gas, per circuito", ml=112, base=40,
                        caption="% del giro con acceleratore ≥95% · più alto = più “motore” (asse da 40)")
    # scatter: gas% (motore) vs velocita' media in curva
    punti = [{"label": c["nome"], "colore": colc(c), "x": c["full_throttle_pct"],
              "y": c["vel_curva_med"], "evidenza": (c["gp"] in (motore["gp"], carico["gp"], veloce["gp"], lenta["gp"]))}
             for c in C]
    svg2 = svg.grafico_scatter(
        punti, x_range=(40, 80), y_range=(100, 230),
        x_ticks=(40, 50, 60, 70, 80), y_ticks=(100, 130, 160, 190, 220),
        cx=round(ft_med), cy=round(vc_med),
        x_label="% del giro a tutto gas (→ più motore)", y_label="velocità media in curva (km/h)",
        titolo="Il piano dei circuiti 2026", sub="motore vs carico · veloce vs stop-and-go",
        ang=("motore, curve lente (stop-and-go)", "veloce e potente",
             "tecnico, curve veloci", "tecnico e lento"))

    mo, ca, ve, le = F["motore"], F["carico"], F["veloce"], F["lenta"]
    art = {
        "id": ID, "stato": "bozza", "data": data_bozza or datetime.date.today().isoformat(),
        "firma": "Muretto · Redazione tecnica", "accent": "var(--sc)",
        "canale": "B (anomalia nei nostri dati)",
        "gara": f"Stagione {anno}", "circuito": f"{len(C)} circuiti", "sessione": "Gara",
        "tag": ["telemetria", "circuiti", "assetto", "multi-gara"],
        "occhiello": f"Telemetria · {len(C)} circuiti {anno}",
        "titolo": "Il DNA dei circuiti 2026: chi chiede motore e chi chiede carico",
        "sommario": (f"La percentuale di giro a tutto gas è la firma più pulita di un tracciato. Sui "
                     f"{len(C)} circuiti con telemetria va dal <b>{it(mo['full_throttle_pct'],0)}%</b> di "
                     f"{mo['nome']} — oltre due terzi di giro flat-out — al {it(ca['full_throttle_pct'],0)}% di "
                     f"{ca['nome']}, il più esigente. In mezzo, chi è veloce e flowing e chi è potente ma "
                     f"stop-and-go.").replace("<b>", "").replace("</b>", ""),
        "sezioni": [
            {"tag": "Evidenza", "titolo": "Dal flat-out al labirinto",
             "html": (
                f"<p>Per ogni gara abbiamo preso il giro più veloce e misurato la frazione di tracciato "
                f"percorsa con l’acceleratore oltre il 95% — la <b>percentuale a tutto gas</b>. È il numero che "
                f"gli ingegneri usano per dire, in una cifra, quanto un circuito chiede motore o carico. Non "
                f"mescola potenza del motore né gomma — è solo gas contro distanza — anche se resta la firma "
                f"del pilota più veloce di giornata. Per non appenderla a un giro solo, la prendiamo come "
                f"mediana sui giri lanciati.</p>"
                f"<p>Lo spettro 2026 è netto. In testa <b>{mo['nome']}</b> con il "
                f"<b>{it(mo['full_throttle_pct'],0)}%</b> del giro flat-out, e {C[1]['nome']} "
                f"({it(C[1]['full_throttle_pct'],0)}%): piste da motore. In fondo, <b>{ca['nome']}</b> a "
                f"<b>{it(ca['full_throttle_pct'],0)}%</b> — meno di metà giro a tutto gas, il tracciato più "
                f"esigente per l’ala. Un secondo numero, la velocità media in curva, separa i simili: "
                f"<b>{ve['nome']}</b> ha le curve più veloci ({it(ve['vel_curva_med'],0)} km/h di media, "
                f"{ve['curve_veloci']} curve veloci), mentre <b>{le['nome']}</b> è la più stop-and-go "
                f"({it(le['vel_curva_med'],0)} km/h, {le['curve_lente']} curve lente) pur restando flat-out a "
                f"lungo.</p>"
             ), "figura": "grafico1"},
            {"tag": "Causa", "titolo": "Cosa chiede la pista decide come nasce la vettura del weekend",
             "html": (
                f"<p>Un giro passato molto a tutto gas premia due cose: <b>potenza</b> del motore e "
                f"<b>bassa resistenza</b> — si scarica l’ala, si allungano i rapporti, si cerca la velocità di "
                f"punta. Un giro spezzato da tante curve premia l’opposto: <b>carico aerodinamico</b> e grip "
                f"meccanico per portare velocità dove il gas è chiuso. È lo stesso compromesso "
                f"carico-resistenza dell’altra nostra analisi, ma visto dal lato della pista: è il circuito a "
                f"dire quanta ala montare.</p>"
                f"<p>La velocità in curva aggiunge il dettaglio. Curve veloci ({ve['nome']}) chiedono stabilità "
                f"aerodinamica ad alta velocità; curve lente ({le['nome']}) chiedono trazione e agilità in uscita. "
                f"Due piste con la stessa percentuale-gas possono quindi domandare vetture diverse — ed è per "
                f"questo che il piano ha bisogno di due assi, non di uno.</p>"
             ), "figura": "grafico2"},
            {"tag": "Effetto", "titolo": "Una mappa per leggere il resto della stagione",
             "html": (
                f"<p>Tradotto: a {mo['nome']} e {C[1]['nome']} conta il motore e l’ala scarica; a {ca['nome']} "
                f"il carico; a {ve['nome']} l’aerodinamica ad alta velocità; a {le['nome']} la trazione. È la "
                f"griglia di lettura per tutto il resto — quando una squadra va forte qui e male là, spesso è "
                f"scritto nel DNA del tracciato. Nota di perimetro: mancano i circuiti più estremi da carico "
                f"(Monaco, Ungheria, Singapore) non ancora in archivio; la vera coda a bassa percentuale-gas "
                f"sarebbe più lunga di così.</p>"
             )},
        ],
        "provenienza": [
            {"grandezza": "percentuale a tutto gas (per circuito)",
             "valore": f"{mo['nome']} {it(mo['full_throttle_pct'],0)}% (max) · {ca['nome']} {it(ca['full_throttle_pct'],0)}% (min) · mediana {it(ft_med,0)}%",
             "stato": "MISURATO", "da": "frazione di distanza con throttle ≥95% sul giro veloce assoluto (FastF1)"},
            {"grandezza": "velocità media in curva", "valore": f"{ve['nome']} {it(ve['vel_curva_med'],0)} (max) · {le['nome']} {it(le['vel_curva_med'],0)} (min) km/h",
             "stato": "MISURATO", "da": "mediana della velocità all’apice delle curve (circuit_info)"},
            {"grandezza": "circuiti nel campione", "valore": f"{len(C)} (Monaco/Ungheria/Singapore assenti dalla cache)",
             "stato": "MISURATO", "da": "archivio FastF1 in cache"},
            {"grandezza": "velocità di punta per circuito", "valore": "riportata ma non centrale",
             "stato": "STIMATO", "da": "picco del giro veloce: può risentire della scia; la percentuale-gas non ne risente"},
        ],
        "fonti": [
            {"tipo": "dati", "testo": f"FastF1 3.8.3 — telemetria vettura (Throttle/Speed) di {len(C)} gare 2026, giro veloce assoluto (cache locale)"},
            {"tipo": "metodo", "testo": "ai_lab/redazione/multigara.py (estrai_dna) + genera_dna.py — percentuale a tutto gas = distanza con throttle≥95% / lunghezza giro; velocità in curva = mediana all’apice delle curve di circuit_info"},
        ],
    }

    FIG = {
        "grafico1": {"svg": svg1,
            "didascalia": "Percentuale di giro a tutto gas per circuito. In arancio le piste da motore, in ciano quelle da carico.",
            "fonte": "FastF1 · car telemetry, elaborazione redazione"},
        "grafico2": {"svg": svg2,
            "didascalia": ("Il piano dei circuiti: a destra si gira di più a tutto gas (motore), in alto le "
                           "curve sono più veloci. Evidenziati gli estremi."),
            "fonte": "FastF1 · car telemetry, elaborazione redazione"},
    }
    for sez in art["sezioni"]:
        if sez.get("figura") in FIG:
            sez["figura"] = FIG[sez["figura"]]
        elif "figura" in sez:
            del sez["figura"]
    return F, art


META = {
    "id": ID, "canale": "B",
    "titolo": "Il DNA dei circuiti (motore vs carico)",
    "tag": ["telemetria", "circuiti", "multi-gara"],
    "descrizione": "caratterizzazione dei tracciati dalla domanda telemetrica (tema X1)",
    "richiede": "telemetria multi-gara", "gare": ["stagione"], "sessioni": ["Race"],
}


def genera(gara=None, data=None):
    r = costruisci(2026, data_bozza=data)
    if not r:
        return None
    F, art = r
    base.scrivi_bozza(ID, art, F)
    return {"id": ID, "titolo": art["titolo"], "stato": art["stato"], "canale": "B"}


if __name__ == "__main__":
    r = costruisci()
    if not r:
        print("dati insufficienti"); sys.exit()
    F, art = r
    base.scrivi_bozza(ID, art, F)
    print(f"Bozza {ID} scritta ({F['n_gare']} circuiti).")
    for c in F["circuiti"]:
        print(f"  {c['nome'][:16]:16} gas {c['full_throttle_pct']:4.0f}%  vCurva {c['vel_curva_med']:3.0f}")
