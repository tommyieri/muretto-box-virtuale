// verifica_M1a_filtri.mjs — seconda tornata adversariale su M1a: I FILTRI E LE POPOLAZIONI.
//
//     node ai_lab/confronto/verifica_M1a_filtri.mjs
//
// 12  M1 sui 140 casi ESCLUSI come "doppiato al rientro": il filtro favorisce un motore?
// 13  il `pace` del file del sito contiene futuro? (ricalcolato a mano sui soli giri <= L)
// 14  lettura C — ciascun motore riclassificato sulla PROPRIA intersezione con la verita'
//     (toglie l'accoppiamento della lettura B, dove i mancanti di un motore tagliano l'altro)
// 15  popolazioni nei due versi: sigle previste e assenti dalla verita', e viceversa
// 16  bootstrap a BLOCCHI = GARE sul saldo esatti (un IC, non solo il leave-one-out)
// 17  M1 con la verita' contata SOLO fra chi e' a pari giro (l'altra definizione possibile)
//
// Non scrive niente su disco e non tocca demo/, simulatore/, data/.

import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { evaluatePit } from '../../demo/pitscenario.mjs';
import { misura as misuraGradino } from '../../demo/gradino.mjs';
import { caricaGare2026 } from '../../simulatore/provenienza/gare_2026.mjs';
import { caricaPrior } from '../../simulatore/provenienza/pitloss_dati.mjs';
import { caricaCostanti } from '../../simulatore/scenario/director_dati.mjs';
import { doveRientri } from '../../simulatore/scenario/costruttore.mjs';
import { MESCOLE_SLICK } from '../../simulatore/provenienza/vocabolario.mjs';

const QUI = path.dirname(fileURLToPath(import.meta.url));
const RADICE = path.resolve(QUI, '..', '..');
const DEMO = path.join(RADICE, 'demo', 'data');
const SIM = path.join(RADICE, 'simulatore');
const GARE = ['Australia', 'Austria', 'Belgio', 'Canada', 'Cina', 'Giappone',
              'Gran Bretagna', 'Miami', 'Monaco', 'Spagna', 'Ungheria'];
const PITLOSS = JSON.parse(readFileSync(path.join(DEMO, 'pitloss.json'), 'utf8'));

const med = (v) => { if (!v.length) return null; const s = [...v].sort((a, b) => a - b); const m = s.length >> 1; return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; };
const avg = (v) => (v.length ? v.reduce((a, b) => a + b, 0) / v.length : null);
const p1 = (x) => (x === null ? ' — ' : `${(100 * x).toFixed(1)}%`);
const rias = (e) => { const a = e.map(Math.abs); return { n: e.length, med: med(a), media: avg(a), esatti: a.length ? a.filter((x) => x === 0).length / a.length : null, nE: a.filter((x) => x === 0).length, bias: avg(e) }; };
const riga = (et, x) => `  ${et.padEnd(28)} n=${String(x.n).padStart(3)}  mediana|e| ${x.med === null ? '—' : x.med.toFixed(1)}  media|e| ${x.media === null ? '—' : x.media.toFixed(2)}  esatti ${p1(x.esatti)} (${x.nE})  bias ${x.bias === null ? '—' : (x.bias >= 0 ? '+' : '') + x.bias.toFixed(3)}`;
const ord = (cum) => (a, b) => (cum[a] - cum[b]) || (a < b ? -1 : a > b ? 1 : 0);

const files = new Map();
const gaSito = (g) => { if (!files.has(g)) files.set(g, JSON.parse(readFileSync(path.join(DEMO, `${g}.json`), 'utf8'))); return files.get(g); };

// ————————————————————————————— tutti i casi, ammessi E scartati per doppiaggio
const TUTTI = [];
for (const g of GARE) {
  const G = gaSito(g);
  const byLap = {}; for (const l of G.laps) byLap[l.lap] = l.cars;
  const nLaps = G.n_laps;
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
    for (const drv of Object.keys(byLap[Li])) {
      if (byLap[Li][drv].in_lap !== true) continue;
      const L = Li - 1, Lo = Li + 1;
      if (Li < 4) continue;
      if (typeof byLap[L]?.[drv]?.cum_time !== 'number') continue;
      if (!byLap[Lo]) continue;
      const cumLo = byLap[Lo][drv]?.cum_time;
      if (typeof cumLo !== 'number') continue;
      const cum = {};
      for (const d of Object.keys(byLap[Lo])) { const t = byLap[Lo][d].cum_time; if (typeof t === 'number') cum[d] = t; }
      const ordine = Object.keys(cum).sort(ord(cum));
      const pariGiro = ordine.filter((d) => !dopp(Lo, cum[d]));
      TUTTI.push({ id: `${g}|${drv}|${Li}`, gara: g, garaSim: g.replace(/\s+/g, ''), pilota: drv,
        L, Li, Lo, nLaps, escluso: dopp(Lo, cumLo),
        vera: ordine.indexOf(drv) + 1, suVeri: ordine.length, ordineVero: ordine,
        veraPari: pariGiro.indexOf(drv) + 1, suPari: pariGiro.length, ordinePari: pariGiro });
    }
  }
}

