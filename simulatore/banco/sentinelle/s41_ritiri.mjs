// s41_ritiri — IL RITIRO COME DATO DI LABORATORIO: spento e' spento, acceso ritira.
//
// Il kernel proietta tutti fino alla bandiera — giusto in produzione (il motore
// non fa sparire nessuno) e DISTORSIVO in laboratorio a gara nota: i ritirati
// veri proiettati fino in fondo comprimono i ranghi (record del 07/08: Canada
// con 6 ritirati, cambi del motore 12 contro 7 reali, soggetto -2). L'ingresso
// `ritiri` ({drv: ultimo giro vero}) e' il gemello di `rivaliNonClassificati`:
// informazione dal futuro, lecita solo a gara finita, dichiarata dal costruttore.
//
// COSA FA FALLIRE QUESTA SENTINELLA:
//  (a) SPENTO NON E' SPENTO: senza `ritiri` (assente, null o {}) l'output del
//      kernel non e' bit-identico su tutti e tre i modi di dire "nessun ritiro";
//  (b) il ritirato NON esce: al giro dopo il suo ultimo giro e' ancora in
//      `ordine`, o il suo cum non e' null, o non compare in `ritirati`;
//  (c) la traccia del ritirato non si ferma al suo ultimo giro (o sparisce:
//      la storia parziale E' il dato vero, non un cum a meta');
//  (d) IL FANTASMA TOCCA IL CAMPO: un pilota ritirato al congelamento deve
//      lasciare i rivali con gli STESSI numeri di una simulazione da cui e'
//      assente — se differiscono, il ritirato continua a duellare da morto;
//  (e) un `ritiri` malformato (giro non intero) passa senza errore.

import { simulate } from '../../engine/kernel.mjs';

let errori = 0;
const fallisci = (msg) => { errori += 1; console.error(`s41 FALLITA — ${msg}`); };

const state = [
  { drv: 'AAA', lap: 5, cum_time: 500.0, tyre_age: 5, mescola: 'MEDIUM' },
  { drv: 'BBB', lap: 5, cum_time: 500.4, tyre_age: 5, mescola: 'MEDIUM' },
  { drv: 'CCC', lap: 5, cum_time: 501.2, tyre_age: 5, mescola: 'HARD' },
];
const pace = (drv, giro, eta) => ({ AAA: 90.0, BBB: 89.8, CCC: 90.2 }[drv] + 0.03 * eta);
const TETTO = { minGap: 0.5, sogliaSorpasso: 0.6, costoDuello: 0.3, costoSubito: 0.3 };
const base = { state, pace, freezeLap: 5, steps: 10, tetto: TETTO, traccia: true };

// (a) spento e' spento, nei tre modi di dirlo
{
  const senza = JSON.stringify(simulate({ ...base }));
  const conNull = JSON.stringify(simulate({ ...base, ritiri: null }));
  const conVuoto = JSON.stringify(simulate({ ...base, ritiri: {} }));
  if (senza !== conNull) fallisci('ritiri: null non e\' bit-identico ad assente');
  if (senza !== conVuoto) fallisci('ritiri: {} non e\' bit-identico ad assente');
}

// (b) + (c) il ritirato esce al giro giusto, con la sua storia parziale
{
  const r = simulate({ ...base, ritiri: { BBB: 9 } });
  if (r.ordine.includes('BBB')) fallisci('BBB ritirato al 9 sta ancora in ordine');
  if (r.cum.BBB !== null) fallisci(`il cum del ritirato deve essere null, non ${r.cum.BBB}`);
  const rit = (r.ritirati ?? []).find((x) => x.drv === 'BBB');
  if (!rit) fallisci('BBB non compare in ritirati');
  else {
    if (rit.lap !== 9) fallisci(`ritirato al giro ${rit.lap} invece che 9`);
    if (!Number.isFinite(rit.cum)) fallisci('il ritirato non porta il cum al ritiro');
  }
  const passi = r.traccia?.BBB ?? [];
  const ultimo = passi.length ? passi[passi.length - 1].lap : null;
  if (ultimo !== 9) fallisci(`la traccia di BBB finisce al giro ${ultimo} invece che 9`);
  if (!r.ordine.includes('AAA') || !r.ordine.includes('CCC')) fallisci('gli altri devono restare in ordine');
}

// (d) il fantasma non tocca il campo: ritiro immediato == assenza dallo stato
{
  const conRitiro = simulate({ ...base, ritiri: { BBB: 5 } });
  const senzaLui = simulate({ ...base, state: state.filter((v) => v.drv !== 'BBB') });
  const numeri = (r) => JSON.stringify({ cum: { AAA: r.cum.AAA, CCC: r.cum.CCC }, ordine: r.ordine });
  if (numeri(conRitiro) !== numeri(senzaLui)) {
    fallisci(`un ritirato al congelamento deve lasciare i rivali come se non ci fosse: ${numeri(conRitiro)} vs ${numeri(senzaLui)}`);
  }
}

// (e) il malformato non passa in silenzio
{
  let esplode = false;
  try { simulate({ ...base, ritiri: { BBB: 'nove' } }); } catch { esplode = true; }
  if (!esplode) fallisci('ritiri con giro non intero deve far esplodere, non passare');
}

process.exit(errori === 0 ? 0 : 1);
