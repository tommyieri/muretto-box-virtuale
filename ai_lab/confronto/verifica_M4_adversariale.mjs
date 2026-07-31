// verifica_M4_adversariale.mjs — RIMISURA INDIPENDENTE DI M4.
//
// Non importa banco.mjs. Ricostruisce da zero: il perimetro, la verita', gli ingressi
// dei due motori (copiati da gen_hero.mjs::scelta e da genera_vista_gara.mjs), le
// statistiche e il test di permutazione. Se i numeri coincidono, coincidono per due
// strade diverse.
//
//   node ai_lab/confronto/verifica_M4_adversariale.mjs           sezioni 1-8
//   node ai_lab/confronto/verifica_M4_adversariale.mjs --largo   aggiunge il campione largo
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
const LARGO = process.argv.includes('--largo');

const leggi = (p) => JSON.parse(readFileSync(p, 'utf8'));

// ─────────────────────────────────────────────────────────── utensili statistici
const med = (v) => { if (!v.length) return null; const s = [...v].sort((a, b) => a - b);
  const m = s.length >> 1; return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; };
const avg = (v) => (v.length ? v.reduce((a, b) => a + b, 0) / v.length : null);
const pct = (a, b) => (b ? `${(100 * a / b).toFixed(1)}%` : 'n/d');
const qEx = (v) => (v.length ? v.filter((x) => x === 0).length / v.length : 0);
const fx = (x, n = 3) => (x == null ? 'n/d' : Number(x).toFixed(n));

// PRNG diverso da quello del misuratore (xorshift128, seme diverso): se le p tornano
// simili, non e' merito del generatore.
function xorshift(a, b, c, d) {
  return function () {
    const t = b << 9; let r = b * 5; r = ((r << 7) | (r >>> 25)) * 9;
    c ^= a; d ^= b; b ^= c; a ^= d; c ^= t; d = (d << 11) | (d >>> 21);
    return (r >>> 0) / 4294967296;
  };
}
function perm(A, B, stat = med, iter = 20000) {
  if (!A.length || !B.length) return null;
  const tutti = [...A, ...B]; const nA = A.length;
  const oss = Math.abs(stat(A) - stat(B));
  const rnd = xorshift(0x9e3779b9, 0x243f6a88, 0xb7e15162, 0x1337c0de);
  let k = 0;
  for (let i = 0; i < iter; i += 1) {
    const v = [...tutti];
    for (let j = v.length - 1; j > 0; j -= 1) { const q = Math.floor(rnd() * (j + 1)); [v[j], v[q]] = [v[q], v[j]]; }
    if (Math.abs(stat(v.slice(0, nA)) - stat(v.slice(nA))) >= oss - 1e-12) k += 1;
  }
  return (k + 1) / (iter + 1);
}
const riass = (tag, e) => ({ tag, n: e.length, med: med(e), avg: avg(e),
  ex: e.filter((x) => x === 0).length, e1: e.filter((x) => x <= 1).length });
const riga = (r) => console.log(`    ${r.tag.padEnd(30)} n=${String(r.n).padStart(3)}`
  + `  med ${String(r.med ?? 'n/d').padStart(4)}  media ${fx(r.avg, 2).padStart(5)}`
  + `  esatti ${String(r.ex).padStart(3)} (${pct(r.ex, r.n).padStart(6)})`
  + `  entro1 ${String(r.e1).padStart(3)} (${pct(r.e1, r.n).padStart(6)})`);

// ══════════════════════════════════════════════════════════════════════════════
// 1. PERIMETRO E VERITA', ricostruiti da zero
// ══════════════════════════════════════════════════════════════════════════════
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

// contesto del motore nuovo, come genera_vista_gara.mjs
const GARESIM = caricaGare2026(SIM);
const CTX_BASE = {
  gare: GARESIM,
  modello: leggi(path.join(SIM, 'data', 'modelli', 'modello_v2.json')),
  prior: caricaPrior(SIM),
  costantiDirector: caricaCostanti(SIM),
  bandaRientro: leggi(path.join(SIM, 'data', 'modelli', 'banda_rientro.json')),
  nGiriGara: null,
};
const ctxDi = (g) => ({ ...CTX_BASE, nGiriGara: GARESIM[SITO2SIM[g]].nGiri });

