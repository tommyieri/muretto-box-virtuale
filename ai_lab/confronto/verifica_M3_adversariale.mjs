#!/usr/bin/env node
// verifica_M3_adversariale.mjs — RIMISURA AVVERSARIALE di M3 («il quando»).
//
//     node ai_lab/confronto/verifica_M3_adversariale.mjs
//
// Non scrive niente su disco, non tocca demo/ simulatore/ data/.
//
// L'accusa da provare: M3_il_quando.mjs ha confrontato i due motori in modo NON alla pari.
// Le sette strade che cerco, dichiarate prima di guardare i numeri:
//
//  V1 · GLI INGRESSI DEL VECCHIO NON SONO QUELLI DELLA PRODUZIONE. Ricostruisco gli
//       argomenti di `evaluatePit` da capo, leggendo `demo/data/<gara>.json` con codice mio
//       (non `banco.mjs::ingressiVecchio`), e verifico che coincidano campo per campo.
//       Se il banco avesse infilato un parametro suo, tutta la colonna VECCHIO cadrebbe.
//
//  V2 · IL GIRO FINALE NON E' DAVVERO COMUNE. `steps = (pitLap-L)+1+orizzonte`: con
//       `orizzonte = H-pitLap-1` deve venire `steps = H-L` COSTANTE. Lo verifico numericamente
//       (non leggendo il codice): a gradino nullo e passo nullo il totale deve essere
//       IDENTICO per ogni candidato — se il giro finale scivolasse, i totali cambierebbero
//       di ~90 s a giro.
//
//  V3 · LA CURVA DEL NUOVO E' MUTILATA DAL DIRECTOR. `curvaDelQuando` tiene solo i candidati
//       APPROVATI (`validi`), quindi puo' buttare i primi giri e far sembrare INTERNO un
//       minimo che sta sul primo giro utile vero. Ricalcolo la curva del nuovo BYPASSANDO il
//       Director (costruisciScenario + simulate a mano, tutti i candidati) e riclassifico.
//
//  V4 · IL NUOVO SBIRCIA IL FUTURO. Il vecchio qui riceve `byLap` TRONCATO a <= L; il nuovo
//       riceve la gara INTERA e si fida che filtri da solo. Lo verifico invece di crederci:
//       gli passo una gara troncata a <= L e confronto la curva punto per punto.
//
//  V5 · A E B NON SONO LA STESSA FISICA. Il referto sostiene che fra convenzione A (mescola
//       al congelamento) e B (mescola legale) «i tempi sono identici, cambia solo la
//       copertura». Se fosse falso, il salto 35,8% -> 68,1% sarebbe fisica travestita da
//       copertura. Confronto le due curve candidato per candidato dove entrambe rispondono.
//
//  V6 · IL MINIMO INTERNO E' RUMORE SOPRA LA SOGLIA. La soglia di piattezza e' 0,01 s. Un
//       minimo interno profondo 0,05 s non e' una raccomandazione. Rifaccio il conto
//       chiedendo profondita' > 0,1 / 0,5 / 1 s, per tutti e quattro allo stesso modo.
//
//  V7 · IL NUMERO E' UNA TAUTOLOGIA ARITMETICA. Nei due motori il totale e' base + deriva +
//       rho*eta + perdita: base, deriva e perdita NON dipendono da quando ti fermi, quindi
//       l'argmin dipende solo dalla somma delle eta' vissute. Se e' cosi', il giro del minimo
//       si predice in chiuso — senza dati, senza modello — e M3 misura un'identita', non una
//       capacita'. Predico k* e confronto col misurato.
//
// Piu' i controlli di igiene richiesti: muti mai contati come errore, popolazioni appaiate,
// numeri del referto che il codice non produce.

import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';

import { casi, ingressiVecchio, contestoNuovo, garaNuova, gare, garaSimDi, RADICE } from './banco.mjs';
import { evaluatePit } from '../../demo/pitscenario.mjs';
import { misura as misuraGradino } from '../../demo/gradino.mjs';
import { curvaDelQuando, costruisciScenario, eseguiEValida } from '../../simulatore/scenario/costruttore.mjs';
import { mescolePerSoste } from '../../simulatore/scenario/piano.mjs';
import { MESCOLE_SLICK_ATTUALI } from '../../simulatore/provenienza/vocabolario.mjs';
import { simulate } from '../../simulatore/engine/kernel.mjs';

