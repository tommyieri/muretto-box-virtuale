// muretto.mjs — IL PANNELLO. Uno solo, per la gara finita e per la gara in corso.
//
//     "Se fermo questo pilota adesso, dove rientra?"
//
// Fino al 22/07/2026 questa risposta viveva dentro gara.html, intrecciata ai suoi globali.
// Funzionava, ma valeva solo li': la pagina live non poteva chiamarla, e l'unico modo di
// avere il muretto in diretta sarebbe stato riscriverlo. Due copie della stessa risposta
// e' il modo piu' sicuro per ritrovarsi, fra un mese, con due numeri diversi per la stessa
// domanda e nessuno che sa quale credere.
//
// Qui dentro non c'e' DOM e non ci sono variabili di pagina: entra un contesto, esce HTML.
// Chi chiama porta i dati; questo modulo decide cosa si puo' dire e cosa no.
//
// COSA NON FA, ed e' il punto del prodotto: non predice la gara. Instrada UNA macchina
// dentro la gara che sta succedendo, e lascia il resto del campo dov'e' davvero. Percio'
// evoluzione pista e carburante degli altri non si modellano — sono gia' nei loro tempi —
// e l'unica cosa che deriva e' l'auto instradata.
import { evaluatePit, stessoGiroReale } from './pitscenario.mjs';
import { treScenariPit, bandaCircuito } from './pitbande.mjs';
import { misura as misuraSoste } from './gradino.mjs';
import { grossi as calcolaGrossi, trafficoRientro, pitLossPilota,
         deriva as calcolaDeriva, deltaPasso, raggruppamento, sogliaDifesa,
         meteo as cancelloMeteo, penalitaPendente } from './grossi.mjs';

// --- GRADINO DI SOSTA (acceso su decisione PO, 2026-07-22) --------------------
// Fino al 22/07 il motore non simulava NEMMENO UN GIRO dopo la sosta e non resettava la
// gomma: fermarsi al giro 12 o al 18 dava lo STESSO identico numero. L'undercut non era
// incerto, era impossibile per costruzione. Ora il pannello misura DALLA GARA IN CORSO,
// con le sole soste gia' avvenute prima del congelamento (causale: nessuno sbircia avanti).
export const GRADINO_ATTIVO = true;

// --- IL CAP DEL TRAFFICO, SPENTO (decisione PO, 22/07/2026) ------------------
// Misurato su 78 soste vere: cap acceso MAE 6,154 s e 30,4% di cambi di posizione; cap
// spento MAE 4,775 s e 24,7%, contro il 25,6% reale. Il prezzo va detto: senza cap due
// auto possono attraversarsi, quindi il motore riproduce QUANTI sorpassi avvengono, non
// QUALI.
export const CAP_TRAFFICO = false;
export const ZONE_PANNELLO = CAP_TRAFFICO ? 1.5 : 0;

// MISURATO, non scelto: a 2 soste il pit-loss vivo ha MAE 3,15 s — PEGGIORE del prior di
// circuito (2,45). A 3 soste crolla a 1,14. Sotto la terza sosta non si mostra.
export const MIN_SOSTE_UI = 3;

// Tassi storici 2026 (71 casi veri). PERIMETRO DICHIARATO, perche' in repo convivono DUE
// numeri veri e diversi: il prereg dell'undercut v2 conta 31 casi con 10 riusciti (32%),
// questa misura ne conta 71 con 17 (24%) perche' getta una rete piu' larga. Nessuno dei
// due mente: mancava dire QUALE. Una percentuale senza la sua popolazione e' il modo piu'
// educato di dire una cosa falsa.
export const UNDERCUT_STORICO = { complessivo: 0.24, n: 71,
                                  sotto1s: 0.71, n_sotto1s: 7,
                                  sopra45s: 0.00, n_sopra45s: 17,
                                  perimetro: 'gap ≤ 6 s, 1-6 giri di overlap, gare asciutte 2026' };

// DOMINIO OSSERVATO: i 71 casi hanno gap0 in (0, 6] s e 1-6 giri di sovrapposizione. Con
// un gap di 11 s "serve che resti fuori 6 giri" e' aritmetica corretta e consiglio senza
// senso: su sei giri il rivale si ferma, degrada, e il campo congelato non regge piu'.
const UC_GAP_MAX = 6.0, UC_K_MAX = 6;

export const SCENARI_ATTIVI = true;

const kv = (k, v, sub) => `<div class="kv"><span class="k">${k}</span><span class="v">${v}`
  + (sub ? ` <span class="sub">${sub}</span>` : '') + '</span></div>';