const ordina = (cum) => (a, b) => (cum[a] - cum[b]) || (a < b ? -1 : a > b ? 1 : 0);

const CASI = [];
const SCARTI = { pit_le_3: 0, no_cum_freeze: 0, no_lap_rientro: 0, no_cum_rientro: 0, doppiato: 0 };
const SCARTATI = [];   // i doppiati, tenuti da parte: servono alla sonda 6
let SOSTE_TOT = 0;
let OUTLAP_OK = 0;

for (const g of GARE) {
  const { G, byLap, nLaps } = demoDi(g);
  const leader = {};
  for (let k = 1; k <= nLaps; k += 1) {
    if (!byLap[k]) continue;
    let m = Infinity;
    for (const d of Object.keys(byLap[k])) { const t = byLap[k][d].cum_time; if (typeof t === 'number' && t < m) m = t; }
    if (m < Infinity) leader[k] = m;
  }
  const dopp = (Lo, cum) => leader[Lo + 1] !== undefined && cum > leader[Lo + 1];
  for (let Li = 1; Li <= nLaps; Li += 1) {
    if (!byLap[Li]) continue;
    for (const p of Object.keys(byLap[Li])) {
      if (byLap[Li][p].in_lap !== true) continue;
      SOSTE_TOT += 1;
      const L = Li - 1, Lo = Li + 1;
      if (Li <= 3) { SCARTI.pit_le_3 += 1; continue; }
      if (typeof byLap[L]?.[p]?.cum_time !== 'number') { SCARTI.no_cum_freeze += 1; continue; }
      if (!byLap[Lo]) { SCARTI.no_lap_rientro += 1; continue; }
      const cumLo = byLap[Lo][p]?.cum_time;
      if (typeof cumLo !== 'number') { SCARTI.no_cum_rientro += 1; continue; }
      const cum = {};
      for (const d of Object.keys(byLap[Lo])) { const t = byLap[Lo][d].cum_time; if (typeof t === 'number') cum[d] = t; }
      const ordine = Object.keys(cum).sort(ordina(cum));
      const caso = {
        id: `${g}|${p}|${Li}`, gara: g, garaSim: SITO2SIM[g], pilota: p,
        freezeLap: L, pitLap: Li, rientroLap: Lo, nGiri: nLaps,
        posizioneVera: ordine.indexOf(p) + 1, suVeri: ordine.length, ordineVero: ordine,
        neutralizzato: byLap[L][p].neutralized === true,
        mescolaFreeze: byLap[L][p].compound ?? null,
        passoVecchio: G.pace[String(L)]?.[p] ?? null,
        outLapAlRientro: byLap[Lo][p].out_lap === true,
      };
      if (dopp(Lo, cumLo)) { SCARTI.doppiato += 1; SCARTATI.push(caso); continue; }
      if (caso.outLapAlRientro) OUTLAP_OK += 1;
      CASI.push(caso);
    }
  }
}
CASI.sort((a, b) => (a.gara < b.gara ? -1 : a.gara > b.gara ? 1 : 0) || a.pitLap - b.pitLap || (a.pilota < b.pilota ? -1 : 1));

