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

// QUANTA PARTE DEL GIRO SI PASSA IN CORSIA, e perche' non e' una costante.
//
// Prima il transito era l'ultimo 5% del giro (FE = 0,95), un numero del generatore delle
// piste. Ma il giro di sosta DURA di piu' proprio perche' contiene la sosta: all'Ungheria
// l'in-lap del kernel e' 107,2 s contro 85,6 di media, cioe' 21,2 s di perdita — il 19,8%
// del giro, non il 5%. Con la finestra costante il pallino restava sul nastro per sedici
// secondi mentre l'auto era ai box, e poi saltava in corsia per cinque: si vedeva un giro
// lento, non una sosta. Qui la quota si MISURA sul giro stesso.
function quotaBox(C, d, lap) {
  const arr = C.cum[d];
  if (!arr) return null;
  const i = arr.findIndex((x) => x.lap === lap);
  if (i < 0) return null;
  const prima = i > 0 ? arr[i - 1].cum : C.lead[lap - 1];
  if (prima == null) return null;
  const dur = arr[i].cum - prima;
  if (!(dur > 0) || !(C.durata > 0)) return null;
  return Math.min(0.45, Math.max(0.10, (dur - C.durata) / dur));
}

// Dentro la finestra: entra, STA FERMO al box, esce. `u` e' il progresso nella finestra.
// La quota ferma e' il 16% del transito: su una perdita da ~21 s fa ~3,4 s sulla piazzola,
// che e' l'ordine di grandezza di una sosta vera. Il resto e' corsia a velocita' limitata.
const U_BOX = 0.42, U_VIA = 0.58;
function inCorsia(u) {
  if (u < U_BOX) return { lane: 0.5 * (u / U_BOX), fermo: false };
  if (u < U_VIA) return { lane: 0.5, fermo: true };
  return { lane: 0.5 + 0.5 * ((u - U_VIA) / (1 - U_VIA)), fermo: false };
}

