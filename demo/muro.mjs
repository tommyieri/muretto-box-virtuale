// muro.mjs — il minimo comune del sito nuovo: guscio, dati, formati.
//
// Regola: qui dentro non entra NIENTE che sappia di una pagina sola. Se una
// funzione serve a un posto solo, sta in quel posto.

import { t, tn, esiste, applica, cambia, LINGUE, L, LOCALE, VIRGOLA } from './lingua.mjs?v=190826f';
export { t, tn, applica, aggiungi, L, ITA, LOCALE } from './lingua.mjs?v=190826f';

export const V = '190826f';                      // targhetta di cache

/* ------------------------------------------------------------------ DOM */
export const $  = (s, r = document) => r.querySelector(s);
export const $$ = (s, r = document) => [...r.querySelectorAll(s)];

/** Gli argomenti veri, senza i null: replaceChildren(null) scrive "null" in pagina. */
export const veri = (...xs) => xs.flat().filter(x => x != null && x !== false);

export function el(tag, attr = {}, ...figli) {
  const n = document.createElementNS(
    tag === 'svg' || tag === 'path' || tag === 'g' || tag === 'circle' ||
    tag === 'rect' || tag === 'line' || tag === 'text' || tag === 'polyline'
      ? 'http://www.w3.org/2000/svg' : 'http://www.w3.org/1999/xhtml', tag);
  for (const [k, v] of Object.entries(attr)) {
    if (v == null || v === false) continue;
    if (k === 'class') n.setAttribute('class', v);
    else if (k === 'html') n.innerHTML = v;
    else if (k === 'testo') n.textContent = v;
    // le proprieta' personalizzate (--c) NON si scrivono con Object.assign:
    // style['--c'] = x non fa nulla e il colore squadra restava grigio.
    else if (k === 'stile') {
      for (const [p, val] of Object.entries(v)) {
        if (p.startsWith('--')) n.style.setProperty(p, val); else n.style[p] = val;
      }
    }
    else if (k.startsWith('on')) n.addEventListener(k.slice(2), v);
    else n.setAttribute(k, v === true ? '' : v);
  }
  for (const f of figli.flat()) {
    if (f == null || f === false) continue;
    n.append(f.nodeType ? f : document.createTextNode(f));
  }
  return n;
}

/* ----------------------------------------------------------------- dati */
const memoria = new Map();

/** Un JSON, una volta sola per pagina. Ritorna null se non c'e' (mai eccezione).
 *
 *  IL FALLIMENTO NON SI TIENE IN CACHE. Prima la promessa andava in `memoria` anche
 *  quando la fetch falliva, e quella promessa valeva null per sempre: il bottone
 *  «Riprova» ri-chiamava boot(), boot() ri-chiamava dati(), e dati() restituiva il null
 *  di prima. Il riquadro di guasto ricompariva identico, all'infinito, su tre pagine.
 *  Un rimedio che non puo' funzionare e' peggio di nessun rimedio: promette.
 *  La voce resta per tutta la durata della richiesta — cosi' due chiamanti simultanei
 *  continuano a condividerla — e sparisce appena si sa che non ha portato niente. */
export async function dati(url) {
  if (memoria.has(url)) return memoria.get(url);
  const p = fetch(url)
    .then(r => (r.ok ? r.json() : null))
    .catch(() => null)
    .then((v) => { if (v == null) memoria.delete(url); return v; });
  memoria.set(url, p);
  return p;
}

/** Come dati(), ma l'assenza e' un guasto: chi chiama vuole saperlo. */
export async function datiObbligatori(url) {
  const d = await dati(url);
  if (d == null) throw new Error(t('muro.non_raggiungibile', { url }));
  return d;
}

export function guasto(nodo, riprova) {
  nodo.replaceChildren(el('div', { class: 'guasto' },
    el('p', { testo: t('muro.guasto') }),
    riprova && el('button', { class: 'btn btn-s', onclick: riprova }, t('muro.riprova'))));
}

export function scheletro(nodo, righe = 5, h = 44) {
  nodo.replaceChildren(...Array.from({ length: righe }, (_, i) =>
    el('div', { class: 'scheletro', stile: { height: h + 'px', marginBottom: '8px', opacity: 1 - i * .12 } })));
}

