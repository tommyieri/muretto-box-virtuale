// verifica_k4_clim.mjs — K4 della sessione climatologia (PREREG_SESSIONE_CLIM.md).
// Test END-TO-END MECCANICO: le bande di data/climatologia_degrado.csv alimentano il
// gancio v1.5 (degrado_hook.mjs, CHIAMATO, mai modificato) su UNA gara demo — caso
// golden Austria VER freeze 30 -> pit 34 (pit a meta' di 71 giri, regime verde).
// NON attiva nulla: con K2=STOP il gancio in produzione resta a banda-zero; qui si
// verifica solo che la catena CSV -> tre scenari sia distinguibile e plausibile.
// Regola dichiarata: compound con riga INFORMATIVA -> banda [q25, mediana, q75];
// compound NON-INFORMATIVA o assente -> [0,0,0] (nessun numero non informativo al gancio).
import { simulate } from './demo/engine.mjs';
import { treScenari } from './degrado_hook.mjs';
import fs from 'fs';

const GARA = 'Austria', DRIVER = 'VER', FREEZE = 30, PIT = 34, CID = 'spielberg';
const AMPIEZZA_MIN = 0.5;      // s: sotto, gli scenari NON sono distinguibili (prereg)
const PLAUS_RATIO = 0.25;      // ampiezza <= 25% del pit-loss di gara (prereg)

// --- banda per compound dal CSV climatologia (solo righe INFORMATIVE del circuito) ---
const rows = fs.readFileSync('./data/climatologia_degrado.csv', 'utf8').trim().split('\n');
const hdr = rows[0].split(',');
const col = n => hdr.indexOf(n);
const banda = { SOFT: [0, 0, 0], MEDIUM: [0, 0, 0], HARD: [0, 0, 0] };
const provenienza = {};
for (const line of rows.slice(1)) {
  const f = line.split(',');
  if (f[col('cid')] !== CID) continue;
  const comp = f[col('compound')];
  const flag = f[col('flag_k1')];
  if (flag === 'INFORMATIVA') {
    banda[comp] = [parseFloat(f[col('banda_min_q25')]),
                   parseFloat(f[col('banda_centrale_med')]),
                   parseFloat(f[col('banda_max_q75')])];
    provenienza[comp] = `INFORMATIVA (n_stint=${f[col('n_stint')]}, n_gare=${f[col('n_gare')]})`;
  } else {
    provenienza[comp] = `${flag} -> banda [0,0,0] (regola dichiarata)`;
  }
}
console.log(`K4 — gancio v1.5 su ${GARA} ${DRIVER} (freeze ${FREEZE}, pit ${PIT}), bande ${CID}:`);
for (const c of ['SOFT', 'MEDIUM', 'HARD'])
  console.log(`  ${c.padEnd(6)} [${banda[c].map(x => x.toFixed(4)).join(', ')}] s/giro — ${provenienza[c] ?? 'assente -> [0,0,0]'}`);

// --- input del caso golden (stessa costruzione di check_banda_gancio.mjs) ---
const r = JSON.parse(fs.readFileSync(`./demo/data/${GARA}.json`, 'utf8'));
r.byLap = {}; for (const lp of r.laps) r.byLap[lp.lap] = lp.cars;
const pitloss = JSON.parse(fs.readFileSync('./demo/data/pitloss.json', 'utf8'));
const pace = r.pace[String(FREEZE)];
const present = Object.keys(r.byLap[FREEZE])
  .filter(d => typeof r.byLap[FREEZE][d].cum_time === 'number' && pace[d] != null);
const state = {}, tyreAge0 = {}, compound = {};
for (const d of present) {
  state[d] = { cum_time: r.byLap[FREEZE][d].cum_time };
  tyreAge0[d] = r.byLap[FREEZE][d].tyre_age;
  compound[d] = r.byLap[FREEZE][d].compound;
}
const steps = (PIT - FREEZE) + 1;
const loss = pitloss[GARA] ?? 22.0;
const pit = { driver: DRIVER, lap: PIT, loss };
const inp = { state, pace, tyreAge0, compound, freezeLap: FREEZE, steps, pit };
console.log(`\n  ${DRIVER}: compound ${compound[DRIVER]}, tyre_age al freeze ${tyreAge0[DRIVER]}, pit-loss ${loss}s, orizzonte ${steps} giri`);

