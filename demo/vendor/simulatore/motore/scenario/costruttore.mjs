// ————————————————————————————————————————————————————————————————————————
// ARTEFATTO GENERATO — non modificare qui.
//   sorgente: simulatore/scenario/costruttore.mjs
//   generato: simulatore/web/trasporta_motore.mjs
// Vercel serve demo/ come radice e non vede simulatore/: questa copia esiste
// solo per essere ESEGUITA dal pannello live, dove il pre-calcolo non puo'
// esistere. Modificare QUESTO file lo fa divergere dall'originale, e
// `node web/trasporta_motore.mjs --verifica` fallisce (lo esegue la CI).
// ————————————————————————————————————————————————————————————————————————
// costruttore.mjs — il COSTRUTTORE DI SCENARI, uno solo (E17).
//
// Nel vecchio repo due risposte adiacenti avevano due fisiche: `confrontaPit`
// rispondeva senza SC e senza deriva, `evaluatePit` con. Le due risposte si
// contraddicevano e nessuno sapeva quale credere. Qui "dove rientri" e "quando
// fermarti" CHIAMANO ENTRAMBE questa funzione: se un giorno la fisica cambia,
// cambia per tutte e due nello stesso commit, o non cambia affatto.
//
// L'ORIZZONTE si lega allo scenario e al modello, non a un parametro morto
// (E20): il giro finale è la fine della gara, e il modello dichiara fin dove è
// stato validato — se si va oltre, l'assunzione viene messa a referto invece di
// restare implicita in una costante che nessuno ricorda perché è lì.
//
// Ogni assunzione esce DICHIARATA nel risultato, con il conteggio di quante
// volte è stata applicata. Un'assunzione che non si vede è un'assunzione che
// nessuno può contestare.

import { regimeNeutralizzato, passoUtilizzabile } from '../provenienza/definizioni.mjs';
import { simboliStatus, MESCOLE_SLICK } from '../provenienza/vocabolario.mjs';
import { osservazioniVerdi } from '../provenienza/gare_indice.mjs';
import { perditaBox } from '../provenienza/pitloss.mjs';
import { creaCella } from '../provenienza/contratto.mjs';
import { simulate } from '../engine/kernel.mjs';
import { creaPasso, stimaBasi } from '../engine/passo_v2.mjs';
import { validaSimulazione } from './director.mjs';

// Finestra entro cui si assume che il regime osservato al congelamento sia
// ancora in corso. Oltre, il regime NON si estrapola: prevedere una Safety Car
// futura sarebbe informazione che al congelamento non esiste (E14).
const PERSISTENZA_REGIME_GIRI = 1;
const MIN_GIRI_BASE = 8;

const regimeAlCongelamento = (cella) => {
  if (cella.status === null || !regimeNeutralizzato(cella)) return null;
  return simboliStatus(cella.status).has('4') ? 'SC' : 'VSC';
};

/**
 * Costruisce l'ingresso COMPLETO del kernel per uno scenario.
 *
 * @returns `{ state, pace, freezeLap, steps, pits, assunzioni, targhette,
 *          orizzonte, perdita }` — `pits` è ciò che le due risposte devono
 *          condividere, ed è la cosa che il cancello P06 confronta.
 */
