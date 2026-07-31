// verifica_M1b_controprova.mjs — CONTROPROVA ADVERSARIALE della misura M1b.
//
// Compito: PROVARE CHE M1b SI SBAGLIA. Se non ci riesco, dirlo.
//
// Metodo: NON importo `metrica_M1b.mjs`. Ricostruisco da capo perimetro, verita' e le due
// chiamate ai motori importando direttamente i motori
//     demo/pitscenario.mjs::evaluatePit                (vecchio)
//     simulatore/scenario/costruttore.mjs::doveRientri  (nuovo)
// e SOLO ALLA FINE confronto caso per caso con `banco.mjs`, per dire dove il mio conto e il
// suo divergono. Se il banco truccasse gli ingressi, il confronto caso-per-caso lo direbbe.
//
// I sospetti che vado a cercare, uno per sezione:
//   C1  il PERIMETRO e' quello dichiarato (274 casi, esclusioni)? lo ricostruisco.
//   C2  la VERITA' regge da una FONTE DIVERSA (il grezzo del simulatore, non demo/data)?
//   C3  i due motori ricevono davvero lo STESSO caso? (freeze, pit, giro di risposta,
//       pit-loss, ampiezza del campo) — e le mie chiamate dirette danno le stesse risposte
//       del banco?
//   C4  FUGA DAL FUTURO: prova di MUTAZIONE. Sporco tutte le celle con lap > freezeLap e
//       guardo se la risposta cambia. Se cambia, quel motore ha letto il futuro.
//   C5  i MUTI: sono esclusi, o contati come errore 0 / errore massimo? E quanto cambia
//       il verdetto sotto le tre convenzioni?
//   C6  M1 nelle tre letture, ricalcolata con codice mio.
//   C7  FRAGILITA' del cancello: quanti casi devono cambiare perche' cada? e
//       leave-one-race-out (blocchi = gare).
//   C8  DA DOVE VIENE lo scarto della lettura A: identita' algebrica errA = errB − k,
//       con k = quanti piloti davanti nella verita' mancano dal campo del motore.
//   C9  significativita' con statistica MIA: binomiale esatta in BigInt (niente logaritmi)
//       e bootstrap a blocchi con RNG e semi DIVERSI da quelli dell'altro agente.
//   C10 il vecchio NON troncato (cio' che gira in produzione): il verdetto si ribalta?
//   C11 le affermazioni collaterali del referto, una per una.
//
// Non scrive niente su disco. Non tocca demo/, simulatore/, data/. Nessun git.
//   node ai_lab/confronto/verifica_M1b_controprova.mjs

import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { evaluatePit } from '../../demo/pitscenario.mjs';
import { misura as misuraGradino } from '../../demo/gradino.mjs';
import { caricaGare2026 } from '../../simulatore/provenienza/gare_2026.mjs';
import { caricaPrior } from '../../simulatore/provenienza/pitloss_dati.mjs';
import { caricaCostanti } from '../../simulatore/scenario/director_dati.mjs';
import { doveRientri } from '../../simulatore/scenario/costruttore.mjs';
import { indicizza } from '../../simulatore/provenienza/gare_indice.mjs';
import { perditaBox } from '../../simulatore/provenienza/pitloss.mjs';
import { MESCOLE_SLICK } from '../../simulatore/provenienza/vocabolario.mjs';

const QUI = path.dirname(fileURLToPath(import.meta.url));
const RADICE = path.resolve(QUI, '..', '..');
const DEMO_DATA = path.join(RADICE, 'demo', 'data');
const SIM = path.join(RADICE, 'simulatore');

// parametri del vecchio: gli stessi che dichiara il banco (copiati da gen_hero.mjs, con
// ORIZZONTE = 0 perche' la risposta deve cadere sul giro di rientro)
const MIN_SOSTE_UI = 3;
const ZONE = 0;
const ORIZZONTE = 0;
const PRIMO_GIRO_AMMESSO = 4;

const log = (...a) => console.log(...a);
const f1 = (x) => (x === null || x === undefined ? '  — ' : x.toFixed(1));
const f2 = (x) => (x === null || x === undefined ? '  — ' : x.toFixed(2));
const f3 = (x) => (x === null || x === undefined ? '  — ' : x.toFixed(3));

// ───────────────────────────────────────────────── statistica, scritta da me
const mediana = (v) => {
  if (!v.length) return null;
  const s = [...v].sort((a, b) => a - b);
  const m = s.length >> 1;
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};
const media = (v) => (v.length ? v.reduce((a, b) => a + b, 0) / v.length : null);
const pct = (k, n) => (n ? (100 * k) / n : null);

function riassunto(err) {
  const abs = err.map(Math.abs);
  const n = abs.length;
  return {
    n,
    med: mediana(abs), avg: media(abs),
    esatti: abs.filter((e) => e === 0).length,
    entro1: abs.filter((e) => e <= 1).length,
    entro2: abs.filter((e) => e <= 2).length,
    q_esatti: pct(abs.filter((e) => e === 0).length, n),
    q_entro1: pct(abs.filter((e) => e <= 1).length, n),
    bias_med: mediana(err), bias_avg: media(err),
    max: n ? Math.max(...abs) : null,
  };
}
const cancello = (V, N) => ({
  med: N.med <= V.med, esatti: N.q_esatti >= V.q_esatti,
  passa: N.med <= V.med && N.q_esatti >= V.q_esatti,
});

// binomiale a due code ESATTA in BigInt: niente logaritmi, niente somme di esponenziali
function binomialeEsatta(k, n) {
  if (!n) return null;
  const C = [];
  { let c = 1n; for (let i = 0; i <= n; i += 1) { C.push(c); c = (c * BigInt(n - i)) / BigInt(i + 1); } }
  const tot = 1n << BigInt(n);
  const soglia = C[k];
  let s = 0n;
  for (let i = 0; i <= n; i += 1) if (C[i] <= soglia) s += C[i];
  // rapporto esatto -> Number
  return Number((s * 1000000n) / tot) / 1000000;
}

// RNG DIVERSO da quello dell'altro agente (lui: xorshift32 seme 20260731).
// mulberry32, seme 424242 — se lo scarto e' vero non deve dipendere dal generatore.
function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const ordina = (cum) => (a, b) => (cum[a] - cum[b]) || (a < b ? -1 : b < a ? 1 : 0);

// ═══════════════════════════════════════════════════════════════ C1 · PERIMETRO
// Ricostruito da capo leggendo demo/data/<gara>.json con codice mio.
const manifest = JSON.parse(readFileSync(path.join(DEMO_DATA, 'vista', 'manifest.json'), 'utf8'));
const SITO2SIM = { ...manifest.cartella_di };
const GARE = Object.keys(SITO2SIM).sort();
const PITLOSS_DEMO = JSON.parse(readFileSync(path.join(DEMO_DATA, 'pitloss.json'), 'utf8'));

const demo = {};
for (const g of GARE) {
  const G = JSON.parse(readFileSync(path.join(DEMO_DATA, `${g}.json`), 'utf8'));
  const byLap = {};
  for (const l of G.laps) byLap[l.lap] = l.cars;
  demo[g] = { G, byLap, nLaps: G.n_laps };
}

const gareSim = caricaGare2026(SIM);
const modello = JSON.parse(readFileSync(path.join(SIM, 'data', 'modelli', 'modello_v2.json'), 'utf8'));
const prior = caricaPrior(SIM);
const costantiDirector = caricaCostanti(SIM);
const bandaRientro = JSON.parse(readFileSync(path.join(SIM, 'data', 'modelli', 'banda_rientro.json'), 'utf8'));
const CTX = { gare: gareSim, modello, prior, costantiDirector, bandaRientro, nGiriGara: null };
const ctxDi = (g) => ({ ...CTX, nGiriGara: gareSim[SITO2SIM[g]].nGiri });

const esclusi = { pit_entro_3: 0, senza_cum_al_congelamento: 0, senza_giro_di_rientro: 0, senza_cum_al_rientro: 0, doppiato_al_rientro: 0 };
let sosteTrovate = 0;
const CASI = [];

