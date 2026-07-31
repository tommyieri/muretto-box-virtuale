// lente_pacchetto.mjs — le tre correzioni, una alla volta e tutte insieme.
//   node ai_lab/confronto/lente_pacchetto.mjs
import { casi, garaNuova, contestoNuovo } from './banco.mjs';
import { doveRientri } from '../../simulatore/scenario/costruttore.mjs';
import { mescolaAlGiro } from '../../simulatore/scenario/risposta.mjs';
import { creaCella } from '../../simulatore/provenienza/contratto.mjs';
import { simboliStatus } from '../../simulatore/provenienza/vocabolario.mjs';
import { regimeDiCella } from './lente_neutralizzazione.mjs';
import { erroreComune } from './lente_regime_dal_campo.mjs';

const mediana = (v) => { if (!v.length) return null; const s = [...v].sort((a, b) => a - b); const m = s.length >> 1; return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; };
const haRossa = (c) => { try { return c && c.status !== null && simboliStatus(c.status).has('5'); } catch { return false; } };

function garaSenzaRivali(g, pilota, L) {
  const perPilota = new Map(g.perPilota);
  for (const [drv, celle] of g.perPilota) {
    if (drv === pilota) continue;
    const clone = new Map(celle);
    for (const [lap, c] of celle) {
      if (lap > L || c.stint === null) continue;
      clone.set(lap, creaCella({ lap_time: c.lap_time, cum_time: c.cum_time, stint: c.stint + 1, compound: c.compound,
        tyre_age: c.tyre_age, in_lap: c.in_lap, out_lap: c.out_lap, status: c.status, del: c.del }));
    }
    perPilota.set(drv, clone);
  }
  return { ...g, perPilota };
}

function risp(k, { rossa = false, rivaliOff = false } = {}) {
  const g = garaNuova(k.gara);
  const mescola = mescolaAlGiro(g, k.freezeLap, k.pilota);
  if (mescola === null) return { muto: true };
  const base = contestoNuovo(k.gara);
  const cL = g.perPilota.get(k.pilota).get(k.freezeLap);
  const applicaRossa = rossa && regimeDiCella(cL) !== null && haRossa(cL);
  const RED = base.prior.fattori_neutralizzazione.RED;
  const prior = applicaRossa
    ? { ...base.prior, fattori_neutralizzazione: { ...base.prior.fattori_neutralizzazione, SC: RED, VSC: RED } }
    : base.prior;
  const gara = rivaliOff ? garaSenzaRivali(g, k.pilota, k.freezeLap) : g;
  let r;
  try { r = doveRientri({ gara: k.garaSim, freezeLap: k.freezeLap, pilota: k.pilota, giroPit: k.pitLap, mescola },
                        { ...base, gare: { ...base.gare, [k.garaSim]: gara }, prior }); } catch { return { muto: true }; }
  if (!r?.approvato || r.posizione == null) return { muto: true };
  const cum = {};
  for (const [drv, passi] of Object.entries(r.traccia ?? {})) { const x = passi?.find((y) => y.lap === k.rientroLap); if (x) cum[drv] = x.cum_time; }
  return { muto: false, banda: r.banda_posizione, ordine: Object.keys(cum).sort((a, b) => (cum[a] - cum[b]) || (a < b ? -1 : 1)) };
}

const elenco = casi();
const eB = (k, v) => (v.muto ? null : erroreComune(k, v.ordine));
const copre = (k, v) => (v.muto || !v.banda ? null : k.posizioneVera >= v.banda.da && k.posizioneVera <= v.banda.a);

const varianti = [
  ['motore com\'e\'', {}],
  ['+ rossa onorata', { rossa: true }],
  ['+ rivali SC spenti', { rivaliOff: true }],
  ['+ rossa + rivali spenti', { rossa: true, rivaliOff: true }],
];
const risultati = varianti.map(([et, opz]) => ({ et, r: elenco.map((k) => ({ k, v: risp(k, opz) })) }));
const base = new Map(risultati[0].r.map((x) => [x.k.id, x]));

console.log('LETTURA B (popolazione comune) e BANDA M5, sul perimetro delle soste vere');
for (const { et, r } of risultati) {
  const vivi = r.filter((x) => !x.v.muto && !base.get(x.k.id).v.muto);
  const e = vivi.map((x) => eB(x.k, x.v)).filter((y) => y !== null);
  const c = vivi.map((x) => copre(x.k, x.v)).filter((y) => y !== null);
  console.log(`  ${et.padEnd(26)} n=${e.length} · |e| med ${mediana(e.map(Math.abs)).toFixed(1)} media ${(e.reduce((a, b) => a + Math.abs(b), 0) / e.length).toFixed(2)} · esatti ${e.filter((x) => x === 0).length} (${((100 * e.filter((x) => x === 0).length) / e.length).toFixed(1)}%) · entro1 ${((100 * e.filter((x) => Math.abs(x) <= 1).length) / e.length).toFixed(1)}% · bias medio ${(e.reduce((a, b) => a + b, 0) / e.length).toFixed(2)} · banda ${c.filter(Boolean).length}/${c.length} (${((100 * c.filter(Boolean).length) / c.length).toFixed(1)}%)`);
}

console.log('\nPER GARA (blocchi) — esatti B: com\'e\' -> rossa+rivali');
const ult = new Map(risultati[3].r.map((x) => [x.k.id, x]));
const pg = {};
for (const [id, a] of base) {
  const b = ult.get(id); if (a.v.muto || b.v.muto) continue;
  const g = (pg[a.k.gara] ??= { n: 0, a: 0, b: 0 }); g.n += 1;
  if (eB(a.k, a.v) === 0) g.a += 1; if (eB(b.k, b.v) === 0) g.b += 1;
}
let vinte = 0, perse = 0;
for (const [gara, g] of Object.entries(pg).sort()) {
  if (g.b > g.a) vinte += 1; if (g.b < g.a) perse += 1;
  console.log(`  ${gara.padEnd(15)} n=${String(g.n).padStart(3)} · ${String(g.a).padStart(3)} -> ${String(g.b).padStart(3)}`);
}
console.log(`  gare migliorate ${vinte} · peggiorate ${perse} · pari ${Object.keys(pg).length - vinte - perse}`);
