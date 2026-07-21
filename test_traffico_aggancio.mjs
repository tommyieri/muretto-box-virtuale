// test_traffico_aggancio.mjs — le TRE verifiche MECCANICHE dell'aggancio traffico.
// Nessun numero di dominio nei casi: i parametri sono SINTETICI dove serve.
import { simulate } from './demo/engine.mjs';
import { readFileSync } from 'fs';
const race = JSON.parse(readFileSync('./demo/data/Austria.json', 'utf8'));
const byLap = {}; for (const lp of race.laps) byLap[lp.lap] = lp.cars;
const L = 30, state = byLap[L], pace = race.pace[String(L)];
const base = simulate({ state, pace, steps: 6, freezeLap: L });

const spento = simulate({ state, pace, steps: 6, freezeLap: L, traffico: null });
const ok1 = Object.keys(base).every(d => Object.is(base[d], spento[d]));

// a=0 -> penalita' nulla, ma il cap NON si applica: il risultato deve essere il no-traffic
const senzaCap = simulate({ state, pace, steps: 6, freezeLap: L, ZONE: 0 });
const a0 = simulate({ state, pace, steps: 6, freezeLap: L, traffico: { a: 0, lam: 1 } });
const ok2 = Object.keys(senzaCap).every(d => Math.abs(senzaCap[d] - a0[d]) < 1e-9);

// penalita' positiva -> tutti piu' lenti o uguali al no-traffic, mai piu' veloci
const vivo = simulate({ state, pace, steps: 6, freezeLap: L, traffico: { a: 0.51, lam: 0.8 } });
const ok3 = Object.keys(senzaCap).filter(d => senzaCap[d] != null)
  .every(d => vivo[d] >= senzaCap[d] - 1e-9);

const righe = [['SPENTO = BIT-IDENTICO (resta il cap di oggi)', ok1],
               ['a=0 = simulazione senza traffico', ok2],
               ['a>0 = nessuno va piu veloce del senza-traffico', ok3]];
for (const [n, ok] of righe) console.log(`  ${ok ? 'PASS' : 'FALLITO'}  ${n}`);
console.log(`\n  ${righe.every(r => r[1]) ? 'aggancio traffico: meccanica verificata' : 'AGGANCIO ROTTO'}`);
process.exit(0);
