// s30_compressione — la neutralizzazione comprime i distacchi, e solo quelli.
//
// PERCHE' ESISTE. Per far entrare la compressione il ciclo del kernel e' passato
// da per-pilota a PER GIRO: e' la modifica piu' invasiva mai fatta al pezzo piu'
// delicato del repo. I golden (s09) coprono il termine spento; questa sentinella
// copre il termine acceso, e soprattutto copre l'unica cosa che i golden non
// possono vedere — che spento sia DAVVERO spento su casi che i golden non hanno.
//
// COSA FA FALLIRE QUESTA SENTINELLA:
//  (a) kappa = 1, oppure una finestra vuota, oppure `null`, NON danno gli stessi
//      identici numeri della simulazione senza il parametro: il termine spento
//      non sarebbe spento, ed e' la sonda obbligatoria della PREREG-2;
//  (b) la compressione non produce gap(k+1) = gap(k)*kappa dentro la finestra:
//      allora il codice non fa cio' che la pre-registrazione descrive;
//  (c) la compressione continua OLTRE la finestra: sarebbe prevedere una Safety
//      Car futura (E14), il difetto piu' facile da introdurre qui;
//  (d) il LEADER viene spostato: la compressione e' relativa a lui, quindi il suo
//      cum non deve cambiare di un millesimo;
//  (e) chi entra ai BOX nel giro compresso viene compresso lo stesso: il suo
//      distacco lo decide la sosta, non la vettura di sicurezza — ed e' il caso
//      che la misura di kappa escludeva;
//  (f) parametri malformati passano in silenzio invece di fallire (E07);
//  (g) l'ordine delle chiavi della traccia cambia: i golden confrontano JSON, e
//      una chiave spostata li romperebbe senza che nessun numero sia sbagliato.

import { banco } from '../asserzioni.mjs';
import { simulate } from '../../engine/kernel.mjs';

const b = banco('s30');

const LF = 10;
// passo finto ma NON costante: se lo fosse, i distacchi non evolverebbero da soli
// e (b) passerebbe anche con la compressione scollegata.
const passi = { UNO: 90, DUE: 91, TRE: 92.5, QUATTRO: 89.5 };
const pace = (drv, giro) => passi[drv] + (giro % 3) * 0.05;
const stato = Object.keys(passi).map((drv, i) => ({ drv, lap: LF, cum_time: 1000 + i * 12, tyre_age: 5 }));
const corri = (extra = {}) => simulate({ state: stato, pace, freezeLap: LF, steps: 6, ...extra });

// ────────────────────────────────── (a) spento e' spento — la sonda obbligatoria
const senza = corri();
b.uguale('neutralizzazione assente ≡ null', corri({ neutralizzazione: null }).cum, senza.cum);
b.uguale('kappa = 1 su ogni giro ≡ spento',
  corri({ neutralizzazione: { perGiro: { [LF + 1]: 1, [LF + 2]: 1 } } }).cum, senza.cum);
b.uguale('mappa vuota ≡ spento', corri({ neutralizzazione: { perGiro: {} } }).cum, senza.cum);

// ──────────────────────────── (b)(c)(d) la forma, dentro e fuori dalla finestra
{
  const KAPPA = 0.7;
  const FINO = LF + 3;
  const finestra = {}; for (let l = LF + 1; l <= FINO; l += 1) finestra[l] = KAPPA;
  const conT = corri({ neutralizzazione: { perGiro: finestra }, traccia: true });
  const senzaT = corri({ traccia: true });
  const cumA = (r, drv, lap) => r.traccia[drv].find((x) => x.lap === lap).cum_time;

  // (d) il leader non si muove: e' il riferimento, non un partecipante
  const leader = 'UNO';   // ha il cum piu' basso al congelamento e il passo piu' rapido
  for (let lap = LF + 1; lap <= LF + 6; lap += 1) {
    b.verifica(`il leader non viene spostato al giro ${lap}`,
      Math.abs(cumA(conT, leader, lap) - cumA(senzaT, leader, lap)) < 1e-9);
  }

  // (b) dentro la finestra: gap(k+1) = gap(k) * kappa, esatto
  for (const drv of ['DUE', 'TRE', 'QUATTRO']) {
    let gapPrec = stato.find((s) => s.drv === drv).cum_time - stato.find((s) => s.drv === leader).cum_time;
    for (let lap = LF + 1; lap <= FINO; lap += 1) {
      const atteso = gapPrec * KAPPA;
      const reale = cumA(conT, drv, lap) - cumA(conT, leader, lap);
      b.verifica(`${drv} giro ${lap}: gap ${reale.toFixed(6)} = gap precedente × ${KAPPA} (${atteso.toFixed(6)})`,
        Math.abs(reale - atteso) < 1e-9);
      gapPrec = reale;
    }
  }

  // (c) fuori dalla finestra la compressione SMETTE: il gap torna a evolvere dal
  // passo, quindi la sua variazione dev'essere quella del modello, non × kappa
  for (const drv of ['DUE', 'TRE', 'QUATTRO']) {
    const gapFino = cumA(conT, drv, FINO) - cumA(conT, leader, FINO);
    const gapDopo = cumA(conT, drv, FINO + 1) - cumA(conT, leader, FINO + 1);
    const daPasso = (cumA(senzaT, drv, FINO + 1) - cumA(senzaT, drv, FINO))
                  - (cumA(senzaT, leader, FINO + 1) - cumA(senzaT, leader, FINO));
    b.verifica(`${drv}: oltre la finestra il gap evolve dal passo (${(gapDopo - gapFino).toFixed(6)} = ${daPasso.toFixed(6)})`,
      Math.abs((gapDopo - gapFino) - daPasso) < 1e-9);
    b.verifica(`${drv}: oltre la finestra il gap NON è × kappa`, Math.abs(gapDopo - gapFino * KAPPA) > 1e-6);
  }

  // il termine fa DAVVERO qualcosa: senza questo, (b) passerebbe su numeri fermi
  b.verifica('la compressione cambia i distacchi in modo misurabile',
    Math.abs(conT.cum.QUATTRO - senzaT.cum.QUATTRO) > 1);
}

