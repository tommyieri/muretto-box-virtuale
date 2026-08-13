// stato_contro.mjs — LA TUA GARA, nella forma che il motore sa leggere.
//
// IL PROBLEMA CHE RISOLVE. Il pannello legge `data/vista/<gara>/<PILOTA>.json`: risposte
// PRE-CALCOLATE, e pre-calcolate sulla gara VERA. Finche' non hai toccato niente va bene —
// la gara che guardi e' quella. Ma dal primo BOX ORA in poi tu stai giocando un'altra gara,
// e il pannello continua a rispondere su quella che hai appena cancellato: al giro 40, dopo
// una sosta al 15, diceva «P8, davanti RUS 11,2 s» quando nella tua gara eri P6 con HAM a
// 5,7. Due posizioni e un rivale diverso — la differenza fra un gioco e una tabella.
//
// LA TRACCIA C'E' GIA'. Il kernel, quando rigioca, restituisce per ogni pilota
// {lap, lap_time, cum_time, tyre_age, in_lap}: il tempo e la gomma di ogni giro della gara
// contro-fattuale. Manca solo il contorno che il contratto del motore pretende — mescola,
// stint, out-lap, regime — e non va inventato: si DERIVA dal piano, che e' l'unica cosa che
// hai cambiato.
//
//   mescola   = quella montata all'ultima sosta prima di questo giro, o quella del
//               congelamento se soste non ce ne sono ancora
//   stint     = quante soste sono gia' avvenute, piu' uno
//   out_lap   = il giro dopo un in-lap
//   status    = il regime VERO di quel giro (le neutralizzazioni non le decide la tua
//               strategia: la Safety Car sarebbe uscita lo stesso)
//   deleted   = false — nella gara contro-fattuale non ci sono giri cancellati
//
// COSA NON FA. Non calcola niente di fisico (E17): rimette in forma cio' che il kernel ha
// gia' prodotto. E i giri FINO al congelamento restano quelli VERI, perche' quelli sono
// successi davvero: la tua gara comincia a divergere dal giro dopo.

/** Le soste con cui un pilota corre la gara contro-fattuale: le TUE se sei il soggetto,
 *  quelle vere altrimenti (i rivali fanno cio' che fecero — e' l'assunzione dichiarata). */
function pianoDi(drv, soggetto, mieSoste, sosteVere) {
  return drv === soggetto ? (mieSoste ?? []) : (sosteVere?.[drv] ?? []);
}

/**
 * @param traccia    risultato.traccia del kernel: {sigla: [{lap, lap_time, cum_time, tyre_age, in_lap}]}
 * @param byLapVero  l'archivio della gara vera (per il passato e per il regime)
 * @param freeze     giro di congelamento: fino a li' la gara e' quella vera
 * @param soggetto   il pilota di cui hai cambiato la strategia
 * @param mieSoste   il tuo piano [{giro, mescola}]
 * @param sosteVere  {sigla: [{giro, mescola}]} — i rivali
 * @returns {Object} byLap nella stessa forma di `race.byLap`, pronto per rispostaLive
 */
export function byLapControFattuale({ traccia, byLapVero, freeze, soggetto, mieSoste, sosteVere }) {
  const out = {};
  // il passato e' il passato: fino al congelamento la gara e' successa davvero
  for (let L = 1; L <= freeze; L += 1) if (byLapVero[L]) out[L] = { ...byLapVero[L] };

  const mescolaA = (drv, L) => {
    const s = pianoDi(drv, soggetto, mieSoste, sosteVere)
      .filter((x) => x.giro < L && x.mescola)
      .sort((a, b) => a.giro - b.giro);
    return s.length ? s[s.length - 1].mescola : (byLapVero[freeze]?.[drv]?.compound ?? null);
  };
  const stintA = (drv, L) => 1 + pianoDi(drv, soggetto, mieSoste, sosteVere).filter((x) => x.giro < L).length;

  for (const [drv, passi] of Object.entries(traccia ?? {})) {
    const soste = new Set(pianoDi(drv, soggetto, mieSoste, sosteVere).map((x) => x.giro));
    const rif = byLapVero[freeze]?.[drv] ?? byLapVero[1]?.[drv] ?? {};
    for (const p of passi ?? []) {
      if (typeof p?.cum_time !== 'number' || !Number.isInteger(p.lap)) continue;
      (out[p.lap] ||= {})[drv] = {
        lap_time: typeof p.lap_time === 'number' ? p.lap_time : null,
        cum_time: p.cum_time,
        tyre_age: typeof p.tyre_age === 'number' ? p.tyre_age : null,
        in_lap: !!p.in_lap,
        out_lap: soste.has(p.lap - 1),
        // la mescola in forza DURANTE il giro L e' quella montata all'ultima sosta
        // precedente; il grezzo la aggiorna all'out-lap, e `mescolaA(drv, L)` fa lo stesso
        compound: mescolaA(drv, p.lap),
        stint: stintA(drv, p.lap),
        // IL REGIME NON LO DECIDE LA TUA STRATEGIA. La Safety Car sarebbe uscita lo stesso:
        // si legge dal giro VERO. Se quel giro nella gara vera non esiste (il pilota si era
        // gia' ritirato) si dichiara verde, che e' l'unica cosa che il contro-fattuale sa.
        status: byLapVero[p.lap]?.[drv]?.status ?? '1',
        deleted: false,
        team: rif.team ?? null,
      };
    }
  }
  return out;
}
