#!/usr/bin/env python3
"""coefficiente_vivo.py — UN NUMERO CHE SI AGGIORNA DA SOLO, gara dopo gara.

Serve a una richiesta precisa del PO: «quando c'e' una nuova gara quel numero o lo
confermiamo o e' migliorato, senza nessun mio input». Vale per qualunque grandezza:
gradino di sosta, pit-loss, degrado, traffico, offset mescola, passo di squadra.

PERCHE' NON UN CANCELLO. Il metodo di casa oggi e' binario: un modello passa un cancello
GO/NO-GO e o si accende o resta spento. In letteratura quel metodo si chiama test-then-pool
ed e' documentato come SUBOTTIMALE rispetto al borrowing continuo (robust mixture prior,
conditional power prior). La ragione e' semplice: un NULL butta via l'informazione parziale,
un PESO la conserva scalata. Qui il cancello resta — ma solo per decidere se ACCENDERE una
cosa in produzione, non per decidere quanto vale un numero.

LE QUATTRO PARTI, tutte in forma chiusa (niente MCMC, niente scipy):

  1. PRIOR DALLO STORICO (MAP prior, meta-analisi random-effects)
     Ogni stagione da' una stima con il suo errore. tau^2 fra stagioni con DerSimonian-Laird
     e' l'unica misura ONESTA di «quanto un cambio di regolamento sposta questo numero»:
     il 2022 e' gia' dentro come precedente reale. Se le stagioni ballano, il prior nasce
     largo e il regime nuovo lo scavalca in fretta. Non e' una scelta: e' una conseguenza.

  2. PRIOR ROBUSTO (Schmidli) — la parte che risponde letteralmente al PO
     prior = w*N(theta_MAP, s^2)  +  (1-w)*N(theta_MAP, (K*s)^2)
     Dopo ogni gara il peso si aggiorna da solo:
         w' = 1 / (1 + ((1-w)/w) * N(y | vaga) / N(y | storica))
     Se il regime nuovo CONFERMA lo storico, w resta alto. Se lo SMENTISCE, w crolla.
     Nessuno decide niente: `w` e' l'indicatore leggibile di «quanto stiamo ancora usando
     il passato», ed e' scritto nella targhetta.

  3. AGGIORNAMENTO GARA PER GARA (Kalman scalare con discount)
     Non si ri-stima da zero a ogni gara: pesare il 2018 quanto il 2026 e' sbagliato.
         predict: P <- P/delta          (delta<1 = dimentica lentamente)
         update : K = P/(P+R);  theta += K*(y-theta);  P = (1-K)*P
     R e' l'errore della misura DI QUELLA GARA (poche soste -> R grande -> conta meno).

  4. IL CICLO PREQUENZIALE (l'unica difesa vera dall'auto-inganno)
     Ordine RIGIDO e non negoziabile, per ogni gara:
        (a) il modello PREVEDE con lo stato di prima
        (b) si registra la perdita
        (c) SOLO DOPO si assorbe la gara
     Invertire (a) e (c) e' esattamente come si costruisce un modello che sembra bravo e
     non lo e'. La perdita e' tenuta a fattore di oblio: due accumulatori, O(1), e vede il
     peggioramento recente che una media cumulata nasconderebbe.

E LA DERIVA. Page-Hinkley sul residuo standardizzato. Quando scatta NON si azzera theta
(butteremmo la stima): si rigonfia P e si rialza w. Cioe' il sistema RIAPRE l'apprendimento
invece di ricominciare da capo.
"""
import json
import math

# --- costanti dichiarate. Cambiarle e' una decisione, non manutenzione. ---
K_VAGA = 10.0          # quanto e' larga la componente "non mi fido" (Schmidli usa 10x)
W0 = 0.5               # fiducia iniziale nello storico: meta'. Nessuno sa di piu' a priori.
DELTA = 0.95           # discount del Kalman: ~20 gare di memoria effettiva
W_MIN, W_MAX = 0.02, 0.98      # il peso non si inchioda mai a 0 o 1: si deve poter tornare
OBLIO = 0.97           # fattore di oblio della perdita prequenziale
PH_DELTA = 0.05        # tolleranza di Page-Hinkley (in unita' di residuo standardizzato)
PH_LAMBDA = 4.0        # soglia d'allarme


def _norm_pdf(x, mu, var):
    if var <= 0:
        return 0.0
    return math.exp(-0.5 * (x - mu) ** 2 / var) / math.sqrt(2 * math.pi * var)


