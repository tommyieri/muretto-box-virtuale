// fisica_sc.mjs — LA FISICA CHE MANCA SOTTO NEUTRALIZZAZIONE.
//
//     node ai_lab/confronto/fisica_sc.mjs
//
// Il modello v2 ha UNA fisica sola: t = base + delta*(giro-1) + rho*eta. Sotto
// Safety Car quella fisica non descrive niente — misurato: il giro sotto SC
// dura +40,4 s (rapporto 1,433) e sotto VSC +13,7 s (1,163). Il motore nuovo
// conosce il regime al congelamento (informazione <= L, e' gia' nella cella) ma
// lo usa SOLO per scontare il pit-loss, e solo se la sosta cade entro
// PERSISTENZA_REGIME_GIRI = 1 giro. Il PASSO resta verde.
//
// Qui si misura il controfattuale minimo e onesto:
//   A · attuale        passo verde su tutti i giri proiettati
//   C · gap congelato  finche' si assume il regime in corso, i distacchi NON
//                      crescono (sotto SC tutti girano al passo della SC: il
//                      distacco e' cio' che il prodotto usa, e sotto SC non
//                      cambia). Dopo, passo verde.
//   D · come C, piu' COMPRESSIONE verso la coda della SC.
//
// La persistenza NON e' inventata: e' misurata in fisica_sonde.mjs (S5) e qui
// si ri-misura, perche' e' il parametro che decide quanti giri dura C.
//
// NON SCRIVE NIENTE su disco. Non tocca demo/, simulatore/, data/.

import path from 'node:path';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { caricaGare2026 } from '../../simulatore/provenienza/gare_2026.mjs';
import { passoUtilizzabile, regimeNeutralizzato } from '../../simulatore/provenienza/definizioni.mjs';
import { simboliStatus } from '../../simulatore/provenienza/vocabolario.mjs';

const QUI = path.dirname(fileURLToPath(import.meta.url));
const RADICE = path.resolve(QUI, '..', '..');
const SIM = path.join(RADICE, 'simulatore');
const MODELLO = JSON.parse(readFileSync(path.join(SIM, 'data', 'modelli', 'modello_v2.json'), 'utf8'));
const RHO = MODELLO.rho.valore;
const DELTA70 = MODELLO.delta_70.scelto;
const MIN_GIRI_BASE = 8;

const ORIZZONTI = [3, 5, 10];
const H_MAX = 10;
const PRIMO = 5;
const PASSO = 2;

const mediana = (v) => { if (!v.length) return null; const s = [...v].sort((a, b) => a - b); const m = s.length >> 1; return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; };
const media = (v) => (v.length ? v.reduce((a, b) => a + b, 0) / v.length : null);
const f = (x, n = 3) => (x === null || x === undefined ? '  —  ' : x.toFixed(n));

const gare = caricaGare2026(SIM);
const NOMI = Object.keys(gare).sort();

const dati = {};
for (const nome of NOMI) {
  const g = gare[nome];
  const perGiro = new Map();
  for (const { drv, lap, cella } of g.righe) {
    if (!perGiro.has(lap)) perGiro.set(lap, new Map());
    perGiro.get(lap).set(drv, cella);
  }
  const oss = [];
  for (const { drv, lap, cella } of g.righe) {
    let ok = false;
    try { ok = passoUtilizzabile(cella) && cella.tyre_age !== null; } catch { ok = false; }
    if (ok) oss.push({ drv, lap, eta: cella.tyre_age, t: cella.lap_time });
  }
  dati[nome] = { perGiro, oss, nGiri: g.nGiri, deriva: -DELTA70 / g.nGiri };
}

const regimeDi = (cella) => {
  if (!cella) return null;
  try { if (!regimeNeutralizzato(cella)) return null; } catch { return null; }
  return simboliStatus(cella.status).has('4') ? 'SC' : 'VSC';
};

