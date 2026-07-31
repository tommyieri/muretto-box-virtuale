// verifica_M1a_adversariale.mjs — RIMISURA INDIPENDENTE DI M1a, con intento ostile.
//
//     node ai_lab/confronto/verifica_M1a_adversariale.mjs
//
// Non importa `banco.mjs` per il PERIMETRO ne' per la VERITA': li ricostruisce da
// demo/data/<gara>.json con codice proprio, e solo alla fine confronta l'elenco dei casi
// con quello del banco. Importa i due MOTORI (sono l'oggetto in prova) e costruisce i loro
// argomenti da capo, copiando gen_hero.mjs (vecchio) e genera_vista_gara.mjs (nuovo).
//
// COSA CERCA, una sezione per sospetto:
//   1  perimetro e verita' indipendenti      (casi filtrati per favorire un motore?)
//   2  M1 lettura A e B rimisurate           (numeri che il codice non produce?)
//   3  pos coerente con l'ordine dichiarato  (la lettura B misura la stessa cosa di A?)
//   4  i muti                                (errore 0? errore infinito? scarto asimmetrico?)
//   5  invarianza al troncamento del NUOVO   (fuga dal futuro)
//   6  il VECCHIO che sbircia (byLap intero) (il verdetto dipende dall'handicap?)
//   7  pit-loss scambiati                    (vince il motore o vince la sua tabella?)
//   8  la mescola muove la risposta?         (ingresso dal futuro travestito)
//   9  test di segno a DUE code + blocchi    (le p riportate sono a una coda)
//  10  lettura B: e' simmetrica?             (l'intersezione favorisce qualcuno?)
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

// il banco, importato SOLO per il confronto finale dell'elenco casi (sezione 1)
import { casi as casiDelBanco } from './banco.mjs';

const QUI = path.dirname(fileURLToPath(import.meta.url));
const RADICE = path.resolve(QUI, '..', '..');
const DEMO = path.join(RADICE, 'demo', 'data');
const SIM = path.join(RADICE, 'simulatore');

const GARE_SITO = ['Australia', 'Austria', 'Belgio', 'Canada', 'Cina', 'Giappone',
                   'Gran Bretagna', 'Miami', 'Monaco', 'Spagna', 'Ungheria'];
const SIM_DI = (g) => g.replace(/\s+/g, '');

const PITLOSS = JSON.parse(readFileSync(path.join(DEMO, 'pitloss.json'), 'utf8'));
const MP = JSON.parse(readFileSync(path.join(DEMO, 'modello_passo_2026.json'), 'utf8'));
const PASSO_V2 = { delta: MP.deriva.delta_gara_s, rho: MP.degrado.rho_s_giro };

// ————————————————————————————————————————————————————————————— statistica
const med = (v) => { if (!v.length) return null; const s = [...v].sort((a, b) => a - b); const m = s.length >> 1; return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; };
const avg = (v) => (v.length ? v.reduce((a, b) => a + b, 0) / v.length : null);
const p1 = (x) => (x === null ? '  — ' : `${(100 * x).toFixed(1)}%`);
const rias = (e) => { const a = e.map(Math.abs); return { n: e.length, med: med(a), media: avg(a), esatti: a.length ? a.filter((x) => x === 0).length / a.length : null, nEsatti: a.filter((x) => x === 0).length, entro1: a.length ? a.filter((x) => x <= 1).length / a.length : null, max: a.length ? Math.max(...a) : null, bias: avg(e) }; };
const riga = (et, x) => `  ${et.padEnd(26)} n=${String(x.n).padStart(3)}  mediana|e| ${x.med === null ? '—' : x.med.toFixed(1)}  media|e| ${x.media === null ? '—' : x.media.toFixed(2)}  esatti ${p1(x.esatti)} (${x.nEsatti})  entro1 ${p1(x.entro1)}  max ${x.max}  bias ${x.bias === null ? '—' : (x.bias >= 0 ? '+' : '') + x.bias.toFixed(3)}`;

