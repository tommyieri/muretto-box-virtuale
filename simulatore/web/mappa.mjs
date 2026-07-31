// mappa.mjs — la mappa che NON SI SPEGNE MAI.
//
// Due strati, sempre entrambi presenti:
//   REALE     — dove le auto sono andate davvero (dal grezzo pinnato);
//   FANTASMA  — la proiezione, disegnata SOPRA il reale, mai al posto suo.
//
// Il fantasma è uno strato COMPLETO (tutte le auto), non solo la mia. È una
// scelta di correttezza, non di stile: il pannello ordina la mia auto fra cum
// PREVISTI di tutte le auto, quindi una mappa che mostrasse i rivali al reale e
// me proiettato darebbe un ordine diverso da quello del pannello — cioè
// l'animazione contraddirebbe il numero, che è esattamente ciò che l'invariante
// vieta.
//
// LA SOSTA SI VEDE: al giro di ingresso il pallino entra in corsia e ci resta
// per il tempo dello stazionario, che è un PRIOR dichiarato (il grezzo per-giro
// non porta la durata reale della sosta).
//
// INVARIANTE (il 377/377 del vecchio repo, rinato): `ordineFantasma` calcolato
// qui, al giro di rientro, deve dare per il mio pilota la stessa posizione che
// dichiara il pannello. Le due strade sono diverse — il pannello viene dal
// kernel, questa dall'ordinamento dei punti da disegnare — e devono incontrarsi.

import { el, txt, num, creaTarghetta } from './targhette.mjs';

const LARGHEZZA = 720;
const ALTEZZA = 300;

/** Ordine di uno strato al giro dato: rango per cumulato crescente. */
export function ordineDelloStrato(scenario, giro, strato) {
  const frame = scenario.mappa.giri.find((g) => g.giro === giro);
  if (!frame) return null;
  const cum = frame[strato];
  const piloti = Object.keys(cum ?? {});
  if (piloti.length === 0) return null;
  return piloti.sort((a, b) => cum[a] - cum[b] || (a < b ? -1 : 1));
}

/** La posizione del mio pilota nello strato fantasma, al giro di rientro. */
export function posizioneDallaMappa(scenario) {
  const ordine = ordineDelloStrato(scenario, scenario.pannello.giro_di_rientro, 'fantasma');
  if (ordine === null) return null;
  const i = ordine.indexOf(scenario.pilota);
  return i < 0 ? null : i + 1;
}

/**
 * Lo stato dell'animazione a un giro: i punti dei due strati, con la posizione
 * lungo il giro derivata dal distacco dal leader (in frazioni di giro), e il
 * flag "in corsia" per chi sta scontando la sosta.
 */
export function statoMappa(scenario, giro) {
  const frame = scenario.mappa.giri.find((g) => g.giro === giro);
  if (!frame) return { giro, punti: [], in_corsia: [] };
  const durataGiroTipica = (() => {
    // tempo tipico sul giro di questa gara: differenza di cum del leader fra due
    // giri consecutivi dello strato reale. È un numero della gara, non un prior.
    const indice = scenario.mappa.giri.findIndex((g) => g.giro === giro);
    const prima = scenario.mappa.giri[indice - 1];
    if (!prima) return null;
    const leaderOra = Math.min(...Object.values(frame.reale ?? {}));
    const leaderPrima = Math.min(...Object.values(prima.reale ?? {}));
    const d = leaderOra - leaderPrima;
    return Number.isFinite(d) && d > 0 ? d : null;
  })();

  const punti = [];
  for (const strato of ['reale', 'fantasma']) {
    const cum = frame[strato] ?? {};
    const piloti = Object.keys(cum);
    if (piloti.length === 0) continue;
    const leader = Math.min(...piloti.map((d) => cum[d]));
    for (const drv of piloti) {
      const distacco = cum[drv] - leader;
      punti.push({
        drv,
        strato,
        cum: cum[drv],
        distacco_s: distacco,
        // frazione di giro dietro al leader; senza durata tipica NON si inventa
        // una posizione: il punto resta senza frazione (regola 6)
        frazione: durataGiroTipica === null ? null : Math.min(distacco / durataGiroTipica, 0.999),
        mio: drv === scenario.pilota,
      });
    }
  }
  return { giro, punti, in_corsia: frame.in_box ?? [], usciti_dalla_corsia: frame.fuori_box ?? [] };
}

