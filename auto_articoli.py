"""auto_articoli.py — pubblica gli ARTICOLI della redazione appena una sessione e'
disponibile su FastF1. Pensato per la CRONTAB del Mac (ogni 30 min), gemello di
auto_tele.py ma per i pezzi editoriali.

COSA FA. Trova il Gran Premio del weekend in corso (dal calendario) e, per ogni
sessione utile non ancora fatta, genera -> VERIFICA (verificatore-LLM) -> pubblica
-> mette online. FP1 escluso (assetti/benzina non affidabili).

LA PSEUDO-SESSIONE "FIA". Prima di tutte c'e' un innesco che NON viene da FastF1:
il documento FIA "Car Presentation Submissions" (l'elenco ufficiale degli
aggiornamenti tecnici, uno per squadra) esce il venerdi' PRIMA delle FP1 — a volte
36 minuti prima. E' l'unica notizia tecnica disponibile quando in pista non e'
ancora successo niente, e da li' esce l'ANTEPRIMA del weekend. Siccome non ha un
orario garantito, il poller non aspetta un'ora fissa: prova a ogni giro (:15/:45)
e finche' il documento non c'e' non segna nulla come fatto. Vedi _passo_fia().

IDEMPOTENTE. Una sessione gia' fatta viene saltata (stato in data/.auto_articoli_stato.json):
il cron puo' girare ogni 30 min senza sfornare doppioni. Una sessione non ancora su
FastF1 non produce nulla e NON viene segnata: si ritenta al giro dopo.

Uso:
  python3 auto_articoli.py            # genera + commit locale (no push)
  python3 auto_articoli.py --push     # + push su main (deploy Vercel)
  python3 auto_articoli.py --dry-run  # dice solo cosa farebbe
  python3 auto_articoli.py --gara "Ungheria"   # forza il GP
  python3 auto_articoli.py --fia-html radice.html --fia-cache /tmp/cp  # collaudo offline
"""
from __future__ import annotations
import os
import re
import sys
import json
import argparse
import datetime

_QUI = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(_QUI, "ai_lab", "redazione"))
sys.path.insert(0, os.path.join(_QUI, "ai_lab", "redazione", "rilevatori"))

import genera_weekend  # noqa: E402

try:
    import fia_cp      # noqa: E402  (il documento FIA degli aggiornamenti tecnici)
except Exception as _e:                      # pragma: no cover — modulo assente/rotto
    fia_cp = None
    print(f"[fia] modulo non importabile ({_e}): l'anteprima FIA resta spenta")

STATO = os.path.join(_QUI, "data", ".auto_articoli_stato.json")
CALENDARIO = os.path.join(_QUI, "demo", "data", "calendario_2026.json")
MAPPA_GARE = os.path.join(_QUI, "data", "mappa_gare.json")

# "FIA" e' una PSEUDO-sessione: non esiste in pista e non viene da FastF1. Sta per
# prima perche' e' l'unica cosa pubblicabile prima che si giri (il documento esce
# il venerdi' mattina, prima delle FP1).
SESSIONE_FIA = "FIA"
SESSIONI = [SESSIONE_FIA, "FP2", "FP3", "Q", "R"]   # FP1 escluso di proposito

# Chiave dello stato dove vive l'impronta del documento FIA gia' pubblicato. Comincia
# con "_" perche' lo stato e' {nome_gara: [sessioni]} e nessuna gara si chiama cosi'.
_CHIAVE_FIA = "_fia"

# CORREZIONI AL NOME FIA. data/mappa_gare.json e' indicizzata sul nome dell'evento
# come lo scrive la FIA, ed e' stata verificata copertina per copertina sugli 11
# documenti 2026: 10 combaciano alla lettera. Uno no — la mappa dice "Barcelona
# Grand Prix", la FIA scrive "BARCELONA-CATALUNYA GRAND PRIX". Non si tocca la mappa
# (la usano altri): si corregge qui, sul nome italiano, che e' quello che arriva.
# T11: "Barcelona-Catalunya" e "Spanish" (= Madrid) sono DUE gare diverse del 2026.
_CORREZIONI_FIA = {
    "Spagna": "Barcelona-Catalunya Grand Prix",
}


