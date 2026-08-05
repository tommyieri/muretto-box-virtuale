// ————————————————————————————————————————————————————————————————————————
// ARTEFATTO GENERATO — non modificare qui.
//   sorgente: simulatore/provenienza/definizioni.mjs
//   generato: simulatore/web/trasporta_motore.mjs
// Vercel serve demo/ come radice e non vede simulatore/: questa copia esiste
// solo per essere ESEGUITA dal pannello live, dove il pre-calcolo non puo'
// esistere. Modificare QUESTO file lo fa divergere dall'originale, e
// `node web/trasporta_motore.mjs --verifica` fallisce (lo esegue la CI).
// ————————————————————————————————————————————————————————————————————————
// definizioni.mjs — UNA definizione, un posto (regola 1, E12).
//
// Questo file è l'UNICO proprietario delle definizioni derivate del repo.
// Chiunque abbia bisogno di "verde" o "neutralizzato" IMPORTA da qui: la
// sentinella s06 fallisce se qualcuno le ridichiara altrove. Il vecchio repo
// ha pagato il 37% di divergenza replay/live per due definizioni di verde
// (E12) e l'11,4% di celle spostate per un `_neut` cieco a rossa e gialla (E03).
//
// Due livelli DISTINTI, mai fusi (CLAUDE.md §Contratti dati):
//   - regimeNeutralizzato: logica di GARA (l'economia della sosta cambia);
//   - verde:               filtro del PASSO (quali giri misurano il ritmo).
// Un giro può essere fuori dal verde senza essere regime (gialla, rossa,
// in-lap) e può essere regime qualunque gomma monti (E03).

import { simboliStatus, MESCOLE_SLICK, MESCOLE_BAGNATO } from './vocabolario.mjs';
import { validaCella } from './contratto.mjs';

// LIMITE DICHIARATO (E13): lo `status` per-auto dell'archivio è la proiezione
// di bandiere track-wide/di settore sul giro dell'auto — misurato sul grezzo
// 2026: il 18,4% dei giri ha status non uniforme fra i piloti, quindi la
// colonna porta informazione per-auto reale, ma NON è una bandiera per-auto
// certificata. Il verso e l'accordo della ricostruzione live restano quelli
// misurati nel vecchio repo (84,8% accordo, 65 falsi verdi) finché non
// esistono bandiere per-auto.

// Regime neutralizzato: lo status contiene Safety Car (4) o VSC (6).
// La rossa (5) NON è regime: è gara sospesa, un'altra cosa. La gialla (2) e il
// 7 restano FUORI per ipotesi non committata: promuoverli è una prereg nuova
// (regola 3), non un edit qui.
export function regimeNeutralizzato(cella) {
  validaCella(cella);
  const simboli = simboliStatus(cella.status);
  return simboli.has('4') || simboli.has('6');
}

// La parte SOLO-STATUS del filtro verde: nessun simbolo fra gialla (2), SC (4),
// rossa (5), VSC (6). Esiste come funzione a sé perché serve a giudicare giri
// che verdi non possono essere per costruzione — un in-lap e un out-lap sono
// fuori dal passo ma possono benissimo essere avvenuti a bandiera verde, ed è
// esattamente ciò che distingue una sosta misurabile da una sotto Safety Car.
// Estrarla invece di riscriverla è regola 1: `verde` la COMPONE, non la duplica.
export function statusVerde(cella) {
  validaCella(cella);
  const simboli = simboliStatus(cella.status);
  return !(simboli.has('2') || simboli.has('4') || simboli.has('5') || simboli.has('6'));
}

// Filtro verde del passo. TUTTE le condizioni, nessuna esclusa (E03):
//   - status senza gialla (2), SC (4), rossa (5), VSC (6);
//   - giro non cancellato (del grezzo);
//   - mescola slick valida — il letterale "None" è già stato lavato a null
//     alla frontiera (E05) e il null qui è semplicemente non-verde;
//   - né in-lap né out-lap.
function passoPulitoDi(cella, mescole) {
  validaCella(cella);
  if (!statusVerde(cella)) return false;
  // `del` nullo = la fonte non sa se il giro è stato cancellato. NON si deduce
  // "non cancellato": si fallisce rumorosamente, come per lo status. Nel fondo
  // 2018 succede, e ammettere quei giri nel verde sarebbe E03 per la seconda
  // volta — stavolta per omissione invece che per distrazione.
  if (cella.del === null) {
    throw new Error('del assente: non si deduce se il giro è cancellato (E03/E13) — il chiamante deve escludere la cella dichiarandolo');
  }
  if (cella.del) return false;
  if (cella.compound === null || !mescole.has(cella.compound)) return false;
  if (cella.in_lap || cella.out_lap) return false;
  return true;
}

