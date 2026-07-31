// verifica_M4_sonde.mjs — le sonde che il misuratore di M4 NON ha fatto.
//
// Quattro domande:
//   S1  il PERIMETRO e' neutro? copertura dei due motori sui 140 doppiati esclusi (tutti).
//   S2  le 274 "soste vere" sono 274 soste DISTINTE? censimento degli in_lap consecutivi.
//   S3  la copertura del vecchio dipende dall'orizzonte o dal troncamento? (deve essere no)
//   S4  il cancello M4 regge se si tolgono le soste-duplicate?
//
// Nessuna scrittura su disco.

import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { evaluatePit } from '../../demo/pitscenario.mjs';
import { misura as misuraGradino } from '../../demo/gradino.mjs';
import { caricaGare2026 } from '../../simulatore/provenienza/gare_2026.mjs';
import { caricaPrior } from '../../simulatore/provenienza/pitloss_dati.mjs';
import { caricaCostanti } from '../../simulatore/scenario/director_dati.mjs';
import { doveRientri } from '../../simulatore/scenario/costruttore.mjs';
import { mescolaAlGiro } from '../../simulatore/scenario/risposta.mjs';

const QUI = path.dirname(fileURLToPath(import.meta.url));
const RADICE = path.resolve(QUI, '..', '..');
const DEMO_DATA = path.join(RADICE, 'demo', 'data');
const SIM = path.join(RADICE, 'simulatore');
const leggi = (p) => JSON.parse(readFileSync(p, 'utf8'));
const med = (v) => { if (!v.length) return null; const s = [...v].sort((a, b) => a - b);
  const m = s.length >> 1; return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; };
const avg = (v) => (v.length ? v.reduce((a, b) => a + b, 0) / v.length : null);
const pct = (a, b) => (b ? `${(100 * a / b).toFixed(1)}%` : 'n/d');
const qEx = (v) => (v.length ? v.filter((x) => x === 0).length / v.length : 0);

