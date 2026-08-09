// test_classifica.mjs — SENTINELLA DI PARITA' della classifica unificata.
//
// PERCHE' ESISTE, E PERCHE' PRIMA DEL CODICE. `classificaAt` (gara.html, cum reali) e
// `classificaSim` (ghostplay.mjs, cum simulati) rispondevano alla stessa domanda — chi e'
// davanti a un dato istante, di quanto, e chi e' doppiato — con lo stesso identico modello,
// scritto due volte. Il commento di classificaSim lo ammetteva: «STESSO modello del replay
// reale». Unirle tocca l'ordine della torre nella pagina piu' vista del sito, dove uno
// scambio di posizione fra due righe non si nota finche' qualcuno non confronta col
// risultato vero. Questo banco congela il comportamento del 09/08/2026 PRIMA di toccare
// niente, e pretende che il modulo unificato lo riproduca ESATTAMENTE.
//
// LE DUE NON ERANO IDENTICHE, e le differenze vanno conservate, non appianate:
//   - il PAREGGIO: gara.html ordina per (icum, cum_time, sigla), la scena solo per icum
//     (lasciando decidere l'ordine delle chiavi). Con cum uguali le due danno righe diverse.
//   - il PRIMO GIRO: gara.html ancora il cum precedente a leadCum[0] quando L===1; la scena
//     usa C.lead[L-1], che al giro di congelamento e' l'ancora costruita da costruisciCum.
//   - la FASE GRIGLIA: esiste solo in gara.html (L===1, f===0), e ordina per griglia di
//     partenza invece che per tempo.
//
// Cosa lo fa fallire (regola 4):
//   C1  l'ordine e i distacchi del contesto GARA coincidono col riferimento congelato, su
//       una griglia fitta di (L, f) e su tutte e 11 le gare. Tolleranza ZERO sull'ordine,
//       1e-12 sui numeri.
//   C2  le etichette (LEADER / +N giri / +X.Xs) coincidono carattere per carattere.
//   C3  il contesto SCENA coincide col riferimento congelato di classificaSim.
//   C4  il pareggio si rompe come prima: due piloti con lo STESSO cum danno lo stesso
//       ordine di prima in entrambi i contesti.
//   C5  il conteggio dei doppiati usa lo stesso orizzonte (L..L+3) e la stessa regola.

import { readFileSync } from 'node:fs';
import * as K from './classifica.mjs';

let falliti = 0;
const ok = (nome, cond, extra = '') => {
  if (cond) console.log(`   [OK  ] ${nome}${extra ? ' — ' + extra : ''}`);
  else { console.log(`   [FALLITO] ${nome}${extra ? ' — ' + extra : ''}`); falliti++; }
};
const leggi = p => JSON.parse(readFileSync(new URL(p, import.meta.url)));

// ───────────────── RIFERIMENTO CONGELATO (09/08/2026) — non si tocca ─────────────────

function RIF_leaderAiGiri(byLap, nLaps, nonParten, L) {
  const out = {};
  for (let k = L; k <= Math.min(L + 3, nLaps); k++) if (byLap[k]) {
    const o = Object.entries(byLap[k])
      .filter(([d, c]) => typeof c.cum_time === 'number' && !nonParten.has(d))
      .sort((a, b) => a[1].cum_time - b[1].cum_time);
    if (o.length) out[k] = o[0][1].cum_time;
  }
  return out;
}

// il NUCLEO di classificaAt: ordine, distacchi, doppiati, etichette (senza la decorazione
// di pagina, che non e' duplicata e resta dov'e')
function RIF_classificaAt(byLap, nLaps, nonParten, leadCum, gridGara, L, f) {
  const A = byLap[L], P = byLap[L - 1];
  const icum = (d, c) => {
    const prev = L === 1 ? leadCum[0] : P?.[d]?.cum_time;
    return (typeof prev === 'number') ? prev + f * (c.cum_time - prev) : c.cum_time;
  };
  let ordine = Object.entries(A).filter(([d, c]) => typeof c.cum_time === 'number' && !nonParten.has(d))
    .map(([d, c]) => [d, c, icum(d, c)]);
  const faseGriglia = (L === 1 && f === 0 && gridGara.length > 0);
  if (faseGriglia) {
    const rank = {}; gridGara.forEach((d, i) => rank[d] = i);
    ordine.sort((a, b) => (rank[a[0]] ?? 999) - (rank[b[0]] ?? 999));
  } else ordine.sort((a, b) => (a[2] - b[2]) || (a[1].cum_time - b[1].cum_time) || (a[0] < b[0] ? -1 : 1));
  const leader = ordine.length ? ordine[0][2] : 0;
  const lag = RIF_leaderAiGiri(byLap, nLaps, nonParten, L);
  return ordine.map(([drv, c, cum], i) => {
    const gap = cum - leader; let gd = 0;
    for (const k in lag) if (+k > L && c.cum_time > lag[k]) gd = +k - L;
    let et, cls, prev = null;
    if (faseGriglia) { et = i === 0 ? 'POLE' : '—'; cls = i === 0 ? 'lead' : ''; }
    else if (gd >= 1) { et = `+${gd} gir${gd > 1 ? 'i' : 'o'}`; cls = 'lapped'; }
    else if (i === 0) { et = 'LEADER'; cls = 'lead'; }
    else { et = `+${gap.toFixed(1)}s`; cls = ''; prev = cum - ordine[i - 1][2]; }
    return { drv, pos: i + 1, icum: cum, et, cls, prev };
  });
}