/* -------------------------------------------------------------- formati */
export const nbsp = ' ';

/** 88.123 -> "1:28.123"; 68.4 -> "1:08.400" */
export function tempo(s, dec = 3) {
  if (s == null || !isFinite(s)) return '—';
  const seg = s < 0 ? '-' : ''; s = Math.abs(s);
  const m = Math.floor(s / 60), r = s - m * 60;
  return m ? `${seg}${m}:${r.toFixed(dec).padStart(dec + 3, '0')}` : `${seg}${r.toFixed(dec)}`;
}

/** IL SEPARATORE DECIMALE NON E' TIPOGRAFIA, E' IL NUMERO.
 *
 *  Fino al 19/08/2026 queste due funzioni scrivevano SEMPRE la virgola, perche' il sito
 *  aveva una lingua sola. In inglese «1,250» non e' uno e due e mezzo: e' milleduecento
 *  cinquanta. Un pit-loss di «20,80 s» diventerebbe venti secondi e ottanta centesimi
 *  letto da noi e ventimila e ottocento letto da un inglese — lo stesso carattere, due
 *  ordini di grandezza. Il punto lo mette la lingua, non l'autore della riga. */
export function delta(s, dec = 3) {
  if (s == null || !isFinite(s)) return '—';
  return (s >= 0 ? '+' : '−') + Math.abs(s).toFixed(dec).replace('.', VIRGOLA);
}

export function nnum(x, dec = 1) {
  if (x == null || !isFinite(x)) return '—';
  return x.toFixed(dec).replace('.', VIRGOLA);
}

/** La data nella lingua attiva. SI CHIAMAVA `dataLoc` e il nome era diventato falso il
 *  giorno in cui il sito ha avuto due lingue: un attrezzo che dice «It» e restituisce
 *  «19 August 2026» mente a chi legge la riga che lo chiama. */
export function dataLoc(iso, opz = { day: 'numeric', month: 'long', year: 'numeric' }) {
  if (!iso) return '';
  return new Date(iso + (iso.length === 10 ? 'T12:00:00' : '')).toLocaleDateString(LOCALE, opz);
}

/** Il nome lungo della mescola: «soft»/«morbida». La SIGLA non si traduce mai. */
export function mescola(sigla) {
  if (!sigla) return '';
  const k = 'mescola.' + String(sigla).toUpperCase();
  return esiste(k) ? t(k) : String(sigla).toLowerCase();
}

/* --------------------------------------------------- i nomi dei Gran Premi */
//
// LA CHIAVE E' IL NOME ITALIANO, e in un dizionario che ha l'inglese come sorgente
// sembra un errore. Non lo e': qui la sorgente non e' una pagina che abbiamo scritto,
// e' un ARTEFATTO — demo/data/calendario_2026.json e demo/data/analisi_articoli.json —
// e quell'artefatto porta scritto «Ungheria». Inventare una chiave nuova avrebbe
// voluto dire mantenere a mano una seconda tabella (nome italiano -> chiave) che
// nessuno sorveglia e che si rompe silenziosamente al primo Gran Premio nuovo.
// Cosi' invece il dato entra e o trova la sua riga, o esce com'e': un GP che manca
// resta col suo nome italiano — leggibile, e visibile a chi guarda.
//
// I nomi dei CIRCUITI non si traducono: «Hungaroring» e «Circuit Gilles Villeneuve»
// sono nomi propri e sono gia' gli stessi in tutte le lingue.
export function gpNome(nome) {
  const k = 'gp.' + nome;
  return nome && esiste(k) ? t(k) : (nome || '');
}
export function gpTitolo(titolo, nome) {
  const k = 'gpt.' + (nome || titolo);
  return esiste(k) ? t(k) : (titolo || nome || '');
}

/* ------------------------------------------------- identita' dei piloti */
let _teams = null, _colori = null, _schede = null;

