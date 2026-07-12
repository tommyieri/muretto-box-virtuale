// gen_pitloss_calibrato.mjs — Sessione D: calibra il pit-loss per RESIDUO (split-half) e
// RI-FA GIRARE il motore sul set TEST due volte (nominale, calibrato). Motore CHIAMATO non
// toccato; pit_loss_circuito_f1db.csv NON sostituito (il calibrato e' un file NUOVO affiancato).
//
// D1 (dimostrato sul codice, engine.mjs:32 unico termine pit): nei giri L->L+1 il motore
// inietta SOLO pit.loss. Quindi errore_pitloss = residuo_pit_k1 - mediana(residuo_controllo_k1
// stesso pilota/gara) = errore del pit-loss (esecuzione reale - loss nominale).
// D2 split-half deterministico: per circuito, stop ordinati per (giro, pilota); indici PARI=FIT,
// DISPARI=TEST. Nessun seed. D3 calibrato = nominale + MEDIANA(errore su FIT). D4 validazione:
// re-run del motore sul TEST con loss nominale vs calibrato (residuo re-inflazionato).
import fs from 'fs';
import { simulate } from './demo/engine.mjs';

const RACES = {  // gara -> [cid, nominale f1db]
  'Australia': ['melbourne', 18.15], 'Austria': ['spielberg', 21.63], 'Canada': ['montreal', 24.37],
  'Cina': ['shanghai', 22.97], 'Giappone': ['suzuka', 23.72], 'Gran Bretagna': ['silverstone', 29.12],
  'Miami': ['miami', 22.63], 'Monaco': ['monaco', 24.8], 'Spagna': ['catalunya', 22.38],
};
const TYRE_MIN = 3, BUFFER = 2, K = 1;
const FUEL_COEFF = 3.0 / 70.0, FUEL0 = 70.0;
const NEU = JSON.parse(fs.readFileSync('demo/neutralizzazione.json', 'utf8'));
const fuelTerm = (lap, N) => Math.max(0, FUEL0 - (FUEL0 / N) * (lap - 1)) * FUEL_COEFF;
const wins = g => { const x = NEU[g] || { sc: [], vsc: [] }; return [...(x.sc || []), ...(x.vsc || [])]; };
const inJson = (w, L) => w.some(([a, b]) => L >= a && L <= b);
const median = a => { if (!a.length) return null; const s = [...a].sort((x, y) => x - y); const m = s.length >> 1; return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; };

function loadRace(g) {
  const r = JSON.parse(fs.readFileSync(`demo/data/${g}.json`, 'utf8'));
  const byLap = {}; for (const lp of r.laps) byLap[lp.lap] = lp.cars;
  return { r, byLap };
}
function present(byLap, pace, L) {
  if (!byLap[L] || !pace[String(L)]) return [];
  return Object.keys(byLap[L]).filter(d => typeof byLap[L][d].cum_time === 'number'
    && pace[String(L)][d] != null && byLap[L][d].tyre_age >= TYRE_MIN);
}
// residuo re-inflazionato di una finestra [L, E=L+steps] per il pilota, con un dato pit
function residuo(byLap, pace, N, L, steps, drv, pit) {
  const pres = present(byLap, pace, L);
  if (!pres.includes(drv)) return null;
  const state = {}; for (const d of pres) state[d] = { cum_time: byLap[L][d].cum_time };
  const fin = simulate({ state, pace: pace[String(L)], freezeLap: L, steps, pit });
  const E = L + steps;
  if (fin[drv] == null || !byLap[E] || !byLap[E][drv] || typeof byLap[E][drv].cum_time !== 'number') return null;
  let fuel = 0; for (let l = L + 1; l <= E; l++) fuel += fuelTerm(l, N);
  return byLap[E][drv].cum_time - (fin[drv] + fuel);
}
function clean(byLap, wins_, N, drv, L, E, pitSet, isPit, P) {
  if (L < 1 || E >= N) return false;
  for (let x = L; x <= E; x++) {
    if (!byLap[x] || !byLap[x][drv] || typeof byLap[x][drv].cum_time !== 'number') return false;
    if (byLap[x][drv].neutralized || inJson(wins_, x)) return false;
  }
  const pres = present(byLap, { [String(L)]: null }, L); // solo per leader/medLap sotto
  return true;
}

