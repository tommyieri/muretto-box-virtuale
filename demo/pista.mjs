// pista.mjs — vista pallini nella pagina-gara, per TUTTE le gare con pista_<gara>.json
// (GENERATO da gen_pista_svg.py: tracciato GPS FastF1 di un giro pulito, parametrizzato
// in distanza — vedi NOTA_PISTE.md).
// I pallini sono REPLAY POSIZIONALE dei tempi-giro reali: la pagina calcola per ogni
// pilota la frazione di giro percorsa (dai cum_time per-giro dei dati gara) e questo
// modulo la traduce in un punto del nastro. Approssimazione dichiarata: dentro il giro
// la velocita' e' assunta uniforme (frazione di tempo = frazione di distanza).
// NON e' una simulazione e NON risponde a "se pitto" — quello e' il motore box.
// LEGGE DEL REPLAY: esplorazione pit attiva => setSpento(true), i pallini si spengono.
// Consumatore puro: legge il JSON generato, non tocca engine/pitscenario/timeline.

export async function creaPista({ canvas, url }) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`pista non disponibile (${res.status})`);
  const data = await res.json();                      // {viewBox,punti,dist,sorgente,...}
  const G = canvas.getContext('2d');
  const [, , VW, VH] = data.viewBox;
  const P = data.punti, D = data.dist, N = P.length;
  let dots = [], spento = false, proj = null;

  const css = v => getComputedStyle(document.documentElement).getPropertyValue(v).trim();

  // canvas nitido a qualunque larghezza: dimensione dal contenitore, aspetto dal viewBox
  function resize() {
    const dpr = window.devicePixelRatio || 1;
    const w = canvas.clientWidth || 600;
    const h = Math.round(w * Math.min(Math.max(VH / VW, 0.55), 1.4));
    canvas.style.height = h + 'px';
    canvas.width = Math.round(w * dpr); canvas.height = Math.round(h * dpr);
    const pad = 24 * dpr;
    const s = Math.min((canvas.width - 2 * pad) / VW, (canvas.height - 2 * pad) / VH);
    const ox = (canvas.width - VW * s) / 2, oy = (canvas.height - VH * s) / 2;
    proj = { x: vx => ox + vx * s, y: vy => oy + vy * s };
    render();
  }

  function tracciato() {
    const dpr = window.devicePixelRatio || 1;
    G.lineJoin = 'round'; G.lineCap = 'round';
    const passa = (stile, w, dash) => {
      G.strokeStyle = stile; G.lineWidth = w * dpr; G.setLineDash(dash || []);
      G.beginPath();
      P.forEach((p, i) => { const X = proj.x(p[0]), Y = proj.y(p[1]); i ? G.lineTo(X, Y) : G.moveTo(X, Y); });
      G.closePath(); G.stroke();
    };
    passa('#1d2430', 14);                                    // alone
    passa(css('--line') || '#3a4557', 8);                    // nastro
    passa('rgba(255,255,255,.08)', 1.2, [4 * dpr, 6 * dpr]); // mezzeria
    G.setLineDash([]);
    // start/finish: tacca al punto 0 (frazione di giro = 0, senso di marcia dei punti)
    const dpx = P[1][0] - P[0][0], dpy = P[1][1] - P[0][1], n = Math.hypot(dpx, dpy) || 1;
    const tx = -dpy / n, ty = dpx / n, L = 7 * dpr;
    G.strokeStyle = 'rgba(255,255,255,.5)'; G.lineWidth = 2 * dpr;
    G.beginPath();
    G.moveTo(proj.x(P[0][0]) - tx * L, proj.y(P[0][1]) - ty * L);
    G.lineTo(proj.x(P[0][0]) + tx * L, proj.y(P[0][1]) + ty * L);
    G.stroke();
  }

  // punto del nastro alla frazione di giro f in [0,1): ricerca binaria su dist + lerp
  function puntoA(f) {
    f = ((f % 1) + 1) % 1;
    let lo = 0, hi = N - 1;
    while (lo < hi) { const m = (lo + hi + 1) >> 1; if (D[m] <= f) lo = m; else hi = m - 1; }
    const a = P[lo], b = P[(lo + 1) % N];
    const d0 = D[lo], d1 = (lo + 1 < N) ? D[lo + 1] : 1;
    const t = (d1 === d0) ? 0 : (f - d0) / (d1 - d0);
    return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
  }

  function render() {
    if (!proj) return;
    const dpr = window.devicePixelRatio || 1;
    G.clearRect(0, 0, canvas.width, canvas.height);
    tracciato();
    if (spento) return;              // legge del replay: pallini spenti, resta il nastro
    for (const d of dots) {
      const [vx, vy] = puntoA(d.f);
      const X = proj.x(vx), Y = proj.y(vy);
      G.beginPath(); G.arc(X, Y, 5.5 * dpr, 0, 7);
      G.fillStyle = d.colore; G.fill();
      G.lineWidth = 1.2 * dpr; G.strokeStyle = 'rgba(255,255,255,.85)'; G.stroke();
      G.fillStyle = '#fff'; G.font = `bold ${9 * dpr}px -apple-system,Arial`;
      G.fillText(d.sigla, X + 7 * dpr, Y + 3 * dpr);
    }
  }

  const ro = new ResizeObserver(resize);
  ro.observe(canvas);
  resize();

  return {
    sorgente: data.sorgente,
    // nuovi pallini: [{f: frazione di giro [0,1), colore, sigla}]
    aggiorna(nuovi) { dots = nuovi || []; render(); },
    setSpento(v) { spento = !!v; render(); },
    destroy() { ro.disconnect(); },
  };
}
