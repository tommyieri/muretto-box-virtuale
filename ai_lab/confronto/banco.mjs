// banco.mjs — IL BANCO DEL CONFRONTO FRA I DUE MOTORI.
//
// Un modulo solo, che tutti gli altri agenti del confronto importano. Fa tre cose e basta:
//   1. elenca i CASI (le soste vere del perimetro) e la loro VERITA';
//   2. esegue il motore VECCHIO (demo/pitscenario.mjs::evaluatePit) su un caso;
//   3. esegue il motore NUOVO (simulatore/scenario/costruttore.mjs::doveRientri) su un caso.
// Le CINQUE METRICHE non stanno qui: qui c'e' il metro, non il giudizio.
//
//     node ai_lab/confronto/banco.mjs            censimento + allineamento + 3 casi di prova
//     node ai_lab/confronto/banco.mjs --json     lo stesso, in JSON
//
// Vale la pre-registrazione in ai_lab/confronto/PREREG_confronto_motori.md.
// Questo file NON scrive niente su disco e non tocca demo/, simulatore/, data/.
//
// ============================================================================
// 1. LA VERITA': COME SI CALCOLA LA POSIZIONE VERA, E PERCHE' E' QUELLA GIUSTA
// ============================================================================
// Per ogni sosta reale del pilota D con giro d'ingresso Li (la cella di Li ha `in_lap`):
//   - congelamento  L  = Li − 1   (l'ultimo giro in cui la sosta non e' ancora visibile)
//   - giro di sosta    = Li
//   - giro di rientro Lo = Li + 1 (la cella di Lo ha `out_lap`: verificato, 274/274)
//
// `posizioneVera` = il RANGO di D fra le auto che hanno un `cum_time` NUMERICO al giro Lo,
// ordinate per `cum_time` crescente (pari merito spezzato in ordine alfabetico, come fanno
// entrambi i motori). Non e' una stima: `cum_time` e' il tempo di sessione con cui quel
// pilota ha CHIUSO il giro Lo, quindi ordinarli e' esattamente la classifica sul traguardo
// a quel giro. Nessun modello entra nel numero.
//
// Perche' e' la controparte giusta della domanda «dove rientri»: la domanda si chiude al
// primo giro completo dopo la sosta, ed e' anche il giro su cui i due motori rispondono —
// il nuovo per costruzione (`doveRientri` fissa `giroFinale = giroPit + 1`), il vecchio
// perche' qui lo si chiama con `orizzonte = 0`, che gli fa terminare la simulazione allo
// stesso identico giro (vedi §3).
//
// Le auto DOPPIATE al giro Lo hanno per costruzione un `cum_time` piu' grande di chiunque
// sia a pari giro, quindi finiscono in coda all'ordinamento e non spostano il rango di D:
// gonfiano `suQuantiVeri`, non `posizioneVera`. Per questo restano dentro. Il caso in cui
// il doppiato e' D STESSO e' invece escluso dal perimetro (la sua posizione «fra chi e' a
// pari giro» non e' confrontabile): D e' doppiato al rientro se il leader ha gia' chiuso il
// giro Lo+1 in meno tempo di quanto D ne abbia impiegato per chiudere Lo.
// Per trasparenza il caso porta anche `posizioneFraPariGiro`/`suQuantiPariGiro`, calcolati
// escludendo i doppiati: servono a M4, dove le popolazioni dei due motori vanno riconciliate.
//
// ============================================================================
// 2. I DUE MOTORI VEDONO LO STESSO CASO — VERIFICATO, NON ASSUNTO
// ============================================================================
// Il vecchio legge `demo/data/<gara>.json`, il nuovo carica il grezzo pinnato di
// `simulatore/data/gare_2026/`. `verificaAllineamento()` confronta cella per cella
// `cum_time` e `compound`.
//
//   MISURATO (31/07/2026, tutte e 11 le gare, tutte le celle):
//   12.733 celle confrontate · 0 divergenze di cum_time (scarto massimo 0) · 0 di compound.
//
// Non e' una coincidenza fortunata: dal 31/07/2026 `demo/data/<gara>.json` E' PRODOTTO da
// `simulatore/provenienza/esporta_demo_gara.mjs` a partire dallo stesso grezzo. I due
// motori leggono due formati della stessa fonte. Se un giorno divergessero,
// `verificaAllineamento()` lo dice prima che il confronto abbia senso.
//
// ============================================================================
// 3. NIENTE FUTURO — E UNA NOTIZIA SUL MOTORE VECCHIO
// ============================================================================
// MOTORE NUOVO: e' pulito per costruzione, ed e' verificabile leggendo il codice.
// `costruisciScenario` prende UNA cella per pilota, quella del congelamento
// (`celle.get(freezeLap)`); stima il passo con `stimaBasi(..., { finoA: freezeLap })`, che
// scarta le osservazioni con `lap > finoA`; `materializzaPerDirector` filtra
// `lap <= scenario.freezeLap`. Il regime della sosta viene dalla cella del congelamento e
// vale al massimo un giro in avanti (`PERSISTENZA_REGIME_GIRI = 1`), dichiarato.
//
// MOTORE VECCHIO: **gen_hero.mjs gli passa `byLap` INTERO, e il motore vecchio legge oltre
// il congelamento in tre punti**. Questo banco lo ha trovato guardando il codice:
//   a) `evaluatePit` -> `giroNeutralizzato = byLap[pitLap][driver].neutralized` (giro L+1);
//   b) `evaluatePit` -> il ciclo di `sotto_neutralizzazione` scandisce da `pitLap` a
//      `L + steps`;
//   c) `stessoGiroReale(byLap, L, nLaps, ...)` guarda i giri da L a L+3 per decidere chi e'
//      a pari giro;
//   d) e a monte, `demo/gradino.mjs::soste(byLap, nLaps, finoAGiro)` si ferma alle soste con
//      `L < finoAGiro` ma per OGNUNA legge la finestra post-sosta fino a `L + 6`: al
//      congelamento arriva quindi a `freezeLap + 5`. E' l'errore E15 del catalogo, ancora
//      vivo in demo/.
//
// Il requisito del confronto e' esplicito: al congelamento nessuna delle due chiamate riceve
// dati oltre quel giro. Percio' QUI il vecchio riceve `byLap` TRONCATO a `<= freezeLap`
// (`byLapTroncato`), e la stessa struttura troncata va anche a `misura()` per il gradino.
// `pace` e' gia' pulito di suo: `demo/data/<gara>.json` scrive `pace[L]` calcolato sui soli
// giri `<= L` (esporta_demo_gara.mjs::passoLegacy, parametro `finoA`), ed e' esattamente
// quello che passa gen_hero.mjs.
//
// IL PREZZO DEL TRONCAMENTO E' MISURATO, NON NASCOSTO (274 casi, 235 con risposta da
// entrambe le varianti):
//   - la posizione di rientro cambia in 49 casi su 235;
//   - `su_totale` cambia in 100 su 235 (con byLap troncato `stessoGiroReale` non ha piu'
//     giri futuri da guardare e la cerchia «a pari giro» diventa tutto il campo presente);
//   - il gradino cambia in 112 casi su 274 (e' la fuga E15 che si chiude);
//   - sulla verita': esatti 75/235 troncato contro 82/235 a byLap intero.
// Cioe': **il troncamento COSTA al motore vecchio**. Va detto perche' e' il contrario del
// sospetto naturale («hanno handicappato il vecchio per far vincere il nuovo» va guardato
// in faccia): il troncamento gli toglie sia un vantaggio (sa se il giro della sosta sara'
// neutralizzato) sia una capacita' (la cerchia a pari giro), e chi legge deve saperlo.
// La variante intera resta a una parola di distanza: `rispostaVecchio(c, { troncato: false })`.
// Ogni risposta porta il campo `troncato`, cosi' nessuna misura puo' confondere le due.
//
// ATTENZIONE, ASIMMETRIA STRUTTURALE DA DICHIARARE NEI REFERTI: con `byLap` troncato il
// motore vecchio non ha PIU' NESSUN meccanismo di neutralizzazione (ne' le soste dei rivali
// sotto SC, ne' la soppressione dei gap), mentre il nuovo ce l'ha e legittimamente — il suo
// lavora sul regime osservato al congelamento, che e' informazione `<= L`. Sui 274 casi il
// regime al congelamento c'e' in 52; al giro della sosta (futuro) in 121.
//
// ============================================================================
// 4. STESSA DOMANDA AI DUE MOTORI
// ============================================================================
// gen_hero.mjs — l'uso di riferimento in produzione — chiama `evaluatePit` con
// `orizzonte = 5` quando il gradino c'e'. Quell'orizzonte NON si copia qui, ed e' l'unico
// parametro in cui questo banco si scosta da gen_hero: con `orizzonte = 5` la risposta del
// vecchio e' la posizione al giro `Li + 6`, non al rientro, e la si confronterebbe con una
// verita' presa sei giri prima. Con `orizzonte = 0` si ha `steps = (pitLap − L) + 1 = 2`, la
// simulazione finisce al giro `L + 2 = Lo`, ed e' lo STESSO giro su cui risponde il nuovo
// (`giroFinale = giroPit + 1`, `steps = 2`). Tutto il resto viene da gen_hero senza
// inventare niente: `ZONE = 0`, `gradino` da `misura()` con la stessa soglia di 3 soste,
// `pitLoss` da `demo/data/pitloss.json`, `present` filtrato su cum_time e pace.
// Il `gradino` resta acceso anche a orizzonte 0: e' il pezzo che nel vecchio distingue il
// passo dopo la sosta, e agisce gia' sul giro di rientro.
//
// La MESCOLA passata al nuovo e' quella su cui il pilota gira AL CONGELAMENTO
// (`mescolaAlGiro`, la stessa convenzione della vista del sito): quella che monteranno e'
// informazione del futuro. Nel motore nuovo la mescola e' dichiarata e non cambia il
// degrado (assunzione MESCOLA_NON_SEPARA, p = 0,209), quindi non muove il numero.
//
// ============================================================================
// 5. STATO INTERNO
// ============================================================================
// L'unico stato e' una MEMOIZZAZIONE pura: i file di gara e il contesto del nuovo si
// leggono una volta sola e si riusano. Nessuna scrittura su disco, nessun contatore
// globale, nessun ordine di chiamata obbligato: le funzioni si possono chiamare in
// qualunque ordine e restituiscono sempre lo stesso valore per lo stesso ingresso.
// `svuotaCache()` esiste per chi volesse rileggere da zero.

