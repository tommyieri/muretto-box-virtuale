// gen_backtest_motore.mjs — IL MOTORE CONTRO IL FONDO.
//
//   node gen_backtest_motore.mjs
//
// Nessuno aveva mai messo alla prova il MOTORE contro la realta'. Il laboratorio giudica i
// propri modelli sulla propria ricostruzione dal fondo e non importa mai engine.mjs; il
// motore, dal canto suo, gira in produzione senza che nessuno abbia misurato di quanto
// sbaglia. Questo banco chiude il buco.
//
// IL KERNEL NON VIENE TOCCATO. `simulate` accetta gia' ZONE, STRENGTH, `traffico` e
// `degrado` come parametri: tutte le varianti si ottengono chiamandolo diversamente.
//
// IL METRO. Per ogni (gara, giro di congelamento, pilota) si simula una finestra di S giri e
// si confronta il TEMPO TRASCORSO previsto con quello reale (il cum_time del demo e' stato
// verificato bit-identico al sesT del fondo). L'errore si scompone in due:
//
//   BIAS COMUNE      mediana fra i piloti dell'errore -> sbaglio di passo/carburante, che
//                    sposta tutti insieme e NON cambia le posizioni;
//   ERRORE RELATIVO  errore del pilota meno il bias comune -> sbaglio sui DISTACCHI, cioe'
//                    l'unica parte che cambia una decisione di strategia.
// Un motore puo' avere un bias comune enorme ed essere comunque utile; se sbaglia il
// relativo, la strategia che propone e' sbagliata.
//
// IGIENE: la finestra entra solo se, per quel pilota, tutti i giri sono VERDI e nessuno e'
// in-lap o out-lap. Niente safety car, niente soste: il motore non le modella e non e'
// quello che stiamo misurando.
import { simulate } from './demo/engine.mjs';
import { eta0PaceBase } from './demo/pitbande.mjs';
import fs from 'fs';

// PERIMETRO E COEFFICIENTI, LETTI — non cablati. (22/07/2026)
//
// Prima erano due liste scritte a mano. Due guasti, entrambi silenziosi:
//  - le GARE erano dieci fisse: all'undicesima gara questo banco avrebbe continuato a
//    misurarne dieci, dicendo "l'errore non e' cambiato" perche' guardava lo stesso mondo;
//  - TRAFFICO_FONDO e RHO erano COPIE dei modelli vivi. I modelli si ricalibrano da soli a
//    ogni gara: le copie no. Alla prima ricalibrazione i due numeri divergevano, e il banco
//    avrebbe misurato un motore alimentato da coefficienti che nessuno usava piu'.
// Ora il perimetro viene dal registro e i coefficienti dai file dei modelli. Se un modello
// cambia, il banco lo segue; se una gara entra, il banco la misura.
const REGISTRO = JSON.parse(fs.readFileSync('./data/gare_registro.json', 'utf8'));
const GARE = Object.keys(REGISTRO).filter(
  n => fs.existsSync(`./demo/data/${n}.json`));

function leggiModello(percorso, estrai, ripiego, nome) {
  try {
    const v = estrai(JSON.parse(fs.readFileSync(percorso, 'utf8')));
    if (v == null) throw new Error('coefficiente assente');
    return { ...v, _fonte: percorso };
  } catch (e) {
    // Ripiego DICHIARATO, mai silenzioso: senza il file il banco deve poter girare, ma
    // chi legge il risultato deve sapere che sta guardando un numero di riserva.
    console.warn(`[banco] ${nome}: ${percorso} illeggibile (${e.message}) -> ripiego cablato`);
    return { ...ripiego, _fonte: 'RIPIEGO CABLATO' };
  }
}

const ORIZZONTI = [5, 10];
const PASSO_FREEZE = 3;          // ogni quanti giri si piazza un congelamento

const TRAFFICO_FONDO = leggiModello('./data/modello_traffico_2026.json',
  j => {
    const c = j.coefficienti;
    return (c && c.a != null && c.lam != null)
      ? { a: +( (c.kappa ?? 1) * c.a ).toFixed(5), lam: c.lam } : null;
  }, { a: 0.74781, lam: 0.5 }, 'traffico');

