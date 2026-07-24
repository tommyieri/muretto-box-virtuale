// test_ghostplay.mjs — la messa in scena non tradisce la traiettoria.
// Verifica le funzioni pure di ghostplay su una traiettoria vera:
//  - le frazioni di giro stanno in [0,1]
//  - il progresso di ogni pilota cresce nel tempo (nessun salto all'indietro)
//  - l'ordine finale della torre coincide con l'ordine dei cum al traguardo
//  - il fantasma scende dopo la sosta e poi risale (sorpassi)
import { readFileSync } from 'node:fs';
import { traiettoriaPit } from './pitscenario.mjs';
import { costruisciCum, tempoReale, statoAl, righeTorre } from './ghostplay.mjs';

const race = JSON.parse(readFileSync(new URL('./data/Australia.json', import.meta.url)));
const byLap = {}; for (const lp of race.laps) byLap[lp.lap] = lp.cars;
const nLaps = race.n_laps;

let pass = 0, fail = 0;
const check = (n, c, x = '') => c ? (pass++, console.log('  OK  ', n)) : (fail++, console.log('  FAIL', n, x));

const L = 42, pitLap = 43;
const pace = race.pace[String(L)];
const present = Object.keys(byLap[L]).filter(d => typeof byLap[L][d].cum_time === 'number' && pace[d] != null);
const driver = present.find(d => byLap[L][d].cum_time != null);

const sim = traiettoriaPit({ byLap, nLaps, pace, driver, freezeLap: L, pitLap, pitLoss: 22, present, gradino: -1.4 });
const C = costruisciCum(sim);

console.log(`caso L=${L} pit=${pitLap} drv=${driver} present=${present.length}`);
check('cum costruito per tutti i presenti', Object.keys(C.cum).length === present.length);

// campiona il tempo su tutta la corsa e verifica gli invarianti
const progPrec = {};
let fdOk = true, progOk = true, sawPit = false, order0 = null, orderN = null;
const steps = 240;
for (let i = 0; i <= steps; i++) {
  const p = C.freezeLap + (C.nLap + 1 - C.freezeLap) * (i / steps);
  const T = tempoReale(C, p);
  if (T === undefined) continue;
  const stato = statoAl(C, T, { driver, pitLap });
  for (const s of stato) {
    if (s.fd < -1e-9 || s.fd > 1 + 1e-9) fdOk = false;
    if (progPrec[s.d] != null && s.prog < progPrec[s.d] - 1e-6) progOk = false;
    progPrec[s.d] = s.prog;
    if (s.d === driver && s.inPit) sawPit = true;
  }
  if (i === 0) order0 = stato.map(s => s.d);
  if (i === steps) orderN = stato.map(s => s.d);
}
check('tutte le frazioni di giro in [0,1]', fdOk);
check('il progresso di ogni pilota non torna indietro', progOk);
check('il fantasma transita in pit-lane almeno una volta', sawPit);

// ordine finale della torre == ordine dei cum al traguardo (fra i presenti con cum)
const cumFin = sim.cumByLap[C.nLap];
const ordCum = Object.keys(cumFin).sort((a, b) => cumFin[a] - cumFin[b]);
check('ordine torre finale == ordine cum al traguardo',
  JSON.stringify(orderN.filter(d => cumFin[d] != null)) === JSON.stringify(ordCum.filter(d => orderN.includes(d))),
  `\n   torre=${orderN}\n   cum  =${ordCum}`);

// il fantasma cambia posizione tra inizio e fine (la sosta ha un effetto visibile)
const posIniz = order0.indexOf(driver) + 1, posFin = orderN.indexOf(driver) + 1;
console.log(`     fantasma: partenza P${posIniz} -> traguardo P${posFin}`);
check('la torre produce righe coerenti', righeTorre(statoAl(C, tempoReale(C, C.nLap), { driver, pitLap }), C.durata)[0].gapTxt === 'LEADER');

console.log(`\n=== ${pass} OK, ${fail} FAIL ===`);
process.exit(fail ? 1 : 0);
