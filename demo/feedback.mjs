// feedback.mjs — la pagina delle segnalazioni: raccoglie, mostra cosa parte, spedisce.
//
// TRE REGOLE, e sono tutte e tre difensive.
//
// 1. QUESTA PAGINA NON HA UN NUMERO DA PUBBLICARE, e quindi non ne inventa nessuno.
//    L'unico dato che produce e' il numero di protocollo, e quel numero lo assegna il
//    server: se il server non risponde, qui non compare NIENTE che somigli a una ricevuta.
//
// 2. IL FALLIMENTO SI DICE. Un modulo che ringrazia comunque e' peggio di un modulo
//    rotto: la persona se ne va convinta di aver segnalato, e il difetto resta. Se la
//    spedizione non riesce, la pagina lo dichiara e restituisce il testo perche' non
//    vada perso. E' la regola 6 della casa applicata a un modulo: l'assenza e' una
//    risposta, non un ripiego che somiglia a un successo.
//
// 3. L'ELENCO DEI CAMPI CHE PARTONO SI DISEGNA DA QUELLO CHE PARTE DAVVERO. Il blocco
//    «che cosa parte da qui» non e' scritto a mano nell'HTML: e' costruito dallo stesso
//    oggetto che finisce nella fetch (`corpo()`), cosi' non puo' divergere. Una promessa
//    sulla privacy mantenuta a mano diverge alla prima modifica, e nessuno se ne accorge.
import { $, el, param } from './muro.mjs?v=090826b';

const BUCA = '/api/feedback';

// I TIPI, e devono essere GLI STESSI dell'endpoint (demo/api/feedback.js::TIPI).
// Le due liste vivono in due file perche' una gira nel browser e l'altra sul server;
// che restino d'accordo lo sorveglia demo/test_feedback.mjs — un tipo aggiunto qui e
// dimenticato la' darebbe 400 a ogni invio, e solo su una pillola su cinque.
const TIPI = [
  ['rotto',     'Qualcosa non funziona'],
  ['sbagliato', 'Un numero è sbagliato'],
  ['oscuro',    'Non si capisce'],
  ['manca',     'Manca qualcosa'],
  ['idea',      'Un\'idea'],
];

const TESTO_MIN = 10;
const TESTO_MAX = 2000;

let tipoScelto = TIPI[0][0];

/* ------------------------------------------------------------------ contesto */

