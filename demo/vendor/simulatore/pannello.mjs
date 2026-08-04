// ————————————————————————————————————————————————————————————————————————
// ARTEFATTO GENERATO — non modificare qui.
//   sorgente: simulatore/web/pannello.mjs
//   generato: simulatore/web/trasporta_formattatori.mjs
// Vercel serve demo/ come radice e non vede simulatore/: questa copia esiste solo
// per essere servita. Modificare QUESTO file lo fa divergere dall'originale, e
// `node web/trasporta_formattatori.mjs --verifica` fallisce (lo esegue la CI).
// ————————————————————————————————————————————————————————————————————————
// pannello.mjs — BOX NOW: la risposta in UNA riga, il resto sotto "perché".
//
// Non calcola niente: legge la vista prodotta da web/genera_vista.mjs (che a
// sua volta passa da scenario/ e dal Director) e la FORMATTA. Ogni quantità
// passa da `num()` con la sua targhetta: la regola 2 non è ricordata, è imposta
// dalla funzione che rifiuta un numero senza natura.
//
// La riga è una riga: posizione di rientro, e chi hai davanti e dietro. Tutto
// il resto — perdita ai box, assunzioni, orizzonte, coefficienti — sta sotto un
// "perché" espandibile. Un pannello che spara dodici numeri non risponde: si fa
// interrogare.

import { el, txt, num, creaTarghetta, NATURE } from './targhette.mjs';

const T = {
  posizione: (s) => creaTarghetta({
    natura: 'MODELLO_DICHIARATO',
    testo: `proiezione del kernel dal congelamento al giro ${s.pannello.giro_di_rientro}, con la sosta al giro ${s.freeze_lap + 1}; l'ordine è fra cum PREVISTI di tutte le auto`,
    data: s._data,
    n: s.pannello.su_quanti,
  }),
  gap: (s) => creaTarghetta({
    natura: 'MODELLO_DICHIARATO',
    testo: 'differenza fra i cumulati previsti al giro di rientro',
    data: s._data,
  }),
  giro: (s) => creaTarghetta({
    natura: 'MISURATO_QUESTA_GARA',
    testo: 'numero di giro osservato nel grezzo pinnato di questa gara',
    data: s._data,
  }),
  perditaBox: (s) => creaTarghetta({
    natura: 'PRIOR_ESTERNO',
    testo: s.perdita.targhetta,
    data: s._data,
  }),
  stazionario: (s) => creaTarghetta({
    natura: 'PRIOR_ESTERNO',
    testo: `stazionario tipico dichiarato dal prior (pavimento fisico ${String(s.stazionario_pavimento_s).replace('.', ',')} s): il grezzo per-giro non porta la durata reale della sosta`,
    data: s._data,
  }),
  rho: (v) => creaTarghetta({
    natura: 'MISURATO_FONDO',
    testo: v.modello.rho_targhetta,
    data: v.modello.data,
    n: v.modello.rho_n,
    banda: v.modello.rho_ic,
  }),
  delta: (v) => creaTarghetta({
    natura: 'MISURATO_FONDO',
    testo: `carburante totale su 70 kg, deciso dall'esperimento pre-registrato (braccio ${v.modello.delta_70_braccio}) contro la stima libera: vince chi sbaglia meno sul bersaglio del prodotto`,
    data: v.modello.data,
  }),
  banda: (s) => creaTarghetta({
    natura: 'MISURATO_QUESTA_GARA',
    testo: `${s.pannello.banda_posizione.targhetta}. ${s.pannello.banda_posizione.cosa_non_e}`,
    data: s._data,
    n: s.pannello.banda_posizione.copertura_fuori_campione === null ? null : undefined,
  }),
  piano: (s) => creaTarghetta({
    natura: 'MODELLO_DICHIARATO',
    testo: `piano gomme fino alla bandiera: la ricerca confronta 0…3 soste col kernel e sceglie il totale minore. ${s.piano.limite}`,
    data: s._data,
  }),
  alternative: (s) => creaTarghetta({
    natura: 'MODELLO_DICHIARATO',
    testo: 'quanto costerebbe in piu\' quel numero di soste, secondo lo stesso kernel che ha scelto il piano: '
      + 'stessa equazione per la scelta e per il confronto (regola 10). NON e\' una misura sulla gara vera, '
      + 'e non tiene conto della reazione degli avversari — nel motore i rivali non si fermano mai.',
    data: s._data,
  }),
  stint: (s) => creaTarghetta({
    natura: 'MODELLO_DICHIARATO',
    testo: 'stint PIANIFICATO, non misurato: un tratto di gara che non è ancora successo (da_dati = false)',
    data: s._data,
  }),
};

