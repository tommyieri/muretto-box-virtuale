// misura_ripartenza_eta.mjs — R0'' di PREREG_ripartenza_eta.md: alla ripartenza
// passa chi ha la gomma fresca?
//
//     node ai_lab/sorpasso/misura_ripartenza_eta.mjs
//
// Fondo 2018-2025 asciutto, stesse occasioni delle prereg 1-2, in piu' il divario
// d'eta' Δ = eta(avanti) − eta(dietro) e G = 5 (dal τ del rodaggio sigillato,
// dichiarato in prereg). Scrive ESITO_ripartenza_eta.json. Non tocca il sigillo:
// quello si muove solo dopo i cancelli R1-R3.

import { gunzipSync } from 'node:zlib';
import { existsSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { adattaColonnare } from '../../simulatore/provenienza/adattatore.mjs';
import { garaAsciutta, regimePerGiroDiCampo } from '../../simulatore/provenienza/definizioni.mjs';
import { creaGeneratore } from '../../simulatore/banco/misure/difesa.mjs';

const QUI = path.dirname(fileURLToPath(import.meta.url));
const RADICE = path.join(QUI, '..', '..', 'simulatore');
const GAP_MAX = 1.5;
const G_DIVARIO = 5;          // prereg: τ rodaggio sigillato 4,75 → 5, NON tarato
const SEME = 20260807;
const RIPETIZIONI = 2000;

let coppieSenzaEta = 0;

function occasioniDaRighe(righe) {
  const perPilota = new Map();
  let nGiri = 0;
  for (const { drv, lap, cella } of righe) {
    if (Number.isInteger(lap) && lap > nGiri) nGiri = lap;
    if (!perPilota.has(drv)) perPilota.set(drv, new Map());
    perPilota.get(drv).set(lap, cella);
  }
  const finestre = regimePerGiroDiCampo(perPilota);
  const ripartenze = new Set();
  for (let L = 2; L <= nGiri; L += 1) if (finestre[L - 1] && !finestre[L]) ripartenze.add(L);

  const esiti = { ripartenza: [], verde: [] };
  for (let L = 2; L <= nGiri; L += 1) {
    if (finestre[L]) continue;
    const tipo = ripartenze.has(L) ? 'ripartenza' : (finestre[L - 1] ? null : 'verde');
    if (tipo === null) continue;
    const righeGiro = [];
    for (const [drv, perLap] of perPilota) {
      const prima = perLap.get(L - 1); const ora = perLap.get(L);
      if (!prima || !ora) continue;
      if (!Number.isFinite(prima.cum_time) || !Number.isFinite(ora.cum_time)) continue;
      righeGiro.push({ drv, prima: prima.cum_time, dopo: ora.cum_time, inout: ora.in_lap === true || ora.out_lap === true, eta: ora.tyre_age });
    }
    righeGiro.sort((a, b) => a.prima - b.prima);
    for (let i = 1; i < righeGiro.length; i += 1) {
      const avanti = righeGiro[i - 1]; const dietro = righeGiro[i];
      if (avanti.inout || dietro.inout) continue;
      const gap = dietro.prima - avanti.prima;
      if (!(gap >= 0 && gap <= GAP_MAX)) continue;
      if (!Number.isFinite(avanti.eta) || !Number.isFinite(dietro.eta)) { coppieSenzaEta += 1; continue; }
      esiti[tipo].push({ sorpasso: dietro.dopo < avanti.dopo, fresco: (avanti.eta - dietro.eta) >= G_DIVARIO });
    }
  }
  return esiti;
}

const blocchi = [];
let gareLette = 0; let gareBagnate = 0; let gareEscluse = 0;
const base = path.join(RADICE, 'data', 'fondo');
for (const anno of readdirSync(base).filter((a) => /^\d{4}$/.test(a)).sort()) {
  for (const gara of readdirSync(path.join(base, anno)).sort()) {
    const f = path.join(base, anno, gara, 'Race.json.gz');
    if (!existsSync(f)) continue;
    let adattate;
    try {
      adattate = adattaColonnare(JSON.parse(gunzipSync(readFileSync(f))), { fonte: `${anno}/${gara}` });
    } catch { gareEscluse += 1; continue; }
    if (!garaAsciutta(adattate.righe)) { gareBagnate += 1; continue; }
    gareLette += 1;
    blocchi.push({ gara: `${anno}/${gara}`, esiti: occasioniDaRighe(adattate.righe) });
  }
}

const conta = (righe) => ({ n: righe.length, passa: righe.filter((x) => x.sorpasso).length });
const odds = (c) => (c.passa === 0 || c.passa === c.n ? null : (c.passa / c.n) / (1 - c.passa / c.n));
const cellaDi = (bs, tipo, fresco) => conta(bs.flatMap((b) => b.esiti[tipo].filter((x) => x.fresco === fresco)));
const orDi = (bs, fresco) => {
  const r = cellaDi(bs, 'ripartenza', fresco); const v = cellaDi(bs, 'verde', fresco);
  const oR = odds(r); const oV = odds(v);
  return { r, v, or: (oR === null || oV === null) ? null : oR / oV };
};

const fresco = orDi(blocchi, true);
const resto = orDi(blocchi, false);

const rnd = creaGeneratore(SEME);
const boot = [];
for (let i = 0; i < RIPETIZIONI; i += 1) {
  const campione = Array.from({ length: blocchi.length }, () => blocchi[Math.floor(rnd() * blocchi.length)]);
  const o = orDi(campione, true).or;
  if (o !== null) boot.push(o);
}
boot.sort((a, b) => a - b);
const ic = [boot[Math.floor(0.025 * boot.length)], boot[Math.floor(0.975 * boot.length)]];
const R0 = fresco.or !== null && ic[0] > 1 && resto.or !== null && fresco.or > resto.or;
const PENDENZA = 1.982602;
const deltaFresco = fresco.or !== null && fresco.or > 0 ? Math.log(fresco.or) / PENDENZA : null;

const esito = {
  _cosa_e: 'R0\'\' di PREREG_ripartenza_eta.md — l\'effetto-ripartenza e\' concentrato in chi ha la gomma fresca?',
  _data: '2026-08-07',
  perimetro: { gare_lette: gareLette, gare_bagnate_escluse: gareBagnate, gare_illeggibili: gareEscluse, gap_max_s: GAP_MAX, divario_minimo_giri: G_DIVARIO, coppie_senza_eta_escluse: coppieSenzaEta, seme: SEME, ripetizioni: RIPETIZIONI },
  fresco: { ripartenza: fresco.r, verde: fresco.v, odds_ratio: fresco.or, ic95: ic },
  resto: { ripartenza: resto.r, verde: resto.v, odds_ratio: resto.or },
  R0_passa: R0,
  conversione: { pendenza_sigillata: PENDENZA, delta_soglia_fresco: deltaFresco },
};
writeFileSync(path.join(QUI, 'ESITO_ripartenza_eta.json'), `${JSON.stringify(esito, null, 1)}\n`);

console.log('══ RIPARTENZA × ETÀ GOMMA — R0\'\' di PREREG_ripartenza_eta.md ═══════════════');
console.log(`   ${gareLette} gare asciutte · G = ${G_DIVARIO} giri · ${coppieSenzaEta} coppie senza età escluse`);
console.log(`   FRESCO (Δ ≥ ${G_DIVARIO}):  ripartenza ${fresco.r.passa}/${fresco.r.n} = ${(100 * fresco.r.passa / fresco.r.n).toFixed(1)}%  ·  verde ${fresco.v.passa}/${fresco.v.n} = ${(100 * fresco.v.passa / fresco.v.n).toFixed(1)}%  ·  OR ${fresco.or?.toFixed(3)}  IC95 [${ic[0]?.toFixed(3)}, ${ic[1]?.toFixed(3)}]`);
console.log(`   RESTO  (Δ < ${G_DIVARIO}):  ripartenza ${resto.r.passa}/${resto.r.n} = ${(100 * resto.r.passa / resto.r.n).toFixed(1)}%  ·  verde ${resto.v.passa}/${resto.v.n} = ${(100 * resto.v.passa / resto.v.n).toFixed(1)}%  ·  OR ${resto.or?.toFixed(3)}`);
console.log(`   R0'' ${R0 ? `PASSA — Δsoglia_fresco = ${deltaFresco.toFixed(4)} s/giro (solo coppie fresche, solo alla ripartenza)` : 'NON PASSA — NULL, fine della famiglia ripartenza senza un dato nuovo'}`);
