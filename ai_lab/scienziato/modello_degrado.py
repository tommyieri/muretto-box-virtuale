"""ai_lab/scienziato/modello_degrado.py — il modello DEGRADO, per regime.

Implementa il contratto di autocalibra.py: nome, regime, uscita, calibra().
Si aggancia al REGISTRO di gen_modelli_lab.py con UNA RIGA, come il traffico, e da li' in
poi si ricalibra DA SOLO a ogni Gran Premio nuovo, con targhetta, storico e idempotenza.

IL CANCELLO DI ACCENSIONE STA QUI DENTRO (PATTERN_MODELLI_VIVI.md, regola 3). Due condizioni,
dichiarate in PREREG_degrado_2026.md §4 PRIMA dei numeri, misurate SOLO su gare di verifica:

  (A) PREDITTIVA — batte il NON-FARE-NIENTE. Il degrado-zero e' RISTIMATO senza le colonne
      dell'eta (§7-bis): non un fantoccio con le rho spente a mano. L'errore di ricostruzione
      |sim(strategia reale) - reale| dev'essere minore col modello, con IC95 appaiato sui
      blocchi (= gare) che ESCLUDE LO ZERO.
  (B) PRODOTTO — X >= 60 % dei casi valutabili e margine mediano >= 2*tol, con almeno 30 casi
      su almeno 4 gare. Soglie IDENTICHE al prereg madre: non cucite addosso al risultato.

Finche' non le soddisfa entrambe, il file scrive ACCENDIBILE: false e IL MODELLO RESTA SPENTO
DA SOLO, senza che nessuno debba ricordarsene. L'accensione e' un gesto UMANO.

IL REGIME FA PARTE DELL'IDENTITA'. `degrado_2026` e `degrado_2022_25` sono due modelli
diversi, con due file diversi: il 2026 e' una rottura regolamentare e non si eredita niente.
"""
import statistics as st

import degrado as DG
import degrado_metro as MT
import degrado_verde as DV
import fondo
import partizione as PZ
import scheletro


