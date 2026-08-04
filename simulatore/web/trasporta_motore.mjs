#!/usr/bin/env node
// trasporta_motore.mjs — porta il MOTORE dove il pannello live puo' eseguirlo.
//
//     node web/trasporta_motore.mjs             copia i moduli + il contesto
//     node web/trasporta_motore.mjs --verifica  esce 1 se le copie sono derivate
//
// PERCHE' ESISTE, dopo che `trasporta_formattatori.mjs` diceva il contrario.
// Quel trasporto porta nel browser SOLO i formattatori, e rifiuta esplicitamente
// qualunque modulo che importi da engine/scenario/provenienza/fisica: la regola
// 8 dice che la pagina non calcola. gara.html la rispetta alla lettera — legge
// risposte pre-calcolate (demo/data/vista/).
//
// IN DIRETTA QUELLA STRADA NON ESISTE. La gara sta succedendo: una risposta
// pre-calcolata su un giro che non e' ancora stato percorso non e' difficile, e'
// impossibile. Le strade erano tre, e sono state pesate sui fatti:
//
//   · il collettore calcola e spinge la risposta — architetturalmente la
//     migliore (la risposta arriva col dato), ma il collettore e' un servizio
//     Python su una macchina che questo repo non collauda: si scriverebbe alla
//     cieca il pezzo che deve funzionare mentre la gara e' in corso;
//   · una funzione serverless — Vercel serve `demo/` come radice (c'e'
//     demo/vercel.json, e le funzioni stanno in demo/api/), quindi una funzione
//     NON puo' importare da simulatore/: il motore andrebbe copiato dentro
//     demo/ COMUNQUE. Stesso trasporto, in piu' un giro di rete e un avvio a
//     freddo proprio nel momento in cui la pagina deve rispondere;
//   · il browser esegue il motore — stesso trasporto, nessun giro di rete,
//     e la pagina continua a rispondere anche se l'API cade.
//
// Poiche' il trasporto dentro demo/ e' inevitabile in due casi su tre, la
// domanda non era "portare la fisica in demo/ si' o no" ma "dove la si esegue".
// Il rischio che la regola 8 vuole evitare — E17, DUE fisiche per due risposte
// adiacenti — non dipende da dove gira: dipende dall'esserci due sorgenti. Qui
// la sorgente resta UNA (simulatore/), la copia e' un artefatto generato con
// manifest di hash, e `--verifica` (in CI) fallisce sulla deriva. La lettera
// della regola 8 per live.html e' DEROGATA e dichiarata; la sua ragione no.
//
// COSA RIFIUTA DI TRASPORTARE: un motore che in pagina non partirebbe. Se un
// modulo della chiusura importa da `node:` o da un pacchetto, questo script
// esce 1 invece di copiare — altrimenti l'errore si scoprirebbe col pannello
// vuoto durante una gara vera. La sentinella s26 verifica la stessa cosa nel
// banco, con lo STESSO camminatore.
import { readFileSync, writeFileSync, mkdirSync, existsSync, rmSync, readdirSync, statSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { chiusura } from './grafo_import.mjs';
import { caricaPrior } from '../provenienza/pitloss_dati.mjs';
import { caricaCostanti } from '../scenario/director_dati.mjs';
import { caricaDurate2026 } from '../scenario/allarmi_dati.mjs';
import { MESCOLE_SLICK_ATTUALI, MESCOLE_BAGNATO } from '../provenienza/vocabolario.mjs';

const RADICE = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const DESTINAZIONE = path.join(RADICE, '..', 'demo', 'vendor', 'simulatore', 'motore');
const MANIFEST = path.join(DESTINAZIONE, 'MANIFEST.json');
const CONTESTO = 'contesto_live.json';

// Gli stessi ingressi della sentinella s26. Se il ponte live ne chiamasse un
// altro, va aggiunto in ENTRAMBI i posti — e s26 se ne accorge, perche' verifica
// che gli ingressi esistano e che il grafo sia caricabile.
const INGRESSI = [
  'scenario/risposta.mjs',        // monta il record: tira dentro costruttore, piano, allarmi, director
  'provenienza/gare_indice.mjs',  // indicizza: il ponte ne ha bisogno per la gara sintetica
  'provenienza/contratto.mjs',    // creaCella: il ponte traduce le celle live nel contratto
  'provenienza/vocabolario.mjs',  // il ponte legge le mescole valide
];

const sha = (t) => createHash('sha256').update(t).digest('hex');

function intestazione(rel) {
  return `// ————————————————————————————————————————————————————————————————————————
// ARTEFATTO GENERATO — non modificare qui.
//   sorgente: simulatore/${rel}
//   generato: simulatore/web/trasporta_motore.mjs
// Vercel serve demo/ come radice e non vede simulatore/: questa copia esiste
// solo per essere ESEGUITA dal pannello live, dove il pre-calcolo non puo'
// esistere. Modificare QUESTO file lo fa divergere dall'originale, e
// \`node web/trasporta_motore.mjs --verifica\` fallisce (lo esegue la CI).
// ————————————————————————————————————————————————————————————————————————
`;
}

/** Il perche' il selettore Wet e' spento, dall'ESITO e non da una frase cablata (E22). */
function motivoWet(esitoBagnato) {
  const cancelli = esitoBagnato?.cancelli ? Object.values(esitoBagnato.cancelli) : [];
  if (cancelli.length && cancelli.every((c) => c?.esito === true)) {
    throw new Error('il cancello bagnato PASSA: il selettore Wet va acceso, non spiegato');
  }
  return esitoBagnato?.limite_dichiarato?.conseguenza
      ?? 'modello del bagnato non ancora validato: il selettore resta spento';
}

/**
 * Il contesto che in Node si carica dal disco, qui congelato in un JSON solo.
 *
 * NON e' una selezione di comodo: sono ESATTAMENTE gli oggetti che
 * `genera_vista_gara.mjs` passa al costruttore, con gli stessi nomi. Il prior
 * viaggia una volta sola e il ponte ricompone `costantiDirector`: duplicarlo
 * qui sarebbe 26 KB in piu' e due copie della stessa verita' nello stesso file.
 */
function contestoLive(dataOggi) {
  const costanti = caricaCostanti(RADICE);
  const leggi = (p) => JSON.parse(readFileSync(path.join(RADICE, p), 'utf8'));
  const modello = leggi('data/modelli/modello_v2.json');
  const esitoBagnato = leggi('banco/prereg/ESITO_bagnato.json');
  return {
    _targhetta: {
      tipo: 'contesto del pannello LIVE — le costanti che in Node si leggono dal disco',
      generato_da: 'simulatore/web/trasporta_motore.mjs',
      nota: 'stessi oggetti che genera_vista_gara.mjs passa al costruttore: la diretta e il replay rispondono con lo stesso motore e le stesse costanti',
      data: dataOggi,
    },
    modello,
    prior: caricaPrior(RADICE),
    limiti: costanti.limiti,
    pavimenti: costanti.pavimenti,
    bandaRientro: leggi('data/modelli/banda_rientro.json'),
    // il TETTO AL MOVIMENTO viaggia col motore: se stesse solo in Node, la diretta
    // risponderebbe senza vincolo e il replay con — che e' E17 nella sua forma esatta.
    sogliaSorpasso: leggi('data/modelli/soglia_sorpasso.json'),
    // I CASI viaggiano col motore, o la diretta direbbe meno del replay sulla
    // stessa situazione — ed e' la forma di E17 che questo trasporto esiste per
    // impedire. Il file e' piccolo: sono due contesti, non una tabella per gara.
    esitiPerCaso: leggi('data/modelli/esiti_per_caso.json'),
    durate2026: caricaDurate2026(RADICE),
    esitoPiano: leggi('banco/prereg/ESITO_multistint.json'),
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
    mescole: [
      ...[...MESCOLE_SLICK_ATTUALI].map((codice) => ({ codice, attiva: true, motivo: null })),
      ...[...MESCOLE_BAGNATO].map((codice) => ({ codice, attiva: false, motivo: motivoWet(esitoBagnato) })),
    ],
  };
}

function main() {
  const verifica = process.argv.includes('--verifica');
  const problemi = [];

  const leggiDalRepo = (rel) => {
    const abs = path.join(RADICE, rel);
    return existsSync(abs) ? readFileSync(abs, 'utf8') : null;
  };
  const { moduli, esterni } = chiusura(INGRESSI, leggiDalRepo);

  // IL RIFIUTO: un motore che in pagina non parte non si trasporta.
  if (esterni.length) {
    console.error('TRASPORTO RIFIUTATO — il motore non sarebbe caricabile in pagina:');
    for (const e of esterni) console.error(`  ${e.da} importa '${e.specificatore}'`);
    console.error('  (un import non relativo non si risolve nel browser: vedi s26)');
    process.exit(1);
  }
  for (const rel of moduli) {
    if (leggiDalRepo(rel) === null) problemi.push(`${rel}: modulo assente (import verso il nulla)`);
  }
  if (problemi.length) {
    console.error('TRASPORTO RIFIUTATO:');
    problemi.forEach((p) => console.error('  ' + p));
    process.exit(1);
  }

  const elenco = [...moduli].sort();
  const manifest = {};
  // La data del contesto non si rigenera a ogni verifica: verrebbe diversa da
  // quella committata e `--verifica` fallirebbe ogni giorno per il calendario.
  // In verifica si riusa la data del manifest esistente; in scrittura, oggi.
  const manifestVecchio = existsSync(MANIFEST) ? JSON.parse(readFileSync(MANIFEST, 'utf8')) : null;
  const dataContesto = verifica
    ? (manifestVecchio?.file?.[CONTESTO]?.data ?? new Date().toISOString().slice(0, 10))
    : new Date().toISOString().slice(0, 10);

  if (!verifica) {
    // si riparte da zero: un modulo uscito dal grafo non deve restare in giro a
    // far credere che il motore lo usi ancora (E20)
    rmSync(DESTINAZIONE, { recursive: true, force: true });
  }
  mkdirSync(DESTINAZIONE, { recursive: true });

  for (const rel of elenco) {
    const orig = leggiDalRepo(rel);
    const atteso = intestazione(rel) + orig;
    const dest = path.join(DESTINAZIONE, rel);
    manifest[rel] = { sha256_sorgente: sha(orig), byte: atteso.length };
    if (verifica) {
      if (!existsSync(dest)) { problemi.push(`${rel}: copia assente`); continue; }
      if (readFileSync(dest, 'utf8') !== atteso) {
        problemi.push(`${rel}: la copia e' DERIVATA dall'originale `
          + '(modificata la copia, o cambiato l\'originale senza ri-trasportare)');
      }
    } else {
      mkdirSync(path.dirname(dest), { recursive: true });
      writeFileSync(dest, atteso);
    }
  }

  // il contesto: stessa disciplina dei moduli
  {
    const testo = JSON.stringify(contestoLive(dataContesto));
    const dest = path.join(DESTINAZIONE, CONTESTO);
    manifest[CONTESTO] = { sha256_sorgente: sha(testo), byte: testo.length, data: dataContesto };
    if (verifica) {
      if (!existsSync(dest) || readFileSync(dest, 'utf8') !== testo) {
        problemi.push(`${CONTESTO}: il contesto committato non e' quello che le costanti producono oggi `
          + '(una costante e\' cambiata e nessuno ha ri-trasportato: E22)');
      }
    } else {
      writeFileSync(dest, testo);
    }
  }

  if (verifica) {
    if (!manifestVecchio) problemi.push('manifest assente');
    else {
      for (const nome of [...elenco, CONTESTO]) {
        if (manifestVecchio.file?.[nome]?.sha256_sorgente !== manifest[nome].sha256_sorgente) {
          problemi.push(`${nome}: hash del sorgente diverso da quello nel manifest`);
        }
      }
      // un modulo ENTRATO nel grafo e mai trasportato non lascerebbe traccia nei
      // controlli sopra: si scopre confrontando gli elenchi, non i contenuti
      const nelManifest = Object.keys(manifestVecchio.file ?? {}).filter((n) => n !== CONTESTO).sort();
      if (JSON.stringify(nelManifest) !== JSON.stringify(elenco)) {
        problemi.push(`l'elenco dei moduli e' cambiato: manifest ${nelManifest.length}, grafo ${elenco.length}`
          + ` — entrati: [${elenco.filter((x) => !nelManifest.includes(x)).join(', ')}]`
          + ` usciti: [${nelManifest.filter((x) => !elenco.includes(x)).join(', ')}]`);
      }
      // e una copia rimasta in cartella che il grafo non prevede piu'
      const inCartella = [];
      const cammina = (dir) => {
        for (const v of readdirSync(dir)) {
          const abs = path.join(dir, v);
          if (statSync(abs).isDirectory()) cammina(abs);
          else if (v.endsWith('.mjs')) inCartella.push(path.relative(DESTINAZIONE, abs).split(path.sep).join('/'));
        }
      };
      cammina(DESTINAZIONE);
      const orfani = inCartella.filter((x) => !elenco.includes(x));
      if (orfani.length) problemi.push(`copie orfane, non piu' nel grafo: ${orfani.join(', ')}`);
    }
    if (problemi.length) {
      console.error('TRASPORTO DERIVATO:');
      problemi.forEach((p) => console.error('  ' + p));
      process.exit(1);
    }
    console.log(`trasporto del motore verificato: ${elenco.length} moduli + il contesto, identici all'originale`);
    return;
  }

  writeFileSync(MANIFEST, JSON.stringify({
    _nota: 'GENERATO da simulatore/web/trasporta_motore.mjs. Le copie in questa cartella '
         + 'sono artefatti: si modifica l\'originale in simulatore/ e si ri-trasporta. '
         + '`--verifica` esce 1 sulla deriva. Il motore gira in pagina SOLO per live.html, '
         + 'dove il pre-calcolo non puo\' esistere: gara.html continua a non calcolare.',
    generato_il: dataContesto,
    ingressi: INGRESSI,
    file: manifest,
  }, null, 1));

  const totale = elenco.reduce((s, r) => s + manifest[r].byte, 0);
  console.log(`trasportati ${elenco.length} moduli -> demo/vendor/simulatore/motore/  (${(totale / 1024).toFixed(1)} KB)`);
  for (const r of elenco) console.log(`  ${r}`);
  console.log(`  ${CONTESTO.padEnd(24)} ${(manifest[CONTESTO].byte / 1024).toFixed(1)} KB di costanti`);
}

main();
