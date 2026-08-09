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
// con playhead ritardato di ~2 intervalli mediani. Il ritmo del tempo
// evento (1x live, Nx replay) e' stimato dal flusso stesso: nessuna
// differenza di codice tra replay e live.
//
// MOVIMENTO FLUIDO (25/07/2026). Prima il playhead veniva RICALCOLATO a
// ogni fotogramma dall'ultimo campione (tMax/wallTMax): a ogni campione
// che arriva la base si sposta, e con la rete che ballonzola il tempo
// saltava avanti/indietro -> il pallino "scattava" (effetto elastico che
// in diretta si legge come lag continuo). Inoltre il playhead veniva
// clampato all'ultimo campione: buffer vuoto = pallino FERMO, poi salto.
// Ora il playhead e' MONOTONO: avanza sempre col tempo di parete e si
// riallinea al bersaglio cambiando la VELOCITA' di poco (<=15%, non si
// vede), mai con un salto; salta solo se il disallineamento e' enorme
// (ricollegamento, cambio sessione). E quando i campioni tardano, il
// pallino prosegue per un attimo sulla velocita' dell'ultimo tratto
// invece di inchiodare, poi si riaggancia al dato vero appena arriva.
//
// Staleness pre-registrata: auto senza campioni da >10 s (orologio di
// parete) -> marker grigio; >60 s -> rimossa. Mai un puntino congelato
// che sembra vivo.

import { STALE_GRIGIO_S, STALE_RIMOZIONE_S } from './live_config.mjs';

// --- movimento: parti pure, testabili senza DOM ------------------------
export const PH = {
  RIAGGANCIO_MS: 3000,      // oltre questo scarto: riaggancio secco (ricollegamento)
  CORREZIONE_MAX: 0.15,     // quanto si puo' accelerare/frenare per rimettersi in pari
  EXTRAP_MAX_MS: 450,       // per quanto il pallino "prosegue" se il dato tarda
  BUFFER_GAP: 1.25,         // stare indietro di 1,25 buchi-di-consegna: c'e' sempre dato avanti
  BUFFER_MIN_MS: 500,
  BUFFER_MAX_MS: 4000,
};

// RITMO E BUCO DI CONSEGNA — misurati su FINESTRA, non fra due campioni.
// Il feed non consegna un frame ogni 240 ms: ne consegna ~4 insieme una volta
// al secondo (misurato sulla registrazione della qualifica). Lo stimatore
// vecchio guardava il singolo salto al bordo della raffica (220 ms di dato /
// 1001 ms di attesa) e concludeva "ritmo 0,25": il pallino strisciava al 25%
// della velocita' e poi saltava ~750 ms di dato in un fotogramma. Su finestra
// il rapporto torna 1,0 (e Nx nel replay) qualunque sia la forma delle raffiche.
export function creaRitmo({ finestraMs = 6000, minCampioni = 4, gapIniziale = 700 } = {}) {
  let arr = [], gap = gapIniziale, ultimoWall = 0;
  return {
    osserva(wall, t) {
      if (ultimoWall) {
        const g = wall - ultimoWall;
        if (g > 30) gap = gap * 0.8 + Math.min(g, 5000) * 0.2;   // buco FRA raffiche
      }
      ultimoWall = wall;
      arr.push({ wall, t });
      while (arr.length > 2 && wall - arr[0].wall > finestraMs) arr.shift();
    },
    ritmo() {
      if (arr.length < minCampioni) return 1;
      const a = arr[0], b = arr[arr.length - 1];
      const dW = b.wall - a.wall, dT = b.t - a.t;
      if (dW <= 0 || dT <= 0) return 1;
      return Math.min(100, dT / dW);
    },
    gap: () => gap,
    // di quanto stare indietro: deve coprire il buco di consegna, o fra una
    // raffica e l'altra il pallino resta senza dato davanti (e inchioda).
    buffer() {
      return Math.max(PH.BUFFER_MIN_MS, Math.min(PH.BUFFER_MAX_MS, gap * PH.BUFFER_GAP));
    },
    reset() { arr = []; gap = gapIniziale; ultimoWall = 0; },
  };
}

// Playhead monotono con riallineamento dolce.
export function creaPlayhead(cfg = {}) {
  const K = { ...PH, ...cfg };
  let t = null, wall = 0;
  return {
    valore: () => t,
    reset() { t = null; wall = 0; },
    // bersaglio = dov'e' il vivo, meno il buffer. Ritorna il playhead nuovo.
    passo(now, bersaglio, ritmo, buffer) {
      if (!Number.isFinite(bersaglio)) return t;
      if (t === null || Math.abs(bersaglio - t) > K.RIAGGANCIO_MS) {
        t = bersaglio; wall = now; return t;          // primo giro o desync grosso
      }
      const d = Math.max(0, Math.min(250, now - wall));   // clamp: tab in background
      wall = now;
      const err = bersaglio - t;
      const span = Math.max(1, 2 * buffer);
      const corr = Math.max(-K.CORREZIONE_MAX, Math.min(K.CORREZIONE_MAX, err / span));
      t += d * ritmo * (1 + corr);                     // sempre avanti, mai un salto
      return t;
    },
  };
}

