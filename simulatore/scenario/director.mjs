// director.mjs — 🛡️ Simulation Director: l'ULTIMO controllo prima della pagina.
//
// DISTINZIONE COSTITUZIONALE (CLAUDE.md). Il Director valida l'OUTPUT a
// runtime: cerca paradossi fisici in ciò che sta per essere mostrato, su questa
// simulazione, adesso. Il Banco valida il CODICE ai cancelli: nessuna modifica
// va online se peggiora i cancelli pre-registrati. Non si fondono: il Banco non
// vede la simulazione dell'utente, il Director non conosce i golden. Un bug che
// passa il Banco può ancora produrre un output assurdo, ed è per quello che
// esiste questo file.
//
// Il Director CONSUMA le definizioni derivate da provenienza/ — `verde`,
// `regimeNeutralizzato`, l'alfabeto degli status. Non le ri-deriva: una
// seconda definizione di verde nel guardiano sarebbe E12 nel posto peggiore
// possibile, perché il guardiano approverebbe con un metro diverso da quello
// con cui il motore ha calcolato.
//
// Nessuna costante è cablata qui: pavimenti da data/modelli/pavimenti_2026.json
// (misurati), soglie da data/priors/director_limiti.json (dichiarate),
// pit-loss e stazionario da data/priors/pitloss_priors.json (prior esterno).
//
// ── Tre invarianti che i DATI hanno corretto, non l'intuizione ──────────────
// Misurato sulle 11 gare 2026 prima di scrivere le regole (disciplina E13):
//   · "l'età riparte da 1 dopo la sosta" è FALSO nel grezzo: 330 casi su 435
//     danno 1, gli altri arrivano fino a 66 (set già usati nelle libere). Non
//     è una regola. Ciò che regge senza eccezioni è che lo STINT avanza a ogni
//     sosta (435 su 435) e che dentro uno stint l'età cresce di esattamente 1
//     (12.013 coppie su 12.013).
//   · il limite delle 2 ore misurato sul tempo-sessione boccerebbe Monaco 2026
//     (144 minuti), che è regolare: c'è stata bandiera rossa. Il limite di gara
//     si verifica solo senza rossa; con rossa vale la finestra di 3 ore.
//   · la regola delle due mescole vale per chi COMPLETA la gara: chi si ritira
//     al giro 5 con una sola mescola non è squalificato. Misurato: 114 piloti
//     al traguardo, 0 con meno di due slick.

import { readFileSync } from 'node:fs';
import path from 'node:path';
import { verde, regimeNeutralizzato } from '../provenienza/definizioni.mjs';
import { simboliStatus, MESCOLE_SLICK, MESCOLE_BAGNATO } from '../provenienza/vocabolario.mjs';
import { caricaPrior, perditaBox } from '../provenienza/pitloss.mjs';

export const SEVERITA = Object.freeze({ FATAL: 'FATAL', SOSPETTO: 'SOSPETTO', INFO: 'INFO' });

export function caricaCostanti(radice) {
  const leggi = (p) => JSON.parse(readFileSync(path.join(radice, p), 'utf8'));
  return {
    limiti: leggi('data/priors/director_limiti.json'),
    // il prior si carica dal SUO modulo, che gli aggancia la misura interna: un
    // JSON.parse diretto qui darebbe al guardiano una fonte diversa da quella
    // del motore, e la sentinella s22 esiste per non farlo passare
    prior: caricaPrior(radice),
    pavimenti: leggi('data/modelli/pavimenti_2026.json'),
  };
}

// La mappa gara → circuito NON sta qui: sta in provenienza/pitloss.mjs, e il
// Director chiede a quel modulo la perdita di riferimento. Tenerne una copia
// significherebbe che il guardiano valida contro una fonte e il motore prezza
// con un'altra — cioè la stessa famiglia di E12, nel posto peggiore.

/**
 * Valida l'output di una simulazione prima che raggiunga la pagina.
 *
 * @param simulazione `{ gara, n_giri, completa, piloti: { drv: { celle:
 *        [{lap, cella}], soste: [{lap, perdita, stazionario, regime}],
 *        settori?: {lap: [s1,s2,s3]} } } }` — `cella` è il contratto di
 *        provenienza, invariato.
 * @returns `{ approved, violazioni: [{codice, severita, giro, atteso,
 *          ottenuto, pilota, messaggio}], riepilogo }`.
 *          Nessuna violazione FATAL → approved.
 */
