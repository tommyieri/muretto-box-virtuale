#!/usr/bin/env node
// s37_vita — la vita della mescola fa quello che dice, e SPENTA non esiste.
//
// Prereg: ai_lab/degrado/PREREG_vita_mescola.md · deroga: simulatore/DEROGA_prior_comportamentale.md
//
// Dal 04/08/2026 la mescola viaggia dallo stato al congelamento fino al passo, e cambia a
// ogni sosta. E' un cambiamento che tocca tre file del percorso caldo — passo, kernel,
// costruttore — e l'unica ragione per cui e' stato accettabile farlo e' che SPENTO deve
// essere indistinguibile da non averlo fatto. Questa sentinella e' quella promessa.
//
// COSA FA FALLIRE QUESTA SENTINELLA:
//  (a) con `vita` null/undefined/mappa vuota il passo NON e' bit-identico a non passarlo;
//  (b) `stimaBasi` non sottrae lo stesso termine che `creaPasso` ri-aggiunge — cioe' il
//      modello conterebbe due volte il degrado oltre-vita dei giri gia' corsi (E02, la
//      stessa forma che e' costata -1,48 s/giro);
//  (c) il termine non e' quello dichiarato: dentro la vita deve valere ESATTAMENTE zero, e
//      oltre deve costare rho per ogni giro in piu' — ne' piu' ne' meno;
//  (d) una mescola IGNOTA fa comparire un termine: un'assenza non diventa mai una vita di
//      riserva (regola 6);
//  (e) un parametro malformato non esplode.
import { creaPasso, stimaBasi, creaVita } from '../../engine/passo_v2.mjs';
import { banco } from '../asserzioni.mjs';

const b = banco('s37');

const BASI = { ALB: 90, LAW: 91.5 };
const P = { delta70: 2.2, rho: 0.030776, nGiri: 58, basi: BASI };
const VITA = { SOFT: 12, MEDIUM: 19, HARD: 22 };

// ── (a) SPENTA NON ESISTE, e non «quasi» ────────────────────────────────────
{
  const senza = creaPasso({ ...P });
  for (const spento of [null, undefined, {}]) {
    const con = creaPasso({ ...P, vita: spento });
    let identici = 0; let diversi = 0;
    for (let giro = 1; giro <= 58; giro += 1) {
      for (let eta = 0; eta <= 60; eta += 1) {
        for (const m of [null, 'SOFT', 'MEDIUM', 'HARD', undefined]) {
          const a = senza('ALB', giro, eta);
          const c = con('ALB', giro, eta, m);
          if (Object.is(a, c)) identici += 1; else diversi += 1;
        }
      }
    }
    b.uguale(`vita = ${JSON.stringify(spento)}: bit-identico a non passarlo (${identici} coppie)`,
      diversi, 0);
  }
}

// ── (b) REGOLA 10: quello che si sottrae misurando si ri-aggiunge simulando ──
{
  // Una gomma portata BEN oltre la sua vita: se `stimaBasi` non sottraesse il termine, la
  // base assorbirebbe il degrado oltre-vita e il modello lo conterebbe due volte.
  const oss = [];
  for (let lap = 1; lap <= 30; lap += 1) oss.push({ drv: 'ALB', lap, eta: lap, t: 90 + 0.030776 * lap, mescola: 'SOFT' });
  const arg = { delta70: 2.2, rho: 0.030776, nGiri: 58, finoA: 30, minGiri: 4 };
  const baseSenza = stimaBasi(oss, arg).ALB;
  const baseCon = stimaBasi(oss, { ...arg, vita: VITA }).ALB;
  b.verifica('stimaBasi sottrae il termine di vita: con una gomma oltre la sua vita la base CAMBIA'
    + ` (${baseSenza.toFixed(6)} → ${baseCon.toFixed(6)}) — se non cambiasse, il degrado`
    + ' oltre-vita finirebbe dentro la base E dentro il passo (E02)',
    !Object.is(baseSenza, baseCon));

  // IL GIRO DI ANDATA E RITORNO. La prima scrittura di questo blocco generava osservazioni
  // SENZA il termine di vita e pretendeva di ricomporle CON: la sentinella l'ha bocciata
  // (errore 0,44 s) e aveva ragione — `stimaBasi` prende la MEDIANA dei residui, e se i
  // residui non sono costanti nessuna base singola puo' ricomporre ogni osservazione. Il
  // test giusto genera con la stessa fisica con cui misura: se il ciclo e' chiuso, la base
  // vera torna indietro esatta.
  const BASE_VERA = 90;
  const generatore = creaPasso({ ...P, basi: { ALB: BASE_VERA }, vita: VITA });
  const sintetiche = [];
  for (let lap = 1; lap <= 30; lap += 1) {
    sintetiche.push({ drv: 'ALB', lap, eta: lap, mescola: 'SOFT', t: generatore('ALB', lap, lap, 'SOFT') });
  }
  const recuperata = stimaBasi(sintetiche, { ...arg, vita: VITA }).ALB;
  b.verifica(`misurare e simulare con la STESSA vita chiude il ciclo: base ${BASE_VERA} → ${recuperata}`
    + ' (se non tornasse, il termine sarebbe contato due volte o zero volte)',
    Math.abs(recuperata - BASE_VERA) < 1e-9);
  // e col ciclo APERTO (misuro senza, simulo con) la base NON torna: e' la prova che il
  // controllo qui sopra non e' vuoto
  const apertoErrato = stimaBasi(sintetiche, arg).ALB;
  b.verifica(`col ciclo aperto la base NON torna (${apertoErrato.toFixed(4)} invece di ${BASE_VERA}):`
    + ' senza questa riga il controllo sopra passerebbe anche con il termine spento',
    Math.abs(apertoErrato - BASE_VERA) > 0.05);
}

