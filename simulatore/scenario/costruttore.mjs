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

import { garaSospesa, passoUtilizzabile, regimeDiCella, regimeNeutralizzato } from '../provenienza/definizioni.mjs';
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

// Quanti giri verdi servono per dichiarare un passo base. Il valore vive nel
// MODELLO con la sua targhetta, non qui: era una costante muta, ereditata dal
// criterio di ammissione del banco («sotto otto giri non ti misuro») e migrata nel
// motore senza che nessuno l'avesse mai giudicata come soglia di QUALITA'. Il
// numero qui sotto e' solo il ripiego per un modello che non la dichiara.
// Protocollo e cancello: ai_lab/confronto/PREREG_soglia_base.md.
const MIN_GIRI_BASE_RIPIEGO = 8;

// Il bias massimo che il modello dichiara di se' (banco/prereg/cancelli_banco.json,
// `soglia_bias`), ed e' il limite entro cui delta70 e' stato validato. Serve alla
// FINESTRA del «quando»: due giri che distano meno di questo, sull'orizzonte
// proiettato, il motore non li distingue.
const BIAS_DICHIARATO_S_GIRO = 0.17;

/**
 * IL PACCHETTO NEUTRALIZZAZIONE (voce 2 del piano, `PREREG_neutralizzazione.md`).
 *
 * Quattro correzioni allo stesso meccanismo, dietro UN interruttore solo. Non è
 * pigrizia: se si accendessero una alla volta, ognuna verrebbe misurata mentre le
 * altre tre sono ancora sbagliate, e il numero non direbbe niente su nessuna. Il
 * cancello è pre-registrato sul PACCHETTO.
 *
 *   N1 · il regime vale anche in PROIEZIONE PURA (senza soste nel piano). Oggi
 *        `soste.length ? … : null` lo rende inerte proprio dove il bias è 1,964
 *        s/giro contro 0,033 in verde.
 *   N2 · la persistenza è MISURATA e DISTINTA per regime, invece di valere 1 per
 *        entrambi senza targhetta.
 *   N4 · i rivali assunti in sosta sotto neutralizzazione: l'assunzione
 *        `stint !== 1` azzecca 25 rivali su 148 e a Monaco ne assume zero mentre
 *        360 entrano davvero.
 *
 * (N3, il fattore misurato in casa, non passa da qui: vive in `pitloss.mjs`
 * accanto alla perdita verde, che è dove sta la stessa domanda per il verde.)
 *
 * Spento = i numeri sono identici a prima, bit a bit. È la condizione C3 del
 * cancello, ed è la più facile da rompere.
 */
// Una Safety Car neutralizza TUTTI. La maggioranza assoluta e' la soglia piu'
// generosa che si possa chiamare «campo» senza inventare (PREREG-6).
const QUOTA_CAMPO_NEUTRALIZZATO = 0.5;

/**
 * IL TETTO AL MOVIMENTO, risolto in UN posto solo (regola 1).
 *
 * Tre casi, e sono tre apposta — il 04/08/2026 questo progetto ha scoperto che un
 * override con una precedenza sbagliata rende un cancello incapace di fallire e non se ne
 * accorge nessuno (E22, `cancelli_vita.mjs`). Qui la precedenza e' esplicita e ha una
 * sentinella (s38):
 *
 *   contesto.tetto === false  ⇒  SPENTO ESPLICITAMENTE. Serve a chi misura: il braccio
 *                                «senza vincolo» di un confronto appaiato deve poter dire
 *                                spento e ottenerlo, anche quando la produzione e' accesa.
 *                                Senza questo caso, il giorno dell'accensione tutti i
 *                                confronti A/B sarebbero diventati A/A in silenzio.
 *   contesto.tetto oggetto    ⇒  IMPOSTO da chi misura, esattamente com'e'.
 *   altrimenti                ⇒  dal SIGILLO `contesto.sogliaSorpasso`, per circuito.
 *                                `attivo !== true` ⇒ null ⇒ numeri bit-identici a prima.
 *
 * Un circuito che non compare nel sigillo prende la SOGLIA COMUNE, non 1 e non zero: la
 * misura dice che dieci piste su undici condividono la stessa soglia, quindi la comune E'
 * la stima per una pista nuova. Non e' un valore di riserva (regola 6): e' il risultato.
 */
export function risolviTetto(contesto, gara) {
  if (contesto.tetto === false) return null;
  if (contesto.tetto) return contesto.tetto;
  const s = contesto.sogliaSorpasso;
  if (!s || s.attivo !== true || !s.parametri) return null;
  const soglia = s.soglia_sorpasso?.[gara] ?? s.soglia_comune;
  if (typeof soglia !== 'number' || !Number.isFinite(soglia)) return null;
  return {
    minGap: s.parametri.minGap,
    sogliaSorpasso: soglia,
    costoDuello: s.parametri.costoDuello,
    costoSubito: s.parametri.costoSubito,
  };
}

function persistenzaPacchetto(contesto, attivo, regime) {
  if (!attivo) return PERSISTENZA_REGIME_GIRI;
  const m = contesto.prior?.persistenza_regime_interna;
  const g = m?.promosso === true ? m?.[regime]?.giri : null;
  return typeof g === 'number' ? g : PERSISTENZA_REGIME_GIRI;
}

