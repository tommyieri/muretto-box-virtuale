// fisica_residui.mjs — LA FORMA DEL RESIDUO.
//
//     node ai_lab/confronto/fisica_residui.mjs
//
// Non misura chi vince fra i due motori (quello e' M1..M5). Misura se
// l'equazione del passo del motore NUOVO
//
//     t = base(pilota) + delta*(giro-1) + rho*eta        delta = -delta70/N
//
// ha residui STRUTTURATI, cioe' se la forma funzionale e' sbagliata. Il test e'
// dentro campione per costruzione (e' un test di FORMA, non di prestazione): un
// residuo che dipende sistematicamente da una variabile che il modello non ha
// e' una mis-specifica, e si vede anche in-sample.
//
// METODO. Per ogni (gara, pilota) si toglie la MEDIANA dei residui, che e'
// esattamente cio' che `stimaBasi` chiama `base`. Quindi il residuo che resta e'
// ortogonale al livello del pilota per costruzione: tutto cio' che ne esce e'
// forma, non taratura.
//
// NON SCRIVE NIENTE su disco. Non tocca demo/, simulatore/, data/.

import path from 'node:path';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { caricaGare2026 } from '../../simulatore/provenienza/gare_2026.mjs';
import { passoUtilizzabile, regimeNeutralizzato, statusVerde } from '../../simulatore/provenienza/definizioni.mjs';
import { simboliStatus } from '../../simulatore/provenienza/vocabolario.mjs';

const QUI = path.dirname(fileURLToPath(import.meta.url));
const RADICE = path.resolve(QUI, '..', '..');
const SIM = path.join(RADICE, 'simulatore');

const MODELLO = JSON.parse(readFileSync(path.join(SIM, 'data', 'modelli', 'modello_v2.json'), 'utf8'));
const RHO = MODELLO.rho.valore;
const DELTA70 = MODELLO.delta_70.scelto;

const mediana = (v) => {
  if (!v.length) return null;
  const s = [...v].sort((a, b) => a - b);
  const m = s.length >> 1;
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};
const media = (v) => (v.length ? v.reduce((a, b) => a + b, 0) / v.length : null);
const f = (x, n = 3) => (x === null || x === undefined ? '  —  ' : x.toFixed(n));

// bootstrap a blocchi = GARE (E11)
function rng(seme) {
  let s = seme >>> 0;
  return () => { s ^= s << 13; s >>>= 0; s ^= s >> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; };
}
function icBlocchi(perGara, stat, { B = 2000, seme = 20260801 } = {}) {
  const chiavi = Object.keys(perGara).filter((k) => perGara[k].length > 0);
  if (chiavi.length < 2) return null;
  const r = rng(seme);
  const out = [];
  for (let b = 0; b < B; b += 1) {
    const u = [];
    for (let i = 0; i < chiavi.length; i += 1) u.push(...perGara[chiavi[Math.floor(r() * chiavi.length)]]);
    const v = stat(u);
    if (v !== null && Number.isFinite(v)) out.push(v);
  }
  out.sort((a, b) => a - b);
  const q = (p) => out[Math.min(out.length - 1, Math.max(0, Math.floor(p * out.length)))];
  return [q(0.025), q(0.975)];
}

const gare = caricaGare2026(SIM);
const NOMI = Object.keys(gare).sort();

// ═══════════════════════════════════════════════════ raccolta dei giri verdi
// Un record per giro verde: residuo dal modello, piu' tutte le covariate che il
// modello NON ha.
const verdi = [];
const neutri = [];
let celleTotali = 0;
let celleNeutre = 0;
let celleSCsolo = 0;
let celleVSCsolo = 0;