def _stato():
    try:
        return json.load(open(STATO))
    except Exception:
        return {}


def _salva(s):
    os.makedirs(os.path.dirname(STATO), exist_ok=True)
    json.dump(s, open(STATO, "w"), ensure_ascii=False, indent=2)


def _calendario():
    try:
        return json.load(open(CALENDARIO)).get("gare", []) or []
    except Exception:
        return []


def gp_attivo():
    """Il GP del weekend ATTIVO: quello con la gara entro +/-3 giorni da oggi (cosi'
    resta attivo dal venerdi' fino a un paio di giorni DOPO la gara -> i pezzi post-gara
    fanno in tempo a uscire). gp_weekend_in_corso() invece guarda solo avanti e, finita
    la gara, salterebbe gia' al GP successivo. Fallback: gp_weekend_in_corso().

    Nota per l'anteprima FIA: il documento esce il venerdi', che dista 2 giorni dalla
    gara della domenica — dentro la finestra. Anche un'uscita anticipata al giovedi'
    (3 giorni) ci sta dentro; prima di cosi' il documento non e' mai apparso."""
    cal = _calendario()
    if cal:
        oggi = datetime.date.today()
        best, best_d = None, 99
        for g in cal:
            d = g.get("data")
            if not d:
                continue
            try:
                delta = abs((datetime.date.fromisoformat(d) - oggi).days)
            except ValueError:
                continue
            if delta <= 3 and delta < best_d:
                best, best_d = g.get("nome"), delta
        if best:
            return best
    return genera_weekend.gp_weekend_in_corso()


def _gara_lavorata(gara):
    """True se la gara e' gia' in data/gare_registro.json, cioe' si e' corsa E la
    pipeline (auto_gara) ne ha lavorato i dati. E' il semaforo del giro post-gara:
    vedi la GUARDIA POST-GARA in main(). In dubbio (file illeggibile) ritorna False:
    meglio ritentare al giro dopo che segnare "R" come fatta a vuoto."""
    try:
        reg = json.load(open(os.path.join(_QUI, "data", "gare_registro.json")))
        return gara in reg
    except Exception:
        return False


# ============================================================ anteprima FIA

def _anno_gp(gara):
    """Anno della gara dal calendario. Fallback: l'anno di oggi (il documento esce
    nella stessa settimana della gara, quindi l'anno non puo' divergere)."""
    for g in _calendario():
        if g.get("nome") == gara:
            try:
                return datetime.date.fromisoformat(g["data"]).year
            except Exception:
                break
    return datetime.date.today().year


def _specifico(nome):
    """Il nome e' abbastanza specifico da essere un CONTROLLO e non un passe-partout?

    Stessa regola di fia_cp._gp_utilizzabile: "Grand Prix" da solo combacia con
    qualunque documento, e il cancello sull'identita' diventerebbe un no-op proprio
    nel caso che deve fermare (il CDN che serve l'elenco di un'altra gara)."""
    k = re.sub(r"[^a-z0-9]+", " ", (nome or "").lower()).strip()
    proprio = re.sub(r"\b(grand|prix|gp)\b", " ", k).strip()
    return len(proprio) >= 3


def nome_fia_del_gp(gara):
    """Nome dell'evento come lo scrive la FIA ("Olanda" -> "Dutch Grand Prix").

    E' l'unico ingrediente OBBLIGATORIO di tutta la catena: senza, cancello_identita
    non controlla piu' niente e un elenco vecchio di un'ora (T12) passerebbe come
    documento di questa gara. Se non si sa, si torna None e non si procede: mai
    ripiegare su un nome generico.
    """
    if gara in _CORREZIONI_FIA:
        nome = _CORREZIONI_FIA[gara]
        return nome if _specifico(nome) else None
    try:
        mappa = json.load(open(MAPPA_GARE))
    except Exception as e:
        print(f"  [fia] mappa_gare.json non leggibile ({e}): nome FIA sconosciuto")
        return None
    trovati = [k for k, v in mappa.items() if (v or {}).get("nome") == gara]
    if len(trovati) != 1:
        print(f"  [fia] \"{gara}\" non ha UN solo nome FIA in mappa_gare.json "
              f"({trovati or 'nessuno'}): non procedo")
        return None
    nome = trovati[0]
    if not _specifico(nome):
        print(f"  [fia] nome FIA \"{nome}\" troppo generico: non procedo")
        return None
    return nome


