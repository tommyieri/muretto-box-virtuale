// att6_v2.mjs — protocollo ATT6 v2 con verdetto automatico (PREREG_ATT6_V2.md).
//
// Uso:  node att6_v2.mjs <CIRCUITO> <ANNO> <VALORE_VECCHIO> <VALORE_NUOVO> [--race-json <path>]
//   es. node att6_v2.mjs silverstone 2026 29.12 20.80
//       node att6_v2.mjs spa-francorchamps 2024 23.36 18.35 --race-json data/gara_storica_spa_2024.json
//
// PRODUCE UN REPORT E UN EXIT CODE, NON APPLICA NULLA. Nessun file di produzione toccato.
// Il verdetto strategico resta del PO: l'exit code registra l'esito del protocollo, non decide il merge.
//
// Passi (PREREG_ATT6_V2.md):
//   1. TIPICITA'   |loss mediano gara - mediana grappolo 2018-2025| > 2,0 s -> NON GIUDICABILE
//   2. SENSIBILITA' per ogni stop valido (verde, no drive-through, no SC/VSC): |pos(vecchio)-pos(nuovo)|;
//                  ordina (sens desc, giro asc, pilota asc), top 5; <3 stop con sens>=1 -> NON GIUDICABILE
//   3. TABELLA     per i casi selezionati: PRIMA / ADESSO / REALE, esito per caso
//   4. VERDETTO    >=3 MIGLIORATI e 0 PEGGIORATI -> PASSA | >=1 PEGGIORATO -> RESPINTO | altrimenti NON CONCLUSIVO
//
// Exit code: 0 = PASSA, 1 = RESPINTO, 2 = NON GIUDICABILE, 3 = NON CONCLUSIVO, 4 = errore d'uso/dati.
import { evaluatePit } from './demo/pitscenario.mjs';
import { simulate } from './demo/engine.mjs';
import fs from 'fs';
import path from 'path';

const ROOT = path.resolve(new URL('.', import.meta.url).pathname);

// --- costanti pre-registrate (PREREG_ATT6_V2.md) -----------------------------
const SOGLIA_TIPICITA = 2.0;   // |loss gara - mediana grappolo| <= 2,0 -> gara giudicabile
const GRAPPOLO = [2018, 2025]; // grappolo storico, estremi inclusi
const TOP_N = 5;               // casi selezionati per sensibilita' meccanica
const MIN_SENSIBILI = 3;       // <3 stop con sensibilita' >=1 -> NON GIUDICABILE PER INSENSIBILITA'
const MIN_MIGLIORATI = 3;      // PASSA: >=3 migliorati E 0 peggiorati

const EXIT = { PASSA: 0, RESPINTO: 1, NON_GIUDICABILE: 2, NON_CONCLUSIVO: 3, ERRORE: 4 };

// mappatura circuito (cid del censimento) -> nome gara in demo/data/
const CID_TO_GP = {
  'montreal': 'Canada', 'silverstone': 'Gran Bretagna', 'spielberg': 'Austria',
  'catalunya': 'Spagna', 'melbourne': 'Australia', 'shanghai': 'Cina',
  'suzuka': 'Giappone', 'miami': 'Miami', 'monaco': 'Monaco',
  'spa-francorchamps': 'Belgio', 'austin': 'Stati Uniti',
};

// --- argomenti ---------------------------------------------------------------
const argv = process.argv.slice(2);
const rjIdx = argv.indexOf('--race-json');
let RACE_JSON = null;
if (rjIdx >= 0) { RACE_JSON = argv[rjIdx + 1]; argv.splice(rjIdx, 2); }
const [CIRCUITO, ANNO_S, VECCHIO_S, NUOVO_S] = argv;
if (!CIRCUITO || !ANNO_S || !VECCHIO_S || !NUOVO_S) {
  console.error('Uso: node att6_v2.mjs <CIRCUITO> <ANNO> <VALORE_VECCHIO> <VALORE_NUOVO> [--race-json <path>]');
  process.exit(EXIT.ERRORE);
}
const ANNO = parseInt(ANNO_S, 10), VECCHIO = parseFloat(VECCHIO_S), NUOVO = parseFloat(NUOVO_S);
if (!Number.isFinite(VECCHIO) || !Number.isFinite(NUOVO) || !Number.isInteger(ANNO)) {
  console.error('ERRORE: anno/valori non numerici.'); process.exit(EXIT.ERRORE);
}

