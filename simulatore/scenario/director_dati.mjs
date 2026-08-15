// director_dati.mjs — le COSTANTI del Director, lette dal disco.
//
// `validaSimulazione` (in director.mjs) e' pura: riceve le costanti e giudica.
// Il caricamento sta qui, per la stessa ragione di pitloss_dati.mjs: il
// guardiano runtime deve poter girare anche nel browser, sotto il pannello
// live, e un `node:fs` nel modulo del giudizio lo impedirebbe.
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { caricaPrior } from '../provenienza/pitloss_dati.mjs';

export function caricaCostanti(radice) {
  const leggi = (p) => JSON.parse(readFileSync(path.join(radice, p), 'utf8'));
  return {
    limiti: leggi('data/priors/director_limiti.json'),
    // il prior si carica dal SUO modulo, che gli aggancia la misura interna: un
    // JSON.parse diretto qui darebbe al guardiano una fonte diversa da quella
    // del motore, e la sentinella s22 esiste per non farlo passare
    prior: caricaPrior(radice),
    pavimenti: leggi('data/modelli/pavimenti_2026.json'),
    // il gemello del pavimento (PREREG_terza_forma.md): lo legge il costruttore per
    // il pacchetto della compressione. Sta qui e non altrove perche' pavimento e
    // soffitto sono la stessa regola con il segno opposto (regola 1).
    soffitti: leggi('data/modelli/soffitti_2026.json'),
  };
}
