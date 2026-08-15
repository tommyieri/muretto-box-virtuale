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
//      una chiave spostata li romperebbe senza che nessun numero sia sbagliato;
//  (h) LA TERZA FORMA (15/08, PREREG_terza_forma.md) smette di essere la STESSA
//      legge: `forma: 'leader'` deve produrre gli identici gap(k+1) = gap(k)*kappa
//      della seconda forma — cambia CHI paga, non quanto si comprime. Se i gap
//      divergono non e' una consegna diversa, e' un modello diverso (cancello T6);
//  (i) nella terza forma qualcuno ACCORCIA il proprio giro: la traslazione deve
//      rendere ogni delta >= 0, e il pavimento non deve legare mai (cancello T2).
//      Se lega, l'aritmetica dello scarto e' sbagliata;
//  (j) `forma` assente non e' identica a `forma: 'inseguitori'`, o una forma
//      sconosciuta passa in silenzio invece di esplodere; o il SOFFITTO (il
//      gemello del pavimento) non lega, oppure lega ACCORCIANDO un giro.

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

// ────────────────── (a-bis) IL PAVIMENTO: spento e' spento, e acceso morde davvero
// Stessa famiglia della sonda qui sopra, per l'ingresso aggiunto il 14/08
// (PREREG_compressione_pavimento_2.md, cancello D6). Il pavimento e' il giro verde piu'
// veloce del circuito: la compressione non puo' consegnare kappa producendo un giro piu'
// rapido di quello. Senza pavimento il ramo non deve esistere; con un pavimento assurdo
// deve legare su tutto; con un valore malformato deve ESPLODERE, non passare in silenzio.
{
  const FINO = LF + 3;
  const finestra = {}; for (let l = LF + 1; l <= FINO; l += 1) finestra[l] = 0.7;
  const conKappa = corri({ neutralizzazione: { perGiro: finestra } });
  b.uguale('pavimento assente ≡ pavimento null',
    corri({ neutralizzazione: { perGiro: finestra, pavimento: null } }).cum, conKappa.cum);
  // 1 s: nessun giro di questo banco ci arriva sotto, quindi il vincolo non lega mai
  b.uguale('un pavimento che nessuno tocca non cambia un bit',
    corri({ neutralizzazione: { perGiro: finestra, pavimento: 1 } }).cum, conKappa.cum);
  // Un pavimento sopra OGNI giro (200 s contro i ~90 di questo banco) annulla il regalo
  // per intero, e i numeri tornano quelli senza compressione. NON alza i giri a 200: il
  // vincolo cancella il tempo REGALATO, non ne aggiunge di nuovo — e' il `Math.min(0, …)`
  // del kernel, ed e' la meta' della forma che si dimentica per prima.
  const alto = corri({ neutralizzazione: { perGiro: finestra, pavimento: 200 }, traccia: true });
  b.verifica('un pavimento sopra ogni giro lega su tutti i compressi', alto.clampPavimento > 0);
  b.uguale('e annulla la compressione invece di aggiungere tempo', alto.cum, senza.cum);
  b.esplode('un pavimento malformato non passa in silenzio',
    () => corri({ neutralizzazione: { perGiro: finestra, pavimento: 'presto' } }));
  b.esplode('un pavimento negativo non passa in silenzio',
    () => corri({ neutralizzazione: { perGiro: finestra, pavimento: -3 } }));
}

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


