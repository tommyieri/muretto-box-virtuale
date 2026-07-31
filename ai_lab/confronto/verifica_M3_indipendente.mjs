#!/usr/bin/env node
// verifica_M3_indipendente.mjs — VERIFICA ADVERSARIALE di M3 (il «quando»).
//
//     node ai_lab/confronto/verifica_M3_indipendente.mjs
//     node ai_lab/confronto/verifica_M3_indipendente.mjs --json
//
// Non scrive niente su disco, non tocca demo/ simulatore/ data/.
//
// COSA VERIFICA, e perche' ognuna delle cose puo' ROMPERE il referto misurato:
//
//  A · IL PERIMETRO. Ricostruito da zero da demo/data/<gara>.json senza passare da
//      banco.mjs::casi(). Se il numero non e' 274, la popolazione era gia' un'altra.
//
//  B · LA CURVA DEL VECCHIO, ricostruita SENZA la scorciatoia `argomentiBase`: ogni
//      candidato riceve i suoi argomenti da capo, e il gradino si rimisura ogni volta.
//
//  C · LA CURVA DEL NUOVO, ricostruita SENZA usare `delta_s`: per ogni candidato si
//      chiama `costruisciScenario` + `eseguiEValida` e si legge `risultato.cum[pilota]`.
//      Se `delta_s` non fosse una pura traslazione del totale (o se qualche candidato
//      sparisse per strada), la classificazione cambierebbe.
//
//  D · IL GIRO FINALE E' DAVVERO COMUNE? Test diretto: i RIVALI (che non si fermano)
//      devono avere lo STESSO tempo simulato a fine finestra per ogni candidato. Se il
//      giro finale scivolasse col candidato, i loro tempi si muoverebbero.
//
//  E · LA CONVENZIONE DEL GIRO DI SOSTA. I due motori non azzerano l'eta gomma allo
//      stesso giro: si misura con un esperimento, non a occhio.
//
//  F · ALLINEAMENTO DI `tyre_age` fra le due fonti. `banco.mjs::verificaAllineamento`
//      confronta cum_time e compound e NON l'eta gomma — ma la forma della curva del
//      «quando» dipende SOLO dall'eta al congelamento e dai giri rimasti.
//
//  G · I DENOMINATORI. La quota di minimi interni cambia a seconda di dove si mettono
//      i MUTI. Si stampano tutte le letture, e i confronti a due a due a popolazione
//      identica per tutte le sei coppie.
//
//  H · I BUCHI. Un minimo puo' sembrare interno solo perche' i primi candidati non sono
//      stati valutati. Si contano gli interni che hanno un buco PRIMA del minimo.
//
//  I · TRONCAMENTO (regola 5) SUL MOTORE NUOVO. Il referto verificava il troncamento
//      solo sul vecchio. Qui si tronca il grezzo del simulatore a <= L e si ricalcola.
//
//  J · A vs B: la mescola cambia i TEMPI o solo la copertura?
//
//  K · I MUTI DEL NUOVO: davvero 14 sono «regola 6» e non rifiuti del Director?

import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { evaluatePit } from '../../demo/pitscenario.mjs';
import { misura as misuraGradino } from '../../demo/gradino.mjs';
import { caricaGare2026 } from '../../simulatore/provenienza/gare_2026.mjs';
import { caricaPrior } from '../../simulatore/provenienza/pitloss_dati.mjs';
import { caricaCostanti } from '../../simulatore/scenario/director_dati.mjs';
import { costruisciScenario, eseguiEValida, curvaDelQuando } from '../../simulatore/scenario/costruttore.mjs';
import { mescolePerSoste } from '../../simulatore/scenario/piano.mjs';
import { MESCOLE_SLICK_ATTUALI } from '../../simulatore/provenienza/vocabolario.mjs';
import { indicizza } from '../../simulatore/provenienza/gare_indice.mjs';

const QUI = path.dirname(fileURLToPath(import.meta.url));
const RADICE = path.resolve(QUI, '..', '..');
const DEMO_DATA = path.join(RADICE, 'demo', 'data');
const SIM = path.join(RADICE, 'simulatore');
const JSONOUT = process.argv.includes('--json');

const PIATTA_S = 0.01;      // stessa soglia del referto sotto esame
const MIN_SOSTE_UI = 3;
const ZONE = 0;
const PRIMO_GIRO_AMMESSO = 4;