// il NUCLEO di classificaSim
function RIF_classificaSim(C, p) {
  const L = Math.max(C.freezeLap, Math.min(C.nLap, Math.floor(p)));
  const f = Math.min(1, Math.max(0, p - L));
  const cumA = (d, k) => (C.cum[d] || []).find(x => x.lap === k)?.cum;
  const cumL = {}, ic = {};
  for (const d of C.present) {
    const cur = cumA(d, L); if (cur == null) continue;
    cumL[d] = cur;
    const pv = cumA(d, L - 1) ?? C.lead[L - 1];
    ic[d] = (typeof pv === 'number') ? pv + f * (cur - pv) : cur;
  }
  const lag = {};
  for (let k = L; k <= Math.min(L + 3, C.nLap); k++) {
    let mn = Infinity;
    for (const d of C.present) { const c = cumA(d, k); if (c != null && c < mn) mn = c; }
    if (mn < Infinity) lag[k] = mn;
  }
  const ord = Object.keys(ic).sort((a, b) => ic[a] - ic[b]);
  const leader = ord.length ? ic[ord[0]] : 0;
  return ord.map((d, i) => {
    let gd = 0; for (const k in lag) if (+k > L && cumL[d] > lag[k]) gd = +k - L;
    let gapTxt, gapCls = '';
    if (gd >= 1) { gapTxt = `+${gd} gir${gd > 1 ? 'i' : 'o'}`; gapCls = 'lapped'; }
    else if (i === 0) { gapTxt = 'LEADER'; gapCls = 'lead'; }
    else gapTxt = `+${(ic[d] - leader).toFixed(1)}s`;
    return { drv: d, pos: i + 1, gapTxt, gapCls };
  });
}

// ───────────────────────── C1/C2/C5: il contesto GARA ─────────────────────────

const manifest = leggi('./data/manifest.json');
let nC = 0, difOrdine = [], difEtich = [], difDopp = [];

for (const { gara, n_laps } of manifest) {
  const dati = leggi(`./data/${gara}.json`);
  const byLap = {}, leadCum = {};
  for (const lp of dati.laps) {
    byLap[lp.lap] = lp.cars;
    for (const c of Object.values(lp.cars)) {
      if (typeof c.cum_time === 'number' &&
          (leadCum[lp.lap] === undefined || c.cum_time < leadCum[lp.lap])) leadCum[lp.lap] = c.cum_time;
    }
  }
  leadCum[0] = (leadCum[1] !== undefined) ? leadCum[1] - 90 : 0;
  const nonParten = new Set();
  const grid = [];                       // senza griglia: la fase-griglia non scatta

  for (let L = 1; L <= n_laps; L += 3) {
    for (const f of [0, 0.37, 0.74]) {
      const a = RIF_classificaAt(byLap, n_laps, nonParten, leadCum, grid, L, f);
      const b = K.classifica({
        cumCorrente: byLap[L], cumPrecedente: byLap[L - 1],
        ancora: leadCum[0], primoGiro: L === 1, f, L, nLap: n_laps,
        battistrada: K.battistradaAiGiri(k => byLap[k], L, n_laps, d => !nonParten.has(d)),
        escludi: d => nonParten.has(d),
        pareggio: 'gara',
      });
      nC++;
      if (a.length !== b.length || a.some((r, i) => r.drv !== b[i].drv)) {
        if (difOrdine.length < 4) difOrdine.push(`${gara} L=${L} f=${f}: ${a.slice(0,5).map(r=>r.drv)} vs ${b.slice(0,5).map(r=>r.drv)}`);
        continue;
      }
      for (let i = 0; i < a.length; i++) {
        if (a[i].et !== b[i].et || a[i].cls !== b[i].cls) {
          if (difEtich.length < 4) difEtich.push(`${gara} L=${L} f=${f} ${a[i].drv}: "${a[i].et}" vs "${b[i].et}"`);
        }
        if (Math.abs(a[i].icum - b[i].icum) > 1e-12) {
          if (difDopp.length < 4) difDopp.push(`${gara} L=${L} ${a[i].drv}: icum ${a[i].icum} vs ${b[i].icum}`);
        }
      }
    }
  }
}

