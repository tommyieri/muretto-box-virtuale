// fisica_base_scia.mjs — QUANTO E' SPORCA LA BASE CHE IL MOTORE PROIETTA?
//
//     node ai_lab/confronto/fisica_base_scia.mjs
//
// `stimaBasi` misura il passo base come mediana dei residui su TUTTI i giri
// verdi <= L, mescolando i giri in aria libera con quelli passati dietro a
// qualcuno. Misurato altrove: stare entro 1 s dall'auto davanti costa
// +0,63 s/giro (11/11 gare). La domanda del prodotto e' pero' «se fermo questo
// pilota adesso, dove rientra» — e chi rientra da una sosta rientra IN ARIA
// LIBERA. Qui si misura di quanto le due basi differiscono, e quanto costa in
// copertura misurare solo in aria libera.
//
// NON SCRIVE NIENTE su disco. Non tocca demo/, simulatore/, data/.

import path from 'node:path';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { caricaGare2026 } from '../../simulatore/provenienza/gare_2026.mjs';
import { passoUtilizzabile } from '../../simulatore/provenienza/definizioni.mjs';

const QUI = path.dirname(fileURLToPath(import.meta.url));
const RADICE = path.resolve(QUI, '..', '..');
const SIM = path.join(RADICE, 'simulatore');
const MODELLO = JSON.parse(readFileSync(path.join(SIM, 'data', 'modelli', 'modello_v2.json'), 'utf8'));
const RHO = MODELLO.rho.valore;
const DELTA70 = MODELLO.delta_70.scelto;
const MIN_GIRI_BASE = 8;

const mediana = (v) => { if (!v.length) return null; const s = [...v].sort((a, b) => a - b); const m = s.length >> 1; return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; };
const f = (x, n = 3) => (x === null || x === undefined ? '  —  ' : x.toFixed(n));

const gare = caricaGare2026(SIM);
const NOMI = Object.keys(gare).sort();

const oss = {};
for (const nome of NOMI) {
  const g = gare[nome];
  const perGiro = new Map();
  for (const { drv, lap, cella } of g.righe) {
    if (!perGiro.has(lap)) perGiro.set(lap, new Map());
    perGiro.get(lap).set(drv, cella);
  }
  const gapAv = new Map();
  for (const [lap, m] of perGiro) {
    const c = [...m.entries()].filter(([, x]) => typeof x.cum_time === 'number').sort((a, b) => a[1].cum_time - b[1].cum_time);
    for (let i = 0; i < c.length; i += 1) gapAv.set(`${c[i][0]}|${lap}`, i === 0 ? null : c[i][1].cum_time - c[i - 1][1].cum_time);
  }
  const deriva = -DELTA70 / g.nGiri;
  const v = [];
  for (const { drv, lap, cella } of g.righe) {
    let ok = false;
    try { ok = passoUtilizzabile(cella) && cella.tyre_age !== null; } catch { ok = false; }
    if (!ok) continue;
    v.push({ drv, lap, r: cella.lap_time - deriva * (lap - 1) - RHO * cella.tyre_age, gap: gapAv.get(`${drv}|${lap}`) ?? null });
  }
  oss[nome] = { v, nGiri: g.nGiri };
}
const ARIA = (x) => x.gap === null || x.gap > 2.0;

// la griglia dei congelamenti di M2
const scarti = [];
const perGaraScarti = {};
for (const n of NOMI) perGaraScarti[n] = [];
let totale = 0; let persiInAria = 0;
const quotaSporca = [];
for (const nome of NOMI) {
  const { v, nGiri } = oss[nome];
  for (let L = 5; L + 10 <= nGiri; L += 2) {
    const fino = v.filter((x) => x.lap <= L);
    const perDrv = new Map();
    for (const x of fino) { if (!perDrv.has(x.drv)) perDrv.set(x.drv, []); perDrv.get(x.drv).push(x); }
    for (const [drv, righe] of perDrv) {
      if (righe.length < MIN_GIRI_BASE) continue;
      totale += 1;
      const bTutti = mediana(righe.map((x) => x.r));
      const aria = righe.filter(ARIA);
      quotaSporca.push(1 - aria.length / righe.length);
      if (aria.length < MIN_GIRI_BASE) { persiInAria += 1; continue; }
      const bAria = mediana(aria.map((x) => x.r));
      scarti.push({ gara: nome, drv, L, d: bTutti - bAria });
      perGaraScarti[nome].push(bTutti - bAria);
    }
  }
}

console.log('QUANTO E\' SPORCA LA BASE — differenza fra base su TUTTI i giri verdi e base sui soli giri in ARIA LIBERA (> 2 s)');
console.log(`   coppie (gara, pilota, congelamento) con almeno ${MIN_GIRI_BASE} giri verdi: ${totale}`);
console.log(`   di queste, con almeno ${MIN_GIRI_BASE} giri in ARIA LIBERA: ${totale - persiInAria} (${(100 * (totale - persiInAria) / totale).toFixed(1)}%)`);
console.log(`   → il costo in copertura di misurare la base solo in aria libera: ${persiInAria} casi (${(100 * persiInAria / totale).toFixed(1)}%)`);
const s = scarti.map((x) => x.d).sort((a, b) => a - b);
const q = (p) => s[Math.min(s.length - 1, Math.floor(p * s.length))];
console.log(`\n   scarto base(tutti) - base(aria libera), s/giro   (positivo = la base usata dal motore e' PIU' LENTA del vero passo in aria libera)`);
console.log(`     mediana ${f(mediana(s))}  ·  p25 ${f(q(0.25))}  ·  p75 ${f(q(0.75))}  ·  p90 ${f(q(0.90))}  ·  max ${f(s[s.length - 1])}`);
console.log(`     casi con scarto > 0,10 s/giro: ${s.filter((x) => x > 0.10).length}/${s.length} (${(100 * s.filter((x) => x > 0.10).length / s.length).toFixed(1)}%)`);
console.log(`     casi con scarto > 0,25 s/giro: ${s.filter((x) => x > 0.25).length}/${s.length} (${(100 * s.filter((x) => x > 0.25).length / s.length).toFixed(1)}%)`);
console.log(`   quota mediana di giri "sporchi" (entro 2 s) nella finestra di stima: ${(100 * mediana(quotaSporca)).toFixed(1)}%`);
console.log('\n   per gara (blocchi = gare): scarto mediano, s/giro');
for (const n of NOMI) {
  const v = perGaraScarti[n];
  if (!v.length) continue;
  console.log(`     ${n.padEnd(15)} n=${String(v.length).padStart(5)}  ${f(mediana(v)).padStart(7)}  (p90 ${f([...v].sort((a, b) => a - b)[Math.floor(0.9 * v.length)])})`);
}
