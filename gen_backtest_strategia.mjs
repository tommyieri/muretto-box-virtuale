// gen_backtest_strategia.mjs — IL PANNELLO CONTRO LA GARA VERA.
//
//   node gen_backtest_strategia.mjs                    tutte le gare, tutti i piloti
//   node gen_backtest_strategia.mjs Belgio LEC         una gara, un pilota, in dettaglio
//   node gen_backtest_strategia.mjs --json             per farci sopra dei conti
//
// C'E' GIA' UN BANCO, e misura un'altra cosa. gen_backtest_motore.mjs prova il KERNEL su
// finestre VERDI e PULITE: niente soste, niente Safety Car — quanto sbaglia a propagare il
// passo. Utile, ma non e' il prodotto. Il prodotto risponde a "se lo fermo adesso, dove
// rientra", e quella domanda si fa esattamente nei momenti che quel banco esclude.
//
// Qui si rifa' la STRATEGIA VERA. Per ogni sosta realmente avvenuta si torna al giro prima,
// si chiede al pannello dove rientrera', e si guarda dove e' rientrato davvero.
//
// ------------------------------------------------------------------ COSA SI CONFRONTA
// Il motore congela il campo e simula fino a  L + (P-L) + 1 + orizzonte. Con L = P-1 e
// orizzonte 5 sono sette giri: la sua risposta riguarda il giro P+6, non il giro dopo la
// sosta. Percio' la realta' si legge LI', allo stesso giro, e fra GLI STESSI PILOTI che il
// motore aveva in mano (chi non ha passo-base al congelamento non e' nella sua classifica
// e non puo' entrare nemmeno in quella vera).
//
// ---------------------------------------------------------- LA CONTAMINAZIONE, SEPARATA
// E qui sta la parte che rende il numero leggibile invece che solo brutto.
//
// Il motore congela i rivali PER COSTRUZIONE: e' la promessa del prodotto — instrada UNA
// macchina dentro la gara reale e lascia il resto del campo dov'e'. Ma nei sette giri della
// finestra i rivali veri si fermano, escono Safety Car, qualcuno si ritira. Quando succede,
// la previsione sbaglia SENZA CHE IL MODELLO SIA SBAGLIATO: e' il mondo che si e' mosso,
// non l'aritmetica che ha toppato.
//
// Sommare i due casi produce un errore medio che non dice niente e non si sa come ridurre.
// Quindi ogni sosta viene ETICHETTATA:
//
//   PULITA        nessun rivale si e' fermato nella finestra, niente neutralizzazioni.
//                 QUI il modello e' responsabile al 100%: se sbaglia, e' colpa nostra.
//   SOSTE_RIVALI  n rivali si sono fermati nella finestra.
//   NEUTRA        SC/VSC dentro la finestra.
//   ROTTA         ritiri o dati mancanti.
//
// L'errore sulle sole PULITE e' il vero errore del modello. Tutto il resto misura quanto
// spesso il mondo si muove — che e' un fatto sul campionato, non sul codice, e si affronta
// in un altro modo (accorciare l'orizzonte, o dichiarare l'incertezza).
import fs from 'fs';
import { pannelloMuretto } from './demo/muretto.mjs';
import { evaluatePit, stessoGiroReale } from './demo/pitscenario.mjs';
import { misura as misuraSoste } from './demo/gradino.mjs';
import { deriva as calcolaDeriva, penalitaPendente } from './demo/grossi.mjs';

const D = './demo/data';
const j = p => JSON.parse(fs.readFileSync(p, 'utf8'));
const GARE = j(`${D}/manifest.json`).map(r => r.gara);
const PITLOSS = (() => { try { return j(`${D}/pitloss.json`); } catch { return {}; } })();
const CAL = (() => { try { return j(`${D}/calendario_2026.json`); } catch { return null; } })();
const NEUTRO = (() => { try { return j(`${D}/neutralizzazione_fondo.json`); } catch { return null; } })();
const RAGG = (() => { try { return j(`${D}/raggruppamento.json`); } catch { return null; } })();
const BANDE = (() => { try { return j(`${D}/climatologia_bande.json`); } catch { return null; } })();
const RCM = (() => { try { return j(`${D}/race_control_2026.json`); } catch { return null; } })();

