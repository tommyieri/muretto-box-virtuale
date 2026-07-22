#!/usr/bin/env python
"""Test locali dell'ingresso OpenF1 (senza rete, senza paho).

Uso:  .venv/bin/python live/collector/test_openf1.py
"""

import json
import sys
import threading
import time
import tempfile
from datetime import datetime
from pathlib import Path

QUI = Path(__file__).resolve().parent
sys.path.insert(0, str(QUI.parent))
sys.path.insert(0, str(QUI))

from ingress_openf1 import (  # noqa: E402
    BACKOFF_MIN_S,
    BACKOFF_MAX_S,
    FINESTRA_CONNECT_S,
    MAX_CONNECT_FINESTRA,
    MARGINE_RINNOVO_S,
    GuardiaConnessioni,
    TokenOpenF1,
    RegistratoreJSONL,
    leggi_env,
    leggi_jsonl,
)

_esiti = []


def caso(nome):
    def decoratore(fn):
        _esiti.append((nome, fn))
        return fn
    return decoratore


@caso("limiti OpenF1: guardia = max 5 CONNECT/minuto, mai di piu'")
def test_guardia_connessioni():
    """Il vincolo della mail OpenF1 del 21/07: >10 disconnessioni in un
    minuto = blocco di 10 minuti. Tetto nostro: 5/minuto (margine 2x)."""
    finto = {"t": 0.0}
    dormite = []

    def orologio():
        return finto["t"]

    def dormi(s):                      # niente attese reali nel test
        dormite.append(s)
        finto["t"] += s

    g = GuardiaConnessioni(orologio=orologio, dormi=dormi)
    # 20 tentativi a raffica, come farebbe un incidente
    istanti = []
    for _ in range(20):
        g.attendi_slot()
        istanti.append(finto["t"])
        finto["t"] += 0.01             # il CONNECT stesso e' istantaneo
    assert len(dormite) > 0, "la guardia non ha mai frenato"
    # nessuna finestra di 60s contiene piu' di 5 CONNECT
    for i, t0 in enumerate(istanti):
        dentro = [t for t in istanti if t0 <= t < t0 + FINESTRA_CONNECT_S]
        assert len(dentro) <= MAX_CONNECT_FINESTRA, \
            f"{len(dentro)} CONNECT in 60s da t={t0}"
    assert MAX_CONNECT_FINESTRA * 2 <= 10, "margine 2x sulla soglia OpenF1"


@caso("limiti OpenF1: il backoff da solo resta sotto 5 CONNECT/minuto")
def test_backoff_sotto_soglia():
    """Anche senza guardia, la sola scala di backoff non deve superare
    il tetto: difesa in profondita' (la guardia e' la seconda rete)."""
    t, istanti, attesa = 0.0, [], BACKOFF_MIN_S
    for _ in range(30):
        istanti.append(t)
        t += attesa
        attesa = min(attesa * 2, BACKOFF_MAX_S)
    for t0 in istanti:
        dentro = [x for x in istanti if t0 <= x < t0 + 60.0]
        assert len(dentro) <= MAX_CONNECT_FINESTRA, \
            f"backoff: {len(dentro)} CONNECT in 60s da t={t0}"


@caso("token: la sveglia della riconnessione e' allineata alla scadenza VERA")
def test_riconnessione_allineata_al_token():
    """REGRESSIONE osservata in produzione il 22/07/2026: /status riportava
    connesso=true e openf1_token.valido=false da 36 minuti.

    Causa: la riconnessione proattiva era legata all'uptime della CONNESSIONE
    (3600 - 2*margine = 3000 s), mentre token() considera fresco il token fino
    a scade-margine (3300 s di eta' del TOKEN). Poiche' la connessione e'
    sempre piu' giovane del token, la sveglia suonava SEMPRE prima della
    soglia di rinnovo: ci si riconnetteva col vecchio token e poi si restava
    connessi con un token scaduto. Un falso allarme rosso in mezzo a una gara.

    Invariante che questo test difende: quando la sveglia suona, la token()
    successiva DEVE rinnovare davvero."""
    tok = TokenOpenF1.__new__(TokenOpenF1)
    tok._lock = threading.Lock()

    ora = time.time()
    # token appena preso: nessuno deve riconnettersi
    tok._token, tok._scade = "x", ora + 3600
    assert not tok.scade_entro(MARGINE_RINNOVO_S), \
        "token fresco: la sveglia non deve suonare"

    # vecchia sveglia: 3000 s di connessione. Il token ne ha 600 di vita: la
    # riconnessione di allora avveniva QUI, e non rinnovava niente.
    tok._scade = ora + 600
    assert not tok.scade_entro(MARGINE_RINNOVO_S), \
        "a 600 s dalla scadenza token() userebbe ancora la cache"

    # nuova sveglia: suona solo dentro il margine, dove token() rinnova davvero
    tok._scade = ora + MARGINE_RINNOVO_S - 1
    assert tok.scade_entro(MARGINE_RINNOVO_S), \
        "dentro il margine la sveglia DEVE suonare"

    tok._token, tok._scade = None, 0.0
    assert tok.scade_entro(MARGINE_RINNOVO_S), \
        "token assente: la sveglia deve suonare"


