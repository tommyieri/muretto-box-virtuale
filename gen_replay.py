"""gen_replay.py — GENERATORE del replay a POSIZIONI VERE.

Per ogni gara del registro produce demo/data/replay_<gara>.json: dove si trovava
DAVVERO ogni vettura, istante per istante, ricavato dal GPS per-auto di FastF1
(session.pos_data) e proiettato sul nastro di pista_<gara>.json.

PERCHE' ESISTE. Fino a oggi i pallini della pagina-gara erano un REPLAY POSIZIONALE
dei tempi-giro: la frazione di giro era una frazione di TEMPO, con la velocita'
assunta uniforme dentro il giro (dichiarato in testa a demo/pista.mjs). Chi perdeva
tre secondi alla Source non si vedeva: si vedeva solo che a fine giro era piu'
indietro. Qui la frazione e' MISURATA sul GPS, quindi le vetture rallentano in curva,
accelerano in rettilineo, si sgranano in staccata e transitano davvero in corsia box.

COSA NON FA. Non simula e non inventa: se una vettura non ha campioni in un istante
(non e' ancora partita, si e' ritirata, buco nel feed) NON viene emessa alcuna
posizione — l'assenza e' assenza, non l'ultimo valore tenuto (regola 6 del progetto).
E' esattamente il difetto per cui data/archivio/telemetria_proto_data.json e' rimasto
archiviato: li' i buchi erano tappati e un'auto ferma era indistinguibile da un'auto
assente.

OROLOGIO. La griglia e' in SECONDI DI SESSIONE, la stessa unita' del cum_time dei
file gara del sito. Non e' un'assunzione: e' MISURATO da questo generatore a ogni
esecuzione (verifica_orologio) confrontando ogni fine-giro di ogni pilota fra
demo/data/<Gara>.json e FastF1. Sulle prime tre gare provate l'offset e' 0,000 s con
scarto massimo 0,000 s: sono lo stesso orologio. Se un giorno divergessero, il
generatore esce 1 invece di produrre un file disallineato.

GEOMETRIA: IL RIGHELLO E' QUELLO DISEGNATO. La frazione di giro e' una misura d'arco su
un nastro, e demo/pista.mjs traduce quella frazione in un punto usando il nastro di
pista_<gara>.json. Se i due nastri non sono lo STESSO giro di riferimento, la misura e il
disegno parlano di due circuiti diversi. Fino al 13/08/2026 questo file ri-sceglieva il
giro per conto suo (G.scegli_giro) e si limitava a DICHIARARE «stesso giro di
riferimento»: all'Ungheria era falso da una stagione, perche' pista_Ungheria.json veniva
dal 2025 mentre qui si sceglieva un giro 2026. Ora il giro lo detta la targhetta della
pista (G.giro_del_disegno) e la sentinella S7 di test_replay.py lo verifica.
La proiezione avviene sulle coordinate grezze: rotazione, ribaltamento e normalizzazione
del viewBox sono isometrie a meno di scala uniforme, quindi la frazione d'arco non cambia.

FLUIDITA': SI INTERPOLA LUNGO IL NASTRO, NON ATTRAVERSO LA PISTA. Fra due rilevazioni
GPS distinte si avanza in FRAZIONE DI GIRO, non in coordinate x,y. Interpolare le
coordinate tira una corda che taglia la curva, e il piede della perpendicolare su quella
corda rallenta fino a fermarsi: e' il pallino che si bloccava prima dell'ultima curva
dell'Hungaroring, dove fra due posizioni diverse il feed 2026 lascia passare fino a 3,1 s
(153 m). Fra due rilevazioni un'auto da corsa resta sulla pista: quello, e non il piano,
e' il posto giusto in cui interpolare.

PIT LANE. Qui e' MISURATA, non stilizzata. gen_pista_svg.py la costruisce parallela
al nastro con W=22 e frazioni 0,95/0,05 identiche su tutte le piste (costanti del
generatore, non misure). Questo file la ricava dai campioni GPS di chi ai box c'e'
passato davvero, e misura le frazioni di ingresso e uscita di QUELLA pista.

Uso:   python3 gen_replay.py                 # tutte le gare del registro
       python3 gen_replay.py --gara Belgio
       python3 gen_replay.py --gara Belgio --hz 4
Nota:  richiede il python3 utente (fastf1, NON venv). Cache ~/muretto_shared/ff1_cache/.
"""
import argparse, json, logging, math, os, sys

import numpy as np
import fastf1
from scipy.spatial import cKDTree

import gen_pista_svg as G   # riuso: giro_del_disegno, ricampiona_anello, carica_registro

logging.getLogger('fastf1').setLevel(logging.ERROR)
fastf1.Cache.enable_cache(os.path.expanduser('~/muretto_shared/ff1_cache'))

