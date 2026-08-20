// lingua.mjs — il sito in due lingue, con l'inglese come principale.
//
// PERCHE' L'INGLESE E' LA SORGENTE E NON UNA TRADUZIONE.
// Il testo inglese sta scritto NELL'HTML e nel primo posto di ogni voce del
// dizionario; l'italiano sta solo nel dizionario. Non e' una preferenza di stile:
// e' l'unico ordine che rende vero «la principale e' l'inglese» anche quando il
// JavaScript non gira. Un motore di ricerca, un lettore senza script, la prima
// vernice della pagina prima che i moduli partano — tutti vedono l'inglese perche'
// e' quello che c'e' scritto nel file, non perche' qualcuno lo ha sostituito in tempo.
// Se il dizionario sparisse, il sito resterebbe un sito inglese intero; se la sorgente
// fosse italiana, sparirebbe il sito.
//
// COSA NON FA. Non traduce i CONTENUTI: i dodici articoli della redazione tecnica
// restano in italiano e lo dichiarano in testa (vedi `articolo.avviso_lingua`). Qui
// dentro c'e' l'interfaccia — quello che il sito dice di se' — non quello che racconta.
// Tradurre a macchina un'analisi tecnica scritta a mano vorrebbe dire pubblicare come
// nostro un testo che nessuno ha verificato, ed e' la cosa che questo progetto non fa.
import { D } from './dizionario.mjs?v=190826f';

/* ------------------------------------------------------------------ le lingue */
export const LINGUE = {
  en: { nome: 'English',  breve: 'EN', locale: 'en-GB', og: 'en_GB', dec: '.' },
  it: { nome: 'Italiano', breve: 'IT', locale: 'it-IT', og: 'it_IT', dec: ',' },
};
export const PREDEFINITA = 'en';
const CHIAVE = 'muretto:lingua';

/** LA LINGUA NON SI INDOVINA DAL BROWSER, e la scelta e' voluta.
 *
 *  `navigator.language` sembra un'attenzione e qui sarebbe il contrario: un visitatore
 *  italiano non vedrebbe MAI la lingua principale del sito, e «principale» diventerebbe
 *  una parola senza effetto. L'ordine e' quindi: quello che dice l'indirizzo (un link
 *  condiviso porta la sua lingua con se'), poi quello che la persona ha scelto qui
 *  dentro l'ultima volta, poi l'inglese. Tre gradini, nessuno dei quali indovina.
 *
 *  `?lang=` VINCE E RESTA: chi apre un link in italiano ha davanti un sito italiano
 *  anche alla pagina dopo, dove il parametro non c'e' piu'. Senza la memoria, la
 *  seconda pagina tornerebbe inglese e la scelta sembrerebbe non aver funzionato. */
function risolvi() {
  try {
    const chiesta = new URLSearchParams(location.search).get('lang');
    if (chiesta && LINGUE[chiesta]) { ricorda(chiesta); return chiesta; }
  } catch { /* URL illeggibile: si scende al gradino dopo */ }
  try {
    const salvata = localStorage.getItem(CHIAVE);
    if (salvata && LINGUE[salvata]) return salvata;
  } catch { /* storage negato (navigazione privata, cookie bloccati) */ }
  return PREDEFINITA;
}

function ricorda(l) {
  try { localStorage.setItem(CHIAVE, l); } catch { /* niente storage: vale per questa pagina */ }
}

/** La lingua attiva. E' una costante: cambiarla ricarica la pagina (vedi `cambia`). */
export const L = risolvi();
export const ITA = L === 'it';
export const LOCALE = LINGUE[L].locale;

/* ------------------------------------------------------------------- le parole */
const mancanti = new Set();

/** Il testo di una chiave, nella lingua attiva. `{nome}` si sostituisce da `sost`.
 *
 *  UNA CHIAVE CHE NON C'E' RITORNA LA CHIAVE, e si vede. Il ripiego comodo sarebbe
 *  l'inglese, ma l'inglese non ce l'abbiamo: se la voce manca, mancano tutt'e due le
 *  lingue. Mostrare `strat.quando_fermarsi` in pagina e' brutto ed e' il punto — un
 *  buco che si nota si ripara, un buco che si traveste da testo resta li'. La
 *  sentinella (test_lingua.mjs) lo trova prima, a freddo, su tutti i sorgenti. */
export function t(chiave, sost = null) {
  const voce = D[chiave];
  if (!voce) {
    if (!mancanti.has(chiave)) { mancanti.add(chiave); console.warn('[lingua] chiave assente:', chiave); }
    return chiave;
  }
  let s = (ITA ? voce[1] : voce[0]) ?? voce[0];
  if (sost) for (const [k, v] of Object.entries(sost)) s = s.split('{' + k + '}').join(String(v));
  return s;
}

