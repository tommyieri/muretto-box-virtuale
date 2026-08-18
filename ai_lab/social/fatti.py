#!/usr/bin/env python3
"""fatti.py — da dove vengono i ganci dei post.

LA REGOLA, ed e' la stessa della redazione: **nessun numero si scrive a mano.**
Ogni `Fatto` nasce da `demo/data/**` e porta con se' la propria `provenienza` —
la frase che finira' stampata in fondo al post. Un fatto senza provenienza non
si pubblica: `Fatto.valido()` lo dice, e i formati si rifiutano di disegnarlo.

PERCHE' CONTA PIU' QUI CHE ALTROVE. Sul sito un numero sbagliato lo vede chi e'
gia' dentro; su Instagram lo vedono trentamila persone che non ci conoscono, e
non si corregge — si ripubblica. Quindi il cancello sta a monte.

IL PUNTEGGIO. Ogni fatto ha una `forza` da 0 a 1: quanto merita di diventare un
post. Serve alla pipeline per scegliere da sola, senza che nessuno legga tutto.
La forza NON e' la qualita' del dato (quella e' data per scontata: o e' misurato
o non esiste) — e' quanto e' sorprendente per chi guarda.
"""
from __future__ import annotations
import os
import json
import functools
from dataclasses import dataclass, field

QUI = os.path.dirname(os.path.abspath(__file__))
REPO = os.path.abspath(os.path.join(QUI, "..", ".."))
DATI = os.path.join(REPO, "demo", "data")

GRIGIO_NEUTRO = "#8A8F98"


def num(v, dec=2) -> str:
    """Un numero come lo scrive un italiano: virgola decimale, punto per le
    migliaia.

    ESISTE PER UN BACO VERO. La prima versione faceva `f"{x:.2f}".replace(".", ",")`
    sull'INTERA frase, e si mangiava anche il punto fermo finale: «costa 18,40
    secondi,». Il separatore si cambia sul numero, mai sul testo."""
    s = f"{v:,.{dec}f}"                     # 10,269.00 -> stile inglese
    return s.replace(",", " ").replace(".", ",").replace(" ", ".")


def intero(v) -> str:
    return f"{int(v):,}".replace(",", ".")


# --------------------------------------------------------------- il fatto
@dataclass
class Fatto:
    tipo: str                  # quale formato lo sa disegnare
    gara: str
    titolo: str                # il gancio, gia' scritto in italiano
    provenienza: str           # OBBLIGATORIA: da dove viene il numero
    dati: dict = field(default_factory=dict)
    forza: float = 0.5

    def valido(self) -> bool:
        return bool(self.tipo and self.titolo and self.provenienza and self.dati)

    def __str__(self):
        return f"[{self.forza:.2f}] {self.tipo:<12} {self.gara:<16} {self.titolo}"


# ------------------------------------------------------------- letture
@functools.lru_cache(maxsize=32)
def carica(nome_file: str):
    p = os.path.join(DATI, nome_file)
    if not os.path.exists(p):
        return None
    try:
        return json.load(open(p, encoding="utf-8"))
    except Exception:
        return None


@functools.lru_cache(maxsize=8)
def colori_team() -> dict:
    p = os.path.join(REPO, "demo", "team_colori.json")
    try:
        return {k: v for k, v in json.load(open(p, encoding="utf-8")).items()
                if not k.startswith("_")}
    except Exception:
        return {}


def colore(team: str | None) -> str:
    return colori_team().get(team or "", GRIGIO_NEUTRO)


def gare_disponibili() -> list:
    cal = carica("calendario_2026.json") or {}
    fatte = []
    for g in cal.get("gare", []):
        nome = g.get("gara_demo") or g.get("nome")
        if nome and os.path.exists(os.path.join(DATI, f"{nome}.json")):
            fatte.append(nome)
    return fatte


def titolo_gp(gara: str) -> str:
    cal = carica("calendario_2026.json") or {}
    for g in cal.get("gare", []):
        if (g.get("gara_demo") or g.get("nome")) == gara:
            return g.get("titolo", f"GP di {gara}")
    return f"GP di {gara}"