ANNO = 2026
HZ = 2.0                  # campioni al secondo della griglia pubblicata
PASSO_NASTRO_U = 20.0     # infittimento del nastro per la proiezione: 20 decimi = 2 m
SCALA_S = 10000           # quantizzazione: 1/10000 di giro (~0,7 m a Spa)
MAX_OFFSET_S = 0.5        # oltre questo scarto fra i due orologi il generatore si ferma
MAX_BUCO_S = 2.0          # oltre questo buco nel feed non si interpola: si dichiara assente
MAX_SCARTO_GIRO = 0.20    # scarto massimo fra GPS e stima a velocita' uniforme, in giri
MIN_COPERTURA = 0.50      # sotto questa copertura la gara non ha un replay a posizioni vere
# due candidati piu' vicini di cosi' LUNGO IL NASTRO sono lo stesso posto, non due rami:
# il nastro e' campionato a 2 m, quindi i vertici vicini sono consecutivi per costruzione.
# 100 m separa due tratti che si sfiorano davvero (un tornante, un ripiegamento).
SEPARAZIONE_RAMI = 1000.0  # decimi di metro = 100 m
# se fra i due capi di una tenuta l'auto si e' spostata meno di questo, era ferma davvero
# (sosta ai box, bandiera rossa, ritiro) e la tenuta E' il dato: non si scavalca.
FERMO_U = 200.0           # decimi di metro = 20 m
# il nastro ricostruito e quello dichiarato da pista_<gara>.json devono essere lo stesso
# oggetto: il ricampionamento leviga e accorcia di qualche per mille, non di piu'
MAX_SCARTO_NASTRO = 0.02
# fra due rilevazioni distinte si interpola LUNGO IL NASTRO; oltre questo intervallo la
# retta in coordinate-pista e' una supposizione troppo lunga per pubblicarla.
# IL LIMITE VIENE DAL FEED, non dal gusto: all'Ungheria (il piu' rado del 2026) fra due
# rilevazioni distinte passano 0,3 s alla mediana e 9,5 s al p99,9; oltre i 12 s non c'e'
# quasi piu' niente da recuperare (i secondi non coperti passano dal 14,9% a 8 s al 7,04%
# a 12 s, e restano 6,88% a 30 s: quel fondo sono i ritirati, che devono sparire).
# Sopra il limite il pallino non scompare: la pagina ricade sulla ricostruzione dai
# tempi-giro e lo disegna VUOTO — una stima dichiarata, non una posizione misurata.
MAX_PONTE_FIX_S = 12.0
# un'auto in pista sta a pochi metri dalla traiettoria di riferimento: se la MEDIANA di
# tutta la gara e' piu' lontana di cosi', il nastro non e' questo circuito
MAX_SCARTO_LATERALE_M = 40.0
# quanto puo' tornare indietro una posizione senza smettere di essere una posizione. In
# unita' di SCALA_S (1/10000 di giro): 12 unita' sono ~5 m all'Hungaroring, ~8 m a Spa.
# MISURATO: con questa soglia una gara col feed sano (Belgio) paga lo 0,04% dei campioni,
# l'Ungheria l'1,88% — e quell'1,88% e' tutto dentro i giri 7-14, dove il feed di
# posizione sbanda e il cronometraggio lo smentisce fino a mezzo giro.
TOLL_INDIETRO = 12
ASSENTE = -1              # sentinella nel campo `pit`: mai una posizione inventata


# ─────────────────────────────────────────────────────────────── orologio

def fine_giro_sito(gara):
    """{sigla: [(giro, cum_time)]} dai dati gara del sito, ordinati. E' la VERITA' sul
    NUMERO di giro: il GPS dice dove sei nel giro, il cronometraggio dice in quale giro."""
    perc = os.path.join('demo', 'data', f'{gara}.json')
    if not os.path.exists(perc):
        return {}
    d = json.load(open(perc))
    per_pilota = {}
    for L in d['laps']:
        for sig, c in L['cars'].items():
            if c.get('cum_time') is not None:
                per_pilota.setdefault(sig, []).append((L['lap'], c['cum_time']))
    for sig in per_pilota:
        per_pilota[sig].sort()
    return per_pilota


def bordi_giro(sig, tempi, fine_sito):
    """Quanti giri interi ha gia' completato il pilota a ciascun istante, secondo il
    CRONOMETRAGGIO. Ritorna (base, bordi, k); bordi None se il pilota non ha fine-giro."""
    giri = fine_sito.get(sig, [])
    if not giri:
        return np.zeros(len(tempi)), None, None
    bordi = np.array([c for _, c in giri])
    numeri = np.array([ng for ng, _ in giri])
    # giro in corso all'istante t = primo fine-giro non ancora passato
    k = np.clip(np.searchsorted(bordi, tempi, side='right'), 0, len(numeri) - 1)
    return numeri[k] - 1.0, bordi, k


def guardia_cronometraggio(sig, tempi, srot, fine_sito, t_in):
    """IL CRONOMETRAGGIO FA DA GUARDIA AL GPS. Dentro il giro la stima "a velocita'
    uniforme" (quella che il sito usava prima) e' grossolana ma non puo' sbagliare di
    molto: se il GPS la contraddice di piu' di MAX_SCARTO_GIRO non e' un'auto che ha
    rallentato, e' il feed che ha sbandato. All'Ungheria succede fra il giro 6 e il 14,
    con le vetture riportate fino a 44 m fuori dal tracciato. Quei valori diventano
    ASSENTI: non si pubblica una posizione che non e' vera."""
    base, bordi, k = bordi_giro(sig, tempi, fine_sito)
    if bordi is None:
        return srot
    t_fine = bordi[k]
    t_inizio = np.where(k > 0, bordi[np.clip(k - 1, 0, len(bordi) - 1)], t_in)
    durata = np.maximum(t_fine - t_inizio, 1e-6)
    atteso = base + np.clip((tempi - t_inizio) / durata, 0.0, 1.0)
    return np.where(np.abs(srot - atteso) > MAX_SCARTO_GIRO, np.nan, srot)


def srotola(sig, tempi, fr, fine_sito, t_in):
    """SROTOLAMENTO ANCORATO AL CRONOMETRAGGIO: da frazione di giro a (giro-1 + frazione).

    Il numero di giro NON si deduce dai salti della frazione: con GPS rado (Monaco)
    un'auto puo' percorrere piu' di mezzo giro fra due rilevazioni e il conteggio si
    perde. Il giro lo dice il cum_time del sito — gia' verificato essere lo stesso
    orologio — e il GPS dice solo DOVE si e' dentro quel giro. Ogni fonte per cio' su cui
    e' autorevole."""
    base, bordi, k = bordi_giro(sig, tempi, fine_sito)
    srot = base + fr
    if bordi is None:
        return srot
    # JITTER AL TRAGUARDO, e solo quello. Il giro viene dal cronometraggio e non si
    # discute; l'unico disaccordo possibile e' di un giro esatto nei pochi secondi a
    # cavallo della linea, quando le due fonti non girano pagina nello stesso istante.
    # Si corregge LOCALMENTE: nessuna correzione cumulativa, che con GPS rado (Monaco:
    # 36% di copertura) propagherebbe un errore su tutta la gara.
    da_bordo = tempi - bordi[np.clip(k - 1, 0, len(bordi) - 1)]
    al_bordo = bordi[k] - tempi
    vicino = 3.0
    srot = np.where((da_bordo >= 0) & (da_bordo < vicino) & (fr > 0.5), srot - 1.0, srot)
    srot = np.where((al_bordo >= 0) & (al_bordo < vicino) & (fr < 0.5), srot + 1.0, srot)
    return guardia_cronometraggio(sig, tempi, srot, fine_sito, t_in)


