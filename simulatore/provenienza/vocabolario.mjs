// vocabolario.mjs — l'alfabeto grezzo e il lavaggio alla frontiera.
// Qui NON si decide cosa è verde: qui si dice soltanto che simboli esistono e
// come si legge il grezzo. Le decisioni stanno in definizioni.mjs (regola 1).

// Vocabolario `status` per-auto (CLAUDE.md §Contratti dati): alfabeto {1,2,4,5,6,7}.
// Uno status è una stringa di simboli COMPOSTA: "45" = SC + bandiera rossa.
// Non esiste un "primo simbolo che conta": si legge l'insieme (E03).
export const ALFABETO_STATUS = Object.freeze(new Set(['1', '2', '4', '5', '6', '7']));
export const SIMBOLO = Object.freeze({
  PISTA_LIBERA: '1',
  GIALLA: '2',
  SAFETY_CAR: '4',
  ROSSA: '5',
  VSC: '6',
  SETTE: '7', // significato non committato (CLAUDE.md: "2 e 7 come regime: ipotesi non committata")
});

// Mescole. Il filtro verde del passo chiede una slick VALIDA: le gomme da
// bagnato escono dal passo (non è la stessa fisica), l'assenza esce sempre.
//
// Le tre slick dell'era attuale, più quelle della nomenclatura 2018 (misurato
// sul fondo: SUPERSOFT 6.033 giri, ULTRASOFT 4.319, HYPERSOFT 887 — tutte e
// sole nel 2018). Sono slick a tutti gli effetti e i loro giri sono verdi: non
// riconoscerle vorrebbe dire buttare una stagione intera senza dirlo. Restano
// però DISTINTE dalle tre attuali, perché un confronto SOFT-HARD su un anno che
// aveva 47 giri HARD in totale non è un confronto.
export const MESCOLE_SLICK_ATTUALI = Object.freeze(new Set(['SOFT', 'MEDIUM', 'HARD']));
export const MESCOLE_SLICK_2018 = Object.freeze(new Set(['SUPERSOFT', 'ULTRASOFT', 'HYPERSOFT']));
export const MESCOLE_SLICK = Object.freeze(new Set([...MESCOLE_SLICK_ATTUALI, ...MESCOLE_SLICK_2018]));
export const MESCOLE_BAGNATO = Object.freeze(new Set(['INTERMEDIATE', 'WET']));

// I letterali che il grezzo usa per dire "non c'è" e che NON devono mai
// arrivare a valle come stringhe (E05: `"None"` come mescola, arrivata in
// pagina). Il lavaggio avviene UNA volta, alla frontiera, nell'adapter.
// `UNKNOWN` (60 giri nel 2021) è la fonte che dichiara di non sapere: è
// ASSENZA, non una mescola. Trattarlo come mescola darebbe una gomma
// inesistente a giri veri (E05); lavarlo a null li fa uscire dal filtro verde,
// che è il verso conservativo E dichiarato.
export const LETTERALI_ASSENZA = Object.freeze(new Set(['None', 'none', 'NaN', 'nan', 'null', '', 'UNKNOWN', 'Unknown']));

export function lava(valore) {
  if (valore === undefined) return null;
  if (typeof valore === 'string' && LETTERALI_ASSENZA.has(valore.trim())) return null;
  return valore;
}

// Legge lo status grezzo e restituisce l'INSIEME dei suoi simboli.
// Fallimento RUMOROSO su tutto ciò che non è una stringa di simboli noti: uno
// status che non si sa leggere non è "verde per assenza di prove" — è E13, la
// ricostruzione dichiarata conservativa e mai misurata.
export function simboliStatus(status) {
  if (typeof status !== 'string' || status.length === 0) {
    throw new Error(`status inutilizzabile: ${JSON.stringify(status)} — non si deduce, si fallisce (E13)`);
  }
  const simboli = new Set();
  for (const ch of status) {
    if (!ALFABETO_STATUS.has(ch)) {
      throw new Error(`simbolo "${ch}" fuori dall'alfabeto {1,2,4,5,6,7} in status ${JSON.stringify(status)}`);
    }
    simboli.add(ch);
  }
  return simboli;
}

// Una mescola sconosciuta non diventa "non verde" in silenzio: si ferma la
// linea. Il null (assenza lavata) è invece un caso previsto e legittimo.
export function validaMescola(compound) {
  if (compound === null) return null;
  if (typeof compound !== 'string' || (!MESCOLE_SLICK.has(compound) && !MESCOLE_BAGNATO.has(compound))) {
    throw new Error(`mescola sconosciuta: ${JSON.stringify(compound)} — aggiornare il vocabolario, non ignorarla`);
  }
  return compound;
}
