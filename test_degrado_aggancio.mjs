// test_degrado_aggancio.mjs — le TRE verifiche MECCANICHE dell'aggancio degrado.
// Nessun numero di dominio: i rate sono SINTETICI e arbitrari, marcati tali.
// Importa simulate (kernel congelato salvo l'aggancio additivo), non lo riscrive.
import { simulate } from './demo/engine.mjs';
import { readFileSync } from 'fs';

const race = JSON.parse(readFileSync('./demo/data/Austria.json', 'utf8'));
const byLap = {}; for (const lp of race.laps) byLap[lp.lap] = lp.cars;
const L = 30, state = byLap[L], pace = race.pace[String(L)];
const base = simulate({ state, pace, steps: 6, freezeLap: L });

// 1 SPENTO = BIT-IDENTICO
const spento = simulate({ state, pace, steps: 6, freezeLap: L, degrado: null });
const ok1 = Object.keys(base).every(d => Object.is(base[d], spento[d]));

// 2 RATE ZERO = BIT-IDENTICO (acceso ma nullo non deve muovere un ulp)
const zero = {}; for (const d of Object.keys(state)) zero[d] = { rate: 0, age0: 5 };
const rz = simulate({ state, pace, steps: 6, freezeLap: L, degrado: zero });
const ok2 = Object.keys(base).every(d => Object.is(base[d], rz[d]));

// 3 RATE POSITIVO = piu lento della quantita ESATTA rate*(0+1+...+(steps-1))
const R = 0.05, steps = 6, atteso = R * (steps * (steps - 1)) / 2;   // sintetico
const uno = {}; for (const d of Object.keys(state)) uno[d] = { rate: R, age0: 5 };
const ru = simulate({ state, pace, steps, freezeLap: L, degrado: uno });
const ok3 = Object.keys(base).filter(d => base[d] != null)
  .every(d => Math.abs((ru[d] - base[d]) - atteso) < 1e-9);

const righe = [['SPENTO = BIT-IDENTICO', ok1], ['RATE ZERO = BIT-IDENTICO', ok2],
               [`RATE ${R} = +${atteso.toFixed(3)}s ESATTI su ${steps} giri`, ok3]];
for (const [n, ok] of righe) console.log(`  ${ok ? 'PASS' : 'FALLITO'}  ${n}`);
console.log(`\n  ${righe.every(r => r[1]) ? 'aggancio degrado: meccanica verificata' : 'AGGANCIO ROTTO'}`);
process.exit(0);   // nessun exit-code decide: e' un test di codice, riporta e basta
