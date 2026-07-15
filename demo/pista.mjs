// pista.mjs — vista pallini nella pagina-gara: REPLAY di posizioni storiche registrate
// (OpenF1 /location), adattamento UI del prototipo telemetria_proto.html (che resta intatto).
// NON e' una simulazione: il pallino mostra dove l'auto ERA. Non risponde a "se pitto" —
// quello e' il motore box (per-giro). LEGGE DEL REPLAY: quando l'esplorazione pit e' attiva
// i pallini si spengono (setSpento) — mai mostrare il replay reale accanto al controfattuale.
// Consumatore puro: legge il JSON registrato, non tocca engine/pitscenario/timeline.

export async function creaPista({ canvas, url }) {
  const data = await (await fetch(url)).json();
  const G = canvas.getContext('2d');
  const T0 = data.t[0], T1 = data.t[data.t.length - 1];
  let T = T0, spento = false, proj = null;

  const css = v => getComputedStyle(document.documentElement).getPropertyValue(v).trim();

  // canvas nitido a qualunque larghezza: dimensione dal contenitore, aspetto dai bounds
  function resize() {
    const b = data.bounds, dpr = window.devicePixelRatio || 1;
    const w = canvas.clientWidth || 600;
    const aspect = (b.maxy - b.miny) / (b.maxx - b.minx);
    const h = Math.round(w * Math.min(Math.max(aspect, 0.55), 1.4));
    canvas.style.height = h + 'px';
    canvas.width = Math.round(w * dpr); canvas.height = Math.round(h * dpr);
    const pad = 24 * dpr;
    const spanx = b.maxx - b.minx, spany = b.maxy - b.miny;
    const s = Math.min((canvas.width - 2 * pad) / spanx, (canvas.height - 2 * pad) / spany);
    const ox = (canvas.width - spanx * s) / 2, oy = (canvas.height - spany * s) / 2;
    proj = { s, x: wx => ox + (wx - b.minx) * s, y: wy => canvas.height - oy - (wy - b.miny) * s };
    render();
  }

  function tracciato() {
    const t = data.track, dpr = window.devicePixelRatio || 1;
    G.lineJoin = 'round'; G.lineCap = 'round';
    const passa = (stile, w, dash) => {
      G.strokeStyle = stile; G.lineWidth = w * dpr; G.setLineDash(dash || []);
      G.beginPath();
      t.forEach((p, i) => { const X = proj.x(p[0]), Y = proj.y(p[1]); i ? G.lineTo(X, Y) : G.moveTo(X, Y); });
      G.closePath(); G.stroke();
    };
    passa('#1d2430', 14);                                  // alone
    passa(css('--line') || '#3a4557', 8);                  // nastro
    passa('rgba(255,255,255,.08)', 1.2, [4 * dpr, 6 * dpr]); // mezzeria
    G.setLineDash([]);
  }

  // indice i tale che t[i] <= T < t[i+1] (ricerca binaria, come nel prototipo)
  function idxAt(x) {
    const t = data.t; let lo = 0, hi = t.length - 1;
    if (x <= t[0]) return 0; if (x >= t[hi]) return hi;
    while (lo < hi) { const m = (lo + hi + 1) >> 1; if (t[m] <= x) lo = m; else hi = m - 1; }
    return lo;
  }
  function posAt(dr) {
    const t = data.t, i = idxAt(T);
    if (i >= t.length - 1) return [dr.x[i], dr.y[i]];
    const f = (t[i + 1] === t[i]) ? 0 : (T - t[i]) / (t[i + 1] - t[i]);
    return [dr.x[i] + (dr.x[i + 1] - dr.x[i]) * f, dr.y[i] + (dr.y[i + 1] - dr.y[i]) * f];
  }

  function render() {
    if (!proj) return;
    const dpr = window.devicePixelRatio || 1;
    G.clearRect(0, 0, canvas.width, canvas.height);
    tracciato();
    if (spento) return;              // legge del replay: pallini spenti, resta il nastro
    for (const dr of data.drivers) {
      const [wx, wy] = posAt(dr);
      const X = proj.x(wx), Y = proj.y(wy);
      G.beginPath(); G.arc(X, Y, 5.5 * dpr, 0, 7);
      G.fillStyle = dr.color; G.fill();
      G.lineWidth = 1.2 * dpr; G.strokeStyle = 'rgba(255,255,255,.85)'; G.stroke();
      G.fillStyle = '#fff'; G.font = `bold ${9 * dpr}px -apple-system,Arial`;
      G.fillText(dr.acr, X + 7 * dpr, Y + 3 * dpr);
    }
  }

  const ro = new ResizeObserver(resize);
  ro.observe(canvas);
  resize();

  return {
    meta: data.meta,
    // f in [0,1] = frazione del TEMPO REALE di gara (dalla somma delle durate-giro del leader)
    seek(f) { T = T0 + Math.min(1, Math.max(0, f)) * (T1 - T0); render(); },
    setSpento(v) { spento = !!v; render(); },
    destroy() { ro.disconnect(); },
  };
}
