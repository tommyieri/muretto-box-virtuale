// verifica_M1a_denominatore.mjs — terza tornata: IL DENOMINATORE E IL GRADINO.
//
//     node ai_lab/confronto/verifica_M1a_denominatore.mjs
//
// 18  LETTURA D — i due motori messi sullo STESSO denominatore della verita': ognuno ordina
//     chi conosce, e per chi non conosce gli si REGALA la verita'. E' la lettura piu'
//     generosa possibile verso il motore che ha il campo piu' piccolo (il vecchio): se il
//     nuovo vince anche qui, il vantaggio della lettura A non e' "il denominatore".
// 19  IL GRADINO nel motore vecchio a orizzonte 0: c'e' davvero, e quanto costa il
//     troncamento che glielo assottiglia?
// 20  le due configurazioni del vecchio del referto (V-banco e V-pannello) ricalcolate.
//
// Non scrive niente su disco e non tocca demo/, simulatore/, data/.

import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { evaluatePit } from '../../demo/pitscenario.mjs';
import { misura as misuraGradino } from '../../demo/gradino.mjs';
import { caricaGare2026 } from '../../simulatore/provenienza/gare_2026.mjs';
import { caricaPrior } from '../../simulatore/provenienza/pitloss_dati.mjs';
import { caricaCostanti } from '../../simulatore/scenario/director_dati.mjs';
import { doveRientri } from '../../simulatore/scenario/costruttore.mjs';
import { MESCOLE_SLICK } from '../../simulatore/provenienza/vocabolario.mjs';

const QUI = path.dirname(fileURLToPath(import.meta.url));
const RADICE = path.resolve(QUI, '..', '..');
const DEMO = path.join(RADICE, 'demo', 'data');
const SIM = path.join(RADICE, 'simulatore');
const GARE = ['Australia', 'Austria', 'Belgio', 'Canada', 'Cina', 'Giappone',
              'Gran Bretagna', 'Miami', 'Monaco', 'Spagna', 'Ungheria'];
const PITLOSS = JSON.parse(readFileSync(path.join(DEMO, 'pitloss.json'), 'utf8'));
const MP = JSON.parse(readFileSync(path.join(DEMO, 'modello_passo_2026.json'), 'utf8'));
const PASSO_V2 = { delta: MP.deriva.delta_gara_s, rho: MP.degrado.rho_s_giro };

const med = (v) => { if (!v.length) return null; const s = [...v].sort((a, b) => a - b); const m = s.length >> 1; return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; };
const avg = (v) => (v.length ? v.reduce((a, b) => a + b, 0) / v.length : null);
const p1 = (x) => (x === null ? ' — ' : `${(100 * x).toFixed(1)}%`);
const rias = (e) => { const a = e.map(Math.abs); return { n: e.length, med: med(a), media: avg(a), esatti: a.length ? a.filter((x) => x === 0).length / a.length : null, nE: a.filter((x) => x === 0).length, bias: avg(e) }; };
const riga = (et, x) => `  ${et.padEnd(28)} n=${String(x.n).padStart(3)}  mediana|e| ${x.med === null ? '—' : x.med.toFixed(1)}  media|e| ${x.media === null ? '—' : x.media.toFixed(2)}  esatti ${p1(x.esatti)} (${x.nE})  bias ${x.bias === null ? '—' : (x.bias >= 0 ? '+' : '') + x.bias.toFixed(3)}`;
const ordP = (cum) => (a, b) => (cum[a] - cum[b]) || (a < b ? -1 : a > b ? 1 : 0);

const files = new Map();
const gaSito = (g) => { if (!files.has(g)) files.set(g, JSON.parse(readFileSync(path.join(DEMO, `${g}.json`), 'utf8'))); return files.get(g); };
const cache = new Map();
function dati(g) {
  if (cache.has(g)) return cache.get(g);
  const G = gaSito(g);
  const byLap = {}; for (const l of G.laps) byLap[l.lap] = l.cars;
  const v = { G, byLap, nLaps: G.n_laps, pitLoss: PITLOSS[g] };
  cache.set(g, v); return v;
}
const tronca = (byLap, L) => { const t = {}; for (let k = 1; k <= L; k += 1) if (byLap[k]) t[k] = byLap[k]; return t; };

