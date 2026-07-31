// verifica_M1b.mjs — VERIFICA ADVERSARIALE della misura M1b.
//
// Non importa `metrica_M1b.mjs` e non usa `banco.mjs` per MISURARE: ricostruisce da capo
// il perimetro, la verita' e le due chiamate ai motori, importando direttamente
//   demo/pitscenario.mjs::evaluatePit      (vecchio)
//   simulatore/scenario/costruttore.mjs::doveRientri  (nuovo)
// `banco.mjs` viene importato SOLO alla fine, per dire dove il mio conto e il suo divergono.
//
// Cerca, in quest'ordine:
//   V1  il perimetro e' quello dichiarato? (274 casi, esclusioni)
//   V2  la verita' regge se la si ricalcola da una FONTE DIVERSA (il grezzo del simulatore)?
//   V3  i due motori ricevono gli stessi casi e parametri leali?
//   V4  FUGA DAL FUTURO: prova di MUTAZIONE — sporco i dati > freezeLap e guardo se la
//       risposta cambia. Se cambia, il motore ha letto il futuro.
//   V5  i muti: sono contati come errore 0? come errore infinito? o esclusi e dichiarati?
//   V6  M1 nelle tre letture, ricalcolata con codice mio
//   V7  da dove viene lo scarto della LETTURA A: e' motore o e' ampiezza del campo?
//   V8  significativita': binomiale esatta (BigInt, niente logaritmi) e bootstrap a blocchi
//       con RNG e semi DIVERSI da quelli dell'altro agente
//   V9  robustezza del cancello: leave-one-race-out
//   V10 il vecchio NON troncato (cio' che gira in produzione): il verdetto cambia?
//
// Non scrive niente su disco. Non tocca demo/, simulatore/, data/.
//   node ai_lab/confronto/verifica_M1b.mjs

import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { evaluatePit } from '../../demo/pitscenario.mjs';
import { misura as misuraGradino } from '../../demo/gradino.mjs';
import { caricaGare2026 } from '../../simulatore/provenienza/gare_2026.mjs';
import { caricaPrior } from '../../simulatore/provenienza/pitloss_dati.mjs';
import { caricaCostanti } from '../../simulatore/scenario/director_dati.mjs';
import { doveRientri } from '../../simulatore/scenario/costruttore.mjs';

const QUI = path.dirname(fileURLToPath(import.meta.url));
const RADICE = path.resolve(QUI, '..', '..');
const DEMO_DATA = path.join(RADICE, 'demo', 'data');
const SIM = path.join(RADICE, 'simulatore');

const SLICK = new Set(['SOFT', 'MEDIUM', 'HARD', 'SUPERSOFT', 'ULTRASOFT', 'HYPERSOFT']);
const MIN_SOSTE_UI = 3;
const ZONE = 0;
const ORIZZONTE = 0;
const PRIMO_GIRO_AMMESSO = 4;

const log = (...a) => console.log(...a);
const f1 = (x) => (x === null || x === undefined ? ' — ' : x.toFixed(1));
const f2 = (x) => (x === null || x === undefined ? ' — ' : x.toFixed(2));
const f3 = (x) => (x === null || x === undefined ? ' — ' : x.toFixed(3));

// ───────────────────────────────────────────────────────── statistica (mia)
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
  return {
    n: err.length,
    med: mediana(abs), avg: media(abs),
    esatti: abs.filter((e) => e === 0).length,
    q_esatti: pct(abs.filter((e) => e === 0).length, err.length),
    entro1: abs.filter((e) => e <= 1).length,
    q_entro1: pct(abs.filter((e) => e <= 1).length, err.length),
    bias: media(err), bias_med: mediana(err),
    max: err.length ? Math.max(...abs) : null,
  };
}

// ───────────────────────────────────── binomiale esatta a due code, con BigInt
// Niente logFatt, niente esponenziali: rapporto di interi esatti. Se il p dell'altro
// agente e' sbagliato per errore numerico, qui si vede.
function binomEsatta(k, n) {
  if (!n) return null;
  const C = [];
  { let c = 1n; for (let i = 0; i <= n; i += 1) { C[i] = c; c = (c * BigInt(n - i)) / BigInt(i + 1); } }
  // due code simmetriche: tutti gli esiti almeno tanto estremi quanto k
  const d = Math.abs(2 * k - n);
  let num = 0n;
  for (let i = 0; i <= n; i += 1) if (Math.abs(2 * i - n) >= d) num += C[i];
  const den = 2n ** BigInt(n);
  // rapporto in double senza overflow
  return Number((num * 10n ** 12n) / den) / 1e12;
}

// ───────────────────────────────────────────────── PARTE 1 — il perimetro, mio
const nomiSito = () => {
  const man = JSON.parse(readFileSync(path.join(DEMO_DATA, 'vista', 'manifest.json'), 'utf8'));
  return man.cartella_di;   // { "Gran Bretagna": "GranBretagna", ... }
};

const ordinaPer = (cum) => (a, b) => (cum[a] - cum[b]) || (a < b ? -1 : b < a ? 1 : 0);

function classifica(cellePerDrv) {
  // cellePerDrv: { drv -> cum_time }  → elenco ordinato
  const cum = {};
  for (const [d, t] of Object.entries(cellePerDrv)) if (typeof t === 'number') cum[d] = t;
  return { ordine: Object.keys(cum).sort(ordinaPer(cum)), cum };
}

function costruisciPerimetro() {
  const map = nomiSito();
  const gareSito = Object.keys(map).sort();
  const casi = [];
  const esclusi = { pit_le_3: 0, senza_cum_al_congelamento: 0, senza_giro_di_rientro: 0, senza_cum_al_rientro: 0, doppiato: 0 };
  let soste = 0;
  const dati = {};
  for (const g of gareSito) {
    const G = JSON.parse(readFileSync(path.join(DEMO_DATA, `${g}.json`), 'utf8'));
    const byLap = {};
    for (const l of G.laps) byLap[l.lap] = l.cars;
    dati[g] = { G, byLap, nLaps: G.n_laps };
    const leader = {};
    for (let k = 1; k <= G.n_laps; k += 1) {
      if (!byLap[k]) continue;
      let m = Infinity;
      for (const d of Object.keys(byLap[k])) { const t = byLap[k][d].cum_time; if (typeof t === 'number' && t < m) m = t; }
      if (m < Infinity) leader[k] = m;
    }
    const doppiato = (Lo, cum) => leader[Lo + 1] !== undefined && cum > leader[Lo + 1];
    for (let Li = 1; Li <= G.n_laps; Li += 1) {
      if (!byLap[Li]) continue;
      for (const drv of Object.keys(byLap[Li])) {
        if (byLap[Li][drv].in_lap !== true) continue;
        soste += 1;
        const L = Li - 1, Lo = Li + 1;
        if (Li < PRIMO_GIRO_AMMESSO) { esclusi.pit_le_3 += 1; continue; }
        if (typeof byLap[L]?.[drv]?.cum_time !== 'number') { esclusi.senza_cum_al_congelamento += 1; continue; }
        if (!byLap[Lo]) { esclusi.senza_giro_di_rientro += 1; continue; }
        const cumLo = byLap[Lo][drv]?.cum_time;
        if (typeof cumLo !== 'number') { esclusi.senza_cum_al_rientro += 1; continue; }
        if (doppiato(Lo, cumLo)) { esclusi.doppiato += 1; continue; }
        const tempiLo = {};
        for (const d of Object.keys(byLap[Lo])) tempiLo[d] = byLap[Lo][d].cum_time;
        const { ordine } = classifica(tempiLo);
        casi.push({
          id: `${g}|${drv}|${Li}`, gara: g, garaSim: map[g], pilota: drv,
          L, Li, Lo, nLaps: G.n_laps,
          vera: ordine.indexOf(drv) + 1, suVeri: ordine.length, ordineVero: ordine,
          compoundAlCongelamento: byLap[L][drv].compound ?? null,
          neutralizzatoAlCongelamento: byLap[L][drv].neutralized === true,
          neutralizzatoAlPit: byLap[Li][drv].neutralized === true,
          paceAlCongelamento: G.pace[String(L)]?.[drv] ?? null,
        });
      }
    }
  }
  casi.sort((a, b) => (a.gara < b.gara ? -1 : a.gara > b.gara ? 1 : 0) || a.Li - b.Li || (a.pilota < b.pilota ? -1 : 1));
  return { casi, esclusi, soste, dati, gareSito, map };
}

