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
import { mkdirSync, readFileSync, writeFileSync, rmSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { caricaGare2026 } from '../provenienza/gare_2026.mjs';
import { caricaPrior } from '../provenienza/pitloss.mjs';
import { regimeNeutralizzato } from '../provenienza/definizioni.mjs';
import { simboliStatus, MESCOLE_SLICK, MESCOLE_SLICK_ATTUALI, MESCOLE_BAGNATO } from '../provenienza/vocabolario.mjs';
import { caricaCostanti } from '../scenario/director.mjs';
import { doveRientri, curvaDelQuando } from '../scenario/costruttore.mjs';
import { pianoOttimo } from '../scenario/piano.mjs';
import { allarmiPiano, caricaDurate2026 } from '../scenario/allarmi.mjs';

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

function mescolaAlGiro(gara, Lf, pilota) {
  const c = gara.perPilota.get(pilota)?.get(Lf);
  return c && MESCOLE_SLICK.has(c.compound) ? c.compound : null;
}

function regimeAlGiro(gara, Lf, pilota) {
  const c = gara.perPilota.get(pilota)?.get(Lf);
  if (!c || c.status === null || !regimeNeutralizzato(c)) return null;
  return simboliStatus(c.status).has('4') ? 'SC' : 'VSC';
}

/** Un record per (pilota, giro): la risposta, la curva, il piano. Null se non c'e' risposta. */
function scenarioPer(nomeGara, gara, Lf, pilota, contesto, extra) {
  const mescola = mescolaAlGiro(gara, Lf, pilota);
  if (mescola === null) return null;               // gomma ignota o da bagnato: non si finge
  const giroPit = Lf + 1;
  let rientro;
  try {
    rientro = doveRientri({ gara: nomeGara, freezeLap: Lf, pilota, giroPit, mescola }, contesto);
  } catch (e) {
    return { freeze_lap: Lf, senza_risposta: e.message };
  }
  // UN RIFIUTO DEL DIRECTOR E' UNA RISPOSTA, e va mostrata. Il componente `pannello` ha
  // il suo ramo apposta: niente numeri, solo i motivi (regola 6). Trattarlo come
  // "nessuna risposta" avrebbe nascosto all'utente proprio il caso in cui il guardiano
  // runtime ha fermato qualcosa — che e' l'informazione piu' utile che ci sia.
  if (rientro && rientro.approvato === false) {
    return {
      freeze_lap: Lf, _data: DATA, gara: nomeGara, pilota, n_giri: gara.nGiri,
      approvato: false,
      motivi_rifiuto: (rientro.direttore?.violazioni ?? [])
        .filter((v) => v.severita === 'FATAL')
        .map((v) => v.messaggio ?? v.codice),
    };
  }
  if (!rientro || rientro.posizione === null || rientro.posizione === undefined) {
    return { freeze_lap: Lf, senza_risposta: 'il motore non ha una risposta a questo giro' };
  }
  const curva = curvaDelQuando({ gara: nomeGara, freezeLap: Lf, pilota, mescola }, contesto);
  const ottimo = pianoOttimo(
    { gara: nomeGara, freezeLap: Lf, pilota, giroFinale: gara.nGiri, kMax: 3 }, contesto);

  // IL FANTASMA, e solo lui: la proiezione del pilota instradato giro per giro. Il reale
  // sta gia' in demo/data/<gara>.json e non si duplica.
  const fantasma = [];
  for (const [drv, passi] of Object.entries(rientro.traccia ?? {})) {
    for (const p of passi ?? []) {
      fantasma.push({ drv, giro: p.lap, cum: Number(p.cum_time.toFixed(3)),
                      ...(p.in_lap ? { in_box: true } : {}),
                      ...(p.out_lap ? { fuori_box: true } : {}) });
    }
  }

  return {
    freeze_lap: Lf,
    // i tre campi che i componenti leggono da `s` e che il costruttore non mette: senza,
    // `pannello` costruirebbe targhette senza data e la mappa non avrebbe i riferimenti
    // dello stazionario. Meglio due numeri ripetuti che un componente che si arrangia.
    _data: DATA,
    // `pannello` li legge da `s`, non dal file che li contiene: senza, num() rifiuta un
    // undefined e l'intero componente cade. Costano una manciata di byte per giro ed
    // evitano di dover forkare il componente — che sarebbe la vera spesa.
    gara: nomeGara,
    pilota,
    n_giri: gara.nGiri,
    stazionario_prior_s: extra.prior.stazionario_tipico_s,
    stazionario_pavimento_s: extra.prior.stazionario_minimo_fisico_s,
    mescola_scelta: mescola,
    regime: regimeAlGiro(gara, Lf, pilota),
    approvato: rientro.approvato,
    pannello: {
      posizione: rientro.posizione,
      su_quanti: rientro.su_quanti,
      giro_di_rientro: rientro.giro_di_rientro,
      davanti: rientro.davanti,
      dietro: rientro.dietro,
      gap_soppressi: rientro.gap_soppressi,
      banda_posizione: rientro.banda_posizione,
    },
    perdita: {
      valore: rientro.perdita.perdita,
      verde: rientro.perdita.perdita_verde,
      fattore: rientro.perdita.fattore,
      circuito: rientro.perdita.circuito,
      fallback: rientro.perdita.fallback,
      targhetta: rientro.perdita.targhetta,
    },
    curva: curva.curva,
    minimo: curva.minimo,
    banda_presente: curva.banda_presente,
    nota_banda: curva.nota_banda,
    orizzonte: curva.orizzonte,
    assunzioni: rientro.assunzioni,
    piano: ottimo.migliore === null ? null : {
      k: ottimo.migliore.k,
      soste: ottimo.migliore.piano.soste,
      stint: ottimo.migliore.piano.stint,
      alternative: ottimo.per_k,
      mescole_gia_usate: ottimo.mescole_gia_usate,
      vincolo_regolamento: ottimo.vincolo_regolamento,
      allarmi: allarmiPiano(ottimo.migliore.piano, extra.durate2026),
      limite: extra.esitoPiano.limite_dichiarato.conseguenza,
      limite_perche: extra.esitoPiano.limite_dichiarato.spiegazione,
    },
    fantasma,
    violazioni_director: rientro.direttore.violazioni.length,
    sospetti_director: rientro.direttore.riepilogo.sospetti,
  };
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
      const s = scenarioPer(nomeGara, gara, Lf, pilota, contesto, extra);
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
  // LA MAPPA DEI NOMI, invece di cablarla nella pagina. Il sito chiama una gara
  // "Gran Bretagna", il simulatore "GranBretagna" — ed e' giusto cosi': E24 del catalogo
  // e' proprio lo spazio nel nome che spezza i glob. Il ponte sta qui, in un dato, non in
  // un `if` dentro gara.html.
  const cartellaDi = {};
  for (const g of tutte) cartellaDi[g.replace(/([a-z])([A-Z])/g, '$1 $2')] = g;
  writeFileSync(path.join(dove, 'manifest.json'), JSON.stringify({
    gare: tutte, cartella_di: cartellaDi, generato_il: DATA,
    nota: 'cartella_di mappa il nome del sito (con spazi) su quello della cartella (senza)',
  }, null, 1));
  console.log(`\n${totScen} risposte pre-calcolate su ${tutte.length} gare`);
}

if (import.meta.url === `file://${process.argv[1]}`) main();