def _impronta(pdf, doc, gp_fia):
    """Come si riconosce IL documento pubblicato: slug + byte + data di uscita."""
    try:
        byte = os.path.getsize(pdf)
    except OSError:
        byte = None
    return {
        "slug": doc.get("slug"),
        "doc": doc.get("doc"),
        "pubblicato_iso": doc.get("pubblicato_iso"),
        "byte": byte,
        "gp_fia": gp_fia,
        "pdf": pdf,
        "quando": datetime.datetime.now().isoformat(timespec="seconds"),
    }


def _riemissione(gara, vecchia, doc):
    """La FIA ha ritirato e ripubblicato il documento dopo che l'avevamo usato?

    Non si ripubblica niente (l'anteprima e' gia' online e il pezzo e' scritto): si
    RILEVA e si scrive nel log, che e' quello che serve per accorgersene il giorno
    dopo. Il confronto e' su quel che si vede senza scaricare di nuovo — slug, numero
    di documento, ora di pubblicazione dell'elenco — piu' la dimensione della copia
    in cache, che cambia se qualcuno l'ha rinfrescata sotto i piedi.
    """
    cambi = []
    for campo in ("slug", "doc", "pubblicato_iso"):
        prima, adesso = vecchia.get(campo), doc.get(campo)
        if prima != adesso:
            cambi.append(f"{campo}: {prima!r} -> {adesso!r}")
    pdf = vecchia.get("pdf")
    if pdf and vecchia.get("byte") is not None:
        try:
            ora = os.path.getsize(pdf)
            if ora != vecchia["byte"]:
                cambi.append(f"byte in cache: {vecchia['byte']} -> {ora}")
        except OSError:
            cambi.append(f"copia in cache sparita: {pdf}")
    if cambi:
        print(f"  [fia] ATTENZIONE — il documento di {gara} e' stato RIEMESSO dopo "
              f"la pubblicazione dell'anteprima: {'; '.join(cambi)}. "
              f"L'articolo online resta quello vecchio: da rivedere a mano.")
    else:
        print(f"  [fia] anteprima gia' pubblicata per {gara} "
              f"({vecchia.get('slug')}), documento invariato.")


