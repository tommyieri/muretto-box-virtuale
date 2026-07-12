// gen_residuo_pit.mjs — PASSO 1-2: costruisce le due popolazioni (CON pit / SENZA pit) e
// misura il RESIDUO del motore congelato (reale - simulato) per pilota, a k=1,3,5.
// Il motore va CHIAMATO, non toccato: importa simulate da demo/engine.mjs (congelato).
// Nessun modello. Solo misura. Scrive data/residuo_pit.csv e data/residuo_controllo.csv.
//
// CONVENZIONE ORIZZONTI (dichiarata): pit reale = in_lap al giro P. freeze L = P-1 (ultimo
// stato verde prima della sosta). Iniezione pit al giro P (semantica del modulo pit),
// endpoint E = P + k, steps = k + 1. Cosi' k=1 copre in+out-lap (esecuzione sosta), k=5
// include passo/degrado; la pit-loss NOMINALE del circuito e' sempre creditata dentro la
// finestra -> il residuo e' pura deviazione di ESECUZIONE dal modello nominale.
// Controllo (SENZA pit): stessa lunghezza finestra (steps = k+1), pit=null.
//
// METRICA PRIMARIA (per-pilota, non contaminabile dai pit altrui):
//   residuo = cum_time REALE del pilota a E  -  cum_time SIMULATO a E  (secondi).
// Ancorati entrambi allo stato reale al freeze L.
import fs from 'fs';
import { simulate } from './demo/engine.mjs';

const RACES = ['Australia','Austria','Canada','Cina','Giappone','Gran Bretagna','Miami','Monaco','Spagna'];
const KS = [1, 3, 5];
const TYRE_MIN = 3;           // stint/gomma con >=3 giri al freeze (simulabilita', dichiarato)
const BUFFER = 2;            // controllo: nessun pit del pilota entro 2 giri prima/dopo la finestra
const pitloss = JSON.parse(fs.readFileSync('demo/data/pitloss.json', 'utf8'));
const NEU = JSON.parse(fs.readFileSync('demo/neutralizzazione.json', 'utf8'));

const excl = { no_freeze:0, no_pace:0, tyre:0, no_endpoint:0, neutralizzato:0, doppio_pit:0 };
const exclCtrl = { no_pace:0, tyre:0, no_endpoint:0, neutralizzato:0, pit_vicino:0 };

function loadRace(g) {
  const r = JSON.parse(fs.readFileSync(`demo/data/${g}.json`, 'utf8'));
  const byLap = {}; for (const lp of r.laps) byLap[lp.lap] = lp.cars;
  return { r, byLap };
}
function neutrWindows(g) {
  const x = NEU[g] || { sc: [], vsc: [] };
  return [...(x.sc || []), ...(x.vsc || [])];
}
// un giro L e' neutralizzato per drv se ha il flag per-auto o cade in una finestra SC/VSC di gara
function isNeutr(byLap, wins, drv, L) {
  if (byLap[L] && byLap[L][drv] && byLap[L][drv].neutralized) return true;
  return wins.some(([a, b]) => L >= a && L <= b);
}
function present(byLap, pace, L) {
  if (!byLap[L] || !pace[String(L)]) return [];
  return Object.keys(byLap[L]).filter(d =>
    typeof byLap[L][d].cum_time === 'number' && pace[String(L)][d] != null);
}
// residuo per-pilota: reale(E) - simulato(E), sim ancorata allo stato reale al freeze L
function residuo(byLap, pace, L, steps, drv, pit) {
  const pres = present(byLap, pace, L);
  if (!pres.includes(drv)) return null;
  const state = {}; for (const d of pres) state[d] = { cum_time: byLap[L][d].cum_time };
  const fin = simulate({ state, pace: pace[String(L)], freezeLap: L, steps, pit });
  const E = L + steps;
  if (fin[drv] == null || !byLap[E] || !byLap[E][drv] || typeof byLap[E][drv].cum_time !== 'number')
    return null;
  // diagnostica: gap al rientro (sim) e cambio del pilota davanti (reale) nella finestra
  const simCum = fin[drv];
  const ord = pres.filter(d => fin[d] != null).map(d => [d, fin[d]]).sort((a, b) => a[1] - b[1]);
  const idx = ord.findIndex(([d]) => d === drv);
  const gapRejoin = idx > 0 ? (simCum - ord[idx - 1][1]) : null;
  const aheadReal = (lap) => {
    const o = pres.filter(d => byLap[lap] && byLap[lap][d] && typeof byLap[lap][d].cum_time === 'number')
      .map(d => [d, byLap[lap][d].cum_time]).sort((a, b) => a[1] - b[1]);
    const i = o.findIndex(([d]) => d === drv); return i > 0 ? o[i - 1][0] : null;
  };
  const cambioDavanti = (byLap[E] && byLap[L]) ? (aheadReal(L) !== aheadReal(E) ? 1 : 0) : 0;
  // descrittore osservato: delta passo-base pre-pit (pace del pilota - mediana campo al freeze)
  const paceRow = pace[String(L)];
  const paces = pres.map(d => paceRow[d]).filter(x => x != null).sort((a, b) => a - b);
  const medPace = paces.length ? paces[Math.floor(paces.length / 2)] : null;
  const dpace = (paceRow[drv] != null && medPace != null) ? (paceRow[drv] - medPace) : null;
  return { residuo: byLap[E][drv].cum_time - simCum, gapRejoin, cambioDavanti, dpace };
}

