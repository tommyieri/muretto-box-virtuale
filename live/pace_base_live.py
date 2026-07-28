"""pace_base_live.py — FASE C: stima INCREMENTALE di pace_base dal flusso live.

pace_base (engine.py::pace_base) = mediana, sul segmento dello stint corrente dei soli
giri VERDI, del tempo fuel-corretto
  t_fc = lap_time - max(0, 70 - (70/N)*(lap-1)) * (3/70)
Serve >=3 giri. In REPLAY arriva pre-calcolato dal kernel; in LIVE non c'e', e gli
scenari di degrado ne hanno bisogno. Questo modulo lo ricostruisce giro-per-giro dagli
stessi campi che il collettore espone, con la STESSA semantica del kernel — verificata
(main) contro pace[L][drv] dell'archivio.

ALLINEATO AL KERNEL IL 28/07/2026, e va raccontato perche' e' il guasto piu' insidioso
di tutti: fino a oggi questo modulo aveva la SUA copia della definizione di "giro verde"
(non neutralizzato, no in/out-lap) mentre il kernel ne aveva un'altra. Quando l'audit ha
corretto il kernel (ai_lab/simulatore/REPORT_AUDIT_KERNEL.md) le due si sono separate, e
la validazione qui sotto lo ha misurato: 765 confronti su 2.053 (37%) davano un passo
DIVERSO per lo stesso pilota allo stesso giro.

    Il replay e la diretta rispondevano alla stessa domanda con due numeri.

E' esattamente il guasto che demo/muretto.mjs era nato per impedire ("due copie della
stessa risposta e' il modo piu' sicuro di ritrovarsi con due numeri diversi e nessuno che
sa quale credere"), ricomparso un piano piu' sotto — nella MISURA invece che nella
risposta. Ora la definizione sta in un posto solo, `verde()`, e chi la usa porta i campi.

COSA SERVE DALLA FONTE, e come lo dice ciascuna:
  ARCHIVIO   `status` per-auto-per-giro (concatenazione degli stati attraversati nel giro,
             vocabolario in data/STATUS_VOCABOLARIO_NOTA.md). Verde = '1' esatto.
  DIRETTA    il feed manda TrackStatus di SESSIONE, non la stringa per-auto-per-giro:
             la concatenazione va RICOSTRUITA dal collettore (il giro e' verde se il
             TrackStatus e' stato AllClear per tutta la sua durata) e passata come
             `giro_verde`. Finche' il collettore non la fornisce, `giro_verde=None` e
             il modulo NON indovina: il giro non entra nella mediana.

Read-only, nessun IO di produzione. Il collettore/shadow lo chiama; qui la validazione.
"""
import sys, os, json
import statistics as st

FUEL_COEFF = 3.0 / 70.0
SLICK = ('SOFT', 'MEDIUM', 'HARD')


def verde(lap_time=None, status=None, compound=None, deleted=False,
          in_lap=False, out_lap=False, neutralized=False, giro_verde=None):
    """LA definizione, una sola. Gemella di engine/engine.py::_verde.

    `giro_verde` e' l'unica concessione alle due fonti: chi non ha lo `status`
    per-auto-per-giro (la diretta) porta il verdetto gia' fatto. Chi non ha ne' l'uno
    ne' l'altro non entra: l'assenza di prova non e' prova di verde.
    """
    if lap_time is None or deleted or in_lap or out_lap or neutralized:
        return False
    if compound not in SLICK:          # mescola ignota o da bagnato -> non e' passo asciutto
        return False
    if giro_verde is not None:
        return bool(giro_verde)
    return str(status or '') == '1'


def fuel_corr(lap_time, lap, N):
    return lap_time - max(0.0, 70.0 - (70.0 / N) * (lap - 1)) * FUEL_COEFF


