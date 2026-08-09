// muro.mjs — il minimo comune del sito nuovo: guscio, dati, formati.
//
// Regola: qui dentro non entra NIENTE che sappia di una pagina sola. Se una
// funzione serve a un posto solo, sta in quel posto.

export const V = '090826b';                      // targhetta di cache

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
  if (d == null) throw new Error(`dato non raggiungibile: ${url}`);
  return d;
}

export function guasto(nodo, riprova) {
  nodo.replaceChildren(el('div', { class: 'guasto' },
    el('p', { testo: 'Questi dati non sono arrivati. Può essere la rete.' }),
    riprova && el('button', { class: 'btn btn-s', onclick: riprova }, 'Riprova')));
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

/** differenze: sempre col segno, sempre virgola all'italiana */
export function delta(s, dec = 3) {
  if (s == null || !isFinite(s)) return '—';
  return (s >= 0 ? '+' : '−') + Math.abs(s).toFixed(dec).replace('.', ',');
}

export function nnum(x, dec = 1) {
  if (x == null || !isFinite(x)) return '—';
  return x.toFixed(dec).replace('.', ',');
}

export function dataIt(iso, opz = { day: 'numeric', month: 'long', year: 'numeric' }) {
  if (!iso) return '';
  return new Date(iso + (iso.length === 10 ? 'T12:00:00' : '')).toLocaleDateString('it-IT', opz);
}

export const MESCOLA_IT = {
  SOFT: 'morbida', MEDIUM: 'media', HARD: 'dura',
  INTERMEDIATE: 'intermedia', WET: 'da bagnato',
};

/* ------------------------------------------------- identita' dei piloti */
let _teams = null, _colori = null, _schede = null;

export async function identita() {
  if (_teams) return { teams: _teams, colori: _colori, schede: _schede };
  const [t, c, s] = await Promise.all([
    dati(`data/teams.json?v=${V}`),
    dati(`team_colori.json?v=${V}`),
    dati(`data/schede_2026.json?v=${V}`),
  ]);
  _teams = t || {}; _colori = c || {}; _schede = s || null;
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
const VOCI = [
  ['Stagione',   '/stagione.html'],
  ['Live',       '/live.html'],
  ['Analisi',    null, [['Articoli', '/analisi.html'], ['Telemetria', '/telemetria.html']]],
  ['Campionato', '/campionato.html'],
];
const foglio = (h) => (h || '').replace(/^\//, '');

/** Intestazione + piede, scritti da un posto solo. `qui` = file corrente. */
export function guscio(qui) {
  const barra = $('.barra'), piede = $('.piede-in');

  // la voce attiva: anche quando sei dentro una sottovoce, il cassetto si accende
  const attiva = ([, href, sotto]) =>
    foglio(href) === qui || (sotto || []).some(([, h]) => foglio(h) === qui);

  if (barra) {
    barra.replaceChildren(
      el('a', { class: 'marchio', href: '/index.html', 'aria-label': 'Muretto Box Virtuale — home' },
        el('span', { class: 'marchio-b' }, 'M'),
        el('span', { class: 'marchio-t' }, el('b', {}, 'MURETTO'), el('small', {}, 'BOX VIRTUALE'))),
      el('nav', { class: 'menu', 'aria-label': 'Sezioni' },
        VOCI.map((v) => (v[2] ? cassetto(v, qui) : voceSemplice(v, qui, attiva)))));
  }
  if (piede) {
    const piatte = VOCI.flatMap(([n, h, sotto]) => sotto ? sotto : [[n, h]]);
    piede.replaceChildren(
      el('span', { class: 'marchio' },
        el('span', { class: 'marchio-b' }, 'M'),
        el('span', { class: 'marchio-t' }, el('b', {}, 'MURETTO'), el('small', {}, 'STAGIONE 2026'))),
      el('nav', {}, piatte.map(([n, f]) => el('a', { href: f }, n))),
      el('small', {}, 'Formula 1 2026 · replay, strategia e telemetria'));
  }
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
  }, foglio(f) === 'live.html' ? el('span', { class: 'pallino', id: 'pallinoLive' }) : null, n);
}

/** Una voce con le sue sottovoci: bottone + tendina. */
function cassetto([nome, , sotto], qui) {
  const dentro = sotto.some(([, h]) => foglio(h) === qui);
  const id = 'sotto-' + nome.toLowerCase();
  const lista = el('div', { class: 'tendina', id, role: 'menu' },
    sotto.map(([n, h]) => el('a', {
      href: h, role: 'menuitem', 'aria-current': foglio(h) === qui ? 'page' : null,
    }, n)));

  const bottone = el('button', {
    class: 'apri', type: 'button', 'aria-expanded': 'false', 'aria-controls': id,
    'aria-current': dentro ? 'true' : null,
  }, nome, el('span', { class: 'freccia', 'aria-hidden': 'true' }));

  const box = el('div', { class: 'voce' }, bottone, lista);

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
      e.preventDefault(); apri(true); lista.querySelector('a')?.focus();
    }
  });
  // il fuoco che esce dal cassetto lo chiude: senza, resta aperto alle spalle
  box.addEventListener('focusout', (e) => {
    if (!box.contains(e.relatedTarget)) apri(false);
  });
  document.addEventListener('click', (e) => { if (!box.contains(e.target)) apri(false); });
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
export const MOTO = !window.matchMedia('(prefers-reduced-motion: reduce)').matches;

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
