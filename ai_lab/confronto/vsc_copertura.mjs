// vsc_copertura.mjs — I CANCELLI DI PREREG_vsc_copertura.md.
//
//     node ai_lab/confronto/vsc_copertura.mjs [--json]
//
// B esiste ed e' solo VSC: il motore lascia passare 1,90 auto attorno a chi si ferma
// contro 1,28 vere. L'ipotesi e' che il motore neutralizzi il giro PER INTERO mentre la
// gara lo neutralizza a meta' (copertura mediana 52%). Se e' cosi', l'eccesso deve
// crescere dove la copertura scende.
//
// La copertura viene da `frazioni_vsc_2026.json` (VSC A TEMPO, validata), non dal simbolo
// '6' per-giro che e' sotto veto: qui entra come variabile di MISURA, mai nel kernel.
//
// NON SCRIVE NIENTE su disco. I cancelli stanno nella prereg.

import { gare, garaNuova } from './banco.mjs';
import { regimePerGiroDiCampo } from '../../simulatore/provenienza/definizioni.mjs';
import { corri, pianiVeriDi, perGara, media } from './bandiera.mjs';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { RADICE } from './banco.mjs';

const JSON_OUT = process.argv.includes('--json');
const SEME = 20260815;
const FRAZ = JSON.parse(readFileSync(path.join(RADICE, 'ai_lab', 'neutralizzazione', 'frazioni_vsc_2026.json'), 'utf8'));