for (const nome of NOMI) {
  const g = gare[nome];
  const N = g.nGiri;
  const deriva = -DELTA70 / N;

  // indice per giro: serve per il gap all'auto davanti (traffico)
  const perGiro = new Map();
  for (const { drv, lap, cella } of g.righe) {
    if (!perGiro.has(lap)) perGiro.set(lap, []);
    perGiro.get(lap).push({ drv, cella });
  }
  // gap all'auto davanti, allo STESSO indice di giro (cioe' fra auto che hanno
  // completato lo stesso numero di giri). Un doppiato fisicamente davanti non
  // compare: LIMITE DICHIARATO.
  const gapDavanti = new Map(); // `${drv}|${lap}` -> secondi (null per il primo)
  for (const [lap, elenco] of perGiro) {
    const conCum = elenco.filter((x) => typeof x.cella.cum_time === 'number')
      .sort((a, b) => a.cella.cum_time - b.cella.cum_time);
    for (let i = 0; i < conCum.length; i += 1) {
      gapDavanti.set(`${conCum[i].drv}|${lap}`,
        i === 0 ? null : conCum[i].cella.cum_time - conCum[i - 1].cella.cum_time);
      // posizione allo stesso indice di giro
      gapDavanti.set(`pos|${conCum[i].drv}|${lap}`, i + 1);
    }
  }

  // stint: primo giro dello stint per pilota (per il giro-dentro-lo-stint)
  for (const [drv, celle] of g.perPilota) {
    const laps = [...celle.keys()].sort((a, b) => a - b);
    for (const lap of laps) {
      const c = celle.get(lap);
      celleTotali += 1;
      let neut = false;
      try { neut = regimeNeutralizzato(c); } catch { neut = false; }
      if (neut) {
        celleNeutre += 1;
        const sim = simboliStatus(c.status);
        if (sim.has('4')) celleSCsolo += 1; else if (sim.has('6')) celleVSCsolo += 1;
        if (typeof c.lap_time === 'number' && c.in_lap !== true && c.out_lap !== true) {
          neutri.push({
            gara: nome, drv, lap, N,
            tipo: sim.has('4') ? 'SC' : 'VSC',
            t: c.lap_time,
            gap: gapDavanti.get(`${drv}|${lap}`) ?? null,
          });
        }
        continue;
      }
      let ok = false;
      try { ok = passoUtilizzabile(c) && c.tyre_age !== null; } catch { ok = false; }
      if (!ok) continue;
      verdi.push({
        gara: nome, drv, lap, N,
        eta: c.tyre_age,
        stint: c.stint,
        t: c.lap_time,
        compound: c.compound,
        // il residuo del MODELLO, prima di togliere la base del pilota
        r0: c.lap_time - deriva * (lap - 1) - RHO * c.tyre_age,
        gap: gapDavanti.get(`${drv}|${lap}`) ?? null,
        pos: gapDavanti.get(`pos|${drv}|${lap}`) ?? null,
        frazione: lap / N,
      });
    }
  }
}

// base = mediana del residuo per (gara, pilota) — la STESSA cosa che fa stimaBasi
const perBlocco = new Map();
for (const v of verdi) {
  const k = `${v.gara}|${v.drv}`;
  if (!perBlocco.has(k)) perBlocco.set(k, []);
  perBlocco.get(k).push(v.r0);
}
const basi = new Map();
for (const [k, vals] of perBlocco) basi.set(k, mediana(vals));
for (const v of verdi) v.e = v.r0 - basi.get(`${v.gara}|${v.drv}`);

// il passo verde tipico del pilota, per normalizzare i giri neutralizzati
const passoTipico = new Map(); // gara|drv -> mediana lap_time verde
{
  const acc = new Map();
  for (const v of verdi) {
    const k = `${v.gara}|${v.drv}`;
    if (!acc.has(k)) acc.set(k, []);
    acc.get(k).push(v.t);
  }
  for (const [k, vals] of acc) passoTipico.set(k, mediana(vals));
}

console.log('FISICA DEL PASSO — la FORMA del residuo del modello v2');
console.log(`  modello: t = base + delta*(giro-1) + rho*eta   ·   delta70 = ${DELTA70}  rho = ${RHO}`);
console.log(`  gare 2026: ${NOMI.length}  ·  celle totali ${celleTotali}  ·  giri verdi utilizzabili ${verdi.length}`);
console.log(`  celle sotto regime neutralizzato ${celleNeutre} (${(100 * celleNeutre / celleTotali).toFixed(1)}%) — SC ${celleSCsolo} · VSC ${celleVSCsolo}`);
console.log(`  blocchi (gara,pilota) con base: ${basi.size}`);

// ═══════════════════════════════════════════════════════ 1 · residuo vs ETA
function tabellaBin(titolo, righe, chiave, bins, etichette) {
  console.log(`\n${titolo}`);
  console.log('   fascia            n      mediana e   media e    IC95 mediana (blocchi=gare)');
  for (let i = 0; i < bins.length; i += 1) {
    const sel = righe.filter(bins[i]);
    if (!sel.length) { console.log(`   ${etichette[i].padEnd(16)}      0`); continue; }
    const e = sel.map((x) => x.e);
    const pg = {};
    for (const n of NOMI) pg[n] = sel.filter((x) => x.gara === n).map((y) => y.e);
    const ic = icBlocchi(pg, mediana);
    console.log(`   ${etichette[i].padEnd(16)} ${String(sel.length).padStart(6)}   ${f(mediana(e)).padStart(9)}  ${f(media(e)).padStart(8)}    [${f(ic?.[0])}; ${f(ic?.[1])}]`);
  }
}

