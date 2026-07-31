/**
 * verifica_M5_banda.mjs — VERIFICA ADVERSARIALE della misura M5.
 *
 * Non importa `banco.mjs` per costruire i casi: li ricostruisce dal grezzo di
 * demo/data/*.json con codice proprio, chiama `doveRientri` da sé, e SOLO ALLA
 * FINE confronta il proprio elenco con quello di banco.mjs per vedere se le due
 * costruzioni indipendenti coincidono.
 *
 * Non scrive niente su disco. Uso: node ai_lab/confronto/verifica_M5_banda.mjs
 */
import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { caricaGare2026 } from '../../simulatore/provenienza/gare_2026.mjs';
import { caricaPrior } from '../../simulatore/provenienza/pitloss_dati.mjs';
import { caricaCostanti } from '../../simulatore/scenario/director_dati.mjs';
import { doveRientri } from '../../simulatore/scenario/costruttore.mjs';
import { MESCOLE_SLICK } from '../../simulatore/provenienza/vocabolario.mjs';
import { evaluatePit } from '../../demo/pitscenario.mjs';
import { misura as misuraGradino } from '../../demo/gradino.mjs';

const QUI = path.dirname(fileURLToPath(import.meta.url));
const RADICE = path.resolve(QUI, '..', '..');
const DEMO = path.join(RADICE, 'demo', 'data');
const SIM = path.join(RADICE, 'simulatore');

const pct = (x, n) => (n === 0 ? 'n/d' : `${((100 * x) / n).toFixed(1)}%`);
const mediana = (v) => {
  if (!v.length) return null;
  const s = [...v].sort((a, b) => a - b);
  const m = s.length >> 1;
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};
const ordinaPer = (cum) => (a, b) => (cum[a] - cum[b]) || (a < b ? -1 : b < a ? 1 : 0);

// ─────────────────────────────────────────────── 1. i casi, ricostruiti da zero
const manifest = JSON.parse(readFileSync(path.join(DEMO, 'vista', 'manifest.json'), 'utf8'));
const SITO2SIM = manifest.cartella_di;
// controllo incrociato: le gare del sito sono i .json di demo/data/ (meno pitloss)
const suDisco = readdirSync(DEMO).filter((f) => f.endsWith('.json') && f !== 'pitloss.json')
  .map((f) => f.replace(/\.json$/, '')).sort();
const GARE = Object.keys(SITO2SIM).sort();
if (JSON.stringify(suDisco) !== JSON.stringify(GARE)) {
  console.log(`ATTENZIONE: file su disco ${suDisco.join(',')} ≠ manifest ${GARE.join(',')}`);
}

const PITLOSS = JSON.parse(readFileSync(path.join(DEMO, 'pitloss.json'), 'utf8'));
const demoGara = {};
for (const g of GARE) {
  const G = JSON.parse(readFileSync(path.join(DEMO, `${g}.json`), 'utf8'));
  const byLap = {};
  for (const l of G.laps) byLap[l.lap] = l.cars;
  demoGara[g] = { G, byLap, nLaps: G.n_laps, pitLoss: PITLOSS[g] };
}

