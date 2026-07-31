// risposta.mjs — la RISPOSTA a «se fermo questo pilota adesso»: un record solo,
// montato in un posto solo.
//
// PERCHE' STA QUI E NON DENTRO IL GENERATORE DELLA VISTA. Questo record lo
// producono DUE strade: il pre-calcolo in Node per gara.html, e il pannello LIVE
// che esegue il motore nel browser. Se ognuna se lo montasse per conto suo,
// replay e diretta risponderebbero con due assemblaggi diversi degli stessi
// numeri — E17 nella sua forma piu' subdola, perche' i due sarebbero uguali il
// giorno in cui li scrivi e diversi il primo giorno che ne tocchi uno.
//
// Montandolo qui, la parita' fra diretta e replay diventa STRUTTURALE e non una
// coincidenza da verificare a mano. Il banco la misura lo stesso (il cancello di
// parita' confronta i due percorsi su gare vere): una proprieta' garantita per
// costruzione va comunque provata, perche' la garanzia sta in questa frase e le
// frasi non falliscono da sole.
//
// PURO: nessun accesso al disco. Contesto e costanti arrivano dal chiamante —
// in Node letti dal disco, in pagina dal `contesto_live.json` trasportato.
import { MESCOLE_SLICK, simboliStatus } from '../provenienza/vocabolario.mjs';
import { regimeNeutralizzato } from '../provenienza/definizioni.mjs';
import { doveRientri, curvaDelQuando } from './costruttore.mjs';
import { pianoOttimo } from './piano.mjs';
import { allarmiPiano } from './allarmi.mjs';

/** La mescola su cui il pilota sta girando al congelamento, o null. */
export function mescolaAlGiro(gara, Lf, pilota) {
  const c = gara.perPilota.get(pilota)?.get(Lf);
  return c && MESCOLE_SLICK.has(c.compound) ? c.compound : null;
}

/** Il regime al congelamento: 'SC', 'VSC' o null. */
export function regimeAlGiro(gara, Lf, pilota) {
  const c = gara.perPilota.get(pilota)?.get(Lf);
  if (!c || c.status === null || !regimeNeutralizzato(c)) return null;
  return simboliStatus(c.status).has('4') ? 'SC' : 'VSC';
}

/**
 * Un record per (pilota, giro): la risposta, la curva, il piano.
 *
 * @param contesto `{ gare, modello, prior, costantiDirector, bandaRientro, nGiriGara }`
 * @param extra    `{ prior, durate2026, esitoPiano }`
 * @param data     la data della targhetta. E' un INGRESSO e non `new Date()`
 *                 qui dentro: due percorsi che montano lo stesso record devono
 *                 poter produrre lo stesso record, e un orologio interno lo
 *                 renderebbe diverso per costruzione.
 * @returns il record, oppure `null` se al congelamento la gomma non e' nota
 *          (non si finge una mescola), oppure `{freeze_lap, senza_risposta}`.
 */
