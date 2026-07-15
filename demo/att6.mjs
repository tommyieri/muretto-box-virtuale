// att6.mjs — ATT6 v2, strumento unico (PREREG_SESSIONE_ATT6_V2.md, ADDENDUM 4).
//
// Uso:  node demo/att6.mjs <CIRCUITO> <ANNO> <PIT_LOSS_CANDIDATO>
//   es. node demo/att6.mjs silverstone 2026 20.80
//
// PRODUCE UN REPORT, NON APPLICA NULLA. Nessun valore di produzione viene toccato.
// Non c'e' exit-code decisionale, non c'e' file di gate, non c'e' un secondo script:
// la decisione e' umana, al checkpoint del merge (ADDENDUM 4).
//
// Tre output, nell'ordine:
//   1. Tipicita'  — unico gate automatico (soglia 2,0 s), da data/engine_ready_stops.csv
//   2. Tabella    — tutti i pit reali della gara demo, con flag SENSIBILE
//   3. Sintesi    — tre righe + data/att6_<CIRCUITO>_<ANNO>.json
//
// Lo strumento LEGGE demo/pitscenario.mjs, non lo modifica. att6_montreal.mjs resta
// intatto come reperto v1: questo script ne generalizza il pattern.
import { evaluatePit } from './pitscenario.mjs';
import { simulate } from './engine.mjs';
import fs from 'fs';
import path from 'path';

const ROOT = path.resolve(new URL('.', import.meta.url).pathname, '..');

// --- costanti pre-registrate (ADDENDUM 4) -----------------------------------
const SOGLIA_TIPICITA = 2.0;   // |loss gara - mediana grappolo| <= 2,0 -> GIUDICABILE
const ZONA_SENSIBILE  = 5.0;   // >=2 auto entro +-5,0 s al rientro reale
const MIN_AUTO_VICINE = 2;
const GRAPPOLO = [2018, 2025]; // grappolo storico, estremi inclusi

// mappatura circuito (cid del censimento) -> nome gara in demo/data/
const CID_TO_GP = {
  'montreal': 'Canada', 'silverstone': 'Gran Bretagna', 'spielberg': 'Austria',
  'catalunya': 'Spagna', 'melbourne': 'Australia', 'shanghai': 'Cina',
  'suzuka': 'Giappone', 'miami': 'Miami', 'monaco': 'Monaco',
  'spa-francorchamps': 'Belgio', 'austin': 'Stati Uniti',
};

const [CIRCUITO, ANNO_S, CAND_S] = process.argv.slice(2);
if (!CIRCUITO || !ANNO_S || !CAND_S) {
  console.error('Uso: node demo/att6.mjs <CIRCUITO> <ANNO> <PIT_LOSS_CANDIDATO>');
  process.exit(2);
}
const ANNO = parseInt(ANNO_S, 10), CANDIDATO = parseFloat(CAND_S);

const mediana = (a) => {
  if (!a.length) return NaN;
  const s = [...a].sort((x, y) => x - y), m = s.length >> 1;
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};

// ============================================================ 1. TIPICITA'
// Fonti per-stop, in ordine di preferenza: il file FF5 (9 circuiti demo) se esiste,
// altrimenti quello FF4 (4 circuiti). Stesso metodo (giro intero), stesso generatore a
// monte: per i circuiti coperti da entrambi le mediane coincidono (verificato al commit).
const FONTI = ['pergara_stops.csv', 'engine_ready_stops.csv'];
function leggiStopsDa(nome) {
  const p = path.join(ROOT, 'data', nome);
  if (!fs.existsSync(p)) return null;
  const [head, ...righe] = fs.readFileSync(p, 'utf8').trim().split('\n');
  const col = head.split(',');
  return righe.map(r => Object.fromEntries(r.split(',').map((v, i) => [col[i], v])));
}
let stops = null, fonteUsata = null;
for (const f of FONTI) {
  const tutti = leggiStopsDa(f);
  if (tutti && tutti.some(s => s.circuito === CIRCUITO)) {
    stops = tutti.filter(s => s.circuito === CIRCUITO); fonteUsata = f; break;
  }
}
if (!stops) {
  console.error(`ERRORE: nessuno stop per il circuito "${CIRCUITO}" nelle fonti ${FONTI.join(', ')}.`);
  process.exit(2);
}