// ══════════════════════════════════════════════════════════════════════════════
// 2. I DUE MOTORI — ingressi ricostruiti dalla produzione
// ══════════════════════════════════════════════════════════════════════════════
const MIN_SOSTE_UI = 3, ZONE = 0;
const TRONCA = new Map();
function troncato(g, L) {
  const k = `${g}|${L}`;
  if (TRONCA.has(k)) return TRONCA.get(k);
  const { byLap } = demoDi(g); const t = {};
  for (let i = 1; i <= L; i += 1) if (byLap[i]) t[i] = byLap[i];
  TRONCA.set(k, t); return t;
}
/** VECCHIO: gli stessi argomenti di gen_hero.mjs::scelta, con orizzonte 0. */
function vecchio(c, { tronca = true, orizzonte = 0, pitLap = null } = {}) {
  const { G, byLap, nLaps, pitLoss } = demoDi(c.gara);
  const L = c.freezeLap;
  const bl = tronca ? troncato(c.gara, L) : byLap;
  const pace = G.pace[L] || {};
  const present = G.drivers.filter((d) => typeof bl[L]?.[d]?.cum_time === 'number' && pace[d] != null);
  const viva = misuraGradino(bl, nLaps, L);
  const gradino = (viva.gradino != null && viva.n_gradino >= MIN_SOSTE_UI) ? viva.gradino : null;
  let r;
  try {
    r = evaluatePit({ byLap: bl, nLaps, pace, driver: c.pilota, freezeLap: L,
      pitLap: pitLap ?? c.pitLap, pitLoss, present, gara: c.gara, laps: G.laps, ZONE, orizzonte, gradino });
  } catch (e) { return { muto: true, motivo: `eccezione: ${e.message}`, pos: null, su: null, ordine: null }; }
  if (!r?.ok) return { muto: true, motivo: r?.reason ?? 'nessuna risposta', pos: null, su: null, ordine: null };
  return { muto: false, motivo: null, pos: r.rientro_pos, su: r.su_totale,
    ordine: r.ordine_previsto.map(([d]) => d), gradino };
}
/** NUOVO: come genera_vista_gara.mjs, mescola = quella al congelamento. */
function nuovo(c, { gareOverride = null } = {}) {
  const ctx = gareOverride ? { ...ctxDi(c.gara), gare: gareOverride } : ctxDi(c.gara);
  const gSim = ctx.gare[c.garaSim];
  const mescola = mescolaAlGiro(gSim, c.freezeLap, c.pilota);
  if (mescola === null) return { muto: true, motivo: 'mescola non nota/non slick', pos: null, su: null, ordine: null };
  let r;
  try {
    r = doveRientri({ gara: c.garaSim, freezeLap: c.freezeLap, pilota: c.pilota,
      giroPit: c.pitLap, mescola }, ctx);
  } catch (e) { return { muto: true, motivo: `eccezione: ${e.message}`, pos: null, su: null, ordine: null }; }
  if (!r || r.approvato !== true) return { muto: true, motivo: 'respinto dal Director', pos: null, su: null, ordine: null };
  if (r.posizione == null) return { muto: true, motivo: 'senza passo base (regola 6)', pos: null, su: null, ordine: null };
  let ordine = null;
  if (r.traccia) {
    const cum = {};
    for (const [d, passi] of Object.entries(r.traccia)) {
      const x = passi?.find((y) => y.lap === c.rientroLap);
      if (x) cum[d] = x.cum_time;
    }
    ordine = Object.keys(cum).sort(ordina(cum));
  }
  return { muto: false, motivo: null, pos: r.posizione, su: r.su_quanti, ordine, banda: r.banda_posizione };
}

// errore A (grezzo) ed errore B (popolazione comune bilaterale), ricalcolati a mano
const errA = (r, c) => (r.muto ? null : Math.abs(r.pos - c.posizioneVera));
function errB(r, c) {
  if (r.muto || !r.ordine) return null;
  const suoi = new Set(r.ordine);
  const S = c.ordineVero.filter((d) => suoi.has(d));
  if (!S.includes(c.pilota) || S.length < 3) return null;
  const mio = r.ordine.filter((d) => S.includes(d)).indexOf(c.pilota) + 1;
  return Math.abs(mio - (S.indexOf(c.pilota) + 1));
}

console.log('══════════════════════════════════════════════════════════════════');
console.log('VERIFICA ADVERSARIALE DI M4 — rimisura indipendente');
console.log('══════════════════════════════════════════════════════════════════');
console.log(`\n1. PERIMETRO  soste reali ${SOSTE_TOT} · ammessi ${CASI.length}`);
console.log(`   scarti: ${Object.entries(SCARTI).map(([k, v]) => `${k}=${v}`).join(' · ')}`);
console.log(`   controllo: al giro di rientro la cella ha out_lap in ${OUTLAP_OK}/${CASI.length}`);

const T = CASI.map((c) => { const v = vecchio(c), n = nuovo(c);
  return { c, v, n, vR: !v.muto, nR: !n.muto, vA: errA(v, c), nA: errA(n, c), vB: errB(v, c), nB: errB(n, c) }; });

