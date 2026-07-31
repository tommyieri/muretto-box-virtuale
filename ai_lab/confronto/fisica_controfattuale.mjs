// fisica_controfattuale.mjs — SE IL PASSO AVESSE UN TERMINE DI SCIA, M2 MIGLIORA?
//
//     node ai_lab/confronto/fisica_controfattuale.mjs
//
// fisica_residui/fisica_sonde hanno misurato che il residuo del modello v2
// dipende dal gap all'auto davanti (11/11 gare, monotono, +0,63 s/giro sotto
// 0,5 s). Ma un residuo strutturato NON e' ancora una miglioria: bisogna
// mostrare che mettendolo nel passo il bersaglio del prodotto migliora, e
// FUORI CAMPIONE (E16 — un ottimo misurato dove il fenomeno non c'e' non vale).
//
// COSA FA. Ricostruisce la misura M2 (bias sul distacco dal leader a 3/5/10
// giri, finestre pulite) per il solo motore NUOVO, in due varianti:
//   A · passo attuale       t = base + delta*(giro-1) + rho*eta
//   B · passo + scia        t = base + delta*(giro-1) + rho*eta + i(gap)
//       con i(g) = a*exp(-g/b), gap = distacco dall'auto davanti PROIETTATA
//       (informazione che il kernel ha gia': sono i cum che sta calcolando).
//
// REGOLA 10, ed e' il punto. Nella variante B la base si misura togliendo
// ANCHE i(gap) dai giri osservati, con lo stesso a e lo stesso b che si
// ri-aggiungono simulando. Se non lo si facesse si ri-farebbe E02: un termine
// aggiunto in simulazione e mai sottratto in misura.
//
// FUORI CAMPIONE. (a,b) si stimano su 10 gare e si giudica sull'11a
// (leave-one-race-out), 11 volte. Il numero in-sample e' riportato accanto,
// per far vedere quanto della miglioria e' circolarita'.
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
const MIN_GIRI_BASE = 8;          // come simulatore/scenario/costruttore.mjs:31

const ORIZZONTI = [3, 5, 10];
const H_MAX = 10;
const PRIMO = 5;
const PASSO = 2;

const mediana = (v) => { if (!v.length) return null; const s = [...v].sort((a, b) => a - b); const m = s.length >> 1; return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; };
const media = (v) => (v.length ? v.reduce((a, b) => a + b, 0) / v.length : null);
const f = (x, n = 3) => (x === null || x === undefined ? '  —  ' : x.toFixed(n));

const gare = caricaGare2026(SIM);
const NOMI = Object.keys(gare).sort();

// ═══════════════════════════════════════════════ indice + osservazioni verdi
const dati = {};
for (const nome of NOMI) {
  const g = gare[nome];
  const perGiro = new Map();
  for (const { drv, lap, cella } of g.righe) {
    if (!perGiro.has(lap)) perGiro.set(lap, new Map());
    perGiro.get(lap).set(drv, cella);
  }
  // gap all'auto davanti OSSERVATO, stesso indice di giro
  const gapOss = new Map();
  for (const [lap, mappa] of perGiro) {
    const c = [...mappa.entries()].filter(([, x]) => typeof x.cum_time === 'number').sort((a, b) => a[1].cum_time - b[1].cum_time);
    for (let i = 0; i < c.length; i += 1) gapOss.set(`${c[i][0]}|${lap}`, i === 0 ? null : c[i][1].cum_time - c[i - 1][1].cum_time);
  }
  // le osservazioni verdi, con il gap osservato attaccato
  const oss = [];
  for (const { drv, lap, cella } of g.righe) {
    let ok = false;
    try { ok = passoUtilizzabile(cella) && cella.tyre_age !== null; } catch { ok = false; }
    if (!ok) continue;
    oss.push({ drv, lap, eta: cella.tyre_age, t: cella.lap_time, gap: gapOss.get(`${drv}|${lap}`) ?? null });
  }
  dati[nome] = { g, perGiro, oss, nGiri: g.nGiri, deriva: -DELTA70 / g.nGiri };
}

// i(g) = a * exp(-g/b); il "primo" (nessuno davanti) non paga scia
const scia = (gap, a, b) => (gap === null || !Number.isFinite(gap) ? 0 : a * Math.exp(-gap / b));

