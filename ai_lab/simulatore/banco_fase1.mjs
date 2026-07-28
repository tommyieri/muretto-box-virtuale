// banco_fase1.mjs — FASE 1: il modello simmetrico contro quello di oggi.
//
//     node ai_lab/simulatore/banco_fase1.mjs
//     node ai_lab/simulatore/banco_fase1.mjs --json ai_lab/simulatore/esito_banco_fase1.json
//
// Tre soglie, pre-registrate in PREREG_fase1.md §5:
//
//   T5  |bias| sui tempi assoluti da ~1,9 s/giro a < 0,5 s/giro
//   T6  la posizione di rientro cambia in < 5% dei casi del banco di Fase 0
//   T3  Phi PER CIRCUITO batte Phi UNICO fuori campione (>= 2/3 delle gare)
//
// COSA SI CONFRONTA, esattamente:
//   OGGI   passo = race.pace[L] (mediana fuel-corretta a serbatoio vuoto), propagato PIATTO
//   NUOVO  passo = base al riferimento, ri-inflazionato a ogni giro con la deriva misurata
// Tutto il resto — gradino, pit-loss, cap del traffico spento — resta IDENTICO. Una sola
// cosa cambia alla volta, altrimenti il banco non attribuisce niente a niente.
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { passiBase, derivaPerGiro, simulaSimmetrico } from './passo.mjs';
import { simulaConSoste, misura } from '../../demo/gradino.mjs';
import { stessoGiroReale } from '../../demo/pitscenario.mjs';

const QUI = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(QUI, '..', '..');
const D = path.join(ROOT, 'demo', 'data');
const j = p => JSON.parse(fs.readFileSync(p, 'utf8'));

const ZONE = 0;
const MIN_SOSTE = 3;
const ORIZZONTI = [5, 10, 20];
const ESCLUSE = new Set(['Monaco']);

const der = j(path.join(QUI, 'esito_deriva.json'));
const RHO = j(path.join(QUI, 'esito_degrado.json')).pooled_comune.rho_comune;
const REG = j(path.join(ROOT, 'data', 'gare_registro.json'));
const tiDi = g => REG[g]?.ti;
// Phi UNICO di regime: la mediana 2026 (una sola cifra per tutto il campionato)
const PHI_UNICO = der.mediane['2026'];
// Phi PER CIRCUITO fuori campione: SOLO il prior storico, mai la gara che si sta valutando
const phiOOS = g => der.phi_per_circuito_2026?.[tiDi(g)]?.prior_storico ?? PHI_UNICO;
// Phi per circuito "di produzione": prior + gara 2026, ristretto (usa la gara -> non OOS)
const phiProd = g => der.phi_per_circuito_2026?.[tiDi(g)]?.phi ?? PHI_UNICO;

const verde = c => c && c.lap_time != null && !c.neutralized && !c.in_lap && !c.out_lap;

function caricaGara(gara) {
  const race = j(path.join(D, `${gara}.json`));
  race.byLap = {};
  for (const lp of race.laps) race.byLap[lp.lap] = lp.cars;
  race.nonParten = new Set(race.nonParten || []);
  race.gara = gara;
  return race;
}

