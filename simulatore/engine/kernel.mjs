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

// LA NEUTRALIZZAZIONE, ed e' l'unica cosa in questo file che guarda due auto
// insieme. Va spiegata, perche' sembra contraddire la riga piu' importante qui
// sopra.
//
// «Le auto non interagiscono» riguarda i DUELLI: chi passa chi, la difesa, la
// scia. Quelli non si simulano, e continuano a non simularsi. Una Safety Car non
// e' un duello: e' un vincolo ESTERNO imposto a tutto il campo insieme, che
// nessuna auto sceglie e nessuna puo' rifiutare. Misurato sul fondo: sotto SC il
// distacco dal leader si contrae del 31% a ogni giro (kappa 0,691, IC95
// [0,614; 0,772] su 71 gare), sotto VSC del 7% (kappa 0,930). In verde CRESCE
// dell'1-3%, ed e' il passo a produrlo — per questo la compressione sostituisce
// l'evoluzione da passo dentro la finestra, invece di sommarcisi.
//
// Senza questo termine il motore proietta passo verde durante una Safety Car e
// sbaglia il distacco di tutto cio' che la Safety Car ha compattato: e' il
// difetto da 1,964 s/giro sotto regime contro 0,033 in verde.
//
// KAPPA E' PER GIRO, non una costante con una finestra. Non e' una complicazione:
// e' un parametro IN MENO. La finestra era una soglia scelta con una regola
// («finche' il regime dura in almeno meta' dei casi»), e trattava una durata
// ALEATORIA come certa — misurato: comprimeva del 28% a giro anche nel 43% dei
// casi in cui a L+2 la Safety Car era gia' rientrata. Con kappa per giro chi
// costruisce lo scenario puo' pesarlo per la probabilita' che il regime sia
// ancora in corso, e la compressione si spegne da sola.
//
// `null` o mappa vuota -> termine spento, e i numeri sono identici al bit a prima
// che esistesse. Protocollo e cancello: ai_lab/confronto/PREREG_neutralizzazione.md.
function normalizzaNeutralizzazione(neutralizzazione, freezeLap, steps) {
  if (neutralizzazione === null || neutralizzazione === undefined) return null;
  if (typeof neutralizzazione !== 'object') throw new Error(`neutralizzazione non utilizzabile: ${JSON.stringify(neutralizzazione)}`);
  const { perGiro } = neutralizzazione;
  if (perGiro === null || typeof perGiro !== 'object') {
    throw new Error(`neutralizzazione.perGiro deve essere una mappa giro -> kappa: ${JSON.stringify(perGiro)}`);
  }
  const mappa = new Map();
  for (const [chiave, k] of Object.entries(perGiro)) {
    const lap = Number(chiave);
    if (!Number.isInteger(lap)) throw new Error(`neutralizzazione: giro non intero ${JSON.stringify(chiave)}`);
    if (typeof k !== 'number' || !Number.isFinite(k) || k <= 0) {
      throw new Error(`neutralizzazione: kappa al giro ${lap} non utilizzabile (serve un numero > 0): ${JSON.stringify(k)}`);
    }
    if (lap <= freezeLap || lap > freezeLap + steps) {
      throw new Error(`neutralizzazione al giro ${lap}, fuori dall'orizzonte [${freezeLap + 1}, ${freezeLap + steps}]: una compressione che non succede e' un no-op silenzioso`);
    }
    if (k !== 1) mappa.set(lap, k);   // kappa = 1 non e' compressione: non crea un percorso
  }
  return mappa.size === 0 ? null : mappa;
}

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
      const { lap, perdita, mescola = null } = sosta ?? {};
      if (!Number.isInteger(lap)) throw new Error(`sosta di ${drv} senza giro intero: ${JSON.stringify(sosta)}`);
      if (typeof perdita !== 'number' || !Number.isFinite(perdita) || perdita < 0) {
        throw new Error(`sosta di ${drv} al giro ${lap} senza perdita dichiarata e finita ≥ 0: ${JSON.stringify(perdita)} (E07: niente numeri di riserva)`);
      }
      if (perGiro.has(lap)) throw new Error(`due soste di ${drv} sullo stesso giro ${lap}`);
      // LA MESCOLA VIAGGIA CON LA SOSTA dal 04/08/2026. Prima si teneva {lap, perdita} e
      // la gomma montata veniva buttata via qui: e' la ragione MECCANICA per cui premere
      // BOX NOW non permetteva di scegliere la mescola — la scelta non arrivava mai al
      // motore. Resta opzionale (`null`): chi non la passa ha i numeri di prima.
      perGiro.set(lap, { perdita, mescola });
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
export function simulate({ state, pace, freezeLap, steps, pits = {}, neutralizzazione = null, tetto = null, traccia = false, ritiri = null }) {
  if (tetto !== null) {
    if (typeof tetto !== 'object') throw new Error(`tetto non utilizzabile: ${JSON.stringify(tetto)}`);
    for (const k of ['minGap', 'sogliaSorpasso', 'costoDuello', 'costoSubito']) {
      const v = tetto[k];
      if (typeof v !== 'number' || !Number.isFinite(v) || v < 0) throw new Error(`tetto.${k} non utilizzabile (serve un numero ≥ 0): ${JSON.stringify(v)}`);
    }
  }
  // I RITIRI DICHIARATI ({drv: ultimo giro percorso}) sono un ingresso di
  // LABORATORIO, il gemello delle soste vere: informazione dal futuro, lecita
  // solo a gara finita, e il costruttore la dichiara (RITIRI_VERI_DEI_RIVALI).
  // Il default null e' la produzione: nessuno sparisce mai (la regola resta).
  // Un oggetto vuoto o assente e' bit-identico a null (sentinella s41).
  if (ritiri !== null) {
    if (typeof ritiri !== 'object' || Array.isArray(ritiri)) throw new Error(`ritiri non utilizzabile: ${JSON.stringify(ritiri)}`);
    for (const [drv, lap] of Object.entries(ritiri)) {
      if (!Number.isInteger(lap) || lap < 0) throw new Error(`ritiri.${drv} non utilizzabile (serve il suo ultimo giro, intero ≥ 0): ${JSON.stringify(lap)}`);
    }
  }
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
  const neutra = normalizzaNeutralizzazione(neutralizzazione, freezeLap, steps);
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
  const ritirati = [];
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

  // ── validazione dello stato, e lo stato di marcia di ogni pilota ──────────
  // Il ciclo è PER GIRO e poi per pilota, non il contrario. Ci è voluto per la
  // neutralizzazione — comprimere un distacco richiede tutto il campo allo
  // stesso giro — e a termine spento produce esattamente gli stessi numeri:
  // ogni pilota accumula il suo cum indipendentemente, come prima.
  const marcia = [];
  for (const voce of state) {
    const { drv, cum_time, tyre_age, mescola = null } = voce;
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
    marcia.push({
      drv,
      c: cum_time,
      e: tyre_age,            // età alla FINE del giro precedente
      m: mescola,             // la gomma MONTATA adesso: cambia a ogni sosta
      attivo: true,
      passi: tracce ? [] : null,
      perGiro: soste.get(drv),
    });
  }

  for (const giro of orizzonte) {
    // ── i ritiri dichiarati escono QUI, prima di ogni interazione del giro ──
    // Chi ha corso il suo ultimo giro vero non compare piu': niente compressione,
    // niente tetto, niente classifica per un pilota che a questo giro non c'era
    // (sentinella s41: ritiro al congelamento == assenza dallo stato). La sua
    // storia parziale resta nella traccia — il ritiro e' la verita', non un cum
    // a meta' (non e' il caso E06) — e il suo posto e' in `ritirati`, mai in
    // `ordine`: un cum di 30 giri non si confronta con uno di 57.
    if (ritiri !== null) {
      for (const m of marcia) {
        if (!m.attivo) continue;
        const ultimo = ritiri[m.drv];
        if (ultimo === undefined || giro <= ultimo) continue;
        m.attivo = false;
        cum[m.drv] = null;
        eta[m.drv] = null;
        if (tracce) tracce[m.drv] = m.passi;
        ritirati.push({ drv: m.drv, lap: ultimo, cum: m.c });
      }
    }
    // Il leader e i distacchi PRIMA di avanzare: la compressione è definita
    // come gap(k+1) = gap(k)·κ, cioè sul distacco di fine giro precedente. È
    // la stessa costruzione con cui κ è stato misurato sul fondo.
    const kappaDelGiro = neutra === null ? undefined : neutra.get(giro);
    const comprime = kappaDelGiro !== undefined;
    let capofila = null;
    const gapPrima = new Map();
    if (comprime) {
      for (const m of marcia) {
        if (!m.attivo) continue;
        if (capofila === null || m.c < capofila.c) capofila = m;
      }
      if (capofila) for (const m of marcia) if (m.attivo) gapPrima.set(m.drv, m.c - capofila.c);
    }

    // L'ordine a INIZIO giro, catturato prima che qualcuno percorra il giro: serve al
    // tetto al movimento, che deve sapere chi era davanti a chi PRIMA (vedi sotto).
    // Costa una copia ordinata per giro solo quando il tetto e' acceso.
    const ordineInizioGiro = tetto === null ? null
      : marcia.filter((m) => m.attivo).sort((a, d) => (a.c - d.c) || (a.drv < d.drv ? -1 : a.drv > d.drv ? 1 : 0));

    const fermiQuestoGiro = new Set();
    for (const m of marcia) {
      if (!m.attivo) continue;
      const etaDelGiro = m.e + 1;
      const t = pace(m.drv, giro, etaDelGiro, m.m);
      if (t === null || t === undefined) {
        // Regola 6: qui finisce la corsa di questo pilota. Il cum accumulato
        // fin qui NON diventa il suo risultato: sarebbe un numero che sembra
        // vero (E06).
        escludi(m.drv, `passo assente al giro ${giro}`);
        m.attivo = false;
        continue;
      }
      if (typeof t !== 'number' || !Number.isFinite(t)) {
        throw new Error(`pace(${m.drv}, ${giro}, ${etaDelGiro}) ha restituito ${JSON.stringify(t)}: né secondi né null`);
      }
      m.c += t;
      const sosta = m.perGiro?.get(giro);
      const inLap = sosta !== undefined;
      const perdita = inLap ? sosta.perdita : undefined;
      if (inLap) {
        m.c += perdita;
        m.e = 0; // la sosta monta il set nuovo: al giro dopo l'età è 1
        // LA GOMMA CAMBIA QUI, ed e' l'unico punto in cui cambia. Se la sosta non dichiara
        // la mescola si tiene quella di prima: un'assenza non diventa una gomma nuova
        // inventata (regola 6), e con `vita` spento non fa differenza comunque.
        if (sosta.mescola !== null && sosta.mescola !== undefined) m.m = sosta.mescola;
        fermiQuestoGiro.add(m.drv);
      } else {
        m.e = etaDelGiro;
      }
      m.ultimoGiro = { lap: giro, lap_time: inLap ? t + perdita : t, cum_time: null, tyre_age: etaDelGiro, in_lap: inLap };
    }

    // ── la compressione, dopo che tutti hanno percorso il giro ──────────────
    // Chi è ENTRATO AI BOX in questo giro non si comprime: il suo distacco lo
    // decide la sosta, non la vettura di sicurezza — ed è esattamente il caso
    // che la misura di κ escludeva (né pilota né leader in in-lap o out-lap).
    if (comprime && capofila !== null && capofila.attivo && !fermiQuestoGiro.has(capofila.drv)) {
      for (const m of marcia) {
        if (!m.attivo || m.drv === capofila.drv) continue;
        if (fermiQuestoGiro.has(m.drv)) continue;
        const g = gapPrima.get(m.drv);
        if (g === undefined) continue;
        m.c = capofila.c + g * kappaDelGiro;
      }
    }

    // ── IL TETTO AL MOVIMENTO: le auto smettono di attraversarsi ───────────
    //
    // Senza questo vincolo due cum possono scavalcarsi liberamente, e il campo si
    // rimescola più di quanto la pista consenta. È la causa dichiarata della
    // popolazione che perde 13-28 contro il non-fare-niente: dove il motore inventa
    // movimento, sbaglia. Il referto gara-intera indica questa — un TETTO, non una
    // probabilità di sorpasso — come unica strada permessa.
    //
    // NON SOTTO NEUTRALIZZAZIONE, ed è una scelta dichiarata: lì la spaziatura la
    // detta la vettura di sicurezza, e il fattore di compressione è una MISURA sul
    // fondo. Un pavimento importato che scavalcasse quella misura sostituirebbe un
    // dato con un'assunzione.
    //
    // Chi è entrato ai box in questo giro resta fuori: non sta duellando, e il suo
    // distacco lo decide la sosta. È lo stesso perimetro della compressione.
    //
    // Parametri e cancelli: ai_lab/confronto/PREREG_tetto_movimento.md.
    // `tetto` null ⇒ questo blocco non esiste e i numeri sono bit-identici.
    if (tetto !== null && !comprime) {
      // L'ORDINE DA GUARDARE È QUELLO DI INIZIO GIRO, non quello di fine.
      //
      // La prima scrittura di questo blocco ordinava per cum DOPO il giro, e la
      // sentinella s34 l'ha bocciata subito: a fine giro il sorpasso è già avvenuto,
      // quindi la coppia arriva rovesciata e il pavimento veniva applicato al
      // contrario — spingeva indietro chi era davanti. Un vincolo che impedisce i
      // sorpassi non può leggere lo stato in cui i sorpassi sono già successi.
      //
      // Chi può passare chi lo decide la posizione a INIZIO giro: si è superati solo
      // da chi era dietro.
      const inGara = ordineInizioGiro.filter((m) => m.attivo && m.ultimoGiro && !fermiQuestoGiro.has(m.drv));
      // UNA passata sola, dal primo all'ultimo, sull'ordine di inizio passata: è la
      // discretizzazione per giro dichiarata, non un'approssimazione nascosta.
      for (let i = 1; i < inGara.length; i += 1) {
        const avanti = inGara[i - 1];
        const dietro = inGara[i];
        if (dietro.c - avanti.c >= tetto.minGap) continue;      // non sono in contatto
        // il vantaggio di PASSO su questo giro, non il distacco accumulato
        const vantaggio = avanti.ultimoGiro.lap_time - dietro.ultimoGiro.lap_time;
        // IL TEMPO PERSO E' TEMPO SUL GIRO, non solo cumulato. La prima scrittura
        // muoveva `c` e lasciava intatto `lap_time`: il Director l'ha respinta subito
        // — «il cumulato non corrisponde alla somma dei tempi sul giro» — su 183 casi
        // su 223. Aveva ragione due volte: rompeva l'invariante, ed era falsa anche
        // fisicamente. Restare imbottigliato dietro qualcuno E' un giro piu' lento, e
        // deve comparire nel giro, non solo nel totale.
        const applica = (m, delta) => { m.c += delta; m.ultimoGiro.lap_time += delta; };
        if (vantaggio > tetto.sogliaSorpasso) {
          applica(avanti, tetto.costoSubito);              // il sorpasso avviene: chi lo subisce paga
        } else {
          applica(dietro, (avanti.c + tetto.minGap) - dietro.c);  // niente passo per passare: resta dietro
        }
        applica(avanti, tetto.costoDuello);                // il contatto costa a entrambi
        applica(dietro, tetto.costoDuello);
      }
    }

    // La traccia riporta ciò che il kernel SA: `out_lap` non c'è, perché
    // dipende anche dallo stato al congelamento (un pilota può essere entrato
    // ai box proprio al giro Lf) e quello lo conosce chi ha costruito lo
    // scenario, non il kernel. Il `cum_time` si scrive QUI, dopo l'eventuale
    // compressione, così la traccia è ciò che il pilota ha davvero.
    if (tracce) {
      for (const m of marcia) {
        if (!m.attivo || !m.ultimoGiro) continue;
        m.passi.push({ ...m.ultimoGiro, cum_time: m.c });   // l'ordine delle chiavi resta quello di sempre: i golden confrontano JSON
      }
    }
  }

  for (const m of marcia) {
    if (!m.attivo) continue;
    cum[m.drv] = m.c;
    eta[m.drv] = m.e;
    if (tracce) tracce[m.drv] = m.passi;
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
    // la chiave compare solo se qualcuno si e' ritirato davvero: cosi' `ritiri`
    // assente, null e {} producono lo stesso identico oggetto (s41, spento e' spento)
    ...(ritirati.length ? { ritirati: ritirati.sort((a, d) => (a.lap - d.lap) || (a.drv < d.drv ? -1 : 1)) } : {}),
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