// ---------------------------------------------------------------- undercut
function rigaUndercut(C, L, gradino, sameLap) {
  // Chi ho davanti ADESSO (non al rientro: quello e' la riga "Davanti"), fra i piloti a
  // pari giro. Sono FATTI letti dal fondo, non stime.
  const cum = d => C.byLap[L][d]?.cum_time;
  const mio = cum(C.driver);
  if (typeof mio !== 'number') return '';
  const davanti = sameLap.filter(d => d !== C.driver && typeof cum(d) === 'number' && cum(d) < mio)
                         .sort((a, b) => cum(b) - cum(a))[0];
  const K = k => `<div class="kv"><span class="k">Undercut</span><span class="v">${k}</span></div>`;
  if (!davanti) return K(`<span class="dim">aria pulita davanti: non c'&egrave; nessuno da scavalcare</span>`);
  const gap0 = mio - cum(davanti);
  const perGiro = Math.abs(Math.min(gradino, 0));
  if (perGiro < 0.05)
    return K(`${davanti} a ${gap0.toFixed(1)} s <span class="sub">oggi la gomma nuova non rende: qui conta la track position</span>`);
  if (gap0 > UC_GAP_MAX)
    return K(`${davanti} &egrave; a ${gap0.toFixed(1)} s <span class="sub">troppo lontano: fuori dai casi osservati nel 2026 (max ${UC_GAP_MAX.toFixed(0)} s)</span>`);
  const giri = Math.ceil(gap0 / perGiro);
  if (giri > UC_K_MAX)
    return K(`${davanti} a ${gap0.toFixed(1)} s <span class="sub">servirebbero pi&ugrave; di ${UC_K_MAX} giri di vantaggio: fuori dominio</span>`);
  const storico = gap0 < 1.0
    ? `sotto 1 s nel 2026 &egrave; riuscito ${Math.round(UNDERCUT_STORICO.sotto1s * 100)}% (${UNDERCUT_STORICO.n_sotto1s} casi)`
    : gap0 > 4.5
      ? `sopra 4,5 s nel 2026 non &egrave; <b>mai</b> riuscito (0 su ${UNDERCUT_STORICO.n_sopra45s})`
      : `nel 2026 riesce nel ${Math.round(UNDERCUT_STORICO.complessivo * 100)}% dei tentativi (${UNDERCUT_STORICO.n} casi, ${UNDERCUT_STORICO.perimetro})`;
  // "davanti a te ADESSO" e' un'altra cosa dalla riga "Davanti", che dice chi ti trovi
  // davanti DOPO il rientro. Due momenti diversi, due nomi che possono non coincidere.
  return K(`su <b>${davanti}</b>, ${gap0.toFixed(1)} s davanti a te <i>adesso</i> &rarr; serve che resti fuori <b>${giri} ${giri === 1 ? 'giro' : 'giri'}</b> in pi&ugrave;
    <span class="sub">${storico}</span>`);
}

// ------------------------------------------------------- scenari di degrado
// SCENARI, non previsioni: banda storica del circuito pesata al 2026. Interruttori di
// sicurezza: niente bande (Monaco/circuito non informativo) o sotto neutralizzazione ->
// torna '' e il pannello resta sulla risposta base a passo piatto.
function scenariDegrado(C, L, pitL, loss, present, neutro) {
  if (!SCENARI_ATTIVI || neutro) return '';
  const bc = bandaCircuito(C.bandeClim, C.gara);
  if (!bc) return '';
  const sc = treScenariPit({ byLap: C.byLap, nLaps: C.nLaps, pace: C.pace,
    driver: C.driver, freezeLap: L, pitLap: pitL, pitLoss: loss, present, banda: bc.banda });
  if (!sc.ok || !sc.degrada) return '';
  const nGiri = pitL - L;
  const cella = e => {
    const dav = e.davanti_ho ? `+${e.gap_ahead.toFixed(1)}s` : 'aria pulita';
    const die = e.dietro_esco ? `+${e.gap_behind.toFixed(1)}s` : '—';
    return `<td>P${e.rientro_pos}</td><td>${dav}</td><td>${die}</td>`;
  };
  return `<div class="scenari">
    <div class="sc-h">Con degrado gomma sui prossimi ${nGiri} giri
      <span class="sc-tag">SCENARI · banda storica ${sc.compound}, non una previsione</span></div>
    <table class="sc-t"><thead><tr><th>scenario</th><th>rientro</th><th>davanti</th><th>dietro</th></tr></thead>
    <tbody>
      <tr><td class="sc-o">ottimistico</td>${cella(sc.ottimistico)}</tr>
      <tr><td class="sc-c">centrale</td>${cella(sc.centrale)}</tr>
      <tr><td class="sc-p">pessimistico</td>${cella(sc.pessimistico)}</tr>
    </tbody></table></div>`;
}

