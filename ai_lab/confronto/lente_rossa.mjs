// lente_rossa.mjs — LA BANDIERA ROSSA ADDEBITATA COME SAFETY CAR.
//
// `regimeNeutralizzato` (definizioni.mjs:31) accetta uno status che contiene '4'
// o '6'. `regimeAlCongelamento` (costruttore.mjs:35) poi decide SC se lo status
// contiene '4'. Nessuno dei due guarda il '5' (rossa). Il prior DICHIARA un
// fattore RED = 0,0 (`fattori_neutralizzazione.RED`) che nessun percorso usa.
// Qui si conta quanto pesa, e si rimisura il fattore a blocchi = gare.
//
// Non scrive niente su disco. Non tocca demo/, simulatore/, data/.
//   node ai_lab/confronto/lente_rossa.mjs

import { casi, garaNuova, contestoNuovo } from './banco.mjs';
import { doveRientri } from '../../simulatore/scenario/costruttore.mjs';
import { mescolaAlGiro } from '../../simulatore/scenario/risposta.mjs';
import { simboliStatus } from '../../simulatore/provenienza/vocabolario.mjs';
import { regimeDiCella } from './lente_neutralizzazione.mjs';
import { erroreComune } from './lente_regime_dal_campo.mjs';

const mediana = (v) => { if (!v.length) return null; const s = [...v].sort((a, b) => a - b); const m = s.length >> 1; return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; };
const simboli = (c) => { try { return c && c.status !== null ? simboliStatus(c.status) : new Set(); } catch { return new Set(); } };

const elenco = casi();
const prior = contestoNuovo().prior;
console.log(`fattori dichiarati dal prior: ${JSON.stringify(prior.fattori_neutralizzazione)}`);
console.log('(RED = 0,0 e\' dichiarato ma nessun percorso del motore lo raggiunge: regimeAlCongelamento sceglie fra SC e VSC soltanto)\n');

// ── 1 · quante volte il '5' e' presente dove il motore legge il regime ──────
let conRegime = 0, conRossaAlCong = 0, conRossaAlPit = 0;
const dettaglio = {};
for (const k of elenco) {
  const g = garaNuova(k.gara);
  const mie = g.perPilota.get(k.pilota);
  const cL = mie.get(k.freezeLap), cPit = mie.get(k.pitLap);
  const reg = regimeDiCella(cL);
  if (reg !== null) {
    conRegime += 1;
    if (simboli(cL).has('5')) {
      conRossaAlCong += 1;
      (dettaglio[k.gara] ??= { cong: 0, pit: 0, status: new Set() }).cong += 1;
      dettaglio[k.gara].status.add(cL.status);
    }
  }
  if (simboli(cPit).has('5')) { conRossaAlPit += 1; (dettaglio[k.gara] ??= { cong: 0, pit: 0, status: new Set() }).pit += 1; }
}
console.log(`1 · casi col regime al congelamento: ${conRegime}`);
console.log(`    di questi, lo status contiene ANCHE la rossa ('5'): ${conRossaAlCong} (${((100 * conRossaAlCong) / conRegime).toFixed(1)}%) — vengono classificati SC e pagano 0,50 della perdita verde`);
console.log(`    casi con la rossa al giro della SOSTA: ${conRossaAlPit}`);
for (const [gara, d] of Object.entries(dettaglio).sort()) {
  console.log(`      ${gara.padEnd(15)} congelamento ${String(d.cong).padStart(2)} · sosta ${String(d.pit).padStart(2)} · status visti: ${[...d.status].join(' ')}`);
}

// ── 2 · il fattore che vince in-sample, a blocchi = gare ────────────────────
console.log('\n2 · IL FATTORE CHE MINIMIZZA L\'ERRORE, GARA PER GARA (blocchi, E11)');
const conReg = elenco.filter((k) => regimeDiCella(garaNuova(k.gara).perPilota.get(k.pilota).get(k.freezeLap)) !== null);
const perGara = {};
for (const k of conReg) (perGara[k.gara] ??= []).push(k);

function risp(k, fattore) {
  const g = garaNuova(k.gara);
  const mescola = mescolaAlGiro(g, k.freezeLap, k.pilota);
  if (mescola === null) return null;
  const base = contestoNuovo(k.gara);
  const p = fattore === null ? base.prior
    : { ...base.prior, fattori_neutralizzazione: { ...base.prior.fattori_neutralizzazione, SC: fattore.SC, VSC: fattore.VSC } };
  let r; try { r = doveRientri({ gara: k.garaSim, freezeLap: k.freezeLap, pilota: k.pilota, giroPit: k.pitLap, mescola }, { ...base, prior: p }); } catch { return null; }
  if (!r?.approvato || r.posizione == null) return null;
  const cum = {};
  for (const [drv, passi] of Object.entries(r.traccia ?? {})) { const x = passi?.find((y) => y.lap === k.rientroLap); if (x) cum[drv] = x.cum_time; }
  return erroreComune(k, Object.keys(cum).sort((a, b) => (cum[a] - cum[b]) || (a < b ? -1 : 1)));
}

const griglia = [{ SC: 0.15, VSC: 0.20 }, { SC: 0.30, VSC: 0.40 }, { SC: 0.50, VSC: 0.65 }, { SC: 0.76, VSC: 0.87 }];
const intestazione = griglia.map((f) => `SC${f.SC.toFixed(2)}`).join('    ');
console.log(`  gara            n   ${intestazione}   (quota di esatti, lettura B)`);
for (const [gara, ks] of Object.entries(perGara).sort()) {
  const celle = griglia.map((f) => {
    const e = ks.map((k) => risp(k, f)).filter((x) => x !== null);
    return `${((100 * e.filter((x) => x === 0).length) / e.length).toFixed(0).padStart(3)}%`;
  });
  console.log(`  ${gara.padEnd(15)} ${String(ks.length).padStart(2)}  ${celle.join('     ')}`);
}
// e senza Monaco
const senzaMonaco = conReg.filter((k) => k.gara !== 'Monaco');
console.log(`\n  SENZA MONACO (n=${senzaMonaco.length}):`);
for (const f of griglia) {
  const e = senzaMonaco.map((k) => risp(k, f)).filter((x) => x !== null);
  console.log(`    SC ${f.SC.toFixed(2)} · VSC ${f.VSC.toFixed(2)} → esatti ${e.filter((x) => x === 0).length}/${e.length} (${((100 * e.filter((x) => x === 0).length) / e.length).toFixed(1)}%) · |e| medio ${(e.reduce((a, b) => a + Math.abs(b), 0) / e.length).toFixed(2)} · bias medio ${(e.reduce((a, b) => a + b, 0) / e.length).toFixed(2)}`);
}
console.log(`  SOLO MONACO (n=${conReg.length - senzaMonaco.length}):`);
const monaco = conReg.filter((k) => k.gara === 'Monaco');
for (const f of griglia) {
  const e = monaco.map((k) => risp(k, f)).filter((x) => x !== null);
  console.log(`    SC ${f.SC.toFixed(2)} · VSC ${f.VSC.toFixed(2)} → esatti ${e.filter((x) => x === 0).length}/${e.length} (${((100 * e.filter((x) => x === 0).length) / e.length).toFixed(1)}%) · |e| medio ${(e.reduce((a, b) => a + Math.abs(b), 0) / e.length).toFixed(2)} · bias medio ${(e.reduce((a, b) => a + b, 0) / e.length).toFixed(2)}`);
}