const mediana = (v) => {
  if (!v.length) return null;
  const s = [...v].sort((a, b) => a - b);
  const m = s.length >> 1;
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};
const pct = (a, b) => (b ? `${(100 * a / b).toFixed(1)}%` : 'n/d');
const R = [];
const dire = (s = '') => { R.push(s); if (!JSONOUT) console.log(s); };

// ════════════════════════════════════════════════════════════ A · IL PERIMETRO
const manifest = JSON.parse(readFileSync(path.join(DEMO_DATA, 'vista', 'manifest.json'), 'utf8'));
const SITO2SIM = manifest.cartella_di;
const GARE = Object.keys(SITO2SIM).sort();
const PITLOSS = JSON.parse(readFileSync(path.join(DEMO_DATA, 'pitloss.json'), 'utf8'));

const demoDi = new Map();
function demo(g) {
  if (demoDi.has(g)) return demoDi.get(g);
  const G = JSON.parse(readFileSync(path.join(DEMO_DATA, `${g}.json`), 'utf8'));
  const byLap = {};
  for (const l of G.laps) byLap[l.lap] = l.cars;
  const v = { G, byLap, nLaps: G.n_laps, pitLoss: PITLOSS[g] };
  demoDi.set(g, v);
  return v;
}

/** Il perimetro, ricostruito da zero dalla prereg. */
function perimetro() {
  const out = [];
  for (const g of GARE) {
    const { G, byLap, nLaps } = demo(g);
    const leader = {};
    for (let k = 1; k <= nLaps; k += 1) {
      if (!byLap[k]) continue;
      let m = Infinity;
      for (const d of Object.keys(byLap[k])) {
        const t = byLap[k][d].cum_time;
        if (typeof t === 'number' && t < m) m = t;
      }
      if (m < Infinity) leader[k] = m;
    }
    const doppiato = (Lo, cum) => leader[Lo + 1] !== undefined && cum > leader[Lo + 1];
    for (let Li = 1; Li <= nLaps; Li += 1) {
      if (!byLap[Li]) continue;
      for (const drv of Object.keys(byLap[Li])) {
        if (byLap[Li][drv].in_lap !== true) continue;
        const L = Li - 1, Lo = Li + 1;
        if (Li < PRIMO_GIRO_AMMESSO) continue;
        if (typeof byLap[L]?.[drv]?.cum_time !== 'number') continue;
        if (!byLap[Lo]) continue;
        const cumLo = byLap[Lo][drv]?.cum_time;
        if (typeof cumLo !== 'number') continue;
        if (doppiato(Lo, cumLo)) continue;
        out.push({ id: `${g}|${drv}|${Li}`, gara: g, garaSim: SITO2SIM[g], pilota: drv,
                   freezeLap: L, pitLap: Li, nGiri: nLaps,
                   mescolaAlCongelamento: byLap[L][drv].compound ?? null,
                   etaAlCongelamento: byLap[L][drv].tyre_age ?? null });
      }
    }
  }
  out.sort((a, b) => (a.gara < b.gara ? -1 : a.gara > b.gara ? 1
    : a.pitLap - b.pitLap || (a.pilota < b.pilota ? -1 : 1)));
  return out;
}

const CASI = perimetro();

// ═══════════════════════════════════════════════════ contesto del motore NUOVO
const GARE_SIM = caricaGare2026(SIM);
const MODELLO = JSON.parse(readFileSync(path.join(SIM, 'data', 'modelli', 'modello_v2.json'), 'utf8'));
const PRIOR = caricaPrior(SIM);
const COSTANTI = caricaCostanti(SIM);
const BANDA = JSON.parse(readFileSync(path.join(SIM, 'data', 'modelli', 'banda_rientro.json'), 'utf8'));
const CONTESTO = { gare: GARE_SIM, modello: MODELLO, prior: PRIOR, costantiDirector: COSTANTI,
                   bandaRientro: BANDA, nGiriGara: null };
const ctx = (caso, extra = {}) => ({ ...CONTESTO, nGiriGara: GARE_SIM[caso.garaSim].nGiri, ...extra });