const pulisci = (s) => String(s).replace(/^\//, '').replace(/\.html$/, '').slice(0, 120);

/** Da dove arriva chi scrive. Il piede di ogni pagina passa `?da=`; se manca si prova
 *  il referrer, ma SOLO se e' di casa nostra: l'indirizzo da cui uno arriva da fuori e'
 *  un dato suo, non nostro, e non ha niente a che fare con la segnalazione. */
function provenienza() {
  const da = param('da');
  if (da) return pulisci(da);
  try {
    const r = document.referrer && new URL(document.referrer);
    if (r && r.origin === location.origin) return pulisci(r.pathname);
  } catch { /* referrer illeggibile: si resta senza, ed e' una risposta */ }
  return '';
}

/** Il navigatore in due parole, non l'impronta. La stringa completa dello user-agent
 *  identifica un browser fra molti; «Safari · telefono» dice quel che serve a
 *  riprodurre un difetto di resa e non basta a riconoscere nessuno. */
function navigatore() {
  const u = navigator.userAgent;
  const nome = /Edg\//.test(u) ? 'Edge'
    : /OPR\/|Opera/.test(u) ? 'Opera'
    : /Firefox\//.test(u) ? 'Firefox'
    : /Chrome\//.test(u) ? 'Chrome'
    : /Safari\//.test(u) ? 'Safari'
    : 'altro';
  const dito = matchMedia('(pointer: coarse)').matches ? 'telefono o tablet' : 'computer';
  return `${nome} · ${dito}`;
}

const schermo = () => `${window.innerWidth}×${window.innerHeight}`;

/* ------------------------------------------------------- il corpo della lettera */

/** L'unico posto in cui si decide che cosa parte. Lo legge la fetch E lo legge il
 *  blocco della trasparenza: una sorgente sola, per costruzione. */
function corpo() {
  return {
    tipo: tipoScelto,
    testo: $('#testo').value.trim(),
    dove: $('#dove').value.trim(),
    contatto: $('#contatto').value.trim(),
    schermo: schermo(),
    navigatore: navigatore(),
  };
}

const ETICHETTE = {
  tipo: 'tipo',
  dove: 'dove',
  testo: 'il tuo messaggio',
  contatto: 'email',
  schermo: 'finestra',
  navigatore: 'navigatore',
};

function disegnaTrasparenza() {
  const c = corpo();
  const nome = Object.fromEntries(TIPI);
  const reso = {
    tipo: nome[c.tipo],
    dove: c.dove || null,
    testo: c.testo ? `${c.testo.length} caratteri, come li hai scritti` : null,
    contatto: c.contatto || null,
    schermo: c.schermo,
    navigatore: c.navigatore,
  };
  $('#parte').replaceChildren(...Object.entries(ETICHETTE).flatMap(([k, eti]) => [
    el('dt', { testo: eti }),
    el('dd', { class: reso[k] ? null : 'fb-senza', testo: reso[k] ?? '— niente —' }),
  ]));
}

/* --------------------------------------------------------------------- pillole */

function disegnaTipi() {
  $('#tipi').replaceChildren(...TIPI.map(([id, eti]) => el('button', {
    type: 'button', class: 'pil', 'data-t': id,
    'aria-pressed': String(id === tipoScelto),
    onclick: () => { tipoScelto = id; disegnaTipi(); disegnaTrasparenza(); },
  }, eti)));
}

/* ---------------------------------------------------------------------- esiti */

function esitoOk(id) {
  $('#esito').replaceChildren(el('div', { class: 'fb-esito ok' },
    el('h2', {}, 'Ricevuta.'),
    el('p', {}, 'La tua segnalazione è arrivata. Il suo numero di protocollo è ',
      el('span', { class: 'fb-protocollo', testo: id }), '.'),
    el('p', { testo: 'Se hai lasciato l\'email ti rispondiamo noi; altrimenti non riceverai '
      + 'nulla — non c\'è nessuna risposta automatica, e non volevamo fingere che ci fosse.' })));
  $('#modulo').hidden = true;
  $('#esito').scrollIntoView({ behavior: 'smooth', block: 'center' });
}

/** Il guasto, senza girarci intorno: che cosa non e' successo, e come non perdere
 *  quello che hai scritto. Il bottone «copia» esiste perche' l'alternativa vera, per
 *  chi ha appena scritto dieci righe, e' chiudere la scheda e non riscriverle mai. */
function esitoKo(motivo, testo) {
  const copia = el('button', { class: 'btn btn-s fb-copia', type: 'button',
    onclick: async () => {
      try {
        await navigator.clipboard.writeText(testo);
        copia.textContent = 'Copiato';
      } catch { copia.textContent = 'Copia non riuscita: selezionalo a mano'; }
    } }, 'Copia il testo');

  $('#esito').replaceChildren(el('div', { class: 'fb-esito ko' },
    el('h2', {}, 'Non è arrivata.'),
    el('p', { testo: motivo }),
    el('p', { testo: 'Il testo è ancora nel modulo qui sotto: puoi riprovare fra un minuto. '
      + 'Se preferisci metterlo al sicuro adesso, copialo.' }),
    testo ? copia : null));
  $('#esito').scrollIntoView({ behavior: 'smooth', block: 'center' });
}

/** I motivi, tradotti. Un «HTTP 429» in faccia a un lettore non e' trasparenza: e'
 *  scaricare su di lui il lavoro di capire. */
function motivoDi(stato, detto) {
  if (stato === 429) return 'Da questa connessione sono già partite parecchie segnalazioni '
    + 'nell\'ultima ora: è il freno anti-robot. Riprova più tardi.';
  if (stato === 503) return 'La buca delle segnalazioni non è raggiungibile in questo momento '
    + '(è un problema nostro, non tuo).';
  if (stato === 400) return detto || 'Il messaggio non è stato accettato così com\'è.';
  if (stato === 0) return 'La richiesta non è nemmeno partita: può essere la rete.';
  return detto || `Il server ha risposto con un errore (${stato}).`;
}

/* ----------------------------------------------------------------------- invio */

async function manda(ev) {
  ev.preventDefault();
  const testo = $('#testo');
  const contatto = $('#contatto');

  testo.setAttribute('aria-invalid', 'false');
  contatto.setAttribute('aria-invalid', 'false');

  if (testo.value.trim().length < TESTO_MIN) {
    testo.setAttribute('aria-invalid', 'true');
    $('#stato-invio').textContent = `Scrivi almeno ${TESTO_MIN} caratteri.`;
    testo.focus();
    return;
  }
  if (contatto.value.trim() && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(contatto.value.trim())) {
    contatto.setAttribute('aria-invalid', 'true');
    $('#stato-invio').textContent = 'L\'indirizzo email non sembra valido.';
    contatto.focus();
    return;
  }

  const bottone = $('#manda');
  bottone.disabled = true;
  $('#stato-invio').textContent = 'Invio in corso…';

  const c = corpo();
  let r = null, dati = {};
  try {
    r = await fetch(BUCA, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        tipo: c.tipo,
        testo: c.testo,
        pagina: c.dove,
        contatto: c.contatto || undefined,
        schermo: c.schermo,
        navigatore: c.navigatore,
        campo_x: $('#campo_x').value,     // l'esca, vuota per chiunque non sia un robot
      }),
    });
    dati = await r.json().catch(() => ({}));
  } catch {
    bottone.disabled = false;
    $('#stato-invio').textContent = '';
    esitoKo(motivoDi(0), c.testo);
    return;
  }

  bottone.disabled = false;
  $('#stato-invio').textContent = '';

  // IL PROTOCOLLO DEVE ESSERCI. Un 2xx senza id sarebbe un successo che non possiamo
  // dimostrare, e questa pagina non annuncia ricevute che non ha in mano.
  if (r.ok && dati.id) { esitoOk(dati.id); return; }
  esitoKo(motivoDi(r.status, dati.errore), c.testo);
}