/** VOCI IN PIU', portate da chi le possiede.
 *
 *  Il dizionario e' del SITO: ci stanno le parole dell'interfaccia, che sono le stesse
 *  su ogni pagina. Un articolo invece ha parole sue — il titolo, l'occhiello, il
 *  sommario — che non appartengono a nessun'altra pagina e che nascono e muoiono con
 *  lui. Metterle nel dizionario comune vorrebbe dire far crescere di dodici voci a
 *  settimana un file che serve a tutti, e mai piu' toglierle.
 *
 *  Cosi' invece la pagina-articolo porta le sue due colonne addosso, in un blocco JSON
 *  scritto da ai_lab/redazione/statico.py, e le consegna prima che il guscio applichi la
 *  lingua. Il meccanismo che le usa resta uno solo: `data-i18n`.
 *
 *  NON SI SOVRASCRIVE UNA VOCE ESISTENTE. Se una chiave d'articolo collidesse con una
 *  del sito, il sito vincerebbe e la pagina se ne accorgerebbe subito: e' meglio di una
 *  parola dell'interfaccia che cambia significato su una pagina sola. */
export function aggiungi(voci) {
  for (const [k, v] of Object.entries(voci || {})) {
    if (Array.isArray(v) && v.length === 2 && !(k in D)) D[k] = v;
  }
}

/** C'e' una voce per questa chiave? Serve a chi ha chiavi costruite da un dato
 *  (`'mescola.' + sigla`): il dato puo' portare una sigla che non abbiamo, e in quel
 *  caso si mostra la sigla com'e' invece della chiave grezza. */
export const esiste = (chiave) => Object.prototype.hasOwnProperty.call(D, chiave);

/** Il plurale delle due lingue che ci servono: nessuna delle due ha casi speciali. */
export function tn(chiaveUno, chiaveTanti, n, sost = null) {
  return t(n === 1 ? chiaveUno : chiaveTanti, { n, ...(sost || {}) });
}

/* --------------------------------------------------------- il testo gia' scritto */
//
// Le pagine portano il loro inglese nell'HTML e una chiave accanto. `applica()` non
// aggiunge testo: lo SOSTITUISCE quando la lingua attiva non e' quella scritta nel file.
// In inglese quindi non tocca niente — zero lavoro, zero sfarfallio, e una pagina che
// resta identica anche se questo modulo non parte.
//
//   data-i18n="chiave"            -> il testo del nodo
//   data-i18n-html="chiave"       -> il contenuto del nodo, con il suo markup
//   data-i18n-attr="attr:chiave"  -> uno o piu' attributi, separati da ';'
//                                    (title, aria-label, placeholder, content, alt…)
export function applica(radice = document) {
  document.documentElement.lang = L;
  if (!ITA) return;                       // l'inglese e' gia' quello scritto nel file
  for (const n of radice.querySelectorAll('[data-i18n]')) n.textContent = t(n.dataset.i18n);
  for (const n of radice.querySelectorAll('[data-i18n-html]')) n.innerHTML = t(n.dataset.i18nHtml);
  for (const n of radice.querySelectorAll('[data-i18n-attr]')) {
    for (const coppia of n.dataset.i18nAttr.split(';')) {
      const i = coppia.indexOf(':');
      if (i < 0) continue;
      n.setAttribute(coppia.slice(0, i).trim(), t(coppia.slice(i + 1).trim()));
    }
  }
}

/* ----------------------------------------------------------------- il selettore */
//
// IL DISEGNO DEL SELETTORE STA IN muro.mjs, non qui, e non e' un dettaglio di
// spartizione: il selettore e' un pezzo del GUSCIO — vive nella barra, riusa la tendina
// che la barra ha gia' — e il guscio lo monta muro.mjs. Qui resta la lingua: come si
// decide qual e', come si cambia, come si scrive una parola. Questo modulo non conosce
// il DOM del sito, e per questo puo' essere importato da chiunque senza girare in tondo.

/** Cambiare lingua RICARICA la pagina, ed e' una scelta, non una pigrizia.
 *
 *  Meta' di quello che si legge qui dentro non sta nell'HTML: lo scrivono i moduli
 *  mentre girano — la classifica, il pannello strategia, il verdetto del motore.
 *  Riscrivere solo i nodi marcati lascerebbe una pagina meta' inglese e meta' italiana,
 *  e la meta' vecchia sarebbe proprio quella che porta i numeri. Ricaricare costa un
 *  istante e non lascia niente indietro. Lo stato che conta vive nell'indirizzo
 *  (`?g=`, `?p=`…), quindi la ricarica torna dov'eri. */
export function cambia(l) {
  if (!LINGUE[l] || l === L) return;
  ricorda(l);
  const u = new URL(location.href);
  if (l === PREDEFINITA) u.searchParams.delete('lang'); else u.searchParams.set('lang', l);
  location.replace(u.toString());
}

/* -------------------------------------------------------------------- i formati */

/** Il separatore decimale della lingua attiva: «0,6» in italiano, «0.6» in inglese.
 *  Non e' un vezzo tipografico — «1,250» letto da un inglese e' mille volte il numero
 *  che volevamo dire. */
export const VIRGOLA = LINGUE[L].dec;
export const decimale = (s) => (VIRGOLA === ',' ? String(s).replace('.', ',') : String(s));
