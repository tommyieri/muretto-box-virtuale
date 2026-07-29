// gen_golden_pit.mjs — genera il mini-golden dell'output pit da casi cross-gara.
// Congela: rientro_pos, su_totale, davanti_ho, gap_ahead, dietro_esco, gap_behind,
//          sotto_neutralizzazione, giro_neutralizzato.
// I casi Monaco (sotto SC) hanno gap ATTESI = null: il golden protegge la soppressione.
import { evaluatePit } from './pitscenario.mjs';
import { misura as misuraSoste } from './gradino.mjs';
import { deriva as calcolaDeriva } from './grossi.mjs';
import fs from 'fs';

// Definizione casi: [gara, driver, freezeLap, pitLap]. Estendi con i 7 cross-gara validati.
const CASI = JSON.parse(fs.readFileSync('./golden_pit_casi.json','utf8'));

// DUE CONFIGURAZIONI, non una. Fino al 22/07/2026 il golden congelava solo i default
// (orizzonte 0, gradino spento) — cioe' un percorso che il pannello NON usa piu' da quando
// il gradino e' acceso. Un golden che protegge un ramo morto e' un ornamento: qui si
// congela ANCHE la configurazione che il cliente vede davvero.
const CONFIG = {
  base:     () => ({ orizzonte: 0, gradino: null }),
  // la configurazione PANNELLO include il cap SPENTO (ZONE 0) dal 22/07/2026: e' quello
  // che il cliente esegue, quindi e' quello che il golden deve congelare.
  pannello: (byLap, nLaps, L) => {
    const m = misuraSoste(byLap, nLaps, L);
    // ARROTONDATO QUI, non solo in scrittura: il golden registra 4 decimali e il test
    // rigioca quelli. Calcolare col numero pieno e salvarne uno tondo faceva divergere
    // generatore e test di 1e-4 — un falso rosso che avrebbe insegnato a ignorare il test.
    const gr = (m.gradino != null && m.n_gradino >= 3) ? +m.gradino.toFixed(4) : null;
    const d = calcolaDeriva(byLap, nLaps, L);
    const dv = d.stato === 'MISURATO' ? +d.valore.toFixed(5) : null;
    return { orizzonte: gr != null ? 5 : 0, gradino: gr, ZONE: 0, deriva: dv };
  },
};
const pitloss = JSON.parse(fs.readFileSync('./data/pitloss.json','utf8'));
// le penalita' pendenti entrano nel costo simulato dal 22/07: il golden deve vederle,
// altrimenti congela un pannello che non esiste piu'.
const RC = JSON.parse(fs.readFileSync('./data/race_control_2026.json','utf8'));
const penDi = (gara, drv, giro) => (RC[gara]?.penalita || [])
  .filter(p => p.pilota === drv && p.giro <= giro && p.secondi > 0)
  .reduce((a, p) => a + p.secondi, 0);

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
  const loss = (pitloss[c.gara] ?? 22.0) + penDi(c.gara, c.driver, L);
  for (const [nomeCfg, mk] of Object.entries(CONFIG)) {
  const cfg = mk(r.byLap, r.n_laps, L);
  const res = evaluatePit({
    byLap:r.byLap, nLaps:r.n_laps, pace:r.pace[String(L)],
    driver:c.driver, freezeLap:L, pitLap:c.pitLap, pitLoss:loss,
    present:present(r,L), gara:c.gara, laps:r.laps,
    orizzonte:cfg.orizzonte, gradino:cfg.gradino, ZONE:cfg.ZONE ?? 1.5, deriva:cfg.deriva ?? null
  });
  out.push({
    caso:`${c.gara}:${c.driver}:fz${L}:pit${c.pitLap}#${nomeCfg}`,
    cfg:nomeCfg, orizzonte:cfg.orizzonte,
    gradino:cfg.gradino, ZONE:cfg.ZONE ?? 1.5, deriva:cfg.deriva ?? null,
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
}
fs.writeFileSync('./golden_pit.json', JSON.stringify(out,null,2));
console.log(`golden_pit.json scritto: ${out.length} casi`);
for(const o of out) console.log('  ',o.caso,'-> P'+o.rientro_pos+'/'+o.su_totale, o.sotto_neutralizzazione?'[NEUTRO gap=null]':`gap_a=${o.gap_ahead==null?null:o.gap_ahead.toFixed(2)}`);
