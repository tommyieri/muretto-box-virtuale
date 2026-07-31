/**
 * verifica_M5_divario.mjs — DA DOVE VIENE IL DIVARIO fra il 67,3% misurato sulle
 * soste vere e l'88,5% dichiarato in banda_rientro.json?
 *
 * L'agente misurato sostiene: «la convenzione del contesto vale 3,8 punti, i
 * restanti ~17 punti NON sono la convenzione». Qui si prova a smentirlo,
 * riproducendo il banco di calibrazione (simulatore/banco/misure/rientro.mjs) e
 * unendolo caso per caso alla misura M5, sulle STESSE soste.
 *
 * Non scrive niente su disco. Uso: node ai_lab/confronto/verifica_M5_divario.mjs
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { caricaGare2026 } from '../../simulatore/provenienza/gare_2026.mjs';
import { caricaPrior } from '../../simulatore/provenienza/pitloss_dati.mjs';
import { caricaCostanti } from '../../simulatore/scenario/director_dati.mjs';
import { doveRientri, costruisciScenario } from '../../simulatore/scenario/costruttore.mjs';
import { misuraRientro } from '../../simulatore/banco/misure/rientro.mjs';
import { perditaBox } from '../../simulatore/provenienza/pitloss.mjs';
import { simulate } from '../../simulatore/engine/kernel.mjs';
import { MESCOLE_SLICK } from '../../simulatore/provenienza/vocabolario.mjs';
import { regimeNeutralizzato } from '../../simulatore/provenienza/definizioni.mjs';
import { simboliStatus } from '../../simulatore/provenienza/vocabolario.mjs';
import { casi as casiBanco } from './banco.mjs';

const QUI = path.dirname(fileURLToPath(import.meta.url));
const RADICE = path.resolve(QUI, '..', '..');
const SIM = path.join(RADICE, 'simulatore');
const pct = (x, n) => (n === 0 ? 'n/d' : `${((100 * x) / n).toFixed(1)}%`);

const gareSim = caricaGare2026(SIM);
const modello = JSON.parse(readFileSync(path.join(SIM, 'data', 'modelli', 'modello_v2.json'), 'utf8'));
const prior = caricaPrior(SIM);
const costantiDirector = caricaCostanti(SIM);
const bandaRientro = JSON.parse(readFileSync(path.join(SIM, 'data', 'modelli', 'banda_rientro.json'), 'utf8'));
const cancelli = JSON.parse(readFileSync(path.join(SIM, 'banco', 'prereg', 'cancelli_banco.json'), 'utf8'));
const CTX = { gare: gareSim, modello, prior, costantiDirector, bandaRientro, nGiriGara: null };

// ─────────────────────────────── 1. il banco di calibrazione, rieseguito
const rientro = misuraRientro(gareSim, {
  rho: modello.rho.valore, delta70: modello.delta_70.scelto, prior, cancelli: cancelli.rientro,
});
console.log('════ DA DOVE VIENE IL DIVARIO 67,3% ↔ 88,5% ════\n');
console.log('1. IL BANCO DI CALIBRAZIONE, RIESEGUITO (simulatore/banco/misure/rientro.mjs)');
console.log(`   casi ${rientro.n_soste} · scarti ${rientro.n_scarti}`);
const perSecco = {};
for (const c of rientro.casi) (perSecco[c.secco] ??= []).push(c);
for (const [s, cs] of Object.entries(perSecco)) {
  const e1 = cs.filter((c) => Math.abs(c.errore) <= 1).length;
  const e2 = cs.filter((c) => Math.abs(c.errore) <= 2).length;
  console.log(`   secco ${s.padEnd(13)} n=${String(cs.length).padStart(3)} · |err|<=1 ${pct(e1, cs.length)} · |err|<=2 ${pct(e2, cs.length)}`);
}
const verde = rientro.casi.filter((c) => c.secco !== 'NEUTRA');
const neutra = rientro.casi.filter((c) => c.secco === 'NEUTRA');
const vOK = verde.filter((c) => Math.abs(c.errore) <= 1).length;
const nOK = neutra.filter((c) => Math.abs(c.errore) <= 2).length;
console.log(`   → come li usa il prodotto: VERDE(±1) ${vOK}/${verde.length} = ${pct(vOK, verde.length)}`
  + `  ·  NEUTRA(±2) ${nOK}/${neutra.length} = ${pct(nOK, neutra.length)}`);
console.log(`     (il file dichiara VERDE 88,5% su 209 casi · NEUTRA 85,7% su 189)`);

// ─────────────────────────────── 2. l'intersezione: stesse soste, due misure
const chiaveB = (c) => `${c.gara}|${c.drv}|${c.lap}`;
const bancoCal = new Map(rientro.casi.map((c) => [chiaveB(c), c]));
const CASI = casiBanco();
const chiaveM = (c) => `${c.garaSim}|${c.pilota}|${c.pitLap}`;

function chiedi(caso) {
  const g = gareSim[caso.garaSim];
  const cella = g.perPilota.get(caso.pilota)?.get(caso.freezeLap);
  const mescola = cella && MESCOLE_SLICK.has(cella.compound) ? cella.compound : null;
  if (mescola === null) return null;
  const r = doveRientri({ gara: caso.garaSim, freezeLap: caso.freezeLap, pilota: caso.pilota,
                          giroPit: caso.pitLap, mescola }, { ...CTX, nGiriGara: g.nGiri });
  if (!r || r.approvato !== true || r.posizione == null) return null;
  return r;
}

const righe = [];
for (const c of CASI) {
  const r = chiedi(c);
  if (!r) continue;
  righe.push({ c, r, cal: bancoCal.get(chiaveM(c)) ?? null });
}
const dentro = (x) => x.c.posizioneVera >= x.r.banda_posizione.da && x.c.posizioneVera <= x.r.banda_posizione.a;
const inter = righe.filter((x) => x.cal);
console.log('\n2. LE STESSE SOSTE, MISURATE DALLE DUE PARTI');
console.log(`   soste del perimetro M5 con risposta: ${righe.length} · presenti anche nel banco: ${inter.length}`);
const copM5 = inter.filter(dentro).length;
const copCal = inter.filter((x) => Math.abs(x.cal.errore) <= (x.cal.secco === 'NEUTRA' ? 2 : 1)).length;
console.log(`   copertura M5   (banda del prodotto vs verità del perimetro) : ${copM5}/${inter.length} = ${pct(copM5, inter.length)}`);
console.log(`   copertura BANCO(|errore| <= semi-ampiezza del suo secco)     : ${copCal}/${inter.length} = ${pct(copCal, inter.length)}`);
console.log('   → sulle STESSE soste le due misure danno numeri diversi: il divario NON è il perimetro');

// ─────────────────────────────── 3. i tre pezzi del divario, uno alla volta
// (a) POPOLAZIONE: il banco classifica previsione E verità dentro `insieme`
//     (chi ha un cum previsto E un cum reale). Il prodotto usa la sua
//     popolazione per la previsione e tutto il campo per la verità.
// (b) PIT-LOSS: il banco prende il regime ai giri L e L+1 (futuro rispetto al
//     congelamento) e con esso sceglie la perdita ai box; il prodotto usa il
//     regime al congelamento.
// (c) SOSTE DEI RIVALI: sotto regime il prodotto assume che i rivali al primo
//     stint si fermino allo stesso giro; il banco non lo fa.
const regimeAlGiroCella = (cella) => {
  if (!cella || cella.status === null || !regimeNeutralizzato(cella)) return null;
  return simboliStatus(cella.status).has('4') ? 'SC' : 'VSC';
};
const regimeSosta = (c) => {
  const celle = gareSim[c.garaSim].perPilota.get(c.pilota);
  for (const lap of [c.pitLap, c.rientroLap]) {
    const r = regimeAlGiroCella(celle.get(lap));
    if (r !== null) return r;
  }
  return null;
};

/** Rirun del kernel con perdita e soste rivali secondo una convenzione scelta. */
function variante(caso, { regimePerPitLoss, sosteRivali }) {
  const g = gareSim[caso.garaSim];
  const cella = g.perPilota.get(caso.pilota)?.get(caso.freezeLap);
  const mescola = cella && MESCOLE_SLICK.has(cella.compound) ? cella.compound : null;
  if (mescola === null) return null;
  const sc = costruisciScenario({ gara: caso.garaSim, freezeLap: caso.freezeLap, pilota: caso.pilota,
                                  giroPit: caso.pitLap, mescola },
                                { ...CTX, nGiriGara: g.nGiri, giroFinale: caso.pitLap + 1 });
  const perdita = perditaBox(prior, caso.garaSim, regimePerPitLoss).perdita;
  const pits = { [caso.pilota]: [{ lap: caso.pitLap, perdita }] };
  if (sosteRivali && regimePerPitLoss !== null) {
    for (const [drv, c] of sc._interno.celleAlCongelamento) {
      if (drv === caso.pilota || c.stint !== 1) continue;
      pits[drv] = [{ lap: caso.pitLap, perdita }];
    }
  }
  const r = simulate({ state: sc.state, pace: sc.pace, freezeLap: sc.freezeLap, steps: sc.steps, pits, traccia: true });
  const conCum = Object.keys(r.cum).filter((d) => r.cum[d] !== null);
  if (!conCum.includes(caso.pilota)) return null;
  const ordine = [...conCum].sort((a, b) => r.cum[a] - r.cum[b] || (a < b ? -1 : 1));
  return { pos: ordine.indexOf(caso.pilota) + 1, su: ordine.length, ordine };
}

