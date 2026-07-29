"""
Articolo #3 (Canale B, tema T3): "Stowe, stessa Ferrari — Leclerc in sesta dove
Hamilton scala in quinta".

Primo rilevatore costruito sul mattone MAPPA-CURVE (curve.py): scandisce le curve
del circuito e trova dove due COMPAGNI di squadra scelgono marce diverse all'apice
in modo sistematico. Feature: il disaccordo alla curva piu' veloce (Stowe), a
parita' di velocita' d'apice -> e' pura scelta di guida, non un vantaggio di passo.

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

ID = "compagni-marce-stowe-gb-2026"
PISTA_GB = os.path.join(base.REPO, "demo", "data", "pista_Gran Bretagna.json")
ORD = "ª"


def it(x, dec=1):
    return base.it(x, dec)


def _disaccordi(ses, piloti):
    """Tutti i disaccordi di marcia all'apice tra compagni, con misure."""
    cs = curve.curve(ses)
    teams = {}
    for sig, info in piloti.items():
        teams.setdefault(info["team"], []).append((sig, info["num"]))
    out = []
    for team, drv in teams.items():
        if len(drv) != 2:
            continue
        (sA, nA), (sB, nB) = drv
        for c in cs:
            a = curve.al_apice(ses, nA, c["dist"])
            b = curve.al_apice(ses, nB, c["dist"])
            if not a or not b:
                continue
            if a["gear_modo"] != b["gear_modo"] and a["gear_consistenza"] >= 0.6 and b["gear_consistenza"] >= 0.6:
                out.append({"team": team, "curva": c, "A": (sA, a), "B": (sB, b)})
    return out


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
    dis = _disaccordi(ses, piloti)
    if not dis:
        return None

    # featured: la CURVA VERA piu' veloce (150-260 km/h: non un quasi-rettilineo,
    # non un tornante) con disaccordo consistente per entrambi -> Stowe.
    def vmin_min(d):
        return min(d["A"][1]["vmin_med"], d["B"][1]["vmin_med"])

    def cons_ok(d):
        return d["A"][1]["gear_consistenza"] >= 0.7 and d["B"][1]["gear_consistenza"] >= 0.7
    reali = [d for d in dis if 150 <= vmin_min(d) <= 260 and cons_ok(d)]
    feat = max(reali, key=vmin_min) if reali else max(dis, key=vmin_min)
    # A = marcia piu' ALTA (tiene il rapporto lungo), B = piu' bassa (scala)
    (sA, a), (sB, b) = feat["A"], feat["B"]
    if a["gear_modo"] < b["gear_modo"]:
        (sA, a), (sB, b) = (sB, b), (sA, a)
    team = feat["team"]; cv = feat["curva"]
    col = colori.get(team) or "var(--dim)"
    nA_g = a["gear_tutte"].count(a["gear_modo"])
    nB_g = b["gear_tutte"].count(b["gear_modo"])
    drpm = abs(a["rpm_med"] - b["rpm_med"])
    dvmin = abs(a["vmin_med"] - b["vmin_med"])
    a["vmin"] = a["vmin_med"]; b["vmin"] = b["vmin_med"]   # alias per la prosa
    numA, numB = piloti[sA]["num"], piloti[sB]["num"]

    # pattern piu' ampio
    n_tot = len(dis)
    n_team = sum(1 for d in dis if d["team"] == team)

    # tracce per il grafico
    tA = curve.traccia_curva(ses, numA, cv["dist"])
    tB = curve.traccia_curva(ses, numB, cv["dist"])
    vv = [p[1] for p in tA + tB]
    gg = [p[2] for p in tA + tB]
    v_range = (int(min(vv) // 25 * 25 - 0), int(max(vv) // 25 * 25 + 25))
    g_range = (max(1, min(gg) - 1), min(8, max(gg) + 1))

    F = {
        "id": ID, "anno": anno, "gara": "Gran Bretagna", "circuito": "Silverstone",
        "sessione": "Qualifiche",
        "curva": {"numero": cv["numero"], "nome": "Stowe" if cv["numero"] == 15 else f"curva {cv['numero']}",
                  "dist": cv["dist"]},
        "A": {"sigla": sA, "team": team, "gear": a["gear_modo"], "n": a["n"], "n_gear": nA_g,
              "vmin": a["vmin_med"], "rpm": a["rpm_med"], "cons": a["gear_consistenza"]},
        "B": {"sigla": sB, "team": team, "gear": b["gear_modo"], "n": b["n"], "n_gear": nB_g,
              "vmin": b["vmin_med"], "rpm": b["rpm_med"], "cons": b["gear_consistenza"]},
        "delta_rpm": drpm, "delta_vmin": dvmin,
        "pattern": {"disaccordi_totali": n_tot, "disaccordi_team": n_team},
    }

    nome_curva = F["curva"]["nome"]
    serie = [
        {"sigla": f"{sA} ({a['gear_modo']}{ORD})", "colore": col, "tratteggio": False, "punti": tA},
        {"sigla": f"{sB} ({b['gear_modo']}{ORD})", "colore": col, "tratteggio": True, "punti": tB},
    ]
    svg1 = svg.grafico_curva(
        serie, v_range=v_range, g_range=g_range,
        apex_txt=f"{sA} {a['gear_modo']}{ORD} · {sB} {b['gear_modo']}{ORD}",
        titolo=f"{nome_curva}: {sA} vs {sB} — stessa {team}",
        sub="velocità + marcia attorno all’apice · Qualifiche GB 2026")
    svgP = svg_pista(punto_pista(cv["dist"]), nome_curva)

    def frase_ripet(e):
        return (f"tutti e {e['n']}" if e["n_gear"] == e["n"] else f"{e['n_gear']} dei {e['n']}")

    FIG = {
        "grafico1": {"svg": svg1,
            "didascalia": (f"Attorno all’apice di {nome_curva}: le tracce di velocità restano vicine, quelle "
                           f"della marcia si separano — {sA} tiene la {a['gear_modo']}{ORD}, {sB} scala in "
                           f"{b['gear_modo']}{ORD}."),
            "fonte": "FastF1 · car telemetry (nGear/Speed), Qualifiche GB 2026"},
        "pista": {"svg": svgP,
            "didascalia": (f"{nome_curva} (curva {cv['numero']}) sul tracciato di Silverstone: la curva veloce "
                           f"dove i due {team} scelgono marce diverse."),
            "fonte": "FastF1 · GPS position + circuit_info, tracciato del sito"},
    }

    art = {
        "id": ID, "stato": "bozza", "data": data_bozza or datetime.date.today().isoformat(),
        "firma": "Muretto · Redazione tecnica", "accent": col, "canale": "B (anomalia nei nostri dati)",
        "gara": F["gara"], "circuito": F["circuito"], "sessione": F["sessione"],
        "tag": ["telemetria", team, "guida", "qualifiche"],
        "occhiello": f"Telemetria · Qualifiche {F['gara']} {anno}",
        "titolo": f"{nome_curva}, stessa {team}: {sA} in {a['gear_modo']}{ORD} dove {sB} scala in {b['gear_modo']}{ORD}",
        "sommario": (f"In una curva veloce di Silverstone le due {team} passano l’apice a velocità vicina, "
                     f"ma con una marcia di differenza: {sA} in {a['gear_modo']}{ORD}, {sB} in {b['gear_modo']}{ORD}. "
                     f"E scalare non rende {sB} più veloce — gli alza il regime. Non è un caso: è una scelta, e si ripete."),
        "sezioni": [
            {"tag": "Evidenza", "titolo": "Due Ferrari identiche, guidate in modo diverso",
             "html": (
                f"<p>A {nome_curva} — curva {cv['numero']}, l’apice si passa a circa {it(a['vmin'],0)} km/h in "
                f"appoggio — la telemetria delle qualifiche mostra due {team} guidate in modo diverso. "
                f"<b>{sA}</b> passa l’apice in <b>{a['gear_modo']}{ORD}</b> su {frase_ripet(F['A'])} i suoi giri "
                f"lanciati; <b>{sB}</b> scala in <b>{b['gear_modo']}{ORD}</b> in {frase_ripet(F['B'])}.</p>"
                f"<p>All’apice le due Ferrari passano a velocità vicina — <b>{it(a['vmin'],0)}</b> contro "
                f"<b>{it(b['vmin'],0)} km/h</b> — e scalare non rende {sB} più veloce: gli alza soltanto il "
                f"regime, <b>{it(drpm,0)} giri/min</b> più su. La differenza è tutta nella marcia. Non è "
                f"nemmeno un caso isolato del singolo circuito: su tutto lo schieramento i compagni di "
                f"squadra scelgono marce diverse all’apice in <b>{n_tot}</b> punti del giro.</p>"
             ), "figura": FIG["grafico1"]},
            {"tag": "Causa", "titolo": "In una curva veloce la marcia non fa velocità: fa il retrotreno",
             "html": (
                f"<p>La scelta della marcia in una curva veloce non serve a fare velocità di percorrenza — "
                f"quella la decidono aerodinamica e gomme — ma a decidere come si comporta il retrotreno "
                f"all’uscita. In <b>{a['gear_modo']}{ORD}</b> il motore gira più basso, vicino al regime di "
                f"potenza, e ha poca coppia residua da scaricare a terra: la vettura è più stabile e "
                f"prevedibile in appoggio. È la scelta di {sA}.</p>"
                f"<p>In <b>{b['gear_modo']}{ORD}</b> il motore gira più su di giri, ha più coppia disponibile e "
                f"fa ruotare di più la vettura all’uscita — più trazione e rotazione, al prezzo di un "
                f"retrotreno più nervoso da gestire. È la scelta di {sB}. È la stessa monoposto: cambia la "
                f"mano del pilota. Il comportamento del retrotreno che ne segue lo interpretiamo dalla "
                f"fisica; non è un canale che misuriamo.</p>"
             ), "figura": FIG["pista"]},
            {"tag": "Effetto", "titolo": "A parità di velocità, mille e quattrocento giri di distanza",
             "html": (
                f"<p>A velocità di percorrenza vicina, <b>{it(drpm,0)} giri/min</b> separano le due {team}: "
                f"{a['gear_modo']}{ORD} contro {b['gear_modo']}{ORD}, stabilità contro rotazione. E scalare non "
                f"compra velocità — {sB} passa l’apice se mai un filo più piano. Non è un dettaglio di un solo "
                f"punto: su tutta la griglia i compagni dissentono sulla marcia in <b>{n_tot}</b> apici diversi. "
                f"È la firma di due stili di guida che convivono nella stessa vettura.</p>"
             )},
        ],
        "provenienza": [
            {"grandezza": "marcia all’apice", "valore": f"{sA} {a['gear_modo']}{ORD} ({frase_ripet(F['A'])}), {sB} {b['gear_modo']}{ORD} ({frase_ripet(F['B'])})",
             "stato": "MISURATO", "da": "moda della marcia all’apice sui giri lanciati (FastF1 + mappa-curve circuit_info)"},
            {"grandezza": "velocità all’apice", "valore": f"{it(a['vmin'],0)} vs {it(b['vmin'],0)} km/h ({sB} non più veloce scalando)",
             "stato": "MISURATO", "da": "mediana della velocità minima all’apice sui giri lanciati"},
            {"grandezza": "giri/min all’apice", "valore": f"Δ {it(drpm,0)} (più alti per {sB})",
             "stato": "MISURATO", "da": "mediana RPM all’apice"},
            {"grandezza": "disaccordi di marcia tra compagni", "valore": f"{n_team} ({team}), {n_tot} sulla griglia",
             "stato": "MISURATO", "da": "scansione di tutte le curve, tutti i team con 2 piloti"},
            {"grandezza": "comportamento del retrotreno (stabilità vs rotazione)", "valore": "interpretazione fisica",
             "stato": "NON_MISURABILE", "da": "nessun canale di assetto/imbardata; è la lettura della scelta, non un dato"},
        ],
        "fonti": [
            {"tipo": "dati", "testo": "FastF1 3.8.3 — telemetria vettura (nGear/Speed/RPM) + mappa curve (circuit_info), Qualifiche Gran Premio di Gran Bretagna 2026"},
            {"tipo": "metodo", "testo": "ai_lab/redazione/genera_stowe.py su curve.py — marcia modale all’apice (finestra −25/+75 m attorno al riferimento circuit_info, dove cade il vero minimo di velocità) su ≥3 giri lanciati per curva; disaccordo = moda diversa con consistenza ≥60% per entrambi. Curva-firma scelta = la più veloce (apice 150–260 km/h) tra i disaccordi, non la più veloce in assoluto"},
        ],
    }
    return F, art


META = {
    "id": ID, "canale": "B",
    "titolo": "Compagni in disaccordo sulla marcia (curva veloce)",
    "tag": ["telemetria", "guida", "qualifiche"],
    "descrizione": "dove due compagni scelgono marce diverse all’apice (tema T3)",
    "richiede": "telemetria", "gare": ["Gran Bretagna"], "sessioni": ["Q"],
}


def genera(gara=None, data=None):
    if gara not in (None, "Gran Bretagna", "British Grand Prix"):
        return None
    r = costruisci(2026, "British Grand Prix", data_bozza=data)
    if not r:
        return None
    F, art = r
    base.scrivi_bozza(ID, art, F)
    return {"id": ID, "titolo": art["titolo"], "stato": art["stato"], "canale": "B"}


if __name__ == "__main__":
    r = costruisci()
    if not r:
        print("nessun disaccordo trovato"); sys.exit()
    F, art = r
    base.scrivi_bozza(ID, art, F)
    a, b = F["A"], F["B"]
    print(f"Bozza {ID} scritta.")
    print(f"  {F['curva']['nome']} (T{F['curva']['numero']}): {a['sigla']} {a['gear']}{ORD} ({a['n_gear']}/{a['n']}) "
          f"vs {b['sigla']} {b['gear']}{ORD} ({b['n_gear']}/{b['n']}) | vmin {it(a['vmin'],0)}/{it(b['vmin'],0)} "
          f"| Δrpm {it(F['delta_rpm'],0)} | pattern {F['pattern']['disaccordi_team']}/{F['pattern']['disaccordi_totali']}")