const binsEta = [
  (x) => x.eta >= 1 && x.eta <= 3,
  (x) => x.eta >= 4 && x.eta <= 7,
  (x) => x.eta >= 8 && x.eta <= 12,
  (x) => x.eta >= 13 && x.eta <= 18,
  (x) => x.eta >= 19 && x.eta <= 25,
  (x) => x.eta >= 26,
];
tabellaBin('1 · RESIDUO vs ETA GOMMA  (se rho lineare bastasse, tutte le righe sarebbero 0)',
  verdi, 'eta', binsEta, ['eta 1-3', 'eta 4-7', 'eta 8-12', 'eta 13-18', 'eta 19-25', 'eta 26+']);

// ═════════════════════════════════════════════ 2 · residuo vs FRAZIONE DI GARA
const binsFraz = [
  (x) => x.frazione <= 0.1,
  (x) => x.frazione > 0.1 && x.frazione <= 0.25,
  (x) => x.frazione > 0.25 && x.frazione <= 0.5,
  (x) => x.frazione > 0.5 && x.frazione <= 0.75,
  (x) => x.frazione > 0.75 && x.frazione <= 0.9,
  (x) => x.frazione > 0.9,
];
tabellaBin('2 · RESIDUO vs FRAZIONE DI GARA  (se delta*(giro-1) lineare bastasse, tutte 0)',
  verdi, 'frazione', binsFraz, ['0-10%', '10-25%', '25-50%', '50-75%', '75-90%', '90-100%']);

// ═══════════════════════════════════════════════════ 3 · residuo vs TRAFFICO
const binsGap = [
  (x) => x.gap !== null && x.gap <= 1.0,
  (x) => x.gap !== null && x.gap > 1.0 && x.gap <= 2.0,
  (x) => x.gap !== null && x.gap > 2.0 && x.gap <= 3.0,
  (x) => x.gap !== null && x.gap > 3.0 && x.gap <= 5.0,
  (x) => x.gap !== null && x.gap > 5.0 && x.gap <= 10.0,
  (x) => x.gap !== null && x.gap > 10.0,
  (x) => x.gap === null,
];
tabellaBin('3 · RESIDUO vs GAP ALL\'AUTO DAVANTI, stesso indice di giro (il modello NON ha traffico)',
  verdi, 'gap', binsGap, ['<= 1,0 s', '1,0-2,0 s', '2,0-3,0 s', '3,0-5,0 s', '5,0-10 s', '> 10 s', 'primo (nessuno)']);

// ═════════════════════════════════════════════ 4 · residuo vs NUMERO DI STINT
const binsStint = [
  (x) => x.stint === 1, (x) => x.stint === 2, (x) => x.stint === 3, (x) => x.stint >= 4,
];
tabellaBin('4 · RESIDUO vs STINT', verdi, 'stint', binsStint, ['stint 1', 'stint 2', 'stint 3', 'stint 4+']);

// ═══════════════════════════════════════════════════ 5 · residuo per MESCOLA
const mescole = [...new Set(verdi.map((x) => x.compound))].sort();
tabellaBin('5 · RESIDUO per MESCOLA (controllo: il repo dichiara che non separano, p = 0,209)',
  verdi, 'compound', mescole.map((m) => (x) => x.compound === m), mescole);