const cens = { soste: 0, pit_le_3: 0, no_cum_freeze: 0, no_giro_rientro: 0, no_cum_rientro: 0, doppiato: 0 };
const CASI = [];
const ESCLUSI_DOPPIATI = [];
for (const gara of GARE) {
  const { G, byLap, nLaps } = demoGara[gara];
  const leaderCum = {};
  for (let k = 1; k <= nLaps; k += 1) {
    const cars = byLap[k];
    if (!cars) continue;
    let m = Infinity;
    for (const d of Object.keys(cars)) {
      const t = cars[d].cum_time;
      if (typeof t === 'number' && t < m) m = t;
    }
    if (m < Infinity) leaderCum[k] = m;
  }
  const doppiatoA = (Lo, cum) => leaderCum[Lo + 1] !== undefined && cum > leaderCum[Lo + 1];

  for (let Li = 1; Li <= nLaps; Li += 1) {
    const cars = byLap[Li];
    if (!cars) continue;
    for (const pilota of Object.keys(cars).sort()) {
      if (cars[pilota].in_lap !== true) continue;
      cens.soste += 1;
      const L = Li - 1; const Lo = Li + 1;
      const costruisci = () => {
        const cum = {};
        for (const d of Object.keys(byLap[Lo])) {
          const t = byLap[Lo][d].cum_time;
          if (typeof t === 'number') cum[d] = t;
        }
        const ordine = Object.keys(cum).sort(ordinaPer(cum));
        const pariGiro = ordine.filter((d) => !doppiatoA(Lo, cum[d]));
        const cumL = {};
        for (const d of Object.keys(byLap[L])) {
          const t = byLap[L][d].cum_time;
          if (typeof t === 'number') cumL[d] = t;
        }
        const ordineL = Object.keys(cumL).sort(ordinaPer(cumL));
        return {
          id: `${gara}|${pilota}|${Li}`, gara, garaSim: SITO2SIM[gara], pilota,
          freezeLap: L, pitLap: Li, rientroLap: Lo, nGiri: nLaps,
          posizioneVera: ordine.indexOf(pilota) + 1,
          suQuantiVeri: ordine.length,
          posizioneFraPariGiro: pariGiro.indexOf(pilota) + 1,
          suQuantiPariGiro: pariGiro.length,
          ordineVero: ordine,
          posizioneAlCongelamento: ordineL.indexOf(pilota) + 1,
          mescolaAlCongelamento: byLap[L][pilota].compound ?? null,
          neutralizzatoAlCongelamento: byLap[L][pilota].neutralized === true,
          neutralizzatoAlPit: byLap[Li][pilota].neutralized === true,
          neutralizzatoAlRientro: byLap[Lo][pilota].neutralized === true,
        };
      };
      if (Li < 4) { cens.pit_le_3 += 1; continue; }
      if (typeof byLap[L]?.[pilota]?.cum_time !== 'number') { cens.no_cum_freeze += 1; continue; }
      if (!byLap[Lo]) { cens.no_giro_rientro += 1; continue; }
      const cumLo = byLap[Lo][pilota]?.cum_time;
      if (typeof cumLo !== 'number') { cens.no_cum_rientro += 1; continue; }
      if (doppiatoA(Lo, cumLo)) { cens.doppiato += 1; ESCLUSI_DOPPIATI.push(costruisci()); continue; }
      CASI.push(costruisci());
    }
  }
}
CASI.sort((a, b) => (a.gara < b.gara ? -1 : a.gara > b.gara ? 1 : a.pitLap - b.pitLap || (a.pilota < b.pilota ? -1 : 1)));

console.log('════ VERIFICA M5 — ricostruzione indipendente ════\n');
console.log('1. PERIMETRO (ricostruito da demo/data/*.json con codice proprio)');
console.log(`   soste reali (celle in_lap) : ${cens.soste}`);
console.log(`   escluse pit<=3             : ${cens.pit_le_3}`);
console.log(`   escluse senza cum @ L      : ${cens.no_cum_freeze}`);
console.log(`   escluse senza giro rientro : ${cens.no_giro_rientro}`);
console.log(`   escluse senza cum @ Lo     : ${cens.no_cum_rientro}`);
console.log(`   escluse doppiato @ Lo      : ${cens.doppiato}`);
console.log(`   AMMESSE                    : ${CASI.length}`);

// controllo interno: la verità fra tutti e la verità fra i soli a pari giro coincidono?
const diversi = CASI.filter((c) => c.posizioneVera !== c.posizioneFraPariGiro);
console.log(`   casi in cui posizioneVera ≠ posizioneFraPariGiro: ${diversi.length}`
  + ` (se 0, i doppiati stanno davvero in coda e non spostano il rango)`);

// ────────────────────────────────────────── 2. il motore nuovo, chiamato da me
const gareSim = caricaGare2026(SIM);
const modello = JSON.parse(readFileSync(path.join(SIM, 'data', 'modelli', 'modello_v2.json'), 'utf8'));
const prior = caricaPrior(SIM);
const costantiDirector = caricaCostanti(SIM);
const bandaRientro = JSON.parse(readFileSync(path.join(SIM, 'data', 'modelli', 'banda_rientro.json'), 'utf8'));
const CTX = { gare: gareSim, modello, prior, costantiDirector, bandaRientro, nGiriGara: null };
const ctxPer = (gara) => ({ ...CTX, nGiriGara: gareSim[SITO2SIM[gara]].nGiri });

