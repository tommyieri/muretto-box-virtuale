// timeline.mjs — helper PURI per l'animazione dell'interfaccia.
// NON importa engine.mjs né pitscenario.mjs: consuma i dati per-giro già calcolati
// dal motore (cum_time, compound, finestre di neutralizzazione), non li modifica.
// Il movimento tra un giro e l'altro nasce SOLO da interpolazione dei dati per-giro.

export const BASE_LPS = 1.0; // giri al secondo a velocità 1× (l'orologio della riproduzione)

// Orologio a requestAnimationFrame: la posizione di gara è un giro FRAZIONARIO.
// onTick(p) è chiamato a ogni frame; onEnd() a fine gara. min = primo giro.
export function makeClock({ onTick, onEnd, min = 1 }) {
  let p = min, speed = 1, playing = false, raf = null, last = null, max = min;
  function step(t) {
    if (!playing) return;
    if (last == null) last = t;
    const dt = (t - last) / 1000; last = t;
    p = Math.min(max, p + dt * BASE_LPS * speed);
    onTick(p);
    if (p >= max) { playing = false; last = null; onEnd && onEnd(); return; }
    raf = requestAnimationFrame(step);
  }
  const api = {
    play() { if (playing) return; if (p >= max) p = min; playing = true; last = null; raf = requestAnimationFrame(step); },
    pause() { playing = false; last = null; if (raf) cancelAnimationFrame(raf); },
    toggle() { playing ? api.pause() : api.play(); },
    seek(v) { p = Math.max(min, Math.min(max, v)); onTick(p); },
    setSpeed(s) { speed = s; },
    reset(m) { api.pause(); max = m; p = min; onTick(p); },
    get position() { return p; },
    get playing() { return playing; },
  };
  return api;
}

// Colori mescola Pirelli (dato reale, dove presente; null = nessun pallino, niente inventato).
export function tyreColor(compound) {
  return ({ SOFT: '#ff3b3b', MEDIUM: '#ffd24e', HARD: '#eef0f3',
            INTERMEDIATE: '#43c463', WET: '#3ba7ff' })[compound] || null;
}

// Geometria delle bande SC/VSC sulla timeline, in percentuale del range-giri.
export function bands(finestreGara, nLaps) {
  if (!finestreGara || nLaps < 2) return [];
  const span = nLaps - 1;
  const mk = (arr, type) => (arr || []).map(([a, b]) => {
    const left = (a - 1) / span * 100, right = (b - 1) / span * 100;
    return { type, a, b, left, width: Math.max(right - left, 1.2) };
  });
  return [...mk(finestreGara.sc, 'sc'), ...mk(finestreGara.vsc, 'vsc')];
}

// Fase corrente della gara al giro L (per l'indicatore testuale accanto al numero giro).
export function fase(finestreGara, L) {
  const dentro = (arr) => (arr || []).some(([a, b]) => L >= a && L <= b);
  if (finestreGara) {
    if (dentro(finestreGara.sc)) return 'SC';
    if (dentro(finestreGara.vsc)) return 'VSC';
  }
  return null;
}
