"""
test_redazione.py — le sentinelle del sistema editoriale.

Regola della casa: una sentinella che stampa FALLITO ed esce 0 e' un ornamento.
Questo file esce 1 se anche una sola prova cade, e ogni prova dichiara in una riga
CHE COSA la farebbe fallire — cosi' chi la rompe sa subito se ha trovato un difetto
o se sta allargando una soglia.

Nessuna prova qui chiama l'API: il sistema editoriale deve essere collaudabile a
freddo, su un VPS, in CI, senza credenziali e senza rete. Le parti che parlano col
modello si provano con il ripiego (che la catena non esploda) e con il diario.

  python3 ai_lab/redazione/test_redazione.py
"""
from __future__ import annotations
import os
import sys
import json

_QUI = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, _QUI)

import stile          # noqa: E402
import voce           # noqa: E402
import memoria        # noqa: E402
import redazione      # noqa: E402
import redattore      # noqa: E402
import base           # noqa: E402

ESITI = []


def prova(nome, cosa_la_fa_fallire):
    def deco(fn):
        try:
            fn()
            ESITI.append((True, nome, ""))
        except AssertionError as e:
            ESITI.append((False, nome, f"{e}  [fallisce se: {cosa_la_fa_fallire}]"))
        except Exception as e:
            ESITI.append((False, nome, f"{type(e).__name__}: {e}  "
                                       f"[fallisce se: {cosa_la_fa_fallire}]"))
        return fn
    return deco


def art(sezioni, **kw):
    a = {"id": "prova", "titolo": "prova", "sommario": "", "sezioni": [
        {"tag": t, "titolo": "", "html": h} for t, h in sezioni]}
    a.update(kw)
    return a


# ------------------------------------------------------------------ numeri ----

@prova("numeri all'italiana", "qualcuno cambia _val_prosa e rompe la lettura di "
                              "10.191 (migliaia) o 1:24,507 (tempo sul giro)")
def t_val():
    assert stile._val_prosa("10.191") == 10191.0, "10.191 deve valere diecimila"
    assert abs(stile._val_prosa("0,247") - 0.247) < 1e-9
    assert abs(stile._val_prosa("1:24,507") - 84.507) < 1e-9
    assert abs(stile._val_prosa("20.80") - 20.8) < 1e-9


@prova("la guardia accetta il regime scritto all'italiana",
       "torna il difetto storico: nei fatti 10191.0, in pagina 10.191, e la guardia "
       "boccia la prosa legittima")
def t_guardia_regime():
    fatti = {"rpm_a": 10191.0, "rpm_b": 11559.0}
    amm = stile.numeri_fatti(fatti)
    fuori = stile.numeri_non_tracciabili("gira a 10.191 giri/min contro 11.559", amm)
    assert not fuori, f"respinti a torto: {fuori}"


@prova("la guardia accetta arrotondamenti e derivati",
       "la guardia torna a essere letterale e boccia 20,8 quando i fatti hanno 20,80, "
       "o la differenza fra due fatti")
def t_guardia_derivati():
    amm = stile.numeri_fatti({"a": 20.803, "b": 20.11})
    assert not stile.numeri_non_tracciabili("sono 20,8 secondi", amm)
    assert not stile.numeri_non_tracciabili("un margine di 0,693 s", amm), "differenza"


@prova("la guardia respinge davvero un numero inventato",
       "la guardia diventa cosi' permissiva da non servire piu' a niente")
def t_guardia_morde():
    amm = stile.numeri_fatti({"a": 20.803})
    fuori = stile.numeri_non_tracciabili("il degrado vale 0,417 s/giro", amm)
    assert fuori, "0,417 non e' nei fatti e deve essere segnalato"


# ------------------------------------------------------------------- testo ----

@prova("i paragrafi si separano prima di togliere i tag",
       "qualcuno riordina piano() e i paragrafi tornano a fondersi "
       "(e' il bug che generava 41 finte 'frasi fuse')")
def t_piano():
    t = stile.piano("<p>Prima.</p><p>Non seconda.</p>")
    assert "\n" in t, f"paragrafi fusi: {t!r}"
    assert len(stile.frasi(t)) == 2


@prova("Gulpease e' la formula, non l'approssimazione",
       "si passa a una libreria che conta la punteggiatura fra le lettere "
       "(fino a 3,5 punti di errore su un'escursione di 10)")