const RHO = leggiModello('./data/modello_degrado_2026.json',
  j => {
    const c = j.coefficienti;
    return (c && c.rho_SOFT != null)
      ? { SOFT: c.rho_SOFT, MEDIUM: c.rho_MEDIUM, HARD: c.rho_HARD } : null;
  }, { SOFT: 0.0541, MEDIUM: 0.0441, HARD: 0.0398 }, 'degrado');

function caricaGara(nome) {
  const r = JSON.parse(fs.readFileSync(`./demo/data/${nome}.json`, 'utf8'));
  r.byLap = {};
  for (const lp of r.laps) r.byLap[lp.lap] = lp.cars;
  return r;
}

// una finestra pulita per un pilota: tutti verdi, nessun in/out-lap
function finestraPulita(r, d, L, S) {
  for (let k = L + 1; k <= L + S; k++) {
    const c = r.byLap[k]?.[d];
    if (!c) return false;
    if (c.neutralized || c.in_lap || c.out_lap) return false;
    if (typeof c.cum_time !== 'number') return false;
  }
  const c0 = r.byLap[L]?.[d];
  return !!(c0 && typeof c0.cum_time === 'number' && !c0.neutralized);
}

function casi() {
  const out = [];
  for (const g of GARE) {
    const r = caricaGara(g);
    for (const S of ORIZZONTI) {
      for (let L = 6; L + S <= r.n_laps - 1; L += PASSO_FREEZE) {
        const pace = r.pace[String(L)];
        if (!pace) continue;
        const presenti = Object.keys(r.byLap[L] || {}).filter(
          d => pace[d] != null && finestraPulita(r, d, L, S));
        if (presenti.length < 6) continue;      // serve un gruppo, non due auto
        out.push({ gara: g, r, L, S, presenti, pace });
      }
    }
  }
  return out;
}

// costruisce gli input del motore per un caso
function inputs(c) {
  const state = {}, pace = {}, tyre = {}, comp = {};
  for (const d of c.presenti) {
    const x = c.r.byLap[c.L][d];
    state[d] = { cum_time: x.cum_time };
    pace[d] = c.pace[d];
    tyre[d] = x.tyre_age;
    comp[d] = x.compound;
  }
  return { state, pace, tyre, comp };
}

// RIPARATO 22/07/2026. Qui c'era `{ rate, age0: 0 }`: un campo che demo/engine.mjs:48 NON
// legge. Il gancio pretende `eta` (eta gomma al congelamento) ed `eta0` (eta a cui pace_base
// e' stato misurato) ed e' SICURO PER ASSENZA — se mancano, il degrado non si applica
// affatto. Risultato: questa variante misurava ZERO ESATTO, e il verdetto depositato
// ("il degrado non migliora le distanze, delta 0,000") era il kernel confrontato con se'
// stesso. eta0 viene dalla stessa funzione che usa il pannello (demo/pitbande.mjs), non da
// una copia: una formula sola.
function degradoDa(c, comp, tyre) {
  const deg = {};
  for (const d of c.presenti) {
    const st = c.r.byLap[c.L][d]?.stint;
    deg[d] = { rate: RHO[comp[d]] ?? 0, eta: tyre[d],
               eta0: eta0PaceBase(c.r.byLap, c.L, d, st) };
  }
  return deg;
}

// esegue una variante e ritorna gli errori per pilota
function valuta(c, opzioni) {
  const { state, pace, comp, tyre } = inputs(c);
  const extra = { ...opzioni };
  if (extra.degrado === 'FONDO') extra.degrado = degradoDa(c, comp, tyre);
  let paceUso = pace;
  if (extra.fuel != null) { paceUso = reinflaziona(c, pace, extra.fuel); delete extra.fuel; }
  const fine = simulate({ state, pace: paceUso, freezeLap: c.L, steps: c.S, ...extra });
  const err = [];
  for (const d of c.presenti) {
    const prev = fine[d], reale = c.r.byLap[c.L + c.S][d].cum_time;
    if (typeof prev !== 'number') continue;
    const t0 = c.r.byLap[c.L][d].cum_time;
    err.push({ drv: d, e: (prev - t0) - (reale - t0) });   // errore sul TEMPO TRASCORSO
  }
  return err;
}

