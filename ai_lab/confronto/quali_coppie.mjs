// quali_coppie.mjs — I CANCELLI DI PREREG_quali_coppie.md.
//
//     node ai_lab/confronto/quali_coppie.mjs [--json]
//
// L'unita' e' la COPPIA, non il cambio. Per ogni coppia {A,B} del campo comune: il loro
// ordine relativo e' cambiato fra il congelamento e la bandiera? Nel motore, e nella
// realta'. Tabella 2x2, e l'associazione phi dice se il motore sa QUALI o solo QUANTE.
//
// Q2 e' il metro vero: un motore FINTO che scambia lo stesso numero ESATTO di coppie ma
// scelte a caso. Azzeccare quante e' gratis; azzeccare quali no.
//
// NON SCRIVE NIENTE su disco. I cancelli stanno nella prereg.

import { gare, garaNuova } from './banco.mjs';
import { regimePerGiroDiCampo } from '../../simulatore/provenienza/definizioni.mjs';
import { corri, pianiVeriDi, perGara, media } from './bandiera.mjs';

const JSON_OUT = process.argv.includes('--json');
const SEME = 20260815;
function rnd(seme) {
  let a = seme >>> 0;
  return () => { a += 0x6D2B79F5; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
// phi della tabella 2x2. Se una marginale e' nulla phi non e' definita: si dice, non si
// mette zero (regola 6).
const phi = ({ a, b, c, d }) => {
  const den = Math.sqrt((a + b) * (c + d) * (a + c) * (b + d));
  return den === 0 ? null : (a * d - b * c) / den;
};

const perGaraDati = [];
for (const nomeSito of gare()) {
  const gSim = garaNuova(nomeSito);
  const neutraVera = regimePerGiroDiCampo(gSim.perPilota);
  const ritiriVeri = {};
  for (const x of perGara(nomeSito)) {
    if (x.classificato) continue;
    const celle = gSim.perPilota.get(x.pilota);
    if (celle && celle.size) ritiriVeri[x.pilota] = Math.max(...celle.keys());
  }
  const piani = pianiVeriDi(nomeSito);
  let e = null;
  for (const x of perGara(nomeSito)) {
    const t = corri(nomeSito, x.pilota, {
      pianiRivali: piani, ritiriRivali: ritiriVeri, neutralizzazioneVera: neutraVera, conTraccia: true,
    });
    if (!t.saltato) { e = t; break; }
  }
  if (!e) continue;

  const lf = e.congelamento; const fine = e.n_giri;
  const campo = Object.entries(e.traccia ?? {})
    .filter(([, p]) => Array.isArray(p) && p.length).map(([d]) => d)
    .filter((d) => gSim.perPilota.get(d)?.size);
  // servono i cum al congelamento E alla bandiera, in entrambi
  const cumA = {}; const cumB = {};   // A = congelamento, B = bandiera
  const vivi = [];
  for (const d of campo) {
    const m0 = gSim.perPilota.get(d)?.get(lf)?.cum_time;
    const mF = gSim.perPilota.get(d)?.get(fine)?.cum_time;
    const pF = e.traccia[d].find((p) => p.lap === fine)?.cum_time;
    if (!Number.isFinite(m0) || !Number.isFinite(mF) || !Number.isFinite(pF)) continue;
    vivi.push(d);
    cumA[d] = { vero: m0, motore: m0 };            // al congelamento i due coincidono per costruzione
    cumB[d] = { vero: mF, motore: pF };
  }

  const coppie = [];
  for (let i = 0; i < vivi.length; i += 1) {
    for (let j = i + 1; j < vivi.length; j += 1) {
      const A = vivi[i]; const B = vivi[j];
      const primaA = cumA[A].vero < cumA[B].vero;    // A davanti a B al congelamento
      const dopoV = cumB[A].vero < cumB[B].vero;
      const dopoM = cumB[A].motore < cumB[B].motore;
      coppie.push({ A, B, vero: primaA !== dopoV, motore: primaA !== dopoM });
    }
  }
  const t = { a: 0, b: 0, c: 0, d: 0 };
  for (const x of coppie) {
    if (x.motore && x.vero) t.a += 1;
    else if (x.motore && !x.vero) t.b += 1;
    else if (!x.motore && x.vero) t.c += 1;
    else t.d += 1;
  }
  perGaraDati.push({ gara: nomeSito, n_coppie: coppie.length, ...t, phi: phi(t), coppie });
}

const somma = (righe) => righe.reduce((acc, r) => ({ a: acc.a + r.a, b: acc.b + r.b, c: acc.c + r.c, d: acc.d + r.d }), { a: 0, b: 0, c: 0, d: 0 });
const T = somma(perGaraDati);
const phiVero = phi(T);

// ── Q1: IC95 a blocchi = gare ────────────────────────────────────────────────
const r1 = rnd(SEME); const boot = [];
for (let i = 0; i < 2000; i += 1) {
  const scelte = [];
  for (let j = 0; j < perGaraDati.length; j += 1) scelte.push(perGaraDati[Math.floor(r1() * perGaraDati.length)]);
  const v = phi(somma(scelte)); if (v !== null) boot.push(v);
}
boot.sort((x, y) => x - y);
const ic = [boot[Math.floor(0.025 * boot.length)], boot[Math.floor(0.975 * boot.length)]];

// ── Q2: il motore FINTO — stesso numero di scambi, coppie a caso ─────────────
const r2 = rnd(SEME); const finte = [];
for (let i = 0; i < 200; i += 1) {
  const tab = { a: 0, b: 0, c: 0, d: 0 };
  for (const g of perGaraDati) {
    const quante = g.a + g.b;                       // lo STESSO numero di scambi del motore
    const idx = g.coppie.map((_, k) => k);
    for (let k = idx.length - 1; k > 0; k -= 1) { const q = Math.floor(r2() * (k + 1)); [idx[k], idx[q]] = [idx[q], idx[k]]; }
    const scelti = new Set(idx.slice(0, quante));
    g.coppie.forEach((x, k) => {
      const m = scelti.has(k);
      if (m && x.vero) tab.a += 1; else if (m && !x.vero) tab.b += 1;
      else if (!m && x.vero) tab.c += 1; else tab.d += 1;
    });
  }
  const v = phi(tab); if (v !== null) finte.push(v);
}
finte.sort((x, y) => x - y);
const p95 = finte[Math.floor(0.95 * finte.length)];

const num = (x) => (x == null || !Number.isFinite(x) ? null : Number(x.toFixed(4)));
const fuori = {
  per_gara: perGaraDati.map(({ coppie, ...r }) => ({ ...r, phi: num(r.phi) })),
  totale: { ...T, n: T.a + T.b + T.c + T.d, phi: num(phiVero) },
  Q1: { ic95: ic.map(num), esclude_zero: ic[0] > 0 },
  Q2: { p95_finte: num(p95), mediana_finte: num(finte[100]), pulito: phiVero > p95 },
  Q3: {
    precisione: num(T.a / (T.a + T.b)),      // fra quelle che il motore scambia, quante la realta' scambia
    richiamo: num(T.a / (T.a + T.c)),        // fra quelle che la realta' scambia, quante il motore prende
    scambiate_motore: T.a + T.b, scambiate_vero: T.a + T.c,
  },
};

if (JSON_OUT) { console.log(JSON.stringify(fuori, null, 1)); } else {
  console.log('');
  console.log('  IL MOTORE SA QUALI? — PREREG_quali_coppie.md');
  console.log('');
  console.log('  gara            coppie   a(entrambi)  b(solo mot)  c(solo vero)  d(nessuno)   phi');
  for (const r of fuori.per_gara) {
    console.log(`  ${r.gara.padEnd(15)} ${String(r.n_coppie).padStart(4)}   ${String(r.a).padStart(9)}  ${String(r.b).padStart(11)}  ${String(r.c).padStart(12)}  ${String(r.d).padStart(10)}   ${r.phi}`);
  }
  const t = fuori.totale;
  console.log('');
  console.log(`  TOTALE ${t.n} coppie:  a ${t.a} · b ${t.b} · c ${t.c} · d ${t.d}`);
  console.log(`  scambiate dal motore ${fuori.Q3.scambiate_motore} · dalla realta' ${fuori.Q3.scambiate_vero}`);
  console.log('');
  console.log(`  Q1  phi = ${t.phi}   IC95 [${fuori.Q1.ic95[0]} ; ${fuori.Q1.ic95[1]}]  → ${fuori.Q1.esclude_zero ? 'esclude lo zero' : 'CONTIENE lo zero'}`);
  console.log(`  Q2  motore FINTO (stesso numero, coppie a caso): 95° percentile ${fuori.Q2.p95_finte} · mediana ${fuori.Q2.mediana_finte}`);
  console.log(`      la phi vera lo batte? ${fuori.Q2.pulito ? 'SI' : 'NO'}`);
  console.log(`  Q3  precisione ${fuori.Q3.precisione} · richiamo ${fuori.Q3.richiamo}`);
  console.log('');
}