/**
 * L'OCCHIELLO — cosa si sta guardando, sopra la riga che lo risponde.
 *
 * La riga dice «Rientri P14…» e non ha mai detto che quella e' una risposta A DUE GIRI.
 * Il fatto stava dentro la targhetta del numero e dentro il contesto: due posti dove
 * bisogna gia' sapere di doverlo cercare. Ed e' l'unica cosa che il motore fa bene —
 * validata a +/-2 posizioni, copertura 88,2% fuori campione — quindi e' anche l'unica
 * che valga la pena mettere in cima. KPI P4, mock approvato dal PO il 03/08/2026.
 *
 * I giri si CONTANO, non si cablano: giro di rientro meno congelamento. Cablare un 2
 * sarebbe un numero che smette di essere vero il giorno che il rientro cambia.
 */
function occhiello(s) {
  const n = s.pannello.giro_di_rientro - s.freeze_lap;
  if (!Number.isFinite(n) || n <= 0) return null;
  return el('p', { classe: 'occhiello' },
    txt('se ti fermi ora, fra '),
    num(n, { unita: n === 1 ? 'giro' : 'giri', formato: 'intero', targhetta: T.posizione(s) }));
}

/** La riga unica: dove esci, e fra chi. */
function riga(s) {
  const pezzi = [txt('Rientri '), num(s.pannello.posizione, { formato: 'posizione', targhetta: T.posizione(s) })];
  // LA BANDA subito accanto al numero, non sotto un "perché": il P14 senza la
  // banda è la promessa che questa fase esiste per non fare più.
  const b = s.pannello.banda_posizione;
  if (b) {
    pezzi.push([
      txt(' (fra '),
      num(b.da, { formato: 'posizione', targhetta: T.banda(s) }),
      txt(' e '),
      num(b.a, { formato: 'posizione', targhetta: T.banda(s) }),
      txt(')'),
    ]);
  }
  const vicino = (v, parola) => {
    if (v === null) return null;
    if (v.gap_s === null) {
      // Gap non quantificabile: si dichiara il motivo. Mai uno zero, mai un
      // trattino muto (regola 6).
      return [txt(`, ${parola} a ${v.drv} `), num(null, {
        formato: 'secondi', targhetta: T.gap(s), motivo_soppressione: v.motivo_soppressione,
      })];
    }
    return [txt(`, ${parola} a ${v.drv} di `), num(v.gap_s, { unita: 's', formato: 'secondi', targhetta: T.gap(s) })];
  };
  pezzi.push(vicino(s.pannello.davanti, 'dietro'));
  pezzi.push(vicino(s.pannello.dietro, 'davanti'));
  return el('p', { classe: 'risposta' }, ...pezzi.flat().filter(Boolean));
}

/**
 * La banda sulla posizione: l'intervallo, e basta.
 *
 * Fino al 04/08/2026 sotto l'intervallo c'erano quattro paragrafi — copertura fuori
 * campione, frequenza naturale, avviso del cancello, «cosa non e'». Sono spariti per
 * decisione di Tommi: al lettore del sito arriva il margine (P12–P16), non il referto
 * che lo calibra. I campi restano nella vista e sono dichiarati orfani nel registro.
 */
function bandaDiRientro(s) {
  const b = s.pannello.banda_posizione;
  if (!b) return null;
  return el('div', { classe: 'banda' },
    el('p', { classe: 'nota' },
      txt('Margine sulla posizione di rientro: '),
      num(b.semi_ampiezza, { unita: 'posizioni', formato: 'intero', targhetta: T.banda(s) })));
}

/**
 * IL PIANO GOMME fino alla bandiera. Lo stint è un oggetto, e si vede: ogni
 * tratto col suo giro d'inizio, la sua durata e la sua mescola.
 *
 * Il LIMITE viaggia col piano, non in una nota in fondo: il modello non ha
 * cliff e propone sistematicamente troppo poche soste. Mostrare il piano senza
 * dirlo sarebbe la promessa che questo repo esiste per non fare.
 */
