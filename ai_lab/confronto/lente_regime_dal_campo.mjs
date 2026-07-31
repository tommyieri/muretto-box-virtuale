// lente_regime_dal_campo.mjs — CONTROFATTUALE: e se il regime lo leggesse il CAMPO?
//
// Il motore nuovo prende il regime dalla SOLA cella del pilota che fa la domanda
// (simulatore/scenario/costruttore.mjs:105, `regimeAlCongelamento(mia)`). Qui gli
// si passa la STESSA gara con la sola cella del congelamento del pilota portata al
// regime che il CAMPO dichiara al medesimo giro L — informazione <= L, nessuna
// fuga dal futuro. Il passo NON cambia: si clona `perPilota`, `righe` resta
// intatto, quindi `osservazioniVerdi` vede esattamente le stesse osservazioni.
//
// Non scrive niente su disco. Non tocca demo/, simulatore/, data/.
//   node ai_lab/confronto/lente_regime_dal_campo.mjs [sogliaCampo]

import { casi, garaNuova, contestoNuovo, rispostaNuovo, rispostaVecchio } from './banco.mjs';
import { doveRientri } from '../../simulatore/scenario/costruttore.mjs';
import { mescolaAlGiro } from '../../simulatore/scenario/risposta.mjs';
import { creaCella } from '../../simulatore/provenienza/contratto.mjs';
import { regimeDiCella, regimeDelCampo } from './lente_neutralizzazione.mjs';

const ordina = (cum) => (a, b) => (cum[a] - cum[b]) || (a < b ? -1 : b < a ? 1 : 0);
const STATUS_DI = { SC: '4', VSC: '6' };

/** La gara con la SOLA cella (pilota, L) portata al regime dichiarato. righe intatto. */
function garaConRegime(g, pilota, L, regime) {
  const vecchie = g.perPilota.get(pilota);
  const c = vecchie.get(L);
  const nuova = creaCella({
    lap_time: c.lap_time, cum_time: c.cum_time, stint: c.stint, compound: c.compound,
    tyre_age: c.tyre_age, in_lap: c.in_lap, out_lap: c.out_lap,
    status: STATUS_DI[regime], del: c.del,
  });
  const celleClone = new Map(vecchie);
  celleClone.set(L, nuova);
  const perPilota = new Map(g.perPilota);
  perPilota.set(pilota, celleClone);
  return { ...g, perPilota };
}

/** doveRientri con il regime del CAMPO al congelamento. `regime=null` => motore com'e'. */
export function rispostaConRegime(caso, regime) {
  const g = garaNuova(caso.gara);
  const mescola = mescolaAlGiro(g, caso.freezeLap, caso.pilota);
  if (mescola === null) return { muto: true, motivo: 'mescola non nota', pos: null, su: null, ordine: null, banda: null };
  const base = contestoNuovo(caso.gara);
  const gara = regime === null ? g : garaConRegime(g, caso.pilota, caso.freezeLap, regime);
  const contesto = { ...base, gare: { ...base.gare, [caso.garaSim]: gara } };
  let r;
  try {
    r = doveRientri({ gara: caso.garaSim, freezeLap: caso.freezeLap, pilota: caso.pilota,
                      giroPit: caso.pitLap, mescola }, contesto);
  } catch (e) { return { muto: true, motivo: `eccezione: ${e.message}`, pos: null, su: null, ordine: null, banda: null }; }
  if (!r || r.approvato !== true) return { muto: true, motivo: 'respinto dal Director', pos: null, su: null, ordine: null, banda: null };
  if (r.posizione == null) return { muto: true, motivo: 'nessun passo base (regola 6)', pos: null, su: null, ordine: null, banda: null };
  let ordine = null;
  if (r.traccia) {
    const cum = {};
    for (const [drv, passi] of Object.entries(r.traccia)) {
      const p = passi?.find((x) => x.lap === caso.rientroLap);
      if (p) cum[drv] = p.cum_time;
    }
    ordine = Object.keys(cum).sort(ordina(cum));
  }
  return { muto: false, pos: r.posizione, su: r.su_quanti, ordine, banda: r.banda_posizione,
           perdita: r.perdita, pits: r.pits, rivaliAssunti: Object.keys(r.pits).length - 1 };
}