function basiAl(nome, finoA) {
  const { oss, deriva } = dati[nome];
  const acc = new Map();
  for (const o of oss) {
    if (o.lap > finoA) continue;
    if (!acc.has(o.drv)) acc.set(o.drv, []);
    acc.get(o.drv).push(o.t - deriva * (o.lap - 1) - RHO * o.eta);
  }
  const basi = {};
  for (const [drv, v] of acc) basi[drv] = v.length >= MIN_GIRI_BASE ? mediana(v) : null;
  return basi;
}

// ══════════════════════ 1 · PERSISTENZA, ri-misurata al livello del CONGELAMENTO
// S5 contava per pilota; qui conta per (gara, giro), che e' l'unita' su cui il
// prodotto decide: se al congelamento L c'e' SC, per quanti giri c'e' ancora?
console.log('1 · PERSISTENZA DEL REGIME, per CONGELAMENTO (gara, giro L)');
console.log('   dato il regime osservato al giro L (informazione <= L), quota di congelamenti');
console.log('   in cui il regime e\' ancora in corso a L+k');
{
  const conta = { SC: { n: 0, k: {} }, VSC: { n: 0, k: {} } };
  const durate = { SC: [], VSC: [] };
  for (const nome of NOMI) {
    const { perGiro, nGiri } = dati[nome];
    for (let L = 1; L <= nGiri; L += 1) {
      const m = perGiro.get(L); if (!m) continue;
      // il regime del congelamento: quello della maggioranza dei piloti al giro L
      const regimi = [...m.values()].map(regimeDi).filter((x) => x !== null);
      if (regimi.length < 3) continue;               // un solo pilota non fa un regime di gara
      const tipo = regimi.filter((x) => x === 'SC').length >= regimi.length / 2 ? 'SC' : 'VSC';
      conta[tipo].n += 1;
      let d = 0;
      for (let k = 1; k <= 8; k += 1) {
        const mm = perGiro.get(L + k);
        const rr = mm ? [...mm.values()].map(regimeDi).filter((x) => x !== null) : [];
        const ancora = rr.length >= 3;
        conta[tipo].k[k] = (conta[tipo].k[k] ?? 0) + (ancora ? 1 : 0);
        if (ancora && d === k - 1) d = k;
      }
      durate[tipo].push(d);
    }
  }
  console.log('   tipo  n(L)    L+1    L+2    L+3    L+4    L+5     giri residui: mediana / media');
  for (const t of ['SC', 'VSC']) {
    if (!conta[t].n) continue;
    const r = [1, 2, 3, 4, 5].map((k) => `${(100 * (conta[t].k[k] ?? 0) / conta[t].n).toFixed(0)}%`.padStart(5)).join('  ');
    console.log(`   ${t.padEnd(5)} ${String(conta[t].n).padStart(4)}  ${r}      ${mediana(durate[t])} / ${f(media(durate[t]), 2)}`);
  }
  console.log('   → PERSISTENZA_REGIME_GIRI vale 1 per entrambi in costruttore.mjs:30');
}

// ══════════════════════════════════ 2 · le coppie della griglia M2, col regime
const coppie = [];
for (const nome of NOMI) {
  const { perGiro, nGiri } = dati[nome];
  for (let L = PRIMO; L + H_MAX <= nGiri; L += PASSO) {
    const al = perGiro.get(L); if (!al) continue;
    const conCum = [...al.entries()].filter(([, c]) => typeof c.cum_time === 'number');
    if (!conCum.length) continue;
    const leader = conCum.reduce((m, x) => (x[1].cum_time < m[1].cum_time ? x : m), conCum[0])[0];
    const regimi = [...al.values()].map(regimeDi).filter((x) => x !== null);
    const regimeL = regimi.length >= 3 ? (regimi.filter((x) => x === 'SC').length >= regimi.length / 2 ? 'SC' : 'VSC') : null;
    for (const H of ORIZZONTI) {
      const Lf = L + H;
      const cl = perGiro.get(Lf)?.get(leader)?.cum_time;
      if (typeof cl !== 'number') continue;
      for (const [drv] of conCum) {
        if (drv === leader) continue;
        const cv = perGiro.get(Lf)?.get(drv)?.cum_time;
        if (typeof cv !== 'number') continue;
        let sosta = false;
        for (let k = L + 1; k <= Lf; k += 1) {
          for (const x of [drv, leader]) {
            const c = perGiro.get(k)?.get(x);
            if (c && (c.in_lap === true || c.out_lap === true)) sosta = true;
          }
        }
        coppie.push({ gara: nome, L, H, drv, leader, gapVero: cv - cl, sosta, regimeL });
      }
    }
  }
}