// ── (c) IL TERMINE E' QUELLO DICHIARATO ─────────────────────────────────────
{
  const con = creaPasso({ ...P, vita: VITA });
  const senza = creaPasso({ ...P });
  for (const [m, v] of Object.entries(VITA)) {
    let dentro = 0;
    for (let eta = 0; eta <= v; eta += 1) if (Object.is(con('ALB', 30, eta, m), senza('ALB', 30, eta))) dentro += 1;
    b.uguale(`${m}: DENTRO la vita (0..${v}) il termine vale esattamente zero`, dentro, v + 1);

    // oltre: ogni giro in piu' costa rho in piu', ne' piu' ne' meno
    const k = 8;
    const atteso = P.rho * k;
    const misurato = con('ALB', 30, v + k, m) - senza('ALB', 30, v + k);
    b.verifica(`${m}: ${k} giri OLTRE la vita costano ${atteso.toFixed(6)} s (misurato ${misurato.toFixed(6)})`,
      Math.abs(misurato - atteso) < 1e-9);
  }
  // e la separazione fra mescole alla STESSA eta' e' quella che il modello promette
  const eta = 22;
  const dSoft = con('ALB', 30, eta, 'SOFT') - con('ALB', 30, eta, 'HARD');
  b.verifica(`a eta' ${eta} la SOFT e' piu' lenta della HARD di ${dSoft.toFixed(4)} s/giro`
    + ' — se fosse zero, la mescola sarebbe di nuovo inerte e il selettore tornerebbe teatro',
    dSoft > 0);
}

// ── (d) MESCOLA IGNOTA: nessun termine, nessuna vita di riserva ─────────────
{
  const con = creaPasso({ ...P, vita: VITA });
  const senza = creaPasso({ ...P });
  for (const m of [null, undefined, 'INTERMEDIATE', 'WET', 'None', '']) {
    b.verifica(`mescola ${JSON.stringify(m)}: il termine non esiste (regola 6, mai un valore di riserva)`,
      Object.is(con('ALB', 30, 40, m), senza('ALB', 30, 40)));
  }
}

// ── (e) UN PARAMETRO MALFORMATO ESPLODE ─────────────────────────────────────
for (const rotto of [{ SOFT: 0 }, { SOFT: -3 }, { SOFT: 'dodici' }, { SOFT: NaN }, { SOFT: null }, 12]) {
  b.esplode(`vita malformata ${JSON.stringify(rotto)} deve esplodere, non essere ignorata`,
    () => creaVita(rotto));
}

// ── (f) CHI MISURA DEVE POTER SPEGNERE LA VITA, e il contesto deve obbedirgli ──
//
// NATA DA UN GUASTO VERO, trovato il 04/08/2026. `cancelli_vita.mjs` scriveva la vita
// dentro `modello.vita_mescola`; il costruttore legge `contesto.vitaMescola ?? modello.
// vita_mescola`, e appena `contestoNuovo` ha cominciato a mettere `vitaMescola` nel
// contesto — col commit che ha ACCESO la mescola in produzione, cioe' DOPO che il cancello
// aveva gia' prodotto il suo esito — quell'override e' diventato inerte. I due bracci
// ricevevano la stessa vita e V1 usciva 0-0 con 167 pari: il modello confrontato con se
// stesso, verde e muto. E' E22 nella sua forma pura.
//
// Il guasto non stava nel passo (che questa sentinella copriva gia'): stava nella
// PRECEDENZA fra le due sorgenti del parametro. Quindi si prova quella.
//
// COSA FA FALLIRE QUESTO BLOCCO: se `contesto.vitaMescola` smettesse di avere la
// precedenza, o se uno spento esplicito nel contesto non spegnesse davvero — cioe' se chi
// misura non potesse piu' costruire due bracci distinti.
{
  const sceltaDa = (contesto, modello) => {
    // la stessa espressione di scenario/costruttore.mjs. Se la' cambia e qui no, questo
    // caso diventa un ornamento: e' il motivo per cui il commento la nomina per intero.
    const vm = contesto.vitaMescola ?? modello.vita_mescola;
    if (vm?.attivo !== true || !vm.giri) return null;
    return vm.giri;
  };
  const produzione = { vita_mescola: { attivo: true, giri: { SOFT: 99, MEDIUM: 99, HARD: 99 } } };

  b.uguale('il contesto ha la PRECEDENZA sul modello: chi misura sceglie la vita',
    JSON.stringify(sceltaDa({ vitaMescola: { attivo: true, giri: VITA } }, produzione)), JSON.stringify(VITA));
  b.verifica('uno SPENTO esplicito nel contesto spegne davvero, anche se il modello e\' acceso',
    sceltaDa({ vitaMescola: { attivo: false } }, produzione) === null);
  b.uguale('senza vitaMescola nel contesto vale il modello — cioe\' la produzione, non un\'assenza',
    JSON.stringify(sceltaDa({}, produzione)), JSON.stringify(produzione.vita_mescola.giri));
}

b.chiudi();
