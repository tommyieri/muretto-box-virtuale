"""
memoria.py — la memoria editoriale della redazione.

Risponde a una domanda sola: **che cosa abbiamo gia' fatto?** Quali forme, quali
attacchi, quali chiuse, quali metafore, quali giri di frase. E' il pezzo che
impedisce al sistema di scrivere venti volte lo stesso articolo con numeri diversi
— il difetto piu' grave misurato sul corpus attuale (12 pezzi su 12 con lo stesso
scheletro, 8 incipit su 12 con lo stesso soggetto grammaticale, 2 identici).

Non e' un archivio: e' un vincolo. Chi pianifica la riceve come elenco di cose
BRUCIATE; il correttore la usa per bocciare un attacco che somiglia a uno gia'
pubblicato o un gruppo di parole gia' uscito.

Legge dai due posti dove gli articoli vivono davvero — `bozze/<id>/articolo.json`
(l'area Lab) e `demo/data/analisi/<id>.json` (il pubblicato) — e non scrive niente:
la memoria e' una vista, non uno stato. Cosi' non puo' divergere dalla realta' e non
diventa un altro file orfano.

Uso:
  python3 ai_lab/redazione/memoria.py            # la sintesi che riceve chi pianifica
  python3 ai_lab/redazione/memoria.py --forme    # solo il conteggio delle forme
"""
from __future__ import annotations
import os
import json
import difflib
from collections import Counter

import stile

_QUI = os.path.dirname(os.path.abspath(__file__))
REPO = stile.REPO
BOZZE = os.path.join(_QUI, "bozze")
PUBBLICATI = os.path.join(REPO, "demo", "data", "analisi")

NON_ARTICOLI = {"forza_macchina", "stagione_dati"}

# quanti articoli indietro guarda la memoria per le regole di rotazione
FINESTRA = 10
# quota massima di una stessa forma nella finestra (VOCE.md F2)
QUOTA_FORMA = 0.40