export async function identita() {
  if (_teams) return { teams: _teams, colori: _colori, schede: _schede };
  const [tm, c, s] = await Promise.all([
    dati(`data/teams.json?v=${V}`),
    dati(`team_colori.json?v=${V}`),
    dati(`data/schede_2026.json?v=${V}`),
  ]);
  _teams = tm || {}; _colori = c || {}; _schede = s || null;
  return { teams: _teams, colori: _colori, schede: _schede };
}

// I due file non chiamano le squadre allo stesso modo: data/teams.json dice
// "Haas", team_colori.json "Haas F1 Team". Un alias, non un colore inventato.
const ALIAS = { 'Haas': 'Haas F1 Team', 'Haas F1 Team': 'Haas', 'Red Bull': 'Red Bull Racing' };
export function coloreDi(team, colori = _colori) {
  if (!colori || !team) return '#8A93A3';
  return colori[team] || colori[ALIAS[team]] || '#8A93A3';
}

/** Cognome leggibile dalla sigla, quando le schede ci sono. */
export function nomeDi(sigla, schede = _schede) {
  const p = schede && Object.values(schede.piloti || {}).find(x => x.sigla === sigla);
  return p?.nome || sigla;
}

export function numeroDi(sigla, schede = _schede) {
  const p = schede && Object.values(schede.piloti || {}).find(x => x.sigla === sigla);
  return p?.numero ?? '';
}