import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { evaluatePit } from '../../demo/pitscenario.mjs';
import { misura as misuraGradino } from '../../demo/gradino.mjs';
import { caricaGare2026 } from '../../simulatore/provenienza/gare_2026.mjs';
import { caricaPrior } from '../../simulatore/provenienza/pitloss_dati.mjs';
import { caricaCostanti } from '../../simulatore/scenario/director_dati.mjs';
import { doveRientri } from '../../simulatore/scenario/costruttore.mjs';
import { mescolaAlGiro, regimeAlGiro } from '../../simulatore/scenario/risposta.mjs';

const QUI = path.dirname(fileURLToPath(import.meta.url));
export const RADICE = path.resolve(QUI, '..', '..');
const DEMO_DATA = path.join(RADICE, 'demo', 'data');
const SIM = path.join(RADICE, 'simulatore');

// I parametri del vecchio, copiati da gen_hero.mjs (unica eccezione: ORIZZONTE, vedi §4).
const MIN_SOSTE_UI = 3;   // stessa soglia del pannello (demo/muretto.mjs)
const ZONE = 0;           // CAP_TRAFFICO = false in produzione
const ORIZZONTE = 0;      // la risposta deve cadere sul GIRO DI RIENTRO

// Perimetro pre-registrato.
const PRIMO_GIRO_AMMESSO = 4;   // soste con Li <= 3 escluse