const entrambi = T.filter((t) => t.vR && t.nR);
const soloV = T.filter((t) => t.vR && !t.nR);
const soloN = T.filter((t) => !t.vR && t.nR);
const nessuno = T.filter((t) => !t.vR && !t.nR);

console.log('\n2. TAVOLA DEI MUTI (rimisurata)');
console.log(`   entrambi ${entrambi.length} · soloV ${soloV.length} · soloN ${soloN.length} · nessuno ${nessuno.length}`);
console.log(`   copertura V ${entrambi.length + soloV.length}/${T.length} (${pct(entrambi.length + soloV.length, T.length)})`
  + ` · N ${entrambi.length + soloN.length}/${T.length} (${pct(entrambi.length + soloN.length, T.length)})`
  + ` · saldo ${soloN.length - soloV.length}`);
const conta = (arr, f) => { const m = new Map(); for (const x of arr) { const k = f(x); m.set(k, (m.get(k) ?? 0) + 1); } return m; };
console.log(`   motivi V: ${[...conta(T.filter((t) => !t.vR), (t) => t.v.motivo)].map(([k, n]) => `${n}× ${k}`).join(' · ')}`);
console.log(`   motivi N: ${[...conta(T.filter((t) => !t.nR), (t) => t.n.motivo)].map(([k, n]) => `${n}× ${k}`).join(' · ')}`);
console.log('   per gara: gara / casi / entrambi / soloV / soloN / nessuno');
for (const g of GARE) {
  const t = T.filter((x) => x.c.gara === g);
  console.log(`     ${g.padEnd(15)} ${String(t.length).padStart(3)} ${String(t.filter((x) => x.vR && x.nR).length).padStart(4)}`
    + ` ${String(t.filter((x) => x.vR && !x.nR).length).padStart(4)} ${String(t.filter((x) => !x.vR && x.nR).length).padStart(4)}`
    + ` ${String(t.filter((x) => !x.vR && !x.nR).length).padStart(4)}`);
}
console.log(`   elenco soloV: ${soloV.map((t) => t.c.id).join(' , ')}`);
console.log(`   elenco nessuno: ${nessuno.map((t) => t.c.id).join(' , ')}`);

console.log('\n3. IL CANCELLO M4 — i casi persi erano buoni? (errore del VECCHIO)');
for (const [tag, sel] of [['A grezza', (t) => t.vA], ['B popolazione comune', (t) => t.vB]]) {
  const tutti = T.filter((t) => t.vR).map(sel).filter((x) => x != null);
  const persi = soloV.map(sel).filter((x) => x != null);
  const tenuti = entrambi.map(sel).filter((x) => x != null);
  console.log(`   — lettura ${tag}`);
  riga(riass('TUTTI (V risponde)', tutti)); riga(riass('TENUTI', tenuti)); riga(riass('PERSI', persi));
  console.log(`     Δ persi−tenuti  mediana ${med(persi) - med(tenuti)} · media ${fx(avg(persi) - avg(tenuti), 2)}`
    + ` · quota esatti ${(100 * (qEx(persi) - qEx(tenuti))).toFixed(1)} punti`);
  console.log(`     Δ persi−TUTTI   mediana ${med(persi) - med(tutti)} · media ${fx(avg(persi) - avg(tutti), 2)}`
    + ` · quota esatti ${(100 * (qEx(persi) - qEx(tutti))).toFixed(1)} punti`);
  console.log(`     permutazione (PRNG e seme diversi): mediane p=${fx(perm(persi, tenuti), 4)} · quota esatti p=${fx(perm(persi, tenuti, qEx), 4)}`);
  const peggiori = med(persi) > med(tenuti) && qEx(persi) < qEx(tenuti);
  console.log(`     i persi sono PEGGIORI della media del vecchio? ${peggiori ? 'SI' : 'NO'}  ⇒ cancello M4 ${peggiori ? 'superato' : 'NON superato'}`);
}