def circuito(gara: str) -> str:
    cal = carica("calendario_2026.json") or {}
    for g in cal.get("gare", []):
        if (g.get("gara_demo") or g.get("nome")) == gara:
            return g.get("circuito", "")
    return ""


# ------------------------------------------------------- attrezzi di gara
def posizioni_al_giro(g: dict, n: int) -> dict:
    """Chi e' davanti a chi al giro n, per tempo cumulato. Solo le auto ancora
    in pista in quel giro: chi si e' ritirato non e' in classifica."""
    giri = g.get("laps", [])
    if not (1 <= n <= len(giri)):
        return {}
    auto = giri[n - 1].get("cars", {})
    vivi = [(s, c["cum_time"]) for s, c in auto.items() if c.get("cum_time") is not None]
    vivi.sort(key=lambda t: t[1])
    return {s: i + 1 for i, (s, _) in enumerate(vivi)}


def soste(g: dict) -> list:
    """Ogni cambio di STINT e' una sosta. E' la definizione che usa il resto del
    progetto (demo/sosta.mjs: sosta = cambio di set), non il conteggio di f1db,
    che sul 2026 ne perde otto."""
    fuori = []
    giri = g.get("laps", [])
    per_pilota = {}
    for i, giro in enumerate(giri, start=1):
        for sig, c in giro.get("cars", {}).items():
            st = c.get("stint")
            if st is None:
                continue
            prima = per_pilota.get(sig)
            if prima is not None and st > prima[0]:
                fuori.append({
                    "sigla": sig, "team": c.get("team"), "giro": i,
                    "da": prima[1], "a": c.get("compound"),
                    "eta_gomma": prima[2],
                })
            per_pilota[sig] = (st, c.get("compound"), c.get("tyre_age"))
    return fuori


# FINESTRA DI GIUDIZIO. Guardare la posizione il giro dopo la sosta non dice
# niente: i rivali non si sono ancora fermati e chi rientra e' sempre indietro.
# Il ciclo di soste di un gruppo si chiude in pochi giri, quindi si misura PRIMA
# della sosta e OTTO GIRI DOPO. Il numero e' arbitrario e per questo e' scritto
# nella provenienza di ogni post: chi legge sa cosa e' stato misurato.
FINESTRA = 8


def giro_neutralizzato(g: dict, n: int) -> bool:
    """Vero se al giro n la gara e' in regime di neutralizzazione (SC o VSC).

    PERCHE' E' IL FILTRO PIU' IMPORTANTE DI QUESTO FILE. La prima versione
    trovava «OCO si ferma al giro 2: 5 posizioni guadagnate» a Spa e «RUS al
    giro 67: 10 posizioni perse» a Monaco. Guardando i dati: in tutti e due i
    casi TUTTE le auto in pista erano neutralizzate (22/22 e 16/16). Non erano
    colpi di strategia — erano soste gratis dietro la Safety Car, e a Monaco
    Russell si ferma pure due volte in tre giri.

    Una sosta sotto neutralizzazione e' un fenomeno DIVERSO: costa meno, la fanno
    tutti insieme, e il guadagno non e' merito del muretto. Venderla come genio
    strategico sarebbe falso, ed e' esattamente il tipo di post che questo
    progetto non deve fare.
    """
    giri = g.get("laps", [])
    if not (1 <= n <= len(giri)):
        return True                        # fuori gara: prudenza, vale come sporco
    auto = giri[n - 1].get("cars", {})
    if not auto:
        return True
    quante = sum(1 for c in auto.values() if c.get("neutralized"))
    return quante >= len(auto) * 0.5


def finestra_verde(g: dict, da: int, a: int, tolleranza: float = 0.2) -> bool:
    """La finestra di giudizio e' utilizzabile solo se e' quasi tutta in verde:
    una SC in mezzo rimescola il campo e il confronto non misura piu' la sosta."""
    giri = [n for n in range(da, a + 1) if 1 <= n <= len(g.get("laps", []))]
    if not giri:
        return False
    sporchi = sum(1 for n in giri if giro_neutralizzato(g, n))
    return sporchi <= len(giri) * tolleranza


