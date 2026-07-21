"""ai_lab/scienziato/fenomeno_fuel.py — IL MATTONE: la correzione carburante.

Implementa il contratto Fenomeno di scheletro.py. Tutto quello che sa dei dati passa da
fondo.py; non importa engine/, non conosce FUEL_COEFF se non per DICHIARARE che cosa
afferma il kernel esistente (§ valore_kernel) — mai per stimare.

GRANDEZZA IDENTIFICABILE (prereg §0)
  Delta = scivolamento totale del tempo sul giro dal giro 1 al giro N attribuibile al
  termine lineare nel giro-gara, in secondi. Il kernel afferma Delta = 3,0*(N-1)/N.

IDENTIFICAZIONE (prereg §2)
  Dentro uno stint giro ed eta sono collineari: la desincronizzazione arriva FRA stint.
  Effetti fissi di PILOTA (mai di stint), livelli di compound, pendenza di degrado per
  compound, e il coefficiente sul giro-gara.

  Confondimento dichiarato: l'evoluzione della pista e' anch'essa lineare nel giro e ha
  lo stesso segno. Delta stimato = carburante + evoluzione => LIMITE SUPERIORE.
"""
import statistics as st

import numpy as np

import fondo
import scheletro

MIN_GIRI = 150
MIN_PILOTI = 8
MIN_COMPOUND = 2
MAX_CORR = 0.95           # G2: oltre, giro ed eta non sono desincronizzati

# EMENDAMENTO dichiarato (dopo la prima esecuzione, REPORT_SCIENZIATO_FUEL.md §B1.4):
# un compound entra solo con >=3 stint distinti e >=30 giri validi; sotto quella soglia
# i suoi giri sono ESCLUSI esplicitamente e contati. Regola NON inventata qui: e' il
# guardrail gia' dichiarato dal progetto in test_identificabilita_degrado.py, conservato
# come METODO. Senza, un compound con 1 solo giro rende la sua colonna dummy collineare
# alla propria colonna eta e fa cadere il rango: 4 gare andavano perse in silenzio.
MIN_STINT_COMPOUND, MIN_GIRI_COMPOUND = 3, 30

# Che cosa afferma il mattone esistente. Trascritto da engine/engine.py:40 come
# DICHIARAZIONE, non importato: il fenomeno non deve poter usare il kernel per stimare.
KERNEL_KG = 70.0
KERNEL_S_PER_KG = 3.0 / 70.0
KERNEL_SWING = KERNEL_KG * KERNEL_S_PER_KG        # 3,0 s a serbatoio pieno


def _compound_identificabili(keep):
    """Guardrail G5 (emendamento dichiarato): tiene solo i compound con abbastanza
    stint e giri. Ritorna (righe_tenute, {compound_escluso: n_giri})."""
    stint, giri = {}, {}
    for r in keep:
        c = r['compound']
        stint.setdefault(c, set()).add((r['drv'], r['stint']))
        giri[c] = giri.get(c, 0) + 1
    ok = {c for c in giri if len(stint[c]) >= MIN_STINT_COMPOUND
          and giri[c] >= MIN_GIRI_COMPOUND}
    return ([r for r in keep if r['compound'] in ok],
            {c: n for c, n in giri.items() if c not in ok})