// binomiale esatta, due code (metodo del punto minimo)
function binomDueCode(k, n) {
  if (n === 0) return 1;
  const lg = (m) => { let s = 0; for (let i = 2; i <= m; i += 1) s += Math.log(i); return s; };
  const lp = (i) => lg(n) - lg(i) - lg(n - i) + n * Math.log(0.5);
  const soglia = lp(k) + 1e-9;
  let s = 0;
  for (let i = 0; i <= n; i += 1) if (lp(i) <= soglia) s += Math.exp(lp(i));
  return Math.min(1, s);
}
function binomUnaCoda(k, n) {
  const lg = (m) => { let s = 0; for (let i = 2; i <= m; i += 1) s += Math.log(i); return s; };
  let s = 0;
  for (let i = k; i <= n; i += 1) s += Math.exp(lg(n) - lg(i) - lg(n - i) + n * Math.log(0.5));
  return Math.min(1, s);
}

// ============================================================================
// 1. PERIMETRO E VERITA', ricostruiti da capo
// ============================================================================
const ordinaPer = (cum) => (a, b) => (cum[a] - cum[b]) || (a < b ? -1 : a > b ? 1 : 0);

const fileGara = new Map();
function gaSito(g) {
  if (!fileGara.has(g)) fileGara.set(g, JSON.parse(readFileSync(path.join(DEMO, `${g}.json`), 'utf8')));
  return fileGara.get(g);
}

const CASI = [];
const CENS = { soste: 0, esc: { entro3: 0, senzaCumFreeze: 0, senzaGiroRientro: 0, senzaCumRientro: 0, doppiato: 0 }, perGara: {} };
for (const g of GARE_SITO) {
  const G = gaSito(g);
  const byLap = {};
  for (const l of G.laps) byLap[l.lap] = l.cars;
  const nLaps = G.n_laps;
  // tempo del leader a ogni giro
  const leader = {};
  for (let k = 1; k <= nLaps; k += 1) {
    if (!byLap[k]) continue;
    let m = Infinity;
    for (const d of Object.keys(byLap[k])) { const t = byLap[k][d].cum_time; if (typeof t === 'number' && t < m) m = t; }
    if (m < Infinity) leader[k] = m;
  }
  const esc = { entro3: 0, senzaCumFreeze: 0, senzaGiroRientro: 0, senzaCumRientro: 0, doppiato: 0 };
  let soste = 0, ammessi = 0;
  for (let Li = 1; Li <= nLaps; Li += 1) {
    if (!byLap[Li]) continue;
    for (const drv of Object.keys(byLap[Li])) {
      if (byLap[Li][drv].in_lap !== true) continue;
      soste += 1; CENS.soste += 1;
      const L = Li - 1, Lo = Li + 1;
      if (Li < 4) { esc.entro3 += 1; CENS.esc.entro3 += 1; continue; }
      if (typeof byLap[L]?.[drv]?.cum_time !== 'number') { esc.senzaCumFreeze += 1; CENS.esc.senzaCumFreeze += 1; continue; }
      if (!byLap[Lo]) { esc.senzaGiroRientro += 1; CENS.esc.senzaGiroRientro += 1; continue; }
      const cumLo = byLap[Lo][drv]?.cum_time;
      if (typeof cumLo !== 'number') { esc.senzaCumRientro += 1; CENS.esc.senzaCumRientro += 1; continue; }
      if (leader[Lo + 1] !== undefined && cumLo > leader[Lo + 1]) { esc.doppiato += 1; CENS.esc.doppiato += 1; continue; }
      const cum = {};
      for (const d of Object.keys(byLap[Lo])) { const t = byLap[Lo][d].cum_time; if (typeof t === 'number') cum[d] = t; }
      const ordine = Object.keys(cum).sort(ordinaPer(cum));
      CASI.push({
        id: `${g}|${drv}|${Li}`, gara: g, garaSim: SIM_DI(g), pilota: drv,
        L, Li, Lo, nLaps,
        vera: ordine.indexOf(drv) + 1, suVeri: ordine.length, ordineVero: ordine,
        regimeCella: byLap[L][drv].neutralized === true,
        mescolaFreeze: byLap[L][drv].compound ?? null,
        posFreeze: null,
      });
      ammessi += 1;
    }
  }
  // posizione al congelamento (per il taglio per fascia)
  for (const c of CASI.filter((x) => x.gara === g)) {
    const cumL = {};
    for (const d of Object.keys(byLap[c.L])) { const t = byLap[c.L][d].cum_time; if (typeof t === 'number') cumL[d] = t; }
    c.posFreeze = Object.keys(cumL).sort(ordinaPer(cumL)).indexOf(c.pilota) + 1;
  }
  CENS.perGara[g] = { soste, ammessi, ...esc };
}
CASI.sort((a, b) => (a.gara < b.gara ? -1 : a.gara > b.gara ? 1 : a.Li - b.Li || (a.pilota < b.pilota ? -1 : 1)));