function pianoGomme(s) {
  if (!s.piano) {
    return el('div', { classe: 'piano assente' },
      txt('Piano fino alla bandiera: non disponibile per questo pilota (manca l\'età gomma al congelamento).'));
  }
  const p = s.piano;
  return el('div', { classe: 'piano' },
    el('h3', {}, txt('Piano gomme fino alla bandiera')),
    el('p', { classe: 'piano-riga' },
      txt('Soste previste '),
      num(p.k, { formato: 'intero', targhetta: T.piano(s) }),
      txt(p.k === 0 ? ' — si arriva in fondo così' : '')),
    el('ol', { classe: 'stint' },
      ...p.stint.map((st) => el('li', { classe: 'stint-voce', titolo: st.da_dati ? null : 'stint PIANIFICATO: non è una misura' },
        txt(`${st.mescola ?? 'mescola ignota'}, dal giro `),
        num(st.giro_inizio, { formato: 'intero', targhetta: T.stint(s) }),
        txt(' al '),
        num(st.giro_fine, { formato: 'intero', targhetta: T.stint(s) }),
        txt(' — '),
        num(st.giri, { unita: 'giri', formato: 'intero', targhetta: T.stint(s) })))),
    p.vincolo_regolamento
      ? el('p', { classe: 'nota vincolo' }, txt(p.vincolo_regolamento, { cifre_dichiarate: 'testo del vincolo: i numeri fanno parte della spiegazione, non sono quantità mostrate come risultato' }))
      : null,
    percheSoste(s));
}

/**
 * PERCHE' QUEL NUMERO DI SOSTE — il confronto che il motore fa e non mostrava.
 *
 * Il censimento dei campi della vista (KPI P1) ha trovato che `piano.alternative` e
 * `piano.limite_perche` erano EMESSI e letti da nessuno: il motore confronta 0, 1, 2 e 3
 * soste col kernel, ne stampa i totali, e la pagina diceva soltanto il vincitore. La
 * domanda piu' ovvia che un utente si fa davanti a «soste previste 1» — *e due?* — aveva
 * gia' la sua risposta calcolata, a un campo di distanza.
 *
 * E' anche la faccia leggibile di un esito registrato: F4 e' MANCATO perche' il piano non
 * propone mai due soste (0 gare su 2 fra quelle in cui Pirelli se le aspettava), e
 * `limite_perche` e' la ragione aritmetica per cui non le propone. Mostrare il confronto e
 * la ragione insieme e' l'unico modo onesto di dire «una sosta» a chi si aspettava due.
 *
 * STA DENTRO UN <details> CHIUSO, e non e' pigrizia: la risposta a due giri deve restare
 * l'elemento dominante del pannello (KPI P4). Questo blocco e' una spiegazione, e una
 * spiegazione che compete tipograficamente con la risposta sposta l'attenzione sulla cosa
 * su cui il motore e' meno validato.
 */
function percheSoste(s) {
  const p = s.piano;
  const alt = Array.isArray(p.alternative) ? [...p.alternative].filter((a) => Number.isFinite(a?.totale)) : [];
  if (!alt.length) return null;
  const migliore = alt.length ? Math.min(...alt.map((a) => a.totale)) : null;
  return el('details', { classe: 'perche-soste' },
    el('summary', {}, txt('Perché questo numero di soste, e non un altro')),
    alt.length
      ? el('table', { classe: 'alternative' },
        el('tr', {},
          el('th', {}, txt('soste')), el('th', {}, txt('quando')), el('th', {}, txt('costo in più')))
        , ...alt.sort((a, b) => a.k - b.k).map((a) => el('tr', { classe: a.totale === migliore ? 'scelta' : null },
          el('td', {}, num(a.k, { formato: 'intero', targhetta: T.piano(s) })),
          // OGNI GIRO PASSA DA num(): «giro 48» come stringa e' una quantita' travestita
          // da parola, e s20 la boccia — a ragione. La targhetta e' quella del piano,
          // perche' quei giri escono dalla stessa ricerca che ha scelto il vincitore.
          el('td', {}, ...(a.soste?.length
            ? a.soste.flatMap((g, j) => [
              txt(j === 0 ? 'giro ' : ', '),
              num(g, { formato: 'intero', targhetta: T.piano(s) }),
            ])
            : [txt('nessuna')])),
          el('td', {}, a.totale === migliore
            ? txt('— la scelta')
            : num(a.totale - migliore, { unita: 's', formato: 'secondi', targhetta: T.alternative(s) })))))
      : null);
}