// ───────────────────────────────── PARTE 2 — le due chiamate, ricostruite da me
const PITLOSS = JSON.parse(readFileSync(path.join(DEMO_DATA, 'pitloss.json'), 'utf8'));

/**
 * @param gradinoDa  'stesso' (dal byLap che si passa) | 'intero' | 'troncato'
 *                   serve a SEPARARE i canali per cui il troncamento pesa.
 */
function ingressiVecchioMio(dati, caso, { byLapOverride = null, troncato = true,
                                          gradinoDa = 'stesso', lapsOverride = null } = {}) {
  const { G, byLap, nLaps } = dati[caso.gara];
  const L = caso.L;
  const tronca = () => { const t = {}; for (let k = 1; k <= L; k += 1) if (byLap[k]) t[k] = byLap[k]; return t; };
  let bl = byLapOverride ?? (troncato ? tronca() : byLap);
  const pace = G.pace[String(L)] || {};
  const present = G.drivers.filter((d) => typeof bl[L]?.[d]?.cum_time === 'number' && pace[d] != null);
  const perGradino = gradinoDa === 'intero' ? byLap : gradinoDa === 'troncato' ? tronca() : bl;
  const viva = misuraGradino(perGradino, nLaps, L);
  const gradino = (viva.gradino != null && viva.n_gradino >= MIN_SOSTE_UI) ? viva.gradino : null;
  return { byLap: bl, nLaps, pace, driver: caso.pilota, freezeLap: L, pitLap: caso.Li,
           pitLoss: PITLOSS[caso.gara], present, gara: caso.gara, laps: lapsOverride ?? G.laps,
           ZONE, orizzonte: ORIZZONTE, gradino };
}

function vecchioMio(dati, caso, opz = {}) {
  const arg = ingressiVecchioMio(dati, caso, opz);
  let r;
  try { r = evaluatePit(arg); } catch (e) { return { ok: false, motivo: `eccezione: ${e.message}` }; }
  if (!r || r.ok !== true) return { ok: false, motivo: r?.reason ?? 'nessuna risposta' };
  return { ok: true, pos: r.rientro_pos, su: r.su_totale,
           ordine: r.ordine_previsto.map(([d]) => d), gradino: arg.gradino };
}

function nuovoMio(ctxBase, gareSim, caso, { override = null } = {}) {
  const g = override ?? gareSim[caso.garaSim];
  const mescola = caso.compoundAlCongelamento;
  if (!SLICK.has(mescola)) return { ok: false, motivo: 'mescola non slick' };
  const contesto = { ...ctxBase, gare: override ? { ...gareSim, [caso.garaSim]: override } : gareSim, nGiriGara: g.nGiri };
  let r;
  try {
    r = doveRientri({ gara: caso.garaSim, freezeLap: caso.L, pilota: caso.pilota, giroPit: caso.Li, mescola }, contesto);
  } catch (e) { return { ok: false, motivo: `eccezione: ${e.message}` }; }
  if (!r || r.approvato !== true) return { ok: false, motivo: 'respinto dal Director' };
  if (r.posizione === null || r.posizione === undefined) return { ok: false, motivo: 'nessuna posizione (regola 6)' };
  // ordine al giro di rientro, dalla traccia
  const cum = {};
  for (const [d, passi] of Object.entries(r.traccia ?? {})) {
    const p = passi?.find((x) => x.lap === caso.Lo);
    if (p) cum[d] = p.cum_time;
  }
  const ordine = Object.keys(cum).sort(ordinaPer(cum));
  return { ok: true, pos: r.posizione, su: r.su_quanti, ordine,
           giroRientro: r.giro_di_rientro, banda: r.banda_posizione };
}

// ────────────────────────────────────────── rango dentro una popolazione ristretta
function rango(ordine, dentro, pilota) {
  const f = ordine.filter((d) => dentro.has(d));
  const i = f.indexOf(pilota);
  return i < 0 ? null : i + 1;
}

// ═══════════════════════════════════════════════════════════════════ MAIN
const P = costruisciPerimetro();
log('VERIFICA ADVERSARIALE DI M1b — rimisura indipendente\n');

log('══ V1 · IL PERIMETRO, ricostruito con codice mio dai soli demo/data/<gara>.json ══');
log(`  soste reali (celle con in_lap) : ${P.soste}`);
log(`  escluse pit<=3 ${P.esclusi.pit_le_3} · senza_cum_al_congelamento ${P.esclusi.senza_cum_al_congelamento}`
  + ` · senza_giro_di_rientro ${P.esclusi.senza_giro_di_rientro} · senza_cum_al_rientro ${P.esclusi.senza_cum_al_rientro}`
  + ` · doppiato_al_rientro ${P.esclusi.doppiato}`);
log(`  CASI AMMESSI: ${P.casi.length}   (l'altro agente dichiara 274 su 459)`);