console.log('VERIFICA ADVERSARIALE DI M1a — rimisura indipendente');
console.log('='.repeat(104));
console.log(`\n1. PERIMETRO RICOSTRUITO DA ZERO`);
console.log(`   soste reali (celle in_lap) ${CENS.soste} · escluse: entro il giro 3 ${CENS.esc.entro3} · senza cum al congelamento ${CENS.esc.senzaCumFreeze}`
  + ` · senza giro di rientro ${CENS.esc.senzaGiroRientro} · senza cum al rientro ${CENS.esc.senzaCumRientro} · doppiato al rientro ${CENS.esc.doppiato}`);
console.log(`   AMMESSI ${CASI.length}`);

// confronto con l'elenco del banco: stessi id, stessa verita'?
const delBanco = casiDelBanco();
const mioId = new Set(CASI.map((c) => c.id));
const suoId = new Set(delBanco.map((c) => c.id));
const soloMio = [...mioId].filter((x) => !suoId.has(x));
const soloSuo = [...suoId].filter((x) => !mioId.has(x));
const mappaMia = new Map(CASI.map((c) => [c.id, c]));
let veritaDiverse = 0;
const esVer = [];
for (const c of delBanco) {
  const m = mappaMia.get(c.id);
  if (!m) continue;
  if (m.vera !== c.posizioneVera || m.suVeri !== c.suQuantiVeri) { veritaDiverse += 1; if (esVer.length < 5) esVer.push(`${c.id} banco ${c.posizioneVera}/${c.suQuantiVeri} mio ${m.vera}/${m.suVeri}`); }
}
console.log(`   confronto con banco.mjs::casi(): solo-mio ${soloMio.length} · solo-banco ${soloSuo.length} · verita' divergenti ${veritaDiverse} ${esVer.join(' | ')}`);
console.log(`   esclusioni "doppiato al rientro" per gara: ` + GARE_SITO.map((g) => `${g.slice(0, 3)} ${CENS.perGara[g].doppiato}/${CENS.perGara[g].soste}`).join(' · '));

// ============================================================================
// 2. I DUE MOTORI, argomenti costruiti da capo
// ============================================================================
const MIN_SOSTE_UI = 3, ZONE = 0;

const cacheByLap = new Map();
function datiVec(g) {
  if (cacheByLap.has(g)) return cacheByLap.get(g);
  const G = gaSito(g);
  const byLap = {};
  for (const l of G.laps) byLap[l.lap] = l.cars;
  const v = { G, byLap, nLaps: G.n_laps, pitLoss: PITLOSS[g] };
  cacheByLap.set(g, v);
  return v;
}
const tronca = (byLap, L) => { const t = {}; for (let k = 1; k <= L; k += 1) if (byLap[k]) t[k] = byLap[k]; return t; };