const MIN_SOSTE_UI = 3;    // stesso valore del pannello (demo/muretto.mjs)
const ORIZZONTE = 5;

function carica(gara) {
  const r = j(`${D}/${gara}.json`);
  const byLap = {}; for (const lp of r.laps) byLap[lp.lap] = lp.cars;
  return { r, byLap, N: r.n_laps };
}

// le penalita' del pilota, nello stesso formato che il pannello riceve da gara.html
function penalitaDi(gara, drv) {
  const g = RCM?.[gara]; if (!g) return null;
  const out = [];
  for (const m of (g.messaggi || g.rcm || [])) {
    if (!m || m.sigla !== drv || !m.secondi) continue;
    out.push({ giro: m.giro, secondi: m.secondi, motivo: m.motivo || null });
  }
  return out.length ? out : null;
}

/**
 * Una sosta vera, rigiocata. Torna il confronto previsione/realta' con la sua etichetta.
 */
function rigioca(gara, byLap, N, drv, P) {
  const L = P - 1;
  if (L < 1 || !byLap[L] || !byLap[L][drv]) return { esito: 'ROTTA', perche: 'nessun dato al congelamento' };

  // --- la domanda, esattamente come la fa la pagina ---------------------------
  const present = Object.keys(byLap[L])
    .filter(d => typeof byLap[L][d].cum_time === 'number');
  const lossTab = PITLOSS[gara] ?? null;
  const viva = misuraSoste(byLap, N, L);
  const usaViva = viva.perdita != null && viva.n_perdita >= MIN_SOSTE_UI;
  const pen = penalitaPendente(penalitaDi(gara, drv), L, P);
  const lossBase = usaViva ? viva.perdita : lossTab;
  if (lossBase == null) return { esito: 'ROTTA', perche: 'nessun pit-loss disponibile' };
  const loss = lossBase + (pen.secondi || 0);
  const gradino = (viva.gradino != null && viva.n_gradino >= MIN_SOSTE_UI) ? viva.gradino : null;
  const neutroPre = !!(byLap[P]?.[drv]?.neutralized);
  const der = neutroPre ? null : calcolaDeriva(byLap, N, L);
  const derVal = (der && der.stato === 'MISURATO') ? der.valore : null;
  const orizzonte = (gradino != null && !neutroPre) ? ORIZZONTE : 0;

  const pace = (carica.cache ||= {});
  const r = evaluatePit({
    byLap, nLaps: N, pace: pacePerGiro(gara, L), driver: drv, freezeLap: L, pitLap: P,
    pitLoss: loss, present, gara, laps: byLap._laps,
    orizzonte, gradino, ZONE: 0, deriva: derVal,
  });
  if (!r.ok) return { esito: 'ROTTA', perche: r.reason };

  // --- la realta', LO STESSO GIRO e GLI STESSI PILOTI -------------------------
  const steps = (P - L) + 1 + orizzonte;
  const Lfin = L + steps;
  if (!byLap[Lfin]) return { esito: 'ROTTA', perche: `la gara finisce prima del giro ${Lfin}` };

  // l'insieme che il motore aveva in mano: stesso giro reale + passo-base al congelamento
  const pc = pacePerGiro(gara, L);
  const simulabili = present.filter(d => pc[d] != null);
  const insieme = stessoGiroReale(byLap, L, N, drv, simulabili);
  const vivi = insieme.filter(d => typeof byLap[Lfin]?.[d]?.cum_time === 'number');
  if (!vivi.includes(drv)) return { esito: 'ROTTA', perche: 'il pilota non arriva a fine finestra' };
  if (vivi.length < 4) return { esito: 'ROTTA', perche: 'meno di 4 piloti confrontabili' };

  const ordVero = vivi.slice().sort((a, b) => byLap[Lfin][a].cum_time - byLap[Lfin][b].cum_time);
  const posVera = ordVero.indexOf(drv) + 1;
  const iVero = posVera - 1;
  const davantiVero = iVero > 0 ? ordVero[iVero - 1] : null;
  const dietroVero = iVero < ordVero.length - 1 ? ordVero[iVero + 1] : null;
  const gapAvanti = davantiVero
    ? byLap[Lfin][drv].cum_time - byLap[Lfin][davantiVero].cum_time : null;
  const gapDietro = dietroVero
    ? byLap[Lfin][dietroVero].cum_time - byLap[Lfin][drv].cum_time : null;

  // LA PREVISIONE, RILETTA SULLA STESSA POPOLAZIONE DELLA REALTA'. r.rientro_pos e' contato
  // su TUTTI i simulabili al congelamento; posVera solo sui VIVI a fine finestra. Confrontarli
  // e' confrontare due classifiche con denominatori diversi: se un rivale davanti al pilota si
  // ritira nella finestra, la sua posizione vera migliora di 1 senza che il motore c'entri, e
  // quel +1 finiva addebitato al modello. Cinque delle dieci gare l'hanno trovato
  // indipendentemente (Cina, Giappone, Australia, Canada, GB). Correzione del BANCO, non del
  // prodotto: al congelamento nessuno sa chi si ritirera'. Si ri-classifica la previsione sui
  // soli piloti arrivati, poi si legge li' il rango del pilota.
  const prevViva = (r.ordine_previsto || []).filter(([d]) => vivi.includes(d));
  const prevPosViva = prevViva.findIndex(([d]) => d === drv) + 1;
  const prevPos = prevPosViva > 0 ? prevPosViva : r.rientro_pos;   // ripiego difensivo

  // --- la contaminazione ------------------------------------------------------
  // Si parte da k = L, non L+1, e si conta in_lap OPPURE out_lap: la perdita di una sosta
  // si consuma su DUE giri, e un rivale che ENTRA al giro di congelamento esce dentro la
  // finestra pagando un out-lap che il motore non gli addebita. Contando solo in_lap da L+1
  // quel rivale non risultava "fermato" e la sosta finiva etichettata PULITA mentre non lo
  // era — l'etichetta piu' importante mentiva su se stessa (trovato in Australia: SAI@11
  // valeva l'intero errore della sosta di ALB e non compariva).
  const rivaliFermati = [];
  let neutraDentro = false;
  for (let k = L; k <= Lfin; k++) {
    for (const d of insieme) {
      const c = byLap[k]?.[d];
      if (!c) continue;
      if (d !== drv && (c.in_lap || c.out_lap)) rivaliFermati.push(`${d}@${k}`);
    }
    // NEUTRALIZZAZIONE = LA MAGGIORANZA DEL CAMPO, non una macchina qualsiasi.
    // Prima bastava UN'auto con il flag per etichettare la finestra come neutralizzata: con
    // sette giri e venti macchine scattava quasi sempre, e infatti 169 soste su 290 finivano
    // li' dentro — un'etichetta che si accende sempre non separa niente. Il flag per-auto e'
    // acceso in media sul 18% dei giri, ma il campo intero e' fermo solo nell'11%: la
    // differenza sono le macchine che incrociano una bandiera gialla locale. La soglia di
    // maggioranza e' la stessa che il resto del repo usa per dire "gara neutralizzata".
    const celle = insieme.map(d => byLap[k]?.[d]).filter(Boolean);
    if (celle.length >= 6 && celle.filter(c => c.neutralized).length > celle.length / 2)
      neutraDentro = true;
  }
  // ETICHETTA A DUE ASSI, non gerarchica. Prima NEUTRA batteva SOSTE_RIVALI, ma la
  // neutralizzazione E' la ragione per cui i rivali si fermano: la gerarchia faceva assorbire
  // il secondo dal primo, e il bias del secchio NEUTRA veniva letto come "effetto della
  // bandiera" quando era quasi tutto campo-congelato. Su tutte le gare, 136 dei 146 NEUTRA
  // avevano ANCHE rivali fermi; i 10 NEUTRA PURI si comportano come i PULITA (trovato in
  // Australia, Giappone). Ora i due assi restano separati e l'etichetta dice quale.
  const esito = neutraDentro
    ? (rivaliFermati.length ? 'NEUTRA_SOSTE' : 'NEUTRA_PURA')
    : (rivaliFermati.length ? 'SOSTE_RIVALI' : 'PULITA');
  // fondo-insieme: quando la previsione e' gia' ultima (o prima), l'errore e' a UNA CODA
  // sola — il motore non puo' sbagliare mettendoti troppo avanti. 79 casi su 290, e li'
  // dentro gli errori negativi sono esattamente zero: e' saturazione, non bravura. Va
  // marcato, o le PULITE sembrano piu' precise di quanto siano (Giappone, Monaco).
  const fondoInsieme = prevPos === 1 || prevPos === prevViva.length;

  return {
    esito, gara, drv, giro_sosta: P, freeze: L, giro_verifica: Lfin, orizzonte,
    // la previsione, contata sulla stessa popolazione della realta'
    prev_pos: prevPos, prev_su: prevViva.length, prev_pos_grezza: r.rientro_pos,
    prev_davanti: r.davanti_ho, prev_gap_avanti: r.gap_ahead,
    prev_dietro: r.dietro_esco, prev_gap_dietro: r.gap_behind,
    // la realta'
    vera_pos: posVera, vera_su: ordVero.length,
    vero_davanti: davantiVero, vero_gap_avanti: gapAvanti,
    vero_dietro: dietroVero, vero_gap_dietro: gapDietro,
    // lo scarto
    errore_pos: prevPos - posVera,
    fondo_insieme: fondoInsieme,
    davanti_azzeccato: r.davanti_ho === davantiVero,
    dietro_azzeccato: r.dietro_esco === dietroVero,
    errore_gap_avanti: (r.gap_ahead != null && gapAvanti != null) ? r.gap_ahead - gapAvanti : null,
    // il contesto, che spiega
    rivali_fermati: rivaliFermati, n_rivali_fermati: rivaliFermati.length,
    sotto_neutralizzazione: r.sotto_neutralizzazione === true,
    pit_loss_usato: +loss.toFixed(2),
    pit_loss_da: usaViva ? `misurato oggi (${viva.n_perdita} soste)` : 'tabella di circuito',
    gradino_usato: gradino != null ? +gradino.toFixed(3) : null,
    mescola_tolta: byLap[P]?.[drv]?.compound ?? null,
    mescola_montata: byLap[P + 1]?.[drv]?.compound ?? null,
  };
}