// ─────────────────── (e) chi entra ai box nel giro compresso non si comprime
{
  const KAPPA = 0.5;
  const conSosta = simulate({
    state: stato, pace, freezeLap: LF, steps: 4, traccia: true,
    pits: { TRE: [{ lap: LF + 2, perdita: 20 }] },
    neutralizzazione: { perGiro: { [LF + 1]: KAPPA, [LF + 2]: KAPPA, [LF + 3]: KAPPA } },
  });
  const senzaComp = simulate({
    state: stato, pace, freezeLap: LF, steps: 4, traccia: true,
    pits: { TRE: [{ lap: LF + 2, perdita: 20 }] },
  });
  const at = (r, drv, lap) => r.traccia[drv].find((x) => x.lap === lap).cum_time;
  // al giro della sosta il suo cum e' quello del modello: la sosta comanda
  const dModello = at(senzaComp, 'TRE', LF + 2) - at(senzaComp, 'TRE', LF + 1);
  const dReale = at(conSosta, 'TRE', LF + 2) - at(conSosta, 'TRE', LF + 1);
  b.verifica(`chi si ferma al giro compresso avanza del suo passo + perdita (${dReale.toFixed(3)} = ${dModello.toFixed(3)})`,
    Math.abs(dReale - dModello) < 1e-9);
  // e la perdita c'e' tutta: 20 s non si sciolgono nella compressione
  b.verifica('la perdita ai box sopravvive alla compressione', dReale > 20);
}

// ──────────────────────────────── (f) i parametri malformati fanno rumore
for (const cattivo of [{ perGiro: { [LF + 1]: 0 } }, { perGiro: { [LF + 1]: -0.5 } }, { perGiro: { [LF + 1]: 'mezzo' } },
  { perGiro: null }, {}, { perGiro: { [LF + 99]: 0.7 } }, { perGiro: { [LF]: 0.7 } }, 'comprimi']) {
  b.esplode(`neutralizzazione malformata rifiutata: ${JSON.stringify(cattivo)}`,
    () => corri({ neutralizzazione: cattivo }));
}

// ───────── (h) kappa DIVERSO per giro: è la forma che serve alla PREREG-4
// Comprimere "in attesa" vuol dire κ_eff(k) = p(k)·κ + (1−p(k)): un numero
// diverso a ogni giro, che tende a 1 man mano che la Safety Car probabilmente
// rientra. Se il kernel applicasse lo stesso κ a tutta la finestra, quella
// ipotesi non sarebbe nemmeno esprimibile.
{
  const perGiro = { [LF + 1]: 0.8, [LF + 2]: 0.9, [LF + 3]: 0.97 };
  const r = corri({ neutralizzazione: { perGiro }, traccia: true });
  const at = (drv, lap) => r.traccia[drv].find((x) => x.lap === lap).cum_time;
  let gapPrec = stato.find((s) => s.drv === 'DUE').cum_time - stato.find((s) => s.drv === 'UNO').cum_time;
  for (const lap of [LF + 1, LF + 2, LF + 3]) {
    const atteso = gapPrec * perGiro[lap];
    const reale = at('DUE', lap) - at('UNO', lap);
    b.verifica(`giro ${lap}: comprime del suo κ (${perGiro[lap]}), non di quello del giro prima`,
      Math.abs(reale - atteso) < 1e-9);
    gapPrec = reale;
  }
  // e un giro SENZA voce nella mappa non si comprime affatto
  const gap3 = at('DUE', LF + 3) - at('UNO', LF + 3);
  const gap4 = at('DUE', LF + 4) - at('UNO', LF + 4);
  b.verifica('un giro fuori dalla mappa non viene compresso', Math.abs(gap4 - gap3 * 0.97) > 1e-6);
}

// ────────────────────── (g) la traccia conserva l'ordine delle chiavi di sempre
{
  const r = corri({ traccia: true });
  b.uguale('le chiavi della traccia sono quelle di sempre, in ordine',
    Object.keys(r.traccia.UNO[0]), ['lap', 'lap_time', 'cum_time', 'tyre_age', 'in_lap']);
}

b.chiudi();