/** Il VECCHIO, argomenti come gen_hero.mjs (unica variazione dichiarata: orizzonte). */
function vecchio(c, { troncato = true, orizzonte = 0, passo = null, pitLossOverride = null } = {}) {
  const { G, byLap, nLaps, pitLoss } = datiVec(c.gara);
  const bl = troncato ? tronca(byLap, c.L) : byLap;
  const pace = G.pace[String(c.L)] || {};
  const present = G.drivers.filter((d) => typeof bl[c.L]?.[d]?.cum_time === 'number' && pace[d] != null);
  const viva = misuraGradino(bl, nLaps, c.L);
  const grad = (viva.gradino != null && viva.n_gradino >= MIN_SOSTE_UI) ? viva.gradino : null;
  let r;
  try {
    r = evaluatePit({ byLap: bl, nLaps, pace, driver: c.pilota, freezeLap: c.L, pitLap: c.Li,
                      pitLoss: pitLossOverride ?? pitLoss, present, gara: c.gara, laps: G.laps,
                      ZONE, orizzonte, gradino: passo ? null : grad, passo });
  } catch (e) { return { muto: true, motivo: `eccezione ${e.message}` }; }
  if (!r || r.ok !== true) return { muto: true, motivo: r?.reason ?? 'nessuna risposta' };
  return { muto: false, pos: r.rientro_pos, su: r.su_totale, ordine: r.ordine_previsto.map((x) => x[0]), grad };
}

// contesto del NUOVO, come genera_vista_gara.mjs
const gareSim = caricaGare2026(SIM);
const modello = JSON.parse(readFileSync(path.join(SIM, 'data', 'modelli', 'modello_v2.json'), 'utf8'));
const prior = caricaPrior(SIM);
const costantiDirector = caricaCostanti(SIM);
const bandaRientro = JSON.parse(readFileSync(path.join(SIM, 'data', 'modelli', 'banda_rientro.json'), 'utf8'));
const CTX = { gare: gareSim, modello, prior, costantiDirector, bandaRientro, nGiriGara: null };

function nuovo(c, { gareAlt = null, mescolaAlt = null, priorAlt = null } = {}) {
  const gs = gareAlt ?? gareSim;
  const g = gs[c.garaSim];
  const cella = g.perPilota.get(c.pilota)?.get(c.L);
  const mescola = mescolaAlt ?? (cella && MESCOLE_SLICK.has(cella.compound) ? cella.compound : null);
  if (mescola === null) return { muto: true, motivo: 'mescola non slick al congelamento' };
  const ctx = { ...CTX, gare: gs, prior: priorAlt ?? prior, nGiriGara: gareSim[c.garaSim].nGiri };
  let r;
  try {
    r = doveRientri({ gara: c.garaSim, freezeLap: c.L, pilota: c.pilota, giroPit: c.Li, mescola }, ctx);
  } catch (e) { return { muto: true, motivo: `eccezione ${e.message}` }; }
  if (!r || r.approvato !== true) return { muto: true, motivo: 'respinto dal Director' };
  if (r.posizione === null || r.posizione === undefined) return { muto: true, motivo: 'nessuna posizione (regola 6)' };
  // ordine al giro di rientro dalla traccia
  let ordine = null;
  if (r.traccia) {
    const cum = {};
    for (const [d, passi] of Object.entries(r.traccia)) {
      const p = passi?.find((x) => x.lap === c.Lo);
      if (p && p.cum_time !== null && p.cum_time !== undefined) cum[d] = p.cum_time;
    }
    ordine = Object.keys(cum).sort(ordinaPer(cum));
  }
  return { muto: false, pos: r.posizione, su: r.su_quanti, ordine,
           banda: r.banda_posizione, perdita: r.perdita?.perdita ?? null };
}

// lettura B: ri-classificazione sull'intersezione delle TRE popolazioni
function letturaB(c, ov, on) {
  if (!ov || !on) return null;
  const sv = new Set(ov), sn = new Set(on);
  const comune = c.ordineVero.filter((d) => sv.has(d) && sn.has(d));
  if (!comune.includes(c.pilota)) return null;
  const S = new Set(comune);
  const rango = (l) => l.filter((d) => S.has(d)).indexOf(c.pilota) + 1;
  return { su: comune.length, vero: rango(c.ordineVero), v: rango(ov), n: rango(on) };
}

