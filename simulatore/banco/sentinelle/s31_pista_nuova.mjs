// s31_pista_nuova — una gara pubblicata non deve cadere nel ripiego per una riga
// mancante in una mappa scritta a mano.
//
// PERCHE' ESISTE. La traduzione «nome della gara sul sito» -> «Gran Premio del
// fondo» vive in due oggetti compilati a mano in provenienza/pitloss.mjs. Il
// giorno in cui il calendario porta una pista nuova, quella riga manca, e il
// motore NON si lamenta: usa il pit-loss di ripiego (la mediana d'era) e stampa
// «circuito NON misurato ne' dal prior ne' dal fondo».
//
// Il 01/08/2026 era il caso dell'OLANDA, che corre il 23. Il pit-loss di
// Zandvoort era gia' misurato sul fondo E promosso — 22,382 s su 85 soste verdi —
// e il motore stava per ignorarlo per una riga mancante, dichiarando all'utente
// una frase falsa sulla propria ignoranza.
//
// COSA FA FALLIRE QUESTA SENTINELLA:
//  (a) una gara del registro non ha una traduzione verso il fondo, mentre il fondo
//      quel Gran Premio ce l'ha misurato e promosso: si sta buttando via un dato
//      che esiste;
//  (b) una gara cade nel `_fallback` pur avendo una misura interna promossa;
//  (c) la mappa punta a un Gran Premio che nel fondo non esiste (refuso di nome).

import { banco } from '../asserzioni.mjs';
import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { GP_PER_GARA, perditaBox } from '../../provenienza/pitloss.mjs';
import { caricaPrior } from '../../provenienza/pitloss_dati.mjs';

const b = banco('s31');
const radice = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const prior = caricaPrior(radice);

// i Gran Premi che il fondo ha misurato e PROMOSSO
const interno = path.join(radice, 'data', 'modelli', 'pitloss_interno.json');
b.verifica('la misura interna del pit-loss esiste', existsSync(interno));
const promossi = new Set(
  Object.entries(JSON.parse(readFileSync(interno, 'utf8')).circuiti ?? {})
    .filter(([, v]) => v.cancello_A?.promosso === true).map(([k]) => k),
);
b.verifica(`ci sono Gran Premi promossi da confrontare (${promossi.size})`, promossi.size > 0);

// (c) la mappa non punta nel vuoto
const nelFondo = new Set();
const base = path.join(radice, 'data', 'fondo');
if (existsSync(base)) {
  for (const anno of readdirSync(base).filter((a) => /^\d{4}$/.test(a))) {
    for (const gp of readdirSync(path.join(base, anno))) nelFondo.add(gp);
  }
}
for (const [gara, gp] of Object.entries(GP_PER_GARA)) {
  b.verifica(`${gara} -> ${gp}: il Gran Premio esiste nel fondo`, nelFondo.has(gp));
}

// (a) e (b): ogni gara del registro che il fondo misura deve USARE quella misura
const registro = path.join(radice, '..', 'demo', 'data', 'vista', 'manifest.json');
const gareSito = existsSync(registro)
  ? Object.keys(JSON.parse(readFileSync(registro, 'utf8')).cartella_di ?? {})
  : [];
b.verifica(`ci sono gare pubblicate da controllare (${gareSito.length})`, gareSito.length > 0);

for (const gara of gareSito) {
  const chiave = gara.replace(/\s/g, '');
  const gp = GP_PER_GARA[chiave] ?? GP_PER_GARA[gara];
  let x = null;
  try { x = perditaBox(prior, chiave, null); } catch { x = null; }
  if (!x) { b.verifica(`${gara}: il pit-loss si calcola`, false); continue; }
  // se il fondo lo misura, il motore deve usarlo
  const misuratoDalFondo = gp !== undefined && promossi.has(gp);
  if (misuratoDalFondo) {
    b.uguale(`${gara}: usa la misura interna e non il ripiego`, x.fonte, 'misura_interna');
    b.verifica(`${gara}: non e' marcata fallback`, x.fallback === false);
  } else if (x.fallback === true) {
    // cade nel ripiego: e' ammesso SOLO se il fondo davvero non lo misura
    const candidati = [...promossi].filter((p) => p.toLowerCase().includes(chiave.slice(0, 4).toLowerCase()));
    b.uguale(`${gara}: cade nel ripiego e il fondo davvero non lo misura`, candidati, []);
  }
}

b.chiudi();