const SOLO = process.argv.find((a) => a.startsWith('--solo='))?.slice(7) ?? null;
const PIATTA_S = 0.01;

const mediana = (v) => {
  if (!v.length) return null;
  const s = [...v].sort((a, b) => a - b);
  const m = s.length >> 1;
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};
const pct = (a, b) => (b ? `${(100 * a / b).toFixed(1)}%` : 'n/d');
const f = (x, n = 3) => (x == null ? 'n/d' : Number(x).toFixed(n));

// ════════════════════════════════════════════════════════════════════════════
// V1 · GLI INGRESSI DEL VECCHIO, RICOSTRUITI DA ZERO (codice mio, non del banco)
// ════════════════════════════════════════════════════════════════════════════
const _demo = new Map();
function demoGara(nome) {
  if (_demo.has(nome)) return _demo.get(nome);
  const G = JSON.parse(readFileSync(path.join(RADICE, 'demo', 'data', `${nome}.json`), 'utf8'));
  const PL = JSON.parse(readFileSync(path.join(RADICE, 'demo', 'data', 'pitloss.json'), 'utf8'));
  const byLap = {};
  for (const l of G.laps) byLap[l.lap] = l.cars;
  const v = { G, byLap, nLaps: G.n_laps, pitLoss: PL[nome] };
  _demo.set(nome, v);
  return v;
}
const _mieiArg = new Map();
/** Gli argomenti di evaluatePit come li costruirei io leggendo gen_hero.mjs. */
function argomentiMiei(caso, troncato = true) {
  const k = `${caso.id}|${troncato}`;
  if (_mieiArg.has(k)) return _mieiArg.get(k);
  const { G, byLap, nLaps, pitLoss } = demoGara(caso.gara);
  const L = caso.freezeLap;
  let bl = byLap;
  if (troncato) {
    bl = {};
    for (const kk of Object.keys(byLap)) if (Number(kk) <= L) bl[kk] = byLap[kk];
  }
  const pace = G.pace[String(L)] || {};
  const present = G.drivers.filter((d) => typeof bl[L]?.[d]?.cum_time === 'number' && pace[d] != null);
  const viva = misuraGradino(bl, nLaps, L);
  const gradino = (viva.gradino != null && viva.n_gradino >= 3) ? viva.gradino : null;
  const a = { byLap: bl, nLaps, pace, driver: caso.pilota, freezeLap: L, pitLap: caso.pitLap,
              pitLoss, present, gara: caso.gara, laps: G.laps, ZONE: 0, orizzonte: 0, gradino };
  _mieiArg.set(k, a);
  return a;
}

/** confronta i miei argomenti con quelli del banco: campo per campo, valore per valore. */
function V1(elenco) {
  const out = { n: 0, diff: {}, esempi: [] };
  for (const c of elenco) {
    const mio = argomentiMiei(c), suo = ingressiVecchio(c).argomenti;
    out.n += 1;
    const chiavi = new Set([...Object.keys(mio), ...Object.keys(suo)]);
    for (const k of chiavi) {
      let uguale;
      if (k === 'byLap') {
        const km = Object.keys(mio.byLap).sort().join(','), ks = Object.keys(suo.byLap).sort().join(',');
        uguale = km === ks && Object.keys(mio.byLap).every((g) => mio.byLap[g] === suo.byLap[g]
          || JSON.stringify(mio.byLap[g]) === JSON.stringify(suo.byLap[g]));
      } else if (k === 'pace' || k === 'present' || k === 'laps') {
        uguale = JSON.stringify(mio[k]) === JSON.stringify(suo[k]);
      } else uguale = mio[k] === suo[k];
      if (!uguale) {
        out.diff[k] = (out.diff[k] ?? 0) + 1;
        if (out.esempi.length < 5) out.esempi.push({ id: c.id, campo: k });
      }
    }
  }
  return out;
}

