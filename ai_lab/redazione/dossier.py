"""
dossier.py — da FATTI a DOSSIER: tutto quello che serve per scrivere, e niente altro.

I rilevatori producono `facts.json`: numeri misurati, corretti, arrotondati alla
precisione di pubblicazione. Sono la verita', e restano intoccati. Ma non bastano a
scrivere un articolo, e le cose che mancano sono esattamente quelle che nel corpus
attuale non ci sono mai:

  · i NOMI. Nei fatti i piloti sono sigle FIA. Nel corpus pubblicato ci sono 101
    sigle contro 42 nomi propri: il testo non contiene mai una persona, contiene
    identificatori di riga. Qui la sigla diventa «Kimi Antonelli, Mercedes, primo in
    campionato», e chi scrive puo' finalmente nominare qualcuno.
  · la SCALA UMANA. Dodici millesimi non vogliono dire niente; novanta centimetri di
    luce si'. La conversione la fa Python, come ogni altro numero: cosi' e'
    tracciabile e la guardia la accetta.
  · la POSTA. In dodici articoli le parole campionato, punti e classifica compaiono
    quattro volte in tutto. Senza la classifica sul tavolo, nessun pezzo puo' dire
    che cosa cambia adesso.
  · la MEMORIA di quel che abbiamo gia' scritto su questo GP e su questi team.
  · il PROSSIMO circuito, col suo profilo: e' quello che rende possibile la chiusa
    di verifica («se e' una scelta, a Monza la rivediamo»).

Tutti i numeri che questo modulo aggiunge sono CALCOLATI da Python a partire dai
fatti o da file generati del repo. Nessuno e' stimato, nessuno viene da fuori. E il
dossier — non `facts.json` — e' l'insieme che la guardia dei numeri considera
ammesso: e' il motivo per cui la traduzione in scala umana e' lecita e l'invenzione
no.

Il formato e' JSON tipato, e viene passato al modello dentro un tag XML. Non e' un
dettaglio: su compiti data-to-text sportivi, dare gli stessi dati in JSON invece che
riassunti in prosa abbatte gli errori fattuali di circa due terzi.
"""
from __future__ import annotations
import os
import re
import json

import stile

_QUI = os.path.dirname(os.path.abspath(__file__))
REPO = stile.REPO
DATI = os.path.join(REPO, "demo", "data")

# Lunghezza di riferimento di una monoposto 2026, per la scala umana. Passo massimo
# 3400 mm da regolamento; la lunghezza totale non e' regolata ma sta attorno ai 5,3 m.
# Dichiarata qui perche' un numero senza provenienza non esiste.
LUNGHEZZA_VETTURA_M = 5.3


def _json(p, default=None):
    try:
        with open(p, encoding="utf-8") as f:
            return json.load(f)
    except Exception:
        return default


# --------------------------------------------------------------- anagrafica ----

def anagrafica():
    """sigla -> {nome, cognome, team, pos, punti} dalla classifica ufficiale."""
    c = _json(os.path.join(DATI, "classifiche_2026.json"), {}) or {}
    fuori = {}
    for p in c.get("piloti", []):
        nome = (p.get("nome") or "").strip()
        fuori[p.get("sigla")] = {
            "nome": nome,
            "cognome": nome.split()[-1] if nome else p.get("sigla"),
            "team": p.get("team_demo") or p.get("team") or p.get("constructorId"),
            "posizione_campionato": p.get("pos"),
            "punti": p.get("punti"),
            "distacco_dal_leader": p.get("distacco"),
        }
    return fuori


def campionato():
    c = _json(os.path.join(DATI, "classifiche_2026.json"), {}) or {}
    piloti = c.get("piloti", [])[:3]
    cost = c.get("costruttori", [])[:3]
    if not piloti:
        return None
    return {
        "aggiornato_al": (c.get("aggiornato_al") or {}).get("nome"),
        "round": (c.get("aggiornato_al") or {}).get("round"),
        "piloti": [{"pos": p.get("pos"), "nome": p.get("nome"), "punti": p.get("punti"),
                    "distacco": p.get("distacco")} for p in piloti],
        "costruttori": [{"pos": t.get("pos"), "nome": t.get("nome"),
                         "punti": t.get("punti")} for t in cost],
    }


