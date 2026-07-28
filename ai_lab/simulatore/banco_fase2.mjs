// banco_fase2.mjs — FASE 2: l'eta' gomma al posto del gradino.
//
//     node ai_lab/simulatore/banco_fase2.mjs
//     node ai_lab/simulatore/banco_fase2.mjs --json ai_lab/simulatore/esito_banco_fase2.json
//
// TRE MOTORI, la stessa domanda, gli stessi 337 casi del banco di Fase 0:
//
//   A  OGGI      passo piatto + `gradino` costante dopo la sosta
//   B  FASE 1    passo con la deriva misurata + `gradino` costante
//   C  FASE 2    passo con la deriva + ETA' GOMMA; la sosta AZZERA l'eta, niente gradino
//
// Il cancello e' G0 (PREREG_fase0.md §8): quota di casi in cui il minimo della curva
// costo/giro-di-sosta e' INTERNO. Soglia >= 80 %. Oggi: 0,0 %.
//
// PERCHE' C PUO' AVERE UN MINIMO E A NO. In A la sosta regala uno sconto COSTANTE per sempre:
// anticiparla e' sempre meglio, la derivata non cambia mai segno. In C la sosta AZZERA l'eta:
// anticipare accorcia il primo stint e allunga il secondo, e la somma delle eta' vissute ha
// un minimo in mezzo. Non e' una taratura: e' un cambio di forma.
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { passiBase, simulaSimmetrico } from '../../demo/passo.mjs';
import { simulaConSoste, misura } from '../../demo/gradino.mjs';
import { stessoGiroReale } from '../../demo/pitscenario.mjs';

const QUI = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(QUI, '..', '..');
const D = path.join(ROOT, 'demo', 'data');
const j = p => JSON.parse(fs.readFileSync(p, 'utf8'));

const ZONE = 0;
const MIN_SOSTE = 3;
const ESCLUSE = new Set(['Monaco']);
const PIATTA = 1e-3;

const RHO = j(path.join(QUI, 'esito_degrado.json')).pooled_comune.rho_comune;
const PHI = j(path.join(QUI, 'esito_deriva.json')).mediane['2026'];
const PITLOSS = j(path.join(D, 'pitloss.json'));

function caricaGara(gara) {
  const race = j(path.join(D, `${gara}.json`));
  race.byLap = {};
  for (const lp of race.laps) race.byLap[lp.lap] = lp.cars;
  race.nonParten = new Set(race.nonParten || []);
  race.gara = gara;
  return race;
}

function curve(race, drv, L) {
  const byLap = race.byLap, nL = race.n_laps;
  const pace = race.pace[String(L)];
  if (!pace) return null;
  const cars = byLap[L] || {};
  const present = Object.keys(cars).filter(d =>
    typeof cars[d].cum_time === 'number' && !race.nonParten.has(d) && pace[d] != null);
  if (!present.includes(drv)) return null;

  const viva = misura(byLap, nL, L);
  const gradino = (viva.gradino != null && viva.n_gradino >= MIN_SOSTE) ? viva.gradino : null;
  const loss = (viva.perdita != null && viva.n_perdita >= MIN_SOSTE) ? viva.perdita
             : (PITLOSS[race.gara] ?? null);
  if (loss == null) return null;
  const eta0 = typeof cars[drv].tyre_age === 'number' ? cars[drv].tyre_age : null;
  if (eta0 == null) return null;
  const steps = nL - L;
  if (steps < 3) return null;

  const state = {};
  for (const d of present) state[d] = { cum_time: cars[d].cum_time };
  const baseP = passiBase(byLap, nL, L, present, { delta: PHI });
  const baseR = passiBase(byLap, nL, L, present, { delta: PHI, rho: RHO, eta0: 0 });
  if (baseP[drv] == null || baseR[drv] == null) return null;

  const A = [], B = [], C = [];
  for (let p = L + 1; p <= nL - 1; p++) {
    const pits = [{ driver: drv, lap: p, loss }];
    const fa = simulaConSoste({ state, pace, freezeLap: L, steps, ZONE, pits, gradino });
    const fb = simulaSimmetrico({ base: baseP, byLap, nLaps: nL, freezeLap: L, steps, pits,
                                  delta: PHI, gradino, ZONE });
    const fc = simulaSimmetrico({ base: baseR, byLap, nLaps: nL, freezeLap: L, steps, pits,
                                  delta: PHI, rho: RHO, gradino: null, ZONE });
    if (fa[drv] == null || fb[drv] == null || fc[drv] == null) return null;
    A.push({ p, c: fa[drv] }); B.push({ p, c: fb[drv] }); C.push({ p, c: fc[drv] });
  }
  if (A.length < 3) return null;

  const info = (arr) => {
    const best = arr.reduce((b, x) => (x.c < b.c ? x : b), arr[0]);
    const spread = Math.max(...arr.map(x => x.c)) - Math.min(...arr.map(x => x.c));
    return { argmin: best.p, spread,
             interno: spread >= PIATTA && best.p !== arr[0].p && best.p !== arr[arr.length - 1].p,
             piatta: spread < PIATTA, primo: arr[0].p, ultimo: arr[arr.length - 1].p };
  };
  return { gara: race.gara, drv, freeze: L, eta0, gradino, loss,
           A: info(A), B: info(B), C: info(C) };
}

