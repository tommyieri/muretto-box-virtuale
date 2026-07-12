// gen_residuo_k1_cov.mjs — E3: covariate osservabili per la decomposizione del residuo pit
// a k=1 (finestre pulite, carburante re-inflazionato). Motore CHIAMATO non toccato.
// Variabili GIA' osservabili nel repo + la sola NUOVA (in-lap del rivale, metodo dichiarato).
import fs from 'fs';
import { simulate } from './demo/engine.mjs';

const RACES = ['Australia','Austria','Canada','Cina','Giappone','Gran Bretagna','Miami','Monaco','Spagna'];
const TYRE_MIN = 3, BUFFER = 2, K = 1;
const FUEL_COEFF = 3.0 / 70.0, FUEL_KG0 = 70.0;
const pitloss = JSON.parse(fs.readFileSync('demo/data/pitloss.json', 'utf8'));   // = f1db (18.15 AUS, 29.12 GB, ...)
const NEU = JSON.parse(fs.readFileSync('demo/neutralizzazione.json', 'utf8'));
// warm-in out-lap (giro_stint=0) per compound da warmin_prior.csv
const WARM = {};
for (const line of fs.readFileSync('data/warmin_prior.csv', 'utf8').trim().split('\n').slice(1)) {
  const [c, gs, w] = line.split(','); if (gs === '0') WARM[c] = parseFloat(w);
}
const fuelTerm = (lap, N) => Math.max(0, FUEL_KG0 - (FUEL_KG0 / N) * (lap - 1)) * FUEL_COEFF;
const wins = g => { const x = NEU[g] || { sc: [], vsc: [] }; return [...(x.sc || []), ...(x.vsc || [])]; };
const inJson = (w, L) => w.some(([a, b]) => L >= a && L <= b);

const rows = [];
for (const g of RACES) {
  const r = JSON.parse(fs.readFileSync(`demo/data/${g}.json`, 'utf8'));
  const byLap = {}; for (const lp of r.laps) byLap[lp.lap] = lp.cars;
  const pace = r.pace, W = wins(g), N = r.n_laps, pl = pitloss[g];
  const pitLaps = {}, pitSet = {};
  for (let L = 1; L <= N; L++) if (byLap[L]) for (const d in byLap[L]) if (byLap[L][d].in_lap) (pitLaps[d] ||= []).push(L);
  for (const d in pitLaps) pitSet[d] = new Set(pitLaps[d]);
  const neutr = (d, L, E) => { for (let x = L; x <= E; x++) { if (byLap[x] && byLap[x][d] && byLap[x][d].neutralized) return true; if (inJson(W, x)) return true; } return false; };

  for (const d in pitLaps) for (const P of pitLaps[d]) {
    const L = P - 1, E = P + K;               // k=1: window [L, E=P+1], steps=2
    if (L < 1 || E >= N) continue;             // edge
    if (!byLap[L] || !byLap[L][d] || pace[String(L)] == null || pace[String(L)][d] == null) continue;
    if (typeof byLap[L][d].cum_time !== 'number' || byLap[L][d].tyre_age < TYRE_MIN) continue;
    if (!byLap[E] || !byLap[E][d] || typeof byLap[E][d].cum_time !== 'number') continue;
    if (neutr(d, L, E)) continue;              // no neutralizzazione dentro
    // doppiaggio proxy + doppio pit
    const pres = Object.keys(byLap[L]).filter(x => typeof byLap[L][x].cum_time === 'number' && pace[String(L)][x] != null && byLap[L][x].tyre_age >= TYRE_MIN);
    const leader = Math.min(...pres.map(x => byLap[L][x].cum_time));
    const lts = pres.map(x => byLap[L][x].lap_time).filter(x => typeof x === 'number').sort((a, b) => a - b);
    const medLap = lts.length ? lts[Math.floor(lts.length / 2)] : 90;
    if ((byLap[L][d].cum_time - leader) > medLap) continue;   // lapped
    let dbl = false; for (let x = P + 1; x <= E; x++) if (byLap[x] && byLap[x][d] && byLap[x][d].in_lap) dbl = true;
    if (dbl) continue;

    const state = {}; for (const x of pres) state[x] = { cum_time: byLap[L][x].cum_time };
    const fin = simulate({ state, pace: pace[String(L)], freezeLap: L, steps: 2, pit: { driver: d, lap: P, loss: pl } });
    if (fin[d] == null) continue;
    let fuel = 0; for (let l = L + 1; l <= E; l++) fuel += fuelTerm(l, N);
    const residuo = byLap[E][d].cum_time - (fin[d] + fuel);   // re-inflazionato
    // traffico al rientro (sim): gap all'auto davanti a E
    const ord = pres.filter(x => fin[x] != null).map(x => [x, fin[x]]).sort((a, b) => a[1] - b[1]);
    const idx = ord.findIndex(([x]) => x === d);
    const gapRejoin = idx > 0 ? (fin[d] - ord[idx - 1][1]) : 0;
    // delta passo-base (descrittore puro): pace[L][d] - mediana campo
    const paceRow = pace[String(L)], paces = pres.map(x => paceRow[x]).filter(x => x != null).sort((a, b) => a - b);
    const medPace = paces[Math.floor(paces.length / 2)];
    const dpace = paceRow[d] - medPace;
    const compOut = (byLap[P + 1] && byLap[P + 1][d]) ? byLap[P + 1][d].compound : '';
    const warm = WARM[compOut] ?? 0;
    // NUOVA: in-lap del rivale. Rivale = auto davanti a d al freeze. Se il rivale pitta in
    // [P-1,P+2], rival_inlap = suo lap_time dell'in-lap - suo pace di riferimento; else 0.
    const rival = idx > 0 ? ord[idx - 1][0] : null;   // usa l'ordine sim al rientro? no: davanti al FREEZE
    const ordFreeze = pres.slice().sort((a, b) => byLap[L][a].cum_time - byLap[L][b].cum_time);
    const iF = ordFreeze.indexOf(d);
    const rivalF = iF > 0 ? ordFreeze[iF - 1] : null;
    let rivalInlap = 0;
    if (rivalF) {
      let q = null; for (let x = P - 1; x <= P + 2; x++) if ((pitSet[rivalF] || new Set()).has(x)) { q = x; break; }
      if (q != null && byLap[q] && byLap[q][rivalF] && typeof byLap[q][rivalF].lap_time === 'number' && pace[String(L)][rivalF] != null)
        rivalInlap = byLap[q][rivalF].lap_time - pace[String(L)][rivalF];
    }
    rows.push([g, d, L, residuo.toFixed(4), pl.toFixed(2), gapRejoin.toFixed(4), warm.toFixed(4), dpace.toFixed(4), rivalInlap.toFixed(4)]);
  }
}
rows.sort((a, b) => String(a.slice(0, 3)).localeCompare(String(b.slice(0, 3))));
fs.writeFileSync('data/residuo_k1_covariate.csv',
  'gara,drv,L,residuo_reinfl,pitloss,gap_rejoin,warmin_out,dpace,rival_inlap\n' +
  rows.map(r => r.join(',')).join('\n') + '\n');
console.log('pit k=1 clean con covariate:', rows.length);
console.log('con rival_inlap != 0:', rows.filter(r => parseFloat(r[8]) !== 0).length, '(sparsita\' della variabile nuova)');
console.log('[scritto] data/residuo_k1_covariate.csv');
