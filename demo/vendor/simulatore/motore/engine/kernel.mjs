// ————————————————————————————————————————————————————————————————————————
// ARTEFATTO GENERATO — non modificare qui.
//   sorgente: simulatore/engine/kernel.mjs
//   generato: simulatore/web/trasporta_motore.mjs
// Vercel serve demo/ come radice e non vede simulatore/: questa copia esiste
// solo per essere ESEGUITA dal pannello live, dove il pre-calcolo non puo'
// esistere. Modificare QUESTO file lo fa divergere dall'originale, e
// `node web/trasporta_motore.mjs --verifica` fallisce (lo esegue la CI).
// ————————————————————————————————————————————————————————————————————————
// kernel.mjs — IL kernel. Uno solo, in JavaScript, perché è ciò che gira in
// produzione (regola 8). La statistica in Python produce JSON con targhetta e
// non re-implementa mai questa funzione: il vecchio repo ha pagato audit di
// allineamento continui per il doppio kernel JS+Python, e due interpreti sulla
// stessa sorgente (E19).
//
// ── Cosa il kernel NON sa, deliberatamente ──────────────────────────────────
//
// Il MODELLO DEL TEMPO SUL GIRO non è qui (arriva al PROMPT 03, dopo
// l'esperimento decisivo su δ). Il kernel riceve `pace(pilota, giro, età)` e
// la applica: così chi misura e chi predice usano la STESSA equazione per
// costruzione (regola 10), e non può ripetersi E02 — il carburante sottratto
// misurando e mai ri-aggiunto simulando, −1,48 s/giro di bias. Se un giorno il
// passo cambia, cambia in UN posto e questo file non se ne accorge.
//
// IL CAP DEL TRAFFICO non esiste, al giorno 1. Il vecchio repo lo aveva tarato
// su finestre senza soste — cioè dove il fenomeno non c'era — e sul bersaglio
// vero del prodotto peggiorava (E16). Quindi, esplicitamente:
//
//     DUE AUTO POSSONO ATTRAVERSARSI: si riproduce QUANTI cambi di posizione,
//     non QUALI.
//
// Chi legge questo output sa che un sorpasso è un incrocio di cum, non un
// duello simulato. La probabilità di sorpasso/difesa al rientro è una fase
// futura con la sua prereg; e nel 2026 il DRS non esiste (Manual Override).
//
// LA SOSTA non regala nulla per sempre: azzera l'età gomma e paga la perdita.
// Nessun gradino costante perpetuo (E01), che produceva "fermati subito" nel
// 100% dei casi. La perdita è quella DICHIARATA da chi chiama, per sosta: il
// kernel non conosce pit-loss di circuito (stanno nei dati, con targhetta) e
// non ne inventa uno di riserva.

const interoNonNegativo = (v) => Number.isInteger(v) && v >= 0;

// Perdita applicata INTERA sul giro della sosta. È la stessa convenzione con
// cui il prior la misura — (in-lap + out-lap) meno due giri di passo pulito —
// quindi NON va ri-applicata una seconda quota sull'out-lap: sarebbe il doppio
// conteggio di E20.
function normalizzaSoste(pits, pilotiNoti) {
  const soste = new Map();
  for (const [drv, elenco] of Object.entries(pits ?? {})) {
    if (!pilotiNoti.has(drv)) throw new Error(`sosta per un pilota che non è nello stato: ${drv}`);
    if (!Array.isArray(elenco)) throw new Error(`le soste di ${drv} non sono un elenco`);
    const perGiro = new Map();
    for (const sosta of elenco) {
      const { lap, perdita } = sosta ?? {};
      if (!Number.isInteger(lap)) throw new Error(`sosta di ${drv} senza giro intero: ${JSON.stringify(sosta)}`);
      if (typeof perdita !== 'number' || !Number.isFinite(perdita) || perdita < 0) {
        throw new Error(`sosta di ${drv} al giro ${lap} senza perdita dichiarata e finita ≥ 0: ${JSON.stringify(perdita)} (E07: niente numeri di riserva)`);
      }
      if (perGiro.has(lap)) throw new Error(`due soste di ${drv} sullo stesso giro ${lap}`);
      perGiro.set(lap, perdita);
    }
    soste.set(drv, perGiro);
  }
  return soste;
}

