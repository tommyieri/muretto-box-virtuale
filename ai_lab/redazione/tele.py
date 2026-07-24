"""
tele.py — il caricatore di telemetria vettura FastF1 che mancava al repo.

I canali auto FastF1 (Speed/Throttle/Brake/nGear/RPM/DRS + X/Y posizione) sono in
cache (~/muretto_shared/ff1_cache) ma NESSUNO script del repo li estraeva: tutti
usavano get_pos_data() (solo X/Y) o caricavano con telemetry=False.  Questo modulo
e' il "mattone mancante": un giro -> il suo canale telemetrico, allineato in metri.

AMBIENTE: gira col python3 UTENTE (fastf1 3.8.3 + pandas 2), NON con la .venv del
kernel (fastf1 non e' nella .venv).  Vedi SETUP_AMBIENTE.md.

Solo lettura: non tocca engine/, demo/, data/.  La cache vive fuori dal repo.
"""
from __future__ import annotations
import os
import logging
import warnings

CACHE = os.path.expanduser("~/muretto_shared/ff1_cache")

_pronto = False


def _prepara():
    """Abilita la cache FastF1 una volta sola e silenzia i log rumorosi."""
    global _pronto
    if _pronto:
        return
    warnings.filterwarnings("ignore")
    import fastf1
    fastf1.Cache.enable_cache(CACHE)
    logging.getLogger("fastf1").setLevel(logging.ERROR)
    try:
        fastf1.set_log_level("ERROR")
    except Exception:
        pass
    _pronto = True


def carica_sessione(anno: int, gp: str, sessione: str = "Q"):
    """Carica una sessione con laps + telemetria dalla cache.

    gp: nome per LOCALITA'/evento accettato da FastF1 (es. 'British Grand Prix').
    Ritorna l'oggetto Session di FastF1 (gia' .load()).
    """
    _prepara()
    import fastf1
    ses = fastf1.get_session(anno, gp, sessione)
    ses.load(telemetry=True, laps=True, weather=False, messages=False)
    return ses


def piloti_sessione(ses):
    """Mappa sigla -> {num, team, colore} per i piloti della sessione.

    Il colore viene dai results FastF1 ('#'+TeamColor); il chiamante puo'
    sovrascriverlo con demo/team_colori.json (fonte canonica del sito).
    """
    out = {}
    for num in ses.drivers:
        di = ses.get_driver(num)
        col = di.get("TeamColor") or ""
        if col and not col.startswith("#"):
            col = "#" + col
        out[di.get("Abbreviation")] = {
            "num": num,
            "team": di.get("TeamName"),
            "colore": col or None,
        }
    return out


def giri_validi(ses, num: str, soglia_lanciato: float = 1.07):
    """Giri LANCIATI puliti di un pilota: LapTime valido, IsAccurate=True e
    tempo entro `soglia_lanciato`x il giro veloce del pilota.

    Il solo IsAccurate non basta: in qualifica alcuni giri in/out arrivano
    mal-etichettati come accurati (verificato: giri ~35 s piu' lenti a 120 km/h).
    Il filtro sul tempo (default 1.07, come SOGLIA_OUTLIER del progetto) tiene
    solo i giri realmente lanciati, non i trasferimenti dai/ai box.
    """
    laps = ses.laps.pick_drivers(num)
    cand = []
    for _, lap in laps.iterrows():
        if lap["LapTime"] != lap["LapTime"]:          # NaT
            continue
        if not bool(lap.get("IsAccurate", False)):
            continue
        s = secondi(lap["LapTime"])
        if s is None:
            continue
        cand.append((s, lap))
    if not cand:
        return []
    veloce = min(c[0] for c in cand)
    return [lap for s, lap in cand if s <= veloce * soglia_lanciato]


def canale_giro(lap):
    """Telemetria vettura di UN giro, allineata in metri.

    Ritorna un DataFrame con almeno: Distance[m], Speed[km/h], Throttle[%],
    Brake[bool], nGear, RPM, DRS, Time.  Solleva se il giro non ha car_data.
    """
    tel = lap.get_car_data().add_distance()
    return tel.reset_index(drop=True)


def posizione_giro(lap):
    """Posizione GPS di un giro: X,Y (in decimi di metro nel sistema FastF1),
    Distance, Status.  Per ancorare un evento sul tracciato.
    """
    pos = lap.get_pos_data().add_distance()
    return pos.reset_index(drop=True)


def secondi(td):
    """timedelta / NaT -> float secondi (o None)."""
    try:
        if td != td:
            return None
    except Exception:
        pass
    try:
        return td.total_seconds()
    except Exception:
        return None
