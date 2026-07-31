// verifica_M4_controperizia.mjs — CONTROPERIZIA ADVERSARIALE DELLA MISURA M4.
//
// NON importa banco.mjs ne' m4_copertura.mjs: ricostruisce da zero il perimetro, la
// verita', gli ingressi dei due motori, le statistiche e il test di permutazione (altro
// PRNG, altro seme). Se i numeri coincidono, coincidono per due strade diverse.
//
//   node ai_lab/confronto/verifica_M4_controperizia.mjs
//   node ai_lab/confronto/verifica_M4_controperizia.mjs --largo
//
// LE ACCUSE CHE PROVA A SOSTENERE (una sezione per accusa):
//   V1  il perimetro e la verita' sono quelli dichiarati? (274 soste, esclusioni)
//   V2  la tavola dei muti regge? (223 / 12 / 37 / 2, per gara)
//   V3  la lettura B e' coerente col numero che il motore ha davvero dato?
//       (ordine ricostruito == popolazione su cui pos e' stata calcolata) — per ENTRAMBI
//   V4  confronto alla pari? la copertura del vecchio dipende dal troncamento o
//       dall'orizzonte scelti dal banco?
//   V5  fuga dal futuro? si TRONCA la gara del nuovo a <= L e si guarda se cambia
//       qualcosa (copertura e posizione)
//   V6  IL DENOMINATORE: quanto e' grande la popolazione su cui ciascun motore ordina,
//       gruppo per gruppo. Un rango fra 4 auto non e' un rango fra 17.
//   V7  (b2) ricalcolata a parita' di taglia della popolazione e per gara
//   V8  (c) lo specchio: il blocco Monaco (E11) — i 37 guadagnati sono 33 Monaco
//   V9  la causa dichiarata, contata: giri verdi <= L (nuovo) e giri verdi nello stint
//       (vecchio)
//   V10 campione largo, ricontato
//
// Nessuna scrittura su disco. Non tocca demo/, simulatore/, data/.

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
import { passoUtilizzabile } from '../../simulatore/provenienza/definizioni.mjs';

const QUI = path.dirname(fileURLToPath(import.meta.url));
const RADICE = path.resolve(QUI, '..', '..');
const DEMO = path.join(RADICE, 'demo', 'data');
const SIM = path.join(RADICE, 'simulatore');
const LARGO = process.argv.includes('--largo');
const leggi = (p) => JSON.parse(readFileSync(p, 'utf8'));

// ————————————————————————————————————————————————————————————————— utensili
const med = (v) => { if (!v.length) return null; const s = [...v].sort((a, b) => a - b);
  const m = s.length >> 1; return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; };
const avg = (v) => (v.length ? v.reduce((a, b) => a + b, 0) / v.length : null);
const pct = (a, b) => (b ? `${(100 * a / b).toFixed(1)}%` : 'n/d');
const fx = (x, n = 3) => (x == null ? 'n/d' : Number(x).toFixed(n));
const quotaEsatti = (v) => (v.length ? v.filter((x) => x === 0).length / v.length : 0);

// PRNG DIVERSO da quello del misuratore (lui: mulberry32, seme 20260731).
// Qui xorshift128+ semplificato, seme 987654321: se le p combaciano comunque, non e'
// perche' e' lo stesso rumore.
function xorshift32(seed) {
  let x = seed | 0 || 1;
  return () => { x ^= x << 13; x |= 0; x ^= x >>> 17; x ^= x << 5; x |= 0; return (x >>> 0) / 4294967296; };
}
function permuta(A, B, stat = med, iter = 20000, seme = 987654321) {
  if (!A.length || !B.length) return null;
  const tutti = [...A, ...B]; const nA = A.length;
  const oss = Math.abs(stat(A) - stat(B));
  const rnd = xorshift32(seme);
  let k = 0;
  for (let i = 0; i < iter; i += 1) {
    const v = [...tutti];
    for (let j = v.length - 1; j > 0; j -= 1) { const r = Math.floor(rnd() * (j + 1)); [v[j], v[r]] = [v[r], v[j]]; }
    if (Math.abs(stat(v.slice(0, nA)) - stat(v.slice(nA))) >= oss - 1e-12) k += 1;
  }
  return { oss, p: (k + 1) / (iter + 1) };
}
function riga(tag, err) {
  const n = err.length;
  const e0 = err.filter((x) => x === 0).length;
  const e1 = err.filter((x) => x <= 1).length;
  console.log(`      ${tag.padEnd(30)} n=${String(n).padStart(3)}  mediana ${String(med(err) ?? 'n/d').padStart(4)}`
    + `  media ${fx(avg(err), 2).padStart(5)}  esatti ${String(e0).padStart(3)} (${pct(e0, n).padStart(6)})`
    + `  entro1 ${String(e1).padStart(3)} (${pct(e1, n).padStart(6)})`);
}

// ————————————————————————————————————————————————————————————— i dati, miei
const MANIFEST = leggi(path.join(DEMO, 'vista', 'manifest.json')).cartella_di;
const GARE = Object.keys(MANIFEST).sort();
const PITLOSS = leggi(path.join(DEMO, 'pitloss.json'));

const GARE_SIM = caricaGare2026(SIM);
const CONTESTO_BASE = {
  gare: GARE_SIM,
  modello: leggi(path.join(SIM, 'data', 'modelli', 'modello_v2.json')),
  prior: caricaPrior(SIM),
  costantiDirector: caricaCostanti(SIM),
  bandaRientro: leggi(path.join(SIM, 'data', 'modelli', 'banda_rientro.json')),
  nGiriGara: null,
};