const R = [];
for (const c of CASI) {
  const v = vecchio(c);
  const n = nuovo(c);
  const B = (!v.muto && !n.muto) ? letturaB(c, v.ordine, n.ordine) : null;
  R.push({ c, v, n, B,
    eAv: v.muto ? null : v.pos - c.vera,
    eAn: n.muto ? null : n.pos - c.vera,
    eBv: B ? B.v - B.vero : null,
    eBn: B ? B.n - B.vero : null });
}
const COM = R.filter((r) => !r.v.muto && !r.n.muto);

console.log(`\n2. M1 RIMISURATA (codice mio, argomenti costruiti da capo)`);
console.log(`   muti: vecchio ${R.filter((r) => r.v.muto).length}/${R.length} · nuovo ${R.filter((r) => r.n.muto).length}/${R.length}`
  + ` · entrambi ${R.filter((r) => r.v.muto && r.n.muto).length} · CASI COMUNI ${COM.length}`);
const Av = rias(COM.map((r) => r.eAv)), An = rias(COM.map((r) => r.eAn));
const Bv = rias(COM.filter((r) => r.B).map((r) => r.eBv)), Bn = rias(COM.filter((r) => r.B).map((r) => r.eBn));
console.log(riga('A vecchio', Av));
console.log(riga('A nuovo', An));
console.log(riga('B vecchio', Bv));
console.log(riga('B nuovo', Bn));
const cancello = (V, N) => (N.med <= V.med && N.esatti >= V.esatti);
console.log(`   CANCELLO M1 — A: ${cancello(Av, An) ? 'PASSA' : 'NON PASSA'} · B: ${cancello(Bv, Bn) ? 'PASSA' : 'NON PASSA'}`);

// ============================================================================
// 3. pos coerente con l'ordine dichiarato?
// ============================================================================
let incoV = 0, incoN = 0, senzaOrdineN = 0, nV = 0, nN = 0;
const esInco = [];
for (const r of R) {
  if (!r.v.muto) { nV += 1; if (r.v.ordine.indexOf(r.c.pilota) + 1 !== r.v.pos || r.v.ordine.length !== r.v.su) incoV += 1; }
  if (!r.n.muto) {
    nN += 1;
    if (!r.n.ordine) { senzaOrdineN += 1; continue; }
    if (r.n.ordine.indexOf(r.c.pilota) + 1 !== r.n.pos || r.n.ordine.length !== r.n.su) {
      incoN += 1;
      if (esInco.length < 5) esInco.push(`${r.c.id}: pos ${r.n.pos}/${r.n.su} ma nell'ordine ${r.n.ordine.indexOf(r.c.pilota) + 1}/${r.n.ordine.length}`);
    }
  }
}
console.log(`\n3. pos COERENTE CON L'ORDINE (se no, A e B non misurano la stessa cosa)`);
console.log(`   vecchio incoerenti ${incoV}/${nV} · nuovo incoerenti ${incoN}/${nN} (senza ordine ${senzaOrdineN}) ${esInco.join(' | ')}`);