// pass 1: raccogli residui nominali (pit) e controllo, per circuito
const stopsPit = [];      // {gara,cid,drv,P,resNom,ctrlBase(fill dopo)}
const ctrlByDrv = {};     // gara -> drv -> [residui controllo]
for (const g of Object.keys(RACES)) {
  const [cid, nom] = RACES[g];
  const { r, byLap } = loadRace(g);
  const pace = r.pace, W = wins(g), N = r.n_laps;
  const pitLaps = {}, pitSet = {};
  for (let L = 1; L <= N; L++) if (byLap[L]) for (const d in byLap[L]) if (byLap[L][d].in_lap) (pitLaps[d] ||= []).push(L);
  for (const d in pitLaps) pitSet[d] = new Set(pitLaps[d]);
  const lapEdge = (drv, L, E) => {
    const pres = present(byLap, pace, L);
    const leader = Math.min(...pres.map(x => byLap[L][x].cum_time));
    const lts = pres.map(x => byLap[L][x].lap_time).filter(x => typeof x === 'number').sort((a, b) => a - b);
    const medLap = lts.length ? lts[medIdx(lts.length)] : 90;
    return (byLap[L][drv].cum_time - leader) > medLap;   // lapped
  };
  function medIdx(n) { return Math.floor(n / 2); }
  // controllo k1
  for (const d of r.drivers) for (let L = 2; L <= N; L++) {
    const E = L + (K + 1);
    if (E > N || !byLap[L] || !byLap[L][d]) continue;
    let near = false; const set = pitSet[d] || new Set();
    for (let x = L - BUFFER; x <= E + BUFFER; x++) if (set.has(x)) { near = true; break; }
    if (near) continue;
    if (pace[String(L)] == null || pace[String(L)][d] == null || typeof byLap[L][d].cum_time !== 'number' || byLap[L][d].tyre_age < TYRE_MIN) continue;
    if (!clean(byLap, W, N, d, L, E, pitSet, false)) continue;
    if (lapEdge(d, L, E)) continue;
    const res = residuo(byLap, pace, N, L, K + 1, d, null);
    if (res == null) continue;
    ((ctrlByDrv[g] ||= {})[d] ||= []).push(res);
  }
  // pit k1
  for (const d in pitLaps) for (const P of pitLaps[d]) {
    const L = P - 1, E = P + K;
    if (L < 1 || E >= N || !byLap[L] || !byLap[L][d]) continue;
    if (pace[String(L)] == null || pace[String(L)][d] == null || typeof byLap[L][d].cum_time !== 'number' || byLap[L][d].tyre_age < TYRE_MIN) continue;
    if (!clean(byLap, W, N, d, L, E, pitSet, true, P)) continue;
    if (lapEdge(d, L, E)) continue;
    let dbl = false; for (let x = P + 1; x <= E; x++) if (byLap[x] && byLap[x][d] && byLap[x][d].in_lap) dbl = true;
    if (dbl) continue;
    const resNom = residuo(byLap, pace, N, L, K + 1, d, { driver: d, lap: P, loss: nom });
    if (resNom == null) continue;
    stopsPit.push({ gara: g, cid, drv: d, P, resNom });
  }
}
// control base per (gara,drv), fallback mediana gara
const ctrlRaceMed = {};
for (const g in ctrlByDrv) ctrlRaceMed[g] = median(Object.values(ctrlByDrv[g]).flat());
const ctrlBase = (g, d) => (ctrlByDrv[g] && ctrlByDrv[g][d] && ctrlByDrv[g][d].length) ? median(ctrlByDrv[g][d]) : (ctrlRaceMed[g] ?? 0);
for (const s of stopsPit) { s.ctrlBase = ctrlBase(s.gara, s.drv); s.errore = s.resNom - s.ctrlBase; }

// split-half deterministico per circuito + calibrazione su FIT
const perCirc = {};
for (const s of stopsPit) (perCirc[s.gara] ||= []).push(s);
const calib = {};
for (const g of Object.keys(RACES)) {
  const arr = (perCirc[g] || []).sort((a, b) => (a.P - b.P) || (a.drv < b.drv ? -1 : 1));
  arr.forEach((s, i) => s.split = (i % 2 === 0) ? 'fit' : 'test');
  const fitErr = arr.filter(s => s.split === 'fit').map(s => s.errore);
  const corr = fitErr.length ? median(fitErr) : 0;
  calib[g] = { cid: RACES[g][0], nom: RACES[g][1], corr, cal: RACES[g][1] + corr,
    n_fit: arr.filter(s => s.split === 'fit').length, n_test: arr.filter(s => s.split === 'test').length };
}
// re-run motore sul TEST con loss calibrata
for (const g of Object.keys(RACES)) {
  const { r, byLap } = loadRace(g); const pace = r.pace, N = r.n_laps;
  for (const s of (perCirc[g] || []).filter(s => s.split === 'test')) {
    s.resCal = residuo(byLap, pace, N, s.P - 1, K + 1, s.drv, { driver: s.drv, lap: s.P, loss: calib[g].cal });
  }
}

// scrittura deterministica
const stops = stopsPit.sort((a, b) => (a.gara < b.gara ? -1 : a.gara > b.gara ? 1 : 0) || (a.P - b.P) || (a.drv < b.drv ? -1 : 1));
fs.writeFileSync('data/pitloss_stops_k1.csv',
  'gara,cid,drv,P,split,residuo_nom,residuo_cal,errore,control_base\n' +
  stops.map(s => [s.gara, s.cid, s.drv, s.P, s.split, s.resNom.toFixed(4),
    s.resCal == null ? '' : s.resCal.toFixed(4), s.errore.toFixed(4), s.ctrlBase.toFixed(4)].join(',')).join('\n') + '\n');
fs.writeFileSync('data/pitloss_calibrato_circuito.csv',
  'gara,cid,nominale,correzione,calibrato,n_fit,n_test\n' +
  Object.keys(RACES).map(g => [g, calib[g].cid, calib[g].nom.toFixed(2), calib[g].corr.toFixed(3),
    calib[g].cal.toFixed(2), calib[g].n_fit, calib[g].n_test].join(',')).join('\n') + '\n');
console.log('stop pit k1 clean:', stops.length, '| controllo per (gara,drv) raccolto');
for (const g of Object.keys(RACES)) console.log(`  ${g.padEnd(14)} nom=${calib[g].nom.toFixed(2)} corr=${calib[g].corr.toFixed(2)} cal=${calib[g].cal.toFixed(2)} n_fit=${calib[g].n_fit} n_test=${calib[g].n_test}`);
console.log('[scritto] data/pitloss_stops_k1.csv, data/pitloss_calibrato_circuito.csv');