const mediana = (a) => {
  if (!a.length) return NaN;
  const s = [...a].sort((x, y) => x - y), m = s.length >> 1;
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};

console.log(`\n${'='.repeat(84)}`);
console.log(`ATT6 v2 (verdetto automatico) — ${CIRCUITO} ${ANNO} — vecchio ${VECCHIO.toFixed(2)} s, nuovo ${NUOVO.toFixed(2)} s`);
console.log('='.repeat(84));

// esce stampando il verdetto e scrivendo il JSON di report
let REPORT = { circuito: CIRCUITO, anno: ANNO, vecchio: VECCHIO, nuovo: NUOVO, protocollo: 'ATT6 v2 (PREREG_ATT6_V2.md)' };
function verdetto(nome, motivo, extra = {}) {
  REPORT = { ...REPORT, ...extra, verdetto: nome, motivo };
  const outPath = path.join(ROOT, 'data', `att6v2_${CIRCUITO}_${ANNO}.json`);
  fs.writeFileSync(outPath, JSON.stringify(REPORT, null, 2));
  console.log(`\n--- 4. VERDETTO ---\n${nome}${motivo ? ' — ' + motivo : ''}`);
  console.log(`[scritto] data/att6v2_${CIRCUITO}_${ANNO}.json`);
  console.log('Questo e un REPORT: non applica nulla. La decisione strategica resta del PO.\n');
  process.exit(EXIT[nome.replaceAll(' ', '_')]);
}

// ============================================================ 1. TIPICITA'
// Fonti per-stop engine-ready, in ordine di preferenza: FF5 (9 circuiti demo) poi FF4.
const FONTI = ['pergara_stops.csv', 'engine_ready_stops.csv'];
function leggiStopsDa(nome) {
  const p = path.join(ROOT, 'data', nome);
  if (!fs.existsSync(p)) return null;
  const [head, ...righeCsv] = fs.readFileSync(p, 'utf8').trim().split('\n');
  const col = head.split(',');
  return righeCsv.map(r => Object.fromEntries(r.split(',').map((v, i) => [col[i], v])));
}
let stops = null, fonteUsata = null;
for (const f of FONTI) {
  const tutti = leggiStopsDa(f);
  if (tutti && tutti.some(s => s.circuito === CIRCUITO && +s.stagione === ANNO)) {
    stops = tutti.filter(s => s.circuito === CIRCUITO); fonteUsata = f; break;
  }
}
if (!stops) {
  console.error(`ERRORE: nessuno stop per ${CIRCUITO} ${ANNO} nelle fonti ${FONTI.join(', ')}.`);
  process.exit(EXIT.ERRORE);
}
const garaRighe = stops.filter(s => +s.stagione === ANNO);
const garaDry = garaRighe.filter(s => s.condizione === 'DRY');
console.log(`\n--- 1. TIPICITA (soglia ${SOGLIA_TIPICITA.toFixed(1)} s; fonte: data/${fonteUsata}) ---`);
if (!garaDry.length) {
  const cond = [...new Set(garaRighe.map(s => s.condizione))].join('/');
  console.log(`  gara ${CIRCUITO} ${ANNO}: condizione = ${cond} — NON DRY (il parametro di produzione e' il dry).`);
  verdetto('NON GIUDICABILE', `gara non dry (${cond}): caso fuori protocollo, decisione umana`,
           { tipicita: { condizione: cond } });
}
function medianePerGara(righe) {
  const perGara = {};
  for (const s of righe) (perGara[s.gara] ||= []).push(parseFloat(s.pit_loss));
  return Object.entries(perGara).map(([g, v]) => [g, mediana(v)]);
}
const grappoloRighe = stops.filter(s => s.condizione === 'DRY'
  && +s.stagione >= GRAPPOLO[0] && +s.stagione <= GRAPPOLO[1]);