function rnd(seme) {
  let a = seme >>> 0;
  return () => { a += 0x6D2B79F5; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

// ── le 63 soste, con l'eccesso OSSERVATO e la copertura VERA ─────────────────
const dati = [];
for (const nomeSito of gare()) {
  const gSim = garaNuova(nomeSito);
  const neutraVera = regimePerGiroDiCampo(gSim.perPilota);
  const fraz = FRAZ.gare[nomeSito]?.piloti;
  if (!fraz) continue;
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

  const campo = Object.entries(e.traccia ?? {})
    .filter(([, p]) => Array.isArray(p) && p.length).map(([d]) => d)
    .filter((d) => gSim.perPilota.get(d)?.size);
  const cumM = {}; const cumV = {};
  for (const d of campo) {
    cumM[d] = {}; for (const p of e.traccia[d]) cumM[d][p.lap] = p.cum_time;
    cumV[d] = {}; for (const [L, c] of gSim.perPilota.get(d)) if (Number.isFinite(c.cum_time)) cumV[d][L] = c.cum_time;
  }
  const al = (f, L) => Object.fromEntries(campo.map((d) => [d, f[d]?.[L] ?? null]));

  for (const r of perGara(nomeSito)) {
    for (const s of r.soste_piano) {
      const L = s.giro;
      if (neutraVera[L] !== 'VSC' || L <= e.congelamento) continue;
      if (!campo.includes(r.pilota)) continue;
      const f = fraz[r.pilota]?.[String(L)]?.f_vsc;
      if (typeof f !== 'number') continue;
      const primaM = al(cumM, L - 1); const dopoM = al(cumM, L + 1);
      const primaV = al(cumV, L - 1); const dopoV = al(cumV, L + 1);
      const passanti = (prima, dopo) => campo.filter((x) => x !== r.pilota
        && Number.isFinite(prima[x]) && Number.isFinite(dopo[x])
        && Number.isFinite(prima[r.pilota]) && Number.isFinite(dopo[r.pilota])
        && prima[x] > prima[r.pilota] && dopo[x] < dopo[r.pilota]).length;
      const pm = passanti(primaM, dopoM); const pv = passanti(primaV, dopoV);
      if (!Number.isFinite(pm) || !Number.isFinite(pv)) continue;
      dati.push({ gara: nomeSito, pilota: r.pilota, lap: L, f, eccesso: pm - pv, pm, pv });
    }
  }
}

// ── la pendenza, e il bootstrap a BLOCCHI = GARE ─────────────────────────────
function pendenza(v) {
  const n = v.length; if (n < 3) return null;
  const mx = media(v.map((x) => x.f)); const my = media(v.map((x) => x.eccesso));
  let num = 0; let den = 0;
  for (const x of v) { num += (x.f - mx) * (x.eccesso - my); den += (x.f - mx) ** 2; }
  return den === 0 ? null : num / den;
}
const G = [...new Set(dati.map((x) => x.gara))];
const perG = Object.fromEntries(G.map((g) => [g, dati.filter((x) => x.gara === g)]));

const b = pendenza(dati);
const r = rnd(SEME);
const boot = [];
for (let i = 0; i < 2000; i += 1) {
  const d = [];
  for (let j = 0; j < G.length; j += 1) d.push(...perG[G[Math.floor(r() * G.length)]]);
  const p = pendenza(d); if (p !== null) boot.push(p);
}
boot.sort((x, y) => x - y);
const ic = [boot[Math.floor(0.025 * boot.length)], boot[Math.floor(0.975 * boot.length)]];

// ── V2: il placebo, f rimescolata DENTRO ogni gara ───────────────────────────
const r2 = rnd(SEME);
const finte = [];
for (let i = 0; i < 200; i += 1) {
  const mescolati = [];
  for (const g of G) {
    const v = perG[g]; const f = v.map((x) => x.f);
    for (let j = f.length - 1; j > 0; j -= 1) { const k = Math.floor(r2() * (j + 1)); [f[j], f[k]] = [f[k], f[j]]; }
    v.forEach((x, idx) => mescolati.push({ ...x, f: f[idx] }));
  }
  const p = pendenza(mescolati); if (p !== null) finte.push(p);
}
finte.sort((x, y) => x - y);
const p05 = finte[Math.floor(0.05 * finte.length)];

// ── V3: terzili e soste piene (riportato, non cancello) ──────────────────────
const ord = [...dati].sort((a, c) => a.f - c.f);
const t = Math.floor(ord.length / 3);
const terzili = [ord.slice(0, t), ord.slice(t, 2 * t), ord.slice(2 * t)];
const piene = dati.filter((x) => x.f >= 0.9);

const num = (x) => (x == null || !Number.isFinite(x) ? null : Number(x.toFixed(4)));
const fuori = {
  n: dati.length, gare: G.length,
  f_mediana: num(media(dati.map((x) => x.f))),
  eccesso_medio: num(media(dati.map((x) => x.eccesso))),
  V1_pendenza: num(b), V1_ic95: ic.map(num), V1_esclude_zero: ic[0] < 0 && ic[1] < 0,
  V2_p05_finte: num(p05), V2_mediana_finte: num(finte[100]), V2_pulito: b < p05,
  V3_terzili: terzili.map((v) => ({ n: v.length, f: num(media(v.map((x) => x.f))), eccesso: num(media(v.map((x) => x.eccesso))) })),
  V3_piene: { n: piene.length, f: num(media(piene.map((x) => x.f))), eccesso: num(media(piene.map((x) => x.eccesso))) },
};

if (JSON_OUT) { console.log(JSON.stringify({ ...fuori, dati }, null, 1)); } else {
  console.log('');
  console.log('  B E\' LA COPERTURA? — PREREG_vsc_copertura.md');
  console.log(`  ${fuori.n} soste su ${fuori.gare} gare · copertura media ${(fuori.f_mediana * 100).toFixed(0)}% · eccesso medio ${fuori.eccesso_medio}`);
  console.log('');
  console.log(`    V1  pendenza  ${fuori.V1_pendenza}   IC95 [${fuori.V1_ic95[0]} ; ${fuori.V1_ic95[1]}]  (blocchi = gare)`);
  console.log(`        negativa e l'IC esclude lo zero? ${fuori.V1_esclude_zero ? 'SI' : 'NO'}`);
  console.log(`    V2  placebo: 5° percentile delle finte ${fuori.V2_p05_finte} · mediana ${fuori.V2_mediana_finte}`);
  console.log(`        la vera sta sotto il 5° percentile? ${fuori.V2_pulito ? 'SI' : 'NO'}`);
  console.log('');
  console.log('    V3 (riportato, non cancello)  terzili di copertura:');
  for (const x of fuori.V3_terzili) console.log(`        f medio ${(x.f * 100).toFixed(0)}%  →  eccesso ${x.eccesso}   (n = ${x.n})`);
  console.log(`        soste PIENE (f ≥ 0,9): eccesso ${fuori.V3_piene.eccesso}   (n = ${fuori.V3_piene.n})`);
  console.log('');
}