// ————————————————————————————————————————————————————————————— memoizzazione
let _cache = null;
const cache = () => (_cache ??= { demo: new Map(), gareSim: null, contesto: null, casi: null, troncati: new Map() });
export function svuotaCache() { _cache = null; }

// ————————————————————————————————————————————————————————————— nomi di gara
// Il sito scrive "Gran Bretagna", il simulatore "GranBretagna" (E24: lo spazio spezza i
// glob). Il ponte NON si cabla: e' un dato, e sta in demo/data/vista/manifest.json, scritto
// da simulatore/web/genera_vista_gara.mjs::manifestDaDisco. Se un giorno arrivasse una gara
// con un nome che la regola meccanica non indovina, il manifest lo sa e questo modulo pure.
function mappaNomi() {
  const c = cache();
  if (c.nomi) return c.nomi;
  const man = JSON.parse(readFileSync(path.join(DEMO_DATA, 'vista', 'manifest.json'), 'utf8'));
  const sito2sim = { ...man.cartella_di };
  const sim2sito = Object.fromEntries(Object.entries(sito2sim).map(([sito, sim]) => [sim, sito]));
  c.nomi = { sito2sim, sim2sito, gareSito: Object.keys(sito2sim).sort() };
  return c.nomi;
}
/** "Gran Bretagna" -> "GranBretagna" */
export function garaSimDi(nomeSito) {
  const n = mappaNomi().sito2sim[nomeSito];
  if (!n) throw new Error(`gara del sito sconosciuta: ${JSON.stringify(nomeSito)}`);
  return n;
}
/** "GranBretagna" -> "Gran Bretagna" */
export function garaSitoDi(nomeSim) {
  const n = mappaNomi().sim2sito[nomeSim];
  if (!n) throw new Error(`gara del simulatore sconosciuta: ${JSON.stringify(nomeSim)}`);
  return n;
}
/** Le 11 gare del perimetro, col nome del sito. */
export function gare() { return [...mappaNomi().gareSito]; }

// ————————————————————————————————————————————————————— dati del motore vecchio
/**
 * Il materiale del vecchio per una gara: il JSON del sito, l'indice per giro, il pit-loss.
 * `byLapTroncato(L)` restituisce la stessa struttura con i soli giri <= L (memoizzata).
 */
export function datiVecchio(nomeSito) {
  const c = cache();
  if (c.demo.has(nomeSito)) return c.demo.get(nomeSito);
  const G = JSON.parse(readFileSync(path.join(DEMO_DATA, `${nomeSito}.json`), 'utf8'));
  const PITLOSS = JSON.parse(readFileSync(path.join(DEMO_DATA, 'pitloss.json'), 'utf8'));
  const pitLoss = PITLOSS[nomeSito];
  if (pitLoss == null) throw new Error(`pit-loss assente per ${nomeSito}`);
  const byLap = {};
  for (const l of G.laps) byLap[l.lap] = l.cars;
  const troncati = new Map();
  const byLapTroncato = (L) => {
    if (troncati.has(L)) return troncati.get(L);
    const t = {};
    for (let k = 1; k <= L; k += 1) if (byLap[k]) t[k] = byLap[k];
    troncati.set(L, t);
    return t;
  };
  const v = { nomeSito, G, byLap, byLapTroncato, nLaps: G.n_laps, pitLoss };
  c.demo.set(nomeSito, v);
  return v;
}

// ————————————————————————————————————————————————————— dati del motore nuovo
/**
 * Il contesto del motore nuovo, caricato UNA volta (memoizzato).
 * Costruito esattamente come fa `simulatore/web/genera_vista_gara.mjs::main`.
 *
 * @param nomeSito se passato, il contesto torna gia' con `nGiriGara` di quella gara —
 *                 che il costruttore pretende come INGRESSO dichiarato e non deduce.
 *                 Senza argomento `nGiriGara` e' null: e' il contesto condiviso.
 */
