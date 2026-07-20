// check_banda_gancio.mjs — STEP 4: prova di COERENZA della banda scelta col gancio
// degrado_hook.mjs (v1.5), su 1-2 casi golden. NON è una nuova validazione del gancio
// (già coperto da test_degrado_hook.mjs), NON produce numeri di dominio nuovi: verifica
// solo che la banda [0,centrale,max] letta da data/banda_degrado_scelta.json sia un
// INPUT valido per il meccanismo (tre scenari ordinati pess>=centrale>=ott, nessun
// incrocio) e che la banda-zero resti bit-identica. Nessun file motore/gancio toccato.
import { simulate } from './demo/engine.mjs';
import { simulaScenario, treScenari } from './demo/degrado_hook.mjs';
import fs from 'fs';

const BANDA = JSON.parse(fs.readFileSync('./data/banda_degrado_scelta.json', 'utf8'));
const CASI  = JSON.parse(fs.readFileSync('./demo/golden_pit_casi.json', 'utf8'));
const pitloss = JSON.parse(fs.readFileSync('./demo/data/pitloss.json', 'utf8'));
const cache = {};
function loadRace(g) {
  if (cache[g]) return cache[g];
  const r = JSON.parse(fs.readFileSync(`./demo/data/${g}.json`, 'utf8'));
  r.byLap = {}; for (const lp of r.laps) r.byLap[lp.lap] = lp.cars;
  cache[g] = r; return r;
}
function inputs(c) {
  const r = loadRace(c.gara), L = c.freezeLap;
  const pace = r.pace[String(L)];
  const present = Object.keys(r.byLap[L])
    .filter(d => typeof r.byLap[L][d].cum_time === 'number' && pace[d] != null);
  const state = {}, tyreAge0 = {}, compound = {};
  for (const d of present) {
    state[d] = { cum_time: r.byLap[L][d].cum_time };
    tyreAge0[d] = r.byLap[L][d].tyre_age;
    compound[d] = r.byLap[L][d].compound;
  }
  const steps = (c.pitLap - L) + 1;
  const pit = { driver: c.driver, lap: c.pitLap, loss: (pitloss[c.gara] ?? 22.0) };
  return { state, pace, tyreAge0, compound, steps, pit, driver: c.driver, freezeLap: L };
}

// banda UNICA compound-agnostica: stessa terna [min,centrale,max] per SOFT/MEDIUM/HARD.
const terna = [BANDA.min, BANDA.centrale, BANDA.max];
const banda = { SOFT: terna, MEDIUM: terna, HARD: terna };
const ZERO  = { SOFT: [0, 0, 0], MEDIUM: [0, 0, 0], HARD: [0, 0, 0] };
console.log(`banda scelta (compound-agnostica): [min=${terna[0]}, centrale=${terna[1]}, max=${terna[2]}] s/giro\n`);

let allPass = true;
for (const cName of ['Austria', 'Monaco']) {   // un caso VERDE + un caso sotto neutralizzazione
  const c = CASI.find(x => x.gara === cName);
  if (!c) { console.log(`  (nessun caso golden per ${cName}, saltato)`); continue; }
  const inp = inputs(c);

  // (a) banda-zero deve restare bit-identica al kernel (invariante v1.5, ri-verificata qui)
  const base  = simulate({ state: inp.state, pace: inp.pace, freezeLap: inp.freezeLap, steps: inp.steps, pit: inp.pit });
  const scZero = treScenari({ ...inp, banda: ZERO });
  let z = 0;
  for (const d of Object.keys(base)) if (typeof base[d] === 'number')
    z = Math.max(z, Math.abs(base[d] - scZero.ottimistico[d]));

  // (b) banda scelta: tre scenari, ordine pess>=centrale>=ott su OGNI pilota
  const sc = treScenari({ ...inp, banda });
  let ordOK = true, nD = 0;
  for (const d of Object.keys(inp.state)) {
    const o = sc.ottimistico[d], ce = sc.centrale[d], pe = sc.pessimistico[d];
    if (o == null || ce == null || pe == null) continue;
    nD++;
    if (!(pe >= ce - 1e-9 && ce >= o - 1e-9)) ordOK = false;
  }
  const d = inp.driver;
  const width = sc.pessimistico[d] - sc.ottimistico[d];
  const pass = (z === 0) && ordOK && width >= -1e-9;
  allPass = allPass && pass;
  console.log(`  ${cName} ${d} (freeze ${inp.freezeLap}, pit ${c.pitLap}):`);
  console.log(`    banda-zero bit-identica: ${z === 0 ? 'OK' : 'FAIL ('+z.toExponential(2)+')'}` +
              ` | ordine pess>=centrale>=ott su ${nD} piloti: ${ordOK ? 'OK' : 'FAIL'}`);
  console.log(`    ${d}: ott=${sc.ottimistico[d].toFixed(3)} centrale=${sc.centrale[d].toFixed(3)} ` +
              `pess=${sc.pessimistico[d].toFixed(3)}  ampiezza=${width.toFixed(3)}s  => ${pass ? 'COERENTE' : 'INCOERENTE'}\n`);
}
console.log(`${allPass ? '✓' : '✗'} STEP 4: la banda scelta è un input ${allPass ? 'VALIDO' : 'NON valido'} per il gancio v1.5` +
            ` (meccanismo già validato in test_degrado_hook.mjs; qui solo coerenza input).`);
process.exit(allPass ? 0 : 1);
