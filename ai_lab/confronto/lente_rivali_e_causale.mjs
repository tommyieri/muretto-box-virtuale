// lente_rivali_e_causale.mjs — L'ASSUNZIONE SOTTO NEUTRALIZZAZIONE, SMONTATA.
//
// Tre esperimenti sul motore NUOVO, tutti a informazione <= L:
//   A) LO STATO DI PISTA DAVVERO CAUSALE: per ogni rivale la cella PIU' RECENTE
//      che ha gia' chiuso quando io chiudo il giro L (cum_time <= il mio). E'
//      cio' che il muretto vede all'istante del congelamento — non "la riga L".
//   B) SOSTE DEI RIVALI ACCESA / SPENTA / ESTESA, per patch degli INGRESSI
//      (lo `stint` della cella al congelamento), senza toccare il motore.
//   C) IL FATTORE di neutralizzazione spazzato sotto il bordo della sua banda.
//
// Non scrive niente su disco. Non tocca demo/, simulatore/, data/.
//   node ai_lab/confronto/lente_rivali_e_causale.mjs

import { casi, garaNuova, contestoNuovo } from './banco.mjs';
import { doveRientri } from '../../simulatore/scenario/costruttore.mjs';
import { mescolaAlGiro } from '../../simulatore/scenario/risposta.mjs';
import { creaCella } from '../../simulatore/provenienza/contratto.mjs';
import { regimeDiCella } from './lente_neutralizzazione.mjs';
import { erroreComune } from './lente_regime_dal_campo.mjs';

const mediana = (v) => { if (!v.length) return null; const s = [...v].sort((a, b) => a - b); const m = s.length >> 1; return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; };
const riass = (e) => ({ n: e.length, med: mediana(e.map(Math.abs)), media: e.length ? e.reduce((a, b) => a + Math.abs(b), 0) / e.length : null,
  esatti: e.filter((x) => x === 0).length, entro1: e.filter((x) => Math.abs(x) <= 1).length, biasMed: mediana(e), biasMedio: e.length ? e.reduce((a, b) => a + b, 0) / e.length : null });
const riga = (et, r, extra = '') => `  ${et.padEnd(34)} n=${String(r.n).padStart(3)} · |e| med ${r.med?.toFixed(1)} media ${r.media?.toFixed(2)} · esatti ${String(r.esatti).padStart(3)} (${((100 * r.esatti) / r.n).toFixed(1)}%) · entro1 ${((100 * r.entro1) / r.n).toFixed(1)}% · bias med ${r.biasMed?.toFixed(1)} medio ${r.biasMedio?.toFixed(2)}${extra}`;

// ── A · lo stato di pista causale ───────────────────────────────────────────
/** Per ogni rivale la cella piu' recente gia' chiusa al mio istante di congelamento. */
function statoCausale(g, L, pilota) {
  const mio = g.perPilota.get(pilota)?.get(L)?.cum_time;
  if (typeof mio !== 'number') return { n: 0, tot: 0, frazione: 0, prevalente: 'SC', ritardoMax: null };
  let n = 0, tot = 0, sc = 0, vsc = 0; let ritardo = 0;
  for (const [drv, celle] of g.perPilota) {
    if (drv === pilota) continue;
    let miglior = null;
    for (const [lap, c] of celle) {
      if (typeof c.cum_time !== 'number' || c.cum_time > mio) continue;
      if (miglior === null || lap > miglior.lap) miglior = { lap, c };
    }
    if (miglior === null) continue;
    tot += 1;
    ritardo = Math.max(ritardo, L - miglior.lap);
    const r = regimeDiCella(miglior.c);
    if (r === null) continue;
    n += 1; if (r === 'SC') sc += 1; else vsc += 1;
  }
  return { n, tot, frazione: tot ? n / tot : 0, prevalente: sc >= vsc ? 'SC' : 'VSC', ritardoMax: ritardo };
}

// ── B · patch degli ingressi ────────────────────────────────────────────────
const STATUS_DI = { SC: '4', VSC: '6' };
/**
 * gara con le celle modificate. `regimeMio`: lo status della MIA cella a L.
 * `spostaStint`: sposta di +1 TUTTA la storia di stint dei rivali (non la sola
 * cella L): cosi' nessun rivale e' piu' "al primo stint" e l'assunzione non
 * scatta, ma la SEQUENZA resta coerente e il Director non vede una sosta
 * fantasma (patchare il solo giro L fa scattare FIS07 — misurato: 8 casi su 20).
 */
