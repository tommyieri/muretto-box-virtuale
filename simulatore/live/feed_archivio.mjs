// feed_archivio.mjs — il feed che il vivo AVREBBE emesso, ricostruito dal
// grezzo pinnato. È l'harness di replay del percorso live: serve al test di
// parità (s18) e a G5, non alla produzione.
//
// DISCIPLINA E14: ogni record del feed è informazione che al giro in cui viene
// emesso esisteva già. `finoA` tronca ALLA FONTE — giri, eventi box,
// cancellazioni, status — e il `giro_fine` di uno stint aperto è l'ultimo giro
// osservato, non quello che lo stint raggiungerà. La sentinella s18 verifica
// che il feed troncato a Lf sia identico al feed intero tagliato a posteriori.
//
// Lo `stato_pista` track-wide qui è un'EMULAZIONE dichiarata: l'unione dei
// simboli di status visti sulle auto a quel giro (l'archivio non conserva il
// TrackStatus FIA). Serve a esercitare la modalità track_wide e il suo limite,
// non a misurarne l'accordo — quello (84,8%) resta il numero del vecchio repo.

export function feedDaGara(gara, { finoA = Infinity } = {}) {
  const giri = [];
  const stint = [];
  const box = [];
  const giriCancellati = [];
  const statusPerAuto = [];
  const statoPistaPerGiro = new Map();

  for (const [pilota, celle] of gara.perPilota) {
    const laps = [...celle.keys()].filter((l) => l <= finoA).sort((a, b) => a - b);
    let stintAperto = null;
    for (const giro of laps) {
      const c = celle.get(giro);

      giri.push({ pilota, giro, durata_s: c.lap_time, sessione_s: c.cum_time, e_out_lap: c.out_lap });

      if (stintAperto === null || c.stint !== stintAperto.numero) {
        if (stintAperto !== null) stint.push(stintAperto);
        stintAperto = {
          pilota,
          numero: c.stint,
          mescola: c.compound,
          eta_iniziale: c.tyre_age,
          giro_inizio: giro,
          giro_fine: giro,
        };
      } else {
        stintAperto.giro_fine = giro;
      }

      if (c.in_lap) box.push({ pilota, giro, lane_duration_s: null, stop_duration_s: null });
      if (c.del) giriCancellati.push({ pilota, giro });
      if (c.status !== null) {
        statusPerAuto.push({ pilota, giro, status: c.status });
        if (!statoPistaPerGiro.has(giro)) statoPistaPerGiro.set(giro, new Set());
        for (const simbolo of c.status) statoPistaPerGiro.get(giro).add(simbolo);
      }
    }
    if (stintAperto !== null) stint.push(stintAperto);
  }

  const ordina = (arr, chiave) => arr.sort((a, b) => (chiave(a) < chiave(b) ? -1 : chiave(a) > chiave(b) ? 1 : 0));
  return {
    giri: ordina(giri, (r) => `${r.pilota}@${String(r.giro).padStart(3, '0')}`),
    stint: ordina(stint, (r) => `${r.pilota}@${String(r.numero).padStart(3, '0')}`),
    box: ordina(box, (r) => `${r.pilota}@${String(r.giro).padStart(3, '0')}`),
    giri_cancellati: ordina(giriCancellati, (r) => `${r.pilota}@${String(r.giro).padStart(3, '0')}`),
    status_per_auto: ordina(statusPerAuto, (r) => `${r.pilota}@${String(r.giro).padStart(3, '0')}`),
    stato_pista: [...statoPistaPerGiro.entries()]
      .sort((a, b) => a[0] - b[0])
      .map(([giro, simboli]) => ({ giro, status: [...simboli].sort().join('') })),
  };
}
