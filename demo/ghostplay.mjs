// ghostplay.mjs — la SOSTA MESSA IN SCENA, condivisa. Consuma la traiettoria di
// traiettoriaPit (l'oggetto `sim` che pannelloMuretto restituisce) e la anima: il pallino
// del pilota entra ai box al giro scelto, monta gomma nuova e risale seguendo la strategia,
// sorpassando i rivali — su mappa (pista.aggiorna) e su una torre (callback onTower).
//
// NON calcola nulla di nuovo. La fisica e' gia' nel cum di ogni giro; qui c'e' solo la messa
// in scena. Al giro-risposta il cum coincide con evaluatePit (garantito da traiettoriaPit),
// quindi l'animazione non puo' contraddire il numero del pannello.
//
// Le funzioni pure (costruisciCum / tempoReale / statoAl / righeTorre) sono testabili in
// Node senza DOM (test_ghostplay.mjs). creaGhostPlay aggiunge solo il loop rAF + il rendering.

// cumSim[d] = [{lap, cum}] dalla traiettoria; leadSim[L] = cum del battistrada al giro L.
export function costruisciCum(sim) {
  const { laps, cumByLap, present, freezeLap } = sim;
  const cum = {}, lead = {};
  for (const d of present) {
    const arr = [];
    for (const L of laps) { const c = cumByLap[L]?.[d]; if (c != null) arr.push({ lap: L, cum: c }); }
    if (arr.length) cum[d] = arr;
  }
  for (const L of laps) {
    let mn = Infinity;
    for (const d in cum) { const e = cum[d].find(x => x.lap === L); if (e && e.cum < mn) mn = e.cum; }
    if (mn < Infinity) lead[L] = mn;
  }
  // ancora prima del giro di congelamento, per interpolare la frazione del primo giro
  const l0 = laps[0];
  const durata = durataMediana(lead, laps);
  lead[l0 - 1] = (lead[l0] ?? 0) - durata;
  return { cum, lead, present, freezeLap, laps, nLap: laps[laps.length - 1], durata };
}

function durataMediana(lead, laps) {
  const d = [];
  for (let i = 1; i < laps.length; i++) {
    const a = lead[laps[i - 1]], b = lead[laps[i]];
    if (a != null && b != null && b > a) d.push(b - a);
  }
  d.sort((x, y) => x - y);
  return d.length ? d[d.length >> 1] : 90;
}

// ancora dell'animazione: p (giro frazionario) -> tempo T del battistrada simulato.
export function tempoReale(C, p) {
  const L = Math.max(C.freezeLap, Math.min(C.nLap, Math.floor(p))), f = Math.min(1, Math.max(0, p - L));
  const t0 = C.lead[L - 1], t1 = C.lead[L] ?? t0;
  if (t0 === undefined) return undefined;
  return t0 + f * (t1 - t0);
}

// inverso: dato un tempo T del battistrada -> la posizione p (giro-frazionario). Serve a
// fermare la fase 1 ESATTAMENTE al rientro del fantasma, senza dipendere dal frame-rate.
export function pDaTempo(C, T) {
  for (let L = C.freezeLap; L <= C.nLap; L++) {
    const a = C.lead[L - 1], b = C.lead[L];
    if (a == null || b == null) continue;
    if (T <= b) return L + (T - a) / ((b - a) || 1);
  }
  return C.nLap + 1;
}

// orologio-per-pilota sui cum simulati: al tempo T il pilota d e' nel suo giro con frazione fd.
function giroDi(cumD, leadL0, T) {
  if (!cumD || !cumD.length || !(T >= leadL0)) return null;
  let lo = 0, hi = cumD.length - 1, idx = cumD.length;
  if (cumD[hi].cum > T) { while (lo < hi) { const m = (lo + hi) >> 1; if (cumD[m].cum > T) hi = m; else lo = m + 1; } idx = lo; }
  if (idx >= cumD.length) return null;
  const fine = cumD[idx], inizio = idx > 0 ? cumD[idx - 1] : { lap: fine.lap - 1, cum: leadL0 };
  if (fine.lap !== inizio.lap + 1) return null;
  const fd = (T - inizio.cum) / ((fine.cum - inizio.cum) || 1);
  return { lap: fine.lap, fd: Math.min(1, Math.max(0, fd)) };
}

// stato completo al tempo T: array ordinato per progresso (leader primo), col fantasma marcato.
export function statoAl(C, T, { driver, pitLap, FE = 0.95, FX = 0.05 }) {
  const leadL0 = C.lead[C.laps[0] - 1] ?? C.lead[C.laps[0]];
  const arr = [];
  for (const d of C.present) {
    const g = giroDi(C.cum[d], leadL0, T);
    if (!g) continue;
    let box = null;
    if (d === driver) {                          // il fantasma transita in pit-lane al SUO giro di sosta
      if (g.lap === pitLap) box = g.fd >= FE ? 'in' : null;
      else if (g.lap === pitLap + 1) box = g.fd <= FX ? 'out' : null;
    }
    const inPit = (box === 'in' && g.fd >= FE) || (box === 'out' && g.fd <= FX);
    arr.push({ d, lap: g.lap, fd: g.fd, prog: g.lap + g.fd, box, inPit });
  }
  arr.sort((a, b) => b.prog - a.prog);
  return arr;
}

