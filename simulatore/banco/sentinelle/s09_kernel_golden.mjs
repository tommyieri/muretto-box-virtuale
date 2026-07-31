// s09_kernel_golden — il kernel contro i casi dichiarati (E07, E06, E16).
//
// Ogni attesa arriva DAL golden banco/golden/kernel_casi.json: in questo file
// non c'è un solo numero di popolazione, nessuna soglia, nessun `449` cablato
// nelle condizioni di successo. Anche la tolleranza di confronto è dichiarata
// nel golden. Se il kernel cambia comportamento, cambia il confronto col
// golden — non una costante nascosta qui dentro.
//
// COSA FA FALLIRE QUESTA SENTINELLA:
//  (a) un cum, un'età, un ordine o un elenco di esclusi diverge dal caso
//      dichiarato (oltre la tolleranza del golden);
//  (b) un pilota senza passo (o senza cum al congelamento) riceve un NUMERO
//      invece di null, o compare nell'ordine: è E06, l'errore da 480 s;
//  (c) un pilota il cui passo sparisce a metà orizzonte riceve la somma
//      PARZIALE come se fosse il cum a fine orizzonte (regola 6);
//  (d) il conteggio dei cambi di posizione diverge da quello dichiarato: è
//      l'unica cosa che il kernel promette sui sorpassi — QUANTI, non QUALI;
//  (e) il golden perde un caso o la sua attesa in parole: un golden senza
//      attesa dichiarata non è un golden (E07).

import { banco } from '../asserzioni.mjs';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { simulate, cambiDiPosizione } from '../../engine/kernel.mjs';

const b = banco('s09');
const radice = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const golden = JSON.parse(readFileSync(path.join(radice, 'banco', 'golden', 'kernel_casi.json'), 'utf8'));
const tolleranza = golden.tolleranza_s;

b.verifica('il golden dichiara una tolleranza di confronto', typeof tolleranza === 'number');
b.verifica('il golden contiene dei casi', Array.isArray(golden.casi) && golden.casi.length > 0);

// Aritmetica di comodo del caso, NON il modello del repo: il kernel la riceve.
const passoDelCaso = (dichiarazioni) => (pilota, giro, eta) => {
  const d = dichiarazioni[pilota];
  if (d === null || d === undefined) return null;
  if (d.muto_dal !== undefined && giro >= d.muto_dal) return null;
  return d.base + d.per_eta * eta;
};

const vicini = (reale, atteso) =>
  reale === null || atteso === null ? reale === atteso : Math.abs(reale - atteso) <= tolleranza;

for (const caso of golden.casi) {
  const q = (t) => `[${caso.nome}] ${t}`;
  b.verifica(q('il caso dichiara la propria attesa in parole'), typeof caso.attesa === 'string' && caso.attesa.length > 0);

  const r = simulate({
    state: caso.stato,
    pace: passoDelCaso(caso.passo),
    freezeLap: caso.freezeLap,
    steps: caso.steps,
    pits: caso.pits,
  });

  // (a) cum ed età, chiave per chiave, con la tolleranza del golden
  b.uguale(q('i piloti nel cum sono quelli dichiarati'), Object.keys(r.cum).sort(), Object.keys(caso.atteso.cum).sort());
  for (const [drv, atteso] of Object.entries(caso.atteso.cum)) {
    b.verifica(q(`cum ${drv} = ${atteso} (reale ${r.cum[drv]})`), vicini(r.cum[drv], atteso));
  }
  for (const [drv, atteso] of Object.entries(caso.atteso.eta)) {
    b.verifica(q(`eta ${drv} = ${atteso} (reale ${r.eta[drv]})`), vicini(r.eta[drv], atteso));
  }
  b.uguale(q('ordine finale'), r.ordine, caso.atteso.ordine);
  b.uguale(q('ordine al congelamento'), r.ordineIniziale, caso.atteso.ordineIniziale);
  b.uguale(q('esclusi con motivo'), r.esclusi, caso.atteso.esclusi);

  // (b) + (c) il null è null, e non entra nell'ordine da nessuna porta
  for (const [drv, atteso] of Object.entries(caso.atteso.cum)) {
    if (atteso === null) {
      b.verifica(q(`${drv} ha cum null, non un numero (E06)`), r.cum[drv] === null);
      b.verifica(q(`${drv} non compare nell'ordine`), !r.ordine.includes(drv));
      b.verifica(q(`${drv} è a referto fra gli esclusi`), r.esclusi.some((e) => e.drv === drv));
    }
  }

  // (d) quanti cambi, non quali
  b.uguale(q('cambi di posizione'), cambiDiPosizione(r.ordineIniziale, r.ordine), caso.atteso.cambi_posizione);
}

b.chiudi();
