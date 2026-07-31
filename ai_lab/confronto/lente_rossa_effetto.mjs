// lente_rossa_effetto.mjs — E SE LA ROSSA VALESSE COME ROSSA?
//
// Regola provata: se lo status del giro da cui il motore legge il regime contiene
// '5' (bandiera rossa), il fattore e' `prior.fattori_neutralizzazione.RED` (0,0,
// gia' dichiarato nel prior e mai raggiunto dal codice) invece di quello SC.
// Emulata SENZA toccare il motore: si passa a `doveRientri` un prior in cui il
// fattore SC vale RED per quei soli casi.
//
// Non scrive niente su disco. Non tocca demo/, simulatore/, data/.
//   node ai_lab/confronto/lente_rossa_effetto.mjs

import { casi, garaNuova, contestoNuovo } from './banco.mjs';
import { doveRientri } from '../../simulatore/scenario/costruttore.mjs';
import { mescolaAlGiro } from '../../simulatore/scenario/risposta.mjs';
import { simboliStatus } from '../../simulatore/provenienza/vocabolario.mjs';
import { regimeDiCella } from './lente_neutralizzazione.mjs';
import { erroreComune } from './lente_regime_dal_campo.mjs';

const mediana = (v) => { if (!v.length) return null; const s = [...v].sort((a, b) => a - b); const m = s.length >> 1; return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; };
const riass = (e) => ({ n: e.length, med: mediana(e.map(Math.abs)), media: e.reduce((a, b) => a + Math.abs(b), 0) / e.length,
  esatti: e.filter((x) => x === 0).length, entro1: e.filter((x) => Math.abs(x) <= 1).length, bias: e.reduce((a, b) => a + b, 0) / e.length });
const riga = (et, r, extra = '') => `  ${et.padEnd(30)} n=${String(r.n).padStart(3)} · |e| med ${r.med?.toFixed(1)} media ${r.media.toFixed(2)} · esatti ${String(r.esatti).padStart(3)} (${((100 * r.esatti) / r.n).toFixed(1)}%) · entro1 ${((100 * r.entro1) / r.n).toFixed(1)}% · bias medio ${r.bias.toFixed(2)}${extra}`;
const haRossa = (c) => { try { return c && c.status !== null && simboliStatus(c.status).has('5'); } catch { return false; } };

function risp(k, { fattoreSC = null } = {}) {
  const g = garaNuova(k.gara);
  const mescola = mescolaAlGiro(g, k.freezeLap, k.pilota);
  if (mescola === null) return { muto: true };
  const base = contestoNuovo(k.gara);
  const prior = fattoreSC === null ? base.prior
    : { ...base.prior, fattori_neutralizzazione: { ...base.prior.fattori_neutralizzazione, SC: fattoreSC, VSC: fattoreSC } };
  let r; try { r = doveRientri({ gara: k.garaSim, freezeLap: k.freezeLap, pilota: k.pilota, giroPit: k.pitLap, mescola }, { ...base, prior }); } catch { return { muto: true }; }
  if (!r?.approvato || r.posizione == null) return { muto: true };
  const cum = {};
  for (const [drv, passi] of Object.entries(r.traccia ?? {})) { const x = passi?.find((y) => y.lap === k.rientroLap); if (x) cum[drv] = x.cum_time; }
  return { muto: false, pos: r.posizione, banda: r.banda_posizione,
           ordine: Object.keys(cum).sort((a, b) => (cum[a] - cum[b]) || (a < b ? -1 : 1)) };
}

const elenco = casi();
const RED = contestoNuovo().prior.fattori_neutralizzazione.RED;
const eB = (k, v) => (v.muto ? null : erroreComune(k, v.ordine));
const copre = (k, v) => (v.muto || !v.banda ? null : k.posizioneVera >= v.banda.da && k.posizioneVera <= v.banda.a);

const righe = [];
for (const k of elenco) {
  const cL = garaNuova(k.gara).perPilota.get(k.pilota).get(k.freezeLap);
  const rossa = regimeDiCella(cL) !== null && haRossa(cL);
  const a = risp(k, {});
  const b = rossa ? risp(k, { fattoreSC: RED }) : a;
  righe.push({ k, rossa, a, b });
}

const rosse = righe.filter((r) => r.rossa && !r.a.muto && !r.b.muto);
console.log(`CASI CON LA ROSSA NELLO STATUS DEL CONGELAMENTO (oggi classificati SC): ${rosse.length}`);
console.log(riga('oggi (fattore SC 0,50)', riass(rosse.map((r) => eB(r.k, r.a)).filter((x) => x !== null))));
console.log(riga(`con la rossa onorata (${RED})`, riass(rosse.map((r) => eB(r.k, r.b)).filter((x) => x !== null))));
const cA = rosse.map((r) => copre(r.k, r.a)).filter((x) => x !== null), cB = rosse.map((r) => copre(r.k, r.b)).filter((x) => x !== null);
console.log(`  banda: ${cA.filter(Boolean).length}/${cA.length} -> ${cB.filter(Boolean).length}/${cB.length}`);
let m = 0, p = 0, u = 0;
for (const r of rosse) { const x = Math.abs(eB(r.k, r.a)), y = Math.abs(eB(r.k, r.b)); if (y < x) m += 1; else if (y > x) p += 1; else u += 1; }
console.log(`  testa a testa: migliora ${m} · peggiora ${p} · pari ${u}`);

const tutti = righe.filter((r) => !r.a.muto && !r.b.muto);
console.log(`\nSU TUTTO IL PERIMETRO (${tutti.length} casi)`);
console.log(riga('oggi', riass(tutti.map((r) => eB(r.k, r.a)).filter((x) => x !== null))));
console.log(riga('con la rossa onorata', riass(tutti.map((r) => eB(r.k, r.b)).filter((x) => x !== null))));
const tA = tutti.map((r) => copre(r.k, r.a)).filter((x) => x !== null), tB = tutti.map((r) => copre(r.k, r.b)).filter((x) => x !== null);
console.log(`  banda M5: ${tA.filter(Boolean).length}/${tA.length} (${((100 * tA.filter(Boolean).length) / tA.length).toFixed(1)}%) -> ${tB.filter(Boolean).length}/${tB.length} (${((100 * tB.filter(Boolean).length) / tB.length).toFixed(1)}%)`);
console.log(`  gare toccate: ${[...new Set(rosse.map((r) => r.k.gara))].join(', ')}`);