// ————————————————————————————————————————————————————————————— i due motori
const cache = new Map();
function dati(g) {
  if (cache.has(g)) return cache.get(g);
  const G = gaSito(g);
  const byLap = {}; for (const l of G.laps) byLap[l.lap] = l.cars;
  const v = { G, byLap, nLaps: G.n_laps, pitLoss: PITLOSS[g] };
  cache.set(g, v); return v;
}
const tronca = (byLap, L) => { const t = {}; for (let k = 1; k <= L; k += 1) if (byLap[k]) t[k] = byLap[k]; return t; };
function vecchio(c) {
  const { G, byLap, nLaps, pitLoss } = dati(c.gara);
  const bl = tronca(byLap, c.L);
  const pace = G.pace[String(c.L)] || {};
  const present = G.drivers.filter((d) => typeof bl[c.L]?.[d]?.cum_time === 'number' && pace[d] != null);
  const viva = misuraGradino(bl, nLaps, c.L);
  const grad = (viva.gradino != null && viva.n_gradino >= 3) ? viva.gradino : null;
  let r;
  try { r = evaluatePit({ byLap: bl, nLaps, pace, driver: c.pilota, freezeLap: c.L, pitLap: c.Li, pitLoss, present, gara: c.gara, laps: G.laps, ZONE: 0, orizzonte: 0, gradino: grad }); }
  catch { return { muto: true }; }
  if (!r || r.ok !== true) return { muto: true };
  return { muto: false, pos: r.rientro_pos, su: r.su_totale, ordine: r.ordine_previsto.map((x) => x[0]) };
}
const gareSim = caricaGare2026(SIM);
const CTX = {
  gare: gareSim,
  modello: JSON.parse(readFileSync(path.join(SIM, 'data', 'modelli', 'modello_v2.json'), 'utf8')),
  prior: caricaPrior(SIM),
  costantiDirector: caricaCostanti(SIM),
  bandaRientro: JSON.parse(readFileSync(path.join(SIM, 'data', 'modelli', 'banda_rientro.json'), 'utf8')),
  nGiriGara: null,
};
function nuovo(c) {
  const g = gareSim[c.garaSim];
  const cella = g.perPilota.get(c.pilota)?.get(c.L);
  if (!cella || !MESCOLE_SLICK.has(cella.compound)) return { muto: true };
  let r;
  try { r = doveRientri({ gara: c.garaSim, freezeLap: c.L, pilota: c.pilota, giroPit: c.Li, mescola: cella.compound }, { ...CTX, nGiriGara: g.nGiri }); }
  catch { return { muto: true }; }
  if (!r || r.approvato !== true || r.posizione === null || r.posizione === undefined) return { muto: true };
  const cum = {};
  for (const [d, passi] of Object.entries(r.traccia ?? {})) {
    const p = passi?.find((x) => x.lap === c.Lo);
    if (p && p.cum_time !== null && p.cum_time !== undefined) cum[d] = p.cum_time;
  }
  return { muto: false, pos: r.posizione, su: r.su_quanti, ordine: Object.keys(cum).sort(ord(cum)) };
}

for (const c of TUTTI) { c.v = vecchio(c); c.n = nuovo(c); }
const AMM = TUTTI.filter((c) => !c.escluso);
const ESC = TUTTI.filter((c) => c.escluso);
const comuni = (l) => l.filter((c) => !c.v.muto && !c.n.muto);

console.log('VERIFICA ADVERSARIALE — I FILTRI E LE POPOLAZIONI');
console.log('='.repeat(104));

