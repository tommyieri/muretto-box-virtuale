// test_pit.mjs — verifica che l'output pit corrente combaci col golden congelato.
// Fallisce (exit 1) al primo scostamento. Da eseguire dopo test_b.py && test_b.mjs.
import { evaluatePit } from './pitscenario.mjs';
import fs from 'fs';

const GOLDEN = JSON.parse(fs.readFileSync('./golden_pit.json','utf8'));
const CASI   = JSON.parse(fs.readFileSync('./golden_pit_casi.json','utf8'));
const pitloss= JSON.parse(fs.readFileSync('./data/pitloss.json','utf8'));

const raceCache={};
function loadRace(gara){
  if(raceCache[gara]) return raceCache[gara];
  const r=JSON.parse(fs.readFileSync(`./data/${gara}.json`,'utf8'));
  r.byLap={}; for(const lp of r.laps) r.byLap[lp.lap]=lp.cars;
  raceCache[gara]=r; return r;
}
const present=(r,L)=>Object.keys(r.byLap[L]).filter(d=>typeof r.byLap[L][d].cum_time==='number');

const CAMPI=['ok','rientro_pos','su_totale','davanti_ho','gap_ahead','dietro_esco','gap_behind','sotto_neutralizzazione','giro_neutralizzato'];
const near=(a,b)=>{ if(a==null&&b==null)return true; if(typeof a==='number'&&typeof b==='number')return Math.abs(a-b)<1e-9; return a===b; };

let fail=0;
for(let i=0;i<CASI.length;i++){
  const c=CASI[i], g=GOLDEN[i], r=loadRace(c.gara), L=c.freezeLap;
  const res=evaluatePit({ byLap:r.byLap,nLaps:r.n_laps,pace:r.pace[String(L)],
    driver:c.driver,freezeLap:L,pitLap:c.pitLap,pitLoss:(pitloss[c.gara]??22.0),
    present:present(r,L),gara:c.gara,laps:r.laps });
  for(const k of CAMPI){
    const got=res[k]??null, exp=g[k]??null;
    if(!near(got,exp)){ console.error(`FAIL ${g.caso} campo ${k}: atteso ${exp} ottenuto ${got}`); fail++; }
  }
}
if(fail){ console.error(`\n✗ test_pit: ${fail} scostamenti`); process.exit(1); }
console.log(`✓ test_pit: ${CASI.length}/${CASI.length} casi combaciano col golden`);
