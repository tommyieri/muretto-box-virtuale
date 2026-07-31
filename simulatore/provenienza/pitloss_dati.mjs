// pitloss_dati.mjs — il CARICATORE del prior di pit-loss, staccato dal calcolo.
//
// `perditaBox` (in pitloss.mjs) e' pura: riceve il prior gia' caricato e
// restituisce un numero. Leggere il JSON dal disco e' un'altra cosa, e finche'
// le due vivevano nello stesso file bastava importare la prima per tirarsi
// dietro `node:fs` — cosa che ha reso l'intero motore non caricabile nel
// browser, dove il pannello LIVE deve eseguirlo (il pre-calcolo in diretta non
// esiste per definizione).
//
// La divisione e' fra "dove sta il dato" e "cosa se ne fa", non fra due
// versioni della stessa cosa: il prior resta UNO, e chi lo carica passa da qui.
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';

export function caricaPrior(radice) {
  const prior = JSON.parse(readFileSync(path.join(radice, 'data', 'priors', 'pitloss_priors.json'), 'utf8'));
  // La misura interna viaggia agganciata al prior: così ogni chiamante di
  // `perditaBox` la riceve senza doverla caricare a parte, e non esiste un
  // percorso in cui il prior vince per distrazione su un circuito promosso.
  const interno = path.join(radice, 'data', 'modelli', 'pitloss_interno.json');
  prior.misura_interna = existsSync(interno) ? JSON.parse(readFileSync(interno, 'utf8')) : null;
  return prior;
}