const blocchi = medianePerGara(grappoloRighe);
const lossGara = mediana(garaDry.map(s => parseFloat(s.pit_loss)));
const lossGrappolo = mediana(blocchi.map(([, m]) => m));
const scarto = Math.abs(lossGara - lossGrappolo);
const tipica = scarto <= SOGLIA_TIPICITA;
console.log(`  loss mediano gara   (engine-ready, dry, n=${garaDry.length}) = ${lossGara.toFixed(2)} s`);
console.log(`  mediana grappolo    (${GRAPPOLO[0]}-${GRAPPOLO[1]}, dry, ${blocchi.length} blocchi) = ${lossGrappolo.toFixed(2)} s`);
console.log(`     blocchi: ${blocchi.map(([g, m]) => `${g}=${m.toFixed(2)}`).join('  ')}`);
console.log(`  scarto = ${scarto.toFixed(2)} s  ->  ${tipica ? 'TIPICA (giudicabile)' : 'ATIPICA'}`);
REPORT.tipicita = { loss_gara: +lossGara.toFixed(4), mediana_grappolo: +lossGrappolo.toFixed(4),
  scarto: +scarto.toFixed(4), soglia: SOGLIA_TIPICITA, esito: tipica ? 'TIPICA' : 'ATIPICA',
  blocchi_grappolo: Object.fromEntries(blocchi.map(([g, m]) => [g, +m.toFixed(4)])) };
if (!tipica) {
  console.log('  Ne attivazione ne rollback: il candidato aspetta la prossima gara sul circuito.');
  verdetto('NON GIUDICABILE', `gara atipica (scarto ${scarto.toFixed(2)} s > ${SOGLIA_TIPICITA.toFixed(1)} s)`);
}

// ============================================================ 2. SENSIBILITA'
const GP = CID_TO_GP[CIRCUITO];
const gpPath = RACE_JSON ? path.resolve(RACE_JSON)
  : (GP ? path.join(ROOT, 'demo', 'data', `${GP}.json`) : null);
if (!gpPath || !fs.existsSync(gpPath)) {
  console.error(`ERRORE: gara non trovata (${gpPath || 'nessuna mappatura per ' + CIRCUITO}). ` +
    'Serve la gara in demo/ (comando "aggiorna") o un --race-json storico.');
  process.exit(EXIT.ERRORE);
}
const race = JSON.parse(fs.readFileSync(gpPath, 'utf8'));
const NOME_GARA = RACE_JSON ? race.gara : GP;  // per neutralizzazioneGara dentro evaluatePit
const byLap = {}; for (const lp of race.laps) byLap[lp.lap] = lp.cars;
const conCum = (L) => Object.keys(byLap[L] || {}).filter(d => typeof byLap[L][d].cum_time === 'number');

// finestre SC/VSC della gara (se censita in demo/neutralizzazione.json), piu' flag per-auto
const NEUTRAL = JSON.parse(fs.readFileSync(path.join(ROOT, 'demo', 'neutralizzazione.json'), 'utf8'));
function inFinestraNeutralizzata(gara, L) {
  const g = NEUTRAL[gara];
  if (!g) return false;
  const dentro = (fin) => fin.some(([a, b]) => L >= a && L <= b);
  return dentro(g.sc) || dentro(g.vsc);
}

// pit reali, con esclusioni pre-verdetto: drive-through e stop sotto SC/VSC
const casi = [], esclusi = [];
for (let L = 1; L < race.n_laps; L++) {
  for (const d of Object.keys(byLap[L] || {})) {
    const c = byLap[L][d], n = (byLap[L + 1] || {})[d];
    if (!c || !c.in_lap || !n || !n.out_lap) continue;
    const stintUguale = c.stint != null && n.stint != null && n.stint === c.stint;
    const gommaTenuta = n.compound === c.compound && n.tyre_age === c.tyre_age + 1;
    if (stintUguale || gommaTenuta) { esclusi.push(`${d} L${L} (drive-through)`); continue; }
    if (c.neutralized || n.neutralized || inFinestraNeutralizzata(NOME_GARA, L)) {
      esclusi.push(`${d} L${L} (SC/VSC)`); continue;
    }
    casi.push({ driver: d, pitLap: L });
  }
}
casi.sort((a, b) => a.pitLap - b.pitLap || (a.driver < b.driver ? -1 : 1));