export function contestoNuovo(nomeSito = null, modelloOverride = null) {
  const c = cache();
  if (!c.contesto) {
    const gareSim = caricaGare2026(SIM);
    const modello = JSON.parse(readFileSync(path.join(SIM, 'data', 'modelli', 'modello_v2.json'), 'utf8'));
    const prior = caricaPrior(SIM);
    const costantiDirector = caricaCostanti(SIM);
    const bandaRientro = JSON.parse(readFileSync(path.join(SIM, 'data', 'modelli', 'banda_rientro.json'), 'utf8'));
    c.gareSim = gareSim;
    c.contesto = { gare: gareSim, modello, prior, costantiDirector, bandaRientro, nGiriGara: null };
  }
  // Il MODELLO si può sostituire senza toccare il disco. Serve a chi misura una
  // variante pre-registrata — per esempio i parametri leave-one-race-out del
  // rodaggio, diversi per ogni gara — e NON cambia niente quando non si passa:
  // il contesto memoizzato resta l'unico oggetto condiviso. Un override non
  // finisce mai in cache, così due misure adiacenti non si contaminano.
  const conModello = modelloOverride === null ? c.contesto : { ...c.contesto, modello: modelloOverride };
  if (nomeSito === null) return conModello;
  const g = c.gareSim[garaSimDi(nomeSito)];
  if (!g) throw new Error(`gara assente dal simulatore: ${nomeSito}`);
  return { ...conModello, nGiriGara: g.nGiri };
}

/**
 * LA RI-CLASSIFICAZIONE SULLA POPOLAZIONE COMUNE, esposta dal banco.
 *
 * `pos` e' un RANGO dentro una popolazione, e le popolazioni dei due motori non
 * coincidono: al vecchio manca il passo di ~3 auto, quasi tutte davanti. Percio'
 * confrontare i due `pos` grezzi (lettura A) e confrontarli dopo averli
 * ri-classificati sulla stessa popolazione (letture B e B2) da' risultati che
 * differiscono di SEI punti — e nessuna delle due sbaglia un conto.
 *
 * Finche' ogni misura se la ri-scriveva in casa, due agenti potevano riportare due
 * numeri diversi dello stesso M1 senza che nessuno avesse torto. Da qui in poi la
 * ri-classificazione e' UNA, e sta nel banco insieme al metro.
 *
 * @param ordine  l'ordine previsto dal motore (sigle, o coppie [sigla, tempo])
 * @param vero    l'ordine vero al giro di rientro
 * @param pilota  di chi si vuole il rango
 * @param altro   l'ordine dell'ALTRO motore: se c'e', la popolazione e' la TERNA
 *                comune (lettura B2, il confronto piu' stretto); se no e' la
 *                coppia motore-verita' (lettura B).
 * @returns `{ pos, posVera, errore, su }` oppure null se il pilota non e' dentro.
 */
export function riclassifica(ordine, vero, pilota, altro = null) {
  const sigle = (o) => (o ? o.map((x) => (Array.isArray(x) ? x[0] : x)) : null);
  const sN = sigle(ordine);
  const sA = sigle(altro);
  if (!sN || !vero) return null;
  const inN = new Set(sN);
  const inA = sA ? new Set(sA) : null;
  const dentro = new Set(vero.filter((d) => inN.has(d) && (inA === null || inA.has(d))));
  const rango = (elenco) => {
    const f = elenco.filter((d) => dentro.has(d));
    const i = f.indexOf(pilota);
    return i < 0 ? null : i + 1;
  };
  const pos = rango(sN);
  const posVera = rango(vero);
  if (pos === null || posVera === null) return null;
  return { pos, posVera, errore: pos - posVera, su: dentro.size };
}

/** Il modello v2 come sta su disco, copia fresca (per costruirne varianti). */
export function modelloDaDisco() {
  return JSON.parse(readFileSync(path.join(SIM, 'data', 'modelli', 'modello_v2.json'), 'utf8'));
}

/** La gara nel formato del simulatore (`{ righe, perPilota, nGiri, fonte }`). */
export function garaNuova(nomeSito) {
  contestoNuovo();
  return cache().gareSim[garaSimDi(nomeSito)];
}

// ———————————————————————————————————————————————————————————————— i CASI
const ordina = (cum) => (a, b) => (cum[a] - cum[b]) || (a < b ? -1 : b < a ? 1 : 0);

/**
 * L'elenco delle soste vere del perimetro, con la verita'.
 * Ordinato per gara (alfabetico), poi per giro di sosta, poi per pilota: deterministico.
 */
export function casi() {
  const c = cache();
  if (c.casi) return c.casi;
  const { casi: elenco } = costruisciCasi();
  c.casi = elenco;
  return elenco;
}

/** Il censimento delle esclusioni: quante soste sono cadute e per quale motivo. */
export function censimento() {
  const c = cache();
  if (!c.censimento) costruisciCasi();
  return c.censimento;
}

