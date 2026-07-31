#!/usr/bin/env node
// quanta_verita_ce.mjs — SI PUO' TARARE UNA BANDA PER IL REGIME "POCHI GIRI"?
//
// La proposta ovvia («rispondi prima, ma con una banda piu' larga DICHIARATA») ha un
// prezzo di ammissione: la banda va TARATA, e tarare vuol dire avere casi con verita'.
// Questo script conta quanti ce ne sono davvero — su tutte le 459 soste reali 2026, non
// solo sulle 274 del perimetro — e fa i due controlli che il resto della lente richiede:
//   · il confronto pochi-giri / molti-giri APPAIATO sul giro di congelamento (bootstrap
//     a blocchi = gare), che e' l'unico modo di non confondere «pochi giri» con «presto»;
//   · la coda del secchio a 4 giri, che nella mediana non si vede.
//
// Uso: node ai_lab/confronto/lente_copertura/quanta_verita_ce.mjs
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { gare, garaNuova, garaSimDi, datiVecchio, RADICE } from '../banco.mjs';
import { osservazioniVerdi } from '../../../simulatore/provenienza/gare_indice.mjs';
import { stimaBasi, derivaPerGiro } from '../../../simulatore/engine/passo_v2.mjs';

const modello = JSON.parse(readFileSync(path.join(RADICE, 'simulatore', 'data', 'modelli', 'modello_v2.json'), 'utf8'));
const RHO = modello.rho.valore, D70 = modello.delta_70.scelto;
const mediana = (v) => { if (!v.length) return null; const s = [...v].sort((a, b) => a - b); const m = s.length >> 1; return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; };
const pc = (n, d) => (d ? (100 * n / d).toFixed(1) + '%' : 'n/d');

