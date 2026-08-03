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
  orizzonteRisposta: (v) => creaTarghetta({
    natura: 'MISURATO_FONDO',
    testo: 'oltre questo orizzonte la RISPOSTA del motore non è validata: è l\'ultimo punto in cui batte SIA il «non cambia niente» SIA il «sei ai box, e ci resti» — i due sbagliano in verso opposto, quindi batterne uno solo non basterebbe. Margine sottile sul primo (p = 0,0368); referto ai_lab/REGISTRO_F1.md',
    data: v.modello.data,
  }),
  orizzonte: (v) => creaTarghetta({
    natura: 'MODELLO_DICHIARATO',
    testo: 'orizzonte oltre il quale il MODELLO DEL PASSO non è validato: il bias del carburante resta sotto la soglia solo fino a qui',
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
    // L'AVVISO PRIMA DEI NUMERI, quando c'è.
    //
    // `avviso_livello` è valorizzato in 1.118 pannelli e nessuno lo leggeva: la
    // banda mostrava «copre il 78,6%» senza dire che il livello pre-registrato
    // era l'80% e che il cancello è ROSSO. Il posto non è una nota in fondo:
    // quando l'intervallo da solo inganna, l'avviso deve precederlo, altrimenti
    // il lettore ha già preso il numero per buono prima di arrivare alla
    // riserva. È lo stesso motivo per cui la nota `circuito_sotto_livello` qui
    // sotto esiste — questa è la sua metà mancante, sul cancello generale.
    b.avviso_livello
      ? el('p', { classe: 'nota allarme avviso-livello' }, txt(b.avviso_livello, {
        cifre_dichiarate: 'avviso del cancello: le percentuali citate sono quelle del referto che spiega perché la banda non raggiunge il livello, non quantità calcolate per questo scenario',
      }))
      : null,
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
        ? (m.codice === s.mescola_scelta
          ? 'gomma montata adesso. Nel 2026 le mescole non separano il degrado (p = 0,209): cambiarla non sposterebbe la risposta, quindi qui si mostra e non si sceglie'
          : 'mescola della stagione — non selezionabile: nel 2026 le mescole non separano il degrado (p = 0,209)')
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

  if (s.orizzonte) {
    // DUE ORIZZONTI, e l'ordine non è estetico: viene PRIMA quello della RISPOSTA,
    // perché è la domanda a cui l'utente sta guardando la risposta.
    //
    // Fino al 03/08/2026 il pannello mostrava solo quello del PASSO (10 giri, da δ₇₀), e
    // chi leggeva ne deduceva che fino a lì la risposta fosse buona. È falso fra 7 e 10
    // giri: lì il motore non batte più il non-fare-niente. Referto ai_lab/REGISTRO_F1.md.
    if (typeof s.orizzonte.orizzonte_risposta === 'number') {
      voci.push(el('div', { classe: 'voce' },
        txt('Fin dove la risposta è validata'),
        num(s.orizzonte.orizzonte_risposta, { unita: 'giri', formato: 'intero', targhetta: T.orizzonteRisposta(vista) }),
        s.orizzonte.oltre_la_risposta
          ? el('span', { classe: 'nota allarme' },
            txt('questa proiezione va più lontano: '),
            num(s.orizzonte.steps, { unita: 'giri', formato: 'intero', targhetta: T.orizzonteRisposta(vista) }))
          : null));
    }

    voci.push(el('div', { classe: 'voce' },
      txt('Orizzonte validato del passo'),
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