function garaPatch(g, pilota, L, { spostaStint = false, regimeMio = null } = {}) {
  const perPilota = new Map(g.perPilota);
  const rifai = (c, campi) => creaCella({ lap_time: c.lap_time, cum_time: c.cum_time, stint: c.stint,
    compound: c.compound, tyre_age: c.tyre_age, in_lap: c.in_lap, out_lap: c.out_lap, status: c.status, del: c.del, ...campi });
  for (const [drv, celle] of g.perPilota) {
    if (drv === pilota) {
      if (regimeMio === null) continue;
      const c = celle.get(L); if (!c) continue;
      const clone = new Map(celle); clone.set(L, rifai(c, { status: STATUS_DI[regimeMio] })); perPilota.set(drv, clone);
      continue;
    }
    if (!spostaStint) continue;
    const clone = new Map(celle);
    for (const [lap, c] of celle) {
      if (lap > L || c.stint === null) continue;
      clone.set(lap, rifai(c, { stint: c.stint + 1 }));
    }
    perPilota.set(drv, clone);
  }
  return { ...g, perPilota };
}

function risposta(caso, { spostaStint = false, regimeMio = null, fattore = null } = {}) {
  const g = garaNuova(caso.gara);
  const mescola = mescolaAlGiro(g, caso.freezeLap, caso.pilota);
  if (mescola === null) return { muto: true, motivo: 'mescola' };
  const base = contestoNuovo(caso.gara);
  const gara = (spostaStint || regimeMio !== null) ? garaPatch(g, caso.pilota, caso.freezeLap, { spostaStint, regimeMio }) : g;
  const prior = fattore === null ? base.prior
    : { ...base.prior, fattori_neutralizzazione: { ...base.prior.fattori_neutralizzazione, SC: fattore.SC, VSC: fattore.VSC } };
  let r;
  try {
    r = doveRientri({ gara: caso.garaSim, freezeLap: caso.freezeLap, pilota: caso.pilota, giroPit: caso.pitLap, mescola },
                    { ...base, gare: { ...base.gare, [caso.garaSim]: gara }, prior });
  } catch (e) { return { muto: true, motivo: e.message }; }
  if (!r || r.approvato !== true) return { muto: true, motivo: 'director' };
  if (r.posizione == null) return { muto: true, motivo: 'regola 6' };
  const cum = {};
  for (const [drv, passi] of Object.entries(r.traccia ?? {})) {
    const p = passi?.find((x) => x.lap === caso.rientroLap);
    if (p) cum[drv] = p.cum_time;
  }
  return { muto: false, pos: r.posizione, banda: r.banda_posizione,
           ordine: Object.keys(cum).sort((a, b) => (cum[a] - cum[b]) || (a < b ? -1 : 1)),
           rivali: Object.keys(r.pits).length - 1 };
}

const eB = (k, v) => (v.muto ? null : erroreComune(k, v.ordine));
const copre = (k, v) => (v.muto || !v.banda ? null : k.posizioneVera >= v.banda.da && k.posizioneVera <= v.banda.a);
const banda = (righe, campo) => { const c = righe.map((r) => copre(r.k, r[campo])).filter((x) => x !== null);
  return ` · banda ${c.filter(Boolean).length}/${c.length} (${((100 * c.filter(Boolean).length) / c.length).toFixed(1)}%)`; };

const elenco = casi();
const conRegime = elenco.filter((k) => regimeDiCella(garaNuova(k.gara).perPilota.get(k.pilota).get(k.freezeLap)) !== null);

