"""
base.py — fondamenta condivise dei rilevatori/generatori della redazione.

Ogni articolo, da qualunque rilevatore nasca, ha la stessa forma e finisce nello
stesso posto (area Lab), con lo stesso contratto di stato e provenienza. Qui
vivono i mattoni comuni: formattazione italiana dei numeri, gli STATI ammessi per
un numero, e lo scrittore di bozze.

Nessuno di questi tocca demo/ o produzione: scrive solo in ai_lab/redazione/bozze/.
"""
from __future__ import annotations
import os
import re
import json

_QUI = os.path.dirname(os.path.abspath(__file__))
REPO = os.path.abspath(os.path.join(_QUI, "..", ".."))
BOZZE = os.path.join(_QUI, "bozze")
TEAM_COLORI = os.path.join(REPO, "demo", "team_colori.json")

# stati ammessi per ogni numero (la "regola della casa" di grossi.mjs)
STATI = ("MISURATO", "STIMATO", "PRIOR", "NON_MISURABILE")


def it(x, dec=1):
    """Numero in stile italiano (virgola decimale)."""
    if x is None:
        return "–"
    return f"{x:.{dec}f}".replace(".", ",")


def lap_fmt(sec):
    """Secondi -> m:ss,mmm."""
    if sec is None:
        return "–"
    m = int(sec // 60)
    return f"{m}:{sec - 60 * m:06.3f}".replace(".", ",")


def carica_colori():
    try:
        return json.load(open(TEAM_COLORI))
    except Exception:
        return {}


def colore(team, colori=None):
    colori = colori if colori is not None else carica_colori()
    return colori.get(team) or "var(--dim)"


def _md(articolo):
    md = [f"# {articolo['titolo']}", "",
          f"*{articolo.get('occhiello','')} — {articolo.get('firma','')} · "
          f"{articolo.get('data','')} · {articolo.get('stato','bozza').upper()}*",
          "", f"> {articolo.get('sommario','')}", ""]
    for s in articolo.get("sezioni", []):
        md.append(f"## {s.get('tag','')} — {s.get('titolo','')}")
        md.append(re.sub("<[^>]+>", "", s.get("html", "")).replace("</p>", "\n\n"))
        if s.get("figura"):
            md.append(f"*[figura] {s['figura'].get('didascalia','')} — "
                      f"fonte: {s['figura'].get('fonte','')}*")
        md.append("")
    if articolo.get("provenienza"):
        md.append("## Provenienza dei dati")
        for p in articolo["provenienza"]:
            md.append(f"- **{p['grandezza']}**: {p['valore']} — `{p['stato']}` ({p['da']})")
    return "\n".join(md)


def _riscrivi_con_llm(articolo, facts):
    """Se il redattore LLM e' disponibile (pacchetto anthropic + chiave), riscrive
    la PROSA delle sezioni (html + titolo) con la voce della redazione, MANTENENDO
    grafici (figura), struttura (stessi tag, stesso ordine) e numeri (la guardia di
    redattore.py rifiuta qualsiasi numero non tracciabile nei fatti).

    Fallisce SEMPRE in sicurezza: senza chiave, senza pacchetto, con un mismatch o un
    qualsiasi errore -> ritorna l'articolo INVARIATO (prosa a template). Cosi' il path
    LLM non puo' rompere la generazione: al peggio resta il template gia' collaudato."""
    try:
        import redattore
        if not redattore.disponibile():
            return articolo
        sez = articolo.get("sezioni", [])
        if not sez:
            return articolo
        # numeri ammessi = tutti i numeri gia' presenti (fatti + provenienza + prosa template)
        blob = json.dumps(facts or {}, ensure_ascii=False)
        blob += " " + json.dumps(articolo.get("provenienza", []), ensure_ascii=False)
        for s in sez:
            blob += " " + (s.get("html") or "") + " " + (s.get("titolo") or "")
        ammessi = redattore._numeri(blob)
        breve = (f"Occhiello: {articolo.get('occhiello','')}\n"
                 f"Titolo: {articolo.get('titolo','')}\n"
                 f"Sommario: {articolo.get('sommario','')}\n\n"
                 "Riscrivi la PROSA di queste sezioni con voce da redazione tecnica: "
                 "STESSO ordine, STESSI tag, migliore stile e chiarezza, NESSUN numero "
                 "nuovo o diverso da quelli gia' presenti. Struttura di riferimento "
                 "(indice | tag | titolo | prosa attuale):\n" +
                 "\n".join(f"[{i}] {s.get('tag','')} | {s.get('titolo','')} | {s.get('html','')}"
                           for i, s in enumerate(sez)))
        nuove = redattore.scrivi_prosa(facts or {}, breve, ammessi)
        if not nuove or len(nuove) != len(sez):
            return articolo  # mismatch o guardia non passata -> template
        # merge: prosa/titolo dall'LLM, ma grafico (figura) e resto dal template
        for i, s in enumerate(sez):
            n = nuove[i] if isinstance(nuove[i], dict) else {}
            if n.get("html"):
                s["html"] = n["html"]
            if n.get("titolo"):
                s["titolo"] = n["titolo"]
        articolo["scrittura"] = "llm"   # traccia: prosa LLM (default: template)
        return articolo
    except Exception:
        return articolo  # fail-safe assoluto


def scrivi_bozza(id_, articolo, facts=None):
    """Scrive una bozza completa in ai_lab/redazione/bozze/<id>/:
    facts.json (macchina), articolo.json (corpo), stato.json, bozza.md (umano).
    'articolo' deve gia' contenere stato/data/firma/titolo/sezioni/provenienza.

    Se c'e' la chiave LLM, la prosa viene riscritta dal redattore (numeri blindati
    dalla guardia); senza chiave resta il template. Vedi _riscrivi_con_llm.
    """
    # controllo minimo: gli stati di provenienza sono ammessi
    for p in articolo.get("provenienza", []):
        if p.get("stato") not in STATI:
            raise ValueError(f"stato non ammesso in provenienza: {p.get('stato')!r}")
    # prosa LLM se disponibile (fail-safe: altrimenti resta il template)
    articolo = _riscrivi_con_llm(articolo, facts)
    out = os.path.join(BOZZE, id_)
    os.makedirs(out, exist_ok=True)
    if facts is not None:
        json.dump(facts, open(os.path.join(out, "facts.json"), "w"),
                  ensure_ascii=False, indent=2)
    json.dump(articolo, open(os.path.join(out, "articolo.json"), "w"),
              ensure_ascii=False, indent=2)
    stato_p = os.path.join(out, "stato.json")
    if not os.path.exists(stato_p):
        json.dump({"id": id_, "stato": articolo.get("stato", "bozza"), "attore": None,
                   "creato": articolo.get("data"), "storico": [
                       {"stato": "bozza", "attore": "redazione",
                        "quando": articolo.get("data"), "nota": "bozza generata"}]},
                  open(stato_p, "w"), ensure_ascii=False, indent=2)
    open(os.path.join(out, "bozza.md"), "w").write(_md(articolo))
    return out


def numeri(testo):
    """Estrae i numeri (grezzi) da un testo/prosa — per il controllo che ogni
    numero della prosa sia tracciabile ai fatti (usato dalla verifica)."""
    return re.findall(r"-?\d+(?:[.,]\d+)?", re.sub("<[^>]+>", " ", testo or ""))