// —————————————————————————————————————————————————————————————————— i casi
const CASI = [];
for (const g of GARE) {
  const { byLap, nLaps } = dati(g);
  const leader = {};
  for (let k = 1; k <= nLaps; k += 1) {
    if (!byLap[k]) continue;
    let m = Infinity;
    for (const d of Object.keys(byLap[k])) { const t = byLap[k][d].cum_time; if (typeof t === 'number' && t < m) m = t; }
    if (m < Infinity) leader[k] = m;
  }
  for (let Li = 4; Li <= nLaps; Li += 1) {
    if (!byLap[Li]) continue;
    for (const drv of Object.keys(byLap[Li])) {
      if (byLap[Li][drv].in_lap !== true) continue;
      const L = Li - 1, Lo = Li + 1;
      if (typeof byLap[L]?.[drv]?.cum_time !== 'number') continue;
      if (!byLap[Lo]) continue;
      const cumLo = byLap[Lo][drv]?.cum_time;
      if (typeof cumLo !== 'number') continue;
      if (leader[Lo + 1] !== undefined && cumLo > leader[Lo + 1]) continue;
      const cum = {};
      for (const d of Object.keys(byLap[Lo])) { const t = byLap[Lo][d].cum_time; if (typeof t === 'number') cum[d] = t; }
      const ordine = Object.keys(cum).sort(ordP(cum));
      CASI.push({ gara: g, garaSim: g.replace(/\s+/g, ''), pilota: drv, L, Li, Lo, nLaps,
                  vera: ordine.indexOf(drv) + 1, suVeri: ordine.length, ordineVero: ordine });
    }
  }
}

function vecchio(c, { troncato = true, passo = null, gradinoOff = false } = {}) {
  const { G, byLap, nLaps, pitLoss } = dati(c.gara);
  const bl = troncato ? tronca(byLap, c.L) : byLap;
  const pace = G.pace[String(c.L)] || {};
  const present = G.drivers.filter((d) => typeof bl[c.L]?.[d]?.cum_time === 'number' && pace[d] != null);
  const viva = misuraGradino(bl, nLaps, c.L);
  let grad = (viva.gradino != null && viva.n_gradino >= 3) ? viva.gradino : null;
  if (gradinoOff || passo) grad = null;
  let r;
  try { r = evaluatePit({ byLap: bl, nLaps, pace, driver: c.pilota, freezeLap: c.L, pitLap: c.Li, pitLoss, present, gara: c.gara, laps: G.laps, ZONE: 0, orizzonte: 0, gradino: grad, passo }); }
  catch { return { muto: true }; }
  if (!r || r.ok !== true) return { muto: true };
  return { muto: false, pos: r.rientro_pos, su: r.su_totale, ordine: r.ordine_previsto.map((x) => x[0]), grad, nGrad: viva.n_gradino };
}
const gareSim = caricaGare2026(SIM);
const CTX = {
  gare: gareSim,
  modello: JSON.parse(readFileSync(path.join(SIM, 'data', 'modelli', 'modello_v2.json'), 'utf8')),
  prior: caricaPrior(SIM),
  costantiDirector: caricaCostanti(SIM),
  bandaRientro: JSON.parse(readFileSync(path.join(SIM, 'data', 'modelli', 'banda_rientro.json'), 'utf8')),
  nGiriGara: null,
};
function nuovo(c) {
  const g = gareSim[c.garaSim];
  const cella = g.perPilota.get(c.pilota)?.get(c.L);
  if (!cella || !MESCOLE_SLICK.has(cella.compound)) return { muto: true };
  let r;
  try { r = doveRientri({ gara: c.garaSim, freezeLap: c.L, pilota: c.pilota, giroPit: c.Li, mescola: cella.compound }, { ...CTX, nGiriGara: g.nGiri }); }
  catch { return { muto: true }; }
  if (!r || r.approvato !== true || r.posizione === null || r.posizione === undefined) return { muto: true };
  const cum = {};
  for (const [d, passi] of Object.entries(r.traccia ?? {})) {
    const p = passi?.find((x) => x.lap === c.Lo);
    if (p && p.cum_time !== null && p.cum_time !== undefined) cum[d] = p.cum_time;
  }
  return { muto: false, pos: r.posizione, su: r.su_quanti, ordine: Object.keys(cum).sort(ordP(cum)) };
}

for (const c of CASI) { c.v = vecchio(c); c.n = nuovo(c); c.vNoGrad = vecchio(c, { gradinoOff: true }); c.vP = vecchio(c, { passo: PASSO_V2 }); }
const COM = CASI.filter((c) => !c.v.muto && !c.n.muto);

console.log('VERIFICA ADVERSARIALE — IL DENOMINATORE E IL GRADINO');
console.log('='.repeat(104));
console.log(`\ncasi comuni: ${COM.length}`);

