#!/usr/bin/env node
// genera_vista.mjs — l'UNICO punto in cui la pagina prende dei numeri.
//
// La pagina non calcola: qui si eseguono `doveRientri` e `curvaDelQuando` (che
// a loro volta passano dal Director) e si scrive web/vista/demo.json. I
// componenti del browser leggono da lì e FORMATTANO. Così non esiste una
// seconda implementazione della fisica dentro l'interfaccia (regola 8, E17), e
// la sentinella s20 può verificarlo sui sorgenti.
//
// Ogni numero esce accompagnato dai DATI della sua targhetta (natura, testo,
// data, n, banda): la targhetta viene poi costruita e VALIDATA dai componenti
// con `creaTarghetta`, che rifiuta un numero senza natura (regola 2).
//
// Uso: node web/genera_vista.mjs

import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { caricaGare2026 } from '../provenienza/gare_2026.mjs';
import { caricaPrior } from '../provenienza/pitloss_dati.mjs';
import { verde, regimeNeutralizzato } from '../provenienza/definizioni.mjs';
import { simboliStatus, MESCOLE_SLICK, MESCOLE_SLICK_ATTUALI, MESCOLE_BAGNATO } from '../provenienza/vocabolario.mjs';
import { caricaCostanti } from '../scenario/director_dati.mjs';
import { doveRientri, curvaDelQuando } from '../scenario/costruttore.mjs';
import { pianoOttimo } from '../scenario/piano.mjs';
import { allarmiPiano } from '../scenario/allarmi.mjs';
import { caricaDurate2026 } from '../scenario/allarmi_dati.mjs';

export const PERCORSO_VISTA = 'web/vista/demo.json';
const DATA = '2026-07-29';
const GIRI_PRIMA_SULLA_MAPPA = 3;

export const PERCORSO_ESITO_BAGNATO = 'banco/prereg/ESITO_bagnato.json';

/**
 * Perché il selettore Wet è spento, detto dall'esito della fase e non da una
 * frase cablata. Se un domani la fase passasse il suo cancello, questa funzione
 * si rifiuta di produrre un motivo: il selettore andrebbe acceso, non spiegato.
 */
function motivoWet(radice) {
  const esito = JSON.parse(readFileSync(path.join(radice, PERCORSO_ESITO_BAGNATO), 'utf8'));
  if (!/NON ESEGUIBILE/.test(esito.verdetto)) {
    throw new Error(`la fase bagnato non è più "non eseguibile" (${esito.verdetto}): il selettore Wet va deciso, non giustificato`);
  }
  return `modello non ancora misurato — fase bagnato eseguita il ${esito._targhetta.data}: ${esito.verdetto.toLowerCase()} (${esito.n_gare_giudicabili} gara giudicabile su ${esito.n_gare_bagnate} bagnate, ne servono ${esito.criterio_dichiarato.min_gare_giudicabili}). Referto: ${PERCORSO_ESITO_BAGNATO}`;
}

/** Congelamento demo: ~55% della distanza, il primo giro VERDE da lì in poi. */
function congelamentoDemo(gara) {
  const inizio = Math.max(6, Math.round(gara.nGiri * 0.55));
  for (let lap = inizio; lap < gara.nGiri - 3; lap += 1) {
    let verdi = 0;
    for (const [, celle] of gara.perPilota) {
      const c = celle.get(lap);
      if (c && c.status !== null && verde(c)) verdi += 1;
    }
    if (verdi >= 10) return lap;
  }
  return inizio;
}

/**
 * Mescola proposta: una slick DIVERSA da quelle già usate, se servono ancora
 * due mescole. Il regolamento 2026 impone due slick sull'asciutto e il Director
 * lo verifica: proporre di rimontare la mescola su cui si è già — come farebbe
 * un selettore ingenuo — significa proporre una squalifica. Misurato sul demo:
 * succede davvero (Cina, ALO su HARD dal giro 1).
 */
function mescolaProposta(gara, Lf, pilota) {
  const usate = new Set();
  for (const [lap, c] of gara.perPilota.get(pilota)) {
    if (lap <= Lf && c.compound !== null && MESCOLE_SLICK.has(c.compound)) usate.add(c.compound);
  }
  const ordine = ['HARD', 'MEDIUM', 'SOFT'];
  if (usate.size >= 2) return ordine[0];
  return ordine.find((m) => !usate.has(m)) ?? ordine[0];
}