// posizione di rientro con i tre motori, per vedere se la Fase 2 muove il prodotto
function posizioni(race, drv, L, P) {
  const byLap = race.byLap, nL = race.n_laps;
  const pace = race.pace[String(L)];
  if (!pace) return null;
  const cars = byLap[L] || {};
  const present = Object.keys(cars).filter(d =>
    typeof cars[d].cum_time === 'number' && !race.nonParten.has(d) && pace[d] != null);
  if (!present.includes(drv)) return null;
  const viva = misura(byLap, nL, L);
  const gradino = (viva.gradino != null && viva.n_gradino >= MIN_SOSTE) ? viva.gradino : null;
  const loss = (viva.perdita != null && viva.n_perdita >= MIN_SOSTE) ? viva.perdita
             : (PITLOSS[race.gara] ?? null);
  if (loss == null) return null;
  const orizzonte = gradino != null ? 5 : 0;
  const steps = (P - L) + 1 + orizzonte;
  const pits = [{ driver: drv, lap: P, loss }];
  const state = {};
  for (const d of present) state[d] = { cum_time: cars[d].cum_time };
  const baseR = passiBase(byLap, nL, L, present, { delta: PHI, rho: RHO, eta0: 0 });
  if (baseR[drv] == null) return null;
  const fa = simulaConSoste({ state, pace, freezeLap: L, steps, ZONE, pits, gradino });
  const fc = simulaSimmetrico({ base: baseR, byLap, nLaps: nL, freezeLap: L, steps, pits,
                                delta: PHI, rho: RHO, gradino: null, ZONE });
  const gruppo = stessoGiroReale(byLap, L, nL, drv, present);
  const rank = f => {
    const ord = gruppo.filter(d => f[d] != null).sort((a, b) => f[a] - f[b]);
    return ord.indexOf(drv) + 1;
  };
  const ra = rank(fa), rc = rank(fc);
  return (ra > 0 && rc > 0) ? { gara: race.gara, drv, P, oggi: ra, fase2: rc } : null;
}