def prior_dallo_storico(stime):
    """MAP prior da piu' stagioni, meta-analisi random-effects (DerSimonian-Laird).

    stime: [(etichetta, theta_s, se_s), ...] — una per stagione/regime storico.
    Ritorna (theta, sigma, tau2, diagnostica).

    tau2 e' la varianza FRA stagioni: e' la misura di quanto questo numero si muove quando
    cambia il mondo. Un tau2 grande NON e' un fallimento — e' l'informazione che ci dice di
    non fidarci troppo del passato, e la trasferisce automaticamente nella larghezza.
    """
    st = [(e, t, s) for e, t, s in stime if s is not None and s > 0]
    if not st:
        raise ValueError('nessuna stima storica utilizzabile')
    if len(st) == 1:
        e, t, s = st[0]
        return t, s, 0.0, {'k': 1, 'nota': 'una sola stagione: tau2 non stimabile'}
    w = [1.0 / s ** 2 for _, _, s in st]
    sw = sum(w)
    theta_fe = sum(wi * t for wi, (_, t, _) in zip(w, st)) / sw
    Q = sum(wi * (t - theta_fe) ** 2 for wi, (_, t, _) in zip(w, st))
    k = len(st)
    C = sw - sum(wi ** 2 for wi in w) / sw
    tau2 = max(0.0, (Q - (k - 1)) / C) if C > 0 else 0.0
    w2 = [1.0 / (s ** 2 + tau2) for _, _, s in st]
    sw2 = sum(w2)
    theta = sum(wi * t for wi, (_, t, _) in zip(w2, st)) / sw2
    sigma = math.sqrt(1.0 / sw2 + tau2)     # incertezza della media + eterogeneita'
    return theta, sigma, tau2, {
        'k': k, 'Q': round(Q, 3), 'tau2': round(tau2, 6),
        'I2': round(max(0.0, (Q - (k - 1)) / Q) if Q > 0 else 0.0, 3),
        'per_stagione': {e: round(t, 4) for e, t, _ in st},
    }


