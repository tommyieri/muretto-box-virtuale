// pipeline_smoke_pit.mjs — guardrail 3 (sanita') di pipeline_gara.py: smoke-test del
// modulo pit CONGELATO contro i dati in staging di una gara nuova.
// Uso: node pipeline_smoke_pit.mjs <dir_smoke> <gara> <pitloss>
//   <dir_smoke> contiene: engine.mjs, pitscenario.mjs, neutralizzazione.json (staged,
//   con la gara nuova), data/<gara>.json (staged). Nessun file di demo/ viene toccato.
// Verifica: (a) un pit in giro verde -> ok:true e gap NUMERICI;
//           (b) un pit dentro una finestra SC/VSC -> gap SOPPRESSI (null).
// Exit 0 = passa, 1 = fallisce.
import fs from 'fs';
import { pathToFileURL } from 'url';
import { join } from 'path';

const [dir, gara, pitlossArg] = process.argv.slice(2);
const pitLoss = parseFloat(pitlossArg);
const { evaluatePit } = await import(pathToFileURL(join(dir, 'pitscenario.mjs')).href);

const r = JSON.parse(fs.readFileSync(join(dir, 'data', gara + '.json'), 'utf8'));
r.byLap = {}; for (const lp of r.laps) r.byLap[lp.lap] = lp.cars;
const NEU = JSON.parse(fs.readFileSync(join(dir, 'neutralizzazione.json'), 'utf8'));
const fin = (NEU[gara] ? [...NEU[gara].sc, ...NEU[gara].vsc] : []).sort((a, b) => a[0] - b[0]);
const inFin = L => fin.some(([a, b]) => L >= a && L <= b);

function prova(freeze, pit) {
  const cars = r.byLap[freeze]; if (!cars) return null;
  const present = Object.keys(cars).filter(d => typeof cars[d].cum_time === 'number');
  const ordinati = present.sort((a, b) => cars[a].cum_time - cars[b].cum_time);
  for (const drv of ordinati.slice(2, 12)) {   // meta' classifica: davanti e dietro popolati
    const res = evaluatePit({ byLap: r.byLap, nLaps: r.n_laps, pace: r.pace[String(freeze)],
      driver: drv, freezeLap: freeze, pitLap: pit, pitLoss, present, gara, laps: r.laps });
    if (res && res.ok) return { drv, res };
  }
  return null;
}

let fail = 0;
// (a) caso VERDE: cerca una finestra di 4 giri liberi attorno a meta' gara
let verde = null;
for (let L = Math.floor(r.n_laps / 2); L < r.n_laps - 4 && !verde; L++) {
  if (![L, L + 1, L + 2, L + 3].some(inFin)) verde = prova(L, L + 3);
}
if (verde && verde.res.sotto_neutralizzazione === false &&
    (typeof verde.res.gap_ahead === 'number' || typeof verde.res.gap_behind === 'number')) {
  console.log(`  smoke VERDE : ${verde.drv} -> P${verde.res.rientro_pos}/${verde.res.su_totale} ` +
              `gapA=${verde.res.gap_ahead?.toFixed(2) ?? 'null'} gapB=${verde.res.gap_behind?.toFixed(2) ?? 'null'} OK`);
} else { console.log('  smoke VERDE : FALLITO', verde ? JSON.stringify(verde.res) : '(nessun caso valutabile)'); fail = 1; }

// (b) caso FINESTRA: primo pit possibile dentro una finestra SC/VSC reale
if (fin.length === 0) {
  console.log('  smoke SC/VSC: nessuna finestra in questa gara — controllo non applicabile');
} else {
  let neutro = null;
  for (const [a, b] of fin) {
    for (let pit = Math.max(a, 3); pit <= b && !neutro; pit++) neutro = prova(pit - 2, pit);
    if (neutro) break;
  }
  if (neutro && neutro.res.sotto_neutralizzazione === true &&
      neutro.res.gap_ahead === null && neutro.res.gap_behind === null) {
    console.log(`  smoke SC/VSC: ${neutro.drv} -> P${neutro.res.rientro_pos}/${neutro.res.su_totale} gap SOPPRESSI OK`);
  } else { console.log('  smoke SC/VSC: FALLITO', neutro ? JSON.stringify(neutro.res) : '(nessun caso valutabile)'); fail = 1; }
}
process.exit(fail);