function leggiPacchetto(contesto) {
  const p = contesto.prior?.pacchetto_neutralizzazione;
  const attivo = p?.attivo === true;
  return {
    attivo,
    regimeInProiezionePura: attivo,
    // N4 E' SCORPORATO dal pacchetto: si accende da solo, con il suo cancello
    // (PREREG_soste_rivali.md). Il pacchetto neutralizzazione resta NULL per i
    // suoi motivi; questa voce ha i suoi, e vengono da 105 gare del fondo invece
    // che dalle undici del banco.
    sosteRivali: contesto.prior?.soste_rivali_sotto_regime
      ?? (attivo ? (p.soste_rivali ?? 'nessuna') : 'stint1'),
    persistenzaDi: (regime) => persistenzaPacchetto(contesto, attivo, regime),
    // La COMPRESSIONE dei distacchi (PREREG-6: forma della PREREG-2, popolazione
    // ristretta). Due cose, e la seconda e' il punto:
    //
    //  1. la forma e' `gap x kappa` sulla finestra di persistenza — la variante
    //     migliore delle quattro provate. Le riformulazioni successive (media dei
    //     rapporti, attesa corretta) peggioravano: piu' giri compressi, peggio.
    //  2. si applica SOLO se al congelamento il CAMPO e' neutralizzato.
    //     `regimeDiCella` legge lo status della singola auto, e un 4 su una
    //     macchina sola non e' una Safety Car: e' una gialla di settore. La
    //     compressione e' un fenomeno del campo intero. Misurato: il 23% dei
    //     congelamenti con regime sul leader NON sono di campo.
    //
    // La stessa soglia vale nella stima su fondo: misurare su una popolazione e
    // predire su un'altra e' la famiglia di E16.
    compressionePerGiro: (regime, freezeLap, giroFinale, quotaCampo) => {
      if (!attivo || regime === null || regime === 'RED') return null;
      if (!(quotaCampo >= QUOTA_CAMPO_NEUTRALIZZATO)) return null;
      const m = contesto.prior?.compressione_distacchi_interna;
      if (m?.promosso !== true) return null;
      const k = m?.[regime]?.kappa_mediano;
      if (typeof k !== 'number') return null;
      const perGiro = {};
      const fino = Math.min(freezeLap + persistenzaPacchetto(contesto, attivo, regime), giroFinale);
      for (let giro = freezeLap + 1; giro <= fino; giro += 1) perGiro[giro] = k;
      return Object.keys(perGiro).length ? perGiro : null;
    },
  };
}

// `regimeAlCongelamento` non vive piu' qui: e' `regimeDiCella` in
// provenienza/definizioni.mjs, l'unico proprietario delle definizioni derivate.
const regimeAlCongelamento = regimeDiCella;

/**
 * Costruisce l'ingresso COMPLETO del kernel per uno scenario.
 *
 * @returns `{ state, pace, freezeLap, steps, pits, assunzioni, targhette,
 *          orizzonte, perdita }` — `pits` è ciò che le due risposte devono
 *          condividere, ed è la cosa che il cancello P06 confronta.
 */
