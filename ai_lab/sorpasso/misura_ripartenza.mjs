// misura_ripartenza.mjs — R0 di PREREG_ripartenza.md: alla ripartenza si passa di più?
//
//     node ai_lab/sorpasso/misura_ripartenza.mjs [--json]
//
// Misura P(sorpasso | occasione) sui giri di RIPARTENZA (primo giro non in finestra
// dopo una finestra di campo) contro i giri VERDI ordinari, sulle 11 gare 2026.
// Occasione e sorpasso sono definiti nella prereg, PRIMA di questa esecuzione.
// L'esito scrive ESITO_ripartenza.json. NON tocca nessun sigillo da solo.

import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { gare, garaNuova } from '../confronto/banco.mjs';
import { regimePerGiroDiCampo } from '../../simulatore/provenienza/definizioni.mjs';
import { creaGeneratore } from '../../simulatore/banco/misure/difesa.mjs';

const QUI = path.dirname(fileURLToPath(import.meta.url));
const JSON_OUT = process.argv.includes('--json');
const GAP_MAX = 1.5;          // prereg: occasione = coppia adiacente con gap <= 1,5 s
const SEME = 20260807;
const RIPETIZIONI = 2000;

function occasioniDellaGara(nomeSito) {
  const g = garaNuova(nomeSito);
  const finestre = regimePerGiroDiCampo(g.perPilota);
  const ripartenze = new Set();
  for (let L = 2; L <= g.nGiri; L += 1) if (finestre[L - 1] && !finestre[L]) ripartenze.add(L);

  const celle = (drv, L) => g.perPilota.get(drv)?.get(L);
  const esiti = { ripartenza: [], verde: [] };
  for (let L = 2; L <= g.nGiri; L += 1) {
    if (finestre[L]) continue;                                    // giro in finestra: fuori
    const tipo = ripartenze.has(L) ? 'ripartenza' : (finestre[L - 1] ? null : 'verde');
    if (tipo === null) continue;
    // l'ordine a inizio giro: cum alla fine di L-1, per chi c'e' a L-1 E a L
    const righe = [];
    for (const [drv, perLap] of g.perPilota) {
      const prima = perLap.get(L - 1); const ora = perLap.get(L);
      if (!prima || !ora) continue;
      if (!Number.isFinite(prima.cum_time) || !Number.isFinite(ora.cum_time)) continue;
      righe.push({ drv, prima: prima.cum_time, dopo: ora.cum_time, inout: ora.in_lap === true || ora.out_lap === true, eta: ora.tyre_age });
    }
    righe.sort((a, b) => a.prima - b.prima);
    for (let i = 1; i < righe.length; i += 1) {
      const avanti = righe[i - 1]; const dietro = righe[i];
      if (avanti.inout || dietro.inout) continue;                 // le soste non sono sorpassi in pista
      const gap = dietro.prima - avanti.prima;
      if (!(gap >= 0 && gap <= GAP_MAX)) continue;
      esiti[tipo].push({
        sorpasso: dietro.dopo < avanti.dopo,
        // contorno descrittivo (non decide): quanto e' piu' fresca la gomma di chi sta dietro
        eta_delta: (Number.isFinite(avanti.eta) && Number.isFinite(dietro.eta)) ? avanti.eta - dietro.eta : null,
      });
    }
  }
  return { gara: nomeSito, ripartenze: [...ripartenze], esiti };
}

const perGara = gare().map(occasioniDellaGara);

const conta = (righe) => ({ n: righe.length, passa: righe.filter((x) => x.sorpasso).length });
const odds = (c) => (c.passa === 0 || c.passa === c.n ? null : (c.passa / c.n) / (1 - c.passa / c.n));
const orDi = (blocchi) => {
  const r = conta(blocchi.flatMap((b) => b.esiti.ripartenza));
  const v = conta(blocchi.flatMap((b) => b.esiti.verde));
  const oR = odds(r); const oV = odds(v);
  return { r, v, or: (oR === null || oV === null) ? null : oR / oV };
};

const punto = orDi(perGara);

