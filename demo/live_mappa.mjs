// live_mappa.mjs — layer LIVE sopra la pista del sito (Fase 3).
// Consuma gli eventi del collettore e disegna un marker per auto su un
// canvas overlay, riusando la proiezione della pista (pista.vista()).
//
// Coordinate: i position_frame arrivano in raw FastF1 (decimi di metro);
// live_geo_<gara>.json (GENERATO da live/gen_live_geo.py) da' la
// trasformazione verso il viewBox della pista:
//   vb = scala * ruota_flip(x, y) + (tx, ty)
//
// Interpolazione (dichiarata): lineare tra campioni (~3,8 Hz -> 60 fps)
// con playhead ritardato di ~2 intervalli mediani; MAI estrapolazione
// oltre l'ultimo campione (il playhead ci si ferma). Il ritmo del tempo
// evento (1x live, Nx replay) e' stimato dal flusso stesso: nessuna
// differenza di codice tra replay e live.
//
// Staleness pre-registrata: auto senza campioni da >10 s (orologio di
// parete) -> marker grigio; >60 s -> rimossa. Mai un puntino congelato
// che sembra vivo.

import { STALE_GRIGIO_S, STALE_RIMOZIONE_S } from './live_config.mjs';

export function creaLiveMappa({ canvasPista, canvasLive, pista, geo }) {
  const G = canvasLive.getContext('2d');
  const rad = geo.rotazione_deg * Math.PI / 180;
  const cosA = Math.cos(rad), sinA = Math.sin(rad);
  const versoVb = (x, y) => [
    geo.scala * (x * cosA - y * sinA) + geo.tx,
    geo.scala * (-(x * sinA + y * cosA)) + geo.ty,
  ];

  // stato per auto: campioni [{t, vb}], ultimo arrivo wall, timing, extra
  const auto = new Map();      // num -> {campioni, wall, inPit, extra}
  const piloti = new Map();    // num -> {sigla, colore}
  let tMax = 0, wallTMax = 0, ritmo = 1, intervalloMed = 260;
  let acceso = false, rafId = null;

  function voce(num) {
    let v = auto.get(num);
    if (!v) { v = { campioni: [], wall: 0, inPit: false, extra: false }; auto.set(num, v); }
    return v;
  }

  function campione(num, xy, tMs, extra) {
    const v = voce(num);
    v.wall = Date.now();
    v.extra = extra;
    v.campioni.push({ t: tMs, vb: versoVb(xy.x, xy.y) });
    if (v.campioni.length > 12) v.campioni.shift();
    if (tMs > tMax) {
      if (wallTMax) {
        const dWall = Date.now() - wallTMax, dT = tMs - tMax;
        if (dWall > 30 && dT > 0) {           // stima del ritmo (1x, 10x, ...)
          const r = dT / dWall;
          ritmo = ritmo * 0.9 + Math.min(r, 100) * 0.1;
          intervalloMed = intervalloMed * 0.9 + Math.min(dT, 5000) * 0.1;
        }
      }
      tMax = tMs; wallTMax = Date.now();
    }
  }

  // ---- eventi dal collettore -------------------------------------------
  function applica(e) {
    if (e.type === 'position_frame') {
      const tMs = e.t ? Date.parse(e.t) : tMax;
      for (const [num, xy] of Object.entries(e.cars)) campione(num, xy, tMs, false);
      for (const [num, xy] of Object.entries(e.extra_cars || {})) campione(num, xy, tMs, true);
    } else if (e.type === 'timing_update') {
      for (const [num, diff] of Object.entries(e.cars))
        if ('in_pit' in diff) voce(num).inPit = !!diff.in_pit;
    } else if (e.type === 'driver_list') {
      for (const [num, d] of Object.entries(e.cars)) {
        const p = piloti.get(num) || {};
        piloti.set(num, { sigla: d.sigla ?? p.sigla, colore: d.colore ?? p.colore });
      }
    } else if (e.type === 'snapshot') {
      auto.clear(); piloti.clear(); tMax = 0; wallTMax = 0;
      for (const [num, d] of Object.entries(e.driver_list || {}))
        piloti.set(num, { sigla: d.sigla, colore: d.colore });
      const tMs = e.t ? Date.parse(e.t) : 0;
      for (const [num, c] of Object.entries(e.cars || {})) {
        if (Number.isFinite(c.x) && Number.isFinite(c.y)) campione(num, c, tMs, false);
        if ('in_pit' in c) voce(num).inPit = !!c.in_pit;
      }
      for (const [num, c] of Object.entries(e.extra_cars || {}))
        if (Number.isFinite(c.x) && Number.isFinite(c.y)) campione(num, c, tMs, true);
    }
  }

  // ---- resa a 60 fps ---------------------------------------------------
  function dimensiona() {
    const dpr = window.devicePixelRatio || 1;
    const w = canvasPista.clientWidth, h = canvasPista.clientHeight;
    canvasLive.style.width = w + 'px'; canvasLive.style.height = h + 'px';
    canvasLive.width = Math.round(w * dpr); canvasLive.height = Math.round(h * dpr);
  }

  function posiziona(v, playhead) {
    const c = v.campioni;
    if (!c.length) return null;
    if (c.length === 1 || playhead >= c[c.length - 1].t) return c[c.length - 1].vb;
    let i = c.length - 1;
    while (i > 0 && c[i - 1].t > playhead) i--;
    if (i === 0) return c[0].vb;
    const a = c[i - 1], b = c[i];
    const f = b.t === a.t ? 1 : (playhead - a.t) / (b.t - a.t);
    return [a.vb[0] + (b.vb[0] - a.vb[0]) * f, a.vb[1] + (b.vb[1] - a.vb[1]) * f];
  }

  function corridoio(proj, dpr) {
    const C = geo.corridoio_pit_vb;
    if (!C || C.length < 2) return;
    G.strokeStyle = 'rgba(120,220,160,.45)'; G.lineWidth = 2.5 * dpr;
    G.setLineDash([5 * dpr, 4 * dpr]);
    G.beginPath();
    C.forEach((p, i) => { const X = proj.x(p[0]), Y = proj.y(p[1]);
      i ? G.lineTo(X, Y) : G.moveTo(X, Y); });
    G.stroke(); G.setLineDash([]);
  }

  function render() {
    rafId = requestAnimationFrame(render);
    const vista = pista.vista();
    if (!vista) return;
    if (canvasLive.width !== canvasPista.width) dimensiona();
    const { proj, dpr } = vista;
    G.clearRect(0, 0, canvasLive.width, canvasLive.height);
    if (!acceso) return;
    corridoio(proj, dpr);

    // playhead: insegue tMax con ritardo di 2 intervalli, mai oltre
    const playhead = tMax + (Date.now() - wallTMax) * ritmo - 2 * intervalloMed;
    const adesso = Date.now();

    for (const [num, v] of auto) {
      const etaS = (adesso - v.wall) / 1000;
      if (etaS > STALE_RIMOZIONE_S) { auto.delete(num); continue; }
      const p = posiziona(v, Math.min(playhead, v.campioni.at(-1)?.t ?? 0));
      if (!p) continue;
      const X = proj.x(p[0]), Y = proj.y(p[1]);
      const stantio = etaS > STALE_GRIGIO_S;
      const pil = piloti.get(num) || {};
      const colore = stantio ? '#5a6272' : (v.extra ? '#f5d43c' : (pil.colore || '#9aa4b5'));

      G.beginPath(); G.arc(X, Y, (v.extra ? 6.5 : 5.5) * dpr, 0, 7);
      G.globalAlpha = stantio ? 0.55 : (v.inPit ? 0.65 : 1);
      G.fillStyle = colore; G.fill();
      G.globalAlpha = 1;
      G.lineWidth = 1.4 * dpr;
      if (v.inPit && !stantio) {                     // stile pit: anello tratteggiato
        G.setLineDash([3 * dpr, 2.5 * dpr]);
        G.strokeStyle = 'rgba(120,220,160,.95)';
      } else {
        G.strokeStyle = v.extra ? '#8a6d00' : 'rgba(255,255,255,.85)';
      }
      G.stroke(); G.setLineDash([]);
      G.fillStyle = stantio ? '#8b93a5' : '#fff';
      G.font = `bold ${9 * dpr}px -apple-system,Arial`;
      G.fillText(v.extra ? 'SC' : (pil.sigla || num), X + 8 * dpr, Y + 3 * dpr);
    }
  }

  dimensiona();
  render();

  return {
    applica,
    setAcceso(v) { acceso = !!v; },
    conteggioAuto() {
      let n = 0;
      for (const v of auto.values()) if (!v.extra) n++;
      return n;
    },
    destroy() { cancelAnimationFrame(rafId); },
  };
}
