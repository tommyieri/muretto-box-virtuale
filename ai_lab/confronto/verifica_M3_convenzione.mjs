#!/usr/bin/env node
// verifica_M3_convenzione.mjs — le DUE divergenze trovate dalla verifica indipendente.
//
//     node ai_lab/confronto/verifica_M3_convenzione.mjs
//
// 1 · L'ARROTONDAMENTO. Il referto sotto esame classifica la curva del nuovo su
//     `delta_s`, che `curvaDelQuando` scrive con `Number(delta.toFixed(3))`. Se due
//     candidati sono in pari merito (succede: l'ottimo cade a mezzo giro), il
//     millesimo li rende UGUALI e l'argmin scivola sul primo. Qui si misura se e'
//     tutto li: si prendono i totali GREZZI e si riclassifica due volte, con e senza
//     arrotondamento.
//
// 2 · LA CONVENZIONE DEL GIRO DI SOSTA. `evaluatePit` applica la perdita e azzera
//     l'eta gomma UN GIRO DOPO il giro dichiarato (`pits.filter(x => x.lap === cur)`
//     con `cur = freezeLap + s`, cioe' dopo aver simulato il giro `cur + 1`);
//     `doveRientri`/`curvaDelQuando` la applicano SUL giro dichiarato. Lo stesso
//     intero significa due cose diverse. Qui i due motori vengono messi sulla STESSA
//     griglia di giri EFFETTIVI (al vecchio si dichiara `p - 1` per ottenere una sosta
//     effettiva al giro `p`) e si rifa M3.
//
// Non scrive niente su disco.

import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { evaluatePit } from '../../demo/pitscenario.mjs';
import { misura as misuraGradino } from '../../demo/gradino.mjs';
import { caricaGare2026 } from '../../simulatore/provenienza/gare_2026.mjs';
import { caricaPrior } from '../../simulatore/provenienza/pitloss_dati.mjs';
import { caricaCostanti } from '../../simulatore/scenario/director_dati.mjs';
import { costruisciScenario, eseguiEValida } from '../../simulatore/scenario/costruttore.mjs';
import { mescolePerSoste } from '../../simulatore/scenario/piano.mjs';
import { MESCOLE_SLICK_ATTUALI } from '../../simulatore/provenienza/vocabolario.mjs';

const QUI = path.dirname(fileURLToPath(import.meta.url));
const RADICE = path.resolve(QUI, '..', '..');
const DEMO_DATA = path.join(RADICE, 'demo', 'data');
const SIM = path.join(RADICE, 'simulatore');
const PIATTA_S = 0.01, MIN_SOSTE_UI = 3, ZONE = 0, PRIMO_GIRO_AMMESSO = 4;

const mediana = (v) => { if (!v.length) return null; const s = [...v].sort((a, b) => a - b); const m = s.length >> 1; return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; };
const pct = (a, b) => (b ? `${(100 * a / b).toFixed(1)}%` : 'n/d');

const manifest = JSON.parse(readFileSync(path.join(DEMO_DATA, 'vista', 'manifest.json'), 'utf8'));
const SITO2SIM = manifest.cartella_di;
const GARE = Object.keys(SITO2SIM).sort();
const PITLOSS = JSON.parse(readFileSync(path.join(DEMO_DATA, 'pitloss.json'), 'utf8'));
const demoDi = new Map();
function demo(g) {
  if (demoDi.has(g)) return demoDi.get(g);
  const G = JSON.parse(readFileSync(path.join(DEMO_DATA, `${g}.json`), 'utf8'));
  const byLap = {}; for (const l of G.laps) byLap[l.lap] = l.cars;
  const v = { G, byLap, nLaps: G.n_laps, pitLoss: PITLOSS[g] };
  demoDi.set(g, v); return v;
}
function perimetro() {
  const out = [];
  for (const g of GARE) {
    const { byLap, nLaps } = demo(g);
    const leader = {};
    for (let k = 1; k <= nLaps; k += 1) { if (!byLap[k]) continue; let m = Infinity;
      for (const d of Object.keys(byLap[k])) { const t = byLap[k][d].cum_time; if (typeof t === 'number' && t < m) m = t; }
      if (m < Infinity) leader[k] = m; }
    const dopp = (Lo, cum) => leader[Lo + 1] !== undefined && cum > leader[Lo + 1];
    for (let Li = 1; Li <= nLaps; Li += 1) { if (!byLap[Li]) continue;
      for (const drv of Object.keys(byLap[Li])) {
        if (byLap[Li][drv].in_lap !== true) continue;
        const L = Li - 1, Lo = Li + 1;
        if (Li < PRIMO_GIRO_AMMESSO) continue;
        if (typeof byLap[L]?.[drv]?.cum_time !== 'number') continue;
        if (!byLap[Lo]) continue;
        const cumLo = byLap[Lo][drv]?.cum_time;
        if (typeof cumLo !== 'number') continue;
        if (dopp(Lo, cumLo)) continue;
        out.push({ id: `${g}|${drv}|${Li}`, gara: g, garaSim: SITO2SIM[g], pilota: drv,
                   freezeLap: L, pitLap: Li, nGiri: nLaps,
                   eta: byLap[L][drv].tyre_age ?? null,
                   mescolaAlCongelamento: byLap[L][drv].compound ?? null });
      } }
  }
  out.sort((a, b) => (a.gara < b.gara ? -1 : a.gara > b.gara ? 1 : a.pitLap - b.pitLap || (a.pilota < b.pilota ? -1 : 1)));
  return out;
}
const CASI = perimetro();

