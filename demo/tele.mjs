// tele.mjs — decodifica e disegno delle tracce giro per giro.
//
// I dati arrivano da gen_giri.py: ogni giro e' ricampionato su una griglia UNIFORME
// di N punti lungo il giro, cosi' due giri qualunque — stesso pilota o piloti diversi,
// stessa sessione o sessioni diverse — cadono sugli stessi punti e si sovrappongono
// senza allineamenti a occhio.
//
// I canali sono base64 di interi: v (uint8 x1,6 km/h), gas (0-100), freno (0/1),
// marcia (0-8), drs (0/1), t (uint16 in unita' di `t_scala` secondi — scala per-giro,
// cosi' il tempo non satura mai e i giri lunghi non vengono troncati in silenzio).

const SCALA_V = 1.6;

function bytes(b64) {
  const s = atob(b64);
  const a = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) a[i] = s.charCodeAt(i);
  return a;
}

/** canali base64 -> array numerici pronti da disegnare. */
import { t } from './muro.mjs?v=190826b';

export function decodifica(c) {
  if (!c) return null;
  const v8 = bytes(c.v);
  const t16 = new Uint16Array(bytes(c.t).buffer);
  // t_scala assente = file vecchio in centesimi: si legge lo stesso, senza mentire
  const kt = Number.isFinite(c.t_scala) ? c.t_scala : 0.01;
  return {
    n: v8.length,
    v: Array.from(v8, x => x * SCALA_V),
    gas: Array.from(bytes(c.gas)),
    freno: Array.from(bytes(c.freno)),
    marcia: Array.from(bytes(c.marcia)),
    drs: Array.from(bytes(c.drs)),
    t: Array.from(t16, x => x * kt),
  };
}

/** Il ritardo di A rispetto a B, punto per punto: dove si perde e dove si guadagna. */
export function differenza(a, b) {
  const n = Math.min(a.t.length, b.t.length);
  const out = new Array(n);
  for (let i = 0; i < n; i++) out[i] = a.t[i] - b.t[i];
  return out;
}

const NS = 'http://www.w3.org/2000/svg';
const nodo = (t, at = {}) => {
  const n = document.createElementNS(NS, t);
  for (const [k, v] of Object.entries(at)) if (v != null) n.setAttribute(k, v);
  return n;
};

/**
 * Un pannello di traccia. Asse x = giro percorso (0-100%), condiviso da tutti.
 * @param serie  [{dati:[], colore, spessore, sotto:boolean}]
 * @param opz    {h, min, max, titolo, unita, tacche:[], zero:boolean, passi:boolean}
 */
export function traccia(serie, opz = {}) {
  // LA GRIGLIA E' IN PIXEL VERI, non in mille unita' scalate.  Con viewBox fisso a 1000
  // e preserveAspectRatio:none il disegno si schiacciava con la finestra: su un telefono
  // da 360 px il pannello della velocita' diventava alto 54 px e le etichette dell'asse
  // 3,4 px — illeggibili proprio sulla pagina per cui e' stato fatto tutto questo.
  // Passando la larghezza vera, un'unita' utente e' un pixel: 9,5 restano 9,5 e l'altezza
  // e' quella dichiarata.  Chi disegna ri-disegna quando la finestra cambia.
  const W = Math.max(240, Math.round(opz.larg || 1000)), H = opz.h ?? 150;
  const mt = 8, mb = 16, ml = 40, mr = 6;
  const dati = serie.filter(s => s.dati?.length);
  if (!dati.length) return nodo('svg');
  const n = Math.max(...dati.map(s => s.dati.length));
  let lo = opz.min, hi = opz.max;
  if (lo == null || hi == null) {
    let a = Infinity, b = -Infinity;
    for (const s of dati) for (const y of s.dati) { if (y < a) a = y; if (y > b) b = y; }
    const m = (b - a) * 0.08 || 1;
    lo = opz.min ?? a - m; hi = opz.max ?? b + m;
  }
  if (hi === lo) hi = lo + 1;
  const X = i => ml + (i / (n - 1)) * (W - ml - mr);
  const Y = y => mt + (1 - (y - lo) / (hi - lo)) * (H - mt - mb);

  const svg = nodo('svg', { viewBox: `0 0 ${W} ${H}`, class: 'tr', preserveAspectRatio: 'none',
    role: 'img', 'aria-label': opz.titolo || '' });
  const g = nodo('g');

  // griglia orizzontale + etichette dell'asse
  const tacche = opz.tacche || [lo, (lo + hi) / 2, hi];
  for (const t of tacche) {
    if (t < lo || t > hi) continue;
    g.append(nodo('line', { x1: ml, x2: W - mr, y1: Y(t).toFixed(1), y2: Y(t).toFixed(1),
      stroke: 'rgba(255,255,255,.07)', 'stroke-width': 1, 'vector-effect': 'non-scaling-stroke' }));
    const tx = nodo('text', { x: ml - 7, y: Y(t) + 3.5, 'text-anchor': 'end',
      fill: '#737D8C', 'font-family': 'JetBrains Mono, monospace', 'font-size': 9.5 });
    tx.textContent = opz.formato ? opz.formato(t) : Math.round(t);
    g.append(tx);
  }
  if (opz.zero && lo < 0 && hi > 0) {
    g.append(nodo('line', { x1: ml, x2: W - mr, y1: Y(0), y2: Y(0),
      stroke: 'rgba(255,255,255,.28)', 'stroke-width': 1, 'vector-effect': 'non-scaling-stroke' }));
  }

  for (const s of dati) {
    const pts = s.dati.map((y, i) => `${X(i).toFixed(1)},${Y(y).toFixed(1)}`).join(' ');
    if (s.area) {
      g.append(nodo('polygon', {
        points: `${X(0).toFixed(1)},${Y(lo).toFixed(1)} ${pts} ${X(s.dati.length - 1).toFixed(1)},${Y(lo).toFixed(1)}`,
        fill: s.area, stroke: 'none' }));
    }
    g.append(nodo('polyline', { points: pts, fill: 'none', stroke: s.colore,
      'stroke-width': s.spessore ?? 1.8, 'stroke-linejoin': 'round', 'stroke-linecap': 'round',
      'stroke-dasharray': s.tratteggio || null, 'vector-effect': 'non-scaling-stroke',
      'shape-rendering': opz.passi ? 'crispEdges' : 'auto' }));
  }
  svg.append(g);
  svg.append(nodo('line', { class: 'mirino', x1: 0, x2: 0, y1: mt, y2: H - mb,
    stroke: '#24E3D2', 'stroke-width': 1, 'vector-effect': 'non-scaling-stroke', opacity: 0 }));
  svg.dataset.ml = ml; svg.dataset.mr = mr; svg.dataset.w = W; svg.dataset.n = n;
  return svg;
}

