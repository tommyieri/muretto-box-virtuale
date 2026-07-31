// pitloss.mjs — la perdita ai box che il banco dà al kernel, con targhetta.
//
// È un PRIOR ESTERNO (regola 2): 2.106 stop misurati 2022-26, file
// `data/priors/pitloss_priors.json`. Non è misurato sul nostro fondo, e finché
// non lo sarà ogni numero che ne dipende porta questa etichetta. Il kernel non
// conosce pit-loss di circuito e non ne inventa uno: glielo passa chi chiama.
//
// La mappa gara → circuito sta QUI e solo qui, ed è esplicita: una gara senza
// misura di circuito NON prende un numero somigliante di nascosto, prende il
// `_fallback` d'era ED è marcata `fallback: true` nel report. Un prior generico
// spacciato per misura di circuito sarebbe la stessa famiglia di E13.
//
// ── PROMOZIONE (banco/prereg/PREREG_pitloss.md) ─────────────────────────────
// Dove la MISURA INTERNA sul fondo ha superato il cancello A, è quella a
// valere, e la targhetta diventa `misurato sul fondo`. Dove non l'ha superato
// resta il prior, con la sua targhetta invariata. Nessun valore misto: mediare
// due fonti darebbe un numero senza natura, e la regola 2 non saprebbe che
// targhetta dargli.

import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';

// Solo i circuiti che il prior misura davvero. Le gare non elencate usano il
// fallback dichiarato: Australia (Melbourne), Canada (Montreal — il prior
// dichiara zero stop green puliti nel 2026), Cina, Giappone, Ungheria.
export const CIRCUITO_PER_GARA = Object.freeze({
  Austria: 'spielberg',
  Belgio: 'spa',
  GranBretagna: 'silverstone',
  Miami: 'miami',
  Monaco: 'monaco',
  Spagna: 'barcelona',
});

// Gara 2026 → Gran Premio del fondo, per leggere la misura interna. È una mappa
// di NOMI, dichiarata: il fondo raggruppa per Gran Premio (vedi il limite
// dichiarato nella targhetta della misura interna).
export const GP_PER_GARA = Object.freeze({
  Australia: 'Australian_Grand_Prix',
  Austria: 'Austrian_Grand_Prix',
  Belgio: 'Belgian_Grand_Prix',
  Canada: 'Canadian_Grand_Prix',
  Cina: 'Chinese_Grand_Prix',
  Giappone: 'Japanese_Grand_Prix',
  GranBretagna: 'British_Grand_Prix',
  Miami: 'Miami_Grand_Prix',
  Monaco: 'Monaco_Grand_Prix',
  Spagna: 'Spanish_Grand_Prix',
  Ungheria: 'Hungarian_Grand_Prix',
});

export function caricaPrior(radice) {
  const prior = JSON.parse(readFileSync(path.join(radice, 'data', 'priors', 'pitloss_priors.json'), 'utf8'));
  // La misura interna viaggia agganciata al prior: così ogni chiamante di
  // `perditaBox` la riceve senza doverla caricare a parte, e non esiste un
  // percorso in cui il prior vince per distrazione su un circuito promosso.
  const interno = path.join(radice, 'data', 'modelli', 'pitloss_interno.json');
  prior.misura_interna = existsSync(interno) ? JSON.parse(readFileSync(interno, 'utf8')) : null;
  return prior;
}

/**
 * Perdita in secondi per una sosta in quella gara, sotto quel regime.
 * `regime` ∈ {null, 'SC', 'VSC'}: sotto neutralizzazione si paga solo una
 * frazione della perdita verde — anch'essa un prior CON BANDA (SC 0,40-0,60 ·
 * VSC 0,60-0,70), qui usata al suo valore centrale e dichiarata come tale.
 */
export function perditaBox(prior, gara, regime = null) {
  const fattore = regime === null ? 1 : prior.fattori_neutralizzazione[regime];
  if (typeof fattore !== 'number') throw new Error(`regime senza fattore dichiarato: ${regime}`);

  // 1. la misura interna, se questo Gran Premio è stato PROMOSSO
  const gp = GP_PER_GARA[gara];
  const interna = gp ? prior.misura_interna?.circuiti?.[gp] : null;
  if (interna && interna.cancello_A?.promosso === true) {
    return {
      perdita: interna.mediana_green_s * fattore,
      perdita_verde: interna.mediana_green_s,
      clean_10pct_s: interna.clean_10pct_s,
      circuito: gp,
      fonte: 'misura_interna',
      fallback: false,
      regime,
      fattore,
      targhetta: `misurato sul fondo 2018-2025: mediana di ${interna.n_soste} soste verdi su asciutto a ${gp} (IC95 ${interna.ic95_mediana ? `${interna.ic95_mediana[0]}–${interna.ic95_mediana[1]}` : 'non calcolabile'} s)`,
    };
  }

  // 2. altrimenti il prior esterno, con la sua targhetta invariata
  const cid = CIRCUITO_PER_GARA[gara];
  const misura = cid ? prior.circuiti[cid] : prior.circuiti._fallback;
  const medianaVerde = misura.mediana_green_s;
  return {
    perdita: medianaVerde * fattore,
    perdita_verde: medianaVerde,
    clean_10pct_s: misura.clean_10pct_s ?? null,
    circuito: cid ?? '_fallback',
    fonte: 'prior_esterno',
    fallback: !cid,
    regime,
    fattore,
    targhetta: cid
      ? `prior esterno, mediana green misurata a ${cid} (${misura.qualita}) — il fondo non ha promosso questo circuito`
      : 'prior esterno, mediana d\'era 22,1 s — circuito NON misurato ne\' dal prior ne\' dal fondo, valore di ripiego dichiarato',
  };
}