const targhettaGiro = (data) => creaTarghetta({ natura: 'MISURATO_QUESTA_GARA', testo: 'numero di giro di questa gara', data });
const targhettaStazionario = (s, data) => creaTarghetta({
  natura: 'PRIOR_ESTERNO',
  testo: `tempo fermo ai box: prior dichiarato (pavimento fisico ${String(s.stazionario_pavimento_s).replace('.', ',')} s). Il grezzo per-giro non porta la durata reale della sosta, e non si inventa`,
  data,
});
const targhettaPosizione = (data) => creaTarghetta({
  natura: 'MODELLO_DICHIARATO',
  testo: 'posizione nello strato fantasma, ordinando i cumulati previsti: è lo stesso ordine su cui risponde il pannello',
  data,
});

/** Geometria schematica: un anello, più una corsia box accanto al traguardo. */
function tracciato() {
  return el('g', { classe: 'tracciato' },
    el('rect', { classe: 'pista', x: 60, y: 40, larghezza: LARGHEZZA - 120, altezza: ALTEZZA - 120, raggio: 100 }),
    el('line', { classe: 'traguardo', x1: LARGHEZZA / 2, y1: 40, x2: LARGHEZZA / 2, y2: 66 }),
    el('path', { classe: 'corsia-box', d: `M${LARGHEZZA / 2 - 120},28 L${LARGHEZZA / 2 + 120},28` }));
}

export function mappa(vista, s) {
  const data = vista._targhetta.data;
  if (!s.mappa.giri || s.mappa.giri.length === 0) {
    return el('section', { classe: 'mappa vuota' },
      el('h2', {}, txt('La mappa')),
      el('p', { classe: 'soppressione' }, txt('Mappa non disponibile per questo scenario: la finestra di proiezione è vuota.')));
  }
  const giroRientro = s.pannello.giro_di_rientro;
  const stato = statoMappa(s, giroRientro);
  const posMappa = posizioneDallaMappa(s);

  const punto = (p, i) => {
    const angolo = p.frazione === null ? (i / Math.max(stato.punti.length, 1)) : p.frazione;
    const perimetro = 2 * (LARGHEZZA - 120) + 2 * (ALTEZZA - 120);
    const lungo = angolo * perimetro;
    // posizione lungo il rettangolo, in senso orario dal traguardo
    const l = LARGHEZZA - 120;
    const h = ALTEZZA - 120;
    let x = LARGHEZZA / 2;
    let y = 40;
    let d = lungo;
    if (d < l / 2) { x = LARGHEZZA / 2 + d; y = 40; }
    else if ((d -= l / 2) < h) { x = LARGHEZZA - 60; y = 40 + d; }
    else if ((d -= h) < l) { x = LARGHEZZA - 60 - d; y = ALTEZZA - 80; }
    else if ((d -= l) < h) { x = 60; y = ALTEZZA - 80 - d; }
    else { x = 60 + Math.min(d - h, l / 2); y = 40; }
    const inCorsia = stato.in_corsia.includes(p.drv) && p.strato === 'fantasma';
    return el('g', {
      classe: `punto ${p.strato} ${p.mio ? 'mio' : ''} ${inCorsia ? 'in-corsia' : ''}`,
      trasla: inCorsia ? `${LARGHEZZA / 2},28` : `${x.toFixed(1)},${y.toFixed(1)}`,
    }, el('circle', { r: p.mio ? 7 : 5 }), p.mio ? el('text', { y: -11, ancora: 'middle' }, txt(p.drv)) : null);
  };

  return el('section', { classe: 'mappa' },
    el('h2', {}, txt('La mappa')),
    el('p', { classe: 'contesto' },
      txt('Giro '),
      num(stato.giro, { formato: 'intero', targhetta: targhettaGiro(data) }),
      txt(' · il fantasma sta sopra il reale, non al suo posto')),
    el('svg', { viewBox: `0 0 ${LARGHEZZA} ${ALTEZZA}`, classe: 'pista-svg', etichetta: 'mappa della gara con strato reale e strato proiettato' },
      tracciato(),
      // REALE prima, FANTASMA dopo: l'ordine di disegno È l'invariante visivo
      ...stato.punti.filter((p) => p.strato === 'reale').map(punto),
      ...stato.punti.filter((p) => p.strato === 'fantasma').map(punto)),
    el('p', { classe: 'lettura' },
      txt(`In corsia box${stato.in_corsia.length ? ` (${stato.in_corsia.join(', ')})` : ''}: fermo per `),
      num(s.stazionario_prior_s, { unita: 's', formato: 'secondi', targhetta: targhettaStazionario(s, data) })),
    el('p', { classe: 'lettura' },
      txt('Posizione nello strato fantasma: '),
      num(posMappa, {
        formato: 'posizione',
        targhetta: targhettaPosizione(data),
        motivo_soppressione: posMappa === null ? 'il pilota non ha una proiezione a questo giro' : null,
      })));
}