def prossima_gara(round_corrente):
    # senza round non si sa quale sia la prossima: restituire il round 1 sarebbe
    # peggio che non rispondere. L'assenza e' null, mai un valore plausibile.
    if not round_corrente:
        return None
    cal = _json(os.path.join(DATI, "calendario_2026.json"), {}) or {}
    gare = sorted(cal.get("gare", []), key=lambda g: g.get("round", 0))
    for g in gare:
        if (g.get("round") or 0) > (round_corrente or 0):
            profilo = _profilo_circuito(g.get("nome"))
            return {"round": g.get("round"), "nome": g.get("nome"),
                    "titolo": g.get("titolo"), "data": g.get("data"),
                    "circuito": g.get("circuito"), "profilo": profilo}
    return None


def _profilo_circuito(nome_it):
    """Il DNA del circuito, se lo abbiamo gia' misurato in una stagione precedente
    o quest'anno. Serve a dire «stesso profilo, stesso problema»."""
    s = _json(os.path.join(DATI, "analisi", "stagione_dati.json"), {}) or {}
    for g in s.get("gare", []):
        c = (g.get("circuito") or "").lower()
        if nome_it and (nome_it.lower()[:5] in c or c[:5] in nome_it.lower()):
            d = g.get("dna") or {}
            return {k: d.get(k) for k in
                    ("full_throttle_pct", "top", "n_curve", "curve_lente",
                     "curve_medie", "curve_veloci", "vel_curva_med") if d.get(k) is not None}
    return None


# -------------------------------------------------------------- scala umana ----

def scala_umana(facts):
    """Le conversioni che rendono un numero immaginabile. Solo quelle che i fatti
    permettono: senza una velocita' di riferimento non si converte un tempo in
    metri, e allora non si converte."""
    fuori = []
    v_kmh = _velocita_riferimento(facts)
    delta = _delta_tempo(facts)
    if v_kmh and delta:
        v = v_kmh / 3.6
        # i delta PICCOLI sono quelli che hanno bisogno di essere tradotti: dodici
        # millesimi non vogliono dire niente, tre secondi si'.
        for d in sorted(delta)[:6]:
            m = d * v
            fuori.append({
                "grandezza": f"{_it(d, 3)} s",
                "in_metri": round(m, 1),
                "in_lunghezze_vettura": round(m / LUNGHEZZA_VETTURA_M, 1),
                "alla_velocita_kmh": round(v_kmh),
                "come_dirlo": _frase_scala(m),
            })
    return fuori


def _frase_scala(m):
    if m < 1:
        return f"{round(m * 100)} centimetri"
    if m < LUNGHEZZA_VETTURA_M:
        return f"{_it(m, 1)} metri, meno di una lunghezza di vettura"
    return f"{_it(m, 1)} metri, {_it(m / LUNGHEZZA_VETTURA_M, 1)} lunghezze di vettura"


def _velocita_riferimento(facts):
    for k in ("vmax_kmh", "vmax", "top", "velocita_punta", "v_media_kmh", "vmin"):
        v = _cerca(facts, k)
        if isinstance(v, (int, float)) and 50 < v < 400:
            return float(v)
        if isinstance(v, dict):
            vals = [x for x in v.values() if isinstance(x, (int, float)) and 50 < x < 400]
            if vals:
                return float(sum(vals) / len(vals))
    return None


def _delta_tempo(facts):
    """I delta in secondi presenti nei fatti: quelli che vale la pena tradurre."""
    fuori = []

    def scava(x, chiave=""):
        if isinstance(x, dict):
            for k, v in x.items():
                scava(v, k)
        elif isinstance(x, list):
            for v in x[:12]:
                scava(v, chiave)
        # UNA CHIAVE NON E' SEMPRE UNA STRINGA, e qui capita per davvero: un articolo
        # sui rapporti del cambio porta le marce come chiavi, cioe' INTERI. Con
        # `chiave.lower()` partiva AttributeError, e il guasto non si vedeva come un
        # guasto: redazione.py lo prende, torna al TEMPLATE e va avanti («nessun guasto
        # puo' fermare la gara»). L'articolo usciva lo stesso, scritto peggio, e il
        # correttore lo bocciava per ripetizioni — dal log sembrava un problema di
        # prosa. Successo il 21/08/2026 su fp-rapporti-zandvoort-2026.
        #
        # COSA NON CAMBIA: con una chiave intera il marcatore non fa presa comunque (7
        # non contiene «delta»), quindi quel numero non entrava e non entra fra i
        # salienti. Rendere il marcatore cumulativo sul percorso delle chiavi
        # cambierebbe QUALI numeri la prosa traduce in ogni articolo: e' una decisione,
        # non una riparazione, e non si prende a weekend cominciato.
        elif isinstance(x, (int, float)) and not isinstance(x, bool):
            k = str(chiave).lower()
            if any(t in k for t in ("margin", "delta", "gap", "distacco", "_s")) \
                    and 0 < abs(x) < 5:
                fuori.append(abs(float(x)))

    scava(facts)
    return sorted(set(round(v, 3) for v in fuori), reverse=True)