/** Base per pilota: mediana di t - deriva*(lap-1) - rho*eta - i(gap), giri <= finoA. */
function basiAl(nome, finoA, a, b) {
  const { oss, deriva } = dati[nome];
  const acc = new Map();
  for (const o of oss) {
    if (o.lap > finoA) continue;
    if (!acc.has(o.drv)) acc.set(o.drv, []);
    acc.get(o.drv).push(o.t - deriva * (o.lap - 1) - RHO * o.eta - scia(o.gap, a, b));
  }
  const basi = {};
  for (const [drv, v] of acc) basi[drv] = v.length >= MIN_GIRI_BASE ? mediana(v) : null;
  return basi;
}

/**
 * Proiezione dal congelamento L per H giri, con termine di scia calcolato sui
 * cum PROIETTATI (nessuna informazione dal futuro: sono i numeri che il kernel
 * sta gia' producendo). a = 0 riproduce esattamente il passo attuale.
 */
function proietta(nome, L, H, basi, a, b) {
  const { perGiro, deriva } = dati[nome];
  const al = perGiro.get(L);
  if (!al) return {};
  const stato = [];
  for (const [drv, c] of al) {
    if (typeof c.cum_time !== 'number' || c.tyre_age === null || c.tyre_age === undefined) continue;
    if (basi[drv] === null || basi[drv] === undefined) continue;
    stato.push({ drv, cum: c.cum_time, eta: c.in_lap === true ? 0 : c.tyre_age });
  }
  for (let k = 1; k <= H; k += 1) {
    const giro = L + k;
    const ordinati = [...stato].sort((x, y) => x.cum - y.cum);
    const gapDi = new Map();
    for (let i = 0; i < ordinati.length; i += 1) gapDi.set(ordinati[i].drv, i === 0 ? null : ordinati[i].cum - ordinati[i - 1].cum);
    for (const s of stato) {
      const eta = s.eta + 1;
      s.cum += basi[s.drv] + deriva * (giro - 1) + RHO * eta + scia(gapDi.get(s.drv), a, b);
      s.eta = eta;
    }
  }
  const out = {};
  for (const s of stato) out[s.drv] = s.cum;
  return out;
}

// ═══════════════════════════════════ le coppie della griglia M2, una volta sola
// (gara, L, H, pilota, leader, gap vero, finestra pulita) — indipendenti da (a,b)
const coppie = [];
for (const nome of NOMI) {
  const { perGiro, nGiri } = dati[nome];
  for (let L = PRIMO; L + H_MAX <= nGiri; L += PASSO) {
    const al = perGiro.get(L); if (!al) continue;
    const conCum = [...al.entries()].filter(([, c]) => typeof c.cum_time === 'number');
    if (!conCum.length) continue;
    const leader = conCum.reduce((m, x) => (x[1].cum_time < m[1].cum_time ? x : m), conCum[0])[0];
    let neutroAlFreeze = false;
    try { neutroAlFreeze = regimeNeutralizzato(al.get(leader)); } catch { neutroAlFreeze = false; }
    for (const H of ORIZZONTI) {
      const Lf = L + H;
      const cumLeaderVero = perGiro.get(Lf)?.get(leader)?.cum_time;
      if (typeof cumLeaderVero !== 'number') continue;
      for (const [drv] of conCum) {
        if (drv === leader) continue;
        const cumVero = perGiro.get(Lf)?.get(drv)?.cum_time;
        if (typeof cumVero !== 'number') continue;
        let sosta = false; let neutro = neutroAlFreeze;
        for (let k = L + 1; k <= Lf; k += 1) {
          for (const x of [drv, leader]) {
            const c = perGiro.get(k)?.get(x);
            if (!c) continue;
            if (c.in_lap === true || c.out_lap === true) sosta = true;
          }
        }
        try { if (regimeNeutralizzato(al.get(drv))) neutro = true; } catch { /* ignora */ }
        coppie.push({ gara: nome, L, H, drv, leader, gapVero: cumVero - cumLeaderVero, sosta, neutro });
      }
    }
  }
}

/** Errori per giro (previsto - vero) sul distacco, per una data coppia (a,b). */
function erroriCon(a, b, { soloPulite = true } = {}) {
  const cache = new Map();
  const out = [];
  for (const c of coppie) {
    if (soloPulite && c.sosta) continue;
    const kb = `${c.gara}|${c.L}`;
    if (!cache.has(kb)) cache.set(kb, basiAl(c.gara, c.L, a, b));
    const basi = cache.get(kb);
    const kp = `${c.gara}|${c.L}|${c.H}`;
    if (!cache.has(kp)) cache.set(kp, proietta(c.gara, c.L, c.H, basi, a, b));
    const p = cache.get(kp);
    if (p[c.drv] === undefined || p[c.leader] === undefined) continue;
    out.push({ ...c, err: ((p[c.drv] - p[c.leader]) - c.gapVero) / c.H });
  }
  return out;
}

