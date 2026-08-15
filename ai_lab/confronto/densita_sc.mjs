// densita_sc.mjs — I CANCELLI DI PREREG_densita_sc.md.
//
//     node ai_lab/confronto/densita_sc.mjs [--json]
//
// IL MODELLO, a zero parametri liberi: chi perde Δt secondi in un campo dove le auto
// distano mediamente g secondi ne scavalca circa Δt/g.
//
//   passanti_previsti = Δt / g          eccesso_previsto = Δt_m/g_m − Δt_v/g_v
//
// Δt = perdita della sosta rispetto al campo sui DUE giri (in-lap + out-lap), la
// convenzione della casa. g = mediana dei distacchi fra auto adiacenti di TUTTO il campo
// al giro L−1, nella rispettiva simulazione o realta'.
//
// P0 VIENE PRIMA DI TUTTO ed e' la lezione del 15/08: se Δt/g non predice i passanti
// osservati, il modello non descrive la corsa e ogni correlazione costruita sopra e'
// aritmetica. Il conteggio statico di ieri prediceva 2,35 dove se ne osservavano 1,07.
//
// NON SCRIVE NIENTE su disco. I cancelli stanno nella prereg.

import { gare, garaNuova } from './banco.mjs';
import { regimePerGiroDiCampo } from '../../simulatore/provenienza/definizioni.mjs';
import { corri, pianiVeriDi, perGara, media, mediana } from './bandiera.mjs';

const JSON_OUT = process.argv.includes('--json');
const SEME = 20260815;

