"""ai_lab/scienziato/modello_traffico.py — il modello TRAFFICO, per regime.

Stessa forma verificata sullo storico, MA i coefficienti si calibrano solo dentro il
proprio regime. Per il 2026 non si eredita niente: ne' a, ne' lam, ne' la durata per
delta-passo. Il 2026 e' un regime a se' sul sorpasso (Spearman theta storico-2026 = -0,024)
e il MODO di superare e' cambiato: push-to-pass a batteria al posto del DRS.

Implementa il contratto di autocalibra.py: nome, regime, uscita, calibra().
"""
import os
import random
import statistics as st

import numpy as np

import composizione as CP
import scheletro
import degrado as DG
import fondo
import traffico as TR

K_RESTART = 3          # finestra post-ripartenza derivata dai dati (2 notti fa)


class ModelloTraffico:
    """Un'istanza per regime. Il regime non si mescola mai."""

    def __init__(self, regime, uscita=None):
        self.regime = regime
        self.nome = f'traffico_{regime.replace("-", "_")}'
        self.uscita = uscita or f'data/modello_{self.nome}.json'

    # ---------------------------------------------------------------- fondo
    def raccogli(self):
        per_gara, dati = {}, {}
        for b in fondo.elenco_blocchi():
            if b['regime'] != self.regime:
                continue
            d = DG.prepara(b)
            if d is None:
                continue
            m = DG.stima(d)
            if 'escluso' in m:
                continue
            inc = TR.incontri(d, m, neutralizzati=TR.giri_neutralizzati(d['righe']),
                              finestra=K_RESTART)
            if inc:
                per_gara[b['id']] = inc
                dati[b['id']] = (d, m)
        return per_gara, dati

    # ---------------------------------------------------------------- calibrazione
    def calibra(self, per_gara=None, dati=None, boot=2000, seed=20260721):
        if per_gara is None:
            per_gara, dati = self.raccogli()
        gids = sorted(per_gara)
        tutti = [x for g in gids for x in per_gara[g]]
        enc = CP.incontri_costo(tutti)

        glob = TR.fit_M0(tutti)                     # a, lam SOLO da questo regime
        dur = CP.stima_durata(enc)
        # kappa: allinea lo stimatore alla METRICA dichiarata. `a` esce dai minimi quadrati
        # (una media) ma il modello e' giudicato sull'errore assoluto MEDIANO: senza kappa
        # la forma sovrastima in ENTRAMBI i regimi (misurato: 0,84 previsto contro 0,43
        # reale nel 2026; 1,01 contro 0,63 nello storico). kappa e' la mediana del rapporto
        # costo reale / costo previsto. Non e' una forma nuova: e' la C2 gia' dichiarata e
        # testata la notte scorsa.
        pr = CP.prevedi(enc, glob, dur, 'C1')
        y = np.array([e['costo'] for e in enc])
        kappa = float(np.median(y[pr > 0] / pr[pr > 0])) if (pr > 0).any() else 1.0

        # intervalli per BOOTSTRAP SUI BLOCCHI (le gare), non sulle osservazioni
        rng = random.Random(seed)
        aa, ll = [], []
        for _ in range(boot):
            camp = [per_gara[gids[rng.randrange(len(gids))]] for _ in gids]
            f = TR.fit_M0([x for c in camp for x in c])
            aa.append(f['a'])
            ll.append(f['lam'])
        aa.sort()
        ll.sort()
        ci = lambda v: [round(v[int(.025 * len(v))], 5), round(v[int(.975 * len(v))], 5)]

        return {
            'coefficienti': {
                'a': round(glob['a'], 5), 'lam': glob['lam'],
                'kappa': round(kappa, 5),
                'durata_per_fascia_delta': {f'{f[0]}..{f[1]}': round(v, 3)
                                            for f, v in sorted(dur['per_fascia'].items())},
                'durata_media': round(dur['globale'], 3)},
            'intervalli': {'a_ci95_blocchi': ci(aa), 'lam_ci95_blocchi': ci(ll),
                           'nota': 'bootstrap sui BLOCCHI (gare), non sulle osservazioni'},
            'forma': {'intensita': 'i(gap) = kappa * a * exp(-gap/lam)  [s al giro]',
                      'durata': 'governata dal delta-passo, per fasce',
                      'soglia_incontro_s': CP.SOGLIA_INCONTRO,
                      'finestra_post_restart_giri': K_RESTART},
            'diagnostica': {'n_incontri': len(enc), 'n_giri_in_traffico': len(tutti),
                            'gare': gids,
                            'costo_incontro_mediano_reale_s': round(
                                st.median([e['costo'] for e in enc]), 3),
                            'costo_per_giro_mediano_reale_s': round(
                                st.median([e['costo'] / e['durata'] for e in enc]), 3)},
            'verifica': self.verifica(per_gara, dati, None),
            'limite_onesto': [
                'CAMPO REALE: si calcola solo contro il campo com era. Le altre auto non '
                'rallentano perche sei li, non si difendono, non cambiano strategia. Dice '
                '"Leclerc diverso dentro la gara che E successa", non "quella che SAREBBE '
                'successa".',
                f'REGIME {self.regime} SOLTANTO: nessun coefficiente ereditato da altri '
                'regimi. Si rinforza a ogni Gran Premio nuovo (vedi storico).',
                'CIECO su pioggia (gare escluse) e sui primi 3 giri dopo ogni ripartenza.',
                'CONSERVATIVO sul delta-passo grande: ordina giusto ma sottostima la '
                'magnitudine di chi e molto piu veloce ed e bloccato.',
                'IL CANCELLO PENDE DA UN SOLO GRAN PREMIO. Misurato leave-one-race-out sul '
                '2026: 5 gare su 10, tolte DA SOLE, ribaltano ACCENDIBILE da false a true '
                '(Canada, Cina, Giappone, Miami, Monaco). Con tutte e 10 le gare il '
                'confronto appaiato contro il traffico-zero e NEGATIVO (-0,057 s: il '
                'modello e peggio del non-fare-niente), ma togliendo una qualunque delle '
                'dieci diventa POSITIVO: la mediana sta in bilico su 5 blocchi. Finche il '
                'regime non si arricchisce, acceso/spento non e una proprieta del modello '
                'ma dell insieme di gare che si e avuto.',
                'LA PARTIZIONE CALIBRAZIONE/VERIFICA NON E STABILE. Il fuori campione usa '
                'gli indici pari/dispari sulle gare ordinate: aggiungere o togliere UN Gran '
                'Premio ROVESCIA la partizione (misurato: togliendo la prima gara, '
                'sovrapposizione fra il vecchio e il nuovo insieme di verifica = ZERO). '
                'Quindi a ogni gara nuova il cancello si rimisura su un insieme diverso, e '
                'puo cambiare risposta per ragioni che NON sono evidenza nuova. Da tenere a '
                'mente prima di leggere un cambio di ACCENDIBILE come un progresso.'],
            '_n_gare': len(gids), '_n_blocchi': len(gids),
        }

    # ---------------------------------------------------------------- verifiche
    def verifica(self, per_gara, dati, coef, seed=20260721):
        """Fuori campione + test McLaren + placebo. Ritorna il verdetto."""
        gids = sorted(per_gara)
        cal, ver = gids[0::2], gids[1::2]
        enc_cal = CP.incontri_costo([x for g in cal for x in per_gara[g]])
        enc_ver = CP.incontri_costo([x for g in ver for x in per_gara[g]])
        glob = TR.fit_M0([x for g in cal for x in per_gara[g]])
        dur = CP.stima_durata(enc_cal)
        pr = CP.prevedi(enc_cal, glob, dur, 'C1')
        yc = np.array([e['costo'] for e in enc_cal])
        kappa = float(np.median(yc[pr > 0] / pr[pr > 0])) if (pr > 0).any() else 1.0

        e_mod = CP.errore_per_gara(enc_ver, kappa * CP.prevedi(enc_ver, glob, dur, 'C1'))
        e_zero = CP.errore_per_gara(enc_ver, np.zeros(len(enc_ver)))

        rng = random.Random(seed)
        def bm(v):
            m = sorted(st.median([v[rng.randrange(len(v))] for _ in v]) for _ in range(2000))
            return round(st.median(v), 4), [round(m[50], 4), round(m[1949], 4)]
        mm, cim = bm(e_mod)
        mz, ciz = bm(e_zero)
        app = [a - b for a, b in zip(e_zero, e_mod)]

        # test McLaren: chi ha delta-passo grande ed e bloccato deve PAGARE DI PIU'
        mc = [e for e in enc_ver if e['delta'] < -0.8]
        pp = [e for e in enc_ver if -0.15 <= e['delta'] < 0.15]
        out = {'oos': {'errore_modello': mm, 'ci95': cim, 'errore_traffico_zero': mz,
                       'ci95_zero': ciz, 'guadagno': round(mz - mm, 4),
                       'n_gare_calibrazione': len(cal), 'n_gare_verifica': len(ver),
                       'appaiato_mediano': round(st.median(app), 4) if app else None},
               'mclaren': None, 'placebo': None,
               'kappa_calibrazione': round(kappa, 5)}
        # IL CANCELLO DI ACCENSIONE, dichiarato: il modello si propone per il live SOLO
        # quando batte il traffico-zero con l'IC95 appaiato che esclude lo zero.
        bo = scheletro.bootstrap_a_blocchi(app) if len(app) > 1 else None
        esclude = bool(bo and bo['ci95'] and bo['ci95'][0] > 0)
        out['cancello_accensione'] = {
            'batte_traffico_zero': bool(mm < mz),
            'appaiato_vs_zero': bo['mediana'] if bo else None,
            'ci95_appaiato': bo['ci95'] if bo else None,
            'esclude_lo_zero': esclude,
            'ACCENDIBILE': esclude,
            'criterio': 'si propone per il live solo se l IC95 appaiato contro il '
                        'traffico-zero esclude lo zero. Finche no, resta spento.'}
        if mc and pp:
            pm = kappa * CP.prevedi(mc, glob, dur, 'C1')
            pa = kappa * CP.prevedi(pp, glob, dur, 'C1')
            out['mclaren'] = {
                'n_delta_grande': len(mc), 'n_pari_passo': len(pp),
                'costo_reale_delta_grande': round(st.median([e['costo'] for e in mc]), 3),
                'costo_reale_pari_passo': round(st.median([e['costo'] for e in pp]), 3),
                'previsto_delta_grande': round(float(np.median(pm)), 3),
                'previsto_pari_passo': round(float(np.median(pa)), 3),
                'ordina_giusto': bool(float(np.median(pm)) > float(np.median(pa))),
                'criterio': 'chi ha delta-passo grande ed e bloccato deve pagare di piu'}
        # placebo: leader a caso (traffico.placebo_leader, GIA SOTTO SIGILLO)
        pl = []
        for g in gids:
            d, m = dati[g]
            pl.extend(TR.placebo_leader(per_gara[g], d, m))
        if pl:
            e_pl = CP.incontri_costo(pl)
            mc_pl = [e for e in e_pl if e['delta'] < -0.8]
            pp_pl = [e for e in e_pl if -0.15 <= e['delta'] < 0.15]
            if mc_pl and pp_pl:
                out['placebo'] = {
                    'costo_delta_grande_finto': round(st.median([e['costo'] for e in mc_pl]), 3),
                    'costo_pari_passo_finto': round(st.median([e['costo'] for e in pp_pl]), 3),
                    'separazione_finta': round(st.median([e['costo'] for e in mc_pl])
                                               - st.median([e['costo'] for e in pp_pl]), 3),
                    'nota': 'con leader a caso la separazione deve COLLASSARE'}
        return out