/**
 * Le mescole: si MOSTRANO, non si scelgono. Non e' una rinuncia, e' una misura.
 *
 * Erano bottoni, e sembravano un comando. Misurato sul motore precedente:
 * cambiando la mescola dello scenario la risposta cambiava in 0 casi su 24.
 * Misurato di nuovo sul motore nuovo, su tutte le viste: mescola diversa in
 * 4.943 casi, posizione di rientro cambiata in 0. Il motivo sta nel modello —
 * nel 2026 le mescole NON separano il degrado (SOFT-HARD p = 0,209) — quindi non
 * c'era niente da far cambiare. Un bottone che si illumina e risponde sempre la
 * stessa cosa e' peggio di un bottone che non c'e': promette una leva che non esiste.
 *
 * (C'era anche un difetto piu' banale: la pagina ascoltava `data-mesc` mentre il
 * pannello emette `data-valore`, quindi il click non arrivava nemmeno. Il
 * selettore era rotto E inerte, e la seconda cosa rendeva invisibile la prima.)
 *
 * Restano tutte e cinque, con la gomma attuale evidenziata: dire su cosa sta
 * girando un pilota e' informazione vera. Torneranno bottoni quando la Fase 3
 * avra' qualcosa da dire — e allora saranno bottoni sul serio, non prima.
 */
function selettoreMescole(vista, s) {
  return el('div', { classe: 'mescole', ruolo: 'group', etichetta: 'mescole della gara' },
    ...vista.mescole.map((m) => el('span', {
      classe: `mescola sola-lettura ${m.codice === s.mescola_scelta ? 'scelta' : ''} ${m.attiva ? '' : 'spenta'}`,
      disabilitato: !m.attiva,
      titolo: m.attiva
        ? (m.codice === s.mescola_scelta ? 'gomma montata adesso' : 'mescola della stagione')
        : m.motivo,
      valore: m.codice,
    }, txt(m.codice))));
}

/** Il "perché": tutto ciò che non sta nella riga. */
function perche(vista, s) {
  const voci = [];

  voci.push(el('div', { classe: 'voce' },
    txt('Perdita ai box'),
    num(s.perdita.valore, { unita: 's', formato: 'secondi', targhetta: T.perditaBox(s) }),
    s.perdita.fattore !== 1
      ? el('span', { classe: 'nota' }, txt(`sotto ${s.regime}: frazione della perdita in verde `),
        num(s.perdita.fattore, { targhetta: T.perditaBox(s) }))
      : null));

  voci.push(el('div', { classe: 'voce' },
    txt('Fermo ai box'),
    num(s.stazionario_prior_s, { unita: 's', formato: 'secondi', targhetta: T.stazionario(s) })));

  voci.push(el('div', { classe: 'voce' },
    txt('Degrado ρ'),
    num(vista.modello.rho, { unita: 's/giro per giro', formato: 'preciso', targhetta: T.rho(vista) })));

  voci.push(el('div', { classe: 'voce' },
    txt('Carburante δ su 70 kg', { cifre_dichiarate: 'il 70 fa parte del NOME dell\'unità (δ₇₀ = secondi per 70 kg di carburante), non è una quantità riportata' }),
    num(vista.modello.delta_70, { unita: 's', formato: 'secondi', targhetta: T.delta(vista) })));

  return el('details', { classe: 'perche' }, el('summary', {}, txt('perché')), ...voci.filter(Boolean));
}

export function pannello(vista, s) {
  const scenario = { ...s, _data: vista._targhetta.data };
  if (!scenario.approvato) {
    // Il Director ha respinto: NIENTE numeri. Il motivo, e basta (regola 6).
    return el('section', { classe: 'pannello respinto' },
      el('h2', {}, txt('BOX NOW')),
      el('p', { classe: 'risposta' }, txt('Risposta non disponibile: il Director ha respinto questo scenario.')),
      el('ul', { classe: 'motivi' },
        ...(scenario.motivi_rifiuto ?? []).map((m) => el('li', {}, txt(m, { cifre_dichiarate: 'messaggio del Director: il numero fa parte della diagnosi, non è una quantità mostrata come risultato' })))));
  }
  return el('section', { classe: 'pannello' },
    el('h2', {}, txt('BOX NOW')),
    el('p', { classe: 'contesto' },
      txt(`${scenario.gara} · ${scenario.pilota} · congelato al giro `),
      num(scenario.freeze_lap, { formato: 'intero', targhetta: T.giro(scenario) }),
      txt(' di '),
      num(scenario.n_giri, { formato: 'intero', targhetta: T.giro(scenario) })),
    occhiello(scenario),
    riga(scenario),
    scenario.pannello.gap_soppressi
      ? el('p', { classe: 'soppressione' }, txt(scenario.pannello.gap_soppressi))
      : null,
    bandaDiRientro(scenario),
    selettoreMescole(vista, scenario),
    pianoGomme(scenario),
    perche(vista, scenario));
}

export { NATURE };