def _stint_lap_times(g: dict, sig: str, stint: int) -> list:
    out = []
    for giro in g.get("laps", []):
        c = giro.get("cars", {}).get(sig)
        if not c or c.get("stint") != stint:
            continue
        t = c.get("lap_time")
        if (t and not c.get("in_lap") and not c.get("out_lap")
                and not c.get("neutralized") and not c.get("deleted")):
            out.append(t)
    return out


# ------------------------------------------------------------ rilevatori
def sosta_decisiva(gara: str) -> list:
    """La sosta che ha spostato di piu' la classifica, in un senso o nell'altro."""
    g = carica(f"{gara}.json")
    if not g:
        return []
    n_giri = len(g.get("laps", []))
    in_fondo = set(g["laps"][-1].get("cars", {})) if g.get("laps") else set()
    # una sosta troppo presto non e' strategia: e' un danno al via
    presto = max(3, int(n_giri * 0.12))
    trovati = []
    for s in soste(g):
        gi = s["giro"]
        if gi < presto or gi - 1 < 1 or gi + FINESTRA > n_giri:
            continue                       # niente giudizi a meta' finestra
        if s["sigla"] not in in_fondo:
            continue                       # chi si ritira dopo: il delta e' un artefatto
        if giro_neutralizzato(g, gi) or not finestra_verde(g, gi - 1, gi + FINESTRA):
            continue                       # sosta gratis dietro la SC: altro fenomeno
        prima = posizioni_al_giro(g, gi - 1).get(s["sigla"])
        dopo = posizioni_al_giro(g, gi + FINESTRA).get(s["sigla"])
        if not prima or not dopo:
            continue
        d = prima - dopo                    # positivo = guadagnate
        trovati.append({**s, "pos_prima": prima, "pos_dopo": dopo, "delta": d})
    if not trovati:
        return []
    trovati.sort(key=lambda t: (-abs(t["delta"]), t["giro"]))
    migliore = trovati[0]
    if migliore["delta"] == 0:
        return []
    n = abs(migliore["delta"])
    # l'accordo va fatto, non abbozzato: «1 posizione guadagnataE» si legge male
    # e su un post non si corregge — si ripubblica.
    sost = "posizione" if n == 1 else "posizioni"
    if migliore["delta"] > 0:
        part = "guadagnata" if n == 1 else "guadagnate"
    else:
        part = "persa" if n == 1 else "perse"
    return [Fatto(
        tipo="sosta",
        gara=gara,
        titolo=f"{migliore['sigla']} si ferma al giro {migliore['giro']}: "
               f"{n} {sost} {part}.",
        provenienza=(f"posizioni per tempo cumulato al giro {migliore['giro'] - 1} e al giro "
                     f"{migliore['giro'] + FINESTRA} ({FINESTRA} giri dopo la sosta, a ciclo "
                     f"chiuso) · gara in regime VERDE per tutta la finestra "
                     f"· {titolo_gp(gara)}"),
        dati={**migliore, "n_giri": n_giri,
              "colore": colore(migliore["team"]),
              "circuito": circuito(gara),
              "classifica_prima": posizioni_al_giro(g, migliore["giro"] - 1),
              "classifica_dopo": posizioni_al_giro(g, migliore["giro"] + FINESTRA),
              "team_di": {sg: c.get("team") for sg, c
                          in g["laps"][migliore["giro"] - 1].get("cars", {}).items()}},
        # Tarata DOPO aver visto i dati veri: col filtro verde una sosta sposta
        # quasi sempre UNA posizione. Quello e' il caso normale e non merita il
        # punteggio pieno; due o piu' e' l'eccezione, e quella si',
        forza=min(1.0, {1: 0.55, 2: 0.72}.get(n, 0.86)),
    )]