@caso("env: parsing KEY=VALUE, commenti e righe vuote ignorati")
def test_env():
    with tempfile.TemporaryDirectory() as tmp:
        p = Path(tmp) / "openf1.env"
        p.write_text("# commento\n\nOPENF1_USERNAME=user@example.com\n"
                     "OPENF1_PASSWORD=segreta=con=uguali\n")
        u, pw = leggi_env(p)
    assert u == "user@example.com", u
    assert pw == "segreta=con=uguali", pw
    assert leggi_env("/percorso/inesistente") == (None, None)


@caso("registratore JSONL: roundtrip scrittura -> lettura")
def test_jsonl_roundtrip():
    with tempfile.TemporaryDirectory() as tmp:
        reg = RegistratoreJSONL(tmp)
        reg.scrivi("v1/location",
                   [{"driver_number": 1, "x": 100, "y": -200, "z": 3,
                     "date": "2026-07-25T13:00:00.100000+00:00"}],
                   "2026-07-25T13:00:01.000")
        reg.scrivi("v1/race_control",
                   {"flag": "RED", "date": "2026-07-25T13:00:02+00:00"},
                   "2026-07-25T13:00:02.500")
        percorso = reg.percorso
        reg.chiudi()
        letti = list(leggi_jsonl(percorso))
    assert len(letti) == 2, letti
    topic, payload, ts = letti[0]
    assert topic == "v1/location" and payload[0]["x"] == 100
    assert ts == datetime(2026, 7, 25, 13, 0, 1), ts
    assert letti[1][1]["flag"] == "RED"


@caso("registratore JSONL: righe rotte saltate, mai eccezioni")
def test_jsonl_robusto():
    with tempfile.TemporaryDirectory() as tmp:
        p = Path(tmp) / "rotto.jsonl"
        p.write_text(json.dumps({"t": "2026-07-25T13:00:01.000",
                                 "topic": "v1/laps", "payload": {}})
                     + "\nRIGA ROTTA {{{\n"
                     + '{"senza_topic": 1}\n')
        letti = list(leggi_jsonl(p))
    assert len(letti) == 1 and letti[0][0] == "v1/laps", letti


@caso("registratore JSONL: apertura pigra (nessun file senza messaggi)")
def test_apertura_pigra():
    with tempfile.TemporaryDirectory() as tmp:
        reg = RegistratoreJSONL(tmp)
        assert list(Path(tmp).iterdir()) == []
        reg.chiudi()
        assert list(Path(tmp).iterdir()) == []
        reg.scrivi("v1/pit", {}, "2026-07-25T13:00:00.000")
        assert len(list(Path(tmp).iterdir())) == 1
        reg.chiudi()


# ---------------------------------------------------------- mappatura

def _eventi(messaggi_):
    from mappa_openf1 import eventi_da_openf1
    return list(eventi_da_openf1(iter(messaggi_)))


@caso("mappa: location raggruppate per date, (0,0,0) filtrato, extra_cars")
def test_mappa_location():
    eventi = _eventi([
        ("v1/drivers", [{"driver_number": 1, "name_acronym": "NOR"},
                        {"driver_number": 44, "name_acronym": "HAM"}], None),
        ("v1/location", [
            {"driver_number": 1, "x": 100, "y": 200, "z": 1,
             "date": "2026-07-25T13:00:01+00:00"},
            {"driver_number": 44, "x": 0, "y": 0, "z": 0,
             "date": "2026-07-25T13:00:01+00:00"},
            {"driver_number": 242, "x": 300, "y": 300, "z": 1,
             "date": "2026-07-25T13:00:01+00:00"},
            {"driver_number": 1, "x": 110, "y": 210, "z": 1,
             "date": "2026-07-25T13:00:01.250000+00:00"},
        ], None),
    ])
    assert len(eventi) == 3, eventi
    dl, f1, f2 = eventi
    assert dl["type"] == "driver_list" and \
        dl["cars"]["1"]["sigla"] == "NOR", dl
    assert f1["type"] == "position_frame"
    assert f1["cars"] == {"1": {"x": 100, "y": 200}}, f1   # 44=(0,0,0) fuori
    assert f1["extra_cars"] == {"242": {"x": 300, "y": 300}}, f1
    assert f1["t"] == "2026-07-25T13:00:01.000Z", f1
    assert f2["cars"]["1"]["x"] == 110 and "extra_cars" not in f2, f2


