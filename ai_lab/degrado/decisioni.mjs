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

const SIM = path.join(RADICE, 'simulatore');

export const MESCOLE = ['SOFT', 'MEDIUM', 'HARD'];
const SLICK = new Set(MESCOLE);

export const mediana = (v) => {
  if (!v.length) return null;
  const s = [...v].sort((a, b) => a - b);
  const m = s.length >> 1;
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};

let _cache = null;

/**
 * Ogni stint CONCLUSO DA UNA SOSTA, con la gomma che portava e quanto e' durato.
 *
 * SI ESCLUDONO gli stint che finiscono con la bandiera, e non e' un dettaglio: quelli non
 * sono decisioni sulla gomma — e' la gara che e' finita. Tenerli significherebbe chiedere
 * al modello di prevedere la lunghezza della gara, non la vita del pneumatico.
 *
 * Si escludono anche le mescole non slick (l'intermedia e la wet hanno un'altra fisica, e
 * il modello dichiara di non averla) e le durate nulle.
 */
export function decisioni() {
  if (_cache) return _cache;
  const gare = caricaGare2026(SIM);
  const fuori = [];
  for (const [nome, g] of Object.entries(gare)) {
    for (const [drv, celle] of g.perPilota) {
      const ord = [...celle].sort((a, b) => a[0] - b[0]);
      let stint = null; let eta = 0; let mescola = null; let giroInizio = null;
      for (const [lap, c] of ord) {
        if (c.stint !== stint) {
          if (stint !== null) {
            fuori.push({
              gara: nome, drv, mescola, durata: eta, giro_inizio: giroInizio, giro_sosta: lap - 1,
            });
          }
          stint = c.stint; eta = 0; mescola = c.compound; giroInizio = lap;
        }
        if (Number.isFinite(c.tyre_age)) eta = Math.max(eta, c.tyre_age);
      }
      // l'ultimo stint NON entra: finisce con la bandiera, non con una decisione
    }
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