/** Sposta il mirino di tutti i pannelli alla stessa frazione di giro. */
export function mirino(svgs, frazione) {
  for (const s of svgs) {
    const l = s.querySelector('.mirino'); if (!l) continue;
    if (frazione == null) { l.setAttribute('opacity', 0); continue; }
    const ml = +s.dataset.ml, mr = +s.dataset.mr, W = +s.dataset.w;
    const x = ml + frazione * (W - ml - mr);
    l.setAttribute('x1', x); l.setAttribute('x2', x); l.setAttribute('opacity', 1);
  }
}

/** La frazione di giro sotto il puntatore, dentro un pannello. */
export function frazioneDa(svg, clientX) {
  const r = svg.getBoundingClientRect();
  const ml = +svg.dataset.ml, mr = +svg.dataset.mr, W = +svg.dataset.w;
  const x = (clientX - r.left) / r.width * W;
  return Math.max(0, Math.min(1, (x - ml) / (W - ml - mr)));
}

/** Il tracciato colorato dalla velocita' di quel giro. */
export function nastroVelocita(pista, vel, { larghezza = 9 } = {}) {
  const [x0, y0, w, h] = pista.viewBox;
  const svg = nodo('svg', { viewBox: `${x0 - 16} ${y0 - 16} ${w + 32} ${h + 32}`,
    class: 'nastro', role: 'img', 'aria-label': t('tele.nastro_aria') });
  const P = pista.punti, D = pista.dist, N = P.length;
  const vmin = Math.min(...vel), vmax = Math.max(...vel);
  const colore = (u) => {                       // lento = rosso, veloce = ciano
    const c = [[255, 40, 60], [255, 176, 0], [47, 213, 118], [36, 227, 210]];
    const x = Math.max(0, Math.min(1, u)) * (c.length - 1);
    const i = Math.min(c.length - 2, Math.floor(x)), f = x - i;
    return `rgb(${c[i].map((v, k) => Math.round(v + (c[i + 1][k] - v) * f)).join(',')})`;
  };
  for (let i = 0; i < N - 1; i++) {
    const u = D[i];                              // frazione di giro del punto
    const j = Math.min(vel.length - 1, Math.round(u * (vel.length - 1)));
    const q = (vel[j] - vmin) / Math.max(1e-6, vmax - vmin);
    svg.append(nodo('line', { x1: P[i][0], y1: P[i][1], x2: P[i + 1][0], y2: P[i + 1][1],
      stroke: colore(q), 'stroke-width': larghezza, 'stroke-linecap': 'round' }));
  }
  const seg = nodo('circle', { class: 'segna', r: 9, fill: 'none',
    stroke: '#fff', 'stroke-width': 3, opacity: 0 });
  svg.append(seg);
  svg.puntoA = (frazione) => {
    let lo = 0, hi = N - 1;
    while (lo < hi) { const m = (lo + hi + 1) >> 1; if (D[m] <= frazione) lo = m; else hi = m - 1; }
    seg.setAttribute('cx', P[lo][0]); seg.setAttribute('cy', P[lo][1]);
    seg.setAttribute('opacity', frazione == null ? 0 : 1);
  };
  return svg;
}