def _passo_fia(gara, st, fatte, dry_run=False, push=False,
               html_radice=None, cartella=None):
    """L'anteprima dal documento FIA. Best-effort: non alza mai, non segna a meta'.

    Ordine, e ogni passo puo' dire di no senza che il resto del giro ne risenta:
      1. nome FIA della gara (OBBLIGATORIO: senza, non si procede);
      2. scopri_documento(anno, atteso_gp=nome) — se non c'e' ancora, si ritenta
         al giro dopo (30 min) e NON si segna niente: il documento arriva quando
         arriva, a volte mezz'ora prima delle FP1;
      3. scarico in cache (rispetta il Crawl-delay: 10 s prima di una richiesta vera);
      4. cancello_identita + cancello_qualita — se si chiudono NON si pubblica e il
         motivo finisce nel log per esteso;
      5. generatori della sessione "FIA" e pubblicazione come le altre sessioni.

    `html_radice` e `cartella` esistono solo per i collaudi offline (vedi --fia-html
    e --fia-cache): in produzione restano None.
    """
    if fia_cp is None:
        print("  FIA: modulo fia_cp assente — salto (nessuna anteprima)")
        return
    atteso = nome_fia_del_gp(gara)
    if not atteso:
        print(f"  FIA: nome FIA di \"{gara}\" non determinabile: NON procedo "
              f"(senza atteso_gp il cancello identita' non controlla nulla)")
        return
    anno = _anno_gp(gara)

    testo = None
    if html_radice:
        try:
            testo = open(html_radice, encoding="utf-8", errors="replace").read()
            print(f"  [fia] COLLAUDO OFFLINE: elenco letto da {html_radice}")
        except OSError as e:
            print(f"  [fia] elenco offline non leggibile ({e})")
            return

    doc = fia_cp.scopri_documento(anno, atteso_gp=atteso, html_testo=testo)
    if not doc:
        print(f"  FIA: documento \"{atteso}\" {anno} non ancora pubblicato "
              f"(o l'evento in cima all'elenco e' un altro): ritento al prossimo giro")
        return
    print(f"  [fia] trovato {doc['slug']} (Doc {doc['doc']}, uscito {doc['pubblicato_iso']})")

    impronte = st.setdefault(_CHIAVE_FIA, {})
    gia = impronte.get(gara)
    if gia:
        # Idempotenza: l'anteprima esce UNA volta. Qui si guarda solo se la FIA ha
        # ripubblicato il documento, e lo si scrive nel log.
        _riemissione(gara, gia, doc)
        return

    pdf = fia_cp.scarica(doc["url"], cartella=cartella or fia_cp.CACHE_DIR)
    if not pdf:
        print("  FIA: scarico fallito o PDF rifiutato: ritento al prossimo giro")
        return

    ok, motivo = fia_cp.cancello_identita(pdf, anno, atteso)
    if not ok:
        print(f"  FIA: CANCELLO IDENTITA' CHIUSO — {motivo}. NON pubblico "
              f"(file: {os.path.basename(pdf)}, atteso: {atteso} {anno})")
        return
    print(f"  [fia] identita': {motivo}")

    estratto = fia_cp.estrai(pdf)
    ok, problemi = fia_cp.cancello_qualita(estratto)
    if not ok:
        print(f"  FIA: CANCELLO QUALITA' CHIUSO ({len(problemi)} problemi). NON pubblico:")
        for p in problemi:
            print(f"        - {p}")
        return
    squadre = [s for s in estratto["squadre"] if s["stato"] == "aggiornamenti"]
    pezzi = sum(len(s["componenti"]) for s in squadre)
    print(f"  [fia] qualita': OK — {len(estratto['squadre'])} squadre, {pezzi} componenti")

    # I generatori della sessione "FIA" possono rileggere la fonte da soli (scarica()
    # torna dalla cache senza rete); questi tre valori evitano loro di dover ri-scoprire
    # il documento, e garantiscono che leggano ESATTAMENTE il file che ha passato i
    # cancelli qui sopra. Chi non li usa non se ne accorge.
    os.environ["MURETTO_FIA_PDF"] = pdf
    os.environ["MURETTO_FIA_GP"] = atteso
    os.environ["MURETTO_FIA_ANNO"] = str(anno)
    # La data di uscita viaggia insieme al file: senza, chi legge il PDF non puo'
    # rifare il cancello di FRESCHEZZA e si fiderebbe di noi sulla parola.
    os.environ["MURETTO_FIA_PUBBLICATO"] = doc.get("pubblicato_iso") or ""

    _, prodotti = genera_weekend.genera_per_gp(gara, [SESSIONE_FIA])
    if not prodotti:
        print("  FIA: cancelli aperti ma nessuna bozza prodotta "
              "(nessun generatore per la sessione FIA, o non applicabile): "
              "ritento al prossimo giro")
        return
    if dry_run:
        print(f"  FIA: {len(prodotti)} bozze pronte (dry-run, NON pubblico): "
              f"{[r['id'] for r in prodotti]}")
        return

    pubbl = genera_weekend.pubblica_e_deploy(prodotti, deploy=push,
                                             etichetta="anteprima FIA")
    fatte.add(SESSIONE_FIA)
    st[gara] = sorted(fatte)
    impronte[gara] = _impronta(pdf, doc, atteso)
    _salva(st)
    if pubbl:
        print(f"  FIA: pubblicati {pubbl}")
    else:
        print("  FIA: nessuna bozza superava la verifica: restano in coda per la "
              "revisione umana (la sessione resta segnata: non si rigenera in loop)")