export function costruisciScenario({ gara, freezeLap, pilota, giroPit, mescola, piano, pianiRivali, sosteAtteseRivali, rivaliNonClassificati, ritiriRivali, neutralizzazioneVera }, contesto) {
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
  // Il RODAGGIO entra solo se il modello lo dichiara ACCESO. Un termine stimato
  // ma non promosso resta nel file con i suoi numeri e la sua targhetta — così
  // il prossimo lo trova invece di ri-stimarlo — ma non tocca nessuna risposta
  // finché il cancello di PREREG_rodaggio.md non l'ha promosso.
  const rodaggio = modello.rodaggio?.attivo === true
    ? { c: modello.rodaggio.c, tau: modello.rodaggio.tau }
    : null;
  // Il CLIFF entra con la STESSA regola del rodaggio, e non è una comodità: un
  // termine che sta nel file ma non è promosso deve restare inerte, altrimenti
  // «misurato» e «acceso» diventano la stessa cosa e nessuno può più leggere il
  // modello per sapere cosa il motore usa davvero. Cancelli e provenienza del
  // parametro: ai_lab/confronto/PREREG_cliff_derivato.md.
  const cliff = modello.cliff?.attivo === true
    ? { kappa: modello.cliff.kappa }
    : null;
  // IL TETTO AL MOVIMENTO arriva dal CONTESTO, non dal modello: non e' fisica del passo
  // ma un vincolo di pista, e il suo parametro portante (la soglia di sorpasso) e' per
  // CIRCUITO. Dal 04/08/2026 e' ACCESO in produzione, con la soglia MISURATA su 5.498
  // occasioni del fondo. Parametri e cancelli: ai_lab/sorpasso/PREREG_soglia_sorpasso.md;
  // accensione: ai_lab/sorpasso/ESITO_aggancio_tetto.json.
  const tetto = risolviTetto(contesto, gara);
  // LA VITA DELLA MESCOLA arriva dal MODELLO, come il cliff e per la stessa ragione: e'
  // fisica del passo, e va letta dal sigillo che dichiara se e' accesa. `attivo !== true`
  // ⇒ null ⇒ numeri bit-identici a prima (sentinella s37). Natura del parametro:
  // PRIOR_COMPORTAMENTALE — vedi simulatore/DEROGA_prior_comportamentale.md; cancelli:
  // ai_lab/degrado/PREREG_vita_mescola.md.
  // Il FATTORE PER CIRCUITO moltiplica la vita di tutte le mescole. Un circuito che non
  // compare nel sigillo usa fattore 1 — la vita globale, senza inventare un adattamento
  // che non e' stato misurato (regola 6). Vale per Zandvoort il 23/08.
  const vita = (() => {
    const vm = contesto.vitaMescola ?? modello.vita_mescola;
    if (vm?.attivo !== true || !vm.giri) return null;
    const f = vm.fattore_circuito?.[gara] ?? 1;
    return Object.fromEntries(Object.entries(vm.giri).map(([m, g]) => [m, g * f]));
  })();

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
    // `mescola` entra nello stato dal 04/08/2026: e' la gomma che il pilota ha ADDOSSO al
    // congelamento, e senza di essa il kernel non potrebbe sapere quale vita applicare.
    // Chi si e' appena fermato monta il set nuovo, e la sua mescola e' quella della cella
    // (il grezzo la riporta gia' aggiornata all'in-lap).
    state.push({ drv, lap: freezeLap, cum_time: c.cum_time, tyre_age: appenaFermato ? 0 : c.tyre_age, mescola: c.compound ?? null });
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
  // LA SOSPENSIONE PRIMA DEL REGIME. Sotto bandiera rossa le auto incolonnano in
  // corsia box: la sosta non costa posizioni, e il prior lo dichiara da sempre
  // (RED = 0,0). Nessun percorso ci arrivava, perche' la rossa non e' un regime
  // — giustamente — e quindi `regimeDiCella` restituisce null. Il risultato era
  // che il motore prezzava a pit-loss pieno una sosta fatta a gara ferma.
  // 'RED' non entra qui come regime: entra come STATO DI PREZZO, ed e' l'unico
  // posto in cui la rossa tocca la fisica.
  // ── LA NEUTRALIZZAZIONE VERA (ingresso di laboratorio, 07/08/2026) ────────
  // {giro: 'SC'|'VSC'|'RED'}, di norma da regimePerGiroDiCampo a gara finita.
  // E14 vieta di estrapolare Safety Car future al congelamento — giustamente —
  // ma cosi' il replay di laboratorio corre IN VERDE i giri che la gara vera
  // passo' dietro la SC: niente compressione e soste a prezzo pieno, ed e'
  // il pezzo mancante misurato dal record (Belgio +3 e GB +2, identici al
  // nullo; a Silverstone il campo vero si rimescola il triplo del motore).
  // Stessa famiglia di pianiRivali/ritiriRivali: informazione dal futuro,
  // dichiarata, vietata in produzione da s25.
  const vera = (() => {
    if (!neutralizzazioneVera) return null;
    const v = {};
    for (const [lap, r] of Object.entries(neutralizzazioneVera)) {
      const L = Number(lap);
      if (!Number.isInteger(L) || L < 1) throw new Error(`neutralizzazioneVera: giro non utilizzabile ${JSON.stringify(lap)}`);
      if (!['SC', 'VSC', 'RED'].includes(r)) throw new Error(`neutralizzazioneVera: regime sconosciuto ${JSON.stringify(r)} al giro ${L}`);
      if (L > freezeLap && L <= giroFinale) v[L] = r;   // <= Lf e' gia' nello stato osservato
    }
    return Object.keys(v).length ? v : null;
  })();

  const regimeOsservato = garaSospesa(mia) ? 'RED' : regimeAlCongelamento(mia);
  const pacchetto = leggiPacchetto(contesto);
  // N2 — la finestra di persistenza è misurata e distinta per regime quando il
  // pacchetto è acceso; altrimenti resta la costante 1 di sempre.
  const persistenza = pacchetto.persistenzaDi(regimeOsservato);
  const regimeDi = (sosta, indice) => (
    regimeOsservato !== null && indice === 0 && sosta.giro - freezeLap <= persistenza
      ? regimeOsservato : null
  );
  // Con la neutralizzazione VERA il prezzo di OGNI sosta (anche dei rivali) viene dal
  // giro in cui cade davvero, non dalla persistenza del regime al congelamento: e'
  // l'informazione in piu' che l'ingresso di laboratorio dichiara. Senza, bit-identico.
  const regimeAllaSosta = (s, i) => (vera ? (vera[s.giro] ?? null) : regimeDi(s, i));
  // N1 — IL REGIME VALE ANCHE IN PROIEZIONE PURA. Senza soste nel piano il
  // meccanismo era inerte: `soste.length ? … : null`. Ma "non mi fermo" sotto
  // Safety Car non è uno scenario in verde — è uno scenario in cui il CAMPO
  // viaggia neutralizzato, ed è il ramo dove il bias del motore vale 1,964
  // s/giro contro 0,033 in verde. Con il pacchetto spento il comportamento è
  // identico al bit (la condizione C3 del cancello).
  const regime = soste.length
    ? regimeDi(soste[0], 0)
    : (pacchetto.regimeInProiezionePura ? regimeOsservato : null);
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
  if (regime === 'RED') {
    dichiara('GARA_SOSPESA',
      `bandiera rossa al congelamento: la gara è ferma e le auto incolonnano in corsia box, quindi la sosta non costa posizioni (${perdita.perdita_verde} s → ${perdita.perdita.toFixed(2)} s)`,
      1, 'PRIOR ESTERNO dichiarato (RED = 0,0): sotto sospensione l\'ordine si conserva — è la ragione per cui i muretti si fermano proprio lì');
  } else if (regime !== null) {
    dichiara('FATTORE_NEUTRALIZZAZIONE',
      `sosta sotto ${regime}: si paga ${perdita.fattore} della perdita verde (${perdita.perdita_verde} s → ${perdita.perdita.toFixed(2)} s)`,
      1, 'PRIOR ESTERNO CON BANDA (SC 0,40-0,60 · VSC 0,60-0,70): è una banda, non un punto');
  }

  // ── soste: le mie, più quelle ASSUNTE dei rivali sotto neutralizzazione ──
  const pits = soste.length
    ? { [pilota]: soste.map((s, i) => ({ lap: s.giro, perdita: perditaBox(prior, gara, regimeAllaSosta(s, i)).perdita, mescola: s.mescola ?? null })) }
    : {};
  // ── LE SOSTE VERE DEI RIVALI: ingresso DI LABORATORIO, spento in produzione ──
  //
  // Il prodotto non puo' usarlo e non lo usa: in diretta, al congelamento, non si sa
  // quando si fermeranno gli altri, e attribuirglielo sarebbe E14 in piena regola.
  // Nessun percorso del sito lo passa, ed e' `undefined` ovunque tranne che nel banco.
  //
  // Esiste per una domanda diagnostica sola (ai_lab/confronto/PREREG_sorpassi.md).
  // La misura «gara intera» del 01/08 dava al soggetto le sue soste vere e a nessun
  // altro le loro: con i rivali che non si fermano mai e tutti che degradano con lo
  // stesso rho, l'ordine fra loro si conserva per 53 giri e il motore assomiglia al
  // modello nullo PER COSTRUZIONE. L'informazione dal futuro era asimmetrica, e
  // l'asimmetria spingeva verso il pareggio che poi si e' letto come un risultato.
  // Questo ingresso la rende simmetrica, cosi' il pareggio (o la sua fine) significa
  // qualcosa.
  //
  // Sta QUI e non nel banco perche' le soste si costruiscono in un posto solo
  // (regola 1): un secondo modo di riempire `pits` sarebbe la porta di E17.
  let rivaliVeri = 0;
  let rivaliScartati = 0;
  // DUE FONTI, E NON SI CONFONDONO MAI. `pianiRivali` sono le soste VERE: informazione dal
  // futuro, ammessa solo al banco. `sosteAtteseRivali` sono DEDOTTE dallo stato al
  // congelamento (scenario/rivali.mjs) e non contengono niente oltre Lf — sono l'unica
  // forma che la produzione puo' usare. Il nome e' diverso apposta: la sentinella s25
  // vieta `pianiRivali` in ogni percorso di produzione, e quel divieto resta intatto.
  const daiRivali = pianiRivali ?? sosteAtteseRivali ?? null;
  const rivaliDedotti = !pianiRivali && Boolean(sosteAtteseRivali);
  if (daiRivali) {
    for (const [drv, sosteDrv] of Object.entries(daiRivali)) {
      if (drv === pilota) continue;
      const nel = (sosteDrv ?? []).filter((s) => Number.isInteger(s?.giro) && s.giro > freezeLap && s.giro < giroFinale);
      // Il letterale "None" si LAVA alla frontiera, non fa esplodere il caso (E05). Una
      // prima scrittura tirava un'eccezione: bastava un rivale con la mescola non nota
      // per perdere l'intero caso — 19 casi e tutta l'Ungheria — e la perdita non
      // c'entrava niente col fenomeno misurato. Il rivale con la sosta illeggibile
      // semplicemente non la riceve, e il conteggio lo dichiara.
      const future = nel.filter((s) => MESCOLE_SLICK.has(s.mescola));
      rivaliScartati += nel.length - future.length;
      if (!future.length) continue;
      pits[drv] = future.map((s, i) => ({ lap: s.giro, perdita: perditaBox(prior, gara, regimeAllaSosta(s, i)).perdita, mescola: s.mescola ?? null }));
      rivaliVeri += 1;
    }
    if (rivaliVeri > 0) {
      dichiara(rivaliDedotti ? 'SOSTE_ATTESE_DEI_RIVALI' : 'SOSTE_VERE_DEI_RIVALI',
        rivaliDedotti
          ? `a ${rivaliVeri} rivali e' stata attribuita la sosta che cadra' quando la gomma che avevano `
            + 'al congelamento finisce (scenario/rivali.mjs). Non e\' informazione dal futuro: mescola ed '
            + 'eta\' sono lette al congelamento e la vita viene dal sigillo. E\' un PRIOR COMPORTAMENTALE, '
            + 'e sbaglia come sbaglia quel prior — ma lasciarli fermi sbagliava di piu\''
          : `a ${rivaliVeri} rivali sono state date le LORO soste vere: e' INFORMAZIONE DAL FUTURO, `
        + 'lecita solo per misurare la fisica a strategia nota. Nessuna risposta del prodotto puo\' nascere da qui'
        + (rivaliScartati ? ` — ${rivaliScartati} soste altrui scartate perche' la mescola non e' slick nota (E05)` : ''),
        rivaliVeri,
        'INGRESSO DI LABORATORIO (E14 consapevole e dichiarato): in diretta le soste dei rivali non si conoscono');
    }
  }

  // ── I RIVALI CHE NON SONO ARRIVATI: ingresso di laboratorio, come le soste vere ──
  //
  // Nella gara vera qualcuno si ritira; il kernel — giustamente — non fa sparire
  // nessuno e proietta tutti fino alla bandiera. Ma allora un ritirato con una
  // sosta sola «completa» su una mescola sola, e REG01 lo squalificherebbe: una
  // squalifica per un arrivo CHE NON E' MAI SUCCESSO. Il Director ha gia' la
  // tacca giusta — strategia non dichiarata ⇒ REG01 non eseguito, a referto in
  // `non_verificabili` — e questo ingresso la usa: chi sta nell'elenco non ha
  // una strategia di gara COMPLETA dichiarabile, perche' la sua gara vera si e'
  // fermata prima. Stessa natura di `pianiRivali` (informazione dal futuro,
  // lecita solo a gara finita), e viaggia solo insieme a quello.
  const nonClassificati = new Set(
    (pianiRivali || sosteAtteseRivali) ? (rivaliNonClassificati ?? []).filter((d) => d !== pilota) : [],
  );
  if (nonClassificati.size > 0) {
    dichiara('RIVALI_NON_CLASSIFICATI',
      `${nonClassificati.size} rivale/i non arrivo' alla bandiera nella gara vera: la sua proiezione fino in fondo `
      + 'e\' un\'assunzione della messa in scena, e REG01 (due mescole slick) non si applica a un arrivo mai successo',
      nonClassificati.size,
      'INGRESSO DI LABORATORIO (informazione dal futuro, come le soste vere): in diretta non si sa chi si ritirera\'');
  }

  // ── I RITIRI VERI DEI RIVALI: il gemello delle soste vere, sul kernel ──────
  //
  // Proiettare un ritirato fino alla bandiera comprime i ranghi attorno al
  // soggetto (record 07/08: Canada, 6 ritirati, il motore inventa 12 cambi
  // contro 7 reali). A gara nota il ritiro e' un DATO come le soste: qui entra
  // {drv: ultimo giro percorso}, il kernel lo fa uscire da quel giro in poi e
  // lo mette in `ritirati`, mai in classifica. INFORMAZIONE DAL FUTURO in
  // piena regola: viaggia solo nei percorsi di laboratorio (s25 la vieta in
  // produzione insieme a pianiRivali), e mai sul soggetto — il controfattuale
  // del soggetto e' il punto della domanda, non si ritira per decreto.
  const ritiri = (() => {
    if (!ritiriRivali) return null;
    const puliti = {};
    for (const [drv, lap] of Object.entries(ritiriRivali)) {
      if (drv === pilota) continue;
      if (!Number.isInteger(lap) || lap < 1) throw new Error(`ritiriRivali.${drv} non utilizzabile (serve il suo ultimo giro, intero ≥ 1): ${JSON.stringify(lap)}`);
      if (lap > freezeLap) puliti[drv] = lap;   // chi si e' gia' ritirato non ha una cella a Lf: e' gia' assente
    }
    return Object.keys(puliti).length ? puliti : null;
  })();
  if (ritiri) {
    dichiara('RITIRI_VERI_DEI_RIVALI',
      `${Object.keys(ritiri).length} rivale/i esce dalla simulazione al giro del suo ritiro VERO invece di essere proiettato alla bandiera`,
      Object.keys(ritiri).length,
      'INGRESSO DI LABORATORIO (informazione dal futuro, come le soste vere): in diretta non si sa chi si ritirera\', ne\' quando');
  }

  let rivaliAssunti = 0;
  if (regime !== null) {
    // N4 — LE SOSTE DEI RIVALI. `stint !== 1` ferma 148 rivali e ne azzecca 25
    // (16,9%), e a Monaco ne assume ZERO mentre 360 entrano davvero: l'assunzione
    // non è conservativa, è semplicemente sbagliata in due versi diversi a
    // seconda del circuito. Con il pacchetto acceso non si assume nessuna sosta
    // altrui — un rivale che non ha dichiarato un piano non ne ha uno.
    // Le due letture di questa voce NON concordano (esatti su, bias giù):
    // il cancello pre-registrato decide sul BIAS, e sta scritto prima.
    if (pacchetto.sosteRivali === 'stint1' && giroPrimaSosta !== null) {
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
    } else {
      dichiara('NESSUNA_SOSTA_ASSUNTA_AI_RIVALI',
        `sotto ${regime} non si assume nessuna sosta altrui: l'assunzione "chi è al primo stint si ferma" azzecca 25 rivali su 148 (16,9%) e a Monaco ne prevede zero mentre 360 entrano davvero`,
        1, 'misurato sul fondo 2026 — pacchetto neutralizzazione, voce N4 di ai_lab/confronto/PREREG_neutralizzazione.md');
    }
  }

  // ── la COMPRESSIONE DEI DISTACCHI, dal regime osservato al congelamento ───
  // Vale sul regime OSSERVATO, non su quello della sosta: e' il campo intero a
  // viaggiare neutralizzato, anche per chi non si ferma affatto. E' la voce che
  // rende il regime finalmente CONSUMATO da qualcosa — prima alimentava solo il
  // prezzo della sosta, quindi in proiezione pura era un no-op misurato.
  // la quota del campo neutralizzata AL CONGELAMENTO: informazione <= Lf
  const quotaCampoNeutralizzato = (() => {
    let n = 0; let tot = 0;
    for (const [, c] of celleAlCongelamento) {
      tot += 1;
      let r = null; try { r = regimeAlCongelamento(c); } catch { r = null; }
      if (r !== null) n += 1;
    }
    return tot === 0 ? 0 : n / tot;
  })();
  const perGiroCompressione = vera
    ? perGiroDaVera(vera, prior)
    : pacchetto.compressionePerGiro(regimeOsservato, freezeLap, giroFinale, quotaCampoNeutralizzato);
  const neutralizzazione = perGiroCompressione === null ? null : { perGiro: perGiroCompressione };
  if (vera) {
    const conta = { SC: 0, VSC: 0, RED: 0 };
    for (const r of Object.values(vera)) conta[r] += 1;
    let sosteInFinestra = 0;
    for (const v of Object.values(pits)) for (const p of v) if (vera[p.lap]) sosteInFinestra += 1;
    dichiara('NEUTRALIZZAZIONE_VERA',
      `i giri neutralizzati sono quelli VERI della gara (${['SC', 'VSC', 'RED'].filter((r) => conta[r]).map((r) => `${conta[r]} ${r}`).join(' + ')}): `
      + `il campo si comprime li' col kappa del sigillo, e ${sosteInFinestra} sosta/e cadute in finestra pagano il fattore del regime`,
      Object.keys(vera).length,
      'INGRESSO DI LABORATORIO (informazione dal futuro, come le soste vere): al congelamento le Safety Car future non si conoscono (E14)');
  }
  if (neutralizzazione !== null && !vera) {
    const giri = Object.keys(perGiroCompressione).map(Number).sort((a, b) => a - b);
    const kBase = prior.compressione_distacchi_interna?.[regimeOsservato]?.kappa_mediano;
    dichiara('DISTACCHI_COMPRESSI',
      `al congelamento c'è ${regimeOsservato}: per ${giri.length} giri i distacchi dal leader si contraggono, `
      + `di ${giri.map((x) => perGiroCompressione[x].toFixed(3)).join(' poi ')} — sempre più vicino a 1 man mano che il regime probabilmente rientra`,
      giri.length,
      `MISURATO sul fondo: κ = ${kBase} sotto ${regimeOsservato}, sulle sole neutralizzazioni DI CAMPO. `
      + `Qui il ${(quotaCampoNeutralizzato * 100).toFixed(0)}% delle auto è sotto regime al congelamento (soglia 50%): `
      + `sotto metà campo non è una Safety Car ma una gialla locale, e la compressione non si applica`);
  }

  // ── passo: base misurata togliendo gli stessi termini che si ri-aggiungono ─
  const minGiriBase = typeof modello.min_giri_base?.valore === 'number'
    ? modello.min_giri_base.valore : MIN_GIRI_BASE_RIPIEGO;
  // `vita` arriva dal CONTESTO e va data a tutti e due — a chi misura la base e a chi
  // simula — o si conta due volte (regola 10, E02). Assente = spenta = numeri di prima.
  const basi = stimaBasi(osservazioniVerdi(g.righe), { delta70, rho, nGiri: nGiriGara, finoA: freezeLap, minGiri: minGiriBase, rodaggio, cliff, vita });
  const pace = creaPasso({ delta70, rho, nGiri: nGiriGara, basi, rodaggio, cliff, vita });
  if (rodaggio !== null) {
    dichiara('RODAGGIO_GOMMA_NUOVA',
      `nei primi giri di vita la gomma è più veloce di quanto dica il degrado lineare: si applica w(età) = −${modello.rodaggio.c}·exp(−età/${modello.rodaggio.tau}) s/giro`,
      1, modello.rodaggio.targhetta ?? 'misurato sul fondo 2026 in aria libera');
  }
  if (cliff !== null) {
    dichiara('CLIFF_FINE_VITA',
      `oltre i primi giri la gomma peggiora più in fretta del degrado lineare: si applica q(età) = ${modello.cliff.kappa}·età² s/giro`,
      1, modello.cliff.targhetta ?? 'parametro DERIVATO da fonte esterna, non misurato sui nostri dati');
  }

  // ── orizzonte legato al modello, non a un parametro morto (E20) ──────────
  const steps = giroFinale - freezeLap;
  const validati = modello.delta_70.decisione?.orizzonti_validati ?? [];
  const orizzonteValidato = validati.length ? Math.max(...validati) : null;
  // fin dove la RISPOSTA e' validata: dal contesto, mai una costante (vedi sotto)
  const orizzonteRisposta = typeof contesto.orizzonteRisposta?.giri === 'number'
    ? contesto.orizzonteRisposta.giri : null;
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
    state, pace, freezeLap, steps, pits, neutralizzazione, tetto, ritiri,
    assunzioni,
    perdita,
    // DUE ORIZZONTI, e fino al 03/08/2026 ne veniva pubblicato uno solo — quello sbagliato
    // per la domanda che il pannello fa.
    //
    //  · `orizzonte_validato` e' quello del PASSO: fin dove e' validato il coefficiente del
    //    carburante (delta_70.decisione.orizzonti_validati -> 10). Resta dov'era, e s17
    //    continua a sorvegliarlo: e' un fatto vero sul modello del tempo sul giro.
    //  · `orizzonte_risposta` e' fin dove la RISPOSTA batte il non-fare-niente: SEI giri,
    //    misurato il 03/08 e registrato in ai_lab/REGISTRO_F1.md. E' la domanda a cui
    //    l'utente sta guardando la risposta, ed e' un numero piu' basso.
    //
    // Il pannello mostrava il primo. Con 10 sovra-dichiarava: fra 7 e 10 giri la risposta
    // NON e' validata e non lo diceva — 774 pannelli su 11.143 (6,9%).
    //
    // Il numero vive nei DATI con la sua targhetta (data/modelli/orizzonte_risposta.json,
    // pinnato nel manifest), non come costante qui: e' la regola che s17 difende, ed e' la
    // lezione di E20. Assente ⇒ null ⇒ il campo non compare e niente cambia.
    orizzonte: {
      giroFinale,
      steps,
      orizzonte_validato: orizzonteValidato,
      oltre_il_validato: orizzonteValidato !== null && steps > orizzonteValidato,
      orizzonte_risposta: orizzonteRisposta,
      oltre_la_risposta: orizzonteRisposta !== null && steps > orizzonteRisposta,
    },
    targhette: {
      rho: modello.rho.targhetta,
      delta_70: `misurato — deciso dall'esperimento pre-registrato (${modello.delta_70.decisione?.braccio_vincente})`,
      pit_loss: perdita.targhetta,
    },
    // materiale per il Director e per le risposte
    _interno: { g, gara, pilota, soste, regime, celleAlCongelamento, nGiriGara, nonClassificati, vera },
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
      // giro di sosta → mescola montata, PER QUESTO pilota. Fino al 07/08 il
      // cambio gomma valeva solo per il soggetto (`drv === pilota`): scritto
      // quando solo lui aveva mescole nei pits. Dal 04/08 anche i rivali
      // possono averle (soste attese o vere), e lasciarli sulla gomma del
      // congelamento faceva squalificare da REG01 ogni rivale proiettato con
      // strategia dichiarata — un difetto del MATERIALIZZATORE, non del kernel,
      // trovato dal banco della pagina «E se?» (E20: i pezzi si spengono e si
      // accendono insieme). La fonte è UNA, `scenario.pits`, dove le mescole
      // sono già validate slick alla frontiera; per il soggetto coincide con
      // `mescolaDopoLaSosta` (stesse soste, stessa mappa).
      const mescolaAllaSosta = drv === pilota
        ? mescolaDopoLaSosta
        : new Map((scenario.pits[drv] ?? []).filter((p) => p.mescola).map((p) => [p.lap, p.mescola]));
      // Il primo giro proiettato è un out-lap se il pilota era ENTRATO ai box
      // al giro del congelamento: è il caso che il Director aveva ragione a
      // bocciare quando la proiezione lo ignorava.
      let prossimoEOutLap = alCongelamento.in_lap === true;
      let giroDelPit = null;
      for (const passo of traccia) {
        const eraInLap = passo.in_lap;
        const eOutLap = prossimoEOutLap;
        if (eOutLap) {
          stint = stint === null ? null : stint + 1;
          // La mescola scelta si monta solo dopo una sosta DELLO SCENARIO: dopo
          // una sosta già avvenuta al congelamento non si sa cosa abbiano preso.
          if (mescolaAllaSosta.has(giroDelPit)) compound = mescolaAllaSosta.get(giroDelPit);
        }
        prossimoEOutLap = eraInLap;
        if (eraInLap) giroDelPit = passo.lap;
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
            // ancora in corso. Non è una misura. Con la neutralizzazione VERA
            // i giri in finestra portano il loro simbolo — il Director deve
            // vedere neutralizzato ciò che era neutralizzato (i giri compressi
            // sono più veloci del passo, e in verde farebbero scattare FIS01).
            status: scenario._interno.vera?.[passo.lap]
              ? ({ SC: '4', VSC: '6', RED: '5' })[scenario._interno.vera[passo.lap]]
              : (suoiPit.has(passo.lap) && regime !== null ? (regime === 'SC' ? '4' : '6') : '1'),
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
      // I non-classificati della gara vera (elenco di laboratorio, vedi sopra) non
      // hanno una strategia COMPLETA dichiarabile: la loro gara si e' fermata prima,
      // e il Director mette a referto «REG01 non eseguito» invece di squalificare
      // un arrivo mai successo.
      strategia_dichiarata: drv === pilota
        || ((scenario.pits[drv] ?? []).length > 0 && !(scenario._interno.nonClassificati?.has(drv))),
      celle: [...osservate, ...proiettate],
      soste: (scenario.pits[drv] ?? []).map((p) => ({
        lap: p.lap,
        perdita: p.perdita,
        stazionario: null, // il grezzo non lo porta e non si inventa (regola 6)
        // con la neutralizzazione VERA ogni sosta porta il regime del SUO giro:
        // senza, il Director vedrebbe una sosta «verde» pagata al fattore SC e
        // la boccerebbe con FIS04 — a ragione, sul regime sbagliato
        regime: scenario._interno.vera ? (scenario._interno.vera[p.lap] ?? null) : regime,
      })),
    };
  }
  const nGiriGara = scenario._interno.nGiriGara;
  return { gara, n_giri: nGiriGara, completa: scenario.orizzonte.giroFinale === nGiriGara, piloti };
}

