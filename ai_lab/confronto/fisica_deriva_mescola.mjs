// fisica_deriva_mescola.mjs — i due candidati che restano, messi alla prova.
//
//     node ai_lab/confronto/fisica_deriva_mescola.mjs
//
// D1 · LA DERIVA E' LINEARE? Il residuo scende con la frazione di gara
//      (+0,32 -> -0,13). Ma frazione di gara e traffico sono confusi. Qui si
//      misura la PENDENZA del residuo sul giro DENTRO L'ARIA LIBERA e dentro il
//      blocco (gara, pilota), e si dice quale delta70 la annullerebbe.
// D2 · LE MESCOLE SEPARANO IL LIVELLO? Il repo dichiara che non separano il
//      DEGRADO (p = 0,209). Il residuo per mescola pero' non e' piatto. E' un
//      effetto o e' confusione con lo stint, l'eta e la frazione di gara?
//
// NON SCRIVE NIENTE su disco. Non tocca demo/, simulatore/, data/.

import path from 'node:path';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { caricaGare2026 } from '../../simulatore/provenienza/gare_2026.mjs';
import { passoUtilizzabile } from '../../simulatore/provenienza/definizioni.mjs';

const QUI = path.dirname(fileURLToPath(import.meta.url));
const RADICE = path.resolve(QUI, '..', '..');
const SIM = path.join(RADICE, 'simulatore');
const MODELLO = JSON.parse(readFileSync(path.join(SIM, 'data', 'modelli', 'modello_v2.json'), 'utf8'));
const RHO = MODELLO.rho.valore;
const DELTA70 = MODELLO.delta_70.scelto;

const mediana = (v) => { if (!v.length) return null; const s = [...v].sort((a, b) => a - b); const m = s.length >> 1; return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; };
const media = (v) => (v.length ? v.reduce((a, b) => a + b, 0) / v.length : null);
const f = (x, n = 4) => (x === null || x === undefined ? '  —  ' : x.toFixed(n));
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

const verdi = [];
for (const nome of NOMI) {
  const g = gare[nome];
  const N = g.nGiri;
  const deriva = -DELTA70 / N;
  const perGiro = new Map();
  for (const { drv, lap, cella } of g.righe) {
    if (!perGiro.has(lap)) perGiro.set(lap, new Map());
    perGiro.get(lap).set(drv, cella);
  }
  const gapAv = new Map();
  for (const [lap, m] of perGiro) {
    const c = [...m.entries()].filter(([, x]) => typeof x.cum_time === 'number').sort((a, b) => a[1].cum_time - b[1].cum_time);
    for (let i = 0; i < c.length; i += 1) gapAv.set(`${c[i][0]}|${lap}`, i === 0 ? null : c[i][1].cum_time - c[i - 1][1].cum_time);
  }
  for (const { drv, lap, cella } of g.righe) {
    let ok = false;
    try { ok = passoUtilizzabile(cella) && cella.tyre_age !== null; } catch { ok = false; }
    if (!ok) continue;
    verdi.push({
      gara: nome, drv, lap, N, eta: cella.tyre_age, stint: cella.stint, compound: cella.compound,
      r0: cella.lap_time - deriva * (lap - 1) - RHO * cella.tyre_age,
      gap: gapAv.get(`${drv}|${lap}`) ?? null, frazione: lap / N,
    });
  }
}
{
  const acc = new Map();
  for (const v of verdi) { const k = `${v.gara}|${v.drv}`; if (!acc.has(k)) acc.set(k, []); acc.get(k).push(v.r0); }
  const basi = new Map(); for (const [k, val] of acc) basi.set(k, mediana(val));
  for (const v of verdi) v.e = v.r0 - basi.get(`${v.gara}|${v.drv}`);
}
const ARIA = (x) => x.gap === null || x.gap > 2.0;

// ═══════════════════════════════════════════════════════════════════════ D1
console.log('D1 · LA DERIVA LINEARE BASTA? — pendenza del residuo sul giro, dentro il blocco (gara,pilota)');
console.log('   pendenza in s/giro: se fosse 0 il termine delta*(giro-1) sarebbe ben specificato.');
console.log('   una pendenza p si annulla portando delta70 da 2,2 a  2,2 - p*N  (N = giri della gara)');
function pendenzaOLS(righe) {
  // regressione entro-blocco (gara,pilota): e ~ pendenza * (lap-1)
  let sxy = 0; let sxx = 0;
  const per = new Map();
  for (const r of righe) { const k = `${r.gara}|${r.drv}`; if (!per.has(k)) per.set(k, []); per.get(k).push(r); }
  for (const [, v] of per) {
    if (v.length < 5) continue;
    const mx = media(v.map((x) => x.lap - 1)); const my = media(v.map((x) => x.e));
    for (const x of v) { sxy += (x.lap - 1 - mx) * (x.e - my); sxx += (x.lap - 1 - mx) ** 2; }
  }
  return sxx > 0 ? sxy / sxx : null;
}
for (const [et, sel] of [['tutti i giri verdi', () => true], ['solo ARIA LIBERA (>2 s)', ARIA], ['solo IN SCIA (<=1 s)', (x) => x.gap !== null && x.gap <= 1]]) {
  const r = verdi.filter(sel);
  const pg = {}; for (const n of NOMI) pg[n] = r.filter((x) => x.gara === n);
  const ic = icBlocchi(pg, pendenzaOLS);
  const p = pendenzaOLS(r);
  const Nmed = mediana(r.map((x) => x.N));
  console.log(`   ${et.padEnd(26)} n=${String(r.length).padStart(5)}  pendenza ${f(p)} s/giro  IC95 [${f(ic?.[0])}; ${f(ic?.[1])}]  -> delta70 implicato ${f(DELTA70 - p * Nmed, 2)}`);
}
console.log('\n   la stessa pendenza gara per gara, in ARIA LIBERA (blocchi = gare)');
let negative = 0; let giudicabili = 0;
for (const n of NOMI) {
  const r = verdi.filter((x) => x.gara === n && ARIA(x));
  const p = pendenzaOLS(r);
  if (p === null) continue;
  giudicabili += 1; if (p < 0) negative += 1;
  console.log(`     ${n.padEnd(15)} n=${String(r.length).padStart(5)}  pendenza ${f(p)}  -> delta70 implicato ${f(DELTA70 - p * r[0].N, 2)}`);
}
console.log(`   → pendenza negativa (il modello migliora troppo poco col carburante) in ${negative}/${giudicabili} gare`);

