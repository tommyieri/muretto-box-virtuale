// s12_ottimo_analitico — l'ottimo a una sosta cade a (giri rimasti − età)/2.
//
// È la verifica analitica che CLAUDE.md assegna al banco: con
// t = base + δ·(giro−1) + ρ·età e la sosta che azzera l'età, il tempo totale
// su R giri rimanenti fermandosi dopo k è
//
//     cost + ρ·[ k·a + k(k+1)/2 + (R−k)(R−k+1)/2 ] + P
//
// la cui derivata in k è ρ·(2k + a − R): si annulla in k* = (R − a)/2.
// Né la perdita ai box P, né δ, né la base entrano nell'ottimo: spostano il
// costo, non il punto. Qui non si simula l'algebra — si sweepa k col KERNEL
// VERO e si guarda dove cade il minimo.
//
// COSA FA FALLIRE QUESTA SENTINELLA:
//  (a) l'argmin non è (R−a)/2: se la sosta smettesse di azzerare l'età non
//      esisterebbe più un minimo interno (E01, il gradino perpetuo che
//      produceva "fermati subito" nel 100% dei casi), e se il kernel contasse
//      l'età sbagliata sul giro della sosta il minimo si sposterebbe di uno;
//  (b) l'ottimo dipende dalla perdita ai box o da δ: vorrebbe dire che il
//      kernel mescola i pezzi del modello (E20);
//  (c) su gomma più vecchia dei giri rimasti (a > R) l'ottimo non è "fermarsi
//      subito";
//  (d) il minimo non è stretto (due k a pari merito quando (R−a) è pari):
//      segnalerebbe che il termine quadratico è sparito.

import { banco } from '../asserzioni.mjs';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { simulate } from '../../engine/kernel.mjs';
import { creaPasso } from '../../engine/passo_v2.mjs';

const b = banco('s12');
const radice = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const modello = JSON.parse(readFileSync(path.join(radice, 'data', 'modelli', 'modello_v2.json'), 'utf8'));
const rho = modello.rho.valore;
const delta70 = modello.delta_70.scelto;

b.verifica('il modello ha un δ₇₀ scelto dall\'esperimento', typeof delta70 === 'number');
b.verifica('ρ è positivo: senza degrado non esiste un ottimo', rho > 0);

const LF = 10;
const N_GIRI = 70;

// Sweep di k col kernel vero: k = quanti giri ancora sulla gomma attuale prima
// di fermarsi. Restituisce il k che minimizza il cum a fine orizzonte.
function argminSosta({ R, a, perdita, d70 }) {
  const pace = creaPasso({ delta70: d70, rho, nGiri: N_GIRI, basi: { UNO: 90 } });
  const stato = [{ drv: 'UNO', lap: LF, cum_time: 0, tyre_age: a }];
  const totali = [];
  for (let k = 1; k <= R - 1; k += 1) {
    const r = simulate({
      state: stato, pace, freezeLap: LF, steps: R,
      pits: { UNO: [{ lap: LF + k, perdita }] },
    });
    totali.push({ k, cum: r.cum.UNO });
  }
  const minimo = Math.min(...totali.map((x) => x.cum));
  const migliori = totali.filter((x) => Math.abs(x.cum - minimo) < 1e-9).map((x) => x.k);
  return { migliori, totali };
}

// (a) l'ottimo cade dove dice l'algebra, su casi con (R − a) pari e interno
for (const [R, a] of [[20, 4], [30, 10], [16, 2], [24, 6], [40, 8]]) {
  const atteso = (R - a) / 2;
  const { migliori } = argminSosta({ R, a, perdita: 21.0, d70: delta70 });
  b.uguale(`R=${R} età=${a} → ottimo a (R−età)/2 = ${atteso}`, migliori, [atteso]);
}

// (b) l'ottimo non dipende dalla perdita ai box né da δ
const riferimento = argminSosta({ R: 20, a: 4, perdita: 21.0, d70: delta70 }).migliori;
for (const perdita of [0, 5.5, 18.4, 28.1, 60]) {
  b.uguale(`perdita ${perdita} s: l'ottimo non si sposta`, argminSosta({ R: 20, a: 4, perdita, d70: delta70 }).migliori, riferimento);
}
for (const d70 of [0, 2.2, 3.0, 6.0]) {
  b.uguale(`δ₇₀ ${d70}: l'ottimo non si sposta`, argminSosta({ R: 20, a: 4, perdita: 21.0, d70 }).migliori, riferimento);
}

// (c) gomma più vecchia dei giri rimasti: fermarsi appena possibile
const vecchia = argminSosta({ R: 10, a: 24, perdita: 21.0, d70: delta70 });
b.uguale('età 24 su 10 giri rimasti → (R−età)/2 < 1, l\'ottimo è il primo giro utile', vecchia.migliori, [1]);

// (d) il minimo è stretto e il profilo è convesso attorno all'ottimo
const { totali } = argminSosta({ R: 20, a: 4, perdita: 21.0, d70: delta70 });
const alK = (k) => totali.find((x) => x.k === k).cum;
b.verifica('il minimo è strettamente più basso del vicino a sinistra', alK(8) < alK(7) - 1e-12);
b.verifica('il minimo è strettamente più basso del vicino a destra', alK(8) < alK(9) - 1e-12);

b.chiudi();