const gara = stops.filter(s => +s.stagione === ANNO);
if (!gara.length) {
  console.error(`ERRORE: nessuno stop per ${CIRCUITO} ${ANNO} in engine_ready_stops.csv.`);
  process.exit(2);
}
// condizione della gara: se e' wet, non e' un caso previsto -> decisione umana
const condizioni = [...new Set(gara.map(s => s.condizione))];
const garaDry = gara.filter(s => s.condizione === 'DRY');
if (!garaDry.length) {
  console.log(`\nGara ${CIRCUITO} ${ANNO}: condizione = ${condizioni.join('/')} — NON DRY.`);
  console.log('Caso non previsto dalla pre-registrazione (il parametro di produzione e il dry).');
  console.log('Nessun verdetto automatico: decisione umana.');
  process.exit(0);
}

// mediana per-gara (blocco), poi mediana delle mediane sul grappolo 2018-2025
function medianePerGara(righe) {
  const perGara = {};
  for (const s of righe) (perGara[s.gara] ||= []).push(parseFloat(s.pit_loss));
  return Object.entries(perGara).map(([g, v]) => [g, mediana(v)]);
}
function medianeTransitoPerGara(righe) {
  const perGara = {};
  for (const s of righe) (perGara[s.gara] ||= []).push(parseFloat(s.pit_lane_time));
  return Object.entries(perGara).map(([g, v]) => [g, mediana(v)]);
}

const grappoloRighe = stops.filter(s => s.condizione === 'DRY'
  && +s.stagione >= GRAPPOLO[0] && +s.stagione <= GRAPPOLO[1]);
const blocchi = medianePerGara(grappoloRighe);
const lossGara = mediana(garaDry.map(s => parseFloat(s.pit_loss)));
const lossGrappolo = mediana(blocchi.map(([, m]) => m));
const scarto = Math.abs(lossGara - lossGrappolo);
const GIUDICABILE = scarto <= SOGLIA_TIPICITA;

// riga informativa (NON gate, ADDENDUM 4): delta transito
const transitoGara = mediana(garaDry.map(s => parseFloat(s.pit_lane_time)));
const transitoGrappolo = mediana(medianeTransitoPerGara(grappoloRighe).map(([, m]) => m));
const dTransito = transitoGara - transitoGrappolo;

console.log(`\n${'='.repeat(84)}`);
console.log(`ATT6 v2 — ${CIRCUITO} ${ANNO} — candidato ${CANDIDATO.toFixed(2)} s`);
console.log('='.repeat(84));
console.log(`\n--- 1. TIPICITA (soglia 2,0 s; fonte: data/${fonteUsata}) ---`);
console.log(`  loss mediano gara   (engine-ready, dry, n=${garaDry.length}) = ${lossGara.toFixed(2)} s`);
console.log(`  mediana grappolo    (${GRAPPOLO[0]}-${GRAPPOLO[1]}, dry, ${blocchi.length} blocchi) = ${lossGrappolo.toFixed(2)} s`);
console.log(`     blocchi: ${blocchi.map(([g, m]) => `${g}=${m.toFixed(2)}`).join('  ')}`);
console.log(`  scarto = ${scarto.toFixed(2)} s  ->  ${GIUDICABILE ? 'GIUDICABILE' : 'NON GIUDICABILE'}`);
console.log(`  [informativo, non gate] transito mediano gara ${transitoGara.toFixed(2)} vs grappolo ` +
            `${transitoGrappolo.toFixed(2)} -> delta ${dTransito >= 0 ? '+' : ''}${dTransito.toFixed(2)} s`);
if (!GIUDICABILE) {
  console.log('\n  NON GIUDICABILE: ne attivazione ne rollback. Il candidato aspetta la prossima gara.');
  console.log('  La tabella qui sotto e comunque informativa.');
}

