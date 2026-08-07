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

/**
 * LA GARA INTERA MESSA IN SCENA (08/08): dalla traccia del rigioca alla forma
 * di ghostplay. Stessa natura di simDaFantasma — si cambia FORMA, non contenuto
 * — ma copre freeze -> bandiera per TUTTO il campo: e' il carburante del
 * «guarda la gara simulata» dentro gara.html. I ritirati veri hanno la serie
 * che finisce al loro giro, e ghostplay li fa sparire dalla pista da solo
 * (giroDi torna null a serie finita: nessun caso speciale qui).
 *
 * @param risultato  l'output del kernel via rigioca (traccia per pilota)
 * @param race       l'archivio della pagina (per il cum VERO al congelamento:
 *                   e' lo stesso stato da cui lo scenario e' partito)
 * @param pilota     il soggetto (il fantasma che transita in pit-lane)
 * @param freeze     il giro di congelamento
 */
export function simDaRigioca({ risultato, race, pilota, freeze }) {
  const traccia = risultato?.traccia;
  if (!traccia || !traccia[pilota] || !traccia[pilota].length) return null;
  const cumByLap = {}, present = new Set(), laps = new Set([freeze]);
  // l'ancora: il cumulato VERO di tutti al congelamento
  for (const [drv, c] of Object.entries(race.byLap[freeze] ?? {})) {
    if (typeof c?.cum_time === 'number') { (cumByLap[freeze] ||= {})[drv] = c.cum_time; present.add(drv); }
  }
  for (const [drv, passi] of Object.entries(traccia)) {
    for (const p of passi ?? []) {
      if (typeof p?.cum_time !== 'number') continue;
      (cumByLap[p.lap] ||= {})[drv] = p.cum_time;
      present.add(drv); laps.add(p.lap);
    }
  }
  const ord = [...laps].sort((a, b) => a - b);
  if (ord.length < 2) return null;
  // il transito in pit-lane e' del PRIMO stop del piano: gli stop successivi
  // (e quelli dei rivali) vivono nel cum — la perdita c'e', la scenografia no
  const primoStop = (traccia[pilota].find((p) => p.in_lap === true)?.lap) ?? null;
  return { laps: ord, cumByLap, present: [...present], freezeLap: freeze,
           pitLap: primoStop ?? freeze + 1, driver: pilota };
}

