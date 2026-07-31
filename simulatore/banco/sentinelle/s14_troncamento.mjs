// s14_troncamento — regola 5 su OGNI misura a congelamento del repo (E15).
//
// Per ogni voce del registro banco/misure_congelamento.mjs: eseguirla su byLap
// intero e su byLap troncato a Lf deve dare lo STESSO risultato. Se differisce,
// quella misura sta leggendo oltre Lf — cioè sbircia il futuro, ed è la fuga
// che nel vecchio repo ha spostato la misura del gradino (leggeva fino a 6 giri
// dopo il congelamento).
//
// COSA FA FALLIRE QUESTA SENTINELLA:
//  (a) una misura registrata dà risultati diversi su dati interi e troncati —
//      la fuga dal futuro, presa sul fatto;
//  (b) una funzione esportata di engine/ o scenario/ ha un parametro di
//      congelamento (`freezeLap`, `finoA`) ma NON è nel registro: sarebbe una
//      misura a congelamento senza sentinella, cioè E15 che riapre la porta;
//  (c) il troncamento non toglie niente (Lf oltre la fine della gara) o il
//      registro è vuoto: due insiemi vuoti coincidono sempre e il test non
//      proverebbe nulla (E09);
//  (d) una misura registrata restituisce sempre lo stesso valore qualunque sia
//      Lf: sarebbe invariante per un motivo sbagliato — non perché non guarda
//      il futuro, ma perché non guarda niente.

import { banco } from '../asserzioni.mjs';
import { readFileSync, readdirSync, existsSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { caricaGara, fontiGare2026 } from '../../provenienza/gare_2026.mjs';
import { caricaPrior } from '../../provenienza/pitloss.mjs';
import { caricaCostanti } from '../../scenario/director.mjs';
import { MISURE_A_CONGELAMENTO, NOMI_REGISTRATI } from '../misure_congelamento.mjs';

const b = banco('s14');
const radice = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const modello = JSON.parse(readFileSync(path.join(radice, 'data', 'modelli', 'modello_v2.json'), 'utf8'));

b.verifica('il registro delle misure a congelamento non è vuoto', MISURE_A_CONGELAMENTO.length > 0);

// Fixture: due gare reali del grezzo pinnato, a due congelamenti diversi.
const fonti = fontiGare2026(radice);
const CASI = [['Ungheria', 30], ['Ungheria', 45], ['Miami', 20], ['Monaco', 40]];

for (const [nomeGara, Lf] of CASI) {
  const gara = caricaGara(fonti[nomeGara].fonteAbs, nomeGara);
  const ctx = {
    nGiri: gara.nGiri, rho: modello.rho.valore, delta70: modello.delta_70.scelto,
    nomeGara, modello, prior: caricaPrior(radice), costantiDirector: caricaCostanti(radice),
  };
  const troncate = gara.righe.filter((r) => r.lap <= Lf);

  // (c) il troncamento deve togliere davvero qualcosa
  b.verifica(`${nomeGara}@${Lf}: il troncamento toglie giri (altrimenti non prova nulla)`, troncate.length < gara.righe.length);

  for (const misura of MISURE_A_CONGELAMENTO) {
    const intero = misura.esegui(gara.righe, Lf, ctx);
    const troncato = misura.esegui(troncate, Lf, ctx);
    b.uguale(`${misura.nome} @ ${nomeGara} Lf=${Lf}: identica su dati interi e troncati`, troncato, intero);

    // (d) e deve dipendere da Lf, altrimenti l'invarianza è vuota
    const altroLf = Lf - 5;
    const adAltroLf = misura.esegui(gara.righe, altroLf, ctx);
    b.verifica(
      `${misura.nome}: il risultato cambia fra Lf=${Lf} e Lf=${altroLf} (l'invarianza non è banale)`,
      JSON.stringify(adAltroLf) !== JSON.stringify(intero),
    );
  }
}

// (b) nessuna misura a congelamento fuori dal registro
const FIRMA = /export function (\w+)\s*\(([^)]*)\)/g;
const PARAMETRI_DI_CONGELAMENTO = /\b(freezeLap|finoA)\b/;
const sorgenti = [];
const visita = (dir) => {
  for (const nome of readdirSync(dir)) {
    const p = path.join(dir, nome);
    if (statSync(p).isDirectory()) visita(p);
    else if (nome.endsWith('.mjs')) sorgenti.push(p);
  }
};
for (const albero of ['engine', 'scenario', 'live']) {
  const dir = path.join(radice, albero);
  if (existsSync(dir)) visita(dir);
}
b.verifica('ci sono sorgenti da controllare', sorgenti.length > 0);
for (const file of sorgenti) {
  const testo = readFileSync(file, 'utf8');
  const rel = path.relative(radice, file).split(path.sep).join('/');
  for (const [, nome, parametri] of testo.matchAll(FIRMA)) {
    if (!PARAMETRI_DI_CONGELAMENTO.test(parametri)) continue;
    b.verifica(
      `${rel}: ${nome}() prende un parametro di congelamento ⇒ deve stare nel registro di banco/misure_congelamento.mjs`,
      NOMI_REGISTRATI.has(nome),
    );
  }
}

b.chiudi();