/**
 * Proietta la gara dal congelamento, un giro alla volta.
 *
 * @param state      voci `{ drv, lap, cum_time, tyre_age }` al congelamento.
 *                   `lap` DEVE valere freezeLap: una voce dal futuro è un
 *                   errore rumoroso (E14), una voce più vecchia esce con null.
 * @param pace       `(pilota, giro, età) → secondi | null`. null = questo
 *                   pilota non ha passo: esce dalla simulazione (regola 6).
 * @param freezeLap  Lf, il giro del congelamento.
 * @param steps      quanti giri proiettare (≥ 1).
 * @param pits       `{ drv: [{ lap, perdita }] }`, perdita in secondi.
 *
 * @returns `{ freezeLap, steps, cum, eta, ordine, ordineIniziale, esclusi }`.
 *          `cum[drv]` è un numero oppure **null esplicito**: mai un cum
 *          inventato per chi non aveva passo (E06 — errori da 480 s), mai una
 *          somma parziale spacciata per cum a fine orizzonte.
 */
export function simulate({ state, pace, freezeLap, steps, pits = {}, traccia = false }) {
  if (!interoNonNegativo(freezeLap)) throw new Error(`freezeLap deve essere intero ≥ 0: ${JSON.stringify(freezeLap)}`);
  if (!Number.isInteger(steps) || steps < 1) throw new Error(`steps deve essere intero ≥ 1: ${JSON.stringify(steps)}`);
  if (typeof pace !== 'function') throw new Error('pace deve essere una funzione (pilota, giro, età) → secondi | null');
  if (!Array.isArray(state)) throw new Error('state deve essere un elenco di voci al congelamento');

  const piloti = new Set();
  for (const voce of state) {
    const drv = voce?.drv;
    if (typeof drv !== 'string' || drv === '') throw new Error(`voce di stato senza pilota: ${JSON.stringify(voce)}`);
    if (piloti.has(drv)) throw new Error(`pilota ripetuto nello stato: ${drv}`);
    if (!Number.isInteger(voce.lap)) throw new Error(`voce di stato di ${drv} senza giro intero: ${JSON.stringify(voce.lap)}`);
    if (voce.lap > freezeLap) {
      throw new Error(`stato di ${drv} al giro ${voce.lap}, oltre il congelamento ${freezeLap}: nei percorsi a congelamento entra solo informazione ≤ Lf (E14)`);
    }
    piloti.add(drv);
  }

  const soste = normalizzaSoste(pits, piloti);
  const orizzonte = [];
  for (let i = 1; i <= steps; i += 1) orizzonte.push(freezeLap + i);
  for (const [drv, perGiro] of soste) {
    for (const lap of perGiro.keys()) {
      if (!orizzonte.includes(lap)) {
        throw new Error(`sosta di ${drv} al giro ${lap} fuori dall'orizzonte [${orizzonte[0]}, ${orizzonte[orizzonte.length - 1]}]: una sosta che non succede è un no-op silenzioso`);
      }
    }
  }

  const cum = {};
  const eta = {};
  const esclusi = [];
  // La traccia per giro serve a chi deve VALIDARE l'output, non solo leggerlo:
  // il Director ragiona su celle, non su cumulati. È opzionale perché è l'unico
  // pezzo di questa funzione che costa memoria proporzionale all'orizzonte.
  const tracce = traccia ? {} : null;
  const escludi = (drv, motivo) => {
    cum[drv] = null;
    eta[drv] = null;
    if (tracce) tracce[drv] = null; // niente traccia parziale: sarebbe un cum a metà (E06)
    esclusi.push({ drv, motivo });
  };

  for (const voce of state) {
    const { drv, cum_time, tyre_age } = voce;
    if (voce.lap < freezeLap) {
      escludi(drv, `stato fermo al giro ${voce.lap}, non aggiornato al congelamento ${freezeLap}`);
      continue;
    }
    if (cum_time === null || cum_time === undefined) {
      escludi(drv, 'cum_time assente al congelamento');
      continue;
    }
    if (typeof cum_time !== 'number' || !Number.isFinite(cum_time)) {
      throw new Error(`cum_time di ${drv} né numero né assenza: ${JSON.stringify(cum_time)}`);
    }
    if (tyre_age === null || tyre_age === undefined) {
      escludi(drv, 'età gomma assente al congelamento');
      continue;
    }
    if (typeof tyre_age !== 'number' || !Number.isFinite(tyre_age) || tyre_age < 0) {
      throw new Error(`tyre_age di ${drv} non utilizzabile: ${JSON.stringify(tyre_age)}`);
    }

    const perGiro = soste.get(drv);
    let c = cum_time;
    let e = tyre_age; // età alla FINE del giro precedente
    let completo = true;
    const passi = tracce ? [] : null;

    for (const giro of orizzonte) {
      const etaDelGiro = e + 1;
      const t = pace(drv, giro, etaDelGiro);
      if (t === null || t === undefined) {
        // Regola 6: qui finisce la corsa di questo pilota. Il cum accumulato
        // fin qui NON diventa il suo risultato: sarebbe un numero che sembra
        // vero (E06).
        escludi(drv, `passo assente al giro ${giro}`);
        completo = false;
        break;
      }
      if (typeof t !== 'number' || !Number.isFinite(t)) {
        throw new Error(`pace(${drv}, ${giro}, ${etaDelGiro}) ha restituito ${JSON.stringify(t)}: né secondi né null`);
      }
      c += t;
      const perdita = perGiro?.get(giro);
      const inLap = perdita !== undefined;
      if (inLap) {
        c += perdita;
        e = 0; // la sosta monta il set nuovo: al giro dopo l'età è 1
      } else {
        e = etaDelGiro;
      }
      // La traccia riporta ciò che il kernel SA: `out_lap` non c'è, perché
      // dipende anche dallo stato al congelamento (un pilota può essere entrato
      // ai box proprio al giro Lf) e quello lo conosce chi ha costruito lo
      // scenario, non il kernel.
      if (passi) {
        passi.push({ lap: giro, lap_time: inLap ? t + perdita : t, cum_time: c, tyre_age: etaDelGiro, in_lap: inLap });
      }
    }

    if (completo) {
      cum[drv] = c;
      eta[drv] = e;
      if (tracce) tracce[drv] = passi;
    }
  }

  // Un pari merito non è una risposta: l'ordine alfabetico a parità di cum è
  // solo determinismo del golden, non una previsione su chi passa (il duello
  // non si simula).
  const perCum = (mappa) => (a, d) => (mappa[a] - mappa[d]) || (a < d ? -1 : a > d ? 1 : 0);
  const cumIniziale = Object.fromEntries(
    state.filter((v) => typeof v.cum_time === 'number').map((v) => [v.drv, v.cum_time]),
  );

  return {
    freezeLap,
    steps,
    cum,
    eta,
    ...(tracce ? { traccia: tracce } : {}),
    ordine: Object.keys(cum).filter((d) => cum[d] !== null).sort(perCum(cum)),
    ordineIniziale: Object.keys(cumIniziale).sort(perCum(cumIniziale)),
    esclusi: esclusi.sort((a, d) => (a.drv < d.drv ? -1 : a.drv > d.drv ? 1 : 0)),
  };
}

