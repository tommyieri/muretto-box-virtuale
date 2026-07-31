// hash_lib.mjs — hash su forma CANONICA (chiavi ordinate, ricorsivamente).
// Un hash su JSON.stringify nudo dipende dall'ordine di inserimento delle
// chiavi: due report identici darebbero hash diversi, e il confronto col
// golden diventerebbe rumore. Qui l'ordine è una proprietà del contenuto.

import { createHash } from 'node:crypto';

export function canonico(valore) {
  if (Array.isArray(valore)) return `[${valore.map(canonico).join(',')}]`;
  if (valore !== null && typeof valore === 'object') {
    const chiavi = Object.keys(valore).sort();
    return `{${chiavi.map((k) => `${JSON.stringify(k)}:${canonico(valore[k])}`).join(',')}}`;
  }
  return JSON.stringify(valore);
}

export function sha256Testo(testo) {
  return createHash('sha256').update(testo, 'utf8').digest('hex');
}