def compagni_di_squadra(gara: str) -> list:
    """Stessa macchina, giornata diversa. E' il confronto piu' onesto che esista
    in F1: l'unico in cui il mezzo non e' una scusa."""
    g = carica(f"{gara}.json")
    if not g or not g.get("laps"):
        return []
    ultimo = g["laps"][-1].get("cars", {})
    per_team = {}
    for sig, c in ultimo.items():
        per_team.setdefault(c.get("team"), []).append(sig)
    cls = posizioni_al_giro(g, len(g["laps"]))
    fuori = []
    for team, piloti in per_team.items():
        if len(piloti) != 2 or not team:
            continue
        a, b = sorted(piloti, key=lambda s: cls.get(s, 99))
        pa, pb = cls.get(a), cls.get(b)
        if not pa or not pb:
            continue
        # il passo vero: mediana dei giri puliti, non il giro veloce
        def mediana_pulita(sig):
            t = []
            for giro in g["laps"]:
                c = giro.get("cars", {}).get(sig)
                if not c:
                    continue
                lt = c.get("lap_time")
                if (lt and not c.get("in_lap") and not c.get("out_lap")
                        and not c.get("neutralized") and not c.get("deleted")):
                    t.append(lt)
            if not t:
                return None
            t.sort()
            return t[len(t) // 2]
        ma, mb = mediana_pulita(a), mediana_pulita(b)
        if ma is None or mb is None:
            continue
        fuori.append({"team": team, "davanti": a, "dietro": b, "pos_davanti": pa,
                      "pos_dietro": pb, "passo_davanti": ma, "passo_dietro": mb,
                      "divario": mb - ma, "posizioni": pb - pa,
                      "colore": colore(team)})
    if not fuori:
        return []
    fuori.sort(key=lambda t: -abs(t["divario"]))
    m = fuori[0]
    return [Fatto(
        tipo="compagni",
        gara=gara,
        titolo=f"{m['davanti']} e {m['dietro']}, stessa macchina: "
               f"{num(abs(m['divario']))} s al giro di differenza.",
        provenienza=("mediana dei giri puliti in gara (esclusi giri d'ingresso e d'uscita "
                     f"dai box, neutralizzazioni e giri cancellati) · {titolo_gp(gara)}"),
        dati={**m, "circuito": circuito(gara), "n_giri": len(g["laps"])},
        forza=min(1.0, 0.45 + min(abs(m["divario"]), 1.5) * 0.30),
    )]


def durata_mescole(gara: str) -> list:
    """Quanto e' durata davvero ogni gomma. Il dato che nessuno pubblica e che
    tutti discutono al bar."""
    g = carica(f"{gara}.json")
    if not g:
        return []
    # SOLO I CAMBI IN REGIME VERDE. Con le soste sotto SC dentro il conto, a Spa
    # usciva «la morbida e' durata da 1 a 14 giri»: quell'1 non e' la vita della
    # gomma, e' la Safety Car del primo giro che regala la sosta a mezzo
    # schieramento. Una gomma cambiata perche' conviene non dice quanto durava.
    per_mescola = {}
    for s in soste(g):
        if not (s["da"] and s["eta_gomma"]):
            continue
        if giro_neutralizzato(g, s["giro"]):
            continue
        per_mescola.setdefault(s["da"], []).append(s["eta_gomma"])
    per_mescola = {k: v for k, v in per_mescola.items() if len(v) >= 3}
    if len(per_mescola) < 2:
        return []
    riassunto = {}
    for mesc, eta in per_mescola.items():
        eta = sorted(eta)
        riassunto[mesc] = {"mediana": eta[len(eta) // 2], "n": len(eta),
                           "min": eta[0], "max": eta[-1]}
    ordine = ["SOFT", "MEDIUM", "HARD"]
    presenti = [m for m in ordine if m in riassunto]
    if len(presenti) < 2:
        return []
    return [Fatto(
        tipo="mescole",
        gara=gara,
        titolo=f"Quanto e' durata ogni gomma a {circuito(gara) or gara}.",
        provenienza=("eta' della gomma al cambio set, mediana sui piloti · solo cambi in "
                     f"regime verde (sotto Safety Car ci si ferma per convenienza, non "
                     f"per usura) · {titolo_gp(gara)}"),
        dati={"mescole": {m: riassunto[m] for m in presenti},
              "circuito": circuito(gara)},
        forza=0.58,
    )]


def numero_del_progetto(gara: str | None = None) -> list:
    """I numeri MISURATI dal progetto: non risultati di gara ma cio' che sappiamo
    e nessun altro pubblica. Sono il gancio migliore prima del lancio, perche'
    non invecchiano con la domenica."""
    fuori = []
    h = carica("hero.json")
    if h and h.get("pitloss") and h.get("degrado"):
        pl, dg = h["pitloss"], h["degrado"]
        if pl.get("s"):
            reale = (f" · realizzato in quella gara: {num(pl['realizzato_in_gara_s'])} s"
                     if pl.get("realizzato_in_gara_s") else "")
            fuori.append(Fatto(
                tipo="numero", gara=h.get("gara", gara or ""),
                titolo=f"Fermarsi ai box a {h.get('circuito', '')} costa "
                       f"{num(pl['s'])} secondi.",
                provenienza=f"{pl.get('targhetta', 'misurato')}{reale}",
                dati={"valore": num(pl["s"]), "unita": "SECONDI PERSI\nA OGNI SOSTA",
                      "circuito": h.get("circuito", ""), "accento": "rosso"},
                forza=0.72))
        if dg.get("rho_s_giro") and dg.get("n_giri"):
            fuori.append(Fatto(
                tipo="numero", gara=h.get("gara", gara or ""),
                titolo=f"Ogni giro di gomma costa {num(dg['rho_s_giro'], 3)} secondi.",
                provenienza=f"{dg.get('targhetta', 'misurato')}",
                dati={"valore": num(dg["rho_s_giro"], 3),
                      "unita": "SECONDI AL GIRO\nPER OGNI GIRO\nDI GOMMA",
                      "nota": f"misurato su {intero(dg['n_giri'])} giri",
                      "accento": "ciano"},
                forza=0.68))
    return fuori


def classifica_campionato(_: str | None = None) -> list:
    c = carica("classifiche_2026.json")
    if not c or not c.get("piloti"):
        return []
    agg = c.get("aggiornato_al", {})
    piloti = c["piloti"][:8]
    return [Fatto(
        tipo="classifica",
        gara=agg.get("gara_demo", ""),
        titolo=f"Il campionato dopo {agg.get('titolo', 'l’ultima gara')}.",
        provenienza=f"classifica canonica f1db al round {agg.get('round', '?')} "
                    f"({agg.get('titolo', '')}, {agg.get('data', '')})",
        dati={"piloti": [{"pos": p["pos"], "sigla": p["sigla"], "nome": p.get("nome", ""),
                          "punti": p["punti"], "distacco": p.get("distacco", 0),
                          "colore": colore(p.get("team_demo") or p.get("team"))}
                         for p in piloti],
              "round": agg.get("round"), "titolo_gara": agg.get("titolo", "")},
        forza=0.50,
    )]


def raccogli(gara: str | None = None) -> list:
    """Tutti i fatti pubblicabili, dal piu' forte al piu' debole."""
    fuori = []
    if gara:
        for r in RILEVATORI_GARA:
            try:
                fuori += r(gara)
            except Exception as e:
                print(f"[social] rilevatore {r.__name__} su {gara}: {e}")
    for r in RILEVATORI_LIBERI:
        try:
            fuori += r(gara)
        except Exception as e:
            print(f"[social] rilevatore {r.__name__}: {e}")
    fuori = [f for f in fuori if f.valido()]
    fuori.sort(key=lambda f: -f.forza)
    return fuori


if __name__ == "__main__":
    import sys
    gare = sys.argv[1:] or gare_disponibili()
    print(f"gare con dati: {len(gare_disponibili())} -> {', '.join(gare_disponibili())}\n")
    for g in gare:
        print(f"===== {g}")
        for f in raccogli(g):
            print("  ", f)
            print("     prov:", f.provenienza[:110])


# ===========================================================================
# LA SCELTA — il formato che presenta IL PRODOTTO, non la Formula 1.
#
# Correzione editoriale del 18/08/2026, e viene dal PO: i rilevatori qui sopra
# raccontano fatti di F1 (quanto costa una sosta, quanto dura una gomma). Sono
# veri e non interessano: non sono il nostro prodotto. Il prodotto e' UNO — ti
# fermi adesso o fra tre giri, e il motore dice DOVE RIENTRI.
#
# Quindi questo rilevatore non guarda i dati: interroga il MOTORE DI PRODUZIONE
# (via ai_lab/social/motore.mjs, che chiama doveRientri, lo stesso della pagina
# gara e della hero) e cerca i casi in cui il momento cambia la risposta.
#
# Il caricamento del motore costa decine di secondi, quindi l'esito si tiene in
# cache per gara: e' un file DERIVATO da un generatore, non una fonte orfana.
# ===========================================================================

CACHE = os.path.join(QUI, "cache_scelte")


def _scelte_dal_motore(gara: str, rifai: bool = False) -> dict:
    import subprocess
    os.makedirs(CACHE, exist_ok=True)
    p = os.path.join(CACHE, f"{gara.replace(' ', '_')}.json")
    if os.path.exists(p) and not rifai:
        try:
            return json.load(open(p, encoding="utf-8"))
        except Exception:
            pass
    mjs = os.path.join(QUI, "motore.mjs")
    try:
        r = subprocess.run(["node", mjs, gara, "--json"], cwd=REPO,
                           capture_output=True, text=True, timeout=900)
    except Exception as e:
        print(f"[social] motore non interrogabile per {gara}: {e}")
        return {}
    if r.returncode != 0:
        print(f"[social] motore fallito su {gara}: {r.stderr.strip()[:200]}")
        return {}
    try:
        dati = json.loads(r.stdout)
    except Exception:
        print(f"[social] il motore non ha risposto JSON per {gara}")
        return {}
    json.dump(dati, open(p, "w", encoding="utf-8"), ensure_ascii=False, indent=1)
    return dati


def scelta_del_muretto(gara: str) -> list:
    """«Lo fermi adesso o fra tre giri?» — con la risposta del motore."""
    dati = _scelte_dal_motore(gara)
    fuori = []
    for c in (dati.get("casi") or [])[:3]:
        ora, dopo = c["box_ora"]["posizione"], c["box_dopo"]["posizione"]
        meglio_aspettare = dopo < ora
        n = abs(c["differenza"])
        fuori.append(Fatto(
            tipo="scelta",
            gara=gara,
            titolo=f"{c['pilota']} è {c['pos_al_congelamento']}° al giro {c['giro']}. "
                   f"Lo fermi adesso o fra {c['attesa']} giri?",
            # PROVENIENZA PER CHI GUARDA, non per chi sviluppa. La prima versione
            # stampava «simulatore/scenario/costruttore.mjs::doveRientri»: giusto e
            # illeggibile: su Instagram un percorso di file non prova niente a
            # nessuno. Quello che prova qualcosa e' che il motore sia LO STESSO
            # che risponde sul sito, e che le due scelte differiscano per una
            # variabile sola.
            provenienza=(f"risposta del motore di simulazione del sito, lo stesso che "
                         f"risponde nella pagina-gara · le due scelte hanno stessa mescola "
                         f"({c['mescola']}), stesso pit-loss e stessi rivali: cambia solo "
                         f"il giro della sosta · {titolo_gp(gara)}"),
            dati={**c, "meglio_aspettare": meglio_aspettare,
                  # appiattite per la didascalia, che non sa scendere in box_ora.posizione
                  "pos_ora": ora, "pos_dopo": dopo,
                  "circuito": c.get("circuito") or circuito(gara)},
            # e' il formato del prodotto: parte sopra a tutti gli altri
            forza=min(1.0, 0.80 + 0.04 * n),
        ))
    return fuori


# L'ORDINE E' LA LINEA EDITORIALE, non un dettaglio di implementazione.
#
# `numero_del_progetto` E' FUORI DALLA ROTAZIONE dal 18/08/2026, per decisione del
# PO: produceva post tipo «fermarsi ai box a Spa costa 18,40 secondi». Il numero e'
# giusto e misurato, e non interessa a nessuno — e' un fatto di Formula 1, mentre
# noi dobbiamo far vedere il PRODOTTO. La funzione resta, perche' quei numeri sono
# buoni DENTRO un altro post (sono le costanti con cui il motore risponde), ma non
# fanno piu' un post per conto loro.
RILEVATORI_GARA = [scelta_del_muretto, sosta_decisiva, compagni_di_squadra, durata_mescole]
RILEVATORI_LIBERI = [classifica_campionato]
FUORI_ROTAZIONE = [numero_del_progetto]