// ============================================================================
// 12. i 140 esclusi per doppiaggio
// ============================================================================
console.log(`\n12. I CASI ESCLUSI COME "DOPPIATO AL RIENTRO" (${ESC.length}) — il filtro favorisce un motore?`);
const cE = comuni(ESC);
console.log(`    di questi, con risposta da entrambi: ${cE.length} (vecchio muto ${ESC.filter((c) => c.v.muto).length} · nuovo muto ${ESC.filter((c) => c.n.muto).length})`);
const eV = rias(cE.map((c) => c.v.pos - c.vera)), eN = rias(cE.map((c) => c.n.pos - c.vera));
console.log(riga('A vecchio (esclusi)', eV));
console.log(riga('A nuovo   (esclusi)', eN));
const cA = comuni(AMM);
const aV = rias(cA.map((c) => c.v.pos - c.vera)), aN = rias(cA.map((c) => c.n.pos - c.vera));
const tV = rias([...cA, ...cE].map((c) => c.v.pos - c.vera)), tN = rias([...cA, ...cE].map((c) => c.n.pos - c.vera));
console.log(riga('A vecchio (ammessi+esclusi)', tV));
console.log(riga('A nuovo   (ammessi+esclusi)', tN));
console.log(`    cancello M1 senza il filtro doppiaggio: ${(tN.med <= tV.med && tN.esatti >= tV.esatti) ? 'PASSA' : 'NON PASSA'}`);

// ============================================================================
// 13. il pace del file del sito contiene futuro?
// ============================================================================
const FUEL = 3.0 / 70.0;
const verdeLegacy = (c) => c.lap_time !== null && c.lap_time !== undefined && String(c.status ?? '') === '1'
  && c.deleted !== true && !c.in_lap && !c.out_lap && ['SOFT', 'MEDIUM', 'HARD'].includes(c.compound);
function paceMio(byLap, nGiri, drv, finoA) {
  let cur = null;
  for (let k = 1; k <= finoA; k += 1) { const c = byLap[k]?.[drv]; if (c) cur = c; }
  if (!cur || cur.stint === null || cur.stint === undefined) return null;
  const v = [];
  for (let k = 1; k <= finoA; k += 1) {
    const c = byLap[k]?.[drv];
    if (!c || c.stint !== cur.stint || !verdeLegacy(c)) continue;
    v.push(c.lap_time - Math.max(0, 70.0 - (70.0 / nGiri) * (k - 1)) * FUEL);
  }
  if (v.length < 3) return null;
  return med(v);
}
let celle = 0, diff = 0, soloFile = 0, soloMio = 0;
const esP = [];
for (const c of AMM) {
  const { G, byLap, nLaps } = dati(c.gara);
  const daFile = G.pace[String(c.L)] ?? {};
  for (const d of G.drivers) {
    const a = daFile[d] ?? null;
    const b = paceMio(byLap, nLaps, d, c.L);
    celle += 1;
    if (a === null && b === null) continue;
    if (a === null) { soloMio += 1; continue; }
    if (b === null) { soloFile += 1; if (esP.length < 5) esP.push(`${c.gara}|${d}|L${c.L} file=${a.toFixed(3)} mio=null`); continue; }
    if (Math.abs(a - b) > 1e-9) { diff += 1; if (esP.length < 5) esP.push(`${c.gara}|${d}|L${c.L} file=${a.toFixed(3)} mio=${b.toFixed(3)}`); }
  }
}
console.log(`\n13. IL pace DEL FILE DEL SITO, ricalcolato da me sui SOLI giri <= L`);
console.log(`    celle confrontate ${celle} · valori diversi ${diff} · presenti solo nel file ${soloFile} · solo nel mio ricalcolo ${soloMio} ${esP.join(' | ')}`);

// ============================================================================
// 14. lettura C — ciascun motore contro la verita' sulla PROPRIA intersezione
// ============================================================================
function rangoIn(lista, insieme, pilota) { const S = new Set(insieme); return lista.filter((d) => S.has(d)).indexOf(pilota) + 1; }
const cC = comuni(AMM);
const eCv = [], eCn = [];
for (const c of cC) {
  const iv = c.ordineVero.filter((d) => c.v.ordine.includes(d));
  const inn = c.ordineVero.filter((d) => c.n.ordine.includes(d));
  if (iv.includes(c.pilota)) eCv.push(rangoIn(c.v.ordine, iv, c.pilota) - rangoIn(c.ordineVero, iv, c.pilota));
  if (inn.includes(c.pilota)) eCn.push(rangoIn(c.n.ordine, inn, c.pilota) - rangoIn(c.ordineVero, inn, c.pilota));
}
console.log(`\n14. LETTURA C — ognuno riclassificato sulla PROPRIA intersezione con la verita'`);
console.log(riga('C vecchio', rias(eCv)));
console.log(riga('C nuovo', rias(eCn)));
const Cv = rias(eCv), Cn = rias(eCn);
console.log(`    cancello M1 in lettura C: ${(Cn.med <= Cv.med && Cn.esatti >= Cv.esatti) ? 'PASSA' : 'NON PASSA'}`);