/**
 * Proiezione con trattamento del regime.
 * modo 'A' : passo verde su tutto (l'attuale)
 * modo 'C' : per i primi P giri il distacco NON cresce (sotto SC tutti al passo
 *            della SC), poi passo verde
 * modo 'D' : come C, piu' compressione geometrica verso il gap di coda `coda`
 */
function proietta(nome, L, H, basi, { modo, P = 0, coda = 1.6, quota = 0.5 }) {
  const { perGiro, deriva } = dati[nome];
  const al = perGiro.get(L); if (!al) return {};
  const stato = [];
  for (const [drv, c] of al) {
    if (typeof c.cum_time !== 'number' || c.tyre_age === null || c.tyre_age === undefined) continue;
    if (basi[drv] === null || basi[drv] === undefined) continue;
    stato.push({ drv, cum: c.cum_time, eta: c.in_lap === true ? 0 : c.tyre_age });
  }
  for (let k = 1; k <= H; k += 1) {
    const giro = L + k;
    const sottoRegime = modo !== 'A' && k <= P;
    if (sottoRegime) {
      // sotto SC il passo e' comune: il distacco resta com'e'. Si aggiunge lo
      // stesso tempo a tutti (il valore non tocca i distacchi) e l'eta cresce.
      const comune = mediana(stato.map((s) => basi[s.drv])) ?? 0;
      for (const s of stato) { s.cum += comune; s.eta += 1; }
      if (modo === 'D' && stato.length > 1) {
        // compressione: ogni distacco dall'auto davanti si avvicina a `coda`
        const ord = [...stato].sort((a, b) => a.cum - b.cum);
        let acc = ord[0].cum;
        for (let i = 1; i < ord.length; i += 1) {
          const g0 = ord[i].cum - ord[i - 1].cum;
          const g1 = g0 <= coda ? g0 : coda + (g0 - coda) * (1 - quota);
          acc += g1; ord[i].cum = acc;
        }
      }
      continue;
    }
    for (const s of stato) {
      const eta = s.eta + 1;
      s.cum += basi[s.drv] + deriva * (giro - 1) + RHO * eta;
      s.eta = eta;
    }
  }
  const out = {};
  for (const s of stato) out[s.drv] = s.cum;
  return out;
}

function errori(opzioni) {
  const cache = new Map(); const out = [];
  for (const c of coppie) {
    if (c.sosta) continue;
    const P = opzioni.modo === 'A' ? 0 : (c.regimeL === 'SC' ? opzioni.P_SC : c.regimeL === 'VSC' ? opzioni.P_VSC : 0);
    const kb = `${c.gara}|${c.L}`;
    if (!cache.has(kb)) cache.set(kb, basiAl(c.gara, c.L));
    const kp = `${c.gara}|${c.L}|${c.H}|${opzioni.modo}|${P}|${opzioni.coda}|${opzioni.quota}`;
    if (!cache.has(kp)) cache.set(kp, proietta(c.gara, c.L, c.H, cache.get(kb), { ...opzioni, P }));
    const p = cache.get(kp);
    if (p[c.drv] === undefined || p[c.leader] === undefined) continue;
    out.push({ ...c, err: ((p[c.drv] - p[c.leader]) - c.gapVero) / c.H });
  }
  return out;
}