const DEMOGARA = {};
for (const g of GARE) {
  const G = leggi(path.join(DEMO, `${g}.json`));
  const byLap = {};
  for (const l of G.laps) byLap[l.lap] = l.cars;
  DEMOGARA[g] = { G, byLap, nLaps: G.n_laps, pitLoss: PITLOSS[g] };
}

const ordina = (cum) => (a, b) => (cum[a] - cum[b]) || (a < b ? -1 : b < a ? 1 : 0);
const troncaCache = new Map();
function byLapTronc(g, L) {
  const k = `${g}|${L}`;
  if (troncaCache.has(k)) return troncaCache.get(k);
  const { byLap } = DEMOGARA[g];
  const t = {};
  for (let i = 1; i <= L; i += 1) if (byLap[i]) t[i] = byLap[i];
  troncaCache.set(k, t);
  return t;
}

// ————————————————————————————————————————————————————————— V1 · perimetro
const cens = { soste: 0, esc: { entro3: 0, senzaCumL: 0, senzaGiroLo: 0, senzaCumLo: 0, doppiato: 0 } };
const CASI = [];
for (const g of GARE) {
  const { G, byLap, nLaps } = DEMOGARA[g];
  const leader = {};
  for (let k = 1; k <= nLaps; k += 1) {
    if (!byLap[k]) continue;
    let m = Infinity;
    for (const d of Object.keys(byLap[k])) { const t = byLap[k][d].cum_time; if (typeof t === 'number' && t < m) m = t; }
    if (m < Infinity) leader[k] = m;
  }
  const dopp = (Lo, cum) => leader[Lo + 1] !== undefined && cum > leader[Lo + 1];
  const daQui = [];
  for (let Li = 1; Li <= nLaps; Li += 1) {
    if (!byLap[Li]) continue;
    for (const drv of Object.keys(byLap[Li])) {
      if (byLap[Li][drv].in_lap !== true) continue;
      cens.soste += 1;
      const L = Li - 1, Lo = Li + 1;
      if (Li < 4) { cens.esc.entro3 += 1; continue; }
      if (typeof byLap[L]?.[drv]?.cum_time !== 'number') { cens.esc.senzaCumL += 1; continue; }
      if (!byLap[Lo]) { cens.esc.senzaGiroLo += 1; continue; }
      const cumLo = byLap[Lo][drv]?.cum_time;
      if (typeof cumLo !== 'number') { cens.esc.senzaCumLo += 1; continue; }
      if (dopp(Lo, cumLo)) { cens.esc.doppiato += 1; continue; }
      const cum = {};
      for (const d of Object.keys(byLap[Lo])) { const t = byLap[Lo][d].cum_time; if (typeof t === 'number') cum[d] = t; }
      const ordine = Object.keys(cum).sort(ordina(cum));
      daQui.push({
        id: `${g}|${drv}|${Li}`, gara: g, garaSim: MANIFEST[g], pilota: drv,
        freezeLap: L, pitLap: Li, rientroLap: Lo, nGiri: nLaps,
        posizioneVera: ordine.indexOf(drv) + 1, suQuantiVeri: ordine.length, ordineVero: ordine,
        neutralizzato: byLap[L][drv].neutralized === true,
        mescolaL: byLap[L][drv].compound ?? null,
        passoVecchio: G.pace[String(L)]?.[drv] ?? null,
      });
    }
  }
  daQui.sort((a, b) => a.pitLap - b.pitLap || (a.pilota < b.pilota ? -1 : 1));
  CASI.push(...daQui);
}

// ————————————————————————————————————————————— i due motori, ingressi miei
const MIN_SOSTE_UI = 3, ZONE = 0;
function vecchio(c, { troncato = true, orizzonte = 0 } = {}) {
  const { G, byLap, nLaps, pitLoss } = DEMOGARA[c.gara];
  const L = c.freezeLap;
  const bl = troncato ? byLapTronc(c.gara, L) : byLap;
  const pace = G.pace[String(L)] || {};
  const present = G.drivers.filter((d) => typeof bl[L]?.[d]?.cum_time === 'number' && pace[d] != null);
  const gr = misuraGradino(bl, nLaps, L);
  const gradino = (gr.gradino != null && gr.n_gradino >= MIN_SOSTE_UI) ? gr.gradino : null;
  let r;
  try {
    r = evaluatePit({ byLap: bl, nLaps, pace, driver: c.pilota, freezeLap: L, pitLap: c.pitLap,
                      pitLoss, present, gara: c.gara, laps: G.laps, ZONE, orizzonte, gradino });
  } catch (e) { return { muto: true, motivo: `eccezione: ${e.message}` }; }
  if (!r || r.ok !== true) return { muto: true, motivo: r?.reason ?? 'nessuna risposta' };
  return { muto: false, pos: r.rientro_pos, su: r.su_totale, ordine: r.ordine_previsto.map(([d]) => d) };
}
function nuovo(c, { garaOverride = null } = {}) {
  const gSim = garaOverride ?? GARE_SIM[c.garaSim];
  const mescola = mescolaAlGiro(gSim, c.freezeLap, c.pilota);
  if (mescola === null) return { muto: true, motivo: 'mescola non nota o non slick' };
  const contesto = garaOverride
    ? { ...CONTESTO_BASE, gare: { ...GARE_SIM, [c.garaSim]: garaOverride }, nGiriGara: GARE_SIM[c.garaSim].nGiri }
    : { ...CONTESTO_BASE, nGiriGara: GARE_SIM[c.garaSim].nGiri };
  let r;
  try {
    r = doveRientri({ gara: c.garaSim, freezeLap: c.freezeLap, pilota: c.pilota,
                      giroPit: c.pitLap, mescola }, contesto);
  } catch (e) { return { muto: true, motivo: `eccezione: ${e.message}` }; }
  if (!r || r.approvato !== true) return { muto: true, motivo: 'respinto dal Director' };
  if (r.posizione == null) return { muto: true, motivo: 'nessun passo base (regola 6)' };
  let ordine = null;
  if (r.traccia) {
    const cum = {};
    for (const [d, passi] of Object.entries(r.traccia)) {
      if (!passi) continue;
      const p = passi.find((x) => x.lap === c.rientroLap);
      if (p) cum[d] = p.cum_time;
    }
    ordine = Object.keys(cum).sort(ordina(cum));
  }
  return { muto: false, pos: r.posizione, su: r.su_quanti, ordine };
}