for (const g of GARE) {
  const { G, byLap, nLaps } = demo[g];
  const leaderCum = {};
  for (let k = 1; k <= nLaps; k += 1) {
    if (!byLap[k]) continue;
    let m = Infinity;
    for (const d of Object.keys(byLap[k])) { const t = byLap[k][d].cum_time; if (typeof t === 'number' && t < m) m = t; }
    if (m < Infinity) leaderCum[k] = m;
  }
  const doppiato = (Lo, cum) => leaderCum[Lo + 1] !== undefined && cum > leaderCum[Lo + 1];
  const daQui = [];
  for (let Li = 1; Li <= nLaps; Li += 1) {
    if (!byLap[Li]) continue;
    for (const pilota of Object.keys(byLap[Li])) {
      if (byLap[Li][pilota].in_lap !== true) continue;
      sosteTrovate += 1;
      const L = Li - 1, Lo = Li + 1;
      if (Li < PRIMO_GIRO_AMMESSO) { esclusi.pit_entro_3 += 1; continue; }
      if (typeof byLap[L]?.[pilota]?.cum_time !== 'number') { esclusi.senza_cum_al_congelamento += 1; continue; }
      if (!byLap[Lo]) { esclusi.senza_giro_di_rientro += 1; continue; }
      const cumLo = byLap[Lo][pilota]?.cum_time;
      if (typeof cumLo !== 'number') { esclusi.senza_cum_al_rientro += 1; continue; }
      if (doppiato(Lo, cumLo)) { esclusi.doppiato_al_rientro += 1; continue; }
      const cum = {};
      for (const d of Object.keys(byLap[Lo])) { const t = byLap[Lo][d].cum_time; if (typeof t === 'number') cum[d] = t; }
      const ordineVero = Object.keys(cum).sort(ordina(cum));
      daQui.push({
        id: `${g}|${pilota}|${Li}`, gara: g, garaSim: SITO2SIM[g], pilota,
        L, Li, Lo, nLaps,
        vera: ordineVero.indexOf(pilota) + 1, suVeri: ordineVero.length, ordineVero,
        mescolaL: byLap[L][pilota].compound ?? null,
        neutrL: byLap[L][pilota].neutralized === true,
        neutrPit: byLap[Li][pilota].neutralized === true,
        passoDemoDisponibile: G.pace[String(L)]?.[pilota] != null,
      });
    }
  }
  daQui.sort((a, b) => a.Li - b.Li || (a.pilota < b.pilota ? -1 : 1));
  CASI.push(...daQui);
}

log('CONTROPROVA ADVERSARIALE M1b — ricostruita da zero, senza importare metrica_M1b.mjs\n');
log('═══ C1 · PERIMETRO ricostruito da capo ═══');
log(`  soste reali trovate (celle con in_lap) : ${sosteTrovate}   [referto: 459]`);
for (const [k, v] of Object.entries(esclusi)) log(`  escluse · ${k.padEnd(28)}: ${v}`);
log(`  CASI AMMESSI                           : ${CASI.length}   [referto: 274]`);
const C1_OK = CASI.length === 274 && sosteTrovate === 459 && esclusi.pit_entro_3 === 22
  && esclusi.senza_cum_al_rientro === 23 && esclusi.doppiato_al_rientro === 140;
log(`  → ${C1_OK ? 'COINCIDE col referto' : 'NON COINCIDE col referto'}`);

// ═════════════════════════════════════════════ C2 · VERITA' DA UNA FONTE DIVERSA
// Il referto ricalcola la verita' da demo/data (la stessa fonte del banco). Io la ricalcolo
// dal GREZZO DEL SIMULATORE, che e' l'altra fonte: se le due divergessero, la verita'
// dipenderebbe da quale file si legge.
let vcSim = 0, vcDivPos = 0, vcDivSu = 0, vcSenza = 0;
const esempiV = [];
for (const c of CASI) {
  const gS = gareSim[c.garaSim];
  const cum = {};
  for (const [drv, celle] of gS.perPilota) {
    const cella = celle.get(c.Lo);
    if (cella && typeof cella.cum_time === 'number') cum[drv] = cella.cum_time;
  }
  const ord = Object.keys(cum).sort(ordina(cum));
  const i = ord.indexOf(c.pilota);
  vcSim += 1;
  if (i < 0) { vcSenza += 1; continue; }
  if (i + 1 !== c.vera) { vcDivPos += 1; if (esempiV.length < 6) esempiV.push({ id: c.id, demo: c.vera, simulatore: i + 1 }); }
  if (ord.length !== c.suVeri) vcDivSu += 1;
}
log('\n═══ C2 · LA VERITA\' DA UNA FONTE DIVERSA (grezzo del simulatore, non demo/data) ═══');
log(`  casi confrontati ${vcSim} · divergenze di POSIZIONE ${vcDivPos} · divergenze di AMPIEZZA ${vcDivSu} · pilota assente ${vcSenza}`);
if (esempiV.length) log(`  esempi: ${JSON.stringify(esempiV)}`);

// ══════════════════════════════════════════ le mie chiamate dirette ai due motori
function mioVecchio(c, { troncato = true, orizzonte = ORIZZONTE, pitLap = null, gara = null, sporcaFuturo = false } = {}) {
  const { G, byLap, nLaps } = demo[c.gara];
  const L = c.L;
  let bl;
  if (troncato) { bl = {}; for (let k = 1; k <= L; k += 1) if (byLap[k]) bl[k] = byLap[k]; }
  else if (sporcaFuturo) {
    bl = {};
    for (const k of Object.keys(byLap)) {
      const n = Number(k);
      if (n <= L) { bl[n] = byLap[n]; continue; }
      const cars = {};
      for (const d of Object.keys(byLap[n])) {
        const o = byLap[n][d];
        cars[d] = { ...o, cum_time: typeof o.cum_time === 'number' ? o.cum_time + 997 : o.cum_time,
                    lap_time: typeof o.lap_time === 'number' ? o.lap_time + 37 : o.lap_time,
                    neutralized: !o.neutralized, stint: 9, tyre_age: 41, in_lap: false, out_lap: false };
      }
      bl[n] = cars;
    }
  } else bl = byLap;
  const pace = G.pace[String(L)] || {};
  const present = G.drivers.filter((d) => typeof bl[L]?.[d]?.cum_time === 'number' && pace[d] != null);
  const viva = misuraGradino(bl, nLaps, L);
  const gradino = (viva.gradino != null && viva.n_gradino >= MIN_SOSTE_UI) ? viva.gradino : null;
  let r;
  try {
    r = evaluatePit({ byLap: bl, nLaps, pace, driver: c.pilota, freezeLap: L,
                      pitLap: pitLap ?? c.Li, pitLoss: PITLOSS_DEMO[c.gara], present,
                      gara: gara === null ? c.gara : gara, laps: G.laps, ZONE, orizzonte, gradino });
  } catch (e) { return { ok: false, motivo: `eccezione: ${e.message}`, pos: null, su: null, ordine: null, gradino }; }
  if (!r || r.ok !== true) return { ok: false, motivo: r?.reason ?? 'nessuna risposta', pos: null, su: null, ordine: null, gradino };
  return { ok: true, motivo: null, pos: r.rientro_pos, su: r.su_totale,
           ordine: r.ordine_previsto.map((x) => x[0]), gradino, nGradino: viva.n_gradino,
           sottoNeutr: r.sotto_neutralizzazione, rivali: r.soste_rivali_assunte };
}

function sporcaCella(cella) {
  return { ...cella,
    lap_time: typeof cella.lap_time === 'number' ? cella.lap_time + 47.5 : 88.8,
    cum_time: typeof cella.cum_time === 'number' ? cella.cum_time + 1234.5 : 9999,
    stint: 9, compound: 'HARD', tyre_age: 44, in_lap: false, out_lap: false, status: '2', del: true };
}
function garaSporcata(gS, freezeLap) {
  const righe = gS.righe.map(({ drv, lap, cella }) => ({ drv, lap, cella: lap <= freezeLap ? cella : sporcaCella(cella) }));
  return { ...gS, ...indicizza(righe) };
}

