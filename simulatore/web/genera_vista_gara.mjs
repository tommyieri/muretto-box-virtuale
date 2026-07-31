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
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { caricaGare2026 } from '../provenienza/gare_2026.mjs';
import { caricaPrior } from '../provenienza/pitloss_dati.mjs';
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

function main() {
  const argv = process.argv.slice(2);
  const iDove = argv.indexOf('--dove');
  const dove = iDove >= 0 ? path.resolve(argv[iDove + 1]) : DOVE_DEFAULT;
  // il VALORE di --dove non e' un nome di gara. Quando --dove manca, iDove vale -1 e
  // iDove+1 vale 0: senza questa guardia si scarterebbe il PRIMO argomento posizionale,
  // e chiedere una gara sola ne farebbe girare undici.
  const soloQueste = argv.filter((a, i) => !a.startsWith('--') && (iDove < 0 || i !== iDove + 1));

  const gare = caricaGare2026(RADICE);
  const modello = JSON.parse(readFileSync(path.join(RADICE, 'data', 'modelli', 'modello_v2.json'), 'utf8'));
  const prior = caricaPrior(RADICE);
  const costantiDirector = caricaCostanti(RADICE);
  const bandaRientro = JSON.parse(readFileSync(path.join(RADICE, 'data', 'modelli', 'banda_rientro.json'), 'utf8'));
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

  console.log(`vista del sito -> ${path.relative(process.cwd(), dove)}`);
  let totScen = 0;
  const tutte = [];
  for (const [nomeGara, gara] of Object.entries(gare)) {
    if (soloQueste.length && !soloQueste.includes(nomeGara)) continue;
    const t = Date.now();
    const contesto = { gare, modello, prior, costantiDirector, bandaRientro, nGiriGara: gara.nGiri };
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