ok('C1 ordine identico al riferimento (contesto GARA)', difOrdine.length === 0,
   `${nC} classifiche su 11 gare${difOrdine.length ? ' · ' + difOrdine.join(' | ') : ''}`);
ok('C2 etichette identiche carattere per carattere', difEtich.length === 0,
   difEtich.length ? difEtich.join(' | ') : 'LEADER / +N giri / +X.Xs');
ok('C5 cum interpolato identico', difDopp.length === 0,
   difDopp.length ? difDopp.join(' | ') : 'entro 1e-12');

// ───────────────────────── C3: il contesto SCENA ─────────────────────────

const C = {
  present: ['AAA', 'BBB', 'CCC', 'DDD'],
  freezeLap: 10, nLap: 16,
  cum: {
    AAA: [10, 11, 12, 13, 14, 15, 16].map((L, i) => ({ lap: L, cum: 900 + i * 90 })),
    BBB: [10, 11, 12, 13, 14, 15, 16].map((L, i) => ({ lap: L, cum: 902 + i * 91 })),
    CCC: [10, 11, 12, 13, 14, 15, 16].map((L, i) => ({ lap: L, cum: 1000 + i * 95 })),
    DDD: [10, 11, 12, 13, 14, 15, 16].map((L, i) => ({ lap: L, cum: 1400 + i * 99 })),
  },
  lead: {},
};
for (let L = 9; L <= 16; L++) {
  let mn = Infinity;
  for (const d of C.present) { const e = C.cum[d].find(x => x.lap === L); if (e && e.cum < mn) mn = e.cum; }
  C.lead[L] = mn < Infinity ? mn : 810;
}
C.lead[9] = 810;

let difScena = [];
for (let p = 10; p <= 17; p += 0.19) {
  const a = RIF_classificaSim(C, p);
  const L = Math.max(C.freezeLap, Math.min(C.nLap, Math.floor(p)));
  const f = Math.min(1, Math.max(0, p - L));
  const cumA = (d, k) => (C.cum[d] || []).find(x => x.lap === k)?.cum;
  const corr = {}, prec = {};
  for (const d of C.present) {
    const c = cumA(d, L); if (c != null) corr[d] = { cum_time: c };
    const q = cumA(d, L - 1); if (q != null) prec[d] = { cum_time: q };
  }
  const b = K.classifica({
    cumCorrente: corr, cumPrecedente: prec,
    ancora: C.lead[L - 1], primoGiro: false, f, L, nLap: C.nLap,
    battistrada: K.battistradaAiGiri(k => {
      const o = {}; for (const d of C.present) { const c = cumA(d, k); if (c != null) o[d] = { cum_time: c }; }
      return Object.keys(o).length ? o : null;
    }, L, C.nLap, () => true),
    escludi: () => false,
    pareggio: 'scena', ripiegoAncora: true,
  });
  const uguali = a.length === b.length && a.every((r, i) => r.drv === b[i].drv && r.gapTxt === b[i].et);
  if (!uguali && difScena.length < 4) {
    difScena.push(`p=${p.toFixed(2)}: ${a.map(r=>r.drv+r.gapTxt)} vs ${b.map(r=>r.drv+r.et)}`);
  }
}
ok('C3 contesto SCENA identico al riferimento', difScena.length === 0,
   difScena.length ? difScena.join(' | ') : '37 istanti, ordine ed etichette');

// ───────────────────────── C4: il pareggio ─────────────────────────
const pari = { ZZZ: { cum_time: 100 }, AAA: { cum_time: 100 } };
const gara4 = K.classifica({ cumCorrente: pari, cumPrecedente: null, ancora: 0, primoGiro: true,
  f: 0.5, L: 1, nLap: 5, battistrada: {}, escludi: () => false, pareggio: 'gara' });
const scena4 = K.classifica({ cumCorrente: pari, cumPrecedente: null, ancora: 0, primoGiro: false,
  f: 0.5, L: 1, nLap: 5, battistrada: {}, escludi: () => false, pareggio: 'scena' });
ok('C4 il pareggio si rompe come prima', gara4[0].drv === 'AAA' && scena4[0].drv === 'ZZZ',
   `gara ordina per sigla (${gara4.map(r=>r.drv)}), scena tiene l'ordine delle chiavi (${scena4.map(r=>r.drv)})`);

console.log(falliti ? `\nESITO: ROSSO (${falliti} falliti)` : '\nESITO: verde');
process.exit(falliti ? 1 : 0);
