// ghostplay.mjs — la SOSTA MESSA IN SCENA, condivisa. Consuma un oggetto `sim`
// {laps, cumByLap, present, freezeLap} e lo anima: il pallino del pilota entra ai box al
// giro scelto, monta gomma nuova e risale seguendo la strategia, sorpassando i rivali —
// su mappa (pista.aggiorna) e su una torre (callback onTower).
//
// DA DOVE ARRIVA QUEL `sim`, dal 31/07/2026: in produzione dalla traccia del simulatore
// nuovo, passata per l'adattatore fantasma_sim.mjs::simDaFantasma — cosi' in gara.html
// (traccia pre-calcolata, letta col resto della vista) come in live.html (traccia che il
// motore produce sul momento). Prima arrivava da traiettoriaPit: e' cambiata la SORGENTE,
// non la forma, ed e' il motivo per cui questo modulo non ha dovuto muoversi. Il banco
// (test_ghostplay.mjs) lo esercita ancora anche contro traiettoriaPit, che la stessa
// forma la produce.
//
// NON calcola nulla di nuovo. La fisica e' gia' nel cum di ogni giro; qui c'e' solo la
// messa in scena. Al giro-risposta il cum coincide con quello del pannello — perche' la
// traccia e la risposta escono dalla STESSA generazione, non perche' qualcuno le
// riallinei — quindi l'animazione non puo' contraddire il numero mostrato.
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

// righe della torre a gap GREZZO (prog·durata). Tenuta per retro-compatibilità/test; la
// torre usa classificaSim, che dà gap PRECISI col modello del replay reale.
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

// classifica-sim al giro frazionario p, col PRECISO gap in secondi — STESSO modello del
// replay reale (gara.html::classificaAt): cum interpolato a (L, f), ordine per icum, e i
// doppiati contati sul battistrada ai giri L..L+3. Sostituisce il gap grezzo di righeTorre.
export function classificaSim(C, p, opts = {}) {
  const { driver = null, pitLap = null } = opts;
  const L = Math.max(C.freezeLap, Math.min(C.nLap, Math.floor(p)));
  const f = Math.min(1, Math.max(0, p - L));
  const cumA = (d, k) => (C.cum[d] || []).find(x => x.lap === k)?.cum;
  const cumL = {}, ic = {};
  for (const d of C.present) {
    const cur = cumA(d, L); if (cur == null) continue;
    cumL[d] = cur;
    const pv = cumA(d, L - 1) ?? C.lead[L - 1];
    ic[d] = (typeof pv === 'number') ? pv + f * (cur - pv) : cur;   // cum interpolato a (L, f)
  }
  const lag = {};                                     // battistrada ai giri L..L+3 (per i doppiati)
  for (let k = L; k <= Math.min(L + 3, C.nLap); k++) {
    let mn = Infinity;
    for (const d of C.present) { const c = cumA(d, k); if (c != null && c < mn) mn = c; }
    if (mn < Infinity) lag[k] = mn;
  }
  const ord = Object.keys(ic).sort((a, b) => ic[a] - ic[b]);
  const leader = ord.length ? ic[ord[0]] : 0;
  return ord.map((d, i) => {
    let gd = 0; for (const k in lag) if (+k > L && cumL[d] > lag[k]) gd = +k - L;
    let gapTxt, gapCls = '';
    if (gd >= 1) { gapTxt = `+${gd} gir${gd > 1 ? 'i' : 'o'}`; gapCls = 'lapped'; }
    else if (i === 0) { gapTxt = 'LEADER'; gapCls = 'lead'; }
    else gapTxt = `+${(ic[d] - leader).toFixed(1)}s`;
    return { drv: d, pos: i + 1, leader: i === 0, gapTxt, gapCls, inPit: d === driver && L === pitLap };
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
  const DWELL_S = 1.3;                     // sosta ferma ai box, per rendere visibile il pit stop
  let p = pMin, raf = null, last = null, vivo = false, fase = 1;
  let ghostInPit = false, dwelled = false, dwelling = false, dwellAcc = 0;

  function frame(T) {
    const stato = statoAl(C, T, opts);
    const dots = stato.map(s => ({
      f: s.fd, box: s.box, colore: coloreDi(s.d) || 'var(--dim)', sigla: s.d,
      ghost: s.d === opts.driver, dim: s.d !== opts.driver, pit: s.d === opts.driver && s.inPit,
    }));
    if (pista) pista.aggiorna(dots);
    if (onTower) onTower(classificaSim(C, p, opts), { lap: Math.round(p), p });
    const g = stato.find(s => s.d === opts.driver);
    ghostInPit = !!(g && g.inPit);
  }

  function step(ts) {
    if (!vivo) return;
    if (last == null) last = ts;
    const dt = (ts - last) / 1000; last = ts;
    if (dwelling) {                          // fermi ai box: non si avanza, si ridisegna e basta
      dwellAcc += dt; if (dwellAcc >= DWELL_S) dwelling = false;
      const T = tempoReale(C, p); if (T !== undefined) frame(T);
      raf = requestAnimationFrame(step); return;
    }
    const cap = (fase === 1) ? pStop : pMaxPieno;   // fase 1 non supera il rientro
    p = Math.min(cap, p + dt / lapSec);
    const T = tempoReale(C, p);
    if (T !== undefined) frame(T);
    // primo istante in pit-lane -> sosta ferma (una volta): il pit stop si vede
    if (!dwelled && ghostInPit) { dwelling = true; dwelled = true; dwellAcc = 0; }
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
