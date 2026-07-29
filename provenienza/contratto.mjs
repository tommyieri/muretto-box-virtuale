// PROVENIENZA / CONTRATTO — le definizioni vivono QUI e in nessun altro posto.
// Regola 1: una definizione, un posto. Chi usa `verde`, `neutralizzato`,
// `mescola valida` li IMPORTA da questo modulo, mai li ridefinisce: due
// definizioni di verde sono costate il 37% di divergenza replay/live (E12).
//
// Vocabolario `status` (per-auto, dall'archivio, data/status_vocabolario.csv):
// un `status` di gara è la concatenazione ordinata degli stati within-lap
// attraversati dall'auto in quel giro. Alfabeto atomico {1,2,4,5,6,7}:
//   1 VERDE · 2 GIALLA di settore · 4 SC · 5 ROSSA · 6 VSC deployed ·
//   7 VSC ending (2 e 7 come regime: ipotesi FIA non committata).

export const ALFABETO_STATUS = new Set(['1', '2', '4', '5', '6', '7']);
export const MESCOLE_SLICK = new Set(['SOFT', 'MEDIUM', 'HARD']);
export const MESCOLE_BAGNATO = new Set(['INTERMEDIATE', 'WET']);

// Lavaggio dei letterali ALLA FRONTIERA (E05): il grezzo TracingInsights usa
// la stringa 'None' per l'assenza. Oltre la frontiera l'assenza è null e
// basta (Regola 6).
export function lavaLetterale(v) {
  return (v === 'None' || v === '' || v === undefined || v === null) ? null : v;
}

// REGIME NEUTRALIZZATO (per la logica di gara): lo status contiene SC (4) o
// VSC (6). Livello DISTINTO dal filtro verde: la rossa (5) e la gialla (2)
// non sono un regime SC/VSC — sporcano il passo (vedi verdePasso) ma non
// scontano la sosta. L'assenza è null: uno status mancante non è un regime.
export function regimeNeutralizzato(status) {
  if (status === null || status === undefined) return null;
  return status.includes('4') || status.includes('6');
}

// FILTRO VERDE DEL PASSO (per le mediane) — IL filtro, unico nel repo.
// Una cella è verde se e solo se:
//   · status presente e senza NESSUNO di {2,4,5,6} (gialla, SC, rossa, VSC);
//   · giro non cancellato (del === false — un del assente non è certificabile);
//   · mescola slick valida (il letterale 'None' è un bug di frontiera, non
//     una mescola);
//   · non in-lap, non out-lap;
//   · lap_time presente.
// Tutto ciò che non è certificabile NON è verde: il dubbio esclude, mai
// ammette (E03: il filtro che ammetteva gialli/cancellati/bagnati ha spostato
// l'11,4% delle celle, con le code concentrate nel post-sosta).
const SPORCANO_IL_PASSO = ['2', '4', '5', '6'];
export function verdePasso(cella) {
  if (!cella) return false;
  if (typeof cella.status !== 'string' || cella.status.length === 0) return false;
  if (SPORCANO_IL_PASSO.some(c => cella.status.includes(c))) return false;
  if (cella.del !== false) return false;
  if (!MESCOLE_SLICK.has(cella.compound)) return false;
  if (cella.in_lap !== false || cella.out_lap !== false) return false;
  if (typeof cella.lap_time !== 'number' || !Number.isFinite(cella.lap_time)) return false;
  return true;
}

// CELLA PER GIRO — la shape unica in tutto il repo (contratto dati).
// `status` e `del` GREZZI viaggiano fino in fondo (E04): le definizioni
// derivate si calcolano qui sopra, mai a valle.
export const CHIAVI_CELLA = Object.freeze(['lap_time', 'cum_time', 'stint',
  'compound', 'tyre_age', 'in_lap', 'out_lap', 'status', 'del']);

export function creaCella({ lap_time, cum_time, stint, compound, tyre_age, in_lap, out_lap, status, del }) {
  return {
    lap_time: lavaLetterale(lap_time),
    cum_time: lavaLetterale(cum_time),
    stint: lavaLetterale(stint),
    compound: lavaLetterale(compound),
    tyre_age: lavaLetterale(tyre_age),
    in_lap: in_lap === true,
    out_lap: out_lap === true,
    status: status === null || status === undefined ? null : String(status),
    del: typeof del === 'boolean' ? del : null,
  };
}
