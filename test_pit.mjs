import { evaluatePit } from './demo/pitscenario.mjs';
import { readFileSync } from 'fs';
const gara = process.argv[2] || 'Austria';
const race=JSON.parse(readFileSync(`demo/data/${gara}.json`,'utf8'));
const byLap={}; for(const lp of race.laps) byLap[lp.lap]=lp.cars;
const esiti=JSON.parse(readFileSync('demo/data/esiti.json','utf8'))[gara]||{};
const NP=new Set(Object.entries(esiti).filter(([d,t])=>t==='NP').map(x=>x[0]));
const loss=JSON.parse(readFileSync('demo/data/pitloss.json','utf8'))[gara];
const L=Number(process.argv[3]||30), pitL=Number(process.argv[4]||L+4);
const present=Object.keys(byLap[L]||{}).filter(d=>typeof byLap[L][d].cum_time==='number' && NP.has(d)===false);
const pace=race.pace[String(L)];
console.log(`${gara}: freeze ${L}, pit ${pitL}, pit-loss ${loss}s\n`);
for(const drv of present){
  const r=evaluatePit({byLap,nLaps:race.n_laps,pace,driver:drv,freezeLap:L,pitLap:pitL,pitLoss:loss,present});
  if(!r.ok){console.log(`${drv}: ${r.reason}`);continue;}
  const dav=r.davanti_ho?`${r.davanti_ho}(${r.gap_ahead==null?'n/d sotto neutralizzazione':`+${r.gap_ahead.toFixed(1)}`})`:'aria pulita';
  const die=r.dietro_esco?`${r.dietro_esco}(${r.gap_behind==null?'n/d sotto neutralizzazione':`+${r.gap_behind.toFixed(1)}`})`:'-';
  console.log(`${drv}: P${r.rientro_pos}/${r.su_totale}  davanti ${dav}  dietro ${die}`);
}
