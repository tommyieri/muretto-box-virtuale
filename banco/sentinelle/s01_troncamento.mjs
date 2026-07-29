// S01 — Invarianza al troncamento (Regola 5, contro E15).
// Ogni misura "al congelamento Lf" deve dare LO STESSO risultato su byLap
// intero e su byLap troncato a Lf: è la definizione operativa di "non sbircia
// il futuro".
//
// FALLIREBBE SE: una misura al congelamento (passo destagionalizzato, età
// gomma, cum) leggesse anche una sola cella oltre Lf — la griglia calcolata
// sul byLap intero divergerebbe da quella calcolata sul byLap troncato.
// FALLIREBBE ANCHE SE la misura diventasse vacua (zero piloti con passo):
// un'uguaglianza fra due griglie vuote non prova niente (contro E09).
import { nuovoBanco, stessi, RADICE } from '../lib/attrezzi.mjs';
import { caricaGaraGrezza, troncaByLap } from '../../provenienza/frontiera.mjs';
import { grigliaAlCongelamento } from '../../engine/misure.mjs';
import { join } from 'node:path';

const b = nuovoBanco('s01_troncamento');

// parametri di prova: targhetta `modello dichiarato, banco` — servono solo a
// destagionalizzare, il loro valore non conta per l'invarianza
const par = { delta: 0.05, rho: 0.0389 };

const byLap = caricaGaraGrezza(join(RADICE, 'data', 'ti_cache', 'Miami.json'));

for (const Lf of [10, 25, 40]) {
  const intera = grigliaAlCongelamento(byLap, Lf, par);
  const tronca = grigliaAlCongelamento(troncaByLap(byLap, Lf), Lf, par);
  b.verifica(stessi(intera, tronca), `Lf=${Lf}: griglia su byLap intero ≠ griglia su byLap troncato`);
  const conPasso = Object.values(intera).filter(v => v && v.base !== null).length;
  b.verifica(conPasso >= 10, `Lf=${Lf}: solo ${conPasso} piloti con passo — misura vacua, l'invarianza non prova niente`);
}

// il troncamento stesso non deve inventare celle: a Lf=40 nessun pilota può
// avere più di 40 celle
const t40 = troncaByLap(byLap, 40);
b.verifica(Object.values(t40).every(celle => celle.length <= 40), 'troncaByLap(40) ha lasciato celle oltre il giro 40');

b.fine();
