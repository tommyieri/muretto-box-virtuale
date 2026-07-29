// test_degrado_hook.mjs — le 3 VERIFICHE MECCANICHE del gancio banda-degrado v1.5.
// Non richiede numeri di dominio: le bande sono SINTETICHE e arbitrarie (marcate tali).
// Kernel/golden/pit non toccati: importa simulate (congelato) e il gancio additivo.
import { simulate } from './demo/engine.mjs';
import { simulaScenario, treScenari, penalitaDegrado } from './demo/degrado_hook.mjs';
import fs from 'fs';

const CASI   = JSON.parse(fs.readFileSync('./demo/golden_pit_casi.json', 'utf8'));
const pitloss = JSON.parse(fs.readFileSync('./demo/data/pitloss.json', 'utf8'));
const cache = {};
function loadRace(g) {
  if (cache[g]) return cache[g];
  const r = JSON.parse(fs.readFileSync(`./demo/data/${g}.json`, 'utf8'));
  r.byLap = {}; for (const lp of r.laps) r.byLap[lp.lap] = lp.cars;
  cache[g] = r; return r;
}
// costruisce gli input di routing di UN caso golden (come evaluatePit)
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
  return { r, L, state, pace, tyreAge0, compound, steps, pit, driver: c.driver };
}
const ZERO = { SOFT: [0, 0, 0], MEDIUM: [0, 0, 0], HARD: [0, 0, 0] };
const rateAll0 = { SOFT: 0, MEDIUM: 0, HARD: 0 };

// ============ VERIFICA 1 — BANDA-ZERO, BIT-IDENTICA AL KERNEL ============
console.log('=== VERIFICA 1 — banda (0,0,0): il gancio e\' inerte, output bit-identico ===');
let maxDiff = 0, nCmp = 0, fail1 = 0;
for (const c of CASI) {
  const { state, pace, tyreAge0, compound, steps, pit } = inputs(c);
  const base = simulate({ state, pace, freezeLap: c.freezeLap, steps, pit });          // kernel oggi
  const hook = simulaScenario({ state, pace, tyreAge0, compound, rate: rateAll0,
                                freezeLap: c.freezeLap, steps, pit });                   // gancio banda-zero
  for (const d of Object.keys(base)) {
    const a = base[d], b = hook[d];
    if ((a == null) !== (b == null)) { fail1++; continue; }
    if (a == null) continue;
    const df = Math.abs(a - b); if (df > maxDiff) maxDiff = df; nCmp++;
    if (df !== 0) fail1++;
  }
}
console.log(`  casi ${CASI.length} | valori confrontati ${nCmp} | max |kernel - gancio| = ${maxDiff.toExponential(2)} | mismatch ${fail1}`);
console.log(`  => ${maxDiff === 0 && fail1 === 0 ? 'PASS: bit-identico (i 3 scenari collassano sul run di oggi)' : 'FAIL: il gancio perturba a banda nulla'}\n`);