/** Pilota demo: il primo in ordine alfabetico con stato utilizzabile a Lf. */
function pilotaDemo(gara, Lf) {
  return [...gara.perPilota.keys()].sort().find((drv) => {
    const c = gara.perPilota.get(drv).get(Lf);
    return c && c.cum_time !== null && c.tyre_age !== null;
  }) ?? null;
}

export function costruisciVistaDemo(radice) {
  const gare = caricaGare2026(radice);
  const modello = JSON.parse(readFileSync(path.join(radice, 'data', 'modelli', 'modello_v2.json'), 'utf8'));
  const prior = caricaPrior(radice);
  const costantiDirector = caricaCostanti(radice);
  const durate2026 = caricaDurate2026(radice);
  const esitoPiano = JSON.parse(readFileSync(path.join(radice, 'banco', 'prereg', 'ESITO_multistint.json'), 'utf8'));
  const bandaRientro = JSON.parse(readFileSync(path.join(radice, 'data', 'modelli', 'banda_rientro.json'), 'utf8'));
  // fin dove la RISPOSTA e' validata (6 giri): sta nei dati con la sua targhetta, non come
  // costante nel codice. Vedi ai_lab/REGISTRO_F1.md.
  const orizzonteRisposta = JSON.parse(readFileSync(path.join(radice, 'data', 'modelli', 'orizzonte_risposta.json'), 'utf8'));
  const vitaMescola = JSON.parse(readFileSync(path.join(radice, 'data', 'modelli', 'vita_mescola.json'), 'utf8'));
  const sogliaSorpasso = JSON.parse(readFileSync(path.join(radice, 'data', 'modelli', 'soglia_sorpasso.json'), 'utf8'));
  const pavimenti = costantiDirector.pavimenti;

  const scenari = [];
  for (const [nomeGara, gara] of Object.entries(gare)) {
    const Lf = congelamentoDemo(gara);
    const pilota = pilotaDemo(gara, Lf);
    if (pilota === null) continue;
    const mescola = mescolaProposta(gara, Lf, pilota);
    const giroPit = Lf + 1; // BOX NOW: la sosta è al giro successivo al congelamento
    const contesto = { gare, modello, prior, costantiDirector, bandaRientro, orizzonteRisposta, vitaMescola, sogliaSorpasso, nGiriGara: gara.nGiri };

    const rientro = doveRientri({ gara: nomeGara, freezeLap: Lf, pilota, giroPit, mescola }, contesto);
    // IL PIANO FINO ALLA BANDIERA. Gli allarmi si calcolano DOPO, sul piano già
    // scelto: la ricerca non li ha mai visti (cancello M4).
    const ottimo = pianoOttimo({ gara: nomeGara, freezeLap: Lf, pilota, giroFinale: gara.nGiri, kMax: 3 }, contesto);
    const curva = curvaDelQuando({ gara: nomeGara, freezeLap: Lf, pilota, mescola }, contesto);
    const cellaLf = gara.perPilota.get(pilota).get(Lf);
    const regime = cellaLf.status !== null && regimeNeutralizzato(cellaLf)
      ? (simboliStatus(cellaLf.status).has('4') ? 'SC' : 'VSC')
      : null;

    // ── mappa: il REALE di tutti (dai dati) + il FANTASMA del pilota (traccia
    //    del kernel). Il fantasma si disegna sopra, non al posto: qui viaggiano
    //    entrambi, separati, fino alla pagina.
    const giroFineMappa = rientro.giro_di_rientro + 1;
    const giriMappa = [];
    for (let lap = Math.max(1, Lf - GIRI_PRIMA_SULLA_MAPPA); lap <= giroFineMappa; lap += 1) {
      const reale = {};
      for (const [drv, celle] of gara.perPilota) {
        const c = celle.get(lap);
        if (c && c.cum_time !== null) reale[drv] = Number(c.cum_time.toFixed(3));
      }
      // strato FANTASMA: la proiezione di tutte le auto, non solo della mia
      const fantasma = {};
      const inBox = [];
      const fuoriBox = [];
      for (const [drv, passi] of Object.entries(rientro.traccia ?? {})) {
        const passo = (passi ?? []).find((x) => x.lap === lap);
        if (!passo) continue;
        fantasma[drv] = Number(passo.cum_time.toFixed(3));
        if (passo.in_lap) inBox.push(drv);
        if (passo.out_lap) fuoriBox.push(drv);
      }
      giriMappa.push({ giro: lap, reale, fantasma, in_box: inBox.sort(), fuori_box: fuoriBox.sort() });
    }

    scenari.push({
      gara: nomeGara,
      n_giri: gara.nGiri,
      freeze_lap: Lf,
      pilota,
      mescola_scelta: mescola,
      mescole_gia_usate: [...new Set([...gara.perPilota.get(pilota)]
        .filter(([lap, c]) => lap <= Lf && c.compound !== null && MESCOLE_SLICK.has(c.compound))
        .map(([, c]) => c.compound))].sort(),
      regime,
      approvato: rientro.approvato,
      pannello: {
        posizione: rientro.posizione,
        su_quanti: rientro.su_quanti,
        giro_di_rientro: rientro.giro_di_rientro,
        davanti: rientro.davanti,
        dietro: rientro.dietro,
        gap_soppressi: rientro.gap_soppressi,
        // LA BANDA sulla posizione. Non è una probabilità di sorpasso: dice di
        // quanto può sbagliare il numero, mai chi supererà chi (cancello D3).
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
      stazionario_prior_s: prior.stazionario_tipico_s,
      stazionario_pavimento_s: prior.stazionario_minimo_fisico_s,
      curva: curva.curva,
      minimo: curva.minimo,
      // LA FINESTRA viaggia fino alla vista demo, e non è un dettaglio di
      // trasporto: questo oggetto è ciò che l'audit P08 cammina. Finché il campo
      // non c'era, nessuna sentinella poteva accorgersi che la pagina pubblicava
      // ancora il giro secco che la decisione del 01/08 aveva abolito — il
      // costruttore la calcolava (su 11.143 risposte in produzione) e qui la
      // proiezione campo-per-campo la lasciava indietro in silenzio.
      finestra: curva.finestra,
      banda_presente: curva.banda_presente,
      nota_banda: curva.nota_banda,
      orizzonte: curva.orizzonte,
      assunzioni: rientro.assunzioni,
      // IL PIANO GOMME: lo stint è un oggetto, e porta `da_dati: false` fino in
      // pagina. Il limite del modello viaggia COL piano — un piano mostrato
      // senza «propone troppo poche soste, perché non c'è cliff» è una promessa
      // che il modello non può mantenere.
      piano: ottimo.migliore === null ? null : {
        k: ottimo.migliore.k,
        soste: ottimo.migliore.piano.soste,
        stint: ottimo.migliore.piano.stint,
        alternative: ottimo.per_k,
        mescole_gia_usate: ottimo.mescole_gia_usate,
        vincolo_regolamento: ottimo.vincolo_regolamento,
        allarmi: allarmiPiano(ottimo.migliore.piano, durate2026),
        limite: esitoPiano.limite_dichiarato.conseguenza,
        limite_perche: esitoPiano.limite_dichiarato.spiegazione,
      },
      mappa: { giri: giriMappa },
      pavimento_s: pavimenti.gare[nomeGara]?.pavimento_s ?? null,
      pavimento_n_verdi: pavimenti.gare[nomeGara]?.n_giri_verdi ?? null,
      violazioni_director: rientro.direttore.violazioni.length,
      sospetti_director: rientro.direttore.riepilogo.sospetti,
    });
  }

  // Uno scenario SOTTO NEUTRALIZZAZIONE, cercato nel grezzo: serve a esercitare
  // la soppressione dei gap e l'assunzione sulle soste dei rivali. Senza almeno
  // un caso così, quei due percorsi della pagina non sarebbero mai guardati.
  const sottoRegime = (() => {
    for (const [nomeGara, gara] of Object.entries(gare)) {
      for (const drv of [...gara.perPilota.keys()].sort()) {
        for (const [lap, c] of gara.perPilota.get(drv)) {
          if (lap < 8 || lap > gara.nGiri - 6) continue;
          if (c.status === null || !regimeNeutralizzato(c)) continue;
          if (c.cum_time === null || c.tyre_age === null) continue;
          return { nomeGara, gara, drv, lap };
        }
      }
    }
    return null;
  })();
  if (sottoRegime) {
    const { nomeGara, gara, drv, lap } = sottoRegime;
    const mescola = mescolaProposta(gara, lap, drv);
    const contesto = { gare, modello, prior, costantiDirector, bandaRientro, orizzonteRisposta, vitaMescola, nGiriGara: gara.nGiri };
    const rientro = doveRientri({ gara: nomeGara, freezeLap: lap, pilota: drv, giroPit: lap + 1, mescola }, contesto);
    if (rientro.approvato) {
      scenari.push({
        gara: nomeGara, n_giri: gara.nGiri, freeze_lap: lap, pilota: drv,
        mescola_scelta: mescola, mescole_gia_usate: [],
        regime: simboliStatus(gara.perPilota.get(drv).get(lap).status).has('4') ? 'SC' : 'VSC',
        sotto_neutralizzazione: true,
        approvato: true,
        piano: null, // scenario di dimostrazione del regime: il piano non fa parte della domanda
        pannello: {
          posizione: rientro.posizione, su_quanti: rientro.su_quanti,
          giro_di_rientro: rientro.giro_di_rientro,
          davanti: rientro.davanti, dietro: rientro.dietro, gap_soppressi: rientro.gap_soppressi,
          banda_posizione: rientro.banda_posizione,
        },
        perdita: {
          valore: rientro.perdita.perdita, verde: rientro.perdita.perdita_verde,
          fattore: rientro.perdita.fattore, circuito: rientro.perdita.circuito,
          fallback: rientro.perdita.fallback, targhetta: rientro.perdita.targhetta,
        },
        stazionario_prior_s: prior.stazionario_tipico_s,
        stazionario_pavimento_s: prior.stazionario_minimo_fisico_s,
        curva: null, minimo: null, finestra: null, banda_presente: null, nota_banda: null, orizzonte: null,
        assunzioni: rientro.assunzioni,
        mappa: { giri: [] },
        pavimento_s: pavimenti.gare[nomeGara]?.pavimento_s ?? null,
        pavimento_n_verdi: pavimenti.gare[nomeGara]?.n_giri_verdi ?? null,
        violazioni_director: rientro.direttore.violazioni.length,
        sospetti_director: rientro.direttore.riepilogo.sospetti,
      });
    }
  }

  return {
    _targhetta: {
      tipo: 'vista demo della pagina — nessun numero calcolato dal browser',
      generata_da: 'web/genera_vista.mjs',
      percorso: 'provenienza → engine → scenario (Director compreso) → questo JSON → componenti',
      data: DATA,
    },
    modello: {
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
      // ATTUALI, non MESCOLE_SLICK: quest'ultimo contiene anche SUPERSOFT,
      // ULTRASOFT e HYPERSOFT, che servono a LEGGERE il fondo 2018 e non
      // esistono nel 2026. Il selettore è del prodotto, non dell'archivio.
      ...[...MESCOLE_SLICK_ATTUALI].map((codice) => ({ codice, attiva: true, motivo: null })),
      // §Cosa NON costruire al giorno 1: il selettore Wet è VISIBILE ma SPENTO,
      // con targhetta. Mostrarlo attivo prometterebbe un modello che non esiste.
      // Il motivo NON è scritto a mano qui: viene dall'esito della fase, così la
      // pagina non può raccontare una ragione diversa da quella a referto (E22).
      ...[...MESCOLE_BAGNATO].map((codice) => ({
        codice, attiva: false,
        motivo: motivoWet(radice),
      })),
    ],
    scenari,
  };
}

const eseguitoDirettamente = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (eseguitoDirettamente) {
  const radice = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
  const vista = costruisciVistaDemo(radice);
  const dest = path.join(radice, PERCORSO_VISTA);
  mkdirSync(path.dirname(dest), { recursive: true });
  writeFileSync(dest, JSON.stringify(vista, null, 1) + '\n');
  for (const s of vista.scenari) {
    console.log(`${s.gara.padEnd(14)} Lf=${String(s.freeze_lap).padStart(2)} ${s.pilota}  rientro P${s.pannello.posizione}/${s.pannello.su_quanti}  minimo curva ${s.minimo ? `giro ${s.minimo.giroPit}` : '—'}  regime ${s.regime ?? 'verde'}${s.pannello.gap_soppressi ? '  (GAP SOPPRESSI)' : ''}`);
  }
  console.log(`\n${vista.scenari.length} scenari → ${PERCORSO_VISTA}`);
}