// ============================================================================
// 4. I MUTI: entrano da qualche parte come numero?
// ============================================================================
const soloV = R.filter((r) => !r.v.muto && r.n.muto);
const soloN = R.filter((r) => r.v.muto && !r.n.muto);
console.log(`\n4. I MUTI`);
console.log(`   solo il vecchio risponde ${soloV.length}: ` + riga('', rias(soloV.map((r) => r.eAv))).trim());
console.log(`   solo il nuovo risponde   ${soloN.length}: ` + riga('', rias(soloN.map((r) => r.eAn))).trim());
console.log(`   controllo: nessun errore calcolato su una risposta muta → ${R.every((r) => (r.v.muto ? r.eAv === null : true) && (r.n.muto ? r.eAn === null : true))}`);
console.log(`   controllo: i due riassunti pooled girano sullo STESSO insieme → n(A vecchio)=${Av.n} n(A nuovo)=${An.n} n(B vecchio)=${Bv.n} n(B nuovo)=${Bn.n}`);
const motivi = (l, k) => { const h = new Map(); for (const r of l) h.set(r[k].motivo, (h.get(r[k].motivo) ?? 0) + 1); return [...h.entries()]; };
console.log(`   motivi vecchio: ${JSON.stringify(motivi(R.filter((r) => r.v.muto), 'v'))}`);
console.log(`   motivi nuovo:   ${JSON.stringify(motivi(R.filter((r) => r.n.muto), 'n'))}`);

// ============================================================================
// 5. INVARIANZA AL TRONCAMENTO DEL MOTORE NUOVO (fuga dal futuro)
// ============================================================================
function garaTroncata(garaSim, L) {
  const g = gareSim[garaSim];
  const righe = g.righe.filter((r) => r.lap <= L);
  const perPilota = new Map();
  for (const [d, celle] of g.perPilota) perPilota.set(d, new Map([...celle].filter(([lap]) => lap <= L)));
  return { ...g, righe, perPilota, nGiri: L };
}
let provati = 0, diversi = 0, mutiDiversi = 0;
const esTronc = [];
for (const r of COM) {
  const alt = { ...gareSim, [r.c.garaSim]: garaTroncata(r.c.garaSim, r.c.L) };
  const t = nuovo(r.c, { gareAlt: alt });
  provati += 1;
  if (t.muto !== r.n.muto) { mutiDiversi += 1; continue; }
  if (!t.muto && (t.pos !== r.n.pos || t.su !== r.n.su)) {
    diversi += 1;
    if (esTronc.length < 5) esTronc.push(`${r.c.id}: intero P${r.n.pos}/${r.n.su} → troncato P${t.pos}/${t.su}`);
  }
}
console.log(`\n5. INVARIANZA AL TRONCAMENTO DEL NUOVO (dati oltre il congelamento cancellati)`);
console.log(`   ${provati} casi provati · risposte diverse ${diversi} · muti diversi ${mutiDiversi} ${esTronc.join(' | ')}`);

// ============================================================================
// 6. IL VECCHIO CHE SBIRCIA (byLap intero, stesso giro di risposta)
// ============================================================================
const VI = COM.map((r) => vecchio(r.c, { troncato: false }));
const comInt = COM.filter((_, i) => !VI[i].muto);
const eInt = comInt.map((r, i) => 0);
const eIntero = [];
const eNuovoSuInt = [];
for (let i = 0; i < COM.length; i += 1) {
  if (VI[i].muto) continue;
  eIntero.push(VI[i].pos - COM[i].c.vera);
  eNuovoSuInt.push(COM[i].eAn);
}
const Ai = rias(eIntero), Ani = rias(eNuovoSuInt);
console.log(`\n6. IL VECCHIO CON byLap INTERO (legge il futuro: e' il vecchio in condizioni MIGLIORI del banco)`);
console.log(riga('A vecchio-intero', Ai));
console.log(riga('A nuovo (stessi casi)', Ani));
console.log(`   cancello M1 lettura A contro il vecchio-che-sbircia: ${cancello(Ai, Ani) ? 'PASSA' : 'NON PASSA'}`);
let posCambia = 0, suCambia = 0;
for (let i = 0; i < COM.length; i += 1) {
  if (VI[i].muto) continue;
  if (VI[i].pos !== COM[i].v.pos) posCambia += 1;
  if (VI[i].su !== COM[i].v.su) suCambia += 1;
}
console.log(`   il troncamento cambia la posizione in ${posCambia}/${eIntero.length} casi e il campo in ${suCambia}/${eIntero.length}`);