def verifica_orologio(gara, session):
    """I cum_time del sito e i SessionTime di FastF1 sono lo stesso orologio?
    Si misura su OGNI fine-giro di OGNI pilota. Fallisce rumorosamente (regola 7)."""
    perc = os.path.join('demo', 'data', f'{gara}.json')
    if not os.path.exists(perc):
        return None, None, 0
    d = json.load(open(perc))
    sito = {}
    for L in d['laps']:
        for sig, c in L['cars'].items():
            if c.get('cum_time') is not None:
                sito[(sig, L['lap'])] = c['cum_time']
    diff = []
    for _, r in session.laps.iterrows():
        if r['Time'] != r['Time']:
            continue
        k = (r['Driver'], int(r['LapNumber']))
        if k in sito:
            diff.append(r['Time'].total_seconds() - sito[k])
    if not diff:
        return None, None, 0
    diff = np.array(diff)
    off = float(np.median(diff))
    scarto = float(np.abs(diff - off).max())
    return off, scarto, len(diff)


# ─────────────────────────────────────────────────────────── nastro e proiezione

def nastro_fine(xy):
    """Il nastro di gen_pista_svg (500 punti, levigato) infittito a ~2 m, in coordinate
    GREZZE. Ritorna (punti, distanza_cumulata, lunghezza)."""
    punti, _ = G.ricampiona_anello(xy, G.N_PUNTI)
    anello = np.vstack([punti, punti[:1]])
    seg = np.hypot(*np.diff(anello, axis=0).T)
    cum = np.concatenate([[0.0], np.cumsum(seg)])
    L = float(cum[-1])
    passi = np.arange(0.0, L, PASSO_NASTRO_U)
    fx = np.interp(passi, cum, anello[:, 0])
    fy = np.interp(passi, cum, anello[:, 1])
    return np.column_stack([fx, fy]), passi, L


def senza_tenute(ts, XY):
    """Toglie le TENUTE del feed: i campioni che ripetono identiche le coordinate del
    precedente.

    PERCHE'. FastF1 non manda sempre una posizione nuova: quando non ne ha una, ripete
    l'ultima. Misurato sul 2026: Belgio e Spagna il 38% dei campioni sono ripetizioni,
    l'UNGHERIA il 76,9%, e li' fra due posizioni DIVERSE passano fino a 2,8 s (p90).
    Ricampionare quel grezzo cosi' com'e' produce un pallino che sta fermo mezzo secondo e
    poi salta: misurato in pagina, il 68,8% dei campioni pubblicati era identico al
    precedente, ed e' esattamente lo scatto che si vede all'ultima curva dell'Hungaroring.

    Fra due rilevazioni distinte l'auto si e' MOSSA: interpolare fra loro non e' inventare —
    e' cio' che gia' si fa fra due campioni qualsiasi, visto che la griglia pubblicata e' a
    2 Hz e il feed a 4. La tenuta, invece, e' un artefatto del trasporto: riprodurla
    vorrebbe dire pubblicare come «ferma» un'auto che stava correndo.

    MA UN'AUTO PUO' ESSERE DAVVERO FERMA (in sosta ai box, sotto bandiera rossa, ritirata a
    bordo pista) e allora le ripetizioni sono il dato, non il rumore. Per questo il ponte e'
    LIMITATO: una tenuta piu' lunga di MAX_PONTE_S conserva i suoi campioni, cosi' l'auto
    resta dov'e'. Si scavalcano solo le tenute brevi, quelle in cui la macchina non puo'
    essersi fermata.
    """
    if len(ts) < 3:
        return ts, XY
    cambia = np.ones(len(ts), dtype=bool)
    cambia[1:] = (np.diff(XY[:, 0]) != 0) | (np.diff(XY[:, 1]) != 0)
    tieni = cambia.copy()
    tieni[0] = tieni[-1] = True
    # UN'AUTO FERMA NON SI RICONOSCE DALLA DURATA DELLA TENUTA, ma dal fatto che non si e'
    # spostata. Il primo tentativo usava un limite di tempo (3 s): all'Ungheria le tenute
    # durano tipicamente 3-5,5 s mentre la macchina sta correndo, quindi quel limite le
    # conservava tutte e il pallino restava fermo cinque secondi per volta — misurato,
    # pianori di 6-11 campioni su tutta la gara. Il criterio giusto guarda i due capi: se la
    # posizione prima e dopo la tenuta e' LA STESSA, l'auto era davvero ferma (box, bandiera
    # rossa, ritiro) e i campioni si conservano; se e' lontana, l'auto si e' mossa e la
    # tenuta e' solo il trasporto che non aveva niente di nuovo da dire.
    bordi = np.flatnonzero(cambia)
    for a, b in zip(bordi[:-1], bordi[1:]):
        if b - a <= 1:
            continue
        spostamento = float(np.hypot(*(XY[b] - XY[a])))
        if spostamento < FERMO_U:
            tieni[a:b] = True        # ferma davvero: la tenuta e' il dato
    return ts[tieni], XY[tieni]