function costruisciCasi() {
  const c = cache();
  const elenco = [];
  const cens = {
    soste_reali_trovate: 0,
    esclusi: { pit_entro_il_giro_3: 0, senza_cum_al_congelamento: 0, senza_giro_di_rientro: 0, senza_cum_al_rientro: 0, doppiato_al_rientro: 0 },
    per_gara: {},
    ammessi: 0,
  };
  for (const nomeSito of gare()) {
    const { G, byLap, nLaps } = datiVecchio(nomeSito);
    // leaderCum[k] = tempo di sessione con cui il PRIMO ha chiuso il giro k.
    const leaderCum = {};
    for (let k = 1; k <= nLaps; k += 1) {
      const cars = byLap[k];
      if (!cars) continue;
      let m = Infinity;
      for (const d of Object.keys(cars)) {
        const t = cars[d].cum_time;
        if (typeof t === 'number' && t < m) m = t;
      }
      if (m < Infinity) leaderCum[k] = m;
    }
    const doppiatoA = (Lo, cum) => leaderCum[Lo + 1] !== undefined && cum > leaderCum[Lo + 1];

    const riga = { soste: 0, ammessi: 0 };
    const daQui = [];
    for (let Li = 1; Li <= nLaps; Li += 1) {
      const cars = byLap[Li];
      if (!cars) continue;
      for (const pilota of Object.keys(cars)) {
        if (cars[pilota].in_lap !== true) continue;   // la sosta VERA e' la cella con in_lap
        cens.soste_reali_trovate += 1; riga.soste += 1;
        const L = Li - 1, Lo = Li + 1;
        if (Li < PRIMO_GIRO_AMMESSO) { cens.esclusi.pit_entro_il_giro_3 += 1; continue; }
        if (typeof byLap[L]?.[pilota]?.cum_time !== 'number') { cens.esclusi.senza_cum_al_congelamento += 1; continue; }
        if (!byLap[Lo]) { cens.esclusi.senza_giro_di_rientro += 1; continue; }
        const cumLo = byLap[Lo][pilota]?.cum_time;
        if (typeof cumLo !== 'number') { cens.esclusi.senza_cum_al_rientro += 1; continue; }
        if (doppiatoA(Lo, cumLo)) { cens.esclusi.doppiato_al_rientro += 1; continue; }

        // la verita': rango per cum_time fra chi ha un cum_time al giro Lo
        const cum = {};
        for (const d of Object.keys(byLap[Lo])) {
          const t = byLap[Lo][d].cum_time;
          if (typeof t === 'number') cum[d] = t;
        }
        const ordine = Object.keys(cum).sort(ordina(cum));
        const pariGiro = ordine.filter((d) => !doppiatoA(Lo, cum[d]));

        // la posizione al congelamento, con la stessa regola, per chi ne ha bisogno
        const cumL = {};
        for (const d of Object.keys(byLap[L])) {
          const t = byLap[L][d].cum_time;
          if (typeof t === 'number') cumL[d] = t;
        }
        const ordineL = Object.keys(cumL).sort(ordina(cumL));

        const cellaL = byLap[L][pilota];
        const cellaLi = byLap[Li][pilota];
        const cellaLo = byLap[Lo][pilota];
        const passo = G.pace[String(L)]?.[pilota];

        daQui.push({
          id: `${nomeSito}|${pilota}|${Li}`,
          gara: nomeSito,
          garaSim: garaSimDi(nomeSito),
          pilota,
          freezeLap: L,
          pitLap: Li,
          rientroLap: Lo,
          nGiri: nLaps,

          // — la verita' —
          posizioneVera: ordine.indexOf(pilota) + 1,
          suQuantiVeri: ordine.length,
          posizioneFraPariGiro: pariGiro.indexOf(pilota) + 1,
          suQuantiPariGiro: pariGiro.length,
          ordineVero: ordine,
          cumAlRientro: cumLo,

          // — mescole —
          // quella che i motori ricevono (informazione <= L)
          mescolaAlCongelamento: cellaL.compound ?? null,
          // quella davvero montata alla sosta: FUTURO, solo diagnostica, non entra nei motori
          mescolaMontata: cellaLo.compound ?? null,

          // — regime —
          // <= L: e' cio' che il nuovo usa e cio' che si saprebbe in diretta
          neutralizzato: cellaL.neutralized === true,
          regimeAlCongelamento: null,   // riempito sotto dal proprietario della definizione
          // FUTURO: e' cio' che il vecchio legge quando gli si passa byLap intero
          neutralizzatoAlPit: cellaLi.neutralized === true,

          // — contorno utile —
          posizioneAlCongelamento: ordineL.indexOf(pilota) + 1,
          cumAlCongelamento: cellaL.cum_time,
          etaGommaAlCongelamento: cellaL.tyre_age ?? null,
          stintAlCongelamento: cellaL.stint ?? null,
          passoVecchioDisponibile: passo != null,
        });
        riga.ammessi += 1;
        cens.ammessi += 1;
      }
    }
    // il regime (SC/VSC) si chiede al suo unico proprietario nel simulatore (regola 1)
    const gSim = garaNuova(nomeSito);
    for (const k of daQui) k.regimeAlCongelamento = regimeAlGiro(gSim, k.freezeLap, k.pilota);
    daQui.sort((a, b) => a.pitLap - b.pitLap || (a.pilota < b.pilota ? -1 : 1));
    elenco.push(...daQui);
    cens.per_gara[nomeSito] = riga;
  }
  c.censimento = cens;
  return { casi: elenco, censimento: cens };
}