// Lisciatore della posizione DISEGNATA: insegue il bersaglio con un
// passo-verso (low-pass). Toglie i micro-strappi residui e soprattutto lo
// strappo quando il feed riprende dopo un buco: il pallino ci arriva in un
// paio di fotogrammi invece di teletrasportarsi. Oltre SALTO_SECCO_VB
// (auto nuova, cambio sessione, giro completato) si posiziona di netto.
export function creaLisciatore({ alfa = 0.28, saltoSecco = 60 } = {}) {
  let p = null;
  return {
    reset() { p = null; },
    passo(bersaglio) {
      if (!bersaglio) return null;
      if (!p || Math.hypot(bersaglio[0] - p[0], bersaglio[1] - p[1]) > saltoSecco) {
        p = [bersaglio[0], bersaglio[1]];
      } else {
        p = [p[0] + (bersaglio[0] - p[0]) * alfa, p[1] + (bersaglio[1] - p[1]) * alfa];
      }
      return p;
    },
  };
}

// Posizione interpolata; oltre l'ultimo campione prosegue per un attimo
// sulla velocita' dell'ultimo tratto (invece di inchiodare).
export function posizionaSu(campioni, playhead, extrapMaxMs = PH.EXTRAP_MAX_MS) {
  const c = campioni;
  if (!c || !c.length) return null;
  const ultimo = c[c.length - 1];
  if (c.length === 1) return ultimo.vb;
  if (playhead >= ultimo.t) {
    const dt = Math.min(playhead - ultimo.t, extrapMaxMs);
    const prima = c[c.length - 2];
    const span = ultimo.t - prima.t;
    if (span <= 0 || dt <= 0) return ultimo.vb;
    const vx = (ultimo.vb[0] - prima.vb[0]) / span, vy = (ultimo.vb[1] - prima.vb[1]) / span;
    return [ultimo.vb[0] + vx * dt, ultimo.vb[1] + vy * dt];
  }
  let i = c.length - 1;
  while (i > 0 && c[i - 1].t > playhead) i--;
  if (i === 0) return c[0].vb;
  const a = c[i - 1], b = c[i];
  const f = b.t === a.t ? 1 : (playhead - a.t) / (b.t - a.t);
  return [a.vb[0] + (b.vb[0] - a.vb[0]) * f, a.vb[1] + (b.vb[1] - a.vb[1]) * f];
}

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
  let tMax = 0, wallTMax = 0;
  const rit = creaRitmo();
  let acceso = false, rafId = null;

  function voce(num) {
    let v = auto.get(num);
    if (!v) { v = { campioni: [], wall: 0, inPit: false, extra: false, lisc: creaLisciatore() }; auto.set(num, v); }
    return v;
  }

  function campione(num, xy, tMs, extra) {
    const v = voce(num);
    v.wall = Date.now();
    v.extra = extra;
    const vb = versoVb(xy.x, xy.y);
    // LE TENUTE NON ENTRANO NEL BUFFER. Il feed non manda sempre una posizione nuova:
    // quando non ne ha una, ripete l'ultima. Misurato sul 2026 lato archivio, dove il
    // grezzo e' lo stesso: il 38% dei campioni al Belgio, il 76,9% all'Ungheria. Se una
    // ripetizione entra nel buffer, posizionaSu() interpola fra due punti IDENTICI e
    // restituisce una costante — il pallino si ferma e poi salta, che e' esattamente lo
    // scatto che si vedeva nel replay prima di ripararlo.
    //
    // Scartarle non fa perdere niente: la posizione e' gia' quella, e il tempo di arrivo
    // di un campione che non dice niente di nuovo non e' informazione. Un'auto DAVVERO
    // ferma smette semplicemente di produrre campioni distinti, e l'extrapolazione — che
    // e' gia' limitata a EXTRAP_MAX_MS — la lascia dov'e' invece di farla scivolare.
    const ult = v.campioni[v.campioni.length - 1];
    if (ult && ult.vb[0] === vb[0] && ult.vb[1] === vb[1]) {
      if (tMs > tMax) { rit.osserva(Date.now(), tMs); tMax = tMs; wallTMax = Date.now(); }
      return;
    }
    v.campioni.push({ t: tMs, vb });
    if (v.campioni.length > 12) v.campioni.shift();
    if (tMs > tMax) {
      rit.osserva(Date.now(), tMs);          // ritmo e buco di consegna su finestra
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
      playhead.reset(); rit.reset();   // sessione nuova: tempo e ritmo da capo
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

  const playhead = creaPlayhead();

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

    // playhead MONOTONO: il bersaglio e' il vivo meno il buffer; il playhead
    // ci si riallinea cambiando velocita' di poco, senza mai saltare indietro.
    const adesso = Date.now();
    const ritmo = rit.ritmo(), buffer = rit.buffer();
    const bersaglio = tMax ? tMax + (adesso - wallTMax) * ritmo - buffer : NaN;
    const ph = playhead.passo(adesso, bersaglio, ritmo, buffer);

    for (const [num, v] of auto) {
      const etaS = (adesso - v.wall) / 1000;
      if (etaS > STALE_RIMOZIONE_S) { auto.delete(num); continue; }
      const p = v.lisc.passo(posizionaSu(v.campioni, ph ?? 0));
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
