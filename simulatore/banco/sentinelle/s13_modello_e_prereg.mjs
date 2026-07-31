// s13_modello_e_prereg — il modello dice da dove viene, e il vecchio si spegne.
//
// COSA FA FALLIRE QUESTA SENTINELLA:
//  (a) modello_v2.json perde un pezzo della targhetta (tipo, data, fonte, hash
//      della vista, ricetta di stima, incertezza): un numero senza targhetta
//      non è utilizzabile (regola 2), e uno senza hash della fonte non è
//      rifacibile (regola 7);
//  (b) il δ cablato non è quello che l'esperimento ha deciso, o l'esperimento
//      non è quello pre-registrato: è E21 che rientra dalla finestra (una
//      scelta silenziosa al posto di un esperimento);
//  (c) i perdenti spariscono dal referto: una misura non si cancella perché ha
//      perso;
//  (d) ρ ha un IC che contiene lo zero: la prereg dichiara che in quel caso
//      l'esperimento su δ non è interpretabile;
//  (e) un sorgente dell'engine legge i MODELLI VECCHI di data/storico/: quando
//      un modello ne sostituisce un altro, i pezzi vecchi si spengono INSIEME
//      (E20);
//  (f) la prereg non esiste più, o è stata scritta dopo l'esito (il commit che
//      la data è nella storia: qui si controlla almeno che esista e dichiari
//      metrica e regola di decisione PRIMA dei numeri).

import { banco } from '../asserzioni.mjs';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const b = banco('s13');
const radice = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const modello = JSON.parse(readFileSync(path.join(radice, 'data', 'modelli', 'modello_v2.json'), 'utf8'));
const esito = JSON.parse(readFileSync(path.join(radice, 'banco', 'prereg', 'ESITO_delta.json'), 'utf8'));

// (a) targhetta completa
for (const campo of ['tipo', 'modello', 'stimatore', 'identificazione', 'incertezza', 'data', 'fonte', 'sha256_vista', 'prodotto_da']) {
  b.verifica(`la targhetta del modello dichiara "${campo}"`, typeof modello._targhetta[campo] === 'string' && modello._targhetta[campo].length > 0);
}
b.verifica('la vista citata dalla targhetta esiste', existsSync(path.join(radice, modello._targhetta.fonte)));
b.verifica('ρ porta la sua targhetta', typeof modello.rho.targhetta === 'string');
b.verifica('ρ porta il suo IC95', Array.isArray(modello.rho.ic95) && modello.rho.ic95.length === 2);

// (b) il cablato è ciò che l'esperimento ha deciso
b.verifica('un δ è stato scelto', typeof modello.delta_70.scelto === 'number');
b.uguale('il braccio vincente del modello è quello dell\'esito', modello.delta_70.decisione.braccio_vincente, esito.vincitore);
b.uguale('il modello punta alla prereg giusta', modello.delta_70.decisione.esperimento, 'banco/prereg/PREREG_delta.md');
b.verifica('l\'esito dichiara di essere stato eseguito sotto quella prereg', esito._targhetta.prereg === 'banco/prereg/PREREG_delta.md');
b.uguale('ρ dell\'esperimento è ρ del modello', esito._targhetta.rho_usato, modello.rho.valore);
b.verifica('l\'esito non è dichiarato non decisivo', esito.non_decisivo === false);
b.verifica('il vincitore passa il cancello di sanità pre-registrato', esito.cancello_sanita.passa === true);

// (c) i perdenti restano a referto, con targhetta
const perdenti = modello.delta_70.decisione.perdenti_a_referto;
b.uguale('i perdenti a referto sono due', perdenti.length, 2);
for (const p of perdenti) {
  b.verifica(`il perdente ${p.braccio} porta il suo numero`, typeof p.max_bias_assoluto === 'number');
  b.verifica(`il perdente ${p.braccio} porta la targhetta`, typeof p.targhetta === 'string' && p.targhetta.length > 0);
}
b.verifica('la stima libera resta nel modello anche se non è stata cablata', typeof modello.delta_70.stimato_libero === 'number');

// (d) ρ identificato
const [rhoBasso, rhoAlto] = modello.rho.ic95;
b.verifica(`l'IC95 di ρ esclude lo zero (${rhoBasso} … ${rhoAlto})`, rhoBasso > 0);

// (e) i modelli vecchi restano spenti
const VECCHI = [/data\/storico/, /modello_degrado_2026/, /modello_traffico_2026/];
const visita = (dir, trovati) => {
  for (const nome of readdirSync(dir)) {
    const p = path.join(dir, nome);
    if (statSync(p).isDirectory()) { visita(p, trovati); continue; }
    if (/\.(mjs|js|py)$/.test(nome)) trovati.push(p);
  }
  return trovati;
};
for (const albero of ['engine', 'fisica', 'scenario', 'live', 'web']) {
  const dir = path.join(radice, albero);
  if (!existsSync(dir)) continue;
  for (const file of visita(dir, [])) {
    const testo = readFileSync(file, 'utf8');
    const rel = path.relative(radice, file).split(path.sep).join('/');
    for (const vecchio of VECCHI) {
      b.verifica(`${rel} non legge i modelli vecchi (${vecchio.source}) — E20`, !vecchio.test(testo));
    }
  }
}

// (f) la prereg esiste e dichiara metrica e decisione
const prereg = path.join(radice, 'banco', 'prereg', 'PREREG_delta.md');
b.verifica('la prereg di δ esiste', existsSync(prereg));
if (existsSync(prereg)) {
  const testo = readFileSync(prereg, 'utf8');
  b.verifica('la prereg dichiara di essere stata scritta prima', /PRIMA di eseguire/i.test(testo));
  b.verifica('la prereg dichiara la metrica', /## Metrica/.test(testo));
  b.verifica('la prereg dichiara la regola di decisione', /## Regola di decisione/.test(testo));
  b.verifica('la prereg dichiara il cancello di sanità', /## Cancello di sanità/.test(testo));
}

b.chiudi();