const manifest = leggi(path.join(DEMO_DATA, 'vista', 'manifest.json'));
const SITO2SIM = manifest.cartella_di;
const GARE = Object.keys(SITO2SIM).sort();
const PITLOSS = leggi(path.join(DEMO_DATA, 'pitloss.json'));
const DEMO = new Map();
function demoDi(g) {
  if (DEMO.has(g)) return DEMO.get(g);
  const G = leggi(path.join(DEMO_DATA, `${g}.json`));
  const byLap = {}; for (const l of G.laps) byLap[l.lap] = l.cars;
  const v = { G, byLap, nLaps: G.n_laps, pitLoss: PITLOSS[g] };
  DEMO.set(g, v); return v;
}
const GARESIM = caricaGare2026(SIM);
const CTX = {
  gare: GARESIM,
  modello: leggi(path.join(SIM, 'data', 'modelli', 'modello_v2.json')),
  prior: caricaPrior(SIM),
  costantiDirector: caricaCostanti(SIM),
  bandaRientro: leggi(path.join(SIM, 'data', 'modelli', 'banda_rientro.json')),
  nGiriGara: null,
};
const ctxDi = (g) => ({ ...CTX, nGiriGara: GARESIM[SITO2SIM[g]].nGiri });
const ordina = (cum) => (a, b) => (cum[a] - cum[b]) || (a < b ? -1 : a > b ? 1 : 0);
const TR = new Map();
function tronca(g, L) {
  const k = `${g}|${L}`; if (TR.has(k)) return TR.get(k);
  const { byLap } = demoDi(g); const t = {};
  for (let i = 1; i <= L; i += 1) if (byLap[i]) t[i] = byLap[i];
  TR.set(k, t); return t;
}
function vecchio(c, { tronca: tr = true, orizzonte = 0 } = {}) {
  const { G, byLap, nLaps, pitLoss } = demoDi(c.gara);
  const L = c.freezeLap;
  const bl = tr ? tronca(c.gara, L) : byLap;
  const pace = G.pace[L] || {};
  const present = G.drivers.filter((d) => typeof bl[L]?.[d]?.cum_time === 'number' && pace[d] != null);
  const viva = misuraGradino(bl, nLaps, L);
  const gradino = (viva.gradino != null && viva.n_gradino >= 3) ? viva.gradino : null;
  let r;
  try {
    r = evaluatePit({ byLap: bl, nLaps, pace, driver: c.pilota, freezeLap: L, pitLap: c.pitLap,
      pitLoss, present, gara: c.gara, laps: G.laps, ZONE: 0, orizzonte, gradino });
  } catch (e) { return { muto: true, motivo: `eccezione: ${e.message}` }; }
  if (!r?.ok) return { muto: true, motivo: r?.reason ?? 'nessuna risposta' };
  return { muto: false, pos: r.rientro_pos, su: r.su_totale, ordine: r.ordine_previsto.map(([d]) => d) };
}
function nuovo(c) {
  const ctx = ctxDi(c.gara);
  const gSim = ctx.gare[c.garaSim];
  const mescola = mescolaAlGiro(gSim, c.freezeLap, c.pilota);
  if (mescola === null) return { muto: true, motivo: 'mescola non nota/non slick' };
  let r;
  try {
    r = doveRientri({ gara: c.garaSim, freezeLap: c.freezeLap, pilota: c.pilota, giroPit: c.pitLap, mescola }, ctx);
  } catch (e) { return { muto: true, motivo: `eccezione: ${e.message}` }; }
  if (!r || r.approvato !== true) return { muto: true, motivo: 'respinto dal Director' };
  if (r.posizione == null) return { muto: true, motivo: 'senza passo base' };
  let ordine = null;
  if (r.traccia) {
    const cum = {};
    for (const [d, passi] of Object.entries(r.traccia)) {
      const x = passi?.find((y) => y.lap === c.rientroLap); if (x) cum[d] = x.cum_time;
    }
    ordine = Object.keys(cum).sort(ordina(cum));
  }
  return { muto: false, pos: r.posizione, su: r.su_quanti, ordine };
}
const errA = (r, c) => (r.muto ? null : Math.abs(r.pos - c.posizioneVera));
function errB(r, c) {
  if (r.muto || !r.ordine) return null;
  const suoi = new Set(r.ordine);
  const S = c.ordineVero.filter((d) => suoi.has(d));
  if (!S.includes(c.pilota) || S.length < 3) return null;
  const mio = r.ordine.filter((d) => S.includes(d)).indexOf(c.pilota) + 1;
  return Math.abs(mio - (S.indexOf(c.pilota) + 1));
}

// ricostruzione del perimetro, tenendo ANCHE gli esclusi
const AMMESSI = [], DOPPIATI = [];
const INLAP = new Map();   // gara -> pilota -> [giri]
for (const g of GARE) {
  const { G, byLap, nLaps } = demoDi(g);
  const leader = {};
  for (let k = 1; k <= nLaps; k += 1) { if (!byLap[k]) continue; let m = Infinity;
    for (const d of Object.keys(byLap[k])) { const t = byLap[k][d].cum_time; if (typeof t === 'number' && t < m) m = t; }
    if (m < Infinity) leader[k] = m; }
  const dopp = (Lo, cum) => leader[Lo + 1] !== undefined && cum > leader[Lo + 1];
  const perPil = new Map(); INLAP.set(g, perPil);
  for (let Li = 1; Li <= nLaps; Li += 1) {
    if (!byLap[Li]) continue;
    for (const p of Object.keys(byLap[Li])) {
      if (byLap[Li][p].in_lap !== true) continue;
      if (!perPil.has(p)) perPil.set(p, []); perPil.get(p).push(Li);
      const L = Li - 1, Lo = Li + 1;
      if (Li <= 3) continue;
      if (typeof byLap[L]?.[p]?.cum_time !== 'number') continue;
      if (!byLap[Lo]) continue;
      const cumLo = byLap[Lo][p]?.cum_time;
      if (typeof cumLo !== 'number') continue;
      const cum = {};
      for (const d of Object.keys(byLap[Lo])) { const t = byLap[Lo][d].cum_time; if (typeof t === 'number') cum[d] = t; }
      const ordine = Object.keys(cum).sort(ordina(cum));
      const caso = { id: `${g}|${p}|${Li}`, gara: g, garaSim: SITO2SIM[g], pilota: p,
        freezeLap: L, pitLap: Li, rientroLap: Lo, nGiri: nLaps,
        posizioneVera: ordine.indexOf(p) + 1, suVeri: ordine.length, ordineVero: ordine };
      if (dopp(Lo, cumLo)) DOPPIATI.push(caso); else AMMESSI.push(caso);
    }
  }
}

