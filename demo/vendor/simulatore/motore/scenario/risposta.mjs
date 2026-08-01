// ————————————————————————————————————————————————————————————————————————
// ARTEFATTO GENERATO — non modificare qui.
//   sorgente: simulatore/scenario/risposta.mjs
//   generato: simulatore/web/trasporta_motore.mjs
// Vercel serve demo/ come radice e non vede simulatore/: questa copia esiste
// solo per essere ESEGUITA dal pannello live, dove il pre-calcolo non puo'
// esistere. Modificare QUESTO file lo fa divergere dall'originale, e
// `node web/trasporta_motore.mjs --verifica` fallisce (lo esegue la CI).
// ————————————————————————————————————————————————————————————————————————
// risposta.mjs — la RISPOSTA a «se fermo questo pilota adesso»: un record solo,
// montato in un posto solo.
//
// PERCHE' STA QUI E NON DENTRO IL GENERATORE DELLA VISTA. Questo record lo
// producono DUE strade: il pre-calcolo in Node per gara.html, e il pannello LIVE
// che esegue il motore nel browser. Se ognuna se lo montasse per conto suo,
// replay e diretta risponderebbero con due assemblaggi diversi degli stessi
// numeri — E17 nella sua forma piu' subdola, perche' i due sarebbero uguali il
// giorno in cui li scrivi e diversi il primo giorno che ne tocchi uno.
//
// Montandolo qui, la parita' fra diretta e replay diventa STRUTTURALE e non una
// coincidenza da verificare a mano. Il banco la misura lo stesso (il cancello di
// parita' confronta i due percorsi su gare vere): una proprieta' garantita per
// costruzione va comunque provata, perche' la garanzia sta in questa frase e le
// frasi non falliscono da sole.
//
// PURO: nessun accesso al disco. Contesto e costanti arrivano dal chiamante —
// in Node letti dal disco, in pagina dal `contesto_live.json` trasportato.
import { MESCOLE_SLICK, simboliStatus } from '../provenienza/vocabolario.mjs';
import { regimeDiCella } from '../provenienza/definizioni.mjs';
import { doveRientri, curvaDelQuando } from './costruttore.mjs';
import { pianoOttimo, mescolePerSoste } from './piano.mjs';
import { allarmiPiano } from './allarmi.mjs';

/** La mescola su cui il pilota sta girando al congelamento, o null. */
export function mescolaAlGiro(gara, Lf, pilota) {
  const c = gara.perPilota.get(pilota)?.get(Lf);
  return c && MESCOLE_SLICK.has(c.compound) ? c.compound : null;
}

/** Il regime al congelamento: 'SC', 'VSC' o null. */
export function regimeAlGiro(gara, Lf, pilota) {
  return regimeDiCella(gara.perPilota.get(pilota)?.get(Lf));
}

/**
 * Un record per (pilota, giro): la risposta, la curva, il piano.
 *
 * @param contesto `{ gare, modello, prior, costantiDirector, bandaRientro, nGiriGara }`
 * @param extra    `{ prior, durate2026, esitoPiano }`
 * @param data     la data della targhetta. E' un INGRESSO e non `new Date()`
 *                 qui dentro: due percorsi che montano lo stesso record devono
 *                 poter produrre lo stesso record, e un orologio interno lo
 *                 renderebbe diverso per costruzione.
 * @returns il record, oppure `null` se al congelamento la gomma non e' nota
 *          (non si finge una mescola), oppure `{freeze_lap, senza_risposta}`.
 */