export function costruisciScenario({ gara, freezeLap, pilota, giroPit, mescola, piano }, contesto) {
  const { gare, modello, prior } = contesto;
  const g = gare[gara];
  if (!g) throw new Error(`gara sconosciuta: ${gara}`);
  if (!Number.isInteger(freezeLap) || freezeLap < 1) throw new Error(`freezeLap non utilizzabile: ${JSON.stringify(freezeLap)}`);

  // ── UN SOLO percorso interno: il PIANO ───────────────────────────────────
  // `{giroPit, mescola}` è zucchero sintattico e si converte QUI, alla
  // frontiera, in un piano a una sosta. Non sopravvive come strada parallela:
  // quando un modo di dire una cosa ne sostituisce un altro, il vecchio si
  // spegne nello stesso commit (E20). Il cancello M2 verifica che le due
  // scritture diano lo stesso identico numero.
  if (piano !== undefined && giroPit !== undefined) {
    throw new Error('scenario con piano E giroPit: si dichiara una strategia sola, non due');
  }
  const soste = piano ?? (giroPit === undefined ? [] : [{ giro: giroPit, mescola }]);
  if (!Array.isArray(soste)) throw new Error(`il piano deve essere un elenco di soste: ${JSON.stringify(piano)}`);
  let precedente = freezeLap;
  for (const s of soste) {
    if (!Number.isInteger(s?.giro) || s.giro <= precedente) {
      throw new Error(`sosta ${JSON.stringify(s)}: le soste vanno in ordine crescente e dopo il congelamento ${freezeLap} — una sosta nel passato non è uno scenario`);
    }
    if (!MESCOLE_SLICK.has(s.mescola)) throw new Error(`mescola non slick valida: ${JSON.stringify(s.mescola)} (E05)`);
    precedente = s.giro;
  }

  // La DISTANZA DI GARA è nota al congelamento (è il regolamento), ma NON si
  // deduce dai giri osservati: al giro 30 di una gara da 70, dedurla darebbe 30
  // e la deriva carburante (−δ₇₀/N) sbaglierebbe di più del doppio. Va passata,
  // e se manca si fallisce rumorosamente invece di indovinare. La sentinella di
  // troncamento s14 ha scoperto proprio questo, confrontando i gap su dati
  // interi e troncati.
  const nGiriGara = contesto.nGiriGara;
  if (!Number.isInteger(nGiriGara) || nGiriGara < 2) {
    throw new Error(`nGiriGara mancante o non utilizzabile: ${JSON.stringify(nGiriGara)} — la distanza di gara è un INGRESSO dichiarato, non si deduce dai giri osservati`);
  }
  const giroFinale = contesto.giroFinale ?? nGiriGara;
  for (const s of soste) {
    if (s.giro >= giroFinale) throw new Error(`sosta al giro ${s.giro}: non sta prima del giro finale ${giroFinale}`);
  }
  const rho = modello.rho.valore;
  const delta70 = modello.delta_70.scelto;
  if (typeof delta70 !== 'number') throw new Error('il modello non ha un δ₇₀ scelto: nessuno scenario si costruisce su un modello non cablabile');

  const assunzioni = [];
  const dichiara = (codice, descrizione, conteggio, targhetta) => assunzioni.push({ codice, descrizione, conteggio, targhetta });

  // ── stato al congelamento: SOLO celle ≤ freezeLap (regola 5) ─────────────
  const state = [];
  const celleAlCongelamento = new Map();
  let sosteAlCongelamento = 0;
  for (const [drv, celle] of g.perPilota) {
    const c = celle.get(freezeLap);
    if (!c) continue;
    celleAlCongelamento.set(drv, c);
    // Chi è ENTRATO ai box proprio al giro del congelamento riparte con un set
    // nuovo: la sua età non prosegue da dove era. Misurato sul 2026: succede
    // davvero (un pilota su venti a ogni giro di sosta). Ignorarlo darebbe una
    // gomma vecchia a chi l'ha appena cambiata, ed è il Director ad accorgersene
    // (FIS07) — non un dettaglio cosmetico.
    const appenaFermato = c.in_lap === true;
    if (appenaFermato) sosteAlCongelamento += 1;
    state.push({ drv, lap: freezeLap, cum_time: c.cum_time, tyre_age: appenaFermato ? 0 : c.tyre_age });
  }
  if (sosteAlCongelamento > 0) {
    dichiara('SOSTA_AL_CONGELAMENTO',
      `${sosteAlCongelamento} pilota/i è entrato ai box proprio al giro ${freezeLap}: riparte da gomma nuova (età 0 al congelamento)`,
      sosteAlCongelamento,
      'la MESCOLA che monteranno è informazione del futuro e non si conosce: si mantiene quella osservata, che al giorno 1 non cambia il degrado (p = 0,209)');
  }
  const mia = celleAlCongelamento.get(pilota);
  if (!mia) throw new Error(`${pilota} non ha una cella al congelamento ${freezeLap}`);

  // ── regime, sosta per sosta ──────────────────────────────────────────────
  // Solo la PRIMA sosta può cadere dentro la neutralizzazione osservata al
  // congelamento. Le successive sono in verde per costruzione: prevedere una
  // Safety Car futura sarebbe informazione che al congelamento non esiste
  // (E14). Un piano non è un'eccezione a questo — semmai è la sua prova.
  const regimeOsservato = regimeAlCongelamento(mia);
  const regimeDi = (sosta, indice) => (
    regimeOsservato !== null && indice === 0 && sosta.giro - freezeLap <= PERSISTENZA_REGIME_GIRI
      ? regimeOsservato : null
  );
  const regime = soste.length ? regimeDi(soste[0], 0) : null;
  const giroPrimaSosta = soste.length ? soste[0].giro : null;
  if (regimeOsservato !== null && regime === null && giroPrimaSosta !== null) {
    dichiara('REGIME_NON_ESTRAPOLATO',
      `al congelamento c'era ${regimeOsservato}, ma la sosta è ${giroPrimaSosta - freezeLap} giri dopo: il regime non si estrapola nel futuro, la sosta è valutata in verde`,
      1, 'assunzione dichiarata — al congelamento non esiste informazione sul regime futuro (E14)');
  }
  if (regimeOsservato !== null && soste.length > 1) {
    dichiara('SOSTE_SUCCESSIVE_IN_VERDE',
      `le ${soste.length - 1} soste dopo la prima sono valutate in verde: il regime osservato non si estrapola`,
      soste.length - 1, 'assunzione dichiarata (E14)');
  }

  // ── perdita ai box, dal regime, con targhetta ───────────────────────────
  const perdita = perditaBox(prior, gara, regime);
  if (perdita.fallback) {
    dichiara('PITLOSS_DI_RIPIEGO', `${gara} non ha una misura di pit-loss di circuito: si usa la mediana d'era ${perdita.perdita_verde} s`, 1, perdita.targhetta);
  }
  if (regime !== null) {
    dichiara('FATTORE_NEUTRALIZZAZIONE',
      `sosta sotto ${regime}: si paga ${perdita.fattore} della perdita verde (${perdita.perdita_verde} s → ${perdita.perdita.toFixed(2)} s)`,
      1, 'PRIOR ESTERNO CON BANDA (SC 0,40-0,60 · VSC 0,60-0,70): è una banda, non un punto');
  }

  // ── soste: le mie, più quelle ASSUNTE dei rivali sotto neutralizzazione ──
  const pits = soste.length
    ? { [pilota]: soste.map((s, i) => ({ lap: s.giro, perdita: perditaBox(prior, gara, regimeDi(s, i)).perdita })) }
    : {};
  let rivaliAssunti = 0;
  if (regime !== null) {
    for (const [drv, c] of celleAlCongelamento) {
      if (drv === pilota) continue;
      if (c.stint !== 1) continue; // solo chi è ancora al primo stint: non si è ancora fermato
      pits[drv] = [{ lap: giroPrimaSosta, perdita: perditaBox(prior, gara, regime).perdita }];
      rivaliAssunti += 1;
    }
    dichiara('SOSTE_RIVALI_SC',
      `sotto ${regime} si assume che i rivali ancora al primo stint si fermino allo stesso giro (${giroPrimaSosta}) — una sola sosta, la loro: al rivale non si attribuisce un PIANO che non ha dichiarato`,
      rivaliAssunti,
      'ASSUNZIONE, non misura: sostituisce la vecchia SOSTE_RIVALI_SC del repo precedente. Non cambia i TEMPI (nel kernel le auto non interagiscono), cambia le POSIZIONI.');
  }

  // ── passo: base misurata togliendo gli stessi termini che si ri-aggiungono ─
  const basi = stimaBasi(osservazioniVerdi(g.righe), { delta70, rho, nGiri: nGiriGara, finoA: freezeLap, minGiri: MIN_GIRI_BASE });
  const pace = creaPasso({ delta70, rho, nGiri: nGiriGara, basi });

  // ── orizzonte legato al modello, non a un parametro morto (E20) ──────────
  const steps = giroFinale - freezeLap;
  const validati = modello.delta_70.decisione?.orizzonti_validati ?? [];
  const orizzonteValidato = validati.length ? Math.max(...validati) : null;
  if (orizzonteValidato !== null && steps > orizzonteValidato) {
    dichiara('OLTRE_ORIZZONTE_VALIDATO',
      `lo scenario proietta ${steps} giri, il modello è validato fino a ${orizzonteValidato}`,
      steps - orizzonteValidato,
      `misurato: il bias del modello è ≤ 0,17 s/giro fino a ${orizzonteValidato} giri e non è validato oltre (data/modelli/modello_v2.json, limiti_dichiarati)`);
  }
  const mescoleDelPiano = soste.map((s) => s.mescola);
  dichiara('MESCOLA_NON_SEPARA',
    `${mescoleDelPiano.length === 1 ? `la mescola scelta (${mescoleDelPiano[0]})` : `le mescole del piano (${mescoleDelPiano.join(' → ') || 'nessuna sosta'})`} sono registrate ma NON cambiano il degrado: al giorno 1 le mescole non separano (p = 0,209)`,
    Math.max(mescoleDelPiano.length, 1),
    'misurato 2026 → la separazione per mescola è ipotesi di Fase 3, con cancello fuori campione');
  if (soste.length > 1) {
    // Conseguenza diretta della riga sopra, e va detta dove si vede: se la
    // mescola non cambia il degrado, non esiste una scelta di mescola MIGLIORE.
    // Quella del piano soddisfa il regolamento, non ottimizza niente.
    dichiara('SCELTA_MESCOLA_NON_OTTIMIZZATA',
      'le mescole del piano soddisfano il regolamento 2026 (due slick sull\'asciutto) con una regola deterministica: a parità di soste, qualunque altra assegnazione costerebbe lo stesso tempo',
      soste.length, 'conseguenza di MESCOLA_NON_SEPARA, non una scelta di prestazione');
  }

  return {
    state, pace, freezeLap, steps, pits,
    assunzioni,
    perdita,
    orizzonte: { giroFinale, steps, orizzonte_validato: orizzonteValidato, oltre_il_validato: orizzonteValidato !== null && steps > orizzonteValidato },
    targhette: {
      rho: modello.rho.targhetta,
      delta_70: `misurato — deciso dall'esperimento pre-registrato (${modello.delta_70.decisione?.braccio_vincente})`,
      pit_loss: perdita.targhetta,
    },
    // materiale per il Director e per le risposte
    _interno: { g, gara, pilota, soste, regime, celleAlCongelamento, nGiriGara },
  };
}