function mioNuovo(c, { mescola = null, giroPit = null, contesto = null } = {}) {
  const gS = gareSim[c.garaSim];
  const cella = gS.perPilota.get(c.pilota)?.get(c.L);
  const scelta = mescola ?? (cella && MESCOLE_SLICK.has(cella.compound) ? cella.compound : null);
  if (scelta === null) return { ok: false, motivo: 'mescola non slick nota', pos: null, su: null, ordine: null };
  const ctx = contesto ?? ctxDi(c.gara);
  let r;
  try {
    r = doveRientri({ gara: c.garaSim, freezeLap: c.L, pilota: c.pilota, giroPit: giroPit ?? c.Li, mescola: scelta }, ctx);
  } catch (e) { return { ok: false, motivo: `eccezione: ${e.message}`, pos: null, su: null, ordine: null }; }
  if (!r || r.approvato !== true) return { ok: false, motivo: 'respinto dal Director', pos: null, su: null, ordine: null };
  if (r.posizione === null || r.posizione === undefined) return { ok: false, motivo: 'nessuna posizione (regola 6)', pos: null, su: null, ordine: null };
  let ordine = null;
  if (r.traccia) {
    const cum = {};
    for (const [drv, passi] of Object.entries(r.traccia)) {
      if (!passi) continue;
      const p = passi.find((x) => x.lap === c.Lo);
      if (p && p.cum_time !== null && p.cum_time !== undefined) cum[drv] = p.cum_time;
    }
    ordine = Object.keys(cum).sort(ordina(cum));
  }
  return { ok: true, motivo: null, pos: r.posizione, su: r.su_quanti, ordine,
           banda: r.banda_posizione ? [r.banda_posizione.da, r.banda_posizione.a] : null,
           giroRientro: r.giro_di_rientro, perdita: r.perdita?.perdita ?? null, mescola: scelta };
}

// eseguo tutto una volta
const R = CASI.map((c) => ({ c, V: mioVecchio(c), N: mioNuovo(c) }));

// ═══════════════════════════════════ C3 · STESSO CASO? E COINCIDO COL BANCO?
log('\n═══ C3 · I DUE MOTORI RICEVONO LO STESSO CASO? ═══');
{
  let giroRientroSbagliato = 0, pilotaFuoriOrdine = 0;
  for (const { c, N } of R) if (N.ok && N.giroRientro !== c.Lo) giroRientroSbagliato += 1;
  for (const { c, V } of R) if (V.ok && V.ordine.indexOf(c.pilota) + 1 !== V.pos) pilotaFuoriOrdine += 1;
  log(`  il NUOVO risponde al giro Lo in ${R.filter((x) => x.N.ok).length - giroRientroSbagliato}/${R.filter((x) => x.N.ok).length} (giro_di_rientro == Li+1)`);
  log(`  il VECCHIO con orizzonte 0 fa steps = (Li − L) + 1 = 2 → finisce al giro L+2 = Lo (algebrico, non misurabile dall'uscita)`);
  log(`  \`pos\` == rango nel proprio \`ordine\`, vecchio: ${R.filter((x) => x.V.ok).length - pilotaFuoriOrdine}/${R.filter((x) => x.V.ok).length}`);
  // pit-loss: quello che riceve ciascun motore
  log('\n  PIT-LOSS RICEVUTO (la piu\' grossa asimmetria dichiarata dal referto)');
  log('    gara              vecchio(tabella)  nuovo(prior verde)   scarto');
  let maxScarto = 0, garaMax = null;
  for (const g of GARE) {
    const v = PITLOSS_DEMO[g];
    const n = perditaBox(prior, SITO2SIM[g], null).perdita;
    const s = Math.abs(v - n);
    if (s > maxScarto) { maxScarto = s; garaMax = g; }
    log(`    ${g.padEnd(16)} ${f2(v).padStart(14)} ${f2(n).padStart(18)} ${f2(v - n).padStart(9)}`);
  }
  log(`    scarto massimo ${f2(maxScarto)} s su ${garaMax}   [referto: «fino a 5,04 s: Belgio 23,36 contro 18,40, Canada 24,37 contro 19,33»]`);
}

// confronto caso per caso col banco
log('\n  CONFRONTO CASO PER CASO COL BANCO (importo banco.mjs SOLO per questo)');
{
  const B = await import('./banco.mjs');
  const suoi = B.casi();
  let divCaso = 0, divV = 0, divN = 0, divVmuto = 0, divNmuto = 0;
  const mapMio = new Map(R.map((x) => [x.c.id, x]));
  if (suoi.length !== R.length) log(`    ATTENZIONE: il banco ha ${suoi.length} casi, io ${R.length}`);
  for (const s of suoi) {
    const mio = mapMio.get(s.id);
    if (!mio) { divCaso += 1; continue; }
    if (s.posizioneVera !== mio.c.vera || s.suQuantiVeri !== mio.c.suVeri || s.freezeLap !== mio.c.L || s.pitLap !== mio.c.Li) divCaso += 1;
    const bv = B.rispostaVecchio(s), bn = B.rispostaNuovo(s);
    if (bv.ok !== mio.V.ok) divVmuto += 1;
    else if (bv.ok && (bv.pos !== mio.V.pos || bv.su !== mio.V.su)) divV += 1;
    if (bn.ok !== mio.N.ok) divNmuto += 1;
    else if (bn.ok && (bn.pos !== mio.N.pos || bn.su !== mio.N.su)) divN += 1;
  }
  log(`    casi divergenti (identita'/verita'/giri): ${divCaso}`);
  log(`    risposta VECCHIO divergente: ${divV} (+ ${divVmuto} discordi su muto/non-muto)`);
  log(`    risposta NUOVO   divergente: ${divN} (+ ${divNmuto} discordi su muto/non-muto)`);
}

// ═══════════════════════════════════════════ C4 · FUGA DAL FUTURO (mutazione)
log('\n═══ C4 · FUGA DAL FUTURO — PROVA DI MUTAZIONE ═══');
log('  Sporco OGNI cella con lap > freezeLap (cum +1234,5 s · lap_time +47,5 · status gialla ·');
log('  del=true · stint 9 · compound HARD · eta 44) e riesumo la risposta. Se cambia, il motore');
log('  ha letto il futuro. Su tutti e 274 i casi.');
{
  let nMut = 0, nCambiati = 0, nMutoDiverso = 0;
  const esempi = [];
  for (const { c, N } of R) {
    const gS = gareSim[c.garaSim];
    const sporca = garaSporcata(gS, c.L);
    const ctx = { ...CTX, gare: { ...gareSim, [c.garaSim]: sporca }, nGiriGara: gS.nGiri };
    const M = mioNuovo(c, { contesto: ctx });
    nMut += 1;
    if (M.ok !== N.ok) { nMutoDiverso += 1; if (esempi.length < 5) esempi.push({ id: c.id, prima: N.ok, dopo: M.ok }); continue; }
    if (M.ok && (M.pos !== N.pos || M.su !== N.su)) { nCambiati += 1; if (esempi.length < 5) esempi.push({ id: c.id, prima: `${N.pos}/${N.su}`, dopo: `${M.pos}/${M.su}` }); }
  }
  log(`  NUOVO   : ${nMut} casi mutati · risposte cambiate ${nCambiati} · muto/non-muto cambiato ${nMutoDiverso}`);
  if (esempi.length) log(`            esempi: ${JSON.stringify(esempi)}`);

  // il vecchio, come lo usa il confronto (troncato): il futuro non e' nemmeno negli argomenti.
  // Lo verifico lo stesso mutando la fonte a monte: byLap troncato non contiene lap > L.
  let celleFuture = 0;
  for (const { c } of R) { const bl = {}; for (let k = 1; k <= c.L; k += 1) if (demo[c.gara].byLap[k]) bl[k] = demo[c.gara].byLap[k]; celleFuture += Object.keys(bl).filter((k) => Number(k) > c.L).length; }
  log(`  VECCHIO troncato: celle con lap > freezeLap negli argomenti: ${celleFuture} (zero = il futuro non entra)`);

  // ...e il vecchio NON troncato, cioe' come gira in produzione: quanto cambia?
  let vnCambiati = 0, vnMuto = 0, vnOk = 0;
  for (const { c } of R) {
    const pulito = mioVecchio(c, { troncato: false });
    const sporco = mioVecchio(c, { troncato: false, sporcaFuturo: true });
    if (pulito.ok !== sporco.ok) { vnMuto += 1; continue; }
    if (!pulito.ok) continue;
    vnOk += 1;
    if (pulito.pos !== sporco.pos || pulito.su !== sporco.su) vnCambiati += 1;
  }
  log(`  VECCHIO NON troncato (produzione): su ${vnOk} risposte, sporcare il futuro ne cambia ${vnCambiati} (+${vnMuto} muto/non-muto)`);
  log('  → conferma che il troncamento NON e\' un capriccio: senza, il vecchio legge oltre il congelamento.');

  // la tabella demo/neutralizzazione.json e' costruita a gara finita (E14): entra nel numero?
  let cambiaSenzaGara = 0;
  for (const { c, V } of R) {
    const senza = mioVecchio(c, { gara: 'GARA_INESISTENTE' });
    if (senza.ok !== V.ok) { cambiaSenzaGara += 1; continue; }
    if (V.ok && (senza.pos !== V.pos || senza.su !== V.su)) cambiaSenzaGara += 1;
  }
  log(`  VECCHIO: sostituendo \`gara\` con un nome inesistente (spegne demo/neutralizzazione.json, che viene dal futuro) la risposta cambia in ${cambiaSenzaGara}/274 casi`);
}