// ── V2 · la verita' da una FONTE DIVERSA: il grezzo pinnato del simulatore ──
const gareSim = caricaGare2026(SIM);
let divFonte = 0, divSu = 0; const esempiFonte = [];
for (const c of P.casi) {
  const g = gareSim[c.garaSim];
  const tempi = {};
  for (const [drv, celle] of g.perPilota) { const x = celle.get(c.Lo); if (x && typeof x.cum_time === 'number') tempi[drv] = x.cum_time; }
  const { ordine } = classifica(tempi);
  const pos = ordine.indexOf(c.pilota) + 1;
  if (pos !== c.vera) { divFonte += 1; if (esempiFonte.length < 5) esempiFonte.push({ id: c.id, sito: c.vera, simulatore: pos }); }
  if (ordine.length !== c.suVeri) divSu += 1;
}
log(`\n══ V2 · LA VERITA' RICALCOLATA DA UN'ALTRA FONTE (grezzo simulatore, non demo/data) ══`);
log(`  casi ${P.casi.length} · divergenze di posizione ${divFonte} · divergenze di ampiezza campo ${divSu}`);
if (esempiFonte.length) log(`  esempi: ${JSON.stringify(esempiFonte)}`);
log(`  (l'altro agente ricalcola la verita' LEGGENDO LO STESSO FILE con la stessa regola:`);
log(`   e' un controllo di trascrizione, non di fonte. Questo lo e' di fonte.)`);

// ── le risposte, mie ──
const ctxBase = {
  modello: JSON.parse(readFileSync(path.join(SIM, 'data', 'modelli', 'modello_v2.json'), 'utf8')),
  prior: caricaPrior(SIM),
  costantiDirector: caricaCostanti(SIM),
  bandaRientro: JSON.parse(readFileSync(path.join(SIM, 'data', 'modelli', 'banda_rientro.json'), 'utf8')),
};

const R = [];
for (const c of P.casi) {
  const V = vecchioMio(P.dati, c);
  const N = nuovoMio(ctxBase, gareSim, c);
  const setVero = new Set(c.ordineVero);
  // LETTURA A
  const eAV = V.ok ? V.pos - c.vera : null;
  const eAN = N.ok ? N.pos - c.vera : null;
  // LETTURA B
  let eBV = null, eBN = null;
  if (V.ok) { const d = new Set(V.ordine.filter((x) => setVero.has(x)));
    const a = rango(V.ordine, d, c.pilota), b = rango(c.ordineVero, d, c.pilota);
    if (a && b) eBV = a - b; }
  if (N.ok) { const d = new Set(N.ordine.filter((x) => setVero.has(x)));
    const a = rango(N.ordine, d, c.pilota), b = rango(c.ordineVero, d, c.pilota);
    if (a && b) eBN = a - b; }
  // LETTURA B2
  let eCV = null, eCN = null;
  if (V.ok && N.ok) {
    const sV = new Set(V.ordine), sN = new Set(N.ordine);
    const d = new Set(c.ordineVero.filter((x) => sV.has(x) && sN.has(x)));
    const t = rango(c.ordineVero, d, c.pilota), a = rango(V.ordine, d, c.pilota), b = rango(N.ordine, d, c.pilota);
    if (t && a && b) { eCV = a - t; eCN = b - t; }
  }
  R.push({ c, V, N, eAV, eAN, eBV, eBN, eCV, eCN });
}

// ── V3/V5 · copertura e muti ──
const app = R.filter((r) => r.V.ok && r.N.ok);
const soloV = R.filter((r) => r.V.ok && !r.N.ok);
const soloN = R.filter((r) => !r.V.ok && r.N.ok);
const zero = R.filter((r) => !r.V.ok && !r.N.ok);
log(`\n══ V3/V5 · COPERTURA E MUTI (ricalcolata) ══`);
log(`  entrambi ${app.length} · solo vecchio ${soloV.length} · solo nuovo ${soloN.length} · muti tutti e due ${zero.length}`);
const motivi = (l) => { const m = {}; for (const x of l) m[x] = (m[x] ?? 0) + 1; return m; };
log(`  muti VECCHIO ${R.filter((r) => !r.V.ok).length} · motivi ${JSON.stringify(motivi(R.filter((r) => !r.V.ok).map((r) => r.V.motivo)))}`);
log(`  muti NUOVO   ${R.filter((r) => !r.N.ok).length} · motivi ${JSON.stringify(motivi(R.filter((r) => !r.N.ok).map((r) => r.N.motivo)))}`);
const mutiVsPace = R.filter((r) => !r.V.ok).every((r) => r.c.paceAlCongelamento === null);
const paceVsMuti = R.filter((r) => r.c.paceAlCongelamento === null).every((r) => !r.V.ok);
log(`  ogni muto del vecchio ha pace assente al congelamento: ${mutiVsPace} · e viceversa: ${paceVsMuti}`);
log(`  → i muti NON entrano in nessuna media: verificato che il vettore degli errori li salta`);
log(`     (n della lettura A = ${R.filter((r) => r.eAV !== null).length} vecchio / ${R.filter((r) => r.eAN !== null).length} nuovo, non ${R.length})`);

// ── V4 · PROVA DI MUTAZIONE: fuga dal futuro ──
log(`\n══ V4 · PROVA DI MUTAZIONE — se sporco i dati DOPO il congelamento, la risposta cambia? ══`);
{
  // campione deterministico: un caso per gara, quello a meta' gara fra gli appaiati
  const camp = [];
  for (const g of P.gareSito) {
    const d = app.filter((r) => r.c.gara === g);
    if (!d.length) continue;
    camp.push(d.reduce((m, x) => (Math.abs(x.c.L - x.c.nLaps / 2) < Math.abs(m.c.L - m.c.nLaps / 2) ? x : m)));
  }
  // VECCHIO. Il byLap troncato NON contiene giri > L: lo verifico invece di crederci.
  // Poi sporco TUTTO il resto che il chiamante passa e che deriva da giri > L (`laps`,
  // che gen_hero passa intero) e guardo se la risposta si muove.
  let chiaviOltreL = 0, cambiaV = 0, cambiaVintero = 0;
  for (const r of camp) {
    const { byLap, G } = P.dati[r.c.gara];
    const t = {}; for (let k = 1; k <= r.c.L; k += 1) if (byLap[k]) t[k] = byLap[k];
    chiaviOltreL += Object.keys(t).filter((k) => Number(k) > r.c.L).length;
    const lapsFalsi = G.laps.map((l) => (l.lap <= r.c.L ? l : { lap: l.lap, cars: {} }));
    const base = vecchioMio(P.dati, r.c);
    const conLapsFalsi = vecchioMio(P.dati, r.c, { lapsOverride: lapsFalsi });
    if (base.pos !== conLapsFalsi.pos || base.su !== conLapsFalsi.su) cambiaV += 1;
    // e per contrasto: quanto ne userebbe se glielo si desse (byLap intero = produzione)
    const intero = vecchioMio(P.dati, r.c, { troncato: false });
    if (intero.pos !== base.pos || intero.su !== base.su) cambiaVintero += 1;
  }
  log(`  VECCHIO (come lo chiama il banco: byLap TRONCATO)`);
  log(`    celle con giro > congelamento dentro il byLap troncato: ${chiaviOltreL} (deve essere 0)`);
  log(`    parametro "laps" falsificato oltre il congelamento → risposta cambiata in ${cambiaV}/${camp.length}  ${cambiaV === 0 ? '(nessuna fuga)' : '(FUGA)'}`);
  log(`    per contrasto, se gli si RIDA' il byLap intero la risposta cambia in ${cambiaVintero}/${camp.length}: e' la fuga che il troncamento chiude`);

  // NUOVO: sporco la struttura in memoria del simulatore oltre il congelamento — non solo i
  // tempi: anche gomma, eta', status e i flag di sosta, cioe' tutto cio' che il costruttore
  // e il Director leggono da una cella.
  let cambiaN = 0;
  const sporcaCella = (c) => ({ ...c,
    cum_time: typeof c.cum_time === 'number' ? c.cum_time + 999 : c.cum_time,
    lap_time: typeof c.lap_time === 'number' ? c.lap_time + 999 : c.lap_time,
    tyre_age: typeof c.tyre_age === 'number' ? c.tyre_age + 40 : c.tyre_age,
    compound: c.compound === 'SOFT' ? 'HARD' : c.compound === 'HARD' ? 'SOFT' : c.compound,
    stint: typeof c.stint === 'number' ? c.stint + 3 : c.stint,
    in_lap: !c.in_lap, out_lap: !c.out_lap, del: !c.del, status: '4' });
  for (const r of camp) {
    const g = gareSim[r.c.garaSim];
    const perPilota = new Map();
    for (const [drv, celle] of g.perPilota) {
      const m = new Map();
      for (const [lap, cella] of celle) m.set(lap, lap <= r.c.L ? cella : sporcaCella(cella));
      perPilota.set(drv, m);
    }
    const righe = g.righe.map((x) => (x.lap <= r.c.L ? x : sporcaCella(x)));
    const falso = { ...g, perPilota, righe };
    const base = nuovoMio(ctxBase, gareSim, r.c);
    const con = nuovoMio(ctxBase, gareSim, r.c, { override: falso });
    if (base.pos !== con.pos || base.su !== con.su) cambiaN += 1;
  }
  log(`  NUOVO`);
  log(`    celle falsificate oltre il congelamento (tempi, gomma, eta', stint, status, flag)`);
  log(`    → risposta cambiata in ${cambiaN}/${camp.length} casi  ${cambiaN === 0 ? '(nessuna fuga)' : '(FUGA)'}`);
}

