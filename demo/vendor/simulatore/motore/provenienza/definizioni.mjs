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