/**
 * Materializza la simulazione COMPLETA (osservato ≤ Lf + proiettato > Lf) nella
 * forma che il Director valida. Le celle proiettate portano assunzioni
 * DICHIARATE: `status` di pista libera dove non c'è regime osservato, `del`
 * falso. Non sono misure e non devono sembrarlo.
 */
function materializzaPerDirector(scenario, risultato) {
  const { g, gara, pilota, soste, regime } = scenario._interno;
  // giro di sosta → mescola montata DOPO quella sosta. Con un piano le mescole
  // sono più d'una, e associarle al giro sbagliato darebbe a REG01 una sequenza
  // che il pilota non ha mai avuto.
  const mescolaDopoLaSosta = new Map(soste.map((x) => [x.giro, x.mescola]));
  const piloti = {};
  for (const [drv, celle] of g.perPilota) {
    const osservate = [...celle.entries()]
      .filter(([lap]) => lap <= scenario.freezeLap)
      .map(([lap, cella]) => ({ lap, cella }))
      .sort((a, b) => a.lap - b.lap);
    if (osservate.length === 0) continue;

    const traccia = risultato.traccia?.[drv];
    const proiettate = [];
    if (traccia) {
      const alCongelamento = celle.get(scenario.freezeLap);
      let stint = alCongelamento.stint;
      let compound = alCongelamento.compound;
      const suoiPit = new Set((scenario.pits[drv] ?? []).map((p) => p.lap));
      // Il primo giro proiettato è un out-lap se il pilota era ENTRATO ai box
      // al giro del congelamento: è il caso che il Director aveva ragione a
      // bocciare quando la proiezione lo ignorava.
      let prossimoEOutLap = alCongelamento.in_lap === true;
      let giroDelMioPit = null;
      for (const passo of traccia) {
        const eraInLap = passo.in_lap;
        const eOutLap = prossimoEOutLap;
        if (eOutLap) {
          stint = stint === null ? null : stint + 1;
          // La mescola scelta si monta solo dopo una sosta DELLO SCENARIO: dopo
          // una sosta già avvenuta al congelamento non si sa cosa abbiano preso.
          if (drv === pilota && mescolaDopoLaSosta.has(giroDelMioPit)) compound = mescolaDopoLaSosta.get(giroDelMioPit);
        }
        prossimoEOutLap = eraInLap;
        if (eraInLap && drv === pilota) giroDelMioPit = passo.lap;
        proiettate.push({
          lap: passo.lap,
          cella: creaCella({
            lap_time: passo.lap_time,
            cum_time: passo.cum_time,
            stint,
            compound,
            tyre_age: passo.tyre_age,
            in_lap: eraInLap,
            out_lap: eOutLap,
            // ASSUNZIONE dichiarata: dopo il congelamento si assume pista
            // libera, tranne sul giro della sosta se il regime osservato è
            // ancora in corso. Non è una misura.
            status: suoiPit.has(passo.lap) && regime !== null ? (regime === 'SC' ? '4' : '6') : '1',
            del: false,
          }),
        });
      }
    }
    piloti[drv] = {
      // La strategia è DICHIARATA per chi ha fatto la domanda — SEMPRE, anche
      // se il suo piano è «non fermarsi più»: quello è un piano, non l'assenza
      // di uno. E per i rivali a cui l'assunzione sotto neutralizzazione ne
      // assegna una. Gli altri proseguono senza fermarsi per assunzione, e su
      // di loro la regola delle due mescole non dice niente di vero.
      //
      // Legarla al «ha almeno una sosta», come faceva la prima stesura, apriva
      // un buco esattamente dove serviva di più: un piano a zero soste per chi
      // ha usato una sola mescola è una squalifica, e il Director lo lasciava
      // passare classificandolo «strategia non dichiarata». Trovato dal
      // cancello M3 su 9 casi delle gare 2026.
      strategia_dichiarata: drv === pilota || (scenario.pits[drv] ?? []).length > 0,
      celle: [...osservate, ...proiettate],
      soste: (scenario.pits[drv] ?? []).map((p) => ({
        lap: p.lap,
        perdita: p.perdita,
        stazionario: null, // il grezzo non lo porta e non si inventa (regola 6)
        regime,
      })),
    };
  }
  const nGiriGara = scenario._interno.nGiriGara;
  return { gara, n_giri: nGiriGara, completa: scenario.orizzonte.giroFinale === nGiriGara, piloti };
}