// ── V3b · il giro su cui rispondono i due motori e' lo stesso? ──
{
  const sbagliati = app.filter((r) => r.N.giroRientro !== r.c.Lo);
  log(`\n══ V3b · I DUE MOTORI RISPONDONO SULLO STESSO GIRO DELLA VERITA'? ══`);
  log(`  nuovo: giro_di_rientro != Lo in ${sbagliati.length}/${app.length} casi`);
  log(`  vecchio: orizzonte 0 → steps = (Li − L) + 1 = 2 → giro finale = L+2 = Lo (per costruzione)`);
  const suOk = app.filter((r) => r.N.ordine.length === r.N.su).length;
  log(`  nuovo: |ordine ricostruito dalla traccia| == su_quanti in ${suOk}/${app.length}`);
  const posOk = app.filter((r) => r.N.ordine.indexOf(r.c.pilota) + 1 === r.N.pos).length;
  const posOkV = app.filter((r) => r.V.ordine.indexOf(r.c.pilota) + 1 === r.V.pos).length;
  log(`  pos == rango nel proprio ordine: nuovo ${posOk}/${app.length} · vecchio ${posOkV}/${app.length}`);
}

// ── V6 · M1 nelle tre letture ──
log(`\n══ V6 · M1 SUI ${app.length} CASI APPAIATI — tre letture, conto mio ══`);
const letture = { A: ['eAV', 'eAN'], B: ['eBV', 'eBN'], B2: ['eCV', 'eCN'] };
const S = {};
for (const [k, [cv, cn]] of Object.entries(letture)) {
  const d = app.filter((r) => r[cv] !== null && r[cn] !== null);
  S[k] = { n: d.length, V: riassunto(d.map((r) => r[cv])), N: riassunto(d.map((r) => r[cn])), d };
  const v = S[k].V, n = S[k].N;
  log(`  lettura ${k.padEnd(2)} (n=${S[k].n})`);
  log(`    VECCHIO med ${f1(v.med)} · media ${f2(v.avg)} · esatti ${v.esatti} (${f1(v.q_esatti)}%) · entro1 ${f1(v.q_entro1)}% · bias ${f2(v.bias)} · max ${v.max}`);
  log(`    NUOVO   med ${f1(n.med)} · media ${f2(n.avg)} · esatti ${n.esatti} (${f1(n.q_esatti)}%) · entro1 ${f1(n.q_entro1)}% · bias ${f2(n.bias)} · max ${n.max}`);
  const c1 = n.med <= v.med, c2 = n.q_esatti >= v.q_esatti;
  log(`    CANCELLO: mediana ${c1 ? 'OK' : 'NO'} · esatti ${c2 ? 'OK' : 'NO'} → ${c1 && c2 ? 'IL NUOVO PASSA' : 'IL NUOVO NON PASSA'}`);
}

// ── V7 · da dove viene lo scarto della lettura A ──
log(`\n══ V7 · LO SCARTO DELLA LETTURA A E' MOTORE O E' AMPIEZZA DEL CAMPO? ══`);
{
  const suV = app.map((r) => r.V.su), suN = app.map((r) => r.N.su), suT = app.map((r) => r.c.suVeri);
  log(`  ampiezza mediana del campo: verita' ${mediana(suT)} · vecchio ${mediana(suV)} · nuovo ${mediana(suN)}`);
  log(`  |campo vecchio| < |campo vero| in ${app.filter((r) => r.V.su < r.c.suVeri).length}/${app.length} casi`
    + ` · |campo nuovo| < |campo vero| in ${app.filter((r) => r.N.su < r.c.suVeri).length}/${app.length}`);
  // quanti piloti il vecchio non simula ma che nella verita' sono DAVANTI al pilota
  let mancantiDavanti = 0, casiConMancanti = 0;
  for (const r of app) {
    const sV = new Set(r.V.ordine);
    const idx = r.c.ordineVero.indexOf(r.c.pilota);
    const persiDavanti = r.c.ordineVero.slice(0, idx).filter((d) => !sV.has(d)).length;
    if (persiDavanti > 0) { casiConMancanti += 1; mancantiDavanti += persiDavanti; }
  }
  log(`  il VECCHIO non simula, in media, ${(mancantiDavanti / app.length).toFixed(2)} piloti che nella verita' sono DAVANTI al pilota`);
  log(`    (in ${casiConMancanti}/${app.length} casi ne manca almeno uno: ogni assente davanti abbassa di 1 la posizione prevista)`);
  let mancantiDavantiN = 0, casiN = 0;
  for (const r of app) {
    const sN = new Set(r.N.ordine);
    const idx = r.c.ordineVero.indexOf(r.c.pilota);
    const persi = r.c.ordineVero.slice(0, idx).filter((d) => !sN.has(d)).length;
    if (persi > 0) { casiN += 1; mancantiDavantiN += persi; }
  }
  log(`  il NUOVO idem: ${(mancantiDavantiN / app.length).toFixed(2)} in media, in ${casiN}/${app.length} casi`);
  // correlazione fra errore-A del vecchio e piloti mancanti davanti
  const coda = app.filter((r) => r.eAV <= -4);
  const codaSpiegata = coda.filter((r) => {
    const sV = new Set(r.V.ordine);
    const idx = r.c.ordineVero.indexOf(r.c.pilota);
    return r.c.ordineVero.slice(0, idx).filter((d) => !sV.has(d)).length >= 4;
  }).length;
  log(`  coda sinistra del vecchio in lettura A (errore <= −4): ${coda.length} casi, di cui ${codaSpiegata} hanno >= 4 piloti davanti NON simulati`);
  log(`  → la lettura A confronta un rango in un campo da ${mediana(suV)} con una verita' in un campo da ${mediana(suT)}.`);
  log(`     Non e' una misura del motore: e' una misura di quanti piloti il motore riesce a mettere in pista.`);
}