const MODELLO_PASSO = JSON.parse(readFileSync(path.join(DEMO_DATA, 'modello_passo_2026.json'), 'utf8'));
const PASSO_V2 = { delta: MODELLO_PASSO.deriva.delta_gara_s, rho: MODELLO_PASSO.degrado.rho_s_giro };

// ══════════════════════════════════════════ B · la curva del VECCHIO, strada lunga
/** Argomenti ricostruiti DA CAPO per ogni candidato (nessuna memoizzazione). */
function argVecchio(caso, pitLap, orizzonte, { troncato = true } = {}) {
  const { G, byLap, nLaps, pitLoss } = demo(caso.gara);
  const L = caso.freezeLap;
  let bl = byLap;
  if (troncato) { bl = {}; for (let k = 1; k <= L; k += 1) if (byLap[k]) bl[k] = byLap[k]; }
  const pace = G.pace[String(L)] || {};
  const present = G.drivers.filter((d) => typeof bl[L]?.[d]?.cum_time === 'number' && pace[d] != null);
  const viva = misuraGradino(bl, nLaps, L);
  const gradino = (viva.gradino != null && viva.n_gradino >= MIN_SOSTE_UI) ? viva.gradino : null;
  return { byLap: bl, nLaps, pace, driver: caso.pilota, freezeLap: L, pitLap, pitLoss, present,
           gara: caso.gara, laps: G.laps, ZONE, orizzonte, gradino };
}

/** @returns { punti:[[pit,totale]] | null, motivo, rivali: Map(pit -> {drv:tempo}) } */
function curvaVecchio(caso, passo, H, { scarto = 0, rivali = false, troncato = true } = {}) {
  const L = caso.freezeLap;
  const punti = [];
  const tavolaRivali = rivali ? new Map() : null;
  for (let p = L + 1; p <= H - 1; p += 1) {
    // `scarto` sposta il giro DICHIARATO al motore senza spostare l'ascissa della curva:
    // serve al test E (convenzione del giro di sosta), non al conto principale (scarto=0).
    const pDichiarato = p + scarto;
    if (pDichiarato <= L || pDichiarato > H - 1) { continue; }
    const a = argVecchio(caso, pDichiarato, H - pDichiarato - 1, { troncato });
    let r;
    try {
      r = evaluatePit({ ...a, passo, gradino: passo ? null : a.gradino, deriva: null });
    } catch (e) { return { punti: null, motivo: `eccezione: ${e.message}` }; }
    if (!r?.ok) return { punti: null, motivo: r?.reason ?? 'nessuna risposta' };
    const mio = r.ordine_previsto.find(([d]) => d === caso.pilota);
    if (!mio) return { punti: null, motivo: 'il pilota non compare nell\'ordine previsto' };
    punti.push([p, mio[1]]);
    if (tavolaRivali) tavolaRivali.set(p, Object.fromEntries(r.ordine_previsto));
  }
  if (punti.length < 3) return { punti: null, motivo: `meno di 3 candidati (${punti.length})` };
  return { punti, motivo: null, rivali: tavolaRivali };
}

// ══════════════════════════════════════ C · la curva del NUOVO, totali ricalcolati
function slickUsate(caso, gSim = GARE_SIM[caso.garaSim]) {
  const u = new Set();
  for (const [lap, c] of gSim.perPilota.get(caso.pilota) ?? []) {
    if (lap <= caso.freezeLap && c.compound !== null && MESCOLE_SLICK_ATTUALI.has(c.compound)) u.add(c.compound);
  }
  return u;
}
const mescolaLegale = (caso) => mescolePerSoste(1, slickUsate(caso))[0] ?? null;

/**
 * La curva del nuovo calcolata SENZA `curvaDelQuando`: scenario per scenario, con il
 * cum del pilota letto dal risultato del kernel. Se `curvaDelQuando` filtrasse o
 * traslasse in modo non innocuo, qui si vedrebbe.
 */
