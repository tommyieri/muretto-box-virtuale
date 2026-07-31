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
  stint: (s) => creaTarghetta({
    natura: 'MODELLO_DICHIARATO',
    testo: 'stint PIANIFICATO, non misurato: un tratto di gara che non è ancora successo (da_dati = false)',
    data: s._data,
  }),
  orizzonte: (v) => creaTarghetta({
    natura: 'MODELLO_DICHIARATO',
    testo: 'orizzonte oltre il quale il modello NON è validato: il bias resta sotto la soglia solo fino a qui',
    data: v.modello.data,
  }),
};

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
 * La banda sulla posizione, spiegata. Dice due cose, e la seconda conta quanto
 * la prima: quanto può sbagliare il numero, e che NON è una previsione su chi
 * supererà chi. Se il circuito è fra quelli dove la banda copre meno del livello
 * dichiarato, lo si dice qui — non in un README.
 */
function bandaDiRientro(s) {
  const b = s.pannello.banda_posizione;
  if (!b) {
    return el('p', { classe: 'nota banda assente' },
      txt('Banda sulla posizione: non disponibile per questo scenario.'));
  }
  return el('div', { classe: 'banda' },
    el('p', { classe: 'nota' },
      txt(`Incertezza sulla posizione, misurata sulle soste vere del 2026 (contesto ${b.contesto}): `,
        { cifre_dichiarate: 'il 2026 è la stagione da cui viene la calibrazione, non una quantità mostrata come risultato' }),
      num(b.semi_ampiezza, { unita: 'posizioni', formato: 'intero', targhetta: T.banda(s) }),
      txt(' — copre il '),
      num(b.copertura_fuori_campione * 100, { unita: '%', formato: 'secondi', targhetta: T.banda(s) }),
      txt(' dei casi fuori campione')),
    b.circuito_sotto_livello
      ? el('p', { classe: 'nota allarme' },
        txt(`Su questo circuito la banda copre MENO del livello dichiarato: `),
        num(b.circuito_sotto_livello.copertura * 100, { unita: '%', formato: 'secondi', targhetta: T.banda(s) }),
        txt(' su '),
        num(b.circuito_sotto_livello.n_casi, { unita: 'soste', formato: 'intero', targhetta: T.banda(s) }),
        txt(' — dove non si sorpassa, le posizioni reali sono più appiccicate di quanto un motore in cui le auto si attraversano possa prevedere'))
      : null,
    el('p', { classe: 'nota limite' }, txt(b.cosa_non_e,
      { cifre_dichiarate: 'il 2026 è la stagione in cui il DRS non esiste (regolamento), non una quantità mostrata come risultato' })));
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
    // gli ALLARMI: dichiarati come tali, mai come limiti fisici
    ...p.allarmi.map((a) => el('p', { classe: 'nota allarme', titolo: a.targhetta },
      txt(a.descrizione, { cifre_dichiarate: 'allarme: i numeri sono quelli del confronto col 2026, riportati nel testo dell\'allarme e spiegati dalla targhetta' }))),
    el('p', { classe: 'nota limite' }, txt(p.limite)));
}

/** Il selettore mescola: Wet VISIBILE ma spento, con targhetta. */
function selettoreMescole(vista, s) {
  return el('div', { classe: 'mescole', ruolo: 'group', etichetta: 'mescola da montare' },
    ...vista.mescole.map((m) => el('button', {
      classe: `mescola ${m.codice === s.mescola_scelta ? 'scelta' : ''} ${m.attiva ? '' : 'spenta'}`,
      disabilitato: !m.attiva,
      titolo: m.attiva ? null : m.motivo,
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

  if (s.orizzonte) {
    voci.push(el('div', { classe: 'voce' },
      txt('Orizzonte validato del modello'),
      num(s.orizzonte.orizzonte_validato, { unita: 'giri', formato: 'intero', targhetta: T.orizzonte(vista) }),
      s.orizzonte.oltre_il_validato
        ? el('span', { classe: 'nota allarme' },
          txt('questa curva proietta oltre: '),
          num(s.orizzonte.steps, { unita: 'giri', formato: 'intero', targhetta: T.orizzonte(vista) }))
        : null));
  }

  // ASSUNZIONI: dichiarate, col conteggio. Un'assunzione che non si vede è
  // un'assunzione che nessuno può contestare.
  if (s.assunzioni.length > 0) {
    voci.push(el('div', { classe: 'assunzioni' },
      el('h3', {}, txt('Assunzioni dichiarate')),
      ...s.assunzioni.map((a) => el('div', { classe: 'assunzione', titolo: a.targhetta },
        txt(`${a.codice}: ${a.descrizione.replace(/\d+/g, '·')}`, { cifre_dichiarate: 'i numeri della descrizione sono sostituiti: il conteggio esce come quantità con targhetta' }),
        num(a.conteggio, {
          formato: 'intero',
          targhetta: creaTarghetta({ natura: 'MODELLO_DICHIARATO', testo: `quante volte questa assunzione è stata applicata — ${a.targhetta}`, data: s._data }),
        })))));
  }

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