/** Errore in lettura B: previsione e verita' ri-classificate sulla popolazione comune. */
export function erroreComune(caso, ordine) {
  if (!ordine) return null;
  const S = new Set(ordine.filter((d) => caso.ordineVero.includes(d)));
  if (!S.has(caso.pilota)) return null;
  const p = ordine.filter((d) => S.has(d)).indexOf(caso.pilota) + 1;
  const v = caso.ordineVero.filter((d) => S.has(d)).indexOf(caso.pilota) + 1;
  return p - v;
}

const mediana = (v) => { if (!v.length) return null; const s = [...v].sort((a, b) => a - b); const m = s.length >> 1; return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; };
const riass = (errs) => ({
  n: errs.length,
  medAss: mediana(errs.map(Math.abs)),
  mediaAss: errs.length ? errs.reduce((a, b) => a + Math.abs(b), 0) / errs.length : null,
  esatti: errs.filter((e) => e === 0).length,
  entro1: errs.filter((e) => Math.abs(e) <= 1).length,
  biasMed: mediana(errs),
  biasMedio: errs.length ? errs.reduce((a, b) => a + b, 0) / errs.length : null,
});
const riga = (et, r) => `  ${et.padEnd(26)} n=${String(r.n).padStart(3)} · |e| med ${r.medAss?.toFixed(1)} media ${r.mediaAss?.toFixed(2)} · esatti ${String(r.esatti).padStart(3)} (${((100 * r.esatti) / r.n).toFixed(1)}%) · entro1 ${((100 * r.entro1) / r.n).toFixed(1)}% · bias med ${r.biasMed?.toFixed(1)} medio ${r.biasMedio?.toFixed(2)}`;