/** Esegue lo scenario e lo fa passare dal Director prima di restituirlo. */
export function eseguiEValida(scenario, costantiDirector) {
  const risultato = simulate({
    state: scenario.state, pace: scenario.pace, freezeLap: scenario.freezeLap,
    steps: scenario.steps, pits: scenario.pits, traccia: true,
  });
  const direttore = validaSimulazione(materializzaPerDirector(scenario, risultato), costantiDirector);
  return { risultato, direttore };
}

/**
 * La BANDA sulla posizione di rientro, dal modello calibrato. È l'unica
 * risposta ammessa a «e se qualcuno si difende?»: dice di quanto può sbagliare
 * il numero, mai chi supererà chi (banco/prereg/PREREG_difesa.md, cancello D3).
 *
 * Il contesto è quello che il prodotto SA al congelamento: sotto regime è
 * NEUTRA, in verde è VERDE — che è calibrata sull'unione di PULITA e
 * SOSTE_RIVALI, perché sapere se i rivali si fermeranno sarebbe informazione
 * dal futuro (E14).
 */
export function bandaDiRientro({ banda, gara, regime, posizione, suQuanti }) {
  if (!banda) return null;
  if (posizione === null) return null; // regola 6: nessuna posizione, nessuna banda
  const contesto = regime !== null ? 'NEUTRA' : 'VERDE';
  const c = banda.contesti?.[contesto];
  if (!c) return null;
  const debole = (c.circuiti_sotto_livello ?? []).find((x) => x.gara === gara) ?? null;
  return {
    contesto,
    da: Math.max(1, posizione - c.banda.sotto),
    a: Math.min(suQuanti, posizione + c.banda.sopra),
    semi_ampiezza: c.semi_ampiezza,
    livello: banda.livello,
    copertura_fuori_campione: c.copertura_fuori_campione,
    targhetta: c.targhetta,
    // l'avviso di circuito viaggia col numero, non in un README
    circuito_sotto_livello: debole,
    cosa_non_e: banda._targhetta.cosa_NON_e,
  };
}

