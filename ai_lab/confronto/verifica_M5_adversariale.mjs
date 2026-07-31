/**
 * verifica_M5_adversariale.mjs — SECONDA VERIFICA ADVERSARIALE di M5.
 *
 * Compito: PROVARE CHE LA MISURA M5 SI SBAGLIA. Non si riusa il suo codice per i
 * numeri: i casi si ricostruiscono da `demo/data/*.json` con codice proprio, il
 * motore nuovo si chiama da qui con un contesto costruito qui, e SOLO ALLA FINE
 * si confronta con `banco.mjs` per vedere se due costruzioni indipendenti
 * coincidono.
 *
 * Cosa si cerca, esplicitamente:
 *   A. la VERITÀ è quella giusta? (rango, doppiati, out_lap)
 *   B. il perimetro filtra a favore di qualcuno?
 *   C. c'è una FUGA DAL FUTURO nel motore nuovo? (sonda per troncamento)
 *   D. la banda è davvero quella che il motore pubblica, o è ricostruita a mano?
 *   E. la copertura cambia con letture diverse (popolazione, ritaglio ai bordi)?
 *   F. il divario con l'88,5% dichiarato: quanto è CONVENZIONE e quanto no?
 *      (l'agente misurato sostiene «3,8 punti la convenzione, ~17 no»)
 *   G. i numeri riportati sono quelli che il codice produce?
 *
 * Non scrive niente su disco, non tocca demo/ né simulatore/.
 * Uso: node ai_lab/confronto/verifica_M5_adversariale.mjs
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { caricaGare2026 } from '../../simulatore/provenienza/gare_2026.mjs';
import { caricaPrior } from '../../simulatore/provenienza/pitloss_dati.mjs';
import { caricaCostanti } from '../../simulatore/scenario/director_dati.mjs';
import { doveRientri } from '../../simulatore/scenario/costruttore.mjs';
import { MESCOLE_SLICK, simboliStatus } from '../../simulatore/provenienza/vocabolario.mjs';
import { regimeNeutralizzato } from '../../simulatore/provenienza/definizioni.mjs';
import { misuraRientro } from '../../simulatore/banco/misure/rientro.mjs';

const QUI = path.dirname(fileURLToPath(import.meta.url));
const RADICE = path.resolve(QUI, '..', '..');
const DEMO = path.join(RADICE, 'demo', 'data');
const SIM = path.join(RADICE, 'simulatore');

const pct = (x, n) => (n === 0 ? 'n/d' : `${((100 * x) / n).toFixed(1)}%`);
const med = (v) => {
  if (!v.length) return null;
  const s = [...v].sort((a, b) => a - b);
  const m = s.length >> 1;
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};
const ordinaPer = (cum) => (a, b) => (cum[a] - cum[b]) || (a < b ? -1 : b < a ? 1 : 0);
const OK = (b) => (b ? 'OK' : '*** DIVERGE ***');

console.log('════════ VERIFICA ADVERSARIALE DI M5 ════════\n');

// ═══════════════════════════════════════════════════════ A. I CASI, DA ZERO
const manifest = JSON.parse(readFileSync(path.join(DEMO, 'vista', 'manifest.json'), 'utf8'));
const SITO2SIM = manifest.cartella_di;
const GARE = Object.keys(SITO2SIM).sort();

const demoG = {};
for (const g of GARE) demoG[g] = JSON.parse(readFileSync(path.join(DEMO, `${g}.json`), 'utf8'));

const casiMiei = [];
const censura = { soste: 0, pit_le_3: 0, no_cum_congelamento: 0, no_giro_rientro: 0, no_cum_rientro: 0, doppiato: 0 };
const fuoriPerimetro = [];   // le soste escluse, tenute da parte: servono a F
let outLapMancante = 0;

for (const gara of GARE) {
  const G = demoG[gara];
  const byLap = {};
  for (const l of G.laps) byLap[l.lap] = l.cars;
  const nLaps = G.n_laps;
  // il tempo con cui il PRIMO ha chiuso il giro k
  const leader = {};
  for (let k = 1; k <= nLaps; k += 1) {
    if (!byLap[k]) continue;
    let m = Infinity;
    for (const d of Object.keys(byLap[k])) {
      const t = byLap[k][d].cum_time;
      if (typeof t === 'number' && t < m) m = t;
    }
    if (m < Infinity) leader[k] = m;
  }
  const doppiato = (Lo, cum) => leader[Lo + 1] !== undefined && cum > leader[Lo + 1];

  for (let Li = 1; Li <= nLaps; Li += 1) {
    if (!byLap[Li]) continue;
    for (const drv of Object.keys(byLap[Li])) {
      if (byLap[Li][drv].in_lap !== true) continue;
      censura.soste += 1;
      const L = Li - 1; const Lo = Li + 1;
      const scarta = (m) => { censura[m] += 1; fuoriPerimetro.push({ gara, drv, Li, motivo: m }); };
      if (Li <= 3) { scarta('pit_le_3'); continue; }
      if (typeof byLap[L]?.[drv]?.cum_time !== 'number') { scarta('no_cum_congelamento'); continue; }
      if (!byLap[Lo]) { scarta('no_giro_rientro'); continue; }
      const cumLo = byLap[Lo][drv]?.cum_time;
      if (typeof cumLo !== 'number') { scarta('no_cum_rientro'); continue; }
      if (doppiato(Lo, cumLo)) {
        censura.doppiato += 1;
        // già doppiato PRIMA della sosta, o doppiato PER EFFETTO della sosta?
        const giaPrima = doppiato(L, byLap[L][drv].cum_time);
        fuoriPerimetro.push({ gara, drv, Li, motivo: 'doppiato', giaPrima });
        continue;
      }
      if (byLap[Lo][drv].out_lap !== true) outLapMancante += 1;

      const cum = {};
      for (const d of Object.keys(byLap[Lo])) {
        const t = byLap[Lo][d].cum_time;
        if (typeof t === 'number') cum[d] = t;
      }
      const ordine = Object.keys(cum).sort(ordinaPer(cum));
      const pariGiro = ordine.filter((d) => !doppiato(Lo, cum[d]));
      const cumL = {};
      for (const d of Object.keys(byLap[L])) {
        const t = byLap[L][d].cum_time;
        if (typeof t === 'number') cumL[d] = t;
      }
      const ordineL = Object.keys(cumL).sort(ordinaPer(cumL));

      casiMiei.push({
        id: `${gara}|${drv}|${Li}`,
        gara, garaSim: SITO2SIM[gara], drv, L, Li, Lo, nLaps,
        vera: ordine.indexOf(drv) + 1,
        suVeri: ordine.length,
        veraPariGiro: pariGiro.indexOf(drv) + 1,
        suPariGiro: pariGiro.length,
        ordineVero: ordine,
        posAlCongelamento: ordineL.indexOf(drv) + 1,
        mescolaL: byLap[L][drv].compound ?? null,
        neutrAlPit: byLap[Li][drv].neutralized === true,
      });
    }
  }
}
console.log('──── A. PERIMETRO E VERITÀ, RICOSTRUITI DA ZERO');
console.log(`  soste vere trovate (celle in_lap) : ${censura.soste}`);
console.log(`  escluse · pit ≤ 3                 : ${censura.pit_le_3}`);
console.log(`  escluse · senza cum al congelam.  : ${censura.no_cum_congelamento}`);
console.log(`  escluse · senza giro di rientro   : ${censura.no_giro_rientro}`);
console.log(`  escluse · senza cum al rientro    : ${censura.no_cum_rientro}`);
console.log(`  escluse · doppiato al rientro     : ${censura.doppiato}`);
console.log(`  AMMESSI                           : ${casiMiei.length}`);
console.log(`  fra gli ammessi, celle di rientro SENZA out_lap: ${outLapMancante} (l'agente dichiara 0/274)`);
const dop = fuoriPerimetro.filter((x) => x.motivo === 'doppiato');
console.log(`    di cui GIÀ doppiati al congelamento ${dop.filter((x) => x.giaPrima).length} · doppiati PER EFFETTO della sosta ${dop.filter((x) => !x.giaPrima).length} (l'agente dichiara 46)`);
const disc = casiMiei.filter((c) => c.vera !== c.veraPariGiro).length;
console.log(`  posizione fra TUTTI ≠ posizione fra PARI GIRO in ${disc}/${casiMiei.length} casi`);
console.log(`    (se 0: i doppiati stanno in coda per costruzione e non spostano il rango — la lettura «grezza» non è`);
console.log('     gonfiata dai doppiati; cambia solo il DENOMINATORE, e quindi il ritaglio della banda in alto)');

// ═══════════════════════════════════════════════ B. IL MOTORE NUOVO, DA QUI
const gareSim = caricaGare2026(SIM);
const modello = JSON.parse(readFileSync(path.join(SIM, 'data', 'modelli', 'modello_v2.json'), 'utf8'));
const prior = caricaPrior(SIM);
const costantiDirector = caricaCostanti(SIM);
const bandaRientro = JSON.parse(readFileSync(path.join(SIM, 'data', 'modelli', 'banda_rientro.json'), 'utf8'));
const CTX = { gare: gareSim, modello, prior, costantiDirector, bandaRientro };

const mescolaDi = (gSim, L, drv) => {
  const c = gSim.perPilota.get(drv)?.get(L);
  return c && MESCOLE_SLICK.has(c.compound) ? c.compound : null;
};
const regimeDi = (gSim, L, drv) => {
  const c = gSim.perPilota.get(drv)?.get(L);
  if (!c || c.status === null || !regimeNeutralizzato(c)) return null;
  return simboliStatus(c.status).has('4') ? 'SC' : 'VSC';
};

function chiedi(caso, { gara = null } = {}) {
  const gSim = gara ?? gareSim[caso.garaSim];
  const mescola = mescolaDi(gSim, caso.L, caso.drv);
  if (mescola === null) return { muto: true, motivo: 'mescola non slick al congelamento' };
  const ctx = { ...CTX, gare: { ...gareSim, [caso.garaSim]: gSim }, nGiriGara: gSim.nGiri };
  let r;
  try {
    r = doveRientri({ gara: caso.garaSim, freezeLap: caso.L, pilota: caso.drv, giroPit: caso.Li, mescola }, ctx);
  } catch (e) { return { muto: true, motivo: `eccezione: ${e.message}` }; }
  if (!r || r.approvato !== true) return { muto: true, motivo: 'respinto dal Director' };
  if (r.posizione === null || r.posizione === undefined) return { muto: true, motivo: 'nessun passo base (regola 6)' };
  let ordine = null;
  if (r.traccia) {
    const cum = {};
    for (const [d, passi] of Object.entries(r.traccia)) {
      const p = passi?.find((x) => x.lap === caso.Lo);
      if (p) cum[d] = p.cum_time;
    }
    ordine = Object.keys(cum).sort(ordinaPer(cum));
  }
  return { muto: false, pos: r.posizione, su: r.su_quanti, banda: r.banda_posizione, ordine,
           perdita: r.perdita, giroRientro: r.giro_di_rientro };
}

const t0 = Date.now();
const R = casiMiei.map((c) => ({ c, n: chiedi(c) }));
const conBanda = R.filter((r) => !r.n.muto && r.n.banda);
const muti = R.filter((r) => r.n.muto);
const okSenzaBanda = R.filter((r) => !r.n.muto && !r.n.banda);
console.log('\n──── B. IL MOTORE NUOVO, CHIAMATO DA QUI');
console.log(`  risponde ${R.length - muti.length}/${R.length} · muto ${muti.length} · con banda ${conBanda.length} · risposta senza banda ${okSenzaBanda.length}`);
const motiviMuti = {};
for (const m of muti) motiviMuti[m.n.motivo] = (motiviMuti[m.n.motivo] ?? 0) + 1;
for (const [k, v] of Object.entries(motiviMuti)) console.log(`    muto · ${v}× ${k}`);
const giroSbagliato = conBanda.filter((r) => r.n.giroRientro !== r.c.Lo).length;
console.log(`  risposte il cui giro di rientro NON è Li+1: ${giroSbagliato}  (deve essere 0: verità e previsione sullo stesso giro)`);
const ordineParziale = conBanda.filter((r) => !r.n.ordine || r.n.ordine.length !== r.n.su).length;
console.log(`  risposte in cui l'ordine dalla traccia non ha su_quanti piloti: ${ordineParziale}  (se >0 la lettura «popolazione comune» sarebbe monca)`);
void t0;   // niente cronometro nell'uscita: due esecuzioni devono essere identiche al byte

// ═════════════════════════════════════ D. LA BANDA È QUELLA DEL MOTORE?
console.log('\n──── D. LA BANDA PUBBLICATA È clip(pos ± s) SUL SUO PROPRIO DENOMINATORE?');
let bandaStrana = 0; let ctxStrano = 0;
for (const r of conBanda) {
  const s = r.n.banda.semi_ampiezza;
  const attesoDa = Math.max(1, r.n.pos - s);
  const attesoA = Math.min(r.n.su, r.n.pos + s);
  if (r.n.banda.da !== attesoDa || r.n.banda.a !== attesoA) bandaStrana += 1;
  const ctxAtteso = regimeDi(gareSim[r.c.garaSim], r.c.L, r.c.drv) !== null ? 'NEUTRA' : 'VERDE';
  if (r.n.banda.contesto !== ctxAtteso) ctxStrano += 1;
}
console.log(`  bande diverse da clip(pos±s): ${bandaStrana}   ${OK(bandaStrana === 0)}`);
console.log(`  contesto ≠ regime al congelamento: ${ctxStrano}   ${OK(ctxStrano === 0)}`);
const semiConti = {};
for (const r of conBanda) semiConti[r.n.banda.semi_ampiezza] = (semiConti[r.n.banda.semi_ampiezza] ?? 0) + 1;
console.log(`  semi-ampiezze osservate: ${Object.entries(semiConti).map(([k, v]) => `±${k}×${v}`).join(' · ')}`);

// ═══════════════════════════════════════════ C. FUGA DAL FUTURO — SONDA DURA
// Si ritaglia la gara ai soli giri ≤ freezeLap e si richiede la stessa risposta.
// Se una qualunque cifra cambia, il motore stava leggendo oltre il congelamento.
function troncaGara(g, L) {
  const perPilota = new Map();
  for (const [drv, celle] of g.perPilota) {
    const m = new Map();
    for (const [lap, c] of celle) if (lap <= L) m.set(lap, c);
    perPilota.set(drv, m);
  }
  return { ...g, perPilota, righe: g.righe.filter((x) => x.lap <= L) };
}
console.log('\n──── C. FUGA DAL FUTURO — la risposta cambia se si cancella tutto ciò che sta dopo L?');
let diversi = 0; let provati = 0; let mutiTronco = 0;
for (const r of conBanda) {
  provati += 1;
  const g2 = troncaGara(gareSim[r.c.garaSim], r.c.L);
  const q = chiedi(r.c, { gara: g2 });
  if (q.muto) { mutiTronco += 1; diversi += 1; continue; }
  if (q.pos !== r.n.pos || q.su !== r.n.su || q.banda.da !== r.n.banda.da || q.banda.a !== r.n.banda.a
      || q.banda.contesto !== r.n.banda.contesto) diversi += 1;
}
console.log(`  casi sondati ${provati} · risposte che CAMBIANO col troncamento: ${diversi} (di cui mute: ${mutiTronco})`);
console.log(`  ${diversi === 0 ? 'nessuna fuga dal futuro nel motore nuovo: la sonda non lo smuove' : '*** il motore nuovo LEGGE OLTRE IL CONGELAMENTO ***'}`);

// ═════════════════════════════════════════════ E. LE LETTURE DELLA COPERTURA
const dentroGrezza = (r) => r.c.vera >= r.n.banda.da && r.c.vera <= r.n.banda.a;
const dentroNonRitagliata = (r) => {
  const s = r.n.banda.semi_ampiezza;
  return r.c.vera >= r.n.pos - s && r.c.vera <= r.n.pos + s;
};
const dentroRitaglioVero = (r) => {   // ritaglio al campo VERO, non a quello del motore
  const s = r.n.banda.semi_ampiezza;
  return r.c.vera >= Math.max(1, r.n.pos - s) && r.c.vera <= Math.min(r.c.suVeri, r.n.pos + s);
};
function comune(r) {                  // popolazione comune: intersezione previsto ∩ vero
  if (!r.n.ordine) return null;
  const setVero = new Set(r.c.ordineVero);
  const inter = new Set(r.n.ordine.filter((d) => setVero.has(d)));
  if (!inter.has(r.c.drv)) return null;
  const pPrev = r.n.ordine.filter((d) => inter.has(d)).indexOf(r.c.drv) + 1;
  const pVero = r.c.ordineVero.filter((d) => inter.has(d)).indexOf(r.c.drv) + 1;
  return { pPrev, pVero, n: inter.size };
}
for (const r of conBanda) r.com = comune(r);
const dentroComune = (r) => {
  if (!r.com) return false;
  const s = r.n.banda.semi_ampiezza;
  return r.com.pVero >= Math.max(1, r.com.pPrev - s) && r.com.pVero <= Math.min(r.com.n, r.com.pPrev + s);
};

console.log('\n──── E. LA COPERTURA, IN CINQUE LETTURE (stessi 260 casi, cambia solo il metro)');
const letture = [
  ['grezza — banda del motore contro rango fra TUTTI (quella dell\'agente)', dentroGrezza],
  ['banda NON ritagliata ai bordi (pos ± s, senza clip)', dentroNonRitagliata],
  ['banda ritagliata al campo VERO invece che a quello del motore', dentroRitaglioVero],
  ['popolazione COMUNE (previsione e verità nello stesso insieme)', dentroComune],
];
for (const [nome, f] of letture) {
  const d = conBanda.filter(f).length;
  console.log(`  ${nome.padEnd(62)} ${String(d).padStart(3)}/${conBanda.length} = ${pct(d, conBanda.length)}`);
}
const copGrezza = conBanda.filter(dentroGrezza).length;
console.log(`  con i ${muti.length} muti contati come NON coperti (silenzio = esito): ${copGrezza}/${casiMiei.length} = ${pct(copGrezza, casiMiei.length)}`);
console.log(`  CANCELLO M5 (≥ 80%): ${letture.map(([nome, f]) => `${(100 * conBanda.filter(f).length / conBanda.length).toFixed(1)}%`).join(' · ')} → ${letture.every(([, f]) => 100 * conBanda.filter(f).length / conBanda.length < 80) ? 'CADE in tutte e quattro le letture' : 'ATTENZIONE: passa in almeno una lettura'}`);

console.log('\n  per gara (lettura grezza) — blocchi = gare:');
const perGara = new Map();
for (const r of conBanda) {
  if (!perGara.has(r.c.gara)) perGara.set(r.c.gara, []);
  perGara.get(r.c.gara).push(r);
}
const quote = [];
for (const [g, rs] of [...perGara.entries()].sort()) {
  const d = rs.filter(dentroGrezza).length;
  const dc = rs.filter(dentroComune).length;
  quote.push(d / rs.length);
  console.log(`    ${g.padEnd(16)} ${String(rs.length).padStart(3)} casi · grezza ${`${d}/${rs.length}`.padStart(7)} ${pct(d, rs.length).padStart(7)} · comune ${`${dc}/${rs.length}`.padStart(7)} ${pct(dc, rs.length).padStart(7)}`);
}
console.log(`    mediana delle ${quote.length} quote: ${(100 * med(quote)).toFixed(1)}% · gare sotto l'80%: ${quote.filter((q) => q < 0.8).length}/${quote.length}`);

// bias con segno
const bias = conBanda.map((r) => r.n.pos - r.c.vera);
console.log(`\n  bias con segno (previsto − vero): mediana ${med(bias)} · media ${(bias.reduce((a, b) => a + b, 0) / bias.length).toFixed(2)}`);
const inVerde = conBanda.filter((r) => !r.c.neutrAlPit);
const inNeutra = conBanda.filter((r) => r.c.neutrAlPit);
const b1 = inVerde.map((r) => r.n.pos - r.c.vera); const b2 = inNeutra.map((r) => r.n.pos - r.c.vera);
console.log(`    sosta poi in verde   n=${inVerde.length} · mediana ${med(b1)} · media ${(b1.reduce((a, b) => a + b, 0) / b1.length).toFixed(2)} · copertura ${pct(inVerde.filter(dentroGrezza).length, inVerde.length)}`);
console.log(`    sosta poi NEUTRALIZZ n=${inNeutra.length} · mediana ${med(b2)} · media ${(b2.reduce((a, b) => a + b, 0) / b2.length).toFixed(2)} · copertura ${pct(inNeutra.filter(dentroGrezza).length, inNeutra.length)}`);

// ═════════════════════════ F. IL DIVARIO CON L'88,5% — QUANTE CONVENZIONI CI SONO?
// Si ri-esegue il BANCO DI CALIBRAZIONE (banco/misure/rientro.mjs), quello da cui
// esce l'88,5%, e lo si unisce caso per caso a questa misura.
console.log('\n──── F. DA DOVE VIENE IL DIVARIO CON L\'88,5% DICHIARATO');
const cancelli = JSON.parse(readFileSync(path.join(SIM, 'banco', 'prereg', 'cancelli_banco.json'), 'utf8'));
const cal = misuraRientro(gareSim, {
  rho: modello.rho.valore, delta70: modello.delta_70.scelto, prior, cancelli: cancelli.rientro,
});
const semiDi = (ctx) => bandaRientro.contesti[ctx].semi_ampiezza;
const ctxCal = (c) => (c.regime !== null ? 'NEUTRA' : 'VERDE');
const copertoCal = (c) => Math.abs(c.errore) <= semiDi(ctxCal(c));
const nCal = cal.casi.length;
const copCal = cal.casi.filter(copertoCal).length;
console.log(`  banco di calibrazione ri-eseguito: ${nCal} soste · copertura ${copCal}/${nCal} = ${pct(copCal, nCal)}`);
for (const ctx of ['VERDE', 'NEUTRA']) {
  const rs = cal.casi.filter((c) => ctxCal(c) === ctx);
  console.log(`    ${ctx.padEnd(7)} n=${String(rs.length).padStart(3)} · ${pct(rs.filter(copertoCal).length, rs.length)} (il file dichiara ${(100 * bandaRientro.contesti[ctx].copertura_fuori_campione).toFixed(1)}% su n=${bandaRientro.contesti[ctx].n_casi})`);
}

// unione caso per caso
const chiaveCal = (c) => `${c.gara}|${c.drv}|${c.lap}`;
const indiceCal = new Map(cal.casi.map((c) => [chiaveCal(c), c]));
const insieme = conBanda.map((r) => ({ r, cal: indiceCal.get(`${r.c.garaSim}|${r.c.drv}|${r.c.Li}`) ?? null }));
const inEntrambi = insieme.filter((x) => x.cal);
console.log(`\n  soste presenti in ENTRAMBI i perimetri: ${inEntrambi.length} (M5 con banda: ${conBanda.length} · calibrazione: ${nCal})`);
console.log(`  soste del banco di calibrazione FUORI dal perimetro M5: ${nCal - inEntrambi.length}`);

if (inEntrambi.length) {
  const n = inEntrambi.length;
  const passi = [
    ['① prodotto, lettura grezza (il numero dell\'agente)', (x) => dentroGrezza(x.r)],
    ['② prodotto, popolazione comune', (x) => dentroComune(x.r)],
    ['③ prodotto, ma contesto banda dal regime DELLA SOSTA (il controfattuale dell\'agente)',
      (x) => {
        const s = semiDi(x.cal.regime !== null ? 'NEUTRA' : 'VERDE');
        return x.r.c.vera >= Math.max(1, x.r.n.pos - s) && x.r.c.vera <= Math.min(x.r.n.su, x.r.n.pos + s);
      }],
    ['④ PREVISIONE della calibrazione (pit-loss col regime della sosta, niente soste-rivali), banda del contesto della sosta',
      (x) => copertoCal(x.cal)],
    ['⑤ PREVISIONE della calibrazione, ma banda col contesto del PRODOTTO (regime al congelamento)',
      (x) => Math.abs(x.cal.errore) <= semiDi(x.r.n.banda.contesto)],
  ];
  console.log('\n  SUGLI STESSI CASI, un pezzo di convenzione alla volta:');
  for (const [nome, f] of passi) {
    const d = inEntrambi.filter(f).length;
    console.log(`    ${nome}`);
    console.log(`        ${String(d).padStart(3)}/${n} = ${pct(d, n)}`);
  }
  // di quanto sbaglia il PUNTO nei due mondi
  const ePro = inEntrambi.map((x) => x.r.n.pos - x.r.c.vera);
  const eCal = inEntrambi.map((x) => x.cal.errore);
  console.log(`\n    |errore| mediano del punto: prodotto ${med(ePro.map(Math.abs))} · calibrazione ${med(eCal.map(Math.abs))}`);
  console.log(`    bias con segno mediano:     prodotto ${med(ePro)} · calibrazione ${med(eCal)}`);
  const cambiaCtx = inEntrambi.filter((x) => (x.cal.regime !== null ? 'NEUTRA' : 'VERDE') !== x.r.n.banda.contesto).length;
  console.log(`    il contesto cambia fra le due convenzioni in ${cambiaCtx}/${n} casi`);

  // DOVE si apre il divario fra ③ e ④: nei casi in cui il regime della sosta NON è
  // quello del congelamento, cioè dove la calibrazione SA una cosa che il prodotto
  // al congelamento non può sapere.
  console.log('\n    dove si apre il divario fra ③ (prodotto) e ④ (calibrazione), sugli stessi casi:');
  for (const [nome, f] of [
    ['regime della sosta = regime al congelamento', (x) => (x.cal.regime !== null ? 'NEUTRA' : 'VERDE') === x.r.n.banda.contesto],
    ['regime DIVERSO (la SC esce al giro della sosta)', (x) => (x.cal.regime !== null ? 'NEUTRA' : 'VERDE') !== x.r.n.banda.contesto],
  ]) {
    const rs = inEntrambi.filter(f);
    if (!rs.length) continue;
    const pro = rs.filter((x) => dentroGrezza(x.r)).length;
    const proC = rs.filter((x) => dentroComune(x.r)).length;
    const ca = rs.filter((x) => copertoCal(x.cal)).length;
    const bp = med(rs.map((x) => x.r.n.pos - x.r.c.vera));
    const bc = med(rs.map((x) => x.cal.errore));
    console.log(`      ${nome.padEnd(48)} n=${String(rs.length).padStart(3)}`);
    console.log(`        prodotto grezza ${pct(pro, rs.length).padStart(6)} · prodotto comune ${pct(proC, rs.length).padStart(6)} · calibrazione ${pct(ca, rs.length).padStart(6)} · bias mediano ${bp} vs ${bc}`);
  }
  // il perimetro della calibrazione contiene informazione dal futuro? sì, e si vede:
  const conSC = inEntrambi.filter((x) => x.cal.regime !== null).length;
  const conSCal = inEntrambi.filter((x) => x.r.n.banda.contesto === 'NEUTRA').length;
  console.log(`\n    soste sotto regime secondo la CALIBRAZIONE (giri L, L+1): ${conSC}/${n}`);
  console.log(`    soste sotto regime secondo il PRODOTTO (giro L−1)      : ${conSCal}/${n}`);
  console.log('    → la calibrazione classifica come NEUTRA soste che al congelamento erano verdi:');
  console.log('      è informazione che al congelamento non esiste, e la banda dichiarata la contiene');
}

// il perimetro: le soste che M5 esclude, come vanno nella calibrazione?
const chiaviM5 = new Set(conBanda.map((r) => `${r.c.garaSim}|${r.c.drv}|${r.c.Li}`));
const soloCal = cal.casi.filter((c) => !chiaviM5.has(chiaveCal(c)));
if (soloCal.length) {
  console.log(`\n  le ${soloCal.length} soste che la calibrazione ha e M5 no (doppiati, pit ≤ 3, muti…):`);
  console.log(`    copertura nella calibrazione: ${soloCal.filter(copertoCal).length}/${soloCal.length} = ${pct(soloCal.filter(copertoCal).length, soloCal.length)}`);
  const dentroCal = cal.casi.filter((c) => chiaviM5.has(chiaveCal(c)));
  console.log(`    copertura nella calibrazione delle soste CONDIVISE: ${dentroCal.filter(copertoCal).length}/${dentroCal.length} = ${pct(dentroCal.filter(copertoCal).length, dentroCal.length)}`);
  console.log('    (se le escluse coprono come le altre, il perimetro di M5 non è il colpevole del divario)');
}

// ═══════════════════════════════ G. PERIMETRO: E SE NON SI ESCLUDESSERO I DOPPIATI?
console.log('\n──── G. SENSIBILITÀ AL PERIMETRO (il cancello resta quello pre-registrato)');
{
  // ricostruzione dei casi SENZA l'esclusione dei doppiati e SENZA pit ≤ 3
  const larghi = [];
  for (const gara of GARE) {
    const G = demoG[gara];
    const byLap = {}; for (const l of G.laps) byLap[l.lap] = l.cars;
    for (let Li = 1; Li <= G.n_laps; Li += 1) {
      if (!byLap[Li]) continue;
      for (const drv of Object.keys(byLap[Li])) {
        if (byLap[Li][drv].in_lap !== true) continue;
        const L = Li - 1; const Lo = Li + 1;
        if (L < 1) continue;
        if (typeof byLap[L]?.[drv]?.cum_time !== 'number') continue;
        if (!byLap[Lo] || typeof byLap[Lo][drv]?.cum_time !== 'number') continue;
        const cum = {};
        for (const d of Object.keys(byLap[Lo])) {
          const t = byLap[Lo][d].cum_time; if (typeof t === 'number') cum[d] = t;
        }
        const ordine = Object.keys(cum).sort(ordinaPer(cum));
        larghi.push({ id: `${gara}|${drv}|${Li}`, gara, garaSim: SITO2SIM[gara], drv, L, Li, Lo,
                      vera: ordine.indexOf(drv) + 1, suVeri: ordine.length, ordineVero: ordine });
      }
    }
  }
  const RL = larghi.map((c) => ({ c, n: chiedi(c) })).filter((r) => !r.n.muto && r.n.banda);
  for (const r of RL) r.com = comune(r);
  const dg = RL.filter(dentroGrezza).length;
  const dc = RL.filter(dentroComune).length;
  console.log(`  perimetro allargato (doppiati e pit ≤ 3 DENTRO): ${RL.length} casi con banda`);
  console.log(`    grezza ${dg}/${RL.length} = ${pct(dg, RL.length)} · popolazione comune ${dc}/${RL.length} = ${pct(dc, RL.length)}`);
  const soloDoppi = RL.filter((r) => !casiMiei.some((c) => c.id === r.c.id));
  console.log(`    solo le soste ESCLUSE da M5: ${soloDoppi.filter(dentroGrezza).length}/${soloDoppi.length} = ${pct(soloDoppi.filter(dentroGrezza).length, soloDoppi.length)} (grezza)`);
}

// ═══════════════════════════════════ H. CONFRONTO CON banco.mjs E COI NUMERI DICHIARATI
console.log('\n──── H. LE DUE COSTRUZIONI INDIPENDENTI COINCIDONO?');
const banco = await import('./banco.mjs');
const casiB = banco.casi();
console.log(`  casi: mio ${casiMiei.length} · banco ${casiB.length}   ${OK(casiMiei.length === casiB.length)}`);
const idB = new Map(casiB.map((c) => [c.id, c]));
let divVera = 0; let divSu = 0; let mancanti = 0;
for (const c of casiMiei) {
  const b = idB.get(c.id);
  if (!b) { mancanti += 1; continue; }
  if (b.posizioneVera !== c.vera) divVera += 1;
  if (b.suQuantiVeri !== c.suVeri) divSu += 1;
}
console.log(`  id assenti nel banco: ${mancanti} · verità diverse: ${divVera} · denominatori diversi: ${divSu}   ${OK(mancanti === 0 && divVera === 0 && divSu === 0)}`);
let divPos = 0; let divBanda = 0; let divMuto = 0;
for (const r of R) {
  const b = banco.rispostaNuovo(idB.get(r.c.id));
  if (b.muto !== r.n.muto) { divMuto += 1; continue; }
  if (r.n.muto) continue;
  if (b.pos !== r.n.pos || b.su !== r.n.su) divPos += 1;
  if ((b.banda?.da ?? null) !== (r.n.banda?.da ?? null) || (b.banda?.a ?? null) !== (r.n.banda?.a ?? null)) divBanda += 1;
}
console.log(`  risposte del motore: muti diversi ${divMuto} · posizioni diverse ${divPos} · bande diverse ${divBanda}   ${OK(divMuto === 0 && divPos === 0 && divBanda === 0)}`);

// ═══════════════ J. IL CONFRONTO COL VECCHIO — ricostruito da qui, non dal banco
// Parametri copiati da gen_hero.mjs::scelta (ZONE 0, gradino da misura(), present
// filtrato su cum_time e pace), con le DUE sole differenze dichiarate dal banco:
// orizzonte 0 (la risposta deve cadere sul giro di rientro, come per il nuovo) e
// byLap troncato a ≤ L (senza, il vecchio leggerebbe oltre il congelamento).
const { evaluatePit } = await import('../../demo/pitscenario.mjs');
const { misura: misuraGradino } = await import('../../demo/gradino.mjs');
const PITLOSS = JSON.parse(readFileSync(path.join(DEMO, 'pitloss.json'), 'utf8'));
function chiediVecchio(caso, { tronca = true } = {}) {
  const G = demoG[caso.gara];
  const byLap = {}; for (const l of G.laps) byLap[l.lap] = l.cars;
  let bl = byLap;
  if (tronca) { bl = {}; for (let k = 1; k <= caso.L; k += 1) if (byLap[k]) bl[k] = byLap[k]; }
  const pace = G.pace[String(caso.L)] || {};
  const present = G.drivers.filter((d) => typeof bl[caso.L]?.[d]?.cum_time === 'number' && pace[d] != null);
  const viva = misuraGradino(bl, G.n_laps, caso.L);
  const gradino = (viva.gradino != null && viva.n_gradino >= 3) ? viva.gradino : null;
  let r;
  try {
    r = evaluatePit({ byLap: bl, nLaps: G.n_laps, pace, driver: caso.drv, freezeLap: caso.L,
                      pitLap: caso.Li, pitLoss: PITLOSS[caso.gara], present, gara: caso.gara,
                      laps: G.laps, ZONE: 0, orizzonte: 0, gradino });
  } catch { return { muto: true }; }
  if (!r || r.ok !== true) return { muto: true };
  return { muto: false, pos: r.rientro_pos, su: r.su_totale, ordine: (r.ordine_previsto ?? []).map((x) => x[0]) };
}
console.log('\n──── J. IL CONFRONTO COL VECCHIO, RIFATTO DA QUI (M5 lo cita: è alla pari?)');
for (const r of conBanda) r.v = chiediVecchio(r.c);
const duo = conBanda.filter((r) => !r.v.muto);
const comV = (r) => {
  const setVero = new Set(r.c.ordineVero);
  const inter = new Set(r.v.ordine.filter((d) => setVero.has(d)));
  if (!inter.has(r.c.drv)) return null;
  return { pPrev: r.v.ordine.filter((d) => inter.has(d)).indexOf(r.c.drv) + 1,
           pVero: r.c.ordineVero.filter((d) => inter.has(d)).indexOf(r.c.drv) + 1,
           n: inter.size };
};
const dentroS = (pos, su, s, vera) => vera >= Math.max(1, pos - s) && vera <= Math.min(su, pos + s);
console.log(`  il vecchio risponde su ${duo.length}/${conBanda.length} dei casi con banda (l'agente dichiara 223)`);
const righeJ = [
  ['NUOVO punto secco', conBanda.length, conBanda.filter((r) => r.n.pos === r.c.vera).length, '98/260 = 37,7%'],
  ['NUOVO banda del modello, casi doppi', duo.length, duo.filter(dentroGrezza).length, '152/223 = 68,2%'],
  ['NUOVO ±1, casi doppi', duo.length, duo.filter((r) => dentroS(r.n.pos, r.n.su, 1, r.c.vera)).length, '150/223 = 67,3%'],
  ['VECCHIO punto secco, casi doppi', duo.length, duo.filter((r) => r.v.pos === r.c.vera).length, '71/223 = 31,8%'],
  ['VECCHIO ±1, casi doppi', duo.length, duo.filter((r) => dentroS(r.v.pos, r.v.su, 1, r.c.vera)).length, '128/223 = 57,4%'],
  ['VECCHIO ±2, casi doppi', duo.length, duo.filter((r) => dentroS(r.v.pos, r.v.su, 2, r.c.vera)).length, '163/223 = 73,1%'],
  ['INERTE ±1 (resti dov\'eri)', conBanda.length, conBanda.filter((r) => dentroS(r.c.posAlCongelamento, r.c.suVeri, 1, r.c.vera)).length, '115/260 = 44,2%'],
];
for (const [nome, n, d, suo] of righeJ) console.log(`    ${nome.padEnd(36)} ${String(d).padStart(3)}/${String(n).padEnd(3)} = ${pct(d, n).padStart(6)}   lui: ${suo}`);
const duoCom = duo.map((r) => ({ r, cn: r.com, cv: comV(r) })).filter((x) => x.cn && x.cv);
const dentroComGen = (c, s) => c.pVero >= Math.max(1, c.pPrev - s) && c.pVero <= Math.min(c.n, c.pPrev + s);
console.log(`    — popolazione comune, stessi ${duoCom.length} casi —`);
console.log(`    NUOVO banda del modello  ${duoCom.filter((x) => dentroComGen(x.cn, x.r.n.banda.semi_ampiezza)).length}/${duoCom.length} = ${pct(duoCom.filter((x) => dentroComGen(x.cn, x.r.n.banda.semi_ampiezza)).length, duoCom.length)}   lui: 158/223 = 70,9%`);
console.log(`    NUOVO ±1                 ${duoCom.filter((x) => dentroComGen(x.cn, 1)).length}/${duoCom.length} = ${pct(duoCom.filter((x) => dentroComGen(x.cn, 1)).length, duoCom.length)}   lui: 156/223 = 70,0%`);
console.log(`    VECCHIO ±1               ${duoCom.filter((x) => dentroComGen(x.cv, 1)).length}/${duoCom.length} = ${pct(duoCom.filter((x) => dentroComGen(x.cv, 1)).length, duoCom.length)}   lui: 157/223 = 70,4%`);
console.log(`    VECCHIO ±2               ${duoCom.filter((x) => dentroComGen(x.cv, 2)).length}/${duoCom.length} = ${pct(duoCom.filter((x) => dentroComGen(x.cv, 2)).length, duoCom.length)}   lui: 188/223 = 84,3%`);
console.log(`    NUOVO ±2                 ${duoCom.filter((x) => dentroComGen(x.cn, 2)).length}/${duoCom.length} = ${pct(duoCom.filter((x) => dentroComGen(x.cn, 2)).length, duoCom.length)}   lui: 188/223 = 84,3%`);

console.log('\n──── I. I NUMERI DICHIARATI DALL\'AGENTE, RICALCOLATI QUI');
const atteso = [
  ['copertura complessiva', `${copGrezza}/${conBanda.length} = ${pct(copGrezza, conBanda.length)}`, '175/260 = 67,3%'],
  ['con i muti come non coperti', `${copGrezza}/${casiMiei.length} = ${pct(copGrezza, casiMiei.length)}`, '175/274 = 63,9%'],
  ['perimetro', `${casiMiei.length} ammessi su ${censura.soste}`, '274 su 459'],
  ['esclusi doppiati', String(censura.doppiato), '140'],
  ['muti', String(muti.length), '14'],
  ['casi con banda', String(conBanda.length), '260'],
  ['bias mediano / medio', `${med(bias)} / ${(bias.reduce((a, b) => a + b, 0) / bias.length).toFixed(2)}`, '+1 / +1,08'],
];
for (const [nome, mio, suo] of atteso) console.log(`  ${nome.padEnd(30)} io: ${String(mio).padEnd(24)} lui: ${suo}`);

console.log('\n════════ fine verifica ════════');
