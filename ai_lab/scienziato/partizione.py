"""ai_lab/scienziato/partizione.py — LA PARTIZIONE calibrazione/verifica del CANCELLO.

Il punto condiviso che prima non esisteva: i cancelli di accensione di `modello_traffico` e
`modello_degrado` copiavano lo split a mano, e nel laboratorio la stessa riga compare in 14
posti. Da qui in poi il cancello la chiede a questo modulo, e una sola.

Prereg: PREREG_partizione_temporale.md, committato PRIMA di guardare quale modello si accende
sotto la regola nuova.

PERIMETRO: questo modulo serve il CANCELLO DI ACCENSIONE dei modelli vivi. Gli script di
studio (`run_*.py`) NON lo usano e restano su v1: i loro risultati sono gia' a referto sotto
quella regola, e cambiarla sotto i piedi renderebbe irrileggibili i rapporti gia' scritti.
"""
import fondo

# ---------------------------------------------------------------- la versione attiva
VERSIONE_ATTIVA = 'v2_temporale'

# T*: la soglia temporale, CONGELATA. Si calcola UNA volta per regime e poi vive qui, in
# git, cosi' non si muove piu'. E' il cuore della stabilita': se il taglio non si sposta,
# aggiungere una gara non ripartiziona niente.
#
#   2026: T* = 2026-05-24 (data del GP del Canada, 5a gara cronologica del regime).
#         Derivata da K_min = 4 (vedi sotto), congelata il 21/07/2026 su 10 gare.
T_STELLA = {
    '2026': '2026-05-24',
}

# K_min NON e' un numero scelto oggi: e' derivato da vincoli gia' pre-registrati PRIMA di
# questa sessione.
#   - scheletro.bootstrap_a_blocchi (SOTTO SIGILLO) vuole >= 2 blocchi per dare un IC;
#   - l'aggregato di calibrazione e' una mediana cross-gara: sotto 3 blocchi e' degenere;
#   - PREREG_degrado_2026.md §4 (committato prima) pretende >= 4 gare DISTINTE in verifica.
# => K_min = 4 lascia 4 blocchi in calibrazione e 6 in verifica su 10 gare: entrambi i lati
#    soddisfano vincoli scritti prima di oggi.
K_MIN = 4


# ---------------------------------------------------------------- v1 — PENSIONATA
def v1_pari_dispari(gids, date=None, regime=None):
    """LA REGOLA VECCHIA. Non si cancella: si versiona.

    Conservata perche' (a) i risultati nati sotto di lei restino interpretabili — chi rilegge
    un vecchio esito_*.json deve sapere quale regola li ha prodotti — e (b) il confronto
    v1-contro-v2 resti eseguibile da chiunque, invece di essere una mia asserzione.

    PERCHE' E' STATA PENSIONATA (misurato, diagnosi 989d3de):
      Gli indici scalano quando il fondo cambia di una gara, e la partizione SI ROVESCIA.
      Togliendo la prima gara delle dieci del 2026, la sovrapposizione fra il vecchio e il
      nuovo insieme di verifica e' ZERO. Conseguenza sul modello traffico: 5 gare su 10,
      tolte da sole, ribaltano ACCENDIBILE — cioe' il verdetto cambiava per come cadeva il
      taglio, non per evidenza nuova.

    DIFETTO SECONDARIO, emerso implementando v2: `sorted(gids)` ordina per NOME, non per
    data. Il taglio "pari/dispari" del 2026 era quindi alfabetico (Australia, Austria,
    Belgian, ...), arbitrario anche rispetto al tempo.
    """
    g = sorted(gids)
    return g[0::2], g[1::2]


# ---------------------------------------------------------------- v2 — attiva
def v2_temporale(gids, date, regime):
    """Calibrazione = le gare piu' VECCHIE, verifica = le piu' RECENTI, con soglia a DATA.

    cal = {gara : data <  T*}
    ver = {gara : data >= T*}

    Il verso e' quello dell'uso reale: al via di domenica hai il passato e applichi il
    modello alla gara che arriva. La soglia e' una DATA e non un conteggio perche' con un
    conteggio togliere una gara farebbe MIGRARE una gara dalla verifica alla calibrazione;
    con la data congelata il taglio non si sposta, le gare nuove entrano in CODA, e
    l'insieme di verifica di domani e' SOVRAINSIEME di quello di oggi.
    """
    t = T_STELLA.get(regime)
    congelata_ora = False
    if t is None:
        # Regime mai visto: si congela ADESSO e si pretende che finisca in git.
        crono = sorted(gids, key=lambda g: (date.get(g, ''), g))
        if len(crono) <= K_MIN:
            return list(crono), [], None, False
        t = date[crono[K_MIN]]
        congelata_ora = True
    cal = sorted([g for g in gids if date.get(g, '') < t], key=lambda g: (date[g], g))
    ver = sorted([g for g in gids if date.get(g, '') >= t], key=lambda g: (date[g], g))
    return cal, ver, t, congelata_ora


REGISTRO_VERSIONI = {'v1_pari_dispari': v1_pari_dispari, 'v2_temporale': v2_temporale}


# ---------------------------------------------------------------- l'interfaccia del cancello
def date_dal_fondo(righe_per_gara):
    """La data di ogni gara dal FONDO (timestamp del primo giro), mai da un file derivato."""
    return {g: fondo.data_gara(r) for g, r in righe_per_gara.items()}


def taglio(gids, date, regime, versione=None):
    """Ritorna (cal, ver, targhetta). La targhetta viaggia col verdetto: un cancello senza il
    nome della propria partizione non e' confrontabile con un altro."""
    versione = versione or VERSIONE_ATTIVA
    gids = list(gids)
    if versione == 'v1_pari_dispari':
        cal, ver = v1_pari_dispari(gids)
        t, congelata_ora = None, False
    else:
        cal, ver, t, congelata_ora = v2_temporale(gids, date, regime)
    targhetta = {'versione': versione, 'T_stella': t, 'K_min': K_MIN,
                 'n_calibrazione': len(cal), 'n_verifica': len(ver),
                 'gare_calibrazione': list(cal), 'gare_verifica': list(ver),
                 'ordinamento': 'cronologico dal fondo' if versione != 'v1_pari_dispari'
                                else 'alfabetico (difetto della regola pensionata)'}
    if congelata_ora:
        targhetta['ATTENZIONE'] = (f'T* per il regime {regime} calcolata al volo e NON ancora '
                                   f'congelata in git: aggiungila a partizione.T_STELLA, '
                                   f'altrimenti si muovera da sola alla prossima gara')
    return cal, ver, targhetta