// errore A (grezzo) ed errore B (popolazione comune bilaterale motore ∩ verita')
const errA = (r, c) => (r.muto || r.pos == null ? null : Math.abs(r.pos - c.posizioneVera));
function errB(r, c) {
  if (r.muto || !r.ordine) return null;
  const suoi = new Set(r.ordine);
  const S = c.ordineVero.filter((d) => suoi.has(d));
  if (!S.includes(c.pilota) || S.length < 3) return null;
  const mio = r.ordine.filter((d) => S.includes(d)).indexOf(c.pilota) + 1;
  return { err: Math.abs(mio - (S.indexOf(c.pilota) + 1)), su: S.length };
}

console.log('═════════════════════════════════════════════════════════════════════');
console.log('CONTROPERIZIA M4 — rimisura indipendente (nessun import da banco.mjs)');
console.log('═════════════════════════════════════════════════════════════════════');

console.log('\n── V1 · PERIMETRO E VERITA\' ─────────────────────────────────────────');
console.log(`    soste reali (celle in_lap) : ${cens.soste}   [dichiarato 459]`);
console.log(`    escluse Li<=3              : ${cens.esc.entro3}   [22]`);
console.log(`    escluse senza cum al congelamento : ${cens.esc.senzaCumL}`);
console.log(`    escluse senza giro di rientro     : ${cens.esc.senzaGiroLo}`);
console.log(`    escluse senza cum al rientro      : ${cens.esc.senzaCumLo}   [23]`);
console.log(`    escluse doppiato al rientro       : ${cens.esc.doppiato}   [140]`);
console.log(`    CASI AMMESSI               : ${CASI.length}   [274]`);

// ————————————————————————————————————————————————————————— V2 · la tavola
const T = CASI.map((c) => {
  const v = vecchio(c), n = nuovo(c);
  return { c, v, n, vR: !v.muto, nR: !n.muto,
           vA: errA(v, c), nA: errA(n, c), vB: errB(v, c), nB: errB(n, c) };
});
const entrambi = T.filter((t) => t.vR && t.nR);
const soloV = T.filter((t) => t.vR && !t.nR);
const soloN = T.filter((t) => !t.vR && t.nR);
const nessuno = T.filter((t) => !t.vR && !t.nR);

console.log('\n── V2 · LA TAVOLA DEI MUTI ──────────────────────────────────────────');
console.log(`    entrambi ${entrambi.length} [223] · soloV ${soloV.length} [12] · soloN ${soloN.length} [37] · nessuno ${nessuno.length} [2]`);
console.log(`    copertura VECCHIO ${T.filter((t) => t.vR).length}/${T.length} (${pct(T.filter((t) => t.vR).length, T.length)}) [235]`
  + ` · NUOVO ${T.filter((t) => t.nR).length}/${T.length} (${pct(T.filter((t) => t.nR).length, T.length)}) [260]`);
const motivi = (sel, chi) => { const m = new Map();
  for (const t of T.filter(sel)) { const k = chi(t).motivo; m.set(k, (m.get(k) ?? 0) + 1); }
  return [...m.entries()].sort((a, b) => b[1] - a[1]).map(([k, v]) => `${v}× ${k}`).join(' · '); };
console.log(`    tace il VECCHIO: ${motivi((t) => !t.vR, (t) => t.v)}`);
console.log(`    tace il NUOVO  : ${motivi((t) => !t.nR, (t) => t.n)}`);
console.log(`    persi  : ${soloV.map((t) => t.c.id).join(' , ')}`);
console.log(`    per gara (casi/soloV/soloN):`);
for (const g of GARE) {
  const t = T.filter((x) => x.c.gara === g);
  console.log(`      ${g.padEnd(16)} ${String(t.length).padStart(3)} / ${String(t.filter((x) => x.vR && !x.nR).length).padStart(2)} / ${String(t.filter((x) => !x.vR && x.nR).length).padStart(2)}`
    + `   cop.V ${pct(t.filter((x) => x.vR).length, t.length).padStart(6)}  cop.N ${pct(t.filter((x) => x.nR).length, t.length).padStart(6)}`);
}

