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

import { creaAncora, giroDi as giroDiCum } from './orologio.mjs?v=250808a';
import { makeClock } from './timeline.mjs?v=220726a';
import { classifica as classificaCondivisa, battistradaAiGiri } from './classifica.mjs?v=250809a';

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

// L'ARITMETICA DEL TEMPO E' CONDIVISA con la pagina-gara: demo/orologio.mjs. Prima queste
// tre funzioni erano una copia di quelle di gara.html, con la stessa ricerca binaria e lo
// stesso calcolo della frazione su una sorgente di cum diversa (simulata invece che reale).
// Restano esportate perche' il banco (test_ghostplay.mjs) le esercita, ma ora sono involucri
// che dichiarano solo COME la scena e' diversa: comincia al giro di CONGELAMENTO, quindi il
// suo primo campione non va respinto (lapZero = laps[0]-1, non 0) e la frazione si clampa.
export function tempoReale(C, p) {
  return ancoraDi(C).tempoDa(p);
}

// inverso: dato un tempo T del battistrada -> la posizione p (giro-frazionario). Serve a
// fermare la fase 1 ESATTAMENTE al rientro del fantasma, senza dipendere dal frame-rate.
export function pDaTempo(C, T) {
  return ancoraDi(C).pDaTempo(T);
}

// una sola ancora per traccia, tenuta accanto alla traccia stessa
function ancoraDi(C) {
  return (C._ancora ||= creaAncora({ lead: C.lead, minLap: C.freezeLap, maxLap: C.nLap }));
}