// —————————————————————————————————————————————————————————— motore VECCHIO
/**
 * Gli ingressi ESATTI di `evaluatePit` per un caso — esposti a parte perche' chi misura
 * M2 (bias del passo) e M3 (la curva del quando) deve poterli variare (orizzonte, pitLap)
 * senza ricostruirli a mano e senza rischiare di ricostruirli DIVERSI.
 */
export function ingressiVecchio(caso, { troncato = true, orizzonte = ORIZZONTE, pitLap = null } = {}) {
  const { G, byLap, byLapTroncato, nLaps, pitLoss } = datiVecchio(caso.gara);
  const L = caso.freezeLap;
  const bl = troncato ? byLapTroncato(L) : byLap;
  const pace = G.pace[String(L)] || {};   // gia' calcolato sui soli giri <= L (passoLegacy finoA)
  const present = G.drivers.filter((d) => typeof bl[L]?.[d]?.cum_time === 'number' && pace[d] != null);
  const viva = misuraGradino(bl, nLaps, L);
  const gradino = (viva.gradino != null && viva.n_gradino >= MIN_SOSTE_UI) ? viva.gradino : null;
  return {
    argomenti: {
      byLap: bl, nLaps, pace, driver: caso.pilota, freezeLap: L,
      pitLap: pitLap ?? caso.pitLap, pitLoss, present,
      gara: caso.gara, laps: G.laps, ZONE, orizzonte, gradino,
    },
    gradino, n_gradino: viva.n_gradino, troncato,
  };
}

/**
 * La risposta del motore VECCHIO su un caso.
 * @returns `{ ok, pos, su, ordine, muto, motivo, ... }` — `muto` e' true quando il motore
 *          non risponde: non si scarta il caso, si registra il silenzio (prereg §metriche).
 */
export function rispostaVecchio(caso, opzioni = {}) {
  const ing = ingressiVecchio(caso, opzioni);
  let r;
  try {
    r = evaluatePit(ing.argomenti);
  } catch (e) {
    return { motore: 'vecchio', ok: false, muto: true, motivo: `eccezione: ${e.message}`,
             pos: null, su: null, ordine: null, troncato: ing.troncato, gradino: ing.gradino, grezzo: null };
  }
  if (!r || r.ok !== true) {
    return { motore: 'vecchio', ok: false, muto: true, motivo: r?.reason ?? 'nessuna risposta',
             pos: null, su: null, ordine: null, troncato: ing.troncato, gradino: ing.gradino, grezzo: r ?? null };
  }
  return {
    motore: 'vecchio',
    ok: true,
    muto: false,
    motivo: null,
    pos: r.rientro_pos,
    su: r.su_totale,
    // [[sigla, tempo simulato al giro di rientro], ...] dal primo all'ultimo
    ordine: r.ordine_previsto,
    davanti: r.davanti_ho,
    dietro: r.dietro_esco,
    gap_ahead: r.gap_ahead,
    gap_behind: r.gap_behind,
    sotto_neutralizzazione: r.sotto_neutralizzazione,
    soste_rivali_assunte: r.soste_rivali_assunte,
    // IL GIRO IN CUI LA SIMULAZIONE FINISCE DAVVERO, non quello del caso.
    //
    // Era cablato a `caso.rientroLap`, e con l'orizzonte di default (0) coincide —
    // la simulazione finisce al giro di rientro. Ma chi misura M2 o M3 varia
    // l'orizzonte, e da quel momento questo campo MENTIVA: diceva il giro del caso
    // mentre la simulazione era finita altrove. Un banco che mente proprio sul
    // percorso di chi lo interroga per un'altra domanda e' peggio di un banco che
    // tace: il numero sbagliato non si vede, si usa.
    giro_di_rientro: ing.argomenti.pitLap + 1 + ing.argomenti.orizzonte,
    gradino: ing.gradino,
    n_gradino: ing.n_gradino,
    troncato: ing.troncato,
    grezzo: r,
  };
}

// ——————————————————————————————————————————————————————————— motore NUOVO
/**
 * La risposta del motore NUOVO su un caso.
 * @returns `{ ok, pos, su, banda, muto, motivo, ... }`
 *
 * Tre modi di NON rispondere, tutti registrati come muti con il loro motivo:
 *   - la mescola al congelamento non e' slick nota (il costruttore rifiuta, e giustamente:
 *     non si finge una gomma);
 *   - il Director respinge lo scenario (`approvato: false`) — un rifiuto E' una risposta,
 *     ma non e' un numero;
 *   - il pilota non ha un passo base e il kernel lo lascia a `null` (regola 6).
 */