// ————————————————————————————————— V3 · la lettura B e' quella del motore?
console.log('\n── V3 · COERENZA DELLA LETTURA B COL NUMERO DEL MOTORE ───────────────');
console.log('    (l\'ordine su cui B ri-classifica deve essere ESATTAMENTE la popolazione');
console.log('     su cui il motore ha calcolato pos/su. Se no, B misura un altro motore.)');
for (const [nome, sel, chi] of [['VECCHIO', (t) => t.vR, (t) => t.v], ['NUOVO', (t) => t.nR, (t) => t.n]]) {
  let ok = 0, badSu = 0, badPos = 0, senzaOrdine = 0;
  for (const t of T.filter(sel)) {
    const r = chi(t);
    if (!r.ordine) { senzaOrdine += 1; continue; }
    const posDaOrdine = r.ordine.indexOf(t.c.pilota) + 1;
    if (r.ordine.length !== r.su) badSu += 1;
    else if (posDaOrdine !== r.pos) badPos += 1;
    else ok += 1;
  }
  console.log(`    ${nome}: coerenti ${ok} · |ordine|≠su ${badSu} · pos≠indice ${badPos} · senza ordine ${senzaOrdine}`);
}

// —————————————————————————— V4 · la copertura del vecchio e' stata handicappata?
console.log('\n── V4 · CONFRONTO ALLA PARI: il troncamento tocca la COPERTURA? ──────');
let copInt = 0, copTr = 0, diffPos = 0, diffSu = 0;
const varianti = CASI.map((c) => {
  const a = vecchio(c, { troncato: true });
  const b = vecchio(c, { troncato: false });
  if (!a.muto) copTr += 1;
  if (!b.muto) copInt += 1;
  if (!a.muto && !b.muto) { if (a.pos !== b.pos) diffPos += 1; if (a.su !== b.su) diffSu += 1; }
  return { c, a, b };
});
console.log(`    copertura con byLap TRONCATO ${copTr}/${CASI.length} · con byLap INTERO ${copInt}/${CASI.length}`
  + `  ⇒ il troncamento ${copTr === copInt ? 'NON tocca la copertura' : 'TOCCA la copertura'}`);
console.log(`    (cambia invece la risposta: pos diversa in ${diffPos} casi, su diverso in ${diffSu})`);
{
  const aOr = CASI.map((c) => vecchio(c, { orizzonte: 5 }));
  console.log(`    copertura con orizzonte 5 (quello di gen_hero): ${aOr.filter((r) => !r.muto).length}/${CASI.length}`
    + `  ⇒ ${aOr.filter((r) => !r.muto).length === copTr ? 'la copertura non dipende dall\'orizzonte' : 'DIPENDE dall\'orizzonte'}`);
}
// e la qualita' del vecchio sui casi persi, con byLap INTERO (nessun handicap)?
{
  const persiIds = new Set(soloV.map((t) => t.c.id));
  const dentro = varianti.filter((x) => persiIds.has(x.c.id) && !x.b.muto)
    .map((x) => Math.abs(x.b.pos - x.c.posizioneVera));
  const fuori = varianti.filter((x) => !persiIds.has(x.c.id) && !x.b.muto)
    .map((x) => Math.abs(x.b.pos - x.c.posizioneVera));
  console.log('    CONTROPROVA: e se il vecchio NON fosse troncato? errore A sui persi vs tenuti');
  riga('persi (byLap intero)', dentro);
  riga('tenuti (byLap intero)', fuori);
}

// ————————————————————————————————————————————— V5 · fuga dal futuro nel NUOVO
console.log('\n── V5 · FUGA DAL FUTURO: si tronca la gara del NUOVO a <= L ──────────');
console.log('    (se il nuovo leggesse oltre il congelamento, troncare cambierebbe qualcosa)');
{
  let cambiaCop = 0, cambiaPos = 0, provati = 0;
  const cacheG = new Map();
  for (const t of T) {
    const c = t.c;
    const k = `${c.garaSim}|${c.freezeLap}`;
    let gT = cacheG.get(k);
    if (!gT) {
      const g = GARE_SIM[c.garaSim];
      const righe = g.righe.filter((r) => r.lap <= c.freezeLap);
      const perPilota = new Map();
      for (const { drv, lap, cella } of righe) {
        if (!perPilota.has(drv)) perPilota.set(drv, new Map());
        perPilota.get(drv).set(lap, cella);
      }
      gT = { ...g, righe, perPilota, nGiri: g.nGiri };
      cacheG.set(k, gT);
    }
    const rT = nuovo(c, { garaOverride: gT });
    provati += 1;
    if (rT.muto !== t.n.muto) cambiaCop += 1;
    else if (!rT.muto && rT.pos !== t.n.pos) cambiaPos += 1;
  }
  console.log(`    ${provati} casi · copertura cambiata ${cambiaCop} · posizione cambiata ${cambiaPos}`
    + `  ⇒ ${cambiaCop + cambiaPos === 0 ? 'il NUOVO e\' invariante al troncamento (nessuna fuga)' : 'ATTENZIONE: il nuovo legge oltre il congelamento'}`);
}

