"""
genera.py — l'orchestratore della redazione.

Scorre i generatori registrati (registro.GENERATORI) e, per la gara indicata,
produce le bozze. Ogni generatore gira ISOLATO: se uno fallisce (es. fastf1
assente, sessione senza telemetria in cache, dato mancante) viene saltato con la
ragione, e NON blocca gli altri. Nessuna bozza viene pubblicata: restano nell'area
Lab, in attesa della coda di revisione umana.

E' il passo agganciato al blocco LABORATORIO di auto_gara.py (check=False).

Uso:
  python3 ai_lab/redazione/genera.py                 # tutti i generatori, gara = default
  python3 ai_lab/redazione/genera.py --gara "Gran Bretagna"
  python3 ai_lab/redazione/genera.py --lista          # elenca i generatori registrati
"""
from __future__ import annotations
import os
import sys
import argparse
import importlib
import inspect
import traceback

_QUI = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, _QUI)
sys.path.insert(0, os.path.join(_QUI, "rilevatori"))

import registro  # noqa: E402


def _carica(nome):
    return importlib.import_module(nome)


def aggiorna_dati_stagione(verbose=True):
    """Estrae le feature multi-gara mancanti e ripubblica il cruscotto interattivo
    (demo/dati.html). Idempotente: le gare gia' estratte tornano dalla cache, solo
    la nuova viene ricalcolata. Guardato: se fastf1 manca (es. VPS) o una gara e'
    lacunosa, salta senza fermare nulla. Richiede la telemetria in cache (Mac)."""
    import json
    repo = os.path.abspath(os.path.join(_QUI, "..", ".."))
    try:
        import multigara
        import pubblica_dati
    except Exception as e:
        if verbose:
            print(f"  [dati] salto cruscotto (import): {e}")
        return
    try:
        reg = json.load(open(os.path.join(repo, "data", "gare_registro.json")))
    except Exception as e:
        if verbose:
            print(f"  [dati] registro non letto: {e}")
        reg = {}
    for k, v in reg.items():
        gp = v.get("ti")
        if not gp:
            continue
        for fn in (multigara.estrai_gara, multigara.estrai_dna):
            try:
                fn(2026, gp, "Race")
            except Exception as e:
                if verbose and os.environ.get("REDAZIONE_DEBUG"):
                    print(f"  [dati] {gp} {fn.__name__}: {e}")
    try:
        o = pubblica_dati.pubblica()
        if verbose:
            print(f"  [dati] cruscotto aggiornato: {o['n_gare']} gare")
    except Exception as e:
        if verbose:
            print(f"  [dati] pubblicazione fallita: {e}")

    # FORZA-MACCHINA: stesso giro post-gara, stessa fonte-gare (stagione_dati.json,
    # appena riscritto sopra). Ripubblica demo/data/analisi/forza_macchina.json: la
    # gara nuova si estrae UNA volta (Q+R da fastf1) e finisce in cache
    # (forza_stagione/), le altre tornano dalla cache. Guardato: se fastf1 manca
    # (VPS) o una gara e' lacunosa, salta senza fermare il resto della redazione.
    try:
        import forza_macchina
        of = forza_macchina.pubblica(2026)
        if verbose:
            print(f"  [forza] forza-macchina aggiornata: {of['n_gare']} gare "
                  f"(ultima {of['ultima']})")
    except Exception as e:
        if verbose:
            print(f"  [forza] forza-macchina saltata: {e}")


def _match_sessione(mod, sessione):
    """Un generatore parte sotto un filtro-sessione solo se lo dichiara in
    META['sessioni'] (lista, es. ['FP1','FP2'] o ['Q'], oppure ['*'] = qualsiasi).
    Chi NON dichiara 'sessioni' resta fuori dai filtri (es. non parte in FP): cosi'
    i generatori-gara non si attivano a meta' weekend.

    Senza filtro (sessione=None, giro post-gara) partono tutti TRANNE i generatori
    SOLO-FP: quelli vivono unicamente sull'innesco FP, altrimenti dopo la gara
    sfornerebbero bozze-FP stantie."""
    ss = getattr(mod, "META", {}).get("sessioni")
    if sessione is None:
        # post-gara (auto_gara): SOLO i generatori-gara/stagione (Race/*) o senza
        # sessione dichiarata. Quelli di FP e di Qualifica partono al loro innesco
        # di sessione (scheduler), non post-gara: cosi' non si sdoppiano.
        if not ss:
            return True
        return "Race" in ss or "*" in ss
    if not ss:
        return False
    return sessione in ss or "*" in ss


def genera_tutti(gara=None, data=None, sessione=None, verbose=True):
    # l'aggiornamento del cruscotto si nutre dei dati-GARA: in un giro FP e' inutile.
    if sessione is None:
        aggiorna_dati_stagione(verbose=verbose)
    prodotti, saltati = [], []
    for nome in registro.GENERATORI:
        try:
            mod = _carica(nome)
        except Exception as e:
            saltati.append((nome, f"import fallito: {e}"))
            if verbose:
                print(f"  [SKIP] {nome}: import fallito: {e}")
            continue
        if not _match_sessione(mod, sessione):
            continue
        try:
            kw = {"gara": gara, "data": data}
            try:
                if "sessione" in inspect.signature(mod.genera).parameters:
                    kw["sessione"] = sessione
            except (ValueError, TypeError):
                pass
            rec = mod.genera(**kw)
            if rec:
                prodotti.append(rec)
                if verbose:
                    print(f"  [OK]   {rec['id']} — {rec['titolo']} ({rec['stato']})")
            else:
                if verbose:
                    print(f"  [--]   {nome}: non applicabile a questa gara")
        except Exception as e:
            saltati.append((nome, str(e)))
            if verbose:
                print(f"  [SKIP] {nome}: {e}")
                if os.environ.get("REDAZIONE_DEBUG"):
                    traceback.print_exc()
    if verbose:
        print(f"\nBozze prodotte: {len(prodotti)} · saltate: {len(saltati)}")
        if prodotti:
            print("Rivedi con:  python3 ai_lab/redazione/coda.py --lista")
    return prodotti, saltati


def lista():
    for nome in registro.GENERATORI:
        try:
            m = _carica(nome)
            META = getattr(m, "META", {})
            print(f"  {META.get('canale','?')}  {META.get('id', nome):28} "
                  f"{META.get('titolo','')}  [{META.get('richiede','-')}]")
        except Exception as e:
            print(f"  ?  {nome:28} (import fallito: {e})")


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--gara", default=None)
    ap.add_argument("--data", default=None, help="AAAA-MM-GG per la targhetta della bozza")
    ap.add_argument("--sessione", default=None,
                    help="FP1/FP2/FP3/Q/... : lancia SOLO i generatori che dichiarano "
                         "quella sessione in META['sessioni']. Senza, giro post-gara completo.")
    ap.add_argument("--lista", action="store_true")
    a = ap.parse_args()
    if a.lista:
        lista()
    else:
        genera_tutti(gara=a.gara, data=a.data, sessione=a.sessione)