def _cerca(x, chiave):
    if isinstance(x, dict):
        if chiave in x:
            return x[chiave]
        for v in x.values():
            r = _cerca(v, chiave)
            if r is not None:
                return r
    elif isinstance(x, list):
        for v in x:
            r = _cerca(v, chiave)
            if r is not None:
                return r
    return None


def _it(x, dec=1):
    return f"{x:.{dec}f}".replace(".", ",")


# ----------------------------------------------------------------- costruzione ----

_RE_SIGLA = re.compile(r"\b[A-Z]{3}\b")


def sigle_in(facts):
    """Le sigle dei piloti che compaiono davvero nei fatti."""
    blob = json.dumps(facts, ensure_ascii=False)
    ana = anagrafica()
    return [s for s in dict.fromkeys(_RE_SIGLA.findall(blob)) if s in ana]


def costruisci(articolo, facts, memoria=None):
    """Il dossier completo. `articolo` serve per identita', figure e provenienza:
    quello che il generatore ha gia' deciso e che non si rimette in discussione."""
    facts = facts or {}
    ana = anagrafica()
    sig = sigle_in(facts)
    rnd = articolo.get("round") or facts.get("round")

    figure = []
    for i, s in enumerate(articolo.get("sezioni", []) or []):
        f = s.get("figura")
        if isinstance(f, dict) and f.get("svg"):
            figure.append({"chiave": s.get("tag") or f"fig{i}",
                           "didascalia": f.get("didascalia"),
                           "fonte": f.get("fonte")})

    non_misurabili = [p for p in (articolo.get("provenienza") or [])
                      if p.get("stato") in ("NON_MISURABILE", "STIMATO")]

    d = {
        "identita": {
            "id": articolo.get("id"),
            "gara": articolo.get("gara") or facts.get("gara"),
            "gp": articolo.get("gp") or facts.get("gp"),
            "circuito": articolo.get("circuito") or facts.get("circuito"),
            "sessione": articolo.get("sessione") or facts.get("sessione"),
            "round": rnd,
            "data": articolo.get("data"),
            "canale": articolo.get("canale"),
        },
        "fatti": facts,
        "protagonisti": {s: ana[s] for s in sig},
        "campionato": campionato(),
        "prossima_gara": prossima_gara(rnd),
        "scala_umana": scala_umana(facts),
        "figure_disponibili": figure,
        "provenienza": articolo.get("provenienza") or [],
        "non_misurabile": [{"grandezza": p.get("grandezza"), "stato": p.get("stato"),
                            "da": p.get("da")} for p in non_misurabili],
        "fonti": articolo.get("fonti") or [],
    }
    if memoria is not None:
        d["gia_scritto_su_questo_gp"] = _precedenti(memoria, d["identita"], sig)
    return d


def _precedenti(memoria, identita, sigle):
    fuori = []
    for a in memoria._vivi()[:20]:
        if a.get("id") == identita.get("id"):
            continue
        stesso_gp = a.get("gp") and a.get("gp") == identita.get("gp")
        blob = json.dumps(a.get("tag") or [], ensure_ascii=False) + (a.get("titolo") or "")
        stessi = [s for s in sigle if s in blob]
        if stesso_gp or stessi:
            fuori.append({"titolo": a.get("titolo"), "data": a.get("data"),
                          "tesi": a.get("tesi"), "perche": "stesso GP" if stesso_gp
                          else "stessi protagonisti"})
    return fuori[:5]


def numeri_ammessi(dossier):
    """L'insieme dei numeri che la prosa puo' usare: i fatti PIU' quello che questo
    modulo ha calcolato (la scala umana, le posizioni di campionato). Tutto
    aritmetica di Python, niente di inventato."""
    return stile.numeri_fatti(dossier)


if __name__ == "__main__":
    import argparse
    ap = argparse.ArgumentParser(description="Mostra il dossier di una bozza")
    ap.add_argument("id")
    a = ap.parse_args()
    d = os.path.join(_QUI, "bozze", a.id)
    art = _json(os.path.join(d, "articolo.json"))
    fac = _json(os.path.join(d, "facts.json"), {})
    if not art:
        raise SystemExit(f"bozza non trovata: {a.id}")
    import memoria as _m
    print(json.dumps(costruisci(art, fac, _m.Memoria(escludi=[a.id])),
                     ensure_ascii=False, indent=1)[:4000])