console.log('\n4. LO SPECCHIO — errore del NUOVO sui casi guadagnati');
for (const [tag, sel] of [['A grezza', (t) => t.nA], ['B popolazione comune', (t) => t.nB]]) {
  const tenuti = entrambi.map(sel).filter((x) => x != null);
  const guad = soloN.map(sel).filter((x) => x != null);
  console.log(`   — lettura ${tag}`);
  riga(riass('TENUTI', tenuti)); riga(riass('GUADAGNATI', guad));
  console.log(`     Δ guadagnati−tenuti  mediana ${med(guad) - med(tenuti)} · media ${fx(avg(guad) - avg(tenuti), 2)}`
    + ` · quota esatti ${(100 * (qEx(guad) - qEx(tenuti))).toFixed(1)} punti`
    + ` · p mediane ${fx(perm(guad, tenuti), 4)} · p quota ${fx(perm(guad, tenuti, qEx), 4)}`);
}

console.log('\n5. LA REGIONE DEL SILENZIO — vecchio, sosta ≤13 contro >13');
for (const [tag, sel] of [['A', (t) => t.vA], ['B', (t) => t.vB]]) {
  const d = T.filter((t) => t.vR && t.c.pitLap <= 13).map(sel).filter((x) => x != null);
  const f = T.filter((t) => t.vR && t.c.pitLap > 13).map(sel).filter((x) => x != null);
  riga(riass(`${tag} · sosta ≤13`, d)); riga(riass(`${tag} · sosta >13`, f));
  console.log(`     Δ quota esatti ${(100 * (qEx(d) - qEx(f))).toFixed(1)} punti · p mediane ${fx(perm(d, f), 4)} · p quota ${fx(perm(d, f, qEx), 4)}`);
}

// ══════════════════════════════════════════════════════════════════════════════
// 6. SONDE ADVERSARIALI
// ══════════════════════════════════════════════════════════════════════════════
console.log('\n6. SONDE ADVERSARIALI');

// 6a — i muti sono contati come errore 0 o ∞?
{
  const nA = T.filter((t) => t.vR).length;
  const popA = T.map((t) => t.vA).filter((x) => x != null).length;
  const popB = T.map((t) => t.vB).filter((x) => x != null).length;
  console.log(`   6a muti come numero: V risponde ${nA}, popolazione errore A ${popA}, B ${popB}`
    + `  → ${nA === popA && nA === popB ? 'nessun muto entra come 0/∞' : 'ATTENZIONE: popolazioni diverse'}`);
  const nN = T.filter((t) => t.nR).length;
  console.log(`      N risponde ${nN}, popolazione errore A ${T.map((t) => t.nA).filter((x) => x != null).length},`
    + ` B ${T.map((t) => t.nB).filter((x) => x != null).length}`);
}

// 6b — il perimetro favorisce un motore? copertura sui 140 casi ESCLUSI come doppiati
{
  const camp = SCARTATI.filter((_, i) => i % 3 === 0);   // 1 su 3, per costo
  let cv = 0, cn = 0;
  for (const c of camp) { if (!vecchio(c).muto) cv += 1; if (!nuovo(c).muto) cn += 1; }
  console.log(`   6b copertura sui doppiati ESCLUSI dal perimetro (campione ${camp.length}/${SCARTATI.length}):`
    + ` V ${cv} (${pct(cv, camp.length)}) · N ${cn} (${pct(cn, camp.length)})`
    + ` → il perimetro ${cn > cv ? 'toglie casi dove copre di piu\' il NUOVO' : cv > cn ? 'toglie casi dove copre di piu\' il VECCHIO' : 'e\' neutro'}`);
}

// 6c — il troncamento del vecchio cambia la COPERTURA o solo l'accuratezza?
{
  let diffCop = 0, diffPos = 0, risp = 0;
  const eInt = [], eTro = [];
  for (const t of T) {
    const i = vecchio(t.c, { tronca: false });
    if (i.muto !== t.v.muto) diffCop += 1;
    if (!i.muto && !t.v.muto) { risp += 1; if (i.pos !== t.v.pos) diffPos += 1;
      eInt.push(Math.abs(i.pos - t.c.posizioneVera)); eTro.push(t.vA); }
  }
  console.log(`   6c troncamento del vecchio: cambia la copertura in ${diffCop} casi · la posizione in ${diffPos}/${risp}`);
  riga(riass('   V byLap INTERO (A)', eInt)); riga(riass('   V byLap troncato (A)', eTro));
}