// ---------------------------------------------------------------- T5 e T3
// Da un giro di congelamento L si predicono i tempi sul giro dei giri VERDI successivi e si
// confrontano col reale. Nessuna sosta di mezzo: qui si misura il passo, non la strategia.
function biasSuOrizzonti(race, phiFn) {
  const out = {};
  for (const H of ORIZZONTI) out[H] = { oggi: [], nuovo: [], conRho: [] };
  const nL = race.n_laps;
  const delta = phiFn(race.gara);
  for (let L = 8; L <= nL - Math.max(...ORIZZONTI); L += 3) {
    const pace = race.pace[String(L)];
    if (!pace) continue;
    const piloti = Object.keys(race.byLap[L] || {})
      .filter(d => !race.nonParten.has(d) && typeof race.byLap[L][d].cum_time === 'number');
    const base = passiBase(race.byLap, nL, L, piloti, { delta });
    // ANTEPRIMA FASE 2, non un deliverable di Fase 1: stesso modello + il termine di eta
    // gomma misurato dal grezzo. Serve a capire se il residuo che resta e' degrado.
    const baseR = passiBase(race.byLap, nL, L, piloti, { delta, rho: RHO, eta0: 0 });
    const dg = derivaPerGiro(delta, nL);
    for (const d of piloti) {
      for (const H of ORIZZONTI) {
        for (let k = L + 1; k <= Math.min(nL, L + H); k++) {
          const c = race.byLap[k]?.[d];
          if (!verde(c)) continue;
          // stesso stint del congelamento: dopo una sosta il passo e' un altro oggetto
          if (c.stint !== race.byLap[L][d]?.stint) continue;
          if (pace[d] != null) out[H].oggi.push(pace[d] - c.lap_time);
          if (base[d] != null) out[H].nuovo.push(base[d] + dg * (k - 1) - c.lap_time);
          if (baseR[d] != null && typeof c.tyre_age === 'number')
            out[H].conRho.push(baseR[d] + dg * (k - 1) + RHO * c.tyre_age - c.lap_time);
        }
      }
    }
  }
  return out;
}

const media = v => v.length ? v.reduce((s, x) => s + x, 0) / v.length : NaN;
const mae = v => v.length ? v.reduce((s, x) => s + Math.abs(x), 0) / v.length : NaN;

// ---------------------------------------------------------------------- T6
// La posizione di rientro cambia? Stessi casi del banco di Fase 0: ogni sosta vera.
function posizioniRientro(race, phiFn) {
  const nL = race.n_laps, out = [];
  const pitloss = j(path.join(D, 'pitloss.json'))[race.gara];
  const delta = phiFn(race.gara);
  for (let P = 2; P <= nL; P++) {
    for (const [drv, c] of Object.entries(race.byLap[P] || {})) {
      if (!c.in_lap) continue;
      const L = P - 1;
      const pace = race.pace[String(L)];
      if (!pace) continue;
      const cars = race.byLap[L] || {};
      const present = Object.keys(cars).filter(d =>
        typeof cars[d].cum_time === 'number' && !race.nonParten.has(d) && pace[d] != null);
      if (!present.includes(drv)) continue;
      const viva = misura(race.byLap, nL, L);
      const gradino = (viva.gradino != null && viva.n_gradino >= MIN_SOSTE) ? viva.gradino : null;
      const loss = (viva.perdita != null && viva.n_perdita >= MIN_SOSTE) ? viva.perdita : pitloss;
      if (loss == null) continue;
      const orizzonte = gradino != null ? 5 : 0;
      const steps = (P - L) + 1 + orizzonte;
      const pits = [{ driver: drv, lap: P, loss }];

      const state = {};
      for (const d of present) state[d] = { cum_time: cars[d].cum_time };
      const A = simulaConSoste({ state, pace, freezeLap: L, steps, ZONE, pits, gradino });

      const base = passiBase(race.byLap, nL, L, present, { delta });
      if (base[drv] == null) continue;
      const B = simulaSimmetrico({ base, byLap: race.byLap, nLaps: nL, freezeLap: L, steps,
                                   pits, delta, gradino, ZONE });

      const gruppo = stessoGiroReale(race.byLap, L, nL, drv, present);
      const rank = (fin) => {
        const ord = gruppo.filter(d => fin[d] != null).sort((a, b) => fin[a] - fin[b]);
        return ord.indexOf(drv) + 1;
      };
      const ra = rank(A), rb = rank(B);
      if (ra > 0 && rb > 0) out.push({ gara: race.gara, drv, P, oggi: ra, nuovo: rb });
    }
  }
  return out;
}