/**
 * IL perGiro DALLA NEUTRALIZZAZIONE VERA: ogni giro in finestra prende il kappa
 * MISURATO del suo regime, dal sigillo (compressione_distacchi_interna). Niente
 * valori di ripiego: un kappa assente fa esplodere, non inventa (regola 6).
 * Sotto ROSSA il campo si ricompatta come sotto SC — e' una scelta DICHIARATA
 * (la rossa incolonna in corsia box), non una misura: il fondo non ha abbastanza
 * giri di rossa per un kappa suo. Pura ed esportata per la sentinella s42.
 */
export function perGiroDaVera(vera, prior) {
  if (!vera) return null;
  const perGiro = {};
  for (const [lap, regime] of Object.entries(vera)) {
    const chiave = regime === 'RED' ? 'SC' : regime;
    const kappa = prior?.compressione_distacchi_interna?.[chiave]?.kappa_mediano;
    if (typeof kappa !== 'number' || !Number.isFinite(kappa)) {
      throw new Error(`kappa mancante nel sigillo per ${chiave}: la neutralizzazione vera non ha valori di ripiego (regola 6)`);
    }
    perGiro[lap] = kappa;
  }
  return Object.keys(perGiro).length ? perGiro : null;
}

/** Esegue lo scenario e lo fa passare dal Director prima di restituirlo. */
export function eseguiEValida(scenario, costantiDirector) {
  const risultato = simulate({
    state: scenario.state, pace: scenario.pace, freezeLap: scenario.freezeLap,
    steps: scenario.steps, pits: scenario.pits,
    neutralizzazione: scenario.neutralizzazione ?? null,
    // il tetto viaggia con lo scenario come pace e pits: se questa riga mancasse,
    // "dove rientri" girerebbe con il vincolo e "quando fermarti" senza — E17.
    // E i ritiri viaggiano con lo scenario per la stessa ragione (null in ogni
    // percorso di produzione: e' un ingresso di laboratorio).
    tetto: scenario.tetto ?? null, ritiri: scenario.ritiri ?? null, traccia: true,
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
    // IL LIVELLO PROMESSO E QUELLO RAGGIUNTO, DETTI INSIEME.
    //
    // Prima stavano affiancati — `livello: 0.8` accanto a `copertura: 0.7857` — e
    // toccava al lettore accorgersi che non coincidono. Sotto neutralizzazione NON
    // coincidono: la banda copre il 78,6% contro l'80% pre-registrato, e il
    // cancello D1 e' rosso per questo. E' una decisione presa il 01/08 al posto
    // delle due che il piano proponeva: non si ri-registra il livello (sarebbe
    // riscrivere un cancello dopo averne visto l'esito, E08) e non si smette di
    // pubblicare la banda (toglierebbe informazione dove la decisione e' piu'
    // difficile). Si dice che il livello non e' stato raggiunto, dove si vede.
    livello_raggiunto: c.copertura_fuori_campione >= banda.livello,
    avviso_livello: c.copertura_fuori_campione >= banda.livello ? null
      : `questa banda NON raggiunge il livello dichiarato: copre il ${(100 * c.copertura_fuori_campione).toFixed(1)}% `
        + `contro il ${(100 * banda.livello).toFixed(0)}% pre-registrato. Con l'informazione disponibile al congelamento `
        + `quel livello non e' attingibile sotto neutralizzazione, ed e' misurato: allargare la banda peggiora `
        + `(77,4% -> 58,3% fuori campione con due gradi di liberta'), e togliere il bias dalla previsione ha reso `
        + `solo +1,2 punti. Resta un cancello rosso e visibile, non un numero aggiustato`,
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

  // banda: solo dove il fattore di neutralizzazione entra davvero in gioco E ha
  // un'incertezza dichiarata.
  //
  // SOTTO BANDIERA ROSSA NON C'E' BANDA, e non e' una dimenticanza: il fattore
  // RED vale 0 per DICHIARAZIONE (a gara sospesa le auto incolonnano e la sosta
  // non costa posizioni), non per stima, quindi non ha un intervallo attorno.
  // SC e VSC ce l'hanno perche' sono prior misurati con banda (0,40-0,60 e
  // 0,60-0,70). Inventare qui un [0,0] per far tornare il codice sarebbe
  // fabbricare una precisione che nessuno ha dichiarato; l'assenza si dichiara
  // (regola 6) e la nota sotto lo dice.
  const regimeCurva = centrale.find((c) => c.scenario._interno.regime !== null)?.scenario._interno.regime ?? null;
  const bandaDelRegime = regimeCurva === null
    ? null : (contesto.costantiDirector.limiti.bande_neutralizzazione[regimeCurva] ?? null);
  const conRegime = bandaDelRegime !== null;
  const bande = { basso: null, alto: null };
  if (conRegime) {
    const [b, a] = bandaDelRegime;
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

  // ── LA FINESTRA: i giri che il motore non sa distinguere dall'ottimo ──────
  //
  // Decisione del PO (01/08): il giro raccomandato non si pubblica piu' come un
  // numero secco. Restava da stabilire quanto larga, e la misura
  // (ai_lab/confronto/PREREG_finestra.md) ha detto una cosa utile: l'incertezza
  // del modello — rho, delta70 e pit-loss agli estremi dei loro IC95 — sposta il
  // giro raccomandato in UNA curva su 1.153. A muoverlo e' dove si chiede.
  //
  // Quindi la finestra non si costruisce perturbando il modello (non muoverebbe
  // niente al prezzo di cinque volte il tempo di calcolo) e NEMMENO dai
  // congelamenti adiacenti: L+1 e' il futuro, e in diretta non esiste (E14).
  //
  // Si costruisce da cio' che il record ha gia': la curva. Sono i giri il cui
  // `delta_s` sta sotto l'errore che il motore DICHIARA di avere — 0,17 s/giro,
  // la soglia del cancello del banco — moltiplicato per quanto lontano sta
  // proiettando. Se due giri distano meno di quello, il motore non li distingue,
  // e dire il contrario sarebbe fingere una precisione che non ha.
  const orizzonteGiri = Math.max(1, giroFinale - freezeLap);
  const sogliaFinestra = BIAS_DICHIARATO_S_GIRO * orizzonteGiri;
  const dentro = curva.filter((c) => c.delta_s <= sogliaFinestra).map((c) => c.giroPit);
  const finestra = dentro.length ? {
    da: Math.min(...dentro),
    a: Math.max(...dentro),
    n_giri: dentro.length,
    soglia_s: Number(sogliaFinestra.toFixed(2)),
    targhetta: `i giri che il motore non distingue dall'ottimo: entro ${sogliaFinestra.toFixed(2)} s, `
      + `cioe' ${BIAS_DICHIARATO_S_GIRO} s/giro (il bias massimo che il modello dichiara di se') per ${orizzonteGiri} giri proiettati. `
      + `NON e' un intervallo di confidenza: il rumore di gara, il traffico e la reazione dei rivali non sono qui dentro`,
  } : null;
  const scenarioRif = validi[0].scenario;
  return {
    approvato: true,
    curva,
    minimo,
    finestra,
    orizzonte: scenarioRif.orizzonte,
    assunzioni: scenarioRif.assunzioni,
    targhette: scenarioRif.targhette,
    banda_presente: conRegime,
    nota_banda: conRegime
      ? 'la banda viene dal fattore di neutralizzazione, che è un PRIOR con banda dichiarata'
      : (regimeCurva === null
        ? 'nessuna banda: tutti i candidati sono in verde e la perdita ai box, uguale per tutti, si cancella nella differenza — la forma della curva non dipende da quel prior'
        : `nessuna banda: sotto ${regimeCurva} la sosta non costa posizioni per DICHIARAZIONE (la gara è sospesa e le auto incolonnano), non per stima — e una dichiarazione non ha un intervallo attorno`),
    respinti_dal_director: respinti.length,
  };
}