// ════════════════════════════════════════════════════════════════════════════
// LE CURVE — codice mio, stessa domanda ai due motori
// ════════════════════════════════════════════════════════════════════════════
/** VECCHIO: totale del pilota al giro H per ogni candidato. `steps` restituito per V2. */
function curvaVecchio(caso, passo, H, troncato = true) {
  const L = caso.freezeLap;
  const base = argomentiMiei(caso, troncato);
  const punti = [];
  const stepsVisti = new Set();
  for (let p = L + 1; p <= H - 1; p += 1) {
    const orizzonte = H - p - 1;
    stepsVisti.add((p - L) + 1 + orizzonte);
    let r;
    try {
      r = evaluatePit({ ...base, pitLap: p, orizzonte, passo,
                        gradino: passo ? null : base.gradino, deriva: null });
    } catch (e) { return { punti: null, motivo: `eccezione: ${e.message}`, stepsVisti }; }
    if (!r?.ok) return { punti: null, motivo: r?.reason ?? 'nessuna risposta', stepsVisti };
    const mio = r.ordine_previsto.find(([d]) => d === caso.pilota);
    if (!mio) return { punti: null, motivo: 'pilota assente dall\'ordine', stepsVisti };
    punti.push([p, mio[1]]);
  }
  if (punti.length < 3) return { punti: null, motivo: `meno di 3 candidati (${punti.length})`, stepsVisti };
  return { punti, motivo: null, stepsVisti };
}

function slickUsate(caso) {
  const g = garaNuova(caso.gara);
  const usate = new Set();
  for (const [lap, c] of g.perPilota.get(caso.pilota)) {
    if (lap <= caso.freezeLap && c.compound !== null && MESCOLE_SLICK_ATTUALI.has(c.compound)) usate.add(c.compound);
  }
  return usate;
}
const mescolaLegale = (caso) => mescolePerSoste(1, slickUsate(caso))[0] ?? null;

/** NUOVO, come lo espone il prodotto: `curvaDelQuando`. */
function curvaNuovo(caso, mescola, H, ctx = null) {
  if (mescola == null) return { punti: null, motivo: 'nessuna mescola slick al congelamento' };
  const contesto = ctx ?? contestoNuovo(caso.gara);
  let r;
  try {
    r = curvaDelQuando({ gara: caso.garaSim, freezeLap: caso.freezeLap, pilota: caso.pilota, mescola },
                       { ...contesto, giroFinale: H });
  } catch (e) { return { punti: null, motivo: `eccezione: ${e.message}` }; }
  if (!r || r.approvato !== true) {
    const viol = (r?.direttore?.violazioni ?? []).filter((v) => v.severita === 'FATAL');
    const cod = [...new Set(viol.map((v) => v.codice ?? v.messaggio))];
    const rifiuto = (r?.respinti ?? 0) > 0 || cod.length > 0;
    return { punti: null, motivo: rifiuto ? `Director: ${cod.join('·') || '?'}` : 'regola 6 (nessun passo base)',
             respinti: r?.respinti ?? null, approvatoDirettore: r?.direttore?.approved ?? null };
  }
  if (!r.curva?.length) return { punti: null, motivo: 'curva vuota' };
  const punti = r.curva.map((c) => [c.giroPit, c.delta_s]);
  if (punti.length < 3) return { punti: null, motivo: `meno di 3 candidati validi (${punti.length})` };
  return { punti, motivo: null, respinti: r.respinti_dal_director };
}

/** V3 · NUOVO senza il filtro del Director: TUTTI i candidati, totale grezzo. */
function curvaNuovoSenzaDirector(caso, mescola, H) {
  if (mescola == null) return { punti: null, motivo: 'niente mescola' };
  const contesto = { ...contestoNuovo(caso.gara), giroFinale: H };
  const punti = [];
  for (let p = caso.freezeLap + 1; p <= H - 1; p += 1) {
    let sc;
    try {
      sc = costruisciScenario({ gara: caso.garaSim, freezeLap: caso.freezeLap, pilota: caso.pilota,
                                giroPit: p, mescola }, contesto);
    } catch (e) { return { punti: null, motivo: `eccezione costruttore: ${e.message}` }; }
    const ris = simulate({ state: sc.state, pace: sc.pace, freezeLap: sc.freezeLap,
                           steps: sc.steps, pits: sc.pits, traccia: false });
    const t = ris.cum[caso.pilota];
    if (t == null) return { punti: null, motivo: 'nessun totale (regola 6)' };
    punti.push([p, t]);
  }
  if (punti.length < 3) return { punti: null, motivo: 'meno di 3 candidati' };
  return { punti, motivo: null };
}