/* ------------------------------------------------------------- il guscio */
// PERCORSI DALLA RADICE, non relativi. Le dodici pagine in demo/articolo/ chiamano
// questo stesso guscio: con href relativi il browser risolveva 'stagione.html' in
// /articolo/stagione.html — nav e marchio a 404 su tutte e dodici, in produzione.
//
// UNA VOCE PUO' AVERE SOTTOVOCI: Analisi non e' una pagina, e' un cassetto che
// contiene Articoli e Telemetria. La voce col cassetto non ha un indirizzo suo —
// aprirla NON deve portare da nessuna parte, deve mostrare le due scelte.
//
// LE ETICHETTE QUI SONO IN INGLESE PERCHE' L'INGLESE E' LA SORGENTE, e non sono il testo
// che finisce in pagina: la voce si scrive con `t('nav.' + etichetta.toLowerCase())`, e
// l'etichetta fa da nome della chiave. Non e' una scorciatoia — e' l'unico modo di
// tradurre la nav SENZA cambiare la forma di questa costante, che tre file sorvegliano
// (demo/test_stat.mjs la confronta con REGISTRO_SEZIONE.json::nav_attesa e con
// ai_lab/redazione/statico.py::NAV). Una chiave al posto dell'etichetta avrebbe reso
// illeggibile il registro e muto il controllo.
const VOCI = [
  ['Season',       '/stagione.html'],
  ['Live',         '/live.html'],
  ['Analysis',     null, [['Articles', '/analisi.html'], ['Telemetry', '/telemetria.html']]],
  ['Championship', '/campionato.html'],
];
const voce = (etichetta) => t('nav.' + etichetta.toLowerCase());
const foglio = (h) => (h || '').replace(/^\//, '');

/** Intestazione + piede, scritti da un posto solo. `qui` = file corrente. */
export function guscio(qui) {
  const barra = $('.barra'), piede = $('.piede-in');

  // la voce attiva: anche quando sei dentro una sottovoce, il cassetto si accende
  const attiva = ([, href, sotto]) =>
    foglio(href) === qui || (sotto || []).some(([, h]) => foglio(h) === qui);

  if (barra) {
    barra.replaceChildren(
      el('a', { class: 'marchio', href: '/index.html', 'aria-label': t('guscio.home') },
        el('span', { class: 'marchio-b' }, 'M'),
        el('span', { class: 'marchio-t' }, el('b', {}, 'MURETTO'), el('small', {}, 'BOX VIRTUALE'))),
      el('nav', { class: 'menu', 'aria-label': t('guscio.sezioni') },
        VOCI.map((v) => (v[2] ? cassetto(v, qui) : voceSemplice(v, qui, attiva)))),
      // IL SELETTORE STA IN FONDO ALLA BARRA, dopo le sezioni e staccato da un filo.
      // La posizione dice cosa e': la nav elenca quello che il sito racconta, questa e'
      // un'impostazione di CHI legge, e le impostazioni stanno all'estremita'. E' anche
      // il posto dove chi arriva su un sito straniero va a cercarla per abitudine, il
      // che vale piu' di qualunque nostra invenzione. Non entra in <nav>: non e' una
      // destinazione, e un lettore di schermo che elenca le sezioni non deve trovarci
      // dentro due bottoni che non portano da nessuna parte.
      selettoreLingua('barra'));
  }
  if (piede) {
    const piatte = VOCI.flatMap(([n, h, sotto]) => sotto ? sotto : [[n, h]]);
    piede.replaceChildren(
      el('span', { class: 'marchio' },
        el('span', { class: 'marchio-b' }, 'M'),
        el('span', { class: 'marchio-t' }, el('b', {}, 'MURETTO'), el('small', {}, t('guscio.piede_sott')))),
      el('nav', {},
        piatte.map(([n, f]) => el('a', { href: f }, voce(n))),
        // LA SEGNALAZIONE STA NEL PIEDE DI OGNI PAGINA, e NON in VOCI: la barra in alto e'
        // il sommario di cosa il sito racconta, e questa non e' una sezione da leggere —
        // e' la porta di servizio. Nel piede pero' ci deve stare ovunque, perche' il
        // difetto lo si trova mentre si guarda un'altra cosa.
        //
        // `?da=` PORTA LA PAGINA DI PARTENZA, ed e' l'unico pezzo di contesto che si puo'
        // raccogliere senza chiederlo: chi segnala descrive quasi sempre il difetto e
        // quasi mai dove stava. Passa il nome del file e nient'altro — nessun parametro
        // della pagina, che potrebbe portarsi dietro scelte fatte da chi legge.
        el('a', {
          class: 'segnala',
          href: '/feedback.html' + (qui ? `?da=${encodeURIComponent(qui)}` : ''),
        }, t('guscio.segnala')),
        // IL SECONDO SELETTORE, in fondo alla pagina. Non e' un doppione inutile: sulla
        // barra la scelta si vede appena si arriva, qui si ritrova senza risalire — e
        // chi scorre fino in fondo e' spesso proprio chi non ha capito la pagina.
        selettoreLingua('piede')),
      el('small', {}, t('guscio.piede_riga')));
  }
  applica();          // il testo gia' scritto nelle pagine, nella lingua attiva
  graficiLeggibili();
}

/** I GRAFICI DEGLI ARTICOLI, LARGHI QUANTO SONO STATI DISEGNATI.
 *
 *  Sono SVG con viewBox e width:100%: dentro una colonna da 309 px un disegno pensato
 *  per 760 si riduce a scala 0,4 — assi, etichette e numeri con lui, sotto i sette pixel.
 *  Il contenitore ha gia' overflow-x, mancava dire al disegno di non rimpicciolirsi.
 *  La larghezza giusta la sa solo il disegno (il viewBox), e il CSS non la puo' leggere:
 *  per questo sta qui e non in muro.css. Il tetto a 900 evita che un grafico molto largo
 *  chieda uno scorrimento infinito. */
function graficiLeggibili() {
  for (const svg of document.querySelectorAll('.art-svg-wrap svg[viewBox]')) {
    const largo = parseFloat((svg.getAttribute('viewBox') || '').split(/[\s,]+/)[2]);
    if (!Number.isFinite(largo) || largo <= 0) continue;
    svg.style.minWidth = Math.min(900, Math.round(largo)) + 'px';
  }
}

function voceSemplice([n, f], qui, attiva) {
  return el('a', {
    href: f, 'aria-current': attiva([n, f]) ? 'page' : null,
  }, foglio(f) === 'live.html' ? el('span', { class: 'pallino', id: 'pallinoLive' }) : null, voce(n));
}

/** Una voce con le sue sottovoci: bottone + tendina. */
function cassetto([nome, , sotto], qui) {
  const dentro = sotto.some(([, h]) => foglio(h) === qui);
  const id = 'sotto-' + nome.toLowerCase();
  const lista = el('div', { class: 'tendina', id, role: 'menu' },
    sotto.map(([n, h]) => el('a', {
      href: h, role: 'menuitem', 'aria-current': foglio(h) === qui ? 'page' : null,
    }, voce(n))));

  const bottone = el('button', {
    class: 'apri', type: 'button', 'aria-expanded': 'false', 'aria-controls': id,
    'aria-current': dentro ? 'true' : null,
  }, voce(nome), el('span', { class: 'freccia', 'aria-hidden': 'true' }));

  const box = el('div', { class: 'voce' }, bottone, lista);
  comportamentoTendina(box, bottone, lista);
  return box;
}

/** APRI/CHIUDI DI UNA TENDINA, in un posto solo.
 *
 *  Era scritto dentro cassetto() e ci sarebbe rimasto, se il selettore di lingua non
 *  avesse avuto bisogno esattamente delle stesse sei attenzioni: il click che non
 *  risale, il passaggio del mouse solo dove c'e' un mouse vero, Escape che riporta il
 *  fuoco sul bottone, la freccia giu' che entra nella lista, il fuoco che esce e chiude,
 *  il click fuori che chiude. Ricopiarle e' il modo di perderne una: la seconda copia
 *  nasce completa e poi una delle due riceve una correzione che l'altra non vede. */
function comportamentoTendina(box, bottone, lista) {
  const apri = (v) => {
    box.classList.toggle('aperta', v);
    bottone.setAttribute('aria-expanded', String(v));
  };
  bottone.addEventListener('click', (e) => {
    e.stopPropagation();
    apri(bottone.getAttribute('aria-expanded') !== 'true');
  });
  // col mouse basta passarci sopra; col dito e con la tastiera serve il click
  if (window.matchMedia('(hover: hover) and (pointer: fine)').matches) {
    box.addEventListener('pointerenter', () => apri(true));
    box.addEventListener('pointerleave', () => apri(false));
  }
  box.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') { apri(false); bottone.focus(); }
    if (e.key === 'ArrowDown' && document.activeElement === bottone) {
      e.preventDefault(); apri(true); lista.querySelector('a,button')?.focus();
    }
  });
  // il fuoco che esce dal cassetto lo chiude: senza, resta aperto alle spalle
  box.addEventListener('focusout', (e) => {
    if (!box.contains(e.relatedTarget)) apri(false);
  });
  document.addEventListener('click', (e) => { if (!box.contains(e.target)) apri(false); });
  return apri;
}