class Proiettore:
    """Punto -> (frazione di giro, scarto laterale). Nearest vertex con KD-tree, poi
    raffinamento sui due segmenti adiacenti: l'errore di discretizzazione sparisce."""

    def __init__(self, punti, passi, L):
        self.P, self.s, self.L = punti, passi, L
        self.tree = cKDTree(punti)
        self.N = len(punti)

    def _raffina(self, xy, i):
        """scarto e frazione proiettando sui due segmenti adiacenti al vertice i"""
        best_s = np.empty(len(xy))
        best_d = np.full(len(xy), np.inf)
        for off in (-1, 0):                       # segmento [i-1,i] e [i,i+1]
            a = (i + off) % self.N
            b = (a + 1) % self.N
            A, B = self.P[a], self.P[b]
            E = B - A
            ll = np.einsum('ij,ij->i', E, E)
            ll[ll == 0] = 1.0
            t = np.clip(np.einsum('ij,ij->i', xy - A, E) / ll, 0.0, 1.0)
            C = A + t[:, None] * E
            d = np.hypot(*(xy - C).T)
            sa = self.s[a] + t * np.sqrt(ll)
            m = d < best_d
            best_d[m], best_s[m] = d[m], sa[m]
        return best_s / self.L, best_d

    def __call__(self, xy):
        _, i = self.tree.query(xy, workers=-1)
        return self._raffina(xy, i)

    def continuo(self, xy, salto_max):
        """Proiezione DISAMBIGUATA DALLA CONTINUITA'.

        Il punto piu' vicino non basta: su un tracciato che si ripiega (Hungaroring, i
        tornanti di Monaco) due tratti diversi passano a pochi metri l'uno dall'altro, e
        il vertice piu' vicino puo' stare sul tratto sbagliato.

        I CANDIDATI DEVONO ESSERE RAMI DIVERSI, e la prima stesura non lo erano. Chiedeva
        al KD-tree i 6 vertici piu' vicini: su un nastro campionato a 2 m sono sei vertici
        CONSECUTIVI dello stesso tratto — misurato all'Ungheria, il 99,9% dei candidati
        cadeva entro 30 m dal primo, mediana 4 m. Non c'era nessuna alternativa fra cui
        scegliere: la disambiguazione era un ornamento, e l'unico suo effetto era buttare
        via il campione quando quell'unico tratto non tornava. All'Ungheria costava 22.773
        posizioni, e in pagina si vedeva: i pallini si fermavano e sparivano all'ultima
        curva. Ora i candidati si raggruppano per distanza LUNGO il nastro e se ne tiene
        uno per gruppo: quelli sono rami veri.

        E NON SCARTA PIU' NIENTE. Scegliere fra rami e giudicare se una posizione e'
        plausibile sono due mestieri diversi: qui si sceglie e basta, restituendo il piu'
        vicino quando nessun ramo e' coerente. A scartare le posizioni implausibili ci
        pensa la guardia del cronometraggio in genera(), che per quello ha lo strumento
        giusto (la stima a velocita' uniforme). Prima facevano il doppio lavoro, e la
        proiezione bocciava anche cio' che la guardia avrebbe promosso."""
        K = min(48, self.N)
        _, idx = self.tree.query(xy, k=K, workers=-1)
        # salto_max puo' essere UNO per tutti (griglia a passo fisso) o UNO PER PUNTO
        # (rilevazioni distinte, che arrivano a distanza di tempo variabile)
        sm = np.broadcast_to(np.asarray(salto_max, dtype=float), (len(xy),))
        s_cand = self.s[idx]                       # distanza d'arco di ogni candidato
        fr0, lat0 = self._raffina(xy, idx[:, 0])   # il piu' vicino in assoluto
        scelta_f = fr0.copy()
        scelta_l = lat0.copy()
        prec = None
        for n_i in range(len(xy)):
            # rami distinti: si scorre in ordine di vicinanza e si tiene un candidato solo
            # per ogni zona del nastro (>= SEPARAZIONE_RAMI dalle gia' prese)
            rami = [0]
            for c in range(1, K):
                d = np.abs(s_cand[n_i, c] - s_cand[n_i, rami])
                d = np.minimum(d, self.L - d)
                if np.all(d >= SEPARAZIONE_RAMI):
                    rami.append(c)
                    if len(rami) >= 4:
                        break
            if prec is None or len(rami) == 1:
                c = 0                              # nessuna ambiguita': il piu' vicino
            else:
                f_r, l_r = self._raffina(np.repeat(xy[n_i:n_i + 1], len(rami), axis=0),
                                         idx[n_i, rami])
                d = np.abs(f_r - prec)
                d = np.minimum(d, 1.0 - d)
                amm = np.flatnonzero(d <= sm[n_i])
                # nessun ramo coerente: si tiene il piu' vicino e si lascia decidere alla
                # guardia. Un campione scartato qui sarebbe un buco che nessuno spiega.
                k_sel = int(amm[np.argmin(l_r[amm])]) if len(amm) else int(np.argmin(l_r))
                scelta_f[n_i], scelta_l[n_i] = f_r[k_sel], l_r[k_sel]
                prec = scelta_f[n_i]
                continue
            scelta_f[n_i], scelta_l[n_i] = fr0[n_i], lat0[n_i]
            prec = scelta_f[n_i]
        return scelta_f, scelta_l


# ─────────────────────────────────────────────────────────────── pit lane