function chiedi(caso, { gareOverride = null } = {}) {
  const gSim = (gareOverride ?? gareSim)[caso.garaSim];
  const cella = gSim.perPilota.get(caso.pilota)?.get(caso.freezeLap);
  const mescola = cella && MESCOLE_SLICK.has(cella.compound) ? cella.compound : null;
  if (mescola === null) return { muto: true, motivo: 'mescola non slick nota al congelamento' };
  const ctx = { ...CTX, gare: gareOverride ?? gareSim, nGiriGara: gareSim[caso.garaSim].nGiri };
  let r;
  try {
    r = doveRientri({ gara: caso.garaSim, freezeLap: caso.freezeLap, pilota: caso.pilota,
                      giroPit: caso.pitLap, mescola }, ctx);
  } catch (e) { return { muto: true, motivo: `eccezione: ${e.message}` }; }
  if (!r || r.approvato !== true) return { muto: true, motivo: 'respinto dal Director' };
  if (r.posizione === null || r.posizione === undefined) return { muto: true, motivo: 'nessuna posizione (regola 6)' };
  let ordine = null;
  if (r.traccia) {
    const cum = {};
    for (const [drv, passi] of Object.entries(r.traccia)) {
      const p = passi?.find((x) => x.lap === caso.rientroLap);
      if (p && p.cum_time !== null) cum[drv] = p.cum_time;
    }
    ordine = Object.keys(cum).sort(ordinaPer(cum));
  }
  return { muto: false, pos: r.posizione, su: r.su_quanti, banda: r.banda_posizione,
           ordine, perdita: r.perdita, giro: r.giro_di_rientro, mescola };
}

const t0 = Date.now();
const R = CASI.map((c) => ({ c, n: chiedi(c) }));
console.log(`\n2. MOTORE NUOVO chiamato su ${CASI.length} casi (${((Date.now() - t0) / 1000).toFixed(1)} s)`);
const muti = R.filter((r) => r.n.muto);
const vivi = R.filter((r) => !r.n.muto);
console.log(`   risponde ${vivi.length}/${R.length} · muto ${muti.length}`);
const perMotivo = {};
for (const m of muti) perMotivo[m.n.motivo] = (perMotivo[m.n.motivo] ?? 0) + 1;
for (const [k, v] of Object.entries(perMotivo)) console.log(`     muto · ${v}× ${k}`);
console.log(`   con banda ${vivi.filter((r) => r.n.banda).length}/${vivi.length}`);
// il giro su cui il motore risponde è davvero il giro di rientro?
console.log(`   risposte il cui giro_di_rientro ≠ Li+1: ${vivi.filter((r) => r.n.giro !== r.c.rientroLap).length}`);

// ───────────────────────────────────────────────────── 3. copertura (lettura A)
const dentro = (r) => r.c.posizioneVera >= r.n.banda.da && r.c.posizioneVera <= r.n.banda.a;
const cop = vivi.filter(dentro).length;
console.log('\n3. COPERTURA GREZZA — posizioneVera dentro [da, a]');
console.log(`   ${cop}/${vivi.length} = ${pct(cop, vivi.length)}   (cancello prereg 80%)`);
console.log(`   muti contati come non coperti: ${cop}/${CASI.length} = ${pct(cop, CASI.length)}`);
console.log('   per gara:');
const perGara = new Map();
for (const r of vivi) { if (!perGara.has(r.c.gara)) perGara.set(r.c.gara, []); perGara.get(r.c.gara).push(r); }
const quote = [];
for (const [g, rs] of [...perGara.entries()].sort()) {
  const d = rs.filter(dentro).length; quote.push(d / rs.length);
  console.log(`     ${g.padEnd(16)} ${String(d).padStart(3)}/${String(rs.length).padEnd(3)} = ${pct(d, rs.length)}`);
}
console.log(`   mediana delle quote di gara ${(100 * mediana(quote)).toFixed(1)}% · gare sotto l'80%: ${quote.filter((q) => q < 0.8).length}/${quote.length}`);