function curvaNuovoDaZero(caso, mescola, H, { gare = GARE_SIM, rivali = false } = {}) {
  if (mescola === null) return { punti: null, motivo: 'nessuna mescola slick', respinti: 0, approvati: 0 };
  const L = caso.freezeLap;
  const punti = [];
  const tavolaRivali = rivali ? new Map() : null;
  let respinti = 0, senzaTotale = 0;
  for (let p = L + 1; p <= H - 1; p += 1) {
    let sc;
    try {
      sc = costruisciScenario({ gara: caso.garaSim, freezeLap: L, pilota: caso.pilota, giroPit: p, mescola },
                              { ...ctx(caso), gare, giroFinale: H });
    } catch (e) { return { punti: null, motivo: `eccezione: ${e.message}`, respinti, approvati: punti.length }; }
    const { risultato, direttore } = eseguiEValida(sc, COSTANTI);
    if (!direttore.approved) { respinti += 1; continue; }
    const t = risultato.cum[caso.pilota];
    if (t === null || t === undefined) { senzaTotale += 1; continue; }
    punti.push([p, t]);
    if (tavolaRivali) tavolaRivali.set(p, { ...risultato.cum });
  }
  if (punti.length < 3) {
    return { punti: null, respinti, approvati: punti.length,
             motivo: respinti > 0 ? `respinti dal Director (${respinti})` : `nessun totale (regola 6, ${senzaTotale})` };
  }
  return { punti, motivo: null, respinti, approvati: punti.length, rivali: tavolaRivali };
}

/** La curva del nuovo COME LA DA' il prodotto (delta_s di curvaDelQuando). */
function curvaNuovoProdotto(caso, mescola, H) {
  if (mescola === null) return { punti: null, motivo: 'nessuna mescola slick' };
  let r;
  try {
    r = curvaDelQuando({ gara: caso.garaSim, freezeLap: caso.freezeLap, pilota: caso.pilota, mescola },
                       ctx(caso, { giroFinale: H }));
  } catch (e) { return { punti: null, motivo: `eccezione: ${e.message}` }; }
  if (!r || r.approvato !== true) {
    const viol = (r?.direttore?.violazioni ?? []).filter((v) => v.severita === 'FATAL');
    const cod = [...new Set(viol.map((v) => v.codice ?? v.messaggio))];
    return { punti: null, respinti: r?.respinti ?? 0, approvedDirector: r?.direttore?.approved ?? null,
             motivo: (r?.respinti ?? 0) > 0 || cod.length ? `Director: ${cod.join('·') || 'senza codice'}` : 'regola 6' };
  }
  if (!r.curva?.length) return { punti: null, motivo: 'curva vuota' };
  const punti = r.curva.map((c) => [c.giroPit, c.delta_s]);
  if (punti.length < 3) return { punti: null, motivo: `meno di 3 candidati (${punti.length})` };
  return { punti, motivo: null, respinti: r.respinti_dal_director };
}

// ════════════════════════════════════════════════════════ classificazione (S5)
function classifica(punti, L) {
  const v = punti.map((x) => x[1]);
  const min = Math.min(...v), max = Math.max(...v);
  const iMin = v.reduce((m, x, i) => (x < v[m] ? i : m), 0);
  const piatta = (max - min) <= PIATTA_S;
  return { n: punti.length, ampiezza: max - min, iMin, piatta,
           giroMin: punti[iMin][0], primoGiro: punti[0][0], ultimoGiro: punti[punti.length - 1][0],
           buchiPrima: punti[iMin][0] - punti[0][0] - iMin,
           primoEDavveroIlPrimo: punti[0][0] === L + 1,
           dove: piatta ? 'piatta' : (iMin === 0 ? 'primo' : (iMin === punti.length - 1 ? 'ultimo' : 'interno')) };
}

// ════════════════════════════════════════════════════════════════ ESECUZIONE
const MOTORI = ['V-null', 'V-v2', 'N-A', 'N-B'];
const esiti = CASI.map(() => ({}));
const mescoleA = CASI.map((c) => (MESCOLE_SLICK_ATTUALI.has(c.mescolaAlCongelamento) ? c.mescolaAlCongelamento : null));
const mescoleB = CASI.map((c) => mescolaLegale(c));

for (let i = 0; i < CASI.length; i += 1) {
  const c = CASI[i];
  const H = c.nGiri;
  esiti[i]['V-null'] = curvaVecchio(c, null, H);
  esiti[i]['V-v2'] = curvaVecchio(c, PASSO_V2, H);
  esiti[i]['N-A'] = curvaNuovoDaZero(c, mescoleA[i], H);
  esiti[i]['N-B'] = curvaNuovoDaZero(c, mescoleB[i], H);
  for (const m of MOTORI) {
    const e = esiti[i][m];
    e.cls = e.punti ? classifica(e.punti, c.freezeLap) : null;
  }
}

