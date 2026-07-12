// gen_residuo_diagnostica.mjs — DEBUG della misura del residuo (Sessione B). NON tocca il
// motore (import simulate). NON cambia KPI/soglie/orizzonti/definizioni: ricostruisce le
// stesse finestre della Sessione A, ma INSTRUMENTATE, per trovare la causa del residuo ~2 s/giro.
//
// Differenza vs Sessione A: NON pre-esclude le finestre neutralizzate (le FLAGGA), cosi' D2
// misura il prima/dopo. Aggiunge il residuo con CARBURANTE RE-INFLAZIONATO (controprova D4):
// il kernel usa pace_base = passo FUEL-CORRETTO (serbatoio vuoto, engine.py:47-48,
// FUEL_COEFF=3/70); simulate lo applica piatto senza ri-aggiungere il peso -> il residuo
// dovrebbe essere il termine carburante fuel_mass(L)*(3/70). Re-inflazionandolo (con la
// STESSA formula del kernel, non modificandolo) il residuo deve crollare se il carburante e'
// la causa. Scrive data/residuo_diagnostica_windows.csv (per-finestra, deterministico).
import fs from 'fs';
import { simulate } from './demo/engine.mjs';

const RACES = ['Australia','Austria','Canada','Cina','Giappone','Gran Bretagna','Miami','Monaco','Spagna'];
const KS = [1, 3, 5];
const TYRE_MIN = 3, BUFFER = 2;
const FUEL_COEFF = 3.0 / 70.0, FUEL_KG0 = 70.0;   // costanti del kernel (engine.py:40,48) — lette, non modificate
const pitloss = JSON.parse(fs.readFileSync('demo/data/pitloss.json', 'utf8'));
const NEU = JSON.parse(fs.readFileSync('demo/neutralizzazione.json', 'utf8'));

const fuelTerm = (lap, N) => Math.max(0, FUEL_KG0 - (FUEL_KG0 / N) * (lap - 1)) * FUEL_COEFF;

function loadRace(g) {
  const r = JSON.parse(fs.readFileSync(`demo/data/${g}.json`, 'utf8'));
  const byLap = {}; for (const lp of r.laps) byLap[lp.lap] = lp.cars;
  return { r, byLap };
}
const neutrWindows = g => { const x = NEU[g] || { sc: [], vsc: [] }; return [...(x.sc || []), ...(x.vsc || [])]; };
const inJson = (wins, L) => wins.some(([a, b]) => L >= a && L <= b);
function present(byLap, pace, L) {
  if (!byLap[L] || !pace[String(L)]) return [];
  return Object.keys(byLap[L]).filter(d => typeof byLap[L][d].cum_time === 'number' && pace[String(L)][d] != null);
}
// residuo cumulato reale-sim + versione con carburante re-inflazionato + flag contaminanti
function measure(byLap, pace, wins, N, L, steps, drv, pit) {
  const pres = present(byLap, pace, L);
  if (!pres.includes(drv)) return null;
  const state = {}; for (const d of pres) state[d] = { cum_time: byLap[L][d].cum_time };
  const fin = simulate({ state, pace: pace[String(L)], freezeLap: L, steps, pit });
  const E = L + steps;
  if (fin[drv] == null || !byLap[E] || !byLap[E][drv] || typeof byLap[E][drv].cum_time !== 'number') return null;
  const realCum = byLap[E][drv].cum_time - byLap[L][drv].cum_time;   // delta reale su [L,E]
  const simCum = fin[drv] - byLap[L][drv].cum_time;                 // delta simulato su [L,E]
  let fuel = 0; for (let l = L + 1; l <= E; l++) fuel += fuelTerm(l, N); // termine carburante del kernel
  // contaminanti (flag, non esclusioni qui)
  let nFlag = 0, nJson = 0;
  for (let l = L; l <= E; l++) {
    if (byLap[l] && byLap[l][drv] && byLap[l][drv].neutralized) nFlag++;
    if (inJson(wins, l)) nJson++;
  }
  const edge = (L <= 1 || E >= N) ? 1 : 0;
  // lapped: al freeze il pilota e' > 1 giro dietro il leader (proxy dichiarato)
  const leader = Math.min(...pres.map(d => byLap[L][d].cum_time));
  const lapTimes = pres.map(d => byLap[L][d].lap_time).filter(x => typeof x === 'number').sort((a, b) => a - b);
  const medLap = lapTimes.length ? lapTimes[Math.floor(lapTimes.length / 2)] : 90;
  const lapped = (byLap[L][drv].cum_time - leader) > medLap ? 1 : 0;
  return {
    residuo_cum: realCum - simCum,
    residuo_cum_fuel: realCum - (simCum + fuel),   // re-inflazionato
    steps, nFlag, nJson, edge, lapped,
  };
}