// pace[L] dal JSON della gara (la stessa tabella che usa la pagina)
const _paceCache = {};
function pacePerGiro(gara, L) {
  const c = (_paceCache[gara] ||= j(`${D}/${gara}.json`).pace);
  return c[String(L)] || {};
}

// ------------------------------------------------------------------ raccolta
export function backtest(gare = GARE, filtroDrv = null) {
  const casi = [];
  for (const gara of gare) {
    const { r, byLap, N } = carica(gara);
    byLap._laps = r.laps;
    const soste = {};
    for (let L = 1; L <= N; L++)
      for (const d of Object.keys(byLap[L] || {}))
        if (byLap[L][d].in_lap) (soste[d] ||= []).push(L);
    for (const d of Object.keys(soste)) {
      if (filtroDrv && d !== filtroDrv) continue;
      for (const P of soste[d]) casi.push({ ...rigioca(gara, byLap, N, d, P), gara, drv: d, giro_sosta: P });
    }
  }
  return casi;
}

const med = v => { if (!v.length) return null; const s = [...v].sort((a, b) => a - b), m = s.length >> 1;
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; };

function _riga(v) {
  const err = v.map(c => c.errore_pos);
  return {
    n: v.length,
    errore_mediano: med(err.map(Math.abs)),
    errore_medio_con_segno: +(err.reduce((a, b) => a + b, 0) / err.length).toFixed(3),
    esatte: v.filter(c => c.errore_pos === 0).length,
    entro_1: v.filter(c => Math.abs(c.errore_pos) <= 1).length,
    davanti_azzeccato: v.filter(c => c.davanti_azzeccato).length,
    dietro_azzeccato: v.filter(c => c.dietro_azzeccato).length,
    a_fondo_insieme: v.filter(c => c.fondo_insieme).length,
  };
}

