// ese.mjs — «E SE?»: la gara finita si RIGIOCA con una strategia diversa.
//
// COSA E' QUESTA PAGINA, detto prima di ogni numero: un CONTROFATTUALE a fisica
// misurata, non una previsione. L'utente sceglie una gara gia' corsa, un pilota,
// e cambia le sue soste; il motore vero — lo stesso trasportato in
// vendor/simulatore/motore/, con manifest di hash — rigioca la gara intera giro
// per giro. I rivali eseguono le LORO soste vere, lette dal lap chart
// d'archivio: e' INFORMAZIONE DAL FUTURO, dichiarata dal costruttore stesso con
// l'assunzione SOSTE_VERE_DEI_RIVALI, e qui e' il punto della pagina, non un
// imbroglio — a gara finita il "futuro" e' un dato registrato, e senza le soste
// vere degli altri l'arrivo simulato non significherebbe niente.
//
// QUESTO MODULO NON CALCOLA NIENTE DI FISICO (E17): traduce l'archivio nel
// contratto del simulatore (stessa strada di ponte_live.mjs), chiama il
// costruttore unico e il Director, e apparecchia i risultati. Se qui dentro
// comparisse un coefficiente, sarebbe la seconda fisica che il costruttore
// unico esiste per impedire.
//
// I LIMITI, che la pagina mostra SEMPRE (non in un details chiuso):
//  · la proiezione copre ~50 giri contro i ~6 validati della risposta — e sulla
//    gara intera e' MISURATO che il motore e il modello nullo sono
//    indistinguibili (PREREG_gara_intera_2.md). Questo e' un gioco onesto, non
//    un oracolo;
//  · i duelli non si simulano: il tetto al movimento (misurato su 5.498
//    occasioni) limita QUANTO ci si passa, mai CHI passa chi;
//  · i rivali non reagiscono alla tua strategia: fanno cio' che fecero.
//
// La sentinella s25 vieta `pianiRivali` nei percorsi di produzione perche' una
// RISPOSTA DEL MURETTO non puo' nascere dal futuro (E14). Questa pagina ha una
// DEROGA DICHIARATA e sorvegliata: s25 la esclude nominandola, e in cambio
// pretende che l'avvertenza «informazione dal futuro» sia resa all'utente.
// Revocare la deroga = togliere ese.mjs dall'elenco escluso in s25_difesa.mjs.

import { garaDaLive, contestoDa, nomeSimulatore } from './ponte_live.mjs?v=070826a';
import { ordineArrivo } from './classifica.mjs?v=090826b';
import { costruisciScenario, eseguiEValida } from './vendor/simulatore/motore/scenario/costruttore.mjs';
import { regimePerGiroDiCampo } from './vendor/simulatore/motore/provenienza/definizioni.mjs';

export const MESCOLE_EDITOR = ['SOFT', 'MEDIUM', 'HARD'];

/** L'archivio per giro nella forma {lap: {DRV: cella}} (stessa di live.html demo). */
export function byLapDa(race) {
  const byLap = {};
  for (const lp of race.laps) byLap[lp.lap] = lp.cars;
  return byLap;
}

/**
 * LE SOSTE VERE, dal lap chart: sosta = giro con `in_lap`, mescola nuova =
 * compound del giro successivo (il grezzo la aggiorna all'out-lap — verificato
 * su Australia/LEC: in-lap 25 MEDIUM, out-lap 26 HARD stint 2 eta' 1).
 * Un pilota che si ritira all'in-lap non ha un giro dopo: la mescola resta
 * null e il costruttore scartera' quella sosta DICHIARANDOLO (E05/regola 6),
 * non la inventiamo qui.
 */
export function sosteVereDa(race) {
  const byLap = race.byLap ?? byLapDa(race);
  const soste = {};
  for (let L = 1; L <= race.n_laps; L += 1) {
    for (const [drv, c] of Object.entries(byLap[L] ?? {})) {
      if (c?.in_lap !== true) continue;
      const dopo = byLap[L + 1]?.[drv];
      (soste[drv] ??= []).push({ giro: L, mescola: dopo?.compound ?? null });
    }
  }
  return soste;
}

/**
 * L'ARRIVO REALE, ricavato dal lap chart: giri completati, poi tempo. Non e'
 * la classifica ufficiale (penalita' post-gara escluse) e la targhetta lo dice.
 */