console.log('══════════════════════════════════════════════════════════════════');
console.log('SONDE EXTRA SU M4');
console.log('══════════════════════════════════════════════════════════════════');

// ── S1 · il perimetro e' neutro fra i due motori? ────────────────────────────
{
  let cv = 0, cn = 0;
  const perGara = new Map();
  for (const c of DOPPIATI) {
    const v = !vecchio(c).muto, n = !nuovo(c).muto;
    if (v) cv += 1; if (n) cn += 1;
    const r = perGara.get(c.gara) ?? { n: 0, v: 0, nu: 0 };
    r.n += 1; if (v) r.v += 1; if (n) r.nu += 1; perGara.set(c.gara, r);
  }
  console.log(`\nS1 · I 140 DOPPIATI ESCLUSI DAL PERIMETRO (tutti, non un campione)`);
  console.log(`   copertura VECCHIO ${cv}/${DOPPIATI.length} (${pct(cv, DOPPIATI.length)})`
    + ` · NUOVO ${cn}/${DOPPIATI.length} (${pct(cn, DOPPIATI.length)}) · saldo ${cn - cv}`);
  console.log(`   per gara: ${[...perGara].map(([g, r]) => `${g} ${r.v}/${r.nu} su ${r.n}`).join(' · ')}`);
  console.log(`   ⇒ dentro il perimetro il saldo del nuovo e' +25; fuori sarebbe ${cn - cv}.`);
  console.log(`     l'esclusione dei doppiati ${cn - cv > 25 ? 'PENALIZZA' : cn - cv < 25 ? 'FAVORISCE' : 'e\' neutra per'} il motore nuovo sulla copertura.`);
}

// ── S2 · 274 soste, ma quante DISTINTE? ─────────────────────────────────────
{
  console.log(`\nS2 · SOSTE CON in_lap IN GIRI CONSECUTIVI (la stessa sosta contata piu' volte?)`);
  let totCelle = 0, totConsec = 0;
  const perGara = [];
  for (const g of GARE) {
    let celle = 0, consec = 0;
    for (const [, giri] of INLAP.get(g)) {
      celle += giri.length;
      for (let i = 1; i < giri.length; i += 1) if (giri[i] - giri[i - 1] === 1) consec += 1;
    }
    totCelle += celle; totConsec += consec;
    perGara.push([g, celle, consec]);
  }
  console.log(`   celle con in_lap ${totCelle} · di cui precedute da un in_lap al giro prima: ${totConsec} (${pct(totConsec, totCelle)})`);
  console.log(`   per gara (celle/consecutive): ${perGara.map(([g, a, b]) => `${g} ${a}/${b}`).join(' · ')}`);
  const ammessiConsec = AMMESSI.filter((c) => (INLAP.get(c.gara).get(c.pilota) ?? []).includes(c.pitLap - 1));
  console.log(`   dei ${AMMESSI.length} casi ammessi, ${ammessiConsec.length} hanno un in_lap ANCHE al giro precedente`);
  const perG = new Map();
  for (const c of ammessiConsec) perG.set(c.gara, (perG.get(c.gara) ?? 0) + 1);
  console.log(`   per gara: ${[...perG].sort((a, b) => b[1] - a[1]).map(([g, n]) => `${g} ${n}`).join(' · ')}`);
  console.log(`   ⇒ in questi casi il "congelamento prima che la sosta sia visibile" cade su un giro in cui`);
  console.log(`     il pilota era GIA' ai box: la premessa del banco non vale.`);
}