@caso("mappa: timing_update solo campi cambiati; gap/last_lap/best_lap")
def test_mappa_timing():
    """best_lap (torre live R2, commit d4273a3) e' emesso SOLO quando il
    giro migliora il precedente: e' un miglior-giro, non una copia
    dell'ultimo. Il primo giro e' anche il migliore."""
    eventi = _eventi([
        ("v1/position", {"driver_number": 4, "position": 3,
                         "date": "2026-07-25T13:00:01+00:00"}, None),
        ("v1/position", {"driver_number": 4, "position": 3,
                         "date": "2026-07-25T13:00:02+00:00"}, None),
        ("v1/intervals", {"driver_number": 4, "gap_to_leader": 1.5,
                          "date": "2026-07-25T13:00:03+00:00"}, None),
        ("v1/intervals", {"driver_number": 16, "gap_to_leader": None,
                          "date": "2026-07-25T13:00:03.500000+00:00"}, None),
        ("v1/laps", {"driver_number": 4, "lap_duration": 103.123,
                     "date_start": "2026-07-25T13:00:04+00:00"}, None),
        # giro piu' lento: last_lap cambia, best_lap NO
        ("v1/laps", {"driver_number": 4, "lap_duration": 104.5,
                     "date_start": "2026-07-25T13:00:05+00:00"}, None),
        # giro piu' veloce: entrambi
        ("v1/laps", {"driver_number": 4, "lap_duration": 102.0,
                     "date_start": "2026-07-25T13:00:06+00:00"}, None),
    ])
    assert [e["type"] for e in eventi] == ["timing_update"] * 5, eventi
    assert eventi[0]["cars"] == {"4": {"pos": 3}}, eventi[0]
    assert eventi[1]["cars"] == {"4": {"gap": "+1.500"}}, eventi[1]
    assert eventi[2]["cars"] == {"4": {"last_lap": "1:43.123",
                                       "best_lap": "1:43.123"}}, eventi[2]
    assert eventi[3]["cars"] == {"4": {"last_lap": "1:44.500"}}, eventi[3]
    assert eventi[4]["cars"] == {"4": {"last_lap": "1:42.000",
                                       "best_lap": "1:42.000"}}, eventi[4]


@caso("mappa: v1/pit non emette eventi (in_pit e' del geometrico, Fase 3)")
def test_mappa_pit():
    eventi = _eventi([
        ("v1/pit", {"driver_number": 81, "pit_duration": 22.5,
                    "lap_number": 20,
                    "date": "2026-07-25T13:10:00+00:00"}, None),
    ])
    assert eventi == [], eventi


@caso("in_pit geometrico: K=3 consecutivi + isteresi, eventi intercalati")
def test_inpit_geometrico():
    from inpit_geometrico import ClassificatoreInPit, arricchisci_in_pit
    # corridoio sintetico: segmento orizzontale y=0, x in [0, 2000] dm
    corridoio = [[0, 0], [1000, 0], [2000, 0]]
    c = ClassificatoreInPit(corridoio, soglia_dm=50, k=3)
    # 2 campioni dentro non bastano, il terzo scatta
    assert c.aggiorna("4", 100, 10) is None
    assert c.aggiorna("4", 200, 10) is None
    assert c.aggiorna("4", 300, 10) is True
    # un campione fuori isolato non fa sfarfallare
    assert c.aggiorna("4", 400, 500) is None
    assert c.aggiorna("4", 500, 10) is None
    assert c.stato("4") is True
    # tre fuori consecutivi -> esce
    assert c.aggiorna("4", 600, 500) is None
    assert c.aggiorna("4", 700, 500) is None
    assert c.aggiorna("4", 800, 500) is False

    def frame(t, x, y):
        return {"type": "position_frame", "t": t,
                "cars": {"4": {"x": x, "y": y}}}
    c2 = ClassificatoreInPit(corridoio, soglia_dm=50, k=3)
    eventi = list(arricchisci_in_pit(iter([
        frame("T1", 100, 10), frame("T2", 200, 10),
        frame("T3", 300, 10)]), c2))
    assert [e["type"] for e in eventi] == [
        "position_frame"] * 3 + ["timing_update"], eventi
    assert eventi[-1] == {"type": "timing_update", "t": "T3",
                          "cars": {"4": {"in_pit": True}}}, eventi[-1]