function riga(et, e) {
  const s = ORIZZONTI.map((H) => {
    const v = e.filter((x) => x.H === H);
    return `${String(v.length).padStart(5)} ${f(mediana(v.map((x) => x.err))).padStart(8)} ${f(mediana(v.map((x) => Math.abs(x.err)))).padStart(7)}`;
  }).join('  |');
  console.log(`   ${et.padEnd(26)} ${s}`);
}

console.log('\n2 · IL CONTROFATTUALE — solo i congelamenti con REGIME OSSERVATO al giro L');
console.log('   (finestre pulite; per ogni orizzonte: n, bias mediano, |err| mediano — s/giro)');
console.log('   ' + ' '.repeat(27) + ORIZZONTI.map((H) => `${String(H) + 'g'}    n     bias    |err|`.padEnd(24)).join(''));

const varianti = [
  ['A · attuale (passo verde)', { modo: 'A' }],
  ['C · gap fermo, SC 1 VSC 1', { modo: 'C', P_SC: 1, P_VSC: 1 }],
  ['C · gap fermo, SC 3 VSC 1', { modo: 'C', P_SC: 3, P_VSC: 1 }],
  ['C · gap fermo, SC 4 VSC 1', { modo: 'C', P_SC: 4, P_VSC: 1 }],
  ['D · +compressione (SC 3)', { modo: 'D', P_SC: 3, P_VSC: 1, coda: 1.6, quota: 0.5 }],
];
const risultati = {};
for (const [et, op] of varianti) {
  const e = errori(op).filter((x) => x.regimeL !== null);
  risultati[et] = e;
  riga(et, e);
}

console.log('\n   gara per gara (blocchi = gare), bias mediano a 3 giri, congelamenti con regime');
const conRegime = [...new Set(coppie.filter((c) => c.regimeL !== null).map((c) => c.gara))].sort();
console.log('   gara            n(3g)   ' + varianti.map(([et]) => et.slice(0, 12).padStart(13)).join(''));
for (const g of conRegime) {
  const n = risultati[varianti[0][0]].filter((x) => x.gara === g && x.H === 3).length;
  if (!n) continue;
  console.log(`   ${g.padEnd(15)} ${String(n).padStart(5)}   `
    + varianti.map(([et]) => f(mediana(risultati[et].filter((x) => x.gara === g && x.H === 3).map((x) => x.err))).padStart(13)).join(''));
}

console.log('\n3 · CONTROLLO DI NON-DANNO — le stesse varianti sui congelamenti IN VERDE');
console.log('   (nessun regime osservato: P = 0, le varianti devono essere IDENTICHE ad A)');
console.log('   ' + ' '.repeat(27) + ORIZZONTI.map((H) => `${String(H) + 'g'}    n     bias    |err|`.padEnd(24)).join(''));
for (const [et, op] of varianti) riga(et, errori(op).filter((x) => x.regimeL === null));

console.log('\n4 · QUANTO PESA IL RAMO — congelamenti e coppie con regime osservato al giro L');
{
  const tot = coppie.filter((c) => !c.sosta && c.H === 3).length;
  const reg = coppie.filter((c) => !c.sosta && c.H === 3 && c.regimeL !== null).length;
  const sc = coppie.filter((c) => !c.sosta && c.H === 3 && c.regimeL === 'SC').length;
  console.log(`   coppie pulite a 3 giri: ${tot} · con regime ${reg} (${(100 * reg / tot).toFixed(1)}%) · di cui SC ${sc}`);
  const cong = new Set(coppie.filter((c) => c.regimeL !== null).map((c) => `${c.gara}|${c.L}`));
  const tuttiCong = new Set(coppie.map((c) => `${c.gara}|${c.L}`));
  console.log(`   congelamenti della griglia: ${tuttiCong.size} · con regime ${cong.size} (${(100 * cong.size / tuttiCong.size).toFixed(1)}%)`);
}