// ═════════════════════════════════════════════════════ stima di (a,b) su un insieme
// Criterio DICHIARATO prima di guardare: minimizza la somma dei |residui mediani|
// sulle 7 fasce di gap dei giri verdi. E' una stima sulla FISICA (i residui del
// passo), non sul bersaglio M2: cosi' M2 resta un giudice esterno.
const FASCE = [[0, 0.5], [0.5, 1], [1, 1.5], [1.5, 2], [2, 3], [3, 5], [5, 1e9]];
function stimaAB(gareInsieme) {
  const righe = [];
  for (const nome of gareInsieme) {
    const { oss, deriva } = dati[nome];
    const acc = new Map();
    for (const o of oss) { if (!acc.has(o.drv)) acc.set(o.drv, []); acc.get(o.drv).push(o); }
    for (const [, v] of acc) {
      const r0 = v.map((o) => o.t - deriva * (o.lap - 1) - RHO * o.eta);
      const bse = mediana(r0);
      v.forEach((o, i) => righe.push({ gap: o.gap, e: r0[i] - bse }));
    }
  }
  let best = null;
  for (let a = 0; a <= 1.6; a += 0.02) {
    for (let b = 0.2; b <= 3.0; b += 0.05) {
      let costo = 0;
      for (const [lo, hi] of FASCE) {
        const sel = righe.filter((x) => (x.gap === null ? false : x.gap > lo && x.gap <= hi));
        if (!sel.length) continue;
        costo += Math.abs(mediana(sel.map((x) => x.e - scia(x.gap, a, b))));
      }
      const primi = righe.filter((x) => x.gap === null);
      if (primi.length) costo += Math.abs(mediana(primi.map((x) => x.e)));
      if (best === null || costo < best.costo) best = { a: Number(a.toFixed(2)), b: Number(b.toFixed(2)), costo };
    }
  }
  return best;
}

// ═══════════════════════════════════════════════════════════════════ referto
console.log('CONTROFATTUALE — un termine di SCIA nel passo migliora M2?');
console.log(`   modello di partenza: delta70 = ${DELTA70} · rho = ${RHO} · MIN_GIRI_BASE = ${MIN_GIRI_BASE}`);
console.log(`   coppie della griglia M2: ${coppie.length} (pulite ${coppie.filter((c) => !c.sosta).length})`);

const abTutte = stimaAB(NOMI);
console.log(`\n(a,b) stimati su TUTTE le 11 gare: i(g) = ${abTutte.a} * exp(-g / ${abTutte.b})`);
console.log(`   i(0) = ${f(scia(0, abTutte.a, abTutte.b))} · i(0,5) = ${f(scia(0.5, abTutte.a, abTutte.b))} · i(1) = ${f(scia(1, abTutte.a, abTutte.b))} · i(2) = ${f(scia(2, abTutte.a, abTutte.b))} · i(4) = ${f(scia(4, abTutte.a, abTutte.b))}`);

const errA = erroriCon(0, 1);
const errB = erroriCon(abTutte.a, abTutte.b);
console.log('\n═ IN CAMPIONE (a,b da tutte e 11 le gare) — finestre pulite, popolazione identica per costruzione');
console.log('   oriz    n      bias mediano A    bias mediano B    |err| mediano A   |err| mediano B');
for (const H of ORIZZONTI) {
  const A = errA.filter((x) => x.H === H); const B = errB.filter((x) => x.H === H);
  console.log(`   ${String(H).padStart(4)}  ${String(A.length).padStart(5)}   ${f(mediana(A.map((x) => x.err))).padStart(14)}    ${f(mediana(B.map((x) => x.err))).padStart(14)}    `
    + `${f(mediana(A.map((x) => Math.abs(x.err)))).padStart(13)}     ${f(mediana(B.map((x) => Math.abs(x.err)))).padStart(13)}`);
}