// ============================================================================
// 15. popolazioni nei due versi
// ============================================================================
let vMancaDaVero = 0, nMancaDaVero = 0, vInPiu = 0, nInPiu = 0;
for (const c of cC) {
  vMancaDaVero += c.ordineVero.filter((d) => !c.v.ordine.includes(d)).length;
  nMancaDaVero += c.ordineVero.filter((d) => !c.n.ordine.includes(d)).length;
  vInPiu += c.v.ordine.filter((d) => !c.ordineVero.includes(d)).length;
  nInPiu += c.n.ordine.filter((d) => !c.ordineVero.includes(d)).length;
}
console.log(`\n15. POPOLAZIONI (${cC.length} casi comuni)`);
console.log(`    sigle della VERITA' assenti dalla previsione : vecchio ${vMancaDaVero} (${(vMancaDaVero / cC.length).toFixed(2)}/caso) · nuovo ${nMancaDaVero} (${(nMancaDaVero / cC.length).toFixed(2)}/caso)`);
console.log(`    sigle PREVISTE e assenti dalla verita'       : vecchio ${vInPiu} (${(vInPiu / cC.length).toFixed(2)}/caso) · nuovo ${nInPiu} (${(nInPiu / cC.length).toFixed(2)}/caso)`);

// ============================================================================
// 16. bootstrap a blocchi = gare sul saldo esatti
// ============================================================================
function bootstrap(campo) {
  const perGara = new Map();
  for (const c of cC) { if (!perGara.has(c.gara)) perGara.set(c.gara, []); perGara.get(c.gara).push(c); }
  const chiavi = [...perGara.keys()];
  const saldi = [];
  let s = 20260731;
  const rnd = () => { s = (s * 1103515245 + 12345) & 0x7fffffff; return s / 0x7fffffff; };
  for (let b = 0; b < 4000; b += 1) {
    let ev = 0, en = 0, n = 0;
    for (let i = 0; i < chiavi.length; i += 1) {
      const g = perGara.get(chiavi[Math.floor(rnd() * chiavi.length)]);
      for (const c of g) { n += 1; if (campo(c).v === 0) ev += 1; if (campo(c).n === 0) en += 1; }
    }
    saldi.push(100 * (en - ev) / n);
  }
  saldi.sort((a, b) => a - b);
  return [saldi[Math.floor(0.025 * saldi.length)], saldi[Math.floor(0.975 * saldi.length)]];
}
const campoA = (c) => ({ v: c.v.pos - c.vera, n: c.n.pos - c.vera });
const campoB = (c) => {
  const sv = new Set(c.v.ordine), sn = new Set(c.n.ordine);
  const comune = c.ordineVero.filter((d) => sv.has(d) && sn.has(d));
  const rg = (l) => rangoIn(l, comune, c.pilota);
  return { v: rg(c.v.ordine) - rg(c.ordineVero), n: rg(c.n.ordine) - rg(c.ordineVero) };
};
const icA = bootstrap(campoA), icB = bootstrap(campoB);
console.log(`\n16. BOOTSTRAP A BLOCCHI = GARE (4.000 ricampionamenti di gare intere), saldo esatti nuovo−vecchio`);
console.log(`    lettura A: IC95 [${icA[0].toFixed(1)}; ${icA[1].toFixed(1)}] punti · lettura B: IC95 [${icB[0].toFixed(1)}; ${icB[1].toFixed(1)}] punti`);

// ============================================================================
// 17. la verita' contata solo fra chi e' a PARI GIRO
// ============================================================================
const eP_v = [], eP_n = [];
for (const c of cC) {
  eP_v.push(c.v.pos - c.veraPari);
  eP_n.push(c.n.pos - c.veraPari);
}
console.log(`\n17. VERITA' CONTATA SOLO FRA CHI E' A PARI GIRO (l'altra definizione possibile)`);
console.log(riga('A vecchio (pari giro)', rias(eP_v)));
console.log(riga('A nuovo   (pari giro)', rias(eP_n)));
const Pv = rias(eP_v), Pn = rias(eP_n);
console.log(`    cancello M1: ${(Pn.med <= Pv.med && Pn.esatti >= Pv.esatti) ? 'PASSA' : 'NON PASSA'}`);
console.log(`    (la verita' cambia rispetto a quella del banco in ${cC.filter((c) => c.vera !== c.veraPari).length}/${cC.length} casi)`);