// ───────────── (h)(i)(j) LA TERZA FORMA: stessa legge, altra ancora ──────────
// La prereg dice «cambia chi paga, non quanto si comprime». Queste prove sono
// esattamente quella frase, verificata invece che dichiarata.
{
  const KAPPA = 0.7;
  const FINO = LF + 3;
  const finestra = {}; for (let l = LF + 1; l <= FINO; l += 1) finestra[l] = KAPPA;
  const leader = 'UNO';
  const seconda = corri({ neutralizzazione: { perGiro: finestra, pavimento: null }, traccia: true });
  const terza = corri({ neutralizzazione: { perGiro: finestra, pavimento: null, soffitto: null, forma: 'leader' }, traccia: true });
  const cumA = (r, drv, lap) => r.traccia[drv].find((x) => x.lap === lap).cum_time;
  const giroDi = (r, drv, lap) => r.traccia[drv].find((x) => x.lap === lap).lap_time;

  // (j) `forma` assente ≡ 'inseguitori': il default non e' una terza strada
  b.uguale('forma assente ≡ forma inseguitori',
    corri({ neutralizzazione: { perGiro: finestra, forma: 'inseguitori' } }).cum, seconda.cum);
  b.esplode('una forma sconosciuta non passa in silenzio',
    () => corri({ neutralizzazione: { perGiro: finestra, forma: 'capofila' } }));
  b.esplode('un soffitto malformato non passa in silenzio',
    () => corri({ neutralizzazione: { perGiro: finestra, soffitto: 'alto', forma: 'leader' } }));
  b.esplode('un soffitto sotto il pavimento non passa in silenzio',
    () => corri({ neutralizzazione: { perGiro: finestra, pavimento: 100, soffitto: 50, forma: 'leader' } }));

  // (h) T6 — gli STESSI gap, alla settima cifra. E' il cancello che distingue una
  // consegna diversa da un modello diverso.
  for (const drv of ['DUE', 'TRE', 'QUATTRO']) {
    for (let lap = LF + 1; lap <= FINO; lap += 1) {
      const g2 = cumA(seconda, drv, lap) - cumA(seconda, leader, lap);
      const g3 = cumA(terza, drv, lap) - cumA(terza, leader, lap);
      b.verifica(`${drv} giro ${lap}: la terza forma da' lo stesso gap della seconda (${g3.toFixed(6)} = ${g2.toFixed(6)})`,
        Math.abs(g3 - g2) < 1e-9);
    }
  }

  // (i) T2 — nessun giro si accorcia, e il capofila paga davvero
  for (const drv of Object.keys(passi)) {
    for (let lap = LF + 1; lap <= FINO; lap += 1) {
      const senzaNulla = corri({ traccia: true });
      b.verifica(`${drv} giro ${lap}: la terza forma non accorcia il giro`,
        giroDi(terza, drv, lap) >= giroDi(senzaNulla, drv, lap) - 1e-9);
    }
  }
  b.verifica('il capofila paga (il suo cum peggiora), che e\' tutta la differenza fra le due forme',
    cumA(terza, leader, FINO) > cumA(seconda, leader, FINO) + 1);
  // L'ANCORA ESISTE, ed e' la proprieta' vera: su ogni giro compresso QUALCUNO paga
  // esattamente zero. NON e' sempre lo stesso pilota — l'ancora e' chi la seconda
  // forma avrebbe premiato di piu' quel giro, e dipende anche dal passo, non solo
  // dal distacco. La prima scrittura di questa prova pretendeva che fosse sempre
  // l'ultimo della fila ed e' fallita: la pretesa era mia, non del modello.
  {
    const senzaNulla = corri({ traccia: true });
    for (let lap = LF + 1; lap <= FINO; lap += 1) {
      const pagati = Object.keys(passi).map((d) => giroDi(terza, d, lap) - giroDi(senzaNulla, d, lap));
      b.verifica(`giro ${lap}: qualcuno paga zero (l'ancora esiste)`, Math.min(...pagati) < 1e-9);
      b.verifica(`giro ${lap}: nessuno paga meno di zero`, Math.min(...pagati) > -1e-9);
    }
  }

  // (i) il PAVIMENTO non lega mai nella terza forma: non c'e' niente da difendere
  const conPav = corri({ neutralizzazione: { perGiro: finestra, pavimento: 200, soffitto: null, forma: 'leader' }, traccia: true });
  b.uguale('nella terza forma un pavimento assurdo non lega e non cambia un bit', conPav.cum, terza.cum);
  b.uguale('e il suo contatore resta a zero', conPav.clampPavimento, 0);

  // (j) IL SOFFITTO: un soffitto sopra ogni giro non tocca niente; uno bassissimo
  // annulla l'aggiunta senza ACCORCIARE (il Math.max(0, …), la meta' della forma
  // che si dimentica per prima — e' la stessa lezione del pavimento allo specchio).
  b.uguale('un soffitto che nessuno tocca non cambia un bit',
    corri({ neutralizzazione: { perGiro: finestra, soffitto: 10000, forma: 'leader' } }).cum, terza.cum);
  const basso = corri({ neutralizzazione: { perGiro: finestra, soffitto: 80, forma: 'leader' }, traccia: true });
  b.verifica('un soffitto sotto quasi ogni giro lega', basso.clampSoffitto > 0);
  for (const drv of Object.keys(passi)) {
    for (let lap = LF + 1; lap <= FINO; lap += 1) {
      b.verifica(`${drv} giro ${lap}: il soffitto annulla l'aggiunta ma non accorcia`,
        giroDi(basso, drv, lap) >= giroDi(corri({ traccia: true }), drv, lap) - 1e-9);
    }
  }
  b.uguale('senza soffitto la chiave del contatore non esiste nemmeno',
    Object.prototype.hasOwnProperty.call(terza, 'clampSoffitto'), false);
}

b.chiudi();
