// test_traiettoria.mjs — la traiettoria del fantasma NON puo' contraddire evaluatePit.
// Al giro-risposta il cum di ogni pilota deve coincidere bit-a-bit con ordine_previsto.
import { readFileSync } from 'node:fs';
import { evaluatePit, traiettoriaPit } from './pitscenario.mjs';

const race = JSON.parse(readFileSync(new URL('./data/Australia.json', import.meta.url)));
const byLap = {}; for (const lp of race.laps) byLap[lp.lap] = lp.cars;
const nLaps = race.n_laps;

function present(L){ return Object.keys(byLap[L]).filter(d => typeof byLap[L][d].cum_time === 'number'); }

let pass = 0, fail = 0;
function check(name, cond, extra=''){ if (cond){ pass++; console.log('  OK  ', name); } else { fail++; console.log('  FAIL', name, extra); } }

for (const [L, pitLap, driver, gradino, orizzonte] of [
  [20, 21, null, null, 0],
  [15, 16, null, -1.4, 5],
  [30, 33, null, null, 0],
  [8,  9,  null, -1.0, 5],
]){
  const pace = race.pace[String(L)];
  const pres = present(L);
  const drv = driver || pres.find(d => pace[d] != null && byLap[L][d].cum_time != null);
  const pitLoss = 20.0;
  const r = evaluatePit({ byLap, nLaps, pace, driver: drv, freezeLap: L, pitLap, pitLoss,
    present: pres, orizzonte, gradino });
  const traj = traiettoriaPit({ byLap, nLaps, pace, driver: drv, freezeLap: L, pitLap, pitLoss,
    present: pres, gradino });
  const Lfin = pitLap + 1 + orizzonte;
  console.log(`\ncaso L=${L} pit=${pitLap} drv=${drv} gradino=${gradino} orizzonte=${orizzonte} -> Lfin=${Lfin}`);
  check('endpoint presente nella traiettoria', !!traj.cumByLap[Lfin]);
  // ordine_previsto = [[d, t]] al giro Lfin; deve coincidere col cum della traiettoria
  let maxDiff = 0;
  for (const [d, t] of r.ordine_previsto){
    const tt = traj.cumByLap[Lfin]?.[d];
    if (tt == null){ maxDiff = Infinity; break; }
    maxDiff = Math.max(maxDiff, Math.abs(tt - t));
  }
  check(`cum coincide con evaluatePit (maxDiff=${maxDiff.toExponential(2)})`, maxDiff < 1e-6, `maxDiff=${maxDiff}`);

  // il fantasma cambia rango: dopo la sosta scende, poi risale (sorpassi reali)
  const rank = (lap) => {
    const cbl = traj.cumByLap[lap]; if (!cbl) return null;
    const ord = Object.entries(cbl).sort((a,b)=>a[1]-b[1]).map(([d])=>d);
    return ord.indexOf(drv) + 1;
  };
  const rF = rank(L), rPit = rank(pitLap+1), rEnd = rank(nLaps);
  console.log(`     rango: freeze=${rF}  dopo-sosta=${rPit}  fine=${rEnd}`);
  check('la sosta fa scendere il fantasma (o pari)', rPit >= rF, `freeze=${rF} dopoSosta=${rPit}`);
}

console.log(`\n=== ${pass} OK, ${fail} FAIL ===`);
process.exit(fail ? 1 : 0);