// stato completo al tempo T: array ordinato per progresso (leader primo), col fantasma marcato.
//
// `soste` (13/08/2026) e' {sigla: Set(giri di sosta)} e vale per TUTTI, non solo per il
// soggetto: prima la marcatura era dentro un `if (d === driver)`, quindi le quaranta soste
// vere dei rivali durante la scena si vedevano come giri lenti in mezzo alla pista.
// `pitLap` resta accettato da solo per i banchi e per chi passa un fantasma unico.
export function statoAl(C, T, { driver, pitLap, soste = null, FE = 0.95 }) {
  const leadL0 = C.lead[C.laps[0] - 1] ?? C.lead[C.laps[0]];
  const dove = soste || (pitLap != null && driver ? { [driver]: new Set([pitLap]) } : {});
  const arr = [];
  for (const d of C.present) {
    const g = giroDi(C.cum[d], leadL0, T);
    if (!g) continue;
    let box = null, lane = null, fermo = false;
    // `tau` e' la frazione di tempo del giro spesa GUIDANDO. Su un giro normale coincide con
    // fd; sul giro di sosta no, perche' li' una fetta del tempo se ne va in corsia box: senza
    // rinormalizzare, il pallino resterebbe indietro per tutto il giro d'ingresso.
    let tau = g.fd;
    if (dove[d]?.has(g.lap)) {
      const q = quotaBox(C, d, g.lap) ?? (1 - FE);
      const inizio = 1 - q;
      if (g.fd >= inizio) {
        box = 'in';
        ({ lane, fermo } = inCorsia(Math.min(1, (g.fd - inizio) / q)));
      } else tau = g.fd / inizio;
    }
    arr.push({ d, lap: g.lap, fd: g.fd, tau, prog: g.lap + g.fd, box, lane, fermo, inPit: box === 'in' });
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
                                durateVere = null, velocita = 1, profilo = null }) {
  const C = costruisciCum(sim);
  const FE = pista?.pitFrazioni?.ingresso ?? 0.95;
  // `sim.soste` = {sigla: [giri]} per TUTTO il campo; `sim.pitLap` resta il fantasma solo.
  const soste = {};
  for (const [d, giri] of Object.entries(sim.soste || {})) soste[d] = new Set(giri);
  if (sim.pitLap != null && sim.driver) (soste[sim.driver] ||= new Set()).add(sim.pitLap);
  const opts = { driver: sim.driver, pitLap: sim.pitLap, soste, FE };
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
  // p0 (08/08): la scena puo' PARTIRE da un giro arbitrario — serve al BOX ORA di
  // gara.html, dove la sosta si aggiunge mentre la gara scorre e la scena riparte
  // dall'ISTANTE corrente (non dal giro intero prima: era il salto all'indietro).
  let fase = 1;
  let rientrato = false;

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
  // LA SOSTA NON FERMA PIU' LA GARA (13/08/2026). Qui c'era
  // `setDur(L => dwelling ? Infinity : ...)`: con durata infinita `p` non avanzava affatto,
  // quindi per 1,3 s si congelavano TUTTE E VENTIDUE le auto invece della sola che era ai
  // box — ed era un booleano unico per tutta la scena, quindi alla seconda e alla terza
  // sosta la pausa non scattava piu'. Adesso il fermo e' un fatto del singolo pilota: sta
  // nella posizione in corsia (`inCorsia`), che tiene il suo pallino sulla piazzola mentre
  // il resto del campo continua a scorrere.
  clock.setDur(lapSecDi);
  clock.setSpeed(velocita);
  // IL FOTOGRAMMA CHE NON VA DISEGNATO. `reset` riporta l'orologio a `pMin` e SUONA un
  // onTick: se poi si salta a `p0`, quel primo fotogramma ha gia' disegnato il campo al
  // giro di congelamento — dove ogni pilota ha frazione zero e le ventidue auto stanno
  // tutte sulla linea. Dura 1/60 di secondo, ma e' un lampo visibile, ed e' un pallino che
  // torna INDIETRO di 355 m fra due fotogrammi: l'unico della gara intera, trovato
  // giocandola. Si tace fino al primo istante vero.
  let pronto = p0 == null;
  clock.reset(pMaxPieno);
  if (p0 != null) {
    clock.seek(Math.min(Math.max(p0, pMin), pMaxPieno));
    pronto = true;
    aggiorna(clock.position);
  }

  function aggiorna(p) {
    if (!pronto) return;
    const T = tempoReale(C, p);
    if (T !== undefined) frame(T, p);
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
      // LA FRAZIONE DI TEMPO NON E' LA FRAZIONE DI NASTRO. Il profilo del circuito
      // (profilo_giro.mjs, misurato dal GPS di questa gara) fa la traduzione: senza, la scena
      // assume velocita' uniforme e i pallini stanno 250 m fuori posto — che e' esattamente
      // il salto che si vedeva premendo BOX ORA, quando si passava dal GPS a questa stima.
      // `prog` resta in TEMPO: e' quello che ordina il campo, e ordinare per distanza
      // percorsa a giri diversi non vorrebbe dire niente.
      f: profilo ? profilo(s.tau) : s.fd,
      box: s.box, lane: s.lane, colore: coloreDi(s.d) || 'var(--dim)', sigla: s.d,
      ghost: s.d === opts.driver, dim: s.d !== opts.driver, pit: s.fermo,
      // I PALLINI DELLA SCENA SONO STIMATI, e da oggi lo dicono. Il replay li disegna
      // pieni perche' la posizione viene dal GPS; qui viene dai cumulati per giro, cioe'
      // e' ricostruita. Era l'unica pagina del sito che perdeva la distinzione.
      stimato: true,
    }));
    if (pista) pista.aggiorna(dots);
    // IL CONTAGIRI USA floor COME IL REPLAY. Con Math.round, a p = 15,6 la scena scriveva
    // 16 mentre la barra diceva 15, e alla bandiera (p = nLap+1) usciva «GIRO 71 / 70»:
    // un giro che in quella gara non esiste.
    if (onTower) onTower(classificaSim(C, p, opts), { lap: Math.min(C.nLap, Math.floor(p)), p });
  }

  return {
    play() { if (clock.position >= pMaxPieno) { fase = 1; clock.seek(pMin); } clock.play(); },
    stop() { clock.pause(); },
    continua() { fase = 2; clock.play(); },   // fino alla bandiera (proiezione)
    riparti() { clock.pause(); fase = 1; rientrato = false; clock.seek(pMin); clock.play(); },
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