# ==================================================================== giro

def main():
    ap = argparse.ArgumentParser(description="Auto-pubblica gli articoli per sessione (cron Mac)")
    ap.add_argument("--push", action="store_true", help="commit + push su main (deploy)")
    ap.add_argument("--gara", default=None, help="forza il GP; default = weekend attivo")
    ap.add_argument("--dry-run", action="store_true", help="non pubblica, dice solo cosa farebbe")
    ap.add_argument("--fia-html", default=None,
                    help="COLLAUDO: elenco FIA da file invece che dalla rete")
    ap.add_argument("--fia-cache", default=None,
                    help="COLLAUDO: cartella della cache PDF invece di ~/muretto_shared/fia_cp")
    a = ap.parse_args()

    gara = a.gara or gp_attivo()
    if not gara:
        print("nessun GP del weekend in corso (calendario): esco.")
        return 0

    st = _stato()
    fatte = set(st.get(gara, []))
    print(f"GP in corso: {gara} · sessioni gia' fatte: {sorted(fatte) or '-'}")

    for ses in SESSIONI:
        if ses == SESSIONE_FIA:
            # Anche a cose fatte si passa di qui: serve a rilevare una RIEMISSIONE
            # del documento. Tutto dentro un try: un guasto della fonte FIA non deve
            # impedire ai pezzi delle sessioni vere di uscire.
            try:
                _passo_fia(gara, st, fatte, dry_run=a.dry_run, push=a.push,
                           html_radice=a.fia_html, cartella=a.fia_cache)
            except Exception as e:
                print(f"  FIA: giro fallito ({e.__class__.__name__}: {e}) — "
                      f"nulla segnato, ritento al prossimo giro")
            continue
        if ses in fatte:
            continue
        # GUARDIA POST-GARA. "R" non e' come le altre sessioni: il giro post-gara fa
        # partire ANCHE i generatori di STAGIONE (dna, efficienza, sviluppo relativo),
        # che producono sempre perche' si nutrono dei dati delle gare precedenti. Senza
        # questa guardia il cron, gia' dal giovedi' (gp_attivo apre la finestra a -3
        # giorni), otterrebbe quelle bozze, segnerebbe "R" come FATTA e i veri pezzi
        # post-gara (recap, vero passo) non uscirebbero MAI in automatico.
        # Segnale usato: la gara e' in data/gare_registro.json, dove la mette auto_gara
        # DOPO averla lavorata. Vuol dire insieme: la gara si e' corsa E i suoi dati ci
        # sono. Piu' affidabile dell'orologio (che direbbe solo che e' passata l'ora).
        if ses == "R" and not _gara_lavorata(gara):
            print(f"  R: la gara non e' ancora nel registro (non corsa, o dati non "
                  f"ancora lavorati): niente giro post-gara, ritento al prossimo giro")
            continue
        # prova a generare i pezzi di questa sessione (self-skip se FastF1 non ha ancora i dati)
        _, prodotti = genera_weekend.genera_per_gp(gara, [ses])
        if not prodotti:
            print(f"  {ses}: non ancora disponibile / niente pezzi — ritento al prossimo giro")
            continue
        if a.dry_run:
            print(f"  {ses}: {len(prodotti)} bozze pronte (dry-run, NON pubblico): "
                  f"{[r['id'] for r in prodotti]}")
            continue
        pubbl = genera_weekend.pubblica_e_deploy(prodotti, deploy=a.push)
        fatte.add(ses)
        st[gara] = sorted(fatte)
        _salva(st)
        print(f"  {ses}: pubblicati {pubbl}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