// righe della torre (posizione, gap in registro onesto), pronte da rendere.
export function righeTorre(stato, lapDur) {
  const leaderProg = stato.length ? stato[0].prog : 0;
  return stato.map((s, i) => {
    let gapTxt, gapCls = '';
    if (i === 0) { gapTxt = 'LEADER'; gapCls = 'lead'; }
    else {
      const dp = leaderProg - s.prog;
      if (dp >= 1) { const n = Math.floor(dp); gapTxt = `+${n} gir${n > 1 ? 'i' : 'o'}`; gapCls = 'lapped'; }
      else { const gs = Math.round(dp * lapDur); gapTxt = gs <= 0 ? 'in scia' : `+~${gs}s`; }
    }
    return { drv: s.d, pos: i + 1, leader: i === 0, inPit: s.inPit, box: s.box, gapTxt, gapCls };
  });
}

// ---- la messa in scena (browser): loop rAF + rendering su pista + callback torre ----
// pista: istanza di pista.mjs (aggiorna/pitFrazioni). coloreDi(sigla)->colore. onTower(righe,{lap}).
//
// DUE FASI, per riconciliare l'animazione col numero del pannello:
//   fase 1  freeze -> GIRO-RISPOSTA: il fantasma si ferma dove il pannello lo valuta
//           ("rientri 4º"). onRientro() scatta e la scena si mette in pausa: è LA RISPOSTA.
//   fase 2  giro-risposta -> bandiera: solo su richiesta (continua()). È una PROIEZIONE —
//           i rivali non reagiscono — e va detto. Senza giroRisposta: una fase sola, fino in fondo.
export function creaGhostPlay({ sim, pista, coloreDi, onTower, onFine, onRientro,
                                giroRisposta = null, durataTot = 16 }) {
  const C = costruisciCum(sim);
  const FE = pista?.pitFrazioni?.ingresso ?? 0.95, FX = pista?.pitFrazioni?.uscita ?? 0.05;
  const opts = { driver: sim.driver, pitLap: sim.pitLap, FE, FX };
  const pMin = C.freezeLap, pMaxPieno = C.nLap + 1;
  const giroRisp = (giroRisposta && giroRisposta <= C.nLap && giroRisposta >= C.freezeLap) ? giroRisposta : null;
  // pStop = posizione (giro-frazionario del battistrada) all'ISTANTE in cui il fantasma
  // completa il giro-risposta. Fermarsi lì è esatto e NON dipende dal frame-rate: p viene
  // clampato, così la scena non può sfilare oltre il rientro anche se un frame salta.
  const rejoinCum = giroRisp != null ? (C.cum[opts.driver] || []).find(e => e.lap === giroRisp)?.cum : null;
  const pStop = (rejoinCum != null) ? pDaTempo(C, rejoinCum) : pMaxPieno;
  const giriRest = Math.max(1, pMaxPieno - pMin);
  const lapSec = Math.min(1.2, Math.max(0.35, durataTot / giriRest));
  let p = pMin, raf = null, last = null, vivo = false, fase = 1;

  function frame(T) {
    const stato = statoAl(C, T, opts);
    const dots = stato.map(s => ({
      f: s.fd, box: s.box, colore: coloreDi(s.d) || 'var(--dim)', sigla: s.d,
      ghost: s.d === opts.driver, dim: s.d !== opts.driver,
    }));
    if (pista) pista.aggiorna(dots);
    if (onTower) onTower(righeTorre(stato, C.durata), { lap: Math.round(p) });
  }

  function step(ts) {
    if (!vivo) return;
    if (last == null) last = ts;
    const dt = (ts - last) / 1000; last = ts;
    const cap = (fase === 1) ? pStop : pMaxPieno;   // fase 1 non supera il rientro
    p = Math.min(cap, p + dt / lapSec);
    const T = tempoReale(C, p);
    if (T !== undefined) frame(T);
    if (fase === 1 && giroRisp != null && p >= pStop) { vivo = false; last = null; onRientro && onRientro(); return; }
    if (p >= pMaxPieno) { vivo = false; last = null; onFine && onFine(); return; }
    raf = requestAnimationFrame(step);
  }

  return {
    play() { if (vivo) return; if (p >= pMaxPieno) { p = pMin; fase = 1; } vivo = true; last = null; raf = requestAnimationFrame(step); },
    stop() { vivo = false; last = null; if (raf) cancelAnimationFrame(raf); },
    continua() { fase = 2; if (vivo) return; vivo = true; last = null; raf = requestAnimationFrame(step); },  // fino alla bandiera (proiezione)
    riparti() { this.stop(); p = pMin; fase = 1; this.play(); },
    get playing() { return vivo; },
    get haRientro() { return giroRisp != null; },
    _C: C,   // per i test
  };
}
