// adattatore.mjs — dal grezzo colonnare dell'archivio al contratto cella.
// È LA frontiera (E05): i letterali d'assenza si lavano qui, una volta, e a
// valle esistono solo valori tipati o null espliciti (regola 6). I campi
// grezzi `status` e `del` passano INTATTI (E04).
//
// Mappa colonna → campo del contratto:
//   time → lap_time · sesT → cum_time · stint → stint · compound → compound
//   life → tyre_age · pin ≠ null → in_lap · pout ≠ null → out_lap
//   status → status (grezzo) · del → del (grezzo)
// (`pin`/`pout` sono i timestamp d'ingresso/uscita corsia: la loro PRESENZA
// definisce in/out-lap; il valore non entra nella cella.)
//
// L'identità resta fuori dalla cella: si restituisce { drv, lap, cella }.

import { creaCella } from './contratto.mjs';
import { lava, validaMescola } from './vocabolario.mjs';

const COLONNE_RICHIESTE = Object.freeze([
  'time', 'sesT', 'stint', 'compound', 'life', 'pin', 'pout', 'status', 'del', 'drv', 'lap',
]);

const numeroLavato = (v, colonna, i, fonte) => {
  const pulito = lava(v);
  if (pulito === null) return null;
  if (typeof pulito !== 'number' || !Number.isFinite(pulito)) {
    throw new Error(`${fonte}: colonna ${colonna}[${i}] non numerica: ${JSON.stringify(v)}`);
  }
  return pulito;
};

export function adattaColonnare(grezzo, { fonte = 'grezzo' } = {}) {
  if (grezzo === null || typeof grezzo !== 'object') throw new Error(`${fonte}: grezzo non è un oggetto colonnare`);
  for (const colonna of COLONNE_RICHIESTE) {
    if (!Array.isArray(grezzo[colonna])) {
      throw new Error(`${fonte}: colonna richiesta assente o non-array: ${colonna} (E04: senza status/del il fix a valle è impossibile)`);
    }
  }
  const n = grezzo.time.length;
  for (const colonna of COLONNE_RICHIESTE) {
    if (grezzo[colonna].length !== n) {
      throw new Error(`${fonte}: colonna ${colonna} lunga ${grezzo[colonna].length}, attese ${n} righe`);
    }
  }

  const righe = new Array(n);
  for (let i = 0; i < n; i += 1) {
    // `del` passa dal lavaggio dei letterali come tutto il resto: nel fondo 2018
    // la fonte scrive "None" quando non sa. Resta booleano o null, mai un terzo
    // valore che somiglia a false.
    const del = lava(grezzo.del[i]);
    if (del !== null && typeof del !== 'boolean') {
      throw new Error(`${fonte}: del[${i}] né booleano né assenza: ${JSON.stringify(grezzo.del[i])} (E04)`);
    }
    const status = lava(grezzo.status[i]);
    if (status !== null && typeof status !== 'string') {
      throw new Error(`${fonte}: status[${i}] né stringa né assenza: ${JSON.stringify(grezzo.status[i])}`);
    }
    const cella = creaCella({
      lap_time: numeroLavato(grezzo.time[i], 'time', i, fonte),
      cum_time: numeroLavato(grezzo.sesT[i], 'sesT', i, fonte),
      stint: numeroLavato(grezzo.stint[i], 'stint', i, fonte),
      compound: validaMescola(lava(grezzo.compound[i])),
      tyre_age: numeroLavato(grezzo.life[i], 'life', i, fonte),
      in_lap: lava(grezzo.pin[i]) !== null,
      out_lap: lava(grezzo.pout[i]) !== null,
      status, // grezzo, intatto (E04); il lavaggio tocca solo il letterale d'assenza
      del,    // grezzo, intatto (E04)
    });
    righe[i] = { drv: grezzo.drv[i], lap: grezzo.lap[i], cella };
  }
  return { fonte, righe };
}
