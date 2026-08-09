// mappa.mjs — la pista e i pallini, a 60 fotogrammi al secondo.
//
// Sostituisce pista.mjs e ne conserva l'INTERFACCIA (aggiorna / setRegime / setSpento /
// vista / pitFrazioni / destroy), perche' ghostplay.mjs la chiama e non va toccato.
//
// COSA CAMBIA, ed e' il motivo per cui esiste. pista.mjs ridisegnava il tracciato — 500
// punti, quattro passate di stroke — a OGNI chiamata di aggiorna(). A 2 aggiornamenti al
// secondo non si vedeva; a 60 e' il 90% del lavoro di ogni fotogramma, ripetuto identico.
// Qui il nastro sta su una tela fuori schermo, ridisegnata solo quando cambia davvero
// (resize, regime di gara): ogni fotogramma e' una copia piu' ventidue cerchi.
//
// I pallini si muovono SEMPRE fra due campioni interpolati dal chiamante: qui dentro non
// c'e' nessuna nozione di tempo. Chi chiama porta le frazioni di giro, questo modulo le
// mette dove vanno.

export async function creaMappa({ canvas, url, pitlane, etichette = 'scelto' }) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`pista non disponibile (${res.status})`);
  const data = await res.json();
  const G = canvas.getContext('2d', { alpha: true });
  const [, , VW, VH] = data.viewBox;
  const P = data.punti, D = data.dist, N = P.length;
  const PL = pitlane || data.pitlane || null;
  const FE = PL?.frazione_ingresso ?? 0.95, FX = PL?.frazione_uscita ?? 0.05;

  let dots = [], spento = false, proj = null, regime = null, scelto = null;
  let sfondo = null, sfondoSporco = true;

  const css = (v, d) => getComputedStyle(document.documentElement).getPropertyValue(v).trim() || d;

  /* ------------------------------------------------------ geometria */
  function puntoA(f) {
    f = ((f % 1) + 1) % 1;
    let lo = 0, hi = N - 1;
    while (lo < hi) { const m = (lo + hi + 1) >> 1; if (D[m] <= f) lo = m; else hi = m - 1; }
    const a = P[lo], b = P[(lo + 1) % N];
    const d0 = D[lo], d1 = (lo + 1 < N) ? D[lo + 1] : 1;
    const t = (d1 === d0) ? 0 : (f - d0) / (d1 - d0);
    return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
  }
  function puntoPit(g) {
    const Q = PL.punti, E = PL.dist, M = Q.length;
    g = Math.min(1, Math.max(0, g));
    let lo = 0, hi = M - 1;
    while (lo < hi) { const m = (lo + hi + 1) >> 1; if (E[m] <= g) lo = m; else hi = m - 1; }
    if (lo >= M - 1) return Q[M - 1];
    const t = (E[lo + 1] === E[lo]) ? 0 : (g - E[lo]) / (E[lo + 1] - E[lo]);
    return [Q[lo][0] + (Q[lo + 1][0] - Q[lo][0]) * t, Q[lo][1] + (Q[lo + 1][1] - Q[lo][1]) * t];
  }
  /** dove sta questo pallino: nastro, oppure corsia box se ci sta passando. */
  function posizione(d) {
    const f = ((d.f % 1) + 1) % 1;
    const inBox = d.box === 'in' || (d.box === 'lane' && f >= FE);
    const usBox = d.box === 'out' || (d.box === 'lane' && f <= FX);
    if (PL && inBox && f >= FE) return puntoPit((f - FE) / (1 - FE) * 0.5);
    if (PL && usBox && f <= FX) return puntoPit(0.5 + f / FX * 0.5);
    return puntoA(f);
  }

  /* --------------------------------------------- il nastro, una volta sola */
  function disegnaSfondo() {
    const dpr = window.devicePixelRatio || 1;
    if (!sfondo) sfondo = document.createElement('canvas');
    sfondo.width = canvas.width; sfondo.height = canvas.height;
    const C = sfondo.getContext('2d');
    C.lineJoin = 'round'; C.lineCap = 'round';
    const traccia = (stile, w, dash) => {
      C.strokeStyle = stile; C.lineWidth = w * dpr; C.setLineDash(dash || []);
      C.beginPath();
      for (let i = 0; i < N; i++) {
        const X = proj.x(P[i][0]), Y = proj.y(P[i][1]);
        i ? C.lineTo(X, Y) : C.moveTo(X, Y);
      }
      C.closePath(); C.stroke();
    };
    // l'alone da' profondita' senza costare niente: e' fuori schermo
    traccia('rgba(0,0,0,.55)', 21);
    traccia('#1A202B', 15);
    // il nastro resta neutro: il regime e' una FILETTATURA sopra, non una tinta piena.
    // Colorare tutto il tracciato di arancio faceva gridare la pista e sparire i pallini.
    traccia(css('--bordo-2', '#333B4A'), 8.5);
    const TINTA = { SC: '#FFB000', VSC: '#E0B400', RF: '#FF1E3C' };
    if (regime) traccia(TINTA[regime], 3, regime === 'VSC' ? [11 * dpr, 9 * dpr] : null);
    traccia('rgba(255,255,255,.07)', 1.3, [4 * dpr, 8 * dpr]);
    C.setLineDash([]);

    if (PL) {                                   // la corsia box
      C.strokeStyle = 'rgba(150,162,184,.32)'; C.lineWidth = 4.5 * dpr;
      C.beginPath();
      PL.punti.forEach((p, i) => { const X = proj.x(p[0]), Y = proj.y(p[1]); i ? C.lineTo(X, Y) : C.moveTo(X, Y); });
      C.stroke();
    }
    // il traguardo: una tacca a scacchi al punto zero
    const dx = P[1][0] - P[0][0], dy = P[1][1] - P[0][1], n = Math.hypot(dx, dy) || 1;
    const tx = -dy / n, ty = dx / n, L = 9 * dpr;
    const X0 = proj.x(P[0][0]), Y0 = proj.y(P[0][1]);
    C.lineWidth = 3 * dpr; C.strokeStyle = 'rgba(255,255,255,.75)';
    C.beginPath(); C.moveTo(X0 - tx * L, Y0 - ty * L); C.lineTo(X0 + tx * L, Y0 + ty * L); C.stroke();
    sfondoSporco = false;
  }

  function resize() {
    const dpr = window.devicePixelRatio || 1;
    const w = canvas.clientWidth || 600;
    const h = canvas.clientHeight || Math.round(w * Math.min(Math.max(VH / VW, .55), 1.4));
    canvas.width = Math.round(w * dpr); canvas.height = Math.round(h * dpr);
    const pad = 30 * dpr;
    const s = Math.min((canvas.width - 2 * pad) / VW, (canvas.height - 2 * pad) / VH);
    proj = { x: vx => (canvas.width - VW * s) / 2 + vx * s, y: vy => (canvas.height - VH * s) / 2 + vy * s };
    sfondoSporco = true;
    render();
  }

  /* -------------------------------------------------------- fotogramma */
  function render() {
    if (!proj) return;
    if (sfondoSporco) disegnaSfondo();
    const dpr = window.devicePixelRatio || 1;
    G.clearRect(0, 0, canvas.width, canvas.height);
    G.drawImage(sfondo, 0, 0);
    if (spento) return;

    // chi e' scelto (o fantasma) si disegna per ultimo, sopra tutti
    const ord = [...dots].sort((a, b) =>
      ((a.ghost || a.sigla === scelto) ? 1 : 0) - ((b.ghost || b.sigla === scelto) ? 1 : 0));

    for (const d of ord) {
      const [vx, vy] = posizione(d);
      const X = proj.x(vx), Y = proj.y(vy);
      const forte = d.ghost || d.sigla === scelto;
      const r = (forte ? 8.2 : 5.8) * dpr;

      if (d.dim && !forte) G.globalAlpha = .38;

      if (forte) { G.shadowColor = d.colore; G.shadowBlur = 16 * dpr; }
      G.beginPath(); G.arc(X, Y, r, 0, 7);
      if (d.stimato) {
        G.lineWidth = 2.2 * dpr; G.strokeStyle = d.colore; G.stroke();
      } else {
        G.fillStyle = d.colore; G.fill();
        G.shadowBlur = 0;
        G.lineWidth = (forte ? 2.6 : 1.6) * dpr;
        G.strokeStyle = forte ? '#fff' : 'rgba(0,0,0,.62)';
        G.stroke();
      }
      G.shadowBlur = 0;

      if (d.pit) {                                   // fermo ai box
        G.setLineDash([3 * dpr, 3 * dpr]);
        G.strokeStyle = '#2FD576'; G.lineWidth = 2 * dpr;
        G.beginPath(); G.arc(X, Y, r + 5 * dpr, 0, 7); G.stroke();
        G.setLineDash([]);
      }
      G.globalAlpha = 1;

      const mostraNome = etichette === 'tutte' || forte;
      if (mostraNome) {
        const t = d.sigla;
        G.font = `700 ${(forte ? 11.5 : 9.5) * dpr}px "JetBrains Mono", ui-monospace, monospace`;
        const w = G.measureText(t).width + 9 * dpr, hh = 15 * dpr;
        const bx = X + r + 5 * dpr, by = Y - hh / 2;
        G.fillStyle = 'rgba(8,9,12,.82)';
        G.beginPath(); G.roundRect(bx, by, w, hh, 4 * dpr); G.fill();
        G.fillStyle = forte ? '#fff' : 'rgba(237,241,247,.9)';
        G.fillText(t, bx + 4.5 * dpr, Y + 3.8 * dpr);
      }
    }
  }

  const ro = new ResizeObserver(resize);
  ro.observe(canvas);
  resize();

  return {
    sorgente: data.sorgente,
    pitFrazioni: { ingresso: FE, uscita: FX },
    vista() { return proj ? { proj, dpr: window.devicePixelRatio || 1 } : null; },
    aggiorna(nuovi) { dots = nuovi || []; render(); },
    setScelto(s) { if (s === scelto) return; scelto = s || null; render(); },
    setRegime(r) { if ((r || null) === regime) return; regime = r || null; sfondoSporco = true; render(); },
    setSpento(v) { if (!!v === spento) return; spento = !!v; render(); },
    /** quale pallino sta sotto questo punto del canvas (coordinate CSS)? */
    colpito(cx, cy) {
      if (!proj || spento) return null;
      const dpr = window.devicePixelRatio || 1;
      const X = cx * dpr, Y = cy * dpr;
      let miglio = null, dmin = 18 * dpr;
      for (const d of dots) {
        const [vx, vy] = posizione(d);
        const dd = Math.hypot(proj.x(vx) - X, proj.y(vy) - Y);
        if (dd < dmin) { dmin = dd; miglio = d.sigla; }
      }
      return miglio;
    },
    destroy() { ro.disconnect(); },
  };
}