/** Copertura di una previsione con una semi-ampiezza, sulla verità del perimetro. */
const copertoGrezzo = (caso, pos, su, s) =>
  caso.posizioneVera >= Math.max(1, pos - s) && caso.posizioneVera <= Math.min(su, pos + s);
/** Copertura riclassificando previsione e verità sulla popolazione comune. */
function copertoComune(caso, ordine, s) {
  const setVero = new Set(caso.ordineVero);
  const int = ordine.filter((d) => setVero.has(d));
  const S = new Set(int);
  if (!S.has(caso.pilota)) return null;
  const pPrev = int.indexOf(caso.pilota) + 1;
  const pVero = caso.ordineVero.filter((d) => S.has(d)).indexOf(caso.pilota) + 1;
  return pVero >= Math.max(1, pPrev - s) && pVero <= Math.min(S.size, pPrev + s);
}

console.log('\n3. I PEZZI DEL DIVARIO, AGGIUNTI UNO ALLA VOLTA (sui 260 casi con risposta)');
const semiProdotto = (x) => x.r.banda_posizione.semi_ampiezza;
const semiBanco = (c) => (regimeSosta(c) !== null ? 2 : 1);

const passi = [];
// P0 — il prodotto com'è
passi.push(['P0 prodotto com\'è (grezzo, contesto al congelamento)',
  righe.filter(dentro).length, righe.length]);