// ————————————————————————————————————————————————————— V6 · IL DENOMINATORE
console.log('\n── V6 · IL DENOMINATORE: su quante auto ciascun motore ordina ────────');
console.log('    (un rango esatto fra 4 auto e\' molto piu\' facile di un rango fra 17.');
console.log('     Se i gruppi che si confrontano hanno denominatori diversi, il confronto');
console.log('     e\' fra due difficolta\', non fra due motori.)');
const fasce = [[4, 8], [9, 13], [14, 20], [21, 30], [31, 45], [46, 99]];
console.log(`    ${'fascia'.padEnd(8)} ${'V:su med'.padStart(10)} ${'V:|S| med'.padStart(10)} ${'N:su med'.padStart(10)} ${'N:|S| med'.padStart(10)} ${'verita\':su'.padStart(11)}`);
for (const [a, b] of fasce) {
  const t = T.filter((x) => x.c.pitLap >= a && x.c.pitLap <= b);
  if (!t.length) continue;
  const vs = t.filter((x) => x.vR).map((x) => x.v.su);
  const vS = t.map((x) => x.vB).filter(Boolean).map((x) => x.su);
  const ns = t.filter((x) => x.nR).map((x) => x.n.su);
  const nS = t.map((x) => x.nB).filter(Boolean).map((x) => x.su);
  const ver = t.map((x) => x.c.suQuantiVeri);
  console.log(`    ${`${a}-${b}`.padEnd(8)} ${String(med(vs) ?? 'n/d').padStart(10)} ${String(med(vS) ?? 'n/d').padStart(10)}`
    + ` ${String(med(ns) ?? 'n/d').padStart(10)} ${String(med(nS) ?? 'n/d').padStart(10)} ${String(med(ver)).padStart(11)}`);
}
{
  const d = T.filter((x) => x.c.pitLap <= 13 && x.vR);
  const f = T.filter((x) => x.c.pitLap > 13 && x.vR);
  console.log(`    VECCHIO — mediana di |S| (popolazione comune): sosta<=13 ${med(d.map((x) => x.vB?.su).filter(Boolean))}`
    + ` · sosta>13 ${med(f.map((x) => x.vB?.su).filter(Boolean))}`);
  console.log(`    VECCHIO — quota di casi con |S| < 10: sosta<=13 ${pct(d.filter((x) => x.vB && x.vB.su < 10).length, d.length)}`
    + ` · sosta>13 ${pct(f.filter((x) => x.vB && x.vB.su < 10).length, f.length)}`);
}

// ———————————————————————————————————————— V7 · (b2) a parita' di popolazione
console.log('\n── V7 · (b2) RICALCOLATA CONTROLLANDO IL DENOMINATORE ────────────────');
{
  const B = (x) => (x.vB ? x.vB.err : null);
  const grande = (x) => x.vB && x.vB.su >= 12;   // campo sostanzialmente intero
  const casi13 = T.filter((x) => x.c.pitLap <= 13 && x.vR);
  const casiOltre = T.filter((x) => x.c.pitLap > 13 && x.vR);
  console.log('    (a) come il misuratore — TUTTI i casi, lettura B');
  const d0 = casi13.map(B).filter((x) => x != null), f0 = casiOltre.map(B).filter((x) => x != null);
  riga('sosta <= 13', d0); riga('sosta >  13', f0);
  const p0 = permuta(d0, f0, quotaEsatti);
  console.log(`      Δ quota esatti ${(100 * (quotaEsatti(d0) - quotaEsatti(f0))).toFixed(1)} punti · p(quota) ${fx(p0.p, 4)}   [dichiarato -21.6 punti, p=0.0106]`);
  console.log('    (b) SOLO i casi in cui il vecchio ordina su un campo quasi intero (|S| >= 12)');
  const d1 = casi13.filter(grande).map(B), f1 = casiOltre.filter(grande).map(B);
  riga('sosta <= 13', d1); riga('sosta >  13', f1);
  if (d1.length && f1.length) {
    const p1 = permuta(d1, f1, quotaEsatti);
    const p1m = permuta(d1, f1);
    console.log(`      Δ quota esatti ${(100 * (quotaEsatti(d1) - quotaEsatti(f1))).toFixed(1)} punti · p(quota) ${fx(p1.p, 4)} · p(mediane) ${fx(p1m.p, 4)}`);
  }
  console.log('    (c) escludendo Monaco (la gara che porta quasi tutti i denominatori piccoli)');
  const d2 = casi13.filter((x) => x.c.gara !== 'Monaco').map(B).filter((x) => x != null);
  const f2 = casiOltre.filter((x) => x.c.gara !== 'Monaco').map(B).filter((x) => x != null);
  riga('sosta <= 13', d2); riga('sosta >  13', f2);
  const p2 = permuta(d2, f2, quotaEsatti);
  console.log(`      Δ quota esatti ${(100 * (quotaEsatti(d2) - quotaEsatti(f2))).toFixed(1)} punti · p(quota) ${fx(p2.p, 4)}`);
}

