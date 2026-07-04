// gen_golden_pit.mjs — genera il mini-golden dell'output pit da casi cross-gara.
// Congela: rientro_pos, su_totale, davanti_ho, gap_ahead, dietro_esco, gap_behind,
//          sotto_neutralizzazione, giro_neutralizzato.
// I casi Monaco (sotto SC) hanno gap ATTESI = null: il golden protegge la soppressione.
import { evaluatePit } from './pitscenario.mjs';
import fs from 'fs';

// Definizione casi: [gara, driver, freezeLap, pitLap]. Estendi con i 7 cross-gara validati.
const CASI = JSON.parse(fs.readFileSync('./golden_pit_casi.json','utf8'));
const pitloss = JSON.parse(fs.readFileSync('./data/pitloss.json','utf8'));

const raceCache = {};
function loadRace(gara){
  if(raceCache[gara]) return raceCache[gara];
  const r = JSON.parse(fs.readFileSync(`./data/${gara}.json`,'utf8'));
  r.byLap = {};
  for(const lp of r.laps) r.byLap[lp.lap] = lp.cars;
  raceCache[gara]=r; return r;
}
function present(r,L){
  return Object.keys(r.byLap[L]).filter(d=>typeof r.byLap[L][d].cum_time==='number');
}

const out=[];
for(const c of CASI){
  const r=loadRace(c.gara);
  const L=c.freezeLap;
  const loss = (pitloss[c.gara] ?? 22.0);
  const res = evaluatePit({
    byLap:r.byLap, nLaps:r.n_laps, pace:r.pace[String(L)],
    driver:c.driver, freezeLap:L, pitLap:c.pitLap, pitLoss:loss,
    present:present(r,L), gara:c.gara, laps:r.laps
  });
  out.push({
    caso:`${c.gara}:${c.driver}:fz${L}:pit${c.pitLap}`,
    ok:res.ok, reason:res.reason??null,
    rientro_pos:res.rientro_pos??null, su_totale:res.su_totale??null,
    davanti_ho:res.davanti_ho??null, gap_ahead:res.gap_ahead??null,
    dietro_esco:res.dietro_esco??null, gap_behind:res.gap_behind??null,
    sotto_neutralizzazione:res.sotto_neutralizzazione??null,
    giro_neutralizzato:res.giro_neutralizzato??null,
    finestra_attiva:res.neutralizzazione_gara?.finestra_attiva??null,
    tipo_neutro:res.neutralizzazione_gara?.tipo??null
  });
}
fs.writeFileSync('./golden_pit.json', JSON.stringify(out,null,2));
console.log(`golden_pit.json scritto: ${out.length} casi`);
for(const o of out) console.log('  ',o.caso,'-> P'+o.rientro_pos+'/'+o.su_totale, o.sotto_neutralizzazione?'[NEUTRO gap=null]':`gap_a=${o.gap_ahead==null?null:o.gap_ahead.toFixed(2)}`);
