// PROVENIENZA / FRONTIERA — dal grezzo colonnare TracingInsights alla cella
// unica del contratto. È QUI che i letterali si lavano (E05) e che i campi
// grezzi `status`/`del` salgono a bordo per viaggiare fino in fondo (E04).
// Oltre questa frontiera esistono solo celle a contratto, e l'assenza è null:
// un giro mancante nel grezzo diventa una cella null ESPLICITA, mai un buco
// silenzioso che sfasa gli indici (Regola 6).
import { readFileSync } from 'node:fs';
import { creaCella, lavaLetterale } from './contratto.mjs';

// byLap: { [sigla pilota]: (Cella | null)[] } — indice i ↔ giro i+1.
export function caricaGaraGrezza(percorso) {
  const grezzo = JSON.parse(readFileSync(percorso, 'utf8'));
  const righe = grezzo.lap.length;
  const byLap = {};
  for (let i = 0; i < righe; i++) {
    const drv = grezzo.drv[i];
    const giro = grezzo.lap[i];
    if (!byLap[drv]) byLap[drv] = [];
    byLap[drv][giro - 1] = creaCella({
      lap_time: grezzo.time[i],
      cum_time: grezzo.sesT[i],
      stint: grezzo.stint[i],
      compound: grezzo.compound[i],
      tyre_age: grezzo.life[i],
      // pin/pout grezzi sono orari ('None' = niente sosta): la frontiera li
      // riduce ai due booleani del contratto
      in_lap: lavaLetterale(grezzo.pin[i]) !== null,
      out_lap: lavaLetterale(grezzo.pout[i]) !== null,
      status: grezzo.status[i],
      del: grezzo.del[i],
    });
  }
  // i buchi diventano null espliciti
  for (const drv of Object.keys(byLap)) {
    const celle = byLap[drv];
    for (let i = 0; i < celle.length; i++) if (celle[i] === undefined) celle[i] = null;
  }
  return byLap;
}

// Troncamento al congelamento Lf: SOLO informazione ≤ Lf (Regola 5, E14/E15).
// Ogni misura "al congelamento" deve dare lo stesso risultato su byLap intero
// e troncato: la sentinella s01 lo pretende.
export function troncaByLap(byLap, Lf) {
  const tronco = {};
  for (const drv of Object.keys(byLap)) tronco[drv] = byLap[drv].slice(0, Lf);
  return tronco;
}