class ModelloDegrado:
    """Un'istanza per regime. Il regime non si mescola mai."""

    def __init__(self, regime, uscita=None):
        self.regime = regime
        self.nome = f'degrado_{regime.replace("-", "_")}'
        self.uscita = uscita or f'data/modello_{self.nome}.json'

    # ---------------------------------------------------------------- fondo
    def raccogli(self):
        """Dal FONDO, solo il proprio regime. Una gara = un blocco."""
        per_gara, dati = {}, {}
        for b in fondo.elenco_blocchi():
            if b['regime'] != self.regime:
                continue
            d = DG.prepara(b)
            if d is None:
                continue                                  # bagnata
            m = DG.stima(d)
            if 'escluso' in m:
                continue
            per_gara[b['id']] = {'rho': m['rho'], 'se_rho': m['se_rho'],
                                 'n_giri': m['n_giri']}
            dati[b['id']] = {'dati': d, 'modello': m, 'motivo': None}
        return per_gara, dati

    # ---------------------------------------------------------------- calibrazione
    def calibra(self, per_gara=None, dati=None):
        if per_gara is None:
            per_gara, dati = self.raccogli()
        gids = sorted(per_gara)
        # I COEFFICIENTI LIVE usano tutte le gare disponibili del regime; il CANCELLO invece
        # gira fuori campione, sul taglio TEMPORALE di partizione.py. Sono due domande
        # diverse: "qual e' la stima migliore che ho" e "me la sono guadagnata".
        rho, dett = MT.rho_viaggiante(dati, gids)

        ordinati = [c for c in ('SOFT', 'MEDIUM', 'HARD') if c in rho]
        ordine = all(rho[ordinati[i]] > rho[ordinati[i + 1]]
                     for i in range(len(ordinati) - 1)) if len(ordinati) > 1 else None
        segni = {}
        for c in ordinati:
            v = [per_gara[g]['rho'][c] for g in gids if c in per_gara[g]['rho']]
            segni[c] = {'n_gare': len(v), 'n_negative': sum(1 for x in v if x < 0),
                        'escursione': round(max(v) - min(v), 4) if v else None}

        ver = self.verifica(per_gara, dati, None)
        return {
            'coefficienti': {f'rho_{c}': round(rho[c], 5) for c in ordinati},
            'intervalli': {f'rho_{c}_ci95_blocchi': dett[c]['ci95'] for c in ordinati
                           if c in dett},
            'forma': {
                'degrado': 'passo(eta) = passo_base + rho_mescola * (eta - eta0)  [s al giro]',
                'incrementale': 'eta0 e l eta a cui il passo base e stato misurato: il '
                                'degrado gia dentro il passo base NON viene ri-contato',
                'aggancio_motore': "demo/engine.mjs, parametro `degrado` "
                                   "{ [pilota]: { rate, age0 } } — assente = bit-identico",
                'contabilita': 'giri verdi: l eta avanza su tutti i giri, il TEMPO si conta '
                               'solo sui verdi (PREREG_degrado_2026.md §0)'},
            'diagnostica': {
                'gare': gids,
                'ordine_SOFT_MEDIUM_HARD_esce_da_solo': ordine,
                'stabilita_segno_fra_gare': segni,
                'rho_per_gara': {c: dett[c]['per_gara'] for c in ordinati if c in dett}},
            'verifica': ver,
            'cancello_accensione': ver['cancello_accensione'],
            'ACCENDIBILE': ver['cancello_accensione']['ACCENDIBILE'],
            'limite_onesto': self.limite_onesto(ver, ordine, segni, len(gids)),
            '_n_gare': len(gids), '_n_blocchi': len(gids),
        }

    # ---------------------------------------------------------------- il cancello
    def verifica(self, per_gara, dati, coef):
        """Fuori campione. Mai la stessa gara nei due ruoli.

        LA PARTIZIONE NON E' SCRITTA QUI: la chiede a `partizione.py`, lo STESSO modulo che
        usa il cancello del traffico, con la STESSA T* (PREREG_partizione_temporale.md).
        Prima era `gids[0::2], gids[1::2]` — pari/dispari su un ordinamento per NOME — e
        bastava una gara in piu' o in meno a rovesciare il taglio.

        T* E' LA STESSA DEL TRAFFICO PERCHE' E' STATO VERIFICATO, NON ASSUNTO: i due modelli
        hanno le stesse identiche 10 gare utili del 2026 (il filtro aria-libera del degrado
        opera DENTRO le gare, non ne elimina nessuna), quindi la 5a gara cronologica e' la
        stessa — Canada, 2026-05-24 — e T* esce dalla stessa derivazione, non da un travaso.
        """
        gids = sorted(per_gara)
        date = PZ.date_dal_fondo({g: dati[g]['dati']['righe'] for g in gids})
        cal, ver, targhetta_partizione = PZ.taglio(gids, date, self.regime)
        out = {'gare_calibrazione': cal, 'gare_verifica': ver,
               'partizione': targhetta_partizione}
        if len(cal) < 2 or len(ver) < 2:
            out['cancello_accensione'] = {
                'ACCENDIBILE': False, 'A_predittivo': None, 'B_prodotto': None,
                'partizione': targhetta_partizione,
                'motivo': f'{len(cal)}/{len(ver)} gare: troppo poche per giudicare',
                'criterio': 'A: batte il degrado-zero ristimato con IC95 appaiato che '
                            'esclude lo zero. B: X>=60% e margine>=2*tol su >=30 casi.'}
            return out

        rho_cal, _ = MT.rho_viaggiante(dati, cal)
        tol, n_scarti = MT.tol_da_cal(dati, cal, rho_cal)
        A = MT.cancello_predittivo(dati, ver, rho_cal)
        X = MT.misura_X(dati, ver, rho_cal, tol, f'cancello {self.nome}')

        abbastanza = X['n_casi'] >= MT.MIN_CASI and X['n_gare'] >= MT.MIN_GARE
        B = bool(abbastanza and X['quota'] and X['quota'] >= MT.QUOTA_NETTA
                 and X['margine_mediano_vittorie']
                 and X['margine_mediano_vittorie'] >= MT.FATTORE_MARGINE * tol)
        out['rho_calibrazione'] = {c: round(v, 5) for c, v in rho_cal.items()}
        out['tol'] = round(tol, 3)
        out['n_scarti_calibrazione'] = n_scarti
        out['A'] = A
        out['X'] = {k: v for k, v in X.items() if k != 'casi'}
        out['cancello_accensione'] = {
            'A_predittivo': {
                'SUPERATO': bool(A.get('SUPERATO')),
                'guadagno_mediano_s': A.get('guadagno_mediano'),
                'ci95': A.get('ci95'),
                'criterio': 'errore di ricostruzione minore del degrado-zero RISTIMATO, '
                            'con IC95 appaiato sui blocchi che esclude lo zero'},
            'B_prodotto': {
                'SUPERATO': B, 'numerosita_sufficiente': abbastanza,
                'n_casi': X['n_casi'], 'n_gare': X['n_gare'],
                'X': X['quota'], 'X_richiesta': MT.QUOTA_NETTA,
                'margine_mediano_s': X['margine_mediano_vittorie'],
                'margine_richiesto_s': round(MT.FATTORE_MARGINE * tol, 3),
                'criterio': f'X >= {MT.QUOTA_NETTA} e margine >= {MT.FATTORE_MARGINE}*tol '
                            f'su >= {MT.MIN_CASI} casi e >= {MT.MIN_GARE} gare'},
            'ACCENDIBILE': bool(A.get('SUPERATO') and B),
            'partizione': targhetta_partizione,
            'regola': 'servono ENTRAMBE. Finche no, il modello resta SPENTO da solo. '
                      'L accensione e un gesto umano: il modello dice solo quando se l e '
                      'guadagnata.'}
        return out

    # ---------------------------------------------------------------- il limite, scritto dentro
    def limite_onesto(self, ver, ordine, segni, n_gare):
        """Che cosa questo modello NON sa fare. Viaggia DENTRO il json, col numero."""
        L = [
            f'REGIME {self.regime} SOLTANTO: nessun coefficiente ereditato da altri regimi. '
            'Il 2026 e una rottura regolamentare (altra macchina, push-to-pass a batteria al '
            'posto del DRS) e il transfer storico->2026 e misurato NULLO.',
            f'{n_gare} GARE SOTTO: gli intervalli sono larghi e sono riportati larghi. '
            'Nessuna cifra decimale va difesa oltre quello che l IC95 sostiene.',
            'CIECO su pioggia (gare escluse) e sui giri neutralizzati (SC/VSC): l eta gomma '
            'avanza ma il tempo non si conta.',
            'IL DEGRADO NON E PER-CIRCUITO: gia falsificato (0 circuiti veri su 8). Questo '
            'modello NON ha, e non deve avere, un coefficiente per pista.',
            'NIENTE CLIFF: il termine non-lineare (soglia+rampa) e stato montato e SCARTATO '
            '— il residuo per fascia di eta gomma e piatto, e il placebo del ginocchio finto '
            'ha ucciso il guadagno. Questo modello NON rappresenta il crollo di fine vita.',
        ]
        if ordine is False:
            L.append('CONTROLLO DI SANITA FALLITO: l ordinamento fisico SOFT>MEDIUM>HARD NON '
                     'esce da solo dai dati. Il numero e riportato com e, non corretto: '
                     'e un sintomo, non un dettaglio.')
        ballerini = [c for c, s in (segni or {}).items() if s.get('n_negative')]
        if ballerini:
            L.append('SEGNO INSTABILE FRA GARE per ' + ', '.join(sorted(ballerini))
                     + ': in alcune gare la pendenza stimata e NEGATIVA (gomme che '
                     'migliorerebbero invecchiando). Dentro la gara la stima e precisa, fra '
                     'le gare balla: ogni gara sta misurando con cura una cosa diversa. '
                     'Finche dura, non esiste una pendenza comune 2026 da far viaggiare.')
        pz = ((ver or {}).get('cancello_accensione') or {}).get('partizione') or {}
        if pz.get('versione'):
            L.append(
                f"PARTIZIONE {pz['versione']} (T* = {pz.get('T_stella')}, "
                f"{pz.get('n_calibrazione')} gare in calibrazione / {pz.get('n_verifica')} in "
                'verifica): lo STESSO modulo e la STESSA soglia del modello traffico — '
                'verificato, non assunto, perche i due modelli hanno le stesse 10 gare utili '
                'del 2026. Fino al 21/07/2026 il cancello usava pari/dispari su un '
                'ordinamento per NOME, che una gara in piu o in meno rovesciava. OGNI '
                'VERDETTO SENZA LA TARGHETTA `partizione` E NATO SOTTO LA REGOLA VECCHIA: '
                'non si confronta con questo.')
        b = (ca_b := ((ver or {}).get('cancello_accensione') or {}).get('B_prodotto')) or {}
        if b and not b.get('numerosita_sufficiente'):
            L.append(
                f"IL CANCELLO (B) NON E GIUDICABILE: {b.get('n_casi')} casi valutabili su "
                f"{b.get('n_gare')} gare, contro i 30 su 4 richiesti. Col taglio temporale la "
                'calibrazione si stringe a 4 gare e i casi che passano il cancello di '
                'calibrazione crollano: il modello non e spento perche ha perso, e spento '
                'perche su (B) non ha ancora abbastanza materiale per giocare. E una '
                'differenza che conta, quando si rileggera questo numero.')
        ca = (ver or {}).get('cancello_accensione', {})
        if not ca.get('ACCENDIBILE'):
            L.append('SPENTO DA SOLO: non ha superato il proprio cancello di accensione. '
                     'NON va agganciato al motore. Si riprovera da solo alla prossima gara.')
        return L