// 6c-bis — il cancello M4 regge se al vecchio si lascia byLap intero (come in produzione)?
{
  const int = new Map(T.map((t) => [t.c.id, vecchio(t.c, { tronca: false })]));
  const eA = (t) => { const r = int.get(t.c.id); return r.muto ? null : Math.abs(r.pos - t.c.posizioneVera); };
  const persi = soloV.map(eA).filter((x) => x != null);
  const tenuti = entrambi.map(eA).filter((x) => x != null);
  console.log('   6c-bis lo stesso cancello, ma col vecchio NON troncato (la variante di produzione):');
  riga(riass('   TENUTI', tenuti)); riga(riass('   PERSI', persi));
  const peggiori = med(persi) > med(tenuti) && qEx(persi) < qEx(tenuti);
  console.log(`     i persi sono peggiori? ${peggiori ? 'SI' : 'NO'} ⇒ cancello ${peggiori ? 'superato' : 'NON superato'} anche cosi'`);
}

// 6d — invarianza al troncamento del NUOVO: gli si danno solo i giri <= freezeLap
{
  const gareTronche = (L) => {
    const out = {};
    for (const [nome, g] of Object.entries(GARESIM)) {
      const perPilota = new Map();
      for (const [drv, celle] of g.perPilota) {
        const m = new Map();
        for (const [lap, cel] of celle) if (lap <= L) m.set(lap, cel);
        perPilota.set(drv, m);
      }
      out[nome] = { ...g, perPilota, righe: g.righe.filter((r) => r.lap <= L) };
    }
    return out;
  };
  let uguali = 0, diversi = 0, mutiDiversi = 0;
  const campione = T.filter((_, i) => i % 7 === 0);
  for (const t of campione) {
    const r = nuovo(t.c, { gareOverride: gareTronche(t.c.freezeLap) });
    if (r.muto !== t.n.muto) { mutiDiversi += 1; continue; }
    if (r.muto) { uguali += 1; continue; }
    if (r.pos === t.n.pos && r.su === t.n.su) uguali += 1; else diversi += 1;
  }
  console.log(`   6d invarianza al troncamento del NUOVO (campione ${campione.length}): identici ${uguali} · diversi ${diversi} · muti diversi ${mutiDiversi}`
    + ` → ${diversi + mutiDiversi === 0 ? 'nessuna fuga dal futuro rilevabile' : 'ATTENZIONE: il nuovo legge oltre il congelamento'}`);
}

// 6e — il vecchio riceve davvero solo giri <= L? e `laps` (intero) conta?
{
  const t = T[Math.floor(T.length / 2)];
  const bl = troncato(t.c.gara, t.c.freezeLap);
  const maxGiro = Math.max(...Object.keys(bl).map(Number));
  const conLaps = vecchio(t.c);
  const senzaLaps = (() => {
    const { G, nLaps, pitLoss } = demoDi(t.c.gara); const L = t.c.freezeLap;
    const pace = G.pace[L] || {};
    const present = G.drivers.filter((d) => typeof bl[L]?.[d]?.cum_time === 'number' && pace[d] != null);
    const viva = misuraGradino(bl, nLaps, L);
    const gr = (viva.gradino != null && viva.n_gradino >= MIN_SOSTE_UI) ? viva.gradino : null;
    const r = evaluatePit({ byLap: bl, nLaps, pace, driver: t.c.pilota, freezeLap: L, pitLap: t.c.pitLap,
      pitLoss, present, gara: null, laps: null, ZONE, orizzonte: 0, gradino: gr });
    return r.ok ? r.rientro_pos : null;
  })();
  console.log(`   6e byLap del vecchio: giro massimo ${maxGiro} contro congelamento ${t.c.freezeLap}`
    + ` → ${maxGiro <= t.c.freezeLap ? 'nessun giro futuro' : 'ATTENZIONE'}`
    + ` · con/senza \`laps\` e \`gara\`: P${conLaps.pos} vs P${senzaLaps} (${conLaps.pos === senzaLaps ? 'irrilevanti' : 'RILEVANTI'})`);
}

