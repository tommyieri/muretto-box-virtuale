// misura_vsc_a_tempo.mjs — V2 di PREREG_vsc_a_tempo.md: il metro sulle frazioni.
//
//     node ai_lab/neutralizzazione/misura_vsc_a_tempo.mjs
//
// LO STESSO stimatore di V1 (R_lap = lap_time / mediana verde dell'auto nella
// gara, niente in/out-lap, guardia E13), con le celle divise per la frazione di
// giro sotto VSC dalla fonte a tempo (frazioni_vsc_2026.json). Cancello V2:
// pieni (f >= 0,9) nel range fisico E monotonia sui tre bin. Scrive
// ESITO_vsc_a_tempo.json.

import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { gare, garaNuova } from '../confronto/banco.mjs';
import { regimeDiCella, verde } from '../../simulatore/provenienza/definizioni.mjs';

const QUI = path.dirname(fileURLToPath(import.meta.url));
const RANGE = [1.20, 1.50];
const F = JSON.parse(readFileSync(path.join(QUI, 'frazioni_vsc_2026.json'), 'utf8'));

const mediana = (v) => { if (!v.length) return null; const s = [...v].sort((a, b) => a - b); const m = s.length >> 1; return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; };
const giudicabile = (c) => c && c.status !== null && c.del !== null;

const bin = { pieni: [], alti: [], bassi: [], zero_ma_6: [] };
const fDelle6 = [];   // la frazione vera delle celle che l'archivio marca '6'
for (const nome of gare()) {
  const fg = F.gare[nome];
  if (!fg) continue;
  const g = garaNuova(nome);
  for (const [drv, celle] of g.perPilota) {
    const verdi = [];
    for (const [, c] of celle) if (giudicabile(c) && verde(c) && Number.isFinite(c.lap_time)) verdi.push(c.lap_time);
    const base = mediana(verdi);
    if (base === null || !(base > 0)) continue;
    const perGiro = fg.piloti[drv] ?? {};
    for (const [lap, c] of celle) {
      if (!giudicabile(c) || !Number.isFinite(c.lap_time)) continue;
      if (c.in_lap === true || c.out_lap === true) continue;
      const fv = perGiro[lap]?.f_vsc;
      if (fv === undefined) continue;
      const fs = perGiro[lap]?.f_sc ?? 0;
      if (fs > 0) continue;                       // niente SC nel giro: si misura la VSC pura
      const r = c.lap_time / base;
      let regime6 = null;
      try { regime6 = regimeDiCella(c); } catch { regime6 = null; }
      if (regime6 === 'VSC') fDelle6.push(fv);
      if (fv >= 0.9) bin.pieni.push(r);
      else if (fv >= 0.5) bin.alti.push(r);
      else if (fv > 0) bin.bassi.push(r);
      else if (regime6 === 'VSC') bin.zero_ma_6.push(r);   // l'archivio dice VSC, il tempo dice zero
    }
  }
}

const R = Object.fromEntries(Object.entries(bin).map(([k, v]) => [k, { n: v.length, r_lap: mediana(v) }]));
const inRange = R.pieni.r_lap !== null && R.pieni.r_lap >= RANGE[0] && R.pieni.r_lap <= RANGE[1];
const monotona = R.bassi.r_lap !== null && R.alti.r_lap !== null && R.pieni.r_lap !== null
  && R.bassi.r_lap < R.alti.r_lap && R.alti.r_lap < R.pieni.r_lap;
const V2 = inRange && monotona;

const esito = {
  _cosa_e: 'V2 di PREREG_vsc_a_tempo.md — R_lap in funzione della frazione di giro sotto VSC (fonte a tempo).',
  _data: '2026-08-07',
  range_fisico: RANGE,
  bin: R,
  cancello: { pieni_nel_range: inRange, monotonia: monotona },
  V2_passa: V2,
  riconciliazione_simbolo_6: {
    f_vsc_mediana_delle_celle_6: mediana(fDelle6),
    n: fDelle6.length,
    nota: 'quanta VSC c\'e' + '\' davvero nei giri che l\'archivio marca \'6\' — la diagnosi della diluizione',
  },
};
writeFileSync(path.join(QUI, 'ESITO_vsc_a_tempo.json'), `${JSON.stringify(esito, null, 1)}\n`);

console.log('══ LA VSC A TEMPO — V2 di PREREG_vsc_a_tempo.md ════════════════════════════');
console.log(`   PIENI  (f ≥ 0,9)   R_lap ${R.pieni.r_lap?.toFixed(3)}  (n ${R.pieni.n})   range [${RANGE[0]}, ${RANGE[1]}]  ${inRange ? '✓' : '✗'}`);
console.log(`   ALTI   (0,5–0,9)   R_lap ${R.alti.r_lap?.toFixed(3)}  (n ${R.alti.n})`);
console.log(`   BASSI  (0–0,5)     R_lap ${R.bassi.r_lap?.toFixed(3)}  (n ${R.bassi.n})`);
console.log(`   monotonia bassi < alti < pieni: ${monotona ? '✓' : '✗'}`);
console.log(`   diagnosi: le celle '6' hanno f_vsc mediana ${mediana(fDelle6)?.toFixed(3)} (n ${fDelle6.length}) · celle '6' con f = 0: n ${R.zero_ma_6.n}${R.zero_ma_6.r_lap ? ` R_lap ${R.zero_ma_6.r_lap.toFixed(3)}` : ''}`);
console.log(`   V2 ${V2 ? 'PASSA' : 'NON PASSA'}`);
