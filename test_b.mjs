import { readFileSync } from "fs";
import { simulate } from "./demo/engine.mjs";

const FILES = ["Australia","Cina","Giappone","Miami","Canada","Monaco","Spagna","Austria"];
// riferimento: Python col-traffico, ricostruito dal vivo (mele con mele)
const ref = JSON.parse(readFileSync("data/ref_traffic_py.json", "utf8"));

const race = {}, stateAt = {}, posAt = {};
for (const gara of FILES) {
  const obj = JSON.parse(readFileSync(`demo/data/${gara}.json`, "utf8"));
  race[gara] = obj; stateAt[gara] = {}; posAt[gara] = {};
  for (const lp of obj.laps) {
    stateAt[gara][lp.lap] = lp.cars;
    for (const [d, c] of Object.entries(lp.cars)) posAt[gara][`${d}|${lp.lap}`] = c.cum_time;
  }
}

const rows = [];
for (const r of ref) {
  const state = stateAt[r.gara][r.L], pace = race[r.gara].pace[String(r.L)];
  if (!state || !pace) continue;
  const fin = simulate({ state, pace, track: 1.0, steps: 5 });
  const cA = fin[r.A], cB = fin[r.B];
  const gE = posAt[r.gara][`${r.B}|${r.L + 5}`], aE = posAt[r.gara][`${r.A}|${r.L + 5}`];
  if ([cA, cB, gE, aE].some(v => v === undefined || v === null)) continue;
  const errJS = Math.abs((cB - cA) - (gE - aE));
  rows.push({ ...r, errJS, diff: Math.abs(errJS - r.err) });
}

const errs = rows.map(x => x.errJS).sort((a, b) => a - b);
const median = errs[Math.floor(errs.length / 2)];
const mean = errs.reduce((s, x) => s + x, 0) / errs.length;
const byDiff = [...rows].sort((a, b) => b.diff - a.diff);
const maxDiff = byDiff[0].diff;

console.log("SECONDO GOLDEN — Test B in JavaScript (Node), vs Python col-traffico\n");
console.log(`n casi           : ${rows.length}  (Python: 449)`);
console.log(`mediana err      : ${median.toFixed(3)}  (Python: 2.076)`);
console.log(`media   err      : ${mean.toFixed(3)}  (Python: 5.514)`);
console.log(`max |JS - Python|: ${maxDiff.toExponential(2)}`);
console.log("\ntop 5 differenze per caso:");
for (const x of byDiff.slice(0, 5))
  console.log(`  ${x.gara} L${x.L} ${x.A}/${x.B}: py=${x.err.toFixed(6)} js=${x.errJS.toFixed(6)} diff=${x.diff.toExponential(2)}`);
// USCITA 1 SUL FALLIMENTO (22/07/2026). Fino a oggi questo file stampava FAIL e usciva 0.
// auto_gara.py:69 ne legge il codice di ritorno per decidere se pubblicare: leggeva SEMPRE
// zero. Cioe' il golden piu' citato del progetto non ha mai fermato niente — era un
// ornamento, e l'unico cancello vero era demo/test_pit.mjs. Un test che non ferma non e'
// una guardia: e' una rassicurazione.
const ok = rows.length === 449 && maxDiff < 1e-9;
console.log("\n=> " + (ok
  ? "PASS: motore JS allineato al Python col-traffico (449/449, sotto 1e-9)"
  : "FAIL: allineamento rotto, NON procedere alla timeline"));
if (!ok) process.exit(1);