// ═══ 1 · QUANTE SOSTE REALI CADONO NEL REGIME "POCHI GIRI" ═══
console.log('═══ 1 · LE SOSTE REALI 2026 PER GIRI VERDI AL CONGELAMENTO ═══');
const conta = {}; let tot = 0; const perGaraBassi = {};
for (const nomeSito of gare()) {
  const g = garaNuova(nomeSito);
  const { byLap, nLaps } = datiVecchio(nomeSito);
  const verdiPer = new Map();
  for (const { drv, lap } of osservazioniVerdi(g.righe)) { if (!verdiPer.has(drv)) verdiPer.set(drv, []); verdiPer.get(drv).push(lap); }
  for (let Li = 1; Li <= nLaps; Li += 1) {
    const cars = byLap[Li]; if (!cars) continue;
    for (const pilota of Object.keys(cars)) {
      if (cars[pilota].in_lap !== true) continue;
      tot += 1;
      const L = Li - 1;
      const v = (verdiPer.get(pilota) ?? []).filter((l) => l <= L).length;
      const k = v >= 8 ? '8+' : String(v);
      conta[k] = (conta[k] ?? 0) + 1;
      if (v < 8) perGaraBassi[nomeSito] = (perGaraBassi[nomeSito] ?? 0) + 1;
    }
  }
}
console.log(`  soste reali trovate: ${tot}`);
console.log('  ' + Object.entries(conta).sort((a, b) => (a[0] === '8+' ? 1 : b[0] === '8+' ? -1 : a[0] - b[0])).map(([k, v]) => `${k} giri: ${v}`).join(' · '));
const bassi = Object.entries(conta).filter(([k]) => k !== '8+').reduce((a, [, v]) => a + v, 0);
console.log(`  → soste con MENO di 8 giri verdi al congelamento: ${bassi}/${tot} (${pc(bassi, tot)})`);
console.log('  per gara: ' + Object.entries(perGaraBassi).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k} ${v}`).join(' · '));
console.log('  NOTA: e\' il tetto assoluto dei casi con verita\' per tarare una banda in quel regime,');
console.log('        prima di qualunque esclusione di perimetro. Sulle 274 ammesse ne restano 14.');

// ═══ 2 · IL CONFRONTO APPAIATO SUL GIRO DI CONGELAMENTO ═══
// «pochi giri» e «presto in gara» sono la stessa cosa se non si controlla Lf. Qui il
// confronto si fa DENTRO ogni Lf e poi si combina: cosi' la domanda e' davvero
// «a parita' di momento, la base corta e' peggio?».
console.log('\n═══ 2 · POCHI GIRI CONTRO MOLTI, A PARITA\' DI GIRO (finestra pulita, H=3) ═══');
const H = 3;
const righe = [];
for (const nomeSito of gare()) {
  const g = garaNuova(nomeSito);
  const oss = osservazioniVerdi(g.righe);
  const deriva = derivaPerGiro(D70, g.nGiri);
  const verdiPer = new Map();
  for (const { drv, lap } of oss) { if (!verdiPer.has(drv)) verdiPer.set(drv, []); verdiPer.get(drv).push(lap); }
  const cella = (drv, lap) => { const c = g.perPilota.get(drv); return c ? c.get(lap) : null; };
  for (let Lf = 5; Lf <= Math.min(40, g.nGiri - H - 1); Lf += 1) {
    const basi = stimaBasi(oss, { delta70: D70, rho: RHO, nGiri: g.nGiri, finoA: Lf, minGiri: 1 });
    const prev = {}, real = {};
    for (const drv of g.perPilota.keys()) {
      const a = cella(drv, Lf), b = cella(drv, Lf + H);
      if (!a || !b || typeof a.cum_time !== 'number' || typeof b.cum_time !== 'number') continue;
      const base = basi[drv]; if (base == null || typeof a.tyre_age !== 'number') continue;
      let cum = a.cum_time;
      for (let k = 1; k <= H; k += 1) cum += base + deriva * (Lf + k - 1) + RHO * (a.tyre_age + k);
      prev[drv] = cum; real[drv] = b.cum_time;
    }
    const piloti = Object.keys(prev); if (piloti.length < 5) continue;
    const leader = piloti.reduce((a, b) => (cella(a, Lf).cum_time <= cella(b, Lf).cum_time ? a : b));
    const sporco = (drv) => { for (let k = Lf + 1; k <= Lf + H; k += 1) { const c = cella(drv, k); if (c && (c.in_lap === true || c.out_lap === true)) return true; } return false; };
    if (sporco(leader)) continue;
    for (const drv of piloti) {
      if (drv === leader || sporco(drv)) continue;
      const v = (verdiPer.get(drv) ?? []).filter((l) => l <= Lf).length;
      righe.push({ gara: nomeSito, Lf, v, err: ((prev[drv] - prev[leader]) - (real[drv] - real[leader])) / H });
    }
  }
}
// scarto appaiato: dentro ogni (gara, Lf) con almeno 3 casi per parte
function scartoAppaiato(dati) {
  const per = new Map();
  for (const r of dati) { const k = `${r.gara}|${r.Lf}`; if (!per.has(k)) per.set(k, []); per.get(k).push(r); }
  const d = [];
  for (const [, v] of per) {
    const a = v.filter((r) => r.v >= 4 && r.v < 8).map((r) => Math.abs(r.err));
    const b = v.filter((r) => r.v >= 8).map((r) => Math.abs(r.err));
    if (a.length >= 3 && b.length >= 3) d.push(mediana(a) - mediana(b));
  }
  return d;
}
const d0 = scartoAppaiato(righe);
console.log(`  celle (gara × giro) con almeno 3 casi per parte: ${d0.length}`);
console.log(`  scarto mediano DENTRO cella  (4-7 giri) − (8+ giri) = ${mediana(d0).toFixed(4)} s/giro`);
console.log(`  celle in cui la base corta e' PEGGIO: ${d0.filter((x) => x > 0).length}/${d0.length} (${pc(d0.filter((x) => x > 0).length, d0.length)})`);
let seed = 20260801;
const rnd = () => { seed ^= seed << 13; seed ^= seed >>> 17; seed ^= seed << 5; return ((seed >>> 0) / 4294967296); };
const perGara = new Map();
for (const r of righe) { if (!perGara.has(r.gara)) perGara.set(r.gara, []); perGara.get(r.gara).push(r); }
const blocchi = [...perGara.values()];
const boot = [];
for (let b = 0; b < 10000; b += 1) {
  const camp = [];
  for (let i = 0; i < blocchi.length; i += 1) camp.push(...blocchi[Math.floor(rnd() * blocchi.length)]);
  const d = scartoAppaiato(camp);
  if (d.length >= 5) boot.push(mediana(d));
}
boot.sort((a, b) => a - b);
const q = (p) => boot[Math.floor(p * (boot.length - 1))];
console.log(`  bootstrap a blocchi = gare: IC95 [${q(0.025).toFixed(4)} ; ${q(0.975).toFixed(4)}] · P(scarto <= 0) = ${(boot.filter((x) => x <= 0).length / boot.length).toFixed(3)}`);

// ═══ 3 · LA CODA A 4 GIRI (la mediana la nasconde) ═══
console.log('\n═══ 3 · LA CODA, SECCHIO PER SECCHIO (finestra pulita) ═══');
console.log('  giri     n   |err| mediano   p75     p90     p95     max     quota > 1 s/giro');
for (const [lo, hi] of [[2, 3], [4, 4], [5, 5], [6, 7], [8, 8], [9, 11], [12, 99]]) {
  const sub = righe.filter((r) => r.v >= lo && r.v <= hi);
  if (sub.length < 10) continue;
  const a = sub.map((r) => Math.abs(r.err)).sort((x, y) => x - y);
  const p = (f) => a[Math.floor(f * (a.length - 1))];
  console.log(`  ${(lo + (hi > lo ? '-' + hi : '')).padEnd(6)} ${String(sub.length).padStart(5)}      ${mediana(a).toFixed(3)}      ${p(0.75).toFixed(3)}   ${p(0.90).toFixed(3)}   ${p(0.95).toFixed(3)}   ${a[a.length - 1].toFixed(2)}    ${pc(a.filter((x) => x > 1).length, a.length)}`);
}
const q4 = righe.filter((r) => r.v === 4).sort((a, b) => Math.abs(b.err) - Math.abs(a.err)).slice(0, 6);
console.log('  i 6 casi peggiori a 4 giri: ' + q4.map((r) => `${r.gara}|${r.Lf} ${r.err.toFixed(2)}`).join(' · '));