/**
 * "DOVE RIENTRI" — la posizione al giro successivo alla sosta.
 * Chiama `costruisciScenario`: stessa fisica di `curvaDelQuando`.
 * Se il Director respinge, la risposta è **null**, non un numero (regola 6).
 */
export function doveRientri({ gara, freezeLap, pilota, giroPit, mescola }, contesto) {
  const scenario = costruisciScenario(
    { gara, freezeLap, pilota, giroPit, mescola },
    { ...contesto, giroFinale: giroPit + 1 },
  );
  const { risultato, direttore } = eseguiEValida(scenario, contesto.costantiDirector);
  if (!direttore.approved) {
    return { approvato: false, posizione: null, davanti: null, dietro: null, direttore, assunzioni: scenario.assunzioni, pits: scenario.pits };
  }
  const conCum = Object.keys(risultato.cum).filter((d) => risultato.cum[d] !== null);
  const ordine = [...conCum].sort((a, b) => risultato.cum[a] - risultato.cum[b] || (a < b ? -1 : 1));
  const indice = risultato.cum[pilota] === null ? -1 : ordine.indexOf(pilota);
  const posizione = indice < 0 ? null : indice + 1;

  // Sotto neutralizzazione il campo si compatta: la differenza di cum resta un
  // numero, ma NON è più il tempo che servirebbe a recuperare. Un gap che non
  // significa quello che sembra significare va SOPPRESSO col motivo — non
  // mostrato come se fosse un risultato (regola 6).
  const gapSoppressi = scenario._interno.regime !== null
    ? `gap non quantificabile: la sosta è sotto ${scenario._interno.regime} e il campo è compattato dalla neutralizzazione — la differenza di cumulato non è il tempo da recuperare`
    : null;
  const vicino = (offset) => {
    if (indice < 0) return null;
    const altro = ordine[indice + offset];
    if (altro === undefined) return null;
    return {
      drv: altro,
      gap_s: gapSoppressi ? null : Math.abs(risultato.cum[altro] - risultato.cum[pilota]),
      motivo_soppressione: gapSoppressi,
    };
  };

  return {
    approvato: true,
    posizione,
    su_quanti: conCum.length,
    giro_di_rientro: giroPit + 1,
    banda_posizione: bandaDiRientro({
      banda: contesto.bandaRientro ?? null,
      gara,
      regime: scenario._interno.regime,
      posizione,
      suQuanti: conCum.length,
    }),
    davanti: vicino(-1),
    dietro: vicino(+1),
    gap_soppressi: gapSoppressi,
    // La traccia di TUTTI: il fantasma è uno strato di proiezione completo. Se
    // la mappa mostrasse i rivali al reale e solo la mia auto proiettata,
    // l'animazione contraddirebbe il pannello per costruzione — e il pannello
    // ordina fra cum PREVISTI, non fra un previsto e venti reali.
    traccia: risultato.traccia ?? null,
    perdita: scenario.perdita,
    assunzioni: scenario.assunzioni,
    targhette: scenario.targhette,
    pits: scenario.pits,
    direttore,
  };
}