// --- (a) banda-zero resta bit-identica al kernel ---
const base = simulate({ state, pace, freezeLap: FREEZE, steps, pit });
const ZERO = { SOFT: [0, 0, 0], MEDIUM: [0, 0, 0], HARD: [0, 0, 0] };
const scZero = treScenari({ ...inp, banda: ZERO });
let z = 0;
for (const d of Object.keys(base)) if (typeof base[d] === 'number')
  z = Math.max(z, Math.abs(base[d] - scZero.centrale[d]));
const zeroOK = z === 0;

// --- (b) i tre scenari con le bande climatologiche ---
const sc = treScenari({ ...inp, banda });
function classifica(cum) {
  return Object.keys(cum).filter(d => typeof cum[d] === 'number').sort((a, b) => cum[a] - cum[b]);
}
console.log(`\n  ${'scenario'.padEnd(13)} ${'rientro'.padStart(7)} ${'gap avanti'.padStart(11)} ${'gap dietro'.padStart(11)} ${'cum ' + DRIVER}`);
const rientri = [];
for (const nome of ['ottimistico', 'centrale', 'pessimistico']) {
  const cum = sc[nome];
  const ord = classifica(cum);
  const p = ord.indexOf(DRIVER);
  rientri.push(p + 1);
  const gapA = p > 0 ? cum[DRIVER] - cum[ord[p - 1]] : NaN;
  const gapD = p < ord.length - 1 ? cum[ord[p + 1]] - cum[DRIVER] : NaN;
  console.log(`  ${nome.padEnd(13)} P${String(p + 1).padEnd(6)} ${(isNaN(gapA) ? 'leader' : '+' + gapA.toFixed(3) + 's').padStart(11)} ${(isNaN(gapD) ? 'ultimo' : '-' + gapD.toFixed(3) + 's').padStart(11)} ${cum[DRIVER].toFixed(3)}`);
}

// --- criteri prereg ---
const ampiezza = sc.pessimistico[DRIVER] - sc.ottimistico[DRIVER];
const rientroCambia = new Set(rientri).size > 1;
const distinguibili = ampiezza >= AMPIEZZA_MIN || rientroCambia;
let ordineOK = true;
for (const d of Object.keys(state)) {
  const o = sc.ottimistico[d], c = sc.centrale[d], p = sc.pessimistico[d];
  if (o == null || c == null || p == null) continue;
  if (!(p >= c - 1e-9 && c >= o - 1e-9)) ordineOK = false;
}
const plausibili = ampiezza <= PLAUS_RATIO * loss && ordineOK;
console.log(`\n  ampiezza pess-ott su ${DRIVER}: ${ampiezza.toFixed(3)}s | rientro cambia tra scenari: ${rientroCambia ? 'si\'' : 'no'}`);
console.log(`  DISTINGUIBILI (>= ${AMPIEZZA_MIN}s o rientro diverso): ${distinguibili ? 'SI\'' : 'NO'}`);
console.log(`  PLAUSIBILI (ampiezza <= ${(PLAUS_RATIO * 100).toFixed(0)}% pit-loss = ${(PLAUS_RATIO * loss).toFixed(2)}s, ordine su tutti i piloti ${ordineOK ? 'OK' : 'FAIL'}): ${plausibili ? 'SI\'' : 'NO'}`);
console.log(`  GOLDEN banda-zero: ${zeroOK ? 'BIT-IDENTICO' : 'FAIL (max diff ' + z.toExponential(2) + ')'}`);
const pass = distinguibili && plausibili && zeroOK;
console.log(`\n${pass ? '✓' : '✗'} K4: scenari ${distinguibili && plausibili ? 'DISTINGUIBILI+PLAUSIBILI' : 'NO'} — golden banda-zero ${zeroOK ? 'BIT-IDENTICO' : 'NO'}`);
process.exit(pass ? 0 : 1);