export function riassunto(casi) {
  const buoni = casi.filter(c => c.esito && c.esito !== 'ROTTA');
  const per = {};
  for (const e of ['PULITA', 'SOSTE_RIVALI', 'NEUTRA_PURA', 'NEUTRA_SOSTE']) {
    const v = buoni.filter(c => c.esito === e);
    per[e] = v.length ? _riga(v) : { n: 0 };
  }
  // la riga che misura DAVVERO il modello: campo fermo E previsione non saturata al fondo.
  const puliteVere = buoni.filter(c => c.esito === 'PULITA' && !c.fondo_insieme);
  return { totali: casi.length, valutabili: buoni.length,
           rotte: casi.filter(c => c.esito === 'ROTTA').length,
           per_esito: per,
           pulite_non_saturate: puliteVere.length ? _riga(puliteVere) : { n: 0 } };
}

// ------------------------------------------------------------------ a mano
if (import.meta.url === `file://${process.argv[1]}`) {
  const args = process.argv.slice(2).filter(a => a !== '--json');
  const json = process.argv.includes('--json');
  const gare = args[0] ? [args[0]] : GARE;
  const drv = args[1] || null;
  const casi = backtest(gare, drv);
  if (json) { console.log(JSON.stringify({ casi, riassunto: riassunto(casi) }, null, 1)); process.exit(0); }

  const R = riassunto(casi);
  console.log('='.repeat(100));
  console.log('IL PANNELLO CONTRO LA GARA VERA — ogni sosta realmente avvenuta, rigiocata');
  console.log('='.repeat(100));
  console.log(`  soste trovate: ${R.totali}   valutabili: ${R.valutabili}   non valutabili: ${R.rotte}`);
  console.log();
  const riga = (nome, v) => {
    if (!v.n) { console.log(`  ${nome.padEnd(22)} ${String(0).padStart(4)}   —`); return; }
    console.log(`  ${nome.padEnd(22)} ${String(v.n).padStart(4)} ${String(v.errore_mediano).padStart(13)} `
      + `${String(v.errore_medio_con_segno).padStart(10)} ${(v.esatte + '/' + v.n).padStart(8)} `
      + `${(v.entro_1 + '/' + v.n).padStart(8)} ${(v.davanti_azzeccato + '/' + v.n).padStart(8)} `
      + `${(v.dietro_azzeccato + '/' + v.n).padStart(8)}`);
  };
  console.log(`  ${'situazione'.padEnd(22)} ${'n'.padStart(4)} ${'|err| mediano'.padStart(13)} ${'con segno'.padStart(10)} `
    + `${'esatte'.padStart(8)} ${'entro 1'.padStart(8)} ${'davanti'.padStart(8)} ${'dietro'.padStart(8)}`);
  for (const [e, v] of Object.entries(R.per_esito)) riga(e, v);
  console.log('  ' + '-'.repeat(88));
  riga('PULITA non saturata', R.pulite_non_saturate);
  console.log('\n  PULITA NON SATURATA e l unica riga che misura NOI: campo fermo (niente rivali');
  console.log('  che si fermano, niente neutralizzazione) E previsione non incollata al fondo o');
  console.log('  alla testa dell insieme, dove l errore e a una coda sola e sembra bravura.');
  console.log('  Gli altri secchi misurano quanto spesso il mondo si muove col campo congelato.');

  if (args[0]) {
    console.log('\n' + '-'.repeat(100));
    console.log(`DETTAGLIO — ${args[0]}${drv ? ' · ' + drv : ''}`);
    console.log('-'.repeat(100));
    console.log(`  ${'pilota'.padEnd(6)} ${'sosta'.padStart(5)} ${'->'.padStart(4)} ${'prev'.padStart(5)} `
      + `${'vero'.padStart(5)} ${'err'.padStart(4)}  ${'situazione'.padEnd(14)} gomme`);
    for (const c of casi) {
      if (!c.esito || c.esito === 'ROTTA') {
        console.log(`  ${c.drv.padEnd(6)} ${String(c.giro_sosta).padStart(5)}    —  non valutabile: ${c.perche}`);
        continue;
      }
      const gm = `${(c.mescola_tolta || '?').slice(0, 3)}->${(c.mescola_montata || '?').slice(0, 3)}`;
      console.log(`  ${c.drv.padEnd(6)} ${String(c.giro_sosta).padStart(5)} ${('g' + c.giro_verifica).padStart(4)} `
        + `${('P' + c.prev_pos).padStart(5)} ${('P' + c.vera_pos).padStart(5)} `
        + `${(c.errore_pos >= 0 ? '+' : '') + c.errore_pos}`.padStart(5)
        + `  ${(c.esito + (c.n_rivali_fermati ? ` (${c.n_rivali_fermati})` : '')).padEnd(14)} ${gm}`);
    }
  }
}