const GARE_SIM = caricaGare2026(SIM);
const MODELLO = JSON.parse(readFileSync(path.join(SIM, 'data', 'modelli', 'modello_v2.json'), 'utf8'));
const PRIOR = caricaPrior(SIM);
const COSTANTI = caricaCostanti(SIM);
const BANDA = JSON.parse(readFileSync(path.join(SIM, 'data', 'modelli', 'banda_rientro.json'), 'utf8'));
const ctx = (c, e = {}) => ({ gare: GARE_SIM, modello: MODELLO, prior: PRIOR, costantiDirector: COSTANTI,
                               bandaRientro: BANDA, nGiriGara: GARE_SIM[c.garaSim].nGiri, ...e });
const MODELLO_PASSO = JSON.parse(readFileSync(path.join(DEMO_DATA, 'modello_passo_2026.json'), 'utf8'));
const PASSO_V2 = { delta: MODELLO_PASSO.deriva.delta_gara_s, rho: MODELLO_PASSO.degrado.rho_s_giro };

function argVecchio(caso, pitLap, orizzonte) {
  const { G, byLap, nLaps, pitLoss } = demo(caso.gara);
  const L = caso.freezeLap;
  const bl = {}; for (let k = 1; k <= L; k += 1) if (byLap[k]) bl[k] = byLap[k];
  const pace = G.pace[String(L)] || {};
  const present = G.drivers.filter((d) => typeof bl[L]?.[d]?.cum_time === 'number' && pace[d] != null);
  const viva = misuraGradino(bl, nLaps, L);
  const gradino = (viva.gradino != null && viva.n_gradino >= MIN_SOSTE_UI) ? viva.gradino : null;
  return { byLap: bl, nLaps, pace, driver: caso.pilota, freezeLap: L, pitLap, pitLoss, present,
           gara: caso.gara, laps: G.laps, ZONE, orizzonte, gradino };
}
/** `effettivo`: se true, per avere la sosta EFFETTIVA al giro p si dichiara p-1. */
function curvaVecchio(caso, passo, H, { effettivo = false } = {}) {
  const L = caso.freezeLap, punti = [];
  for (let p = L + 1; p <= H - 1; p += 1) {
    const dich = effettivo ? p - 1 : p;
    const a = argVecchio(caso, dich, H - dich - 1);
    let r;
    try { r = evaluatePit({ ...a, passo, gradino: passo ? null : a.gradino, deriva: null }); }
    catch (e) { return { punti: null, motivo: `eccezione: ${e.message}` }; }
    if (!r?.ok) return { punti: null, motivo: r?.reason ?? 'nessuna risposta' };
    const mio = r.ordine_previsto.find(([d]) => d === caso.pilota);
    if (!mio) return { punti: null, motivo: 'assente dall\'ordine' };
    punti.push([p, mio[1]]);
  }
  return punti.length < 3 ? { punti: null, motivo: 'meno di 3 candidati' } : { punti, motivo: null };
}
const slickUsate = (c) => { const u = new Set();
  for (const [lap, x] of GARE_SIM[c.garaSim].perPilota.get(c.pilota) ?? [])
    if (lap <= c.freezeLap && x.compound !== null && MESCOLE_SLICK_ATTUALI.has(x.compound)) u.add(x.compound);
  return u; };
const mescolaLegale = (c) => mescolePerSoste(1, slickUsate(c))[0] ?? null;

function curvaNuovo(caso, mescola, H) {
  if (mescola === null) return { punti: null };
  const L = caso.freezeLap, punti = [];
  for (let p = L + 1; p <= H - 1; p += 1) {
    let sc;
    try { sc = costruisciScenario({ gara: caso.garaSim, freezeLap: L, pilota: caso.pilota, giroPit: p, mescola }, ctx(caso, { giroFinale: H })); }
    catch (e) { return { punti: null }; }
    const { risultato, direttore } = eseguiEValida(sc, COSTANTI);
    if (!direttore.approved) continue;
    const t = risultato.cum[caso.pilota];
    if (t === null || t === undefined) continue;
    punti.push([p, t]);
  }
  return punti.length < 3 ? { punti: null } : { punti };
}
function classifica(punti) {
  const v = punti.map((x) => x[1]);
  const min = Math.min(...v), max = Math.max(...v);
  const iMin = v.reduce((m, x, i) => (x < v[m] ? i : m), 0);
  const piatta = (max - min) <= PIATTA_S;
  return { iMin, giroMin: punti[iMin][0],
           dove: piatta ? 'piatta' : (iMin === 0 ? 'primo' : (iMin === punti.length - 1 ? 'ultimo' : 'interno')) };
}
/** La stessa curva vista attraverso il millesimo, come la pubblica `curvaDelQuando`. */
function arrotonda(punti) {
  const min = Math.min(...punti.map((x) => x[1]));
  return punti.map(([p, t]) => [p, Number((t - min).toFixed(3))]);
}