// ══════════════════════════════════════════════════════ C5 · I MUTI, COME CONTANO
log('\n═══ C5 · I MUTI: esclusi, o contati come 0 / come errore massimo? ═══');
const mutiV = R.filter((x) => !x.V.ok), mutiN = R.filter((x) => !x.N.ok);
const app = R.filter((x) => x.V.ok && x.N.ok);
{
  const motivi = (l, k) => { const m = {}; for (const x of l) { const s = x[k].motivo ?? '—'; m[s] = (m[s] ?? 0) + 1; } return m; };
  log(`  muti VECCHIO ${mutiV.length}/274 · ${JSON.stringify(motivi(mutiV, 'V'))}`);
  log(`  muti NUOVO   ${mutiN.length}/274 · ${JSON.stringify(motivi(mutiN, 'N'))}`);
  log(`  rispondono entrambi ${app.length} · solo vecchio ${R.filter((x) => x.V.ok && !x.N.ok).length} · solo nuovo ${R.filter((x) => !x.V.ok && x.N.ok).length} · muti tutti e due ${R.filter((x) => !x.V.ok && !x.N.ok).length}`);
  log('  Nel referto i muti NON entrano in nessuna media: le tre letture girano sui 223 appaiati.');
  log('  Lo verifico rifacendo M1 sotto le TRE convenzioni possibili (sotto, in C6/C7).');
}

// ═════════════════════════════════════════════════════ C6 · M1, TRE LETTURE
function rango(sigle, dentro, chi) {
  const f = sigle.filter((d) => dentro.has(d));
  const i = f.indexOf(chi);
  return i < 0 ? null : i + 1;
}
for (const x of R) {
  const { c, V, N } = x;
  const setVero = new Set(c.ordineVero);
  x.errAV = V.ok ? V.pos - c.vera : null;
  x.errAN = N.ok ? N.pos - c.vera : null;
  x.errBV = null; x.errBN = null; x.errB2V = null; x.errB2N = null;
  x.kV = null; x.kN = null;
  if (V.ok && V.ordine) {
    const dentro = new Set(V.ordine.filter((d) => setVero.has(d)));
    const p = rango(V.ordine, dentro, c.pilota), t = rango(c.ordineVero, dentro, c.pilota);
    if (p !== null && t !== null) { x.errBV = p - t; x.kV = c.vera - t; }
    x.fuoriVero = V.ordine.filter((d) => !setVero.has(d)).length;
  }
  if (N.ok && N.ordine) {
    const dentro = new Set(N.ordine.filter((d) => setVero.has(d)));
    const p = rango(N.ordine, dentro, c.pilota), t = rango(c.ordineVero, dentro, c.pilota);
    if (p !== null && t !== null) { x.errBN = p - t; x.kN = c.vera - t; }
    x.fuoriVeroN = N.ordine.filter((d) => !setVero.has(d)).length;
  }
  if (V.ok && N.ok && V.ordine && N.ordine) {
    const sv = new Set(V.ordine), sn = new Set(N.ordine);
    const dentro = new Set(c.ordineVero.filter((d) => sv.has(d) && sn.has(d)));
    const t = rango(c.ordineVero, dentro, c.pilota);
    const pv = rango(V.ordine, dentro, c.pilota), pn = rango(N.ordine, dentro, c.pilota);
    if (t !== null && pv !== null && pn !== null) { x.errB2V = pv - t; x.errB2N = pn - t; }
  }
}
const col = (l, k) => l.map((x) => x[k]).filter((v) => v !== null && v !== undefined);
const LET = {
  A: { V: riassunto(col(app, 'errAV')), N: riassunto(col(app, 'errAN')) },
  B: { V: riassunto(col(app, 'errBV')), N: riassunto(col(app, 'errBN')) },
  B2: { V: riassunto(col(app, 'errB2V')), N: riassunto(col(app, 'errB2N')) },
};
log('\n═══ C6 · M1 SUI 223 APPAIATI, RICALCOLATA CON CODICE MIO ═══');
log('  lettura    motore   n   med|e|  media|e|  esatti      entro1     bias med  bias medio  max');
for (const [k, v] of Object.entries(LET)) {
  for (const m of ['V', 'N']) {
    const s = v[m];
    log(`  ${k.padEnd(9)} ${(m === 'V' ? 'VECCHIO' : 'NUOVO').padEnd(8)} ${String(s.n).padStart(3)}  ${f1(s.med)}   ${f2(s.avg)}   ${String(s.esatti).padStart(3)} (${f1(s.q_esatti)}%)  ${String(s.entro1).padStart(3)} (${f1(s.q_entro1)}%)  ${f1(s.bias_med)}   ${f2(s.bias_avg)}   ${s.max}`);
  }
  const g = cancello(v.V, v.N);
  log(`  ${' '.repeat(9)} CANCELLO mediana ${g.med ? 'OK' : 'NO'} · esatti ${g.esatti ? 'OK' : 'NO'} → ${g.passa ? 'IL NUOVO PASSA' : 'IL NUOVO NON PASSA'}`);
}
// copertura piena
{
  const pv = riassunto(col(R.filter((x) => x.V.ok), 'errAV'));
  const pn = riassunto(col(R.filter((x) => x.N.ok), 'errAN'));
  log(`  COPERTURA PIENA (ognuno sul proprio insieme, lettura A): vecchio n=${pv.n} med ${f1(pv.med)} media ${f2(pv.avg)} esatti ${pv.esatti} (${f1(pv.q_esatti)}%) · nuovo n=${pn.n} med ${f1(pn.med)} media ${f2(pn.avg)} esatti ${pn.esatti} (${f1(pn.q_esatti)}%)`);
}

// ═══════════════════════════════════════════════ C7 · FRAGILITA' DEL CANCELLO
log('\n═══ C7 · QUANTO E\' FRAGILE IL CANCELLO? ═══');
for (const [k, v] of Object.entries(LET)) {
  const d = v.N.esatti - v.V.esatti;
  log(`  ${k.padEnd(3)} margine sugli esatti: ${d >= 0 ? '+' : ''}${d} casi su ${v.V.n} (${f1(v.N.q_esatti - v.V.q_esatti)} punti). Bastano ${Math.floor(d / 2) + 1} scambi di esito perche' cada.`);
}
log('  LEAVE-ONE-RACE-OUT (blocchi = gare: tolgo una gara per volta e riguardo il cancello)');
log('    gara tolta        A: medV medN esattiV% esattiN% esito | B: esito | B2: esito');
const LOO = {};
for (const g of GARE) {
  const sub = app.filter((x) => x.c.gara !== g);
  const l = {
    A: cancello(riassunto(col(sub, 'errAV')), riassunto(col(sub, 'errAN'))),
    B: cancello(riassunto(col(sub, 'errBV')), riassunto(col(sub, 'errBN'))),
    B2: cancello(riassunto(col(sub, 'errB2V')), riassunto(col(sub, 'errB2N'))),
  };
  LOO[g] = l;
  const rA = { V: riassunto(col(sub, 'errAV')), N: riassunto(col(sub, 'errAN')) };
  log(`    ${g.padEnd(16)} ${f1(rA.V.med).padStart(5)} ${f1(rA.N.med).padStart(5)} ${f1(rA.V.q_esatti).padStart(7)}% ${f1(rA.N.q_esatti).padStart(7)}%  ${l.A.passa ? 'PASSA' : 'CADE '} | ${l.B.passa ? 'PASSA' : 'CADE '} | ${l.B2.passa ? 'PASSA' : 'CADE '}`);
}
for (const k of ['A', 'B', 'B2']) {
  const cadute = GARE.filter((g) => !LOO[g][k].passa);
  log(`  lettura ${k}: il cancello CADE togliendo ${cadute.length ? cadute.join(', ') : 'nessuna gara'} (${cadute.length}/${GARE.length})`);
}