const rowsPit = [], rowsCtrl = [];
for (const g of RACES) {
  const { r, byLap } = loadRace(g);
  const pace = r.pace, wins = neutrWindows(g), pl = pitloss[g];
  const nLaps = r.n_laps;
  // indicizza i pit (in_lap) per pilota
  const pitLaps = {};
  for (let L = 1; L <= nLaps; L++) if (byLap[L]) for (const d in byLap[L])
    if (byLap[L][d].in_lap) (pitLaps[d] ||= []).push(L);

  // ---------- POPOLAZIONE A: CON PIT ----------
  for (const d in pitLaps) for (const P of pitLaps[d]) {
    const L = P - 1;
    if (L < 1 || !byLap[L] || !byLap[L][d]) { excl.no_freeze++; continue; }
    if (pace[String(L)] == null || pace[String(L)][d] == null || typeof byLap[L][d].cum_time !== 'number') { excl.no_pace++; continue; }
    if (!(byLap[L][d].tyre_age >= TYRE_MIN)) { excl.tyre++; continue; }
    for (const k of KS) {
      const E = P + k, steps = k + 1;
      if (!byLap[E] || !byLap[E][d] || typeof byLap[E][d].cum_time !== 'number') { excl.no_endpoint++; continue; }
      // esclusione SC/VSC su tutta la finestra [L,E] (o il pit)
      let neu = false; for (let x = L; x <= E; x++) if (isNeutr(byLap, wins, d, x)) { neu = true; break; }
      if (neu) { excl.neutralizzato++; continue; }
      // niente secondo pit del pilota dentro (P escluso)
      let dbl = false; for (let x = P + 1; x <= E; x++) if (byLap[x] && byLap[x][d] && byLap[x][d].in_lap) { dbl = true; break; }
      if (dbl) { excl.doppio_pit++; continue; }
      const res = residuo(byLap, pace, L, steps, d, { driver: d, lap: P, loss: pl });
      if (res == null) { excl.no_endpoint++; continue; }
      const comp = (byLap[P + 1] && byLap[P + 1][d]) ? byLap[P + 1][d].compound : (byLap[P][d] ? byLap[P][d].compound : '');
      rowsPit.push([g, d, k, L, P, comp, pl, res.residuo.toFixed(4),
        res.gapRejoin == null ? '' : res.gapRejoin.toFixed(4), res.dpace == null ? '' : res.dpace.toFixed(4), res.cambioDavanti]);
    }
  }

  // ---------- POPOLAZIONE B: CONTROLLO (SENZA PIT) ----------
  const pitSet = {}; for (const d in pitLaps) pitSet[d] = new Set(pitLaps[d]);
  const drivers = r.drivers;
  for (const d of drivers) {
    for (let L = 2; L <= nLaps; L++) {
      if (!byLap[L] || !byLap[L][d]) continue;
      for (const k of KS) {
        const steps = k + 1, E = L + steps;
        if (E > nLaps) continue;
        // controllo: nessun pit del pilota in [L-BUFFER, E+BUFFER]
        let near = false;
        const set = pitSet[d] || new Set();
        for (let x = L - BUFFER; x <= E + BUFFER; x++) if (set.has(x)) { near = true; break; }
        if (near) { exclCtrl.pit_vicino++; continue; }
        if (pace[String(L)] == null || pace[String(L)][d] == null || typeof byLap[L][d].cum_time !== 'number') { exclCtrl.no_pace++; continue; }
        if (!(byLap[L][d].tyre_age >= TYRE_MIN)) { exclCtrl.tyre++; continue; }
        if (!byLap[E] || !byLap[E][d] || typeof byLap[E][d].cum_time !== 'number') { exclCtrl.no_endpoint++; continue; }
        let neu = false; for (let x = L; x <= E; x++) if (isNeutr(byLap, wins, d, x)) { neu = true; break; }
        if (neu) { exclCtrl.neutralizzato++; continue; }
        const res = residuo(byLap, pace, L, steps, d, null);
        if (res == null) { exclCtrl.no_endpoint++; continue; }
        rowsCtrl.push([g, d, k, L, res.residuo.toFixed(4),
          res.dpace == null ? '' : res.dpace.toFixed(4), res.cambioDavanti]);
      }
    }
  }
}

// writer deterministico (ordina le righe)
rowsPit.sort((a, b) => String([a[0], a[1], a[2], a[4]]).localeCompare(String([b[0], b[1], b[2], b[4]])));
rowsCtrl.sort((a, b) => String([a[0], a[1], a[2], a[3]]).localeCompare(String([b[0], b[1], b[2], b[3]])));
fs.writeFileSync('data/residuo_pit.csv',
  'gara,drv,k,freeze_L,pit_P,compound_out,pitloss,residuo,gap_rejoin_sim,dpace_prepit,cambio_davanti\n' +
  rowsPit.map(r => r.join(',')).join('\n') + '\n');
fs.writeFileSync('data/residuo_controllo.csv',
  'gara,drv,k,freeze_L,residuo,dpace_prepit,cambio_davanti\n' +
  rowsCtrl.map(r => r.join(',')).join('\n') + '\n');

console.log('POPOLAZIONI (metrica primaria per-pilota, residuo reale-simulato in secondi)');
console.log('  CON pit   : righe', rowsPit.length, '| esclusi', JSON.stringify(excl));
console.log('  SENZA pit : righe', rowsCtrl.length, '| esclusi', JSON.stringify(exclCtrl));
for (const k of KS) {
  const np = rowsPit.filter(r => r[2] === k).length, nc = rowsCtrl.filter(r => r[2] === k).length;
  console.log(`  k=${k}: CON pit ${np} | SENZA pit ${nc}`);
}
console.log('[scritto] data/residuo_pit.csv , data/residuo_controllo.csv');