function rnd(seme) {
  let a = seme >>> 0;
  return () => { a += 0x6D2B79F5; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
const gapMediano = (cum) => {
  const v = Object.values(cum).filter(Number.isFinite).sort((a, b) => a - b);
  const g = []; for (let i = 1; i < v.length; i += 1) g.push(v[i] - v[i - 1]);
  return g.length ? mediana(g) : null;
};

const dati = [];
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

  const campo = Object.entries(e.traccia ?? {})
    .filter(([, p]) => Array.isArray(p) && p.length).map(([d]) => d)
    .filter((d) => gSim.perPilota.get(d)?.size);
  const cumM = {}; const cumV = {};
  for (const d of campo) {
    cumM[d] = {}; for (const p of e.traccia[d]) cumM[d][p.lap] = p.cum_time;
    cumV[d] = {}; for (const [L, c] of gSim.perPilota.get(d)) if (Number.isFinite(c.cum_time)) cumV[d][L] = c.cum_time;
  }
  const al = (f, L) => Object.fromEntries(campo.map((d) => [d, f[d]?.[L] ?? null]));

  const fermiAl = {};
  for (const r of perGara(nomeSito)) for (const s of r.soste_piano) (fermiAl[s.giro] ||= new Set()).add(r.pilota);

  for (const [lapS, chi] of Object.entries(fermiAl)) {
    const L = Number(lapS);
    const regime = neutraVera[L];
    if (!regime || L <= e.congelamento) continue;
    const nonFermi = campo.filter((d) => !chi.has(d));
    const passoM = mediana(nonFermi.map((d) => (cumM[d]?.[L + 1] != null && cumM[d]?.[L - 1] != null) ? (cumM[d][L + 1] - cumM[d][L - 1]) / 2 : null).filter((x) => x != null));
    const passoV = mediana(nonFermi.map((d) => (cumV[d]?.[L + 1] != null && cumV[d]?.[L - 1] != null) ? (cumV[d][L + 1] - cumV[d][L - 1]) / 2 : null).filter((x) => x != null));
    if (passoM == null || passoV == null) continue;
    const primaM = al(cumM, L - 1); const dopoM = al(cumM, L + 1);
    const primaV = al(cumV, L - 1); const dopoV = al(cumV, L + 1);
    const gM = gapMediano(primaM); const gV = gapMediano(primaV);
    if (!gM || !gV) continue;

    for (const d of chi) {
      if (!campo.includes(d)) continue;
      const tm = (cumM[d]?.[L + 1] != null && cumM[d]?.[L - 1] != null) ? (cumM[d][L + 1] - cumM[d][L - 1]) - 2 * passoM : null;
      const tv = (cumV[d]?.[L + 1] != null && cumV[d]?.[L - 1] != null) ? (cumV[d][L + 1] - cumV[d][L - 1]) - 2 * passoV : null;
      if (tm == null || tv == null || tm <= 1 || tv <= 1) continue;
      const passanti = (prima, dopo) => campo.filter((x) => x !== d
        && Number.isFinite(prima[x]) && Number.isFinite(dopo[x])
        && Number.isFinite(prima[d]) && Number.isFinite(dopo[d])
        && prima[x] > prima[d] && dopo[x] < dopo[d]).length;
      dati.push({
        gara: nomeSito, pilota: d, lap: L, regime,
        tm, tv, gM, gV,
        prevM: tm / gM, prevV: tv / gV,
        ossM: passanti(primaM, dopoM), ossV: passanti(primaV, dopoV),
      });
    }
  }
}
for (const r of dati) { r.eccessoOss = r.ossM - r.ossV; r.eccessoPrev = r.prevM - r.prevV; }

// ── strumenti ────────────────────────────────────────────────────────────────
const spearman = (a, b) => {
  const rk = (v) => { const s = v.map((x, i) => [x, i]).sort((p, q) => p[0] - q[0]); const r = []; s.forEach(([, i], k) => { r[i] = k + 1; }); return r; };
  const x = rk(a); const y = rk(b); const n = x.length;
  if (n < 3) return null;
  const mx = media(x); const my = media(y);
  let num = 0; let dx = 0; let dy = 0;
  for (let i = 0; i < n; i += 1) { num += (x[i] - mx) * (y[i] - my); dx += (x[i] - mx) ** 2; dy += (y[i] - my) ** 2; }
  return (dx && dy) ? num / Math.sqrt(dx * dy) : null;
};

// ── P0: il modello predice i passanti OSSERVATI? ─────────────────────────────
const P0 = {
  n: dati.length,
  rho_motore: spearman(dati.map((r) => r.prevM), dati.map((r) => r.ossM)),
  rho_vero: spearman(dati.map((r) => r.prevV), dati.map((r) => r.ossV)),
  scarto_motore: media(dati.map((r) => Math.abs(r.prevM - r.ossM))),
  scarto_vero: media(dati.map((r) => Math.abs(r.prevV - r.ossV))),
  previsto_motore: media(dati.map((r) => r.prevM)), osservato_motore: media(dati.map((r) => r.ossM)),
  previsto_vero: media(dati.map((r) => r.prevV)), osservato_vero: media(dati.map((r) => r.ossV)),
};

// ── P1/P2/P3 sulle sole SC ───────────────────────────────────────────────────
const sc = dati.filter((r) => r.regime === 'SC');
const G = [...new Set(sc.map((r) => r.gara))];
const perG = Object.fromEntries(G.map((g) => [g, sc.filter((r) => r.gara === g)]));
const rhoSC = spearman(sc.map((r) => r.eccessoPrev), sc.map((r) => r.eccessoOss));
const r1 = rnd(SEME); const boot = [];
for (let i = 0; i < 2000; i += 1) {
  const d = []; for (let j = 0; j < G.length; j += 1) d.push(...perG[G[Math.floor(r1() * G.length)]]);
  const v = spearman(d.map((x) => x.eccessoPrev), d.map((x) => x.eccessoOss));
  if (v !== null) boot.push(v);
}
boot.sort((a, b) => a - b);
const ic = [boot[Math.floor(0.025 * boot.length)], boot[Math.floor(0.975 * boot.length)]];

const r2 = rnd(SEME); const finte = [];
for (let i = 0; i < 200; i += 1) {
  const mesc = [];
  for (const g of G) {
    const v = perG[g]; const gm = v.map((x) => x.gM); const gv = v.map((x) => x.gV);
    for (let j = gm.length - 1; j > 0; j -= 1) { const k = Math.floor(r2() * (j + 1)); [gm[j], gm[k]] = [gm[k], gm[j]]; [gv[j], gv[k]] = [gv[k], gv[j]]; }
    v.forEach((x, i2) => mesc.push({ ...x, eccessoPrev: x.tm / gm[i2] - x.tv / gv[i2] }));
  }
  const v = spearman(mesc.map((x) => x.eccessoPrev), mesc.map((x) => x.eccessoOss));
  if (v !== null) finte.push(v);
}
finte.sort((a, b) => a - b);
const p95 = finte[Math.floor(0.95 * finte.length)];

const num = (x) => (x == null || !Number.isFinite(x) ? null : Number(x.toFixed(4)));
const perRegime = {};
for (const r of dati) {
  (perRegime[r.regime] ||= { n: 0, prev: 0, oss: 0 });
  perRegime[r.regime].n += 1; perRegime[r.regime].prev += r.eccessoPrev; perRegime[r.regime].oss += r.eccessoOss;
}

const fuori = {
  P0: Object.fromEntries(Object.entries(P0).map(([k, v]) => [k, typeof v === 'number' ? num(v) : v])),
  P0_verde: Math.max(P0.scarto_motore, P0.scarto_vero) < 0.6,
  P1: { n: sc.length, gare: G.length, rho: num(rhoSC), ic95: ic.map(num), esclude_zero: ic[0] > 0 },
  P2: { previsto: num(media(sc.map((r) => r.eccessoPrev))), osservato: num(media(sc.map((r) => r.eccessoOss))) },
  P3: { p95_finte: num(p95), mediana_finte: num(finte[100]), pulito: rhoSC > p95 },
  per_regime: Object.fromEntries(Object.entries(perRegime).map(([k, v]) => [k, { n: v.n, eccesso_previsto: num(v.prev / v.n), eccesso_osservato: num(v.oss / v.n) }])),
};
fuori.P2.rapporto = num(fuori.P2.previsto / fuori.P2.osservato);
fuori.P2_verde = Math.sign(fuori.P2.previsto) === Math.sign(fuori.P2.osservato)
  && Math.abs(fuori.P2.rapporto) <= 3 && Math.abs(fuori.P2.rapporto) >= 1 / 3;

if (JSON_OUT) { console.log(JSON.stringify({ ...fuori, dati }, null, 1)); } else {
  console.log('');
  console.log('  LA DENSITA\' SPIEGA L\'ECCESSO? — PREREG_densita_sc.md');
  console.log('');
  console.log(`  P0  la validazione (n = ${fuori.P0.n}, SC+VSC) — Δt/g predice i passanti osservati?`);
  console.log(`      motore: previsto ${fuori.P0.previsto_motore} · osservato ${fuori.P0.osservato_motore} · rho ${fuori.P0.rho_motore} · scarto medio ${fuori.P0.scarto_motore}`);
  console.log(`      vero:   previsto ${fuori.P0.previsto_vero} · osservato ${fuori.P0.osservato_vero} · rho ${fuori.P0.rho_vero} · scarto medio ${fuori.P0.scarto_vero}`);
  console.log(`      scarto sotto 0,6 (l'effetto da spiegare)? ${fuori.P0_verde ? 'SI' : 'NO — tutto il resto e\' NULLO'}`);
  console.log('');
  console.log(`  P1  fuori campione, sole SC (n = ${fuori.P1.n} su ${fuori.P1.gare} gare)`);
  console.log(`      rho previsto/osservato ${fuori.P1.rho}   IC95 [${fuori.P1.ic95[0]} ; ${fuori.P1.ic95[1]}]  → ${fuori.P1.esclude_zero ? 'esclude lo zero' : 'CONTIENE lo zero'}`);
  console.log(`  P2  eccesso medio SC: previsto ${fuori.P2.previsto} · osservato ${fuori.P2.osservato} · rapporto ${fuori.P2.rapporto}  ${fuori.P2_verde ? 'entro il fattore 3' : 'FUORI'}`);
  console.log(`  P3  placebo: 95° percentile delle finte ${fuori.P3.p95_finte} · mediana ${fuori.P3.mediana_finte} → ${fuori.P3.pulito ? 'la vera lo batte' : 'NON lo batte'}`);
  console.log('');
  console.log('  per regime — eccesso previsto contro osservato:');
  for (const [k, v] of Object.entries(fuori.per_regime)) console.log(`      ${k.padEnd(4)} n=${String(v.n).padStart(3)}   previsto ${String(v.eccesso_previsto).padStart(8)} · osservato ${v.eccesso_osservato}`);
  console.log('');
}
