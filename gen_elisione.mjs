// gen_elisione.mjs — E1: CERTIFICATO DI ELISIONE (bloccante). Misura, non asserisce.
// Tesi (Sessione A-bis): l'offset carburante di pace_base si ELIDE nei gap relativi (due auto
// allo stesso giro -> stessa fuel_mass -> stesso offset -> cancella nella differenza), quindi
// il motore e' sano nel suo uso proprio (gap) e il +27% e' salvo. Qui la si MISURA.
//
// Per coppie di piloti di CONTROLLO puliti (nessun pit di A o B dentro/±2 giri, nessun giro
// neutralizzato dentro, no edge di gara, no doppiaggio): residuo sul GAP =
//   gap_reale(E) - gap_simulato(E),  gap = cum(A) - cum(B),  A dietro B (B = auto davanti).
// SENZA re-inflazione carburante. Se l'elisione vale: mediana |residuo/giro| <= 0.30, e la
// versione CON re-inflazione dev'essere quasi identica (il carburante si cancella nel gap).
// Motore CHIAMATO non toccato; la re-inflazione e' una trasformazione sull'OUTPUT.
import fs from 'fs';
import { simulate } from './demo/engine.mjs';

const RACES = ['Australia','Austria','Canada','Cina','Giappone','Gran Bretagna','Miami','Monaco','Spagna'];
const KS = [1, 3, 5];
const TYRE_MIN = 3, BUFFER = 2;
const FUEL_COEFF = 3.0 / 70.0, FUEL_KG0 = 70.0;   // costanti kernel (engine.py) — lette, non modificate
const NEU = JSON.parse(fs.readFileSync('demo/neutralizzazione.json', 'utf8'));
const fuelTerm = (lap, N) => Math.max(0, FUEL_KG0 - (FUEL_KG0 / N) * (lap - 1)) * FUEL_COEFF;
const neutrWindows = g => { const x = NEU[g] || { sc: [], vsc: [] }; return [...(x.sc || []), ...(x.vsc || [])]; };
const inJson = (wins, L) => wins.some(([a, b]) => L >= a && L <= b);

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
// pulito su [L-BUFFER, E+BUFFER] per pit e [L,E] per neutralizzazione/edge/lapped
function clean(byLap, wins, pitSet, N, d, L, E) {
  if (L <= 1 || E >= N) return false;                       // edge di gara
  const set = pitSet[d] || new Set();
  for (let x = L - BUFFER; x <= E + BUFFER; x++) if (set.has(x)) return false;   // pit di d
  for (let x = L; x <= E; x++) {
    if (byLap[x] && byLap[x][d] && byLap[x][d].neutralized) return false;
    if (inJson(wins, x)) return false;
    if (!byLap[x] || !byLap[x][d] || typeof byLap[x][d].cum_time !== 'number') return false;
  }
  return true;
}

const rows = [];
for (const g of RACES) {
  const { r, byLap } = loadRace(g);
  const pace = r.pace, wins = neutrWindows(g), N = r.n_laps;
  const pitLaps = {}; const pitSet = {};
  for (let L = 1; L <= N; L++) if (byLap[L]) for (const d in byLap[L]) if (byLap[L][d].in_lap) (pitLaps[d] ||= []).push(L);
  for (const d in pitLaps) pitSet[d] = new Set(pitLaps[d]);

  for (let L = 2; L <= N; L++) {
    const pres = present(byLap, pace, L);
    if (pres.length < 2) continue;
    // ordine reale al freeze (cum crescente = piu' avanti)
    const ordL = pres.slice().sort((a, b) => byLap[L][a].cum_time - byLap[L][b].cum_time);
    // leader per il proxy-doppiaggio
    const leaderCum = byLap[L][ordL[0]].cum_time;
    const lapTimes = pres.map(d => byLap[L][d].lap_time).filter(x => typeof x === 'number').sort((a, b) => a - b);
    const medLap = lapTimes.length ? lapTimes[Math.floor(lapTimes.length / 2)] : 90;
    for (const k of KS) {
      const steps = k + 1, E = L + steps;
      if (E > N) continue;
      // una simulazione per (L,k): tutti i piloti, pit=null
      const state = {}; for (const d of pres) state[d] = { cum_time: byLap[L][d].cum_time };
      const fin = simulate({ state, pace: pace[String(L)], freezeLap: L, steps, pit: null });
      // termine carburante dei giri L+1..E (identico per ogni pilota che avanza gli stessi giri)
      let fuel = 0; for (let l = L + 1; l <= E; l++) fuel += fuelTerm(l, N);
      for (let i = 1; i < ordL.length; i++) {
        const A = ordL[i], B = ordL[i - 1];               // A dietro B (B davanti)
        // entrambi puliti e simulabili fino a E
        if (!clean(byLap, wins, pitSet, N, A, L, E) || !clean(byLap, wins, pitSet, N, B, L, E)) continue;
        if (fin[A] == null || fin[B] == null) continue;
        // proxy doppiaggio: A o B > 1 giro dietro il leader al freeze
        if ((byLap[L][A].cum_time - leaderCum) > medLap || (byLap[L][B].cum_time - leaderCum) > medLap) continue;
        const gapReal = byLap[E][A].cum_time - byLap[E][B].cum_time;
        const gapSim = fin[A] - fin[B];                    // SENZA re-inflazione
        const gapSimReinf = (fin[A] + fuel) - (fin[B] + fuel);  // CON re-inflazione (fuel identico -> cancella)
        rows.push([g, A, B, k, L, (gapReal - gapSim).toFixed(4), (gapReal - gapSimReinf).toFixed(4),
          ((gapReal - gapSim) / steps).toFixed(4)]);
      }
    }
  }
}
rows.sort((a, b) => String(a.slice(0, 5)).localeCompare(String(b.slice(0, 5))));
fs.writeFileSync('data/residuo_gap_controllo.csv',
  'gara,A,B,k,L,residuo_gap,residuo_gap_reinfl,residuo_gap_perlap\n' +
  rows.map(r => r.join(',')).join('\n') + '\n');
console.log('coppie di controllo pulite:', rows.length);
console.log('[scritto] data/residuo_gap_controllo.csv');
