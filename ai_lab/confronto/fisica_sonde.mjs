// fisica_sonde.mjs — le sonde che separano le cause.
//
//     node ai_lab/confronto/fisica_sonde.mjs
//
// fisica_residui.mjs ha trovato TRE strutture nel residuo del modello v2:
// traffico (gap <= 1 s -> +0,29 s/giro), frazione di gara (+0,32 -> -0,13) e
// stint. Ma frazione, stint e traffico sono confusi fra loro: a inizio gara il
// campo e' compatto. Queste sonde li separano.
//
// NON SCRIVE NIENTE su disco. Non tocca demo/, simulatore/, data/.

import path from 'node:path';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { caricaGare2026 } from '../../simulatore/provenienza/gare_2026.mjs';
import { passoUtilizzabile, regimeNeutralizzato, statusVerde } from '../../simulatore/provenienza/definizioni.mjs';
import { simboliStatus } from '../../simulatore/provenienza/vocabolario.mjs';

const QUI = path.dirname(fileURLToPath(import.meta.url));
const RADICE = path.resolve(QUI, '..', '..');
const SIM = path.join(RADICE, 'simulatore');
const MODELLO = JSON.parse(readFileSync(path.join(SIM, 'data', 'modelli', 'modello_v2.json'), 'utf8'));
const RHO = MODELLO.rho.valore;
const DELTA70 = MODELLO.delta_70.scelto;

const mediana = (v) => { if (!v.length) return null; const s = [...v].sort((a, b) => a - b); const m = s.length >> 1; return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; };
const media = (v) => (v.length ? v.reduce((a, b) => a + b, 0) / v.length : null);
const f = (x, n = 3) => (x === null || x === undefined ? '  —  ' : x.toFixed(n));
function rng(s0) { let s = s0 >>> 0; return () => { s ^= s << 13; s >>>= 0; s ^= s >> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; }; }
function icBlocchi(perGara, stat, { B = 2000, seme = 20260801 } = {}) {
  const k = Object.keys(perGara).filter((x) => perGara[x].length > 0);
  if (k.length < 2) return null;
  const r = rng(seme); const out = [];
  for (let b = 0; b < B; b += 1) { const u = []; for (let i = 0; i < k.length; i += 1) u.push(...perGara[k[Math.floor(r() * k.length)]]); const v = stat(u); if (v !== null && Number.isFinite(v)) out.push(v); }
  out.sort((a, b) => a - b);
  const q = (p) => out[Math.min(out.length - 1, Math.max(0, Math.floor(p * out.length)))];
  return [q(0.025), q(0.975)];
}

const gare = caricaGare2026(SIM);
const NOMI = Object.keys(gare).sort();

// ═════════════════════════════ raccolta comune (uguale a fisica_residui.mjs)
const verdi = [];
const indice = {};   // gara -> { perGiro: Map(lap -> Map(drv->cella)), nGiri }
for (const nome of NOMI) {
  const g = gare[nome];
  const N = g.nGiri;
  const deriva = -DELTA70 / N;
  const perGiro = new Map();
  for (const { drv, lap, cella } of g.righe) {
    if (!perGiro.has(lap)) perGiro.set(lap, new Map());
    perGiro.get(lap).set(drv, cella);
  }
  indice[nome] = { perGiro, nGiri: N };
  const gapAv = new Map(); const posAv = new Map();
  for (const [lap, mappa] of perGiro) {
    const conCum = [...mappa.entries()].filter(([, c]) => typeof c.cum_time === 'number').sort((a, b) => a[1].cum_time - b[1].cum_time);
    for (let i = 0; i < conCum.length; i += 1) {
      gapAv.set(`${conCum[i][0]}|${lap}`, i === 0 ? null : conCum[i][1].cum_time - conCum[i - 1][1].cum_time);
      posAv.set(`${conCum[i][0]}|${lap}`, i + 1);
    }
  }
  for (const [drv, celle] of g.perPilota) {
    for (const [lap, c] of celle) {
      let ok = false;
      try { ok = passoUtilizzabile(c) && c.tyre_age !== null; } catch { ok = false; }
      if (!ok) continue;
      verdi.push({
        gara: nome, drv, lap, N, eta: c.tyre_age, stint: c.stint, t: c.lap_time,
        r0: c.lap_time - deriva * (lap - 1) - RHO * c.tyre_age,
        gap: gapAv.get(`${drv}|${lap}`) ?? null,
        pos: posAv.get(`${drv}|${lap}`) ?? null,
        frazione: lap / N,
      });
    }
  }
}
const basi = new Map();
{
  const acc = new Map();
  for (const v of verdi) { const k = `${v.gara}|${v.drv}`; if (!acc.has(k)) acc.set(k, []); acc.get(k).push(v.r0); }
  for (const [k, val] of acc) basi.set(k, mediana(val));
}
for (const v of verdi) v.e = v.r0 - basi.get(`${v.gara}|${v.drv}`);

const ARIA = (x) => x.gap === null || x.gap > 2.0;     // aria libera dichiarata: > 2,0 s o primo
const SCIA = (x) => x.gap !== null && x.gap <= 1.0;