export function rispostaPer(nomeGara, gara, Lf, pilota, contesto, extra, data) {
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
      freeze_lap: Lf, _data: data, gara: nomeGara, pilota, n_giri: gara.nGiri,
      approvato: false,
      motivi_rifiuto: (rientro.direttore?.violazioni ?? [])
        .filter((v) => v.severita === 'FATAL')
        .map((v) => v.messaggio ?? v.codice),
    };
  }
  if (!rientro || rientro.posizione === null || rientro.posizione === undefined) {
    return { freeze_lap: Lf, senza_risposta: 'il motore non ha una risposta a questo giro' };
  }
  const ottimo = pianoOttimo(
    { gara: nomeGara, freezeLap: Lf, pilota, giroFinale: gara.nGiri, kMax: 3 }, contesto);

  // LA CURVA MONTA LA GOMMA CHE IL REGOLAMENTO PERMETTE, non quella che il pilota
  // ha su. Sembra un dettaglio e valeva il 26,4% dei pannelli: rimontare la stessa
  // mescola lascia il pilota con UNA sola slick alla bandiera, e il Director boccia
  // — giustamente — con REG01. La curva usciva vuota su 2.678 risposte su 10.131 e
  // sembrava un difetto del motore, mentre il motore aveva ragione: era la domanda
  // a essere illegale.
  //
  // La scelta non si ricalcola qui: si legge da `pianoOttimo`, che le mescole gia'
  // usate le ha gia' derivate (informazione <= Lf, E14). Una seconda derivazione
  // sarebbe una seconda regola, e il giorno che una delle due imparasse a leggere
  // il bagnato non sarebbero piu' d'accordo.
  //
  // MISURATO prima di accendere: cambiando la mescola dello scenario la POSIZIONE
  // di rientro non si muove in nessuno dei 4.943 casi in cui la gomma differisce —
  // nel 2026 le mescole non separano il degrado (p = 0,209). Quindi questa riga non
  // sposta una risposta gia' pubblicata: riempie una curva che era vuota.
  const mescolaCurva = mescolePerSoste(1, ottimo.mescole_gia_usate ?? [])[0] ?? mescola;
  const curva = curvaDelQuando({ gara: nomeGara, freezeLap: Lf, pilota, mescola: mescolaCurva }, contesto);

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
    _data: data,
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
    // La FINESTRA accanto al minimo, non al posto suo: l'ottimo resta l'ipotesi
    // centrale, ma smette di essere LA risposta (decisione del PO, 01/08).
    finestra: curva.finestra ?? null,
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
    // CIO' CHE IL DIRECTOR NON HA POTUTO VERIFICARE, e perche'.
    //
    // Il Director lo dichiara da sempre (`non_verificabili`), e questo record lo
    // buttava via: arrivavano in pagina solo i CONTEGGI delle violazioni. Su una
    // pista che il repo non ha mai visto — nessun pavimento misurato, nessun
    // clean-stop — FIS01 e FIS04 semplicemente non girano, e l'utente vedeva un
    // pannello identico a quello di una gara con tutti i guardrail accesi.
    //
    // «Un'assunzione che non si vede e' un'assunzione che nessuno puo'
    // contestare» sta scritto in testa al costruttore. Vale anche per una
    // VERIFICA che non e' stata fatta: tacerla e' peggio che non poterla fare.
    // Compatto per CODICE, non la lista grezza: su una gara vera sono 23 righe,
    // quasi tutte lo stesso messaggio ripetuto per pilota, e moltiplicate per
    // 11.143 record diventerebbero peso senza informazione. Qui resta cio' che
    // serve a chi legge: QUALE controllo non e' stato eseguito, su quante voci, e
    // il primo motivo per esteso.
    // ── I CASI: cosa e' successo DAVVERO a chi si e' trovato qui ─────────────
    //
    // Accanto alla previsione, e non al posto suo. La previsione dice «rientri
    // P8»: per farla il motore simula passo, duelli e reazione dei rivali, e due
    // su tre dichiara di non saperle fare. Questo blocco non prevede niente —
    // conta. I duelli ci sono dentro perche' sono successi.
    //
    // Quale era risponde lo decide la carta delle ere, gia' applicata nel file:
    // dove fondo e 2026 divergono vince il 2026, dove i casi non bastano il
    // campo dice «non lo so» invece di riempire il buco.
    casi: (() => {
      const t = contesto.esitiPerCaso;
      if (!t) return null;
      const ctx = regimeAlGiro(gara, Lf, pilota) === null ? 'VERDE' : 'NEUTRA';
      const c = t.contesti?.[ctx];
      if (!c || !c.era_che_risponde) return { contesto: ctx, sa: false, motivo: 'non ci sono abbastanza casi simili: non lo so' };
      const d = c.era_che_risponde === '2026' ? c.d2026 : c.fondo;
      if (!d?.sa) return { contesto: ctx, sa: false, motivo: 'non ci sono abbastanza casi simili: non lo so' };
      return {
        contesto: ctx, sa: true,
        era: c.era_che_risponde, perche_questa_era: c.motivo,
        n: d.n, n_gare: d.n_gare,
        posizioni_mediana: d.mediana, p10: d.p10, p90: d.p90,
        guadagna: d.guadagna, invariata: d.invariata, perde: d.perde,
        orizzonte_giri: 10,
        cosa_e: `su ${d.n} soste vere in ${d.n_gare} gare, dieci giri dopo: ha guadagnato posizioni nel ${d.guadagna}% dei casi, `
          + `le ha perse nel ${d.perde}%, ed e' rimasto dov'era nel ${d.invariata}%`,
        cosa_non_e: 'NON e\' una previsione su di te: e\' cio\' che e\' successo a chi si e\' trovato in questa situazione. '
          + 'Il rumore di gara non e\' un errore da correggere qui dentro — e\' la distribuzione.',
      };
    })(),
    non_verificabili: (() => {
      const righe = rientro.direttore.riepilogo.non_verificabili ?? [];
      const perCodice = new Map();
      for (const r of righe) {
        const m = String(r).match(/\b((?:FIS|GEO|REG)\d{2}(?:\/(?:FIS|GEO|REG)?\d{2})*)\b/);
        const codice = m ? m[1] : 'altro';
        if (!perCodice.has(codice)) perCodice.set(codice, { codice, voci: 0, esempio: String(r) });
        perCodice.get(codice).voci += 1;
      }
      return [...perCodice.values()];
    })(),
  };
}