function main() {
  const soglia = Number(process.argv[2] ?? 0.25);
  const elenco = casi();
  const out = [];
  for (const k of elenco) {
    const g = garaNuova(k.gara);
    const mieCelle = g.perPilota.get(k.pilota);
    const mioL = regimeDiCella(mieCelle.get(k.freezeLap));
    const mioPit = regimeDiCella(mieCelle.get(k.pitLap));
    const campo = regimeDelCampo(g, k.freezeLap);
    // la regola proposta: se la mia cella tace ma il campo dichiara >= soglia, si adotta
    // il regime PREVALENTE del campo. Informazione <= L.
    const daCampo = mioL === null && campo.frazione >= soglia ? campo.prevalente : null;
    const attuale = rispostaConRegime(k, null);
    const proposto = daCampo === null ? attuale : rispostaConRegime(k, daCampo);
    out.push({ k, mioL, mioPit, campo, daCampo, attuale, proposto });
  }

  const cambiati = out.filter((r) => r.daCampo !== null);
  console.log(`SOGLIA CAMPO = ${(soglia * 100).toFixed(0)}% · casi in cui la regola accende il regime: ${cambiati.length}/${out.length}`);
  const rispondeEntrambi = cambiati.filter((r) => !r.attuale.muto && !r.proposto.muto);
  const posCambia = rispondeEntrambi.filter((r) => r.attuale.pos !== r.proposto.pos).length;
  console.log(`  rispondono entrambe le versioni: ${rispondeEntrambi.length} · la posizione cambia in ${posCambia}`);
  const veriPositivi = cambiati.filter((r) => r.mioPit !== null).length;
  console.log(`  la sosta era davvero neutralizzata in ${veriPositivi}/${cambiati.length}`);

  // ── errore, sui SOLI casi accesi ──────────────────────────────────────────
  const eA = (r, v) => (v.muto ? null : v.pos - r.k.posizioneVera);
  const eB = (r, v) => (v.muto ? null : erroreComune(r.k, v.ordine));
  const raccogli = (righe, f) => righe.map(f).filter((x) => x !== null);
  console.log(`\nSUI ${rispondeEntrambi.length} CASI ACCESI DALLA REGOLA`);
  console.log('LETTURA A (pos grezza contro posizione vera)');
  console.log(riga('nuovo COM\'E\'', riass(raccogli(rispondeEntrambi, (r) => eA(r, r.attuale)))));
  console.log(riga('nuovo col regime dal campo', riass(raccogli(rispondeEntrambi, (r) => eA(r, r.proposto)))));
  console.log('LETTURA B (popolazione comune)');
  console.log(riga('nuovo COM\'E\'', riass(raccogli(rispondeEntrambi, (r) => eB(r, r.attuale)))));
  console.log(riga('nuovo col regime dal campo', riass(raccogli(rispondeEntrambi, (r) => eB(r, r.proposto)))));
  let megl = 0, peg = 0, pari = 0;
  for (const r of rispondeEntrambi) {
    const a = Math.abs(eB(r, r.attuale) ?? NaN), b = Math.abs(eB(r, r.proposto) ?? NaN);
    if (Number.isNaN(a) || Number.isNaN(b)) continue;
    if (b < a) megl += 1; else if (b > a) peg += 1; else pari += 1;
  }
  console.log(`  testa a testa (lettura B): migliora ${megl} · peggiora ${peg} · pari ${pari}`);

  // ── copertura della banda (M5) sui casi accesi ────────────────────────────
  const copre = (v, k) => (v.muto || !v.banda ? null : (k.posizioneVera >= v.banda.da && k.posizioneVera <= v.banda.a));
  const cop = (righe, campo) => {
    const vals = righe.map((r) => copre(r[campo], r.k)).filter((x) => x !== null);
    return `${vals.filter(Boolean).length}/${vals.length} (${((100 * vals.filter(Boolean).length) / vals.length).toFixed(1)}%)`;
  };
  console.log(`\nBANDA DI RIENTRO (M5) sui casi accesi: com'e' ${cop(rispondeEntrambi, 'attuale')} · col regime dal campo ${cop(rispondeEntrambi, 'proposto')}`);

  // ── e su TUTTO il perimetro ───────────────────────────────────────────────
  const tutti = out.filter((r) => !r.attuale.muto && !r.proposto.muto);
  console.log(`\nSU TUTTO IL PERIMETRO (${tutti.length} casi con risposta da entrambe)`);
  console.log('LETTURA A');
  console.log(riga('nuovo COM\'E\'', riass(raccogli(tutti, (r) => eA(r, r.attuale)))));
  console.log(riga('nuovo col regime dal campo', riass(raccogli(tutti, (r) => eA(r, r.proposto)))));
  console.log('LETTURA B');
  console.log(riga('nuovo COM\'E\'', riass(raccogli(tutti, (r) => eB(r, r.attuale)))));
  console.log(riga('nuovo col regime dal campo', riass(raccogli(tutti, (r) => eB(r, r.proposto)))));
  console.log(`BANDA su tutto: com'e' ${cop(tutti, 'attuale')} · col regime dal campo ${cop(tutti, 'proposto')}`);

  // per gara
  console.log('\nPER GARA (blocchi) — accesi · esatti B com\'e\' -> col campo');
  const perGara = {};
  for (const r of tutti) {
    const g = (perGara[r.k.gara] ??= { n: 0, acc: 0, a: 0, b: 0 });
    g.n += 1; if (r.daCampo !== null) g.acc += 1;
    if (eB(r, r.attuale) === 0) g.a += 1;
    if (eB(r, r.proposto) === 0) g.b += 1;
  }
  for (const [gara, g] of Object.entries(perGara).sort()) {
    console.log(`  ${gara.padEnd(15)} n=${String(g.n).padStart(3)} accesi ${String(g.acc).padStart(3)} · ${String(g.a).padStart(3)} -> ${String(g.b).padStart(3)}`);
  }
  return out;
}

if (import.meta.url === `file://${process.argv[1]}`) main();