// P1 — + popolazione comune
passi.push(['P1  + popolazione comune (verità riclassificata come nel banco)',
  righe.filter((x) => {
    const cum = {};
    for (const [drv, passiT] of Object.entries(x.r.traccia ?? {})) {
      const p = passiT?.find((y) => y.lap === x.c.rientroLap);
      if (p && p.cum_time !== null) cum[drv] = p.cum_time;
    }
    const ordine = Object.keys(cum).sort((a, b) => cum[a] - cum[b] || (a < b ? -1 : 1));
    return copertoComune(x.c, ordine, semiProdotto(x)) === true;
  }).length, righe.length]);
// P2 — + larghezza della banda scelta col regime della sosta (solo la convenzione della BANDA)
passi.push(['P2  + banda scelta col regime della SOSTA (solo larghezza: è il §10 dell\'agente)',
  righe.filter((x) => copertoGrezzo(x.c, x.r.posizione, x.r.su_quanti, semiBanco(x.c))).length, righe.length]);
// P3 — + pit-loss col regime della sosta (convenzione piena, ma prodotto per il resto)
const varP3 = righe.map((x) => ({ x, v: variante(x.c, { regimePerPitLoss: regimeSosta(x.c), sosteRivali: true }) })).filter((y) => y.v);
passi.push(['P3  + pit-loss col regime della SOSTA (banda + perdita ai box)',
  varP3.filter((y) => copertoGrezzo(y.x.c, y.v.pos, y.v.su, semiBanco(y.x.c))).length, varP3.length]);
// P3b — SOLO il pit-loss col regime della sosta, banda del prodotto (attribuzione pulita)
passi.push(['P3b solo pit-loss col regime della SOSTA (banda quella del prodotto)',
  varP3.filter((y) => copertoGrezzo(y.x.c, y.v.pos, y.v.su, semiProdotto(y.x))).length, varP3.length]);
// P4 — + niente soste dei rivali (come il banco)
const varP4 = righe.map((x) => ({ x, v: variante(x.c, { regimePerPitLoss: regimeSosta(x.c), sosteRivali: false }) })).filter((y) => y.v);
passi.push(['P4  + nessuna sosta assunta dei rivali (come il banco)',
  varP4.filter((y) => copertoGrezzo(y.x.c, y.v.pos, y.v.su, semiBanco(y.x.c))).length, varP4.length]);
// P5 — + popolazione comune sopra P4: è il banco, sul perimetro M5
passi.push(['P5  + popolazione comune sopra P4 = il BANCO, sul perimetro M5',
  varP4.filter((y) => copertoComune(y.x.c, y.v.ordine, semiBanco(y.x.c)) === true).length, varP4.length]);
for (const [nome, d, n] of passi) console.log(`   ${nome.padEnd(64)} ${String(d).padStart(3)}/${n} = ${pct(d, n)}`);
console.log('   (P1…P5 sono contro-fattuali di misura: mostrano di chi è il divario, non cambiano il prodotto)');

// ─────────────────────────────── 4. il pezzo che l'agente ha attribuito male
const cambia = righe.filter((x) => semiProdotto(x) !== semiBanco(x.c));
console.log('\n4. IL PUNTO CONTESTATO — «la convenzione vale 3,8 punti»');
console.log(`   casi in cui il contesto cambia fra le due convenzioni: ${cambia.length}/${righe.length}`);
const p0 = passi[0][1] / passi[0][2]; const p2 = passi[2][1] / passi[2][2];
const p3 = passi[3][1] / passi[3][2];
console.log(`   solo la LARGHEZZA della banda   : ${(100 * (p2 - p0)).toFixed(1)} punti  ← quello che l'agente ha misurato`);
console.log(`   larghezza + PERDITA AI BOX      : ${(100 * (p3 - p0)).toFixed(1)} punti  ← la convenzione per intero`);
const nzSolo = righe.filter((x) => x.r.banda_posizione.contesto === 'VERDE' && regimeSosta(x.c) !== null);
console.log(`   i casi che pagano: congelamento in verde ma sosta sotto regime = ${nzSolo.length}`);
console.log(`     copertura del prodotto su questi: ${pct(nzSolo.filter(dentro).length, nzSolo.length)}`);

console.log('\n════ fine ════');