// ============================================================================
// 7. PIT-LOSS SCAMBIATI — vince il motore o vince la sua tabella?
// ============================================================================
// Al vecchio si da' il pit-loss VERDE che il nuovo usa (prior di circuito), lasciando
// tutto il resto identico. Non e' un nuovo cancello: e' la domanda "quanto dello scarto
// e' tabella".
const perditaNuovoPerGara = {};
for (const g of GARE_SITO) {
  const c = COM.find((r) => r.c.gara === g);
  if (c) perditaNuovoPerGara[g] = c.n.perdita;
}
const eSwap = [];
for (const r of COM) {
  const pl = perditaNuovoPerGara[r.c.gara];
  const v2 = vecchio(r.c, { pitLossOverride: pl });
  eSwap.push(v2.muto ? null : v2.pos - r.c.vera);
}
const Asw = rias(eSwap.filter((x) => x !== null));
console.log(`\n7. PIT-LOSS SCAMBIATO (al vecchio la perdita del nuovo)`);
console.log('   ' + GARE_SITO.map((g) => `${g.slice(0, 3)} ${PITLOSS[g]}→${(perditaNuovoPerGara[g] ?? NaN).toFixed(2)}`).join(' · '));
console.log(riga('A vecchio (pitloss nuovo)', Asw));
console.log(riga('A vecchio (pitloss suo)', Av));

// ============================================================================
// 8. LA MESCOLA MUOVE LA RISPOSTA DEL NUOVO?
// ============================================================================
let mescCambia = 0, mescProvati = 0;
for (const r of COM.slice(0, 80)) {
  const alt = r.c.mescolaFreeze === 'HARD' ? 'SOFT' : 'HARD';
  const t = nuovo(r.c, { mescolaAlt: alt });
  mescProvati += 1;
  if (t.muto !== r.n.muto || (!t.muto && (t.pos !== r.n.pos || t.su !== r.n.su))) mescCambia += 1;
}
console.log(`\n8. LA MESCOLA: su ${mescProvati} casi, cambiandola la risposta cambia in ${mescCambia}`);

// ============================================================================
// 9. TEST DI SEGNO A DUE CODE, e per blocchi (gare)
// ============================================================================
const testa = (kv, kn, sub = COM) => { let v = 0, n = 0, pari = 0; for (const r of sub) { if (r[kv] === null || r[kn] === null) continue; const a = Math.abs(r[kv]), b = Math.abs(r[kn]); if (b < a) n += 1; else if (a < b) v += 1; else pari += 1; } return { n, v, pari }; };
const tA = testa('eAv', 'eAn'), tB = testa('eBv', 'eBn');
console.log(`\n9. TEST DI SEGNO`);
console.log(`   A: nuovo ${tA.n} · vecchio ${tA.v} · pari ${tA.pari}  → p una coda ${binomUnaCoda(tA.n, tA.n + tA.v).toFixed(3)} · p DUE code ${binomDueCode(tA.n, tA.n + tA.v).toFixed(3)}`);
console.log(`   B: nuovo ${tB.n} · vecchio ${tB.v} · pari ${tB.pari}  → p una coda ${binomUnaCoda(tB.n, tB.n + tB.v).toFixed(3)} · p DUE code ${binomDueCode(tB.n, tB.n + tB.v).toFixed(3)}`);
// per gara
const perGara = GARE_SITO.map((g) => {
  const d = COM.filter((r) => r.c.gara === g);
  const a = rias(d.map((r) => r.eAv)), b = rias(d.map((r) => r.eAn));
  const bv = rias(d.filter((r) => r.B).map((r) => r.eBv)), bn = rias(d.filter((r) => r.B).map((r) => r.eBn));
  return { g, n: d.length, av: a, an: b, bv, bn };
});
const vinteA = perGara.filter((p) => p.n && p.an.esatti > p.av.esatti).length;
const perseA = perGara.filter((p) => p.n && p.an.esatti < p.av.esatti).length;
const vinteB = perGara.filter((p) => p.n && p.bn.esatti > p.bv.esatti).length;
const perseB = perGara.filter((p) => p.n && p.bn.esatti < p.bv.esatti).length;
console.log(`   per gara (esatti) A: ${vinteA} vinte / ${perseA} perse → p due code ${binomDueCode(Math.max(vinteA, perseA), vinteA + perseA).toFixed(3)} (una coda ${binomUnaCoda(vinteA, vinteA + perseA).toFixed(3)})`);
console.log(`   per gara (esatti) B: ${vinteB} vinte / ${perseB} perse → p due code ${binomDueCode(Math.max(vinteB, perseB), vinteB + perseB).toFixed(3)} (una coda ${binomUnaCoda(vinteB, vinteB + perseB).toFixed(3)})`);
console.log(`   media NON pesata delle quote-esatti per gara — A ${p1(avg(perGara.filter((p) => p.n).map((p) => p.av.esatti)))} → ${p1(avg(perGara.filter((p) => p.n).map((p) => p.an.esatti)))}`
  + ` · B ${p1(avg(perGara.filter((p) => p.n).map((p) => p.bv.esatti)))} → ${p1(avg(perGara.filter((p) => p.n).map((p) => p.bn.esatti)))}`);