/* ------------------------------------------------------ il selettore di lingua */
//
// DOVE STA: in fondo alla barra, dopo le sezioni, separato da un filo verticale. La nav
// elenca quello che il sito racconta; questa e' un'impostazione di chi legge, e le
// impostazioni stanno all'estremita' — che e' anche l'angolo dove chi apre un sito in
// una lingua non sua va a cercarla per abitudine. Non entra dentro <nav>: non e' una
// destinazione, e un lettore di schermo che elenca le sezioni non deve trovarci dentro
// un comando che non porta da nessuna parte. Sta anche nel piede, perche' chi scorre
// fino in fondo senza aver capito la pagina non deve risalire per cambiarla.
//
// PERCHE' UN BOTTONE SOLO E NON DUE. Il primo disegno erano due sigle affiancate,
// EN | IT: si vede tutto senza toccare niente, ed e' il migliore — su uno schermo largo.
// Su 375 px non ci sta, e non e' un'opinione: marchio 32 + menu 265 + coppia 60 + spazi
// = 401 px in una barra da 375, con IT tagliato a meta' (misurato nel browser, non
// stimato). La barra era gia' al limite prima — le voci scendono a 4 px di respiro sotto
// i 380 — e le etichette inglesi sono piu' lunghe delle italiane: CHAMPIONSHIP contro
// CAMPIONATO. Restringere ancora le voci per far posto avrebbe fatto pagare a tutto il
// sito, su ogni pagina, lo spazio di un comando che si usa una volta sola. Un bottone
// costa 44 px, e la tendina che apre da alle due lingue righe da 44 px vere, che
// affiancate in barra non avrebbero mai avuto.
//
// PERCHE' IL MAPPAMONDO. Da solo, «EN» in un angolo e' un'etichetta ambigua. Il segno
// del mappamondo e' l'unica convenzione davvero condivisa per «lingua» — piu' delle
// bandiere, che dicono un PAESE e non una lingua (quale bandiera per l'inglese?) e che
// escludono chi quella lingua la parla altrove. Insieme dicono «lingua: inglese», e si
// capisce che si puo' cambiare senza dover aprire niente per scoprirlo.
const MAPPAMONDO = 'M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20zm0 0c2.5 2.5 3.8 6 3.8 10'
  + 'S14.5 19.5 12 22c-2.5-2.5-3.8-6-3.8-10S9.5 4.5 12 2zM2.4 9h19.2M2.4 15h19.2';