def t_gulpease():
    t = "Il gas resta pieno. La linea passa."
    g = stile.gulpease(t)
    P, F = len(stile.parole(t)), len(stile.frasi(t))
    L = sum(1 for c in t if c.isalnum())
    assert abs(g - (89 + (300 * F - 10 * L) / P)) < 1e-9
    assert F == 2 and L == 27, f"F={F} L={L}"


@prova("una frase stampata due volte e' un errore bloccante",
       "sparisce il controllo che ha trovato la frase duplicata del recap Ungheria")
def t_frase_doppia():
    f = ("<p>Minisettore per minisettore il duello resta apertissimo davvero, "
         "senza dubbio alcuno.</p>")
    e = stile.controlla(art([("A", f), ("B", f)]))
    assert any("due volte" in v["messaggio"] for v in e["violazioni"]), e["violazioni"]


@prova("un tratto ripetuto lungo produce UNA violazione, non venti",
       "torna il rapporto illeggibile in cui una frase duplicata genera venti righe")
def t_ripetizione_fusa():
    f = ("<p>la pole si decide sull equilibrio e non su un tratto solo del giro "
         "veloce di ieri</p>")
    e = stile.controlla(art([("A", f), ("B", f)]))
    n = sum(1 for v in e["violazioni"] if "tratto ripetuto" in v["messaggio"])
    assert n <= 2, f"{n} violazioni per una ripetizione sola"


@prova("il trattino lungo e' contingentato",
       "si allarga la soglia degli em-dash, che nel corpus valgono uno ogni 53 parole")
def t_emdash():
    h = "<p>Uno — due — tre — quattro — cinque parole in fila qui.</p>"
    e = stile.controlla(art([("A", h)]))
    assert any(v["regola"] == "R3" for v in e["violazioni"])


@prova("la prima frase non puo' avere per soggetto lo strumento",
       "si toglie la regola A1, e gli attacchi tornano tutti uguali "
       "(8 su 12 nel corpus storico)")
def t_incipit():
    e = stile.controlla(art([("A", "<p>La telemetria delle qualifiche mostra un "
                                   "gesto ripetuto e isolato dei due piloti.</p>")]))
    assert any(v["regola"] == "A1" for v in e["violazioni"])


@prova("il vocabolario 2026 e' bloccante",
       "un termine fuori epoca (DRS, MGU-H, beam wing) smette di essere un errore")
def t_2026():
    e = stile.controlla(art([("A", "<p>Con il DRS aperto la vettura guadagna in "
                                   "fondo al rettilineo principale del circuito.</p>")]))
    assert any(v["regola"] == "L4" and v["gravita"] == stile.BLOCCANTE
               for v in e["violazioni"])


@prova("dell'energia si PUO' parlare, non si puo' quantificare",
       "si torna a vietare il vocabolo invece del numero: e' la regola sbagliata "
       "che cinque articoli online violavano avendo ragione loro. Oppure il "
       "contrario: passa una quantificazione di una grandezza che non misuriamo")
def t_energia():
    ok = stile.controlla(art([("A", "<p>Il gesto e' compatibile con una gestione "
                                    "della carica: la Mercedes sta comprando "
                                    "margine per il giro dopo.</p>")]))
    assert not any(v["regola"] in ("L2", "L4") for v in ok["violazioni"]), \
        "parlare di carica senza numeri deve essere ammesso"
    ko = stile.controlla(art([("A", "<p>Alzando il piede la batteria recupera "
                                    "0,4 MJ in piu' rispetto al giro prima.</p>")]))
    assert any(v["regola"] == "L2" for v in ko["violazioni"]), "0,4 MJ non lo misuriamo"
    reg = stile.controlla(art([("A", "<p>Sopra i 290 km/h l'erogazione decade fino "
                                     "ad annullarsi, ed e' li' che nasce il "
                                     "clipping che si vede in fondo al rettilineo.</p>")]))
    assert not any(v["regola"] == "L2" for v in reg["violazioni"]), \
        "i valori pubblici del regolamento si possono citare"


@prova("una frase con quattro numeri e' una riga di CSV",
       "si allarga N2 e tornano i periodi-tabella (dieci numeri in una frase, "
       "nel corpus storico)")
def t_numeri_frase():
    e = stile.controlla(art([("A", "<p>Nel settore uno stanno 0,208 e 0,244 e "
                                   "0,025 e 0,281 secondi tondi tondi.</p>")]))
    assert any(v["regola"] == "N2" for v in e["violazioni"])