/**
 * "LA CURVA DEL QUANDO" — per ogni giro di sosta candidato, il tempo totale
 * AL MEDESIMO giro finale. `delta_s` è quanto si perde rispetto al migliore:
 * il minimo vale 0.
 *
 * La banda esiste dove i coefficienti sono PRIOR: se qualche candidato è sotto
 * neutralizzazione, la curva si ricalcola agli estremi della banda dichiarata
 * del fattore. Dove tutti i candidati sono in verde la banda è nulla — e non
 * per pigrizia: la perdita ai box in verde è la stessa per ogni candidato e si
 * CANCELLA nella differenza, quindi la forma della curva non dipende affatto
 * da quel prior. La sentinella s17 lo verifica invece di affermarlo.
 */
export function curvaDelQuando({ gara, freezeLap, pilota, mescola }, contesto) {
  const g = contesto.gare[gara];
  // La DISTANZA DI GARA è nota al congelamento (è il regolamento), ma NON si
  // deduce dai giri osservati: al giro 30 di una gara da 70, dedurla darebbe 30
  // e la deriva carburante (−δ₇₀/N) sbaglierebbe di più del doppio. Va passata,
  // e se manca si fallisce rumorosamente invece di indovinare. La sentinella di
  // troncamento s14 ha scoperto proprio questo, confrontando i gap su dati
  // interi e troncati.
  const nGiriGara = contesto.nGiriGara;
  if (!Number.isInteger(nGiriGara) || nGiriGara < 2) {
    throw new Error(`nGiriGara mancante o non utilizzabile: ${JSON.stringify(nGiriGara)} — la distanza di gara è un INGRESSO dichiarato, non si deduce dai giri osservati`);
  }
  const giroFinale = contesto.giroFinale ?? nGiriGara;
  const candidati = [];
  for (let giroPit = freezeLap + 1; giroPit < giroFinale; giroPit += 1) candidati.push(giroPit);
  if (candidati.length === 0) throw new Error(`nessun giro di sosta candidato fra ${freezeLap} e ${giroFinale}`);

  const valuta = (fattoreNeutralizzazione) => candidati.map((giroPit) => {
    const scenario = costruisciScenario({ gara, freezeLap, pilota, giroPit, mescola }, { ...contesto, giroFinale });
    if (fattoreNeutralizzazione !== null && scenario._interno.regime !== null) {
      const p = scenario.pits[pilota][0];
      p.perdita = scenario.perdita.perdita_verde * fattoreNeutralizzazione;
    }
    const { risultato, direttore } = eseguiEValida(scenario, contesto.costantiDirector);
    return { giroPit, totale: risultato.cum[pilota], scenario, direttore };
  });

  const centrale = valuta(null);
  const respinti = centrale.filter((c) => !c.direttore.approved);
  const validi = centrale.filter((c) => c.totale !== null && c.direttore.approved);
  if (validi.length === 0) {
    return { approvato: false, curva: [], minimo: null, respinti: respinti.length, direttore: centrale[0]?.direttore ?? null };
  }
  const minimoTotale = Math.min(...validi.map((c) => c.totale));

  // banda: solo dove il fattore di neutralizzazione entra davvero in gioco
  const conRegime = centrale.some((c) => c.scenario._interno.regime !== null);
  const bande = { basso: null, alto: null };
  if (conRegime) {
    const regime = centrale.find((c) => c.scenario._interno.regime !== null).scenario._interno.regime;
    const [b, a] = contesto.costantiDirector.limiti.bande_neutralizzazione[regime];
    bande.basso = valuta(b);
    bande.alto = valuta(a);
  }

  const curva = validi.map((c, i) => {
    const delta = c.totale - minimoTotale;
    let banda = null;
    if (conRegime) {
      const estremi = [bande.basso[i], bande.alto[i]]
        .filter((x) => x && x.totale !== null)
        .map((x) => x.totale - Math.min(...bande.basso.concat(bande.alto).filter((y) => y.totale !== null).map((y) => y.totale)));
      if (estremi.length === 2) banda = [Number(Math.min(...estremi).toFixed(3)), Number(Math.max(...estremi).toFixed(3))];
    }
    return { giroPit: c.giroPit, delta_s: Number(delta.toFixed(3)), banda };
  });

  const minimo = curva.reduce((m, c) => (m === null || c.delta_s < m.delta_s ? c : m), null);
  const scenarioRif = validi[0].scenario;
  return {
    approvato: true,
    curva,
    minimo,
    orizzonte: scenarioRif.orizzonte,
    assunzioni: scenarioRif.assunzioni,
    targhette: scenarioRif.targhette,
    banda_presente: conRegime,
    nota_banda: conRegime
      ? 'la banda viene dal fattore di neutralizzazione, che è un PRIOR con banda dichiarata'
      : 'nessuna banda: tutti i candidati sono in verde e la perdita ai box, uguale per tutti, si cancella nella differenza — la forma della curva non dipende da quel prior',
    respinti_dal_director: respinti.length,
  };
}
