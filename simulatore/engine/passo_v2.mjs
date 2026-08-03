// passo_v2.mjs — l'UNICA implementazione dell'equazione del tempo sul giro.
//
//     t(pilota, giro) = base + δ·(giro − 1) + ρ·età_gomma + w(età) + q(età)
//     δ (s/giro) = − δ₇₀ / N_giri_gara      (δ₇₀ = carburante totale su 70 kg)
//     w(età)     = − c·exp(−età/τ)          il RODAGGIO, opzionale e dichiarato
//     q(età)     = κ·età²                   il CLIFF, opzionale e SPENTO di default
//     la SOSTA azzera l'età: la gestisce il kernel, non questa funzione
//
// Nessun gradino costante post-sosta (E01): l'unico effetto della sosta è che
// l'età riparte, e chi la applica è `simulate`. Niente curve per mescola al
// giorno 1 (p = 0,209 — Fase 3, fuori campione).
//
// IL CLIFF è arrivato il 03/08/2026 ed è SPENTO se nessuno lo accende: con
// `cliff` null i numeri sono bit-identici a prima che esistesse, e a dirlo è una
// sentinella, non questo commento. Protocollo, fonte del parametro e cancelli:
// ai_lab/confronto/PREREG_cliff_derivato.md.
//
// IL RODAGGIO non è un gradino, ed è per questo che può stare qui: `w → 0` per
// età grande, quindi la `base` conserva il significato di passo su gomma matura
// e non esiste nessun vantaggio perpetuo. L'ottimo a una sosta NON si sposta —
// cade dove l'età al pit eguaglia l'età alla bandiera (a+k = R−k), e lì
// `w(a+k) − w(R−k) = 0` per qualunque w. La sentinella s12 lo verifica col
// kernel vero e NON va allargata per far posto a questo termine.
// Protocollo e cancello: ai_lab/confronto/PREREG_rodaggio.md.
//
// `rodaggio` ASSENTE o null = termine spento, e i numeri sono bit-identici a
// prima che esistesse. Non c'è nessun valore di riserva: parametri malformati
// falliscono rumorosamente (E07).
//
// REGOLA 10, ed è il cuore di tutto. `stimaBasi` misura la base togliendo
// ESATTAMENTE i termini che `creaPasso` ri-aggiungerà. Il vecchio motore
// prendeva la mediana grezza dello stint — misurata su gomme 9,15 giri più
// giovani di quelle simulate (−0,403 s/giro) — e girava su un passo a
// serbatoio vuoto senza mai ri-gonfiarlo (−1,480 s/giro, E02). I due pezzi
// facevano il 99% di un bias da −1,86 s/giro. Qui non possono ripetersi: la
// sottrazione e la ri-addizione sono la stessa riga di codice, con lo stesso δ,
// lo stesso ρ e lo stesso w — e la sentinella s28 misura quanto costerebbe
// scollegarne uno solo, in tutti e due i versi.

export function derivaPerGiro(delta70, nGiri) {
  if (typeof delta70 !== 'number' || !Number.isFinite(delta70)) throw new Error(`delta70 non utilizzabile: ${JSON.stringify(delta70)}`);
  if (!Number.isInteger(nGiri) || nGiri < 2) throw new Error(`n_giri gara non utilizzabile: ${JSON.stringify(nGiri)}`);
  return -delta70 / nGiri;
}

/**
 * Il termine di rodaggio come funzione dell'età: `w(età) = −c·exp(−età/τ)`.
 *
 * È UNA sola funzione, usata sia da `stimaBasi` (che la sottrae) sia da
 * `creaPasso` (che la ri-aggiunge): è la forma operativa della regola 10 per
 * questo termine, e la ragione per cui non può ripetersi E02.
 *
 * `null`/`undefined` → termine spento (la funzione costante 0).
 */
export function creaRodaggio(rodaggio) {
  if (rodaggio === null || rodaggio === undefined) return () => 0;
  if (typeof rodaggio !== 'object') throw new Error(`rodaggio non utilizzabile: ${JSON.stringify(rodaggio)}`);
  const { c, tau } = rodaggio;
  if (typeof c !== 'number' || !Number.isFinite(c) || c < 0) throw new Error(`rodaggio.c non utilizzabile (serve un numero ≥ 0): ${JSON.stringify(c)}`);
  if (typeof tau !== 'number' || !Number.isFinite(tau) || tau <= 0) throw new Error(`rodaggio.tau non utilizzabile (serve un numero > 0): ${JSON.stringify(tau)}`);
  if (c === 0) return () => 0;
  return (eta) => -c * Math.exp(-eta / tau);
}

