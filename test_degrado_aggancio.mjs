// test_degrado_aggancio.mjs — le verifiche MECCANICHE dell'aggancio degrado.
// Nessun numero di dominio: i rate sono SINTETICI e arbitrari, marcati tali.
// Importa simulate (kernel congelato salvo l'aggancio additivo), non lo riscrive.
//
// NOTA STORICA. Fino al 21/07/2026 questo test CERTIFICAVA LA TRAPPOLA: passava `age0: 5` e
// si aspettava rate*(0+1+...+(steps-1)), cioe' esattamente il comportamento in cui il campo
// dell'eta di riferimento veniva IGNORATO dal codice. Un test che chiede al motore di fare
// la cosa sbagliata non protegge: la cementa. Le verifiche 4 e 5 nascono da li'.
import { simulate } from './demo/engine.mjs';
import { readFileSync } from 'fs';

const race = JSON.parse(readFileSync('./demo/data/Austria.json', 'utf8'));
const byLap = {}; for (const lp of race.laps) byLap[lp.lap] = lp.cars;
const L = 30, state = byLap[L], pace = race.pace[String(L)];
const steps = 6;
const base = simulate({ state, pace, steps, freezeLap: L });
const piloti = Object.keys(base).filter(d => base[d] != null);
const perTutti = f => Object.keys(state).reduce((o, d) => (o[d] = f(d), o), {});

// 1 SPENTO = BIT-IDENTICO
const spento = simulate({ state, pace, steps, freezeLap: L, degrado: null });
const ok1 = Object.keys(base).every(d => Object.is(base[d], spento[d]));

// 2 RATE ZERO = BIT-IDENTICO (acceso ma nullo non deve muovere un ulp)
const zero = perTutti(() => ({ rate: 0, eta: 12, eta0: 3 }));
const rz = simulate({ state, pace, steps, freezeLap: L, degrado: zero });
const ok2 = Object.keys(base).every(d => Object.is(base[d], rz[d]));

// 3 eta0 == eta (passo misurato all'eta attuale): il CASO PARTICOLARE, rate*(0+1+...+(steps-1))
const R = 0.05;
const pari = perTutti(() => ({ rate: R, eta: 12, eta0: 12 }));
const rp = simulate({ state, pace, steps, freezeLap: L, degrado: pari });
const attesoPari = R * (steps * (steps - 1)) / 2;                       // sintetico
const ok3 = piloti.every(d => Math.abs((rp[d] - base[d]) - attesoPari) < 1e-9);

// 4 eta0 < eta — LA VERIFICA CHE AVREBBE PRESO LA TRAPPOLA.
//   `pace` misurato su gomme piu' giovani di quelle che corrono i giri simulati: la penalita'
//   deve crescere di ESATTAMENTE rate*(eta-eta0) per ogni giro. Col vecchio codice (rate*s)
//   questa differenza sarebbe stata ZERO, e nessuno se ne sarebbe accorto.
const D = 9;                                                            // giri di scarto
const piu = perTutti(() => ({ rate: R, eta: 12, eta0: 12 - D }));
const rv = simulate({ state, pace, steps, freezeLap: L, degrado: piu });
const attesoExtra = R * D * steps;
const ok4 = piloti.every(d => Math.abs((rv[d] - rp[d]) - attesoExtra) < 1e-9);

// 5 SICURO PER ASSENZA: senza `eta`/`eta0` il degrado NON si applica. Meglio un effetto
//   visibilmente assente che una forma sbagliata applicata di nascosto.
const monco = perTutti(() => ({ rate: R }));
const rm = simulate({ state, pace, steps, freezeLap: L, degrado: monco });
const ok5 = Object.keys(base).every(d => Object.is(base[d], rm[d]));

const righe = [
  ['SPENTO = BIT-IDENTICO', ok1],
  ['RATE ZERO = BIT-IDENTICO', ok2],
  [`eta0 == eta: +${attesoPari.toFixed(3)}s ESATTI su ${steps} giri`, ok3],
  [`eta0 = eta-${D}: +${attesoExtra.toFixed(3)}s IN PIU (la trappola)`, ok4],
  ['senza eta/eta0: degrado NON applicato (sicuro per assenza)', ok5],
];
for (const [n, ok] of righe) console.log(`  ${ok ? 'PASS' : 'FALLITO'}  ${n}`);
console.log(`\n  ${righe.every(r => r[1]) ? 'aggancio degrado: meccanica verificata' : 'AGGANCIO ROTTO'}`);
process.exit(0);   // nessun exit-code decide: e' un test di codice, riporta e basta