function selettoreLingua(dove) {
  const id = 'lingue-' + dove;
  const lista = el('div', { class: 'tendina tendina-lingue', id, role: 'menu' },
    Object.entries(LINGUE).map(([cod, info]) => el('button', {
      type: 'button', role: 'menuitemradio', lang: cod,
      class: 'lingua-voce' + (cod === L ? ' on' : ''),
      // aria-checked dice QUALE delle due e' in uso: senza, un lettore di schermo
      // annuncia due voci identiche e chi ascolta non sa dove si trova.
      'aria-checked': String(cod === L),
      onclick: () => cambia(cod),
    }, el('span', { class: 'lingua-cod', 'aria-hidden': 'true' }, info.breve), info.nome)));

  const bottone = el('button', {
    class: 'apri apri-lingua', type: 'button',
    'aria-expanded': 'false', 'aria-controls': id,
    'aria-label': t('lingua.scegli') + ': ' + LINGUE[L].nome,
  },
    el('svg', { class: 'globo', viewBox: '0 0 24 24', 'aria-hidden': 'true' },
      el('path', { d: MAPPAMONDO })),
    el('span', { class: 'lingua-ora', 'aria-hidden': 'true' }, LINGUE[L].breve),
    el('span', { class: 'freccia', 'aria-hidden': 'true' }));

  const box = el('div', { class: 'voce voce-lingua voce-lingua-' + dove }, bottone, lista);
  comportamentoTendina(box, bottone, lista);
  return box;
}

/* --------------------------------------------------- scelte nell'URL */
export function param(nome, dflt = null) {
  return new URLSearchParams(location.search).get(nome) ?? dflt;
}

export function scriviParam(coppie, sostituisci = true) {
  const u = new URL(location.href);
  for (const [k, v] of Object.entries(coppie)) {
    if (v == null) u.searchParams.delete(k); else u.searchParams.set(k, v);
  }
  history[sostituisci ? 'replaceState' : 'pushState'](null, '', u);
}

/* --------------------------------------------------------- animazione */
/** Il movimento e' consentito? In Node NO, e non e' una risposta di comodo.
 *
 *  QUESTO MODULO GIRA ANCHE FUORI DAL BROWSER. Le sentinelle del banco importano
 *  demo/ese.mjs a freddo, con `node`, per controllare i NUMERI del rigioca; da quando
 *  ese.mjs prende da qui i suoi due messaggi, `window` non c'e' e questa riga faceva
 *  cadere la verifica 10 prima ancora del primo caso. Il resto del modulo tocca il DOM
 *  solo quando lo si chiama — questa riga era l'unica a farlo al momento dell'import. */
export const MOTO = typeof window !== 'undefined'
  && !window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/** Un ciclo rAF con delta-tempo, che si ferma da solo quando la scheda è nascosta. */
export function ciclo(passo) {
  let vivo = true, prima = performance.now();
  function giro(ora) {
    if (!vivo) return;
    const dt = Math.min(0.1, (ora - prima) / 1000); prima = ora;
    passo(dt, ora);
    requestAnimationFrame(giro);
  }
  requestAnimationFrame(giro);
  return { ferma() { vivo = false; }, get vivo() { return vivo; } };
}

/** interpolazione con smorzamento esponenziale, indipendente dal frame-rate */
export function verso(attuale, bersaglio, dt, tau = .12) {
  return attuale + (bersaglio - attuale) * (1 - Math.exp(-dt / tau));
}