// ── LEAVE-ONE-RACE-OUT: (a,b) da 10 gare, giudizio sull'11a ────────────────
console.log('\n═ FUORI CAMPIONE — leave-one-race-out: (a,b) stimati sulle altre 10, giudicati sulla gara esclusa');
const looAB = {};
for (const n of NOMI) looAB[n] = stimaAB(NOMI.filter((x) => x !== n));
console.log('   gara            a     b      |bias| 3g A -> B      |bias| 5g A -> B      |bias| 10g A -> B');
const fuoriA = []; const fuoriB = [];
for (const n of NOMI) {
  const { a, b } = looAB[n];
  const eA = errA.filter((x) => x.gara === n);
  const eB = erroriCon(a, b).filter((x) => x.gara === n);
  fuoriA.push(...eA); fuoriB.push(...eB);
  const riga = ORIZZONTI.map((H) => {
    const xa = Math.abs(mediana(eA.filter((x) => x.H === H).map((x) => x.err)) ?? NaN);
    const xb = Math.abs(mediana(eB.filter((x) => x.H === H).map((x) => x.err)) ?? NaN);
    return `${f(xa)} -> ${f(xb)}${xb <= xa ? ' ok ' : ' PEG'}`;
  }).join('   ');
  console.log(`   ${n.padEnd(15)} ${String(a).padStart(4)} ${String(b).padStart(5)}    ${riga}`);
}
console.log('\n   POOLED fuori campione (ogni gara giudicata con (a,b) delle altre 10)');
console.log('   oriz    n      bias mediano A    bias mediano B    |err| mediano A   |err| mediano B   |err| medio A -> B');
for (const H of ORIZZONTI) {
  const A = fuoriA.filter((x) => x.H === H); const B = fuoriB.filter((x) => x.H === H);
  console.log(`   ${String(H).padStart(4)}  ${String(A.length).padStart(5)}   ${f(mediana(A.map((x) => x.err))).padStart(14)}    ${f(mediana(B.map((x) => x.err))).padStart(14)}    `
    + `${f(mediana(A.map((x) => Math.abs(x.err)))).padStart(13)}     ${f(mediana(B.map((x) => Math.abs(x.err)))).padStart(13)}     `
    + `${f(media(A.map((x) => Math.abs(x.err))))} -> ${f(media(B.map((x) => Math.abs(x.err))))}`);
}
console.log('\n   gare in cui |bias| migliora (fuori campione), per orizzonte:');
for (const H of ORIZZONTI) {
  const vinte = NOMI.filter((n) => {
    const xa = Math.abs(mediana(fuoriA.filter((x) => x.gara === n && x.H === H).map((x) => x.err)) ?? NaN);
    const xb = Math.abs(mediana(fuoriB.filter((x) => x.gara === n && x.H === H).map((x) => x.err)) ?? NaN);
    return xb <= xa;
  });
  console.log(`     ${H}g: ${vinte.length}/11  [${vinte.join(', ')}]`);
}
console.log('\n   appaiato coppia per coppia (fuori campione), quota in cui B e\' piu\' vicino al vero:');
for (const H of ORIZZONTI) {
  const A = fuoriA.filter((x) => x.H === H); const B = fuoriB.filter((x) => x.H === H);
  const mappa = new Map(B.map((x) => [`${x.gara}|${x.L}|${x.drv}`, x.err]));
  let vinceB = 0; let n = 0; const diffs = [];
  for (const x of A) {
    const eb = mappa.get(`${x.gara}|${x.L}|${x.drv}`);
    if (eb === undefined) continue;
    n += 1; if (Math.abs(eb) < Math.abs(x.err)) vinceB += 1;
    diffs.push(Math.abs(eb) - Math.abs(x.err));
  }
  console.log(`     ${H}g: ${vinceB}/${n} = ${(100 * vinceB / n).toFixed(1)}%   mediana D|err| ${f(mediana(diffs))}`);
}

// ── controllo: e sulle finestre NEUTRALIZZATE al congelamento? ─────────────
console.log('\n═ CONTROLLO — le finestre con regime SC/VSC al congelamento (dove il passo verde non vale)');
console.log('   oriz   n      bias mediano A    bias mediano B    (il termine di scia NON le tocca: sono un\'altra fisica)');
for (const H of ORIZZONTI) {
  const A = fuoriA.filter((x) => x.H === H && x.neutro); const B = fuoriB.filter((x) => x.H === H && x.neutro);
  console.log(`   ${String(H).padStart(4)}  ${String(A.length).padStart(5)}   ${f(mediana(A.map((x) => x.err))).padStart(14)}    ${f(mediana(B.map((x) => x.err))).padStart(14)}`);
}
