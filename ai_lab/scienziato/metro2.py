"""ai_lab/scienziato/metro2.py — il metro a DUE CONDIZIONI.

Sostituisce il metro "identico a se' stesso" (Q di Cochran), difettoso nella forma:
Q chiede IDENTITA', la domanda vera e' POSIZIONE. Q puniva la precisione (SE piccole ->
rifiuto facile) e scartava proprio i circuiti dove sapere-il-circuito aiuta di piu'.

    (i)  SEGNO STABILE   tutte le stagioni dallo stesso lato del globale
    (ii) DISTANZA NETTA  |media pesata - globale| >= soglia

La soglia NON e' fissata a mano: e' derivata dalla nulla per permutazione delle etichette
di circuito, come il valore che porta al 5% il tasso di falsi positivi CONGIUNTO (i)^(ii).
Vedi PREREG_metro2.md §2.

Riferimento sempre "leave-circuit-out": il globale con cui un circuito si confronta non
contiene mai il circuito stesso.
"""
import random
import statistics as st

REPLICHE_NULLA = 10000
SEED = 20260721
FP_CONGIUNTO = 0.05      # tasso di falsi positivi bersaglio del metro intero


def _se(cella):
    lo, hi = cella['valore_ci95']
    return (hi - lo) / 2 / 1.96


def globale_meno(valori_tutti, valori_circuito):
    """Mediana del regime ESCLUSO il circuito in esame."""
    da_togliere = list(valori_circuito)
    resto = list(valori_tutti)
    for v in da_togliere:
        if v in resto:
            resto.remove(v)
    return st.median(resto) if resto else None


def media_pesata(valori, se):
    w = [1 / s ** 2 for s in se]
    return sum(x * y for x, y in zip(w, valori)) / sum(w)


def giudica(valori, se, G, soglia):
    """Applica il metro. Ritorna esito + le due condizioni separate."""
    d = [v - G for v in valori]
    segno_stabile = all(x > 0 for x in d) or all(x < 0 for x in d)
    D = abs(media_pesata(valori, se) - G)
    return {'condizione_i_segno_stabile': segno_stabile,
            'condizione_ii_distanza_netta': D >= soglia,
            'esito': 'PER-CIRCUITO VERO' if (segno_stabile and D >= soglia) else 'NON PASSA',
            'D': round(D, 4), 'soglia': round(soglia, 4),
            'lato': 'sopra' if all(x > 0 for x in d) else
                    ('sotto' if all(x < 0 for x in d) else 'oscilla'),
            'deviazioni': [round(x, 3) for x in d],
            'media_pesata': round(media_pesata(valori, se), 4), 'globale_meno_c': round(G, 4)}


def soglia_da_nulla(celle_per_anno, k, repliche=REPLICHE_NULLA, seed=SEED,
                    fp_bersaglio=FP_CONGIUNTO):
    """Deriva la soglia dai dati.

    celle_per_anno = {anno: [(valore, se), ...]} — le gare disponibili in ciascun anno.
    Si permutano le etichette di circuito dentro ogni anno (valore e SE viaggiano in
    coppia), si formano circuiti-fantoccio con una gara per anno, si calcolano la stessa
    D e la stessa condizione (i). La soglia e' il valore di D per cui la frazione di
    fantocci che passano ENTRAMBE le condizioni vale fp_bersaglio.
    """
    anni = sorted(celle_per_anno)[:k]
    n = min(len(celle_per_anno[a]) for a in anni)
    rng = random.Random(seed)
    tutti = []          # (D, segno_stabile)
    for _ in range(repliche):
        colonne = []
        for a in anni:
            c = list(celle_per_anno[a])
            rng.shuffle(c)
            colonne.append(c[:n])
        piatti = [x for col in colonne for x in col]
        valori_piatti = [v for v, _ in piatti]
        for i in range(n):
            v = [colonne[j][i][0] for j in range(len(anni))]
            s = [colonne[j][i][1] for j in range(len(anni))]
            G = globale_meno(valori_piatti, v)
            if G is None:
                continue
            d = [x - G for x in v]
            tutti.append((abs(media_pesata(v, s) - G),
                          all(x > 0 for x in d) or all(x < 0 for x in d)))
    tutti.sort(key=lambda x: -x[0])
    n_tot = len(tutti)
    bersaglio = int(fp_bersaglio * n_tot)
    passati, soglia = 0, None
    for D, segno in tutti:
        if segno:
            passati += 1
            if passati >= bersaglio:
                soglia = D
                break
    fp_i = sum(1 for _, s in tutti if s) / n_tot
    return {'k': k, 'soglia': round(soglia, 4) if soglia else None,
            'repliche': repliche, 'n_fantocci': n_tot,
            'fp_solo_condizione_i': round(fp_i, 4),
            'fp_congiunto_bersaglio': fp_bersaglio,
            'quantili_D_nulla': {q: round(sorted(x[0] for x in tutti)[int(q * n_tot)], 4)
                                 for q in (0.5, 0.9, 0.95, 0.99)}}