// ============================================================================
// 18. LETTURA D — stesso denominatore della verita', con la verita' REGALATA per i mancanti
// ============================================================================
/**
 * Posizione del pilota dentro la popolazione della VERITA', usando l'ordine del motore per
 * chi il motore conosce e la verita' per chi non conosce. Non e' un rango inventato: e'
 * "quanti gli stanno davanti", contati una volta sola.
 *   davanti = (previsti davanti, fra chi il motore conosce)
 *           + (veri davanti, fra chi il motore NON conosce)
 */
function letturaD(c, ordineMotore) {
  const S = new Set(ordineMotore);
  const iM = ordineMotore.indexOf(c.pilota);
  if (iM < 0) return null;
  const davantiPrevisti = ordineMotore.slice(0, iM).filter((d) => c.ordineVero.includes(d)).length;
  const iV = c.ordineVero.indexOf(c.pilota);
  const davantiVeriIgnoti = c.ordineVero.slice(0, iV).filter((d) => !S.has(d)).length;
  return davantiPrevisti + davantiVeriIgnoti + 1;
}
const dV = [], dN = [];
for (const c of COM) {
  const a = letturaD(c, c.v.ordine), b = letturaD(c, c.n.ordine);
  if (a !== null) dV.push(a - c.vera);
  if (b !== null) dN.push(b - c.vera);
}
const Dv = rias(dV), Dn = rias(dN);
console.log(`\n18. LETTURA D — stesso denominatore della verita', mancanti REGALATI (la piu' generosa col vecchio)`);
console.log(riga('D vecchio', Dv));
console.log(riga('D nuovo', Dn));
console.log(`    cancello M1 in lettura D: ${(Dn.med <= Dv.med && Dn.esatti >= Dv.esatti) ? 'PASSA' : 'NON PASSA'}`);
let dTesta = { n: 0, v: 0, pari: 0 };
for (let i = 0; i < dV.length; i += 1) { const a = Math.abs(dV[i]), b = Math.abs(dN[i]); if (b < a) dTesta.n += 1; else if (a < b) dTesta.v += 1; else dTesta.pari += 1; }
console.log(`    testa a testa: nuovo ${dTesta.n} · vecchio ${dTesta.v} · pari ${dTesta.pari}`);
// per gara
console.log('    per gara (esatti v→n): ' + GARE.map((g) => {
  const d = COM.filter((c) => c.gara === g);
  const a = rias(d.map((c) => letturaD(c, c.v.ordine) - c.vera)), b = rias(d.map((c) => letturaD(c, c.n.ordine) - c.vera));
  return `${g.slice(0, 3)} ${p1(a.esatti)}→${p1(b.esatti)}`;
}).join(' · '));

// ============================================================================
// 19. IL GRADINO
// ============================================================================
const conGrad = COM.filter((c) => c.v.grad !== null).length;
let cambiaSenzaGrad = 0;
for (const c of COM) if (!c.vNoGrad.muto && c.vNoGrad.pos !== c.v.pos) cambiaSenzaGrad += 1;
// gradino con byLap intero (quello che avrebbe in produzione, E15 compresa)
let gradIntero = 0, gradDiverso = 0;
for (const c of COM) {
  const { byLap, nLaps } = dati(c.gara);
  const vi = misuraGradino(byLap, nLaps, c.L);
  const gi = (vi.gradino != null && vi.n_gradino >= 3) ? vi.gradino : null;
  if (gi !== null) gradIntero += 1;
  if ((gi === null) !== (c.v.grad === null)) gradDiverso += 1;
}
console.log(`\n19. IL GRADINO DEL VECCHIO a orizzonte 0`);
console.log(`    gradino presente (byLap troncato) in ${conGrad}/${COM.length} casi · (byLap intero) in ${gradIntero}/${COM.length} · presenza che cambia col troncamento: ${gradDiverso}`);
console.log(`    spegnendolo, la posizione del vecchio cambia in ${cambiaSenzaGrad}/${COM.length} casi`);
console.log(riga('A vecchio senza gradino', rias(COM.filter((c) => !c.vNoGrad.muto).map((c) => c.vNoGrad.pos - c.vera))));
console.log(riga('A vecchio con gradino', rias(COM.map((c) => c.v.pos - c.vera))));

// ============================================================================
// 20. le due configurazioni del referto
// ============================================================================
const comP = CASI.filter((c) => !c.vP.muto && !c.n.muto);
console.log(`\n20. LE CONFIGURAZIONI DEL VECCHIO (controllo dei numeri del referto)`);
console.log(riga('V-banco (passo null)', rias(COM.map((c) => c.v.pos - c.vera))));
console.log(riga('V-pannello (passo v2)', rias(comP.map((c) => c.vP.pos - c.vera))));
console.log(riga('NUOVO (stessi casi)', rias(comP.map((c) => c.n.pos - c.vera))));