// ————————————————————————————————————————— V8 · lo specchio, dentro il blocco
console.log('\n── V8 · (c) LO SPECCHIO — e\' un effetto MOTORE o un effetto MONACO? ──');
{
  const guad = new Set(soloN.map((t) => t.c.id));
  const perGara = new Map();
  for (const t of soloN) perGara.set(t.c.gara, (perGara.get(t.c.gara) ?? 0) + 1);
  console.log(`    i 37 guadagnati per gara: ${[...perGara.entries()].sort((a, b) => b[1] - a[1]).map(([g, k]) => `${g} ${k}`).join(' · ')}`);
  const B = (x) => (x.nB ? x.nB.err : null);
  console.log('    (a) come il misuratore: guadagnati (quasi tutti Monaco) contro tenuti (tutte le gare)');
  const g0 = soloN.map(B).filter((x) => x != null), k0 = entrambi.map(B).filter((x) => x != null);
  riga('GUADAGNATI', g0); riga('TENUTI', k0);
  const pp = permuta(g0, k0, quotaEsatti);
  console.log(`      Δ quota esatti ${(100 * (quotaEsatti(g0) - quotaEsatti(k0))).toFixed(1)} punti · p(quota) ${fx(pp.p, 4)}   [dichiarato -22.3 punti, p=0.0108]`);
  console.log('    (b) DENTRO IL BLOCCO MONACO: guadagnati Monaco contro tutti gli altri casi Monaco a cui il nuovo risponde');
  const mg = T.filter((x) => x.c.gara === 'Monaco' && guad.has(x.c.id)).map(B).filter((x) => x != null);
  const mk = T.filter((x) => x.c.gara === 'Monaco' && !guad.has(x.c.id) && x.nR).map(B).filter((x) => x != null);
  riga('Monaco · guadagnati', mg); riga('Monaco · altri', mk);
  if (mg.length && mk.length) {
    const pm = permuta(mg, mk, quotaEsatti); const pmm = permuta(mg, mk);
    console.log(`      Δ quota esatti ${(100 * (quotaEsatti(mg) - quotaEsatti(mk))).toFixed(1)} punti · p(quota) ${fx(pm.p, 4)} · p(mediane) ${fx(pmm.p, 4)}`);
  }
  console.log('    (c) il NUOVO su TUTTA Monaco contro il NUOVO fuori Monaco (nessun guadagno di mezzo)');
  const mn = T.filter((x) => x.c.gara === 'Monaco' && x.nR).map(B).filter((x) => x != null);
  const fn = T.filter((x) => x.c.gara !== 'Monaco' && x.nR).map(B).filter((x) => x != null);
  riga('NUOVO · Monaco', mn); riga('NUOVO · fuori Monaco', fn);
  const pmo = permuta(mn, fn, quotaEsatti);
  console.log(`      Δ quota esatti ${(100 * (quotaEsatti(mn) - quotaEsatti(fn))).toFixed(1)} punti · p(quota) ${fx(pmo.p, 4)}`);
  console.log('    (d) e i 37 guadagnati contro i tenuti, ESCLUSA Monaco da entrambi i lati');
  const g2 = soloN.filter((x) => x.c.gara !== 'Monaco').map(B).filter((x) => x != null);
  const k2 = entrambi.filter((x) => x.c.gara !== 'Monaco').map(B).filter((x) => x != null);
  riga('GUADAGNATI (no Monaco)', g2); riga('TENUTI (no Monaco)', k2);
}

// —————————————————————————————————————————————————————— V9 · la causa, contata
console.log('\n── V9 · LA CAUSA DICHIARATA, CONTATA ────────────────────────────────');
{
  // nuovo: giri verdi utilizzabili <= L (serve >= 8)
  const verdiFinoA = (garaSim, drv, L) => {
    const g = GARE_SIM[garaSim];
    let n = 0;
    for (const c of g.perPilota.get(drv)?.values() ?? []) void c;
    for (const { drv: d, lap, cella } of g.righe) {
      if (d !== drv || lap > L) continue;
      if (passoUtilizzabile(cella) && cella.tyre_age !== null) n += 1;
    }
    return n;
  };
  // vecchio: giri verdi nello stint corrente <= L (serve >= 3, esporta_demo_gara::passoLegacy)
  const verdiStint = (gara, drv, L) => {
    const { byLap } = DEMOGARA[gara];
    const cur = byLap[L]?.[drv];
    if (!cur) return null;
    let n = 0;
    for (let k = L; k >= 1; k -= 1) {
      const c = byLap[k]?.[drv];
      if (!c || c.stint !== cur.stint) break;
      if (typeof c.lap_time === 'number' && !c.in_lap && !c.out_lap && !c.neutralized && !c.deleted) n += 1;
    }
    return n;
  };
  const p = soloV.map((t) => verdiFinoA(t.c.garaSim, t.c.pilota, t.c.freezeLap));
  console.log(`    i 12 PERSI — giri verdi <= L per il nuovo (soglia 8): ${p.join(', ')}`);
  console.log(`      tutti sotto 8? ${p.every((x) => x < 8) ? 'SI (la causa dichiarata regge)' : 'NO'}`);
  const q = soloN.map((t) => verdiStint(t.c.gara, t.c.pilota, t.c.freezeLap));
  console.log(`    i 37 GUADAGNATI — giri verdi nello stint per il vecchio (soglia 3): min ${Math.min(...q)} max ${Math.max(...q)} · sotto 3: ${q.filter((x) => x < 3).length}/${q.length}`);
  const neu = soloN.filter((t) => t.c.neutralizzato).length;
  console.log(`    i 37 GUADAGNATI — flag neutralized al congelamento: ${neu}/${soloN.length} [dichiarato 34/37]`);
}