class CoefficienteVivo:
    """Un coefficiente che si aggiorna da solo. Non chiede niente a nessuno."""

    def __init__(self, nome, unita, theta_prior, sigma_prior, tau2=0.0,
                 diagnostica_prior=None, delta=DELTA, w0=W0, congelato=False):
        # congelato=True: PREVEDE e registra la perdita come tutti, ma NON impara mai.
        # Serve come termine di paragone onesto ("e se ci fossimo fidati e basta del
        # passato?"), e va misurato con lo stesso metro degli altri — non escluso.
        self.congelato = congelato
        self.nome = nome
        self.unita = unita
        self.theta0 = theta_prior          # il prior storico, mai modificato
        self.sigma0 = sigma_prior
        self.tau2 = tau2
        self.diag_prior = diagnostica_prior or {}
        self.delta = delta
        # stato vivo
        self.theta = theta_prior
        self.P = sigma_prior ** 2
        self.w = w0                        # peso della componente STORICA
        self.n = 0
        # ciclo prequenziale
        self._S = 0.0
        self._N = 0.0
        self.storia = []
        # Page-Hinkley
        self._ph_m = 0.0
        self._ph_M = 0.0
        self.allarmi = []

    # ---------------------------------------------------------------- lettura
    def prevedi(self):
        """(theta, sd) da usare PRIMA di vedere la gara. E' l'unico numero pubblicabile."""
        return self.theta, math.sqrt(self.P)

    def perdita_prequenziale(self):
        """Errore medio recente, a fattore di oblio. None finche' non c'e' storia."""
        return (self._S / self._N) if self._N > 0 else None

    # ---------------------------------------------------------------- scrittura
    def assorbi(self, y, se_y, etichetta=''):
        """Assorbe UNA gara. Rispetta l'ordine: prima si prevede, poi si impara.

        y: la stima di quella gara.  se_y: il suo errore standard (poche soste -> grande).
        """
        if se_y is None or se_y <= 0:
            se_y = max(abs(y) * 0.5, 1e-3)      # misura senza incertezza dichiarata: prudenza
        R = se_y ** 2

        # (a) previsione con lo stato di PRIMA, e (b) perdita. Mai dopo.
        prev, sd_prev = self.prevedi()
        err = y - prev
        self._S = OBLIO * self._S + abs(err)
        self._N = OBLIO * self._N + 1.0
        z = err / math.sqrt(self.P + R) if (self.P + R) > 0 else 0.0

        # peso del prior storico (Schmidli): si aggiorna DA SOLO
        v_sto = self.sigma0 ** 2 + R
        v_vag = (K_VAGA * self.sigma0) ** 2 + R
        d_sto = _norm_pdf(y, self.theta0, v_sto)
        d_vag = _norm_pdf(y, self.theta0, v_vag)
        if d_sto > 0 and self.w > 0:
            self.w = 1.0 / (1.0 + ((1.0 - self.w) / self.w) * (d_vag / d_sto))
        self.w = min(W_MAX, max(W_MIN, self.w))

        # (c) SOLO ORA si impara. Kalman scalare con discount.
        if self.congelato:
            self.n += 1
            self.storia.append({'gara': etichetta, 'y': round(y, 4),
                                'previsto': round(prev, 4), 'errore': round(err, 4),
                                'congelato': True})
            return {'previsto': prev, 'errore': err, 'deriva': False}
        self.P = self.P / self.delta
        Kg = self.P / (self.P + R)
        self.theta = self.theta + Kg * (y - self.theta)
        self.P = (1.0 - Kg) * self.P
        self.n += 1

        # deriva: Page-Hinkley sul residuo standardizzato
        self._ph_m += abs(z) - PH_DELTA
        self._ph_M = min(self._ph_M, self._ph_m)
        deriva = (self._ph_m - self._ph_M) > PH_LAMBDA
        if deriva:
            # non si butta theta: si riapre l'apprendimento
            self.P = max(self.P, self.sigma0 ** 2)
            self.w = W0
            self._ph_m = self._ph_M = 0.0
            self.allarmi.append(etichetta)

        self.storia.append({
            'gara': etichetta, 'y': round(y, 4), 'se': round(se_y, 4),
            'previsto': round(prev, 4), 'errore': round(err, 4), 'z': round(z, 2),
            'theta_dopo': round(self.theta, 4), 'sd_dopo': round(math.sqrt(self.P), 4),
            'w_storico': round(self.w, 3), 'guadagno_kalman': round(Kg, 3),
            'deriva': deriva,
        })
        return {'previsto': prev, 'errore': err, 'deriva': deriva}

    # ---------------------------------------------------------------- targhetta
    def targhetta(self):
        """Tutto quello che serve per fidarsi (o non fidarsi) del numero, in un dict."""
        th, sd = self.prevedi()
        return {
            'nome': self.nome, 'unita': self.unita,
            'valore': round(th, 4), 'sd': round(sd, 4),
            'gare_assorbite': self.n,
            'peso_storico_w': round(self.w, 3),
            'prior_storico': {'valore': round(self.theta0, 4),
                              'sd': round(self.sigma0, 4),
                              'tau2_fra_stagioni': round(self.tau2, 6),
                              **self.diag_prior},
            'perdita_prequenziale': (round(self.perdita_prequenziale(), 4)
                                     if self.perdita_prequenziale() is not None else None),
            'allarmi_deriva': self.allarmi,
            'lettura': self._lettura(),
        }

    def _lettura(self):
        if self.n == 0:
            return 'nessuna gara del regime nuovo: il numero e SOLO il prior storico'
        if self.w > 0.7:
            return f'il regime nuovo CONFERMA lo storico (w={self.w:.2f} su {self.n} gare)'
        if self.w < 0.2:
            return f'il regime nuovo SMENTISCE lo storico (w={self.w:.2f}): sta decidendo il 2026'
        return f'storico e regime nuovo convivono (w={self.w:.2f} su {self.n} gare)'

    def __repr__(self):
        th, sd = self.prevedi()
        return f'<{self.nome} {th:+.3f}±{sd:.3f} {self.unita} n={self.n} w={self.w:.2f}>'


def confronto_prequenziale(candidati, sequenza):
    """Fa correre piu' candidati sulla STESSA sequenza e ne misura la perdita.

    E' l'unico modo onesto di sapere se lo storico aiuta o fa danno: non un indice di
    distanza fra domini (non ne esiste uno affidabile), ma il confronto diretto.
    candidati: {nome: CoefficienteVivo}
    sequenza : [(etichetta, y, se), ...] in ORDINE CRONOLOGICO. L'ordine e' il metodo.
    """
    perdite = {k: [] for k in candidati}
    for etichetta, y, se in sequenza:
        for k, c in candidati.items():
            prev, _ = c.prevedi()
            perdite[k].append(abs(y - prev))
            c.assorbi(y, se, etichetta)
    return {k: {'mae': sum(v) / len(v) if v else None,
                'perdita_recente': candidati[k].perdita_prequenziale(),
                'n': len(v)} for k, v in perdite.items()}
