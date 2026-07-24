import fs from 'fs';
import { deriva as calcolaDeriva, penalitaPendente } from './grossi.mjs';
import { misura as misuraSoste } from './gradino.mjs';
import { evaluatePit, stessoGiroReale } from './pitscenario.mjs';
const D='./data', j=p=>JSON.parse(fs.readFileSync(p,'utf8'));
const r=j(`${D}/Miami.json`); const byLap={}; for(const lp of r.laps) byLap[lp.lap]=lp.cars;
const N=r.n_laps; const drv='ANT', P=26, L=25;
console.log('n_laps',N);
const der=calcolaDeriva(byLap,N,L);
console.log('DERIVA @L=25:', JSON.stringify(der));
// ricostruisco a mano la regressione
const ASC=['SOFT','MEDIUM','HARD'];
const pts=[];
for(let l=Math.max(1,L-12); l<=L; l++){
  const cars=byLap[l]; if(!cars) continue;
  const v=Object.values(cars).filter(c=>c&&c.lap_time!=null&&!c.neutralized&&!c.in_lap&&!c.out_lap&&ASC.includes(c.compound)).map(c=>c.lap_time);
  if(v.length>=6){const s=[...v].sort((a,b)=>a-b),m=s.length>>1; pts.push([l, s.length%2?s[m]:(s[m-1]+s[m])/2, v.length]);}
}
console.log('punti regressione (giro, mediana, n auto):');
for(const p of pts) console.log('  ',p[0],p[1].toFixed(3),p[2]);
const mx=pts.reduce((a,p)=>a+p[0],0)/pts.length, my=pts.reduce((a,p)=>a+p[1],0)/pts.length;
const den=pts.reduce((a,p)=>a+(p[0]-mx)**2,0);
const d=pts.reduce((a,p)=>a+(p[0]-mx)*(p[1]-my),0)/den;
console.log('mia pendenza:',d.toFixed(5),'n punti',pts.length, ' contributo cumulato 7 giri = d*28 =',(d*28).toFixed(4));
// ANT reale nei giri 26..32 vs pace base
const pace=r.pace[String(L)];
console.log('\npace_base ANT @L25 =',pace[drv]);
console.log('giro  lap_time  in/out  neutr  compound  age  delta_vs_pacebase');
for(let l=P-3;l<=L+7+1 && l<=N;l++){const c=byLap[l]?.[drv]; if(!c)continue;
  console.log(' ',l, String(c.lap_time).padStart(8), (c.in_lap?'IN ':'   ')+(c.out_lap?'OUT':'   '), c.neutralized?'NEU':'   ', String(c.compound).padEnd(7), c.tyre_age, c.lap_time!=null?(c.lap_time-pace[drv]).toFixed(3):'—');}
