// coda_miami.mjs — la coda del secchio "4 giri" e' base corta o neutralizzazione dentro la finestra?
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { gare, garaNuova, RADICE } from '../banco.mjs';
import { osservazioniVerdi } from '../../../simulatore/provenienza/gare_indice.mjs';
import { stimaBasi, derivaPerGiro } from '../../../simulatore/engine/passo_v2.mjs';
import { regimeNeutralizzato } from '../../../simulatore/provenienza/definizioni.mjs';
const m = JSON.parse(readFileSync(path.join(RADICE, 'simulatore', 'data', 'modelli', 'modello_v2.json'), 'utf8'));
const RHO = m.rho.valore, D70 = m.delta_70.scelto, H = 3;
const mediana = (v) => { const s=[...v].sort((a,b)=>a-b); const k=s.length>>1; return s.length%2?s[k]:(s[k-1]+s[k])/2; };
const pc=(n,d)=>d?(100*n/d).toFixed(1)+'%':'n/d';
const righe = [];
for (const nome of gare()) {
  const g = garaNuova(nome), oss = osservazioniVerdi(g.righe), deriva = derivaPerGiro(D70, g.nGiri);
  const vp = new Map(); for (const {drv,lap} of oss){ if(!vp.has(drv)) vp.set(drv,[]); vp.get(drv).push(lap); }
  const cel=(d,l)=>{const c=g.perPilota.get(d); return c?c.get(l):null;};
  for (let Lf=5; Lf<=Math.min(40,g.nGiri-H-1); Lf+=1){
    const basi = stimaBasi(oss,{delta70:D70,rho:RHO,nGiri:g.nGiri,finoA:Lf,minGiri:1});
    const prev={},real={};
    for (const drv of g.perPilota.keys()){
      const a=cel(drv,Lf),b=cel(drv,Lf+H);
      if(!a||!b||typeof a.cum_time!=='number'||typeof b.cum_time!=='number') continue;
      const base=basi[drv]; if(base==null||typeof a.tyre_age!=='number') continue;
      let cum=a.cum_time; for(let k=1;k<=H;k+=1) cum+=base+deriva*(Lf+k-1)+RHO*(a.tyre_age+k);
      prev[drv]=cum; real[drv]=b.cum_time;
    }
    const pil=Object.keys(prev); if(pil.length<5) continue;
    const leader=pil.reduce((a,b)=>cel(a,Lf).cum_time<=cel(b,Lf).cum_time?a:b);
    const sostaDentro=(d)=>{for(let k=Lf+1;k<=Lf+H;k+=1){const c=cel(d,k); if(c&&(c.in_lap===true||c.out_lap===true)) return true;} return false;};
    const neutroDentro=(d)=>{for(let k=Lf+1;k<=Lf+H;k+=1){const c=cel(d,k); if(c&&regimeNeutralizzato(c)) return true;} return false;};
    if(sostaDentro(leader)) continue;
    const leaderNeutro=neutroDentro(leader);
    for(const drv of pil){
      if(drv===leader||sostaDentro(drv)) continue;
      const v=(vp.get(drv)??[]).filter(l=>l<=Lf).length;
      righe.push({gara:nome,Lf,v,neutro:leaderNeutro||neutroDentro(drv),err:((prev[drv]-prev[leader])-(real[drv]-real[leader]))/H});
    }
  }
}
console.log(`finestre pulite da soste: ${righe.length} · di cui con NEUTRALIZZAZIONE dentro: ${righe.filter(r=>r.neutro).length} (${pc(righe.filter(r=>r.neutro).length,righe.length)})`);
for (const [et,f] of [['tutte',()=>true],['SENZA neutralizzazione dentro',r=>!r.neutro]]) {
  const sub0=righe.filter(f);
  console.log(`\n── ${et} ──`);
  console.log('  giri     n   |err| mediano   p90     quota > 1 s/giro');
  for (const [lo,hi] of [[2,3],[4,4],[5,5],[6,7],[8,8],[9,11],[12,99]]) {
    const s=sub0.filter(r=>r.v>=lo&&r.v<=hi); if(s.length<10) continue;
    const a=s.map(r=>Math.abs(r.err)).sort((x,y)=>x-y);
    console.log(`  ${(lo+(hi>lo?'-'+hi:'')).padEnd(6)} ${String(s.length).padStart(5)}      ${mediana(a).toFixed(3)}      ${a[Math.floor(0.9*(a.length-1))].toFixed(3)}    ${pc(a.filter(x=>x>1).length,a.length)}`);
  }
  const lo8=sub0.filter(r=>r.v>=4&&r.v<8).map(r=>Math.abs(r.err)), hi8=sub0.filter(r=>r.v>=8).map(r=>Math.abs(r.err));
  console.log(`  SECCO 4-7 (n=${lo8.length}) mediano ${mediana(lo8).toFixed(3)} · 8+ (n=${hi8.length}) mediano ${mediana(hi8).toFixed(3)} · scarto ${(mediana(lo8)-mediana(hi8)).toFixed(4)}`);
}
