// s43_ripartenza — al giro di ripartenza la soglia si abbassa, e SOLO li'.
//
// L'ingresso `tetto.ripartenza` ({giri, deltaSoglia}) viene da
// PREREG_ripartenza_fondo.md: sul fondo asciutto (147 gare) alla ripartenza si
// passa con odds x1,357 (IC95 [1,114; 1,640]) e la conversione dichiarata da'
// delta = 0,154 s/giro. E' un ingresso di LABORATORIO: il costruttore lo monta
// solo con neutralizzazioneVera, la produzione non lo vede mai.
//
// COSA FA FALLIRE QUESTA SENTINELLA:
//  (a) SPENTO NON E' SPENTO: tetto senza `ripartenza` (assente, null, o giri
//      vuoti) non e' bit-identico al tetto di sempre;
//  (b) la soglia NON si abbassa sul giro elencato: una coppia col vantaggio fra
//      (soglia - delta) e soglia resta bloccata anche alla ripartenza;
//  (c) la soglia si abbassa ANCHE su giri non elencati: il delta e' scappato
//      dal suo giro;
//  (d) un `ripartenza` malformato (giri non interi, delta negativo) passa.

import { simulate } from '../../engine/kernel.mjs';

let errori = 0;
const fallisci = (msg) => { errori += 1; console.error(`s43 FALLITA — ${msg}`); };

const LF = 5;
// AAA davanti, BBB dietro a 0,2 s con vantaggio di passo 0,50 s/giro: sotto la
// soglia 0,61 (resta dietro), sopra soglia-delta 0,456 (alla ripartenza passa).
const state = [
  { drv: 'AAA', lap: LF, cum_time: 500.0, tyre_age: 5, mescola: 'MEDIUM' },
  { drv: 'BBB', lap: LF, cum_time: 500.2, tyre_age: 5, mescola: 'MEDIUM' },
];
const pace = (drv) => ({ AAA: 90.5, BBB: 90.0 }[drv]);
const TETTO = { minGap: 0.5, sogliaSorpasso: 0.61, costoDuello: 0.3, costoSubito: 0.3 };
const RIP = { giri: [LF + 2], deltaSoglia: 0.154 };
const corri = (tetto) => simulate({ state, pace, freezeLap: LF, steps: 4, tetto, traccia: true });

// (a) spento e' spento
{
  const base = JSON.stringify(corri({ ...TETTO }));
  if (JSON.stringify(corri({ ...TETTO, ripartenza: null })) !== base) fallisci('ripartenza: null non e\' bit-identico ad assente');
  if (JSON.stringify(corri({ ...TETTO, ripartenza: { giri: [], deltaSoglia: 0.154 } })) !== base) fallisci('giri vuoti non sono bit-identici ad assente');
}

// (b) + (c) il delta agisce sul suo giro e solo su quello
{
  const senza = corri({ ...TETTO });
  const con = corri({ ...TETTO, ripartenza: RIP });
  // senza ripartenza: BBB non passa mai (0,50 < 0,61), resta incollato dietro
  if (senza.ordine[0] !== 'AAA') fallisci('nel braccio senza ripartenza BBB non doveva passare');
  // con ripartenza: al giro LF+2 il vantaggio 0,50 supera 0,456 e BBB passa
  if (con.ordine[0] !== 'BBB') fallisci(`alla ripartenza BBB doveva passare (vantaggio 0,50 > soglia abbassata 0,456): ordine ${con.ordine}`);
  // ...e il sorpasso avviene ESATTAMENTE al giro elencato, non prima
  const cumA = Object.fromEntries(con.traccia.AAA.map((p) => [p.lap, p.cum_time]));
  const cumB = Object.fromEntries(con.traccia.BBB.map((p) => [p.lap, p.cum_time]));
  if (!(cumB[LF + 1] > cumA[LF + 1])) fallisci('BBB e\' passato PRIMA del giro di ripartenza (il delta e\' scappato dal suo giro)');
  if (!(cumB[LF + 2] < cumA[LF + 2])) fallisci('BBB non e\' davanti alla fine del giro di ripartenza');
}

// (d) il malformato esplode
{
  let e1 = false; try { corri({ ...TETTO, ripartenza: { giri: ['sette'], deltaSoglia: 0.1 } }); } catch { e1 = true; }
  if (!e1) fallisci('giri non interi devono far esplodere');
  let e2 = false; try { corri({ ...TETTO, ripartenza: { giri: [LF + 2], deltaSoglia: -0.1 } }); } catch { e2 = true; }
  if (!e2) fallisci('delta negativo deve far esplodere');
}

process.exit(errori === 0 ? 0 : 1);