// ═════════════════════════════════ C8 · DA DOVE VIENE LO SCARTO DELLA LETTURA A
log('\n═══ C8 · L\'IDENTITA\' errA = errB − k  (k = piloti davanti nella verita\' che il motore NON simula) ═══');
{
  let idV = 0, idN = 0, nV = 0, nN = 0;
  for (const x of app) {
    if (x.errAV !== null && x.errBV !== null && x.kV !== null) { nV += 1; if (x.errAV === x.errBV - x.kV) idV += 1; }
    if (x.errAN !== null && x.errBN !== null && x.kN !== null) { nN += 1; if (x.errAN === x.errBN - x.kN) idN += 1; }
  }
  log(`  identita' verificata: vecchio ${idV}/${nV} · nuovo ${idN}/${nN}`);
  const kV = col(app, 'kV'), kN = col(app, 'kN');
  log(`  k (piloti davanti mancanti dal campo del motore): vecchio mediana ${f1(mediana(kV))} media ${f2(media(kV))} max ${Math.max(...kV)} · nuovo mediana ${f1(mediana(kN))} media ${f2(media(kN))} max ${Math.max(...kN)}`);
  log(`  piloti simulati che NON esistono nella verita' (ritirati fra L e Lo): vecchio ${app.filter((x) => x.fuoriVero > 0).length} casi · nuovo ${app.filter((x) => x.fuoriVeroN > 0).length} casi`);
  log(`  ampiezza mediana del campo: verita' ${mediana(app.map((x) => x.c.suVeri))} · vecchio ${mediana(app.map((x) => x.V.su))} · nuovo ${mediana(app.map((x) => x.N.su))}`);
  log('  su MEDIANO per gara (vecchio / nuovo / verita\') — il referto stampa una tabella che metrica_M1b.mjs NON produce:');
  for (const g of GARE) {
    const s = app.filter((x) => x.c.gara === g);
    if (!s.length) continue;
    log(`    ${g.padEnd(16)} ${mediana(s.map((x) => x.V.su))} / ${mediana(s.map((x) => x.N.su))} / ${mediana(s.map((x) => x.c.suVeri))}`);
  }
}

// ══════════════════════════════════════════════════ C9 · SIGNIFICATIVITA' (mia)
log('\n═══ C9 · SIGNIFICATIVITA\' con statistica mia (binomiale BigInt · bootstrap mulberry32 seme 424242) ═══');
for (const [k, [cv, cn]] of Object.entries({ A: ['errAV', 'errAN'], B: ['errBV', 'errBN'], B2: ['errB2V', 'errB2N'] })) {
  const d = app.filter((x) => x[cv] !== null && x[cn] !== null);
  const vn = d.filter((x) => Math.abs(x[cn]) < Math.abs(x[cv])).length;
  const vv = d.filter((x) => Math.abs(x[cn]) > Math.abs(x[cv])).length;
  log(`  ${k.padEnd(3)} vince nuovo ${vn} · vince vecchio ${vv} · pari ${d.length - vn - vv} → p (due code, esatta) = ${f3(binomialeEsatta(vn, vn + vv))}`);
}
{
  const rnd = mulberry32(424242);
  const perG = GARE.map((g) => app.filter((x) => x.c.gara === g)).filter((s) => s.length);
  const q = (v, p) => { const s = [...v].sort((a, b) => a - b); return s[Math.min(s.length - 1, Math.max(0, Math.round(p * (s.length - 1))))]; };
  for (const [k, [cv, cn]] of Object.entries({ A: ['errAV', 'errAN'], B: ['errBV', 'errBN'], B2: ['errB2V', 'errB2N'] })) {
    const stat = (sel) => {
      const eV = sel.map((x) => Math.abs(x[cv])).filter((v) => !Number.isNaN(v));
      const eN = sel.map((x) => Math.abs(x[cn])).filter((v) => !Number.isNaN(v));
      return { dm: media(eN) - media(eV), de: pct(eN.filter((e) => e === 0).length, eN.length) - pct(eV.filter((e) => e === 0).length, eV.length) };
    };
    const oss = stat(app.filter((x) => x[cv] !== null && x[cn] !== null));
    const dm = [], de = [];
    for (let b = 0; b < 10000; b += 1) {
      const sel = [];
      for (let i = 0; i < perG.length; i += 1) sel.push(...perG[Math.floor(rnd() * perG.length)]);
      const s = stat(sel.filter((x) => x[cv] !== null && x[cn] !== null));
      dm.push(s.dm); de.push(s.de);
    }
    log(`  ${k.padEnd(3)} Δmedia|err| ${f3(oss.dm)} IC95 [${f3(q(dm, 0.025))}; ${f3(q(dm, 0.975))}] · nuovo migliore nel ${f1(pct(dm.filter((v) => v < 0).length, dm.length))}%`
      + ` | Δesatti ${f2(oss.de)} pt IC95 [${f2(q(de, 0.025))}; ${f2(q(de, 0.975))}] · nuovo con piu' esatti nel ${f1(pct(de.filter((v) => v > 0).length, de.length))}%`);
  }
}

// ════════════════════════════════════════════ C10 · IL VECCHIO NON TRONCATO
log('\n═══ C10 · IL VECCHIO NON TRONCATO (cio\' che gira in produzione): il verdetto si ribalta? ═══');
{
  const Rint = CASI.map((c) => ({ c, V: mioVecchio(c, { troncato: false }) }));
  const mapN = new Map(R.map((x) => [x.c.id, x.N]));
  const appI = [];
  for (const x of Rint) {
    const N = mapN.get(x.c.id);
    if (!x.V.ok || !N.ok) continue;
    const setVero = new Set(x.c.ordineVero);
    const o = { c: x.c, V: x.V, N };
    o.errAV = x.V.pos - x.c.vera; o.errAN = N.pos - x.c.vera;
    const dV = new Set(x.V.ordine.filter((d) => setVero.has(d)));
    o.errBV = rango(x.V.ordine, dV, x.c.pilota) - rango(x.c.ordineVero, dV, x.c.pilota);
    const dN = new Set(N.ordine.filter((d) => setVero.has(d)));
    o.errBN = rango(N.ordine, dN, x.c.pilota) - rango(x.c.ordineVero, dN, x.c.pilota);
    const sv = new Set(x.V.ordine), sn = new Set(N.ordine);
    const d2 = new Set(x.c.ordineVero.filter((d) => sv.has(d) && sn.has(d)));
    const t = rango(x.c.ordineVero, d2, x.c.pilota);
    o.errB2V = rango(x.V.ordine, d2, x.c.pilota) - t;
    o.errB2N = rango(N.ordine, d2, x.c.pilota) - t;
    appI.push(o);
  }
  const vOkI = Rint.filter((x) => x.V.ok).length;
  log(`  il vecchio INTERO risponde in ${vOkI}/274 (troncato: ${R.filter((x) => x.V.ok).length}/274) · appaiati ${appI.length}`);
  const pieno = riassunto(Rint.filter((x) => x.V.ok).map((x) => x.V.pos - x.c.vera));
  log(`  copertura piena, lettura A: n=${pieno.n} med ${f1(pieno.med)} media ${f2(pieno.avg)} esatti ${pieno.esatti} (${f1(pieno.q_esatti)}%)   [referto/banco: «82/235 intero contro 75/235 troncato»]`);
  for (const [k, [cv, cn]] of Object.entries({ A: ['errAV', 'errAN'], B: ['errBV', 'errBN'], B2: ['errB2V', 'errB2N'] })) {
    const V = riassunto(col(appI, cv)), N = riassunto(col(appI, cn));
    const g = cancello(V, N);
    log(`  ${k.padEnd(3)} n=${V.n} vecchio med ${f1(V.med)} media ${f2(V.avg)} esatti ${f1(V.q_esatti)}% | nuovo med ${f1(N.med)} media ${f2(N.avg)} esatti ${f1(N.q_esatti)}% → ${g.passa ? 'IL NUOVO PASSA' : 'IL NUOVO NON PASSA'}`);
  }
}

