// decisioni.mjs — LE 427 DECISIONI DI SOSTA, e la vita che se ne ricava.
//
// Non e' uno script: non stampa e non esegue niente all'import.
//
// PERCHE' ESISTE. Il progetto ha cercato per mesi l'effetto della mescola dentro il degrado
// del tempo sul giro, dove non c'e' (rho SOFT-HARD, p = 0,209). Ma il segnale c'e', ed e'
// nelle DECISIONI: SOFT dura 12 giri, MEDIUM 19, HARD 22, e gli interquartili di soft e
// hard non si sovrappongono. La ragione per cui non compare nei tempi e' strutturale, non
// statistica — i team si fermano PRIMA che la gomma mostri la differenza, e cosi' facendo
// la rimuovono dai tempi. Questo modulo tiene le decisioni in un posto solo (regola 1).
//
// Deroga firmata: simulatore/DEROGA_prior_comportamentale.md · prereg dei cancelli:
// ai_lab/degrado/PREREG_vita_mescola.md.

import { caricaGare2026 } from '../../simulatore/provenienza/gare_2026.mjs';
import path from 'node:path';
import { RADICE } from '../confronto/banco.mjs';
// LA REGOLA DELLO STINT VIVE IN UN POSTO SOLO dal 04/08/2026: stava qui, scritta per il
// 2026, e il lavoro n. 1 del PO ha chiesto la stessa cosa su otto stagioni di fondo. Due
// copie sarebbero due perimetri quasi uguali, cioe' E12 (regola 1).
import { stintConclusi, mediana } from './durate.mjs';

const SIM = path.join(RADICE, 'simulatore');

export const MESCOLE = ['SOFT', 'MEDIUM', 'HARD'];
const SLICK = new Set(MESCOLE);

export { mediana };

let _cache = null;

/**
 * Ogni stint CONCLUSO DA UNA SOSTA del 2026, con la gomma che portava e quanto e' durato.
 *
 * L'estrazione la fa `stintConclusi` (durate.mjs): esclude l'ultimo stint di ogni pilota,
 * perche' quello non e' una decisione sulla gomma — e' la gara che e' finita.
 *
 * QUI si escludono soltanto le mescole non attuali (l'intermedia e la wet hanno un'altra
 * fisica, e il modello dichiara di non averla) e le durate nulle. Il perimetro PIU' STRETTO
 * di PREREG_vita_per_circuito.md — via le soste sotto SC e bandiera rossa — NON si applica
 * qui: queste sono le 427 decisioni su cui i cancelli V1/V2 sono gia' stati chiusi, e
 * cambiarle sotto un esito gia' scritto sarebbe riscrivere il passato. Chi vuole il
 * perimetro nuovo chiama `nelPerimetro`.
 */
export function decisioni() {
  if (_cache) return _cache;
  const gare = caricaGare2026(SIM);
  const fuori = [];
  for (const [nome, g] of Object.entries(gare)) {
    fuori.push(...stintConclusi(g.perPilota, { gara: nome }));
  }
  _cache = fuori.filter((d) => SLICK.has(d.mescola) && d.durata > 0);
  return _cache;
}

/**
 * La VITA per mescola: la mediana delle durate osservate.
 *
 * LA MEDIANA E NON LA MEDIA, e la ragione sta nei dati: i minimi sono di 1 giro — soste
 * opportunistiche sotto regime e incidenti al primo giro. La mediana le assorbe, la media
 * ci si sposta dietro.
 *
 * `escludiGara` e' il leave-one-race-out: la vita si calcola sulle ALTRE gare, cosi'
 * nessuno stint contribuisce al parametro che poi lo giudica.
 */
export function vitaDa(righe, escludiGara = null) {
  const usate = escludiGara === null ? righe : righe.filter((d) => d.gara !== escludiGara);
  const out = {};
  for (const m of MESCOLE) {
    const v = usate.filter((d) => d.mescola === m).map((d) => d.durata);
    if (v.length) out[m] = mediana(v);
  }
  return out;
}

/** La mediana di TUTTE le durate, mescole insieme: e' il nullo N2 nella sua forma cieca. */
export function vitaCieca(righe, escludiGara = null) {
  const usate = escludiGara === null ? righe : righe.filter((d) => d.gara !== escludiGara);
  return mediana(usate.map((d) => d.durata));
}