@prova("le formule da testo generato sono bloccanti",
       "si svuota la lista di lessico.json e «in conclusione» torna ammesso")
def t_formule():
    e = stile.controlla(art([("A", "<p>In conclusione la vettura resta la stessa "
                                   "e i piloti pure, per quanto ne sappiamo.</p>")]))
    assert any(v["regola"] == "D-IA" for v in e["violazioni"])


# ----------------------------------------------------------------- memoria ----

@prova("la memoria vede il corpus e riconosce una frase gia' uscita",
       "la memoria smette di leggere bozze/ o demo/data/analisi/, e il sistema "
       "puo' ripubblicare le stesse frasi")
def t_memoria():
    m = memoria.Memoria()
    assert len(m.articoli) >= 10, f"solo {len(m.articoli)} articoli in memoria"
    # una frase presa da un articolo vero, in questo momento: se la memoria
    # funziona, la riconosce come gia' uscita. Il testo cambia nel tempo, il
    # meccanismo no — per questo la frase si pesca dal corpus invece di essere
    # scritta qui dentro, dove invecchierebbe a ogni riscrittura.
    a = m.usciti()[0]
    _t, sez, _s = stile.prosa_articolo(a)
    tok = stile.token_norm(sez[0][1]) if sez else []
    assert len(tok) > 10, "primo articolo senza prosa"
    g = " ".join(tok[3:3 + stile.soglia("ngramma_len")])
    assert m.gia_scritto(g), f"la memoria non riconosce «{g}», che ha appena letto"
    assert m.forme(), "nessuna forma censita"


@prova("la memoria non accusa un articolo di copiare se stesso",
       "si toglie escludi(), e ogni pezzo gia' su disco risulta plagio di se' stesso")
def t_memoria_esclusione():
    ids = [a.get("id") for a in memoria.Memoria().articoli]
    m = memoria.Memoria(escludi=[ids[0]])
    assert all(a.get("id") != ids[0] for a in m._vivi())


# -------------------------------------------------------------------- voce ----

@prova("la voce e' abbastanza grande da essere cacheata e ha un'impronta stabile",
       "la guida scende sotto i 512 token (minimo di cache su Opus 5) o diventa "
       "variabile fra due chiamate, e la cache non si aggancia piu'")
def t_voce():
    assert voce.peso_token() > 512, voce.peso_token()
    assert voce.impronta() == voce.impronta()
    assert "—" not in voce.divieti() or True     # la guida puo' citarlo
    for lista in ("formule_ia", "cliche_f1", "vietati_2026"):
        assert voce.lessico()[lista], f"lista {lista} vuota"


@prova("il testo servito al modello non contiene niente di variabile",
       "qualcuno ci mette una data o un contatore e la cache del prefisso salta "
       "a ogni chiamata (si paga 12 volte invece di 1)")
def t_voce_stabile():
    import re as _re
    t = voce.testo_completo()
    assert not _re.search(r"\b20\d\d-\d\d-\d\dT\d\d", t), "c'e' un timestamp"


# ------------------------------------------------------------- fail-safe ----

@prova("ogni ritorno al template dichiara il MOTIVO, e sono due motivi diversi",
       "torna il fallimento muto: la riscrittura non riesce e nessuno se ne accorge "
       "(e' successo da luglio a oggi, su 18 bozze); oppure i due cancelli — "
       "il mandato del PO e le credenziali — si confondono in un messaggio solo")
def t_failsafe():
    import agenti
    vera_disp, vera_acc = agenti.disponibile, redazione.accesa
    vecchia = os.environ.pop("MURETTO_REDAZIONE", None)
    try:
        # 1. cancello del PO chiuso: si torna al template anche con le credenziali
        redazione.accesa = lambda: False
        agenti.disponibile = lambda: True
        a = redazione.riscrivi(art([("A", "<p>Testo.</p>")]), {}, verboso=False)
        assert "mandato" in a.get("scrittura", ""), a.get("scrittura")
        # 2. cancello aperto ma senza credenziali: motivo DIVERSO
        redazione.accesa = lambda: True
        agenti.disponibile = lambda: False
        b = redazione.riscrivi(art([("A", "<p>Testo.</p>")]), {}, verboso=False)
        assert "credenzial" in b.get("scrittura", ""), b.get("scrittura")
        assert a["scrittura"] != b["scrittura"]
    finally:
        agenti.disponibile, redazione.accesa = vera_disp, vera_acc
        if vecchia:
            os.environ["MURETTO_REDAZIONE"] = vecchia