// --- replica VERBATIM di stessoGiroReale da demo/pitscenario.mjs (funzione locale al
// modulo, non esportata), SOLO per la segnalazione dell'Addendum 3 (esclusi davanti).
function stessoGiroReale(byLap, L, nLaps, drv, present) {
  const leaderCumAt = {};
  for (let k=L; k<=Math.min(L+3,nLaps); k++) if (byLap[k]) {
    const o = present.filter(d=>byLap[k][d] && typeof byLap[k][d].cum_time==='number')
      .sort((a,b)=>byLap[k][a].cum_time-byLap[k][b].cum_time);
    if (o.length) leaderCumAt[k] = byLap[k][o[0]].cum_time;
  }
  const lapsDown = d => { const c=byLap[L][d].cum_time; let n=0;
    for (const k in leaderCumAt) if (+k>L && c>leaderCumAt[k]) n=+k-L; return n; };
  const mine = lapsDown(drv);
  return present.filter(d => lapsDown(d)===mine);
}

const validi = [], saltati = [], warnings = [];
for (const c of casi) {
  const L = c.pitLap - 2, Lr = c.pitLap + 1;
  if (L < 1 || !byLap[L] || !byLap[Lr]) { saltati.push(`${c.driver} L${c.pitLap}: freeze L${L} o rientro L${Lr} fuori gara`); continue; }
  const pace = race.pace[String(L)];
  if (!pace) { saltati.push(`${c.driver} L${c.pitLap}: nessun pace al freeze L${L}`); continue; }
  const realiAlRientro = conCum(Lr);
  if (!realiAlRientro.includes(c.driver)) { saltati.push(`${c.driver} L${c.pitLap}: nessun cum_time reale al rientro L${Lr}`); continue; }

  const args = (loss) => ({ byLap, nLaps: race.n_laps, pace, driver: c.driver, freezeLap: L,
                            pitLap: c.pitLap, pitLoss: loss, present: conCum(L), gara: NOME_GARA, laps: race.laps });
  const prima = evaluatePit(args(VECCHIO)), adesso = evaluatePit(args(NUOVO));
  if (!prima.ok || !adesso.ok) { saltati.push(`${c.driver} L${c.pitLap}: ${prima.reason || adesso.reason}`); continue; }

  // rango reale a fine out-lap, dai soli dati reali
  const ordReale = [...realiAlRientro].sort((a, b) => byLap[Lr][a].cum_time - byLap[Lr][b].cum_time);
  const posReale = ordReale.indexOf(c.driver) + 1;

  // segnalazione Addendum 3: esclusi dal field del motore ma davanti nel reale
  const present = conCum(L), simulabili = present.filter(d => pace[d] != null);
  const state = {}; for (const d of simulabili) state[d] = { cum_time: byLap[L][d].cum_time };
  const fin = simulate({ state, pace, freezeLap: L, steps: (c.pitLap - L) + 1,
                         pit: { driver: c.driver, lap: c.pitLap, loss: VECCHIO } });
  const campoMotore = fin[c.driver] == null ? []
    : stessoGiroReale(byLap, L, race.n_laps, c.driver, simulabili).filter(d => fin[d] != null);
  if (campoMotore.length !== prima.su_totale)
    warnings.push(`${c.driver} L${c.pitLap}: replica field ${campoMotore.length} != modulo ${prima.su_totale}`);
  const esclusiDavanti = ordReale.slice(0, posReale - 1).filter(d => !campoMotore.includes(d));

  const eP = Math.abs(prima.rientro_pos - posReale), eA = Math.abs(adesso.rientro_pos - posReale);
  validi.push({ ...c, sens: Math.abs(prima.rientro_pos - adesso.rientro_pos),
    posPrima: prima.rientro_pos, posAdesso: adesso.rientro_pos, posReale,
    nMotore: prima.su_totale, nReale: ordReale.length, eP, eA, esclusiDavanti,
    esito: eA < eP ? 'MIGLIORATO' : (eA > eP ? 'PEGGIORATO' : 'INVARIATO') });
}

