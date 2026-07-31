// RILETTA IL 31/07/2026, quando il kernel Python e' stato cancellato.
// Questo test nacque per verificare che il motore JS riproducesse quello Python. Quel
// Python non esiste piu': il per-giro del sito lo produce ora il simulatore
// (simulatore/provenienza/esporta_demo_gara.mjs), e engine/engine.py e' stato tolto.
//
// Il file resta, e il suo riferimento (data/ref_traffic_py.json) diventa uno STORICO
// CONGELATO: non verifica piu' un allineamento fra due lingue — verifica che
// demo/engine.mjs, il kernel VECCHIO ancora vivo sotto il pannello di live.html, non sia
// derivato rispetto a com'era. Muore insieme a quel pannello.
//
// Il nome del file e i messaggi dicono ancora "vs Python": e' storia, non una promessa
// attiva. Cambiarli avrebbe reso irriconoscibile un golden che qualcuno potrebbe cercare.
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
// IL 449 CABLATO ERA UN SECONDO GOLDEN NON DICHIARATO (corretto 28/07/2026).
// Questo test esiste per una cosa sola: verificare che il motore JS riproduca il Python.
// Ma la condizione conteneva anche `rows.length === 449`, cioe' congelava di nascosto QUANTI
// casi il Python riesce a valutare — una grandezza che dipende dai dati, non dall'allineamento.
// Quando il filtro verde di pace_base e' stato corretto (audit del kernel, 28/07), tre piloti
// hanno smesso di avere un passo e i casi valutabili sono passati da 449 a 443: l'allineamento
// era PERFETTO (max |JS - Python| = 0.00e+0) e il test falliva lo stesso, per il conteggio.
// Ora l'attesa si legge dal riferimento: "JS riproduce OGNI caso che il Python ha prodotto".
// Il numero non e' piu' scritto in nessun posto, quindi non puo' piu' scadere.
const ok = rows.length === ref.length && maxDiff < 1e-9;
console.log("\n=> " + (ok
  ? `PASS: motore JS allineato al Python col-traffico (${rows.length}/${ref.length}, sotto 1e-9)`
  : "FAIL: allineamento rotto, NON procedere alla timeline"));
if (!ok) process.exit(1);
