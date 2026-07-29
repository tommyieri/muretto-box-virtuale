"""stint_poller.py — poller REST degli stint OpenF1 -> (compound, tyre_age) per pilota.

PERCHE' REST E NON MQTT/SignalR (vincoli misurati, vedi RUNBOOK_WEEKEND):
  - SignalR (`TimingAppData`, che HA gli stint) e' irraggiungibile dal VPS: CloudFront
    blocca gli IP datacenter (403 su ogni richiesta, blocco IP/ASN);
  - l'MQTT OpenF1 e' rifiutato dal broker (`Not authorized`, dal 20/07) e `v1/stints`
    non e' comunque documentato tra i topic;
  - `GET api.openf1.org/v1/stints` invece risponde **200 dal VPS in ~25 ms** (host
    diverso: nessun blocco CloudFront) e porta esattamente compound + eta'-gomma.
Gli stint sono dati a BASSA frequenza (cambiano solo ai pit stop): un polling ogni
30-60 s basta, non serve uno stream.

FORMULA DELL'ETA'-GOMMA — CALIBRATA, non assunta (21/07/2026):
    eta(giro) = tyre_age_at_start + (giro - lap_start) + 1
Confrontata contro il `tyre_age` dell'archivio (demo/data/Gran Bretagna.json, gara
British 2026 = session_key 11326) su 1059 confronti: **98.0% di match**, contro **0%**
della variante senza il +1. Il +1 conta il giro in corso. Regressione in test_stint_poller.

ONESTA': nessun dato inventato. Compound fuori dal vocabolario noto -> None (non
emesso); eta' non calcolabile -> None; errore HTTP/timeout -> nessun evento e warning.

Uso (verifica manuale a sessione aperta):
    python3 live/collector/stint_poller.py --session-key latest
"""
import argparse
import json
import logging
import urllib.error
import urllib.request

log = logging.getLogger("stint_poller")

URL_STINTS = "https://api.openf1.org/v1/stints"
COMPOUND_NOTI = ("SOFT", "MEDIUM", "HARD", "INTERMEDIATE", "WET")
INTERVALLO_S = 45.0          # gli stint cambiano solo ai pit: 30-60 s bastano
TIMEOUT_S = 10.0


def eta_gomma(stint, giro):
    """eta' della gomma al `giro` dato (formula calibrata, vedi docstring).
    None se i campi non ci sono o il giro precede l'inizio dello stint."""
    a0 = stint.get("tyre_age_at_start")
    ls = stint.get("lap_start")
    if a0 is None or ls is None or giro is None:
        return None
    try:
        eta = int(a0) + (int(giro) - int(ls)) + 1
    except (TypeError, ValueError):
        return None
    return eta if eta >= 0 else None


def _compound(valore):
    return valore if valore in COMPOUND_NOTI else None


def stint_corrente(stints_pilota, giro=None):
    """Lo stint in corso: quello che CONTIENE il giro se noto, altrimenti quello con
    stint_number massimo. None se la lista e' vuota."""
    utili = [s for s in stints_pilota if isinstance(s, dict)]
    if not utili:
        return None
    if giro is not None:
        dentro = [s for s in utili
                  if s.get("lap_start") is not None
                  and s.get("lap_end") is not None
                  and int(s["lap_start"]) <= int(giro) <= int(s["lap_end"])]
        if dentro:
            return max(dentro, key=lambda s: s.get("stint_number") or 0)
    return max(utili, key=lambda s: s.get("stint_number") or 0)


def stato_da_stints(righe, giro_per_pilota=None):
    """[righe API] -> {numero_pilota(str): {'compound':..., 'tyre_age':...}}.

    `giro_per_pilota` (dal feed live, se disponibile) e' la fonte AUTOREVOLE del giro
    corrente; in sua assenza si usa `lap_end` dello stint (durante una sessione viva
    segue il giro in corso — semantica da confermare alla prima sessione)."""
    giro_per_pilota = giro_per_pilota or {}
    per_pilota = {}
    for r in righe or ():
        if not isinstance(r, dict):
            continue
        num = r.get("driver_number")
        if num is None:
            continue
        per_pilota.setdefault(str(num), []).append(r)
    out = {}
    for num, stints in per_pilota.items():
        giro = giro_per_pilota.get(num)
        cur = stint_corrente(stints, giro)
        if cur is None:
            continue
        if giro is None:
            giro = cur.get("lap_end")
        comp = _compound(cur.get("compound"))
        eta = eta_gomma(cur, giro)
        if comp is None and eta is None:
            continue                      # niente di utile: non si emette nulla
        out[num] = {"compound": comp, "tyre_age": eta}
    return out


def scarica(session_key="latest", url=URL_STINTS, timeout=TIMEOUT_S, token=None):
    """GET dell'endpoint. Ritorna la lista di righe, o None su errore (mai eccezioni:
    un poller che muore e' peggio di un poller che salta un giro)."""
    req = urllib.request.Request(f"{url}?session_key={session_key}")
    if token:
        req.add_header("Authorization", f"Bearer {token}")
    try:
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            return json.loads(resp.read().decode("utf-8"))
    except (urllib.error.URLError, TimeoutError, ValueError, OSError) as e:
        log.warning("stint_poller: GET fallito (%r) — nessun evento emesso", e)
        return None


class StintPoller:
    """Stato + diff: emette SOLO i campi cambiati, come i timing_update del collettore."""

    def __init__(self, session_key="latest", fetch=None, token=None):
        self.session_key = session_key
        self._fetch = fetch or (lambda: scarica(self.session_key, token=token))
        self._ultimo = {}          # num -> {'compound':..., 'tyre_age':...}

    def aggiorna(self, giro_per_pilota=None):
        """Scarica e ritorna il DIFF {num: {campi cambiati}} ({} se nulla o errore)."""
        righe = self._fetch()
        if righe is None:
            return {}
        nuovo = stato_da_stints(righe, giro_per_pilota)
        diff = {}
        for num, campi in nuovo.items():
            prima = self._ultimo.get(num, {})
            cambi = {k: v for k, v in campi.items()
                     if v is not None and prima.get(k) != v}
            if cambi:
                diff[num] = cambi
            self._ultimo[num] = {**prima, **{k: v for k, v in campi.items()
                                             if v is not None}}
        return diff


def evento_timing_update(diff, t=None):
    """Diff -> evento nella forma del collettore. None se il diff e' vuoto."""
    if not diff:
        return None
    e = {"type": "timing_update", "cars": diff}
    if t is not None:
        e["t"] = t
    return e


def main():
    p = argparse.ArgumentParser(description="Verifica manuale del poller stint OpenF1")
    p.add_argument("--session-key", default="latest")
    p.add_argument("--token", default=None, help="bearer token OpenF1 (dati live)")
    args = p.parse_args()
    logging.basicConfig(level=logging.INFO, format="%(message)s")
    righe = scarica(args.session_key, token=args.token)
    if righe is None:
        print("GET fallito: nessun dato.")
        return 1
    print(f"righe stint ricevute: {len(righe)}")
    stato = stato_da_stints(righe)
    if not stato:
        print("nessuno stint utilizzabile (sessione non viva o dati assenti).")
        return 0
    print(f"{'pilota':>7}  {'compound':<8} eta'")
    for num in sorted(stato, key=lambda x: int(x) if str(x).isdigit() else 999):
        v = stato[num]
        print(f"{num:>7}  {str(v['compound'] or '-'):<8} {v['tyre_age']}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
