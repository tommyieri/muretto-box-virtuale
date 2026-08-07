// misura_ripartenza_fondo.mjs — R0' di PREREG_ripartenza_fondo.md: la ripartenza sul FONDO.
//
//     node ai_lab/sorpasso/misura_ripartenza_fondo.mjs
//
// Stesse definizioni della prereg 1 (finestra, ripartenza, occasione, sorpasso,
// conversione), perimetro = fondo 2018-2025 gare ASCIUTTE (garaAsciutta, lo stesso
// filtro della legge di soglia). Il 2026 non entra nella stima del parametro.
// Scrive ESITO_ripartenza_fondo.json.

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
const SEME = 20260807;
const RIPETIZIONI = 2000;

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
      righeGiro.push({ drv, prima: prima.cum_time, dopo: ora.cum_time, inout: ora.in_lap === true || ora.out_lap === true });
    }
    righeGiro.sort((a, b) => a.prima - b.prima);
    for (let i = 1; i < righeGiro.length; i += 1) {
      const avanti = righeGiro[i - 1]; const dietro = righeGiro[i];
      if (avanti.inout || dietro.inout) continue;
      const gap = dietro.prima - avanti.prima;
      if (!(gap >= 0 && gap <= GAP_MAX)) continue;
      esiti[tipo].push({ sorpasso: dietro.dopo < avanti.dopo });
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
const orDi = (bs) => {
  const r = conta(bs.flatMap((b) => b.esiti.ripartenza));
  const v = conta(bs.flatMap((b) => b.esiti.verde));
  const oR = odds(r); const oV = odds(v);
  return { r, v, or: (oR === null || oV === null) ? null : oR / oV };
};

const punto = orDi(blocchi);
const rnd = creaGeneratore(SEME);
const orBoot = [];
for (let i = 0; i < RIPETIZIONI; i += 1) {
  const campione = Array.from({ length: blocchi.length }, () => blocchi[Math.floor(rnd() * blocchi.length)]);
  const o = orDi(campione).or;
  if (o !== null) orBoot.push(o);
}
orBoot.sort((a, b) => a - b);
const ic = [orBoot[Math.floor(0.025 * orBoot.length)], orBoot[Math.floor(0.975 * orBoot.length)]];
const R0 = punto.or !== null && ic[0] > 1;
const PENDENZA = 1.982602;
const deltaSoglia = punto.or !== null && punto.or > 0 ? Math.log(punto.or) / PENDENZA : null;

const esito = {
  _cosa_e: 'R0\' di PREREG_ripartenza_fondo.md — la ripartenza sul fondo 2018-2025, gare asciutte.',
  _data: '2026-08-07',
  perimetro: { gare_lette: gareLette, gare_bagnate_escluse: gareBagnate, gare_illeggibili: gareEscluse, gap_max_s: GAP_MAX, seme: SEME, ripetizioni: RIPETIZIONI },
  ripartenza: { occasioni: punto.r.n, sorpassi: punto.r.passa, p: punto.r.n ? punto.r.passa / punto.r.n : null },
  verde: { occasioni: punto.v.n, sorpassi: punto.v.passa, p: punto.v.n ? punto.v.passa / punto.v.n : null },
  odds_ratio: punto.or,
  ic95: ic,
  R0_passa: R0,
  conversione: { pendenza_sigillata: PENDENZA, delta_soglia_s_giro: deltaSoglia },
  richiamo_2026: 'la stessa misura sul 2026 (ESITO_ripartenza.json): OR 2,078, IC95 [0,919; 3,410], 115 occasioni — NON PASSA da sola, va nello stesso verso',
};
writeFileSync(path.join(QUI, 'ESITO_ripartenza_fondo.json'), `${JSON.stringify(esito, null, 1)}\n`);

// ── il SIGILLO: la sezione `ripartenza` di soglia_sorpasso.json la scrive QUESTO
// generatore (mai a mano). E' un INGRESSO DI LABORATORIO: il costruttore la usa
// solo con neutralizzazioneVera, la produzione non la vede mai (s43, s25).
if (R0) {
  const sigilloPath = path.join(RADICE, 'data', 'modelli', 'soglia_sorpasso.json');
  const sigillo = JSON.parse(readFileSync(sigilloPath, 'utf8'));
  sigillo.ripartenza = {
    attivo: false,
    perche_spenta: 'cancelli di applicazione NON superati (ESITO_cancelli_ripartenza.json): R1 8->10, R3 placebo >= reale. Il fenomeno esiste (R0 sotto), la forma uniforme del delta non rende. Accensione solo con una forma nuova pre-registrata.',
    delta_soglia: Number(deltaSoglia.toFixed(6)),
    odds_ratio: Number(punto.or.toFixed(4)),
    ic95: ic.map((x) => Number(x.toFixed(4))),
    occasioni_ripartenza: punto.r.n,
    gare: gareLette,
    targhetta: 'misurato sul fondo 2018-2025 asciutto (07/08/2026, PREREG_ripartenza_fondo.md) — '
      + 'INGRESSO DI LABORATORIO: agisce solo con neutralizzazioneVera, mai in produzione',
    generato_da: 'ai_lab/sorpasso/misura_ripartenza_fondo.mjs',
  };
  writeFileSync(sigilloPath, `${JSON.stringify(sigillo, null, 1)}\n`);
  console.log('   sigillo aggiornato: data/modelli/soglia_sorpasso.json -> ripartenza');
}

console.log('══ LA RIPARTENZA SUL FONDO — R0\' di PREREG_ripartenza_fondo.md ═════════════');
console.log(`   ${gareLette} gare asciutte lette (${gareBagnate} bagnate escluse, ${gareEscluse} illeggibili)`);
console.log(`   ripartenza  ${punto.r.passa}/${punto.r.n} occasioni = ${(100 * punto.r.passa / punto.r.n).toFixed(1)}%`);
console.log(`   verde       ${punto.v.passa}/${punto.v.n} occasioni = ${(100 * punto.v.passa / punto.v.n).toFixed(1)}%`);
console.log(`   odds ratio  ${punto.or?.toFixed(3)}   IC95 [${ic[0]?.toFixed(3)}, ${ic[1]?.toFixed(3)}]`);
console.log(`   R0' ${R0 ? `PASSA — Δsoglia = ${deltaSoglia.toFixed(4)} s/giro (dal FONDO: fuori campione per i cancelli 2026)` : 'NON PASSA — NULL su entrambe le fonti, il capitolo si chiude'}`);