export function rispostaPer(nomeGara, gara, Lf, pilota, contesto, extra, data) {
  const mescola = mescolaAlGiro(gara, Lf, pilota);
  if (mescola === null) return null;               // gomma ignota o da bagnato: non si finge
  const giroPit = Lf + 1;
  let rientro;
  try {
    rientro = doveRientri({ gara: nomeGara, freezeLap: Lf, pilota, giroPit, mescola }, contesto);
  } catch (e) {
    return { freeze_lap: Lf, senza_risposta: e.message };
  }
  // UN RIFIUTO DEL DIRECTOR E' UNA RISPOSTA, e va mostrata. Il componente `pannello` ha
  // il suo ramo apposta: niente numeri, solo i motivi (regola 6). Trattarlo come
  // "nessuna risposta" avrebbe nascosto all'utente proprio il caso in cui il guardiano
  // runtime ha fermato qualcosa — che e' l'informazione piu' utile che ci sia.
  if (rientro && rientro.approvato === false) {
    return {
      freeze_lap: Lf, _data: data, gara: nomeGara, pilota, n_giri: gara.nGiri,
      approvato: false,
      motivi_rifiuto: (rientro.direttore?.violazioni ?? [])
        .filter((v) => v.severita === 'FATAL')
        .map((v) => v.messaggio ?? v.codice),
    };
  }
  if (!rientro || rientro.posizione === null || rientro.posizione === undefined) {
    return { freeze_lap: Lf, senza_risposta: 'il motore non ha una risposta a questo giro' };
  }
  const curva = curvaDelQuando({ gara: nomeGara, freezeLap: Lf, pilota, mescola }, contesto);
  const ottimo = pianoOttimo(
    { gara: nomeGara, freezeLap: Lf, pilota, giroFinale: gara.nGiri, kMax: 3 }, contesto);

  // IL FANTASMA, e solo lui: la proiezione del pilota instradato giro per giro. Il reale
  // sta gia' in demo/data/<gara>.json e non si duplica.
  const fantasma = [];
  for (const [drv, passi] of Object.entries(rientro.traccia ?? {})) {
    for (const p of passi ?? []) {
      fantasma.push({ drv, giro: p.lap, cum: Number(p.cum_time.toFixed(3)),
                      ...(p.in_lap ? { in_box: true } : {}),
                      ...(p.out_lap ? { fuori_box: true } : {}) });
    }
  }

  return {
    freeze_lap: Lf,
    // i tre campi che i componenti leggono da `s` e che il costruttore non mette: senza,
    // `pannello` costruirebbe targhette senza data e la mappa non avrebbe i riferimenti
    // dello stazionario. Meglio due numeri ripetuti che un componente che si arrangia.
    _data: data,
    // `pannello` li legge da `s`, non dal file che li contiene: senza, num() rifiuta un
    // undefined e l'intero componente cade. Costano una manciata di byte per giro ed
    // evitano di dover forkare il componente — che sarebbe la vera spesa.
    gara: nomeGara,
    pilota,
    n_giri: gara.nGiri,
    stazionario_prior_s: extra.prior.stazionario_tipico_s,
    stazionario_pavimento_s: extra.prior.stazionario_minimo_fisico_s,
    mescola_scelta: mescola,
    regime: regimeAlGiro(gara, Lf, pilota),
    approvato: rientro.approvato,
    pannello: {
      posizione: rientro.posizione,
      su_quanti: rientro.su_quanti,
      giro_di_rientro: rientro.giro_di_rientro,
      davanti: rientro.davanti,
      dietro: rientro.dietro,
      gap_soppressi: rientro.gap_soppressi,
      banda_posizione: rientro.banda_posizione,
    },
    perdita: {
      valore: rientro.perdita.perdita,
      verde: rientro.perdita.perdita_verde,
      fattore: rientro.perdita.fattore,
      circuito: rientro.perdita.circuito,
      fallback: rientro.perdita.fallback,
      targhetta: rientro.perdita.targhetta,
    },
    curva: curva.curva,
    minimo: curva.minimo,
    banda_presente: curva.banda_presente,
    nota_banda: curva.nota_banda,
    orizzonte: curva.orizzonte,
    assunzioni: rientro.assunzioni,
    piano: ottimo.migliore === null ? null : {
      k: ottimo.migliore.k,
      soste: ottimo.migliore.piano.soste,
      stint: ottimo.migliore.piano.stint,
      alternative: ottimo.per_k,
      mescole_gia_usate: ottimo.mescole_gia_usate,
      vincolo_regolamento: ottimo.vincolo_regolamento,
      allarmi: allarmiPiano(ottimo.migliore.piano, extra.durate2026),
      limite: extra.esitoPiano.limite_dichiarato.conseguenza,
      limite_perche: extra.esitoPiano.limite_dichiarato.spiegazione,
    },
    fantasma,
    violazioni_director: rientro.direttore.violazioni.length,
    sospetti_director: rientro.direttore.riepilogo.sospetti,
  };
}