// bootstrap A BLOCCHI = GARE (regola: blocchi = gare, sempre), seminato
const rnd = creaGeneratore(SEME);
const orBoot = [];
for (let i = 0; i < RIPETIZIONI; i += 1) {
  const campione = Array.from({ length: perGara.length }, () => perGara[Math.floor(rnd() * perGara.length)]);
  const o = orDi(campione).or;
  if (o !== null) orBoot.push(o);
}
orBoot.sort((a, b) => a - b);
const ic = [orBoot[Math.floor(0.025 * orBoot.length)], orBoot[Math.floor(0.975 * orBoot.length)]];
const R0 = punto.or !== null && ic[0] > 1;

const PENDENZA = 1.982602;    // |pendenza| della legge sigillata (soglia_sorpasso.json)
const deltaSoglia = punto.or !== null && punto.or > 0 ? Math.log(punto.or) / PENDENZA : null;

const mediana = (v) => { const s = v.filter((x) => x !== null).sort((a, b) => a - b); return s.length ? s[s.length >> 1] : null; };
const etaPassRip = mediana(perGara.flatMap((b) => b.esiti.ripartenza.filter((x) => x.sorpasso).map((x) => x.eta_delta)));
const etaPassVer = mediana(perGara.flatMap((b) => b.esiti.verde.filter((x) => x.sorpasso).map((x) => x.eta_delta)));

const esito = {
  _cosa_e: 'R0 di PREREG_ripartenza.md — alla ripartenza si passa di piu\'? Misura, non cancello di prodotto.',
  _data: '2026-08-07',
  perimetro: { gare: perGara.length, gap_max_s: GAP_MAX, seme: SEME, ripetizioni: RIPETIZIONI },
  ripartenza: { occasioni: punto.r.n, sorpassi: punto.r.passa, p: punto.r.n ? punto.r.passa / punto.r.n : null },
  verde: { occasioni: punto.v.n, sorpassi: punto.v.passa, p: punto.v.n ? punto.v.passa / punto.v.n : null },
  odds_ratio: punto.or,
  ic95: ic,
  R0_passa: R0,
  conversione: {
    pendenza_sigillata: PENDENZA,
    delta_soglia_s_giro: deltaSoglia,
    nota: 'Δ = ln(OR)/pendenza — stessa logistica con intercetta spostata, assunzione di forma DICHIARATA (prereg)',
  },
  contorno_descrittivo: {
    eta_delta_mediano_chi_passa_ripartenza: etaPassRip,
    eta_delta_mediano_chi_passa_verde: etaPassVer,
    nota: 'quanto e\' piu\' fresca (in giri) la gomma di chi passa; descrive, non decide',
  },
  giri_di_ripartenza_per_gara: Object.fromEntries(perGara.map((b) => [b.gara, b.ripartenze])),
};

writeFileSync(path.join(QUI, 'ESITO_ripartenza.json'), `${JSON.stringify(esito, null, 1)}\n`);

if (JSON_OUT) { console.log(JSON.stringify(esito, null, 1)); } else {
  console.log('══ LA RIPARTENZA — R0 di PREREG_ripartenza.md ══════════════════════════════');
  console.log(`   ripartenza  ${punto.r.passa}/${punto.r.n} occasioni = ${(100 * punto.r.passa / punto.r.n).toFixed(1)}%`);
  console.log(`   verde       ${punto.v.passa}/${punto.v.n} occasioni = ${(100 * punto.v.passa / punto.v.n).toFixed(1)}%`);
  console.log(`   odds ratio  ${punto.or?.toFixed(3)}   IC95 [${ic[0]?.toFixed(3)}, ${ic[1]?.toFixed(3)}]   (bootstrap a blocchi-gara)`);
  console.log(`   R0 ${R0 ? 'PASSA' : 'NON PASSA'} — ${R0 ? `Δsoglia = ln(OR)/pendenza = ${deltaSoglia.toFixed(4)} s/giro` : 'il capitolo si chiude NULL, il kernel non si tocca'}`);
  console.log(`   contorno: chi passa alla ripartenza ha gomma piu' fresca di ${etaPassRip} giri (mediana; in verde: ${etaPassVer})`);
}