// —————————————————————————————— V11 · SONO SOSTE, QUELLE? (la sosta fantasma)
console.log('\n── V11 · LE 274 "SOSTE VERE" SONO 274 SOSTE? ────────────────────────');
console.log('    Il perimetro chiama "sosta vera" ogni cella con in_lap. Tre firme, di cui');
console.log('    due dalla FONTE e una dal conteggio, dicono che una cella con in_lap non e\'');
console.log('    una sosta di strategia:');
console.log('      (R)   BANDIERA ROSSA: lo status del pilota contiene "5" al giro della');
console.log('            sosta o al rientro (vocabolario.mjs: ROSSA = "5")');
console.log('      (C)   in_lap di PIU\' DI MEZZO CAMPO nello stesso giro: e\' la pit-lane che');
console.log('            si riempie, non venti muretti che decidono insieme');
console.log('      (A)   lo stesso pilota ha in_lap anche al giro adiacente');
console.log('    (la firma "la gomma non ringiovanisce" e\' stata SCARTATA: in questo dataset');
console.log('     tyre_age non si azzera nemmeno sulle soste buone — Australia|COL|9 lo mostra.)');
{
  for (const t of T) {
    const c = t.c;
    const { byLap } = DEMOGARA[c.gara];
    const cars = byLap[c.pitLap];
    const nIn = Object.keys(cars).filter((d) => cars[d].in_lap === true).length;
    const st = (x) => String(x ?? '');
    t.f_rossa = st(cars[c.pilota].status).includes('5') || st(byLap[c.rientroLap][c.pilota]?.status).includes('5');
    t.f_campo = nIn > Object.keys(cars).length / 2;
    t.f_adiac = byLap[c.pitLap - 1]?.[c.pilota]?.in_lap === true || byLap[c.pitLap + 1]?.[c.pilota]?.in_lap === true;
    t.dubbia = t.f_rossa || t.f_campo || t.f_adiac;
  }
  const dub = T.filter((t) => t.dubbia);
  console.log(`\n    casi con almeno una firma: ${dub.length}/${T.length}   (R) ${T.filter((t) => t.f_rossa).length} · (C) ${T.filter((t) => t.f_campo).length} · (A) ${T.filter((t) => t.f_adiac).length}`);
  const pg = new Map();
  for (const t of dub) pg.set(t.c.gara, (pg.get(t.c.gara) ?? 0) + 1);
  console.log(`    per gara: ${[...pg.entries()].sort((a, b) => b[1] - a[1]).map(([g, k]) => `${g} ${k}`).join(' · ')}`);
  console.log(`    dei 37 GUADAGNATI dal nuovo, quanti sono dubbi: ${soloN.filter((t) => t.dubbia).length}/37`);
  console.log(`    dei 12 PERSI, quanti sono dubbi: ${soloV.filter((t) => t.dubbia).length}/12`);
  console.log('\n    IL SALDO DI COPERTURA, UNA FIRMA ALLA VOLTA (togliendo solo quella firma)');
  for (const [tag, sel] of [['R · bandiera rossa', (t) => t.f_rossa], ['C · mezzo campo ai box', (t) => t.f_campo],
                            ['A · in_lap adiacente', (t) => t.f_adiac], ['R∪C∪A', (t) => t.dubbia]]) {
    const p = T.filter((t) => !sel(t));
    const v = p.filter((t) => t.vR).length, n = p.filter((t) => t.nR).length;
    console.log(`      ${tag.padEnd(22)} casi ${String(p.length).padStart(3)} · vecchio ${pct(v, p.length).padStart(6)} · nuovo ${pct(n, p.length).padStart(6)} · SALDO ${n - v > 0 ? '+' : ''}${n - v}`);
  }
  const puliti = T.filter((t) => !t.dubbia);
  const pV = puliti.filter((t) => t.vR).length, pN = puliti.filter((t) => t.nR).length;
  console.log(`\n    LA TAVOLA SUL PERIMETRO PULITO (${puliti.length} casi)`);
  console.log(`      entrambi ${puliti.filter((t) => t.vR && t.nR).length} · soloV ${puliti.filter((t) => t.vR && !t.nR).length}`
    + ` · soloN ${puliti.filter((t) => !t.vR && t.nR).length} · nessuno ${puliti.filter((t) => !t.vR && !t.nR).length}`);
  console.log(`      copertura VECCHIO ${pV}/${puliti.length} (${pct(pV, puliti.length)}) · NUOVO ${pN}/${puliti.length} (${pct(pN, puliti.length)}) · SALDO ${pN - pV}   [sul perimetro intero era +25]`);
  const pgc = new Map();
  for (const t of puliti) {
    const r = pgc.get(t.c.gara) ?? { n: 0, v: 0, u: 0 };
    r.n += 1; if (t.vR) r.v += 1; if (t.nR) r.u += 1; pgc.set(t.c.gara, r);
  }
  console.log(`      per gara (saldo N−V): ${[...pgc.entries()].map(([g, r]) => `${g} ${r.u - r.v > 0 ? '+' : ''}${r.u - r.v}`).join(' · ')}`);
  // il cancello M4 rifatto sul perimetro pulito
  const persiP = puliti.filter((t) => t.vR && !t.nR), tenutiP = puliti.filter((t) => t.vR && t.nR);
  for (const [tag, get] of [['A · grezza', (x) => x.vA], ['B · comune', (x) => (x.vB ? x.vB.err : null)]]) {
    const p = persiP.map(get).filter((x) => x != null), k = tenutiP.map(get).filter((x) => x != null);
    console.log(`      cancello M4, lettura ${tag}:`);
    riga('persi', p); riga('tenuti', k);
  }
}