// ============================================================ 2. TABELLA
const GP = CID_TO_GP[CIRCUITO];
const gpPath = GP ? path.join(ROOT, 'demo', 'data', `${GP}.json`) : null;
if (!GP || !fs.existsSync(gpPath)) {
  console.log(`\n--- 2. TABELLA ---`);
  console.log(`  Gara demo assente per "${CIRCUITO}"${GP ? ` (atteso demo/data/${GP}.json)` : ' (nessuna mappatura)'}.`);
  console.log('  La tabella non e calcolabile: serve la gara in demo/ (comando "aggiorna").');
  console.log(`\n--- 3. SINTESI ---`);
  console.log(`Tipicita': ${GIUDICABILE ? 'GIUDICABILE' : 'NON GIUDICABILE'} (scarto ${scarto.toFixed(2)} s)`);
  console.log(`Casi: 0 totali, 0 sensibili — migliorati/peggiorati/invariati: 0/0/0 (sensibili: 0/0/0)`);
  console.log(`Esito: ${GIUDICABILE ? 'GARA DEMO ASSENTE — tabella non calcolabile' : 'NON GIUDICABILE'}`);
  process.exit(0);
}

const race = JSON.parse(fs.readFileSync(gpPath, 'utf8'));
const byLap = {}; for (const lp of race.laps) byLap[lp.lap] = lp.cars;
const conCum = (L) => Object.keys(byLap[L] || {}).filter(d => typeof byLap[L][d].cum_time === 'number');
const PROD = JSON.parse(fs.readFileSync(path.join(ROOT, 'demo', 'data', 'pitloss.json'), 'utf8'))[GP];
if (PROD == null) { console.error(`ERRORE: nessun pit-loss di produzione per "${GP}".`); process.exit(2); }

// --- copia VERBATIM di stessoGiroReale da demo/pitscenario.mjs (funzione locale al modulo,
// non esportata). Serve SOLO a ispezionare il field del motore per la segnalazione
// dell'ADDENDUM 3. La copia e' verificata a ogni caso contro evaluatePit (vedi CHECK sotto):
// se dovesse divergere, lo strumento lo stampa invece di mentire.
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

// --- pit reali della gara, drive-through esclusi -----------------------------
// Drive-through = la gomma NON si azzera attraverso il transito: stesso compound e
// tyre_age che continua a incrementare (o stint invariato). Stesso rilevatore del
// censimento FF3. Uno stop vero azzera tyre_age (anche su set usato: es. 13 -> 4).
const casi = [], driveThrough = [];
for (let L = 1; L < race.n_laps; L++) {
  for (const d of Object.keys(byLap[L] || {})) {
    const c = byLap[L][d], n = (byLap[L + 1] || {})[d];
    if (!c || !c.in_lap || !n || !n.out_lap) continue;
    const stintUguale = c.stint != null && n.stint != null && n.stint === c.stint;
    const gommaTenuta = n.compound === c.compound && n.tyre_age === c.tyre_age + 1;
    if (stintUguale || gommaTenuta) { driveThrough.push(`${d} L${L}`); continue; }
    casi.push({ driver: d, pitLap: L });
  }
}
casi.sort((a, b) => a.pitLap - b.pitLap || (a.driver < b.driver ? -1 : 1));