/**
 * Il CLIFF di fine vita come funzione dell'età: `q(età) = κ·età²`.
 *
 * SPENTO PER DEFAULT, e questo file ha dichiarato per un anno «niente cliff di
 * fine vita»: quella riga resta vera finché `cliff` è null, ed è verificata da
 * una sentinella di bit-identità, non da una promessa.
 *
 * PERCHÉ È QUADRATICO E NON UNA SOGLIA. Un cliff «vero» sarebbe una soglia oltre
 * cui il degrado esplode, ma nessuna fonte aperta pubblica dove sta quella
 * soglia. La quadratica è la sola forma non lineare per cui esistano
 * coefficienti pubblicati da altri — i `k_2_quad` dei file TUMFTM — e κ arriva
 * da lì con una regola di derivazione dichiarata prima di misurare
 * (`ai_lab/confronto/PREREG_cliff_derivato.md` §3). Non è stimato dai nostri
 * dati: l'arco della stima del degrado è chiuso da cinque cancelli NULL.
 *
 * L'OTTIMO A UNA SOSTA NON SI SPOSTA, come per il rodaggio e per lo stesso
 * motivo: cade dove l'età al pit eguaglia l'età alla bandiera (a+k = R−k), e lì
 * `q(a+k) − q(R−k) = 0` per qualunque q funzione della sola età. La sentinella
 * s12 vale ancora e NON va allargata. Ciò che il termine sposta è il confronto
 * fra k diversi — che è esattamente ciò per cui esiste.
 *
 * `null`/`undefined` → termine spento (la funzione costante 0).
 */
export function creaCliff(cliff) {
  if (cliff === null || cliff === undefined) return () => 0;
  if (typeof cliff !== 'object') throw new Error(`cliff non utilizzabile: ${JSON.stringify(cliff)}`);
  const { kappa } = cliff;
  if (typeof kappa !== 'number' || !Number.isFinite(kappa) || kappa < 0) throw new Error(`cliff.kappa non utilizzabile (serve un numero ≥ 0): ${JSON.stringify(kappa)}`);
  if (kappa === 0) return () => 0;
  return (eta) => kappa * eta * eta;
}

/**
 * Passo del modello v2. Un pilota senza base esce con **null** (regola 6): il
 * kernel lo escluderà con motivo, invece di riceverne un numero inventato.
 */
export function creaPasso({ delta70, rho, nGiri, basi, rodaggio = null, cliff = null }) {
  const deriva = derivaPerGiro(delta70, nGiri);
  if (typeof rho !== 'number' || !Number.isFinite(rho)) throw new Error(`rho non utilizzabile: ${JSON.stringify(rho)}`);
  if (basi === null || typeof basi !== 'object') throw new Error('basi mancanti');
  const w = creaRodaggio(rodaggio);
  const q = creaCliff(cliff);
  return (pilota, giro, eta) => {
    const base = basi[pilota];
    if (base === null || base === undefined) return null;
    return base + deriva * (giro - 1) + rho * eta + w(eta) + q(eta);
  };
}

const mediana = (v) => {
  const s = [...v].sort((a, b) => a - b);
  const m = s.length >> 1;
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};

/**
 * Base per pilota al congelamento: mediana di `t − δ·(giro−1) − ρ·età − w(età)`
 * sui giri con passo utilizzabile fino a `finoA` COMPRESO. Chi non arriva a
 * `minGiri` osservazioni esce con base null: l'assenza è null, non una media
 * di due giri spacciata per passo (regola 6).
 *
 * `rodaggio` è lo STESSO oggetto che riceve `creaPasso`, e la sottrazione qui è
 * la stessa riga che là diventa addizione: se un giorno se ne passasse uno solo
 * ai due, la base assorbirebbe il rodaggio e il termine sarebbe contato due
 * volte — E02, il carburante mai ri-aggiunto, −1,48 s/giro.
 *
 * Legge solo giri ≤ finoA: invariante al troncamento per costruzione
 * (regola 5).
 */
export function stimaBasi(osservazioni, { delta70, rho, nGiri, finoA, minGiri, rodaggio = null, cliff = null }) {
  if (!Number.isInteger(finoA)) throw new Error(`finoA deve essere intero: ${JSON.stringify(finoA)}`);
  if (!Number.isInteger(minGiri) || minGiri < 1) throw new Error(`minGiri deve essere intero ≥ 1: ${JSON.stringify(minGiri)}`);
  const deriva = derivaPerGiro(delta70, nGiri);
  const w = creaRodaggio(rodaggio);
  const q = creaCliff(cliff);
  const perPilota = new Map();
  for (const { drv, lap, eta, t } of osservazioni) {
    if (lap > finoA) continue;
    if (!perPilota.has(drv)) perPilota.set(drv, []);
    perPilota.get(drv).push(t - deriva * (lap - 1) - rho * eta - w(eta) - q(eta));
  }
  const basi = {};
  for (const [drv, valori] of perPilota) basi[drv] = valori.length >= minGiri ? mediana(valori) : null;
  return basi;
}