// ═══════════════════════════════════════════ C11 · LE AFFERMAZIONI COLLATERALI
log('\n═══ C11 · LE AFFERMAZIONI COLLATERALI DEL REFERTO, UNA PER UNA ═══');
{
  const senzaPasso = R.filter((x) => !x.c.passoDemoDisponibile).length;
  const coincidono = mutiV.every((x) => !x.c.passoDemoDisponibile) && senzaPasso === mutiV.length;
  log(`  «i 39 muti del vecchio coincidono coi 39 passoVecchioDisponibile=false» → muti ${mutiV.length} · senza passo ${senzaPasso} · coincidono: ${coincidono}`);
  const monaco = mutiV.filter((x) => x.c.gara === 'Monaco').length;
  log(`  «35 dei 39 muti del vecchio sono di Monaco» → Monaco ${monaco}/${mutiV.length}`);
  const nuovoSuMuti = R.filter((x) => !x.V.ok && x.N.ok);
  const rn = riassunto(col(nuovoSuMuti, 'errAN'));
  log(`  i ${nuovoSuMuti.length} casi in cui SOLO il nuovo parla: sua mediana ${f1(rn.med)} media ${f2(rn.avg)} esatti ${rn.esatti} (${f1(rn.q_esatti)}%) — contro ${f1(LET.A.N.q_esatti)}% sugli appaiati`);
  const vecchioSuMutiN = R.filter((x) => x.V.ok && !x.N.ok);
  const rv = riassunto(col(vecchioSuMutiN, 'errAV'));
  log(`  i ${vecchioSuMutiN.length} casi in cui SOLO il vecchio parla: sua mediana ${f1(rv.med)} media ${f2(rv.avg)} esatti ${rv.esatti} (${f1(rv.q_esatti)}%) — contro ${f1(LET.A.V.q_esatti)}% sugli appaiati`);

  // il taglio sulla neutralizzazione, rifatto: uso il regime dal grezzo del simulatore
  const regime = (c) => {
    const cella = gareSim[c.garaSim].perPilota.get(c.pilota)?.get(c.L);
    if (!cella || cella.status === null) return null;
    const s = new Set(String(cella.status).split(''));
    if (!(s.has('4') || s.has('6'))) return null;
    return s.has('4') ? 'SC' : 'VSC';
  };
  const sotto = app.filter((x) => regime(x.c) !== null || x.c.neutrL);
  const verde = app.filter((x) => regime(x.c) === null && !x.c.neutrL);
  for (const [nome, sel] of Object.entries({ 'VERDE al congelamento': verde, 'NEUTRALIZZATO al congelamento': sotto })) {
    const bV = riassunto(col(sel, 'errBV')), bN = riassunto(col(sel, 'errBN'));
    log(`  ${nome.padEnd(30)} n=${sel.length} · lettura B: vecchio esatti ${f1(bV.q_esatti)}% media ${f2(bV.avg)} | nuovo esatti ${f1(bN.q_esatti)}% media ${f2(bN.avg)} → ${bN.q_esatti >= bV.q_esatti ? 'nuovo' : 'VECCHIO'} avanti`);
  }
  const vsc = app.filter((x) => regime(x.c) === 'VSC');
  const bV = riassunto(col(vsc, 'errBV')), bN = riassunto(col(vsc, 'errBN'));
  log(`  VSC (n=${vsc.length}) lettura B: vecchio esatti ${bV.esatti}/${bV.n} media ${f2(bV.avg)} | nuovo esatti ${bN.esatti}/${bN.n} media ${f2(bN.avg)}`);

  // determinismo del mio stesso conto
  const rip = CASI.slice(0, 60).map((c) => `${mioVecchio(c).pos}|${mioNuovo(c).pos}`).join(',');
  const rip2 = CASI.slice(0, 60).map((c) => `${mioVecchio(c).pos}|${mioNuovo(c).pos}`).join(',');
  log(`  determinismo (60 casi rieseguiti): ${rip === rip2 ? 'identico' : 'DIVERSO'}`);
}

// ═══════════════ C12 · I 140 CASI ESCLUSI («doppiato al rientro»): chi favoriscono?
// La PREREG li esclude perche' «la posizione fra chi e' a pari giro non e' confrontabile».
// Ma la VERITA' che il banco usa NON e' fra pari giro: e' il rango fra TUTTI i cum_time del
// giro Lo, e i doppiati ci stanno dentro (finiscono in coda). Su quel metro i 140 casi sono
// misurabili eccome. Se il nuovo ci andasse peggio, l'esclusione lo starebbe favorendo.
log('\n═══ C12 · I 140 CASI ESCLUSI PER «DOPPIATO AL RIENTRO»: l\'esclusione favorisce qualcuno? ═══');
{
  const ESCLUSI = [];
  for (const g of GARE) {
    const { G, byLap, nLaps } = demo[g];
    const leaderCum = {};
    for (let k = 1; k <= nLaps; k += 1) {
      if (!byLap[k]) continue;
      let m = Infinity;
      for (const d of Object.keys(byLap[k])) { const t = byLap[k][d].cum_time; if (typeof t === 'number' && t < m) m = t; }
      if (m < Infinity) leaderCum[k] = m;
    }
    const doppiato = (Lo, cum) => leaderCum[Lo + 1] !== undefined && cum > leaderCum[Lo + 1];
    for (let Li = 1; Li <= nLaps; Li += 1) {
      if (!byLap[Li]) continue;
      for (const pilota of Object.keys(byLap[Li])) {
        if (byLap[Li][pilota].in_lap !== true) continue;
        const L = Li - 1, Lo = Li + 1;
        if (Li < PRIMO_GIRO_AMMESSO) continue;
        if (typeof byLap[L]?.[pilota]?.cum_time !== 'number') continue;
        if (!byLap[Lo]) continue;
        const cumLo = byLap[Lo][pilota]?.cum_time;
        if (typeof cumLo !== 'number') continue;
        if (!doppiato(Lo, cumLo)) continue;   // <- SOLO gli esclusi
        const cum = {};
        for (const d of Object.keys(byLap[Lo])) { const t = byLap[Lo][d].cum_time; if (typeof t === 'number') cum[d] = t; }
        const ordineVero = Object.keys(cum).sort(ordina(cum));
        ESCLUSI.push({ id: `${g}|${pilota}|${Li}`, gara: g, garaSim: SITO2SIM[g], pilota, L, Li, Lo, nLaps,
                       vera: ordineVero.indexOf(pilota) + 1, suVeri: ordineVero.length, ordineVero,
                       passoDemoDisponibile: G.pace[String(L)]?.[pilota] != null });
      }
    }
  }
  const RE = ESCLUSI.map((c) => ({ c, V: mioVecchio(c), N: mioNuovo(c) }));
  const appE = RE.filter((x) => x.V.ok && x.N.ok);
  for (const x of appE) {
    const setVero = new Set(x.c.ordineVero);
    x.errAV = x.V.pos - x.c.vera; x.errAN = x.N.pos - x.c.vera;
    const dV = new Set(x.V.ordine.filter((d) => setVero.has(d)));
    x.errBV = rango(x.V.ordine, dV, x.c.pilota) - rango(x.c.ordineVero, dV, x.c.pilota);
    const dN = new Set(x.N.ordine.filter((d) => setVero.has(d)));
    x.errBN = rango(x.N.ordine, dN, x.c.pilota) - rango(x.c.ordineVero, dN, x.c.pilota);
  }
  log(`  casi esclusi ricostruiti ${ESCLUSI.length} · muti vecchio ${RE.filter((x) => !x.V.ok).length} · muti nuovo ${RE.filter((x) => !x.N.ok).length} · appaiati ${appE.length}`);
  for (const [k, [cv, cn]] of Object.entries({ A: ['errAV', 'errAN'], B: ['errBV', 'errBN'] })) {
    const V = riassunto(col(appE, cv)), N = riassunto(col(appE, cn));
    const g = cancello(V, N);
    log(`  ${k} vecchio med ${f1(V.med)} media ${f2(V.avg)} esatti ${V.esatti}/${V.n} (${f1(V.q_esatti)}%) bias ${f2(V.bias_avg)} | nuovo med ${f1(N.med)} media ${f2(N.avg)} esatti ${N.esatti}/${N.n} (${f1(N.q_esatti)}%) bias ${f2(N.bias_avg)} → ${g.passa ? 'il nuovo passerebbe' : 'IL NUOVO NON PASSEREBBE'}`);
  }
  // e il perimetro ALLARGATO: 274 + gli esclusi insieme
  const tutti = [...app, ...appE];
  for (const [k, [cv, cn]] of Object.entries({ A: ['errAV', 'errAN'], B: ['errBV', 'errBN'] })) {
    const V = riassunto(col(tutti, cv)), N = riassunto(col(tutti, cn));
    const g = cancello(V, N);
    log(`  PERIMETRO ALLARGATO (${tutti.length} appaiati) ${k}: vecchio med ${f1(V.med)} esatti ${f1(V.q_esatti)}% | nuovo med ${f1(N.med)} esatti ${f1(N.q_esatti)}% → ${g.passa ? 'IL NUOVO PASSA' : 'IL NUOVO NON PASSA'}`);
  }
}