// 6f — le popolazioni: quanti piloti conta ciascun motore
{
  const suV = entrambi.map((t) => t.v.su), suN = entrambi.map((t) => t.n.su), suT = entrambi.map((t) => t.c.suVeri);
  console.log(`   6f su quanti (sui 223 tenuti): V mediana ${med(suV)} · N mediana ${med(suN)} · verita' mediana ${med(suT)}`);
  const suNG = soloN.map((t) => t.n.su), suTG = soloN.map((t) => t.c.suVeri);
  console.log(`      sui ${soloN.length} guadagnati: N mediana ${med(suNG)} (min ${Math.min(...suNG)}) · verita' mediana ${med(suTG)}`);
  const suVP = soloV.map((t) => t.v.su), suTP = soloV.map((t) => t.c.suVeri);
  console.log(`      sui ${soloV.length} persi: V mediana ${med(suVP)} (min ${Math.min(...suVP)}) · verita' mediana ${med(suTP)}`);
}

// 6g — Monaco: le soste doppie del finale sono soste vere?
{
  const { byLap, nLaps } = demoDi('Monaco');
  const perPilota = new Map();
  for (let l = 1; l <= nLaps; l += 1) {
    if (!byLap[l]) continue;
    for (const d of Object.keys(byLap[l])) if (byLap[l][d].in_lap === true) {
      if (!perPilota.has(d)) perPilota.set(d, []); perPilota.get(d).push(l);
    }
  }
  const consecutive = [...perPilota.entries()].filter(([, g]) => g.some((x, i) => i > 0 && x - g[i - 1] === 1));
  console.log(`   6g Monaco: soste con in_lap per pilota — ${[...perPilota.entries()].map(([d, g]) => `${d}:${g.join('/')}`).slice(0, 6).join(' ')} …`);
  console.log(`      piloti con in_lap in giri CONSECUTIVI: ${consecutive.length}/${perPilota.size}`
    + `${consecutive.length ? ` (es. ${consecutive.slice(0, 4).map(([d, g]) => `${d} ${g.join(',')}`).join(' · ')})` : ''}`);
  const neu = (l) => { const c = byLap[l]; const k = Object.keys(c); return `${k.filter((d) => c[d].neutralized).length}/${k.length}`; };
  console.log(`      neutralizzati: giro 60 ${neu(60)} · 65 ${neu(65)} · 66 ${neu(66)} · 67 ${neu(67)} · 68 ${neu(68)}`);
  const { G } = demoDi('Monaco');
  const conPasso = (l) => Object.keys(G.pace[String(l)] ?? {}).length;
  console.log(`      piloti con pace nel demo: giro 60 ${conPasso(60)} · 63 ${conPasso(63)} · 65 ${conPasso(65)} · 67 ${conPasso(67)} · 71 ${conPasso(71)}`);
  const soloNMonaco = soloN.filter((t) => t.c.gara === 'Monaco');
  const idsDoppi = soloNMonaco.filter((t) => (perPilota.get(t.c.pilota) ?? []).includes(t.c.pitLap - 1)
    || (perPilota.get(t.c.pilota) ?? []).includes(t.c.pitLap + 1));
  console.log(`      dei ${soloNMonaco.length} guadagnati a Monaco, ${idsDoppi.length} appartengono a un pilota con soste consecutive`);
}

// 6h — 274 casi: i due motori ricevono lo STESSO caso? (stesso pilota, stesso giro)
{
  let ok = 0;
  for (const t of T) {
    const gS = GARESIM[t.c.garaSim];
    const cellaSim = gS.perPilota.get(t.c.pilota)?.get(t.c.freezeLap);
    const cellaDemo = demoDi(t.c.gara).byLap[t.c.freezeLap][t.c.pilota];
    if (cellaSim && Math.abs(cellaSim.cum_time - cellaDemo.cum_time) < 1e-9) ok += 1;
  }
  console.log(`   6h stessa cella al congelamento nelle due fonti: ${ok}/${T.length}`);
}