function conta(m, filtro = () => true) {
  const v = CASI.map((c, i) => ({ c, e: esiti[i][m] })).filter(({ c }) => filtro(c));
  const con = v.filter((x) => x.e.cls);
  return { casi: v.length, curve: con.length, muti: v.length - con.length,
           piatte: con.filter((x) => x.e.cls.dove === 'piatta').length,
           interni: con.filter((x) => x.e.cls.dove === 'interno').length,
           primo: con.filter((x) => x.e.cls.dove === 'primo').length,
           ultimo: con.filter((x) => x.e.cls.dove === 'ultimo').length,
           ampiezza: mediana(con.map((x) => x.e.cls.ampiezza)) };
}

dire('VERIFICA ADVERSARIALE DI M3 — misura indipendente');
dire('');
dire('A · IL PERIMETRO, ricostruito da zero (non da banco.mjs::casi)');
dire(`  soste vere ammesse: ${CASI.length}   gare: ${GARE.length}`);
const perGara = {};
for (const c of CASI) perGara[c.gara] = (perGara[c.gara] ?? 0) + 1;
dire(`  per gara: ${Object.entries(perGara).map(([g, n]) => `${g} ${n}`).join(' · ')}`);

dire('');
dire('B+C · IL CONTO PRINCIPALE, ricalcolato (H = bandiera, candidati L+1..H-1)');
dire('      vecchio: argomenti ricostruiti a OGNI candidato (niente scorciatoia)');
dire('      nuovo:   totali dal kernel, NON da delta_s');
for (const m of MOTORI) {
  const x = conta(m);
  dire(`  ${m.padEnd(7)} curve ${String(x.curve).padStart(3)}/${x.casi}  muti ${String(x.muti).padStart(3)}`
    + `  piatte ${String(x.piatte).padStart(3)}  INTERNI ${String(x.interni).padStart(3)} (${pct(x.interni, x.curve)})`
    + `  primo ${String(x.primo).padStart(3)} (${pct(x.primo, x.curve)})  ultimo ${x.ultimo}`
    + `  ampiezza mediana ${x.ampiezza === null ? 'n/d' : x.ampiezza.toFixed(3)} s`);
}

// —— C-bis: delta_s del prodotto contro i totali ricalcolati ——
let cmp = { n: 0, stessoGiroMin: 0, stessaClasse: 0, stessiPunti: 0, diversi: [] };
for (let i = 0; i < CASI.length; i += 1) {
  const mio = esiti[i]['N-B'];
  if (!mio.cls) continue;
  const prod = curvaNuovoProdotto(CASI[i], mescoleB[i], CASI[i].nGiri);
  if (!prod.punti) { cmp.diversi.push(`${CASI[i].id}: prodotto muto, io no`); continue; }
  const cp = classifica(prod.punti, CASI[i].freezeLap);
  cmp.n += 1;
  if (cp.giroMin === mio.cls.giroMin) cmp.stessoGiroMin += 1;
  if (cp.dove === mio.cls.dove) cmp.stessaClasse += 1;
  if (cp.n === mio.cls.n) cmp.stessiPunti += 1;
}
dire('');
dire('C-bis · `delta_s` (quello che usa il referto) contro i totali ricalcolati da me');
dire(`  n=${cmp.n} · stesso giro del minimo ${cmp.stessoGiroMin} · stessa classe ${cmp.stessaClasse} · stesso n. punti ${cmp.stessiPunti}`);
if (cmp.diversi.length) dire(`  divergenze di copertura: ${cmp.diversi.slice(0, 5).join(' | ')}`);