/**
 * IL PANNELLO. Contesto -> {ok, titolo, html}.
 *
 * C = {
 *   byLap, nLaps, pace,        la gara (pace = la riga del giro di congelamento)
 *   laps,                      opzionale: finestre di neutralizzazione della gara
 *   gara,                      nome demo, per le bande climatologiche (live: null)
 *   circuitId,                 per probabilita' SC e soglia di difesa (live: dal calendario)
 *   driver, freezeLap, pitLap,
 *   pitLossTabella,            prior di circuito [s]
 *   penalita,                  penalita' race control del pilota, o null
 *   nonParten,                 Set di chi non e' partito (live: vuoto)
 *   neutroFondo, ragg, bandeClim,   tabelle dal fondo 2018-2026
 * }
 */
export function pannelloMuretto(C) {
  const L = C.freezeLap, pitL = C.pitLap;
  const nonParten = C.nonParten || new Set();
  const present = Object.keys(C.byLap[L] || {})
    .filter(d => typeof C.byLap[L][d].cum_time === 'number' && !nonParten.has(d));
  const lossTab = C.pitLossTabella ?? 22.0;

  // sotto SC/VSC il gradino non si applica: va saputo PRIMA di chiamare il motore
  const neutroPre = () => !!(C.byLap[pitL] && C.byLap[pitL][C.driver]
                             && C.byLap[pitL][C.driver].neutralized);

  // I due numeri della gara IN CORSO, dalle sole soste gia' avvenute prima del freeze.
  const viva = GRADINO_ATTIVO ? misuraSoste(C.byLap, C.nLaps, L)
                              : { perdita: null, gradino: null, n_gradino: 0, n_perdita: 0 };
  const usaViva = viva.perdita != null && viva.n_perdita >= MIN_SOSTE_UI;

  // PENALITA PENDENTE — misurato sul 2026: l'82% delle penalita' di tempo si sconta ALLA
  // SOSTA SUCCESSIVA, cioe' esattamente nel momento che il pannello sta simulando. Entra
  // quindi NEL COSTO, non accanto: il cliente deve leggere UN numero, quello vero per lui.
  // Le penalita' POST-GARA restano fuori: quelle si mostrano e non si simulano.
  const pen = penalitaPendente(C.penalita, L, pitL);
  const lossBase = usaViva ? viva.perdita : lossTab;
  const loss = lossBase + (pen.secondi || 0);
  const gradino = (viva.gradino != null && viva.n_gradino >= MIN_SOSTE_UI) ? viva.gradino : null;

  // LA DERIVA DEL CAMPO. Il resto della griglia e' reale: la sua evoluzione e il suo
  // carburante sono gia' nei tempi veri. Solo la macchina instradata rischia di restare
  // ferma mentre la gara scorre — quindi la deriva tocca lei e nessun altro.
  const der = neutroPre() ? null : calcolaDeriva(C.byLap, C.nLaps, L);
  const derVal = (der && der.stato === 'MISURATO') ? der.valore : null;

  const r = evaluatePit({ byLap: C.byLap, nLaps: C.nLaps, pace: C.pace, driver: C.driver,
    freezeLap: L, pitLap: pitL, pitLoss: loss, present, gara: C.gara, laps: C.laps,
    orizzonte: (gradino != null && !neutroPre()) ? 5 : 0,
    gradino, ZONE: ZONE_PANNELLO, deriva: derVal });

  if (!r.ok) {
    // traduzione UI del limite dichiarato del motore: chi e' appena passato dai box non
    // ha passo-base al congelamento — spiegarlo, non citare solo il codice
    const c = C.byLap[L]?.[C.driver];
    return { ok: false, html: (c && (c.in_lap || c.out_lap))
      ? `<div class="pitmsg">${C.driver} &egrave; appena passato dai box: il motore non ha ancora un passo-base per valutarlo. Fai scorrere la gara di un giro o due, o sposta il cursore pi&ugrave; avanti.</div>`
      : `<div class="pitmsg">Non valutabile a questo giro (${r.reason}).</div>` };
  }

  const neutro = r.sotto_neutralizzazione === true;
  const gapTxt = (nome, gap) => {
    if (!nome) return '<span class="g">—</span>';
    if (neutro || gap == null) return `${nome} <span class="sub">gap n/d sotto neutralizzazione</span>`;
    return `${nome} <span class="g">+${gap.toFixed(1)}s</span>`;
  };
  const dav = r.davanti_ho ? gapTxt(r.davanti_ho, r.gap_ahead) : '<span class="g">aria pulita</span>';
  const die = gapTxt(r.dietro_esco, r.gap_behind);
  const ng = r.neutralizzazione_gara || {};
  const warn = ng.finestra_attiva
    ? `<div class="warn">⚠ Pit in finestra ${ng.tipo} (giri ${ng.finestra[0]}–${ng.finestra[1]}, durata tipica ${ng.durata_tipica} giri): il pit-loss verde qui sovrastima la perdita reale.</div>`
    : '';
  // Provenienza del pit-loss: la misura di OGGI batte la tabella (0,48 s contro 1,11 s di
  // scarto mediano dal realizzato), ma va detto DA DOVE viene, sempre.
  const provPL = pen.secondi
    ? `<span class="sub">${lossBase.toFixed(1)} + ${pen.nota} &middot; ${pen.limite}</span>`
    : (usaViva
      ? `<span class="sub">misurato oggi su ${viva.n_perdita} soste &middot; tabella ${lossTab.toFixed(1)}</span>`
      : '<span class="sub">stima di circuito &middot; nessuna sosta ancora misurabile</span>');
  const rigaGradino = (gradino != null && !neutro)
    ? `<div class="kv"><span class="k">Gomma nuova</span><span class="v num">${gradino.toFixed(2)} s/giro
         <span class="sub">misurato oggi su ${viva.n_gradino} soste</span></span></div>`
    : (GRADINO_ATTIVO && !neutro
      ? `<div class="kv"><span class="k">Gomma nuova</span><span class="v dim">non ancora misurabile: servono ${MIN_SOSTE_UI} soste in gara</span></div>`
      : '');
  // stessi piloti a pari giro che usa il motore: l'undercut su un doppiato non esiste
  const sameLap = stessoGiroReale(C.byLap, L, C.nLaps, C.driver, present);
  const rigaUC = (gradino != null && !neutro) ? rigaUndercut(C, L, gradino, sameLap) : '';
  const notaCap = CAP_TRAFFICO ? '' :
    `<div class="kv"><span class="k">Duelli</span><span class="v dim">il motore riproduce
     <b>quanti</b> cambi di posizione avvengono, non <b>quali</b>: il duello in pista non &egrave; simulato</span></div>`;

  // --- I GROSSI, misurati da questa gara (demo/grossi.mjs) ---------------------
  const G = calcolaGrossi(C.byLap, C.nLaps, L, { priorPitLoss: lossTab, neutro });
  // IL CANCELLO METEO — non un modello: due stati. Si accende dalla MESCOLA del campo, mai
  // dal flag di pioggia (verificato inaffidabile). Quando e' acceso i numeri del pannello
  // non valgono: pit-loss, degrado e gomma nuova sono misurati TUTTI su asciutto, e dentro
  // un passaggio di mescola il passo si muove di 3 s/giro — cento volte quei numeri.
  const met = cancelloMeteo(C.byLap, C.nLaps, L);
  let righeGrossi = '';
  if (met.stato === 'FUORI_DOMINIO')
    righeGrossi += `<div class="warn">⛔ ${met.nota}<span class="sub">${met.limite}</span></div>`;

  if (G.stato !== 'SOSPESO' && met.stato !== 'FUORI_DOMINIO') {
    // quanto ci mette LA SUA squadra rispetto alla pista
    const plp = pitLossPilota(G.pit_loss, C.byLap[L]?.[C.driver]?.team);
    if (plp.nota_squadra) righeGrossi += kv('Box della squadra', plp.nota_squadra,
      'il transito e della pista, questo e della squadra: si muovono separati');
    // degrado letto dalla SOSTA, non dentro lo stint
    const d = G.degrado;
    if (d.stato === 'MISURATO')
      righeGrossi += kv('Degrado', `${d.valore.toFixed(2)} s/giro per ogni giro di vita gomma`,
        `letto da ${d.n} soste di oggi &middot; degrado + evoluzione pista insieme`);
    // warm-up della mescola che monterebbe
    const cmpNuovo = C.byLap[L]?.[C.driver]?.compound;
    const w = cmpNuovo && G.warm_up.per_mescola?.[cmpNuovo];
    if (w && w.stato === 'MISURATO')
      righeGrossi += kv('Primo giro su gomma nuova',
        `${w.valore >= 0 ? '+' : ''}${w.valore.toFixed(2)} s`,
        `${cmpNuovo} misurato su ${w.n} soste &middot; mangia parte dell'undercut`);
    // DELTA-PASSO: non e' un modello, e' una sottrazione. Il rivale davanti al rientro ha
    // tempi VERI e gia' noti; io dopo la sosta sono passo + gradino. La differenza dice
    // quanto DURA l'incontro. PASSO CONTRO PASSO, senza il gradino: sommarlo al mio e
    // confrontarlo col passo MEDIO del rivale e' un doppio conteggio, e a Spagna dava
    // 2,31 s/giro di vantaggio dove i tempi veri ne dicono 0,37.
    const pc = C.pace || {};
    if (r.davanti_ho && pc[r.davanti_ho] != null && pc[C.driver] != null) {
      const dp = deltaPasso({ paceIo: pc[C.driver], paceRivale: pc[r.davanti_ho],
                              gap: r.gap_ahead, rivale: r.davanti_ho });
      if (dp.stato === 'MISURATO')
        righeGrossi += kv('Delta-passo', dp.lettura,
          dp.intrappolato ? 'la U rovesciata: i piu bloccati non sono i lenti, sono quelli appena piu veloci'
                          : null);
    }
    // LA DERIVA: quanto scorre la gara, e quindi di quanto la mia auto si muove con essa
    if (der && der.stato === 'MISURATO')
      righeGrossi += kv('Come scorre la gara', der.nota,
        `misurata sugli ultimi ${der.n} giri del campo &middot; carburante ed evoluzione pista insieme`);
    else if (der && der.stato === 'FUORI_DOMINIO')
      righeGrossi += kv('Come scorre la gara', '<span class="dim">non leggibile adesso</span>', der.nota);

    // LA SAFETY CAR — UNA RIGA SOLA, e non e' il costo della sosta.
    // Qui c'era anche "quanto costa fermarsi sotto neutralizzazione", dal rapporto
    // SC/verde per circuito. TOLTA il 22/07/2026 su decisione del PO, e la ragione va
    // scritta perche' e' una lezione e non una preferenza: quel rapporto poggia su 3-4
    // gare per pista, e su un caso reale di Silverstone ha prodotto la risposta
    // ROVESCIATA — diceva "il leader resta davanti di 6 s" dove il fondo, su 286 casi
    // identici, dice che chi insegue passa nel 61%. Resta l'ESITO OSSERVATO, che e' la
    // risposta e non i suoi ingredienti.
    const probSC = C.neutroFondo?.per_circuito?.[C.circuitId]?.probabilita ?? null;
    const rg = raggruppamento(r.gap_behind, C.ragg);
    const sd = sogliaDifesa(C.circuitId, C.ragg);
    if (rg.stato === 'MISURATO' && rg.quota >= 0.35) {
      const quanto = sd.stato === 'MISURATO' ? ` &mdash; ${sd.nota} (${sd.limite})` : '';
      const ctx = probSC != null
        ? `${rg.contesto} &middot; su questa pista una Safety Car arriva nel ${Math.round(probSC * 100)}% delle gare`
        : rg.contesto;
      righeGrossi += `<div class="warn">⚠ Se esce la Safety Car subito dopo: ${rg.nota}${quanto}`
        + `<span class="sub">${ctx} &middot; ${rg.limite}</span></div>`;
    } else if (sd.stato === 'MISURATO' && r.gap_behind != null) {
      righeGrossi += kv('Margine sulla Safety Car',
        `hai ${r.gap_behind.toFixed(1)} s su chi ti insegue, ${sd.nota}`, sd.limite);
    }
    // traffico al rientro: parla solo dove morde davvero
    const t = trafficoRientro(r.gap_ahead);
    if (t.stato === 'MISURATO')
      righeGrossi += `<div class="warn">⚠ ${t.nota} <span class="sub">${t.limite}</span></div>`;
  }

  const html = warn + `
    <div class="kv"><span class="k">Pit-loss</span><span class="v num">+${loss.toFixed(1)} s ${provPL}</span></div>
    <div class="kv"><span class="k">Rientro</span><span class="v">P${r.rientro_pos} <span class="sub">tra i ${r.su_totale} a pari giro</span></span></div>
    <div class="kv"><span class="k">Davanti</span><span class="v">${dav}</span></div>
    <div class="kv"><span class="k">Dietro</span><span class="v">${die}</span></div>
    ${rigaGradino}
    ${rigaUC}
    ${righeGrossi}
    ${notaCap}
    ${scenariDegrado(C, L, pitL, loss, present, neutro)}`;
  return { ok: true, html, rientro: r.rientro_pos, su_totale: r.su_totale, motore: r };
}