// ══════════════════════════ C13 · LE CONVENZIONI SUI MUTI, tutte e quattro
// «muto contato come errore zero o come errore infinito» e' esattamente l'inganno che
// il compito mi chiede di cercare. Il referto ESCLUDE i muti. Metto le alternative accanto.
log('\n═══ C13 · E SE I MUTI SI CONTASSERO DIVERSAMENTE? (quattro convenzioni, denominatore 274) ═══');
{
  const maxOss = Math.max(...col(app, 'errAV').map(Math.abs), ...col(app, 'errAN').map(Math.abs));
  const varianti = {
    'referto: muti ESCLUSI (223 appaiati)': () => [col(app, 'errAV'), col(app, 'errAN')],
    'muti = errore 0 (premia il silenzio)': () => [
      R.map((x) => (x.V.ok ? x.errAV : 0)), R.map((x) => (x.N.ok ? x.errAN : 0))],
    [`muti = errore massimo osservato (${maxOss}) (punisce il silenzio)`]: () => [
      R.map((x) => (x.V.ok ? x.errAV : maxOss)), R.map((x) => (x.N.ok ? x.errAN : maxOss))],
    'muti tenuti ma NON esatti (mediana sui soli parlanti)': () => [
      R.filter((x) => x.V.ok).map((x) => x.errAV), R.filter((x) => x.N.ok).map((x) => x.errAN)],
  };
  for (const [nome, f] of Object.entries(varianti)) {
    const [ev, en] = f();
    const V = riassunto(ev), N = riassunto(en);
    const denomV = nome.startsWith('muti tenuti') ? 274 : V.n;
    const denomN = nome.startsWith('muti tenuti') ? 274 : N.n;
    const qV = pct(V.esatti, denomV), qN = pct(N.esatti, denomN);
    log(`  ${nome.padEnd(52)} vecchio med ${f1(V.med)} esatti ${V.esatti}/${denomV} (${f1(qV)}%) | nuovo med ${f1(N.med)} esatti ${N.esatti}/${denomN} (${f1(qN)}%) → ${(N.med <= V.med && qN >= qV) ? 'nuovo' : 'VECCHIO'}`);
  }
  log('  → la convenzione «muto = errore 0» e\' l\'UNICA che darebbe il cancello al vecchio, e premia il tacere:');
  log('     e\' esclusa dalla PREREG («un caso muto NON si scarta per l\'altro motore: si conta come muto, ed e\' un esito»).');
}

// ═══ C14 · QUANTO FUTURO COMPRA QUANTA ACCURATEZZA (troncamento progressivo del vecchio)
// Il vecchio legge oltre il congelamento in tre punti (giroNeutralizzato a L+1;
// stessoGiroReale fino a L+3; il gradino fino a L+5). Do al vecchio byLap troncato a L+K e
// guardo la scala: e' la misura di quanto il suo vantaggio «intero» sia comprato col futuro.
log('\n═══ C14 · TRONCAMENTO PROGRESSIVO DEL VECCHIO: quanto futuro compra quanta accuratezza ═══');
{
  const mapN = new Map(R.map((x) => [x.c.id, x.N]));
  log('    fino a   risponde  su mediano  A: med media esatti%   B: med media esatti%   cancello A / B');
  for (const K of [0, 1, 2, 3, 5, 999]) {
    const righe = [];
    for (const c of CASI) {
      const { byLap } = demo[c.gara];
      const lim = c.L + K;
      const bl = {};
      for (const k of Object.keys(byLap)) { const n = Number(k); if (n <= lim) bl[n] = byLap[n]; }
      // riuso mioVecchio passando un byLap gia' tagliato: replico qui la chiamata
      const { G, nLaps } = demo[c.gara];
      const pace = G.pace[String(c.L)] || {};
      const present = G.drivers.filter((d) => typeof bl[c.L]?.[d]?.cum_time === 'number' && pace[d] != null);
      const viva = misuraGradino(bl, nLaps, c.L);
      const gradino = (viva.gradino != null && viva.n_gradino >= MIN_SOSTE_UI) ? viva.gradino : null;
      let r = null;
      try {
        r = evaluatePit({ byLap: bl, nLaps, pace, driver: c.pilota, freezeLap: c.L, pitLap: c.Li,
                          pitLoss: PITLOSS_DEMO[c.gara], present, gara: c.gara, laps: G.laps, ZONE, orizzonte: ORIZZONTE, gradino });
      } catch { r = null; }
      const N = mapN.get(c.id);
      if (!r || r.ok !== true || !N.ok) { righe.push({ ok: false }); continue; }
      const ordV = r.ordine_previsto.map((x) => x[0]);
      const setVero = new Set(c.ordineVero);
      const dV = new Set(ordV.filter((d) => setVero.has(d)));
      righe.push({ ok: true, su: r.su_totale,
        errAV: r.rientro_pos - c.vera,
        errBV: rango(ordV, dV, c.pilota) - rango(c.ordineVero, dV, c.pilota),
        errAN: N.pos - c.vera,
        errBN: (() => { const dN = new Set(N.ordine.filter((d) => setVero.has(d))); return rango(N.ordine, dN, c.pilota) - rango(c.ordineVero, dN, c.pilota); })() });
    }
    const ok = righe.filter((x) => x.ok);
    const AV = riassunto(ok.map((x) => x.errAV)), AN = riassunto(ok.map((x) => x.errAN));
    const BV = riassunto(ok.map((x) => x.errBV)), BN = riassunto(ok.map((x) => x.errBN));
    const et = K === 999 ? 'INTERO' : `L+${K}`;
    log(`    ${et.padEnd(8)} ${String(ok.length).padStart(8)} ${String(mediana(ok.map((x) => x.su))).padStart(11)}`
      + `   ${f1(AV.med)} ${f2(AV.avg)} ${f1(AV.q_esatti)}%    ${f1(BV.med)} ${f2(BV.avg)} ${f1(BV.q_esatti)}%`
      + `   ${(AN.med <= AV.med && AN.q_esatti >= AV.q_esatti) ? 'nuovo' : 'VECCHIO'} / ${(BN.med <= BV.med && BN.q_esatti >= BV.q_esatti) ? 'nuovo' : 'VECCHIO'}`);
  }
  log('    (le colonne del NUOVO non cambiano mai: A med 1.0 media 1.28 esatti 40.4% · B med 1.0 media 1.13 esatti 43.9%)');
}