export function arrivoRealeDa(race) {
  // LA REGOLA STA IN UN POSTO SOLO (demo/classifica.mjs::ordineArrivo): era scritta qui
  // e serviva anche alla torre della pagina-gara. Il comportamento non cambia — stessa
  // chiave d'ordinamento, stesso tie-break sulla sigla — cambia solo dove vive.
  const byLap = race.byLap ?? byLapDa(race);
  return ordineArrivo((L) => byLap[L], race.n_laps)
    .map(({ drv, posizione, giri }) => ({ drv, posizione, giri }));
}

/**
 * IL CONGELAMENTO: il primo giro (da 5 in poi, come gara_intera.mjs) in cui il
 * motore ha un passo base per il pilota. Prima del 5 non esistono i 4 giri
 * verdi minimi; se non si trova entro `max`, si restituisce l'ultimo errore —
 * un rifiuto parlante, non un numero inventato (regola 6).
 */
/**
 * IL CONGELAMENTO VICINO ALLA SOSTA (08/08, per il BOX ORA): il piu' TARDI
 * possibile prima del giro scelto — cosi' la storia che l'utente ha appena
 * visto scorrere e' quella VERA fino a un giro dalla sosta, e la scena riparte
 * senza salti. Si scende da giroSosta-1 verso min finche' il motore ha un
 * passo per il pilota (stesso criterio di scegliCongelamento).
 */
export function congelamentoPer({ nome, contesto, pilota, giroSosta, min = 5 }) {
  let ultimo = null;
  for (let Lf = Math.max(min, giroSosta - 1); Lf >= min; Lf -= 1) {
    try {
      const scenario = costruisciScenario({ gara: nome, freezeLap: Lf, pilota }, { ...contesto, giroFinale: Lf + 1 });
      const { risultato } = eseguiEValida(scenario, contesto.costantiDirector);
      if (typeof risultato.cum[pilota] === 'number') return { freezeLap: Lf, motivo: null };
      ultimo = `al giro ${Lf} il pilota non ha un passo base`;
    } catch (e) { ultimo = e.message; }
  }
  return { freezeLap: null, motivo: ultimo };
}

export function scegliCongelamento({ nome, contesto, pilota, min = 5, max = 15 }) {
  let ultimo = null;
  for (let Lf = min; Lf <= max; Lf += 1) {
    try {
      // Costruire non basta: in una gara partita dietro la Safety Car (Spa) al
      // giro 5 lo scenario esiste ma il PILOTA non ha ancora quattro giri verdi
      // — e il kernel, giustamente, lo fa uscire con null (regola 6). Si prova
      // con una proiezione di UN giro e si accetta il primo congelamento in cui
      // il suo cumulato esiste: stesso criterio del laboratorio (bandiera.mjs).
      const scenario = costruisciScenario({ gara: nome, freezeLap: Lf, pilota }, { ...contesto, giroFinale: Lf + 1 });
      const { risultato } = eseguiEValida(scenario, contesto.costantiDirector);
      if (typeof risultato.cum[pilota] === 'number') return { freezeLap: Lf, motivo: null };
      ultimo = `al giro ${Lf} il pilota non ha ancora un passo base (giri verdi insufficienti)`;
    } catch (e) { ultimo = e.message; }
  }
  return { freezeLap: null, motivo: ultimo };
}

/**
 * LA GARA SI RIGIOCA. `soste` sono quelle dell'utente (solo > freezeLap:
 * quelle gia' avvenute stanno nello stato, rimetterle sarebbe fermarsi due
 * volte). `sosteRivali` sono le soste VERE di tutti gli altri.
 * Ritorna risultato del kernel (con traccia), verdetto del Director e lo
 * scenario (con le sue assunzioni, che la pagina rende SEMPRE).
 */
export function rigioca({ nome, contesto, pilota, freezeLap, soste, sosteRivali, nonClassificati = [], ritiriVeri = undefined, neutraVera = undefined }) {
  const scenario = costruisciScenario(
    // `rivaliNonClassificati`: chi nella gara vera non arrivo' (RIT/NP) non viene
    // squalificato da REG01 per un arrivo mai successo. `ritiriRivali` (07/08) fa
    // il passo intero: chi si ritiro' ESCE al suo giro vero invece di correre
    // fino alla bandiera da fantasma — misurato che i fantasmi comprimono i
    // ranghi (Canada: cambi inventati 12 contro 7 reali). Stessa natura di
    // tutto il resto: informazione dal futuro, dichiarata dal motore in run.
    // `neutralizzazioneVera` (07/08 sera): i giri che la gara vera passo' sotto
    // SC/VSC comprimono il campo col kappa misurato, e le soste cadute li' pagano
    // il fattore del regime — prima il replay li correva in verde, ed era il
    // pezzo mancante misurato dal record (GB: 6 cambi simulati contro 15 veri;
    // con le finestre vere: 16).
    { gara: nome, freezeLap, pilota, piano: soste, pianiRivali: sosteRivali,
      rivaliNonClassificati: nonClassificati, ritiriRivali: ritiriVeri,
      neutralizzazioneVera: neutraVera },
    { ...contesto, giroFinale: contesto.nGiriGara },
  );
  const { risultato, direttore } = eseguiEValida(scenario, contesto.costantiDirector);
  return { scenario, risultato, direttore };
}