// ─────────────────────────────────────── 4. copertura sulla popolazione comune
function comune(r) {
  if (!r.n.ordine) return null;
  const setVero = new Set(r.c.ordineVero);
  const inter = r.n.ordine.filter((d) => setVero.has(d));
  const S = new Set(inter);
  if (!S.has(r.c.pilota)) return null;
  const pPrev = inter.indexOf(r.c.pilota) + 1;
  const pVero = r.c.ordineVero.filter((d) => S.has(d)).indexOf(r.c.pilota) + 1;
  return { pPrev, pVero, n: S.size };
}
const conCom = vivi.map((r) => ({ ...r, k: comune(r) })).filter((r) => r.k);
const copCom = conCom.filter((r) => {
  const s = r.n.banda.semi_ampiezza;
  return r.k.pVero >= Math.max(1, r.k.pPrev - s) && r.k.pVero <= Math.min(r.k.n, r.k.pPrev + s);
}).length;
console.log('\n4. COPERTURA SULLA POPOLAZIONE COMUNE (previsione, verità e banda nello stesso insieme)');
console.log(`   ${copCom}/${conCom.length} = ${pct(copCom, conCom.length)}`);
const dSu = vivi.map((r) => r.n.su - r.c.suQuantiVeri);
console.log(`   su_nuovo − su_vero: ≠ 0 in ${dSu.filter((x) => x !== 0).length}/${vivi.length} · mediana ${mediana(dSu)}`);

// ───────────────────────────────────────────────────────── 5. contesto e bias
console.log('\n5. CONTESTO, AMPIEZZA, BIAS');
for (const ctx of ['VERDE', 'NEUTRA']) {
  const rs = vivi.filter((r) => r.n.banda.contesto === ctx);
  if (!rs.length) continue;
  const d = rs.filter(dentro).length;
  const w = rs.reduce((a, r) => a + (r.n.banda.a - r.n.banda.da + 1), 0) / rs.length;
  const err = rs.map((r) => r.n.pos - r.c.posizioneVera);
  console.log(`   ${ctx}: n=${rs.length} · copertura ${pct(d, rs.length)} · dichiarata ${(100 * rs[0].n.banda.copertura_fuori_campione).toFixed(1)}%`
    + ` · larghezza media ${w.toFixed(2)} · bias mediano ${mediana(err)} medio ${(err.reduce((a, b) => a + b, 0) / err.length).toFixed(2)}`);
}
const errTutti = vivi.map((r) => r.n.pos - r.c.posizioneVera);
const abs = errTutti.map(Math.abs).sort((a, b) => a - b);
console.log(`   tutti: bias mediano ${mediana(errTutti)} medio ${(errTutti.reduce((a, b) => a + b, 0) / errTutti.length).toFixed(2)}`
  + ` · |err| mediana ${mediana(abs)} p80 ${abs[Math.floor(0.8 * (abs.length - 1))]} p90 ${abs[Math.floor(0.9 * (abs.length - 1))]} max ${abs[abs.length - 1]}`);
const fuori = vivi.filter((r) => !dentro(r));
const ott = fuori.filter((r) => r.c.posizioneVera > r.n.banda.a).length;
console.log(`   fuori banda ${fuori.length}: troppo indietro (pessimista) ${fuori.length - ott} · troppo avanti (ottimista) ${ott}`);
const tagliate = vivi.filter((r) => r.n.banda.da === 1 || r.n.banda.a === r.n.su);
console.log(`   bande tagliate dal bordo: ${tagliate.length} (${pct(tagliate.length, vivi.length)}) copertura ${pct(tagliate.filter(dentro).length, tagliate.length)}`
  + ` · non tagliate ${vivi.length - tagliate.length} copertura ${pct(vivi.filter((r) => !(r.n.banda.da === 1 || r.n.banda.a === r.n.su)).filter(dentro).length, vivi.length - tagliate.length)}`);

// ─────────────────────────────────────── 6. NIENTE FUTURO: prova di troncamento
console.log('\n6. PROVA DI FUGA DAL FUTURO — si ritronca la gara a <= freezeLap e si richiede');
function garaTroncata(garaSim, L) {
  const g = gareSim[garaSim];
  const righe = g.righe.filter((x) => x.lap <= L);
  const perPilota = new Map();
  for (const [drv, celle] of g.perPilota) {
    const m = new Map();
    for (const [lap, cella] of celle) if (lap <= L) m.set(lap, cella);
    if (m.size) perPilota.set(drv, m);
  }
  return { ...g, righe, perPilota };
}
const campione = process.env.CAMPIONE === 'tutti' ? vivi : vivi.filter((_, i) => i % 7 === 0);
let diff = 0; let mutiT = 0;
for (const r of campione) {
  const ov = { ...gareSim, [r.c.garaSim]: garaTroncata(r.c.garaSim, r.c.freezeLap) };
  const t = chiedi(r.c, { gareOverride: ov });
  if (t.muto) { mutiT += 1; continue; }
  if (t.pos !== r.n.pos || t.su !== r.n.su || t.banda?.da !== r.n.banda.da || t.banda?.a !== r.n.banda.a) diff += 1;
}
console.log(`   ${campione.length} casi ritestati su dati troncati: risposte DIVERSE ${diff} · diventate mute ${mutiT}`);