function classifica(punti) {
  const v = punti.map((x) => x[1]);
  const min = Math.min(...v), max = Math.max(...v);
  const iMin = v.reduce((m, x, i) => (x < v[m] ? i : m), 0);
  const piatta = (max - min) <= PIATTA_S;
  return { n: punti.length, ampiezza: max - min, iMin, piatta,
           giroMin: punti[iMin][0], primoGiro: punti[0][0],
           dove: piatta ? 'piatta' : (iMin === 0 ? 'primo' : (iMin === v.length - 1 ? 'ultimo' : 'interno')),
           profondita: Math.min(v[0], v[v.length - 1]) - min };
}

// ════════════════════════════════════════════════════════════════════════════
// ESECUZIONE
// ════════════════════════════════════════════════════════════════════════════
let elenco = casi();
if (SOLO) elenco = elenco.filter((c) => c.gara === SOLO);
console.log(`RIMISURA AVVERSARIALE DI M3 — ${elenco.length} soste vere, ${gare().length} gare`);

// ── V1
console.log('\n══ V1 · gli argomenti del VECCHIO ricostruiti da zero coincidono col banco?');
const v1 = V1(elenco);
console.log(`   ${v1.n} casi · campi divergenti: ${Object.keys(v1.diff).length === 0 ? 'NESSUNO' : JSON.stringify(v1.diff)}`);
if (v1.esempi.length) console.log(`   esempi: ${JSON.stringify(v1.esempi)}`);

// ── curve dei quattro motori, con codice mio
const modelloPasso = JSON.parse(readFileSync(path.join(RADICE, 'demo', 'data', 'modello_passo_2026.json'), 'utf8'));
const passoV2 = { delta: modelloPasso.deriva.delta_gara_s, rho: modelloPasso.degrado.rho_s_giro };
const NOMI = ['VECCHIO null', 'VECCHIO v2', 'NUOVO A (sito)', 'NUOVO B (legale)'];
const righe = [];
const stepsCostanti = { ok: 0, no: 0 };
for (const caso of elenco) {
  const H = caso.nGiri;
  const a = curvaVecchio(caso, null, H);
  const b = curvaVecchio(caso, passoV2, H);
  if (a.stepsVisti) (a.stepsVisti.size === 1 ? stepsCostanti.ok++ : stepsCostanti.no++);
  const c = curvaNuovo(caso, caso.mescolaAlCongelamento, H);
  const d = curvaNuovo(caso, mescolaLegale(caso), H);
  righe.push({ caso, H, esiti: [a, b, c, d],
               cl: [a, b, c, d].map((x) => (x.punti ? classifica(x.punti) : null)) });
}

