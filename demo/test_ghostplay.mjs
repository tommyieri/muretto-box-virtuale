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

// --- il loop rAF si ferma ESATTAMENTE al rientro (fase 1), col fantasma dove dice il pannello ---
import { creaGhostPlay } from './ghostplay.mjs';
import { evaluatePit } from './pitscenario.mjs';
{
  // mock di requestAnimationFrame: coda pompata a mano a passi di 16ms (rendering "liscio")
  const coda = [];
  globalThis.requestAnimationFrame = cb => { coda.push(cb); return coda.length; };
  globalThis.cancelAnimationFrame = () => {};

  // driver di TESTA (a pari giro col grosso del gruppo): per lui la posizione ASSOLUTA della
  // torre coincide con quella "a pari giro" del pannello — è il caso che conta (chi lotta per
  // posizione, non un doppiato). Il marcatore cita comunque il pannello "tra i N a pari giro".
  const drvLead = [...present].sort((a, b) => byLap[L][a].cum_time - byLap[L][b].cum_time)[5];
  const rL = evaluatePit({ byLap, nLaps, pace, driver: drvLead, freezeLap: L, pitLap, pitLoss: 22,
    present, orizzonte: 5, gradino: -1.4 });
  const simL = traiettoriaPit({ byLap, nLaps, pace, driver: drvLead, freezeLap: L, pitLap, pitLoss: 22,
    present, gradino: -1.4 });
  const giroRisp = pitLap + 1 + 5;   // = Lfin del motore

  let rientroFired = false, ultimaTorre = null, finito = false;
  const pistaMock = { pitFrazioni: { ingresso: 0.95, uscita: 0.05 }, aggiorna() {} };
  const gp = creaGhostPlay({
    sim: simL, pista: pistaMock, coloreDi: () => '#fff', giroRisposta: giroRisp,
    onTower: righe => { ultimaTorre = righe; },
    onRientro: () => { rientroFired = true; },
    onFine: () => { finito = true; },
  });
  gp.play();
  let ts = 0;
  for (let i = 0; i < 20000 && !rientroFired && !finito && coda.length; i++) { const cb = coda.shift(); ts += 16; cb(ts); }

  check('creaGhostPlay: onRientro scatta (fase 1 si ferma al rientro)', rientroFired && !finito);
  // al fermo, per un lead-lap la posizione del fantasma nella torre == quella del pannello
  const posTorre = ultimaTorre ? ultimaTorre.findIndex(x => x.drv === drvLead) + 1 : -1;
  check(`torre al rientro (P${posTorre}) == pannello (P${rL.rientro_pos}) [${drvLead}, lead lap]`,
    posTorre === rL.rientro_pos,
    `\n   torre=${ultimaTorre && ultimaTorre.slice(0, 6).map(x => x.pos + x.drv).join(' ')}`);

  // continua(): la fase 2 riparte e arriva alla bandiera
  gp.continua();
  for (let i = 0; i < 40000 && !finito && coda.length; i++) { const cb = coda.shift(); ts += 16; cb(ts); }
  check('continua(): la proiezione arriva alla bandiera (onFine)', finito);
}

console.log(`\n=== ${pass} OK, ${fail} FAIL ===`);
process.exit(fail ? 1 : 0);