export function validaSimulazione(simulazione, costanti) {
  const { limiti, prior, pavimenti } = costanti;
  const violazioni = [];
  const nonVerificabili = [];
  const agg = (codice, severita, giro, atteso, ottenuto, pilota, messaggio) =>
    violazioni.push({ codice, severita, giro, atteso, ottenuto, pilota, messaggio });

  const { gara, n_giri: nGiri, completa = false, piloti = {} } = simulazione;

  // ── pavimento del circuito (misurato) ────────────────────────────────────
  const pav = pavimenti.gare?.[gara];
  const pavimento = pav && pav.pavimento_s !== null
    ? pav.pavimento_s - limiti.margine_pavimento_s.valore
    : null;
  if (pavimento === null) nonVerificabili.push(`pavimento non misurato per "${gara}": FIS01 non eseguito (regola 6: non si inventa un limite di ripiego)`);

  // ── riferimento della perdita ai box: LA STESSA FONTE del motore ─────────
  // Dove il fondo ha promosso il circuito è la misura interna; altrove il prior.
  // La targhetta viaggia con il numero e finisce nel riepilogo.
  const riferimentoPit = perditaBox(prior, gara, null);
  const clean = riferimentoPit.clean_10pct_s ?? null;
  if (clean === null) nonVerificabili.push(`clean-stop non misurato per "${gara}" (${riferimentoPit.fonte}): FIS04 non eseguito`);

  let rossaPresente = false;
  let durataMassima = 0;

  for (const [drv, pilota] of Object.entries(piloti)) {
    const celle = [...(pilota.celle ?? [])].sort((a, b) => a.lap - b.lap);
    if (celle.length === 0) continue;

    // ── GEO01 · sequenza giri contigua da 1, senza buchi né duplicati ──────
    if (celle[0].lap !== 1) {
      agg('GEO01', SEVERITA.FATAL, celle[0].lap, 'primo giro = 1', `primo giro = ${celle[0].lap}`, drv, 'la sequenza dei giri non parte da 1');
    }
    for (let i = 1; i < celle.length; i += 1) {
      if (celle[i].lap === celle[i - 1].lap) {
        agg('GEO01', SEVERITA.FATAL, celle[i].lap, 'giri distinti', `giro ${celle[i].lap} duplicato`, drv, 'giro duplicato nella sequenza');
      } else if (celle[i].lap !== celle[i - 1].lap + 1) {
        agg('GEO01', SEVERITA.FATAL, celle[i].lap, `giro ${celle[i - 1].lap + 1}`, `giro ${celle[i].lap}`, drv, 'buco nella sequenza dei giri');
      }
    }
    if (completa && celle[celle.length - 1].lap > nGiri) {
      agg('GEO01', SEVERITA.FATAL, celle[celle.length - 1].lap, `ultimo giro ≤ ${nGiri}`, `${celle[celle.length - 1].lap}`, drv, 'la simulazione supera la distanza di gara');
    }

    let saltiCum = 0;
    for (let i = 1; i < celle.length; i += 1) {
      const prima = celle[i - 1].cella;
      const dopo = celle[i].cella;
      const giro = celle[i].lap;

      // ── FIS01 · nessun giro VERDE sotto il pavimento del circuito ────────
      if (pavimento !== null && dopo.status !== null && verde(dopo) && dopo.lap_time !== null && dopo.lap_time < pavimento) {
        agg('FIS01', SEVERITA.FATAL, giro, `≥ ${pavimento.toFixed(3)} s`, `${dopo.lap_time} s`, drv,
          `giro verde sotto il pavimento del circuito (minimo misurato ${pav.pavimento_s} s meno margine ${limiti.margine_pavimento_s.valore} s)`);
      }

      // ── GEO02 · somma dei tempi = totale (sui cum consecutivi) ───────────
      if (prima.cum_time !== null && dopo.cum_time !== null && dopo.lap_time !== null) {
        const scarto = Math.abs(dopo.cum_time - prima.cum_time - dopo.lap_time);
        if (scarto > limiti.tolleranza_cum_s.valore) {
          agg('GEO02', SEVERITA.FATAL, giro, `|Δcum − tempo giro| ≤ ${limiti.tolleranza_cum_s.valore} s`, `${scarto.toFixed(3)} s`, drv,
            'il cumulato non corrisponde alla somma dei tempi sul giro');
        }
      } else {
        saltiCum += 1;
      }

      // ── FIS06 / FIS07 · età nello stint, stint alla sosta ───────────────
      if (prima.in_lap) {
        if (prima.stint !== null && dopo.stint !== null && dopo.stint <= prima.stint) {
          agg('FIS07', SEVERITA.FATAL, giro, `stint > ${prima.stint}`, `stint ${dopo.stint}`, drv,
            'dopo una sosta lo stint non avanza: il set nuovo non è stato montato');
        }
      } else if (prima.stint !== null && dopo.stint === prima.stint
        && prima.tyre_age !== null && dopo.tyre_age !== null && dopo.tyre_age !== prima.tyre_age + 1) {
        agg('FIS06', SEVERITA.FATAL, giro, `età ${prima.tyre_age + 1}`, `età ${dopo.tyre_age}`, drv,
          'dentro lo stint l\'età gomma non avanza di esattamente un giro');
      }
    }
    if (saltiCum > 0) nonVerificabili.push(`${drv}: ${saltiCum} coppie di giri senza cum o senza tempo — GEO02 non eseguito lì (l'assenza resta null)`);

    // ── FIS05 · somma settori = tempo giro, dove i settori esistono ────────
    for (const { lap, cella } of celle) {
      const settori = pilota.settori?.[lap];
      if (!settori || cella.lap_time === null || settori.some((s) => s === null || s === undefined)) continue;
      const somma = settori.reduce((a, b) => a + b, 0);
      const scarto = Math.abs(somma - cella.lap_time);
      if (scarto > limiti.tolleranza_somma_settori_s.valore) {
        agg('FIS05', SEVERITA.FATAL, lap, `somma settori = ${cella.lap_time} s`, `${somma.toFixed(3)} s`, drv,
          'la somma dei settori non fa il tempo sul giro');
      }
    }

    // ── REG01 · due mescole slick su asciutto, per chi COMPLETA la gara ────
    // Si applica solo dove una STRATEGIA È DICHIARATA. Un rivale proiettato
    // sotto l'assunzione "non si ferma" finirebbe per forza su una mescola
    // sola: quella è una proprietà dell'assunzione, non una squalifica da
    // mostrare in pagina. Chi costruisce lo scenario dichiara per chi la
    // strategia è specificata; l'osservato reale lo è sempre (default true).
    const strategiaDichiarata = pilota.strategia_dichiarata !== false;
    const mescole = new Set(celle.map(({ cella }) => cella.compound).filter((c) => c !== null));
    const bagnato = [...mescole].some((m) => MESCOLE_BAGNATO.has(m));
    const slick = [...mescole].filter((m) => MESCOLE_SLICK.has(m));
    const haCompletato = celle[celle.length - 1].lap === nGiri;
    if (completa && haCompletato && !bagnato && !strategiaDichiarata) {
      nonVerificabili.push(`${drv}: strategia non dichiarata (proiettato senza soste) — REG01 non eseguito`);
    }
    if (completa && haCompletato && !bagnato && strategiaDichiarata && slick.length < 2) {
      agg('REG01', SEVERITA.FATAL, celle[celle.length - 1].lap, '≥ 2 mescole slick', `${slick.length} (${slick.join(', ') || 'nessuna'})`, drv,
        'gara asciutta completata con meno di due mescole slick: pena la squalifica (regolamento 2026)');
    }

    // ── rossa e durata ────────────────────────────────────────────────────
    for (const { cella } of celle) {
      if (cella.status !== null && simboliStatus(cella.status).has('5')) rossaPresente = true;
    }
    const primo = celle[0].cella;
    const ultimo = celle[celle.length - 1].cella;
    if (primo.cum_time !== null && ultimo.cum_time !== null) {
      durataMassima = Math.max(durataMassima, ultimo.cum_time - primo.cum_time + (primo.lap_time ?? 0));
    }

    // ── soste: stazionario e perdita ──────────────────────────────────────
    for (const sosta of pilota.soste ?? []) {
      const { lap, perdita, stazionario, regime = null } = sosta;

      if (stazionario !== null && stazionario !== undefined) {
        const pavimentoFisico = prior.stazionario_minimo_fisico_s;
        if (stazionario < pavimentoFisico) {
          agg('FIS02', SEVERITA.FATAL, lap, `≥ ${pavimentoFisico} s`, `${stazionario} s`, drv,
            'stazionario sotto il pavimento fisico: quattro ruote non si cambiano in meno tempo');
        } else if (stazionario > limiti.stazionario_massimo_anomalo_s.valore) {
          agg('FIS03', SEVERITA.SOSPETTO, lap, `≤ ${limiti.stazionario_massimo_anomalo_s.valore} s`, `${stazionario} s`, drv,
            'stazionario anomalo: possibile ma raro (danno, riparazione, sosta sotto rossa)');
        }
      } else {
        nonVerificabili.push(`${drv} giro ${lap}: stazionario assente — FIS02/FIS03 non eseguiti`);
      }

      if (perdita === null || perdita === undefined) {
        nonVerificabili.push(`${drv} giro ${lap}: perdita ai box assente — FIS04/REG03 non eseguiti`);
        continue;
      }
      const verdeDelCircuito = riferimentoPit.perdita_verde;

      if (regime === null) {
        if (clean !== null && perdita < clean - limiti.margine_pitloss_s.valore) {
          agg('FIS04', SEVERITA.FATAL, lap, `≥ ${(clean - limiti.margine_pitloss_s.valore).toFixed(2)} s`, `${perdita} s`, drv,
            `perdita in verde sotto il clean-stop del circuito (${clean} s, decile migliore misurato) meno il margine ${limiti.margine_pitloss_s.valore} s`);
        }
      } else {
        // ── REG03 · una sosta neutralizzata non costa quanto una verde ────
        const rapporto = perdita / verdeDelCircuito;
        const banda = limiti.bande_neutralizzazione[regime];
        if (rapporto >= limiti.rapporto_pit_neutralizzato_massimo.valore) {
          agg('REG03', SEVERITA.FATAL, lap, `rapporto < ${limiti.rapporto_pit_neutralizzato_massimo.valore} della perdita verde`, `${rapporto.toFixed(3)}`, drv,
            `sosta sotto ${regime} prezzata come se fosse in verde: il vantaggio della neutralizzazione è sparito`);
        } else if (banda && (rapporto < banda[0] || rapporto > banda[1])) {
          agg('REG03', SEVERITA.SOSPETTO, lap, `rapporto in [${banda[0]}, ${banda[1]}]`, `${rapporto.toFixed(3)}`, drv,
            `sosta sotto ${regime} fuori dalla banda dichiarata del prior (banda, non punto)`);
        }
        // La sosta si dichiara neutralizzata: lo status del giro deve dirlo.
        // Il flag arriva da provenienza, non viene ri-derivato qui (E12).
        const cellaSosta = celle.find((c) => c.lap === lap)?.cella;
        if (cellaSosta && cellaSosta.status !== null && !regimeNeutralizzato(cellaSosta)) {
          agg('REG03', SEVERITA.SOSPETTO, lap, 'status in regime neutralizzato', `status "${cellaSosta.status}"`, drv,
            'la sosta è dichiarata sotto neutralizzazione ma lo status del giro non è un regime neutralizzato');
        }
      }
    }
  }

  // ── REG02 · durata ────────────────────────────────────────────────────────
  if (durataMassima > 0) {
    const finestra = limiti.durata_massima_finestra_s.valore;
    const gara2h = limiti.durata_massima_gara_s.valore;
    if (durataMassima > finestra) {
      agg('REG02', SEVERITA.FATAL, null, `≤ ${finestra} s (finestra 3 ore)`, `${durataMassima.toFixed(0)} s`, null,
        'la simulazione supera la finestra totale di tre ore');
    } else if (!rossaPresente && durataMassima > gara2h) {
      agg('REG02', SEVERITA.FATAL, null, `≤ ${gara2h} s (2 ore di gara)`, `${durataMassima.toFixed(0)} s`, null,
        'la gara supera le due ore senza bandiera rossa che giustifichi la sospensione');
    } else if (rossaPresente && durataMassima > gara2h) {
      nonVerificabili.push(`durata ${durataMassima.toFixed(0)} s oltre le 2 ore ma con bandiera rossa: REG02 verificato sulla finestra di 3 ore`);
    }
  }

  const fatali = violazioni.filter((v) => v.severita === SEVERITA.FATAL);
  return {
    approved: fatali.length === 0,
    violazioni,
    riepilogo: {
      fatali: fatali.length,
      sospetti: violazioni.filter((v) => v.severita === SEVERITA.SOSPETTO).length,
      codici: [...new Set(violazioni.map((v) => v.codice))].sort(),
      non_verificabili: [...new Set(nonVerificabili)],
      fonte_pit_loss: riferimentoPit.fonte,
      targhetta_pit_loss: riferimentoPit.targhetta,
    },
  };
}

/**
 * Costruisce l'ingresso del Director da una gara caricata da provenienza.
 * Le soste si riconoscono dal flag `in_lap` GREZZO; perdita e stazionario
 * restano **null** perché il grezzo per-giro non li porta (regola 6: non si
 * riempiono con un prior per far girare un controllo).
 */
export function simulazioneDaGara(gara, nomeGara, { completa = true } = {}) {
  const piloti = {};
  for (const [drv, celle] of gara.perPilota) {
    const elenco = [...celle.entries()].map(([lap, cella]) => ({ lap, cella })).sort((a, b) => a.lap - b.lap);
    piloti[drv] = {
      celle: elenco,
      soste: elenco.filter(({ cella }) => cella.in_lap).map(({ lap, cella }) => ({
        lap,
        perdita: null,
        stazionario: null,
        regime: cella.status !== null && regimeNeutralizzato(cella)
          ? (simboliStatus(cella.status).has('4') ? 'SC' : 'VSC')
          : null,
      })),
    };
  }
  return { gara: nomeGara, n_giri: gara.nGiri, completa, piloti };
}