// ═══════════════════════════════ 6 · il giro sotto NEUTRALIZZAZIONE, quanto costa
console.log('\n6 · IL GIRO NEUTRALIZZATO — quanto dura davvero rispetto al passo verde dello stesso pilota');
console.log('   (giri con lap_time, esclusi in-lap e out-lap; rapporto e differenza rispetto alla mediana verde)');
console.log('   tipo      n     rapporto mediano   differenza mediana (s)   IC95 differenza');
for (const tipo of ['SC', 'VSC']) {
  const sel = neutri.filter((x) => x.tipo === tipo && passoTipico.has(`${x.gara}|${x.drv}`));
  if (!sel.length) continue;
  const rap = sel.map((x) => x.t / passoTipico.get(`${x.gara}|${x.drv}`));
  const dif = sel.map((x) => x.t - passoTipico.get(`${x.gara}|${x.drv}`));
  const pg = {};
  for (const n of NOMI) pg[n] = sel.filter((x) => x.gara === n).map((y) => y.t - passoTipico.get(`${y.gara}|${y.drv}`));
  const ic = icBlocchi(pg, mediana);
  console.log(`   ${tipo.padEnd(6)} ${String(sel.length).padStart(5)}   ${f(mediana(rap)).padStart(14)}   ${f(mediana(dif), 2).padStart(20)}   [${f(ic?.[0], 2)}; ${f(ic?.[1], 2)}]`);
}
// per gara, che e' l'unita' di blocco
console.log('\n   per gara (differenza mediana, s) — blocchi = gare');
for (const n of NOMI) {
  for (const tipo of ['SC', 'VSC']) {
    const sel = neutri.filter((x) => x.gara === n && x.tipo === tipo && passoTipico.has(`${x.gara}|${x.drv}`));
    if (sel.length < 5) continue;
    const dif = sel.map((x) => x.t - passoTipico.get(`${x.gara}|${x.drv}`));
    console.log(`     ${n.padEnd(14)} ${tipo.padEnd(4)} n=${String(sel.length).padStart(4)}  ${f(mediana(dif), 2).padStart(8)} s`);
  }
}

// ═════════════════════════ 7 · sotto SC i DISTACCHI si comprimono? (il gap, non il tempo)
console.log('\n7 · SOTTO NEUTRALIZZAZIONE IL DISTACCO SI COMPRIME — variazione del gap dal leader, per giro');
console.log('   per ogni coppia (pilota, giro) con cum al giro k e k+1: d(gap dal leader) fra k e k+1');
console.log('   regime      n        d(gap) mediano   d(gap) medio   IC95 mediano');
{
  const perRegime = { verde: [], SC: [], VSC: [] };
  const perRegimeGara = { verde: {}, SC: {}, VSC: {} };
  for (const n of NOMI) for (const k of Object.keys(perRegime)) perRegimeGara[k][n] = [];
  for (const nome of NOMI) {
    const g = gare[nome];
    const perGiro = new Map();
    for (const { drv, lap, cella } of g.righe) {
      if (!perGiro.has(lap)) perGiro.set(lap, new Map());
      perGiro.get(lap).set(drv, cella);
    }
    for (let k = 1; k + 1 <= g.nGiri; k += 1) {
      const a = perGiro.get(k); const b = perGiro.get(k + 1);
      if (!a || !b) continue;
      const cumA = [...a.entries()].filter(([, c]) => typeof c.cum_time === 'number');
      if (!cumA.length) continue;
      const leader = cumA.reduce((m, x) => (x[1].cum_time < m[1].cum_time ? x : m), cumA[0])[0];
      const lA = a.get(leader); const lB = b.get(leader);
      if (!lB || typeof lB.cum_time !== 'number') continue;
      for (const [drv, cA] of a) {
        if (drv === leader) continue;
        const cB = b.get(drv);
        if (!cB || typeof cA.cum_time !== 'number' || typeof cB.cum_time !== 'number') continue;
        // niente soste dentro: il salto ai box non e' compressione
        if (cB.in_lap || cB.out_lap || lB.in_lap || lB.out_lap) continue;
        const d = (cB.cum_time - lB.cum_time) - (cA.cum_time - lA.cum_time);
        let reg = 'verde';
        try {
          const nb = regimeNeutralizzato(cB) || regimeNeutralizzato(lB);
          if (nb) reg = simboliStatus(cB.status).has('4') || simboliStatus(lB.status).has('4') ? 'SC' : 'VSC';
          else if (!statusVerde(cB) || !statusVerde(lB)) reg = null;
        } catch { reg = null; }
        if (reg === null) continue;
        perRegime[reg].push(d);
        perRegimeGara[reg][nome].push(d);
      }
    }
  }
  for (const reg of ['verde', 'SC', 'VSC']) {
    const v = perRegime[reg];
    const ic = icBlocchi(perRegimeGara[reg], mediana);
    console.log(`   ${reg.padEnd(8)} ${String(v.length).padStart(7)}   ${f(mediana(v)).padStart(14)}   ${f(media(v)).padStart(12)}   [${f(ic?.[0])}; ${f(ic?.[1])}]`);
  }
}