function tabella(sel, etichetta) {
  console.log(`\n   ${etichetta}`);
  for (let i = 0; i < 4; i += 1) {
    const v = righe.filter(sel).map((r) => r.cl[i]).filter(Boolean);
    const q = (d) => v.filter((x) => x.dove === d).length;
    console.log(`     ${NOMI[i].padEnd(17)} curve ${String(v.length).padStart(3)}`
      + `  piatte ${String(q('piatta')).padStart(3)}`
      + `  INTERNI ${String(q('interno')).padStart(3)} (${pct(q('interno'), v.length)})`
      + `  primo ${String(q('primo')).padStart(3)} (${pct(q('primo'), v.length)})`
      + `  ultimo ${String(q('ultimo')).padStart(3)}`);
  }
}
console.log('\n══ CONTO PRINCIPALE rifatto con codice mio (H = nGiri, candidati L+1..H-1)');
tabella(() => true, 'ogni motore sulla sua popolazione (come il referto)');
tabella((r) => r.cl.every(Boolean), `popolazione comune a tutti e quattro`);
for (const [ia, ib, nome] of [[0, 3, 'vecchio null vs nuovo B'], [1, 3, 'vecchio v2 vs nuovo B'], [1, 2, 'vecchio v2 vs nuovo A']]) {
  const cop = righe.filter((r) => r.cl[ia] && r.cl[ib]);
  const q = (i, d) => cop.filter((r) => r.cl[i].dove === d).length;
  console.log(`\n   ${nome}  n=${cop.length}`);
  console.log(`     ${NOMI[ia].padEnd(17)} INTERNI ${q(ia, 'interno')} (${pct(q(ia, 'interno'), cop.length)})  piatte ${q(ia, 'piatta')}  primo ${q(ia, 'primo')}`);
  console.log(`     ${NOMI[ib].padEnd(17)} INTERNI ${q(ib, 'interno')} (${pct(q(ib, 'interno'), cop.length)})  piatte ${q(ib, 'piatta')}  primo ${q(ib, 'primo')}`);
  const d = cop.map((r) => r.cl[ib].giroMin - r.cl[ia].giroMin);
  console.log(`     scarto giro del minimo: mediana ${mediana(d)} · uguale in ${d.filter((x) => x === 0).length} (${pct(d.filter((x) => x === 0).length, d.length)})`);
}

// ── V2
console.log('\n══ V2 · il giro finale e\' davvero comune?');
console.log(`   steps costante su tutti i candidati: ${stepsCostanti.ok} curve SI · ${stepsCostanti.no} NO`);
const piatteNull = righe.map((r) => r.cl[0]).filter((x) => x && x.piatta);
console.log(`   controprova numerica: curve del vecchio passo=null a gradino nullo -> ampiezza`);
console.log(`   massima ${piatteNull.length ? Math.max(...piatteNull.map((x) => x.ampiezza)).toExponential(2) : 'n/d'} s`
  + ` su ${piatteNull.length} curve (se il giro finale scivolasse sarebbero ~90 s a giro)`);
const senzaGradino = elenco.filter((c) => argomentiMiei(c).gradino === null).length;
console.log(`   casi con gradino NULL (meno di 3 soste viste al congelamento): ${senzaGradino}`
  + `  → coincidono con le curve piatte? ${senzaGradino === piatteNull.length ? 'SI' : 'NO'}`);

// ── V5 (prima di V3: serve a decidere quanto pesa la copertura)
console.log('\n══ V5 · A e B sono la stessa fisica? (curve confrontate candidato per candidato)');
{
  let entrambe = 0, identiche = 0, diverse = 0, maxScarto = 0, diversoEstensione = 0;
  const esempi = [];
  for (const r of righe) {
    const A = r.esiti[2].punti, B = r.esiti[3].punti;
    if (!A || !B) continue;
    entrambe += 1;
    const mB = new Map(B);
    let peggio = 0, comuni = 0;
    for (const [g, y] of A) if (mB.has(g)) { comuni += 1; peggio = Math.max(peggio, Math.abs(y - mB.get(g))); }
    if (A.length !== B.length) diversoEstensione += 1;
    maxScarto = Math.max(maxScarto, peggio);
    if (peggio <= 1e-9) identiche += 1;
    else { diverse += 1; if (esempi.length < 4) esempi.push({ id: r.caso.id, scarto: peggio, nA: A.length, nB: B.length }); }
  }
  console.log(`   ${entrambe} casi con entrambe le curve · identiche sui candidati comuni ${identiche} · diverse ${diverse}`);
  console.log(`   scarto massimo su un punto: ${maxScarto.toExponential(2)} s · curve di lunghezza diversa: ${diversoEstensione}`);
  if (esempi.length) console.log(`   esempi: ${JSON.stringify(esempi)}`);
  const cambia = righe.filter((r) => r.cl[2] && r.cl[3] && r.cl[2].dove !== r.cl[3].dove).length;
  console.log(`   classificazione DIVERSA fra A e B dove rispondono entrambe: ${cambia}/${entrambe}`);
}

