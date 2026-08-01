// s28_rodaggio — il rodaggio si sottrae misurando e si ri-aggiunge simulando.
//
// PERCHE' ESISTE. `w(età) = −c·exp(−età/τ)` è il primo termine aggiunto al passo
// dopo la rifondazione, ed è esattamente la forma di difetto che è già costata
// −1,48 s/giro: E02, il carburante sottratto da `stimaBasi` e mai ri-aggiunto da
// `creaPasso`. Se qualcuno passasse `rodaggio` a una sola delle due funzioni, la
// base assorbirebbe il rodaggio e il termine verrebbe contato due volte — e
// nessun test di forma se ne accorgerebbe, perché entrambe le funzioni da sole
// sembrerebbero corrette.
//
// La regola 10 qui non è un commento: è un'uguaglianza numerica verificabile.
//
// COSA FA FALLIRE QUESTA SENTINELLA:
//  (a) con `rodaggio` assente o nullo i numeri NON sono identici a prima che il
//      termine esistesse: il termine spento non sarebbe più spento;
//  (b) `stimaBasi` e `creaPasso` non si cancellano: su dati generati DALLA
//      stessa equazione, il passo ricostruito deve tornare il tempo osservato al
//      millesimo di millesimo. Se uno dei due dimenticasse w, l'errore sarebbe
//      dell'ordine di c;
//  (c) passare il rodaggio a UNA SOLA delle due funzioni non produce differenza:
//      vorrebbe dire che il termine non fa niente, e allora (b) era teatro (E09);
//  (d) `w` non è monotona decrescente in valore assoluto, o non tende a zero:
//      sarebbe il gradino perpetuo di E01 travestito;
//  (e) parametri malformati (c < 0, τ ≤ 0, non numeri) passano in silenzio
//      invece di fallire rumorosamente (E07: niente valori di riserva);
//  (f) l'invarianza al troncamento si perde: `stimaBasi` con rodaggio deve
//      continuare a leggere solo i giri ≤ finoA (regola 5, E15).

import { banco } from '../asserzioni.mjs';
import { creaPasso, creaRodaggio, stimaBasi, derivaPerGiro } from '../../engine/passo_v2.mjs';

const b = banco('s28');

const N_GIRI = 58;
const RHO = 0.030776;
const D70 = 2.2;
const RODAGGIO = { c: 0.67, tau: 4.75 };
const BASE_VERA = { UNO: 91.234, DUE: 92.001 };

// ── il mondo finto, generato DALLA stessa equazione che si vuole verificare ──
// Due piloti, due stint ciascuno: senza l'azzeramento dell'età alla sosta, età e
// giro sarebbero collineari e la base non sarebbe identificata.
function osservazioni(rodaggio) {
  const w = creaRodaggio(rodaggio);
  const deriva = derivaPerGiro(D70, N_GIRI);
  const righe = [];
  for (const drv of Object.keys(BASE_VERA)) {
    let eta = 0;
    for (let lap = 1; lap <= 40; lap += 1) {
      eta = lap === 21 ? 1 : eta + 1; // sosta al giro 20: al 21 la gomma ha età 1
      righe.push({ drv, lap, eta, t: BASE_VERA[drv] + deriva * (lap - 1) + RHO * eta + w(eta) });
    }
  }
  return righe;
}

// ─────────────────────────────────────────── (a) spento ≡ come se non esistesse
{
  const oss = osservazioni(null);
  const opzioni = { delta70: D70, rho: RHO, nGiri: N_GIRI, finoA: 40, minGiri: 8 };
  const senzaCampo = stimaBasi(oss, opzioni);
  const conNull = stimaBasi(oss, { ...opzioni, rodaggio: null });
  const conZero = stimaBasi(oss, { ...opzioni, rodaggio: { c: 0, tau: 5 } });
  b.uguale('stimaBasi: rodaggio assente ≡ rodaggio null', conNull, senzaCampo);
  b.uguale('stimaBasi: rodaggio assente ≡ c = 0', conZero, senzaCampo);

  const p0 = creaPasso({ delta70: D70, rho: RHO, nGiri: N_GIRI, basi: senzaCampo });
  const p1 = creaPasso({ delta70: D70, rho: RHO, nGiri: N_GIRI, basi: senzaCampo, rodaggio: null });
  const p2 = creaPasso({ delta70: D70, rho: RHO, nGiri: N_GIRI, basi: senzaCampo, rodaggio: { c: 0, tau: 5 } });
  const campione = [[1, 1], [10, 7], [30, 22], [55, 3]];
  b.uguale('creaPasso: rodaggio assente ≡ null', campione.map(([g, e]) => p1('UNO', g, e)), campione.map(([g, e]) => p0('UNO', g, e)));
  b.uguale('creaPasso: rodaggio assente ≡ c = 0', campione.map(([g, e]) => p2('UNO', g, e)), campione.map(([g, e]) => p0('UNO', g, e)));
}