function main() {
  const argv = process.argv.slice(2);
  const iJson = argv.indexOf('--json');
  const outJson = iJson >= 0 ? argv[iJson + 1] : null;
  const gare = j(path.join(D, 'manifest.json')).map(r => r.gara).filter(g => !ESCLUSE.has(g));

  console.log('='.repeat(100));
  console.log('BANCO FASE 2 — l eta gomma al posto del gradino');
  console.log(`rho = ${RHO.toFixed(4)} s/giro per giro di vita   ·   Phi = ${PHI.toFixed(3)} s`);
  console.log('='.repeat(100));

  const casi = [], pos = [], coerenza = [];
  for (const g of gare) {
    const race = caricaGara(g);
    for (let P = 2; P <= race.n_laps; P++) {
      for (const [drv, c] of Object.entries(race.byLap[P] || {})) {
        if (!c.in_lap) continue;
        const r = curve(race, drv, P - 1);
        if (r) { r.sosta_vera = P; casi.push(r); }
        const q = posizioni(race, drv, P - 1, P);
        if (q) pos.push(q);
        // COERENZA: il gradino misurato dovrebbe valere circa -rho * eta della gomma tolta
        if (r && r.gradino != null) coerenza.push({ atteso: -RHO * r.eta0, misurato: r.gradino });
      }
    }
  }

  const n = casi.length;
  const riga = (k, nome) => {
    const piatte = casi.filter(c => c[k].piatta).length;
    const interni = casi.filter(c => c[k].interno).length;
    const primo = casi.filter(c => !c[k].piatta && c[k].argmin === c[k].primo).length;
    const ultimo = casi.filter(c => !c[k].piatta && c[k].argmin === c[k].ultimo).length;
    console.log(`  ${nome.padEnd(28)}${String(piatte).padStart(8)}${String(primo).padStart(9)}`
      + `${String(ultimo).padStart(9)}${String(interni).padStart(9)}`
      + `${(interni / n * 100).toFixed(1).padStart(9)}%`);
    return interni / n;
  };
  console.log(`\nG0 — DOVE CADE IL MINIMO (${n} soste vere, Monaco escluso)`);
  console.log(`  ${'motore'.padEnd(28)}${'piatta'.padStart(8)}${'al 1o'.padStart(9)}`
    + `${'all ult'.padStart(9)}${'INTERNO'.padStart(9)}${'G0'.padStart(10)}`);
  const g0a = riga('A', 'A · oggi');
  const g0b = riga('B', 'B · Fase 1 (deriva)');
  const g0c = riga('C', 'C · Fase 2 (eta gomma)');
  console.log(`\n  soglia G0 >= 80 %  ->  Fase 2 ${g0c >= 0.8 ? 'PASSA' : 'NON PASSA'}`);

  // dove cadono i minimi NON interni della Fase 2: e' "fermati subito" ed e' corretto?
  const bordoC = casi.filter(c => !c.C.interno && !c.C.piatta);
  const vecchie = bordoC.filter(c => (c.C.ultimo + 1 - c.freeze - c.eta0) / 2 <= 1).length;
  console.log(`  minimi al bordo in C: ${bordoC.length}, di cui ${vecchie} con gomma gia troppo`
    + ' vecchia ((giri rimasti - eta)/2 <= 1): li "fermati subito" e la risposta GIUSTA');

  // coerenza fra il gradino misurato in gara e rho * eta
  if (coerenza.length) {
    const d = coerenza.map(x => x.misurato - x.atteso).sort((a, b) => a - b);
    const q = p => d[Math.min(d.length - 1, Math.floor(d.length * p))];
    const ma = coerenza.reduce((s, x) => s + x.atteso, 0) / coerenza.length;
    const mm = coerenza.reduce((s, x) => s + x.misurato, 0) / coerenza.length;
    console.log('\nCONTROLLO INDIPENDENTE — il gradino misurato in gara vale -rho x eta?');
    console.log(`  gradino misurato (media)      ${mm.toFixed(3)} s/giro`);
    console.log(`  -rho x eta della gomma tolta  ${ma.toFixed(3)} s/giro`);
    console.log(`  scarto: mediana ${q(.5).toFixed(3)}   p25 ${q(.25).toFixed(3)}   p75 ${q(.75).toFixed(3)}`);
    console.log('  Due misure indipendenti: il gradino viene dalle soste di QUESTA gara, rho');
    console.log('  dalla pendenza intra-stint di 10 gare. Se coincidono, si sostengono a vicenda.');
  }

  const cambiate = pos.filter(r => r.oggi !== r.fase2);
  console.log(`\nLE POSIZIONI DI RIENTRO — oggi contro Fase 2`);
  console.log(`  casi ${pos.length}   cambiate ${cambiate.length}  (${(cambiate.length / pos.length * 100).toFixed(1)}%)`);
  if (cambiate.length) {
    const s = cambiate.map(r => r.fase2 - r.oggi);
    console.log(`  ${s.filter(x => x < 0).length} rientri MIGLIORI, ${s.filter(x => x > 0).length} PEGGIORI`
      + `   massimo ${Math.max(...s.map(Math.abs))} posizioni`);
  }

  if (outJson) {
    fs.writeFileSync(outJson, JSON.stringify({
      targhetta: { rho: RHO, phi: PHI, gare, escluse: [...ESCLUSE], n_casi: n, ZONE,
                   prereg: 'ai_lab/simulatore/PREREG_fase0.md §8 (G0)' },
      G0: { A_oggi: g0a, B_fase1: g0b, C_fase2: g0c, soglia: 0.80, passa: g0c >= 0.8 },
      bordo_C: { n: bordoC.length, gomma_gia_vecchia: vecchie },
      coerenza_gradino_rho: coerenza.length ? {
        n: coerenza.length,
        gradino_medio: coerenza.reduce((s, x) => s + x.misurato, 0) / coerenza.length,
        atteso_medio: coerenza.reduce((s, x) => s + x.atteso, 0) / coerenza.length } : null,
      posizioni: { n: pos.length, cambiate: cambiate.length, casi: cambiate },
      casi,
    }, null, 1));
    console.log(`\nscritto ${outJson}`);
  }
}

main();