class PaceBaseLive:
    """Stato incrementale per-pilota. `osserva` un giro completato; `pace(drv)`
    ritorna la pace_base corrente (None se < 3 giri verdi nello stint)."""

    def __init__(self, n_laps):
        self.N = n_laps
        self._seg = {}          # drv -> {'stint': s, 'tfc': [..]}

    def osserva(self, drv, lap, lap_time, stint, neutralized=False,
                in_lap=False, out_lap=False, *,
                status=None, compound=None, deleted=False, giro_verde=None):
        """Registra un giro COMPLETATO. Ignora i giri non-verdi (come il kernel).

        Il cambio di stint azzera il segmento SEMPRE, anche per un giro non verde: la
        gomma e' cambiata comunque, e tenere i tempi della vecchia sarebbe peggio che
        non averne.
        """
        if lap_time is None or stint is None:
            return
        s = self._seg.get(drv)
        if s is None or s['stint'] != stint:
            s = {'stint': stint, 'tfc': []}     # nuovo stint -> segmento azzerato
            self._seg[drv] = s
        if not verde(lap_time=lap_time, status=status, compound=compound,
                     deleted=deleted, in_lap=in_lap, out_lap=out_lap,
                     neutralized=neutralized, giro_verde=giro_verde):
            return                              # verde: gli altri escono dalla mediana
        s['tfc'].append(fuel_corr(lap_time, lap, self.N))

    def pace(self, drv):
        s = self._seg.get(drv)
        if not s or len(s['tfc']) < 3:
            return None
        return float(st.median(s['tfc']))


# ------------------------------------------------------------ validazione
def _valida(gara_json):
    """Rialimenta i giri dell'archivio in ordine e confronta pace(drv) col
    pace[L][drv] del kernel a OGNI freeze L. Match a 1e-6."""
    r = json.load(open(gara_json))
    N = r['n_laps']
    pace_kernel = r['pace']
    # per-lap car states in ordine di giro
    byLap = {}
    for lp in r['laps']:
        for d, c in lp['cars'].items():
            byLap.setdefault(c['lap'], {})[d] = c
    live = PaceBaseLive(N)
    confronti = ok = diff = 0
    dettaglio_diff = []
    for L in range(1, N + 1):
        # 1) osserva i giri COMPLETATI al giro L (stato = fine giro L)
        for d, c in byLap.get(L, {}).items():
            live.osserva(d, c['lap'], c.get('lap_time'), c.get('stint'),
                         c.get('neutralized', False), c.get('in_lap', False),
                         c.get('out_lap', False),
                         # i due campi che l'esportatore porta dal 28/07/2026: senza,
                         # questa validazione non potrebbe nemmeno essere scritta
                         status=c.get('status'), compound=c.get('compound'),
                         deleted=c.get('deleted', False))
        # 2) confronta col kernel a freeze L (pace calcolata sui giri <= L)
        riga = pace_kernel.get(str(L), {})
        for d, pk in riga.items():
            pl = live.pace(d)
            if pl is None:
                continue                    # kernel ha pace ma live <3 giri: salta (bordo)
            confronti += 1
            if abs(pl - pk) <= 1e-6:
                ok += 1
            else:
                diff += 1
                if len(dettaglio_diff) < 8:
                    dettaglio_diff.append((L, d, pk, pl))
    return confronti, ok, diff, dettaglio_diff


def main():
    ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    gare = sys.argv[1:] or [os.path.join(ROOT, 'demo', 'data', 'Gran Bretagna.json'),
                            os.path.join(ROOT, 'demo', 'data', 'Austria.json')]
    print('=' * 72)
    print('FASE C — pace_base LIVE vs kernel (archivio). Match a 1e-6.')
    print('=' * 72)
    tot_c = tot_ok = tot_diff = 0
    for g in gare:
        if not os.path.exists(g):
            print(f'  (assente: {g})'); continue
        c, ok, diff, det = _valida(g)
        tot_c += c; tot_ok += ok; tot_diff += diff
        nome = os.path.basename(g).replace('.json', '')
        print(f'  {nome:16s}: {ok}/{c} confronti (L,drv) combaciano'
              + (f'  | {diff} DIFF' if diff else ''))
        for L, d, pk, pl in det:
            print(f'      DIFF L{L} {d}: kernel {pk:.4f} live {pl:.4f}')
    print('-' * 72)
    esito = 'OK — pace_base live riproduce il kernel' if tot_diff == 0 else 'DIFF da ispezionare'
    print(f'  TOTALE: {tot_ok}/{tot_c} combaciano -> {esito}')
    return 0 if tot_diff == 0 else 1


if __name__ == '__main__':
    sys.exit(main())