// ══════════════════════════ S1 · la frazione di gara, DENTRO l'aria libera
console.log('S1 · IL TREND SULLA FRAZIONE DI GARA SOPRAVVIVE ALL\'ARIA LIBERA?');
console.log('   (se sparisce togliendo la scia, il trend era traffico; se resta, e\' carburante/evoluzione pista)');
const fasce = [
  ['0-10%', (x) => x.frazione <= 0.1],
  ['10-25%', (x) => x.frazione > 0.1 && x.frazione <= 0.25],
  ['25-50%', (x) => x.frazione > 0.25 && x.frazione <= 0.5],
  ['50-75%', (x) => x.frazione > 0.5 && x.frazione <= 0.75],
  ['75-90%', (x) => x.frazione > 0.75 && x.frazione <= 0.9],
  ['90-100%', (x) => x.frazione > 0.9],
];
console.log('   fascia      TUTTI (n, mediana)        ARIA LIBERA >2s (n, mediana, IC95)      IN SCIA <=1s (n, mediana)');
for (const [et, sel] of fasce) {
  const t = verdi.filter(sel);
  const a = t.filter(ARIA); const s = t.filter(SCIA);
  const pg = {}; for (const n of NOMI) pg[n] = a.filter((x) => x.gara === n).map((y) => y.e);
  const ic = icBlocchi(pg, mediana);
  console.log(`   ${et.padEnd(9)} ${String(t.length).padStart(5)}  ${f(mediana(t.map((x) => x.e))).padStart(7)}        `
    + `${String(a.length).padStart(5)}  ${f(mediana(a.map((x) => x.e))).padStart(7)}  [${f(ic?.[0])}; ${f(ic?.[1])}]        `
    + `${String(s.length).padStart(5)}  ${f(mediana(s.map((x) => x.e))).padStart(7)}`);
}

// ══════════════════════════ S2 · il traffico, DENTRO ogni fascia di gara
console.log('\nS2 · L\'EFFETTO SCIA SOPRAVVIVE DENTRO OGNI FASCIA DI GARA?');
console.log('   scarto mediano  e(scia <=1s) - e(aria >2s), per fascia');
console.log('   fascia       n scia   n aria    scarto (s/giro)   IC95 (blocchi=gare)');
for (const [et, sel] of fasce) {
  const t = verdi.filter(sel);
  const a = t.filter(ARIA); const s = t.filter(SCIA);
  if (s.length < 20 || a.length < 20) { console.log(`   ${et.padEnd(9)} ${String(s.length).padStart(6)} ${String(a.length).padStart(8)}   (campione troppo piccolo)`); continue; }
  const pg = {}; for (const n of NOMI) pg[n] = t.filter((x) => x.gara === n);
  const ic = icBlocchi(pg, (u) => {
    const uu = u.filter(SCIA).map((x) => x.e); const aa = u.filter(ARIA).map((x) => x.e);
    return uu.length && aa.length ? mediana(uu) - mediana(aa) : null;
  });
  console.log(`   ${et.padEnd(9)} ${String(s.length).padStart(6)} ${String(a.length).padStart(8)}   ${f(mediana(s.map((x) => x.e)) - mediana(a.map((x) => x.e))).padStart(15)}   [${f(ic?.[0])}; ${f(ic?.[1])}]`);
}

// ══════════════════════════ S3 · il traffico, gara per gara (blocchi, E11)
console.log('\nS3 · L\'EFFETTO SCIA GARA PER GARA (blocchi = gare, nessuna media che le mescoli)');
console.log('   gara            n scia   n aria    e(scia)   e(aria)   scarto');
let gareConSegnoGiusto = 0; let gareGiudicabili = 0;
for (const n of NOMI) {
  const t = verdi.filter((x) => x.gara === n);
  const s = t.filter(SCIA); const a = t.filter(ARIA);
  if (s.length < 20 || a.length < 20) { console.log(`   ${n.padEnd(15)} ${String(s.length).padStart(6)} ${String(a.length).padStart(8)}   (piccolo)`); continue; }
  const ms = mediana(s.map((x) => x.e)); const ma = mediana(a.map((x) => x.e));
  gareGiudicabili += 1; if (ms - ma > 0) gareConSegnoGiusto += 1;
  console.log(`   ${n.padEnd(15)} ${String(s.length).padStart(6)} ${String(a.length).padStart(8)}   ${f(ms).padStart(7)}   ${f(ma).padStart(7)}   ${f(ms - ma).padStart(7)}`);
}
console.log(`   → scarto positivo (la scia costa) in ${gareConSegnoGiusto}/${gareGiudicabili} gare`);