class Memoria:
    def __init__(self, escludi=None):
        self._escl = set(escludi or ())
        self.articoli = self._carica()

    # ---------------------------------------------------------------- carica --
    def _carica(self):
        visti, fuori = {}, []
        for base, ext in ((PUBBLICATI, ".json"), (BOZZE, None)):
            if not os.path.isdir(base):
                continue
            for nome in sorted(os.listdir(base)):
                if ext:
                    if not nome.endswith(ext):
                        continue
                    id_ = nome[:-len(ext)]
                    p = os.path.join(base, nome)
                else:
                    id_ = nome
                    p = os.path.join(base, nome, "articolo.json")
                if id_ in NON_ARTICOLI or id_ in visti or not os.path.exists(p):
                    continue
                try:
                    a = json.load(open(p, encoding="utf-8"))
                except Exception:
                    continue
                if not isinstance(a, dict) or "sezioni" not in a:
                    continue
                visti[id_] = True
                fuori.append(a)
        fuori.sort(key=lambda a: (a.get("data") or "", a.get("id") or ""), reverse=True)
        return fuori

    def escludi(self, id_):
        """Toglie un articolo dalla memoria: serve quando si controlla un pezzo che
        e' gia' su disco, altrimenti si trova da solo e si accusa di plagio."""
        self._escl.add(id_)
        return self

    def _vivi(self):
        return [a for a in self.articoli if a.get("id") not in self._escl]

    # ------------------------------------------------------------- rotazione --
    def forme(self, n=FINESTRA):
        return Counter(a.get("forma") or _forma_implicita(a) for a in self._vivi()[:n])

    def attacchi(self, n=FINESTRA):
        return Counter(a.get("attacco") for a in self._vivi()[:n] if a.get("attacco"))

    def chiuse(self, n=FINESTRA):
        return Counter(a.get("chiusa") for a in self._vivi()[:n] if a.get("chiusa"))

    def forme_bruciate(self, n=FINESTRA):
        """Le forme che hanno gia' saturato la loro quota nella finestra."""
        c = self.forme(n)
        tot = max(1, sum(c.values()))
        return [f for f, k in c.items() if f and k / tot > QUOTA_FORMA]

    def metafore_recenti(self, n=3):
        """I lemmi-firma usati negli ultimi n articoli: vietati nel prossimo."""
        lemmi = stile.lessico()["metafore_firma"]["lemmi"]
        usate = set()
        for a in self._vivi()[:n]:
            t, _, _ = stile.prosa_articolo(a)
            tok = set(stile.token_norm(t))
            usate |= {m for m in lemmi if stile._norm(m).strip() in tok}
        return sorted(usate)

    # ------------------------------------------------------------ ripetizioni --
    def _indice_ngrammi(self):
        if getattr(self, "_ng", None) is None:
            self._ng = {}
            tecn = set(stile.token_norm(
                " ".join(stile.lessico()["anglicismi"]["prestiti_ammessi"])))
            for a in self._vivi():
                t, _, _ = stile.prosa_articolo(a)
                for g, _n in stile.ngrammi(t, minimo=1):
                    if set(g.split()) & tecn:
                        continue
                    self._ng.setdefault(g, a.get("titolo") or a.get("id"))
        return self._ng

    def gia_scritto(self, ngramma):
        """Il titolo dell'articolo dove questo gruppo di parole e' gia' uscito."""
        return self._indice_ngrammi().get(ngramma)

    def incipit(self):
        fuori = []
        for a in self._vivi():
            _, sez, _ = stile.prosa_articolo(a)
            if not sez:
                continue
            fr = stile.frasi(sez[0][1])
            if fr:
                fuori.append((a.get("titolo") or a.get("id"), fr[0]))
        return fuori

    def incipit_simile(self, lede, soglia_=None):
        """Il titolo dell'articolo il cui attacco somiglia troppo a questo."""
        s = soglia_ if soglia_ is not None else stile.soglia("similitudine_incipit_max")
        a = " ".join(stile.token_norm(lede)[:25])
        for titolo, altro in self.incipit():
            b = " ".join(stile.token_norm(altro)[:25])
            if not b:
                continue
            if difflib.SequenceMatcher(None, a, b).ratio() >= s:
                return titolo
        return None

    # ---------------------------------------------------------------- sintesi --
    def sintesi(self, n=FINESTRA):
        """Il promemoria che riceve chi pianifica. Prosa, non JSON: le istruzioni a
        un agente vanno in testo, i dati in JSON."""
        vivi = self._vivi()[:n]
        if not vivi:
            return "Nessun articolo precedente: qualunque forma e' libera."
        righe = ["Gli ultimi %d pezzi pubblicati, dal piu' recente:" % len(vivi)]
        for a in vivi:
            f = a.get("forma") or _forma_implicita(a)
            att = a.get("attacco") or "?"
            ch = a.get("chiusa") or "?"
            righe.append(f"  · {a.get('data','?')} «{a.get('titolo','?')}» "
                         f"[forma {f} · attacco {att} · chiusa {ch}]")
        bruciate = self.forme_bruciate(n)
        if bruciate:
            righe.append("")
            righe.append("Forme SATURE (oltre il 40% della finestra), da non riusare: "
                         + ", ".join(bruciate))
        met = self.metafore_recenti()
        if met:
            righe.append("Metafore consumate negli ultimi tre pezzi, vietate adesso: "
                         + ", ".join(met))
        att = [a for a, _ in self.attacchi(3).most_common() if _ >= 2]
        if att:
            righe.append("Attacchi gia' usati due volte di recente: " + ", ".join(att))
        righe.append("")
        righe.append("Attacchi degli ultimi pezzi, per non ripeterne il taglio:")
        for titolo, lede in self.incipit()[:5]:
            righe.append(f"  · {lede[:150]}")
        return "\n".join(righe)


def _forma_implicita(a):
    """Gli articoli scritti prima del sistema non dichiarano la forma: la si deduce
    dai tag delle sezioni, cosi' la memoria vede anche il passato."""
    tag = [s.get("tag") for s in a.get("sezioni", []) or []]
    if tag[:3] == ["Evidenza", "Causa", "Effetto"] or set(tag) >= {"Evidenza", "Causa", "Effetto"}:
        return "anomalia"
    return "(non dichiarata)"


def main():
    import argparse
    ap = argparse.ArgumentParser(description="La memoria editoriale della redazione")
    ap.add_argument("--forme", action="store_true")
    ap.add_argument("--incipit", action="store_true")
    a = ap.parse_args()
    m = Memoria()
    if a.forme:
        for f, n in m.forme().most_common():
            print(f"  {n:2}  {f}")
        print("  sature:", ", ".join(m.forme_bruciate()) or "nessuna")
    elif a.incipit:
        for t, l in m.incipit():
            print(f"  {t[:50]:52} | {l[:110]}")
    else:
        print(m.sintesi())
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