// ============================================================================
// 10. LETTURA B: E' SIMMETRICA?
// ============================================================================
// L'intersezione parte dall'ordine VERO e tiene chi c'e' in tutti e tre. Controprova:
// quante sigle perde ciascun motore, e cosa succede se si prende l'intersezione delle sole
// DUE previsioni (senza filtrare sulla verita').
let persePerV = 0, persePerN = 0;
for (const r of COM) {
  if (!r.B) continue;
  const sv = new Set(r.v.ordine), sn = new Set(r.n.ordine);
  persePerV += r.c.ordineVero.filter((d) => !sv.has(d)).length;
  persePerN += r.c.ordineVero.filter((d) => !sn.has(d)).length;
}
console.log(`\n10. LETTURA B — sigle della verita' assenti dalla previsione: vecchio ${persePerV} · nuovo ${persePerN} (su ${COM.filter((r) => r.B).length} casi)`);
console.log(`    casi persi dalla lettura B (pilota fuori dall'intersezione): ${COM.filter((r) => !r.B).length}`);

// contro-lettura C: rango solo fra chi e' presente in ENTRAMBE le previsioni e nella verita',
// ma partendo dall'ordine di ciascun motore invece che dalla verita' (deve dare lo stesso)
let diffC = 0;
for (const r of COM) {
  if (!r.B) continue;
  const sv = new Set(r.v.ordine), sn = new Set(r.n.ordine), sT = new Set(r.c.ordineVero);
  const S = new Set(r.v.ordine.filter((d) => sn.has(d) && sT.has(d)));
  const rg = (l) => l.filter((d) => S.has(d)).indexOf(r.c.pilota) + 1;
  if (rg(r.c.ordineVero) !== r.B.vero || rg(r.v.ordine) !== r.B.v || rg(r.n.ordine) !== r.B.n) diffC += 1;
}
console.log(`    contro-lettura (intersezione costruita partendo dal vecchio): divergenze ${diffC}`);

// ============================================================================
// 11. TABELLA PER GARA (blocchi)
// ============================================================================
console.log(`\n11. PER GARA`);
console.log('    gara              n  | A mediana v→n   esatti v→n     | B mediana v→n   esatti v→n');
for (const p of perGara) {
  if (!p.n) continue;
  console.log(`    ${p.g.padEnd(16)} ${String(p.n).padStart(3)} |  ${p.av.med.toFixed(1)}→${p.an.med.toFixed(1)}    ${p1(p.av.esatti)}→${p1(p.an.esatti)}  |  ${p.bv.med.toFixed(1)}→${p.bn.med.toFixed(1)}    ${p1(p.bv.esatti)}→${p1(p.bn.esatti)}`);
}