// ══════════════════════════ S4 · la forma della penalita' di scia
console.log('\nS4 · LA FORMA DELLA PENALITA\' DI SCIA — mediana del residuo per fascia fine di gap');
console.log('   gap (s)        n     mediana e   media e    IC95 mediana');
const finiGap = [
  ['0,0-0,5', (x) => x.gap !== null && x.gap <= 0.5],
  ['0,5-1,0', (x) => x.gap !== null && x.gap > 0.5 && x.gap <= 1.0],
  ['1,0-1,5', (x) => x.gap !== null && x.gap > 1.0 && x.gap <= 1.5],
  ['1,5-2,0', (x) => x.gap !== null && x.gap > 1.5 && x.gap <= 2.0],
  ['2,0-3,0', (x) => x.gap !== null && x.gap > 2.0 && x.gap <= 3.0],
  ['3,0-5,0', (x) => x.gap !== null && x.gap > 3.0 && x.gap <= 5.0],
  ['> 5,0', (x) => x.gap !== null && x.gap > 5.0],
];
for (const [et, sel] of finiGap) {
  const t = verdi.filter(sel);
  const pg = {}; for (const n of NOMI) pg[n] = t.filter((x) => x.gara === n).map((y) => y.e);
  const ic = icBlocchi(pg, mediana);
  console.log(`   ${et.padEnd(11)} ${String(t.length).padStart(6)}   ${f(mediana(t.map((x) => x.e))).padStart(9)}  ${f(media(t.map((x) => x.e))).padStart(8)}   [${f(ic?.[0])}; ${f(ic?.[1])}]`);
}
const quotaScia = verdi.filter(SCIA).length / verdi.length;
console.log(`   quota di giri verdi passati entro 1,0 s dall'auto davanti: ${(100 * quotaScia).toFixed(1)}% (${verdi.filter(SCIA).length}/${verdi.length})`);

// ══════════════════════════ S5 · quanto dura una neutralizzazione, vista da L
console.log('\nS5 · PERSISTENZA DEL REGIME — dato SC/VSC osservato al giro L (informazione <= L),');
console.log('   quanti giri resta? (frazione di piloti ancora neutralizzati a L+k)');
{
  const persistenza = { SC: {}, VSC: {} };
  const totale = { SC: 0, VSC: 0 };
  const durate = { SC: [], VSC: [] };
  for (const nome of NOMI) {
    const { perGiro, nGiri } = indice[nome];
    for (let L = 1; L <= nGiri; L += 1) {
      const m = perGiro.get(L); if (!m) continue;
      for (const [drv, c] of m) {
        let neut = false; try { neut = regimeNeutralizzato(c); } catch { neut = false; }
        if (!neut) continue;
        const tipo = simboliStatus(c.status).has('4') ? 'SC' : 'VSC';
        totale[tipo] += 1;
        let quanti = 0;
        for (let k = 1; k <= 8; k += 1) {
          const cc = perGiro.get(L + k)?.get(drv);
          let nn = false; try { nn = cc ? regimeNeutralizzato(cc) : false; } catch { nn = false; }
          persistenza[tipo][k] = (persistenza[tipo][k] ?? 0) + (nn ? 1 : 0);
          if (nn && quanti === k - 1) quanti = k;
        }
        durate[tipo].push(quanti);
      }
    }
  }
  console.log('   tipo   n(L)    L+1     L+2     L+3     L+4     L+5     giri residui mediani');
  for (const tipo of ['SC', 'VSC']) {
    const riga = [1, 2, 3, 4, 5].map((k) => `${(100 * (persistenza[tipo][k] ?? 0) / totale[tipo]).toFixed(0)}%`.padStart(6)).join('  ');
    console.log(`   ${tipo.padEnd(5)} ${String(totale[tipo]).padStart(5)}  ${riga}     ${mediana(durate[tipo])} (media ${f(media(durate[tipo]), 2)})`);
  }
}

// ══════════════════════════ S6 · sotto SC, il gap all'auto davanti collassa?
console.log('\nS6 · SOTTO SC/VSC IL DISTACCO ALL\'AUTO DAVANTI COLLASSA? (stesso indice di giro)');
console.log('   regime    n       gap mediano   p25     p75     quota <= 2,0 s');
{
  const perReg = { verde: [], SC: [], VSC: [] };
  for (const nome of NOMI) {
    const { perGiro } = indice[nome];
    for (const [, mappa] of perGiro) {
      const conCum = [...mappa.entries()].filter(([, c]) => typeof c.cum_time === 'number').sort((a, b) => a[1].cum_time - b[1].cum_time);
      for (let i = 1; i < conCum.length; i += 1) {
        const c = conCum[i][1];
        const gap = c.cum_time - conCum[i - 1][1].cum_time;
        let reg = null;
        try {
          if (regimeNeutralizzato(c)) reg = simboliStatus(c.status).has('4') ? 'SC' : 'VSC';
          else if (statusVerde(c)) reg = 'verde';
        } catch { reg = null; }
        if (reg) perReg[reg].push(gap);
      }
    }
  }
  for (const reg of ['verde', 'SC', 'VSC']) {
    const v = [...perReg[reg]].sort((a, b) => a - b);
    const q = (p) => v[Math.min(v.length - 1, Math.floor(p * v.length))];
    console.log(`   ${reg.padEnd(8)} ${String(v.length).padStart(6)}   ${f(mediana(v), 2).padStart(10)}  ${f(q(0.25), 2).padStart(6)}  ${f(q(0.75), 2).padStart(6)}   ${(100 * v.filter((x) => x <= 2).length / v.length).toFixed(1)}%`);
  }
}