/* ----------------------------------------------------------------------- avvio */

function avvio() {
  disegnaTipi();
  $('#dove').value = provenienza();

  const conta = $('#conta'), testo = $('#testo');
  const aggiorna = () => {
    conta.textContent = `${testo.value.length} / ${TESTO_MAX}`;
    conta.classList.toggle('troppo', testo.value.length >= TESTO_MAX);
    disegnaTrasparenza();
  };
  testo.addEventListener('input', aggiorna);
  $('#dove').addEventListener('input', disegnaTrasparenza);
  $('#contatto').addEventListener('input', disegnaTrasparenza);
  // ANCHE IL RIDIMENSIONAMENTO, e non e' un dettaglio: la misura della finestra e'
  // l'unico campo che puo' cambiare senza che chi scrive tocchi niente. Se il blocco
  // lo disegnasse una volta sola, basterebbe girare il telefono perche' l'elenco
  // «che cosa parte da qui» dichiarasse un numero e ne partisse un altro — e una
  // promessa vera per sbaglio non e' una promessa. Vale anche al primo disegno: con
  // la finestra non ancora misurata dal browser qui compariva «0×0».
  addEventListener('resize', disegnaTrasparenza);
  aggiorna();

  $('#modulo').addEventListener('submit', manda);

  // SI CHIEDE ALLA BUCA SE E' APERTA, prima che qualcuno scriva. Se la funzione non e'
  // configurata (Upstash assente), promettere un invio sarebbe una bugia detta in
  // anticipo: meglio dirlo sopra il modulo, mentre c'e' ancora tempo per non scrivere.
  fetch(`${BUCA}?stato=1`)
    .then(r => r.json())
    .then(s => { if (!s.attivo) throw new Error('spenta'); })
    .catch(() => {
      $('#esito').replaceChildren(el('div', { class: 'fb-esito ko' },
        el('h2', {}, 'La buca è chiusa in questo momento.'),
        el('p', { testo: 'Il modulo qui sotto funziona, ma la ricezione delle segnalazioni '
          + 'non è raggiungibile: se scrivi adesso, il messaggio non arriverebbe. '
          + 'È un guasto nostro e lo stiamo già vedendo.' })));
    });
}

avvio();