// ─────────────────────────────── 7. i 140 esclusi per doppiaggio: sono i facili?
console.log('\n7. I CASI ESCLUSI PER DOPPIAGGIO AL RIENTRO (fuori perimetro per prereg)');
const RD = ESCLUSI_DOPPIATI.map((c) => ({ c, n: chiedi(c) }));
const viviD = RD.filter((r) => !r.n.muto && r.n.banda);
const copD = viviD.filter(dentro).length;
console.log(`   ${ESCLUSI_DOPPIATI.length} casi esclusi · il nuovo risponde su ${viviD.length}`);
console.log(`   copertura della banda su QUESTI: ${copD}/${viviD.length} = ${pct(copD, viviD.length)}`);
console.log(`   copertura se il perimetro li includesse: ${cop + copD}/${vivi.length + viviD.length} = ${pct(cop + copD, vivi.length + viviD.length)}`);
// il sotto-insieme che l'agente indica come «i casi in cui fermarsi costa di più»:
// doppiati al rientro ma NON già doppiati al congelamento
const perEffetto = viviD.filter((r) => {
  const { byLap } = demoGara[r.c.gara];
  const cumL = byLap[r.c.freezeLap][r.c.pilota].cum_time;
  const Lp1 = r.c.freezeLap + 1;
  let leader = Infinity;
  for (const d of Object.keys(byLap[Lp1] ?? {})) {
    const t = byLap[Lp1][d].cum_time;
    if (typeof t === 'number' && t < leader) leader = t;
  }
  return !(leader < Infinity && cumL > leader);
});
console.log(`   di cui doppiati SOLO per effetto della sosta: ${perEffetto.length} · copertura ${pct(perEffetto.filter(dentro).length, perEffetto.length)}`);

// ────────────────────────────── 8. il motore vecchio, stessi casi, banda ±1
console.log('\n8. MOTORE VECCHIO (parametri di gen_hero, orizzonte 0, byLap troncato) con banda ±1');
function vecchio(caso) {
  const { G, byLap, nLaps, pitLoss } = demoGara[caso.gara];
  const L = caso.freezeLap;
  const bl = {};
  for (let k = 1; k <= L; k += 1) if (byLap[k]) bl[k] = byLap[k];
  const pace = G.pace[String(L)] || {};
  const present = G.drivers.filter((d) => typeof bl[L]?.[d]?.cum_time === 'number' && pace[d] != null);
  const viva = misuraGradino(bl, nLaps, L);
  const gradino = (viva.gradino != null && viva.n_gradino >= 3) ? viva.gradino : null;
  try {
    const r = evaluatePit({ byLap: bl, nLaps, pace, driver: caso.pilota, freezeLap: L,
      pitLap: caso.pitLap, pitLoss, present, gara: caso.gara, laps: G.laps, ZONE: 0, orizzonte: 0, gradino });
    if (!r || r.ok !== true) return { muto: true };
    return { muto: false, pos: r.rientro_pos, su: r.su_totale, ordine: (r.ordine_previsto ?? []).map((x) => x[0]) };
  } catch { return { muto: true }; }
}
const conV = vivi.map((r) => ({ ...r, v: vecchio(r.c) })).filter((r) => !r.v.muto);
const entro = (pos, su, s, vera) => vera >= Math.max(1, pos - s) && vera <= Math.min(su, pos + s);
const nBanda = conV.filter(dentro).length;
const v1 = conV.filter((r) => entro(r.v.pos, r.v.su, 1, r.c.posizioneVera)).length;
const n1 = conV.filter((r) => entro(r.n.pos, r.n.su, 1, r.c.posizioneVera)).length;
const n2 = conV.filter((r) => entro(r.n.pos, r.n.su, 2, r.c.posizioneVera)).length;
const v2 = conV.filter((r) => entro(r.v.pos, r.v.su, 2, r.c.posizioneVera)).length;
console.log(`   casi con risposta doppia: ${conV.length}`);
console.log(`   NUOVO banda ${nBanda}/${conV.length} ${pct(nBanda, conV.length)} · NUOVO ±1 ${pct(n1, conV.length)} · VECCHIO ±1 ${v1}/${conV.length} ${pct(v1, conV.length)}`);
console.log(`   NUOVO ±2 ${n2}/${conV.length} ${pct(n2, conV.length)} · VECCHIO ±2 ${v2}/${conV.length} ${pct(v2, conV.length)}`);
// popolazione comune per entrambi
function comuneCon(caso, ordine) {
  if (!ordine) return null;
  const setVero = new Set(caso.ordineVero);
  const inter = ordine.filter((d) => setVero.has(d));
  const S = new Set(inter);
  if (!S.has(caso.pilota)) return null;
  return { pPrev: inter.indexOf(caso.pilota) + 1,
           pVero: caso.ordineVero.filter((d) => S.has(d)).indexOf(caso.pilota) + 1, n: S.size };
}
const duoCom = conV.map((r) => ({ ...r, kn: comuneCon(r.c, r.n.ordine), kv: comuneCon(r.c, r.v.ordine) }))
  .filter((r) => r.kn && r.kv);