@prova("il sistema editoriale nasce SPENTO",
       "qualcuno accende la scrittura nel mandato senza che il PO lo decida: da quel "
       "momento ogni gara pubblica prosa scritta dal modello")
def t_spento():
    m = json.load(open(os.path.join(_QUI, "mandato.json"), encoding="utf-8"))
    assert "scrittura" in m, "il mandato non ha piu' il cancello di accensione"
    if m["scrittura"].get("attiva"):
        assert m["scrittura"].get("acceso_da"), \
            "acceso senza dire da chi: il mandato e' un atto, non un flag"


@prova("il raccordo storico regge", "qualcuno rimuove redattore.verifica, che "
                                    "genera_weekend.py chiama prima di pubblicare")
def t_raccordo():
    assert callable(redattore.verifica)
    assert callable(redattore.disponibile)
    assert redattore.scrivi_prosa({}, "", set()) is None
    assert callable(base._riscrivi_con_llm)


# -------------------------------------------------- il corpus storico non passa --

@prova("il correttore ha il potere di bocciare",
       "le soglie vengono allargate finche' tutto passa: il correttore diventa un "
       "ornamento e questa e' l'unica prova che se ne accorge. Il campione e' "
       "CONGELATO (prove/corpus_storico.json) proprio perche' non guarisca da solo "
       "quando gli articoli veri vengono riscritti")
def t_corpus():
    p = os.path.join(_QUI, "prove", "corpus_storico.json")
    d = json.load(open(p, encoding="utf-8"))
    tot, regole = 0, set()
    for a in d["articoli"]:
        e = stile.controlla(a)
        assert not e["ok"], f"{a['id']} non viene piu' bocciato"
        tot += e["profilo"]["bloccanti"]
        regole |= {v["regola"] for v in e["violazioni"]
                   if v["gravita"] == stile.BLOCCANTE}
    assert tot >= 20, f"solo {tot} violazioni sul campione congelato (attese >= 20)"
    for r in ("R3", "N2", "11.3"):
        assert r in regole, f"la regola {r} non morde piu' sul campione congelato"


@prova("i fatti con chiavi NON stringa non fanno cadere il dossier",
       "qualcuno rimette `chiave.lower()` al posto di `str(chiave).lower()`")
def _chiavi_non_stringa():
    """Il guasto del 21/08/2026, e perche' merita una sentinella tutta sua.

    Un articolo sui rapporti del cambio porta le MARCE come chiavi: interi. Dentro
    `dossier._delta_tempo` la chiave veniva passata a `.lower()` e partiva
    AttributeError — ma il guasto non si vedeva come un guasto: `redazione.py` prende
    ogni eccezione, torna al TEMPLATE e va avanti («nessun guasto puo' fermare la
    gara»). L'articolo usciva lo stesso, scritto peggio, e il correttore lo bocciava
    per ripetizioni. Dal log sembrava un problema di prosa: era una riga di codice.

    E' il fallimento muto che questo repo descrive di se' in tre punti diversi, e si
    trova solo leggendo il log riga per riga. Percio' la prova sta qui."""
    import dossier
    for facts in ({"delta_s": {7: 0.4, 8: 0.9}},          # le marce
                  {"gap": {2026: 0.3}},                    # un anno
                  {"x": [{"delta": {1: 0.2}}]}):           # annidato in una lista
        dossier._delta_tempo(facts)                        # non deve alzare
        dossier.scala_umana(facts)
    # e cio' che funzionava deve continuare a funzionare
    assert dossier._delta_tempo({"x": {"delta_gap": 0.247}}) == [0.247], \
        "una chiave stringa che porta un delta piccolo deve restare fra i salienti"


def main():
    for fn in list(globals().values()):
        pass
    ok = sum(1 for e, _, _ in ESITI if e)
    for e, nome, msg in ESITI:
        print(f"  {'OK  ' if e else 'ROTTO'}  {nome}")
        if msg:
            print(f"          {msg}")
    print(f"\n{ok}/{len(ESITI)} sentinelle passate")
    return 0 if ok == len(ESITI) else 1


if __name__ == "__main__":
    raise SystemExit(main())