console.log(`\n--- 2. SENSIBILITA (stop validi: ${validi.length}; esclusi pre-verdetto: ${esclusi.length}${esclusi.length ? ' [' + esclusi.join(', ') + ']' : ''}) ---`);
for (const s of saltati) console.log(`  saltato: ${s}`);
const nSensibili = validi.filter(v => v.sens >= 1).length;
console.log(`  sensibilita' = |pos(vecchio) - pos(nuovo)| per stop; stop con sensibilita' >= 1: ${nSensibili}`);
REPORT.sensibilita = { stop_validi: validi.length, esclusi_pre_verdetto: esclusi, saltati,
                       stop_sensibili: nSensibili, minimo: MIN_SENSIBILI };
if (nSensibili < MIN_SENSIBILI) {
  verdetto('NON GIUDICABILE', `banco insensibile (${nSensibili} stop con sensibilita' >= 1, minimo ${MIN_SENSIBILI})`);
}

// selezione deterministica: sensibilita' decrescente, poi giro crescente, poi pilota
const selezionati = [...validi]
  .sort((a, b) => b.sens - a.sens || a.pitLap - b.pitLap || (a.driver < b.driver ? -1 : 1))
  .slice(0, TOP_N);

// ============================================================ 3. TABELLA
console.log(`\n--- 3. TABELLA — top ${selezionati.length} per sensibilita' meccanica ---`);
console.log(`  PRIMA = vecchio ${VECCHIO.toFixed(2)} s   ADESSO = nuovo ${NUOVO.toFixed(2)} s   REALE = rango a fine out-lap`);
console.log(`\n  ${'caso'.padEnd(14)} ${'sens'.padEnd(5)} ${'PRIMA'.padEnd(8)} ${'ADESSO'.padEnd(8)} ${'REALE'.padEnd(8)} ${'esito'.padEnd(11)} err`);
console.log('  ' + '-'.repeat(64));
for (const r of selezionati) {
  console.log(`  ${(r.driver + ' L' + r.pitLap).padEnd(14)} ${String(r.sens).padEnd(5)} ` +
    `${('P' + r.posPrima + '/' + r.nMotore).padEnd(8)} ${('P' + r.posAdesso + '/' + r.nMotore).padEnd(8)} ` +
    `${('P' + r.posReale + '/' + r.nReale).padEnd(8)} ${r.esito.padEnd(11)} ${r.eP}->${r.eA}`);
  if (r.esclusiDavanti.length)
    console.log(`  ${' '.repeat(14)} ^ SEGNALAZIONE (Addendum 3): esclusi dal field motore ma DAVANTI nel reale: ${r.esclusiDavanti.join(',')}`);
}
if (warnings.length) { console.log('\n  *** ATTENZIONE, replica del field divergente dal modulo:'); warnings.forEach(w => console.log('    ' + w)); }
REPORT.casi = selezionati.map(r => ({ caso: `${r.driver} L${r.pitLap}`, sensibilita: r.sens,
  prima: r.posPrima, adesso: r.posAdesso, reale: r.posReale,
  n_field_motore: r.nMotore, n_field_reale: r.nReale,
  err_prima: r.eP, err_adesso: r.eA, esito: r.esito, esclusi_davanti: r.esclusiDavanti }));

// ============================================================ 4. VERDETTO
const cnt = (e) => selezionati.filter(r => r.esito === e).length;
const M = cnt('MIGLIORATO'), P = cnt('PEGGIORATO'), I = cnt('INVARIATO');
console.log(`\n  migliorati/peggiorati/invariati: ${M}/${P}/${I} su ${selezionati.length} casi`);
REPORT.conteggio = { migliorati: M, peggiorati: P, invariati: I, casi: selezionati.length };
if (P >= 1)                 verdetto('RESPINTO', `${P} caso/i peggiorato/i`);
if (M >= MIN_MIGLIORATI)    verdetto('PASSA', `${M} migliorati, 0 peggiorati`);
verdetto('NON CONCLUSIVO', `${M} migliorati (< ${MIN_MIGLIORATI}), 0 peggiorati: ne' PASSA ne' RESPINTO`);
