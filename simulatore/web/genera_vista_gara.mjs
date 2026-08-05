#!/usr/bin/env node
// genera_vista_gara.mjs — la vista del SITO: ogni pilota, ogni giro, una gara alla volta.
//
//     node web/genera_vista_gara.mjs                  tutte le gare
//     node web/genera_vista_gara.mjs Belgio           una sola
//     node web/genera_vista_gara.mjs --dove ../demo/data/vista
//
// PERCHE' ESISTE, ACCANTO A genera_vista.mjs. Quello produce la vista DEMO: uno scenario
// curato per gara, per la pagina vetrina. Il sito e' un'altra cosa — l'utente sposta il
// cursore su un giro qualunque e tocca un pilota qualunque — quindi lo spazio da coprire
// non e' un caso per gara ma (gara x pilota x giro di congelamento).
//
// LA REGOLA RESTA QUELLA: la pagina non calcola (regola 8, E17). Qui si esegue il motore
// in Node, si passa dal Director, e si scrive JSON; il browser formatta e basta. Cambia
// solo QUANTO si pre-calcola, non chi calcola.
//
// PERCHE' PRE-CALCOLARE INVECE DI CHIAMARE UNA FUNZIONE SERVERLESS. Misurato: uno scenario
// costa ~108 ms (rientro 4, curva 59, piano 45) e pesa 4,5 KB senza la mappa. Un pilota per
// tutta la gara sta in ~267 KB, che il browser scarica quando lo tocchi; una gara intera si
// genera in ~2 minuti, dentro il ciclo post-gara. Una funzione a richiesta avrebbe fatto
// smettere il sito di essere statico: il replay funziona offline, ed e' una proprieta' che
// non si baratta per risparmiare due minuti di build.
//
// COSA NON SCRIVE, E PERCHE' NON E' UNA PERDITA. Il campo `mappa.reale` della vista demo
// (il 40% del peso) sono i cum_time di tutti giro per giro: il sito ce li ha GIA' in
// demo/data/<gara>.json, che e' cio' da cui disegna la pista. Riscriverli qui sarebbe una
// seconda copia della stessa verita' — l'errore che questo progetto paga da sempre. Il
// FANTASMA invece resta: quello e' proiezione, non dato, e senza non c'e' l'animazione.
import { mkdirSync, readFileSync, writeFileSync, rmSync, readdirSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { caricaGare2026 } from '../provenienza/gare_2026.mjs';
import { caricaPrior } from '../provenienza/pitloss_dati.mjs';
import { perditaBox } from '../provenienza/pitloss.mjs';
import { MESCOLE_SLICK_ATTUALI, MESCOLE_BAGNATO } from '../provenienza/vocabolario.mjs';
import { caricaCostanti } from '../scenario/director_dati.mjs';
import { caricaDurate2026 } from '../scenario/allarmi_dati.mjs';
// Il record della risposta NON si monta qui: lo monta scenario/risposta.mjs, che
// e' lo stesso modulo che esegue il pannello LIVE nel browser. Due assemblaggi
// dello stesso record renderebbero la parita' diretta/replay una coincidenza.
import { rispostaPer } from '../scenario/risposta.mjs';

const RADICE = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const DOVE_DEFAULT = path.join(RADICE, '..', 'demo', 'data', 'vista');

// I GIRI CHE NON SI CHIEDONO. Sotto i primi giri il passo-base non esiste (servono giri
// verdi nello stint), e a fine gara non c'e' piu' spazio per una sosta: chiedere lo stesso
// produrrebbe righe di rifiuto pre-calcolate, cioe' peso senza informazione.
const PRIMO_CONGELAMENTO = 5;

// LA DATA DELLA VISTA. Ogni targhetta la porta (regola 2): un numero senza data non si
// sa se e' stato rimisurato dopo l'ultimo fix — e' l'errore E22 del catalogo.
const DATA = new Date().toISOString().slice(0, 10);
const GIRI_MINIMI_DOPO = 3;

/**
 * L'impronta di un artefatto che la vista consuma ma che non e' un coefficiente
 * scalare (la banda di rientro, il prior di pit-loss): il contenuto, non la data.
 * Una data si puo' aggiornare senza che il file cambi, e viceversa.
 */
export function sha256Corto(percorso) {
  if (!existsSync(percorso)) return null;
  return createHash('sha256').update(readFileSync(percorso)).digest('hex').slice(0, 16);
}

/** Il rodaggio come lo vede la vista: i due parametri E se era acceso. Spento e
 *  acceso con gli stessi (c, τ) sono due motori diversi, e il timbro deve dirlo. */
export function impronteRodaggio(modello) {
  const r = modello.rodaggio;
  if (!r) return { attivo: false, c: null, tau: null };
  return { attivo: r.attivo === true, c: r.attivo === true ? r.c : null, tau: r.attivo === true ? r.tau : null };
}

/** Perche' il selettore Wet e' spento, detto dall'ESITO della fase e non da una frase
 *  cablata (E22): se un domani quel cancello passasse, questa funzione si rifiuta di
 *  produrre un motivo — il selettore andrebbe acceso, non spiegato. */
function motivoWet() {
  const esito = JSON.parse(readFileSync(path.join(RADICE, 'banco', 'prereg', 'ESITO_bagnato.json'), 'utf8'));
  const cancelli = esito?.cancelli ? Object.values(esito.cancelli) : [];
  if (cancelli.length && cancelli.every((c) => c?.esito === true)) {
    throw new Error('il cancello bagnato PASSA: il selettore Wet va acceso, non spiegato');
  }
  return esito?.limite_dichiarato?.conseguenza
      ?? 'modello del bagnato non ancora validato: il selettore resta spento';
}

export function generaVistaGara(radice, nomeGara, gara, contesto, extra, dove) {
  const dir = path.join(dove, nomeGara);
  rmSync(dir, { recursive: true, force: true });
  mkdirSync(dir, { recursive: true });
  const ultimo = gara.nGiri - GIRI_MINIMI_DOPO;
  // L'INDICE FA DA `vista` PER I COMPONENTI. Loro leggono vista._targhetta,
  // vista.modello e vista.mescole: mettendoli qui la pagina passa (indice, scenario) e i
  // componenti restano gli STESSI del repo d'origine, non una variante per il sito.
  const indice = {
    gara: nomeGara, n_giri: gara.nGiri, primo_giro: PRIMO_CONGELAMENTO,
    ultimo_giro: ultimo, piloti: {},
    _targhetta: {
      tipo: 'vista del sito — nessun numero calcolato dal browser',
      generata_da: 'simulatore/web/genera_vista_gara.mjs',
      percorso: 'provenienza → engine → scenario (Director compreso) → questo JSON → componenti',
      data: DATA,
    },
    modello: extra.modelloTarghetta,
    mescole: extra.mescole,
    // LA PERDITA CHE IL MOTORE USA DAVVERO, con la sua targhetta.
    //
    // Stava solo dentro ogni singola risposta, mentre il badge in intestazione mostrava
    // un ALTRO numero — quello di demo/data/pitloss.json — e su Canada i due divergevano
    // di 5,04 s. Non era un difetto del calcolo: sono due grandezze diverse (il
    // «realizzato» e' la media delle soste di QUELLA gara, che al congelamento nessuno
    // conosce), ma la home dichiarava che la risposta era calcolata col primo. Decisione
    // del PO del 02/08: il badge mostra il numero del motore, e il realizzato resta una
    // nota. Qui sopra c'e' la stessa `perditaBox` che il costruttore chiama: una
    // definizione, un posto (regola 1). E' costante per gara — la sosta in verde non
    // dipende dal pilota ne' dal giro.
    perdita: (() => {
      const p = perditaBox(contesto.prior, nomeGara, null);
      return { verde: p.perdita_verde, circuito: p.circuito, fonte: p.fonte,
               fallback: p.fallback, targhetta: p.targhetta };
    })(),
  };
  for (const pilota of [...gara.perPilota.keys()].sort()) {
    const giri = [];
    for (let Lf = PRIMO_CONGELAMENTO; Lf <= ultimo; Lf += 1) {
      const s = rispostaPer(nomeGara, gara, Lf, pilota, contesto, extra, DATA);
      if (s !== null) giri.push(s);
    }
    const conRisposta = giri.filter((g) => !g.senza_risposta).length;
    if (conRisposta === 0) continue;

    // IL FANTASMA VIAGGIA A PARTE, e non e' un'ottimizzazione gratuita: e' un terzo del
    // peso (49 KB su 149) e serve SOLO a chi preme "Guarda la sosta". Farlo scaricare a
    // chiunque tocchi un pilota sarebbe far pagare a tutti una cosa che usano in pochi.
    // Stesso nome, suffisso diverso: la pagina lo chiede quando serve.
    const fantasmi = {};
    for (const g of giri) {
      if (g.fantasma && g.fantasma.length) fantasmi[g.freeze_lap] = g.fantasma;
      delete g.fantasma;
    }
    writeFileSync(path.join(dir, `${pilota}.json`),
                  JSON.stringify({ gara: nomeGara, pilota, n_giri: gara.nGiri, giri }));
    writeFileSync(path.join(dir, `${pilota}.fantasma.json`),
                  JSON.stringify({ gara: nomeGara, pilota, per_giro: fantasmi }));
    indice.piloti[pilota] = { giri: giri.length, con_risposta: conRisposta };
  }
  writeFileSync(path.join(dir, 'indice.json'), JSON.stringify(indice, null, 1));
  return indice;
}

/**
 * Il manifest della vista, letto da CIO' CHE STA SU DISCO.
 *
 * NON dall'elenco delle gare di questa esecuzione, ed e' una distinzione che e'
 * costata: `auto_gara.py` chiama il generatore con UNA gara sola — quella appena
 * corsa — e il manifest veniva riscritto con quella sola voce. La prima domenica
 * dopo la messa in produzione il sito avrebbe perso la mappa dei nomi di tutte le
 * altre gare, e il pannello sarebbe rimasto muto su dieci gare su undici. Da solo,
 * di notte, senza che nessuno avesse toccato niente.
 *
 * Un indice deve descrivere l'archivio, non l'ultimo giro di manovella.
 *
 * LA MAPPA DEI NOMI sta qui e non cablata nella pagina: il sito chiama una gara
 * "Gran Bretagna", il simulatore "GranBretagna". E24 del catalogo e' proprio lo
 * spazio nel nome che spezza i glob — il ponte e' un dato, non un `if` in gara.html.
 */
export function manifestDaDisco(dove) {
  const gare = readdirSync(dove, { withFileTypes: true })
    .filter((v) => v.isDirectory() && existsSync(path.join(dove, v.name, 'indice.json')))
    .map((v) => v.name)
    .sort();
  const cartellaDi = {};
  for (const g of gare) cartellaDi[g.replace(/([a-z])([A-Z])/g, '$1 $2')] = g;
  return {
    gare,
    cartella_di: cartellaDi,
    generato_il: DATA,
    nota: 'cartella_di mappa il nome del sito (con spazi) su quello della cartella (senza). '
        + 'L\'elenco viene dalle cartelle presenti su disco, NON dalle gare rigenerate '
        + 'nell\'ultima esecuzione: il generatore gira anche su una gara sola.',
  };
}

export function scriviManifest(dove) {
  const m = manifestDaDisco(dove);
  writeFileSync(path.join(dove, 'manifest.json'), JSON.stringify(m, null, 1));
  return m;
}

/**
 * Le gare su disco la cui vista NON e' stata generata col motore di adesso.
 *
 * Serve a `--sincronizza`, ed e' la meta' costruttiva di quello che la sentinella
 * s29 verifica: lei dice CHE c'e' una divergenza, questa dice DOVE, cosi'
 * `auto_gara.py` rigenera le tre gare che servono invece delle undici che non
 * servono. Rigenerare tutto costa ~45 minuti; senza questa funzione l'unica
 * automazione corretta sarebbe anche quella che nessuno terrebbe accesa.
 *
 * Il confronto e' sul TIMBRO, non sulla data: una vista rigenerata ieri con
 * coefficienti vecchi e' vecchia, una di un mese fa con gli stessi coefficienti
 * e' buona.
 */
export function gareDaRigenerare(dove, timbroAtteso) {
  if (!existsSync(dove)) return [];
  const fuori = [];
  // NON si parte da `manifestDaDisco`: quello elenca solo le cartelle che HANNO un
  // `indice.json`, quindi una vista MONCA — cartella presente, indice assente —
  // verrebbe SALTATA invece che rigenerata. E' lo stato in cui resta una gara se la
  // rigenerazione si interrompe a meta': `generaVistaGara` svuota la cartella prima
  // di riempirla. Successo davvero il 01/08 con l'Australia, e a prenderlo e' stata
  // s27 e non questa funzione — che invece diceva serenamente «niente da fare».
  //
  // Una cartella senza indice non e' una gara assente: e' una gara ROTTA, ed e' il
  // caso che ha piu' bisogno di essere rigenerato.
  for (const v of readdirSync(dove, { withFileTypes: true })) {
    if (!v.isDirectory()) continue;
    let m = null;
    try { m = JSON.parse(readFileSync(path.join(dove, v.name, 'indice.json'), 'utf8')).modello ?? null; } catch { m = null; }
    if (m === null || JSON.stringify(m) !== JSON.stringify(timbroAtteso)) fuori.push(v.name);
  }
  return fuori.sort();
}

function main() {
  const argv = process.argv.slice(2);
  const iDove = argv.indexOf('--dove');
  const dove = iDove >= 0 ? path.resolve(argv[iDove + 1]) : DOVE_DEFAULT;
  // il VALORE di --dove non e' un nome di gara. Quando --dove manca, iDove vale -1 e
  // iDove+1 vale 0: senza questa guardia si scarterebbe il PRIMO argomento posizionale,
  // e chiedere una gara sola ne farebbe girare undici.
  let soloQueste = argv.filter((a, i) => !a.startsWith('--') && (iDove < 0 || i !== iDove + 1));
  const sincronizza = argv.includes('--sincronizza');

  const gare = caricaGare2026(RADICE);
  const modello = JSON.parse(readFileSync(path.join(RADICE, 'data', 'modelli', 'modello_v2.json'), 'utf8'));
  const prior = caricaPrior(RADICE);
  const costantiDirector = caricaCostanti(RADICE);
  const bandaRientro = JSON.parse(readFileSync(path.join(RADICE, 'data', 'modelli', 'banda_rientro.json'), 'utf8'));
  const orizzonteRisposta = JSON.parse(readFileSync(path.join(RADICE, 'data', 'modelli', 'orizzonte_risposta.json'), 'utf8'));
  const vitaMescola = JSON.parse(readFileSync(path.join(RADICE, 'data', 'modelli', 'vita_mescola.json'), 'utf8'));
  const sogliaSorpasso = JSON.parse(readFileSync(path.join(RADICE, 'data', 'modelli', 'soglia_sorpasso.json'), 'utf8'));
  const pEsiti = path.join(RADICE, 'data', 'modelli', 'esiti_per_caso.json');
  const esitiPerCaso = existsSync(pEsiti) ? JSON.parse(readFileSync(pEsiti, 'utf8')) : null;
  const extra = {
    durate2026: caricaDurate2026(RADICE),
    esitoPiano: JSON.parse(readFileSync(path.join(RADICE, 'banco', 'prereg', 'ESITO_multistint.json'), 'utf8')),
    prior,
    modelloTarghetta: {
      rho: modello.rho.valore,
      rho_ic: modello.rho.ic95,
      rho_n: modello._targhetta.n_giri_verdi,
      rho_targhetta: modello.rho.targhetta,
      delta_70: modello.delta_70.scelto,
      delta_70_braccio: modello.delta_70.decisione.braccio_vincente,
      orizzonti_validati: modello.delta_70.decisione.orizzonti_validati,
      data: modello._targhetta.data,
      // ── IL TIMBRO, ed e' quello che rende automatizzabile la ri-stima ──────
      // Il generatore gira UNA GARA ALLA VOLTA (auto_gara.py lo chiama cosi'). Il
      // giorno in cui un coefficiente si muove, le viste delle altre gare restano
      // calcolate col vecchio e nessuno se ne accorge: e' una divergenza silenziosa
      // fra il motore e cio' che il sito mostra, cioe' E12 su scala di prodotto.
      // Da qui in poi ogni vista dichiara con COSA e' stata fatta, e la sentinella
      // s29 la confronta col motore di oggi. Senza questo timbro, attaccare gli
      // stimatori all'automazione sarebbe pericoloso prima che utile.
      rodaggio: impronteRodaggio(modello),
      // LA SOGLIA DI BASE decide CHI ha una risposta: cambiarla riempie o svuota
      // caselle. E' finita nel timbro il 01/08 perche' la prima volta che si e'
      // mossa `--sincronizza` ha risposto «0 viste fuori passo» — il timbro
      // registrava rho, delta70 e il rodaggio, e la soglia era passata sotto il
      // naso della sentinella che esiste apposta. Un timbro incompleto e' peggio
      // di nessun timbro: dice di no quando dovrebbe dire di si'.
      min_giri_base: typeof modello.min_giri_base?.valore === 'number' ? modello.min_giri_base.valore : null,
      // La regola sulle soste dei rivali decide QUALI auto il motore muove sotto
      // neutralizzazione, quindi le posizioni. Nel timbro dal primo minuto: la
      // soglia di base c'e' finita solo dopo che `--sincronizza` aveva risposto
      // «0 viste fuori passo» a un coefficiente appena cambiato.
      soste_rivali: prior.soste_rivali_sotto_regime ?? 'stint1',
      // nel timbro dal primo minuto: i casi cambiano cio' che la pagina mostra
      esiti_per_caso_sha256: sha256Corto(pEsiti),
      banda_rientro_sha256: sha256Corto(path.join(RADICE, 'data', 'modelli', 'banda_rientro.json')),
      pitloss_sha256: sha256Corto(path.join(RADICE, 'data', 'priors', 'pitloss_priors.json')),
    },
    // ATTUALI, non MESCOLE_SLICK: quest'ultimo porta anche SUPERSOFT/ULTRASOFT/HYPERSOFT,
    // che servono a LEGGERE il fondo 2018 e nel 2026 non esistono. Il selettore e' del
    // prodotto, non dell'archivio. Il Wet resta VISIBILE e SPENTO col suo motivo.
    mescole: [
      ...[...MESCOLE_SLICK_ATTUALI].map((codice) => ({ codice, attiva: true, motivo: null })),
      ...[...MESCOLE_BAGNATO].map((codice) => ({ codice, attiva: false, motivo: motivoWet() })),
    ],
  };
  mkdirSync(dove, { recursive: true });

  // --sincronizza: rigenera SOLO le gare il cui timbro non e' quello di adesso, e
  // dice quali salta. Non "niente da fare" in silenzio: se una domenica non
  // rigenera nulla, quel nulla deve essere leggibile nel log.
  if (sincronizza) {
    const fuori = gareDaRigenerare(dove, extra.modelloTarghetta);
    const conIndice = new Set(manifestDaDisco(dove).gare);
    const monche = fuori.filter((g) => !conIndice.has(g));
    if (monche.length) console.log(`sincronizza: ${monche.length} viste MONCHE (cartella senza indice, rigenerazione interrotta) -> ${monche.join(', ')}`);
    const tutteSuDisco = readdirSync(dove, { withFileTypes: true }).filter((v) => v.isDirectory()).length;
    console.log(`sincronizza: ${fuori.length} viste su ${tutteSuDisco} sono fuori passo col motore`
      + (fuori.length ? ` -> ${fuori.join(', ')}` : ' — niente da rigenerare'));
    if (soloQueste.length) {
      const chieste = new Set(soloQueste);
      soloQueste = [...new Set([...fuori, ...soloQueste])];
      console.log(`  (piu' le ${chieste.size} chieste esplicitamente)`);
    } else if (fuori.length === 0) {
      scriviManifest(dove);
      return;
    } else {
      soloQueste = fuori;
    }
  }

  console.log(`vista del sito -> ${path.relative(process.cwd(), dove)}`);
  let totScen = 0;
  const tutte = [];
  for (const [nomeGara, gara] of Object.entries(gare)) {
    if (soloQueste.length && !soloQueste.includes(nomeGara)) continue;
    const t = Date.now();
    // `orizzonteRisposta` DEVE stare anche qui, e la sua assenza era un guasto vero.
    // Il 03/08 F1 e' stato registrato a 6 giri e il pannello ha imparato a dire «fin dove
    // la risposta e' validata»: il generatore del DEMO e' stato cablato, questo no. Sul
    // sito pubblico l'etichetta non compariva in nessuna delle 11.303 risposte, e chi
    // leggeva vedeva solo l'orizzonte del PASSO (10) — deducendone che fino a li' la
    // risposta fosse buona, che REGISTRO_F1.md dice essere falso fra 7 e 10 giri.
    // E' E20 nella sua forma tipica: due pezzi della stessa decisione, spenti uno solo.
    const contesto = { gare, modello, prior, costantiDirector, bandaRientro, esitiPerCaso, orizzonteRisposta, vitaMescola, sogliaSorpasso, nGiriGara: gara.nGiri };
    const ind = generaVistaGara(RADICE, nomeGara, gara, contesto, extra, dove);
    const n = Object.values(ind.piloti).reduce((s, x) => s + x.con_risposta, 0);
    totScen += n;
    tutte.push(nomeGara);
    console.log(`  ${nomeGara.padEnd(16)} ${String(Object.keys(ind.piloti).length).padStart(3)} piloti `
      + `${String(n).padStart(5)} risposte  ${((Date.now() - t) / 1000).toFixed(0)} s`);
  }
  scriviManifest(dove);
  console.log(`\n${totScen} risposte pre-calcolate su ${tutte.length} gare `
    + `(il manifest ne elenca ${manifestDaDisco(dove).gare.length}, cioe' tutte quelle su disco)`);
}

if (import.meta.url === `file://${process.argv[1]}`) main();