// ───────────────────── (b) misura e predizione si cancellano al giro esatto ──
{
  const oss = osservazioni(RODAGGIO);
  const basi = stimaBasi(oss, { delta70: D70, rho: RHO, nGiri: N_GIRI, finoA: 40, minGiri: 8, rodaggio: RODAGGIO });
  const pace = creaPasso({ delta70: D70, rho: RHO, nGiri: N_GIRI, basi, rodaggio: RODAGGIO });

  for (const drv of Object.keys(BASE_VERA)) {
    b.verifica(`la base di ${drv} torna quella vera (${BASE_VERA[drv]}, ricostruita ${basi[drv]?.toFixed(9)})`,
      Math.abs(basi[drv] - BASE_VERA[drv]) < 1e-9);
  }
  let peggiore = 0;
  for (const { drv, lap, eta, t } of oss) peggiore = Math.max(peggiore, Math.abs(pace(drv, lap, eta) - t));
  b.verifica(`il passo ricostruito torna il tempo osservato su tutti gli ${oss.length} giri (scarto max ${peggiore.toExponential(2)} s)`,
    peggiore < 1e-9);
}

// ───────── (c) passarlo a UNA SOLA delle due rompe — e di quanto, esattamente ──
// E' la potenza di fallire di (b): se `w` fosse scollegata, (b) passerebbe lo
// stesso. Qui si misura il difetto E02 in miniatura, e la sua MAGNITUDINE non e'
// "un ordine c": la base assorbe la MEDIANA di w sulle eta' osservate, quindi lo
// scarto e' un offset costante pari a |mediana(w)|. E' un numero preciso, quindi
// si pretende quel numero e non una soglia comoda.
{
  const oss = osservazioni(RODAGGIO);
  const w = creaRodaggio(RODAGGIO);
  const valori = oss.map((r) => w(r.eta)).sort((x, y) => x - y);
  const medW = valori.length % 2
    ? valori[valori.length >> 1]
    : (valori[(valori.length >> 1) - 1] + valori[valori.length >> 1]) / 2;

  const basiSenza = stimaBasi(oss, { delta70: D70, rho: RHO, nGiri: N_GIRI, finoA: 40, minGiri: 8 });
  const soloPredizione = creaPasso({ delta70: D70, rho: RHO, nGiri: N_GIRI, basi: basiSenza, rodaggio: RODAGGIO });
  let peggiore = 0;
  for (const { drv, lap, eta, t } of oss) peggiore = Math.max(peggiore, Math.abs(soloPredizione(drv, lap, eta) - t));
  b.verifica(`sottrarre e non ri-aggiungere sbaglia di |mediana(w)| = ${Math.abs(medW).toFixed(4)} s/giro su OGNI giro (misurato ${peggiore.toFixed(4)})`,
    Math.abs(peggiore - Math.abs(medW)) < 1e-9);
  b.verifica('...e quel difetto non e\' zero: il termine entra davvero nei numeri', peggiore > 1e-3);

  // Il difetto che conta per il prodotto e' piu' grande di cosi'. Al giro DOPO
  // la sosta (eta 1) la base misurata su gomme mature e' fuori di w(1) − mediana(w):
  // e' l'unico giro su cui M1 misura, ed e' dove il termine vive o muore.
  const scartoAEta1 = Math.abs(w(1) - medW);
  b.verifica(`al giro dopo la sosta lo scarto vale ${scartoAEta1.toFixed(3)} s, molto piu' dell'offset mediano`,
    scartoAEta1 > Math.abs(medW) * 3);

  const basiCon = stimaBasi(oss, { delta70: D70, rho: RHO, nGiri: N_GIRI, finoA: 40, minGiri: 8, rodaggio: RODAGGIO });
  b.verifica('e le due basi sono davvero diverse: il rodaggio entra nella misura, non solo nella predizione',
    Math.abs(basiCon.UNO - basiSenza.UNO) > 0.01);
}

// ───────────────────────────── (d) w decade a zero: nessun vantaggio perpetuo ─
{
  const w = creaRodaggio(RODAGGIO);
  b.verifica('w è negativa (la gomma nuova è più veloce, non più lenta)', w(1) < 0);
  let monotona = true;
  for (let e = 1; e < 80; e += 1) if (!(Math.abs(w(e + 1)) < Math.abs(w(e)))) monotona = false;
  b.verifica('|w| decresce a ogni giro di età', monotona);
  b.verifica(`w si è spenta a età 60 (${w(60).toExponential(2)} s: sotto il millesimo)`, Math.abs(w(60)) < 1e-3);
  b.verifica('w(0) vale esattamente −c', Math.abs(w(0) + RODAGGIO.c) < 1e-12);
}

// ────────────────────────────────── (e) i parametri malformati fanno rumore ──
for (const cattivo of [{ c: -0.1, tau: 5 }, { c: 0.5, tau: 0 }, { c: 0.5, tau: -3 }, { c: 'mezzo', tau: 5 }, { c: 0.5 }, { c: 0.5, tau: NaN }, 'rodaggio']) {
  b.esplode(`rodaggio malformato rifiutato: ${JSON.stringify(cattivo)}`, () => creaRodaggio(cattivo));
}

// ──────────────────────── (f) col rodaggio la stima non guarda oltre finoA ──
{
  const oss = osservazioni(RODAGGIO);
  const troncate = oss.filter((r) => r.lap <= 25);
  b.verifica('il troncamento toglie davvero qualcosa (altrimenti non prova nulla)', troncate.length < oss.length);
  const opzioni = { delta70: D70, rho: RHO, nGiri: N_GIRI, finoA: 25, minGiri: 8, rodaggio: RODAGGIO };
  b.uguale('stimaBasi con rodaggio è invariante al troncamento (regola 5)', stimaBasi(troncate, opzioni), stimaBasi(oss, opzioni));
}

b.chiudi();