const cop2 = (k, s) => k.pVero >= Math.max(1, k.pPrev - s) && k.pVero <= Math.min(k.n, k.pPrev + s);
const setN2 = duoCom.filter((r) => cop2(r.kn, 2));
const setV2 = duoCom.filter((r) => cop2(r.kv, 2));
const idN2 = new Set(setN2.map((r) => r.c.id)); const idV2 = new Set(setV2.map((r) => r.c.id));
const entrambi2 = duoCom.filter((r) => idN2.has(r.c.id) && idV2.has(r.c.id)).length;
console.log(`   — popolazione comune, ${duoCom.length} casi —`);
console.log(`   NUOVO banda ${duoCom.filter((r) => cop2(r.kn, r.n.banda.semi_ampiezza)).length}/${duoCom.length}`
  + ` · NUOVO ±1 ${duoCom.filter((r) => cop2(r.kn, 1)).length} · VECCHIO ±1 ${duoCom.filter((r) => cop2(r.kv, 1)).length}`
  + ` · NUOVO ±2 ${setN2.length} · VECCHIO ±2 ${setV2.length}`);
console.log(`   ±2, insiemi: entrambi ${entrambi2} · solo nuovo ${setN2.length - entrambi2} · solo vecchio ${setV2.length - entrambi2}`
  + ` · nessuno ${duoCom.length - (setN2.length + setV2.length - entrambi2)}`);

// ─────────────────── 9. confronto con la costruzione dei casi di banco.mjs
const banco = await import('./banco.mjs');
const idMiei = new Set(CASI.map((c) => c.id));
const idLoro = new Set(banco.casi().map((c) => c.id));
const soloMiei = [...idMiei].filter((x) => !idLoro.has(x));
const soloLoro = [...idLoro].filter((x) => !idMiei.has(x));
console.log('\n9. CONFRONTO CON banco.mjs (due costruzioni indipendenti dello stesso perimetro)');
console.log(`   miei ${idMiei.size} · suoi ${idLoro.size} · solo miei ${soloMiei.length} · solo suoi ${soloLoro.length}`);
const perId = new Map(CASI.map((c) => [c.id, c]));
let veroDiverso = 0;
for (const c of banco.casi()) {
  const m = perId.get(c.id);
  if (!m) continue;
  if (m.posizioneVera !== c.posizioneVera || m.suQuantiVeri !== c.suQuantiVeri) veroDiverso += 1;
}
console.log(`   casi con verità diversa fra le due costruzioni: ${veroDiverso}`);
let rispDiversa = 0;
const perIdR = new Map(R.map((r) => [r.c.id, r]));
for (const c of banco.casi()) {
  const mio = perIdR.get(c.id); if (!mio) continue;
  const loro = banco.rispostaNuovo(c);
  const a = mio.n.muto ? 'muto' : `${mio.n.pos}/${mio.n.su}/${mio.n.banda?.da}-${mio.n.banda?.a}`;
  const b = loro.muto ? 'muto' : `${loro.pos}/${loro.su}/${loro.banda?.da}-${loro.banda?.a}`;
  if (a !== b) rispDiversa += 1;
}
console.log(`   risposte del NUOVO diverse fra il mio codice e banco.mjs: ${rispDiversa}`);

console.log('\n════ fine verifica ════');