export function rispostaNuovo(caso, { mescola = null, modello = null, tetto = null } = {}) {
  const gSim = garaNuova(caso.gara);
  const scelta = mescola ?? mescolaAlGiro(gSim, caso.freezeLap, caso.pilota);
  const base = { motore: 'nuovo', ok: false, muto: true, pos: null, su: null, banda: null, grezzo: null };
  if (scelta === null) {
    return { ...base, motivo: 'mescola al congelamento non nota o non slick: il motore non finge una gomma' };
  }
  const contesto = tetto === null ? contestoNuovo(caso.gara, modello)
    : { ...contestoNuovo(caso.gara, modello), tetto };
  let r;
  try {
    r = doveRientri({ gara: caso.garaSim, freezeLap: caso.freezeLap, pilota: caso.pilota,
                      giroPit: caso.pitLap, mescola: scelta }, contesto);
  } catch (e) {
    return { ...base, motivo: `eccezione: ${e.message}`, mescola_usata: scelta };
  }
  if (!r || r.approvato !== true) {
    const motivi = (r?.direttore?.violazioni ?? []).filter((v) => v.severita === 'FATAL')
      .map((v) => v.messaggio ?? v.codice);
    return { ...base, motivo: `respinto dal Director: ${motivi.join(' · ') || 'senza motivo dichiarato'}`,
             mescola_usata: scelta, grezzo: r ?? null };
  }
  if (r.posizione === null || r.posizione === undefined) {
    return { ...base, motivo: 'nessuna posizione: il pilota non ha un passo base (regola 6)',
             mescola_usata: scelta, grezzo: r };
  }
  // l'ordine completo al giro di rientro, ricostruito dalla traccia: serve a M1/M4 per
  // riclassificare le due previsioni sulla STESSA popolazione. E' la stessa quantita' su cui
  // `doveRientri` ha calcolato `posizione` (il cum finale = cum al giro di rientro).
  let ordine = null;
  if (r.traccia) {
    const cum = {};
    for (const [drv, passi] of Object.entries(r.traccia)) {
      if (!passi) continue;
      const p = passi.find((x) => x.lap === caso.rientroLap);
      if (p) cum[drv] = p.cum_time;
    }
    ordine = Object.keys(cum).sort(ordina(cum)).map((d) => [d, cum[d]]);
  }
  return {
    motore: 'nuovo',
    ok: true,
    muto: false,
    motivo: null,
    pos: r.posizione,
    su: r.su_quanti,
    banda: r.banda_posizione,      // { da, a, contesto, semi_ampiezza, ... } oppure null
    ordine,
    davanti: r.davanti,
    dietro: r.dietro,
    gap_soppressi: r.gap_soppressi,
    giro_di_rientro: r.giro_di_rientro,
    perdita: r.perdita,
    mescola_usata: scelta,
    assunzioni: r.assunzioni,
    violazioni_director: r.direttore?.violazioni?.length ?? 0,
    grezzo: r,
  };
}

// ——————————————————————————————————————————— i due motori vedono lo stesso caso?
/**
 * Confronta cella per cella `cum_time` e `compound` fra il file del sito e il grezzo
 * pinnato del simulatore. Senza argomenti confronta TUTTE le celle di tutte le gare.
 * @returns `{ celle, divergenze_cum, divergenze_compound, scarto_massimo_s, esempi, per_gara }`
 */
export function verificaAllineamento({ campionePerGara = null } = {}) {
  const out = { celle: 0, divergenze_cum: 0, divergenze_compound: 0, scarto_massimo_s: 0,
                celle_solo_sito: 0, celle_solo_simulatore: 0, esempi: [], per_gara: {} };
  for (const nomeSito of gare()) {
    const { byLap } = datiVecchio(nomeSito);
    const gSim = garaNuova(nomeSito);
    const riga = { celle: 0, cum: 0, compound: 0, solo_sito: 0, solo_sim: 0 };
    const chiavi = [];
    for (const [drv, celle] of gSim.perPilota) for (const lap of celle.keys()) chiavi.push([drv, lap]);
    chiavi.sort((a, b) => a[1] - b[1] || (a[0] < b[0] ? -1 : 1));
    const scelte = campionePerGara === null ? chiavi
      : chiavi.filter((_, i) => i % Math.max(1, Math.ceil(chiavi.length / campionePerGara)) === 0);
    for (const [drv, lap] of scelte) {
      const s = gSim.perPilota.get(drv).get(lap);
      const d = byLap[lap]?.[drv];
      riga.celle += 1; out.celle += 1;
      if (!d) { riga.solo_sim += 1; out.celle_solo_simulatore += 1; continue; }
      const a = s.cum_time, b = d.cum_time;
      let diverso = false;
      if (typeof a === 'number' && typeof b === 'number') {
        const scarto = Math.abs(a - b);
        if (scarto > out.scarto_massimo_s) out.scarto_massimo_s = scarto;
        diverso = scarto > 1e-9;
      } else diverso = (a ?? null) !== (b ?? null);
      if (diverso) {
        riga.cum += 1; out.divergenze_cum += 1;
        if (out.esempi.length < 10) out.esempi.push({ gara: nomeSito, pilota: drv, giro: lap, simulatore: a, sito: b });
      }
      if ((s.compound ?? null) !== (d.compound ?? null)) { riga.compound += 1; out.divergenze_compound += 1; }
    }
    // celle presenti nel sito e assenti nel simulatore
    if (campionePerGara === null) {
      for (const lap of Object.keys(byLap)) {
        for (const drv of Object.keys(byLap[lap])) {
          if (!gSim.perPilota.get(drv)?.has(Number(lap))) { riga.solo_sito += 1; out.celle_solo_sito += 1; }
        }
      }
    }
    out.per_gara[nomeSito] = riga;
  }
  return out;
}

