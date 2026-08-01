// cancello_soste_rivali.mjs — le quattro condizioni di PREREG_soste_rivali.md.
//
//     node ai_lab/confronto/cancello_soste_rivali.mjs [--json]
//
//   R1  esatti sui casi CON REGIME al congelamento: non calano
//   R2  esatti su tutti i 223 appaiati: non calano di piu' di 1 punto
//   R3  i casi SENZA regime restano identici AL BIT
//   R4  la copertura non cala
//
// DECIDE M1, non M2, ed e' dichiarato nella prereg: questa assunzione non tocca il
// passo — nel kernel le auto non interagiscono — quindi sposta solo le POSIZIONI, e
// si giudica sulle posizioni. M2 si riporta e non decide.

import { casi, rispostaVecchio, rispostaNuovo, contestoNuovo } from './banco.mjs';

const sigleDi = (o) => (o ? o.map((x) => (Array.isArray(x) ? x[0] : x)) : null);
const rango = (sigle, dentro, pil) => { const f = sigle.filter((d) => dentro.has(d)); const i = f.indexOf(pil); return i < 0 ? null : i + 1; };
const f = (x, n = 2) => (x === null || !Number.isFinite(x) ? '  —  ' : x.toFixed(n));

// il banco passa il MODELLO; qui serve il PRIOR, quindi si patcha il contesto a monte
const base = contestoNuovo();
const conRegola = (regola) => { base.prior.soste_rivali_sotto_regime = regola; };

function misura(regola) {
  conRegola(regola);
  const righe = [];
  for (const c of casi()) {
    const V = rispostaVecchio(c);
    const N = rispostaNuovo(c);
    const vero = c.ordineVero; const sV = sigleDi(V.ordine); const sN = sigleDi(N.ordine);
    let err = null; let posN = null;
    if (V.ok && N.ok && sV && sN) {
      const sSV = new Set(sV); const sSN = new Set(sN);
      const dentro = new Set(vero.filter((d) => sSV.has(d) && sSN.has(d)));
      const t = rango(vero, dentro, c.pilota); const p = rango(sN, dentro, c.pilota);
      if (t && p) err = p - t;
    }
    if (N.ok) posN = `${N.pos}/${N.su}`;
    righe.push({ id: c.id, gara: c.gara, regime: c.regimeAlCongelamento, ok: N.ok, err, posN });
  }
  return righe;
}

const prima = misura('stint1');
const dopo = misura('nessuna');
conRegola(undefined);   // il contesto resta come l'ho trovato

const app = prima.map((r, i) => ({ ...r, errDopo: dopo[i].err, okDopo: dopo[i].ok, posDopo: dopo[i].posN }))
  .filter((r) => r.err !== null && r.errDopo !== null);
const conRegime = app.filter((r) => r.regime !== null);
const senzaRegime = app.filter((r) => r.regime === null);
const es = (v, k) => (v.length ? 100 * v.filter((r) => r[k] === 0).length / v.length : null);

const R1 = es(conRegime, 'errDopo') >= es(conRegime, 'err');
const R2 = es(app, 'errDopo') >= es(app, 'err') - 1;
const identici = senzaRegime.filter((r) => r.err === r.errDopo && r.posN === r.posDopo).length;
const R3 = senzaRegime.length > 0 && identici === senzaRegime.length;
const copPrima = prima.filter((r) => r.ok).length; const copDopo = dopo.filter((r) => r.ok).length;
const R4 = copDopo >= copPrima;

// ripartizione per gara: gli esatti non devono salire per merito di una sola
const perGara = {};
for (const g of [...new Set(conRegime.map((r) => r.gara))].sort()) {
  const v = conRegime.filter((r) => r.gara === g);
  perGara[g] = { n: v.length, prima: es(v, 'err'), dopo: es(v, 'errDopo') };
}
const esito = {
  targhetta: { protocollo: 'ai_lab/confronto/PREREG_soste_rivali.md', decide: 'M1 lettura B2 — l\'assunzione sposta le posizioni, non i tempi', data: '2026-08-01' },
  R1: { n: conRegime.length, esatti_prima: es(conRegime, 'err'), esatti_dopo: es(conRegime, 'errDopo'), passa: R1 },
  R2: { n: app.length, esatti_prima: es(app, 'err'), esatti_dopo: es(app, 'errDopo'), passa: R2 },
  R3: { n_senza_regime: senzaRegime.length, identici, passa: R3 },
  R4: { copertura_prima: copPrima, copertura_dopo: copDopo, passa: R4 },
  per_gara: perGara,
  verdetto: R1 && R2 && R3 && R4,
};
if (process.argv.includes('--json')) { console.log(JSON.stringify(esito, null, 2)); process.exit(esito.verdetto ? 0 : 1); }

console.log('CANCELLO DELLE SOSTE DEI RIVALI — PREREG_soste_rivali.md  (decide M1, lettura B2)');
console.log(`\n  R1 · casi CON REGIME (n=${conRegime.length}): esatti ${f(esito.R1.esatti_prima)}% → ${f(esito.R1.esatti_dopo)}%   ${R1 ? 'PASSA' : 'FALLISCE'}`);
console.log(`  R2 · tutti gli appaiati (n=${app.length}): esatti ${f(esito.R2.esatti_prima)}% → ${f(esito.R2.esatti_dopo)}%  (limite −1 punto)   ${R2 ? 'PASSA' : 'FALLISCE'}`);
console.log(`  R3 · casi SENZA regime identici al bit: ${identici}/${senzaRegime.length}   ${R3 ? 'PASSA' : 'FALLISCE'}`);
console.log(`  R4 · copertura ${copPrima} → ${copDopo}   ${R4 ? 'PASSA' : 'FALLISCE'}`);
console.log('\n  per gara, sui casi con regime (blocchi = gare)');
for (const [g, x] of Object.entries(perGara)) console.log(`    ${g.padEnd(15)} n=${String(x.n).padStart(3)}  ${f(x.prima)}% → ${f(x.dopo)}%`);
console.log(`\n  → L'ASSUNZIONE ${esito.verdetto ? 'SI TOGLIE' : 'RESTA'}`);
process.exit(esito.verdetto ? 0 : 1);