// —— D · il giro finale e' comune? ——
dire('');
dire('D · IL GIRO FINALE E\' DAVVERO COMUNE? (i rivali non si fermano: il loro tempo a fine');
dire('    finestra deve essere IDENTICO per ogni candidato — se scivolasse, si muoverebbe)');
const provaD = { vecchio: { n: 0, mosse: 0, max: 0 }, nuovo: { n: 0, mosse: 0, max: 0 } };
for (const idx of [7, 60, 130, 200, 260]) {
  const c = CASI[idx]; if (!c) continue;
  const cv = curvaVecchio(c, PASSO_V2, c.nGiri, { rivali: true });
  if (cv.rivali) {
    const chiavi = [...cv.rivali.keys()];
    const rif = cv.rivali.get(chiavi[0]);
    for (const k of chiavi.slice(1)) {
      for (const [d, t] of Object.entries(cv.rivali.get(k))) {
        if (d === c.pilota || rif[d] === undefined) continue;
        provaD.vecchio.n += 1;
        const s = Math.abs(t - rif[d]);
        if (s > 1e-6) provaD.vecchio.mosse += 1;
        if (s > provaD.vecchio.max) provaD.vecchio.max = s;
      }
    }
  }
  const cn = curvaNuovoDaZero(c, mescoleB[idx], c.nGiri, { rivali: true });
  if (cn.rivali) {
    const chiavi = [...cn.rivali.keys()];
    const rif = cn.rivali.get(chiavi[0]);
    for (const k of chiavi.slice(1)) {
      for (const [d, t] of Object.entries(cn.rivali.get(k))) {
        if (d === c.pilota || rif[d] == null || t == null) continue;
        provaD.nuovo.n += 1;
        const s = Math.abs(t - rif[d]);
        if (s > 1e-6) provaD.nuovo.mosse += 1;
        if (s > provaD.nuovo.max) provaD.nuovo.max = s;
      }
    }
  }
}
dire(`  VECCHIO: ${provaD.vecchio.n} confronti rivale×candidato · tempi che si muovono ${provaD.vecchio.mosse} (scarto max ${provaD.vecchio.max.toExponential(2)} s)`);
dire(`  NUOVO  : ${provaD.nuovo.n} confronti rivale×candidato · tempi che si muovono ${provaD.nuovo.mosse} (scarto max ${provaD.nuovo.max.toExponential(2)} s)`);

// —— E · la convenzione del giro di sosta ——
dire('');
dire('E · LA CONVENZIONE DEL GIRO DI SOSTA. Stesso `pitLap` dichiarato ai due motori:');
dire('    vuol dire la stessa cosa? Si confronta il giro del minimo, e poi lo si rifa');
dire('    dichiarando al VECCHIO un giro spostato di −1, −2 (l\'ascissa della curva resta');
dire('    la stessa: si sposta solo cio\' che il motore capisce).');
const scarti = { 0: [], '-1': [], '-2': [] };
for (const s of [0, -1, -2]) {
  for (let i = 0; i < CASI.length; i += 1) {
    const n = esiti[i]['N-B']; if (!n.cls) continue;
    const v = s === 0 ? esiti[i]['V-v2'] : curvaVecchio(CASI[i], PASSO_V2, CASI[i].nGiri, { scarto: s });
    const cls = s === 0 ? v.cls : (v.punti ? classifica(v.punti, CASI[i].freezeLap) : null);
    if (!cls) continue;
    scarti[String(s)].push(n.cls.giroMin - cls.giroMin);
  }
}
for (const s of ['0', '-1', '-2']) {
  const d = scarti[s];
  dire(`  vecchio con giro dichiarato ${s.padStart(2)}: n=${d.length} · scarto del minimo (nuovo − vecchio) mediana ${mediana(d)}`
    + ` · uguale in ${d.filter((x) => x === 0).length} (${pct(d.filter((x) => x === 0).length, d.length)})`);
}

// —— F · tyre_age allineata fra le due fonti? ——
dire('');
dire('F · `tyre_age` E\' ALLINEATA FRA LE DUE FONTI? (banco.mjs verifica cum_time e compound,');
dire('    non l\'eta — ma la forma della curva dipende SOLO da eta al congelamento e giri rimasti)');
let allF = { celle: 0, diverse: 0, esempi: [], soloUno: 0, casiEtaDiversa: 0 };
for (const g of GARE) {
  const { byLap } = demo(g);
  const gS = GARE_SIM[SITO2SIM[g]];
  for (const [drv, celle] of gS.perPilota) {
    for (const [lap, cella] of celle) {
      const d = byLap[lap]?.[drv];
      if (!d) { allF.soloUno += 1; continue; }
      allF.celle += 1;
      const a = cella.tyre_age ?? null, b = d.tyre_age ?? null;
      if (a !== b) {
        allF.diverse += 1;
        if (allF.esempi.length < 6) allF.esempi.push(`${g}|${drv}|g${lap}: sim ${a} vs sito ${b}`);
      }
    }
  }
}
for (const c of CASI) {
  const sim = GARE_SIM[c.garaSim].perPilota.get(c.pilota)?.get(c.freezeLap);
  if (!sim) continue;
  if ((sim.tyre_age ?? null) !== (c.etaAlCongelamento ?? null)) allF.casiEtaDiversa += 1;
}
dire(`  celle confrontate ${allF.celle} · tyre_age divergenti ${allF.diverse} (${pct(allF.diverse, allF.celle)})`);
dire(`  sui ${CASI.length} congelamenti del perimetro: eta diversa in ${allF.casiEtaDiversa}`);
if (allF.esempi.length) dire(`  esempi: ${allF.esempi.join(' | ')}`);