/**
 * QUANTI cambi di posizione, non QUALI. Conta i piloti che hanno cambiato
 * indice fra i due ordini, sull'intersezione dei due elenchi: chi è uscito per
 * mancanza di passo non genera un finto sorpasso.
 */
export function cambiDiPosizione(ordinePrima, ordineDopo) {
  if (!Array.isArray(ordinePrima) || !Array.isArray(ordineDopo)) throw new Error('gli ordini devono essere elenchi');
  const comuni = new Set(ordineDopo.filter((d) => ordinePrima.includes(d)));
  const prima = ordinePrima.filter((d) => comuni.has(d));
  const dopo = ordineDopo.filter((d) => comuni.has(d));
  return prima.reduce((n, drv, i) => n + (dopo[i] === drv ? 0 : 1), 0);
}

/**
 * Costruisce lo stato al congelamento dai record di Provenienza
 * (`{ drv, lap, cella }`), leggendo SOLO le celle al giro Lf: il futuro non
 * viene guardato, quindi il risultato è identico su dati interi e troncati
 * (regola 5, E15 — sentinella s11). Un pilota senza cella a Lf non sparisce in
 * silenzio: entra con cum_time null e il kernel lo escluderà con un motivo.
 */
export function statoAlCongelamento(righe, freezeLap) {
  if (!interoNonNegativo(freezeLap)) throw new Error(`freezeLap deve essere intero ≥ 0: ${JSON.stringify(freezeLap)}`);
  const alCongelamento = new Map();
  const tuttiIPiloti = new Set();
  for (const { drv, lap, cella } of righe) {
    tuttiIPiloti.add(drv);
    if (lap !== freezeLap) continue;
    if (alCongelamento.has(drv)) throw new Error(`due celle per ${drv} al giro ${freezeLap}`);
    alCongelamento.set(drv, cella);
  }
  return [...tuttiIPiloti].sort().map((drv) => {
    const cella = alCongelamento.get(drv);
    return {
      drv,
      lap: freezeLap,
      cum_time: cella ? cella.cum_time : null,
      tyre_age: cella ? cella.tyre_age : null,
    };
  });
}