// ── V3
console.log('\n══ V3 · la curva del nuovo e\' mutilata dal Director? (bypass, tutti i candidati)');
{
  const conBuchi = righe.filter((r) => r.cl[3] && r.cl[3].n < (r.H - 1 - r.caso.freezeLap));
  // campione: TUTTE le curve con buchi + un caso ogni 12 per il controllo generale
  const campione = [...conBuchi, ...righe.filter((r, i) => r.cl[3] && i % 12 === 0 && !conBuchi.includes(r))];
  let n = 0, uguale = 0, cambia = 0;
  const spost = { 'interno→primo': 0, 'primo→interno': 0, altro: 0 };
  for (const r of campione) {
    const nudo = curvaNuovoSenzaDirector(r.caso, mescolaLegale(r.caso), r.H);
    if (!nudo.punti) continue;
    n += 1;
    const c2 = classifica(nudo.punti);
    if (c2.dove === r.cl[3].dove) uguale += 1;
    else {
      cambia += 1;
      const k = `${r.cl[3].dove}→${c2.dove}`;
      spost[k] = (spost[k] ?? 0) + 1;
    }
  }
  console.log(`   curve del nuovo B con buchi: ${conBuchi.length}/${righe.filter((r) => r.cl[3]).length}`);
  console.log(`   ricalcolate senza Director: ${n} · classificazione INVARIATA ${uguale} · cambiata ${cambia} ${JSON.stringify(spost)}`);
}

// ── V4
console.log('\n══ V4 · il nuovo sbircia il futuro? (gara troncata a <= L)');
{
  let n = 0, identiche = 0, diverse = 0, maxScarto = 0;
  const esempi = [];
  const perGara = new Map();
  for (const r of righe) {
    if (!r.cl[3]) continue;
    const k = r.caso.gara;
    perGara.set(k, (perGara.get(k) ?? 0) + 1);
    if (perGara.get(k) > 2) continue;    // due casi per gara: il costo e' quadratico
    const g = garaNuova(r.caso.gara);
    const perPilota = new Map();
    for (const [drv, celle] of g.perPilota) {
      const m = new Map();
      for (const [lap, c] of celle) if (lap <= r.caso.freezeLap) m.set(lap, c);
      if (m.size) perPilota.set(drv, m);
    }
    const gT = { ...g, righe: g.righe.filter((x) => x.lap <= r.caso.freezeLap), perPilota };
    const base = contestoNuovo(r.caso.gara);
    const ctxT = { ...base, gare: { ...base.gare, [garaSimDi(r.caso.gara)]: gT } };
    const t = curvaNuovo(r.caso, mescolaLegale(r.caso), r.H, ctxT);
    n += 1;
    if (!t.punti) { diverse += 1; if (esempi.length < 4) esempi.push({ id: r.caso.id, muto: t.motivo }); continue; }
    const mT = new Map(t.punti);
    let peggio = 0;
    let stessaEstensione = t.punti.length === r.esiti[3].punti.length;
    for (const [gg, y] of r.esiti[3].punti) {
      if (!mT.has(gg)) { stessaEstensione = false; continue; }
      peggio = Math.max(peggio, Math.abs(y - mT.get(gg)));
    }
    maxScarto = Math.max(maxScarto, peggio);
    if (peggio <= 1e-9 && stessaEstensione) identiche += 1;
    else { diverse += 1; if (esempi.length < 4) esempi.push({ id: r.caso.id, scarto: peggio, stessaEstensione }); }
  }
  console.log(`   ${n} casi (2 per gara) · curva IDENTICA a quella su gara intera: ${identiche} · diversa ${diverse}`);
  console.log(`   scarto massimo su un punto: ${maxScarto.toExponential(2)} s`);
  if (esempi.length) console.log(`   ${JSON.stringify(esempi)}`);
}

// ── stesso per il VECCHIO: byLap intero vs troncato
console.log('\n══ V4-bis · il VECCHIO cambia risposta fra byLap troncato e INTERO (produzione)?');
{
  let n = 0, cambia = 0;
  const dove = {};
  for (const r of righe) {
    if (!r.cl[1]) continue;
    const i = curvaVecchio(r.caso, passoV2, r.H, false);
    if (!i.punti) continue;
    n += 1;
    const c2 = classifica(i.punti);
    if (c2.dove !== r.cl[1].dove) cambia += 1;
    dove[c2.dove] = (dove[c2.dove] ?? 0) + 1;
  }
  console.log(`   vecchio v2, ${n} curve: classificazione cambiata in ${cambia} · con byLap intero ${JSON.stringify(dove)}`);
}

