// misura_vsc_di_campo.mjs — V1 di PREREG_vsc_di_campo.md: la VSC letta DI CAMPO.
//
//     node ai_lab/neutralizzazione/misura_vsc_di_campo.mjs
//
// R_lap = lap_time / mediana verde della stessa auto nella stessa gara. Tre
// popolazioni: VSC DI CAMPO (regimePerGiroDiCampo), VSC SOLO LOCALE (cella '6'
// col campo non in VSC), SC DI CAMPO (confronto, attesa ~1,6). Primario: le 11
// gare 2026. Secondario descrittivo: fondo asciutto. Scrive ESITO_vsc_di_campo.json.

import { gunzipSync } from 'node:zlib';
import { existsSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { gare, garaNuova } from '../confronto/banco.mjs';
import { adattaColonnare } from '../../simulatore/provenienza/adattatore.mjs';
import { garaAsciutta, regimePerGiroDiCampo, regimeDiCella, verde } from '../../simulatore/provenienza/definizioni.mjs';

const QUI = path.dirname(fileURLToPath(import.meta.url));
const RADICE = path.join(QUI, '..', '..', 'simulatore');
const RANGE = [1.20, 1.50];
const MIN_GIRI_AUTO = 5;

const mediana = (v) => { if (!v.length) return null; const s = [...v].sort((a, b) => a - b); const m = s.length >> 1; return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; };

function rapportiDiGara(perPilota) {
  const finestre = regimePerGiroDiCampo(perPilota);
  const rapporti = { vsc_campo: [], vsc_locale: [], sc_campo: [] };
  // celle senza status o senza del NON si giudicano (E13): stessa guardia di attacchi.mjs
  const giudicabile = (c) => c && c.status !== null && c.del !== null;
  for (const [, celle] of perPilota) {
    const verdi = [];
    for (const [, c] of celle) if (giudicabile(c) && verde(c) && Number.isFinite(c.lap_time)) verdi.push(c.lap_time);
    const base = mediana(verdi);
    if (base === null || !(base > 0)) continue;
    for (const [lap, c] of celle) {
      if (!giudicabile(c) || !Number.isFinite(c.lap_time)) continue;
      if (c.in_lap === true || c.out_lap === true) continue;
      const r = c.lap_time / base;
      const campo = finestre[lap];
      let regime = null;
      try { regime = regimeDiCella(c); } catch { regime = null; }
      if (campo === 'VSC') rapporti.vsc_campo.push(r);
      else if (campo === 'SC') rapporti.sc_campo.push(r);
      else if (campo === undefined && regime === 'VSC') rapporti.vsc_locale.push(r);
    }
  }
  return rapporti;
}

// ── primario: le 11 gare 2026 ───────────────────────────────────────────────
const perCircuito = {};
const pool = { vsc_campo: [], vsc_locale: [], sc_campo: [] };
for (const nome of gare()) {
  const g = garaNuova(nome);
  const r = rapportiDiGara(g.perPilota);
  perCircuito[nome] = {
    vsc_campo: { n: r.vsc_campo.length, r_lap: mediana(r.vsc_campo) },
    vsc_locale: { n: r.vsc_locale.length, r_lap: mediana(r.vsc_locale) },
    sc_campo: { n: r.sc_campo.length, r_lap: mediana(r.sc_campo) },
  };
  for (const k of Object.keys(pool)) pool[k].push(...r[k]);
}

const conDati = Object.entries(perCircuito).filter(([, v]) => v.vsc_campo.n >= MIN_GIRI_AUTO);
const dentro = conDati.filter(([, v]) => v.vsc_campo.r_lap >= RANGE[0] && v.vsc_campo.r_lap <= RANGE[1]);
const pooled = mediana(pool.vsc_campo);
const V1 = pooled !== null && pooled >= RANGE[0] && pooled <= RANGE[1] && dentro.length >= 6;

// ── secondario descrittivo: il fondo asciutto ───────────────────────────────
const fondoPool = { vsc_campo: [], vsc_locale: [] };
let gareFondo = 0;
const base = path.join(RADICE, 'data', 'fondo');
for (const anno of readdirSync(base).filter((a) => /^\d{4}$/.test(a)).sort()) {
  for (const gara of readdirSync(path.join(base, anno)).sort()) {
    const f = path.join(base, anno, gara, 'Race.json.gz');
    if (!existsSync(f)) continue;
    let adattate;
    try { adattate = adattaColonnare(JSON.parse(gunzipSync(readFileSync(f))), { fonte: `${anno}/${gara}` }); } catch { continue; }
    if (!garaAsciutta(adattate.righe)) continue;
    gareFondo += 1;
    const perPilota = new Map();
    for (const { drv, lap, cella } of adattate.righe) {
      if (!perPilota.has(drv)) perPilota.set(drv, new Map());
      perPilota.get(drv).set(lap, cella);
    }
    const r = rapportiDiGara(perPilota);
    fondoPool.vsc_campo.push(...r.vsc_campo);
    fondoPool.vsc_locale.push(...r.vsc_locale);
  }
}

const esito = {
  _cosa_e: 'V1 di PREREG_vsc_di_campo.md — la VSC letta di campo risana R_lap?',
  _data: '2026-08-07',
  range_fisico: RANGE,
  primario_2026: {
    pooled_vsc_campo: { n: pool.vsc_campo.length, r_lap: pooled },
    circuiti_con_dati: conDati.length,
    circuiti_dentro_range: dentro.length,
    diagnosi_vsc_solo_locale: { n: pool.vsc_locale.length, r_lap: mediana(pool.vsc_locale) },
    confronto_sc_campo: { n: pool.sc_campo.length, r_lap: mediana(pool.sc_campo) },
    per_circuito: perCircuito,
  },
  secondario_fondo: {
    gare: gareFondo,
    vsc_campo: { n: fondoPool.vsc_campo.length, r_lap: mediana(fondoPool.vsc_campo) },
    vsc_solo_locale: { n: fondoPool.vsc_locale.length, r_lap: mediana(fondoPool.vsc_locale) },
    nota: 'descrittivo: non decide il cancello',
  },
  V1_passa: V1,
};
writeFileSync(path.join(QUI, 'ESITO_vsc_di_campo.json'), `${JSON.stringify(esito, null, 1)}\n`);

console.log('══ LA VSC DI CAMPO — V1 di PREREG_vsc_di_campo.md ══════════════════════════');
console.log(`   2026 · VSC DI CAMPO   pooled R_lap ${pooled?.toFixed(3)} su ${pool.vsc_campo.length} giri-auto · circuiti nel range ${dentro.length}/${conDati.length} (con ≥${MIN_GIRI_AUTO})`);
console.log(`   2026 · VSC solo locale       R_lap ${mediana(pool.vsc_locale)?.toFixed(3)} su ${pool.vsc_locale.length} — la diagnosi (attesa ~1,0)`);
console.log(`   2026 · SC di campo           R_lap ${mediana(pool.sc_campo)?.toFixed(3)} su ${pool.sc_campo.length} — il confronto (attesa ~1,6)`);
for (const [nome, v] of Object.entries(perCircuito)) {
  if (v.vsc_campo.n > 0) console.log(`     ${nome.padEnd(14)} campo ${String(v.vsc_campo.n).padStart(4)} giri-auto  R_lap ${v.vsc_campo.r_lap?.toFixed(3)}   · locale ${String(v.vsc_locale.n).padStart(4)}  ${v.vsc_locale.r_lap ? 'R ' + v.vsc_locale.r_lap.toFixed(3) : ''}`);
}
console.log(`   fondo (descrittivo): campo R_lap ${mediana(fondoPool.vsc_campo)?.toFixed(3)} (n ${fondoPool.vsc_campo.length}) · locale ${mediana(fondoPool.vsc_locale)?.toFixed(3)} (n ${fondoPool.vsc_locale.length}) su ${gareFondo} gare`);
console.log(`   V1 ${V1 ? 'PASSA' : 'NON PASSA'}`);
