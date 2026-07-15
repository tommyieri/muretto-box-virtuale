// timeline.mjs — helper PURI per l'animazione dell'interfaccia.
// NON importa engine.mjs né pitscenario.mjs: consuma i dati per-giro già calcolati
// dal motore (cum_time, compound, tyre_age, finestre), non li modifica.
// Il movimento tra un giro e l'altro nasce SOLO da interpolazione dei dati per-giro.

// Orologio a requestAnimationFrame: la posizione di gara è un giro FRAZIONARIO.
// ANCORA: p ∈ [L, L+1) = il leader sta percorrendo il giro L; il traguardo del giro L
// sta a p = L+1, quindi la gara di n giri finisce a p = n+1 (max = nLaps+1).
// A 1× il giro L dura durFn(L) SECONDI REALI (durata vera della gara). onTick(p) a
// ogni frame; onEnd() a fine gara. Senza durFn ricade su 1 giro/secondo (fallback).
export function makeClock({ onTick, onEnd, min = 1 }) {
  let p = min, speed = 1, playing = false, raf = null, last = null, max = min, durFn = () => 1;
  function step(t) {
    if (!playing) return;
    if (last == null) last = t;
    const dt = (t - last) / 1000; last = t;
    const L = Math.max(1, Math.floor(p));
    const ld = durFn(L) || 1;                 // secondi reali di quel giro a 1×
    p = Math.min(max, p + dt * speed / ld);
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
    setDur(fn) { durFn = fn || (() => 1); },
    reset(m) { api.pause(); max = m; p = min; onTick(p); },
    get position() { return p; },
    get playing() { return playing; },
  };
  return api;
}

// Durata reale del giro L = delta del MINIMO cum_time tra fine giro L-1 e fine giro L
// (il tempo del battistrada, chiunque sia: e' la STESSA ancora di tempoReale in
// gara.html, cosi' l'orologio dell'animazione resta proporzionale al tempo reale su
// ogni giro, anche ai cambi di leadership; fonte telescopica: la somma e' la durata
// reale della gara). dur[L] e' la durata del giro FISICO L (p ∈ [L, L+1) = giro L).
// Il giro 1 non è derivabile dai dati (cum_time è tempo-sessione: l'offset di partenza
// è cotto dentro cum_time[1]): dur[1] = mediana — passo d'animazione dichiarato, non
// un dato di gara. Clamp a 4× la mediana per non congelare l'animazione su artefatti.
// I giri sotto SC restano lenti.
// BANDIERA ROSSA: il giro rosso contiene la sospensione reale (~38 min a Monaco, cotta
// nel suo cum_time). NON la animiamo in tempo reale: durata fissa breve REDFLAG_HOLD col
// banner "gara sospesa" (scelta dichiarata dal PO). rfLaps = Set dei giri rossi.
export const REDFLAG_HOLD = 5; // secondi a 1× per il giro-rosso (pausa breve, non 38 min)
export function computeDurations(byLap, nLaps, rfLaps = new Set()) {
  const minCum = {};
  for (let L = 1; L <= nLaps; L++) {
    let m = Infinity;
    for (const d in (byLap[L] || {})) { const c = byLap[L][d].cum_time; if (typeof c === 'number' && c < m) m = c; }
    if (m < Infinity) minCum[L] = m;
  }
  const raw = {}, all = [];
  for (let L = 2; L <= nLaps; L++) {
    if (minCum[L] === undefined || minCum[L - 1] === undefined) continue;
    const dt = minCum[L] - minCum[L - 1];
    if (dt > 0) { raw[L] = dt; all.push(dt); }
  }
  all.sort((a, b) => a - b);
  const med = all.length ? all[all.length >> 1] : 90, cap = med * 4;
  const dur = {};
  for (let L = 1; L <= nLaps; L++) dur[L] = rfLaps.has(L) ? REDFLAG_HOLD : Math.min(raw[L] ?? med, cap);
  return dur;
}

// Colori mescola Pirelli (dato reale, dove presente; null = nessun pallino, niente inventato).
export function tyreColor(compound) {
  return ({ SOFT: '#ff3b3b', MEDIUM: '#ffd24e', HARD: '#eef0f3',
            INTERMEDIATE: '#43c463', WET: '#3ba7ff' })[compound] || null;
}

// Geometria delle bande SC/VSC sulla timeline, in percentuale della barra.
// Asse della barra: 0% = partenza, 100% = bandiera a scacchi (p = nLaps+1); il giro L
// occupa l'INTERVALLO [(L-1)/nLaps, L/nLaps] — stessa mappa del cursore (p-1)/nLaps.
// La finestra a..b copre quindi da inizio giro a a fine giro b, e il cursore le sta
// dentro esattamente nei giri in cui il banner di fase è acceso.
export function bands(finestreGara, nLaps) {
  if (!finestreGara || nLaps < 1) return [];
  const mk = (arr, type) => (arr || []).map(([a, b]) => {
    const left = (a - 1) / nLaps * 100, right = b / nLaps * 100;
    return { type, a, b, left, width: Math.max(right - left, 1.2) };
  });
  // rf disegnato per ultimo -> sta sopra la banda sc (i giri rossi sono dentro la sc)
  return [...mk(finestreGara.sc, 'sc'), ...mk(finestreGara.vsc, 'vsc'), ...mk(finestreGara.rf, 'rf')];
}

// Fase corrente della gara al giro L (per pill + banner bandiera).
// Priorità: RF (rossa, gara sospesa) > SC > VSC.
export function fase(finestreGara, L) {
  const dentro = (arr) => (arr || []).some(([a, b]) => L >= a && L <= b);
  if (finestreGara) {
    if (dentro(finestreGara.rf)) return 'RF';
    if (dentro(finestreGara.sc)) return 'SC';
    if (dentro(finestreGara.vsc)) return 'VSC';
  }
  return null;
}