// —— G · i denominatori ——
dire('');
dire('G · I DENOMINATORI. La quota di minimi interni con i MUTI dentro e fuori.');
for (const m of MOTORI) {
  const x = conta(m);
  dire(`  ${m.padEnd(7)} interni/curve ${x.interni}/${x.curve} = ${pct(x.interni, x.curve)}`
    + `   ·   interni/CASI ${x.interni}/${x.casi} = ${pct(x.interni, x.casi)}   (muto = non interno)`);
}
dire('');
dire('  a due a due, popolazione IDENTICA (solo i casi in cui rispondono entrambi):');
for (let a = 0; a < MOTORI.length; a += 1) {
  for (let b = a + 1; b < MOTORI.length; b += 1) {
    const cop = CASI.map((c, i) => esiti[i]).filter((e) => e[MOTORI[a]].cls && e[MOTORI[b]].cls);
    const ia = cop.filter((e) => e[MOTORI[a]].cls.dove === 'interno').length;
    const ib = cop.filter((e) => e[MOTORI[b]].cls.dove === 'interno').length;
    const d = cop.map((e) => e[MOTORI[b]].cls.giroMin - e[MOTORI[a]].cls.giroMin);
    dire(`    ${MOTORI[a].padEnd(7)} vs ${MOTORI[b].padEnd(7)} n=${String(cop.length).padStart(3)}`
      + `  ${String(ia).padStart(3)} (${pct(ia, cop.length).padStart(6)})  vs  ${String(ib).padStart(3)} (${pct(ib, cop.length).padStart(6)})`
      + `  · scarto minimo mediana ${mediana(d)}`);
  }
}

// —— H · i buchi ——
dire('');
dire('H · I BUCHI. Un minimo e\' «interno» solo perche\' i primi candidati mancano?');
for (const m of MOTORI) {
  const v = CASI.map((c, i) => esiti[i][m]).filter((e) => e.cls);
  const interni = v.filter((e) => e.cls.dove === 'interno');
  const sospetti = interni.filter((e) => e.cls.buchiPrima > 0 || !e.cls.primoEDavveroIlPrimo);
  dire(`  ${m.padEnd(7)} curve ${v.length} · con buchi ${v.filter((e) => e.cls.buchiPrima > 0 || !e.cls.primoEDavveroIlPrimo).length}`
    + ` · INTERNI ${interni.length} di cui con un buco prima del minimo ${sospetti.length}`
    + ` → interni «puliti» ${interni.length - sospetti.length}`);
}

// —— I · troncamento del motore NUOVO ——
dire('');
dire('I · TRONCAMENTO (regola 5) SUL MOTORE NUOVO: si tronca il grezzo del simulatore a');
dire('    <= L e si ricalcola. Se la classificazione cambiasse, il nuovo leggerebbe il futuro.');
const tronc = { n: 0, classeCambia: 0, minimoCambia: 0, esempi: [] };
const passo = Math.max(1, Math.floor(CASI.length / 40));
for (let i = 0; i < CASI.length; i += passo) {
  const c = CASI[i];
  const base = esiti[i]['N-B'];
  if (!base.cls) continue;
  const g = GARE_SIM[c.garaSim];
  const righe = g.righe.filter((r) => r.lap <= c.freezeLap);
  const gT = { ...g, ...indicizza(righe), nGiri: g.nGiri };
  const t = curvaNuovoDaZero(c, mescoleB[i], c.nGiri, { gare: { ...GARE_SIM, [c.garaSim]: gT } });
  if (!t.punti) { tronc.esempi.push(`${c.id}: muto solo da troncato (${t.motivo})`); continue; }
  const ct = classifica(t.punti, c.freezeLap);
  tronc.n += 1;
  if (ct.dove !== base.cls.dove) tronc.classeCambia += 1;
  if (ct.giroMin !== base.cls.giroMin) { tronc.minimoCambia += 1; if (tronc.esempi.length < 5) tronc.esempi.push(`${c.id}: min ${base.cls.giroMin}→${ct.giroMin}`); }
}
dire(`  campione ${tronc.n} casi · classe che cambia ${tronc.classeCambia} · giro del minimo che cambia ${tronc.minimoCambia}`);
if (tronc.esempi.length) dire(`  ${tronc.esempi.join(' | ')}`);