// ————————————————————————————————————————————————————————————————— la prova
function main() {
  const json = process.argv.includes('--json');
  const elenco = casi();
  const cens = censimento();
  const all = verificaAllineamento();

  // TRE CASI DI TRE GARE DIVERSE, scelti in modo deterministico e non a caso: per ognuna
  // delle prime tre gare, il caso con risposta da entrambi i motori il cui congelamento e'
  // piu' vicino a meta' gara. A meta' gara ci sono gia' soste alle spalle, quindi il vecchio
  // ha un gradino vero e non il ramo degenere `gradino assente`.
  // Piu' un QUARTO caso, il primo con regime al congelamento: e' l'unico ramo in cui i due
  // motori trattano la neutralizzazione, e vederlo spento nei primi tre non basta.
  const prova = [];
  const rispondono = (x) => !rispostaVecchio(x).muto && !rispostaNuovo(x).muto;
  for (const g of gare()) {
    if (prova.length >= 3) break;
    const dellaGara = elenco.filter((x) => x.gara === g && rispondono(x));
    if (!dellaGara.length) continue;
    const c = dellaGara.reduce((m, x) =>
      Math.abs(x.freezeLap - x.nGiri / 2) < Math.abs(m.freezeLap - m.nGiri / 2) ? x : m);
    prova.push({ caso: c, vecchio: rispostaVecchio(c), nuovo: rispostaNuovo(c) });
  }
  const sottoRegime = elenco.find((x) => x.regimeAlCongelamento !== null && rispondono(x));
  if (sottoRegime) prova.push({ caso: sottoRegime, vecchio: rispostaVecchio(sottoRegime), nuovo: rispostaNuovo(sottoRegime) });

  if (json) {
    console.log(JSON.stringify({ censimento: cens, allineamento: all,
      prova: prova.map((p) => ({ caso: p.caso,
        vecchio: { ok: p.vecchio.ok, pos: p.vecchio.pos, su: p.vecchio.su, troncato: p.vecchio.troncato },
        nuovo: { ok: p.nuovo.ok, pos: p.nuovo.pos, su: p.nuovo.su, banda: p.nuovo.banda && [p.nuovo.banda.da, p.nuovo.banda.a] } })) }, null, 1));
    return;
  }

  console.log('BANCO DEL CONFRONTO — casi, verita\', due motori');
  console.log(`\nPERIMETRO: ${gare().length} gare di demo/data/`);
  console.log(`  soste reali trovate (celle con in_lap) : ${cens.soste_reali_trovate}`);
  for (const [k, v] of Object.entries(cens.esclusi)) console.log(`  escluse · ${k.padEnd(28)}: ${v}`);
  console.log(`  CASI AMMESSI                           : ${cens.ammessi}`);
  console.log('\n  per gara:');
  for (const [g, v] of Object.entries(cens.per_gara)) {
    console.log(`    ${g.padEnd(16)} soste ${String(v.soste).padStart(3)}  casi ${String(v.ammessi).padStart(3)}`);
  }

  console.log(`\nALLINEAMENTO DELLE DUE FONTI (requisito 2)`);
  console.log(`  celle confrontate            : ${all.celle}`);
  console.log(`  divergenze di cum_time       : ${all.divergenze_cum}  (scarto massimo ${all.scarto_massimo_s} s)`);
  console.log(`  divergenze di compound       : ${all.divergenze_compound}`);
  console.log(`  celle solo sito / solo simul.: ${all.celle_solo_sito} / ${all.celle_solo_simulatore}`);

  console.log(`\nCASI DI PROVA (tre gare diverse a meta' gara, piu' uno sotto regime)`);
  for (const p of prova) {
    const c = p.caso;
    console.log(`\n  ${c.id}   congelamento ${c.freezeLap} · box ${c.pitLap} · rientro ${c.rientroLap} (gara da ${c.nGiri})`);
    console.log(`    verita'  P${c.posizioneVera}/${c.suQuantiVeri}   (fra pari giro P${c.posizioneFraPariGiro}/${c.suQuantiPariGiro})`);
    console.log(`    gomma    al congelamento ${c.mescolaAlCongelamento}/${c.etaGommaAlCongelamento}g · montata alla sosta ${c.mescolaMontata} (futuro, diagnostica)`);
    console.log(`    regime   al congelamento ${c.regimeAlCongelamento ?? 'verde'} · al giro del box ${c.neutralizzatoAlPit ? 'neutralizzato' : 'verde'} (futuro)`);
    console.log(`    VECCHIO  P${p.vecchio.pos}/${p.vecchio.su}  err ${p.vecchio.pos - c.posizioneVera >= 0 ? '+' : ''}${p.vecchio.pos - c.posizioneVera}`
      + `  · gradino ${p.vecchio.gradino === null ? 'assente' : p.vecchio.gradino.toFixed(3)} (n=${p.vecchio.n_gradino}) · byLap troncato: ${p.vecchio.troncato}`);
    console.log(`    NUOVO    P${p.nuovo.pos}/${p.nuovo.su}  err ${p.nuovo.pos - c.posizioneVera >= 0 ? '+' : ''}${p.nuovo.pos - c.posizioneVera}`
      + `  · banda ${p.nuovo.banda ? `P${p.nuovo.banda.da}–P${p.nuovo.banda.a} (${p.nuovo.banda.contesto})` : 'assente'}`
      + ` · perdita ${p.nuovo.perdita.perdita.toFixed(2)} s`);
  }
  console.log('\n(le cinque metriche NON si calcolano qui: questo e\' il metro, non il giudizio)');
}

if (import.meta.url === `file://${process.argv[1]}`) main();