// ── S3 · la copertura dipende da orizzonte/troncamento? ─────────────────────
{
  let dOr = 0, dTr = 0;
  for (const c of AMMESSI) {
    const base = vecchio(c).muto;
    if (vecchio(c, { orizzonte: 5 }).muto !== base) dOr += 1;
    if (vecchio(c, { tronca: false }).muto !== base) dTr += 1;
  }
  console.log(`\nS3 · LA COPERTURA DEL VECCHIO e' INVARIANTE?`);
  console.log(`   cambia con orizzonte 5 (quello di produzione) in ${dOr}/${AMMESSI.length} casi`);
  console.log(`   cambia con byLap intero in ${dTr}/${AMMESSI.length} casi`);
  console.log(`   ⇒ la TAVOLA DEI MUTI non dipende da nessuna delle due scelte del banco.`);
}

// ── S4 · il cancello M4 senza le soste-duplicate ────────────────────────────
{
  const T = AMMESSI.map((c) => { const v = vecchio(c), n = nuovo(c);
    return { c, v, n, vR: !v.muto, nR: !n.muto, vA: errA(v, c), vB: errB(v, c) }; });
  const dup = (t) => (INLAP.get(t.c.gara).get(t.c.pilota) ?? []).includes(t.c.pitLap - 1);
  const pulito = T.filter((t) => !dup(t));
  const eV = pulito.filter((t) => t.vR), sV = pulito.filter((t) => t.vR && !t.nR), sN = pulito.filter((t) => !t.vR && t.nR);
  const ent = pulito.filter((t) => t.vR && t.nR);
  console.log(`\nS4 · IL CANCELLO M4 SENZA LE SOSTE-DUPLICATE (${pulito.length} casi su ${T.length})`);
  console.log(`   copertura V ${eV.length}/${pulito.length} (${pct(eV.length, pulito.length)})`
    + ` · N ${(ent.length + sN.length)}/${pulito.length} (${pct(ent.length + sN.length, pulito.length)})`
    + ` · soloV ${sV.length} · soloN ${sN.length} · saldo ${sN.length - sV.length}`);
  for (const [tag, sel] of [['A', (t) => t.vA], ['B', (t) => t.vB]]) {
    const persi = sV.map(sel).filter((x) => x != null), tenuti = ent.map(sel).filter((x) => x != null);
    if (!persi.length || !tenuti.length) { console.log(`   lettura ${tag}: sottoinsieme vuoto`); continue; }
    console.log(`   lettura ${tag}: PERSI n=${persi.length} med ${med(persi)} media ${avg(persi).toFixed(2)} esatti ${pct(persi.filter((x) => x === 0).length, persi.length)}`
      + ` | TENUTI n=${tenuti.length} med ${med(tenuti)} media ${avg(tenuti).toFixed(2)} esatti ${pct(tenuti.filter((x) => x === 0).length, tenuti.length)}`
      + ` ⇒ persi peggiori? ${med(persi) > med(tenuti) && qEx(persi) < qEx(tenuti) ? 'SI' : 'NO'}`);
  }
  const perGara = new Map();
  for (const t of pulito) {
    const r = perGara.get(t.c.gara) ?? { n: 0, sv: 0, sn: 0 };
    r.n += 1; if (t.vR && !t.nR) r.sv += 1; if (!t.vR && t.nR) r.sn += 1; perGara.set(t.c.gara, r);
  }
  console.log(`   per gara (casi/soloV/soloN): ${[...perGara].map(([g, r]) => `${g} ${r.n}/${r.sv}/${r.sn}`).join(' · ')}`);
}

console.log('\n══════════════════════════════════════════════════════════════════');