/**
 * IL REGIME DI UNA CELLA: 'SC', 'VSC' oppure null.
 *
 * Stava scritta in TRE posti — scenario/costruttore.mjs (regimeAlCongelamento),
 * scenario/risposta.mjs (regimeAlGiro) e banco/misure/rientro.mjs
 * (regimeDellaSosta, che pero' guardava anche il giro DOPO). Tre copie della
 * stessa domanda, e non erano nemmeno d'accordo: quella del banco leggeva il
 * futuro rispetto al congelamento, ed e' cosi' che la banda di rientro e'
 * finita calibrata su un'informazione che il prodotto non ha (E14 del
 * catalogo, dentro la calibrazione invece che dentro il motore).
 *
 * Da qui in poi la domanda si fa a questo modulo. Se un giorno servisse
 * guardare avanti, quella e' un'ALTRA funzione con un altro nome, non un
 * parametro in piu' su questa.
 */
export function regimeDiCella(cella) {
  if (!cella || cella.status === null || !regimeNeutralizzato(cella)) return null;
  return simboliStatus(cella.status).has('4') ? 'SC' : 'VSC';
}

/**
 * GARA SOSPESA: lo status contiene la bandiera rossa (5).
 *
 * NON e' un regime, ed e' esattamente per questo che ha una funzione sua.
 * `regimeNeutralizzato` (SC, VSC) descrive una gara che CORRE piano; la rossa
 * descrive una gara che non corre affatto, e CLAUDE.md tiene apposta i due
 * concetti separati. Confonderli farebbe rientrare la rossa nel filtro del
 * passo dalla porta di servizio.
 *
 * Serve a una cosa sola, e concreta: sotto sospensione le auto incolonnano in
 * corsia box e una sosta non costa posizioni. Il prior lo dichiara da sempre
 * (`fattori_neutralizzazione.RED = 0.0`) e nessun percorso del codice ci
 * arrivava — il motore prezzava quelle soste a pit-loss pieno e rispondeva un
 * numero sbagliato mentre la gara era ferma.
 */
export function garaSospesa(cella) {
  validaCella(cella);
  return simboliStatus(cella.status).has('5');
}

export function verde(cella) {
  return passoPulitoDi(cella, MESCOLE_SLICK);
}

// Il gemello del filtro verde per le gomme da BAGNATO. Stesse condizioni —
// stesso status, stesso del, niente in-lap né out-lap — e cambia solo la
// famiglia di mescole ammessa. Non è una seconda definizione di verde: è la
// stessa definizione con l'altra famiglia, e il codice è letteralmente lo
// stesso (passoPulitoDi). Serve alla Fase Bagnato, dove il passo da misurare è
// per costruzione fuori dal verde.
export function passoBagnato(cella) {
  return passoPulitoDi(cella, MESCOLE_BAGNATO);
}

// Verde E il tempo esiste: un giro verde con lap_time null è un giro senza
// passo, non un passo qualunque (regola 6). Le mediane si calcolano su questo.
export function passoUtilizzabile(cella) {
  return verde(cella) && cella.lap_time !== null;
}

/**
 * GARA ASCIUTTA: nessuna gomma da bagnato compare, per nessuno.
 *
 * È la definizione CONSERVATIVA — una gara con dieci giri di pioggia non è
 * "quasi asciutta", è bagnata — ed è l'unica del repo. Viveva inline dentro
 * `esporta_soste_fondo.mjs`; è salita qui il 04/08/2026 quando le durate del
 * fondo hanno avuto bisogno della stessa domanda. Due copie di "asciutta"
 * avrebbero prodotto due perimetri che si somigliano abbastanza da non
 * accorgersene: è la forma esatta di E12, che questo file esiste per impedire.
 *
 * Prende le righe GIÀ adattate al contratto, non il grezzo: la frontiera ha già
 * lavato i letterali d'assenza (E05), quindi qui una mescola è una mescola.
 */
export function garaAsciutta(righe) {
  for (const { cella } of righe) {
    if (cella.compound !== null && MESCOLE_BAGNATO.has(cella.compound)) return false;
  }
  return true;
}