const mediana = v => {
  if (!v.length) return null;
  const s = [...v].sort((a, b) => a - b), m = s.length >> 1;
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};

// bootstrap sui BLOCCHI (le gare), mai sulle osservazioni
function bootBlocchi(perGara, repliche = 2000, seed = 20260721) {
  const gare = Object.keys(perGara);
  if (gare.length < 2) return null;
  let s = seed;
  const rnd = () => (s = (s * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff;
  const med = [];
  for (let i = 0; i < repliche; i++) {
    const camp = [];
    for (let j = 0; j < gare.length; j++) camp.push(perGara[gare[Math.floor(rnd() * gare.length)]]);
    med.push(mediana(camp));
  }
  med.sort((a, b) => a - b);
  return [med[Math.floor(0.025 * repliche)], med[Math.floor(0.975 * repliche)]];
}

// Il carburante: `pace_base` sottrae il peso -> il passo e' a SERBATOIO VUOTO. `simulate`
// non lo ri-aggiunge mai, quindi simula tutti piu' veloci di quanto vadano davvero. Qui lo
// ri-aggiungo COME INPUT (media sulla finestra), per due coefficienti: quello del kernel
// (3,0 s su 70 kg, tarato sull'era vecchia) e quello misurato sul 2026 (2,1939).
function reinflaziona(c, pace, totale) {
  const N = c.r.n_laps, fpl = 70.0 / N, coeff = totale / 70.0;
  let somma = 0;
  for (let k = c.L; k < c.L + c.S; k++) somma += Math.max(0, 70.0 - fpl * (k - 1)) * coeff;
  const medio = somma / c.S;
  const out = {};
  for (const d of Object.keys(pace)) out[d] = pace[d] + medio;
  return out;
}

const VARIANTI = {
  'A kernel com e (ZONE 1.5, STRENGTH 1.0)': {},
  'B traffico SPENTO (nessuna interazione)': { ZONE: 0 },
  'C traffico del FONDO (a=0.748, lam=0.5)': { traffico: TRAFFICO_FONDO },
  'D fondo traffico + degrado': { traffico: TRAFFICO_FONDO, degrado: 'FONDO' },
  'E kernel + degrado': { degrado: 'FONDO' },
  'F kernel + carburante ri-aggiunto (3,0 kernel)': { fuel: 3.0 },
  'G kernel + carburante ri-aggiunto (2,1939 fondo 2026)': { fuel: 2.1939 },
  'H fondo pieno: carb 2026 + traffico fondo + degrado':
      { fuel: 2.1939, traffico: TRAFFICO_FONDO, degrado: 'FONDO' },
};

function main() {
  const C = casi();
  console.log('='.repeat(96));
  console.log('IL MOTORE CONTRO IL FONDO — backtest su finestre pulite (verde, senza soste)');
  console.log('='.repeat(96));
  console.log(`  casi: ${C.length}  (gara x giro di congelamento x orizzonte)`);
  const perOriz = {};
  for (const c of C) perOriz[c.S] = (perOriz[c.S] || 0) + 1;
  console.log(`  per orizzonte: ${JSON.stringify(perOriz)}`);
  console.log(`  piloti per caso (mediana): ${mediana(C.map(c => c.presenti.length))}`);

  const risultati = {};
  for (const S of ORIZZONTI) {
    console.log(`\n${'-'.repeat(96)}\n  ORIZZONTE ${S} GIRI\n${'-'.repeat(96)}`);
    console.log(`  ${'variante'.padEnd(42)} ${'|err relativo|'.padStart(14)} ${'IC95 blocchi'.padStart(20)} ${'bias comune'.padStart(12)}`);
    for (const [nome, opz] of Object.entries(VARIANTI)) {
      const relPerGara = {}, biasPerGara = {};
      for (const c of C.filter(x => x.S === S)) {
        const err = valuta(c, opz);
        if (err.length < 6) continue;
        const bias = mediana(err.map(x => x.e));
        const rel = err.map(x => Math.abs(x.e - bias));
        (relPerGara[c.gara] ||= []).push(mediana(rel));
        (biasPerGara[c.gara] ||= []).push(bias);
      }
      const relG = {}, biasG = {};
      for (const g of Object.keys(relPerGara)) { relG[g] = mediana(relPerGara[g]); biasG[g] = mediana(biasPerGara[g]); }
      const rel = mediana(Object.values(relG)), bias = mediana(Object.values(biasG));
      const ci = bootBlocchi(relG);
      console.log(`  ${nome.padEnd(42)} ${rel.toFixed(4).padStart(14)} ` +
                  `${('[' + ci[0].toFixed(3) + ', ' + ci[1].toFixed(3) + ']').padStart(20)} ` +
                  `${bias.toFixed(4).padStart(12)}`);
      risultati[`S${S}|${nome}`] = { rel, ci, bias, per_gara: relG };
    }
  }
  fs.writeFileSync('./data/backtest_motore.json', JSON.stringify(risultati, null, 1) + '\n');
  console.log('\n[scritto] data/backtest_motore.json');
  memoria(risultati);
}

// --------------------------------------------------------------------- LA MEMORIA
// Senza questo, «il modello si migliora da solo» resta una promessa non verificabile: i
// golden rilevano un CAMBIAMENTO, non un PEGGIORAMENTO, e un motore che sbaglia sempre
// allo stesso modo li passa per sempre.
//
// Qui si tiene una riga per esecuzione: quante gare c'erano sotto, e quanto sbagliava il
// motore com'e' (variante A, quella in produzione). La regola d'allarme e' DICHIARATA
// PRIMA, non scelta guardando i numeri: se l'errore relativo esce SOPRA il limite alto
// dell'IC95 della volta precedente, per DUE esecuzioni di fila, si alza una bandiera.
// Due di fila perche' una gara strana capita; due no.
const SOGLIA_ALLARMI = 2;

function memoria(risultati) {
  const F = './data/errore_motore_storico.json';
  let storia = [];
  try { storia = JSON.parse(fs.readFileSync(F, 'utf8')); } catch (_) { storia = []; }
  const A5 = risultati['S5|A kernel com e (ZONE 1.5, STRENGTH 1.0)'];
  const A10 = risultati['S10|A kernel com e (ZONE 1.5, STRENGTH 1.0)'];
  if (!A5 || !A10) return;
  const voce = {
    gare: GARE.length,
    gare_elenco: GARE,
    s5: { rel: +A5.rel.toFixed(4), ci: A5.ci.map(x => +x.toFixed(3)), bias: +A5.bias.toFixed(4) },
    s10: { rel: +A10.rel.toFixed(4), ci: A10.ci.map(x => +x.toFixed(3)), bias: +A10.bias.toFixed(4) },
    traffico_fonte: TRAFFICO_FONDO._fonte, degrado_fonte: RHO._fonte,
  };
  const prec = storia.length ? storia[storia.length - 1] : null;
  // idempotenza: stesso perimetro e stessi numeri -> non si allunga la storia
  if (prec && prec.gare === voce.gare && prec.s5.rel === voce.s5.rel
      && prec.s10.rel === voce.s10.rel) {
    console.log('[memoria] nulla di nuovo: la storia non si allunga');
    return;
  }
  voce.peggiorato = !!(prec && voce.s5.rel > prec.s5.ci[1]);
  const consecutivi = voce.peggiorato ? ((prec && prec.consecutivi) || 0) + 1 : 0;
  voce.consecutivi = consecutivi;
  voce.bandiera = consecutivi >= SOGLIA_ALLARMI;
  storia.push(voce);
  fs.writeFileSync(F, JSON.stringify(storia, null, 1) + '\n');
  console.log(`[memoria] ${F}: ${storia.length} voci, ${voce.gare} gare, `
    + `err5 ${voce.s5.rel}` + (prec ? ` (prima ${prec.s5.rel})` : ''));
  if (voce.bandiera) {
    console.log('*** BANDIERA: l errore del motore peggiora da '
      + `${consecutivi} esecuzioni di fila. Non e' una gara strana. ***`);
  }
}

main();