// ═══ A ═══════════════════════════════════════════════════════════════════
console.log('═══ A · LO STATO DI PISTA CAUSALE (cella piu\' recente gia\' chiusa al mio congelamento) ═══');
let recuperati = 0, falsi = 0, ciechi = 0, ritardi = [];
const accesiCausali = [];
for (const k of elenco) {
  const g = garaNuova(k.gara);
  const mie = g.perPilota.get(k.pilota);
  const mioL = regimeDiCella(mie.get(k.freezeLap));
  const mioPit = regimeDiCella(mie.get(k.pitLap));
  const st = statoCausale(g, k.freezeLap, k.pilota);
  ritardi.push(st.ritardoMax);
  const acceso = mioL === null && st.frazione >= 0.25;
  if (acceso) { accesiCausali.push({ k, regime: st.prevalente }); if (mioPit !== null) recuperati += 1; else falsi += 1; }
  if (mioPit !== null && mioL === null && !acceso) ciechi += 1;
}
console.log(`  ritardo mediano dell'ultima cella nota di un rivale: ${mediana(ritardi)} giri (max ${Math.max(...ritardi)})`);
console.log(`  la regola causale (>=25% del campo noto) accende ${accesiCausali.length} casi in piu': giusti ${recuperati}, sbagliati ${falsi}`);
console.log(`  restano ciechi ${ciechi} casi di sosta neutralizzata`);
if (accesiCausali.length) {
  const righe = [];
  for (const { k, regime } of accesiCausali) {
    const a = risposta(k, {}), b = risposta(k, { regimeMio: regime });
    if (!a.muto && !b.muto) righe.push({ k, a, b });
  }
  console.log(riga('com\'e\'', riass(righe.map((r) => eB(r.k, r.a)).filter((v) => v !== null)), banda(righe, 'a')));
  console.log(riga('col regime causale', riass(righe.map((r) => eB(r.k, r.b)).filter((v) => v !== null)), banda(righe, 'b')));
}

// ═══ B ═══════════════════════════════════════════════════════════════════
console.log(`\n═══ B · LE SOSTE DEI RIVALI, sui ${conRegime.length} casi col regime gia' visibile al congelamento ═══`);
const varianti = [
  ['motore com\'e\' (solo stint 1)', {}],
  ['assunzione SPENTA (nessun rivale)', { spostaStint: true }],
];
const tabella = [];
for (const [et, opz] of varianti) {
  const righe = [];
  for (const k of conRegime) { const v = risposta(k, opz); righe.push({ k, v }); }
  const vivi = righe.filter((r) => !r.v.muto);
  const errs = vivi.map((r) => eB(r.k, r.v)).filter((v) => v !== null);
  const rivali = vivi.reduce((a, r) => a + r.v.rivali, 0);
  console.log(riga(et, riass(errs), banda(vivi.map((r) => ({ k: r.k, v: r.v })), 'v') + ` · rivali fermati ${rivali}`));
  tabella.push({ et, righe: vivi });
}
// testa a testa com'e' contro spenta
const A = new Map(tabella[0].righe.map((r) => [r.k.id, r]));
const B = new Map(tabella[1].righe.map((r) => [r.k.id, r]));
let megl = 0, peg = 0, pari = 0;
for (const [id, a] of A) {
  const b = B.get(id); if (!b) continue;
  const ea = Math.abs(eB(a.k, a.v)), eb = Math.abs(eB(b.k, b.v));
  if (eb < ea) megl += 1; else if (eb > ea) peg += 1; else pari += 1;
}
console.log(`  testa a testa (spenta contro com'e'): spegnendola migliora ${megl} · peggiora ${peg} · pari ${pari}`);

// per gara
console.log('  per gara (blocchi) — casi · esatti com\'e\' -> spenta:');
const pg = {};
for (const [id, a] of A) { const b = B.get(id); if (!b) continue;
  const g = (pg[a.k.gara] ??= { n: 0, a: 0, b: 0 }); g.n += 1;
  if (eB(a.k, a.v) === 0) g.a += 1; if (eB(b.k, b.v) === 0) g.b += 1; }
for (const [gara, g] of Object.entries(pg).sort()) console.log(`    ${gara.padEnd(15)} n=${String(g.n).padStart(2)} · ${g.a} -> ${g.b}`);

// ═══ C ═══════════════════════════════════════════════════════════════════
console.log('\n═══ C · IL FATTORE, ANCHE SOTTO IL BORDO DELLA BANDA DICHIARATA ═══');
for (const f of [{ SC: 0.15, VSC: 0.20 }, { SC: 0.25, VSC: 0.35 }, { SC: 0.40, VSC: 0.60 }, { SC: 0.50, VSC: 0.65 }, { SC: 0.60, VSC: 0.70 }]) {
  const righe = [];
  for (const k of conRegime) { const v = risposta(k, { fattore: f }); if (!v.muto) righe.push({ k, v }); }
  const errs = righe.map((r) => eB(r.k, r.v)).filter((v) => v !== null);
  console.log(riga(`SC ${f.SC.toFixed(2)} · VSC ${f.VSC.toFixed(2)}${f.SC === 0.5 ? '  <- in uso' : ''}`, riass(errs), banda(righe, 'v')));
}
