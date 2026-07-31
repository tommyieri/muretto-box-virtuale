// ————————————————————————————————————————————————————————————————————————
// ARTEFATTO GENERATO — non modificare qui.
//   sorgente: simulatore/provenienza/contratto.mjs
//   generato: simulatore/web/trasporta_motore.mjs
// Vercel serve demo/ come radice e non vede simulatore/: questa copia esiste
// solo per essere ESEGUITA dal pannello live, dove il pre-calcolo non puo'
// esistere. Modificare QUESTO file lo fa divergere dall'originale, e
// `node web/trasporta_motore.mjs --verifica` fallisce (lo esegue la CI).
// ————————————————————————————————————————————————————————————————————————
// contratto.mjs — la cella per giro, shape UNICA in tutto il repo
// (CLAUDE.md §Contratti dati):
//   { lap_time, cum_time, stint, compound, tyre_age, in_lap, out_lap, status, del }
//
// `status` e `del` GREZZI viaggiano fino in fondo (E04: il contratto che non li
// portava rendeva il fix impossibile a valle). Le definizioni derivate
// (`verde`, `neutralized`) NON stanno nella cella: si calcolano da
// definizioni.mjs ogni volta. Una cella che porta dentro il proprio verdetto è
// una seconda definizione di verde che viaggia nei dati (E12).
//
// L'IDENTITÀ (pilota, giro, gara) sta FUORI dalla cella: l'adapter restituisce
// record `{ drv, lap, cella }`. Così la shape resta quella dichiarata, una sola.

export const CAMPI_CELLA = Object.freeze([
  'lap_time', 'cum_time', 'stint', 'compound', 'tyre_age', 'in_lap', 'out_lap', 'status', 'del',
]);

const DERIVATI_VIETATI = Object.freeze(['verde', 'green', 'neutralized', 'neutralizzato', 'regime']);

const numeroONull = (v) => v === null || (typeof v === 'number' && Number.isFinite(v));

export function validaCella(cella) {
  if (cella === null || typeof cella !== 'object') throw new Error('cella non è un oggetto');
  const chiavi = Object.keys(cella);

  for (const derivato of DERIVATI_VIETATI) {
    if (Object.hasOwn(cella, derivato)) {
      throw new Error(`la cella porta la definizione derivata "${derivato}": si calcola, non si congela (E12)`);
    }
  }
  for (const campo of CAMPI_CELLA) {
    if (!Object.hasOwn(cella, campo) || cella[campo] === undefined) {
      throw new Error(`campo del contratto mancante: ${campo} (E04)`);
    }
  }
  for (const chiave of chiavi) {
    if (!CAMPI_CELLA.includes(chiave)) throw new Error(`campo estraneo al contratto: ${chiave}`);
  }

  if (!numeroONull(cella.lap_time)) throw new Error(`lap_time deve essere numero o null: ${JSON.stringify(cella.lap_time)}`);
  if (!numeroONull(cella.cum_time)) throw new Error(`cum_time deve essere numero o null: ${JSON.stringify(cella.cum_time)}`);
  if (!numeroONull(cella.stint)) throw new Error(`stint deve essere numero o null: ${JSON.stringify(cella.stint)}`);
  if (!numeroONull(cella.tyre_age)) throw new Error(`tyre_age deve essere numero o null: ${JSON.stringify(cella.tyre_age)}`);
  if (cella.compound !== null && typeof cella.compound !== 'string') throw new Error('compound deve essere stringa o null');
  if (typeof cella.in_lap !== 'boolean') throw new Error('in_lap deve essere booleano');
  if (typeof cella.out_lap !== 'boolean') throw new Error('out_lap deve essere booleano');
  // `del` è booleano oppure **null**: nel fondo 2018 la fonte a volte non sa se
  // un giro è stato cancellato, e "non lo so" non è "non cancellato". Dedurlo
  // sarebbe E03 (il filtro che ammetteva i cancellati); `verde()` si rifiuta di
  // giudicare una cella con del nullo, esattamente come fa con lo status.
  if (cella.del !== null && typeof cella.del !== 'boolean') {
    throw new Error(`del GREZZO deve essere booleano o null: ${JSON.stringify(cella.del)} (E04)`);
  }
  if (cella.status !== null && typeof cella.status !== 'string') throw new Error('status GREZZO deve essere stringa o null');

  return cella;
}

// Costruisce la cella nell'ordine del contratto e la congela: chi vuole una
// variante ne crea un'altra, non muta questa sotto i piedi di chi la legge.
export function creaCella(campi) {
  const cella = {};
  for (const campo of CAMPI_CELLA) cella[campo] = campi[campo];
  for (const chiave of Object.keys(campi)) {
    if (!CAMPI_CELLA.includes(chiave)) throw new Error(`campo estraneo al contratto: ${chiave}`);
  }
  validaCella(cella);
  return Object.freeze(cella);
}
