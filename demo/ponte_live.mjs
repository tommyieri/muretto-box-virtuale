// ponte_live.mjs — dalla gara IN CORSO alla risposta del simulatore.
//
// Il pannello di gara.html legge risposte pre-calcolate. In diretta non si puo':
// la gara sta succedendo, e una risposta su un giro non ancora percorso non
// esiste. Quindi qui il motore VERO gira nel browser — non una seconda
// implementazione, lo stesso codice trasportato da simulatore/ come artefatto
// con manifest di hash (vedi simulatore/web/trasporta_motore.mjs, e la CI che
// verifica la deriva).
//
// QUESTO MODULO NON CALCOLA NIENTE DI FISICO. Fa una cosa sola: TRADURRE. Le
// celle che il flusso live produce (live_bylap.mjs) nella cella del contratto
// che il simulatore pretende, e poi chiama `rispostaPer` — lo stesso identico
// montaggio che produce la vista pre-calcolata. Se un giorno qui dentro comparira'
// un coefficiente, o una media, o una correzione "solo per il live", quella sara'
// la seconda fisica che tutto questo giro serviva a non avere (E17).
//
// ── I DUE LIMITI DEL LIVE, misurati e dichiarati ───────────────────────────
//
//  1. LO STATO PISTA E' TRACK-WIDE. In gara non esistono bandiere per-auto: il
//     feed dice com'e' la pista, non com'e' stata per quella macchina. La
//     ricostruzione e' stata MISURATA (vecchio repo, live 2026): 84,8% di
//     accordo, 65 falsi verdi, 34,1% delle celle di passo oltre 0,10 s. Ogni
//     numero che ne discende porta banda allargata.
//
//  2. IL FEED NON REVOCA I GIRI CANCELLATI. Il contratto vuole `del` grezzo, e
//     `del: null` fa fallire il filtro verde apposta (non si deduce). In diretta
//     l'unica risposta possibile e' `false` — "questo giro risulta non
//     cancellato" — ed e' una DICHIARAZIONE, non una conoscenza.
//     Quanto costa, misurato sulle 11 gare 2026 (non stimato): 162 giri
//     cancellati su 12.733 celle; ignorarli fa entrare nel verde 138 giri che
//     non dovrebbero esserci, cioe' l'1,34% dei giri verdi. E' un ordine di
//     grandezza sotto il limite 1, e va detto insieme a quello.
//
// Nessuno dei due si corregge qui: si dichiarano, e chi mostra il numero li
// mostra con lui.

import { creaCella } from './vendor/simulatore/motore/provenienza/contratto.mjs';
import { indicizza } from './vendor/simulatore/motore/provenienza/gare_indice.mjs';
import { rispostaPer } from './vendor/simulatore/motore/scenario/risposta.mjs';

export const LIMITI_LIVE = Object.freeze({
  stato_track_wide: Object.freeze({
    targhetta: 'misurato (vecchio repo, live 2026): ricostruzione del verde da stato pista track-wide, finche\' non esistono bandiere per-auto',
    accordo: 0.848,
    falsi_verdi: 65,
    quota_celle_passo_oltre_soglia: 0.341,
    soglia_scarto_s: 0.10,
  }),
  giri_cancellati_ignoti: Object.freeze({
    targhetta: 'misurato sulle 11 gare 2026 (31/07/2026): il feed live non revoca i giri cancellati',
    cancellati_nel_fondo: 162,
    celle_totali: 12733,
    falsi_verdi: 138,
    quota_sui_verdi: 0.0134,
  }),
});

// ── La traduzione dello stato pista, in un posto solo ──────────────────────
// Il feed parla per nomi ('SCDeployed'), il simulatore per simboli ({1,2,4,5,6,7}).
//
// PERCHE' GLI "Ending" MAPPANO SUL REGIME PIENO. Verrebbe da dare a VSCEnding il
// suo simbolo 7 (che nell'alfabeto e' VERDE per il filtro del passo). Sarebbe un
// cambio non misurato: live_bylap.mjs tratta gia' gli Ending come giro sporco, e
// quella scelta e' stata verificata contro il dato ufficiale — 870 celle
// neutralizzate su 871 identiche. Mappare qui in un altro modo farebbe divergere
// la diretta da cio' che e' stato validato, per un'eleganza di vocabolario.
// La distinzione "Ending" non si perde: e' quella che decide se il giro DOPO
// riparte pulito, e vive in live_bylap.mjs dove e' stata misurata.
const SIMBOLO_DI = Object.freeze({
  AllClear: '1',
  Yellow: '2',
  SCDeployed: '4',
  SCEnding: '4',
  Red: '5',
  VSCDeployed: '6',
  VSCEnding: '6',
});