console.log('LE DUE DIVERGENZE — arrotondamento e convenzione del giro di sosta');
console.log(`\ncasi: ${CASI.length}`);

// ═══════════════ 1 · l'arrotondamento a 3 decimali di delta_s
const arr = { A: { n: 0, grezzo: 0, tondo: 0, spostati: 0, classeDiversa: 0 },
              B: { n: 0, grezzo: 0, tondo: 0, spostati: 0, classeDiversa: 0 } };
const nuoveA = [], nuoveB = [];
for (const c of CASI) {
  const mA = MESCOLE_SLICK_ATTUALI.has(c.mescolaAlCongelamento) ? c.mescolaAlCongelamento : null;
  const mB = mescolaLegale(c);
  for (const [k, m, dove] of [['A', mA, nuoveA], ['B', mB, nuoveB]]) {
    const r = curvaNuovo(c, m, c.nGiri);
    dove.push(r);
    if (!r.punti) continue;
    const g = classifica(r.punti), t = classifica(arrotonda(r.punti));
    arr[k].n += 1;
    if (g.dove === 'interno') arr[k].grezzo += 1;
    if (t.dove === 'interno') arr[k].tondo += 1;
    if (g.giroMin !== t.giroMin) arr[k].spostati += 1;
    if (g.dove !== t.dove) arr[k].classeDiversa += 1;
  }
}
console.log('\n1 · L\'ARROTONDAMENTO DI `delta_s` (Number(delta.toFixed(3)) in curvaDelQuando)');
for (const k of ['A', 'B']) {
  const a = arr[k];
  console.log(`  NUOVO ${k}: curve ${a.n} · INTERNI sui totali grezzi ${a.grezzo} (${pct(a.grezzo, a.n)})`
    + ` · INTERNI su delta_s arrotondato ${a.tondo} (${pct(a.tondo, a.n)})`);
  console.log(`            il millesimo sposta il giro del minimo in ${a.spostati} curve, e la CLASSE in ${a.classeDiversa}`);
}
console.log('  (il referto sotto esame stampa 34/95 e 177/260: sono i numeri arrotondati)');

// ═══════════════ 2 · la convenzione del giro di sosta
console.log('\n2 · LA CONVENZIONE DEL GIRO DI SOSTA');
console.log('  `evaluatePit`: pits.filter(x => x.lap === cur), cur = freezeLap + s (s da 0):');
console.log('  la perdita e l\'azzeramento dell\'eta cadono DOPO il giro reale cur+1 → il giro');
console.log('  dichiarato P si comporta come una sosta EFFETTIVA al giro P+1.');
console.log('  Rimessi sulla stessa griglia di giri EFFETTIVI (al vecchio si dichiara p-1):');
const conf = { pari: { v: 0, n: 0, tot: 0, uguali: 0, scarti: [] },
               spostata: { v: 0, n: 0, tot: 0, uguali: 0, scarti: [] } };
for (let i = 0; i < CASI.length; i += 1) {
  const c = CASI[i];
  const nb = nuoveB[i];
  if (!nb.punti) continue;
  const clsN = classifica(nb.punti);
  for (const [nome, eff] of [['pari', false], ['spostata', true]]) {
    const v = curvaVecchio(c, PASSO_V2, c.nGiri, { effettivo: eff });
    if (!v.punti) continue;
    const clsV = classifica(v.punti);
    const o = conf[nome];
    o.tot += 1;
    if (clsV.dove === 'interno') o.v += 1;
    if (clsN.dove === 'interno') o.n += 1;
    if (clsV.giroMin === clsN.giroMin) o.uguali += 1;
    o.scarti.push(clsN.giroMin - clsV.giroMin);
  }
}
for (const nome of ['pari', 'spostata']) {
  const o = conf[nome];
  console.log(`  ${nome === 'pari' ? 'stesso intero ai due motori (come il referto)' : 'stessa sosta EFFETTIVA (vecchio dichiara p-1)  '}`
    + `  n=${o.tot}  VECCHIO v2 interni ${o.v} (${pct(o.v, o.tot)})  ·  NUOVO B interni ${o.n} (${pct(o.n, o.tot)})`);
  console.log(`      stesso giro del minimo ${o.uguali} (${pct(o.uguali, o.tot)}) · scarto mediano ${mediana(o.scarti)}`);
}