// ── V6
console.log('\n══ V6 · quanto e\' PROFONDO il minimo interno? (stessa soglia per tutti)');
for (const soglia of [0, 0.1, 0.5, 1, 3]) {
  const c = [0, 1, 2, 3].map((i) => {
    const v = righe.map((r) => r.cl[i]).filter(Boolean);
    const int = v.filter((x) => x.dove === 'interno' && x.profondita > soglia).length;
    return `${int}/${v.length} (${pct(int, v.length)})`;
  });
  console.log(`   profondita' > ${String(soglia).padStart(3)} s : ` + c.map((x, i) => `${NOMI[i]} ${x}`).join('  ·  '));
}
console.log('   profondita\' mediana del minimo interno:');
for (let i = 0; i < 4; i += 1) {
  const v = righe.map((r) => r.cl[i]).filter((x) => x && x.dove === 'interno').map((x) => x.profondita);
  console.log(`     ${NOMI[i].padEnd(17)} n=${String(v.length).padStart(3)}  mediana ${f(mediana(v))} s`);
}

// ── V7
console.log('\n══ V7 · il giro del minimo si predice in chiuso? (nessun dato, solo aritmetica)');
{
  // somma delle eta' vissute, con k = giroPit - L, N = H - L, A0 = eta al congelamento
  //   NUOVO   (kernel.mjs)        k* = (N - A0) / 2
  //   VECCHIO (simulaSimmetrico)  k* = (N - 1 - A0) / 2
  const rap = [];
  for (const [i, kstar] of [[1, (N, A0) => (N - 1 - A0) / 2], [3, (N, A0) => (N - A0) / 2]]) {
    let n = 0, esatto = 0, entro1 = 0;
    const scarti = [];
    for (const r of righe) {
      const c = r.cl[i];
      if (!c) continue;
      const A0 = r.caso.etaGommaAlCongelamento;
      if (A0 == null) continue;
      const N = r.H - r.caso.freezeLap;
      const k = Math.min(Math.max(Math.round(kstar(N, A0)), 1), N - 1);
      const predetto = r.caso.freezeLap + k;
      n += 1;
      const s = c.giroMin - predetto;
      scarti.push(s);
      if (s === 0) esatto += 1;
      if (Math.abs(s) <= 1) entro1 += 1;
    }
    rap.push(`${NOMI[i]}: n=${n} esatto ${esatto} (${pct(esatto, n)}) · entro 1 giro ${entro1} (${pct(entro1, n)}) · scarto mediano ${mediana(scarti)}`);
  }
  for (const x of rap) console.log(`   ${x}`);
  // e la classificazione? interno <=> 1 <= k* <= N-2
  for (const [i, kstar] of [[1, (N, A0) => (N - 1 - A0) / 2], [3, (N, A0) => (N - A0) / 2]]) {
    let n = 0, ok = 0;
    for (const r of righe) {
      const c = r.cl[i]; if (!c || r.caso.etaGommaAlCongelamento == null) continue;
      const N = r.H - r.caso.freezeLap, A0 = r.caso.etaGommaAlCongelamento;
      const k = Math.min(Math.max(Math.round(kstar(N, A0)), 1), N - 1);
      const previsto = (k > 1 && k < N - 1) ? 'interno' : (k <= 1 ? 'primo' : 'ultimo');
      n += 1; if (previsto === c.dove) ok += 1;
    }
    console.log(`   classificazione predetta dalla sola aritmetica per ${NOMI[i]}: ${ok}/${n} (${pct(ok, n)})`);
  }
}