/**
 * Lo status grezzo del contratto, dagli stati pista visti durante il giro.
 * Uno stato che non sappiamo leggere NON diventa verde per assenza di prove
 * (E13): si dichiara ignoto restituendo null, e il filtro verde si rifiutera'
 * di giudicare quella cella invece di regalarle un giro buono.
 */
export function statusDaStatoPista(statiPista) {
  const stati = Array.isArray(statiPista) ? statiPista : [];
  if (stati.length === 0) return '1';
  const simboli = new Set();
  for (const s of stati) {
    const sim = SIMBOLO_DI[s];
    if (sim === undefined) return null;          // ignoto: non si deduce
    simboli.add(sim);
  }
  return [...simboli].sort().join('');
}

/**
 * Una cella del sito nella cella del contratto.
 *
 * DUE SORGENTI, UNA TRADUZIONE. La stessa pagina serve due casi:
 *   · la DIRETTA, dove la cella arriva da live_bylap.mjs e porta `stato_pista`
 *     (i nomi grezzi del feed) e nessuna informazione sui giri cancellati;
 *   · il REPLAY di una gara vera (`live.html?demo=<gara>`), dove la cella arriva
 *     da demo/data/<gara>.json e porta gia' lo `status` grezzo d'archivio (una
 *     stringa di simboli, es. "167") e `deleted`.
 *
 * Si legge il grezzo che c'e', preferendo quello d'archivio quando esiste perche'
 * e' il dato vero e non una ricostruzione. Non sono due definizioni: la mappa dei
 * simboli resta una sola, qui sopra. Fingere `stato_pista` anche in modalita'
 * demo avrebbe fatto passare per verdi i giri di Safety Car, cioe' avrebbe reso
 * il replay piu' ottimista della gara che sta rigiocando.
 */
export function cellaDaLive(c) {
  const statusArchivio = typeof c.status === 'string' && c.status.length > 0 ? c.status : null;
  return creaCella({
    lap_time: typeof c.lap_time === 'number' ? c.lap_time : null,
    cum_time: typeof c.cum_time === 'number' ? c.cum_time : null,
    stint: typeof c.stint === 'number' ? c.stint : null,
    compound: c.compound ?? null,
    tyre_age: typeof c.tyre_age === 'number' ? c.tyre_age : null,
    in_lap: !!c.in_lap,
    out_lap: !!c.out_lap,
    status: statusArchivio ?? statusDaStatoPista(c.stato_pista),
    // in diretta si dichiara `false` (vedi LIMITI_LIVE.giri_cancellati_ignoti);
    // dall'archivio si legge il dato vero, che a volte e' proprio `true`
    del: typeof c.deleted === 'boolean' ? c.deleted : false,
  });
}

/**
 * La gara sintetica che il costruttore di scenari pretende, dal byLap live.
 * Stessa forma di quelle d'archivio: `{ righe, perPilota, nGiri }`.
 *
 * `nGiri` NON si deduce dai giri osservati — al giro 30 di una gara da 70
 * darebbe 30 e la deriva carburante sbaglierebbe di piu' del doppio. Arriva dal
 * feed (`giri_totali`), ed e' un ingresso dichiarato: se manca, il motore
 * fallisce rumorosamente invece di indovinare.
 */
