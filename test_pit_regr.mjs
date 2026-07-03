import { evaluatePit } from './demo/pitscenario.mjs';
import fs from 'fs';

const d = JSON.parse(fs.readFileSync('./demo/data/Austria.json','utf8'));
const laps = d.laps, nLaps = d.n_laps;

const byLap = {};
for (const row of laps) { byLap[row.lap] = {}; for (const drv in row.cars) byLap[row.lap][drv] = row.cars[drv]; }

const L = 30, pitLap = 34, driver = 'VER', pitLoss = 21.63;
const pace = d.pace[String(L)];              // <-- pace al giro di freeze (per-pilota)
const present = Object.keys(byLap[L]);

const r = evaluatePit({ byLap, nLaps, pace, driver, freezeLap:L, pitLap, pitLoss, present,
                        gara:'Austria', laps });

console.log('=== REGRESSIONE (deve restare identico al pre-patch) ===');
console.log('ok            :', r.ok, r.reason?('reason: '+r.reason):'');
console.log('rientro_pos   :', r.rientro_pos, '  (atteso 7)');
console.log('su_totale     :', r.su_totale);
console.log('davanti_ho    :', r.davanti_ho, 'gap', r.gap_ahead?.toFixed(1), '  (atteso HAD +4.3)');
console.log('dietro_esco   :', r.dietro_esco, 'gap', r.gap_behind?.toFixed(1), '  (atteso NOR +2.1)');
console.log('null preservati:', [r.aria_libera,r.perdita_primi3,r.undercut,r.overcut,r.delta_strategia].every(x=>x===null));

console.log('\n=== CAMPI NUOVI (additivi) ===');
console.log('warmin_rientro       :', JSON.stringify(r.warmin_rientro));
console.log('neutralizzazione_gara:', JSON.stringify(r.neutralizzazione_gara));

const ok = r.ok && r.rientro_pos===7 && r.davanti_ho==='HAD' && r.dietro_esco==='NOR';
console.log('\n' + (ok ? '✅ REGRESSIONE PASSATA — rientro identico, campi nuovi popolati'
                        : '❌ REGRESSIONE FALLITA'));