/** Posizioni per giro dalla traccia del kernel (rango per cumulato, giro per giro). */
export function posizioniPerGiro(traccia) {
  const perGiro = new Map();
  for (const [drv, passi] of Object.entries(traccia ?? {})) {
    for (const p of passi ?? []) {
      if (typeof p?.cum_time !== 'number') continue;
      if (!perGiro.has(p.lap)) perGiro.set(p.lap, []);
      perGiro.get(p.lap).push({ drv, cum: p.cum_time });
    }
  }
  const posizioni = {};
  for (const [lap, righe] of perGiro) {
    righe.sort((a, b) => (a.cum - b.cum) || (a.drv < b.drv ? -1 : 1));
    posizioni[lap] = Object.fromEntries(righe.map((r, i) => [r.drv, i + 1]));
  }
  return posizioni;
}

/** Posizioni reali per giro, dal lap chart (stesso rango: cumulato). */
export function posizioniRealiPerGiro(race) {
  const byLap = race.byLap ?? byLapDa(race);
  const posizioni = {};
  for (let L = 1; L <= race.n_laps; L += 1) {
    const righe = Object.entries(byLap[L] ?? {})
      .filter(([, c]) => typeof c?.cum_time === 'number')
      .map(([drv, c]) => ({ drv, cum: c.cum_time }))
      .sort((a, b) => (a.cum - b.cum) || (a.drv < b.drv ? -1 : 1));
    if (righe.length) posizioni[L] = Object.fromEntries(righe.map((r, i) => [r.drv, i + 1]));
  }
  return posizioni;
}

/**
 * TUTTO IL NECESSARIO PER UNA GARA, montato una volta: l'archivio, la gara nel
 * contratto del simulatore, il contesto (lo STESSO montaggio di ponte_live:
 * tetto, vita mescola e orizzonte inclusi dal 07/08), le soste vere, l'arrivo.
 */
export async function preparaGara(nomeSito, { fetchJson }) {
  const [race, contestoLive, esiti] = await Promise.all([
    fetchJson(`data/${encodeURIComponent(nomeSito)}.json`),
    fetchJson('vendor/simulatore/motore/contesto_live.json'),
    fetchJson('data/esiti.json').catch(() => ({})),
  ]);
  race.byLap = byLapDa(race);
  const nome = nomeSimulatore(nomeSito);
  const gara = garaDaLive(race.byLap, race.n_laps, {
    tolleranzaCum: contestoLive?.limiti?.tolleranza_cum_s?.valore ?? null,
  });
  const { contesto } = contestoDa(contestoLive, nome, gara);
  const tipoArrivo = esiti?.[nomeSito] ?? {};
  const nonClassificati = Object.entries(tipoArrivo).filter(([, t]) => t === 'RIT' || t === 'NP').map(([d]) => d);
  // l'ultimo giro VERO di chi si ritiro': dal lap chart, per l'ingresso ritiriRivali
  const ritiriVeri = {};
  for (const drv of nonClassificati) {
    let ultimo = null;
    for (let L = 1; L <= race.n_laps; L += 1) if (race.byLap[L]?.[drv]) ultimo = L;
    if (ultimo !== null) ritiriVeri[drv] = ultimo;
  }
  return {
    race, nome, gara, contesto,
    // i giri di campo neutralizzati VERI, dalla stessa definizione unica del motore
    neutraVera: regimePerGiroDiCampo(gara.perPilota),
    sosteVere: sosteVereDa(race),
    arrivoReale: arrivoRealeDa(race),
    posizioniReali: posizioniRealiPerGiro(race),
    tipoArrivo,
    // chi non arrivo' alla bandiera nella gara vera (per il Director, dichiarato)
    nonClassificati,
    ritiriVeri,
  };
}
