// s29_vista_e_motore — ogni vista pubblicata dichiara con COSA e' stata fatta, e
// quel "cosa" deve essere il motore di oggi.
//
// PERCHE' ESISTE, ed e' il prerequisito di un'altra cosa. La direttiva del PO
// (01/08/2026) e' che ogni gara nuova ri-stimi tutto e renda il progetto piu'
// preciso. Ma il generatore delle viste gira UNA GARA ALLA VOLTA — `auto_gara.py`
// lo chiama con la sola gara appena corsa — quindi il giorno in cui rho, delta70,
// c, tau o la banda si muovono, le viste delle ALTRE gare restano calcolate col
// motore vecchio.
//
// Nessuno se ne accorgerebbe. La pagina non calcola (regola 8): mostra quello che
// trova nel JSON, e un JSON vecchio e' indistinguibile da uno nuovo a occhio. Il
// sito direbbe una cosa e il motore un'altra, che e' E12 portato alla scala del
// prodotto — la voce piu' cara del catalogo.
//
// Percio' questa sentinella viene PRIMA dell'automazione della ri-stima, non dopo:
// e' quella che rende l'automazione sicura. Se diventa rossa, la risposta non e'
// allentarla — e' rigenerare le viste (`node web/genera_vista_gara.mjs`).
//
// COSA FA FALLIRE QUESTA SENTINELLA:
//  (a) una vista e' stata generata con rho o delta70 diversi da quelli cablati oggi;
//  (b) una vista e' stata generata con un rodaggio diverso — parametri diversi
//      OPPURE lo stesso parametro ma acceso/spento (sono due motori distinti);
//  (c) una vista e' stata generata con una banda di rientro o un prior di pit-loss
//      diversi da quelli su disco (confronto per CONTENUTO, non per data);
//  (d) una vista non porta affatto il timbro: senza, (a)-(c) non provano niente e
//      la divergenza tornerebbe silenziosa;
//  (e) il confronto e' vuoto — nessuna vista su disco — che passerebbe sempre (E09).

import { banco } from '../asserzioni.mjs';
import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { sha256Corto, impronteRodaggio } from '../../web/genera_vista_gara.mjs';

const b = banco('s29');
const radice = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const dove = path.join(radice, '..', 'demo', 'data', 'vista');

const modello = JSON.parse(readFileSync(path.join(radice, 'data', 'modelli', 'modello_v2.json'), 'utf8'));
const atteso = {
  rho: modello.rho.valore,
  delta_70: modello.delta_70.scelto,
  rodaggio: impronteRodaggio(modello),
  banda: sha256Corto(path.join(radice, 'data', 'modelli', 'banda_rientro.json')),
  pitloss: sha256Corto(path.join(radice, 'data', 'priors', 'pitloss_priors.json')),
};

// (e) il confronto non e' vuoto
b.verifica('la cartella delle viste esiste', existsSync(dove));
const gare = existsSync(dove)
  ? readdirSync(dove, { withFileTypes: true })
    .filter((v) => v.isDirectory() && existsSync(path.join(dove, v.name, 'indice.json')))
    .map((v) => v.name).sort()
  : [];
b.verifica(`ci sono viste pubblicate da confrontare (${gare.length})`, gare.length > 0);

for (const g of gare) {
  const indice = JSON.parse(readFileSync(path.join(dove, g, 'indice.json'), 'utf8'));
  const m = indice.modello;

  // (d) il timbro c'e'
  b.verifica(`${g}: la vista porta il timbro del modello`, m !== null && m !== undefined && typeof m === 'object');
  if (!m) continue;
  b.verifica(`${g}: il timbro dichiara il rodaggio`, m.rodaggio !== null && typeof m.rodaggio === 'object');
  b.verifica(`${g}: il timbro dichiara la banda di rientro`, typeof m.banda_rientro_sha256 === 'string');

  // (a) i coefficienti scalari
  b.uguale(`${g}: ρ della vista è quello cablato`, m.rho, atteso.rho);
  b.uguale(`${g}: δ₇₀ della vista è quello cablato`, m.delta_70, atteso.delta_70);

  // (b) il rodaggio, parametri E interruttore
  b.uguale(`${g}: il rodaggio della vista è quello cablato`, m.rodaggio ?? null, atteso.rodaggio);

  // (c) gli artefatti, per contenuto
  b.uguale(`${g}: la banda di rientro della vista è quella su disco`, m.banda_rientro_sha256 ?? null, atteso.banda);
  b.uguale(`${g}: il prior di pit-loss della vista è quello su disco`, m.pitloss_sha256 ?? null, atteso.pitloss);
}

b.chiudi();
