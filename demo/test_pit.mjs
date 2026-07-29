// test_pit.mjs — verifica che l'output pit corrente combaci col golden congelato.
// Fallisce (exit 1) al primo scostamento. Da eseguire dopo test_b.py && test_b.mjs.
import { evaluatePit } from './pitscenario.mjs';
import { misura as misuraSoste } from './gradino.mjs';
import fs from 'fs';

const GOLDEN = JSON.parse(fs.readFileSync('./golden_pit.json','utf8'));
const CASI   = JSON.parse(fs.readFileSync('./golden_pit_casi.json','utf8'));
const pitloss= JSON.parse(fs.readFileSync('./data/pitloss.json','utf8'));
const RC = JSON.parse(fs.readFileSync('./data/race_control_2026.json','utf8'));
const penDi = (gara, drv, giro) => (RC[gara]?.penalita || [])
  .filter(p => p.pilota === drv && p.giro <= giro && p.secondi > 0)
  .reduce((a, p) => a + p.secondi, 0);

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
for(let i=0;i<GOLDEN.length;i++){
  const g=GOLDEN[i], c=CASI[Math.floor(i/2)], r=loadRace(c.gara), L=c.freezeLap;
  // la configurazione e' REGISTRATA nel golden: il test la rilegge invece di indovinarla,
  // cosi' base e pannello sono coperti dallo stesso file e nessuno dei due puo' sparire.
  const res=evaluatePit({ byLap:r.byLap,nLaps:r.n_laps,pace:r.pace[String(L)],
    driver:c.driver,freezeLap:L,pitLap:c.pitLap,pitLoss:(pitloss[c.gara]??22.0)+penDi(c.gara,c.driver,L),
    present:present(r,L),gara:c.gara,laps:r.laps,
    orizzonte:g.orizzonte??0, gradino:g.gradino??null, ZONE:g.ZONE??1.5, deriva:g.deriva??null });
  for(const k of CAMPI){
    const got=res[k]??null, exp=g[k]??null;
    if(!near(got,exp)){ console.error(`FAIL ${g.caso} campo ${k}: atteso ${exp} ottenuto ${got}`); fail++; }
  }
}
if(fail){ console.error(`\n✗ test_pit: ${fail} scostamenti`); process.exit(1); }
console.log(`✓ test_pit: ${GOLDEN.length}/${GOLDEN.length} casi (base + pannello) combaciano col golden`);