// —— J · A contro B ——
dire('');
dire('J · LA MESCOLA (A = al congelamento, come il sito · B = quella legale del repo)');
const AB = { entrambi: 0, stessaClasse: 0, stessoMinimo: 0, stessoTempo: 0, soloA: 0, soloB: 0, stessaMescola: 0 };
for (let i = 0; i < CASI.length; i += 1) {
  const a = esiti[i]['N-A'], b = esiti[i]['N-B'];
  if (mescoleA[i] === mescoleB[i]) AB.stessaMescola += 1;
  if (a.cls && !b.cls) AB.soloA += 1;
  if (b.cls && !a.cls) AB.soloB += 1;
  if (!a.cls || !b.cls) continue;
  AB.entrambi += 1;
  if (a.cls.dove === b.cls.dove) AB.stessaClasse += 1;
  if (a.cls.giroMin === b.cls.giroMin) AB.stessoMinimo += 1;
  const ta = a.punti.map((x) => x[1]), tb = b.punti.map((x) => x[1]);
  if (ta.length === tb.length && ta.every((x, k) => Math.abs(x - tb[k]) < 1e-9)) AB.stessoTempo += 1;
}
dire(`  mescola identica in ${AB.stessaMescola}/${CASI.length} casi`);
dire(`  rispondono entrambi ${AB.entrambi} · stessa classe ${AB.stessaClasse} · stesso giro del minimo ${AB.stessoMinimo} · tempi bit-identici ${AB.stessoTempo}`);
dire(`  risponde solo A ${AB.soloA} · risponde solo B ${AB.soloB}   (A ⊂ B se «solo A» = 0)`);

// —— K · i muti del nuovo ——
dire('');
dire('K · I MUTI DEL NUOVO, per natura (rifiuto del Director vs regola 6)');
for (const [nome, mesc] of [['N-A', mescoleA], ['N-B', mescoleB]]) {
  const mot = {};
  for (let i = 0; i < CASI.length; i += 1) {
    if (esiti[i][nome].cls) continue;
    const prod = curvaNuovoProdotto(CASI[i], mesc[i], CASI[i].nGiri);
    const k = `${prod.motivo} | respinti=${prod.respinti ?? 0} | directorApproved=${prod.approvedDirector}`;
    mot[k] = (mot[k] ?? 0) + 1;
  }
  dire(`  ${nome}: ${Object.entries(mot).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${v} × ${k}`).join('  ·  ')}`);
}

// —— muti del vecchio ——
dire('');
dire('  i muti del VECCHIO, per motivo:');
for (const m of ['V-null', 'V-v2']) {
  const mot = {};
  for (let i = 0; i < CASI.length; i += 1) {
    if (esiti[i][m].cls) continue;
    const k = esiti[i][m].motivo;
    mot[k] = (mot[k] ?? 0) + 1;
  }
  dire(`  ${m}: ${Object.entries(mot).map(([k, v]) => `${v} × ${k}`).join(' · ')}`);
}

// —— per gara ——
dire('');
dire('PER GARA (interni/curve)');
for (const g of GARE) {
  const celle = MOTORI.map((m) => {
    const x = conta(m, (c) => c.gara === g);
    return x.curve ? `${x.interni}/${x.curve}`.padStart(10) : 'muto'.padStart(10);
  });
  dire(`  ${g.padEnd(16)}${celle.join('')}`);
}

if (JSONOUT) console.log(JSON.stringify({ righe: R }, null, 1));