// --- valutazione ------------------------------------------------------------
const righe = [];
let warnings = [];
for (const c of casi) {
  const L = c.pitLap - 2, Lr = c.pitLap + 1;
  if (L < 1 || !byLap[L] || !byLap[Lr]) {
    righe.push({ ...c, saltato: `freeze L${L} o rientro L${Lr} fuori gara` }); continue;
  }
  const pace = race.pace[String(L)];
  if (!pace) { righe.push({ ...c, saltato: `nessun pace al freeze L${L}` }); continue; }

  // SENSIBILE: dai SOLI dati reali, al giro di rientro
  const realiAlRientro = conCum(Lr);
  if (!realiAlRientro.includes(c.driver)) {
    righe.push({ ...c, saltato: `nessun cum_time reale al rientro L${Lr}` }); continue;
  }
  const mioCum = byLap[Lr][c.driver].cum_time;
  const vicine = realiAlRientro.filter(d => d !== c.driver
    && Math.abs(byLap[Lr][d].cum_time - mioCum) <= ZONA_SENSIBILE)
    .map(d => ({ d, gap: +(byLap[Lr][d].cum_time - mioCum).toFixed(2) }))
    .sort((a, b) => Math.abs(a.gap) - Math.abs(b.gap));
  const sensibile = vicine.length >= MIN_AUTO_VICINE;

  // field del motore (replica) + CHECK contro evaluatePit
  const present = conCum(L);
  const simulabili = present.filter(d => pace[d] != null);
  const state = {}; for (const d of simulabili) state[d] = { cum_time: byLap[L][d].cum_time };
  const steps = (c.pitLap - L) + 1;
  const fin = simulate({ state, pace, freezeLap: L, steps, pit: { driver: c.driver, lap: c.pitLap, loss: PROD } });
  const campoMotore = fin[c.driver] == null ? []
    : stessoGiroReale(byLap, L, race.n_laps, c.driver, simulabili).filter(d => fin[d] != null);

  const args = (loss) => ({ byLap, nLaps: race.n_laps, pace, driver: c.driver, freezeLap: L,
                            pitLap: c.pitLap, pitLoss: loss, present, gara: GP, laps: race.laps });
  const prima = evaluatePit(args(PROD)), adesso = evaluatePit(args(CANDIDATO));
  if (!prima.ok || !adesso.ok) {
    righe.push({ ...c, saltato: prima.reason || adesso.reason }); continue;
  }
  // CHECK: la replica del field combacia con il modulo? Altrimenti lo dico.
  if (campoMotore.length !== prima.su_totale) {
    warnings.push(`${c.driver} L${c.pitLap}: replica field ${campoMotore.length} != modulo ${prima.su_totale}`);
  }

  const ordReale = [...realiAlRientro].sort((a, b) => byLap[Lr][a].cum_time - byLap[Lr][b].cum_time);
  const posReale = ordReale.indexOf(c.driver) + 1;
  // ADDENDUM 3: segnala se un escluso dal field del motore era DAVANTI al pilota
  const esclusiDavanti = ordReale.slice(0, posReale - 1).filter(d => !campoMotore.includes(d));

  const eP = Math.abs(prima.rientro_pos - posReale), eA = Math.abs(adesso.rientro_pos - posReale);
  righe.push({ ...c, sensibile, vicine, campoMotore, nMotore: prima.su_totale, nReale: ordReale.length,
               posPrima: prima.rientro_pos, posAdesso: adesso.rientro_pos, posReale, eP, eA,
               esclusiDavanti, esito: eA < eP ? 'MIGLIORATO' : (eA > eP ? 'PEGGIORATO' : 'INVARIATO') });
}

console.log(`\n--- 2. TABELLA — ${casi.length} pit reali (drive-through esclusi: ${driveThrough.length}${driveThrough.length ? ' [' + driveThrough.join(', ') + ']' : ''}) ---`);
console.log(`  PRIMA = produzione ${PROD.toFixed(2)} s   ADESSO = candidato ${CANDIDATO.toFixed(2)} s   REALE = rango a fine out-lap`);
console.log(`\n  ${'caso'.padEnd(16)} ${'sens?'.padEnd(6)} ${'PRIMA'.padEnd(8)} ${'ADESSO'.padEnd(8)} ${'REALE'.padEnd(8)} ${'esito'.padEnd(11)} err`);
console.log('  ' + '-'.repeat(76));
for (const r of righe) {
  const caso = `${r.driver} L${r.pitLap}`.padEnd(16);
  if (r.saltato) { console.log(`  ${caso} ${'-'.padEnd(6)} ${('SALTATO: ' + r.saltato)}`); continue; }
  console.log(`  ${caso} ${(r.sensibile ? 'SI' : 'no').padEnd(6)} ` +
    `${('P' + r.posPrima + '/' + r.nMotore).padEnd(8)} ${('P' + r.posAdesso + '/' + r.nMotore).padEnd(8)} ` +
    `${('P' + r.posReale + '/' + r.nReale).padEnd(8)} ${r.esito.padEnd(11)} ${r.eP}->${r.eA}` +
    (r.sensibile ? `   [${r.vicine.length} auto entro ${ZONA_SENSIBILE}s: ${r.vicine.slice(0, 3).map(v => `${v.d}${v.gap >= 0 ? '+' : ''}${v.gap}`).join(' ')}]` : ''));
  if (r.esclusiDavanti.length)
    console.log(`  ${' '.repeat(16)} ^ SEGNALAZIONE (Addendum 3): esclusi dal field motore ma DAVANTI nel reale: ${r.esclusiDavanti.join(',')}`);
}
if (warnings.length) { console.log('\n  *** ATTENZIONE, replica del field divergente dal modulo:'); warnings.forEach(w => console.log('    ' + w)); }