const rows = [];
let totPit = 0;
const census = { tot_pit: 0, no_freeze: 0, no_pace: 0, tyre: 0 };
for (const g of RACES) {
  const { r, byLap } = loadRace(g);
  const pace = r.pace, wins = neutrWindows(g), pl = pitloss[g], N = r.n_laps;
  const pitLaps = {};
  for (let L = 1; L <= N; L++) if (byLap[L]) for (const d in byLap[L]) if (byLap[L][d].in_lap) (pitLaps[d] ||= []).push(L);

  // CON PIT (senza pre-escludere neutralizzazione: flaggata)
  for (const d in pitLaps) for (const P of pitLaps[d]) {
    census.tot_pit++; totPit++;
    const L = P - 1;
    if (L < 1 || !byLap[L] || !byLap[L][d]) { census.no_freeze++; continue; }
    if (pace[String(L)] == null || pace[String(L)][d] == null || typeof byLap[L][d].cum_time !== 'number') { census.no_pace++; continue; }
    if (!(byLap[L][d].tyre_age >= TYRE_MIN)) { census.tyre++; continue; }
    for (const k of KS) {
      const steps = k + 1, E = P + k;
      if (!byLap[E] || !byLap[E][d] || typeof byLap[E][d].cum_time !== 'number') continue;
      let dbl = false; for (let x = P + 1; x <= E; x++) if (byLap[x] && byLap[x][d] && byLap[x][d].in_lap) { dbl = true; break; }
      if (dbl) continue;
      const m = measure(byLap, pace, wins, N, L, steps, d, { driver: d, lap: P, loss: pl });
      if (m) rows.push(['pit', g, d, k, L, E, m.residuo_cum.toFixed(4), m.residuo_cum_fuel.toFixed(4), m.nFlag, m.nJson, m.edge, m.lapped]);
    }
  }
  // CONTROLLO
  const pitSet = {}; for (const d in pitLaps) pitSet[d] = new Set(pitLaps[d]);
  for (const d of r.drivers) for (let L = 2; L <= N; L++) {
    if (!byLap[L] || !byLap[L][d]) continue;
    for (const k of KS) {
      const steps = k + 1, E = L + steps;
      if (E > N) continue;
      let near = false; const set = pitSet[d] || new Set();
      for (let x = L - BUFFER; x <= E + BUFFER; x++) if (set.has(x)) { near = true; break; }
      if (near) continue;
      if (pace[String(L)] == null || pace[String(L)][d] == null || typeof byLap[L][d].cum_time !== 'number') continue;
      if (!(byLap[L][d].tyre_age >= TYRE_MIN)) continue;
      if (!byLap[E] || !byLap[E][d] || typeof byLap[E][d].cum_time !== 'number') continue;
      const m = measure(byLap, pace, wins, N, L, steps, d, null);
      if (m) rows.push(['ctrl', g, d, k, L, E, m.residuo_cum.toFixed(4), m.residuo_cum_fuel.toFixed(4), m.nFlag, m.nJson, m.edge, m.lapped]);
    }
  }
}
rows.sort((a, b) => String(a.slice(0, 5)).localeCompare(String(b.slice(0, 5))));
fs.writeFileSync('data/residuo_diagnostica_windows.csv',
  'pop,gara,drv,k,L,E,residuo_cum,residuo_cum_fuel,n_neu_flag,n_neu_json,edge,lapped\n' +
  rows.map(r => r.join(',')).join('\n') + '\n');
console.log('finestre instrumentate:', rows.length, '| pit reali totali (in_lap):', totPit);
console.log('census pit:', JSON.stringify(census));
console.log('[scritto] data/residuo_diagnostica_windows.csv');