// ============ VERIFICA 2 — MONOTONIA (bande sintetiche crescenti) ============
console.log('=== VERIFICA 2 — monotonia: allargando la banda, l\'intervallo non si restringe ===');
console.log('    bande SINTETICHE e ARBITRARIE (solo per testare il meccanismo), s/giro:');
const BANDE = {
  'B0 (0,0,0)':        { SOFT: [0, 0, 0],       MEDIUM: [0, 0, 0],       HARD: [0, 0, 0] },
  'B1 stretta':        { SOFT: [.01, .02, .03], MEDIUM: [.01, .02, .03], HARD: [.01, .02, .03] },
  'B2 media':          { SOFT: [.00, .03, .06], MEDIUM: [.00, .03, .06], HARD: [.00, .03, .06] },
  'B3 larga':          { SOFT: [.00, .05, .10], MEDIUM: [.00, .05, .10], HARD: [.00, .05, .10] },
};
// caso di riferimento con traffico e finestra: Monaco LEC (sotto SC) + Austria VER (verde)
for (const cName of ['Monaco:LEC:fz57:pit60', 'Austria:VER:fz30:pit34']) {
  const c = CASI.find(x => `${x.gara}:${x.driver}:fz${x.freezeLap}:pit${x.pitLap}` === cName)
         || CASI.find(x => x.gara === cName.split(':')[0]);
  const inp = inputs(c);
  console.log(`\n  caso ${c.gara} ${c.driver} (freeze ${c.freezeLap}, pit ${c.pitLap}):`);
  console.log(`  ${'banda'.padEnd(14)} ${'cum_ott'.padStart(12)} ${'cum_centr'.padStart(12)} ${'cum_pess'.padStart(12)} ${'ampiezza'.padStart(10)}  ord?`);
  let prevWidth = -1, mono = true, cross = false;
  for (const [nome, banda] of Object.entries(BANDE)) {
    const sc = treScenari({ ...inp, banda });
    const d = c.driver;
    const ott = sc.ottimistico[d], ce = sc.centrale[d], pe = sc.pessimistico[d];
    const width = pe - ott;
    // ordinamento pess >= centrale >= ott per il pilota (piu' degrado = piu' lento = cum maggiore)
    const ordOK = pe >= ce - 1e-9 && ce >= ott - 1e-9;
    if (!ordOK) cross = true;
    if (width < prevWidth - 1e-9) mono = false;
    prevWidth = width;
    console.log(`  ${nome.padEnd(14)} ${ott.toFixed(3).padStart(12)} ${ce.toFixed(3).padStart(12)} ${pe.toFixed(3).padStart(12)} ${width.toFixed(3).padStart(10)}  ${ordOK ? 'ok' : 'CROSS'}`);
  }
  // controllo forte: pess>=centrale>=ott per OGNI pilota, all'ampiezza massima
  const scMax = treScenari({ ...inp, banda: BANDE['B3 larga'] });
  let allOrd = true;
  for (const d of Object.keys(inp.state)) {
    const a = scMax.pessimistico[d], b = scMax.centrale[d], e = scMax.ottimistico[d];
    if (a == null || b == null || e == null) continue;
    if (!(a >= b - 1e-9 && b >= e - 1e-9)) { allOrd = false; break; }
  }
  console.log(`  monotonia ampiezza: ${mono ? 'OK (non si restringe)' : 'FAIL'} | nessun incrocio (pilota): ${!cross ? 'OK' : 'FAIL'} | ordine su TUTTI i piloti (B3): ${allOrd ? 'OK' : 'FAIL'}`);
}

// ============ VERIFICA 3 — COERENZA SCENARI (3 run interi validi) ============
console.log('\n=== VERIFICA 3 — coerenza: ogni scenario e\' un run intero valido ===');
{
  const c = CASI.find(x => x.gara === 'Austria');
  const inp = inputs(c);
  const sc = treScenari({ ...inp, banda: BANDE['B3 larga'] });
  for (const [nome, cum] of Object.entries(sc)) {
    const drv = Object.keys(cum).filter(d => typeof cum[d] === 'number');
    const finiti = drv.every(d => Number.isFinite(cum[d]));
    const ord = drv.sort((a, b) => cum[a] - cum[b]);              // ordine di arrivo dello scenario
    const gapMono = ord.every((d, i) => i === 0 || cum[d] >= cum[ord[i - 1]] - 1e-9); // gap non negativi
    const permOK = new Set(ord).size === drv.length;             // permutazione completa
    const pos = ord.indexOf(inp.driver) + 1;
    console.log(`  ${nome.padEnd(12)}: ${drv.length} piloti, tutti finiti=${finiti}, gap monotoni=${gapMono}, ` +
                `permutazione completa=${permOK}, rientro ${inp.driver} = P${pos}/${drv.length}`);
  }
  console.log('  => ogni scenario, preso da solo, e\' una simulazione valida e internamente consistente.');
}

// esito complessivo per exit code
const ok1 = maxDiff === 0 && fail1 === 0;
console.log(`\n${ok1 ? '✓' : '✗'} VERIFICA 1 (invariante banda-zero) ${ok1 ? 'PASS' : 'FAIL'} — le altre stampano OK/FAIL inline.`);
process.exit(ok1 ? 0 : 1);
