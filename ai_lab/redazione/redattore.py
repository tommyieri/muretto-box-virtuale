"""
redattore.py — il vecchio scrittore LLM, oggi il RACCORDO verso la redazione nuova.

Il mestiere e' passato a redazione.py (dossier -> caposervizio -> firma ->
correttore -> revisione guidata) e a stile.py (il correttore deterministico).
Questo file resta perche' due call-site storici lo chiamano — `genera_weekend.py`
per la verifica prima di pubblicare, ed eventuali generatori vecchi — e romperli
non avrebbe portato nessun vantaggio.

PERCHE' IL VECCHIO NON HA MAI SCRITTO UNA RIGA. Vale la pena tenerlo scritto, perche'
e' il tipo di guasto che si ripete. Erano tre difetti sovrapposti:

  1. `guardia_numeri` confrontava i numeri come STRINGHE. Nei fatti un regime sta
     come `10191.0`; in pagina si scrive `10.191 giri/min`. Nessuna corrispondenza:
     la prosa veniva respinta e si tornava al template. Verificato dal vivo il
     3/8/2026: il modello scriveva bene, la guardia bocciava due numeri su
     ventisette, e la bocciatura era su TUTTO l'articolo — non c'era correzione,
     solo rifiuto secco.
  2. `disponibile()` ritornava True anche senza credenziali, perche'
     `anthropic.Anthropic()` si costruisce comunque e alza solo alla richiesta.
     Quindi in ambienti senza chiave il ramo LLM sembrava attivo e falliva dopo.
  3. Il fallimento era MUTO: `except Exception: return articolo` in base.py. Da
     luglio a oggi nessuno dei 18 articoli porta il campo `scrittura`, e non esiste
     una riga di log che dica perche'.

Nessuno dei tre riguardava la qualita' della scrittura. Il quarto difetto invece si':
al modello si chiedeva di riscrivere la prosa MANTENENDO «stesso ordine, stessi
tag», dentro una struttura Evidenza/Causa/Effetto imposta dal system prompt. Anche
funzionando, avrebbe consegnato lo stesso articolo con parole diverse.
"""
from __future__ import annotations
import os
import re

import stile

# Tenuto per compatibilita': il modello vero lo sceglie agenti.py.
MODELLO = os.environ.get("MURETTO_MODELLO_SCRITTURA", "claude-opus-5")


def disponibile():
    """Vero se si puo' davvero chiamare l'API. Delegato ad agenti.disponibile(),
    che controlla le CREDENZIALI e non solo che il costruttore non alzi."""
    try:
        import agenti
        return agenti.disponibile()
    except Exception:
        return False


def _numeri(s):
    """Compatibilita': i token numerici di un testo."""
    return set(re.findall(r"-?\d+(?:[.,]\d+)?", re.sub("<[^>]+>", " ", s or "")))


def guardia_numeri(html, ammessi):
    """I numeri della prosa che non si spiegano coi fatti.

    Ora normalizza davvero: legge la prosa all'italiana (virgola decimale, punto
    per le migliaia, `1:24,507` come tempo sul giro) e i fatti come li scrive il
    JSON, e accetta gli arrotondamenti e i derivati elementari. Vedi
    stile.numeri_non_tracciabili, che e' l'unica implementazione."""
    valori = stile.numeri_fatti(list(ammessi) if not isinstance(ammessi, dict) else ammessi)
    return [s for s, _ in stile.numeri_non_tracciabili(stile.piano(html), valori)]


_VIETATI = re.compile(
    r"\b(ERS|MGU-?[KH]?|clipping|deployment|harvest\w*|SoC|stato di carica|"
    r"mappa energetica|recupero energetico|batteria)\b", re.I)


def verifica(articolo, facts):
    """Il cancello prima della pubblicazione. {"ok": bool, "problemi": [...]}.

    Delegato a redazione.verifica: correttore deterministico + censore cieco su un
    modello diverso da quello che ha scritto. Se la redazione nuova non e'
    importabile si ricade sul controllo storico dei termini vietati, che e' meglio
    di niente e non ha falsi positivi."""
    try:
        import redazione
        return redazione.verifica(articolo, facts)
    except Exception as e:
        problemi = []
        for s in articolo.get("sezioni", []):
            testo = re.sub("<[^>]+>", " ", s.get("html", "") or "")
            if _VIETATI.search(testo):
                problemi.append(f"termine vietato (energia/ERS, assente nel 2026) "
                                f"in '{s.get('tag')}'")
        problemi.append(f"NOTA: redazione.py non importabile ({e}): "
                        f"sono passati solo i controlli storici")
        return {"ok": len([p for p in problemi if not p.startswith("NOTA")]) == 0,
                "problemi": problemi}


def scrivi_prosa(fatti, breve, numeri_ammessi):
    """SUPERATA. La scrittura ora parte dai FATTI e da un PIANO, non da una prosa
    precedente da parafrasare: la firma di questa funzione non puo' esprimerlo.
    Chi la chiama riceve None e resta sul proprio template — come prima."""
    return None