// ═══ C15 · CHE COSA COMPRA ESATTAMENTE QUEL GIRO L+1, E A CHI
// Tutto lo scarto troncato/intero sta in UN giro: L+1, cioe' il giro della sosta. Li' il
// vecchio legge due cose: (a) `byLap[pitLap][driver].neutralized`, che accende le soste dei
// rivali sotto SC; (b) `stessoGiroReale`, che gli fa restringere la cerchia a pari giro.
// Le separo, e guardo dove finisce il guadagno.
log('\n═══ C15 · CHE COSA COMPRA IL GIRO L+1 (e quanto e\' fisica, quanto e\' popolazione piu\' piccola) ═══');
{
  const mapN = new Map(R.map((x) => [x.c.id, x.N]));
  const righe = [];
  for (const c of CASI) {
    const N = mapN.get(c.id);
    const tr = mioVecchio(c, { troncato: true });
    const If = mioVecchio(c, { troncato: false });
    if (!N.ok || !tr.ok || !If.ok) continue;
    const setVero = new Set(c.ordineVero);
    const bOf = (ord) => { const d = new Set(ord.filter((x) => setVero.has(x))); return rango(ord, d, c.pilota) - rango(c.ordineVero, d, c.pilota); };
    // B2 sulla terna comune, calcolata separatamente per la variante troncata e per l'intera
    const b2 = (ordV) => {
      const sv = new Set(ordV), sn = new Set(N.ordine);
      const d = new Set(c.ordineVero.filter((x) => sv.has(x) && sn.has(x)));
      const t = rango(c.ordineVero, d, c.pilota);
      return [rango(ordV, d, c.pilota) - t, rango(N.ordine, d, c.pilota) - t];
    };
    const [b2trV, b2trN] = b2(tr.ordine);
    const [b2inV, b2inN] = b2(If.ordine);
    righe.push({ c, pitNeutro: c.neutrPit, suTr: tr.su, suIn: If.su,
      rivaliIn: If.rivali ?? 0,
      aTr: tr.pos - c.vera, aIn: If.pos - c.vera, aN: N.pos - c.vera,
      bTr: bOf(tr.ordine), bIn: bOf(If.ordine), bN: bOf(N.ordine),
      b2trV, b2trN, b2inV, b2inN });
  }
  const parti = { 'giro di sosta NEUTRALIZZATO (futuro)': righe.filter((r) => r.pitNeutro),
                  'giro di sosta in VERDE': righe.filter((r) => !r.pitNeutro) };
  log(`  n=${righe.length} casi con risposta da tutti e tre (troncato, intero, nuovo)`);
  for (const [nome, sel] of Object.entries(parti)) {
    const t = riassunto(sel.map((r) => r.bTr)), i = riassunto(sel.map((r) => r.bIn)), n = riassunto(sel.map((r) => r.bN));
    log(`  ${nome.padEnd(38)} n=${String(sel.length).padStart(3)} · lettura B esatti: troncato ${f1(t.q_esatti)}% → intero ${f1(i.q_esatti)}%  (nuovo ${f1(n.q_esatti)}%)`);
    log(`  ${' '.repeat(38)}      su mediano: troncato ${mediana(sel.map((r) => r.suTr))} → intero ${mediana(sel.map((r) => r.suIn))} (verita' ${mediana(sel.map((r) => r.c.suVeri))}) · rivali fermati dal vecchio intero: ${sel.reduce((a, r) => a + r.rivaliIn, 0)}`);
  }
  log('  LETTURA B2 (terna comune: l\'unica in cui i due motori girano sulla STESSA popolazione)');
  for (const [nome, sel] of Object.entries({ TUTTI: righe, ...parti })) {
    const tv = riassunto(sel.map((r) => r.b2trV)), tn = riassunto(sel.map((r) => r.b2trN));
    const iv = riassunto(sel.map((r) => r.b2inV)), inn = riassunto(sel.map((r) => r.b2inN));
    log(`    ${nome.padEnd(38)} n=${String(sel.length).padStart(3)} · TRONCATO vecchio ${f1(tv.q_esatti)}% vs nuovo ${f1(tn.q_esatti)}% | INTERO vecchio ${f1(iv.q_esatti)}% vs nuovo ${f1(inn.q_esatti)}%`);
  }
}

// ═══ C16 · LA CIRCOLARITA' DEL NUOVO: il verdetto dipende dai coefficienti tarati in-sample?
// ρ e δ₇₀ del nuovo sono misurati sul fondo 2026, che CONTIENE queste 11 gare. Se il cancello
// reggesse solo al valore tarato, sarebbe circolarita' che vince. Rifaccio tutto agli estremi
// dell'IC95 di ρ e ai valori leave-one-race-out di δ₇₀ (che il modello stesso porta).
log('\n═══ C16 · IL CANCELLO REGGE FUORI DAL COEFFICIENTE TARATO? ═══');
{
  const varianti = [];
  varianti.push(['ρ = 0,030776 (tarato) · δ₇₀ = 2,2 (scelto)', modello.rho.valore, modello.delta_70.scelto]);
  varianti.push([`ρ = ${modello.rho.ic95[0]} (IC95 basso)`, modello.rho.ic95[0], modello.delta_70.scelto]);
  varianti.push([`ρ = ${modello.rho.ic95[1]} (IC95 alto)`, modello.rho.ic95[1], modello.delta_70.scelto]);
  varianti.push([`δ₇₀ = ${modello.delta_70.stimato_libero.toFixed(3)} (stima libera, non 2,2)`, modello.rho.valore, modello.delta_70.stimato_libero]);
  const loro = Object.values(modello.delta_70.leave_one_race_out ?? {});
  if (loro.length) {
    varianti.push([`δ₇₀ = ${Math.min(...loro).toFixed(3)} (LORO minimo)`, modello.rho.valore, Math.min(...loro)]);
    varianti.push([`δ₇₀ = ${Math.max(...loro).toFixed(3)} (LORO massimo)`, modello.rho.valore, Math.max(...loro)]);
  }
  varianti.push(['ρ = 0 (degrado spento: il nuovo senza la sua fisica)', 0, modello.delta_70.scelto]);
  log('    variante                                           n    A: med media esatti%   B2: vecchio% nuovo%   cancello A / B2');
  for (const [nome, rho, d70] of varianti) {
    const mod = { ...modello, rho: { ...modello.rho, valore: rho }, delta_70: { ...modello.delta_70, scelto: d70 } };
    const righe = [];
    for (const x of R) {
      if (!x.V.ok) continue;
      const ctx = { ...ctxDi(x.c.gara), modello: mod };
      const N = mioNuovo(x.c, { contesto: ctx });
      if (!N.ok) continue;
      const setVero = new Set(x.c.ordineVero);
      const sv = new Set(x.V.ordine), sn = new Set(N.ordine);
      const d2 = new Set(x.c.ordineVero.filter((d) => sv.has(d) && sn.has(d)));
      const t = rango(x.c.ordineVero, d2, x.c.pilota);
      righe.push({ aN: N.pos - x.c.vera, aV: x.V.pos - x.c.vera,
                   b2V: rango(x.V.ordine, d2, x.c.pilota) - t, b2N: rango(N.ordine, d2, x.c.pilota) - t });
    }
    const AN = riassunto(righe.map((r) => r.aN)), AV = riassunto(righe.map((r) => r.aV));
    const B2V = riassunto(righe.map((r) => r.b2V)), B2N = riassunto(righe.map((r) => r.b2N));
    log(`    ${nome.padEnd(50)} ${String(righe.length).padStart(3)}   ${f1(AN.med)} ${f2(AN.avg)} ${f1(AN.q_esatti)}%    ${f1(B2V.q_esatti)}%   ${f1(B2N.q_esatti)}%    `
      + `${(AN.med <= AV.med && AN.q_esatti >= AV.q_esatti) ? 'nuovo' : 'VECCHIO'} / ${(B2N.med <= B2V.med && B2N.q_esatti >= B2V.q_esatti) ? 'nuovo' : 'VECCHIO'}`);
  }
}

// ══════════════════════════════════════════════════════════════════ VERDETTO
log('\n═══ VERDETTO DELLA CONTROPROVA ═══');
{
  const esiti = Object.entries(LET).map(([k, v]) => `${k}:${cancello(v.V, v.N).passa ? 'PASSA' : 'CADE'}`).join(' · ');
  log(`  cancello M1 ricalcolato da me: ${esiti}`);
  log(`  perimetro ${CASI.length === 274 ? 'coincide' : 'NON coincide'} · verita' da fonte diversa ${vcDivPos === 0 ? 'coincide' : 'DIVERGE'}`);
}
