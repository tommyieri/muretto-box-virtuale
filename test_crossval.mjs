import { evaluatePit } from './demo/pitscenario.mjs';
import fs from 'fs';

function loadGara(nome){
  const d = JSON.parse(fs.readFileSync(`./demo/data/${nome}.json`,'utf8'));
  const byLap = {};
  for (const row of d.laps){ byLap[row.lap]={}; for(const drv in row.cars) byLap[row.lap][drv]=row.cars[drv]; }
  return { d, byLap, nLaps:d.n_laps };
}

// casi scelti per STRESSARE i campi nuovi, non solo confermare Austria
const casi = [
  // gara,      freeze, pitLap, driver, pitLoss, perche'
  ['Austria',   30, 34, 'VER', 21.63, 'baseline gia validato (verde, HARD)'],
  ['Monaco',    55, 60, 'LEC', 24.80, 'PIT DENTRO finestra SC 58-70 -> deve accendersi'],
  ['Monaco',    40, 45, 'NOR', 24.80, 'pit PRIMA della SC -> finestra_attiva false'],
  ['Australia', 15, 18, 'RUS', 18.15, 'PIT DENTRO finestra VSC 18-19 -> tipo VSC'],
  ['Spagna',    58, 62, 'HAM', 22.38, 'PIT DENTRO finestra VSC 61-65 -> tipo VSC'],
  ['Miami',      8, 10, 'PIA', 22.63, 'PIT DENTRO finestra SC 5-11 -> tipo SC'],
  ['Giappone',  30, 34, 'HAD', 23.72, 'pit fuori finestra, compound da verificare'],
];

for (const [gara, L, pitLap, driver, pitLoss, perche] of casi){
  let out;
  try{
    const { d, byLap, nLaps } = loadGara(gara);
    const pace = d.pace[String(L)];
    if(!pace){ console.log(`\n[${gara}] freeze ${L}: pace mancante — SKIP`); continue; }
    const present = Object.keys(byLap[L]||{});
    if(!byLap[L] || !byLap[L][driver]){ console.log(`\n[${gara}] ${driver} non in pista giro ${L} — SKIP`); continue; }
    const r = evaluatePit({ byLap, nLaps, pace, driver, freezeLap:L, pitLap, pitLoss, present, gara, laps:d.laps });
    out = r;
    console.log(`\n=== ${gara} | ${driver} freeze${L} pit${pitLap} ===  (${perche})`);
    if(!r.ok){ console.log('  ok:false reason:', r.reason); continue; }
    console.log(`  rientro: P${r.rientro_pos}/${r.su_totale} | davanti ${r.davanti_ho}(+${r.gap_ahead?.toFixed(1)}) | dietro ${r.dietro_esco??'—'}(${r.gap_behind?('+'+r.gap_behind.toFixed(1)):'—'})`);
    const w = r.warmin_rientro;
    console.log(`  warm-in: ${w.compound} g0 ${w.penalita_g0} g1 ${w.penalita_g1}`);
    const n = r.neutralizzazione_gara;
    console.log(`  neutralizz: attiva=${n.finestra_attiva} tipo=${n.tipo??'—'} finestra=${n.finestra?JSON.stringify(n.finestra):'—'} durata=${n.durata_tipica??'—'}`);
  }catch(e){
    console.log(`\n[${gara}] ECCEZIONE: ${e.message}`);
  }
}
console.log('\n--- fine cross-val ---');