function main() {
  const argv = process.argv.slice(2);
  const iJson = argv.indexOf('--json');
  const outJson = iJson >= 0 ? argv[iJson + 1] : null;
  const gare = j(path.join(D, 'manifest.json')).map(r => r.gara).filter(g => !ESCLUSE.has(g));

  console.log('='.repeat(100));
  console.log('BANCO FASE 1 — il modello simmetrico contro quello di oggi');
  console.log(`Phi unico di regime = ${PHI_UNICO.toFixed(3)} s   ·   per-circuito da esito_deriva.json`);
  console.log('='.repeat(100));

  // --- T5 ---
  const accUni = {}, accCirc = {}, accOOS = {};
  for (const H of ORIZZONTI) { accUni[H] = { oggi: [], nuovo: [], conRho: [] }; accCirc[H] = { oggi: [], nuovo: [] }; accOOS[H] = { oggi: [], nuovo: [] }; }
  const perGara = [];
  for (const g of gare) {
    const race = caricaGara(g);
    const u = biasSuOrizzonti(race, () => PHI_UNICO);
    const c = biasSuOrizzonti(race, phiProd);
    const o = biasSuOrizzonti(race, phiOOS);
    for (const H of ORIZZONTI) {
      accUni[H].oggi.push(...u[H].oggi); accUni[H].nuovo.push(...u[H].nuovo);
      accUni[H].conRho.push(...u[H].conRho);
      accCirc[H].nuovo.push(...c[H].nuovo);
      accOOS[H].nuovo.push(...o[H].nuovo);
    }
    perGara.push({ gara: g,
      mae_unico: mae(u[10].nuovo), mae_circuito_oos: mae(o[10].nuovo),
      bias_oggi: media(u[10].oggi), bias_nuovo: media(u[10].nuovo) });
  }

  console.log('\nT5 — BIAS SUI TEMPI ASSOLUTI (previsto meno reale, s/giro)');
  console.log(`  ${'orizzonte'.padEnd(12)}${'OGGI bias'.padStart(11)}${'OGGI MAE'.padStart(10)}`
    + `${'NUOVO bias'.padStart(12)}${'NUOVO MAE'.padStart(11)}${'n'.padStart(9)}`);
  let t5 = true;
  for (const H of ORIZZONTI) {
    const bo = media(accUni[H].oggi), bn = media(accUni[H].nuovo);
    console.log(`  ${(H + ' giri').padEnd(12)}${bo.toFixed(3).padStart(11)}`
      + `${mae(accUni[H].oggi).toFixed(3).padStart(10)}${bn.toFixed(3).padStart(12)}`
      + `${mae(accUni[H].nuovo).toFixed(3).padStart(11)}${String(accUni[H].nuovo.length).padStart(9)}`);
    if (Math.abs(bn) >= 0.5) t5 = false;
  }
  console.log(`  T5 ${t5 ? 'PASSA' : 'NON PASSA'}  (soglia |bias| < 0,5 s/giro su tutti gli orizzonti)`);

  console.log('\n  ANTEPRIMA FASE 2 — lo stesso modello col termine di eta gomma acceso');
  console.log(`  (rho = ${RHO.toFixed(4)} dal grezzo; NON e un deliverable di Fase 1)`);
  let t5r = true;
  for (const H of ORIZZONTI) {
    const b = media(accUni[H].conRho);
    if (Math.abs(b) >= 0.5) t5r = false;
    console.log(`  ${(H + ' giri').padEnd(12)}${''.padStart(21)}${b.toFixed(3).padStart(12)}`
      + `${mae(accUni[H].conRho).toFixed(3).padStart(11)}${String(accUni[H].conRho.length).padStart(9)}`);
  }
  console.log(`  con rho acceso T5 ${t5r ? 'PASSEREBBE' : 'non passerebbe'}`);

  // --- T3 ---
  console.log('\nT3 — PHI PER CIRCUITO BATTE PHI UNICO? (fuori campione: solo prior storico)');
  const vinte = perGara.filter(r => r.mae_circuito_oos < r.mae_unico).length;
  console.log(`  ${'gara'.padEnd(18)}${'MAE Phi unico'.padStart(15)}${'MAE per-circuito'.padStart(18)}  esito`);
  for (const r of perGara)
    console.log(`  ${r.gara.padEnd(18)}${r.mae_unico.toFixed(3).padStart(15)}`
      + `${r.mae_circuito_oos.toFixed(3).padStart(18)}  ${r.mae_circuito_oos < r.mae_unico ? 'per-circuito' : 'unico'}`);
  const t3 = vinte / perGara.length >= 2 / 3;
  console.log(`  per-circuito vince in ${vinte}/${perGara.length}  -> T3 ${t3 ? 'PASSA' : 'NON PASSA'} (soglia 2/3)`);

  // --- T6 ---
  console.log('\nT6 — LE POSIZIONI DI RIENTRO SI MUOVONO?');
  const phiScelto = t3 ? phiProd : () => PHI_UNICO;
  let tutte = [];
  for (const g of gare) tutte.push(...posizioniRientro(caricaGara(g), phiScelto));
  const cambiate = tutte.filter(r => r.oggi !== r.nuovo);
  const quota = cambiate.length / tutte.length;
  const t6 = quota < 0.05;
  console.log(`  casi confrontati: ${tutte.length}`);
  console.log(`  posizione cambiata: ${cambiate.length}  (${(quota * 100).toFixed(1)}%)`);
  const spost = cambiate.map(r => r.nuovo - r.oggi);
  if (spost.length) {
    const su = spost.filter(x => x < 0).length, giu = spost.filter(x => x > 0).length;
    console.log(`  di cui: ${su} rientri MIGLIORI, ${giu} PEGGIORI   `
      + `spostamento massimo ${Math.max(...spost.map(Math.abs))} posizioni`);
  }
  console.log(`  T6 ${t6 ? 'PASSA' : 'NON PASSA'}  (soglia < 5%)`);

  // --- la decisione di pubblicazione, dalla tabella del PREREG §6 ---
  console.log('\n' + '='.repeat(100));
  console.log('DECISIONE DI PUBBLICAZIONE (PREREG_fase1.md §6)');
  let deciso;
  if (t5 && t6 && t3) deciso = 'modello simmetrico con Phi PER CIRCUITO -> online';
  else if (t5 && t6) deciso = 'modello simmetrico con Phi UNICO di regime -> online';
  else if (t5) deciso = 'modello simmetrico dietro INTERRUTTORE SPENTO: cambia le posizioni, decide il PO';
  else deciso = 'non si pubblica il modello; si pubblica il report del perche';
  console.log(`  T5 ${t5 ? 'ok' : 'no'} · T6 ${t6 ? 'ok' : 'no'} · T3 ${t3 ? 'ok' : 'no'}  ->  ${deciso}`);

  if (outJson) {
    fs.writeFileSync(outJson, JSON.stringify({
      targhetta: { prereg: 'ai_lab/simulatore/PREREG_fase1.md', phi_unico: PHI_UNICO,
                   gare, escluse: [...ESCLUSE], orizzonti: ORIZZONTI, ZONE },
      T5: { passa: t5, per_orizzonte: Object.fromEntries(ORIZZONTI.map(H => [H, {
        bias_oggi: media(accUni[H].oggi), mae_oggi: mae(accUni[H].oggi),
        bias_nuovo: media(accUni[H].nuovo), mae_nuovo: mae(accUni[H].nuovo),
        n: accUni[H].nuovo.length,
        bias_con_rho: media(accUni[H].conRho), mae_con_rho: mae(accUni[H].conRho) }])) },
      T3: { passa: t3, vinte, su: perGara.length, per_gara: perGara },
      T6: { passa: t6, n: tutte.length, cambiate: cambiate.length, quota, casi: cambiate },
      decisione: deciso,
    }, null, 1));
    console.log(`\nscritto ${outJson}`);
  }
}

main();