// ============================================================ 3. SINTESI
const val = righe.filter(r => !r.saltato);
const sens = val.filter(r => r.sensibile);
const cnt = (a, e) => a.filter(r => r.esito === e).length;
const peggioratiSensibili = sens.filter(r => r.esito === 'PEGGIORATO');

let esito;
if (!GIUDICABILE) esito = 'NON GIUDICABILE';
else if (peggioratiSensibili.length) esito = 'ATTENZIONE: caso sensibile peggiorato — richiede spiegazione prima di attivare';
else esito = 'NESSUN PEGGIORAMENTO SENSIBILE — attivazione al checkpoint umano';

const r1 = `Tipicita': ${GIUDICABILE ? 'GIUDICABILE' : 'NON GIUDICABILE'} (scarto ${scarto.toFixed(2)} s)`;
const r2 = `Casi: ${val.length} totali, ${sens.length} sensibili — migliorati/peggiorati/invariati: ` +
  `${cnt(val, 'MIGLIORATO')}/${cnt(val, 'PEGGIORATO')}/${cnt(val, 'INVARIATO')} ` +
  `(sensibili: ${cnt(sens, 'MIGLIORATO')}/${cnt(sens, 'PEGGIORATO')}/${cnt(sens, 'INVARIATO')})`;
const r3 = `Esito: ${esito}`;
console.log(`\n--- 3. SINTESI ---\n${r1}\n${r2}\n${r3}`);
if (peggioratiSensibili.length)
  console.log(`  casi sensibili peggiorati da spiegare: ${peggioratiSensibili.map(r => `${r.driver} L${r.pitLap} (err ${r.eP}->${r.eA})`).join(', ')}`);

const out = {
  circuito: CIRCUITO, anno: ANNO, candidato: CANDIDATO, produzione: PROD, gara_demo: GP,
  tipicita: { loss_gara: +lossGara.toFixed(4), mediana_grappolo: +lossGrappolo.toFixed(4),
              scarto: +scarto.toFixed(4), soglia: SOGLIA_TIPICITA, esito: GIUDICABILE ? 'GIUDICABILE' : 'NON GIUDICABILE',
              blocchi_grappolo: Object.fromEntries(blocchi.map(([g, m]) => [g, +m.toFixed(4)])),
              transito_gara: +transitoGara.toFixed(4), transito_grappolo: +transitoGrappolo.toFixed(4),
              delta_transito_informativo: +dTransito.toFixed(4) },
  drive_through_esclusi: driveThrough,
  casi: righe.map(r => r.saltato ? { caso: `${r.driver} L${r.pitLap}`, saltato: r.saltato }
    : { caso: `${r.driver} L${r.pitLap}`, sensibile: r.sensibile, auto_vicine: r.vicine,
        prima: r.posPrima, adesso: r.posAdesso, reale: r.posReale,
        n_field_motore: r.nMotore, n_field_reale: r.nReale,
        err_prima: r.eP, err_adesso: r.eA, esito: r.esito,
        esclusi_davanti: r.esclusiDavanti }),
  sintesi: { tipicita: r1, casi: r2, esito: r3 },
};
const outPath = path.join(ROOT, 'data', `att6_${CIRCUITO}_${ANNO}.json`);
fs.writeFileSync(outPath, JSON.stringify(out, null, 2));
console.log(`\n[scritto] data/att6_${CIRCUITO}_${ANNO}.json`);
console.log('Questo e un REPORT: non applica nulla. La decisione e umana, al checkpoint del merge.\n');