// orologio-per-pilota sui cum simulati: al tempo T il pilota d e' nel suo giro con frazione fd.
// lapZero e' PER PILOTA — il giro prima del suo primo campione — e non una costante della
// scena: il codice di prima ancorava con `{lap: fine.lap - 1}`, cioe' si adattava al primo
// giro DI QUEL pilota. Un pilota i cui dati cominciano dopo il congelamento (perche' entra
// piu' tardi nella traccia) veniva accettato, e deve continuare a esserlo. Fissare lapZero
// al congelamento della scena lo avrebbe respinto: un pallino che sparisce, in silenzio.
function giroDi(cumD, leadL0, T) {
  if (!cumD || !cumD.length) return null;
  return giroDiCum(cumD, T, { tempoZero: leadL0, lapZero: cumD[0].lap - 1, clamp: true });
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
  // celle nella forma che il modulo condiviso si aspetta: {sigla: {cum_time}}
  const celleAl = k => {
    const o = {};
    for (const d of C.present) { const c = cumA(d, k); if (c != null) o[d] = { cum_time: c }; }
    return Object.keys(o).length ? o : null;
  };
  const righe = classificaCondivisa({
    cumCorrente: celleAl(L), cumPrecedente: celleAl(L - 1),
    ancora: C.lead[L - 1], primoGiro: false, f, L, nLap: C.nLap,
    battistrada: battistradaAiGiri(celleAl, L, C.nLap),
    // la scena NON ordina a pari merito e RIPIEGA sul battistrada quando un pilota non ha
    // il proprio giro precedente: al congelamento non ce l'ha nessuno, e senza ripiego i
    // distacchi resterebbero fermi. Erano le due differenze con la pagina-gara, e restano.
    pareggio: 'scena', ripiegoAncora: true,
  });
  return righe.map(r => ({
    drv: r.drv, pos: r.pos, leader: r.pos === 1, gapTxt: r.et, gapCls: r.cls,
    inPit: r.drv === driver && L === pitLap,
  }));
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
                                giroRisposta = null, durataTot = 16, p0 = null,
                                durateVere = null }) {
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
  const lapSecFisso = Math.min(1.2, Math.max(0.35, durataTot / giriRest));
  // DUE ANDATURE, e adesso si sceglie. `durateVere` (giro -> secondi reali) fa correre la
  // scena come la gara: a 1x un giro dura quello che e' durato, e i tasti 1/2/4x... dicono
  // la verita'. Senza, resta la compressione di sempre.
  const lapSecDi = durateVere ? (L) => (durateVere(L) || lapSecFisso) : () => lapSecFisso;
  const DWELL_S = 1.3;                     // sosta ferma ai box, per rendere visibile il pit stop
  // p0 (08/08): la scena puo' PARTIRE da un giro arbitrario — serve al BOX ORA di
  // gara.html, dove la sosta si aggiunge mentre la gara scorre e la scena riparte
  // dal giro corrente, non dal congelamento. Assente = comportamento di sempre.
  let fase = 1;
  let ghostInPit = false, dwelled = false, dwelling = false, dwellFino = 0, rientrato = false;

  // L'OROLOGIO E' QUELLO DELLA PAGINA-GARA (timeline.mjs::makeClock), non un secondo loop
  // rAF scritto qui. Prima ce n'erano due che facevano la stessa cosa — avanzare p nel
  // tempo — e solo uno dei due sapeva mettersi in pausa, cambiare velocita' e farsi
  // trascinare. Ora ne resta uno, e la scena eredita quelle tre cose.
  //
  // IL RITMO: due andature, e dal 10/08/2026 SI SCEGLIE (prima era imposta).
  //
  // La scena nasceva come «proiezione da guardare in venti secondi»: durataTot spalmato sui
  // giri rimasti, cioe' una costante. Con 65 giri da correre veniva 0,35 s/giro, cioe' 229
  // VOLTE il tempo reale: a 60 fotogrammi il pallino avanzava di 209 metri per fotogramma —
  // «a scatti», ma non per un difetto di disegno: per l'andatura. E soprattutto la gara
  // finiva prima che si potesse premere BOX ORA una seconda volta, quindi il multi-sosta
  // c'era, era scritto anche nel messaggio in pagina, ed era irraggiungibile.
  //
  // Con `durateVere` la scena corre come la gara: a 1x un giro dura i secondi che e' durato
  // davvero, i giri sotto Safety Car restano lenti, e i tasti di velocita' dicono la verita'.
  // La compressione resta per chi non passa le durate (i banchi).
  const clock = makeClock({
    min: pMin,
    onTick: (p, ts) => aggiorna(p, ts),
    onEnd: () => { onFine && onFine(); },
  });
  clock.setDur((L) => dwelling ? Infinity : lapSecDi(L));   // Infinity = p non avanza (sosta ferma)
  clock.reset(pMaxPieno);
  if (p0 != null) clock.seek(Math.min(Math.max(p0, pMin), pMaxPieno));

  function aggiorna(p, ts) {
    // la sosta ferma si conta sul TIMESTAMP DEL FRAME, non sull'ora di sistema: e' la
    // stessa base dei tempi con cui l'orologio fa avanzare p, ed e' l'unica che i banchi
    // possono pilotare (pompano rAF a mano). Con l'ora di sistema la sosta non sarebbe
    // scaduta mai a orologio simulato, e la scena sarebbe rimasta ferma per sempre.
    if (dwelling && ts != null && ts >= dwellFino) dwelling = false;
    const T = tempoReale(C, p);
    if (T !== undefined) frame(T, p);
    // primo istante in pit-lane -> sosta ferma (una volta): il pit stop si vede
    if (!dwelled && ghostInPit && ts != null) {
      dwelled = true; dwelling = true;
      dwellFino = ts + DWELL_S * 1000;
    }
    // la fase 1 non supera il rientro: ci si ferma sull'ISTANTE esatto, non sul frame.
    // `rientrato` non e' un ornamento: seek() richiama onTick, che rientrerebbe qui e
    // chiamerebbe seek di nuovo — ricorsione infinita al primo frame oltre pStop.
    if (fase === 1 && giroRisp != null && !rientrato && p >= pStop) {
      rientrato = true;
      clock.pause();
      if (p > pStop) clock.seek(pStop);
      onRientro && onRientro();
    }
  }

  function frame(T, p) {
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

  return {
    play() { if (clock.position >= pMaxPieno) { fase = 1; clock.seek(pMin); } clock.play(); },
    stop() { clock.pause(); },
    continua() { fase = 2; clock.play(); },   // fino alla bandiera (proiezione)
    riparti() { clock.pause(); fase = 1; rientrato = false; dwelled = dwelling = false; clock.seek(pMin); clock.play(); },
    // TRASPORTO, che la scena prima non aveva: si puo' mettere in pausa, scorrere e
    // cambiare velocita' come nel replay reale. Arriva gratis dall'orologio condiviso.
    seek(p) { clock.seek(Math.min(Math.max(p, pMin), pMaxPieno)); },
    setSpeed(s) { clock.setSpeed(s); },
    get playing() { return clock.playing; },
    get posizione() { return clock.position; },   // giro-frazionario corrente (per aggiungere soste al volo)
    get haRientro() { return giroRisp != null; },
    get estremi() { return { min: pMin, max: pMaxPieno }; },
    _C: C,   // per i test
  };
}
