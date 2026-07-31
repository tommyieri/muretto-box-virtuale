// s10_kernel_guardie — il kernel rifiuta ciò che non sa simulare (regola 6, E14).
//
// Un kernel che accetta tutto produce sempre un numero, e un numero prodotto
// da un ingresso incoerente è indistinguibile da un numero vero: è la forma
// generale di E06. Qui si pretende il fallimento RUMOROSO su tutto ciò che è
// ambiguo, e il null esplicito su tutto ciò che è semplicemente assente.
//
// COSA FA FALLIRE QUESTA SENTINELLA:
//  (a) il kernel accetta uno stato che viene DAL FUTURO (una voce a lap >
//      freezeLap): è E14 dentro il motore, e nessuna sentinella a valle
//      potrebbe più distinguerlo;
//  (b) accetta una sosta fuori dall'orizzonte, senza perdita dichiarata, o per
//      un pilota che non è nello stato: una sosta che non succede è un no-op
//      silenzioso, ed è così che sono nati i doppi conteggi di E20;
//  (c) accetta un `pace` che restituisce spazzatura (NaN, Infinity, stringhe)
//      invece di fallire: NaN si propaga in silenzio fino in pagina;
//  (d) accetta parametri d'orizzonte assurdi (steps 0 o negativi, freezeLap
//      non intero);
//  (e) NON esclude con motivo esplicito un pilota il cui stato è più vecchio
//      del congelamento, o che non ha età gomma (regola 6).

import { banco } from '../asserzioni.mjs';
import { simulate } from '../../engine/kernel.mjs';

const b = banco('s10');

const statoBase = [
  { drv: 'ALB', lap: 20, cum_time: 1800.0, tyre_age: 5 },
  { drv: 'BOR', lap: 20, cum_time: 1805.5, tyre_age: 2 },
];
const passoFisso = () => 95.0;
const corri = (patch = {}) => simulate({
  state: statoBase, pace: passoFisso, freezeLap: 20, steps: 3, pits: {}, ...patch,
});

b.verifica('il caso di riferimento gira', typeof corri().cum.ALB === 'number');

// (a) niente stato dal futuro
b.esplode('una voce di stato a lap > freezeLap è rifiutata (E14)', () => corri({
  state: [{ drv: 'ALB', lap: 21, cum_time: 1800.0, tyre_age: 5 }],
}));
b.esplode('stato senza campo lap: rifiutato', () => corri({
  state: [{ drv: 'ALB', cum_time: 1800.0, tyre_age: 5 }],
}));
b.esplode('due voci per lo stesso pilota: rifiutate', () => corri({
  state: [statoBase[0], { ...statoBase[0] }],
}));

// (b) le soste
b.esplode('sosta oltre l\'orizzonte: rifiutata', () => corri({ pits: { ALB: [{ lap: 99, perdita: 21.0 }] } }));
b.esplode('sosta nel passato (≤ freezeLap): rifiutata', () => corri({ pits: { ALB: [{ lap: 20, perdita: 21.0 }] } }));
b.esplode('sosta senza perdita dichiarata: rifiutata (E07)', () => corri({ pits: { ALB: [{ lap: 22 }] } }));
b.esplode('sosta con perdita null: rifiutata', () => corri({ pits: { ALB: [{ lap: 22, perdita: null }] } }));
b.esplode('sosta con perdita negativa: rifiutata', () => corri({ pits: { ALB: [{ lap: 22, perdita: -3 }] } }));
b.esplode('sosta per un pilota fuori dallo stato: rifiutata', () => corri({ pits: { XXX: [{ lap: 22, perdita: 21.0 }] } }));
b.esplode('due soste sullo stesso giro: rifiutate', () => corri({
  pits: { ALB: [{ lap: 22, perdita: 21.0 }, { lap: 22, perdita: 21.0 }] },
}));

// (c) il passo deve essere un numero o null, mai spazzatura
for (const spazzatura of [NaN, Infinity, '95.0', {}]) {
  b.esplode(`pace che restituisce ${JSON.stringify(String(spazzatura))}: rifiutato`, () => corri({ pace: () => spazzatura }));
}
b.esplode('pace che non è una funzione: rifiutato', () => corri({ pace: 95.0 }));

// (d) orizzonte
b.esplode('steps = 0: rifiutato', () => corri({ steps: 0 }));
b.esplode('steps negativo: rifiutato', () => corri({ steps: -2 }));
b.esplode('steps non intero: rifiutato', () => corri({ steps: 2.5 }));
b.esplode('freezeLap non intero: rifiutato', () => corri({ freezeLap: 20.5 }));
b.esplode('freezeLap negativo: rifiutato', () => corri({ freezeLap: -1 }));

// (e) l'assenza esce con motivo, non con un numero
const vecchio = corri({
  state: [statoBase[0], { drv: 'HUL', lap: 18, cum_time: 1700.0, tyre_age: 4 }],
});
b.uguale('stato più vecchio del congelamento → cum null', vecchio.cum.HUL, null);
b.verifica('...e non entra nell\'ordine', !vecchio.ordine.includes('HUL'));
b.verifica('...e porta il motivo', vecchio.esclusi.some((e) => e.drv === 'HUL' && /congelamento/.test(e.motivo)));

const senzaEta = corri({
  state: [statoBase[0], { drv: 'HUL', lap: 20, cum_time: 1700.0, tyre_age: null }],
});
b.uguale('età gomma assente → cum null', senzaEta.cum.HUL, null);
b.verifica('...con motivo esplicito', senzaEta.esclusi.some((e) => e.drv === 'HUL' && /età|eta/i.test(e.motivo)));

// il pilota escluso non contamina gli altri
b.verifica('gli altri piloti restano numerici', typeof senzaEta.cum.ALB === 'number');

b.chiudi();