// ————————————————————————————————————————————————————————— V10 · il largo
if (LARGO) {
  console.log('\n── V10 · CAMPIONE LARGO, RICONTATO ──────────────────────────────────');
  let tot = 0, cv = 0, cn = 0, sv = 0, sn = 0, svPresto = 0, svPresto10 = 0;
  const perFascia = new Map();
  const perGaraL = new Map();
  for (const g of GARE) {
    const { G, byLap, nLaps } = DEMOGARA[g];
    for (let L = 3; L <= nLaps - 2; L += 1) {
      const cars = byLap[L];
      if (!cars) continue;
      for (const drv of Object.keys(cars)) {
        if (typeof cars[drv].cum_time !== 'number') continue;
        const c = { id: `${g}|${drv}|${L + 1}`, gara: g, garaSim: MANIFEST[g], pilota: drv,
                    freezeLap: L, pitLap: L + 1, rientroLap: L + 2, nGiri: nLaps };
        const rv = vecchio(c), rn = nuovo(c);
        tot += 1;
        if (!rv.muto) cv += 1;
        if (!rn.muto) cn += 1;
        if (!rv.muto && rn.muto) { sv += 1; if (L + 1 <= 15) svPresto += 1; if (L + 1 <= 10) svPresto10 += 1; }
        if (rv.muto && !rn.muto) sn += 1;
        const f = L + 1 <= 5 ? '1-5' : L + 1 <= 10 ? '6-10' : L + 1 <= 15 ? '11-15' : L + 1 <= 20 ? '16-20' : L + 1 <= 30 ? '21-30' : L + 1 <= 40 ? '31-40' : '41-99';
        const r = perFascia.get(f) ?? { n: 0, v: 0, u: 0 };
        r.n += 1; if (!rv.muto) r.v += 1; if (!rn.muto) r.u += 1; perFascia.set(f, r);
        const rg = perGaraL.get(g) ?? { n: 0, v: 0, u: 0 };
        rg.n += 1; if (!rv.muto) rg.v += 1; if (!rn.muto) rg.u += 1; perGaraL.set(g, rg);
        void G;
      }
    }
  }
  void perGaraL;
  console.log(`    domande ${tot} [11.980] · vecchio ${cv} (${pct(cv, tot)}) [10.196 · 85.1%] · nuovo ${cn} (${pct(cn, tot)}) [10.315 · 86.1%]`);
  console.log(`    solo vecchio ${sv} [1.328] · solo nuovo ${sn} [1.447] · saldo ${cn - cv} [+119]`);
  console.log(`    dei persi, sosta <= giro 15: ${svPresto} (${pct(svPresto, sv)}) [1.299 · 97.8%] · <= giro 10: ${svPresto10} (${pct(svPresto10, sv)}) [1.122 · 84.5%]`);
  for (const f of ['1-5', '6-10', '11-15', '16-20', '21-30', '31-40', '41-99']) {
    const r = perFascia.get(f); if (!r) continue;
    console.log(`      ${f.padEnd(6)} ${String(r.n).padStart(5)}  vecchio ${pct(r.v, r.n).padStart(6)}  nuovo ${pct(r.u, r.n).padStart(6)}`);
  }
  console.log('    SALDO PER GARA (blocchi, E11):');
  let saldoSenzaMonaco = 0;
  for (const [g, r] of [...perGaraL.entries()].sort((a, b) => (b[1].u - b[1].v) - (a[1].u - a[1].v))) {
    if (g !== 'Monaco') saldoSenzaMonaco += r.u - r.v;
    console.log(`      ${g.padEnd(16)} ${String(r.n).padStart(5)}  saldo ${String(r.u - r.v).padStart(5)}`);
  }
  console.log(`    ⇒ saldo TOTALE ${cn - cv} · saldo SENZA Monaco ${saldoSenzaMonaco}`
    + ` · gare in cui il nuovo copre di piu': ${[...perGaraL.values()].filter((r) => r.u > r.v).length}/${perGaraL.size}`);
}

// —————————————————————————————————— V12 · il perimetro escluso e' neutro?
console.log('\n── V12 · I 140 DOPPIATI ESCLUSI: il perimetro nasconde una copertura? ─');
{
  let n = 0, v = 0, u = 0;
  for (const g of GARE) {
    const { byLap, nLaps } = DEMOGARA[g];
    const leader = {};
    for (let k = 1; k <= nLaps; k += 1) {
      if (!byLap[k]) continue;
      let m = Infinity;
      for (const d of Object.keys(byLap[k])) { const t = byLap[k][d].cum_time; if (typeof t === 'number' && t < m) m = t; }
      if (m < Infinity) leader[k] = m;
    }
    for (let Li = 4; Li <= nLaps; Li += 1) {
      const cars = byLap[Li]; if (!cars) continue;
      for (const drv of Object.keys(cars)) {
        if (cars[drv].in_lap !== true) continue;
        const L = Li - 1, Lo = Li + 1;
        if (typeof byLap[L]?.[drv]?.cum_time !== 'number') continue;
        const cumLo = byLap[Lo]?.[drv]?.cum_time;
        if (typeof cumLo !== 'number') continue;
        if (!(leader[Lo + 1] !== undefined && cumLo > leader[Lo + 1])) continue;  // SOLO i doppiati
        const c = { gara: g, garaSim: MANIFEST[g], pilota: drv, freezeLap: L, pitLap: Li, rientroLap: Lo, nGiri: nLaps };
        n += 1;
        if (!vecchio(c).muto) v += 1;
        if (!nuovo(c).muto) u += 1;
      }
    }
  }
  console.log(`    esclusi ${n} [140] · copertura VECCHIO ${pct(v, n)} · NUOVO ${pct(u, n)} · saldo ${u - v}`);
  console.log('    (dentro il perimetro il divario era 85.8% contro 94.9%: se qui fosse rovesciato,');
  console.log('     l\'esclusione sarebbe un filtro che favorisce un motore)');
}

console.log('\n═════════════════════════════════════════════════════════════════════');
console.log('FINE CONTROPERIZIA');
console.log('═════════════════════════════════════════════════════════════════════');