def misura_pitlane(session, pos, t0s, proj, punti_nastro, L):
    """La corsia box RICAVATA dal GPS di chi ci e' passato, non disegnata a tavolino.
    Ritorna (punti_grezzi_ordinati, frazione_ingresso, frazione_uscita, diagnostica)."""
    campioni, soste = [], 0
    for dn, df in pos.items():
        gl = session.laps[session.laps['DriverNumber'] == dn]
        ts = (df['SessionTime'].dt.total_seconds().to_numpy() - t0s)
        XY = np.column_stack([df['X'].to_numpy(float), df['Y'].to_numpy(float)])
        pin = [(x - t0s) for x in gl['PitInTime'].dropna().dt.total_seconds().to_numpy()] \
            if len(gl) else []
        pout = [(x - t0s) for x in gl['PitOutTime'].dropna().dt.total_seconds().to_numpy()] \
            if len(gl) else []
        for a in pin:
            dopo = [o for o in pout if o > a]
            if not dopo:
                continue
            m = (ts >= a - 2.0) & (ts <= dopo[0] + 2.0)
            if m.sum():
                campioni.append(XY[m])
                soste += 1
    if not campioni:
        return None, None, None, {'campioni': 0, 'soste': 0}
    P = np.vstack(campioni)
    fr, lat = proj(P)
    # la corsia e' cio' che sta LONTANO dal nastro; la soglia si sceglie dove la
    # distribuzione si separa, non a occhio: meta' fra la mediana on-track e quella in corsia
    soglia = float(np.clip(np.median(lat[lat > np.percentile(lat, 60)]) * 0.45, 60.0, 220.0))
    fuori = P[lat > soglia]
    if len(fuori) < 100:
        return None, None, None, {'campioni': int(len(fuori)), 'soste': soste,
                                  'motivo': 'campioni in corsia insufficienti'}
    fr_f, _ = proj(fuori)
    # la corsia scavalca il traguardo: si srotola attorno al buco piu' grande
    o = np.sort(fr_f)
    buchi = np.diff(np.concatenate([o, [o[0] + 1.0]]))
    taglio = o[int(np.argmax(buchi))]
    fr_srot = np.where(fr_f > taglio, fr_f - 1.0, fr_f)
    ordine = np.argsort(fr_srot)
    fuori, fr_srot = fuori[ordine], fr_srot[ordine]
    # mediana mobile per una polilinea pulita (il GPS in corsia e' rumoroso e a strati)
    nbin = 60
    bordi = np.linspace(fr_srot.min(), fr_srot.max(), nbin + 1)
    linea = []
    for k in range(nbin):
        m = (fr_srot >= bordi[k]) & (fr_srot <= bordi[k + 1])
        if m.sum() >= 3:
            linea.append(np.median(fuori[m], axis=0))
    if len(linea) < 8:
        return None, None, None, {'campioni': int(len(fuori)), 'soste': soste,
                                  'motivo': 'polilinea corsia troppo corta'}
    fe = float(fr_srot.min() % 1.0)
    fx = float(fr_srot.max() % 1.0)
    # PLAUSIBILITA': una corsia box e' un arco CORTO a cavallo del traguardo. Se lo
    # srotolamento ha sbagliato il taglio (succede col GPS rado) esce un arco lunghissimo
    # o spostato a meta' giro: in quel caso non si pubblica una geometria falsa, si
    # dichiara non misurabile e si resta sulla stilizzata. Regola 6.
    arco = float(fr_srot.max() - fr_srot.min())
    if arco > 0.35 or not (fe > 0.55 or fe < 0.20):
        return None, None, None, {'campioni': int(len(fuori)), 'soste': soste,
                                  'motivo': f'arco implausibile (copre {arco:.2f} di giro, '
                                            f'ingresso {fe:.3f})'}
    diag = {'campioni': int(len(fuori)), 'soste': soste,
            'soglia_laterale_m': round(soglia / 10.0, 1),
            'scarto_mediano_m': round(float(np.median(lat[lat > soglia])) / 10.0, 1),
            'arco_di_giro': round(arco, 4)}
    return np.array(linea), fe, fx, diag


def in_viewbox(punti_grezzi, rot_gradi, rif_punti):
    """Applica ai punti grezzi la STESSA trasformazione di gen_pista_svg (rotazione,
    ribaltamento y, traslazione e scala del viewBox), ricavata dal nastro di riferimento."""
    a = math.radians(rot_gradi)
    R = np.array([[math.cos(a), math.sin(a)], [-math.sin(a), math.cos(a)]])
    rif = rif_punti @ R
    rif[:, 1] = -rif[:, 1]
    mn = rif.min(axis=0)
    scala = 1000.0 / (rif - mn)[:, 0].max()
    out = punti_grezzi @ R
    out[:, 1] = -out[:, 1]
    return (out - mn) * scala


# ─────────────────────────────────────────────────────────────── generazione