class FenomenoFuel:
    nome = 'correzione carburante'
    grandezza = ('scivolamento totale del tempo sul giro dal giro 1 al giro N dovuto al '
                 'termine lineare nel giro-gara (carburante + evoluzione pista)')
    unita = 's sull\'intera gara'

    def __init__(self, soglia_aria=fondo.SOGLIA_ARIA, eta_da_life=False,
                 senza_compound=False, eta_quadratica=False, giro_quadratico=False,
                 cache=None):
        self.soglia_aria = soglia_aria
        self.eta_da_life = eta_da_life
        self.senza_compound = senza_compound
        self.eta_quadratica = eta_quadratica
        # D1 del PREREG_percircuito: termine giro^2, DIAGNOSTICO della contaminazione da
        # evoluzione pista (il carburante e' esattamente lineare nel giro, l'evoluzione
        # satura). Non modifica nessuna stima: si legge il suo coefficiente e basta.
        self.giro_quadratico = giro_quadratico
        self._cache = {} if cache is None else cache

    # ------------------------------------------------------------ blocchi
    def blocchi(self):
        return fondo.elenco_blocchi()

    def valore_kernel(self, blocco):
        N = self._dati(blocco)[2] if self._dati(blocco) else None
        return None if N is None else round(KERNEL_SWING * (N - 1) / N, 4)

    # ------------------------------------------------------------ dati puliti
    def _dati(self, blocco):
        key = (blocco['percorso'], self.soglia_aria, self.eta_da_life)
        if key in self._cache:
            return self._cache[key]
        righe = fondo.carica(blocco['percorso'])
        if fondo.bagnato(righe):
            self._cache[key] = None
            return None
        keep, scarti, N = fondo.pulisci(righe, self.soglia_aria, self.eta_da_life)
        self._cache[key] = (keep, scarti, N, fondo.data_gara(righe), righe)
        return self._cache[key]

    # ------------------------------------------------------------ disegno
    def _disegno(self, keep, colonna_giro=None):
        """Costruisce X, y, gruppi. colonna_giro permette di sostituire il giro-gara con
        la sua versione permutata (null) senza toccare nient'altro."""
        piloti = sorted({r['drv'] for r in keep})
        comp = sorted({r['compound'] for r in keep})
        rif = 'MEDIUM' if 'MEDIUM' in comp else comp[0]
        di = {d: i for i, d in enumerate(piloti)}
        nd, nc = len(piloti), len(comp)
        usa_comp = (not self.senza_compound) and nc > 1
        n_delta = (nc - 1) if usa_comp else 0
        n_gamma = nc if usa_comp else 1
        n_extra = (1 if self.giro_quadratico else 0) + (1 if self.eta_quadratica else 0)
        cols = nd + n_delta + 1 + n_gamma + n_extra
        giri = colonna_giro if colonna_giro is not None else [r['lap'] for r in keep]
        gm = st.mean(giri)
        X = np.zeros((len(keep), cols))
        y = np.array([r['time'] for r in keep], float)
        i_giro = nd + n_delta
        d_idx = {c: nd + j for j, c in enumerate([c for c in comp if c != rif])}
        g_idx = ({c: i_giro + 1 + j for j, c in enumerate(comp)} if usa_comp
                 else {c: i_giro + 1 for c in comp})
        i_giro2 = (i_giro + 1 + n_gamma) if self.giro_quadratico else None
        i_eta2 = (cols - 1) if self.eta_quadratica else None
        for i, r in enumerate(keep):
            X[i, di[r['drv']]] = 1.0
            if usa_comp and r['compound'] != rif:
                X[i, d_idx[r['compound']]] = 1.0
            X[i, i_giro] = giri[i] - gm
            X[i, g_idx[r['compound']]] = r['eta']
            if i_giro2 is not None:
                X[i, i_giro2] = (giri[i] - gm) ** 2
            if i_eta2 is not None:
                X[i, i_eta2] = r['eta'] ** 2
        gruppi = [(r['drv'], r['stint']) for r in keep]
        self._i_giro2, self._n_gamma = i_giro2, n_gamma
        return X, y, gruppi, i_giro

    # ------------------------------------------------------------ B1: la stima
    def stima(self, blocco):
        d = self._dati(blocco)
        if d is None:
            return {'escluso': 'G1 pioggia (wR)'}
        keep, scarti, N, data, righe = d
        keep, esclusi_c = _compound_identificabili(keep)
        scarti = dict(scarti, G5_compound_non_identificabile=sum(esclusi_c.values()))
        if len(keep) < MIN_GIRI:
            return {'escluso': f'G4 solo {len(keep)} giri validi'}
        if len({r['drv'] for r in keep}) < MIN_PILOTI:
            return {'escluso': f'G4 solo {len({r["drv"] for r in keep})} piloti'}
        if len({r['compound'] for r in keep}) < MIN_COMPOUND:
            return {'escluso': 'G4 un solo compound identificabile'}
        c = scheletro.corr([r['lap'] for r in keep], [r['eta'] for r in keep])
        if abs(c) > MAX_CORR:
            return {'escluso': f'G2 giro ed eta non desincronizzati (corr {c:+.3f})'}
        X, y, gruppi, i_giro = self._disegno(keep)
        fit = scheletro.ols_cluster(X, y, gruppi)
        if fit is None:
            return {'escluso': 'G3 rango non pieno'}
        gamma = float(fit['beta'][i_giro])
        se = float(fit['se'][i_giro])
        span = N - 1
        return {'valore': round(-gamma * span, 4),
                'valore_ci95': [round(-(gamma + 1.96 * se) * span, 4),
                                round(-(gamma - 1.96 * se) * span, 4)],
                'gamma_s_per_giro': round(gamma, 5), 'se_gamma': round(se, 5),
                'n_giri': len(keep), 'n_piloti': len({r['drv'] for r in keep}),
                'n_stint': len(set(gruppi)), 'n_laps_gara': N, 'data': data,
                'corr_giro_eta': round(c, 3), 'sigma_residuo': round(fit['sigma'], 3),
                'scarti': scarti,
                'curvatura_giro2': (None if self._i_giro2 is None
                                    else round(float(fit['beta'][self._i_giro2]), 6)),
                'degrado_medio_s_giro': round(float(np.mean(
                    [fit['beta'][j] for j in range(i_giro + 1,
                                                   i_giro + 1 + self._n_gamma)])), 4)}

    # ------------------------------------------------------------ B1: il null
    def null(self, blocco, n=200, seed=20260721):
        """Permuta gli OFFSET di stint (offset = giro - eta, costante dentro lo stint)
        fra gli stint, tenendo ferme le eta. La desincronizzazione diventa finta:
        sotto il null il coefficiente sul giro deve essere ~0."""
        import random
        d = self._dati(blocco)
        if d is None:
            return []
        keep, _, N, _, _ = d
        keep, _ = _compound_identificabili(keep)
        if len(keep) < MIN_GIRI:
            return []
        stint = {}
        for i, r in enumerate(keep):
            stint.setdefault((r['drv'], r['stint']), []).append(i)
        chiavi = list(stint)
        offset = {k: st.median([keep[i]['lap'] - keep[i]['eta'] for i in stint[k]])
                  for k in chiavi}
        rng = random.Random(seed + hash(blocco['id']) % 10000)
        fuori, span = [], N - 1
        for _ in range(n):
            perm = list(offset.values())
            rng.shuffle(perm)
            giri = [0.0] * len(keep)
            for k, off in zip(chiavi, perm):
                for i in stint[k]:
                    giri[i] = off + keep[i]['eta']
            X, y, gruppi, i_giro = self._disegno(keep, colonna_giro=giri)
            fit = scheletro.ols_cluster(X, y, gruppi)
            if fit is not None:
                fuori.append(-float(fit['beta'][i_giro]) * span)
        return fuori

    # ------------------------------------------------------------ robustezze
    @staticmethod
    def varianti_robustezza():
        return {
            'aria_1.0s': {'soglia_aria': 1.0},
            'aria_3.0s': {'soglia_aria': 3.0},
            'nessun_filtro_traffico': {'soglia_aria': 0.0},
            'eta_dal_campo_life': {'eta_da_life': True},
            'senza_livelli_compound': {'senza_compound': True},
            'con_eta_quadratica': {'eta_quadratica': True},
        }