// 6i — pit-loss: quanto diverge fra i due motori
{
  const { caricaPrior: cp } = { caricaPrior };
  void cp;
  const scarti = [];
  for (const g of GARE) {
    const pv = PITLOSS[g];
    const c = CASI.find((x) => x.gara === g);
    if (!c) continue;
    const r = nuovo(c);
    void r;
    scarti.push([g, pv]);
  }
  console.log(`   6i pit-loss del VECCHIO per gara: ${scarti.map(([g, v]) => `${g} ${v}`).join(' · ')}`);
}

// ══════════════════════════════════════════════════════════════════════════════
// 7. CAMPIONE LARGO
// ══════════════════════════════════════════════════════════════════════════════
if (LARGO) {
  console.log('\n7. CAMPIONE LARGO (rimisurato)');
  let tot = 0, cv = 0, cn = 0, sv = 0, sn = 0, svPresto = 0;
  const mV = new Map(), mN = new Map();
  const fasce = [[1, 5], [6, 10], [11, 15], [16, 20], [21, 30], [31, 40], [41, 99]];
  const pf = fasce.map(() => ({ n: 0, v: 0, nu: 0, sv: 0, sn: 0 }));
  const perGara = new Map();
  for (const g of GARE) {
    const { byLap, nLaps } = demoDi(g);
    const r = { n: 0, v: 0, nu: 0, sv: 0, sn: 0 };
    for (let L = 3; L <= nLaps - 2; L += 1) {
      const cars = byLap[L]; if (!cars) continue;
      for (const p of Object.keys(cars)) {
        if (typeof cars[p].cum_time !== 'number') continue;
        const c = { id: `${g}|${p}|${L + 1}`, gara: g, garaSim: SITO2SIM[g], pilota: p,
          freezeLap: L, pitLap: L + 1, rientroLap: L + 2, nGiri: nLaps };
        const rv = vecchio(c), rn = nuovo(c);
        tot += 1; r.n += 1;
        if (!rv.muto) { cv += 1; r.v += 1; } else mV.set(rv.motivo, (mV.get(rv.motivo) ?? 0) + 1);
        if (!rn.muto) { cn += 1; r.nu += 1; } else mN.set(rn.motivo, (mN.get(rn.motivo) ?? 0) + 1);
        if (!rv.muto && rn.muto) { sv += 1; r.sv += 1; if (L + 1 <= 15) svPresto += 1; }
        if (rv.muto && !rn.muto) { sn += 1; r.sn += 1; }
        const i = fasce.findIndex(([a, b]) => L + 1 >= a && L + 1 <= b);
        if (i >= 0) { pf[i].n += 1; if (!rv.muto) pf[i].v += 1; if (!rn.muto) pf[i].nu += 1;
          if (!rv.muto && rn.muto) pf[i].sv += 1; if (rv.muto && !rn.muto) pf[i].sn += 1; }
      }
    }
    perGara.set(g, r);
  }
  console.log(`   domande ${tot} · V ${cv} (${pct(cv, tot)}) · N ${cn} (${pct(cn, tot)}) · saldo ${cn - cv} · soloV ${sv} · soloN ${sn}`);
  console.log(`   dei ${sv} persi, ${svPresto} (${pct(svPresto, sv)}) hanno la sosta entro il giro 15`);
  console.log(`   motivi V: ${[...mV].map(([k, n]) => `${n}× ${k}`).join(' · ')}`);
  console.log(`   motivi N: ${[...mN].map(([k, n]) => `${n}× ${k}`).join(' · ')}`);
  fasce.forEach(([a, b], i) => { const r = pf[i]; if (!r.n) return;
    console.log(`     ${`${a}-${b}`.padEnd(7)} n=${String(r.n).padStart(5)} V ${pct(r.v, r.n).padStart(6)} N ${pct(r.nu, r.n).padStart(6)} soloV ${String(r.sv).padStart(4)} soloN ${String(r.sn).padStart(4)}`); });
  for (const [g, r] of perGara) console.log(`     ${g.padEnd(15)} n=${String(r.n).padStart(5)} saldo ${String(r.nu - r.v).padStart(5)} soloV ${String(r.sv).padStart(4)} soloN ${String(r.sn).padStart(4)}`);
}

console.log('\n══════════════════════════════════════════════════════════════════');
console.log('FINE VERIFICA');
console.log('══════════════════════════════════════════════════════════════════');