def genera(nome, reg, hz=HZ, anno=ANNO):
    ti = reg['ti']
    print(f'== {nome} ({ti}) ==')
    session = fastf1.get_session(anno, ti, 'R')
    session.load(laps=True, telemetry=True, weather=False, messages=True)

    off, scarto, n_coppie = verifica_orologio(nome, session)
    if off is None:
        print('   ATTENZIONE: nessun file gara del sito da cui verificare l\'orologio')
        off, scarto = 0.0, 0.0
    elif abs(off) > MAX_OFFSET_S or scarto > MAX_OFFSET_S:
        print(f'   ERRORE: i due orologi divergono (offset {off:+.3f} s, scarto max '
              f'{scarto:.3f} s su {n_coppie} fine-giro). Non produco un file disallineato.')
        return False
    else:
        print(f'   orologio verificato su {n_coppie} fine-giro: offset {off:+.3f} s, '
              f'scarto max {scarto:.3f} s')

    fine_sito = fine_giro_sito(nome)
    # IL NASTRO E' QUELLO CHE LA PAGINA DISEGNA, non uno ri-scelto qui. Vedi
    # gen_pista_svg.giro_del_disegno: misurare su un righello e disegnare su un altro
    # sposta ogni pallino, e all'Ungheria lo fermava del tutto.
    lap, xy, targhetta = G.giro_del_disegno(nome, session=session, anno=anno)
    if lap is None:
        print(f'   ERRORE: demo/data/pista_{nome}.json non dichiara un giro di riferimento '
              f'recuperabile. Il replay misura su quel nastro: senza, non si pubblica.')
        return False
    punti_n, passi, L = nastro_fine(xy)
    atteso_m = targhetta.get('lunghezza_m')
    if atteso_m and abs(L / 10.0 - atteso_m) / atteso_m > MAX_SCARTO_NASTRO:
        print(f'   ERRORE: il nastro ricostruito misura {L / 10.0:.0f} m, pista_{nome}.json '
              f'ne dichiara {atteso_m:.0f}. Non sono la stessa geometria: non misuro '
              f'frazioni su un righello che non e\' quello disegnato.')
        return False
    print(f'   nastro del disegno: {targhetta.get("evento")} {targhetta.get("pilota")} '
          f'giro {targhetta.get("giro")}, {L / 10.0:.0f} m ({targhetta.get("controlli")})')
    proj = Proiettore(punti_n, passi, L)
    pos = session.pos_data

    # finestra di GARA: dal primo giro alla bandiera. Fuori da qui le vetture sono in
    # garage o in parco chiuso, e i loro campioni non sono un replay.
    t_in = float(session.laps['LapStartTime'].min().total_seconds())
    t_fin = float(session.laps['Time'].max().total_seconds())
    griglia = np.arange(t_in, t_fin, 1.0 / hz)
    n = len(griglia)
    # quanto puo' avanzare un'auto fra due campioni della griglia: 2,5 volte il passo del
    # giro di riferimento (che e' il piu' VELOCE della gara) — oltre non e' un'auto, e'
    # la proiezione che ha sbagliato tratto
    lap_s = float(lap['LapTime'].total_seconds())
    salto_max = 2.5 * (1.0 / hz) / lap_s

    num2sig = {}
    for _, r in session.laps.iterrows():
        num2sig[str(r['DriverNumber'])] = str(r['Driver'])

    piloti, saltati = {}, []
    clampati = clamp_tot = scartati_indietro = 0   # contabilita' della monotonia
    for dn, df in pos.items():
        sig = num2sig.get(str(dn))
        if sig is None:                     # nel GPS ma non nei giri: nessuna gara da mostrare
            saltati.append(str(dn))
            continue
        gl = session.laps[session.laps['DriverNumber'] == dn]
        ts_grezzo = df['SessionTime'].dt.total_seconds().to_numpy()
        XY_grezzo = np.column_stack([df['X'].to_numpy(float), df['Y'].to_numpy(float)])
        # DUE COSE DIVERSE, e prima le confondevo. Un BUCO e' l'assenza di campioni (a
        # Monaco fino a 3.011 s: il feed tace); una TENUTA e' la presenza di campioni che
        # ripetono le stesse coordinate (all'Ungheria il 76,9%: il feed parla ma non sa).
        # Il buco si rileva sul grezzo e non si scavalca mai; la tenuta si scavalca, perche'
        # fra due rilevazioni distinte l'auto si e' mossa davvero.
        ts, XY = senza_tenute(ts_grezzo, XY_grezzo)
        # presenza: dal via all'ULTIMO giro davvero completato (il ritirato sparisce,
        # non resta congelato in pista). Regola 6.
        t_ultimo = float(gl['Time'].max().total_seconds()) if gl['Time'].notna().any() else t_fin
        t_primo = max(t_in, float(ts[0]))
        m = (griglia >= t_primo) & (griglia <= min(t_ultimo, t_fin))
        if not m.any():
            saltati.append(sig)
            continue
        idx = np.flatnonzero(m)
        da, a = int(idx[0]), int(idx[-1])
        g = griglia[da:a + 1]

        # SI INTERPOLA LUNGO IL NASTRO, NON ATTRAVERSO LA PISTA.
        #
        # Prima si interpolavano le COORDINATE fra due rilevazioni e si proiettava il
        # risultato. Con un feed fitto e' innocuo; con un feed rado e' un disastro, e
        # all'Ungheria 2026 il feed e' rado: fra due posizioni DIVERSE passano 1,15 s in
        # media e 3,14 s al p90, cioe' fino a 153 m. La retta fra due punti a 153 m di
        # distanza in una curva NON passa per la curva: taglia la corda, cade dentro il
        # tracciato, e il piede della perpendicolare sul nastro prima rallenta, poi si
        # ferma, poi risale di scatto. E' esattamente il pallino che si blocca prima
        # dell'ultima curva e riparte — segnalato dal PO, e per due volte curato dalla
        # parte sbagliata.
        #
        # Fra due rilevazioni un'auto da corsa non taglia i prati: resta sulla pista. Il
        # posto giusto in cui interpolare non e' il piano, e' la PISTA — la frazione di
        # giro. Si proietta ogni rilevazione DISTINTA, e fra due rilevazioni si avanza
        # lungo il nastro. Quel che resta e' un'approssimazione dichiarata (velocita'
        # uniforme per un secondo, non piu' per un giro intero: era la vecchia
        # ricostruzione dai tempi-giro, applicata su 1,15 s invece che su 82) e non
        # inventa una traiettoria che nessuno ha percorso.
        mf = (ts >= g[0] - MAX_PONTE_FIX_S) & (ts <= g[-1] + MAX_PONTE_FIX_S)
        tf, XF = ts[mf], XY[mf]
        if len(tf) < 10:
            saltati.append(sig)
            continue
        # quanto puo' avanzare l'auto fra due rilevazioni dipende da quanto distano NEL
        # TEMPO: con un passo variabile il limite non puo' essere una costante
        dt_fix = np.diff(tf, prepend=tf[0] - 1.0 / hz)
        salto = np.clip(2.5 * dt_fix / lap_s, salto_max, 0.35)
        fr_fix, lat_fix = proj.continuo(XF, salto)
        srot_fix = srotola(sig, tf, fr_fix, fine_sito, t_in)
        ok_fix = np.isfinite(srot_fix)
        if ok_fix.sum() < 10:
            saltati.append(sig)
            continue
        tfb, sfb, latb = tf[ok_fix], srot_fix[ok_fix], lat_fix[ok_fix]
        srot = np.interp(g, tfb, sfb, left=np.nan, right=np.nan)
        lat = np.interp(g, tfb, latb, left=np.nan, right=np.nan)
        # NON SI SCAVALCA UN BUCO. Il passo tipico del feed e' 240 ms; oltre MAX_BUCO_S
        # non c'e' piu' un dato fra cui interpolare — a Monaco ci sono 22 buchi oltre
        # 30 s, uno da 3.011 s (la bandiera rossa). Li' il pilota e' ASSENTE e il pallino
        # sparisce (regola 6). Il buco si misura sul GREZZO: una tenuta non e' un buco,
        # il feed sta parlando, semplicemente non sa niente di nuovo.
        if len(ts_grezzo) > 1:
            j = np.searchsorted(ts_grezzo, g, side='right')
            buco = (ts_grezzo[np.clip(j, 0, len(ts_grezzo) - 1)]
                    - ts_grezzo[np.clip(j - 1, 0, len(ts_grezzo) - 1)])
            srot = np.where(buco > MAX_BUCO_S, np.nan, srot)
        # e non si tira un ponte troppo lungo nemmeno fra due rilevazioni DISTINTE: la
        # retta lungo il nastro e' piu' onesta di quella nel piano, ma resta una retta.
        jf = np.searchsorted(tfb, g, side='right')
        campata = (tfb[np.clip(jf, 0, len(tfb) - 1)] - tfb[np.clip(jf - 1, 0, len(tfb) - 1)])
        srot = np.where(campata > MAX_PONTE_FIX_S, np.nan, srot)
        # la guardia del cronometraggio vale anche su cio' che il ponte ha prodotto
        srot = guardia_cronometraggio(sig, g, srot, fine_sito, t_in)
        s_q = np.where(np.isfinite(srot), np.round(srot * SCALA_S), ASSENTE).astype(np.int64)
        vis = s_q != ASSENTE
        if vis.any():
            v = s_q[vis]
            w = np.maximum.accumulate(v)             # un'auto non torna indietro
            # LA MONOTONIA NON RIPARA: ACCUSA. Tenere il massimo raggiunto trasforma un
            # dato che torna indietro in un pallino FERMO, e un pallino fermo mentre
            # l'auto corre e' una bugia con l'aria di un dato. All'Ungheria, nei giri in
            # cui il feed di posizione sbanda, questo produceva pianori fino a 27 s.
            # Qualche metro all'indietro e' rumore di proiezione e si appiattisce; di
            # piu' non e' un'auto che indietreggia, e' una posizione che non e' vera:
            # diventa ASSENTE, e la pagina ricade sul pallino VUOTO ricostruito dai
            # tempi-giro, che almeno continua a scorrere ed e' dichiarato per quel che e'.
            arretra = (w - v) > TOLL_INDIETRO
            clampati += int(((w != v) & ~arretra).sum())
            scartati_indietro += int(arretra.sum())
            clamp_tot += len(v)
            s_q[vis] = np.where(arretra, ASSENTE, w)
        piloti[sig] = {'da': da, 's': s_q, 'lat': lat, 'fine': min(t_ultimo, t_fin)}

    if not piloti:
        print('   NIENTE: nessun pilota con GPS utilizzabile')
        return False

    # IL NASTRO E' DAVVERO QUESTO CIRCUITO? Se il giro di riferimento viene da un'altra
    # stagione (all'Ungheria viene dal 2025) le coordinate FastF1 potrebbero non essere
    # piu' le stesse. Non si assume: si misura quanto stanno lontane dal nastro le
    # posizioni vere di questa gara. Un'auto in pista sta a pochi metri dalla traiettoria.
    lat_tutti = np.concatenate([v['lat'][np.isfinite(v['lat'])] for v in piloti.values()])
    lat_med = float(np.median(lat_tutti)) / 10.0
    if lat_med > MAX_SCARTO_LATERALE_M:
        print(f'   ERRORE: le vetture di questa gara stanno mediamente a {lat_med:.0f} m dal '
              f'nastro disegnato. Non e\' lo stesso sistema di coordinate: non pubblico '
              f'frazioni misurate su una geometria che non e\' questa pista.')
        return False
    quota_clamp = clampati / max(clamp_tot, 1)
    quota_indietro = scartati_indietro / max(clamp_tot, 1)
    print(f'   scarto laterale mediano dal nastro: {lat_med:.1f} m · monotonia: '
          f'{quota_clamp:.2%} appiattiti (rumore), {quota_indietro:.2%} scartati '
          f'(tornavano indietro di piu\' di {TOLL_INDIETRO / SCALA_S * L / 10.0:.0f} m)')

    # ── pit lane misurata
    pl, fe, fx, diagpl = misura_pitlane(session, pos, 0.0, proj, punti_n, L)
    rot = 0.0
    try:
        rot = float(session.get_circuit_info().rotation)
    except Exception:
        pass
    rif, _ = G.ricampiona_anello(xy, G.N_PUNTI)
    pitlane = None
    if pl is not None:
        pv = in_viewbox(pl.copy(), rot, rif.copy())
        seg = np.hypot(*np.diff(pv, axis=0).T)
        dist = np.concatenate([[0.0], np.cumsum(seg)]) / max(seg.sum(), 1e-9)
        pitlane = {
            'nota': ('MISURATA dal GPS di chi e\' passato ai box in questa gara '
                     '(non stilizzata): polilinea mediana dei campioni in corsia.'),
            'punti': [[round(float(a), 1), round(float(b), 1)] for a, b in pv],
            'dist': [round(float(v), 6) for v in dist],
            'frazione_ingresso': round(fe, 4),
            'frazione_uscita': round(fx, 4),
            **diagpl,
        }
        print(f'   pit lane misurata: {diagpl["campioni"]} campioni da {diagpl["soste"]} soste, '
              f'ingresso {fe:.3f} uscita {fx:.3f} (stilizzata: 0,950 / 0,050)')
    else:
        print(f'   pit lane NON misurabile ({diagpl.get("motivo", "?")}): resta quella di pista_*.json')

    # ── uscita: delta-encoding per pilota, assenza esplicita
    out_piloti = {}
    tot_campioni = 0
    for sig, v in piloti.items():
        s = v['s']
        lat = v['lat']
        prec, delta = 0, []
        for x in s:
            if x == ASSENTE:
                delta.append(ASSENTE)
            else:
                delta.append(int(x - prec))
                prec = int(x)
        # in corsia box: scarto laterale oltre la soglia della corsia misurata
        soglia = diagpl.get('soglia_laterale_m', 12.0) * 10.0 if pitlane else 120.0
        inpit = np.isfinite(lat) & (lat > soglia)
        tratti, k = [], 0
        while k < len(inpit):
            if inpit[k]:
                j = k
                while j + 1 < len(inpit) and inpit[j + 1]:
                    j += 1
                if j - k >= 2:
                    tratti.append([int(k), int(j)])
                k = j + 1
            else:
                k += 1
        out_piloti[sig] = {'da': int(v['da']), 's': delta}
        if tratti:
            out_piloti[sig]['pit'] = tratti
        tot_campioni += int((s != ASSENTE).sum())

    # COPERTURA: quante delle posizioni che servirebbero esistono davvero. Sotto la
    # soglia non si pubblica un replay a posizioni vere — una gara mostrata per meta',
    # o che si ferma al giro 45 di 78, non e' un replay: e' un'altra cosa che gli
    # somiglia. La pagina resta sulla ricostruzione dai tempi-giro, dichiarata.
    attese = sum(min(int(round((piloti[s]['fine'] - t_in) * hz)) + 1, n) for s in out_piloti)
    copertura = tot_campioni / max(attese, 1)
    if copertura < MIN_COPERTURA:
        print(f'   DECLINATO: copertura GPS {copertura:.1%} sotto il minimo {MIN_COPERTURA:.0%} '
              f'({tot_campioni} posizioni su {attese} attese) — nessun replay a posizioni '
              f'vere per questa gara, resta la ricostruzione dai tempi-giro')
        return None                # scelta consapevole, non un errore: la CI non deve arrossire

    out = {
        '_nota': ('GENERATO da gen_replay.py (FastF1 pos_data). POSIZIONI VERE: la frazione '
                  'di giro e\' misurata sul GPS, non dedotta dal tempo sul giro. `s` e\' '
                  '(giro-1 + frazione) x 10000, codificato a differenze; -1 = ASSENTE '
                  '(l\'assenza non si tappa, regola 6). Non modificare a mano.'),
        'gara': nome,
        'hz': hz,
        't0': round(float(griglia[0]), 3),
        'n': n,
        'assente': ASSENTE,
        'scala_s': SCALA_S,
        'piloti': out_piloti,
        **({'pitlane': pitlane} if pitlane else {}),
        'sorgente': {
            'evento': f'{anno} {ti}', 'sessione': 'R',
            # LA TARGHETTA DEL RIGHELLO. Prima diceva «stesso giro di riferimento» e lo
            # dava per scontato; all'Ungheria era falso da una stagione. Ora e' letta da
            # pista_<gara>.json, quindi non puo' piu' divergere da cio' che si disegna.
            'nastro': (f'pista_{nome}.json — {targhetta.get("evento")} '
                       f'{targhetta.get("pilota")} giro {targhetta.get("giro")}, '
                       f'{L / 10.0:.0f} m'
                       + ('' if str(targhetta.get('evento', '')).startswith(str(anno))
                          else ' (ALTRA STAGIONE: il feed di questa gara non ha un giro '
                               'con GPS utilizzabile per la geometria)')),
            # in chiaro, per la sentinella S7: non si controlla una frase, si controlla
            # che il righello sia lo stesso oggetto della targhetta di pista_<gara>.json
            'nastro_giro': {'evento': targhetta.get('evento'),
                            'pilota': targhetta.get('pilota'),
                            'giro': targhetta.get('giro')},
            'scarto_laterale_mediano_m': round(lat_med, 1),
            'monotonia_appiattiti_pct': round(100 * quota_clamp, 2),
            'monotonia_scartati_pct': round(100 * quota_indietro, 2),
            'interpolazione': ('lungo il NASTRO fra due rilevazioni GPS distinte '
                               '(velocita\' uniforme fra un rilevamento e il successivo, '
                               'non dentro il giro); mai attraverso un buco > '
                               f'{MAX_BUCO_S:.0f} s ne\' una campata > {MAX_PONTE_FIX_S:.0f} s'),
            'orologio': (f'cum_time del sito verificato contro SessionTime FastF1 su '
                         f'{n_coppie} fine-giro: offset {off:+.3f} s, scarto max {scarto:.3f} s'),
            'finestra_gara_s': [round(t_in, 1), round(t_fin, 1)],
            'campioni_per_pilota_mediano': int(np.median(
                [sum(1 for x in p['s'] if x != ASSENTE) for p in out_piloti.values()])),
            'piloti_saltati': saltati,
            'fastf1': fastf1.__version__,
        },
    }
    dest = os.path.join('demo', 'data', f'replay_{nome}.json')
    with open(dest, 'w') as f:
        json.dump(out, f, ensure_ascii=False, separators=(',', ':'))
        f.write('\n')
    kb = os.path.getsize(dest) / 1024
    print(f'   scritto {dest}: {len(out_piloti)} piloti, {n} istanti a {hz} Hz, '
          f'{tot_campioni} posizioni, {kb:.0f} KB'
          + (f', saltati {saltati}' if saltati else ''))
    return True


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--gara', help='solo questa gara (nome demo); default: tutte')
    ap.add_argument('--hz', type=float, default=HZ, help=f'campioni al secondo (default {HZ})')
    ap.add_argument('--anno', type=int, default=ANNO)
    args = ap.parse_args()
    registro = G.carica_registro()
    nomi = [args.gara] if args.gara else list(registro)
    if args.gara and args.gara not in registro:
        sys.exit(f'gara sconosciuta: {args.gara} (registro: {", ".join(registro)})')
    esiti = {}
    for nome in nomi:
        try:
            esiti[nome] = genera(nome, registro[nome], hz=args.hz, anno=args.anno)
        except Exception as e:
            import traceback
            print(f'   ERRORE {nome}: {e}')
            traceback.print_exc()
            esiti[nome] = False
    eti = {True: 'OK', None: 'declinata (copertura)', False: 'ERRORE'}
    print('\nRIEPILOGO:', ', '.join(f'{n}={eti[v]}' for n, v in esiti.items()))
    # esce 1 solo sugli ERRORI: una gara declinata per copertura e' una risposta, non un guasto
    if any(v is False for v in esiti.values()):
        sys.exit(1)


if __name__ == '__main__':
    main()