// ═══════════════════════════════════════════════════════════════════════ D2
console.log('\nD2 · LE MESCOLE SEPARANO IL LIVELLO? — residuo per mescola, grezzo e con i controlli');
const mesc = ['SOFT', 'MEDIUM', 'HARD'];
function tabellaMescola(et, sel) {
  const r = verdi.filter(sel);
  const parti = mesc.map((m) => {
    const v = r.filter((x) => x.compound === m);
    const pg = {}; for (const n of NOMI) pg[n] = v.filter((x) => x.gara === n).map((y) => y.e);
    const ic = v.length > 30 ? icBlocchi(pg, mediana) : null;
    return `${m} n=${String(v.length).padStart(4)} ${f(mediana(v.map((x) => x.e)), 3).padStart(7)} [${f(ic?.[0], 2)};${f(ic?.[1], 2)}]`;
  });
  console.log(`   ${et.padEnd(30)} ${parti.join('  ')}`);
}
tabellaMescola('grezzo (tutti i giri)', () => true);
tabellaMescola('solo ARIA LIBERA', ARIA);
tabellaMescola('aria libera + stint >= 2', (x) => ARIA(x) && x.stint >= 2);
tabellaMescola('aria libera + eta 5-20', (x) => ARIA(x) && x.eta >= 5 && x.eta <= 20);
tabellaMescola('aria + stint>=2 + eta 5-20', (x) => ARIA(x) && x.stint >= 2 && x.eta >= 5 && x.eta <= 20);
console.log('\n   quante gare usano davvero ogni mescola (giri verdi in aria libera)');
for (const m of mesc) {
  const perGara = NOMI.map((n) => verdi.filter((x) => x.gara === n && ARIA(x) && x.compound === m).length);
  console.log(`     ${m.padEnd(7)} gare con >=50 giri: ${perGara.filter((x) => x >= 50).length}/11   [${perGara.join(', ')}]`);
}

// ═══════════════════ D3 · controllo: il termine rho e' mal specificato? (in aria libera)
console.log('\nD3 · CONTROLLO — residuo vs ETA GOMMA in ARIA LIBERA (se rho lineare bastasse: tutte 0)');
const binsEta = [[1, 3], [4, 7], [8, 12], [13, 18], [19, 25], [26, 99]];
for (const [lo, hi] of binsEta) {
  const v = verdi.filter((x) => ARIA(x) && x.eta >= lo && x.eta <= hi);
  const pg = {}; for (const n of NOMI) pg[n] = v.filter((x) => x.gara === n).map((y) => y.e);
  const ic = icBlocchi(pg, mediana);
  console.log(`   eta ${String(lo).padStart(2)}-${String(hi).padStart(2)}  n=${String(v.length).padStart(5)}  mediana ${f(mediana(v.map((x) => x.e)), 3).padStart(7)}  IC95 [${f(ic?.[0], 3)}; ${f(ic?.[1], 3)}]`);
}
// pendenza del residuo sull'eta, entro blocco: quanto andrebbe corretto rho
function pendenzaEta(righe) {
  let sxy = 0; let sxx = 0;
  const per = new Map();
  for (const r of righe) { const k = `${r.gara}|${r.drv}`; if (!per.has(k)) per.set(k, []); per.get(k).push(r); }
  for (const [, v] of per) {
    if (v.length < 5) continue;
    const mx = media(v.map((x) => x.eta)); const my = media(v.map((x) => x.e));
    for (const x of v) { sxy += (x.eta - mx) * (x.e - my); sxx += (x.eta - mx) ** 2; }
  }
  return sxx > 0 ? sxy / sxx : null;
}
{
  const r = verdi.filter(ARIA);
  const pg = {}; for (const n of NOMI) pg[n] = r.filter((x) => x.gara === n);
  const ic = icBlocchi(pg, pendenzaEta);
  const p = pendenzaEta(r);
  console.log(`   pendenza residua sull'eta (aria libera): ${f(p)} s/giro·giro  IC95 [${f(ic?.[0])}; ${f(ic?.[1])}]  -> rho implicato ${f(RHO + p, 4)} (cablato ${RHO})`);
}