@caso("mappa: race_control track-wide -> track_status, settore ignorato")
def test_mappa_race_control():
    eventi = _eventi([
        ("v1/race_control", {"category": "Flag", "flag": "GREEN",
                             "scope": "Track",
                             "date": "2026-07-25T13:00:00+00:00"}, None),
        ("v1/race_control", {"category": "Flag", "flag": "YELLOW",
                             "scope": "Sector", "sector": 7,
                             "date": "2026-07-25T13:01:00+00:00"}, None),
        ("v1/race_control", {"category": "SafetyCar", "flag": None,
                             "message": "SAFETY CAR DEPLOYED",
                             "date": "2026-07-25T13:02:00+00:00"}, None),
        ("v1/race_control", {"category": "Flag", "flag": "CLEAR",
                             "scope": "Track",
                             "date": "2026-07-25T13:05:00+00:00"}, None),
    ])
    assert [(e["type"], e["status"]) for e in eventi] == [
        ("track_status", "AllClear"),
        ("track_status", "SCDeployed"),
        ("track_status", "AllClear")], eventi


@caso("mappa: deduplica per _id monotono per topic")
def test_mappa_dedup_id():
    eventi = _eventi([
        ("v1/position", {"_id": 10, "driver_number": 4, "position": 3,
                         "date": "2026-07-25T13:00:01+00:00"}, None),
        ("v1/position", {"_id": 10, "driver_number": 4, "position": 5,
                         "date": "2026-07-25T13:00:01+00:00"}, None),
        ("v1/position", {"_id": 11, "driver_number": 4, "position": 2,
                         "date": "2026-07-25T13:00:02+00:00"}, None),
    ])
    assert [e["cars"]["4"]["pos"] for e in eventi] == [3, 2], eventi


# ------------------------------------------------------------------ e2e

def _fixture_jsonl(tmp):
    from ingress_openf1 import RegistratoreJSONL
    reg = RegistratoreJSONL(tmp)
    reg.scrivi("v1/drivers",
               [{"driver_number": 1, "name_acronym": "NOR"}],
               "2026-07-25T12:59:59.000")
    reg.scrivi("v1/location",
               [{"driver_number": 1, "x": 100, "y": 200, "z": 1,
                 "date": "2026-07-25T13:00:01+00:00"},
                {"driver_number": 242, "x": 5, "y": 5, "z": 1,
                 "date": "2026-07-25T13:00:01+00:00"}],
               "2026-07-25T13:00:01.900")
    reg.scrivi("v1/position", {"driver_number": 1, "position": 1,
                               "date": "2026-07-25T13:00:02+00:00"},
               "2026-07-25T13:00:02.500")
    reg.scrivi("v1/race_control", {"category": "Flag", "flag": "RED",
                                   "date": "2026-07-25T13:00:10+00:00"},
               "2026-07-25T13:00:10.800")
    percorso = reg.percorso
    reg.chiudi()
    return percorso


@caso("e2e: collettore --replay JSONL = eventi dell'adapter, via WS")
def test_e2e_jsonl():
    import asyncio
    from mappa_openf1 import eventi_replay_openf1
    from test_collector import avvia_collettore, porte_libere, \
        raccogli_eventi
    with tempfile.TemporaryDirectory() as tmp:
        f = _fixture_jsonl(tmp)
        attesi = list(eventi_replay_openf1([f]))
        ws_port, status_port = porte_libere()
        proc = avvia_collettore([f], ws_port, status_port)
        try:
            import urllib.request
            stato = json.loads(urllib.request.urlopen(
                f"http://127.0.0.1:{status_port}/status", timeout=5).read())
            snapshot, eventi = asyncio.run(raccogli_eventi(ws_port))
        finally:
            proc.wait(timeout=30)
    assert stato["ingress"] == "openf1", stato
    assert eventi == attesi, (eventi, attesi)
    assert snapshot["type"] == "snapshot"
    frame = next(e for e in eventi if e["type"] == "position_frame")
    assert frame["extra_cars"] == {"242": {"x": 5, "y": 5}}, frame
    assert eventi[-1] == {"type": "track_status",
                          "t": "2026-07-25T13:00:10.000Z",
                          "status": "Red"}, eventi[-1]


def main() -> int:
    falliti = 0
    for nome, fn in _esiti:
        try:
            fn()
            print(f"OK   {nome}")
        except AssertionError as e:
            falliti += 1
            print(f"FAIL {nome}: {e}")
        except Exception as e:
            falliti += 1
            print(f"ERR  {nome}: {e!r}")
    print(f"\n{len(_esiti) - falliti}/{len(_esiti)} casi passati")
    return 1 if falliti else 0


if __name__ == "__main__":
    sys.exit(main())
