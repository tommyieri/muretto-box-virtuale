// fantasma_sim.mjs — dalla traccia del simulatore alla forma che vuole ghostplay.
//
// ADATTATORE, non un secondo calcolo: la traccia e' una lista piatta
// {drv, giro, cum}; ghostplay.mjs vuole {laps, cumByLap, present}. Qui si cambia
// FORMA, non contenuto — nessun tempo viene sommato, sottratto o inventato.
//
// Sta in un modulo suo perche' lo usano DUE pagine: gara.html (dove il fantasma
// arriva dal file pre-calcolato) e live.html (dove arriva dal record che il
// motore produce sul momento). Una copia per pagina sarebbe la solita seconda
// sorgente della stessa cosa, con la variante peggiore: quella che si scopre
// solo quando le due animazioni iniziano a raccontare due soste diverse.

export function simDaFantasma(passi, drv, freezeLap) {
  if (!passi || !passi.length) return null;
  const cumByLap = {}, present = new Set(), laps = new Set();
  for (const p of passi) {
    (cumByLap[p.giro] ||= {})[p.drv] = p.cum;
    present.add(p.drv); laps.add(p.giro);
  }
  const ord = [...laps].sort((a, b) => a - b);
  if (ord.length < 2) return null;
  return { laps: ord, cumByLap, present: [...present], freezeLap,
           pitLap: freezeLap + 1, driver: drv };
}