// ── igiene: i muti
console.log('\n══ IGIENE · i muti, e come sono contati');
{
  const conta = [0, 1, 2, 3].map((i) => {
    const m = {};
    for (const r of righe) if (!r.cl[i]) { const k = String(r.esiti[i].motivo).slice(0, 55); m[k] = (m[k] ?? 0) + 1; }
    return m;
  });
  for (let i = 0; i < 4; i += 1) {
    const tot = Object.values(conta[i]).reduce((a, b) => a + b, 0);
    console.log(`   ${NOMI[i].padEnd(17)} muti ${String(tot).padStart(3)} ${JSON.stringify(conta[i])}`);
  }
  // il referto sostiene: i 14 muti del nuovo B hanno direttore.approved=true e respinti=0
  const b14 = righe.filter((r) => !r.cl[3]);
  const verificati = b14.filter((r) => r.esiti[3].respinti === 0 || r.esiti[3].respinti === null).length;
  console.log(`   nuovo B: ${b14.length} muti · con respinti=0/null ${verificati}`);
  // i 39 muti del vecchio: e' davvero "niente passo al congelamento"?
  const v39 = righe.filter((r) => !r.cl[0]);
  const senzaPasso = v39.filter((r) => r.caso.passoVecchioDisponibile === false).length;
  console.log(`   vecchio: ${v39.length} muti · di cui senza passo legacy al congelamento ${senzaPasso}`);
}

// ── controprova sulla vista pre-calcolata, con il controllo dei buchi
console.log('\n══ CONTROPROVA · demo/data/vista/ (il prodotto come e\' servito)');
{
  const base = path.join(RADICE, 'demo', 'data', 'vista');
  const o = { tot: 0, senza: 0, rifiutati: 0, vuota: 0, con: 0, piatte: 0, interni: 0, primo: 0, ultimo: 0,
              buchi: 0, interniSenzaBuchi: 0, conSenzaBuchi: 0 };
  for (const g of readdirSync(base, { withFileTypes: true }).filter((d) => d.isDirectory()).map((d) => d.name)) {
    for (const nome of readdirSync(path.join(base, g))) {
      if (!nome.endsWith('.json') || nome.includes('fantasma') || nome === 'indice.json') continue;
      const j = JSON.parse(readFileSync(path.join(base, g, nome), 'utf8'));
      for (const r of j.giri ?? []) {
        o.tot += 1;
        if (r.senza_risposta) { o.senza += 1; continue; }
        if (r.approvato === false) { o.rifiutati += 1; continue; }
        if (!r.curva?.length) { o.vuota += 1; continue; }
        o.con += 1;
        const c = classifica(r.curva.map((x) => [x.giroPit, x.delta_s]));
        o[{ piatta: 'piatte', interno: 'interni', primo: 'primo', ultimo: 'ultimo' }[c.dove]] += 1;
        const L = r.giro ?? r.freezeLap ?? null;
        const atteso = (j.n_giri ?? null) != null && L != null ? (j.n_giri - 1 - L) : null;
        if (atteso != null && c.n < atteso) o.buchi += 1;
        else { o.conSenzaBuchi += 1; if (c.dove === 'interno') o.interniSenzaBuchi += 1; }
      }
    }
  }
  console.log(`   record ${o.tot} · senza_risposta ${o.senza} · rifiutati ${o.rifiutati} · curva vuota ${o.vuota} (${pct(o.vuota, o.vuota + o.con)})`);
  console.log(`   con curva ${o.con} → piatte ${o.piatte} · INTERNI ${o.interni} (${pct(o.interni, o.con)}) · primo ${o.primo} · ultimo ${o.ultimo}`);
  console.log(`   curve con buchi ${o.buchi} · fra le SENZA buchi: interni ${o.interniSenzaBuchi}/${o.conSenzaBuchi} (${pct(o.interniSenzaBuchi, o.conSenzaBuchi)})`);
}

// ── per gara
console.log('\n══ PER GARA (interni/curve — vecchio null | vecchio v2 | nuovo A | nuovo B)');
for (const g of gare()) {
  const rr = righe.filter((r) => r.caso.gara === g);
  if (!rr.length) continue;
  const celle = [0, 1, 2, 3].map((i) => {
    const v = rr.map((r) => r.cl[i]).filter(Boolean);
    return v.length ? `${v.filter((x) => x.dove === 'interno').length}/${v.length}`.padStart(9) : 'muto'.padStart(9);
  });
  console.log(`   ${g.padEnd(16)}${celle.join('')}`);
}