// ── V8 · significativita' con codice e semi MIEI ──
log(`\n══ V8 · SIGNIFICATIVITA' (binomiale ESATTA con BigInt · bootstrap con altro RNG e 5 semi) ══`);
for (const [k, [cv, cn]] of Object.entries(letture)) {
  const d = S[k].d;
  const vn = d.filter((r) => Math.abs(r[cn]) < Math.abs(r[cv])).length;
  const vv = d.filter((r) => Math.abs(r[cn]) > Math.abs(r[cv])).length;
  const id = d.filter((r) => r[cn] === r[cv]).length;
  log(`  lettura ${k.padEnd(2)}  vince nuovo ${vn} · vince vecchio ${vv} · pari ${d.length - vn - vv} (identici ${id})`
    + ` → p esatto = ${binomEsatta(vn, vn + vv).toFixed(4)}`);
}
// bootstrap a blocchi, mulberry32 (diverso dallo xorshift dell'altro agente), 5 semi
function mulberry32(a) { return () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
for (const [k, [cv, cn]] of Object.entries(letture)) {
  const perG = P.gareSito.map((g) => S[k].d.filter((r) => r.c.gara === g)).filter((x) => x.length);
  const stat = (sel) => {
    const eV = sel.map((r) => Math.abs(r[cv])), eN = sel.map((r) => Math.abs(r[cn]));
    return { dm: media(eN) - media(eV), de: pct(eN.filter((e) => e === 0).length, eN.length) - pct(eV.filter((e) => e === 0).length, eV.length) };
  };
  const oss = stat(perG.flat());
  const righe = [];
  for (const seme of [1, 7, 42, 2026, 987654321]) {
    const rnd = mulberry32(seme);
    const dm = [], de = [];
    for (let b = 0; b < 10000; b += 1) {
      const sel = [];
      for (let i = 0; i < perG.length; i += 1) sel.push(...perG[Math.floor(rnd() * perG.length)]);
      const s = stat(sel); dm.push(s.dm); de.push(s.de);
    }
    const q = (v, p) => { const s = [...v].sort((a, b) => a - b); return s[Math.min(s.length - 1, Math.max(0, Math.round(p * (s.length - 1))))]; };
    righe.push(`seme ${String(seme).padStart(9)}: IC95 Δmedia [${f3(q(dm, 0.025))}, ${f3(q(dm, 0.975))}] · IC95 Δesatti [${f2(q(de, 0.025))}, ${f2(q(de, 0.975))}] · nuovo migliore ${f1(pct(dm.filter((x) => x < 0).length, dm.length))}%`);
  }
  log(`  lettura ${k} · Δmedia osservata ${f3(oss.dm)} · Δesatti osservata ${f2(oss.de)} punti`);
  for (const r of righe) log(`    ${r}`);
}

// ── V9 · leave-one-race-out sul cancello ──
log(`\n══ V9 · IL CANCELLO REGGE SE TOLGO UNA GARA ALLA VOLTA? ══`);
for (const [k, [cv, cn]] of Object.entries(letture)) {
  const esiti = [];
  for (const g of P.gareSito) {
    const d = S[k].d.filter((r) => r.c.gara !== g);
    const v = riassunto(d.map((r) => r[cv])), n = riassunto(d.map((r) => r[cn]));
    esiti.push({ g, passa: n.med <= v.med && n.q_esatti >= v.q_esatti, dEs: n.q_esatti - v.q_esatti });
  }
  const falliti = esiti.filter((e) => !e.passa);
  log(`  lettura ${k.padEnd(2)}: cancello superato togliendo ${esiti.length - falliti.length}/${esiti.length} gare`
    + (falliti.length ? ` · FALLISCE togliendo: ${falliti.map((e) => e.g).join(', ')}` : '')
    + ` · Δesatti min ${f2(Math.min(...esiti.map((e) => e.dEs)))} max ${f2(Math.max(...esiti.map((e) => e.dEs)))}`);
}

// ── V7b · anche la LETTURA B ha un effetto-ampiezza, e va nella direzione OPPOSTA ──
log(`\n══ V7b · LA LETTURA B NON E' NEUTRA: dentro un anello piu' STRETTO si sbaglia di meno ══`);
{
  const popV = [], popN = [], popB2 = [];
  for (const r of app) {
    const sVero = new Set(r.c.ordineVero);
    popV.push(r.V.ordine.filter((d) => sVero.has(d)).length);
    popN.push(r.N.ordine.filter((d) => sVero.has(d)).length);
    const sV = new Set(r.V.ordine), sN = new Set(r.N.ordine);
    popB2.push(r.c.ordineVero.filter((d) => sV.has(d) && sN.has(d)).length);
  }
  log(`  ampiezza mediana dell'anello su cui si misura l'errore in lettura B: vecchio ${mediana(popV)} · nuovo ${mediana(popN)}`);
  log(`  ampiezza mediana dell'anello in lettura B2 (identico per i due): ${mediana(popB2)}`);
  log(`  → in lettura A vince chi ha il campo PIU' GRANDE (il nuovo); in lettura B chi ce l'ha`);
  log(`    piu' PICCOLO (il vecchio): l'errore massimo possibile e' |anello|−1.`);
  log(`    Solo la B2 mette i due sullo stesso anello. E' l'unica delle tre a essere un confronto.`);
}

// ── V10 · il vecchio NON troncato (quello che gira in produzione) ──
log(`\n══ V10 · E SE AL VECCHIO SI LASCIA IL byLap INTERO (com'e' in produzione)? ══`);
{
  const byId = new Map(R.map((r) => [r.c.id, r]));
  const varianti = {
    'troncato (banco)': {},
    'intero (produzione)': { troncato: false },
    'troncato + gradino da byLap intero': { gradinoDa: 'intero' },
    'intero + gradino da byLap troncato': { troncato: false, gradinoDa: 'troncato' },
  };
  for (const [nome, opz] of Object.entries(varianti)) {
    const eA = [], eAn = [], eC = [], eCn = [];
    let nOk = 0;
    for (const c of P.casi) {
      const V = vecchioMio(P.dati, c, opz);
      const alt = byId.get(c.id);
      if (!V.ok || !alt.N.ok) continue;
      nOk += 1;
      eA.push(V.pos - c.vera); eAn.push(alt.eAN);
      const sV = new Set(V.ordine), sN = new Set(alt.N.ordine);
      const d = new Set(c.ordineVero.filter((x) => sV.has(x) && sN.has(x)));
      const t = rango(c.ordineVero, d, c.pilota), a = rango(V.ordine, d, c.pilota), b = rango(alt.N.ordine, d, c.pilota);
      if (t && a && b) { eC.push(a - t); eCn.push(b - t); }
    }
    const vA = riassunto(eA), nA = riassunto(eAn), vC = riassunto(eC), nC = riassunto(eCn);
    const esito = (v, n) => (n.med <= v.med && n.q_esatti >= v.q_esatti ? 'IL NUOVO PASSA' : 'IL NUOVO NON PASSA');
    const vn = eC.filter((_, i) => Math.abs(eCn[i]) < Math.abs(eC[i])).length;
    const vv = eC.filter((_, i) => Math.abs(eCn[i]) > Math.abs(eC[i])).length;
    log(`  ${nome}  (appaiati ${nOk})`);
    log(`    A : vecchio med ${f1(vA.med)} media ${f2(vA.avg)} esatti ${f1(vA.q_esatti)}%  |  nuovo med ${f1(nA.med)} media ${f2(nA.avg)} esatti ${f1(nA.q_esatti)}%  → ${esito(vA, nA)}`);
    log(`    B2: vecchio med ${f1(vC.med)} media ${f2(vC.avg)} esatti ${f1(vC.q_esatti)}%  |  nuovo med ${f1(nC.med)} media ${f2(nC.avg)} esatti ${f1(nC.q_esatti)}%  → ${esito(vC, nC)}`);
    log(`        testa a testa B2: nuovo ${vn} · vecchio ${vv} → p esatto ${binomEsatta(vn, vn + vv).toFixed(4)}`);
  }
  log(`  (NON e' il confronto pre-registrato: il byLap intero E' una fuga dal futuro, misurata a parte in V4.`);
  log(`   Sta qui perche' "hanno handicappato il vecchio" e' l'accusa piu' ovvia e va guardata in faccia con un numero,`);
  log(`   e perche' separa il canale che pesa: il GRADINO letto sui giri dopo la sosta.)`);
}

// ── V11 · il troncamento toglie FUTURO o toglie anche PRESENTE? ──
log(`\n══ V11 · IL TRONCAMENTO TOGLIE SOLO IL FUTURO? (i canali, uno alla volta) ══`);
log(`  Dentro evaluatePit il byLap oltre il congelamento serve a tre cose:`);
log(`    (a) stessoGiroReale legge cum_time ai giri L..L+3 per sapere CHI E' GIA' DOPPIATO.`);
log(`        Non e' futuro: "quando io ho chiuso il giro L, il leader aveva gia' chiuso L+1"`);
log(`        e' un fatto vero all'istante del congelamento. Il banco lo cancella lo stesso.`);
log(`    (b) giroNeutralizzato = neutralized al giro DELLA SOSTA → questo si' e' futuro.`);
log(`    (c) il gradino post-sosta → futuro (gia' isolato in V10: non sposta niente).`);
log(`  Qui ricostruisco un vecchio SENZA FUTURO ma CON (a), e con (b) sostituito dalla stessa`);
log(`  assunzione che usa il nuovo: il regime visto al congelamento persiste un giro.\n`);
{
  const byId = new Map(R.map((r) => [r.c.id, r]));
  const costruisci = (c, { pariGiro, regimePersistente, regimeFuturo }) => {
    const { byLap, nLaps } = P.dati[c.gara];
    const bl = {};
    for (let k = 1; k <= c.L; k += 1) if (byLap[k]) bl[k] = byLap[k];
    if (pariGiro) {
      for (let k = c.L + 1; k <= Math.min(c.L + 3, nLaps); k += 1) {
        if (!byLap[k]) continue;
        const cars = {};
        // SOLO il cumulato: niente lap_time, niente compound, niente flag. Cosi' il gradino
        // non puo' guadagnarci nulla (verde() pretende lap_time e compound) e l'unico canale
        // riaperto e' quello del pari-giro.
        for (const d of Object.keys(byLap[k])) cars[d] = { cum_time: byLap[k][d].cum_time, neutralized: false };
        bl[k] = cars;
      }
    }
    if (regimePersistente || regimeFuturo) {
      const sorgente = regimeFuturo ? byLap[c.Li] : byLap[c.L];
      const base = bl[c.Li] ?? {};
      const cars = { ...base };
      for (const d of Object.keys(sorgente)) {
        cars[d] = { ...(base[d] ?? {}), neutralized: sorgente[d].neutralized === true };
      }
      bl[c.Li] = cars;
    }
    return bl;
  };
  const varianti = {
    'senza futuro, senza presente (= il banco)': { pariGiro: false, regimePersistente: false },
    'senza futuro, CON il pari-giro (a)': { pariGiro: true, regimePersistente: false },
    'senza futuro, CON regime persistente (b\')': { pariGiro: false, regimePersistente: true },
    'senza futuro, CON (a) + (b\') — il vecchio LEALE': { pariGiro: true, regimePersistente: true },
    'CON IL FUTURO: regime VERO al giro della sosta (b)': { pariGiro: false, regimeFuturo: true },
    'CON IL FUTURO: (a) + regime VERO (b)': { pariGiro: true, regimeFuturo: true },
  };
  for (const [nome, opz] of Object.entries(varianti)) {
    const eA = [], eAn = [], eC = [], eCn = [];
    let nOk = 0, muti = 0;
    for (const c of P.casi) {
      const V = vecchioMio(P.dati, c, { byLapOverride: costruisci(c, opz), gradinoDa: 'troncato' });
      const alt = byId.get(c.id);
      if (!V.ok) { muti += 1; continue; }
      if (!alt.N.ok) continue;
      nOk += 1;
      eA.push(V.pos - c.vera); eAn.push(alt.eAN);
      const sV = new Set(V.ordine), sN = new Set(alt.N.ordine);
      const d = new Set(c.ordineVero.filter((x) => sV.has(x) && sN.has(x)));
      const t = rango(c.ordineVero, d, c.pilota), a = rango(V.ordine, d, c.pilota), b = rango(alt.N.ordine, d, c.pilota);
      if (t && a && b) { eC.push(a - t); eCn.push(b - t); }
    }
    const vA = riassunto(eA), nA = riassunto(eAn), vC = riassunto(eC), nC = riassunto(eCn);
    const esito = (v, n) => (n.med <= v.med && n.q_esatti >= v.q_esatti ? 'IL NUOVO PASSA' : 'IL NUOVO NON PASSA');
    const vn = eC.filter((_, i) => Math.abs(eCn[i]) < Math.abs(eC[i])).length;
    const vv = eC.filter((_, i) => Math.abs(eCn[i]) > Math.abs(eC[i])).length;
    log(`  ${nome}   (appaiati ${nOk} · muti vecchio ${muti})`);
    log(`    A : vecchio med ${f1(vA.med)} media ${f2(vA.avg)} esatti ${f1(vA.q_esatti)}%  |  nuovo esatti ${f1(nA.q_esatti)}%  → ${esito(vA, nA)}`);
    log(`    B2: vecchio med ${f1(vC.med)} media ${f2(vC.avg)} esatti ${f1(vC.q_esatti)}%  |  nuovo med ${f1(nC.med)} media ${f2(nC.avg)} esatti ${f1(nC.q_esatti)}%  → ${esito(vC, nC)}`);
    log(`        testa a testa B2: nuovo ${vn} · vecchio ${vv} → p esatto ${binomEsatta(vn, vn + vv).toFixed(4)}`);
  }
  // controprova: la variante "leale" e' davvero senza futuro?
  const camp = [];
  for (const g of P.gareSito) {
    const d = app.filter((r) => r.c.gara === g);
    if (d.length) camp.push(d.reduce((m, x) => (Math.abs(x.c.L - x.c.nLaps / 2) < Math.abs(m.c.L - m.c.nLaps / 2) ? x : m)));
  }
  let cambia = 0;
  for (const r of camp) {
    const { byLap, nLaps } = P.dati[r.c.gara];
    const vero = costruisci(r.c, { pariGiro: true, regimePersistente: true });
    // stessa costruzione, ma i giri > L+3 (che nessuno dei tre canali puo' leggere) sporcati
    const falso = { ...vero };
    for (let k = r.c.L + 4; k <= nLaps; k += 1) if (byLap[k]) {
      const cars = {};
      for (const d of Object.keys(byLap[k])) cars[d] = { ...byLap[k][d], cum_time: byLap[k][d].cum_time + 999, neutralized: true };
      falso[k] = cars;
    }
    const a = vecchioMio(P.dati, r.c, { byLapOverride: vero, gradinoDa: 'troncato' });
    const b = vecchioMio(P.dati, r.c, { byLapOverride: falso, gradinoDa: 'troncato' });
    if (a.pos !== b.pos || a.su !== b.su) cambia += 1;
  }
  log(`  controprova sul "vecchio LEALE": sporcando i giri > L+3 la risposta cambia in ${cambia}/${camp.length}`);
  log(`  (il pari-giro guarda al massimo L+3; oltre, nessun canale deve reagire)`);
}

// ── V12 · e se i due motori ricevessero LO STESSO pit-loss? ──
log(`\n══ V12 · CONFRONTO NON ALLA PARI? I DUE RICEVONO PIT-LOSS DIVERSI ══`);
{
  const { perditaBox } = await import('../../simulatore/provenienza/pitloss.mjs');
  const byId = new Map(R.map((r) => [r.c.id, r]));
  log(`  gara              vecchio (demo/data/pitloss.json)   nuovo (prior, verde)   scarto`);
  for (const g of P.gareSito) {
    const p = perditaBox(ctxBase.prior, P.map[g], null);
    log(`  ${g.padEnd(16)} ${String(PITLOSS[g]).padStart(10)} s ${''.padEnd(12)} ${p.perdita_verde.toFixed(2).padStart(8)} s ${''.padEnd(6)} ${(PITLOSS[g] - p.perdita_verde).toFixed(2).padStart(7)} s  [${p.fonte}]`);
  }
  // rimisuro il vecchio con il pit-loss del NUOVO: l'unico modo di sapere quanto dello
  // scarto e' la tabella e quanto e' il motore.
  const eA = [], eAn = [], eC = [], eCn = [];
  for (const c of P.casi) {
    const p = perditaBox(ctxBase.prior, c.garaSim, null).perdita_verde;
    const arg = ingressiVecchioMio(P.dati, c);
    arg.pitLoss = p;
    let r; try { r = evaluatePit(arg); } catch { r = null; }
    const alt = byId.get(c.id);
    if (!r || r.ok !== true || !alt.N.ok) continue;
    const ordine = r.ordine_previsto.map(([d]) => d);
    eA.push(r.rientro_pos - c.vera); eAn.push(alt.eAN);
    const sV = new Set(ordine), sN = new Set(alt.N.ordine);
    const d = new Set(c.ordineVero.filter((x) => sV.has(x) && sN.has(x)));
    const t = rango(c.ordineVero, d, c.pilota), a = rango(ordine, d, c.pilota), b = rango(alt.N.ordine, d, c.pilota);
    if (t && a && b) { eC.push(a - t); eCn.push(b - t); }
  }
  const vA = riassunto(eA), nA = riassunto(eAn), vC = riassunto(eC), nC = riassunto(eCn);
  const esito = (v, n) => (n.med <= v.med && n.q_esatti >= v.q_esatti ? 'IL NUOVO PASSA' : 'IL NUOVO NON PASSA');
  log(`  VECCHIO (troncato) rimisurato COL PIT-LOSS DEL NUOVO, su ${eA.length} appaiati:`);
  log(`    A : vecchio med ${f1(vA.med)} media ${f2(vA.avg)} esatti ${vA.esatti} (${f1(vA.q_esatti)}%)  |  nuovo esatti ${nA.esatti} (${f1(nA.q_esatti)}%)  → ${esito(vA, nA)}`);
  log(`    B2: vecchio med ${f1(vC.med)} media ${f2(vC.avg)} esatti ${vC.esatti} (${f1(vC.q_esatti)}%)  |  nuovo med ${f1(nC.med)} media ${f2(nC.avg)} esatti ${nC.esatti} (${f1(nC.q_esatti)}%)  → ${esito(vC, nC)}`);
  log(`    (per contrasto, col pit-loss suo il vecchio in B2 faceva 96 esatti su 223 = 43.0%:`);
  log(`     cambiare SOLO la tabella del pit-loss gli porta ${vC.esatti - 96} esatti in piu' e chiude quasi tutto lo scarto)`);
  const vn = eC.filter((_, i) => Math.abs(eCn[i]) < Math.abs(eC[i])).length;
  const vv = eC.filter((_, i) => Math.abs(eCn[i]) > Math.abs(eC[i])).length;
  log(`        testa a testa B2: nuovo ${vn} · vecchio ${vv} → p esatto ${binomEsatta(vn, vn + vv).toFixed(4)}`);
}

// ── V13 · i 140 casi esclusi «doppiato al rientro»: l'esclusione favorisce qualcuno? ──
log(`\n══ V13 · I 140 ESCLUSI «DOPPIATO AL RIENTRO» — l'esclusione aiuta un motore? ══`);
{
  // ricostruisco il perimetro SENZA quel filtro e misuro M1 sui soli casi esclusi
  const extra = [];
  for (const g of P.gareSito) {
    const { G, byLap, nLaps } = P.dati[g];
    const leader = {};
    for (let k = 1; k <= nLaps; k += 1) {
      if (!byLap[k]) continue;
      let m = Infinity;
      for (const d of Object.keys(byLap[k])) { const t = byLap[k][d].cum_time; if (typeof t === 'number' && t < m) m = t; }
      if (m < Infinity) leader[k] = m;
    }
    for (let Li = PRIMO_GIRO_AMMESSO; Li <= nLaps; Li += 1) {
      if (!byLap[Li]) continue;
      for (const drv of Object.keys(byLap[Li])) {
        if (byLap[Li][drv].in_lap !== true) continue;
        const L = Li - 1, Lo = Li + 1;
        if (typeof byLap[L]?.[drv]?.cum_time !== 'number' || !byLap[Lo]) continue;
        const cumLo = byLap[Lo][drv]?.cum_time;
        if (typeof cumLo !== 'number') continue;
        if (!(leader[Lo + 1] !== undefined && cumLo > leader[Lo + 1])) continue;  // SOLO i doppiati
        const tempi = {};
        for (const d of Object.keys(byLap[Lo])) tempi[d] = byLap[Lo][d].cum_time;
        const { ordine } = classifica(tempi);
        extra.push({ id: `${g}|${drv}|${Li}`, gara: g, garaSim: P.map[g], pilota: drv, L, Li, Lo, nLaps,
          vera: ordine.indexOf(drv) + 1, suVeri: ordine.length, ordineVero: ordine,
          compoundAlCongelamento: byLap[L][drv].compound ?? null });
      }
    }
  }
  const eA = [], eAn = [], eC = [], eCn = [];
  let mutiV = 0, mutiN = 0;
  for (const c of extra) {
    const V = vecchioMio(P.dati, c);
    const N = nuovoMio(ctxBase, gareSim, c);
    if (!V.ok) mutiV += 1;
    if (!N.ok) mutiN += 1;
    if (!V.ok || !N.ok) continue;
    eA.push(V.pos - c.vera); eAn.push(N.pos - c.vera);
    const sV = new Set(V.ordine), sN = new Set(N.ordine);
    const d = new Set(c.ordineVero.filter((x) => sV.has(x) && sN.has(x)));
    const t = rango(c.ordineVero, d, c.pilota), a = rango(V.ordine, d, c.pilota), b = rango(N.ordine, d, c.pilota);
    if (t && a && b) { eC.push(a - t); eCn.push(b - t); }
  }
  const vA = riassunto(eA), nA = riassunto(eAn), vC = riassunto(eC), nC = riassunto(eCn);
  log(`  casi esclusi ritrovati ${extra.length} · muti vecchio ${mutiV} · muti nuovo ${mutiN} · appaiati ${eA.length}`);
  log(`    A : vecchio med ${f1(vA.med)} media ${f2(vA.avg)} esatti ${f1(vA.q_esatti)}%  |  nuovo med ${f1(nA.med)} media ${f2(nA.avg)} esatti ${f1(nA.q_esatti)}%`);
  log(`    B2: vecchio med ${f1(vC.med)} media ${f2(vC.avg)} esatti ${f1(vC.q_esatti)}%  |  nuovo med ${f1(nC.med)} media ${f2(nC.avg)} esatti ${f1(nC.q_esatti)}%`);
  const vn = eC.filter((_, i) => Math.abs(eCn[i]) < Math.abs(eC[i])).length;
  const vv = eC.filter((_, i) => Math.abs(eCn[i]) > Math.abs(eC[i])).length;
  log(`        testa a testa B2: nuovo ${vn} · vecchio ${vv} → p esatto ${binomEsatta(vn, vn + vv).toFixed(4)}`);
  log(`  (l'esclusione E' pre-registrata; questo dice solo in che verso avrebbe spinto tenerli)`);
}

// ── per gara ──
log(`\n══ PER GARA (blocchi) — lettura A e B, conto mio ══`);
log(`  gara              app | A: medV medN esattiV% esattiN% | B: medV medN esattiV% esattiN%`);
let gA = [0, 0, 0], gB = [0, 0, 0];
for (const g of P.gareSito) {
  const d = app.filter((r) => r.c.gara === g);
  const aV = riassunto(d.map((r) => r.eAV)), aN = riassunto(d.map((r) => r.eAN));
  const dB = d.filter((r) => r.eBV !== null && r.eBN !== null);
  const bV = riassunto(dB.map((r) => r.eBV)), bN = riassunto(dB.map((r) => r.eBN));
  if (aN.med < aV.med) gA[0] += 1; else if (aN.med > aV.med) gA[1] += 1; else gA[2] += 1;
  if (bN.med < bV.med) gB[0] += 1; else if (bN.med > bV.med) gB[1] += 1; else gB[2] += 1;
  log(`  ${g.padEnd(16)} ${String(d.length).padStart(3)} | ${f1(aV.med).padStart(5)} ${f1(aN.med).padStart(5)}`
    + ` ${f1(aV.q_esatti).padStart(7)}% ${f1(aN.q_esatti).padStart(7)}% | ${f1(bV.med).padStart(5)} ${f1(bN.med).padStart(5)}`
    + ` ${f1(bV.q_esatti).padStart(7)}% ${f1(bN.q_esatti).padStart(7)}%`);
}
log(`  gare vinte (mediana) A: nuovo ${gA[0]} · vecchio ${gA[1]} · pari ${gA[2]}   |   B: nuovo ${gB[0]} · vecchio ${gB[1]} · pari ${gB[2]}`);

// ── confronto finale con il banco dell'altro agente ──
log(`\n══ CONFRONTO CON IL BANCO DELL'ALTRO AGENTE (caso per caso) ══`);
{
  const banco = await import('./banco.mjs');
  const suoi = new Map(banco.casi().map((x) => [x.id, x]));
  let mancanti = 0, divVera = 0, divPosV = 0, divPosN = 0, divMutoV = 0, divMutoN = 0;
  for (const r of R) {
    const s = suoi.get(r.c.id);
    if (!s) { mancanti += 1; continue; }
    if (s.posizioneVera !== r.c.vera) divVera += 1;
    const sv = banco.rispostaVecchio(s), sn = banco.rispostaNuovo(s);
    if (sv.muto === r.V.ok) divMutoV += 1;
    if (sn.muto === r.N.ok) divMutoN += 1;
    if (sv.ok && r.V.ok && sv.pos !== r.V.pos) divPosV += 1;
    if (sn.ok && r.N.ok && sn.pos !== r.N.pos) divPosN += 1;
  }
  log(`  casi miei non presenti nel suo elenco: ${mancanti} · suoi casi ${suoi.size} · miei ${R.length}`);
  log(`  divergenze: verita' ${divVera} · muto vecchio ${divMutoV} · muto nuovo ${divMutoN} · posizione vecchio ${divPosV} · posizione nuovo ${divPosN}`);
}