export function garaDaLive(byLap, nGiriGara, { tolleranzaCum = null } = {}) {
  // prima per pilota e in ordine di giro: il controllo sul cumulato guarda
  // coppie consecutive, e senza ordine non esistono coppie
  const perDrv = new Map();
  for (const [L, perSigla] of Object.entries(byLap)) {
    const lap = Number(L);
    if (!Number.isInteger(lap)) continue;
    for (const [drv, c] of Object.entries(perSigla)) {
      if (!perDrv.has(drv)) perDrv.set(drv, []);
      perDrv.get(drv).push({ lap, c });
    }
  }

  const righe = [];
  let cumIgnoti = 0;
  for (const [drv, v] of perDrv) {
    v.sort((a, b) => a.lap - b.lap);
    let cumPrec = null, lapPrec = null;
    for (const { lap, c } of v) {
      const cum = typeof c.cum_time === 'number' ? c.cum_time : null;
      // IL CUMULATO CHE NON REGGE IL SUO STESSO TEMPO SUL GIRO SI DICHIARA IGNOTO.
      //
      // Il cum live e' ricostruito dal distacco (`riferimento + gap`), e nei primi
      // giri la catena del riferimento deve ancora agganciarsi: su Spa 2026
      // l'errore sul distacco vale fino a 5,3 s al giro 2 e scende a 0,25 s dal
      // giro 3. Sette celle su 823 restano incoerenti, tutte ai giri 2-3, quasi
      // tutte out-lap sotto Safety Car.
      //
      // Non si tengono e non si buttano. TENERLE significa dare al motore un
      // cumulato che sappiamo sbagliato, e il Director — giustamente — rifiuta
      // l'intera risposta per tutti (una cella incoerente in un punto qualunque
      // del campo vale il rifiuto: e' il suo mestiere). BUTTARE LA CELLA aprirebbe
      // un buco nella sequenza dei giri, che e' una violazione peggiore.
      // Si dichiara ignoto il solo campo che non regge: il contratto ammette
      // `cum_time: null`, il Director salta le coppie nulle, e il pilota resta
      // in pista con un giro in cui non sappiamo dov'era (regola 6).
      //
      // La soglia NON e' scelta qui: e' la stessa del Director, importata dalle
      // sue costanti. Averne una propria vorrebbe dire due definizioni di
      // "cumulato coerente", cioe' E12 nel punto esatto in cui si e' manifestato.
      let cumDichiarato = cum;
      if (tolleranzaCum !== null && cumPrec !== null && cum !== null
          && typeof c.lap_time === 'number' && lapPrec === lap - 1
          && Math.abs(cum - cumPrec - c.lap_time) > tolleranzaCum) {
        cumDichiarato = null;
        cumIgnoti += 1;
      }
      let cella;
      try {
        cella = cellaDaLive({ ...c, cum_time: cumDichiarato });
      } catch (_) {
        // una cella che non passa il contratto non entra travestita da buona:
        // esce, e il pilota avra' meno giri — che e' visibile, al contrario di
        // un valore plausibile messo al posto di un dato assente (regola 6).
        cumPrec = cum; lapPrec = lap;
        continue;
      }
      righe.push({ drv, lap, cella });
      // la catena prosegue sul cumulato RICOSTRUITO, non su quello dichiarato:
      // altrimenti la cella dopo verrebbe confrontata con due giri di distanza e
      // il controllo diventerebbe un altro controllo
      cumPrec = cum; lapPrec = lap;
    }
  }

  const gara = indicizza(righe);
  // `indicizza` deduce nGiri dai giri visti: in diretta e' il giro corrente, non
  // la distanza di gara. Si sovrascrive con quella vera, dichiarata dal feed.
  return {
    ...gara,
    nGiri: Number.isInteger(nGiriGara) ? nGiriGara : gara.nGiri,
    cum_dichiarati_ignoti: cumIgnoti,
  };
}

/** Il nome che il simulatore usa per la gara ('Gran Bretagna' → 'GranBretagna'). */
export function nomeSimulatore(nomeSito) {
  return String(nomeSito ?? '').replace(/\s+/g, '');
}

/**
 * Contesto ed extra del motore, dal `contesto_live.json` trasportato.
 * `costantiDirector` si ricompone qui: nel JSON il prior viaggia una volta
 * sola, perche' duplicarlo sarebbe 26 KB e due copie della stessa verita'.
 */
export function contestoDa(contestoLive, nomeGara, gara) {
  return {
    contesto: {
      gare: { [nomeGara]: gara },
      modello: contestoLive.modello,
      prior: contestoLive.prior,
      costantiDirector: {
        limiti: contestoLive.limiti,
        prior: contestoLive.prior,
        pavimenti: contestoLive.pavimenti,
      },
      bandaRientro: contestoLive.bandaRientro,
      nGiriGara: gara.nGiri,
    },
    extra: {
      prior: contestoLive.prior,
      durate2026: contestoLive.durate2026,
      esitoPiano: contestoLive.esitoPiano,
    },
  };
}

/**
 * La risposta del muretto sulla gara in corso.
 *
 * @returns lo stesso record della vista pre-calcolata (`rispostaPer`), oppure
 *          `null` se al congelamento la gomma non e' nota, oppure
 *          `{freeze_lap, senza_risposta}`.
 */
export function rispostaLive({ byLap, nGiriGara, nomeGara, pilota, freezeLap, contestoLive, data }) {
  const nome = nomeSimulatore(nomeGara);
  const gara = garaDaLive(byLap, nGiriGara, {
    tolleranzaCum: contestoLive?.limiti?.tolleranza_cum_s?.valore ?? null,
  });
  const { contesto, extra } = contestoDa(contestoLive, nome, gara);
  const quando = data ?? new Date().toISOString().slice(0, 10);
  try {
    return rispostaPer(nome, gara, freezeLap, pilota, contesto, extra, quando);
  } catch (e) {
    return { freeze_lap: freezeLap, senza_risposta: e.message };
  }
}
